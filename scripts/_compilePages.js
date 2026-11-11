import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import gulp from 'gulp';
import gzip from 'gulp-gzip';
import debug from 'gulp-debug';
import htmlmin from 'gulp-htmlmin';
import uglify from 'gulp-uglify';
import cleancss from 'gulp-clean-css';
// require ('gulp-css-purge')
import purge from 'gulp-css-purge';
import preprocess from 'gulp-preprocess';

import jsonmin from 'gulp-jsonmin';
import flatmap from 'gulp-flatmap';
import pump from 'pump';
import { CConfig } from './_common.js';

const DEFAULTS = {
    "locations": {
        "webSource": "src/web",
        "webDist"  : "dist/web",
        "webPacked": "tmp/web",
        "webTemp":   "tmp/web",
        "includes" : "dist/include"
    }
}
var Settings = new CConfig(DEFAULTS);


// #region Minimize functions

function minimizeHTML() {
    let strSourcePath   = Settings.getWebSourcePath() + "/*.html";
    let strTargetPath   = Settings.getWebDistPath();
    let strTempSrcPath  = Settings.getWebTempPath() + "/src";
    let strPackedPath   = Settings.getWebPackedPath();

    return gulp.src(strSourcePath)
        .pipe(debug({ title: 'min HTML :'}))
        .pipe(preprocess())
        .pipe(gulp.dest(strTempSrcPath))
        .pipe(htmlmin({collapseWhitespace: true, minifyJS: true, removeComments:true}))
        .pipe(gulp.dest(strTargetPath))
        .pipe(gzip({append:true}))
        .pipe(gulp.dest(strPackedPath));
}

function minimizeScripts() {
    let strSourcePath = Settings.getWebSourcePath() + "/js/*.js";
    let strTargetPath = Settings.getWebDistPath() + "/js";
    let strTempSrcPath  = Settings.getWebTempPath() + "/src/js";
    let strPackedPath = Settings.getWebPackedPath();
    
    return gulp.src(strSourcePath)
    .pipe(debug({ title: 'min JS   :'}))
    .pipe(preprocess())
    .pipe(gulp.dest(strTempSrcPath))
    .pipe(uglify())
    .pipe(gulp.dest(strTargetPath))
    .pipe(gzip({append:true}))
    .pipe(gulp.dest(strPackedPath));
}

function minimizeCSS() {
    let strSourcePath = Settings.getWebSourcePath() + "/css/*.css";
    let strTargetPath = Settings.getWebDistPath() + "/css";
    let strPackedPath = Settings.getWebPackedPath();
    console.log(`CSS minimize "${strSourcePath}" ==> ${strTargetPath}`);
    return gulp.src(strSourcePath)
        .pipe(debug({ title: 'min CSS  :'}))
        .pipe(purge({
                trim : true,
                shorten : true,
                verbose : true
            }))
        .pipe(gulp.dest(strTargetPath))
        .pipe(gzip({append:true}))
        .pipe(gulp.dest(strPackedPath));
}

function minimizeLanguages() {
    let strSourcePath = Settings.getWebSourcePath() + "/i18n/*.json";
    let strTargetPath = Settings.getWebDistPath() + "/i18n";
    let strPackedPath = Settings.getWebPackedPath();
    return gulp.src(strSourcePath)
        .pipe(debug({ title: 'min i18n :'}))
        .pipe(jsonmin())
        .pipe(gulp.dest(strTargetPath))
        .pipe(gzip({append:true}))
        .pipe(gulp.dest(strPackedPath));
}

/**
 * Embeds the local stylesheets and scripts into the (minimized) index.html.
 *
 * The device answers every request with "Connection: close" - every file needs its own
 * connection. Browsers (especially Safari) load all files of the page in parallel, which
 * exhausts the few connections / the heap of small devices (ESP8266): files are missing
 * (page without formatting) or the device crashes. With the embedded files the start page
 * is one single request.
 *
 * - <link rel="stylesheet" href="css/x.css">  => <style>...</style>   (same position)
 * - <script src="js/x.js"></script>           => <script>...</script> (same position)
 * - <script src="js/x.js" defer></script>     => moved to the end of the body (defer order)
 * External URLs (http..., //...) and missing files are not touched.
 * The files are still delivered separately - other pages may use them.
 */
