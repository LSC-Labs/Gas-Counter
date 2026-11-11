#ifndef DEBUG_LSC_GASCOUNTER
    #undef DEBUGINFOS
#endif

#include <GasCounter.h>
#include <DevelopmentHelper.h>
#include <FunctionalInterrupt.h>
#include <Appl.h>
#include <AppConfig.h>
#include <interrupts.h>
#include <math.h>
#include <stdlib.h>
#include <WebSocket.h>
#include <AccessToken.h>
#include <Security.h>

// Obergrenze für einen plausiblen Zählerstand (m³).
#define GASCOUNTER_MAX_METER_READING 99999999.0

#pragma region Constructor, Desctrutor and Setup

/**
 * @brief Erzeugt einen Zähler ohne zugewiesenen Eingang; Monitoring muss separat gestartet werden.
 */
CGasCounter::CGasCounter()
    : IModule(), IHomeAssistantComponent()
{
}

/**
 * @brief Ruft die Eingangskonfiguration auf; registriert noch keinen Interrupt.
 */
CGasCounter::CGasCounter(int nPortNumber)
    : IModule(), IHomeAssistantComponent()
{
    setup(nPortNumber);
}

/**
 * @brief Meldet den Interrupt vor dem Freigeben der Instanz ab.
 */
CGasCounter::~CGasCounter()
{
    if (m_bMonitoring) detachInterrupt(m_nPin);
}

/**
 * @brief Konfiguriert den eigenen Eingang aktiv-low mit Pull-up; beendet ggf. das Monitoring.
 */
void CGasCounter::setup(int nPortNumber)
{
    if (m_bMonitoring) {
        detachInterrupt(m_nPin);
        m_bMonitoring = false;
        dispatch(); // Bereits erfasste Impulse noch mit der bisherigen Konfiguration verbuchen.
    }
    CInputPinController::setup(nPortNumber, true, true);
}

/**
 * @brief Übernimmt Impulse atomar und verarbeitet Verbrauch/Ereignisse im Hauptprogramm.
 * Die kritische Sektion enthält nur Kopien von Ganzzahlen. Neue Impulse während
 * der Verarbeitung bleiben für den nächsten Aufruf erhalten. Aufgestaute Impulse
 * werden dem Verarbeitungszeitpunkt zugeordnet (Minuten- und Tagesintervall).
 */
void CGasCounter::dispatch() {
    uint32_t nTicks, nLastTick, nPeriod;
    {
        esp8266::InterruptLock lock;
        nTicks = m_ulPendingTicks;
        nLastTick = m_ulLastTickMillis;
        nPeriod = m_ulTickPeriodMillis;
        m_ulPendingTicks = 0;
    }

    adjustDayCounters();
    storeMinuteValue();
    if (nTicks == 0) {
        // Nach langem Stillstand darf ein millis()-Umlauf keinen alten Durchfluss reaktivieren.
        if (getCurrentConsumedCubicMeters() == 0.0f) Status.ulPeriodTimeMillis = 0;
        saveState();
        return;
    }

    Status.ulLastCountInMillis = nLastTick;
    Status.ulPeriodTimeMillis = nPeriod;
    const time_t tNow = time(nullptr);
    if (tNow >= 946684800) Status.tLastTickTime = tNow;   // nur mit synchronisierter Uhr
    // Impulsvolumen auf 6 Nachkommastellen runden, damit z.B. 0.01f exakt als 0.01 summiert wird.
    const double dUnitPerTick = round(static_cast<double>(Config.fUnitPerTick) * 1e6) / 1e6;
    for (uint32_t i = 0; i < nTicks; ++i) {
        ++Status.ulTotalTickCounter;
        Status.fTotalConsumedValue += Config.fUnitPerTick;
        Status.fTodayConsumedValue += Config.fUnitPerTick;
        Status.dMeterReading += dUnitPerTick;
        Status.tfMinuteValues[Status.nCurrentMinuteIndex] += Config.fUnitPerTick;
        // Der synchrone Bus und seine Empfänger dürfen jetzt Speicher allozieren.
        Appl.MsgBus.sendEvent(this, MSG_GASCOUNTER_TICK, nullptr, m_nPin);
    }
    saveState();
}

/**
 * @brief Wechselt den Tageszähler einmal pro vorwärts laufendem lokalen Datum.
 * Ohne gültige Zeit bleibt der Zähler erhalten; die erste Synchronisation setzt
 * nur das Bezugsdatum. Rückwärtssprünge lösen keinen erneuten Tageswechsel aus.
 */
