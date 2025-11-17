/**
 * WebSocket emulator for OnAirLight messages
 * i.E. use Postman to simulate the calls
 * see: https://blog.postman.com/set-up-a-websockets-server-in-node-js-postman/
 * 
 * to receive the objects you have to send Json requests from Postman like:
 * { "command": "status" }
 * Expecting module to be in project subdir toos/wsemulator (2 Level deep !)
 */

console.log("[I] Starting WebSocket Emulation Server for your hardware");
console.log("[I] You can connect to ws://localhost (port is 8080)");
console.log("[I| Send your requests to this port with json requests like {\"command\": \"status\"}");
console.log("[I] ..use i.E. Postmand with websock request");

const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");

// #region Security

// For authentication - simulate Token - has to be the same as in the web - page...
const AccessToken="JoWaschlEmulator";
const WS_NEEDS_AUTH = "saveconfig,getbackup,restorebackup,restart,factoryreset";

function needsAuth(strCommand) {
    let bNeedsAuth = false;
    WS_NEEDS_AUTH.split(",").forEach(strCmd => {
        if(strCmd == strCommand) bNeedsAuth = true;
    });
    return(bNeedsAuth);
}
function isAuthorized(oMsg) {
    let bIsAuthorized = true;
    if(needsAuth(oMsg.command)) {
        bIsAuthorized = (AccessToken == oMsg.token);
        console.log("checking access token : " + oMsg.token);
    }
    return(bIsAuthorized);
}

// #endregion

// #region setup the websocket server and default Websocket functions



const wss = new WebSocket.Server({
    port: 8080
});

/// Send message to all clients
wss.broadcast = function broadcast(oJsonData) {
    wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(oJsonData));
        }
    });
};



/// Register event handler on the websocket
wss.on('connection', function connection(ws) {
    ws.on("error", () => console.log("[W] WebSocket Error - Assume a client is disconnected."));
    ws.on('message', function incoming(message) {
        let oMsg = JSON.parse(message);
        console.log("[I] Request command '" + oMsg.command +"' received...") ;
        if(isAuthorized(oMsg)) {
            let strCommand = oMsg.command ? oMsg.command.toLowerCase() : "no-command";
            switch (strCommand) {

                case "getstatus":
                    sendStatus();
                    break;

                case "getconfig":
                    sendConfig();
                    break;

                case "saveconfig":
                    saveConfig(oMsg.payload);
                    break;

                case "getbackup":
                    backupConfig();
                    break;

                case "gettime":
                    sendTime();
                    break;

                case "settime":
                    setTime(oMsg.payload);
                    break;

                case "getfile":
                    sendFile(oMsg.payload);
                    break;

                case "getfilelist":
                    sendFileList();
                    break;

                case "scanwifi":
                    sendWiFiList();
                    break;

                case "scanrf433":
                    sendRF433ScanCode();
                    break;
        
                case "restart":
                    console.log(" ----- REBOOTING -----");
                    break;

                case "factoryreset":
                    console.log(" ----- FACTORY RESET -----");
                    oConfigData = getObjectFromFile("config.json");
                    break;

                default:
                    console.log("[W] Unknown command " + strCommand);
                    console.log(oMsg);
                    break;
            }
        } else {
            sendAccessDenied(oMsg);
        }
    });
});



//#endregion

// #region Helper functions
function findFile(strFileName) {
    let strFoundFile;
    [
        "../../test/data",
        "../../test",
        "test/data",
        "test",
        "."
    ].forEach(strPath => {
        if(!strFoundFile) {
            let strFile = path.join(strPath,strFileName);
            if(fs.existsSync(strFile)) { 
                strFoundFile = strFile;
            }
        }
    });
    return strFoundFile;
}
function getObjectFromFile(strFileName) {
    let oResult = {};
    if(strFileName) {
        console.log(` - searching : "${strFileName}"` )
        let strFoundFile = findFile(strFileName);
        if(strFoundFile) {
            console.log(` - using     : "${strFoundFile}"` )
            let strData = fs.readFileSync(strFoundFile);
            try {
                oResult = JSON.parse(strData);
            } catch(ex) {
                console.log("[X] Exception reading file: " + strFoundFile);
                console.log(strData);
                console.log(ex);
            }
        }
    }
    console.log(oResult);
    return(oResult);

}


