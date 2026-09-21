#include <StatusLed.h>
#include <Msgs.h>
#include <AppConfig.h>


/**
 * @brief Startet bei einem Impuls die LED-Anzeige und verarbeitet Loop-Ereignisse.
 * Andere Ereignisse werden an die Systemstatus-LED weitergereicht.
 */
int CStatusLed::receiveEvent(const void * pSender, int nMsgId, const void * pMessage, int nType) {
    int nResult = EVENT_MSG_RESULT_OK;
    switch(nMsgId) {

        // Gas counter tick event - prepare tick indication
        case MSG_GASCOUNTER_TICK:
            // Start tick indication
            _tickDelay.restart();
            break;

        // Application loop - update the LED status
        case MSG_APPL_LOOP:
            updateLED();
            break;

        // Pass other messages to base class
        default:
            nResult = CSysStatusLed::receiveEvent(pSender, nMsgId, pMessage, nType);
        break;
    }
    return(nResult);
}

/**
 * @brief Priorisiert die gelbe Impulsanzeige vor dem normalen Systemstatus.
 * Achtung: isExpired() prüft nur ein explizites Flag, nicht den Zeitablauf.
 */
void CStatusLed::updateLED() {
    if(_tickDelay.isActive()) {
        // During tick, just check if delay is complete
        if(_tickDelay.isExpired()) {
            setColor(RGB_COLOR::BLACK); // Turn off LED after tick
            _tickDelay.stop();
        } else {
            setColor(RGB_COLOR::YELLOW); // Indicate tick with yellow color
        }
    }
    else {
        CSysStatusLed::updateLED();
    }
}