void CGasCounter::adjustDayCounters() {
    struct tm tmLocal = {};
    if (!getLocalTimeStruct(&tmLocal)) return;

    // Gregorianische Tagesnummer ohne Abhängigkeit von 23-/25-Stunden-Tagen (Sommerzeit).
    const long nPreviousYear = tmLocal.tm_year + 1899L;
    const long nDay = 365L * nPreviousYear + nPreviousYear / 4
                   - nPreviousYear / 100 + nPreviousYear / 400 + tmLocal.tm_yday;
    if (m_lCurrentDay < 0) {
        m_lCurrentDay = nDay;
    } else if (nDay > m_lCurrentDay) {
        Status.fYesterdayConsumedValue = nDay == m_lCurrentDay + 1
                                       ? Status.fTodayConsumedValue : 0.0f;
        Status.fTodayConsumedValue = 0.0f;
        m_lCurrentDay = nDay;
    }
}

#pragma endregion

#pragma Interface implementation

/**
 * @brief Schreibt Impulsvolumen (m³) und Diagrammskalen in den Konfigurationsknoten.
 * bHideCritical bleibt ungenutzt, da diese Werte keine Zugangsdaten enthalten.
 */
void CGasCounter::writeConfigTo(JsonNode &oCfgNode, bool bHideCritical)
{
    oCfgNode["m3PerTick"]       = Config.fUnitPerTick;
    oCfgNode["maxRateHourly"]   = Config.fMaxRateHourly;
    oCfgNode["maxRateDaily"]    = Config.fMaxRateDaily;
}

/**
 * @brief Lädt nur endliche, positive Werte; fehlende/ungültige Werte bleiben unverändert.
 * Der alte Tippfehler m2hPerTick wird für bestehende Konfigurationen noch gelesen,
 * sofern der korrekte Schlüssel m3PerTick fehlt. Schreiben verwendet nur m3PerTick.
 */
void CGasCounter::readConfigFrom(JsonNode &oCfgNode)
{
    // Noch ausstehende Impulse gehören zum bisherigen Impulsvolumen.
    dispatch();
    float fValue = Config.fUnitPerTick;
    const char *pszTickKey = oCfgNode.exists("m3PerTick") ? "m3PerTick" : "m2hPerTick";
    if (oCfgNode.storeValueIf(pszTickKey, &fValue) && isfinite(fValue) && fValue > 0.0f)
        Config.fUnitPerTick = fValue;
    if (oCfgNode.storeValueIf("maxRateHourly", &fValue) && isfinite(fValue) && fValue > 0.0f)
        Config.fMaxRateHourly = fValue;
    if (oCfgNode.storeValueIf("maxRateDaily", &fValue) && isfinite(fValue) && fValue > 0.0f)
        Config.fMaxRateDaily = fValue;
}

/**
 * @brief Exportiert Zählerstände und berechnete Verbrauchswerte für Web und MQTT.
 * Die historischen m3h-Feldnamen bezeichnen außer m3hCurrent Volumen in m³.
 * nLevel wird derzeit nicht zur Filterung verwendet.
 */
void CGasCounter::writeStatusTo(JsonNode &oStatusNode, int nLevel)
{
    oStatusNode["TickCounter"]     = Status.ulTotalTickCounter;
    oStatusNode["m3hPerTick"]      = Config.fUnitPerTick;
    oStatusNode["m3hTotal"]        = Status.fTotalConsumedValue;
    oStatusNode["m3hToday"]        = Status.fTodayConsumedValue;
    oStatusNode["m3hPrevday"]      = Status.fYesterdayConsumedValue;
    oStatusNode["m3hLastHour"]     = getConsumedCubicMetersInLastHour();
    oStatusNode["m3hCurrent"]      = getCurrentConsumedCubicMeters();
    // Zählerstand als JSON-Zahl mit drei Nachkommastellen (float würde Stellen verlieren).
    // Erst nach dem ersten Setzen melden: ein Sprung von 0 auf den echten Stand würde
    // in Home Assistant (total_increasing) sonst als Verbrauch verbucht.
    if (Status.bMeterReadingValid) {
        char szReading[32];
        snprintf(szReading, sizeof(szReading), "%.3f", Status.dMeterReading);
        JsonNode *pReading = oStatusNode.getElement("MeterReading", true);
        if (pReading && !pReading->parse(szReading)) pReading->setValue(static_cast<float>(Status.dMeterReading));
    }
    // Zeitpunkt des letzten Impulses (ISO 8601, UTC) - nur wenn bekannt.
    if (Status.tLastTickTime >= 946684800) {
        struct tm tmUtc = {};
        char szTime[32];
        if (gmtime_r(&Status.tLastTickTime, &tmUtc) && strftime(szTime, sizeof(szTime), "%Y-%m-%dT%H:%M:%SZ", &tmUtc) > 0)
            oStatusNode["LastTick"] = szTime;
    }
}

