
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

void sendLargeZippedBin(AsyncWebServerRequest *pRequest,const char * pszType, const uint8_t tData[], const size_t nDataSize) {
    DEBUG_FUNC_START_PARMS("%s,%u",pszType,nDataSize);
   //  const size_t nDataSize = sizeof(tData);

    AsyncWebServerResponse *pResponse = 
        pRequest->beginChunkedResponse( 
            pszType,                         
            [tData,nDataSize](uint8_t *pBuffer, size_t nMaxLen, size_t nAlreadySent) -> size_t {
                // DEBUG_INFOS("sendLargeBin: maxLen=%u, alreadySent=%u", (unsigned)nMaxLen, (unsigned)nAlreadySent);
                if (nDataSize - nAlreadySent >= nMaxLen) {
                    DEBUG_INFO("sendLargeBin: sending full chunk");
                    memcpy(pBuffer, tData + nAlreadySent, nMaxLen);
                    return nMaxLen;
                } else {  // last chunk and then 0
                    DEBUG_INFO("sendLargeBin: sending last chunk");
                    memcpy(pBuffer, tData + nAlreadySent, nDataSize - nAlreadySent);
                    return nDataSize - nAlreadySent; 
                }
            }
        );
    pResponse->addHeader("Content-Encoding", "gzip");
    pRequest->send(pResponse);
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
        /*sendLargeZippedBin(request,
                         "text/javascript",
                         _runtime_js_gz,
                         _runtime_js_gz_len
                        );
        */
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

/* touched by page compiler : 1765442290931 */
