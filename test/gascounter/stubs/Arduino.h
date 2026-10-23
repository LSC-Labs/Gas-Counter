#pragma once
#include <string>
#include <cstdio>
#include <cstdlib>
#include <cstdint>
#include <ctime>
#include <cmath>
#include <cstring>
#include <cctype>
#include <iostream>
class String : public std::string {
public:
    using std::string::string;
    String(const std::string &value) : std::string(value) {}
    void replace(const char *from, const char *to) {
        size_t offset = 0;
        while ((offset = find(from, offset)) != npos) {
            std::string::replace(offset, strlen(from), to);
            offset += strlen(to);
        }
    }
};
#define ICACHE_FLASH_ATTR
#define F(value) value
struct TestSerial {
    void printf(const char *text) { ::fputs(text, stdout); }
    template<typename... Args> void printf(const char *format, Args... args) { ::printf(format, args...); }
    void println(const char *value) { ::puts(value); }
};
inline TestSerial Serial;
unsigned long millis();
