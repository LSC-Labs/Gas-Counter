/**
 * Gas Counter settings page - additionally allows to set the meter reading of the gas meter.
 *
 * @PageBuilder:register(GasCounterPage,CGasCounterPage)
 */
class CGasCounterPage extends CPageHandler {
    /** Verbindet den Seitenhandler mit der Anwendungskonfiguration. */
    constructor(oApp) {
        super("gascounter",EC("#GasCounterPage"),oApp.Config);
        this._App = oApp;
        this.Transe = new CTranslator();
    }

    /** Lädt den aktuellen Status, um den Zählerstand anzuzeigen. */
    preparePage(pView, pApp) {
        super.preparePage(pView, pApp);
        this._View = pView;
        pApp.requestActStatus();
    }

    /** Liefert den aktuellen Zählerstand aus dem Gerätestatus (oder undefined). */
    getMeterReading(pApp) {
        let oGas = pApp.DeviceStatus ? pApp.DeviceStatus.gascounter : undefined;
        return (oGas && oGas.MeterReading !== undefined) ? parseFloat(oGas.MeterReading) : undefined;
    }

    /** Zeigt den Zählerstand an; das Eingabefeld wird nur vorbelegt, solange es leer ist. */
    onUpdateStatusReceived(pView, pApp) {
        let fReading = this.getMeterReading(pApp);
        if(fReading === undefined || isNaN(fReading)) return(false);
        let oView = pView ?? this._View;
        if(!oView) return(false);
        let oAct = oView.sel("#actMeterReading");
        if(oAct) oAct.innerText = fReading.toFixed(3);
        let oInput = oView.sel("#newMeterReading");
        if(oInput && oInput.value === "") oInput.value = fReading.toFixed(3);
        return(false);
    }

    /** Sendet den neuen Zählerstand an das Gerät (Kommando "setgasmeter"). */
    async setMeterReading(pView) {
        let oView = pView ?? this._View;
        let oInput = oView ? oView.sel("#newMeterReading") : null;
        if(!oInput) return;
        let fValue = parseFloat(String(oInput.value).replace(",","."));
        if(isNaN(fValue) || fValue < 0 || fValue > 99999999) {
            alert(await this.Transe.getKeyData("gasCounter.meterReading.invalid") ?? "invalid value");
            return;
        }
        let strAsk = await this.Transe.getKeyData("gasCounter.meterReading.confirm");
        if(!confirm((strAsk ?? "Set meter reading to") + " " + fValue.toFixed(3) + " m³ ?")) return;
        this._App.sendSocketCommand("setgasmeter","",{ "meterReading": fValue.toFixed(3) });
        // Device processes the command in its loop - then fetch the new status.
        let oApp = this._App;
        setTimeout(() => oApp.requestActStatus(), 1000);
    }

    on(pView, oElement) {
        if(Utils.isElement(oElement)) {
            switch(oElement.id) {
                case "setMeterReading": this.setMeterReading(pView); break;
            }
        }
    }
}
