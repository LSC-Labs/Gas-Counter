/**
  @PageBuilder:register(InfoPage,CInfoPage)
 */


/** Chart Plugins used to draw the chart */
const ChartPlugins = {
    Defaults: {
        ChartWidth : 700,
        NeedleCharSize : 30,
        NeedleColor : 'grey',
        NeedleLabelColor: 'grey',
        FontColor: 'grey',
        LabelCharSize: 15
    },
    /**
     * Draw the needle in the tachometer
     */
    gaugeNeedle : {
        id: 'gaugeNeedle',
    /** Zeichnet die zusätzliche Instrumentdarstellung nach dem Datensatz. */
        afterDatasetDraw(chart, args, plugins) {
            const { ctx, data } = chart;
            const nChartPercentWidth = chart.width / ChartPlugins.Defaults.ChartWidth;
            const xCenter = chart.getDatasetMeta(0).data[0].x;
            const yCenter = chart.getDatasetMeta(0).data[0].y;
            const outerRadius = chart.getDatasetMeta(0).data[0].outerRadius;
            const innerRadius = chart.getDatasetMeta(0).data[0].innerRadius;
            const barWidth = outerRadius - innerRadius;
            const middleBar = (outerRadius - innerRadius) / 2;
            
         
           
            // const radius = 12;
            // First use the half of the default char size for the needle radius.
            // Then calculate the % of the box width to the default chart width
            let nNeedleRadius = ChartPlugins.Defaults.NeedleCharSize / 2;
            
            // Adjust the needle radius to the percentage
            // e.g. Chart width 350 => 50% of 700 => needle radius 15
            nNeedleRadius = Math.round(nNeedleRadius * nChartPercentWidth);
            // console.log("Needle radius : " + nNeedleRadius);
            const angle = Math.PI / 180;

            // https://www.youtube.com/watch?v=hlRMMooNxGM
            const needleValue = data.datasets[0].needleValue;
            const dataTotal = data.datasets[0].data.reduce((a,b) => a + b, 0);
            // View the calulated total chart data and the segments of the arc
            // console.log("Total value of chart data : " + dataTotal);
            // console.log(chart.getDatasetMeta(0).data[0]);
            
            const circumference = 
                (
                    (chart.getDatasetMeta(0).data[0].circumference / Math.PI) /
                    data.datasets[0].data[0]
                ) * needleValue;

            ctx.save();
            // Draw the pointer
            /*
            ctx.moveTo(xCenter,yCenter);
            ctx.lineTo(xCenter,yCenter - outerRadius),
            ctx.stroke();
            */
           ctx.translate(xCenter,yCenter);
           ctx.rotate(Math.PI * (circumference + 1.5));
           ctx.beginPath();
           ctx.lineWidth = 1;
           ctx.strokeStyle = data.datasets[0].needleColor ?? ChartPlugins.Defaults.NeedleColor??'grey';
           ctx.fillStyle = data.datasets[0].needleColor ?? ChartPlugins.Defaults.NeedleColor?? 'grey';
           ctx.moveTo(0 - nNeedleRadius,0);
           ctx.lineTo(0,- innerRadius - middleBar); 
           ctx.lineTo(0 + nNeedleRadius,0);
           ctx.closePath();
           ctx.stroke();
           ctx.fill();
        
           // Draw the closing arc
           ctx.beginPath();
           ctx.arc(0,0,nNeedleRadius,0,angle *360,false)
           ctx.fill();

           ctx.restore();
        }
    },

    gaugeFlowMeter : {
        // see also : https://www.youtube.com/watch?v=QWo6E2zCwGw
        id: 'gaugeFlowMeter',
    /** Zeichnet die zusätzliche Instrumentdarstellung nach dem Datensatz. */
        afterDatasetDraw(chart, args, plugins) {
            const { ctx, data } = chart;
            ctx.save();

            const percentageWidth = chart.width / ChartPlugins.Defaults.ChartWidth;
            const needleValue = data.datasets[0].needleValue;
            const xCenter = chart.getDatasetMeta(0).data[0].x;
            const yCenter = chart.getDatasetMeta(0).data[0].y;

            const circumference = 
                (
                    (chart.getDatasetMeta(0).data[0].circumference / Math.PI) /
                    data.datasets[0].data[0]
                ) * needleValue;
            const percentageValue = circumference * 100;

            // flowMeter
            const nFontSize = Math.round(ChartPlugins.Defaults.NeedleCharSize * 2 * percentageWidth);
            
            ctx.fillStyle = data.datasets[0].needleColor ?? ChartPlugins.Defaults.NeedleLabelColor ?? 'grey';
            ctx.textAlign = 'center';
            ctx.font = `bold ${nFontSize}px sans-serif`;
            //ctx.fillText(`${percentageValue.toFixed(2)}%`,xCenter,yCenter + 10 + nFontSize);
            ctx.fillText(`${needleValue.toFixed(2)}`,xCenter,yCenter + 10 + nFontSize);

            ctx.font = `bold ${nFontSize / 2}px sans-serif`;
            ctx.fillText(`m³`,xCenter + nFontSize + 10 ,yCenter + 10 + nFontSize);


            // If there is a text in the box to be set, it is in the attribute data-text
        /*
            if(data.datasets[0].needleText) {
                ctx.font = `${nFontSize / 2}px sans-serif`;
                ctx.fillText(`${data.datasets[0].needleText}`,xCenter,yCenter + 20 + nFontSize *2);
            }
                */
            ctx.restore();
        }

    },

    gaugeLabels : {
        id: 'gaugeLabels',
    /** Zeichnet die zusätzliche Instrumentdarstellung nach dem Datensatz. */
        afterDatasetDraw(chart, args, plugins) {
            const { ctx, chartArea: { left, right } } = chart;
            const percentageWidth = chart.width / ChartPlugins.Defaults.ChartWidth;
            const xCenter = chart.getDatasetMeta(0).data[0].x;
            const yCenter = chart.getDatasetMeta(0).data[0].y;

            const outerRadius = chart.getDatasetMeta(0).data[0].outerRadius;
            const innerRadius = chart.getDatasetMeta(0).data[0].innerRadius;
            const barCenter = (outerRadius - innerRadius) / 2;

            ctx.save();
            ctx.translate(xCenter,yCenter);
            // Font size = Font Size (Default) - 
            const nFontHalfSize = ChartPlugins.Defaults.LabelCharSize / 2;
            const nDefaultSize = ChartPlugins.Defaults.LabelCharSize;
            let nFontSize = Math.round(nFontHalfSize * percentageWidth + nFontHalfSize);
            // console.log("## font size (label): " + nFontSize + " - " + percentageWidth + "%");
            // nFontSize = 12;
            ctx.font = `bold ${nFontSize}px sans-serif`;
            ctx.fillStyle =  ChartPlugins.Defaults.LabelColor ?? 'grey';
            ctx.textAlign = 'center';
            ctx.fillText(`0.0`,0 - innerRadius - barCenter , 5 + nFontSize);
            ctx.fillText(`max`,0 + innerRadius + barCenter, 5 + nFontSize);
            
            ctx.restore();
        }
    }
}

