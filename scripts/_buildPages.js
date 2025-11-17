/**
 * Build pages
 * This script is used to synchronize files between different directories.
 * It is part of the PLibESPV1 project.
 * 
 * @file scripts/syncFiles.js
 * @author LSC Labs - Peter Liebl
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import { CConfig, getProjectName,Utils } from './_common.js';

const MODULE_NAME = "buildPages";
const MODULE_VERSION = "0.1";


/**
 * Minimum needed informations for this module
 */
const DEFAULTS = {
    "locations": {
        "webSource": "src/web"
    },
    "pageNames": {
        "htmlFile": "_pages.html",
        "scriptFile": "_pages.js",
        
    },
    "writePageHandlerRegistration": true,
    "usePages": []

}
var Settings = new CConfig(DEFAULTS);

const Status = {
    "numHTML": 0,
    "numScript": 0,
    "numLanguages": 0,
    "numErrors": 0,
    "numSyncFiles": 0,
    "bCreatePageRegistration": false
}


// #region common functions

function getBasePath(bCreateIfNotExist = true) {
    let strBasePath = Settings.getData("locations.webSource","src/web");
    if(bCreateIfNotExist && !fs.existsSync(strBasePath)) fs.mkdirSync(strBasePath,{recursive: true})
    return(strBasePath);
}

function getHtmlTargetName(bCreateIfNotExist = true) {
    return(
        path.join(
            getBasePath(bCreateIfNotExist),
            Settings.getData("pageNames.htmlFile","_pages.html")
        )
    );
}

function getScriptTargetName(bCreateIfNotExist = true) {
    let strBasePath = path.join(getBasePath(false),"js");
    if(bCreateIfNotExist && !fs.existsSync(strBasePath)) fs.mkdirSync(strBasePath,{recursive: true})    
    return(
        path.join(
            strBasePath,
            Settings.getData("pageNames.scriptFile","_pages.js")
        )
    );
}

function getLanguagePath(bCreateIfNotExist = true) {
    let strPath = path.join(
        getBasePath(false),
        Settings.getData("locations.i18nLoc","i18n")
    );
    if(bCreateIfNotExist && !fs.existsSync(strPath)) fs.mkdirSync(strPath,{recursive: true});
    return(strPath);
}
// #endregion

// #region HTML page joiner
function joinHtmlPage(strPagePath) {
    let strInput = path.join(strPagePath,"page.html");
    if(fs.existsSync(strInput)) {
        let strOut = getHtmlTargetName();
        console.log("   -> appending HTML to : " + strOut);
        let strData = fs.readFileSync(strInput);
        fs.appendFileSync(strOut,strData);
        Status.numHTML++;
    }
}
// #endregion

// #region Script file joiner
let tPageHandlerRegistration = [];

function joinScriptPage(strPagePath) {
    let strInput = path.join(strPagePath,"page.js");
    if(fs.existsSync(strInput)) {
        let strOut = getScriptTargetName();
        console.log("   -> appending Script to : " + strOut);
        let strData = fs.readFileSync(strInput);
        fs.appendFileSync(strOut,strData);
        Status.numScript++;

        let oRXPageRegistration = new RegExp('@PageBuilder:register\((?<id>.*),(?<class>[a-zA-Z0-9_]*)\).*',"g");
        let oRXResult = oRXPageRegistration.exec(strData);
        if(oRXResult) {
            Status.bCreatePageRegistration = true;
            let strID = oRXResult.groups.id.startsWith("(") ? oRXResult.groups.id.substring(1) : oRXResult.groups.id;
            let strClass = oRXResult.groups.class.endsWith(")") ? oRXResult.groups.class.substring(0,oRXResult.groups.class.length-1) : oRXResult.groups.class;
            console.log("   -> Page registration found, will register page handler:" + strID + " with " + strClass);
            tPageHandlerRegistration.push({ "id": strID, "class": strClass });
        }
    }
}


function writePageHandlerRegistration() {
    if(Status.bCreatePageRegistration && Utils.isTrueValue(Settings.getData("writePageHandlerRegistration",true))) {
        let strOut = getScriptTargetName();
        console.log("   -> writing page handler registration to : " + strOut);
        let fd = fs.openSync(strOut, 'a');
        if(fd) {
            fs.writeSync(fd, "\n// Page Handler Registration\n");
            fs.writeSync(fd, "function registerPageHandler(pApp) {\n");
            tPageHandlerRegistration.forEach((oPageHandler) => {
                console.log(oPageHandler);
                fs.writeSync(fd, `    pApp.registerPageHandler("${oPageHandler.id}",new ${oPageHandler.class}(pApp));\n`);
            });
            fs.writeSync(fd, "}\n");
            fs.writeSync(fd, "\n// End of Page Handler Registration\n");
            fs.close(fd);
            console.log("   -> Page Handler registration written.");
        }
    }
}
// #endregion

