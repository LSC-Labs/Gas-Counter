#pragma once
#include <InputPinController.h>
#include <ConfigHandler.h>
#include <StatusHandler.h>
#include <SimpleDelay.h>

struct GasCounterConfig {
    float fUnitPerTick = 0.01; // Default: 0.01 cubic meters per tick
    float fMaxRateHourly = 2.0; // Default: 2 cubic meters per hour
    float fMaxRateDaily = 20.0; // Default: 20 cubic meters
};

struct GasCounterStatus {
    volatile unsigned long ulTotalTickCounter = 0;  // Number of total ticks counted since power on
    volatile unsigned long ulLastCountInMillis = 0;   // Last tick in millis
    volatile unsigned long ulPeriodTimeMillis = 0;  // Last period since previous tick in millis

    float tfMinuteValues[60] = {0.0};       // Storage of last 60 minute values
    unsigned int nCurrentMinuteIndex = 0;   // Current minute as index in the minute values array

    volatile float fTotalCounter = 0.0; 
    volatile float fTotalConsumedValue = 0.0;   // Total consumed value in cubic meters
    volatile float fTodayConsumedValue = 0.0;   // Consumed value today in cubic meters
    float fYesterdayConsumedValue = 0.0; // Consumed value yesterday in cubic meters
    
};

/**
 * Either use the constructor with the port number or call setup() later
 * to initialize the gas counter on a specific port.
 */
class CGasCounter : CInputPinController, public IConfigHandler, public IStatusHandler
{
    private:
        CSimpleDelay m_oDebounceDelay;
        CSimpleDelay m_oAdjustTimeCountersDelay;
       
        void IRAM_ATTR interruptHandler();
        bool getLocalTimeStruct(struct tm *pTimeinfo);
        void storeMinuteValue();

    public :
        GasCounterStatus Status;
        GasCounterConfig Config;

    public:
        CGasCounter();
        CGasCounter(int nPortNumber);
        ~CGasCounter();

        void setup(int nPortNumber);
        void startMonitoring();
        void dispatch();

        void writeConfigTo(JsonNode &oCfgNode, bool bHideCritical) override;
        void readConfigFrom(JsonNode &oCfgNode) override;
        void writeStatusTo(JsonNode &oStatusNode, int nLevel) override;

        unsigned long getCurrentGasCounter();
        float getConsumedCubicMetersInLastHour();
        float getCurrentConsumedCubicMeters();


};