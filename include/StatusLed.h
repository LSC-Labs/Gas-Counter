#pragma once

#include <SysStatusLed.h>
#include <GasCounter.h>

class CStatusLed : public CSysStatusLed {
    protected:
        CGasCounter &_gasCounter;

    public:
        CStatusLed(CGasCounter &gasCounter, int nRedPin, int nGreenPin, int nBluePin,
                   bool bActiveLow = false)
            : CSysStatusLed(nRedPin, nGreenPin, nBluePin, bActiveLow),
              _gasCounter(gasCounter) {}

        void updateLED() override;
};
