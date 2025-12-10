import fs from 'fs';
import path from 'path';
import gulp from 'gulp';
import gzip from 'gulp-gzip';
import debug from 'gulp-debug';
import htmlmin from 'gulp-htmlmin';
import uglify from 'gulp-uglify';
import cleancss from 'gulp-clean-css';
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

async function minimizeHTML(cb) {
    let strSourcePath   = Settings.getWebSourcePath() + "/*.html";
    let strTargetPath   = Settings.getWebDistPath();
    let strTempSrcPath  = Settings.getWebTempPath() + "/src";
    let strPackedPath   = Settings.getWebPackedPath();

    gulp.src(strSourcePath)
        .pipe(debug({ title: 'min HTML :'}))
        .pipe(preprocess())
        .pipe(gulp.dest(strTempSrcPath))
        .pipe(htmlmin({collapseWhitespace: true, minifyJS: true, removeComments:true}))
        .pipe(gulp.dest(strTargetPath))
        .pipe(gzip({append:true}))
        .pipe(gulp.dest(strPackedPath));
    cb();
}

async function minimizeScripts(cb) {
    let strSourcePath = Settings.getWebSourcePath() + "/js/*.js";
    let strTargetPath = Settings.getWebDistPath() + "/js";
    let strTempSrcPath  = Settings.getWebTempPath() + "/src/js";
    let strPackedPath = Settings.getWebPackedPath();
    
    gulp.src(strSourcePath)
    .pipe(debug({ title: 'min JS   :'}))
    .pipe(preprocess())
    .pipe(gulp.dest(strTempSrcPath))
    .pipe(uglify())
    .pipe(gulp.dest(strTargetPath))
    .pipe(gzip({append:true}))
    .pipe(gulp.dest(strPackedPath));
    cb();
}

async function minimizeCSS(cb) {
    let strSourcePath = Settings.getWebSourcePath() + "/css/*.css";
    let strTargetPath = Settings.getWebDistPath() + "/css";
    let strPackedPath = Settings.getWebPackedPath();
    console.log(`CSS minimize "${strSourcePath}" ==> ${strTargetPath}`);
    gulp.src(strSourcePath)
        .pipe(debug({ title: 'min CSS  :'}))
        .pipe(purge({
                trim : true,
                shorten : true,
                verbose : true
            }))
        .pipe(gulp.dest(strTargetPath))
        .pipe(gzip({append:true}))
        .pipe(gulp.dest(strPackedPath));
    cb();
}

async function minimizeLanguages(cb) {
    let strSourcePath = Settings.getWebSourcePath() + "/i18n/*.json";
    let strTargetPath = Settings.getWebDistPath() + "/i18n";
    let strPackedPath = Settings.getWebPackedPath();
    gulp.src(strSourcePath)
        .pipe(debug({ title: 'min i18n :'}))
        .pipe(jsonmin())
        .pipe(gulp.dest(strTargetPath))
        .pipe(gzip({append:true}))
        .pipe(gulp.dest(strPackedPath));
    cb();
}

// #endregion

// #region build of cpp header information of packed files

async function buildHeaderFiles(cb) {

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
                let oWS = fs.createWriteStream(strHeaderFileName);
                oWS.on("error", function(oErr) { console.log(oErr) });
                oWS.write("#pragma once\n");
                oWS.write("#define " + strIncludeName.replace(/\.|-/g, "_") + "_len " + nPackedFileSize + "\n");
                oWS.write("const uint8_t " + strIncludeName.replace(/\.|-/g, "_") + "[] PROGMEM = {")
                for(let i = 0; i < tData.length; i++) {
                    if (i % 1000 == 0) oWS.write("\n");
                    oWS.write('0x' + ('00' + tData[i].toString(16)).slice(-2));
                    if (i < tData.length - 1) oWS.write(',');
                }
                oWS.write("\n};");
                oWS.end();
                fTotalSize += nPackedFileSize;
            }
        }
    });
    console.log("==================================================================");
    console.log("Web Frontend size in memory : " + fTotalSize + " bytes");
    console.log("==================================================================");
    let strTouchFile = Settings.getData("touchAfterPagesCompiled");
    console.log("Checking touch file : " + strTouchFile);
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
            let strMatchMask = strTouchText + "\\d*";
            let oRegEx = new RegExp(strMatchMask, 'g');
            // If found, replace it, else append it...
            if(strData.match(oRegEx)) {
                strData = strData.replace(oRegEx,strTouchText + changedModifiedTime.getTime());
            } else {
                strData += "/* " + strTouchText + changedModifiedTime.getTime() + " */\n";
            }
            // Write the file back to disk...
            fs.writeFile(strTouchFile, strData, 'utf8', function (err) {
                if (err) return console.log(err);
            });
            
        });
        // as touching does not trigger the compile, append a line as comment...
        // fs.appendFileSync(strTouchFile,"/* touched by page compiler : " + changedModifiedTime.getTime() + " */\n");   
    }
    cb();
}

// #endregion


export async function runCompilePages(cb, oSettings) {
    console.log("---- compile....");
    Settings.addConfig(oSettings);
    
    const runMinimizeJob = gulp.series(   
                                    minimizeHTML,
                                    minimizeCSS,
                                    minimizeScripts,
                                    minimizeLanguages,
                                );
    const runBuildHeaders = gulp.series(buildHeaderFiles);
    await runMinimizeJob();
    return await runBuildHeaders();
}