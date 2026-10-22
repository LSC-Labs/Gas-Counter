/**
 * Update version info
 * gets the prog name and version info from package.json and updates the settings.js
 * It is part of the PLibESPV1 project.
 * 
 * @file scripts/syncFiles.js
 * @author LSC Labs - Peter Liebl
 * @version 1.0.10.2
 */

// const process = require('process');
import process from 'process';
import fs from 'fs';
import path from 'path';
import { CConfig, getProjectName,Utils } from './_common.js';

const MODULE_NAME = "updateVersionInfos";
const MODULE_VERSION = "1.0.10";

const args = process.argv;

var oLocations = {
    "appsetting":           path.join("src","web","js","settings.js"),
    "versionfile":          path.join("data","version.json"),
    "versionincludefile":   path.join("include","ProgVersion.h"),
    "packagefile":          "package.json",
    "basebuildfolder":      path.join(".pio","build"),
    "buildfilefolder":      "src",
    "mainbuildfile":        "main.cpp.o",
    "test": {
        statusFiles: 
        [
            path.join("test","data","status.json"),
            path.join("src","web","apiV1","status")

        ]
    }
}

var oPackageData = {
    "name": "-",
    "version": "0.0.0.1"
}

/**
 * Version Data (initial without name)
 * if name is not in place, the root of the project name will be used,
 * otherwise, it will not be touched here...
 * Version numbers will be handled:
 * major, minor and patch will be used from package information..
 * build number will be increased
 */
var oVersionData = {
	"major": 0,
	"minor": 1,
	"patch": 0,
	"build": 0
}

function getDirectories(path) {
  return fs.readdirSync(path).filter(function (file) {
    return fs.statSync(path+'/'+file).isDirectory();
  });
}

function forceCompileMain() {
    for(let strName of getDirectories(oLocations.basebuildfolder)) {
        
        console.log("forcing on build : " + strName);
        let strFileName = path.join(oLocations.basebuildfolder,strName,oLocations.buildfilefolder,oLocations.mainbuildfile);
        if(fs.existsSync(strFileName)) {
            fs.rmSync(strFileName);
            console.log( "  --> unlinking " + strFileName);
        }

    }
}


function loadVersionFile() {
    let bResult = false;
    let strFile = oLocations.versionfile;
     if( fs.existsSync(strFile)) {
        console.log("---> using version file: " + strFile)
        let strData = fs.readFileSync(strFile);
        oVersionData = JSON.parse(strData);
        bResult = true;
    } else {
        console.log("[E] version file not found : " + strFile)
    }
    return(bResult);
}

function loadProjectPackageFile() {
    let bResult = false;
    let strFile = oLocations.packagefile;
    if( fs.existsSync(strFile)) {
        console.log("---> using project package file: " + strFile)
        let strData = fs.readFileSync(strFile);
        oPackageData = JSON.parse(strData);
        bResult = true;
    } else {
        console.log("[E] project package file not found : " + strFile)
    }
    return(bResult);
}

function updateProjectPackageFile() {
    // load was already in place... oPackageData contains the needed infos.
    let bModified = false;
    let tVersion = oPackageData.version.split('.');
    let nMajor = tVersion[0] ?? 0;
    let nMinor = tVersion[1] ?? 0;
    let nPatch = tVersion[2] ?? 1;

    for(let strArg of args) {
        switch(strArg) {
            case "-major": bModified = true; nMajor++; nMinor = 0; nPatch = 0; break;
            case "-minor": bModified = true; nMinor++; nPatch = 0; break;
            case "-patch": bModified = true; nPatch++; break;
        }
    }

    if(bModified) {
        oVersionData.build = -1;
        console.log("Updating package version info...");
        oPackageData.version = nMajor + "." + nMinor + "." + nPatch;
        // Write to filesystem - pretty print 
        let strJson = JSON.stringify(oPackageData,null,4);
        fs.writeFileSync(oLocations.packagefile, strJson);
    }
    return(bModified);
}

function getLongVersionString() {
    return(oVersionData.major + "." + oVersionData.minor + "." + oVersionData.patch + "." + oVersionData.build);
}

function showCurrentVersion() {
    console.log(" - Prog Name : " + oVersionData.name);
    console.log(" - Version   : " + getLongVersionString());
}



function updateVersionFile(bResetBuild) {
    console.log("---> update version file...")
    // set name only, if not already in place...
    if(!oVersionData.name) {
       oVersionData.name = path.basename(process.cwd());
    }
    oVersionData.author = oPackageData.author;
    oVersionData.homepage = oPackageData.homepage;
    
    // User major/minor/patch from package file
    // and increment the requested (build) number...
    let tVersion = oPackageData.version.split('.');
    oVersionData.major = tVersion[0];
    oVersionData.minor = tVersion[1];
    oVersionData.patch = tVersion[2];
    oVersionData.build++;
    if(bResetBuild) oVersionData.build = 0;

    // Write to filesystem - pretty print 
    let strJson = JSON.stringify(oVersionData,null,4);
    fs.writeFileSync(oLocations.versionfile, strJson);
}