int CGasCounter::receiveEvent(const void * pSender, int nMsg, const void * pMessage, int nMsgInfo) {
    if (nMsg == MSG_APPL_SHUTDOWN) {
        dispatch();
        saveState(true);
    } else if (nMsg == MSG_WEBSOCKET_DATA_RECEIVED && nMsgInfo == 1 && pMessage) {
        // nMsgInfo == 1: gültiges JSON mit einem von CWebSocket nicht behandelten Kommando.
        handleWebSocketCommand(pMessage);
    }
    return EVENT_MSG_RESULT_OK ;
}

/**
 * @brief Verarbeitet das Kommando "setgasmeter" (Zählerstand setzen) im Hauptprogramm.
 * Erwartet {"command":"setgasmeter","token":"...","payload":{"meterReading":12345.678}}.
 * Nur mit gültigem Anmelde-Token, da der Zählerstand sonst von jedem verändert werden könnte.
 */
void CGasCounter::handleWebSocketCommand(const void *pMessage) {
    const CWebSocketMessage *pWSMessage = static_cast<const CWebSocketMessage *>(pMessage);
    if (!pWSMessage->pSerializedMessage) return;
    JsonNode oRequest;
    if (!oRequest.parse(pWSMessage->pSerializedMessage)) return;
    String strCommand = oRequest.getValue("command");
    if (!strCommand.equalsIgnoreCase(F("setgasmeter"))) return;

    String strToken = oRequest.getValue("token");
    String strRemoteIP = pWSMessage->RemoteIP.toString();
    CAccessToken oToken(strToken.c_str());
    if (strToken.length() <= 10 || !oToken.isAuthValid(strRemoteIP.c_str(), APPL_SECURITY_TOKEN_KEY)) {
        Appl.Log.logError(F("GasCounter: setgasmeter - access denied"));
        return;
    }
    JsonNode *pPayload = oRequest.getObject("payload");
    JsonNode *pValue = pPayload ? pPayload->getElement("meterReading") : nullptr;
    const char *pszValue = pValue ? pValue->getValue() : nullptr;
    if (!pszValue || !*pszValue) return;
    char *pEnd = nullptr;
    const double dValue = strtod(pszValue, &pEnd);
    if (pEnd == pszValue || *pEnd || !setMeterReading(dValue)) {
        Appl.Log.logError(F("GasCounter: setgasmeter - invalid value"));
        return;
    }
    char szInfo[64];
    snprintf(szInfo, sizeof(szInfo), "GasCounter: meter reading set to %.3f m3", Status.dMeterReading);
    Appl.Log.logInfo(szInfo);
}

/**
 * @brief Erzeugt Home-Assistant-Sensoreinträge mit Geräte-ID und JSON-Wertvorlage.
 * Topic und Verfügbarkeit stammen aus dem übergeordneten Discovery-Dokument.
 */
