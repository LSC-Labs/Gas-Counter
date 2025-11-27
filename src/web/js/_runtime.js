/**
 * 
 * (c) 2024 LSC Labs - P.Liebl
 * 
 * Runtime is a base library for simple GUI's on smart devices.
 * Main intention is to save space and be plugable with pages.
 * 
 * Hints: 
 * ======
 * - use an editor that supports the #region command like Visual code, to get a structured view to this code.
 * - gulp-preprocess is used with the @exclude syntax for prod,
 *   ==> see  https://github.com/jsoverson/preprocess - and https://github.com/jsoverson/preprocess#directive-syntax
 * 
 * Global objects:
 * ===============
 * DEFAULTS  Default settings and commands (object)
 * EC()      is the Element Class/Container shortcut to be used to handle HTML object as CElement instance
 * 
 */

/**
 * Defaults container with settings for all modules. 
 * Page Definitions can insert their settings also here...
 * Default are the commands sent on WebSocket when connection is established,
 * also the commands needed to administrate the device with a Web GUI.
 * (otherwise this script and the html is not needed, so it is defined here.)
 * If you need Defaults for further device specific pages or override the commands,
 * you can define them in the page definition with "DEFAULTS.xxxx = setting"; 
 */
const DEFAULTS = {
    DEBUG_TOKEN            : "JoWaschlEmulator",// Default Debug Access Token (for emulator)
    GET_CONFIG_COMMAND     : "getconfig",       // Websocket get configuration
    GET_STATUS_COMMAND     : "getstatus",       // Websocket get status
    RESTART_COMMAND        : "restart",         // Websocket restart
    SAVE_CONFIG_COMMAND    : "saveconfig",      // Websocket save configuration
    FACTORY_RESET_COMMAND  : "factoryreset",    // Websocket factory reset the device
    GET_BACKUP_COMMAND     : "getbackup",       // Websocket get a backup of the config
    RESTORE_BACKUP_COMMAND : "restorebackup",   // Websocket restore the config in the device
    SCAN_WIFI              : "scanwifi",        // Websocket ask the device to scan the WiFi
}


// #region Security
class CSecurity 
{
    // Access Token of current user 
    static AccessToken;

    constructor(pApp) {
        this._App = pApp;
    }
    
    /**
     * check if the user is already authenticated
     * @returns 
     */
    isAuth() {
        return(Utils.isString(CSecurity.AccessToken));
    }

     _closeDlg(oDlg) {
        if(oDlg && Utils.isFunction(oDlg.close)) {
            oDlg.close();
        }
    }

    signin() {
        this.Dlg = new CSigninDialog({ onFinished: this.authenticate.bind(this)});
        this.Dlg.showModal();
    }
    signout() {
        CSecurity.AccessToken = undefined;
        this.updateAuthModeView(document.body);
    }

    authenticate(strPasswd,oDlg) {
        CSecurity.AccessToken = undefined;
        // @exclude 
        // is used for websocket emulator tests only
        if (strPasswd === "emu") {
            CSecurity.AccessToken = DEFAULTS.DEBUG_TOKEN;
            this._closeDlg(oDlg);
            this.updateAuthModeView()
        } else {
        // @endexclude
            let oSelf = this;
            let strUser = "admin";
            let url = "/login";
            let xhr = new XMLHttpRequest();
            xhr.open("get", url, true, strUser, strPasswd);
            xhr.onload = function(e) {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        // Login is ok, store the access token and establish the websocket
                        CSecurity.AccessToken = xhr.getResponseHeader("AUTHTOKEN");
                        oSelf._closeDlg(oDlg);
                    } else {
                        alert("Incorrect password!");
                    }
                    oSelf.updateAuthModeView()
                }
            };
            xhr.send(null);
        //@exclude
        }
        //@endexclude
    }

    _setRO(oElement,bRO = true,bIterate = true) {
        let oE = CElement.asNative(oElement);
        let strType = oE.type;
       
        switch(strType) {
            case "number":
            case "text":        oE.readOnly = bRO; break;
            case 'select' :
            case 'select-one' :
            case 'radio':
            case 'checkbox':    oE.disabled = bRO; break;
        }
        if(bIterate) {
            EC(oE).selAll("input, select, radio, checkbox").forEach(e => this._setRO(e,bRO,bIterate));
        }
    }

    /**
     * Update the BaseElement to view only elements reflecting the 
     * correct authentication mode by using the show and hide functions of CElement
     * @param {HTMLElement|undefined|null} oBaseElement The element ot process or the body of the document
     */
    updateAuthModeView(oBaseElement) {
        if(!oBaseElement) oBaseElement = document.body;
        let bIsAuth = this.isAuth();
        EC(oBaseElement).gelAll("[data-auth]").forEach(e => {
            switch(e.data("auth")) {
                case "RO" : this._setRO(e,!bIsAuth,true); break;
                case "1" : e.show(bIsAuth); break;
                case "0" : e.hide(bIsAuth); break;
            }
        })
    }

}
// #endregion

// #region VarTable 

/**
 * CVarTable - variables in a table
 * 
 * Set and Get vars by name.
 * 
 */
class CVarTable {
    _tVars = [];       // Array with the var values.

