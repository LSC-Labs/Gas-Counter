#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
TEST_BIN=$(mktemp "${TMPDIR:-/tmp}/gas-counter-tests.XXXXXX")
trap 'rm -f "$TEST_BIN"' EXIT
"${CXX:-c++}" -std=c++17 -Wall -Wextra -Wno-unknown-pragmas -Wno-unused-parameter \
    -fsanitize=address,undefined -fno-omit-frame-pointer -g \
    -Itest/gascounter/stubs -Iinclude \
    test/gascounter/test_gascounter.cpp src/CGasCounter.cpp -o "$TEST_BIN"
"$TEST_BIN"