void CGasCounter::insertComponentDiscovery(const char * pszComponentName,JsonNode & oComponents, CMQTTController *pController) {
    // State topic and availability are supplied by the device discovery document.
    // Home Assistant rules: device_class "gas" allows only state_class "total"/"total_increasing"
    // and the units L, m³, ft³, CCF, MCF. Rolling or config values must not use "gas".
    struct SensorDiscovery {
        const char *pszField;           // field in the "gascounter" status object
        const char *pszObjectID;        // suffix of the default entity id
        const char *pszName;
        const char *pszDeviceClass;
        const char *pszUnit;
        const char *pszStateClass;
        const char *pszIcon;
        int         nPrecision;         // suggested_display_precision, < 0 = not set
        bool        bDiagnostic;        // entity_category "diagnostic"
    };
    const SensorDiscovery tSensors[] = {
        // Meter reading of the gas meter - the sensor for the HA energy dashboard
        {"MeterReading", "meter_reading",   "Zählerstand",             "gas",              "m³",    "total_increasing", "mdi:meter-gas",      3, false},
        {"m3hCurrent",   "flow",            "Durchfluss",              "volume_flow_rate", "m³/h",  "measurement",      "mdi:gauge",          3, false},
        {"m3hLastHour",  "last_hour",       "Verbrauch letzte Stunde", nullptr,            "m³",    "measurement",      "mdi:fire",           2, false},
        // Reset at local midnight by the device - HA detects the decrease as a new cycle
        {"m3hToday",     "today",           "Verbrauch heute",         "gas",              "m³",    "total_increasing", "mdi:fire",           2, false},
        {"m3hPrevday",   "yesterday",       "Verbrauch gestern",       "gas",              "m³",    nullptr,            "mdi:fire",           2, false},
        {"m3hTotal",     "total",           "Verbrauch gesamt",        "gas",              "m³",    "total_increasing", "mdi:fire",           2, false},
        {"LastTick",     "last_tick",       "Letzter Impuls",          "timestamp",        nullptr, nullptr,            "mdi:clock-outline", -1, false},
        {"TickCounter",  "ticks",           "Impulse",                 nullptr,            "imp",   "total_increasing", "mdi:counter",        0, true},
        {"m3hPerTick",   "volume_per_tick", "Volumen pro Impuls",      nullptr,            "m³",    nullptr,            "mdi:water-outline",  3, true},
    };

    for (const auto &oSensor : tSensors) {
        String strComponentID = pszComponentName;
        strComponentID += "_";
        strComponentID += oSensor.pszField;
        String strUniqueID = Appl.getDeviceID();
        strUniqueID += "-";
        strUniqueID += strComponentID;
        // Stable entity ids (sensor.gascounter_meter_reading, ...) - used by the HA templates/dashboard
        String strEntityID = "sensor.";
        strEntityID += pszComponentName;
        strEntityID += "_";
        strEntityID += oSensor.pszObjectID;

        // A missing value (i.e. no last tick yet) renders "None" => state "unknown".
        String strValueTemplate = "{{ value_json.";
        strValueTemplate += pszComponentName;
        strValueTemplate += ".";
        strValueTemplate += oSensor.pszField;
        strValueTemplate += " | default(None) }}";

        JsonNode *pSensor = oComponents.getObject(strComponentID.c_str(), true);
        pSensor->setValue("p", "sensor");
        pSensor->setValue("name", oSensor.pszName);
        pSensor->setValue("unique_id", strUniqueID.c_str());
        pSensor->setValue("default_entity_id", strEntityID.c_str());
        pSensor->setValue("value_template", strValueTemplate.c_str());
        pSensor->setValue("icon", oSensor.pszIcon);
        if (oSensor.pszUnit)         pSensor->setValue("unit_of_measurement", oSensor.pszUnit);
        if (oSensor.pszDeviceClass)  pSensor->setValue("device_class", oSensor.pszDeviceClass);
        if (oSensor.pszStateClass)   pSensor->setValue("state_class", oSensor.pszStateClass);
        if (oSensor.nPrecision >= 0) pSensor->setValue("suggested_display_precision", oSensor.nPrecision);
        if (oSensor.bDiagnostic)     pSensor->setValue("entity_category", "diagnostic");
    }
}

#pragma endregion


#pragma Interrupt Handling and Monitoring

/**
 * @brief Aktiviert die fallende Flanke einmalig; der erste Impuls hat noch keine Periode.
 */
void CGasCounter::startMonitoring(){
    if (m_bMonitoring || !canSendInterrupts()) return;
    {
        esp8266::InterruptLock lock;
        m_bHasTick = false;
        m_ulTickPeriodMillis = 0;
    }
    Status.ulPeriodTimeMillis = 0;
    storeMinuteValue();
    attachInterrupt(m_nPin, std::bind(&CGasCounter::interruptHandler, this), FALLING);
    m_bMonitoring = true;
}

/**
 * @brief Erfasst entprellte Impulse ohne Heap, Fließkomma, Logging oder Ereignisbus.
 * Unsigned-Differenzen funktionieren auch über den 32-Bit-millis()-Überlauf hinweg.
 * Der Interruptzustand wird vom Framework wiederhergestellt, nicht hier verändert.
 */
void IRAM_ATTR CGasCounter::interruptHandler() {
    const uint32_t nNow = millis();
    const uint32_t nElapsed = nNow - m_ulLastTickMillis;
    if (m_bHasTick && nElapsed < 100U) return;

    m_ulTickPeriodMillis = m_bHasTick ? nElapsed : 0;
    m_ulLastTickMillis = nNow;
    m_bHasTick = true;
    ++m_ulPendingTicks;
}

#pragma endregion

#pragma region Gas Counter Value Handling

