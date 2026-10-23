#pragma once
// Kleiner Host-Adapter: Die Tests kompilieren den echten CGasCounter.cpp.
#include <cassert>
#include <cstdint>
#include <ctime>
#include <functional>
#include <map>
#include <string>
#include <utility>
#define IRAM_ATTR
#define FALLING 2
#include <Arduino.h>
extern uint32_t testMillis;
extern bool testLocked;
extern std::function<void()> testInterrupt;
extern std::function<void()> testAfterUnlock;
inline unsigned long millis() { return testMillis; }
inline void attachInterrupt(int pin, std::function<void()> callback, int) {
    assert(pin >= 0);
    testInterrupt = std::move(callback);
}
inline void detachInterrupt(int) { testInterrupt = {}; }
class CInputPinController {
protected:
    int m_nPin = -1;
public:
    void setup(int pin, bool, bool) { m_nPin = pin; }
    bool isPinLogicalOn() { return false; }
    bool canSendInterrupts() { return m_nPin >= 0; }
};
#include <JsonNode.h>
class IConfigHandler {
public:
    virtual void writeConfigTo(JsonNode&, bool) = 0;
    virtual void readConfigFrom(JsonNode&) = 0;
};
class IStatusHandler {
public:
    virtual void writeStatusTo(JsonNode&, int) = 0;
};
class CMQTTController {};
class IHomeAssistantComponent {
public:
    virtual void insertComponentDiscovery(const char*, JsonNode&, CMQTTController*) = 0;
};
struct TestBus {
    unsigned calls = 0;
    std::function<void()> onEvent;
    void sendEvent(void*, int, const void*, int) {
        assert(!testLocked);
        ++calls;
        if (onEvent) onEvent();
    }
};
struct TestApplication {
    TestBus MsgBus;
    String getDeviceID() { return "test-device"; }
};
extern TestApplication Appl;
