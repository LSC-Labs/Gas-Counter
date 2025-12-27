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
 * processing within the interrupt handler.
 *  
 */


#include <Appl.h>
#include <AppControl.h>
#include <EventHandler.h>
#include <Msgs.h>
#include <JsonHelper.h>
#include <LSCUtils.h>
#include <GasCounter.h>


CAppControl::CAppControl()
{
    // Constructor implementation (if needed)
}   

int CAppControl::receiveEvent(const void* pSender, int nMsgID, const void * pMsg, int nMsgClass)
{
    int nResult = EVENT_MSG_RESULT_OK;
    // Handle incoming events here
    // Example:
    // if (nMsgID == SOME_MESSAGE_ID) { ... }
    switch(nMsgID)
    {
        case MSG_APPL_INITIALIZED:
            // Process when the application is up and running
            break;
        case MSG_RESTART_REQUEST:
            // Process some save actions if needed and prepare shutdown
            break;
        case  MSG_GASCOUNTER_TICK:
            // Remember the tick, as we are in an event, do not send immediately...
            GasCounterTickMsg *pTickMsg = new GasCounterTickMsg((CGasCounter *) pSender);

            this->tGasCounterTicks.push_back(pTickMsg);
            break;


    }
    return nResult; // Return appropriate status
}

/**
 * @brief Dispatch stored events and process them.
 */
void CAppControl::dispatch()
{
    // Dispatch stored GasCounterTickMsg events
    for (auto pTickMsg : this->tGasCounterTicks)
    {
        char tTimeBuffer[25];
        JSON_DOC(oMsgDoc,300); // Process each tick message
        oMsgDoc["type"] = "tick";
        oMsgDoc["unitPerTick"]  = pTickMsg->fUnitPerTick;
        oMsgDoc["timestamp"]    = pTickMsg->oTimeStamp;
        oMsgDoc["isotime"]      = LSC::getISODateTime(pTickMsg->oTimeStamp,tTimeBuffer,sizeof(tTimeBuffer));   
        Appl.MsgBus.sendEvent(this,MSG_MQTT_SEND_JSONOBJ,&oMsgDoc,0);
        delete pTickMsg;
    }
    this->tGasCounterTicks.clear();
}