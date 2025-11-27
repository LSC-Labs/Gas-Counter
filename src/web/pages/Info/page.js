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
            console.log("Needle radius : " + nNeedleRadius);
            const angle = Math.PI / 180;

            // https://www.youtube.com/watch?v=hlRMMooNxGM
            const needleValue = data.datasets[0].needleValue;
            const dataTotal = data.datasets[0].data.reduce((a,b) => a + b, 0);
            // View the calulated total chart data and the segments of the arc
            console.log("Total value of chart data : " + dataTotal);
            console.log(chart.getDatasetMeta(0).data[0]);
            
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
            const nFontSize = Math.round(ChartPlugins.Defaults.NeedleCharSize * percentageWidth);
            console.log("## font size : " + nFontSize);
            ctx.font = `bold ${nFontSize}px sans-serif`;
            ctx.fillStyle = data.datasets[0].needleColor ?? ChartPlugins.Defaults.NeedleLabelColor ?? 'grey';
            ctx.textAlign = 'center';
            //ctx.fillText(`${percentageValue.toFixed(2)}%`,xCenter,yCenter + 10 + nFontSize);
            ctx.fillText(`${needleValue.toFixed(2)} m³`,xCenter,yCenter + 10 + nFontSize);
            // If there is a text in the box to be set, it is in the attribute data-text
            if(data.datasets[0].needleText) {
                ctx.fillText(`${data.datasets[0].needleText}`,xCenter,yCenter + 20 + nFontSize *2);
            }
            ctx.restore();
        }

    },

    gaugeLabels : {
        id: 'gaugeLabels',
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


    constructor(oChartNode) {
        this.oChartNode = oChartNode;
        this.chartWidth = oChartNode.getBoundingClientRect().width - 40;
        // console.log(this.chartWidth);
        this.oChartCanvas = oChartNode.querySelector('canvas');
        this.oChartCTX = this.oChartCanvas.getContext('2d');
        this.chartData.datasets[0].needleText = EC(oChartNode).data('label');
        // Prepare the textual display
        this.oChartText = oChartNode.querySelector('div');
        if(this.oChartText) {
            this.oChartNumber = this.oChartText.querySelector(".number");
            this.oChartLabel = this.oChartText.querySelector(".label");
        }
        this.oChartCanvas.style.display = this.isChartJSAvailable() ? "block" : "none";;
        this.oChartText.style.display = this.isChartJSAvailable() ? "none"  : "block";;
    }

    render(nValue, nMaxValue) {
        // Set the data value (only one for the tachometer)
        this.chartData.datasets[0].data = [nMaxValue?? 10];
        this.chartData.datasets[0].needleValue = nValue;
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

        if(this.isChartJSAvailable()) {
            this.oChart = new Chart(this.oChartCanvas, this.chartConfig);
        } else {
            if(this.oChartNumber) this.oChartNumber.innerText = `${nValue.toFixed(2)} m³`
            if(this.oChartLabel) this.oChartLabel.innerText = this.chartData.datasets[0].needleText
        }
    }

    // #region ChartJS Custom Plugins for the Gauge Chart
   
    isChartJSAvailable() { return typeof Chart === 'function1' }
    // #endregion


}


class CInfoPage extends CPageHandler {
    /**
     * 
     * @param {CAPP} oApp 
     */
    constructor(oApp) {
        // don't use this, before initialized !
        super("info",new CElement("#InfoPage"),oApp.Config);
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
     * 
     * @param {*} pView 
     * @param {*} pApp 
     * @returns 
     * @overload
     */
    loadPageConfig(pView, pApp) {
        let oStatus = pApp.DeviceStatus.gascounter;
        if(isChartJSAvailable()) {
            let oCC = new CTachoChart(pView.sel("#chartCurrent"));
            oCC.render(oStatus.m3hCurrent, 1);
        }

        let oID = pApp.DeviceStatus.sensorID ?? {};
        let oOD = pApp.DeviceStatus.sensorOD ?? {};
        
        let nMaxTemp = 80;
        let nMinTemp = -20; 
        let nTempRange = 60;
        let nDefaultTemp = nMinTemp;
        let nDefaultHum = 0;
        this._createThermo(pView.gel("#intTemp"), {
            type: "T",
            label: (oID.temp_c ? oID.temp_c.toFixed(1) : "--")  + "°",
            height: this.calcDisplayPercent((oID.temp_c ?? nDefaultTemp),nMinTemp,nTempRange)
        })
        this._createThermo(pView.gel("#intHumidity"), {
            type: "H",
            label: (oID.hum ?? nDefaultHum).toFixed(1) + "%",
            height: this.calcDisplayPercent((oID.hum ?? nDefaultHum),0,100)
        })
        this._createThermo(pView.gel("#extTemp"), {
            type: "T",
            label: (oOD.temp_c ? oOD.temp_c.toFixed(1) : "--.-")  + "°",
            height: this.calcDisplayPercent((oOD.temp_c ?? nDefaultTemp),nMinTemp,nTempRange)
        })
        this._createThermo(pView.gel("#extHumidity"), {
            type: "H",
           label: (oOD.hum ?? nDefaultHum).toFixed(1) + "%",
            height: this.calcDisplayPercent((oOD.hum ?? nDefaultHum),0,100)
        })
        pView.gel("#dewPointID").html((oID.dew_point ?? 0).toFixed(1) + "°C" );
        pView.gel("#tempID").html((oID.temp_c ?? 0).toFixed(1) + "°C" );
        pView.gel("#humID").html((oID.hum ?? 0).toFixed() + "%" );

        pView.gel("#dewPointOD").html((oOD.dew_point ?? 0).toFixed(1) + "°C" );
        pView.gel("#tempOD").html((oOD.temp_c ?? 0).toFixed(1) + "°C" );
        pView.gel("#humOD").html((oOD.hum ?? 0).toFixed() + "%" );

        return(oStatus);
    }

      _createThermo(oBaseElement, oData) {
        let oParent = CElement.asInstance(oBaseElement);
        oParent.html(""); 
        let oThermo = oParent.cce("div").ac("thermo");
        let oGlas   = oThermo.cce("div").ac("thermo-glas");
        let oLiquid = oGlas.cce("div").ac("thermo-liquid");
        let oLabel  = oThermo.cce("div").ac("thermo-label");
        if(oData.label) oLabel.setText(oData.label)
        oLiquid.getBase().style.height = oData.height;
        switch(oData.type) {
            case "T" :  oLiquid.ac("thermo-temp");
                        break;
            case "H" : oLiquid.ac("thermo-humidity");
                        break;
        }
        oGlas.ac("thermo-glas-active");
        return(oThermo);
    }

    calcDisplayPercent(fData, fMin = -20, fRange = 60) {
        return(((fData - fMin) * 100 / fRange).toFixed() + "%")
    }
}