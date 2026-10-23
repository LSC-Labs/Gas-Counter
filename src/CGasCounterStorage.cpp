#include <GasCounter.h>
#include <LittleFS.h>
#include <cmath>
#include <cstddef>
#include <ctime>

namespace {
constexpr const char *statePath = "/gascounter.state";
constexpr const char *tempPath = "/gascounter.state.tmp";
struct StoredState {
    uint32_t version;
    GasCounterStatus status;
    long day;
    int64_t savedAt;
    uint32_t checksum;
};
uint32_t checksum(const StoredState &state) {
    const auto *bytes = reinterpret_cast<const unsigned char *>(&state);
    uint32_t hash = 2166136261U;
    for (size_t i = 0; i < offsetof(StoredState, checksum); ++i)
        hash = (hash ^ bytes[i]) * 16777619U;
    return hash;
}
bool validVolume(float value) { return std::isfinite(value) && value >= 0; }
}

bool CGasCounter::beginPersistence() {
    if (m_bStorageEnabled) return true;
    m_bStorageEnabled = true;
    StoredState state = {};
    File file = LittleFS.open(statePath, "r");
    if (!file || file.size() != sizeof(state) ||
        file.read(reinterpret_cast<uint8_t *>(&state), sizeof(state)) != sizeof(state)) return false;
    file.close();
    if (state.version != 1 || state.checksum != checksum(state) ||
        state.status.nCurrentMinuteIndex >= 60 || state.day < -1 ||
        !validVolume(state.status.fTotalCounter) ||
        !validVolume(state.status.fTotalConsumedValue) ||
        !validVolume(state.status.fTodayConsumedValue) ||
        !validVolume(state.status.fYesterdayConsumedValue)) return false;
    for (float value : state.status.tfMinuteValues)
        if (!validVolume(value)) return false;
    Status = state.status;
    m_lCurrentDay = state.day;
    // millis() gehört zum vorigen Boot; keine alte Durchflussperiode übernehmen.
    Status.ulLastCountInMillis = 0;
    Status.ulPeriodTimeMillis = 0;
    const time_t now = time(nullptr);
    // Ohne verlässliche Uhr sind die alten Minutenwerte zeitlich nicht zuordenbar.
    if (state.savedAt < 946684800 || now < state.savedAt || now < 946684800) {
        for (float &value : Status.tfMinuteValues) value = 0;
    } else {
        const uint64_t minutes = (now - state.savedAt) / 60;
        if (minutes >= 60) {
            for (float &value : Status.tfMinuteValues) value = 0;
        } else {
            for (uint64_t i = 0; i < minutes; ++i) {
                Status.nCurrentMinuteIndex = (Status.nCurrentMinuteIndex + 1) % 60;
                Status.tfMinuteValues[Status.nCurrentMinuteIndex] = 0;
            }
        }
    }
    m_ulMinuteStartedAt = millis();
    m_bMinuteClockStarted = true;
    m_bStateSaved = true;
    m_ulSavedTicks = Status.ulTotalTickCounter;
    m_lSavedDay = m_lCurrentDay;
    m_fSavedToday = Status.fTodayConsumedValue;
    m_fSavedYesterday = Status.fYesterdayConsumedValue;
    return true;
}

bool CGasCounter::saveState(bool force) {
    if (!m_bStorageEnabled) return true;
    if (!force && m_bStateSaved && m_ulSavedTicks == Status.ulTotalTickCounter &&
        m_lSavedDay == m_lCurrentDay && m_fSavedToday == Status.fTodayConsumedValue &&
        m_fSavedYesterday == Status.fYesterdayConsumedValue) return true;
    StoredState state = {};
    state.version = 1;
    state.status = Status;
    state.day = m_lCurrentDay;
    state.savedAt = time(nullptr);
    state.checksum = checksum(state);
    File file = LittleFS.open(tempPath, "w");
    if (!file) return false;
    const bool written = file.write(reinterpret_cast<const uint8_t *>(&state), sizeof(state)) == sizeof(state);
    file.flush();
    file.close();
    if (!written || !LittleFS.rename(tempPath, statePath)) return false;
    m_bStateSaved = true;
    m_ulSavedTicks = Status.ulTotalTickCounter;
    m_lSavedDay = m_lCurrentDay;
    m_fSavedToday = Status.fTodayConsumedValue;
    m_fSavedYesterday = Status.fYesterdayConsumedValue;
    return true;
}
