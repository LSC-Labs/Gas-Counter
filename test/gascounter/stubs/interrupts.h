#pragma once
#include "TestRuntime.h"
namespace esp8266 {
class InterruptLock {
    bool previous;
public:
    InterruptLock() : previous(testLocked) { testLocked = true; }
    ~InterruptLock() {
        testLocked = previous;
        if (!testLocked && testAfterUnlock) {
            auto callback = std::move(testAfterUnlock);
            testAfterUnlock = {};
            callback();
        }
    }
};
}
