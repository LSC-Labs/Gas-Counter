/**
 * Sync files script
 * This script is used to synchronize files between different directories.
 * It is part of the PLibESPV1 project.
 *
 * @file scripts/syncFiles.js
 * @author LSC Labs - Peter Liebl
 * @version 1.5.0
 *
 * @param 1 == pages.json (or pages.json in cwd will be used)
 *
 * Instructions in pages.json -> "sync.files":   "<source> <cmd> <target>"
 *   =   copy only, if the target does not exist (initial copy, i.e. templates)
 *   >   copy source to target, if the source is newer
 *   <   copy target back to source, if the target is newer
 *   <>  copy in the direction of the newer file
 *
 * The source can also be a folder - then all files of the folder (including all
 * sub folders) are synced into the target folder with the same command, i.e.:
 *   "lib/PLibESPV1/src/web/pages/Status  =  src/web/pages/Status"
 *
 * Result of each file:
 *   🆕 new        - target did not exist, copied
 *   🔄 updated    - target was older, overwritten
 *   ⬅️  back       - newer target copied back to the source
 *   ✅ up to date - no action needed
 *   ⏭️  kept       - target exists (=), not overwritten
 *   ⚠️  missing    - source not found
 *   ❌ error      - invalid instruction / copy failed
 */


const MODULE_NAME = "syncFiles";
const MODULE_VERSION = "1.5.0";


import fs from 'fs';
import path from 'path';
import { CConfig, Utils } from './_common.js';

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

const RESULT = {
    NEW:      { icon: "🆕", text: "new       " },
    UPDATED:  { icon: "🔄", text: "updated   " },
    BACK:     { icon: "⬅️ ", text: "back      " },
    UPTODATE: { icon: "✅", text: "up to date" },
    KEPT:     { icon: "⏭️ ", text: "kept      " },
    MISSING:  { icon: "⚠️ ", text: "missing   " },
    ERROR:    { icon: "❌", text: "error     " },
};

const Status = {
    "numNew": 0,
    "numUpdated": 0,
    "numBack": 0,
    "numUpToDate": 0,
    "numKept": 0,
    "numMissing": 0,
    "numErrors": 0
}

function report(oResult, strSource, strDirection, strTarget, strInfo = "") {
    switch(oResult) {
        case RESULT.NEW:        Status.numNew++;        break;
        case RESULT.UPDATED:    Status.numUpdated++;    break;
        case RESULT.BACK:       Status.numBack++;       break;
        case RESULT.UPTODATE:   Status.numUpToDate++;   break;
        case RESULT.KEPT:       Status.numKept++;       break;
        case RESULT.MISSING:    Status.numMissing++;    break;
        default:                Status.numErrors++;     break;
    }
    let strLine = `   ${oResult.icon} ${oResult.text}  ${strSource}  ${strDirection}  ${strTarget}`;
    if(strInfo) strLine += `  (${strInfo})`;
    if(oResult === RESULT.ERROR || oResult === RESULT.MISSING) console.error(strLine);
    else console.log(strLine);
}


function loadPagesFile(strPages) {
    if(!strPages) strPages = "pages.json";
    if( fs.existsSync(strPages)) {
        console.log("---> using pages definition: " + strPages)
        let strData = fs.readFileSync(strPages);
        let oPagesData = JSON.parse(strData);
        Settings.addConfig(oPagesData);
    } else {
        console.log("❌ pages definition file not found : " + strPages)
    }
}
// #region Sync functions

/** find the source (file or folder) - in the project or in one of the sync locations */
function findSource(strFile) {
    if(fs.existsSync(strFile)) return(strFile);
    for(let strLocation of Settings.getData("sync.locations",[])) {
        let strSource = path.join(strLocation,strFile);
        if(fs.existsSync(strSource)) return(strSource);
    }
    return(null);
}

/** normalize the target path and check, it is inside the project (null if not) */
function checkTargetPath(strTarget) {
    let strPath = path.normalize(strTarget);
    if(strPath.startsWith("/"))  strPath = "." + strPath;
    if(strPath.startsWith("..")) return(null);
    return(strPath);
}

function copyFile(strFrom, strTo) {
    fs.mkdirSync(path.dirname(strTo), { recursive: true });
    fs.copyFileSync(strFrom, strTo);
}

/**
 * sync a single file
 * @returns nothing - the result is reported and counted.
 */
