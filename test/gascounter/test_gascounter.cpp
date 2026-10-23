#include "TestRuntime.h"
#include <GasCounter.h>
#include <AppConfig.h>
#include <LittleFS.h>
#include <cmath>
#include <cstdlib>
#include <iostream>
#include <limits>

uint32_t testMillis = 1000;
bool testLocked = false;
std::function<void()> testInterrupt;
std::function<void()> testAfterUnlock;
TestApplication Appl;
static time_t testTime = 0;
extern "C" time_t time(time_t* destination) noexcept(noexcept(::time(nullptr))) {
    if (destination) *destination = testTime;
    return testTime;
}
static void near(float actual, float expected) {
    assert(std::isfinite(actual));
    assert(std::fabs(actual - expected) < 0.0002f);
}
static void reset(uint32_t now = 1000) {
    testMillis = now;
    testTime = 0;
    Appl.MsgBus = {};
    testAfterUnlock = {};
    assert(!testLocked);
}
static void date(int year, int month, int day, int hour = 12, int minute = 0) {
    tm calendar = {};
    calendar.tm_year = year - 1900;
    calendar.tm_mon = month - 1;
    calendar.tm_mday = day;
    calendar.tm_hour = hour;
    calendar.tm_min = minute;
    calendar.tm_isdst = -1;
    testTime = mktime(&calendar);
}
static void pulse(uint32_t now) {
    testMillis = now;
    assert(testInterrupt);
    assert(!testLocked);
    testInterrupt();
}
static void tick(CGasCounter& counter, uint32_t now) {
    pulse(now);
    counter.dispatch();
}

