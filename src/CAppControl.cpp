/**
 * CAppControl.cpp
 *
 * (c) 2024/25 LSC Labs - P. Liebl
 *
 * Application Control Module
 * Use this module to implement the main application logic.
 *
 * Receives events from all modules and dispatches actions accordingly.
 * GasCounter tick events are stored and dispatched in batch to avoid
 * publishing nested state messages from the tick event handler.
 *
 */


#include <Appl.h>
#include <AppControl.h>
#include <EventHandler.h>
#include <LSCUtils.h>
#include <GasCounter.h>

// Intervall für die regelmäßige Veröffentlichung des States (Home Assistant).
// Ohne sie fiele z.B. der Durchfluss in HA nie auf 0 und "Heute" würde erst
// beim nächsten Impuls nach Mitternacht zurückgesetzt.
#ifndef APP_STATE_PUBLISH_INTERVAL_MS
    #define APP_STATE_PUBLISH_INTERVAL_MS 60000UL
#endif


/**
 * @brief Erzeugt die Anwendungssteuerung mit leerer Impulswarteschlange.
 */
CAppControl::CAppControl()
{
    // Constructor implementation (if needed)
}

/**
 * @brief Merkt Impulse und Statusanforderungen zur späteren MQTT-Veröffentlichung.
 * CGasCounter sendet diese Ereignisse aus dispatch(), niemals aus dem Interrupt.
 * Hier wird nichts gesendet - das erfolgt in dispatch() (keine verschachtelten Events).
 */
int CAppControl::receiveEvent(const void* pSender, int nMsgID, const void * pMsg, int nMsgClass)
{
    int nResult = EVENT_MSG_RESULT_OK;
    switch(nMsgID)
    {
        case MSG_APPL_INITIALIZED:
            // Process when the application is initializing
            break;

        case MSG_APPL_STARTED:
            // Process when the application is up and running
            break;

        case MSG_RESTART_REQUEST:
            // Process some save actions if needed and prepare shutdown
            break;

        case MSG_MQTT_CONNECTED:
            // Send the current state right after (re)connect - HA would show "unknown" otherwise
            m_bMqttConnected = true;
            m_bPublishStateRequested = true;
            break;

        case MSG_MQTT_DISCONNECTED:
            m_bMqttConnected = false;
            break;

        case MSG_GASCOUNTER_READING_SET:
            // New meter reading - publish immediately
            m_bPublishStateRequested = true;
            break;

        case  MSG_GASCOUNTER_TICK: {
            // Remember the tick, as we are in an event, do not send immediately...
            GasCounterTickMsg *pTickMsg = new GasCounterTickMsg((CGasCounter *) pSender);
            this->tGasCounterTicks.push_back(pTickMsg);
            break;
        }
    }
    return nResult; // Return appropriate status
}

/**
 * @brief Dispatch stored events and process them.
 * Impulse werden einzeln veröffentlicht; zusätzlich wird der State regelmäßig
 * (APP_STATE_PUBLISH_INTERVAL_MS) und auf Anforderung veröffentlicht.
 */
void CAppControl::dispatch()
{
    // Dispatch stored GasCounterTickMsg events
    for (auto pTickMsg : this->tGasCounterTicks)
    {
        publishState("tick", pTickMsg);
        delete pTickMsg;
    }
    this->tGasCounterTicks.clear();

    if (m_bMqttConnected &&
        (m_bPublishStateRequested || millis() - m_ulLastStatePublish >= APP_STATE_PUBLISH_INTERVAL_MS)) {
        publishState("state");
    }
}

/**
 * @brief Veröffentlicht den kompletten Gerätestatus auf dem State-Topic.
 * Home Assistant liest alle Sensorwerte per value_template aus diesem Dokument.
 * @param pszType   "tick" bei einem Impuls, sonst "state"
 * @param pTickMsg  Impulsinformationen (nur bei "tick")
 */
void CAppControl::publishState(const char *pszType, GasCounterTickMsg *pTickMsg)
{
    JsonNode oMsgDoc;
    // Include the registered component states used by Home Assistant discovery.
    Appl.writeStatusTo(oMsgDoc, STATUS_LEVEL_STATE);
    oMsgDoc["type"] = pszType;
    if (pTickMsg) {
        char tTimeBuffer[25];
        oMsgDoc["unitPerTick"]  = pTickMsg->fUnitPerTick;
        oMsgDoc["timestamp"]    = pTickMsg->oTimeStamp;
        oMsgDoc["isotime"]      = LSC::getISODateTime(pTickMsg->oTimeStamp,tTimeBuffer,sizeof(tTimeBuffer));
    }
    Appl.MsgBus.sendEvent(this,MSG_MQTT_SEND_JSONSTATE,&oMsgDoc,0);
    m_ulLastStatePublish = millis();
    m_bPublishStateRequested = false;
}