class CTachoChart {
    nBaseChartWidth = 700;
    nDefaultCharSize = 16;
    // #region Chart Basic structures for the interface charJS */
    /**
     * Chart Data
     */
    chartData = {
      labels: ['Verbrauch'],
      datasets: [{
        label: 'Current Hour',
        data: [10],
        backgroundColor: [
          this.gradientSegment,
          'rgba(0, 0, 0, 0.2)'
        ],
        borderColor: [
          this.gradientSegment,
          'rgba(0, 0, 0, 0.2)'
        ],
        borderWidth: 1,
        circumference: 180,
        rotation: 270,
        cutout: '80%',
        needleValue : 7, // Value to be set for the needle (!)
        needleText: '...'
      }]
    };

    /**
     * Chart Config
     */
    chartConfig = {
        type: 'doughnut',
        data: this.chartData,
        options: {
            layout: {
                padding: {
                    bottom: 50
                }
            },
            aspectRatio: 1.8,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false
                }
            }
        },
    plugins: [ChartPlugins.gaugeNeedle, ChartPlugins.gaugeFlowMeter, ChartPlugins.gaugeLabels]
    };
    // #endregion


    /** Bindet Diagramm und Textfallback an die DOM-Elemente des Instruments. */
    constructor(oChartNode) {
        this.oChartNode = EC(oChartNode)
        this.chartWidth = oChartNode.getBoundingClientRect().width - 40;
         // console.log(this.chartWidth);
        this.oChartText   = this.oChartNode.gel(".chartText");
        this.oChartCanvas = this.oChartNode.gel('canvas');
        this.oChartValue  = this.oChartNode.sel(".chartNumber");
        this.oChartLabel  = this.oChartNode.sel(".chartLabel");
        this.oChartCTX    = this.oChartCanvas.getBase().getContext('2d');
        // Prepare the textual display (hide if chart js is not available)
        this.showSections();
    }

    /** Zeigt je nach Verfügbarkeit von Chart.js Diagramm oder Textfallback. */
    showSections() {
        let bIsChartJSAvailable = this.isChartJSAvailable();
        this.oChartText.hide(bIsChartJSAvailable);
        this.oChartCanvas.show(bIsChartJSAvailable);
        return(bIsChartJSAvailable);
    }
    /** Zeichnet eine bereits erzeugte Chart.js-Instanz erneut; nValue bleibt ungenutzt. */
    updateChart(nValue) {
        this.oChart.update();
    }


    /**
     * render the chart...
     * if Chart.JS is not in place... do nothing
     * @param {*} nValue 
     * @param {*} nMaxValue 
     */
    render(nValue, nMaxValue) {
        // Set the data value (only one for the tachometer)
        this.chartData.datasets[0].data = [nMaxValue?? 10];
        this.chartData.datasets[0].needleValue = nValue ?? parseFloat(this.oChartValue.innerText);
        this.chartData.datasets[0].needleText = this.oChartLabel.innerText;
        let bIsChartJSAvailable = this.showSections();
        if(bIsChartJSAvailable) {
            if(this.oChart) this.oChart.update();
            else {
                // prepare the gradient from green to red.
                const gradientSegment = this.oChartCTX.createLinearGradient(0,0,this.chartWidth,0);
                gradientSegment.addColorStop(0,'green');
                gradientSegment.addColorStop(0.4,'yellow');
                gradientSegment.addColorStop(1,'red');
                
                this.chartData.datasets[0].backgroundColor =  [
                                                    gradientSegment,
                                                    'rgba(0, 0, 0, 0.2)'
                                                    ];
                this.chartData.datasets[0].borderColor =  [
                                                    gradientSegment,
                                                    'rgba(0, 0, 0, 0.2)'
                                                    ];
                                                    
                this.chartConfig.data = this.chartData;
                this.oChart = new Chart(this.oChartCanvas.getBase(), this.chartConfig);
            }
        }
    }

    // #region ChartJS Custom Plugins for the Gauge Chart
   
    /** Prüft, ob der Chart.js-Konstruktor geladen wurde. */
    isChartJSAvailable() { return typeof Chart === 'function' }
    // #endregion


}


