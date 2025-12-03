#ifndef DEBUG_LSC_GASCOUNTER
    #undef DEBUGINFOS
#endif

#include <GasCounter.h>
#include <DevelopmentHelper.h>
#include <FunctionalInterrupt.h>
#include <Appl.h>
#include <AppConfig.h>

CGasCounter::CGasCounter()
    : IConfigHandler()
    , IStatusHandler()
{
}

CGasCounter::CGasCounter(int nPortNumber)
    : IConfigHandler()
    , IStatusHandler()
{
    setup(nPortNumber);
}

CGasCounter::~CGasCounter()
{
}

void CGasCounter::setup(int nPortNumber)
{
    CInputPinController(nPortNumber, true, true);
}

/**
 * @brief Start monitoring the gas counter input pin
 */
void CGasCounter::startMonitoring(){
    DEBUG_FUNC_START();
    if(canSendInterrupts()) {
        this->m_oDebounceDelay.start(100);              // 100 ms debounce
        this->m_oAdjustTimeCountersDelay.start(10000);  // 10 seconds adjust time counters
        attachInterrupt(m_nPin, std::bind(&CGasCounter::interruptHandler, this), FALLING);
    } 
    DEBUG_FUNC_END();
}

/**
 * @brief Interrupt handler for gas counter ticks
 * Respect the debounce delay to avoid multiple counts
 * and keep processing time short - you are in an interrupt!
 */
void IRAM_ATTR CGasCounter::interruptHandler() {
    if(m_oDebounceDelay.isDone()) {
        m_oDebounceDelay.restart();
        DEBUG_INFOS("GASCOUNTER: pin %d - tick counter=%lu",
                m_nPin,
                Status.ulTotalTickCounter);

        // Update consumed values...
        Status.ulTotalTickCounter++;
        Status.fTotalConsumedValue += Config.fUnitPerTick;
        Status.fTodayConsumedValue += Config.fUnitPerTick;
        
        // Update timestamps
        unsigned long ulCurrentMillis = millis();
        Status.ulPeriodTimeMillis = ulCurrentMillis - Status.ulLastCountInMillis;
        Status.ulLastCountInMillis = ulCurrentMillis;

        Appl.MsgBus.sendEvent(this, MSG_GASCOUNTER_TICK ,nullptr,m_nPin);
    }
    interrupts();
}

void CGasCounter::storeMinuteValue() 
{
    struct tm tmLocal;
    if(getLocalTimeStruct(&tmLocal)) {
        if(tmLocal.tm_min != Status.nCurrentMinuteIndex) {
            Status.nCurrentMinuteIndex = tmLocal.tm_min;
        }
    }
    // Minute Values Storage overflow handling
    if(Status.nCurrentMinuteIndex < sizeof(Status.tfMinuteValues)) {
        Status.tfMinuteValues[Status.nCurrentMinuteIndex] = Status.fTodayConsumedValue;;
    }
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
    bool bResult = false;
    if( pTimeinfo != nullptr) {
        time_t now;
        time(&now);
        localtime_r(&now, pTimeinfo);
        bResult = pTimeinfo->tm_year > 100; // Valid year check (since 2000)
    }
    return(bResult);
}

/**
 * @brief Dispatch method to be called in the main loop on a regular base
 */
void CGasCounter::dispatch() {
    
    if(m_oAdjustTimeCountersDelay.isDone()) {
        m_oAdjustTimeCountersDelay.restart();
        struct tm tmLocal;
        getLocalTimeStruct(&tmLocal);
        
        if(tmLocal.tm_hour == 0 && tmLocal.tm_min == 0) {
            // Reset today counter at midnight
            Status.fYesterdayConsumedValue = Status.fTodayConsumedValue;
            Status.fTodayConsumedValue = 0.0;
        }
        storeMinuteValue();
    }
    // Placeholder for future dispatch logic if needed
}

void CGasCounter::writeConfigTo(JsonObject &oCfgNode, bool bHideCritical)
{
    oCfgNode["m3PerTick"]       = Config.fUnitPerTick;
    oCfgNode["maxRateHourly"]   = Config.fMaxRateHourly;  // Implementation to write configuration to JSON object
    oCfgNode["maxRateDaily"]    = Config.fMaxRateDaily;
    // Implementation to write configuration to JSON object
}

void CGasCounter::readConfigFrom(JsonObject &oCfgNode)
{
    Config.fUnitPerTick     = oCfgNode["m3hPerTick"]    | 0.01;
    Config.fMaxRateHourly   = oCfgNode["maxRateHourly"] | 2.0;
    Config.fMaxRateDaily    = oCfgNode["maxRateDaily"]  | 20.0;
}

void CGasCounter::writeStatusTo(JsonObject &oStatusNode)
{
    oStatusNode["TickCounter"]     = Status.ulTotalTickCounter;
    oStatusNode["m3hPerTick"]      = Config.fUnitPerTick;
    oStatusNode["m3hTotal"]        = Status.fTotalConsumedValue;
    oStatusNode["m3hToday"]        = Status.fTodayConsumedValue;
    oStatusNode["m3hPrevday"]      = Status.fYesterdayConsumedValue;
    oStatusNode["m3hLastHour"]     = getConsumedCubicMetersInLastHour();
    oStatusNode["m3hCurrent"]      = getCurrentConsumedCubicMeters();
}

/**
 * @brief Get the consumed cubic meters in the last hour
 * uses the current minute (and the next minute) to calculate the difference
 * As the buffer is a circular buffer, the next minute is the value 60 minutes ago.
 * @return Consumed cubic meters in the last hour
 */
float CGasCounter::getConsumedCubicMetersInLastHour()
{
    float fTotal = 0.0;
    int nCurrentMinute = Status.nCurrentMinuteIndex;
    int nNextMinute = nCurrentMinute + 1;
    if(nNextMinute > (sizeof(Status.tfMinuteValues) - 1) ) {
        nNextMinute = 0;
    }
    return(Status.tfMinuteValues[nNextMinute] - Status.tfMinuteValues[nCurrentMinute]);
}


/**
 * @brief Get the current consumed cubic meters per hour
 * based on the last tick period.
 * @return Current consumed cubic meters per hour
 */
float CGasCounter::getCurrentConsumedCubicMeters()
{
    float fTotal = 0.0;
    if(Status.ulPeriodTimeMillis != 0) {
        if(Status.ulLastCountInMillis < 60000) {
            fTotal = (Config.fUnitPerTick / (Status.ulLastCountInMillis / 1000)) * 3600.0; // current m3 per hour
        }
    }
    return(fTotal);
}

unsigned long CGasCounter::getCurrentGasCounter()
{
    return(Status.ulTotalTickCounter);
}