// #region Multi language (i18n) joiner


function getJsonFromFile(strFile) {
    let oData = {};
    if(fs.existsSync(strFile)) {
        let strData = fs.readFileSync(strFile);
        oData = JSON.parse(strData);
    }
    return(oData);
}

function joinLanguages(strPagePath) {
    let strInputPath = path.join(strPagePath,"i18n"); {
        let oRX = new RegExp("^[a-z]{2}\.json$")
        if(fs.existsSync(strInputPath)) {
            fs.readdirSync(strInputPath).forEach((strFile) => {
                let oRX = new RegExp("^[a-z]{2}\.json$");
                if(oRX.test(strFile)) {
                    console.log("   -> joining language : " + strFile);
                    // Join the language....
                    let strTargetFile = path.join(getLanguagePath(),strFile);
                    // remember existing data....
                    let oTarget = getJsonFromFile(strTargetFile);
                    let strInputFile = path.join(strInputPath, strFile);
                    let oInput = getJsonFromFile(strInputFile);
                    let oTargetConfig = new CConfig(oTarget);
                    oTargetConfig.addConfig(oInput);
                    // merge the data and write back...
                    // let oResult = {...oTarget,...oInput}
                    // fs.writeFileSync(strTargetFile,JSON.stringify(oResult,null,2));
                    fs.writeFileSync(strTargetFile,JSON.stringify(oTargetConfig.getConfig(),null,2));

                    Status.numLanguages++;
                }
            });
        }
    }
}
// #endregion

// #region Prepare joining and cleanup


const HTML_PREAMBLE = [
    "<!-- ",
    " ***************************************************************************",
    " * This file is generated by \"" + MODULE_NAME + " v" + MODULE_VERSION + "\"",
    " * Do not edit this file, it will be overwritten by the pageBuilder script.",
    " * The " + MODULE_NAME + " module is part of the PLibESPV1 project.",
    " * Build date: " + new Date().toISOString(),
    " * Build context: " + getProjectName(),
    " *************************************************************************** -->",
    ""
];
const SCRIPT_PREAMBLE = [
    "/***************************************************************************",
    " * This file is generated by \"" + MODULE_NAME + " v" + MODULE_VERSION + "\"",
    " * Do not edit this file, it will be overwritten by the pageBuilder script.",
    " * The " + MODULE_NAME + " module is part of the PLibESPV1 project.",
    " * Build date: " + new Date().toISOString(),
    " * Build context: " + getProjectName(),
    " ***************************************************************************/",
    ""
];
/**
 * remove already existing targets, to avoid appending duplicates.
 * This is needed for html and script.
 * 
 * NOT for JSON files like language files (!)
 * 
 */
function removeTargetPages() {
    if(fs.existsSync(getHtmlTargetName()))   fs.rmSync(getHtmlTargetName())
    if(fs.existsSync(getScriptTargetName())) fs.rmSync(getScriptTargetName())
}

function writeTextToFile(strFileName,tArray = []) {
    if(strFileName) {
        let fd = fs.openSync(strFileName,'w');
        if(fd) {
            console.log(" - writing to : " + strFileName);
            tArray.forEach((strLine) => {
                console.log(" -> : " + strLine)
                fs.writeSync(fd, strLine + "\n");
            })
            fs.close(fd);
        }
    }
}
/**
 * Create the defaults and write a preamble to avoid the user will edit
 * and loose the changes after next run (!)
 */
function prepareAndWritePreamples() {
    writeTextToFile(getHtmlTargetName(),HTML_PREAMBLE);
    writeTextToFile(getScriptTargetName(),SCRIPT_PREAMBLE);
}
// #endregion





/**
 * start building the pages...
 * Iterate over the page def locations and call the generators...
 */
function processPages() {
    for(let strPageLocation of Settings.getData("usePages",[])) {
        console.log(" - processing page defintion : " + strPageLocation);
        joinHtmlPage(strPageLocation);
        joinScriptPage(strPageLocation);
        joinLanguages(strPageLocation);
    }
}


/**
 * build the pages from page definitions
 * 
 * @param {function()} cb        as running in context of gulp, this is a callback
 * @param {CConfig | object } oSettings user settings
 */
export async function runBuildPages(cb, oSettings) {
    console.log("---- build pages....");
    Settings.addConfig(oSettings);
    removeTargetPages();
    prepareAndWritePreamples();
    processPages();
    writePageHandlerRegistration();
    if(Utils.isFunction(cb)) cb();
}