    /**
     * Set default Prog vars, so they can be used by the application.
     */
    setDefaults() {
        this.setVar("prog.name","LSC Device");
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
     * @param {[]|CVarTable|object} oData either an array [], an instance of CVarTable or an object {...}.
     * @returns this VarTable
     */
    setVars(oData) {   
        if(oData) {
            let tVars = Array.isArray(oData) ? oData : Array.isArray(oData._tVars) ? oData._tVars : undefined;
            if(Array.isArray(tVars)) {
                for(const strKey in tVars) { 
                    this._tVars[strKey] = tVars[strKey] 
                }
            }
            else if(typeof oData === 'object') {
                for(const strKey in oData) { 
                    this._tVars[strKey] = oData[strKey] 
                }
            }
        }
        return(this);
    }

    /**
     * scans the HTML document or a given element for "VarTable" elements
     * @param {HTMLElement|CElement} [oElement=document.body] Default is the document body
     * @param {string} [strTable="VarTable"] Default is the global vars.. specify your local table if needed like "PageVarTable"
     */
    setPageVars(oElement = document,strTable = "VarTable") {
        if(oElement && strTable) {
            let oBase = CElement.asNative(oElement);
            oBase.querySelectorAll(strTable).forEach((t) => {
                try {
                    let tVars = JSON.parse(t.innerText);
                    for(const strKey in tVars) this.setVar(strKey,tVars[strKey]);
                } catch (ex){
                    Log.logEx(ex,"json : " + t.innerText);
                }
            })
        }
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

// #endregion

// #region Utility class
/**
 * Common utitilities for java script
 */
class Utils {

    static capitalizeFirstLetter(strWord) {
        let oResult = strWord;
        if(Utils.isString(strWord)) oResult = String(strWord).charAt(0).toUpperCase() + String(strWord).slice(1);
    }

    static isFalseValue(oValue) {
        let bResult = false;
        if(this.isString(oValue)) {
            oValue = oValue.trim().toLowerCase();
            bResult = [ "false", "0", "no", "off" ].includes(oValue);
        } else if(this.isBoolean(oValue)) {
            bResult = !oValue;
        } else if(oValue === undefined) {
            bResult = true;
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

    static isArray(oElement) {
        return(Array.isArray(oElement));
    }

}

// #endregion

// #region Logging class

/**
 * Logging class
 */
class CLog {
    static _bDebug = false;
    static _nLogLevel = 5;

    setDebug(bOn) {
        this.constructor._bDebug = bOn;
    }
    setLogLevel(nLevel) {
        this.constructor._nLogLevel = nLevel
    }
    getLogLevel() {
        return(this.constructor._nLogLevel);
    }
    getDebugMode() {
        return(this.constructor._bDebug);
    }
    _log(strType,oData) {
        if(oData && typeof oData === 'string') console.log(`${Date.now()} [${strType}] : ${oData}`);
        else console.log(oData);
    }

    logDebug(e) {
        if(this.getDebugMode() && e) this._log("D",e);
    }
    logEx(ex,str) {
        this._log("X",str);
        this._log("X",ex);
    }

    logInfo(e) {
        if(this.getLogLevel() > 0) this._log("I",e);
    }
    logWarning(e) {
        if(this.getLogLevel() > 0) this._log("W",e);
    }
    logVerbose(e) {
        if(this.getLogLevel() > 2) this._log("V",e);
    }
    logError(e) {
        if(this.getLogLevel() > 0) this._log("E",e);
    }
    logTrace(e) {
        if(this.getLogLevel() > 4) this._log("T",e);
    }
}
// #endregion

// #region Config class
/**
 * Config class.
 */
class CConfig {

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
    /**
     * add a config to the existing one.
     * join the data (and consruct a new config object)
     * @param {*} oConfig 
     */
    addConfig(oConfig) {
        this._oConfig = {...this._oConfig,...oConfig}; 
    }

    /**
     * set a new config object
     * @param {*} oConfig 
     */
    setConfig(oConfig)    { this._oConfig = oConfig ?? {}; }

    /**
     * get the current config object (root)
     * @returns 
     */
    getConfig()           { return(this._oConfig); }

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
            oData = tKeys.reduce((obj, i) => obj[i], this._oConfig);
        } catch  {}
        return(oData ?? oDefault);
    }

    /**
     * Store the data in the key of the section.
     * If the key contains section information, ensure, the section exists.
     * @param {*} strKey key to store like "wifi.settings.on" ( => "on")
     * @param {*} oData  data to be stored in the requested section ( => "wifi.settings" )
     */
    setData(strKey, oData) {
        let oBase = this.getConfig();
        if(Utils.isString(strKey)) {
            let nPos    = strKey.lastIndexOf("."); 
            if(nPos > -1) {
                let strPath = strKey.substring(0,nPos);
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

    /**
     * get the config object as a serialized string
     * @returns 
     */
    getSerialized() {
        return(JSON.stringify(this._oConfig, null, 2));
    }

}


// #endregion

// #region Basic Element class

class CElement extends Utils {
    _oBE = document.body;

    /**
     * Either a string with an query selector to an HTML element,
     * or already an CElement object, 
     * or a HTML element...
     * otherwise the body of the html document
     * @param {*} oNI 
    */
    constructor(oSel) {
        super();
        if(Utils.isString(oSel)) {
            this._oBE = document.querySelector(oSel);
        }
        else if(Utils.isInstanceOf(oSel, "CElement")) {
            this._oBE = oSel._oBE;
        }
        else {
            this._oBE = oSel;
        }
    }

    /**
     * get the base obj. 
     * @returns 
     */
    getBase() {
        return(this._oBE);
    }
    hasBase() {
        return(Utils.isElement(this._oBE))
    }

    /**
     * returns the parent element (HTMLElement)
     * @returns HTMLElement or null
     */
    parent() {
        return(new CElement(this.getBase().parentElement));
    }

    static asNative(oEL) {
        let oResult = oEL;
        if(Utils.isInstanceOf(oEL,"CElement")) oResult = oEL.getBase();
        return(oResult);
    }

    static asInstance(oEL) {
        let oResult = oEL;
        if(Utils.isElement(oEL)) oResult = new CElement(oEL);
        return(oResult);
    }

    isValid() {
        return(this._oBE ? this._oBE.checkValidity() : false);
    }

    /**
     * is the element visible to the user ?
     * Also checks the parent elements, if bRecursive is true.
     * @param {*} bRecursive true -> check the whole tree, otherwise only this element
     * @returns 
     */
    isVisible(bRecursive = true) {
        let oBE = this.getBase();
        let bResult = oBE ? true : false;
        if(oBE && oBE.nodeName !== "BODY") {
            if(oBE.disabled || oBE.style.display === "none" || oBE.style.visibility === "hidden") {
                bResult = false;
            } else {
                if(bRecursive) {
                    let oParent = new CElement(oBE.parentElement);
                    bResult = oParent.isVisible(bRecursive);
                }
            }
        }
        return(bResult);
    }

    append(oElement) {
        if(this._oBE) {
            let oNE = this.constructor.asNative(oElement);
            if(oNE) this.getBase().appendChild(oNE);
        }
        return(this);
    }

    replaceWith(oElement) {
        if(this._oBE) {
            let oNE = this.constructor.asNative(oElement);
            if(oNE) {
                this._oBE.replaceWith(oNE);
                this._oBE = oNE;
            }
        }
        return(this);
    }

    on(strEvent,func,oInfo) {
        if(this._oBE) {
            if(Utils.isString(strEvent) && Utils.isFunction(func)) {
                this.getBase().addEventListener(strEvent,func);
            }
            if(oInfo && !this.evtArgs()) this.evtArgs(oInfo);
        }
        return(this);
    }
    /**
     * Reset the element (and all childs)
     * all event listeners, all values will be lost...
     */
    reset() {
        let oNew = this.getBase().cloneNode(true);
        // this.ce(this.getBase().nodeName);
        // let strHTML = this._oBE.outerHTML;
        this.replaceWith(oNew);
        
        // this._oBE.parentNode(replaceChild(oNew,this._oBE))
        // this._oBE.outerHTML = strHTML;
    }

    evtArgs(oArgs) {
        let strArgs = oArgs;
        let strObjPrefix = "###:"
        let oResult = this;
        if(oArgs) {
            try {
                if(Utils.isObj(oArgs)) strArgs = strObjPrefix + JSON.stringify(oArgs);
                this.data("evtArgs",strArgs);
            } catch(ex) {
                this.Log.logEx(ex,"Args for event listener");
            };
        } else {
            oResult = this.data("evtArgs");
            try {
                if(oResult.startsWith(strObjPrefix)) {
                    oResult = JSON.parse(strArgs.substring(strObjPrefix.length))
                } 
            } catch {}
        }
        return(oResult);
    }

    /**
     * create an element
     * if arg is a name (string), a element with this name will be created.
     * @param {*} strName 
     * @returns 
     */
    static ce(strName) {
        return new CElement(document.createElement(strName));
    }

    ce(strName) {
        return(CElement.ce(strName));
    }

    /* create child element */
    cce(strName) {
        if(this._oBE) {
            const oNewElement = document.createElement(strName);
            this.getBase().appendChild(oNewElement);
            return new CElement(oNewElement);
        }
    }

    /* create element with namespace */
    static ceNS(strNS,strName) {
        return new CElement(document.createElementNS(strNS, strName));
    }

    // #region select element and get element functions...

    /**
     * query select from the base obj
     * @param {*} strSel 
     * @returns 
     */
    sel(strSel) {
        return(this.getBase().querySelector(strSel));
    }

    /**
     * query select all, starting from the base obj
     * @param {*} strSel 
     * @returns 
     */
    selAll(strSel) {
        return(this.getBase().querySelectorAll(strSel));
    }

    /**
     * select by id, starting from the base obj !
     * @param {*} strSel 
     * @returns 
     */
    selById(strSel) {
        return(this.sel("#" + strSel));
    }

    /**
     * query select an element
     * @param {*} strSel 
     * @returns a CElement object
     */
    gel(strSel) {
        return(new CElement(this.getBase().querySelector(strSel)));
    }
    /**
     * query select all, starting from the base obj
     * @param {*} strSel 
     * @returns list of CElement objects
     */
    gelAll(strSel) {
        let tResult = [];
        this.selAll(strSel).forEach(e => tResult.push(new CElement(e)));
        return(tResult);
    }

    gelById(strSel) {
        return(this.gel("#" + strSel));
    }

    // #endregion

    

    // #region attribute and element operations

    /**
     * get or set the innerHTML of an element.
     * @param {*} strHTML 
     * @returns this object
     */
    html(strHTML) {
        let oResult = this;
        let oElement = this._oBE;
        if(oElement) {
            if(strHTML === undefined || strHTML === null) {
                oResult = oElement.innerHTML;
            } else {
                oElement.innerHTML = strHTML;
            } 
        }
        return(oResult);
    }

    hasAttr(strName) {
        return(this._oBE ? this._oBE.hasAttribute(strName) : false);
    }

    id(strID) {
        let oResult = this;
        if(this._oBE) {
            if(Utils.isString(strID)) {
                this._oBE.id = strID;
            } else if(strID === undefined) {
                 oResult = this._oBE.id;
            } else {
                this.attr("id",null);
            }
        }
        return(oResult);
    }

    /**
     * set the dataset info
     * @param {*} strName 
     * @param {string|object|null|undefined} oValue null== delete, undefined == get, all other set...
     * @returns the value or the json object by get, otherwise this object
     */
    data(strName,oValue) {
        let oResult = this;
        let oE = this.getBase();
        if(strName && oE) {
            if(oValue === null) delete oE.dataset[strName];
            else if (oValue) {
                if(Utils.isObj(oValue)) {
                    try {
                        oValue = JSON.stringify(oValue);
                    } catch {}
                }
                oE.dataset[strName] = oValue;
            } else {
                oResult = oE.dataset[strName]; 
                if(oResult && oResult.startsWith("{")) {
                    try {
                        oResult = JSON.parse(oResult);
                    } catch(ex) { console.log("EX: parsing to json object"); console.log(oResult); console.log(ex)}
                }
            }
        }
        return(oResult);
    }

    /**
     * get and set an attribute of the element.
     * @param {*} strName Name of the attribute to be set or get.
     * @param {*} strValue null = remove the attribute, undefined = get the attribute value.
     * @returns either the value of the attribute, or this object, when setting or removing the attribute.
     */
    attr(strName, strValue) {
        let oResult = this;
        let oE = this.getBase();
        if(strName && oE) {
            if(strValue === null) {
                oE.removeAttribute(strName);
            }
            else if (strValue) {
                oE.setAttribute(strName,strValue);
            } else {
                oResult = oE.getAttribute(strName);
            }
        }
        return(oResult);
    }

    attrFrom(oElement,bReplace = false, tVars) {
        let oSource = oElement;
        let oTarget = this.getBase();
        if(oTarget) {
            if(Utils.isInstanceOf(oElement,"CElement")) oSource = oElement.getBase();
            let bSubst = Utils.isInstanceOf(tVars,"CVarTable");
            for(let oAttr of oSource.attributes ) {
                if(bReplace || !oTarget.hasAttribute(oAttr.name)) {
                    let strValue = bSubst ? tVars.subst(oAttr.value) : oAttr.value;
                    oTarget.setAttribute(oAttr.name,strValue)
                }
            }
        }
    }

    /**
     * set the list of attributes for an element, based on the given data.
     * @param {*} oData json string or object with "attribute-name: value" pairs.
     * @returns this object for further processing
     */
    setAttributes(oData) {
        // If oData is a string, try to convert the JSON string into an object first.
        if(this.constructor.isString(oData)) {
            try {
                oData = JSON.parse(oData);
            } catch(ex) { console.log(ex) };
        }
        if (this.constructor.isObj(oData)) {
            for (const strKey in oData) {
                this.attr(strKey, oData[strKey]);
            }
        }
        return this;
    }

    hasClass(strClass) {
        return(this._oBE ? this._oBE.classList.contains(strClass) : false);
    }
    ac(strClass) {
        if(strClass && this._oBE) this._oBE.classList.add(strClass);
        return(this);
    }

    rc(strClass) {
        if(strClass && this._oBE) this._oBE.classList.remove(strClass);
        return(this);
    }

    /**
     * add class names.
     * Already existing names will not be touched.
     * @param {*} oE        The element
     * @param {*} strNames  The names to be set in class attribute
     */
    acn(strNames) {
        if(strNames) {
            let oSelf = this;
            strNames.split(" ").forEach((cn) => {
                oSelf.ac(cn);
            });
        }
    }
    // #endregion

    // #region Set and get the value of this object, independent of the type


    /**
     * Set the text of this element.
     * If the text starts with "i18n:", the data attribute will be set
     * and the element can be translated
     * @param {*} strText 
     * @returns this object
     */
    setText(strText) {
        let oElement = this.getBase();
        if(strText && oElement) {
            if(strText.startsWith("i18n:")) oElement.dataset.i18n = strText.substring(5);
            else oElement.innerHTML = strText;
        }
        return(this);
    }

    /**
     * Set a value to an element, without knowing about the type.
     * Used by config to element functions, they only know the property name.
     * @param {*} oElement  The element
     * @param {*} oValue    The value to be set as text/value
     * @returns this object
     */
    setValue(oValue) {
        let oElement = this.getBase();
        if(oValue != undefined && oElement) {
            if(!oElement.type) oElement.innerText = oValue;
            else {
                switch(oElement.type) {
                    case "password"   :
                    case "number":
                    case "text"       : oElement.value = oValue; break;
                    case "select-one" : // Select the option if exists - if not, append...
                                        let bExists = false;
                                        let strVal = oValue;
                                        for(let i=0;i<oElement.options.length;i++) {
                                            if(oElement.options[i].value == strVal) {
                                                bExists = true; break;
                                            }
                                        };
                                        if(!bExists) {
                                            oElement.innerHTML += "<option value='" + oValue + "'>" + oValue + "</option>"; 
                                        }
                                        oElement.value = strVal;
                                        break;
                    case "checkbox"   :
                                        // set checked, if value is true ( keep in mind, also "1" will become true )
                                        oElement.checked = Utils.isTrueValue(oValue);
                                        break;

                    case "radio"      : // Set the checked radio button to true / false.
                                        oElement.checked = oElement.value == oValue;
                                        break;
                }
            }
        }
        return(this);
    }

    /**
     * Get the value of an element, without knowing about the type.
     * Used by config to element functions, they only know the property name.
     * @param {*} bNative   Get the value, see radio button (!)
     * @returns The value/text of the element
     */
    getValue(bNative = false) {
        let oResult;
        let oElement = this.getBase();
        if(oElement) {
            switch(oElement.type) {
                case "password"   :
                case "number":
                case "text"       : oResult = oElement.value; 
                                    if(!oResult) oResult = "";
                                    break;
                case "select-one" : // Try to get the specialized value first (i.E. ssid display is different, but the value to be stored
                                    // is in the option field "ssid").
                                    // If not in place, use the value of the element
                                    oResult = oElement.value;
                                    break;

                case "checkbox"   : oResult = Utils.isTrueValue(oElement.checked) ? "1" : "0";
                                    break;

                case "radio"      : // The value of the checked element will be the result.
                                    // unchecked radio buttons will result in undefined
                                    if(oElement.checked || bNative) oResult = oElement.value;
                                    break;
            }
        }
        return(oResult);
    }

    // #endregion

    // #region Fade In/Out and visibility of this element

    async fadeIn(ms = 500){
        let oSelf = this;
        let oElement = this.getBase();
        if(oElement) {
            oElement.style.opacity = 0;
            oElement.style.filter = "alpha(opacity=0)";
            oElement.style.display = "inline-block";
            oElement.style.visibility = "visible";

            if( ms ) {
                let opacity = 0;
                let timer = setInterval( function() {
                    opacity += 50 / ms;
                    if( opacity >= 1 )
                    {
                        clearInterval(timer);
                        opacity = 1;
                        return(oSelf);
                    }
                    oElement.style.opacity = opacity;
                    oElement.style.filter = "alpha(opacity=" + opacity * 100 + ")";
                    }, 50 );
            } else {
                oElement.style.opacity = 1;
                oElement.style.filter = "alpha(opacity=1)";
                return(oSelf);
            }
        }
        return(oSelf);
    }

    async fadeOut(ms = 500) {
        let oSelf = this;
        let oElement = this.getBase();
        if(oElement && ms) {
            let nOpacity = 1;
            let oTimer = setInterval( function() {
                nOpacity -= 50 / ms;
                if( nOpacity <= 0 )
                {
                    clearInterval(oTimer);
                    nOpacity = 0;
                    oElement.style.display = "none";
                    oElement.style.visibility = "hidden";
                    return(oSelf);
                }
                oElement.style.opacity = nOpacity;
                oElement.style.filter = "alpha(opacity=" + nOpacity * 100 + ")";
                }, 50 );
        } else {
            oElement.style.opacity = 0;
            oElement.style.filter = "alpha(opacity=0)";
            oElement.style.display = "none";
            oElement.style.visibility = "hidden";
        }
        
        return(oSelf);
    }

    /**
     * Hide this element.
     * it is necessary to inclue runtime.css also, as it is used with
     * the classdefinition "isHidden"
     * @param {*} bHide true == hide , false == show
     */
    hide(bHide = true) {
        if(bHide) this.ac("isHidden");
        else this.show();
    }
    /**
     * Show this element.
     * it is necessary to inclue runtime.css also, as it is used with
     * the classdefinition "isHidden"
     * @param {*} bShow true == show , false == hide
     */
    show(bShow = true) {
        if(bShow) this.rc("isHidden");
        else this.hide();
    }

    // #endregion



}

/**
 * Element Class/Container as shortcut to the CElement class
 * If the parameter is a string, it will be searched for this element in the DOM.
 * 
 * @param {string|HTMLElement|CElement} oData 
 * @returns CElement object
 */
function EC(oData) { return new CElement(oData) }

// #endregion

// #region Template (HTML Elements) class

class CTemplates {

    constructor(oSettings,tVars) {
        this._Vars = Utils.isInstanceOf(tVars,"CVarTable") ? tVars : new CVarTable();
        this._Settings = Utils.isInstanceOf(oSettings,"CAppSettings") ? oSettings :
                         Utils.isObj(oSettings) ? new CAppSettings(oSettings) : 
                         new CAppSettings({});
    }


    // #region create icons and find icon definitions

    /**
     * returns the icon definition for a given icon name (if available).
     * @param {*} strName 
     * @returns null or the icon def
     */
    findIconDef(strName) {
        let oIcon = null;
        for (const i of this._Settings.getSection("icons.d")) {
            if (i.name === strName) {
                oIcon = i;
                break;
            }
        }
        return oIcon || null;
    }

    /**
     * getIconDef searche the icon def, via findIconDef()
     * --- 
     * the result will be a copy of the original def, which 
     * can be modified without affecting the base definition.
     * @param {*} strName 
     * @returns 
     */
    getIconDef(strName) {
        let oIcon = this.findIconDef(strName)
        return(oIcon ? {...oIcon} : null);
    }

    /**
     * Create an Icon, based on an icon definition (see settings).
     * Currently tested are SVG icons
     * Example of a definition {
           "name": "Arrows",                        // Name of this icon definition
           "type": "svg",                           // Type of the definition (svg grafik)
           "class": "bi bi-chevron-double-left",    // class to be set, to be used by css
           "title": "Arrow icon",                   // Title to be set on the element
           "attr": {                                // Attributes to be set on the created element, 
               "viewBox": "0 0 16 16"
           },
            "data": [                               // Type specific array ... for svg the path elements.
                "M8.354 1.646a.5.5 0 0 1 0 .708L2.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0",
                "M12.354 1.646a.5.5 0 0 1 0 .708L6.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0"
            ]
        },
     * @param {string|object} eIconDef either the icon definition or a string with the name of the icon..
     * @param {string?} strSub if set, the icon<strSub> will be also applied for attributes...
     * @returns  a new HTML Element with the icon data
     */
    createIcon(eIconDef,strSub) {
        let oIcon = undefined;
        let oIconDef = eIconDef;
        if(typeof eIconDef == 'string') oIconDef = this.getIconDef(eIconDef);
        if(oIconDef) {
            let oDefaults;  // Defaults for icon definition, taking from the settings.
            if (oIconDef.type == "svg") {
                oDefaults = this._Settings.getSection("icons.svg") ?? {};
                if(Utils.isString(strSub) && strSub.length > 0) {
                    let oSub = this._Settings.getSection("icons.svg" + strSub);
                    oDefaults = {...oDefaults, ...oSub};
                }
                const NS = "http://www.w3.org/2000/svg";
                oIcon = CElement.ceNS(NS,"svg"); 
                for(const strData of oIconDef.data) {
                    let oPath = CElement.ceNS(NS,"path").attr("d",strData);
                    oIcon.append(oPath);
                }
                // If a title definition is in place, set the title text...
                if(oIconDef.title) {
                    let oTitle = oIcon.cce("title").html(oIconDef.title);
                    if(oIconDef.i18n) oTitle.getBase().dataset.i18n = oIconDef.i18n + ".title";
                } 
            }
            else {
                oIcon = CElement.ce("i");
                oIcon.acn(eIconDef.class); // Assuming the icon is a class name
                if(oIconDef.i18n) oIcon.getBase().dataset.i18n = oIconDef.i18n + ".title";
            }
            if(oIcon) {
                oIcon.setAttributes(oDefaults || {});
                oIcon.setAttributes(oIconDef.attr || {});
            }
        } 
        return (oIcon);
    }

    /**
     * create all icons inside a container..
     * remove the definition after create, to avoid multiple icons
     * @param {*} oContainer 
     */
    createIcons(oContainer) {
        if(oContainer) {
            let oSource = CElement.asInstance(oContainer);
            let oSelf = this;
            oSource.selAll("[data-icon]").forEach((oElement) => {
                let oIconDef = oSelf.getIconDef(oElement.dataset.icon);
                if(oIconDef) {
                    let strTitle = oElement.dataset.title;
                    if(strTitle) {
                        oIconDef.title = strTitle;
                    }
                    let strAttrs = oElement.dataset.iconAttr;
                    if(strAttrs) {
                        if(!oIconDef.attr) oIconDef.attr = {};
                        strAttrs.split(";").forEach(function(s) {
                            let t = s.trim().split("=");
                            if(t.length == 2) {
                                oIconDef.attr[t[0].trim()] = t[1].trim();;
                            }   
                        });
                    }
                    let oHtmlIcon = oSelf.createIcon(oIconDef);
                    if(oHtmlIcon) {
                        if(oElement.tagName.toLowerCase() == "icon") oElement.replaceWith(oHtmlIcon.getBase());
                        else oElement.append(oHtmlIcon.getBase());
                    }
                }
                // To avoid duplicate icons on calls - remove the data-icon attribute
                oElement.removeAttribute("data-icon");
            });
        }
    }


    // #endregion

    // #region create element types like buttons / rows...

    /**
     * create well known elements in the container
     * @param {HTMLElement|CElement} oContainer 
     * @param {IEventCallback} pEventHandler (needs the onEvent function)
     */
    createElements(oContainer,pEventHandler) {
        if(!oContainer) oContainer = document.body;
        let oC = CElement.asInstance(oContainer);
        oC.selAll("[data-element-type]").forEach(e => {
            this.createElementType(e,pEventHandler);
        });
    }

    /**
     * create an element, defined by it's type...
     * "save-btn"       : a default save button
     * "save-btn-row"   : a default row with a save button - aligned right.
     * @param {*} oElement 
     * @param {IEventCallback} pEventHandler 
     */
    createElementType(oElement,pEventHandler) {
        if(oElement) {
            let oNEL = CElement.asNative(oElement);
            switch(oNEL.dataset.elementType) {
                case "save-btn-row": this.createSaveBtnRow(oElement,pEventHandler); break;
                case "save-btn" :    this.createSaveButton(oElement,pEventHandler); break;
                case "expand":       this.expandElement(oElement,pEventHandler);    break;
            }
            oNEL.removeAttribute("data-element");
        }
    }


    /**
     * create an row with the requested save button inside
     * replace the element with the result
     * @param {*} oElement 
     * @returns an instance of the row
     */
    createSaveBtnRow(oElement,pEventHandler) {
        let oCell = CElement.ce("div");
        oCell.acn(this._Settings.getData("save.cell.classes"));
        let oButton = oCell.cce("button");
        this.createSaveButton(oButton,pEventHandler);
        oElement.replaceWith(oCell.getBase());
        return(oCell);
    }

    /**
     * creates a save button
     * replace the element with the button
     * @param {*} oElement 
     * @returns instance of new button
     */
    createSaveButton(oElement,pEventHandler) {
        let oSource = CElement.asInstance(oElement);
        let oButton = CElement.ce("button");
        oButton.attrFrom(oSource,true,this._Vars);
        oButton.ac("saveBtn");
        oButton.acn(this._Settings.getData("save.btn.classes"));
        oButton.html("Save");
        oButton.data("i18n","main.saveBtn");
        oButton.data("auth","1");
        
        // oButton.attr("formAction","void()")
        oSource.replaceWith(oButton);
        if(pEventHandler && Utils.isFunction(pEventHandler.savePage)) {
            oSource.on("click",pEventHandler.savePage.bind(pEventHandler),"savePage");
        }
        return(oButton);
    }

    /**
     * expand an element by substitution of attributes and content
     * @param {*} oElement 
     */
    expandElement(oElement) {
        let oNE = CElement.asNative(oElement);
        if(oNE) {
            for(let oAttr of oNE.attributes ) {
                oNE.setAttribute(oAttr.name,this._Vars.subst(oAttr.value))
            }
            oNE.innerHTML = this._Vars.subst(oNE.innerHTML);
        }
    }
    // #endregion



}

// #endregion

// #region Application Setting class
/**
 * Settings for an application, based on a config object
 */
class CAppSettings extends CConfig {
    Log = new CLog();
    /**
     * 
     * @param {object} oSettings 
     */
    constructor(oSettings) {
        super(oSettings);
    }

    /**
     * get the array of menu entries (if not exist - create)
     * @returns the array.
     */
    getMenuDefs() {
        if(!this._oConfig.hasOwnProperty("menu")) this._oConfig.menu = [];
        return(this._oConfig.menu);
    }

    /**
     * update or create a menu entry.
     * The menu entry will be inserted at correct position in the menu tree,
     * if the name property has parent elements.
     * "home" will become a root menu entry "home".
     * "Settings|wifi" will become a submenu entry in the drop down menu "Settings"
     * 
     * Prepare the menu tree, before creating the menus.
     * @param {*} oMenuDef 
     * @returns 
     */
    setMenuEntry(oMenuDef, strPageContainerID) {
        let oMenuEntry;
        let oParent = this.getMenuDefs();
        // At least a name must be in place... !
        if(oMenuDef && oMenuDef.name) {
            let tNames = oMenuDef.name.split("|");
            // Search the parent menu - or create if not exist...
            for(let i = 0; i < tNames.length -1; i++) {
                let strMenuName = tNames[i];
                let oEntry = oParent.find((oME) => oME.name == strMenuName);
                if(!oEntry) {
                    oEntry = { name: strMenuName };
                    oParent.push( oEntry ) ;
                }
                if(!oEntry.menu) oEntry.menu = [];
                oParent = oEntry.menu;
            }
            // a special container id where the page is stored ?
            if(strPageContainerID) {
                if(!oMenuDef.attr) oMenuDef.attr = {}
                if(!oMenuDef.attr.pageID) oMenuDef.attr.pageID = strPageContainerID;
            } 
            // now get or create the menu entry...
            let strMenuName = tNames[tNames.length -1];
            this.Log.logTrace(`setting menu entry: ${strMenuName}`)
            let oMenuEntry = oParent.find((oME) => oME.name == strMenuName)
            if(!oMenuEntry) {
                // Menu does not exist... create with whole object...
                oMenuEntry = { ...oMenuDef, ...{name:strMenuName }};
                oParent.push( oMenuEntry );
            } else {
                // Menu already exists... update...
                Object.assign(oMenuEntry,oMenuDef);
                oMenuEntry.name = strMenuName;
            }
        }
        return(oMenuEntry);
    }

}

// #endregion

// #region i18n Translator

/**
 * i18n Translator to reflect users language in the GUI
 * The translator loads from the current server location the needed language definition
 * in the form of "i18n/<language-code>.json".
 */
class CTranslator {
    // default language is "en" - english, if not set in the document root element.
    static _defaultLang = document.documentElement.lang ? document.documentElement.lang.substring(0,2) : "en";
    static _tLangDefs = [];
    _userLang    = this.getUserLanguage() ?? CTranslator._defaultLang;
    _strLoadPath;  // = "i18n";

    /**
     * constructor of CTranslator
     * @param {*} strLoadPath path, where to find the <language>.json files - default is "i18n"
     * @param {boolean} [bForceAttributes=true] set the attribute if it exists or not.
     */
    constructor(strLoadPath = "i18n", bForceAttributes = true) {
        this._strLoadPath = strLoadPath;
        this._bForceAttributes = bForceAttributes;
        
    }

    async preload(funcCallBack) {
        // preload the language files to avoid load time...
        await this.getLanguageDef(CTranslator._defaultLang);
        await this.getLanguageDef(this._userLang);
        if(funcCallBack) funcCallBack();
        return(this);
    }

    /**
     * get a specific language definition.
     * If not already loaded, fetch it from the server..
     * @param {*} strLanguage 
     * @returns a language definition object...
     */
    async getLanguageDef(strLanguage) {
        let oResult = {};
        if(strLanguage) {
            let oLangDef = CTranslator._tLangDefs[strLanguage]; 
            if(!oLangDef) {
                oLangDef = {
                    "_": {
                        "lang": strLanguage,
                        "status": 0,
                        "statusText": "loading"
                    }
                }
                // CTranslator._tLangDefs[strLanguage] = {...oLangDef};
                await fetch(`${this._strLoadPath}/${strLanguage}.json`)
                    .then(oResponse => {
                        oLangDef._.status       = oResponse.status;
                        oLangDef._.statusText   = oResponse.statusText;
                        return(oResponse.status == 200 ? oResponse.json() : oLangDef);
                        })
                    .then( oData => {
                        let oResult = {...oLangDef};
                        if(oLangDef._.status == 200) {
                            oResult = { ...oData,...oLangDef};
                        }
                        // store the result in the language table...
                        CTranslator._tLangDefs[strLanguage] = oResult;
                        return(oResult);
                    })
                    .catch(ex => { 
                        oLangDef._.status = -1;
                        oLangDef._.statusText = ex.message;
                        CTranslator._tLangDefs[strLanguage] = oLangDef;
                        return oLangDef; 
                    });
            }
            oResult = CTranslator._tLangDefs[strLanguage];
        }
        return(oResult ?? {} );
    }

    /**
     * Get the language of the user interface (Browser)
     * The primary language will be used (first entry)
     * If the browser does not support, the language of the page will be used
     * @returns the language code
     */
    getUserLanguage(){
        let strLang = navigator.languages ? navigator.languages[0]: navigator.language;
        return(strLang.substring(0,2));
    }

    /**
     * Get the i18n data definition from the  language object
     * @param {*} i18nKey      The i18n info like "menu.status"
     * @param {*} oLangDef     A i18n language definition object
     * @returns text or object found in the language object. if not in place - undefined.
     */
    getI18nData(i18nKey,oLangDef) {
        let oData;
        try {
            let tKeys = i18nKey.split(".");
            oData = tKeys.reduce((obj, i) => obj[i], oLangDef);
        } catch  {}
        return(oData);
    }


    getAsString(oData, strDefault) {
        let strResult = "";
        if(oData) {
            if(Array.isArray(oData)) {
                for(let strLine of oData) strResult += strLine;
            } else {
                strResult = oData;
            }
        }
        return(strResult ?? strDefault);
    }

    /**
     * gets the Language data - 
     * - either from the requested language (object)
     * - or if not found, from the default language.
     * 
     * If no info could be found, the default will be returned
     * 
     * @param {string} i18nKey               The key to be searched
     * @param {string} strLanguage 
     * @param {string|object|undefined} oDefaultData 
     * @returns 
     */
    async getKeyData(i18nKey, strLanguage, oDefaultData) {
        let oDefaultLangDef;
        let oData = oDefaultData;
        if(!strLanguage) strLanguage = this.getUserLanguage();
        return(this.getLanguageDef(CTranslator._defaultLang)
            .then(oLD => {
                oDefaultLangDef = oLD;
                return(this.getLanguageDef(strLanguage));
            })
            .then(oUserLangDef => {
                oData = this.getI18nData(i18nKey,oUserLangDef);
                if(!oData) {
                    oData = this.getI18nData(i18nKey,oDefaultLangDef,oDefaultData);
                }
                return(oData);
            }));
    }

    

    /**
     * workhorse to fill the element properties with data
     * Either data is a string, then the element innerHTML will be set,
     * Or data is an object, then all properties inside will be processed.
     *  - "text" will become innerText
     *  - "html" will become innerHTML
     *  - "@..." will become attributes (if force, they will be created)
     * @param {*} oElement The HTML element to operate on
     * @param {*} oData Data object as string, or with object properties to be processed
     * @param {*} oVarTable Vars to be substituted against.
     * @returns the Element processed
     */
    _setElementProps(oElement,oData, oVarTable) {
        let bSubst = oVarTable && oVarTable.subst;
        if(Array.isArray(oData)) {
            oData = this.getAsString(oData)
        }
        if(typeof oData === 'string') {
            oElement.innerHTML = bSubst ? oVarTable.subst(oData) : oData;
        }
        else if(typeof oData === 'object') {
            // If object, all "@..." elements are attribute information
            // The the target has this attribute, it will be replaced...
            for(let strKey in oData) {
                if(strKey.startsWith("@")) {
                    let strAttr = strKey.substring(1);
                    if(this._bForceAttributes || oElement.hasAttribute(strAttr)) {
                        oElement.setAttribute(strAttr,bSubst ? oVarTable.subst(oData[strKey]) : oData[strKey]);
                    }
                } else {
                    // set element by name
                    let strVal = bSubst ? oVarTable.subst(oData[strKey]) : oData[strKey]
                    switch(strKey) {
                        case "text": oElement.innerText = strVal; break;
                        case "html": oElement.innerHTML = strVal; break;
                    }
                }

            }
        }
        return(oElement);
    }

    async translateI18n(strI18n,strLanguage,oVars) {
        let strResult = "";
        await this.getKeyData(strI18n,strLanguage)
            .then(str => {
                strResult = oVars ? oVars.subst(str) : str;
            })
        return(strResult);
    }

    /**
     * Translate an (html) element into the requested language
     * and substitute it against the var table
     * @param {HTMLElement} oElement         The element to be translated
     * @param {string|undefined} strLanguage Default is the userlanguage code
     * @param {CVarTable} oVars              The vars of the application
     * @param {boolean} bWithChilds false == only the element, true == also the child elements
     */
    async translate(oElement, strLanguage, oVars, bWithChilds = true) {
        if(!strLanguage) strLanguage = this.getUserLanguage();
        let oSelf = this;
        if(typeof oElement === 'object') {
            let strI18n = oElement.dataset.i18n;

            if(strI18n && typeof strLanguage === 'string') {
                for(let strSelect of strI18n.split("|")) {
                    let strKey = strSelect;
                    let strTarget;
                    let nPos = strSelect.indexOf(":");
                    if(nPos > -1 ) {
                        strKey = strSelect.substring(nPos+1);
                        strTarget = strSelect.substring(0,nPos);
                    }
                    
                    this.getKeyData(strKey,strLanguage)
                        .then(oData => {
                            if(strTarget) {
                                if(strTarget.startsWith("@")) oElement.setAttribute(strTarget.substring(1),oData);
                                else {
                                    let oTargetElement = oElement.querySelector(strTarget);
                                    if(oTargetElement) oTargetElement.innerHTML = this.getAsString(oData);
                                }
                            }
                            let oResult = strTarget ? oElement : this._setElementProps(oElement,oData,oVars);
                            return(oResult);
                        })
                        .then(e => {
                            if(bWithChilds) {
                                e.querySelectorAll("[data-i18n]").forEach(e => oSelf.translate(e,strLanguage,oVars,bWithChilds))
                            }
                        });
                }
            } else {
                if(bWithChilds) {
                    oElement.querySelectorAll("[data-i18n]").forEach(e => oSelf.translate(e,strLanguage,oVars,bWithChilds))
                }
            }
        }
    }

    /**
     * Set the page tag to reflect all language specific behaviour in the browser
     * @param {*} strLanguage 
     */
    setPageTag(strLanguage) {
        if(strLanguage) {
            this._userLang = strLanguage;
            if (document.documentElement.lang !== this._userLang) {
                document.documentElement.lang = this._userLang;
            }
        }
    }     
}
// #endregion

// #region (Partial) View class for end user
class CView extends CElement {
    LocalVars = new CVarTable();

    constructor(oSel, oSettings) {
        super(oSel);
        this._Settings = Utils.isInstanceOf(oSettings,"CAppSettings") ? oSettings :
                         Utils.isObj(oSettings) ? new CAppSettings(oSettings) :
                         new CAppSettings({});
    }

    /**
     * gets the id of this page.
     * @returns 
     */
    getID () {
        return(this.getBase().dataset.viewId);
    }

    setID(strID) {
        this.getBase().dataset.viewId = strID;
        return(this);
    }

    getArea() {
        return(this.getBase());
    }

    Payload(oPayload) {
        return(this.data("payload",oPayload));
    }

    /**
     * Load the content of oData into this area, set the content id and load the local vars.
     * Create the shortcut element types and needed icons.
     * The page is loaded, but NOT translated... !
     * 
     * @param {*} strID the id to be used for this content in getID() and setID()
     * @param {string|HTMLElement|CElement} oData  sourc to pick the innerHTML
     * @param {IEventCallback} pCaller // Interface for calling the onEvent function
     * @param {CVarTable} tVars Vars to be used for substitution
     * @returns true.
     */
    loadView(strID,oData,tVars,pCaller) {
        let bLoaded = false;
        if(oData) {
            let strContent;
            if(Utils.isString(oData)) strContent = oData;
            else if(Utils.isElement(oData)) strContent = oData.innerHTML;
            else if(Utils.isInstanceOf(CElement)) strContent = oData.getBase().innerHTML;

            if(strContent) {
                this.rc("isLoaded");
                this.data("cfg",null);
                // set the content to scan for var definition.. in "PageVars"
                // then load all needed vars, substitute the content and load again
                this.html(strContent);
                this.LocalVars = new CVarTable();
                this.LocalVars.setVars(tVars); // empty object will be covered by CVarTable()
                this.LocalVars.setPageVars(this.getArea(),"PageVars");
                // If Payload object contains a var object, set this vars also...
                let oPayload = this.Payload();
                if(Utils.isObj(oPayload)) this.LocalVars.setVars(oPayload.vars);
                // Now process the content...
                strContent = this.LocalVars.subst(strContent);
                // Load the content into the container and set the data-act-page attribute.
                this.html(strContent);
                this.setID(strID);
                this.ac("isLoaded");

                // Now it's time to create all user templates and icons...
                let oTemplates = new CTemplates(this._Settings,this.LocalVars);

                oTemplates.createElements(this.getArea(),pCaller)
                oTemplates.createIcons(this.getArea());

                // Translate the data-id attributes to id of the elments (to avoid duplicate id's in the doc)
                this.selAll("[data-id]").forEach((e) => {
                    if(!e.id) e.id = e.dataset.id;
                });

                // Register the onEvent handler of the calling function...
                if(pCaller && Utils.isFunction(pCaller.onEvent)) {
                    let pCallBack = pCaller.onEvent.bind(pCaller);
                    // Register the update - event handler for input elements...
                    this.selAll("input").forEach((e) => {
                        let strType = e.type ?? e.getAttribute("type");
                        let ec = EC(e);
                        switch(strType) {
                            case "checkbox":
                                        if(!ec.hasAttr("onclick")) ec.on("click",pCallBack,"onCheckboxClick");
                                        break;
                            case "radio":
                                        if(!ec.hasAttr("onclick")) ec.on("click",pCallBack,"onRadioClick");
                                        break;
                            case "number":
                            case "text": 
                                        if(!ec.hasAttr("onchange")) ec.on("keyup",pCallBack,"onTextKeyUp");
                                        break;

                        }
                    })
                    // Register the update - handler for select elements...
                    this.gelAll("select:not([onchange])").forEach((e) => {
                        e.on("change",pCallBack,"onSelectChanged");
                    })
                    // Register button clicks... if no handler is defined, on no evtArgs is in place (prev. handler)
                    this.gelAll("button:not([onclick])").forEach((ec) => {
                        if(ec.evtArgs() == "savePage") {
                            ec.on("click",pCaller.savePage.bind(pCaller),"savePage");
                        }
                        else {
                            ec.on("click",pCallBack,"onButtonClicked"); //  e.setAttribute("onclick","APP.on('onButtonClicked',this)");
                        }
                    })
                }
                bLoaded = true;
            }
        }
        return(bLoaded);
    }

    enableAll(strSel,bEnable = true) {
        if(strSel) {
            this.selAll(strSel).forEach((e) => {
                e.disabled = !bEnable;
            });
        }
    }
}
// #endregion

// #region Page Handler Class 

/**
 * Base class for handling a page
 * - load configuration into the gui,
 * - store data from gui into config
 * - check validity 
 * - handle events
 * 
 * override for specialized pages like WiFi
 * 
 */
class CPageHandler {

    // #region common vars, constructor and init functions
    Log = new CLog();
    PageID;         // Holds the id of this page
    Content;        // Holds the content of the page as string

    /**
     * Config and ConfigName
     * =====================
     * Config is the complete config objectfor all pages !!!
     * ConfigName specifies the section name inside the Config object.
     * All Elements inside the config object can be used for pages to configure !
     */
    Config;         // The native config object, with all application settings inside 
    ConfigName;     // Section name of the config to be used (will be created by getConfig())


    _oMenuDef = {}; // Definition of gui entries, as found in the html


    /**
     * constructor initializes the content and the id.
     * @param {string} strID     the PageID of the content 
     * @param {string|CElement|HTMLElement} oContent  if set, the content as string or the HTMLElement node
     * @param {object} oConfig 
     */
    constructor(strID, oContent, oConfig) {
        // super();
        this.PageID = strID;
        this.Config = oConfig ?? {};
        this.setConfigName(strID);
        this._load(oContent);
    }

    /**
     * Once called, when the handler becomes active,
     * and the page view has been loaded.
     * @param {*} pView 
     * @param {*} pApp 
     */
    preparePage(pView, pApp) {
    }

    /**
     * Page cleanup - override if needed.
     * Page View and this handler will be destroyed after this call.
     */
    disposePage(pView, pApp) {}

    /**
     * Set the config section name.
     * Default is the page id, without "Page" in lowercase.
     * If the logic detects a data-cfg attribute in the page root,
     * this data will be used.
     * @param {*} strName 
     */
    setConfigName(strName) {
        if(Utils.isString(strName)) {
            this.ConfigName = strName;
            if(strName.endsWith("Page")) this.ConfigName = strName.substring(0,strName.length - 4).toLowerCase();
        }
    }

    /**
     * Get the config - and creates the section if does not exist...
     * @param {*} bCreateIfNotExist 
     * @returns empty json object or the section in the config file.
     */
    getConfig(bCreateIfNotExist) {
        let oCfg = {};
        if(this.Config) {
            oCfg = CConfig.asInstance(this.Config).getSection(this.ConfigName,bCreateIfNotExist);
        }
        return(oCfg ?? {});
    }


    /**
     * load content and menu infos into member vars..
     * it can process CElement's, native html elements and string as parameter.
     * if it is an CElement or an HTML element, additional infos can be in the html structure:
     * - @data-cfg      can be used to set the config section name for this page
     * - @data-menu.    can be used to define menu entries in the main navigation
     * 
     * @param {*} oData if string, this is the content, if HTMLElement, the innerHTML is the content.
     */
    _load(oData) {
        if(oData) {
            // if it is an CElement, get only the underlying html element
            if(Utils.isInstanceOf(oData,"CElement")) oData = oData.getBase();
            // if it is a string, then it is already the content
            if(Utils.isString(oData)) this.Content = oData;
            else if(Utils.isElement(oData)) {
                // use the config name from the page content
                this.setConfigName(oData.dataset.cfg);
                this.Content = oData.innerHTML;
                let strMenu = oData.dataset.menu;
                if(strMenu) {
                    let oOverlay = {};
                    try { oOverlay = JSON.parse(strMenu) }
                    catch (ex) {
                        this.Log.logEx(ex,`loading menu: "${strMenu}"`);
                    }
                    this._oMenuDef = {...this._oMenuDef, ...oOverlay};
                }
            }
        }
    }
    // #endregion
   
    // #region Load / Save and validity check functions of the page

     /** 
     * Get the content of the page (native - without user input)
     * Use the cached data if already loaded....
     */
    getContent() {
        return(this.Content ?? "");
    }
    

    /**
     * check if the page is valid and all input elements are filled correctly.
     * Respects only the visible input elements !
     * 
     * @param {*} pView 
     * @returns true == all inputs/settings are valid and can be processed
     */
    isPageValid(pView) {
        let bIsValid = true;
        pView = CView.asInstance(pView);
        pView.gelAll("input").forEach((e) => {
            if(e.isVisible()){
                if(!e.isValid()) {
                    bIsValid = false; 
                }
            }
        });
        return(bIsValid);
    }

    isModified(pView, bAllElements) {
        let bIsModified = false;
        pView = CView.asInstance(pView);
        pView.gelAll(["data-act-cfg"]).forEach(e => {
            if(bAllElements || e.isVisible()) {
                if(e.getValue() != e.data("actCfg")) bIsModified = true;
            }
        })
        return(bIsModified);
    }

    /**
     * load all config data into the Page.
     * The page is already inside the View, all expansion and translations are done,
     * Now load the user data from the config object into the elements.
     * Override this function in specialized PageHandlers.
     * @param {CView} pView 
     * @param {*} pApp 
     * @returns the used config for this page to be re-used by derivited objects 
     */
    loadPageConfig(pView, pApp) {
        let strConfigName = pView.data("cfg");
        if(strConfigName) this.setConfigName(strConfigName);
        let oCfg = this.getConfig(false);
        this.setConfigValues(pView,oCfg);
        
        return(oCfg);
    }

    /**
     * Set the values from a config object into the elements of the page/view.
     * As it should be possible to set mulitple config areas into the gui, a prefix can be used.
     * The module iterates all properties in the config object and searches for elements 
     * with the data attribute "cfg", the id or with the "@name" matching the config name.
     * The prefix will be used to build the final config name to search for...
     * 
     * To set wifi property for "wifi_<name>", set the data-cfg attribute to "wifi_<name>",
     * or set the id to "wifi_<name>".
     * 
     * @param {CView} pView                         This is the active page (content) to operate on... (mandatory)
     * @param {object} oCfg                         The native config object (mandatory)
     * @param {string | undefined} strPrefixName    If specified, this is the prefix with "_" that will be used.
    */
    setConfigValues(pView, oCfg, strPrefixName) {
        if(pView && Utils.isObj(oCfg)) {
            strPrefixName = strPrefixName ? strPrefixName + "_": "" ;
            for(let strPropName in oCfg) {
                let strSearch = strPrefixName + strPropName;
                [
                    `[data-cfg = "${strSearch}"]`,
                    `[id = "${strSearch}"]:not([data-cfg])`,
                    `[name = "${strSearch}"]:not([data-cfg]):not(id)`
                ].forEach(strSearch => {
                     pView.gelAll(strSearch).forEach((e) => {
                        e.setValue(oCfg[strPropName]);
                        e.data("curVal", oCfg[strPropName]);
                    });
                })
            }
        }
    }


    /**
     * updateView, set visible elements by checking the
     * data-viewon... and data-hideon... attributes.
     * If data-viewon is set, the values inside must evaluate to true.
     * Each element inside is the config name with the expected value.
     * @param {CView} pView 
     * @param {*} pApp 
     */
    updateView(pView, pApp) {
        if(pView) {
            pView.selAll("[data-viewon]").forEach((e) => {
                let bView = this._getViewCondition(e.dataset.viewon,pView,pApp)
                e.style.display = bView ? "" : "none";
            });
        }
        pView.enableAll(".saveBtn",this.isPageValid(pView));
    }

    
    /**
     * Get the vie condition for a condition string.
     * The conditions string are setting conditions in the view, that has to be fulfilled.
     * like "enabled=1". If more than one condition is nedede, sperate them by a ';' or a ','.
     * If multiple condition combinations are needed, and one of them should resolve to true,
     * speratae them by an '|' character....
     * Example: "enabled=1;visible=1 | enabled=0;visible=0"
     * @param {*} strFullCond 
     * @param {*} pView 
     * @param {*} pApp 
     * @returns 
     */
    _getViewCondition(strFullCond,pView,pApp) {
        let strOrResult = "";
        let bResult = false;
        let oThis = this;
        if(strFullCond) {
            // conditions are OR conditions, seperated by '|'
            strFullCond.split("|").forEach((s) => {
                // Process the first part of the or condition
                let strAndResult = "";
                s.split(/,|;/).map((c) => c.trim()).forEach((c) => {
                    let tCond = c.split("=").map((v) => v.trim());
                    if(tCond.length == 2) {
                        // Now we have the key value pair....
                        let strConfigKey = tCond[0];
                        let strValue = tCond[1];
                        let strQuery = "input, select";
                        pView.selAll(strQuery).forEach((e) => {
                            let strElementName = e.dataset.cfg || e.id || e.name;
                            if(strElementName == strConfigKey) {

                                let oValue = CElement.asInstance(e).getValue(false);
                                if(oValue != undefined) {
                                    strAndResult += oValue == strValue ? "1" : "0";
                                } 
                            }
                        })
                    }
                });
                // If all conditions result into true, append a "1" to the result string, otherwise "0".
                strOrResult += strAndResult.indexOf("0") == -1 ? "1" : "0";
            })
            // In the OR condtion, at least one "1" has to be in the result string.
            bResult = strOrResult.indexOf("1") == -1 ? false : true;
        } else {
            // If no condition is set, the result is also true.
            bResult = true;
        }
        return(bResult);
    }


    savePage(pView) {
        let oCfg = this.getConfig(true);
        this.saveConfigValues(pView, oCfg);
    }
    // #endregion

    // #region Config set values / save values functions
    
    

   
    

    /**
     * Default save config values function
     * scans all input elements and stores them into the config object
     * search order:
     * 1. data-cfg  attribute of the element
     * 2. id attribute of the element
     * 3. name attribute of the element
     *  
     * @param {CView} pView 
     * @param {object} oCfg 
     * @param {string} strPrefixName 
     */
    saveConfigValues(pView,oCfg,strPrefixName) {
        if(pView && Utils.isObj(oCfg)) {
            strPrefixName = strPrefixName ? strPrefixName + "_": "" ;
            // let oArea = pView.getArea(); // this is the HTML Element
            let oSelf = this;
            // Search trough all known element types...
            [
                'input'
                ,'select'
            ].forEach(strSearch => {
                pView.gelAll(strSearch).forEach((e) => {
                    if(e.isVisible()) {
                        oSelf.saveElementToConfig(e.getBase(),oCfg,strPrefixName);
                    }
                });
            })
            
        }
    }

    /**
     * Save a single element to the config object
     * The value of the element (HTML) will be stored in the config
     * by using the property name, detected by the element structure.
     * The final property name will be calculated, by extracting the prefix.
     * 
     * - data-cfg   if, set this property name will be used
     * - id         otherwise if id is in place, use this as property name
     * - name       or it has a name attribute (radioButton) - the name will be used.
     * @param {*} oElement      // Element to be saved (mandatory)
     * @param {*} oCfg          // Config object to store the value (mandatory)
     * @param {*} strPrefixName // Prefix to be extracted from the property.
     */
    saveElementToConfig(oElement,oCfg,strPrefixName) {
        if(Utils.isElement(oElement) && Utils.isObj(oCfg)) {
            if(!strPrefixName) strPrefixName = "";
            // If either data-cfg, or id or the name attribute is set...
            let strProp =   oElement.dataset.cfg ? oElement.dataset.cfg :
                            oElement.id ? oElement.id :
                            oElement.getAttribute("name");
            if(strProp && strProp.length > strPrefixName.length) {
                // Property to set is the found prop without prefix...
                strProp = strProp.substring(strPrefixName.length);
                let strVal = CElement.asInstance(oElement).getValue();//  this.getValue(oElement);
                // If the value is defined, set the value.
                // this is necessary, cause radio buttonns can be unchecked and will return undefined.
                if(!(strVal === undefined)) oCfg[strProp] = strVal;
                
            }
        }
    }

    // #endregion

    // #region Events and Messages (clicks, websocket messages, etc...)

    /**
     * Default "on" handler for input/select/radio elements
     * override this function in the specialized page handlers.
     * @param {*} pView 
     * @param {*} oElement 
     */
    on(pView,oElement) {
        
    }
    /**
     * If a checkbox is clicked, adjust the view
     * @param {*} pView 
     * @param {*} oElement 
     */
    onCheckboxClick(pView,oElement) {
        this.updateView(pView,oElement);
    }

    /**
     * If a radio button is clicked, adjust the view
     * @param {*} pView 
     * @param {*} oElement 
     */
    onRadioClick(pView,oElement,str) {
        this.updateView(pView,oElement);
    }
    
    /**
     * Default funktion to close a dialog.
     * The element has to be inside the dialog, so it finds 
     * the dialog by searching the parent path...
     * @param {*} pView will not be used here, but is sent by the "on" function of the page handler
     * @param {*} oElement Element (Cancel Button?) as start point to search the parent dialog.
     */
    closeDialog(pView,oElement) {
        CDialog.close(oElement);
    }
    // #endregion

}

// #endregion

// #region Dialog classes

/**
 * The base Dialog class.
 * get's an id, with the HTML description of the dialog,
 * and options how to handle the dialog.
 * options: {
 *      title: <the title of the dialog> (opt)
 *      body: <the body of the dialog> (opt)
 *      cancelBtn: <Text of the cancel button> (opt)
 *      okBtn: <Text of the ok button> (opt)
 *      onOK: <callback function for OK Button>
 *      onFinished: <callback - when process/time is finished>
 * }
 * 
 * 
 */
class CDialog extends CElement {

    constructor(eID, oOptions) {
        super(eID);
        this._Options = oOptions ?? {};
    }

    /**
     * show the dialog in modal mode
     * Options are inserted in the HTML and it will be translated
     *
     * @param {*} oOptions 
     */
    showModal(oOptions) {
        let oData = {...this._Options, ...oOptions};
        let oTitle = this.gel(".modal-title",this.Dialog);
        let oBody = this.gel(".dialogBody",this.Dialog);
        let oPriBtn = this.gel(".btn-primary",this.Dialog);
        let oSecBtn = this.gel(".btn-secondary",this.Dialog);

        oTitle.setText(oData.title);
        oBody.setText(oData.body);
        if(oSecBtn.hasBase()) {
            let strC = oData.cancelBtn;
            oSecBtn.show(strC ? true : false);
            oSecBtn.setValue(Utils.isString(strC) ? strC : "i18n:main.cancel");
        }
        if(oPriBtn.hasBase()) {
            oPriBtn.setValue(oData.okBtn ?? "i18n:main.ok");
            if(!oData.keepOpen) {
                oPriBtn.on("click", oData.onOK ?? this.close.bind(this));
            }
        }
        let oTranse = new CTranslator();
        oTranse.translate(this.getBase())
            .then( (e) => {
                let oDlg = this.getBase();
                // remove the blur effect...
                oDlg.addEventListener("close", (e) => {
                    document.body.classList.remove("modal-open");
                });
                oDlg.showModal();
            });
        // add the blur effect to the background...
        document.body.classList.add("modal-open")
    } 

    /**
     * close the dialog,
     * search the dialog frame to be closed, based on the event/element.
     * @param {*} oOE either the event from the event listener, or an html element like the close button.
     */
    close(oOE) {
        if(!oOE) oOE = this;
        CDialog.close(oOE);
    }

    static close(oOE) {
        if(oOE) {
            let oElement = oOE;
            if(Utils.isInstanceOf(oOE,"CElement")) oElement = oElement.getBase();
            else if(!Utils.isElement(oElement)) oElement = oOE.currentTarget;
            while(oElement) {
                if(Utils.isFunction(oElement.close)) {
                    oElement.close();
                    break;
                }
                oElement = oElement.parentElement;
            }
        }
    }
}

/**
 * displays an Alert message...
 */
class CAlertDialog extends CDialog {
    constructor(oOptions) {
        super("#alertDialog",oOptions);
    }

    showModal(oOptions) {
        let oBody = this.gel(".dialogBody").ac("text-center");
        super.showModal(oOptions);
    }
}

class CWaitDialog extends CDialog {
    constructor(oOptions) {
        super("#waitDialog",oOptions);
    }

    showModal(oOptions) {
        super.showModal(oOptions);
        let oSelf = this;
        let oData = {...this._Options, ...oOptions};
        let nCurStatus = 1;
        let oBar = this.sel(".progressBar");
        let oStatus = this.sel(".progressStatus");
        oStatus.style.width = nCurStatus + "%";
        let nTickTimer = 100;       // every 100 ms...
        let nTotalSecs = oData.timeOutSecs ?? 10;    // runtime (default 10secs)

        let nStepWidth = (100 / nTotalSecs) / (1000 / nTickTimer);
        this.getBase().showModal();
        this._ActTimerID = setInterval(() => {
            nCurStatus = nCurStatus + nStepWidth;
            if(nCurStatus >= 100) {
                clearInterval(this._ActTimerID);
                oSelf.close(oStatus);
                if(Utils.isFunction(oData.onFinished)) oData.onFinished();
            }
            else oStatus.style.width = nCurStatus + "%";   
        },nTickTimer);
    }
}

class CSigninDialog extends CDialog {
    constructor(oOptions) {
        super("#signinDialog",oOptions);
        this._oForm = this.gel("form");
        this._oForm.reset();
        this._oForm.on("submit",this.onSubmit.bind(this));
        this._Options.keepOpen = true;
        this._oPasswd = this.gel("[name='password']");
        this._oPasswd.setValue("");
        // this._oPasswd.on("keyup",this.validate.bind(this));
        
        super.gelAll("[type='submit']").forEach(e => {
                e.reset(); // remove the registerd handlers...
            })
       
    }
    /*
    validate() {
        this.selAll("[type='submit']").forEach(e => {
            e.disabled = !this._oPasswd.isValid();
        })
    }
    */

    onSubmit(oEvt) {
        oEvt.preventDefault();
        if(Utils.isFunction(this._Options.onFinished)) {
            this._Options.onFinished(this._oPasswd.getValue(),this);
        }
    }
}

// #endregion

// #region Websocket class

class CWebSocketV2 {
    static WS_OPEN = "open";
    static WS_CLOSE = "close";
    _bDesiredOpen = true;
    _oWebSocket = null;                // The Websocket object
    _isConnectionAvailable = false;    // Is the connection activ and available ?
    _nReConTimer = 0;           // Avoids multiple timers to be in place...
    _gotInitialData = false;           // Did we already received the initial data ?
    
    Log = new CLog();
    _callBacks;
    /* = {
        onStatusChanged,
        onMessage
    };*/  

    /**
     * creates a new Socket with options
     * @param {object} oCallBacks 
     * @param {object} oOptions 
     */
    constructor( oCallBacks, oOptions) {
        this.Options = oOptions ?? {}
        this._callBacks = oCallBacks ?? {};
    }

   
    /**
     * Connection uri depends on the call of the webpage.
     * either via http, https or via file...
     * so find the correct url to the socket.
     * Default Socketname is "/ws" or set in Options with "socketName".
     * @returns the correct uri for the socket
     */
    _getConnectionUri() {
        // Prepare the websocket URI
        let strSocketName = this.Options.socketName ?? "ws";
        let strHostName = window.location.hostname;
        let wsUri = `ws://${strHostName}/${strSocketName}`;
        if (window.location.protocol === "https:") {
            wsUri = `wss://${strHostName}:${window.location.port}/${strSocketName}`;
        } else if (window.location.protocol === "file:" ||
            ["0.0.0.0", "localhost", "127.0.0.1"].includes(window.location.hostname)) {
            wsUri = `ws://localhost:8080/${strSocketName}`;
        }         
        return(wsUri);      
    }

    // #region Status and Message Event handler

    /**
     * send the status about the socket to the callback if in place
     * @param {*} nStatus 
     */
    _onStatusChanged(nStatus) {
        this.Log.logTrace("WS: Status changed : " + nStatus);
        if(this._callBacks.onStatusChanged) this._callBacks.onStatusChanged(nStatus,this);
    }

    _onMsgReceived(oMsg) {
        this.Log.logTrace("WS: Message received...");
        this.Log.logTrace(oMsg);
        if(this._callBacks.onMessage) this._callBacks.onMessage(oMsg,this);
    }

    // #endregion

    // #region open, close and monitor the connection

    _openSocket() {
        if(!this._isConnectionAvailable) {    
            this.Log.logVerbose("WS: creating WebSocket");
            this._oWebSocket = new WebSocket(this._getConnectionUri());
            let oSelf = this;
            // Register the handler....
            this._oWebSocket.addEventListener("message", function(oMsg) {
                oSelf._onMsgReceived(oMsg,this);
            });
            this._oWebSocket.onopen  = function(evt) { 
                oSelf._isConnectionAvailable = true;
                oSelf.Log.logVerbose("WS: connection opened");
                oSelf._onStatusChanged(oSelf.constructor.WS_OPEN);
                EC("#statusInfo").fadeOut();
            };
            // onclose will be called on close and if it cannot be opened...
            this._oWebSocket.onclose = function(evt) { 
                oSelf.Log.logVerbose("WS: connection closed");
                oSelf._isConnectionAvailable = false;
                oSelf._onStatusChanged(oSelf.constructor.WS_CLOSE);
                EC("#statusInfo").fadeIn();   
            };

            // Setup the reconnection timer (if needed...)
            // calls this function again, if connection got lost...  
        }
    }

     /**
     * monitor the connection and reconnect, if the session stops unexpected
     * is called on a regular base, when a connect comes in place...
     */
    _monCon() {
        let oSelf = this;
        if(oSelf._bDesiredOpen && !oSelf._isConnectionAvailable) {
            oSelf._openSocket();
        }
    }

    /**
     * Open the WebSocket Connection and establishes the handlers
     * @returns 
     */
    connect(bRecon) {
        this._bDesiredOpen = true;
        this._openSocket();
        // Monitor the connection ...

        if(bRecon && !this.oMonTimeID) this.oMonTimerID = setInterval(this._monCon.bind(this),5000);
    }

    /**
     * close the socket...
     * the only valid way to stop the socket,
     * otherwise the reconnect will try to reopen again...
     */
    close() {
        this._bDesiredOpen = false;
        // stop the monitor timer, if it is in place...
        if(this.oMonTimeID) {
            clearInterval(this.oMonTimeID);
            this.oMonTimeID = undefined;
        }
        if(this._oWebSocket) this._oWebSocket.close();
    }

    // #endregion


    /**
     * Send a message via the websocket...
     * This is the only function, that access the websock to send.
     * @param {*} oMsg 
    */
    send(oMsg) {
        this.Log.logVerbose("WS: Sending socket message:");
        this.Log.logVerbose(oMsg);
        if(this._oWebSocket && this._isConnectionAvailable) this._oWebSocket.send(oMsg);
    }
}

// #endregion

// #region MenuBar / SideBar classes

/**
 * A Menu Bar - Based on CElement
 * - can use all CElement operations on this "Container"
 */
class CMenuBar extends CElement {
    _Settings;      // CAppSettings object;
    _oCallBacks;    // Callback object with functions inside
    Log = new CLog();

    /**
     * 
     * @param {string} selBar The select to the ID of the menubar
     * @param {*} oSettings CAppSettings or object with application settings
     */
    constructor(selBar = "#menubar", oSettings) {
        super(selBar)
        this._oMenu    =  new CElement(selBar + " ul");
        this._Settings = CAppSettings.asInstance(oSettings);
    }

    /**
     * Initialize the Sidebar
     * @param {CAppSettings} oSettings  Settings of the application with (basic) menu structure
     * @param {object}  oCallBacks Callback functions
     * @param {CVarTable} tVars Needed to create elements by CTemplates 
     */
    init(oSettings,oCallBacks = {} ,tVars) {
        this.Templates = new CTemplates(oSettings,tVars)
        this.addMenuEntries(oSettings);
        this._oCallBacks = oCallBacks;
        // register the UAC classes to this object
        this.gelAll(".UAC li").forEach(e => {
            e.on("click",this.onUAC.bind(this));
        })
    }

    /** are all needed objects in place? */
    isValid() {
        return this._oMenu !== null;
    }

    /**
     * Callback the registered functions by name...
     * @param {*} strName Name of the requested action like "onClicked"
     * @param {*} oData   Data to be sent
     */
    _callBack(strName,oData) {
        this.Log.logTrace(`MB: callBack(${strName})`);
        if(this._oCallBacks && this._oCallBacks.hasOwnProperty(strName)) 
        {
            let funcCall = this._oCallBacks[strName];
            if(Utils.isFunction(funcCall)) funcCall(strName,oData,this);
        }
    }

    onClicked(oEvent) {
       this._callBack("onClicked",oEvent);
    }

    onUAC(oEvent) {
        let oElement = EC(oEvent.currentTarget).gel("button");
        let strCall = "on" + oElement.data("on");
        this._callBack(strCall);
    }

    /**
     * registered event handler...
     * @param {*} oEvent 
     */
    onToggleSubMenu(oEvent) {
        let oSubMenu = oEvent.currentTarget;
        if(!oSubMenu.nextElementSibling.classList.contains('show')) {
            this.closeAllSubMenus();
        }
        oSubMenu.nextElementSibling.classList.toggle('show');
        oSubMenu.classList.toggle('rotate');
        this._callBack("onToggleMenu",oEvent);
    }

    closeAllSubMenus() {
        Array.from(this.getBase().getElementsByClassName('show')).forEach(ul => {
            ul.classList.remove('show');
            ul.previousElementSibling.classList.remove('rotate');    
        })
    }

     /**
     * add all menu entries from a given menu definition to the sidebar.
     * @param {object} oMenuDefs Menudefinitions
     * @param {CElement} pParent   Parent Menu entry (default is the menubar)
     */
    addMenuEntries(oMenuDefs, pParent) {
        if (!pParent) { pParent = this._oMenu; }
        for (const oM of oMenuDefs.menu) {
            this.addMenuEntry(oMenuDefs, oM, pParent);
        }
        
        
        // Register the toggle submenu action in the dropdown buttons, if on click is not set !
        for(let oDropDown of this.selAll(".dropdown-btn")) {
            if(!oDropDown.hasAttribute("onclick")) {
                oDropDown.addEventListener("click", this.onToggleSubMenu.bind(this));
            }
        }
    }

    /**
     * Add a single menu entry to the sidebar.
     * @param {object}   oSettings // The settings object - also containing defaults and icons
     * @param {object}   oMenuDef  // The menu definiton object to process
     * @param {CElement|null|undefined} pParent   // null or the parent element to append the new entry.
     */
    addMenuEntry(oSettings, oMenuDef, pParent) {
        const oLI = this.ce("li");
        oLI.setAttributes(oMenuDef.attr);
        // Keep the payload info for the handler when clicked...
        if(oMenuDef.payload) oLI.data("payload",oMenuDef.payload);
        const oIconDef = this.Templates.findIconDef(oMenuDef.icon ?? oMenuDef.name);
        if (oMenuDef.hasOwnProperty("menu")) {
            const oButton = oLI.cce("button");
            oButton.ac("dropdown-btn");
            if (oIconDef) {
                oButton.append(this.Templates.createIcon(oIconDef));
            }
            const oSpan = oButton.cce("span");
            this.setText(oSpan,oMenuDef.name, oMenuDef.title);
            let oSub = oLI.cce("ul");
            let oSubMenu = oSub.cce("div");
            oSub.ac("sub-menu");
            for (const oM of oMenuDef.menu) {
                this.addMenuEntry(oSettings, oM, oSubMenu);
            }
        }
        else {
            // Create the click link and bind the onClicked to this instance...
            // Also set the id of the link to the name of the menu entry.
            const a = this.ce("a");
            a.getBase().addEventListener("click",this.onClicked.bind(this));
            a.id(oMenuDef.name);
            if (oIconDef) {
                let oParent = CElement.asNative(pParent)
                let bIsSub = (oParent && oParent.parentNode && oParent.parentNode.classList.contains("sub-menu"));
                let oIcon = bIsSub ? this.Templates.createIcon(oIconDef,"Sub"): this.Templates.createIcon(oIconDef);
                a.append(oIcon);
            }
            const span = this.ce("span");
            this.setText(span, oMenuDef.name, oMenuDef.title);
            a.append(span);
            oLI.append(a);
        }
        pParent?.append(oLI);
    }

     /**
     * set the text of an element, by inserting a i18n info also by the name as id 
     * @param {*} oE        // The element to operate on
     * @param {*} strName   // The (unique) name of the element, used for i18n
     * @param {*} strTitle  // if set, the text to be displayed, otherwise the name is used
     * @returns the element for further processing.
     */
    setText(oE, strName, strTitle = "") {
        if (oE) {
            oE = CElement.asNative(oE);
            let str = strTitle || strName;
            oE.textContent = str;
            oE.dataset.i18n = "menu." + strName;
        }
        return oE;
    }

     /**
     * Set this entry as the active entry in the menu
     * @param {*} oMenuEntry 
     */
    setAsActiveEntry(oMenuEntry) {
        for (let oMenu of this.gelAll(".active")) {
            oMenu.rc("active");
        }
        if (oMenuEntry) {
            let oME = EC(oMenuEntry);
            oME.ac("active");

            let oDD = oME.parent().parent();
            if(oDD.hasClass("sub-menu")) {
                oDD.parent().gelAll(".dropdown-btn").forEach(e => e.ac("active"))
            }
        }
        
    }

}

class CSideBar extends CMenuBar {
    constructor(selBar = "#sidebar", oSettings) {
        super(selBar,oSettings)
    }

    init(oSettings,oCallBacks = {} ,tVars) {
        super.init(oSettings,oCallBacks,tVars);
        try {
            this.gel("#sidebarHide").on("click",this.hide.bind(this))
            EC(document.body).gel("#sidebarShow").on("click",this.show.bind(this));
        } catch {}
    }

    show() { this.ac("show");}
    hide() { this.rc("show") }
}

// #endregion

// #region CAppl / IAppl

/**
 * Appliction class with websocket and sidebar menu.
 * override if needed
 */
class CAppl {
        /**
     * Default settings to create elements
     * (override in constructor)
     */
    _oDefaults = {
        sys : {
            timer: {
                fwInst: 5,
                restart: 10,
            }
        },
        "save" : {
            "cell": {
                "classes": "col-xs-12 col-md-12",
            },
            "btn": {
                "classes": "btn btn-primary btn-sm pull-right save-btn",
                "attr": {
                }
            }
        },
        "icons" : {
            "svg": {
                "height": "18px",
                "width": "18px",
                "viewBox": "0 0 16 16",
            },
            "svgSub": {
                "height": "16px",
                "width": "16px",
            }
        }
    }
    _tPageHandler = [];        // List of known page handlers
    MainView;                  // CView - The Activ main view instance.
    _pCurHandler;              // Current active page handler.
    _pMPH;                     // Main Page Handler to handle requests to the main content...
    Log = new CLog();
    // MenuBar = new CSidebar();
    MenuBar = new CSideBar();


    // public objects...
    Vars = new CVarTable();
    Translator = new CTranslator();
    Config = new CConfig();
    DeviceStatus = {};
    WS;// = new CWebSocket(this);

    constructor() {
        this.Security = new CSecurity(this);
        this.WS = new CWebSocketV2({
            onMessage: this.onSocketMessage.bind(this),
            onStatusChanged: this.onSocketStatus.bind(this)
        })
    }   

    init(oSettings) {
        this.Settings = new CAppSettings({...this._oDefaults,...oSettings});
        this.MainView = new CView("#mainContent",this.Settings);
        this.Vars.setDefaults();    // Default var definitions
        this.Vars.setPageVars();    // All VarTable elements from the current html page
        this.Vars.setVars(this.Settings.getSection("app")); // and the application specifc settings.
        this.requestActDeviceStatus();
        // Prepare the translator and load the languages...
        // - initialize the menubar
        // - prepare the current html page
        this.Translator.preload()
            .then(t => {   
                this.MenuBar.init(oSettings, { 
                    "onClicked": this.onMenuClicked.bind(this),
                    "onSignin" : this.signin.bind(this),
                    "onSignout": this.signout.bind(this)
                });
                            
                let bRecon =  Utils.isTrueValue(this.Settings.getData("app.ws.recon","1"))
                this.WS.connect(bRecon);
                
                // Now register all well known pages... if defined by framework build
                if(typeof registerPageHandler === 'function') registerPageHandler(this);
                this.requestActStatus()
                .then(pApp => {
                    this.prepareContainer(document.body);
                    let strTitle = this.Settings.getData("app.prog_name","LSC");
                    document.title = strTitle;
                    // Select the Default Page from Application Settings...
                    let strHomePage = this.Settings.getData("DefaultPage") ?? "HomePage";
                    this.updateAuthModeView(this.isAuth());
                    this.loadPage(strHomePage);
                })
                
            })
    }


    // #region Views and operations on containers...
    
    /**
     * If a new page comes in place, prepare the content so it can be used.
     * - create and replace Elements if needed,
     * - create Wellknown functions and handler
     * - translate the page into user language..
     * @param {HTMLElement|CView} oContainer 
     */
    prepareContainer(oContainer) {
        let oPageVars = new CVarTable();
        // If it is a CView, all operations are done by the CView.loadView() 
        // Otherwise process, if the container is a simple HTMLElement.
        if(Utils.isInstanceOf(oContainer,"CView")) {
            oPageVars = oContainer.LocalVars;
        } else {
            oPageVars.setVars(this.Vars);
            oPageVars.setPageVars(oContainer,"LocalVars");
            let oTemplates = new CTemplates(this.Settings,oPageVars);
            oTemplates.createElements(oContainer,this);
            oTemplates.createIcons(oContainer);
        }

        // Register the actions, translate and update Auth Mode View
        this.createKnownActions(oContainer);
        this.translateContainer(oContainer,oPageVars);
        this.Security.updateAuthModeView(oContainer);
    }

    translateContainer(oContainer, oVarTable) {
        let oPageVars = oVarTable;
        if(!oPageVars) {
            oPageVars = new CVarTable();
            oPageVars.setVars(this.Vars);
            oPageVars.setPageVars(oContainer,"LocalVarTable");
        }
        this.Translator.translate(oContainer,undefined,oPageVars);
    }

    createKnownActions(oContainer) {
        let oThis = this;
        // Insert the dismiss dialog function...
        EC(oContainer).gelAll("[data-dismiss = 'modal']:not([onclick])",oContainer).forEach((e) => {
            e.on("click",oThis.onEvent.bind(oThis),"closeDialog");
        })
    }

    /**
     * register a page handler for a specific page ID.
     * This handler will process the page behaviour...
     * If you have your own handler, use CPageHandler class a parent class,
     * so most functions can be processed by default.
     * @param {*} strPageID 
     * @param {*} oContent string or HTMLElement as content
     * @param {*} oMenuDef menudefinition as json object or null.
     */
   
    registerPageHandler(strPageID, oPH) {
        if(strPageID && oPH) {
            this._tPageHandler[strPageID] = oPH;
        }
    }

    /**
     * Get a handler for a page. Either create, or return the existing one.
     * When creating the pagehandler, a config section will also be detected / created.
     * The config section is either the 2nd parameter, or will be detected:
     * - if data-cfg is in place, we use this name
     * - otherwise it is the page id without the trailing "Page" in lowercase.
     * @param {*} strPageID 
     * @returns 
     */
    getPageHandler(strPageID) {
        let oPH = this._tPageHandler[strPageID];
        let PageContainer = new CElement("#PageContainer");
        if(!oPH) {
            let oPage = PageContainer.selById(strPageID);
            oPH = new CPageHandler(strPageID,oPage,this.Config);
            this._tPageHandler[strPageID] = oPH;
        }
        return(oPH);
    }

    /**
     * Load the Page into the activ area
     * The page is the id of the section like "Status" + the name "Page"
     * The webpart id to search is id="StatusPage"
     * 
     * @param {string|HTMLElement} soel     // (String Or Element) String (with id) or Menu Element with id of page...
     */
    loadPage(soel) {
        if(soel) {
            let strPageID = "-null-";
            let oMenuElement;
            
            if(typeof soel === 'string') {
                oMenuElement = document.getElementById(soel);
                // If the oMenuElement is a string, try to find the menu entry, so it can be enabled.
                // set the config section to the given name in lowercase
                strPageID = soel.endsWith("Page") ? soel : soel + "Page";
                // soel = this.MenuBar.oSB.querySelector("#" + soel);
                soel = this.MenuBar.selById(soel);
            } else {
                // If it is an HTMLElement, 
                // if the parent has an attribute "containerid" - load this element
                // otherwise use the id of the menu and enhance with "Page"
                // The config section name is the element "data-cfg-section", or the id of the element in lowercase.
                oMenuElement = soel.parentElement;
                let strID = oMenuElement.getAttribute("pageid") ?? soel.id ?? "";
                strPageID = strID.endsWith("Page") ? strID : strID + "Page";
            }
            // Inform the current page handler, that we leave the page...
            this._callPageHandler("disposePage",this);
            // Create a page handler and get the matching config section...
            let oPH = this.getPageHandler(strPageID);          
            this.MainView.Payload(oMenuElement.dataset.payload)
            if(this.MainView.loadView(strPageID,oPH.getContent(),this.Vars,this)) {
                // soel is definitly an HTMLElement.
                let strMenuID = soel.id;
                this.prepareContainer(this.MainView.getArea());
                // Inform the world, that the page is loaded by menu click with attribute data-menu-id.
                if(strMenuID) this.MainView.data("menuId",strMenuID);
                // Also set the data-cfg attribute if not already in place, so the default handler
                // can load the page already without further operations by specialized handlers.
                // - first, if the menu entry has a data-cfg - this will go in place...
                // - if not, the menu id will be the config name...
                if(oMenuElement.dataset.cfg) this.MainView.data("cfg",oMenuElement.dataset.cfg);
                // if(!this.MainView.data("cfg")) this.MainView.data("cfg",strMenuID);
                this._pCurHandler = oPH;

                // As loadPageConfig can happen multiple times - async, give the handler a chance to prepare the page first...
                this._callPageHandler("preparePage",    this);
                this._callPageHandler("loadPageConfig", this);
                this._callPageHandler("updateView",this);
                
                // If the Pagehandler has additional load logic, call this also.
                // oPH.loadPageConfig(this.MainView,this);
                // activate the selected menu..
                this.MenuBar.setAsActiveEntry(oMenuElement);
            }
        }
    }

    refreshContentPage() {
        if(this._pCurHandler) this._pCurHandler.loadPageConfig(this.MainView,this);
    }


    /**
     * Workhorse to call a page handler
     * If the function exists in a page handler (Default class or derived instances )
     * @param {*} strFuncName function to be called (if it exists in the page handler)
     * @param {*} oElement  HTMLElement to operate on
     */
    _callPageHandler(strFuncName,oElement,oPayload) {
        let oResult = null;
        if(this._pCurHandler) {
            let pFunc = this._pCurHandler[strFuncName];
            if(typeof pFunc === 'function') {
                this.Log.logTrace(`-calling: ${Utils.getInstanceName(this._pCurHandler)}.${strFuncName}(...)`);
                oResult = this._pCurHandler[strFuncName](this.MainView,oElement,oPayload);
            }
        } else {
            this.Log.logTrace(` - no function handler ${strFuncName} found in page handler !`);
        }
        return(oResult);
    }

    /**
     * check if the page is valid - all input elements are filled correctly.
     * Use the default html logic to handle - and, if a PageHandler is in place,
     * ask the Handler also...
     */
    isPageValid() {
        let bIsValid = true;
        // Ask the page handler, if in place... 
        if(this._pCurHandler) bIsValid = this._pCurHandler.isPageValid(this.MainView.getArea());
        return(bIsValid);
    }


    // #endregion

    // #region Handle the config changes.. (showPending / review / commit)
    
    /** */
    showChangePending(bShow = true) {
        let oChangePending = EC("#changePending");
        let oFooterInfo    = EC("#footerInfo");
        let oShowElement = bShow ? oChangePending : oFooterInfo;
        let oHideElement = bShow ? oFooterInfo : oChangePending;

        oChangePending.on("click",this.reviewChanges.bind(this),"reviewChanges");
        if(oShowElement && oHideElement) {
            let oParent = oChangePending.parent();
            if(bShow) oParent.ac("changePending");
            else      oParent.rc("changePending");
            oHideElement.hide();
            oShowElement.fadeIn(1000);
            // this.fadeIn(oShowElement,1000);
        }
        
    }

    /**
     * show the review changes dialog...
     */
    reviewChanges() {
        let oData = "";
        try {
            oData = this.Config.getSerialized();
            let oOptions = {
                "title": "i18n:save.review",
                "okBtn": "i18n:save.ok",
                "cancelBtn": true,
                "onOK" : this.commitChanges.bind(this)
            }
            let oReviewDialog = new CDialog("#reviewDialog",oOptions);
            oReviewDialog.gel("#reviewData").html(oData);
            oReviewDialog.showModal();
        } catch (ex) {
            alert(ex);
        }
    }

    /**
     * commit the changes to make it persistent...
     * @param {*} oSender 
     */
    commitChanges(oSender) {
        CDialog.close(oSender);
        this.sendSocketCommand(DEFAULTS.SAVE_CONFIG_COMMAND,"",this.Config.getConfig());
        this._bChangePending = false;
        this.showChangePending(false)
        let oDlg = new CWaitDialog({ 
                title: "i18n:dialog.save.title",
                body: "i18n:dialog.save.waitmsg",
                onFinished: function() { location.href = location.href; }
            });
        oDlg.showModal();
        this.restartDevice();
    }

    // #endregion

    // #region calls to admin the device
    restartDevice() {
        this.sendSocketCommand(DEFAULTS.RESTART_COMMAND);
    }

    /**
     * Factory reset....
     */
    resetDevice() {
        this.sendSocketCommand(DEFAULTS.FACTORY_RESET_COMMAND);
    }

    async requestActDeviceStatus() {
        // this.sendSocketCommand(DEFAULTS.GET_STATUS_COMMAND);
        let oSelf = this;
        fetch(`apiV1/sysstatus`)
            .then((oResponse) => {
                return oResponse.json();
            })
            .then((oStatus) => {
                this.setNewSysStatus(oStatus);
                return(oSelf)
            })
            .catch((error) => {
                this.Log.logError("Error fetching status: " + error);
            });
    }

    async requestActStatus() {
        let oSelf = this;
        // this.sendSocketCommand(DEFAULTS.GET_STATUS_COMMAND);
        fetch(`apiV1/status`)
            .then((oResponse) => {
                return oResponse.json();
            })
            .then((oStatus) => {
                this.setNewStatus(oStatus);
                return(oSelf);
            })
            .catch((error) => {
                this.Log.logError("Error fetching status: " + error);
            });
    }

    setNewSysStatus(oStatusObj) {
        if(Utils.isObj(oStatusObj)) {
            this.DeviceStatus = {...this.DeviceStatus,...oStatusObj};
        }
    }

    setNewStatus(oStatusObj) {
        if(Utils.isObj(oStatusObj)) {
            this.setNewSysStatus(oStatusObj);
            if(this.DeviceStatus.DebugMode) this.Log.setDebug(this.DeviceStatus.DebugMode);

            // Update the vars from the status, in special the prog name, version and the debug mode.
            this.Vars.setVar("prog_name",this.DeviceStatus.prog_name);
            this.Vars.setVar("prog_ver",this.DeviceStatus.prog_version);
            this.Vars.setVar("DebugMode", Utils.isTrueValue(this.DeviceStatus.DebugMode) ? "1" : "0");
            this._callPageHandler("onUpdateStatusReceived",this,oStatusObj);
        }
    }

    // #endregion
 
    // #region Callbacks and GUI Event Handler

    savePage() {
        this.on("savePage");
        if(!this._bChangePending) this.showChangePending(true);
        this._bChangePending = true;
        
    }

    /**
     * a menu entry has been clicked....
     * @param {*} oEvent 
     * @param {*} strMsg 
     * @param {*} oSender 
     */
    onMenuClicked(strMsg,oEvent,oSender) {
        this.Log.logTrace("APP: menuClicked()")
        if(strMsg === "onClicked") this.loadPage(oEvent.currentTarget);
    }

    /**
     * event of an element occoured in the GUI
     * @param {*} oEvent 
     */
    onEvent(oEvent) {
        let oElement = oEvent.currentTarget;
        let strParm = EC(oElement).evtArgs();
        this.on(strParm,oElement);
    }

    /**
     * on Handler.
     * catches most events and sends it to the page handler.
     * per Default:
     * "onTextKeyUp"    : will validate the page (and enable/disable defaults)
     * @param {*} strFunc 
     * @param {*} oElement 
     */
    on(strFunc,oElement) {
        this.Log.logTrace(` - on event "${strFunc}" received...`)
        let bValidate = false;
        switch(strFunc) {
            case "onSelectChanged": 
            case "onRadioClick":
            case "onTextKeyUp":     bValidate = true; break;
        }
        // Call the generic "on" and the specific function on PageHandler
        this._callPageHandler("on",oElement,strFunc);
        this._callPageHandler(strFunc,oElement);

        // Now check if the page content is still valid (if necessary to check)
        let bIsValid = true;
        if(bValidate) {
            bIsValid = this.isPageValid();
            this.MainView.enableAll(".saveBtn",bIsValid);
        }
    }
    // #endregion

    // #region WebSocket operations

    onSocketStatus(eNewStatus,pWS    ) {
        this.Log.logTrace("APP: Socket status changed to : " + eNewStatus);
        if(eNewStatus == "open") {
            if(!(this._bInitialDataReceived === true)) {
                this.sendSocketCommand(DEFAULTS.GET_CONFIG_COMMAND);
                this._bInitialDataReceived = true;
            }
        }
    }
    /**
     * Prepares the message with a command, token and if defined, a type.
     * The message itself will be stored in "payload" property.
     * @param {*} strCommand 
     * @param {*} strType 
     * @param {*} oData 
    */
    sendSocketCommand(strCommand,strType,oData) {
        let oMsg = {
                "command": strCommand,
                "token"  : this.getAccessToken()
            }
        if(strType) oMsg.type = strType;
        if(oData)   oMsg.payload = oData;
        this.WS.send(JSON.stringify(oMsg));
    }

    sendSocketMsg(oMsg) {
        this.WS.send(oMsg);
    }

    onSocketMessage(oMsg) {
        let oMsgData = JSON.parse(oMsg.data);
        if (oMsgData.hasOwnProperty("command")) {
            switch (oMsgData.command) {
            case "update": // Update received
                this._onUpdateMessage(oMsgData);
                break;

            case "backup": // Backup received
                this._callPageHandler("onBackupMessageReceived",oMsgData);
                break

            case "error": // Error received
                this._onErrorMessageReceived(oMsgData);
                break;

            default:
                break;
            }
        }
        this._callPageHandler("onSocketMessage",oMsgData);
    }

    _onErrorMessageReceived(oMsg) {
        let oErrorDlg = new CAlertDialog({
            "title": "Error: " + oMsg.data,
            "body" : oMsg.payload.msg + ' => "' + oMsg.payload.command + '"'
        });
        oErrorDlg.showModal();
    }

    _onUpdateMessage(oMsg) {
        if(oMsg && Utils.isString(oMsg.data)) {
            switch(oMsg.data) {
                case "status":  // A new status received
                    this.setNewStatus(oMsg.payload);
                    break;

                case "config":
                    this.Config.setConfig(oMsg.payload);
                    if(this._pCurHandler) this._pCurHandler.loadPageConfig(this.MainView,this);
                    this._callPageHandler("onUpdateConfigReceived");
                    break;            
                }
            // Call the specific handler for this update, if in place...
            // If the result is explicit false, do not call the refreshContentPage,
            // to avoid loops, when the refreshContentPage calls an update request again.
            if(this._callPageHandler("onUpdate_" + oMsg.data + "_Received",this,oMsg.payload) !== false) {
                this.refreshContentPage();
            }
           
        }
    }

    // #endregion

    // #region Security operations
    isAuth() {
        return(this.Security ? this.Security.isAuth() : false)
    }
    signin() {
        if(this.Security) this.Security.signin();
    }
    signout() {
        if(this.Security) this.Security.signout();
    }
    getAccessToken() {
        return(CSecurity.AccessToken);
    }
    updateAuthModeView(bIsAuth = false) {
        this.Security.updateAuthModeView();
    }
    // #endregion

}

// #endregion


/**
 * initial load - place after body load !
 * DOM is available now...
 * Loads main.html from the server into the element with id "PageContainer"
 */
(function() {
    const APP         = new CAppl();
    

    const APPSettings = new CAppSettings(APP_SETTINGS);
    const Log = new CLog();
    Log.setLogLevel(APPSettings.getData("app.logLevel",2));
    if(Utils.isFalseValue(APPSettings.getData("app.hideApp"))) {
        window.APP = APP;
    }
    if(Utils.isFalseValue(APPSettings.getData("app.hideLog"))) {
        window.Log = Log;
    }
    
    fetch(`_pages.html`)
        .then((response) => {
            return response.text();
        })
        .then((html) => {
            let oPC = EC("#PageContainer");
            oPC.html(oPC.html() + html); // .innerHTML = oPC.innerHTML + html   
            // Avoid duplicate id's in the DOM - Move all id's into data-id.
            // data-id will become id again, when loaded into the mainView container.
            // Only the main id stays in place - this is the id of the page...
            // all id's inside a page will be renamed - when there is no explicit data-id is in place already.
            oPC.selAll(":not(:scope > *)[id]").forEach((e) => {
                if(!e.dataset.id)  {
                    e.dataset.id = e.id;
                    e.removeAttribute("id");
                }
            })
                
            // Create the menu structure, based on html data-menu attributes.
            oPC.selAll("[data-menu]").forEach((e) => {
                let oAttr = e.getAttribute("data-menu");
                try {
                    let oDM = JSON.parse(oAttr);
                    if(Utils.isArray(oDM)) {
                        // It is an array, so process each (multiple menu entries...)
                        for(let oME of oDM) APPSettings.setMenuEntry(oME,e.id);
                    } else {
                        // No it is a single menu entry...
                        APPSettings.setMenuEntry(JSON.parse(e.getAttribute("data-menu")));
                    }
                } catch(ex) {
                    APP.Log.logEx(ex,"parsing menu def... : ");
                    APP.logInfo(oAttr);
                }
            })

           
            // Initialize the sidebar and the application.
            // SB.init(APPSettings.getConfig());
            APP.init(APPSettings.getConfig());
        })
        .catch((ex) => {
            APP.Log.logEx(ex,"loading main.html into page container");
            // this._tLanguages[this._lang] = {};
            // console.error(`Could not load ${this._lang}.json.`)
        });
})();
