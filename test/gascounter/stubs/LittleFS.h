#pragma once
#include "TestRuntime.h"
#include <algorithm>
#include <cstring>
#include <memory>
#include <vector>
struct File {
    std::shared_ptr<std::vector<uint8_t>> data;
    explicit operator bool() const { return bool(data); }
    size_t size() const { return data ? data->size() : 0; }
    size_t read(uint8_t *out, size_t count) {
        count = std::min(count, size());
        if (count) std::memcpy(out, data->data(), count);
        return count;
    }
    size_t write(const uint8_t *in, size_t count) {
        data->assign(in, in + count);
        return count;
    }
    void flush() {}
    void close() {}
};
struct TestFileSystem {
    std::map<std::string, std::shared_ptr<std::vector<uint8_t>>> files;
    bool failRename = false;
    unsigned writes = 0;
    bool exists(const char *path) { return files.count(path) != 0; }
    File open(const char *path, const char *mode) {
        if (*mode == 'w') {
            ++writes;
            files[path] = std::make_shared<std::vector<uint8_t>>();
        }
        const auto it = files.find(path);
        return {it == files.end() ? nullptr : it->second};
    }
    bool rename(const char *from, const char *to) {
        if (failRename || !files.count(from)) return false;
        files[to] = files[from];
        files.erase(from);
        return true;
    }
};
inline TestFileSystem LittleFS;
