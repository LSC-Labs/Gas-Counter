
/**
 * WebRoutes.cpp
 * 
 * Is part of PLibESPV1 - CWebServer
 * 
 * Insert your application specific static pages here, also
 * as the defaults and the registration/handling of API's
 * 
 * 
 */
#ifndef DEBUG_LSC_WEBROUTES
    #undef DEBUGINFOS
#endif

#include <WebServer.h>
#include <JsonHelper.h>
#include <web/index.html.gz.h>
#include <web/app.css.gz.h>
#include <web/_app.css.gz.h>
#include <web/settings.js.gz.h>
#include <web/_runtime.css.gz.h>
#include <web/_runtime.js.gz.h>
#include <web/_pages.html.gz.h>
#include <web/_pages.js.gz.h>
#include <web/de.json.gz.h>
#include <web/en.json.gz.h>


void sendGzipResponse(AsyncWebServerRequest *pRequest, AsyncWebServerResponse *pResponse) {
    DEBUG_FUNC_START();
    DEBUG_INFOS("WEB: %s",pRequest->url().c_str());
    pResponse->addHeader("Content-Encoding", "gzip");
    pRequest->send(pResponse);
    DEBUG_FUNC_END();
}

void sendJsonResponse(JsonDocument &oDoc, AsyncWebServerRequest *pRequest) {
    DEBUG_FUNC_START();
    DEBUG_INFOS("WEB: %s",pRequest->url().c_str());
    DEBUG_JSON_OBJ(oDoc);
    AsyncResponseStream *pStream =  pRequest->beginResponseStream(F("application/json"));
    serializeJson(oDoc, *pStream);
    pRequest->send(pStream);
    DEBUG_FUNC_END();
}



void registerWebRoutes(CWebServer &oWebServer) {
    oWebServer.registerDefaults();
    oWebServer.registerFileAccess();
    
    oWebServer.on("/index.html", HTTP_GET, [](AsyncWebServerRequest *request) {
        sendGzipResponse(request,
                         request->beginResponse_P(
                            200,
                            F("text/html"),
                            index_html_gz, 
                            index_html_gz_len)
                        );
	});

    oWebServer.on("/_pages.html", HTTP_GET, [](AsyncWebServerRequest *request) {
        sendGzipResponse(request,
                         request->beginResponse_P(
                            200,
                            F("text/html"),
                            _pages_html_gz, 
                            _pages_html_gz_len)
                        );
	});

    oWebServer.on("/css/_runtime.css", HTTP_GET, [](AsyncWebServerRequest *request) {
		sendGzipResponse(request,
                         request->beginResponse_P(
                            200,
                            F("text/css"),
                            _runtime_css_gz, 
                            _runtime_css_gz_len)
                        );
	});


    oWebServer.on("/css/app.css", HTTP_GET, [](AsyncWebServerRequest *request) {
		sendGzipResponse(request,
                         request->beginResponse_P(
                            200,
                            F("text/css"),
                            app_css_gz, 
                            app_css_gz_len)
                        );
	});

    oWebServer.on("/css/_app.css", HTTP_GET, [](AsyncWebServerRequest *request) {
		sendGzipResponse(request,
                         request->beginResponse_P(
                            200,
                            F("text/css"),
                            _app_css_gz, 
                            _app_css_gz_len)
                        );
	});

    oWebServer.on("/js/settings.js", HTTP_GET, [](AsyncWebServerRequest *request) {
        sendGzipResponse(request,
                         request->beginResponse_P(
                            200,
                            F("text/javascript"),
                            settings_js_gz, 
                            settings_js_gz_len)
                        );
	});


	oWebServer.on("/js/_runtime.js", HTTP_GET, [](AsyncWebServerRequest *request) {
        sendGzipResponse(request,
                         request->beginResponse_P(
                            200,
                            F("text/javascript"),
                            _runtime_js_gz, 
                            _runtime_js_gz_len)
                        );
	});

	oWebServer.on("/js/_pages.js", HTTP_GET, [](AsyncWebServerRequest *request) {
        sendGzipResponse(request,
                         request->beginResponse_P(
                            200,
                            F("text/javascript"),
                            _pages_js_gz, 
                            _pages_js_gz_len)
                        );
	});

    oWebServer.on("/i18n/de.json", HTTP_GET, [](AsyncWebServerRequest *request) {
        sendGzipResponse(request,
                         request->beginResponse_P(
                            200,
                            F("application/json"),
                            de_json_gz, 
                            de_json_gz_len)
                        );
	});
    oWebServer.on("/i18n/en.json", HTTP_GET, [](AsyncWebServerRequest *request) {
        sendGzipResponse(request,
                         request->beginResponse_P(
                            200,
                            F("application/json"),
                            en_json_gz, 
                            en_json_gz_len)
                        );
	});
    
    oWebServer.on("/apiV1/status", HTTP_GET, [](AsyncWebServerRequest *request) {
        JSON_DOC(oStatus,4096);
        Appl.writeStatusTo(oStatus);
        sendJsonResponse(oStatus,request);
	});
    
    oWebServer.on("/apiV1/sysstatus", HTTP_GET, [](AsyncWebServerRequest *request) {
        JSON_DOC(oStatus,2048);
        Appl.writeSystemStatusTo(oStatus);
        sendJsonResponse(oStatus,request);
	});
}

/* touched by page compiler : 1763393136048 */
/* touched by page compiler : 1763393165500 */
/* touched by page compiler : 1763393563618 */
/* touched by page compiler : 1763393742050 */
/* touched by page compiler : 1763395950737 */
/* touched by page compiler : 1763396019053 */
/* touched by page compiler : 1763396054607 */
/* touched by page compiler : 1763396124046 */
/* touched by page compiler : 1763409319204 */
/* touched by page compiler : 1763476660531 */
/* touched by page compiler : 1763476708378 */
/* touched by page compiler : 1763476970449 */
/* touched by page compiler : 1763477315850 */
/* touched by page compiler : 1763719306900 */
/* touched by page compiler : 1764239413419 */
/* touched by page compiler : 1764239574489 */
/* touched by page compiler : 1764239638423 */
/* touched by page compiler : 1764239705803 */
/* touched by page compiler : 1764239948164 */
