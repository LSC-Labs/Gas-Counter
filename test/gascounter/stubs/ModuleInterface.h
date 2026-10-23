#pragma once
#include "TestRuntime.h"

#define EVENT_MSG_RESULT_OK 0

class IMsgEventReceiver {
public:
    virtual int receiveEvent(const void*, int, const void*, int) = 0;
};

class IModule : public IConfigHandler, public IStatusHandler, public IMsgEventReceiver {};