/**
 * @brief Schiebt den 60-Minuten-Ring anhand der Laufzeit vor und löscht abgelaufene Werte.
 * Die Summe enthält die aktuelle angebrochene und 59 vollständige Minuten
 * (Auflösung eine Minute). Kalender-/NTP-Sprünge beeinflussen den Ring nicht.
 */
void CGasCounter::storeMinuteValue()
{
    const uint32_t nNow = millis();
    if (!m_bMinuteClockStarted) {
        m_ulMinuteStartedAt = nNow;
        m_bMinuteClockStarted = true;
        return;
    }
    const uint32_t nMinutes = (nNow - m_ulMinuteStartedAt) / 60000U;
    if (nMinutes == 0) return;
    const size_t nSize = sizeof(Status.tfMinuteValues) / sizeof(Status.tfMinuteValues[0]);
    if (nMinutes >= nSize) {
        for (float &fValue : Status.tfMinuteValues) fValue = 0.0f;
        Status.nCurrentMinuteIndex = (Status.nCurrentMinuteIndex + nMinutes) % nSize;
    } else {
        for (uint32_t i = 0; i < nMinutes; ++i) {
            Status.nCurrentMinuteIndex = (Status.nCurrentMinuteIndex + 1) % nSize;
            Status.tfMinuteValues[Status.nCurrentMinuteIndex] = 0.0f;
        }
    }
    m_ulMinuteStartedAt += nMinutes * 60000U;
}

/**
 * @brief Get the local time structure
 * Use NTP Service if needed in the main application
 * @param pTimeinfo Pointer to the tm structure to fill
 * @return true if the time structure is valid, false otherwise
 * @see CNTPHandler
 */
bool CGasCounter::getLocalTimeStruct(struct tm *pTimeinfo)
{
    if (pTimeinfo == nullptr) return false;
    const time_t nNow = time(nullptr);
    return nNow != static_cast<time_t>(-1) && localtime_r(&nNow, pTimeinfo) != nullptr
        && pTimeinfo->tm_year >= 100; // Zeit vor 2000 gilt als noch nicht synchronisiert.
}


/**
 * @brief Summiert die noch gültigen Minutenverbräuche in m³, auch nach einer Pause.
 */
float CGasCounter::getConsumedCubicMetersInLastHour()
{
    storeMinuteValue();
    float fTotal = 0.0f;
    for (float fValue : Status.tfMinuteValues) fTotal += fValue;
    return fTotal;
}

/**
 * @brief Schätzt den Durchfluss in m³/h aus der letzten vollständigen Impulsperiode.
 * Bleibt der nächste Impuls aus, sinkt die Schätzung mit dessen Wartezeit.
 * Nach 60 Sekunden oder zwei Perioden (je nachdem, was länger ist) gilt
 * der Durchfluss als null. Damit bleiben auch langsame Impulsfolgen messbar.
 */
float CGasCounter::getCurrentConsumedCubicMeters()
{
    const uint32_t nPeriod = Status.ulPeriodTimeMillis;
    if (nPeriod == 0) return 0.0f;
    const uint32_t nAge = static_cast<uint32_t>(millis()) - Status.ulLastCountInMillis;
    const uint64_t nTimeout = static_cast<uint64_t>(nPeriod) * 2U;
    if (nAge >= 60000U && nAge >= nTimeout) return 0.0f;
    const uint32_t nEffectivePeriod = nAge > nPeriod ? nAge : nPeriod;
    return Config.fUnitPerTick * (3600000.0f / nEffectivePeriod);
}

/**
 * @brief Liefert die Anzahl akzeptierter Impulse seit dem letzten Gerätestart.
 */
unsigned long CGasCounter::getCurrentGasCounter()
{
    return(Status.ulTotalTickCounter);
}

/**
 * @brief Übernimmt den abgelesenen Zählerstand der Gasuhr (m³) und speichert sofort.
 * Noch ausstehende Impulse werden vorher verbucht, da sie in der Ablesung enthalten sind.
 * @return false bei ungültigem Wert (negativ, nicht endlich oder unplausibel groß).
 */
bool CGasCounter::setMeterReading(double dValue)
{
    if (!isfinite(dValue) || dValue < 0.0 || dValue > GASCOUNTER_MAX_METER_READING) return false;
    dispatch();
    // Auf 1 Liter runden, um Eingabeartefakte (z.B. 12345.6789999) zu vermeiden.
    Status.dMeterReading = round(dValue * 1000.0) / 1000.0;
    Status.bMeterReadingValid = true;
    saveState(true);
    Appl.MsgBus.sendEvent(this, MSG_GASCOUNTER_READING_SET, nullptr, 0);
    return true;
}

#pragma endregion
