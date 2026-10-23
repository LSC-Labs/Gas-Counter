#include <GasCounter.h>
#include <LittleFS.h>
#include <cmath>
#include <cstddef>
#include <cstring>
#include <cstdlib>
#include <cstdio>
#include <memory>
#include <cctype>
#include <ctime>

namespace {
constexpr const char *statePath = "/gascounter.state";
constexpr const char *tempPath = "/gascounter.state.tmp";
// Eingefrorenes altes Layout, ausschließlich zur einmaligen Migration.
struct LegacyStatus {
    unsigned long ticks, lastTick, period;
    float minutes[60];
    unsigned int minuteIndex;
    float totalCounter, total, today, yesterday;
};
struct LegacyState {
    uint32_t version;
    LegacyStatus status;
    long day;
    int64_t savedAt;
    uint32_t checksum;
};
uint32_t hashBytes(const void *data, size_t length) {
    const auto *bytes = static_cast<const unsigned char *>(data);
    uint32_t hash = 2166136261U;
    for (size_t i = 0; i < length; ++i) hash = (hash ^ bytes[i]) * 16777619U;
    return hash;
}
bool validVolume(float value) { return std::isfinite(value) && value >= 0; }
// Dezimaltext mit 9 signifikanten Stellen erhält jeden float exakt beim Roundtrip.
void writeVolume(JsonNode &node, const char *key, float value) {
    char text[32];
    snprintf(text, sizeof(text), "%.9g", static_cast<double>(value));
    node[key] = text;
}
bool readNumber(JsonNode &node, const char *key, double &value,
                double minimum, double maximum, bool required = false) {
    if (!node.exists(key)) return !required;
    JsonNode *field = node.getElement(key);
    if (!field) return false;
    const char *text = field->getValue();
    if (!text || !*text) return false;
    char *end = nullptr;
    const double parsed = strtod(text, &end);
    if (end == text || *end || !std::isfinite(parsed) || parsed < minimum || parsed > maximum)
        return false;
    value = parsed;
    return true;
}
bool readVolume(JsonNode &node, const char *key, float &value, bool required = false) {
    if (!node.exists(key)) return !required;
    JsonNode *field = node.getElement(key);
    if (!field) return false;
    const char *text = field->getValue();
    if (!text || !*text) return false;
    char *end = nullptr;
    const float parsed = strtof(text, &end);
    if (end == text || *end || !validVolume(parsed)) return false;
    value = parsed;
    return true;
}
}

