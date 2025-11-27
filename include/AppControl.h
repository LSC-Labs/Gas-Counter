#pragma once

/**
 * Use the App to implement the main application logic.
 * Registered on the message bus, you can reflect to messages sent fromt the modules.
 */

#include <EventHandler.h>
#include <AppConfig.h>



class CAppControl : public IMsgEventReceiver
{

public:
    CAppControl();

    // Inherited via EventHandler
    virtual int onEvent(const void* pSender, int nMsgID, const void * pMsg, int nMsgClass);
    
};