function syncFile(strSourceFile, strTargetFile, strDirection) {
    if(path.resolve(strSourceFile) === path.resolve(strTargetFile)) {
        report(RESULT.UPTODATE, strSourceFile, strDirection, strTargetFile, "source and target are identical");
        return;
    }
    let bSourceExists = fs.existsSync(strSourceFile);
    let bTargetExists = fs.existsSync(strTargetFile);
    let nSrcMS = bSourceExists ? fs.statSync(strSourceFile).mtimeMs : 0;
    let nTgtMS = bTargetExists ? fs.statSync(strTargetFile).mtimeMs : 0;

    try {
        switch(strDirection) {
            case "=":   if(!bSourceExists)      report(RESULT.MISSING, strSourceFile, strDirection, strTargetFile);
                        else if(bTargetExists)  report(RESULT.KEPT, strSourceFile, strDirection, strTargetFile);
                        else {
                            copyFile(strSourceFile, strTargetFile);
                            report(RESULT.NEW, strSourceFile, strDirection, strTargetFile);
                        }
                        break;

            case ">":   if(!bSourceExists)      report(RESULT.MISSING, strSourceFile, strDirection, strTargetFile);
                        else if(nSrcMS > nTgtMS) {
                            copyFile(strSourceFile, strTargetFile);
                            report(bTargetExists ? RESULT.UPDATED : RESULT.NEW, strSourceFile, strDirection, strTargetFile);
                        } else                  report(RESULT.UPTODATE, strSourceFile, strDirection, strTargetFile);
                        break;

            case "<":   if(bTargetExists && nTgtMS > nSrcMS) {
                            copyFile(strTargetFile, strSourceFile);
                            report(RESULT.BACK, strSourceFile, strDirection, strTargetFile);
                        } else                  report(RESULT.UPTODATE, strSourceFile, strDirection, strTargetFile);
                        break;

            case "<>":  if(nTgtMS > nSrcMS)     syncFile(strSourceFile, strTargetFile, "<");
                        else                    syncFile(strSourceFile, strTargetFile, ">");
                        break;

            default:    report(RESULT.ERROR, strSourceFile, strDirection, strTargetFile, "invalid sync command");
                        break;
        }
    } catch(ex) {
        report(RESULT.ERROR, strSourceFile, strDirection, strTargetFile, ex.message);
    }
}

/** list all files of a folder (recursive) - relative to the folder */
function listFiles(strFolder, strRel = "") {
    let tFiles = [];
    for(let oEntry of fs.readdirSync(path.join(strFolder, strRel), { withFileTypes: true })) {
        let strEntry = path.join(strRel, oEntry.name);
        if(oEntry.isDirectory())    tFiles.push(...listFiles(strFolder, strEntry));
        else if(oEntry.isFile())    tFiles.push(strEntry);
    }
    return(tFiles);
}

/**
 * sync a folder - all files including sub folders - with the same command.
 * "<" / "<>" sync back only files that exist in the source folder.
 */
function syncFolder(strSourceFolder, strTargetFolder, strDirection) {
    let tFiles = listFiles(strSourceFolder);
    console.log(`   📁 folder  ${strSourceFolder}  ${strDirection}  ${strTargetFolder}  (${tFiles.length} files)`);
    if(fs.existsSync(strTargetFolder) && !fs.statSync(strTargetFolder).isDirectory()) {
        report(RESULT.ERROR, strSourceFolder, strDirection, strTargetFolder, "target is a file, not a folder");
        return;
    }
    for(let strFile of tFiles) {
        syncFile(path.join(strSourceFolder, strFile), path.join(strTargetFolder, strFile), strDirection);
    }
}

async function syncFileList(cb) {
    const oRegEx = new RegExp("^(?<source>[^<=>]+?)\\s*(?<cmd><>|[<=>])\\s*(?<target>.+)$");
    Settings.getData("sync.files",[]).forEach((strInstruction) => {
        let oMatch = oRegEx.exec(strInstruction.trim());
        if(!oMatch) {
            report(RESULT.ERROR, strInstruction, "?", "", "instruction does not respect rule <source> [= > < <>] <target>");
            return;
        }
        let strSourceName = oMatch.groups.source.trim();
        let strCmd        = oMatch.groups.cmd.trim();
        let strTarget     = checkTargetPath(oMatch.groups.target.trim());
        let strSource     = findSource(strSourceName);
        if(!strSource) {
            report(RESULT.MISSING, strSourceName, strCmd, oMatch.groups.target.trim(), "source not found");
        } else if(!strTarget) {
            report(RESULT.ERROR, strSource, strCmd, oMatch.groups.target.trim(), "target is outside the project");
        } else if(fs.statSync(strSource).isDirectory()) {
            syncFolder(strSource, strTarget, strCmd);
        } else {
            syncFile(strSource, strTarget, strCmd);
        }
    });
    if(Utils.isFunction(cb)) cb();
}

function printSummary() {
    console.log("--------------------------------------------");
    console.log(`   ${RESULT.NEW.icon} new: ${Status.numNew}   ${RESULT.UPDATED.icon} updated: ${Status.numUpdated}   ` +
                `${RESULT.BACK.icon}back: ${Status.numBack}   ${RESULT.UPTODATE.icon} up to date: ${Status.numUpToDate}   ` +
                `${RESULT.KEPT.icon}kept: ${Status.numKept}`);
    if(Status.numMissing || Status.numErrors) {
        console.log(`   ${RESULT.MISSING.icon}missing: ${Status.numMissing}   ${RESULT.ERROR.icon} errors: ${Status.numErrors}`);
    }
}

// #endregion

console.log("********************************************");
console.log("---- " + MODULE_NAME + " Version " + MODULE_VERSION);
console.log("********************************************");
loadPagesFile(process.argv[2]);
syncFileList();
printSummary();
console.log("==> " + MODULE_NAME + " Version " + MODULE_VERSION + "... done");
if(Status.numErrors) process.exitCode = 1;
