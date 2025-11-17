/**
 * @file scripts/_common.js
 * This file contains common functions and settings used across the project.
 * It is part of the PLibESPV1 project.
 * 
 * @author LSC Labs - Peter Liebl
 * @version 1.0.0
 */
import fs from 'fs';
import path from 'path';

/**
 * Get the name of the project.
 * Expecting the script to be in the subdirectory "scripts" of the project root.
 * @returns The name of the project based on the current file path.
 */
export function getProjectName() {
    // As we are a "module", use meta instead of __dirname
    let strPath = import.meta.dirname;
    return(path.basename(path.join(strPath,"..")));
}

// #region Utility class
/**
 * Common utitilities for java script
 */
export class Utils {

    static isFalseValue(oValue) {
        let bResult = false;
        if(this.isString(oValue)) {
            oValue = oValue.trim().toLowerCase();
            bResult = [ "false", "0", "no", "off" ].includes(oValue);
        } else if(this.isBoolean(oValue)) {
            bResult = !oValue;
        }
        return(bResult);

    }

    static isTrueValue(oValue) {    
        return(!this.isFalseValue(oValue));
    }

    /**
     * get the instance name of an object.
     * 
     * Examples:
     * if a class, it is the class name
     * if a html element like <div>, it is 'HTMLDivElement'
     * 
     * @param {*} oObj 
     * @returns the name of the instance
     */
    static getInstanceName(oObj) {
        let strName;
        if(oObj && oObj.constructor) strName = oObj.constructor.name;
        return(strName);
    }

    /**
     * is the object an instance of strType, like CUtils.
     * also parent classes are reflected, so you can ask if an instance of CAPP
     * is also an instance of CUtils...
     * @param {*} oObj      Object to inspect
     * @param {*} strType   Type expected like "CUtils" - default is "Object"
     * @param {*} oObjOnly  if true, only the object itself will be checked, not the parents...
     * @returns 
     */
    static isInstanceOf(oObj,strType= 'Object',bObjOnly = false) {
        let bResult = false;
        let oInstance = oObj;
        while(oInstance) {
            if(Utils.getInstanceName(oInstance) == strType) {
                bResult = true;
                break;
            }
            if(bObjOnly) break;
            oInstance = Object.getPrototypeOf(oInstance);
        }
        return(bResult)
    }

    static isObj(oData) {
        return(oData != null && typeof oData === 'object');
    }

    static isString(oData) {
        return(typeof oData === 'string');
    }

    static isBoolean(oData) {
        return(typeof oData === 'boolean');
    }
    
    static isFunction(oData) {
        return(typeof oData === 'function');
    }

    static isElement(oElement) {
        return(this.isObj(oElement) && oElement.nodeType == 1);
    }

}

// #endregion

/**
 * CVarTable - variables in a table
 * 
 * Set and Get vars by name.
 * can also substitute strings with the vars.
 * 
 */
export class CVarTable {
    _tVars = [];       // Array with the var values.

    /**
     * Set default Prog vars, so they can be used by the application.
     */
    setDefaults() {
        this.setVar("prog.name","ESP-ProjectTemplate");
        this.setVar("prog.ver","1.0");
        this.setVar("prog.copy","(c) LSC-Labs");
        this.setVar("prog.link","https://github/LSC-Labs");
    }

    /**
     * Set a var by name...
     * @param {*} strName   The name of the var (mandatory)
     * @param {*} strValue The value to be set... if not set, the var will be deleted
     * @returns the VarTable
     */
    setVar(strName, strValue) {
        if(strName) {
            if(strValue) {
                this._tVars[strName] = strValue;
            }
            else {
                let nPos = this._tVars.indexOf(strName);
                if(nPos > -1) this._tVars.splice(nPos,1);
            }
        }
        return(this);
    }

    /**
     * Set the vars into the local var table.
     * 
     * @param {*} oData either an array [], an instance of CVarTable or an object {...}.
     * @returns this VarTable
     */
    setVars(oData) {
        if(oData) {
            let tVars = Array.isArray(oData) ? oData : Array.isArray(oData.m_tVars) ? oData._tVars : undefined;
            if(Array.isArray(tVars)) {
                for(const strKey in tVars) { this._tVars[strKey] = tVars[strKey] }
            }
            else if(typeof oData === 'object') {
                for(const strKey in oData) { this._tVars[strKey] = oData[strKey] }
            }
        }
        return(this);
    }

    getValue(strName, strDefault = "") {
        let strResult = strDefault;
        if(strName) {
            strResult = this._tVars[strName] ?? strDefault;
        } 
        return(strResult);
    }

    /**
     * substitute a string.
     * Each var definition inside will be replaced with the var content...
     * "This is $(prog.name) Ver.: $(prog.ver) (c) $(prog.copy)"
     * @param {*} str 
     * @returns 
     */
    subst(str) {
        let strResult = "";
        let nIterations = 7;
        if(str && typeof str === 'string') {
            strResult = str;
            let nTokenPos = strResult.indexOf("$(");
            while(nIterations-- > 0 && nTokenPos > -1) {
                for(const strKey in this._tVars) {
                    strResult = strResult.replaceAll("$(" + strKey + ")",this._tVars[strKey]);
                }
            }
        }
        return(strResult);
    }

}

