#pragma once

/**
 * Use the App to implement the main application logic.
 * Registered on the message bus, you can reflect to messages sent fromt the modules.
 */

#include <EventHandler.h>
#include <AppConfig.h>
#include <GasCounter.h>


class GasCounterTickMsg
{
    public:
        time_t oTimeStamp;
        float fUnitPerTick;

        GasCounterTickMsg(CGasCounter * pSender) {
            time(&oTimeStamp);
            fUnitPerTick = pSender->Config.fUnitPerTick;
        }
};
       
        

class CAppControl : public IMsgEventReceiver
{
    protected:
        std::vector<GasCounterTickMsg*> tGasCounterTicks;


    public:
        CAppControl();

        void dispatch();
        // Inherited via EventHandler
        virtual int receiveEvent(const void* pSender, int nMsgID, const void * pMsg, int nMsgClass);
    
};
