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
CStatusLed      oStatusLED(oGasCounter,D6,D5,D0,false); // RGB LED on D6=Red, D5=Green, D0=Blue


#ifdef DEBUGINFOS
/**
 * @brief Gibt die aktuelle Konfiguration zur Diagnose auf der seriellen Schnittstelle aus.
 */
void runDebugTests() {
  DEBUG_INFO("Registered Event Receiver:");
  Appl.MsgBus.dumpReceiver();

  DEBUG_INFO("Registered Config Handler:");
  Appl.dumpConfigHandler();  

  JsonNode oCfgNode;
  Appl.writeConfigTo(oCfgNode,false);
  DEBUG_INFO("Current configuration:");
  Serial.println(oCfgNode.getAsJsonTextPretty());
  CJsonNode * pWiFiNode = oCfgNode.getObject("wifi");
  if(pWiFiNode) {
    Serial.println(pWiFiNode->getAsJsonText());
  }
}
#endif

void registerModules() {
  DEBUG_FUNC_START();
  Appl.registerModule("wifi",          &oWiFiController);
  Appl.registerModule("web",           &oWebServer);
  Appl.registerModule("mqtt",          &oMqttController);
  Appl.registerModule("gascounter",    &oGasCounter);
  Appl.registerModule("ntp",           &oNTPHandler);

  Appl.MsgBus.registerEventReceiver(&oAppControl,"AppCtrl");
  Appl.MsgBus.registerEventReceiver(&oStatusLED,"StatusLED");
  Appl.MsgBus.registerEventReceiver(&oWebSocket,"WebSocket");

  oMqttController.registerHomeAssistantComponent("wifi",  &oWiFiController);
  oMqttController.registerHomeAssistantComponent("gascounter",&oGasCounter);  
  DEBUG_FUNC_END();
}

/**
 * @brief Registriert Konfigurations-, Status- und MQTT-Empfänger und startet Netzwerk/Webserver.
 * NTP liefert die lokale Kalenderzeit für den Tageswechsel; Monitoring startet zuletzt.
 */
void setup() {
  //  Serial.begin(115200);
  DEBUG_FUNC_START();
  DEBUG_INFOS("\nInitializing application: \"%s\" Version: %s\n",APP_NAME,APP_VERSION);
  oStatusLED.setColor(RGB_COLOR::BLUE);
  registerModules();

  Appl.init(APP_NAME,APP_VERSION);
  Appl.sayHello();
  
  bool bUseConfigData = Appl.readConfigFrom(CONFIG_FILE);
  Appl.printDiag();
  Appl.Log.logInfo(F("Initializing services..."));
 
  // Initialize and start the WiFi
  oWiFiController.startWiFi(bUseConfigData);
  
  // Prepare and start the Web Server
  registerWebRoutes(oWebServer);  
  oWebServer.addHandler(&oWebSocket);
  oWebServer.begin();

  if(oWiFiController.Status.isInAccessPointMode) {
    delay(500);
    // oDisplay.activatePage("APConfig-Page");
    // oDisplay.freezePage();
  } else {
    // Message broker only, if in station mode...
    oMqttController.setup();
  }

  
  Appl.Log.logInfo(F("Hello world... - let's start the show!"));
  oStatusLED.showStartupFlashLight(250);
  delay(200);

  #ifdef DEBUGINFOS
    runDebugTests();
  #endif

  oGasCounter.startMonitoring();
  Appl.start();
  DEBUG_FUNC_END();
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