function inlineIndexAssets(cb) {
    const strDistPath   = Settings.getWebDistPath();
    const strPackedPath = Settings.getWebPackedPath();
    const strIndexFile  = path.join(strDistPath, "index.html");
    if(!fs.existsSync(strIndexFile)) { cb(); return; }

    const isLocal = (strUrl) => strUrl && !/^([a-z]+:)?\/\//i.test(strUrl);
    const readAsset = (strUrl) => {
        let strFile = path.join(strDistPath, strUrl.split("?")[0].replace(/^\//, ""));
        return fs.existsSync(strFile) ? fs.readFileSync(strFile, "utf8") : null;
    };
    let nInlined = 0;
    let tDeferred = [];
    let strHtml = fs.readFileSync(strIndexFile, "utf8");

    // Stylesheets
    strHtml = strHtml.replace(/<link\b[^>]*>/gi, (strTag) => {
        let oHref = strTag.match(/\bhref\s*=\s*["']?([^"'\s>]+)/i);
        if(!/\brel\s*=\s*["']?stylesheet/i.test(strTag) || !oHref || !isLocal(oHref[1])) return strTag;
        let strCSS = readAsset(oHref[1]);
        if(strCSS === null) { console.log(` [W] inline: ${oHref[1]} not found - not embedded`); return strTag; }
        nInlined++;
        return "<style>" + strCSS.replace(/<\/style/gi, "<\\/style") + "</style>";
    });

    // Scripts with src
    strHtml = strHtml.replace(/<script\b([^>]*)>\s*<\/script>/gi, (strTag, strAttrs) => {
        let oSrc = strAttrs.match(/\bsrc\s*=\s*["']?([^"'\s>]+)/i);
        if(!oSrc || !isLocal(oSrc[1])) return strTag;
        let strJS = readAsset(oSrc[1]);
        if(strJS === null) { console.log(` [W] inline: ${oSrc[1]} not found - not embedded`); return strTag; }
        nInlined++;
        // "</script" inside the code would end the script element
        let strInline = "<script>" + strJS.replace(/<\/script/gi, "<\\/script") + "\n</script>";
        if(/\bdefer\b/i.test(strAttrs)) {
            tDeferred.push(strInline);
            return "";
        }
        return strInline;
    });
    if(tDeferred.length > 0) {
        let nBodyEnd = strHtml.toLowerCase().lastIndexOf("</body>");
        if(nBodyEnd < 0) strHtml += tDeferred.join("");
        else strHtml = strHtml.substring(0, nBodyEnd) + tDeferred.join("") + strHtml.substring(nBodyEnd);
    }

    fs.writeFileSync(strIndexFile, strHtml);
    fs.writeFileSync(path.join(strPackedPath, "index.html.gz"), zlib.gzipSync(Buffer.from(strHtml, "utf8"), { level: 9 }));
    console.log(` - index.html : ${nInlined} stylesheets/scripts embedded`);
    cb();
}

// #endregion

// #region build of cpp header information of packed files

function buildHeaderFiles(cb) {

    // let strScanMask = Settings.getWebPackedPath() + "/*.gz";
    let fTotalSize = 0;
    let strIncludePath = Settings.getIncludePath();
    let strPackedPath = Settings.getWebPackedPath();
    fs.readdirSync(strPackedPath).forEach(strFileName => {
        if(strFileName.endsWith(".gz")) {
            let strPackedFileName = path.join(strPackedPath,strFileName);
            let strHeaderFileName = path.join(strIncludePath,strFileName+ ".h");
            let nPackedFileSize = fs.statSync(strPackedFileName).size;
            let tData = fs.readFileSync(strPackedFileName);
            if(nPackedFileSize == tData.length) {
                console.log(` - file size (${nPackedFileSize})\tis OK ${strPackedFileName}\t ==> ${strHeaderFileName}`);
                let strIncludeName = path.basename(strPackedFileName);
                const strVarName = strIncludeName.replace(/\.|-/g, "_");
                const tLines = [
                    "#pragma once\n",
                    "#define " + strVarName + "_len " + nPackedFileSize + "\n",
                    "const uint8_t " + strVarName + "[] PROGMEM = {"
                ];
                for(let i = 0; i < tData.length; i++) {
                    if (i % 1000 == 0) tLines.push("\n");
                    tLines.push('0x' + ('00' + tData[i].toString(16)).slice(-2));
                    if (i < tData.length - 1) tLines.push(',');
                }
                tLines.push("\n};");
                // No timestamp to avoid github change...
                // Synchronous write - the header is complete, when this task ends.
                fs.writeFileSync(strHeaderFileName, tLines.join(""));
                fTotalSize += nPackedFileSize;
            }
        }
    });
    console.log("==================================================================");
    console.log("Web Frontend size in memory : " + fTotalSize + " bytes");
    console.log("==================================================================");
    let strTouchFile = Settings.getData("touchAfterPagesCompiled");
    if (typeof strTouchFile === 'string' || strTouchFile instanceof String) {
        removeObjectFilesOf(strTouchFile);
    } else {
        for(let strTouchFile of Settings.getData("touchAfterPagesCompiled",[])) {
            removeObjectFilesOf(strTouchFile);
        }
    }

    cb();
}

/**
 * removes the object files in all targets of the source file.
 * @param {string} strSourceFileName name of the source file i.E. "src/main.cpp"
 */
function removeObjectFilesOf(strSourceFileName) {
    let strObjectBaseFolder = ".pio/build";
    let tFiles = fs.readdirSync(strObjectBaseFolder);
    for (let i in tFiles){
        let strFileName = path.join(strObjectBaseFolder,tFiles[i]);
        if (fs.statSync(strFileName).isDirectory()){
            let strObjectFile = path.join(strFileName,strSourceFileName + ".o");
            if(fs.existsSync(strObjectFile)) {
                console.log("## > removing object file : " + strObjectFile);
                fs.unlinkSync(strObjectFile);
            }
        } 
    } 
}


// previous function to touch the file...
// new version will delete the previous compiled object file
function obsolet_01() {
    if(strTouchFile && fs.existsSync(strTouchFile)) {
        console.log("touching file : " + strTouchFile);
        let changedModifiedTime = new Date();
        let changedAccessTime = new Date();
        fs.utimesSync(strTouchFile, changedAccessTime, changedModifiedTime);

        // Read the file into memory...
        fs.readFile(strTouchFile, 'utf8', function (err,strData) {
            if (err) {
                return console.log(err);
            }
            let strTouchText = "touched by page compiler : ";
            // 2026-01-22T13:36:26.786Z
            let strMatchMask = strTouchText + "[\\d-T:\\.Z]*";
            // let strMatchMask = strTouchText + "[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{1,3}Z";
            let oRegEx = new RegExp(strMatchMask, 'g');
            // If found, replace it, else append it...
            if(strData.match(oRegEx)) {
                strData = strData.replace(oRegEx,strTouchText + changedModifiedTime.toISOString()); //new Date().toISOString()
            } else {
                strData += "/* " + strTouchText + changedModifiedTime.toISOString() + " */\n";
            }
            // Write the file back to disk...
            fs.writeFile(strTouchFile, strData, 'utf8', function (err) {
                if (err) return console.log(err);
            });
            
        });
        
        // as touching does not trigger the compile, append a line as comment...
        // fs.appendFileSync(strTouchFile,"/* touched by page compiler : " + changedModifiedTime.getTime() + " */\n");   
    }


}

// #endregion


export async function runCompilePages(cb, oSettings) {
    console.log("---- compile....");
    Settings.addConfig(oSettings);
    
    
    // gulp.series() returns a task function - it has to be called with a done callback,
    // otherwise nothing waits for the streams and the headers are built from old *.gz files.
    const runCompileJob = gulp.series(
                                    minimizeHTML,
                                    minimizeCSS,
                                    minimizeScripts,
                                    minimizeLanguages,
                                    inlineIndexAssets,      // after HTML, CSS and JS are minimized
                                    buildHeaderFiles
                                );
    return new Promise((resolve, reject) => {
        runCompileJob((oErr) => oErr ? reject(oErr) : resolve());
    });
}