class CInfoPage extends CPageHandler {
    /**
     * 
     * @param {CAPP} oApp 
     */

    fDefaultMaxRateDaily = 10.0;
    fDefaultMaxRateHourly = 5.0;
    /** Verbindet den Seitenhandler mit der Anwendungskonfiguration. */
    constructor(oApp) {
        // don't use this, before initialized !
        super("info",new CElement("#InfoPage"),oApp.Config);
        this._App = oApp;
       // this.Translator = new CTranslator();
    }

    
    // #region Update Status on a regular base
    /** Beendet das periodische Nachladen beim Verlassen der Seite. */
    disposePage(pView, pApp) {
        super.disposePage(pView, pApp);
        this.RefreshTimer = clearInterval(this.RefreshTimer);
        this.RefreshTimer = null;
        this.oCC = undefined;
        this.oCL = undefined;
        this.oCT = undefined;
        this.oCY = undefined;
    }

    /** Aktiviert die Statusabfrage im Abstand von fünf Sekunden. */
    preparePage(pView, pApp) {
        super.preparePage(pView, pApp);
        // Set an interval to refresh the status infos every 5 seconds...
        this.RefreshTimer = setInterval( this.refreshStatus.bind(this, pView, pApp), 5000);
    }
    
    /** Fordert neue Gerätestatusdaten über die Anwendung an. */
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
     * calculate the value for the maximum rate.
     * fDefault is 5.0.
     * If fValue1 or fValue2 are higher than fDefault, the higher value is returned.
     * @param {*} fValue1 
     * @param {*} fValue2 
     * @param {*} fDefault 
     * @returns the maximum rate for the scale....
     */
    calcMaxRate(fValue1,fValue2,fDefault) {
        let fRate = fDefault ?? 5.0;
        if(fValue1 != undefined) {
            if (fValue1 >= fRate) fRate = fValue1;
        }
        if(fValue2 != undefined) {
            if (fValue2 >= fRate) fRate = fValue2;
        }
        return(fRate);
    }

    /**
     * 
     * @param {*} pView 
     * @param {*} pApp 
     * @returns 
     * @overload
     */
    loadPageConfig(pView, pApp) {
        let oStatus = pApp.DeviceStatus;

        this.setConfigValues(pView,oStatus);
        for(let strName in oStatus) {
            let oData = oStatus[strName];
            if(oData && Utils.isObj(oData)) {
                this.setConfigValues(pView,oData,strName);
            }
        }

        if(!this.oCC) this.oCC = new CTachoChart(pView.sel("#chartCurrent"));
        if(!this.oCL) this.oCL = new CTachoChart(pView.sel("#chartLastHour"));
        if(!this.oCT) this.oCT = new CTachoChart(pView.sel("#chartToday"));
        if(!this.oCY) this.oCY = new CTachoChart(pView.sel("#chartPrevday"));

        // Get the default maximum rates from the configuration...
        let fMaxDefaultHourly = pApp.Config.getData("gascounter.maxRateHourly",this.fDefaultMaxRateHourly); 
        let fMaxDefaultDaily  = pApp.Config.getData("gascounter.maxRateDaily",this.fDefaultMaxRateDaily);

        // Calculate the maximum rates for the charts...
        let fMaxRateHourly = this.calcMaxRate(oStatus.m3hCurrent,oStatus.m3hLastHour,fMaxDefaultHourly);
        let fMaxRateDaily  = this.calcMaxRate(oStatus.m3hToday,oStatus.chartPrevday,fMaxDefaultDaily);

        // Now render the charts...
        this.oCC.render(oStatus.m3hCurrent,     fMaxRateHourly);
        this.oCL.render(oStatus.m3hLastHour,    fMaxRateHourly);
        this.oCT.render(oStatus.m3hToday,       fMaxRateDaily);
        this.oCY.render(oStatus.m3hPrevday,     fMaxDefaultDaily);
        return(oStatus);
    }
}