bool CGasCounter::beginPersistence() {
    if (m_bStorageEnabled) return true;
    GasCounterStatus restored;
    long day = -1;
    int64_t savedAt = 0;
    bool migrated = false;
    File file = LittleFS.open(statePath, "r");
    if (!file) {
        m_bStorageEnabled = !LittleFS.exists(statePath);
        return false;
    }
    // Unbekannte/defekte Bestandsdateien niemals automatisch mit Nullständen ersetzen.
    if (!file.size() || file.size() > 32768) return false;
    const size_t size = file.size();
    std::unique_ptr<char[]> buffer(new char[size + 1]);
    if (static_cast<size_t>(file.read(reinterpret_cast<uint8_t *>(buffer.get()), size)) != size) return false;
    file.close();
    buffer[size] = 0;
    const char *begin = buffer.get();
    while (*begin && std::isspace(static_cast<unsigned char>(*begin))) ++begin;
    if (*begin != '{') {
        if (size != sizeof(LegacyState)) return false;
        LegacyState legacy;
        memcpy(&legacy, buffer.get(), sizeof(legacy));
        if (legacy.version != 1 || legacy.checksum != hashBytes(&legacy, offsetof(LegacyState, checksum)))
            return false;
        restored.ulTotalTickCounter = legacy.status.ticks;
        restored.fTotalCounter = legacy.status.totalCounter;
        restored.fTotalConsumedValue = legacy.status.total;
        restored.fTodayConsumedValue = legacy.status.today;
        restored.fYesterdayConsumedValue = legacy.status.yesterday;
        restored.nCurrentMinuteIndex = legacy.status.minuteIndex;
        for (size_t i = 0; i < 60; ++i) restored.tfMinuteValues[i] = legacy.status.minutes[i];
        day = legacy.day;
        savedAt = legacy.savedAt;
        migrated = true;
    } else {
        JsonNode document;
        const char *end = document.parse(begin);
        if (!end) return false;
        if (*end == '}') ++end;
        while (*end && std::isspace(static_cast<unsigned char>(*end))) ++end;
        size_t tail = size;
        while (tail && std::isspace(static_cast<unsigned char>(buffer[tail - 1]))) --tail;
        if (end != buffer.get() + size || !tail || buffer[tail - 1] != '}') return false;
        JsonNode *data = document.getObject("data");
        double schema = 0, storedHash = 0;
        if (!data || !readNumber(document, "schemaVersion", schema, 2, 2, true) ||
            !readNumber(document, "checksum", storedHash, 0, UINT32_MAX, true)) return false;
        const char *serialized = data->getAsJsonText();
        if (storedHash != hashBytes(serialized, strlen(serialized))) return false;
        double ticks = 0, index = 0, date = -1, timestamp = 0;
        if (!readNumber(*data, "tickCounter", ticks, 0, UINT32_MAX, true) || floor(ticks) != ticks ||
            !readNumber(*data, "minuteIndex", index, 0, 59) || floor(index) != index ||
            !readNumber(*data, "day", date, -1, INT32_MAX) || floor(date) != date ||
            !readNumber(*data, "savedAt", timestamp, 0, 253402300799.0) || floor(timestamp) != timestamp ||
            !readVolume(*data, "totalCounter", restored.fTotalCounter) ||
            !readVolume(*data, "total", restored.fTotalConsumedValue, true) ||
            !readVolume(*data, "today", restored.fTodayConsumedValue) ||
            !readVolume(*data, "yesterday", restored.fYesterdayConsumedValue)) return false;
        restored.ulTotalTickCounter = static_cast<unsigned long>(ticks);
        restored.nCurrentMinuteIndex = static_cast<unsigned int>(index);
        day = static_cast<long>(date);
        savedAt = static_cast<int64_t>(timestamp);
        if (data->exists("minutes")) {
            JsonNode *minutes = data->getObject("minutes");
            if (!minutes) return false;
            for (size_t i = 0; i < 60; ++i) {
                char key[8];
                snprintf(key, sizeof(key), "%u", static_cast<unsigned int>(i));
                if (!readVolume(*minutes, key, restored.tfMinuteValues[i])) return false;
            }
        }
    }
    if (restored.nCurrentMinuteIndex >= 60 || day < -1 ||
        !validVolume(restored.fTotalCounter) || !validVolume(restored.fTotalConsumedValue) ||
        !validVolume(restored.fTodayConsumedValue) || !validVolume(restored.fYesterdayConsumedValue)) return false;
    for (float value : restored.tfMinuteValues) if (!validVolume(value)) return false;
    m_bStorageEnabled = true;
    Status = restored;
    m_lCurrentDay = day;
    // millis() gehört zum vorigen Boot; keine alte Durchflussperiode übernehmen.
    Status.ulLastCountInMillis = 0;
    Status.ulPeriodTimeMillis = 0;
    const time_t now = time(nullptr);
    // Ohne verlässliche Uhr sind die alten Minutenwerte zeitlich nicht zuordenbar.
    if (savedAt < 946684800 || now < savedAt || now < 946684800) {
        for (float &value : Status.tfMinuteValues) value = 0;
    } else {
        const uint64_t minutes = (now - savedAt) / 60;
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
    if (migrated) saveState(true);
    return true;
}

bool CGasCounter::saveState(bool force) {
    if (!m_bStorageEnabled) return true;
    if (!force && m_bStateSaved && m_ulSavedTicks == Status.ulTotalTickCounter &&
        m_lSavedDay == m_lCurrentDay && m_fSavedToday == Status.fTodayConsumedValue &&
        m_fSavedYesterday == Status.fYesterdayConsumedValue) return true;
    JsonNode document;
    document["schemaVersion"] = 2;
    JsonNode &data = *document.getObject("data", true);
    data["tickCounter"] = Status.ulTotalTickCounter;
    writeVolume(data, "totalCounter", Status.fTotalCounter);
    writeVolume(data, "total", Status.fTotalConsumedValue);
    writeVolume(data, "today", Status.fTodayConsumedValue);
    writeVolume(data, "yesterday", Status.fYesterdayConsumedValue);
    data["minuteIndex"] = Status.nCurrentMinuteIndex;
    data["day"] = m_lCurrentDay;
    const time_t now = time(nullptr);
    data["savedAt"] = static_cast<signed long long>(now > 0 ? now : 0);
    JsonNode &minutes = *data.getObject("minutes", true);
    for (size_t i = 0; i < 60; ++i) {
        char key[8];
        snprintf(key, sizeof(key), "%u", static_cast<unsigned int>(i));
        writeVolume(minutes, key, Status.tfMinuteValues[i]);
    }
    const char *payload = data.getAsJsonText();
    document["checksum"] = static_cast<unsigned long>(hashBytes(payload, strlen(payload)));
    const char *text = document.getAsJsonText();
    const size_t length = strlen(text);
    File file = LittleFS.open(tempPath, "w");
    if (!file) return false;
    const bool written = file.write(reinterpret_cast<const uint8_t *>(text), length) == length;
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