function updateSettingFile() {
    console.log("---> update setting file...")
    let strFile = oLocations.appsetting;
    if(fs.existsSync(strFile)) {
        let strContent = fs.readFileSync(strFile).toString('utf-8');
        let tFileData = strContent.split(/\r?\n/);
        let nLineNumber = 1;

        var oWS = fs.createWriteStream(strFile);
        oWS.on('error', function(err) { console.log("Error on writing to " + strFile); console.log(err); });
        tFileData.forEach(function(strLine) { 
            if(strLine.match(/\"prog_name\"\s*:\s*\"([\.\-_A-Za-z0-9\s]*)\"/)) {
                strLine = strLine.substring(0, strLine.indexOf(":")) + ":" + '"' + oVersionData.name + `",`;
            }
            if(strLine.match(/\"prog_ver\"\s*:\s*\"([\.\-_A-Z0-9]*)\"/)) {
                strLine = strLine.substring(0, strLine.indexOf(":")) + ":" + '"' + oPackageData.version + `",`;
            }
            oWS.write(strLine + '\n'); 
        });
        oWS.end();

    } else {
        console.log("[E] - app setting file '" + strFile + "' not found...");
    }
}


var ProgVersionIncludeSkel = [
        '#pragma once',
        '\n' + '// (c) LSC Labs',
        '\n' + '// This file will be build by the runtime, so do not change here.',
        '\n' + '// If you want to change the major/minor/patch version nummer, use the file data/prog_ver.json.',
        '\n' + '// Use the npm incr* scripts to update this file.',
        '\n' + '// The build nummer will be incremented by platform.io -> prebuild steps (release mode)',
        '\n'
]
    


/**
 * ProgVersion.h in include file folder - set new values...
 */
function updateVersionIncludeFile() {
    console.log("---> update version include file...")
    let strFile = oLocations.versionincludefile;
    if(fs.existsSync(strFile)) {
        let strData = fs.readFileSync(strFile);
        var oWS = fs.createWriteStream(strFile);
        oWS.on('error', function(err) { console.log("Error on writing to " + strFile); console.log(err); });
        for(let strLine of ProgVersionIncludeSkel) oWS.write(strLine);
        oWS.write("\n#define PROG_VERSION_NAME  \"" + oVersionData.name        + "\"");
	    oWS.write("\n#define PROG_AUTHOR        " + oVersionData.author     );
		oWS.write("\n#define PROG_HOMEPAGE      " + oVersionData["homepage"]);
		oWS.write("\n#define PROG_VERSION_MAJOR " + oVersionData["major"]   );
		oWS.write("\n#define PROG_VERSION_MINOR " + oVersionData["minor"]   );
		oWS.write("\n#define PROG_VERSION_PATCH " + oVersionData["patch"]   );
		oWS.write("\n#define PROG_VERSION_BUILD " + oVersionData["build"]   );
		oWS.write("\n#define PROG_VERSION       \"" + oVersionData["major"] + "." + oVersionData["minor"] + "." + oVersionData["patch"] + "\"");
		oWS.write("\n#define PROG_VERSION_SHORT \"" + oVersionData["major"] + "." + oVersionData["minor"] + "\"");
		oWS.write("\n#define PROG_VERSION_LONG  \"" + getLongVersionString() + "\"");
        oWS.end();
    } else {
        console.log("[E] - app setting file '" + strFile + "' not found...");
    }
}


function updateTestStatusFile(strFile) {
    if(!strFile) strFile = oLocations.test.statusFiles[0]; 
    console.log("---> update test status file : " + strFile);
    if(fs.existsSync(strFile)) {
        let strData = fs.readFileSync(strFile);
        let oTestData = JSON.parse(strData);
        oTestData.prog_name = oVersionData.name;
        oTestData.prog_version = getLongVersionString() + "-T";

        
        // Write to filesystem - pretty print 
        let strJson = JSON.stringify(oTestData,null,4);
        fs.writeFileSync(strFile, strJson);

    } else {
        console.log("[E] - app setting file '" + strFile + "' not found...");
    }
}


/**
 * build the pages from page definitions
 * 
 * @param {function()} cb        as running in context of gulp, this is a callback
 * @param {CConfig | object } oSettings user settings
 */
export async function runUpdateVersionInfos(cb, oSettings) {
    console.log("---- update version info files....");
    if(loadPackageData()) {

    } else {
        console.log("[E] package file not found: " + PACKAGE_FILE)
    }
    if(Utils.isFunction(cb)) cb();
}



console.log("********************************************");
console.log("---- " + MODULE_NAME + " Version " + MODULE_VERSION);
console.log("********************************************");
if(loadProjectPackageFile() && loadVersionFile()) {
    let bPackageUpdate = updateProjectPackageFile();
    updateVersionFile();   
    updateSettingFile();
    updateVersionIncludeFile();
    oLocations.test.statusFiles.forEach(strFile => updateTestStatusFile(strFile));
}
console.log("==> udpated to Version:");
console.log("--------------------------------------------");
showCurrentVersion();
console.log("--------------------------------------------");

forceCompileMain();