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
    for (uint32_t i = 0; i < nTicks; ++i) {
        ++Status.ulTotalTickCounter;
        Status.fTotalConsumedValue += Config.fUnitPerTick;
        Status.fTodayConsumedValue += Config.fUnitPerTick;
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
}

int CGasCounter::receiveEvent(const void * pSender, int nMsg, const void * pMessage, int nMsgInfo) {
    if (nMsg == MSG_APPL_SHUTDOWN) {
        dispatch();
        saveState(true);
    }
    return EVENT_MSG_RESULT_OK ;
}

/**
 * @brief Erzeugt Home-Assistant-Sensoreinträge mit Geräte-ID und JSON-Wertvorlage.
 * Topic und Verfügbarkeit stammen aus dem übergeordneten Discovery-Dokument.
 */
void CGasCounter::insertComponentDiscovery(const char * pszComponentName,JsonNode & oComponents, CMQTTController *pController) {
    // State topic and availability are supplied by the device discovery document.
    struct SensorDiscovery {
        const char *pszField;
        const char *pszName;
        const char *pszDeviceClass;
        const char *pszUnit;
        const char *pszStateClass;
    };
    const SensorDiscovery tSensors[] = {
        {"TickCounter", "Gas Impulse", nullptr, "imp", "total_increasing"},
        {"m3hPerTick", "Gas pro Impuls", "gas", "m³", nullptr},
//        {"m3hTotal", "Gasverbrauch gesamt", "gas", "m³", "total_increasing"},
//        {"m3hToday", "Gasverbrauch heute", "gas", "m³", "total_increasing"},
        // Previous-day and rolling-hour values are not increasing counters.
//        {"m3hPrevday", "Gasverbrauch gestern", "gas", "m³", nullptr},
//        {"m3hLastHour", "Gasverbrauch letzte Stunde", nullptr, "m³", "measurement"},
        {"m3hCurrent", "Gasdurchfluss", "volume_flow_rate", "m³/h", "measurement"}
    };

    for (const auto &oSensor : tSensors) {
        String strComponentID = pszComponentName;
        strComponentID += "_";
        strComponentID += oSensor.pszField;
        String strUniqueID = Appl.getDeviceID();
        strUniqueID += "-";
        strUniqueID += strComponentID;

        // Keep the original precision, especially for small configured tick volumes.
        String strValueTemplate = "{{ value_json.";
        strValueTemplate += pszComponentName;
        strValueTemplate += ".";
        strValueTemplate += oSensor.pszField;
        strValueTemplate += " }}";

        JsonNode *pSensor = oComponents.getObject(strComponentID.c_str(), true);
        pSensor->setValue("p", "sensor");
        pSensor->setValue("name", oSensor.pszName);
        pSensor->setValue("unique_id", strUniqueID.c_str());
        pSensor->setValue("value_template", strValueTemplate.c_str());
        pSensor->setValue("unit_of_measurement", oSensor.pszUnit);
        pSensor->setValue("icon", "mdi:fire");
        if (oSensor.pszDeviceClass != nullptr) {
            pSensor->setValue("device_class", oSensor.pszDeviceClass);
        }
        if (oSensor.pszStateClass != nullptr) {
            pSensor->setValue("state_class", oSensor.pszStateClass);
        }
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

#pragma endregion
