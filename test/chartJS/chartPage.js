

const Data = {
        "TickCounter" : 122,
        "m3hPerTick": 0.02,
        "m3hTotal": 18.3,
        "m3hToday": 2.9,
        "m3hPrevday": 5.6,
        "m3hLastHour" : 0.6,
        "m3hCurrent" : 0.2
    };

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

            ctx.save();
            /*
            console.log("-------- dataset meta data ---------");
            console.log(chart.getDatasetMeta(0));
            console.log(" -------");
            console.log(chart.getDatasetMeta(0).data);
            */
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
            ctx.restore();
        }

    },

    gaugeLabel : {
        id: 'gaugeLabel',
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
            console.log("## font size (label): " + nFontSize + " - " + percentageWidth + "%");
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
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{
        label: 'Weekly Sales',
        data: [10],
        backgroundColor: [
          'green',
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
        needleValue : 7 // Value to be set for the needle (!)
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
    plugins: [ChartPlugins.gaugeNeedle, ChartPlugins.gaugeFlowMeter, ChartPlugins.gaugeLabel]
    };
    // #endregion


    constructor(oChartNode) {
        this.oChartNode = oChartNode;
        this.chartWidth = oChartNode.getBoundingClientRect().width - 40;
        console.log(this.chartWidth);
        this.oChartCanvas = oChartNode.querySelector('canvas');
        this.oChartCTX = this.oChartCanvas.getContext('2d');
        this.oChartNumber = oChartNode.querySelector('.number');
        this.oChartLabel = oChartNode.querySelector('.label');
        // Draw with an linear gradient from green to red.
        this.oChartCanvas.style.display = isChartJSAvailable() ? "block" : "none";;
        this.oChartNumber.style.display = isChartJSAvailable() ? "none"  : "block";;
    
    }

    render(nValue, nMaxValue) {
        if(isChartJSAvailable()) {
            // Set the data value (only one for the tachometer)
            this.chartData.datasets[0].data = [nMaxValue?? 10];
            this.chartData.datasets[0].needleValue = nValue;
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

            this.oChart = new Chart(this.oChartCanvas, this.chartConfig);
        } else {
            this.oChartNumber.innerText = nValue + " m3";
        }
    }

    // #region ChartJS Custom Plugins for the Gauge Chart
   

    // #endregion


}
function isChartJSAvailable() { return false; }
const oTachoChart = new CTachoChart(document.getElementById("chartBox"));
oTachoChart.render(Data.m3hCurrent, 0.3);