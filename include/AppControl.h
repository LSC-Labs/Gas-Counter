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

/**
 * @brief Erfasst Empfangszeit und Impulsvolumen; pSender muss auf einen gültigen Zähler zeigen.
 */
        GasCounterTickMsg(CGasCounter * pSender) {
            time(&oTimeStamp);
            fUnitPerTick = pSender->Config.fUnitPerTick;
        }
};
       
        

class CAppControl : public IMsgEventReceiver
{
    protected:
        std::vector<GasCounterTickMsg*> tGasCounterTicks;
        bool m_bMqttConnected = false;      // State nur bei bestehender Verbindung veröffentlichen
        bool m_bPublishStateRequested = false;
        unsigned long m_ulLastStatePublish = 0;
        void publishState(const char *pszType, GasCounterTickMsg *pTickMsg = nullptr);


    public:
        CAppControl();

        void dispatch();
        // Inherited via EventHandler
        virtual int receiveEvent(const void* pSender, int nMsgID, const void * pMsg, int nMsgClass);
    
};
