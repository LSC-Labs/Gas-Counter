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


CFS oFS;
CWiFiController oWiFiController;
CMQTTController oMqttController;
CWebSocket      oWebSocket("/ws");
CWebServer      oWebServer(80);
CGasCounter     oGasCounter(D5);
CAppControl     oAppControl;
CMDNSController oMDNSController;
CStatusLed      oStatusLed(D6,D5,D0,false); // RGB LED on D6=Red, D5=Green, D0=Blue


#ifdef DEBUGINFOS
void runDebugTests() {
  JsonDocument oCfg;
  JsonObject oCfgNode = oCfg.to<JsonObject>();
  Appl.writeConfigTo(oCfgNode,false);
  DEBUG_INFO("Current configuration:");
  DEBUG_JSON_OBJ(oCfgNode);
}
#endif

void setup() {
  Serial.begin(115200);
  DEBUG_INFOS("\nInitializing application: \"%s\" Version: %s\n",APP_NAME,APP_VERSION);
  
  Appl.addConfigHandler("wifi",&oWiFiController);
  Appl.addConfigHandler("mqtt",&oMqttController);
  Appl.addConfigHandler("gascounter",&oGasCounter);

  Appl.addStatusHandler("wifi",&oWiFiController);
  Appl.addStatusHandler("mqtt",&oMqttController);
  Appl.addStatusHandler("gascounter",&oGasCounter);

  Appl.MsgBus.registerEventReceiver(&oAppControl);
  Appl.MsgBus.registerEventReceiver(&oMqttController);

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
}

void loop() {

  // Dispatch application actions (registered controller)
  Appl.dispatch();

  // Dispatch the WebSocket messages
  oWebSocket.dispatchMessageQueue();

  // put your main code here, to run repeatedly:
  oGasCounter.dispatch();

  oAppControl.dispatch();
  
  // Send the heartbeat, if configured
  oMqttController.publishHeartBeat();
}