int main() {
    setenv("TZ", "UTC0", 1);
    tzset();
    {
        reset();
        date(2026, 10, 23);
        LittleFS.files.clear();
        {
            CGasCounter counter(5);
            assert(!counter.beginPersistence()); // Erster Start ohne Datei.
            counter.startMonitoring();
            tick(counter, 1000);
            tick(counter, 2000);
            assert(counter.saveState(true));
            const unsigned writes = LittleFS.writes;
            counter.dispatch();
            assert(LittleFS.writes == writes); // Kein Flash-Schreiben im Leerlauf.
        }
        {
            CGasCounter restored(5);
            assert(restored.beginPersistence());
            assert(restored.getCurrentGasCounter() == 2);
            near(restored.Status.fTotalConsumedValue, 0.02f);
            near(restored.Status.fTodayConsumedValue, 0.02f);
            near(restored.getConsumedCubicMetersInLastHour(), 0.02f);
            near(restored.getCurrentConsumedCubicMeters(), 0);
            restored.startMonitoring();
            LittleFS.failRename = true;
            tick(restored, 3000);
            LittleFS.failRename = false;
        }
        date(2026, 10, 24);
        {
            CGasCounter restored(5);
            assert(restored.beginPersistence()); // Alter Stand bei fehlgeschlagenem Austausch.
            assert(restored.getCurrentGasCounter() == 2);
            date(2026, 10, 24);
            restored.dispatch();
            near(restored.Status.fTodayConsumedValue, 0);
            near(restored.Status.fYesterdayConsumedValue, 0.02f);
        }
        {
            CGasCounter restored(5);
            assert(restored.beginPersistence());
            near(restored.Status.fYesterdayConsumedValue, 0.02f);
            near(restored.getConsumedCubicMetersInLastHour(), 0);
        }
        {
            CGasCounter restored(5);
            assert(restored.beginPersistence());
            restored.Status.fTotalCounter = 42.5f;
            restored.receiveEvent(nullptr, MSG_APPL_SHUTDOWN, nullptr, 0);
        }
        {
            CGasCounter restored(5);
            assert(restored.beginPersistence());
            near(restored.Status.fTotalCounter, 42.5f);
        }
        (*LittleFS.files["/gascounter.state"])[0] ^= 1;
        CGasCounter corrupt(5);
        assert(!corrupt.beginPersistence());
        assert(corrupt.getCurrentGasCounter() == 0);
    }
    {
        reset(0);
        CGasCounter counter(5);
        counter.startMonitoring();
        pulse(0); // Der erste Impuls bei millis()==0 muss gültig sein.
        assert(Appl.MsgBus.calls == 0 && counter.getCurrentGasCounter() == 0);
        counter.dispatch();
        assert(counter.getCurrentGasCounter() == 1 && Appl.MsgBus.calls == 1);
        near(counter.getCurrentConsumedCubicMeters(), 0);
        tick(counter, 99); // Prellen unterhalb 100 ms.
        assert(counter.getCurrentGasCounter() == 1);
        tick(counter, 100);
        assert(counter.getCurrentGasCounter() == 2);
        near(counter.getCurrentConsumedCubicMeters(), 360);
        counter.startMonitoring(); // Wiederholter Start darf Entprellung nicht löschen.
        tick(counter, 101);
        assert(counter.getCurrentGasCounter() == 2);
        testMillis = 60100;
        counter.dispatch();
        near(counter.getCurrentConsumedCubicMeters(), 0);
        near(counter.Status.fTotalConsumedValue, 0.02f);
    }
    assert(!testInterrupt); // Destruktor meldet Callback ab.
    {
        reset();
        CGasCounter counter(5);
        counter.startMonitoring();
        pulse(1000);
        pulse(1100);
        pulse(1200);
        // Ein Impuls direkt nach dem atomaren Snapshot bleibt für den nächsten Loop erhalten.
        testAfterUnlock = [] { pulse(1300); };
        counter.dispatch();
        assert(counter.getCurrentGasCounter() == 3 && Appl.MsgBus.calls == 3);
        counter.dispatch();
        assert(counter.getCurrentGasCounter() == 4 && Appl.MsgBus.calls == 4);
        // Auch ein Impuls während synchroner Ereignisverarbeitung erzeugt keine Rekursion.
        Appl.MsgBus.onEvent = [] { pulse(1500); };
        tick(counter, 1400);
        assert(counter.getCurrentGasCounter() == 5);
        Appl.MsgBus.onEvent = {};
        counter.dispatch();
        assert(counter.getCurrentGasCounter() == 6);
    }
    {
        reset(UINT32_MAX - 49U);
        CGasCounter counter(5);
        counter.startMonitoring();
        tick(counter, UINT32_MAX - 49U);
        tick(counter, 49); // 99 ms über den Überlauf: verwerfen.
        assert(counter.getCurrentGasCounter() == 1);
        tick(counter, 50); // 100 ms: gültige Periode.
        near(counter.getCurrentConsumedCubicMeters(), 360);
        testMillis = 60000U - 50U;
        counter.dispatch();
        assert(counter.Status.nCurrentMinuteIndex == 1);
    }
    {
        reset();
        CGasCounter counter(5);
        counter.startMonitoring();
        tick(counter, 1000);
        tick(counter, 121000); // Impulsabstand 120 s, also langsamer als ein Impuls pro Minute.
        near(counter.getCurrentConsumedCubicMeters(), 0.3f);
        testMillis = 181000;
        near(counter.getCurrentConsumedCubicMeters(), 0.3f);
        testMillis = 301000;
        near(counter.getCurrentConsumedCubicMeters(), 0.2f);
        testMillis = 361000;
        counter.dispatch();
        near(counter.getCurrentConsumedCubicMeters(), 0);
    }
    {
        reset();
        CGasCounter counter(5);
        counter.startMonitoring();
        for (unsigned minute = 0; minute < 120; ++minute) {
            tick(counter, 1000 + minute * 60000U);
            const unsigned active = minute < 60 ? minute + 1 : 60;
            near(counter.getConsumedCubicMetersInLastHour(), active * 0.01f);
            assert(counter.Status.nCurrentMinuteIndex < 60);
        }
        testMillis += 3600000U;
        near(counter.getConsumedCubicMetersInLastHour(), 0);
        // Nach einer längeren Pause werden alle überholten Buckets entfernt.
        tick(counter, testMillis + 60000U);
        near(counter.getConsumedCubicMetersInLastHour(), 0.01f);
    }
    {
        reset();
        CGasCounter counter(5);
        counter.startMonitoring();
        date(2026, 12, 31, 23, 59);
        tick(counter, 1000);
        date(2027, 1, 1, 0, 1); // Mitternachtsminute übersprungen.
        tick(counter, 2000);
        near(counter.Status.fYesterdayConsumedValue, 0.01f);
        near(counter.Status.fTodayConsumedValue, 0.01f);
        for (int i = 0; i < 6; ++i) counter.dispatch();
        near(counter.Status.fYesterdayConsumedValue, 0.01f);
        near(counter.Status.fTodayConsumedValue, 0.01f);
        near(counter.getConsumedCubicMetersInLastHour(), 0.02f);
        date(2027, 1, 4);
        counter.dispatch();
        near(counter.Status.fYesterdayConsumedValue, 0);
        near(counter.Status.fTodayConsumedValue, 0);
        tick(counter, 3000);
        date(2027, 1, 3); // NTP-Korrektur rückwärts: kein zweiter Reset.
        counter.dispatch();
        date(2027, 1, 4);
        counter.dispatch();
        near(counter.Status.fTodayConsumedValue, 0.01f);
    }
    {
        reset();
        CGasCounter counter(5);
        counter.startMonitoring();
        tick(counter, 1000); // Noch keine gültige Uhrzeit.
        counter.dispatch();
        date(2028, 2, 28, 23, 59);
        counter.dispatch(); // Erste Synchronisation bewahrt erfassten Verbrauch.
        near(counter.Status.fTodayConsumedValue, 0.01f);
        date(2028, 2, 29);
        counter.dispatch();
        near(counter.Status.fYesterdayConsumedValue, 0.01f);
        tick(counter, 2000);
        date(2028, 3, 1);
        counter.dispatch();
        near(counter.Status.fYesterdayConsumedValue, 0.01f);
        testTime = -1;
        counter.dispatch();
        near(counter.Status.fYesterdayConsumedValue, 0.01f);
    }
    {
        reset();
        setenv("TZ", "CET-1CEST,M3.5.0,M10.5.0/3", 1);
        tzset();
        CGasCounter counter(5);
        counter.startMonitoring();
        date(2026, 3, 29, 0, 0);
        tick(counter, 1000);
        date(2026, 3, 29, 3, 0); // Sommerzeitsprung ist kein Tageswechsel.
        counter.dispatch();
        near(counter.Status.fTodayConsumedValue, 0.01f);
        date(2026, 3, 30, 0, 0); // 23-Stunden-Tag.
        counter.dispatch();
        near(counter.Status.fYesterdayConsumedValue, 0.01f);
        setenv("TZ", "UTC0", 1);
        tzset();
    }
    {
        reset();
        CGasCounter counter(5);
        counter.startMonitoring();
        pulse(1000); // Konfigurationswechsel verarbeitet alte Impulse mit altem Faktor.
        JsonNode config;
        config["m3PerTick"] = 0.02f;
        config["maxRateHourly"] = 7.0f;
        config["maxRateDaily"] = 40.0f;
        counter.readConfigFrom(config);
        near(counter.Status.fTotalConsumedValue, 0.01f);
        tick(counter, 2000);
        near(counter.Status.fTotalConsumedValue, 0.03f);
        JsonNode saved;
        counter.writeConfigTo(saved, false);
        CGasCounter restored;
        restored.readConfigFrom(saved);
        near(restored.Config.fUnitPerTick, 0.02f);
        near(restored.Config.fMaxRateHourly, 7);
        near(restored.Config.fMaxRateDaily, 40);
        config["m3PerTick"] = -1.0f;
        config["maxRateHourly"] = std::numeric_limits<float>::infinity();
        config["maxRateDaily"] = std::numeric_limits<float>::quiet_NaN();
        counter.readConfigFrom(config);
        near(counter.Config.fUnitPerTick, 0.02f);
        near(counter.Config.fMaxRateHourly, 7);
        near(counter.Config.fMaxRateDaily, 40);
        config["m3PerTick"] = 0;
        counter.readConfigFrom(config);
        near(counter.Config.fUnitPerTick, 0.02f);
        JsonNode legacy;
        legacy["m2hPerTick"] = 0.04f;
        counter.readConfigFrom(legacy);
        near(counter.Config.fUnitPerTick, 0.04f);
        legacy["m3PerTick"] = 0.03f;
        counter.readConfigFrom(legacy);
        near(counter.Config.fUnitPerTick, 0.03f);
        JsonNode nonnumeric;
        nonnumeric["m3PerTick"].numeric = false;
        nonnumeric["m2hPerTick"] = 0.08f;
        counter.readConfigFrom(nonnumeric); // Ein ungültiger neuer Schlüssel aktiviert keinen Legacy-Fallback.
        near(counter.Config.fUnitPerTick, 0.03f);
        JsonNode empty;
        counter.readConfigFrom(empty);
        near(counter.Config.fUnitPerTick, 0.03f);
    }
    std::cout << "GasCounter: alle Regressionstests bestanden\n";
}
