/**
 * Sync files script
 * This script is used to synchronize files between different directories.
 * It is part of the PLibESPV1 project.
 * 
 * @file scripts/syncFiles.js
 * @author LSC Labs - Peter Liebl
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import gulp from 'gulp';
import { CConfig } from './_common.js';

const DEFAULTS = {
    
    "locations": {
        "webSource": "src/web",
        "webDist"  : "dist/web",
        "webPacked": "tmp/tmp",
        "includes" : "dist/include",
        "rtLibrary": "lib/PLibESPV1"
    },

    "sync" : {
        "locations": [
                            ".",
                            "lib/PLibESPV1"
                    ],
        "files": [
                    "src/web/index.html          = src/web/index.html",
                    "src/web/i18n/de.json        = src/web/i18n/de.json",
                    "src/web/i18n/en.json        = src/web/i18n/en.json",
                    "src/web/css/runtime.css     > src/web/css/_runtime.css",
                    "src/web/css/runtime.css.map > src/web/css/_runtime.css.map",
                    "src/web/js/runtime.js       > src/web/js/_runtime.js",
                    "src/web/js/settings.js      = src/web/js/settings.js"
                ]
    },
}

const Settings = new CConfig(DEFAULTS);

const Status = {
    "numHTML": 0,
    "numScript": 0,
    "numLanguages": 0,
    "numErrors": 0,
    "numSyncFiles": 0,
    "bCreatePageRegistration": false
}
// #region Sync functions

function findSourceFile(strFile) {
    let strSourceFile = null;
    if(fs.existsSync(strFile)) strSourceFile = strFile;
    Settings.getData("sync.locations",[]).forEach((strLocation) => {
        let strSource = path.join(strLocation,strFile);
        if(!strSourceFile && fs.existsSync(strSource)) strSourceFile = strSource;
    });
    return(strSourceFile);
}

function findTargetFile(strFile, strSourceFile) {
    let strTargetFile = strFile;
    if(!strTargetFile) strTargetFile = strSourceFile;
    if(strTargetFile) {
        let strTargetPath = path.normalize(path.dirname(strTargetFile));
        if(strTargetPath.startsWith("/"))  strTargetPath = "." + strTargetPath;
        if(strTargetPath.startsWith("../")) {
            console.error(" - ERROR : target path is outside the project : " + strTargetPath);
            strTargetFile = null;   
        } else {
            fs.mkdirSync(strTargetPath, { recursive: true });
            strTargetFile = path.join(strTargetPath, path.basename(strTargetFile));
        }
    }
    return(strTargetFile);
}

function syncFile(strSourceFile, strTargetFile, strDirection) {
    console.log(`   => sync file: "${strSourceFile}" \t${strDirection} "${strTargetFile}"`);
    if(strSourceFile != strTargetFile) {
        let bSourceExists = fs.existsSync(strSourceFile);
        let bTargetExists = fs.existsSync(strTargetFile);
        let nSrcMS = bSourceExists ? fs.statSync(strSourceFile).mtimeMs : 0;
        let nTgtMS = bTargetExists ? fs.statSync(strTargetFile).mtimeMs : 0;

        switch(strDirection) {
            case "=":  if(!bTargetExists) {
                            console.log(`   (=) copying "${strSourceFile}" \tto "${strTargetFile}"`);
                            fs.copyFileSync(strSourceFile, strTargetFile);
                            Status.numSyncFiles++;
                        } else {
                            console.log("   (=) target file already exists - no action...");
                        }
                        break;

                        case ">":   if(nSrcMS > nTgtMS && bSourceExists) {
                            console.log(`   (>) copying "${strSourceFile}" \tto "${strTargetFile}"`);
                            fs.copyFileSync(strSourceFile, strTargetFile);
                            Status.numSyncFiles++;
                        } else {
                            console.log(bSourceExists ? 
                                        `   (>) target file is up to date...  - no action` :
                                        "   (>) source file does not exist... - no action");
                        }
                        break;

            case "<":   if(nTgtMS > nSrcMS && bTargetExists) {
                            console.log(`   (<) copying newer target to source "${strSourceFile}"`);
                            fs.copyFileSync(strTargetFile, strSourceFile);
                            Status.numSyncFiles++;
                        } 
                        break;

            case "<>":  if(nSrcMS > nTgtMS) syncFile(strSourceFile, strTargetFile,">");
                        if(nTgtMS > nSrcMS) syncFile(strSourceFile, strTargetFile,"<")
                        break;

            default:    console.error(" - ERROR : invalid sync command : " + strDirection);
                        Status.numErrors++;
                        break;
        }
    } else {
        console.log("   (x) source and target are identical - no action...");
    }
    console.log("");

}

async function syncFileList(cb) {
    Settings.getData("sync.files",[]).forEach((strInstruction) => {
        console.log(` - parsing: "${strInstruction}"`) ;
        // let oRegEx = new RegExp("^(?<source>[\\/\\._a-zA-Z0-9]*)\\s*(?<cmd>[<=>]{1,2})\\s*(?<target>.*)$");
        let oRegEx = /^(?<source>[\/\._a-zA-Z0-9]*)\s*(?<cmd>[<=>]{1,2})\s*(?<target>.*)$/gm
        let oMatch = oRegEx.exec(strInstruction);
        if(oMatch) {
            if(oMatch.groups.cmd && oMatch.groups.target) {
                let strSourceFile = findSourceFile(oMatch.groups.source.trim());
                if(!strSourceFile) { console.error(" - source file not found : " + oMatch.groups.source.trim());}
                else {
                    let strTargetFile = findTargetFile(oMatch.groups.target.trim(), strSourceFile);
                    syncFile(   strSourceFile,
                                strTargetFile,
                                oMatch.groups.cmd.trim());
                }
            } else {
                console.error(" - invalid instruction : [" + strInstruction + "]");
                Status.numErrors++;
            }
        } else {
            console.error(" - instruction does not respect rule <source> [<>] <target> : " + strInstruction);
            Status
        }
    });
    cb()
}





// #endregion


export async function runSyncFiles(cb, oSettings) {
    console.log("---- syncFiles....");
    if(oSettings && typeof oSettings === "object") {
        if(oSettings.sync) {    
            // to ensure, that only new settings are applied
            if(oSettings.sync.locations) { Settings.setData("sync.locations", oSettings.sync.locations) }
            if(oSettings.sync.files)     { Settings.setData("sync.files",oSettings.sync.files); }
        }
    }
    Settings.addConfig(oSettings);
    const runJob = gulp.series( syncFileList );
    return await runJob();
}