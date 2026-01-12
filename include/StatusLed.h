#pragma once

#include <SysStatusLed.h>
#include <EventHandler.h> 
#include <SimpleDelay.h>

#define STATUS_LED_TICK_INTERVAL_MS  500

class CStatusLed : public CSysStatusLed {
    protected:
        bool _bTickIsActive = false;
        CSimpleDelay _tickDelay;

    public:
        CStatusLed(int nRedPin, int nGreenPin, int nBluePin, bool bActiveLow = false) : CSysStatusLed(nRedPin, nGreenPin, nBluePin, bActiveLow) {
            _tickDelay.start( 500, false  );
        };

        int receiveEvent(const void * pSender, int nMsgId, const void * pMessage, int nType) override;
        void updateLED() override;
};