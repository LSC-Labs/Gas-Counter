#pragma once
#include <InputPinController.h>
#include <ModuleInterface.h>
#include <stdint.h>
#include <MQTTController.h>

struct GasCounterConfig {
    float fUnitPerTick = 0.01; // Default: 0.01 cubic meters per tick
    float fMaxRateHourly = 2.0; // Default: 2 cubic meters per hour
    float fMaxRateDaily = 20.0; // Default: 20 cubic meters
};

struct GasCounterStatus {
    unsigned long ulTotalTickCounter = 0;  // Number of total ticks counted since power on
    unsigned long ulLastCountInMillis = 0;   // Last tick in millis
    unsigned long ulPeriodTimeMillis = 0;  // Last period since previous tick in millis

    float tfMinuteValues[60] = {0.0};       // Verbrauch pro Minute, unabhängig von Kalenderzeit (m³)
    unsigned int nCurrentMinuteIndex = 0;   // Index des aktuellen Minutenintervalls (0 bis 59)

    float fTotalCounter = 0.0;
    float fTotalConsumedValue = 0.0;   // Total consumed value in cubic meters
    float fTodayConsumedValue = 0.0;   // Consumed value today in cubic meters
    float fYesterdayConsumedValue = 0.0; // Consumed value yesterday in cubic meters
    
};

/**
 * Either use the constructor with the port number or call setup() later
 * to initialize the gas counter on a specific port.
 */
class CGasCounter : CInputPinController, public IModule, public IHomeAssistantComponent
{
    private:
        // Ausschließlich Ganzzahlen im ISR; Übernahme im Loop unter InterruptLock.
        volatile uint32_t m_ulPendingTicks = 0;
        volatile uint32_t m_ulLastTickMillis = 0;
        volatile uint32_t m_ulTickPeriodMillis = 0;
        volatile bool m_bHasTick = false;
        bool m_bMonitoring = false;
        bool m_bMinuteClockStarted = false;
        uint32_t m_ulMinuteStartedAt = 0;
        long m_lCurrentDay = -1;

        void adjustDayCounters();
       
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

        void insertComponentDiscovery(const char * pszComponentName,JsonNode & oComponents, CMQTTController *pController) override;
        void setup(int nPortNumber);
        void startMonitoring();
        void dispatch();

        void writeConfigTo(JsonNode &oCfgNode, bool bHideCritical) override;
        void readConfigFrom(JsonNode &oCfgNode) override;
        void writeStatusTo(JsonNode &oStatusNode, int nLevel) override;
        int receiveEvent(const void * pSender, int nMsg, const void * pMessage, int nMsgInfo) override;

        unsigned long getCurrentGasCounter();
        float getConsumedCubicMetersInLastHour();
        float getCurrentConsumedCubicMeters();


};