/// Send a payload package to all receivers
function sendPayload(strCommand, strDataType, oPayload, bWithToken) {
    let oData = {
        "command": strCommand,
        "data":    strDataType,
        "payload": oPayload
    };
    if(bWithToken === true) oData.auth = AccessToken
    console.log("[I] sending data on websocket...");
    console.log(oData)
    wss.broadcast(oData);
}

function sendAccessDenied(oMsg) {
    let oData = {
        "command": "error",
        "data":    "401",
        "AccessToken": "notValid",
        "payload": {
            "msg": "access denied",
            "command": oMsg.command,
            "type"   : "null"
        }
    };
    console.log("[I] sending data on websocket...");
    console.log(oData)
    wss.broadcast(oData);
}
// #endregion

// #region Config and Status Data emulators
/**
 * Config stays as variable, to test saveConfig() and sendConfig()
 */
var oConfigData = getObjectFromFile("config.json");

function sendConfig() {
    console.log("[I] Sending config data...")
    sendPayload("update","config",oConfigData,true);
    // wss.broadcast(stats);
}
function saveConfig(oCfg) {
    console.log("[I] Saving config data...")
    console.log(oCfg);
    oConfigData = oCfg;
}

function backupConfig() {
    sendPayload("backup","config",oConfigData,true);
}

function sendStatus() {
    // Status is always from the filesystem - update in test folder also during running tests !
    let oStatus = getObjectFromFile("status.json");
    sendPayload("update","status",oStatus);
}

function sendRF433ScanCode() {
    let nMin = 0xff0000;
    let nMax = 0xfffff0
    let nNum = Math.floor(Math.random() * (nMax - nMin + 1) + nMin);
    sendPayload("update","rf433code", { on: nNum });
}

//#endregion

// #region Time emulators

function sendTime() {
    console.log("[I] Sending time...");
    sendPayload("update","time",{ "Time": Math.floor((new Date).getTime() / 1000 )});
}

function setTime(oData) {
    console.log("[I] Setting local time to : " + oData.Time);
    oTime = new Date();
    oTime.setTime(oData.Time * 1000);
    console.log(oTime);
}

// #endregion

// #region Directory - and File emulators

function sendFileList() {
    let oPayloadData = [
        { "size": 1024, "name": "config.json" },
        { "size": 2048, "name": "data.txt" }
    ];
    sendPayload("file","dir",oPayloadData);
}

function sendFile(strFileName) {
    let oPayloadData = { 
        "name": strFileName
    };

    if(strFileName == "config.json") {
        oPayloadData["status"] = "OK";
        oPayloadData["content"] = configdata;
    } else if(strFileName == "data.txt" ) {
        oTextFile = "Hello World\nDas ist ein Textfile\n\nmit einem Testinhalt";
        oPayloadData["status"] = "OK";
        oPayloadData["content"] = oTextFile;
    } else {
        oPayloadData["status"] = "ERR";
    }
    sendPayload("file","content",oPayloadData);
}

// #endregion

// #region WiFi emulators

function sendWiFiList() {
    let oPayload = [{
                        "ssid": "Company's Network",
                        "bssid": "4c:f4:39:a1:41",
                        "rssi": "-84"
                    },
                    {
                        "ssid": "Home Router",
                        "bssid": "8a:e6:63:a8:15",
                        "rssi": "-42"
                    },
                    {
                        "ssid": "SSID Shown Here",
                        "bssid": "8a:f5:86:c3:12",
                        "rssi": "-77"
                    },
                    {
                        "ssid": "Great Wall of WPA",
                        "bssid": "9c:f1:90:c5:15",
                        "rssi": "-80"
                    },
                    {
                        "ssid": "Not Internet",
                        "bssid": "8c:e4:57:c5:16",
                        "rssi": "-87"
                    }
                ];
    sendPayload("update","ssidlist",oPayload);
    
}
// #endregion