// #region Config class
/**
 * Config class.
 */
export class CConfig {

    // Holds the config data...
    _oConfig = {}

    constructor(oConfig = {}) {
        this.setConfig(oConfig);
    }

    /**
     * returns the data a CConfig object instance
     * @param {*} oData either CConfig or an normal object
     */
    static asInstance(oData) {
        let oResult = Utils.isInstanceOf(oData,"CConfig") ? oData :
                      Utils.isObj(oData) ? new CConfig(oData) : {};
        return(oResult);
    }
    asNative(oData) {
        return(CConfig.asNative(oData));
    }

    static asNative(oData) {
        let oResult = Utils.isInstanceOf(oData,"CConfig") ? oData._oConfig :
                      Utils.isObj(oData) ? oData : {};
        return(oResult);
    }
    /**
     * add a config to the existing one.
     * join the data (and consruct a new config object)
     * @param {*} oConfig 
     */
    addConfig(oConfig) {
        this.mergeSection("",oConfig);
        // this._oConfig = {...this.getConfig(),...this.asNative(oConfig)}; 
    }

    /**
     * set a new config object
     * @param {*} oConfig 
     */
    setConfig(oConfig)    { this._oConfig = this.asNative(oConfig) }

    /**
     * get the current config object (root)
     * @returns 
     */
    getConfig()           { return(this._oConfig ?? {}); }

    /**
     * Get data from a section...
     * @param {*} strFullKey 
     * @param {*} oDefault 
     * @returns the data (string / object or the default)
     */
    getData(strFullKey, oDefault) {
        let oData;
        try {
            let tKeys = strFullKey.split(".");
            oData = tKeys.reduce((obj, i) => obj[i], this.getConfig());
        } catch  {}
        return(oData ?? oDefault);
    }

    /**
     * Store the data in the key of the section.
     * If the key contains section information, ensure, the section exists.
     * @param {string} strKey key to store like "wifi.settings.on" ( => "on")
     * @param {string|object|Array|number|undefined} oData  data to be stored in the requested section ( => "wifi.settings" )
     */
    setData(strKey, oData) {
       
        if(Utils.isString(strKey)) {
            let oBase = this.getConfig();
            let nPos    = strKey.lastIndexOf("."); 
            if(nPos > -1) {
                let strPath = strKey.substring(0, nPos);
                strKey      = strKey.substring(nPos +1 );
                oBase       = this.getSection(strPath,true);
            }
            oBase[strKey] = oData;
        };
    }

    /**
     * Get the section by name from the global config.
     * If the section name is "", the global config will be used.
     * Function is recursive, so you can specify also subsection like "wifi.network.info"
     * @param {*} strSectionName    Section Name, with delimited sections by '.'
     * @param {*} oBaseSection      null = based on global oConfig, otherwise starting from this section.
     * @param {*} bCreateIfNotExist true = section will be created if it does not exist in oBaseSection...
     * @returns the section (if exists or created) or undefined if the section does not exists.
     */
    getSection(strSectionName, bCreateIfNotExist, oBaseSection) {
        let oResult = undefined;
        oBaseSection = oBaseSection ? oBaseSection : this._oConfig;
        if(strSectionName == "") oResult = oBaseSection;
        else if(strSectionName && strSectionName.length> 0) {
            let nLastPosOfSeperator = strSectionName.lastIndexOf(".");
            if(nLastPosOfSeperator > -1) {
                let strBaseSectionName = strSectionName.substring(0,nLastPosOfSeperator);
                strSectionName = strSectionName.substring(nLastPosOfSeperator +1);
                oBaseSection = this.getSection(strBaseSectionName, bCreateIfNotExist ,oBaseSection);
            }
            if(oBaseSection) {
                if(!oBaseSection.hasOwnProperty(strSectionName) && bCreateIfNotExist) {
                    oBaseSection[strSectionName] = {};
                }
                oResult = oBaseSection[strSectionName];
            }
        }
        return(oResult);
    }

    mergeSection(strSectionName, oAddSection) {
        // console.log("mergin section....:" + strSectionName);
        let oSection = this.getSection(strSectionName,true)
        // console.log(" --- org:");
        // console.log(oSection);
        for(let strName in oAddSection) {
            let oData = oAddSection[strName];
            if(Utils.isObj(oData)) {
                // merge a subobject...
                this.mergeSection(strSectionName + "." + strName,oData);
            }
            else {
                // set the value
                oSection[strName] = oData;
            }
        }
    }

    /**
     * get the config object as a serialized string
     * @returns 
     */
    getSerialized() {
        return(JSON.stringify(this.getConfig(), null, 2));
    }
    getWebSourcePath()  { return(this.getData("locations.webSource"   ,"src/web"))}
    getWebDistPath()    { return(this.getData("locations.webDist"     ,"dist/web"))}
    getWebPackedPath()  { return(this.getData("locations.webPacked"   ,"tmp/web"))}
    getWebTempPath()    { return(this.getData("locations.webTemp"     ,"tmp/web"))}
    getIncludePath()    { return(this.getData("locations.includes"    ,"include"))}


};

// #endregion
