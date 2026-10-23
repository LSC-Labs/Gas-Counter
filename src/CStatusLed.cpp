#include <StatusLed.h>

/**
 * @brief Zeigt den aktuellen Impulszustand statt einer zeitgesteuerten Nachleuchtdauer.
 * Die Basisklasse ruft diese Methode bei jedem MSG_APPL_LOOP auf.
 */
void CStatusLed::updateLED() {
    if (_gasCounter.isPulseActive()) {
        setColor(RGB_COLOR::GREEN);
    } else {
        CSysStatusLed::updateLED();
    }
}
