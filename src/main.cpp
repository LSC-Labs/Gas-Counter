#include <Arduino.h>
#include <AppConfig.h>
#include <FileSystem.h>
#include <Appl.h>
#include <WiFiController.h>
#include <MQTTController.h>
#include <WebSocket.h>
#include <WebServer.h>
#include <WebRoutes.h>
#include <DevelopmentHelper.h>
#include <GasCounter.h>
#include <AppControl.h>
#include <MDNSController.h>
#include <StatusLed.h>
#include <NTPHandler.h>


CFS oFS;
CWiFiController oWiFiController;
CMQTTController oMqttController;
CWebSocket      oWebSocket("/ws");
CWebServer      oWebServer(80);
CGasCounter     oGasCounter(D7);
CAppControl     oAppControl;
CMDNSController oMDNSController;
CNTPHandler     oNTPHandler;
CStatusLed      oStatusLed(D6,D5,D0,false); // RGB LED on D6=Red, D5=Green, D0=Blue


#ifdef DEBUGINFOS
/**
 * @brief Gibt die aktuelle Konfiguration zur Diagnose auf der seriellen Schnittstelle aus.
 */
void runDebugTests() {
  JsonNode oCfgNode;
  Appl.writeConfigTo(oCfgNode,false);
  DEBUG_INFO("Current configuration:");
  DEBUG_JSON_OBJ(oCfgNode);
}
#endif

/**
 * @brief Registriert Konfigurations-, Status- und MQTT-Empfänger und startet Netzwerk/Webserver.
 * NTP liefert die lokale Kalenderzeit für den Tageswechsel; Monitoring startet zuletzt.
 */
void setup() {
  Serial.begin(115200);
  DEBUG_INFOS("\nInitializing application: \"%s\" Version: %s\n",APP_NAME,APP_VERSION);
  
  Appl.addConfigHandler("wifi",&oWiFiController);
  Appl.addConfigHandler("mqtt",&oMqttController);
  Appl.addConfigHandler("gascounter",&oGasCounter);
  // Vor dem WLAN-Start registrieren: NTP startet beim Verbindungsereignis.
  Appl.registerModule("ntp", &oNTPHandler);

  Appl.addStatusHandler("wifi",&oWiFiController);
  Appl.addStatusHandler("mqtt",&oMqttController);
  Appl.addStatusHandler("gascounter",&oGasCounter);

  Appl.MsgBus.registerEventReceiver(&oAppControl);
  Appl.MsgBus.registerEventReceiver(&oMqttController);

  oMqttController.registerHomeAssistantComponent("gascounter",&oGasCounter);

  Appl.init(APP_NAME,APP_VERSION);
  Appl.sayHello();
  
  bool bUseConfigData = Appl.readConfigFrom(CONFIG_FILE);
  Appl.printDiag();
  Appl.Log.logInfo(F("Initializing services..."));
 
  // Initialize and start the WiFi
  oWiFiController.startWiFi(bUseConfigData);
  oMqttController.setup();

  // Prepare and start the Web Server
  oWebServer.addHandler(&oWebSocket);
  registerWebRoutes(oWebServer);  
  oWebServer.begin();
  
  Appl.Log.logInfo(F("Hello world... - let's start the show!"));
  delay(200);

  #ifdef DEBUGINFOS
    runDebugTests();
  #endif
  Appl.start();
  oGasCounter.startMonitoring();
}

/**
 * @brief Verarbeitet Systemereignisse, zeitabhängige Zählerpflege und ausstehende MQTT-Nachrichten.
 */
void loop() {

  // Dispatch application actions (registered controller)
  Appl.dispatch();

  // put your main code here, to run repeatedly:
  oGasCounter.dispatch();

  oAppControl.dispatch();
  
}
