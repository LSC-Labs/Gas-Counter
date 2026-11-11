#pragma once
#include <WebServer.h>

/// @brief Registers the default, file access and application specific routes (see WebRoutes.cpp).
void registerWebRoutes(CWebServer &oWebServer);
