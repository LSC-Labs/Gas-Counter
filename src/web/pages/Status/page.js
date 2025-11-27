/**
  @PageBuilder:register(StatusPage,CStatusPage)
 */

class CStatusPage extends CPageHandler {
    /**
     * 
     * @param {CAPP} oApp 
     */
    constructor(oApp) {
        // don't use this, before initialized !
        super("status",new CElement("#StatusPage"),oApp.Config);
        this._App = oApp;
       // this.Translator = new CTranslator();
    }

        
    // #region Update Status on a regular base
    disposePage(pView, pApp) {
        super.disposePage(pView, pApp);
        this.RefreshTimer = clearInterval(this.RefreshTimer);
        this.RefreshTimer = null;
    }

    preparePage(pView, pApp) {
        super.preparePage(pView, pApp);
        // Set an interval to refresh the status infos every 5 seconds...
        this.RefreshTimer = setInterval( this.refreshStatus.bind(this, pView, pApp), 5000);
    }
    
    refreshStatus(pView, pApp) {
        pApp.requestActStatus();
    }

    /**
     * Triggered, when a new status message is received from the web socket.
     * @param {CView} pView 
     * @param {CApp} pApp 
     * @returns false to avoid loadPageConfig is called again (!) and the game starts again...
     */
    onUpdateStatusReceived(pView, pApp) {
        this.loadPageConfig(pView, pApp);
        return(false)
    }
    // #endregion




    /**
     * Load the page config...
     * Request an actual status from the device...
     * This will trigger an update message, which will be handled in onUpdate_status_Received.
     * @param {CView} pView 
     * @param {CApp} pApp 
     */
    loadPageConfig(pView, pApp) {
        let oStatus = pApp.DeviceStatus;
       
        // set the root element infos - no prefix...
        this.setConfigValues(pView,oStatus);
        for(let strName in oStatus) {
            let oData = oStatus[strName];
            if(oData && Utils.isObj(oData)) {
                this.setConfigValues(pView,oData,strName);
            }
        }

        let oVars = new CVarTable();
        oVars.setVars(pApp.tVars);
        oVars.setVars(oStatus);
        
        // now the usage bar
        let nAvailableSize = oStatus.flash_size - oStatus.fs_total;
        let nPercentUsed = (oStatus.sketch_size * 100) / nAvailableSize;
        let oUsageBar =  pView.sel("#flashUsage");
        if(oUsageBar) {
            oVars.setVar("flash_used_percent",~~nPercentUsed);
            oVars.setVar("flash_available",nAvailableSize);
            oUsageBar.style.width = nPercentUsed + "%";
            oUsageBar.innerText = ~~(oStatus.sketch_size / 1024) + " KB";
            let oUB = EC(oUsageBar);
            let oTranse = new CTranslator();
            let strI18n = "Status.memOK";
            if(nPercentUsed > 50) {
                oUB.rc("usageOK").ac("usageWarn");
                strI18n = "Status.memWarn";
            } else {
                oUB.ac("usageOK").rc("usageWarn");
            }
            oTranse.translateI18n(strI18n,undefined,oVars)
                .then(str => { 
                    oUB.attr("title",str)
                }
            )
        }
        return(oStatus);
    }

    
}