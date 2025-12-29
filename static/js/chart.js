function httpGet(theUrl) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open("GET", theUrl, false);
    xmlHttp.send();

    return xmlHttp.responseText;
}

function updateChartWithMonthData(element, title, month) {
    var deviceData = httpGet("/monthdata?month=" + month);

    var j = {
        "element": element,
        "title": title,
        "legend": [ 'Occupancy' ],
        "label": [ "" ],
        "label_format": [ "", "" ],
        "device_data": deviceData,
    };

    updateChart(j);
}

function updateChartWithWeekData(element, title, week) {
    var deviceData = httpGet("/weekdata?week=" + week);

    var j = {
        "element": element,
        "title": title,
        "legend": [ 'Occupancy' ],
        "label": [ "" ],
        "label_format": [ "", "" ],
        "device_data": deviceData,
    };

    updateChart(j);
}

function updateChartWithDayData(element, brianId, title, day, isSimpleView = false) {
    var deviceData = httpGet("/daydata?day=" + day + "&brian=" + brianId);

    var j = {
        "element": element,
        "title": title,
        "legend": [ 'Occupancy', 'CO2', 'Humidity' ],
        "label": [ "", "          [ppm]", "" ],
        "label_format": [ "", "", "%" ],
        "device_data": deviceData,
        "show_visualMap": !isSimpleView,
        "show_tooltip": !isSimpleView,
        "show_dataZoom": !isSimpleView
    };

    updateChartEx(j);
}

function convert2MilliSeconds(clock) {
    const [hours, minutes, seconds] = clock.split(':');
    const totalMilliSeconds = ((+hours) * 60 * 60 + (+minutes) * 60 + (+seconds)) * 1000;

    return totalMilliSeconds;
}

function updateChart(j) {
    const xyOccupancyData = [];
    const dataList = [];

    const jOccupancy = JSON.parse(j["device_data"]);
    for (let i = 0; i < jOccupancy.length; i++) {
        xyOccupancyData[i] = [convert2MilliSeconds(jOccupancy[i][0]), parseInt(jOccupancy[i][1])];
    }

    j["occupancy_data"] = xyOccupancyData;
    j["people_threshold"] = parseInt(jOccupancy[0][2]);  // people_threshold
    j["people_max_allow"] = parseInt(jOccupancy[0][3]);  // people_max_allow

    showChart(j);
}

function updateChartEx(j) {
    const xyOccupancyData = [];
    const xyCO2Data = [];
    const xyHumidityData = [];
    const dataList = [];

    const jOccupancy = JSON.parse(j["device_data"])[0];
    for (let i = 0; i < jOccupancy.length; i++) {
        xyOccupancyData[i] = [jOccupancy[i][0]*1000, parseInt(jOccupancy[i][1])];
    }

    const jSCD30 = JSON.parse(j["device_data"])[1];
    for (let i = 0; i < jSCD30.length; i++) {
        xyCO2Data[i] = [jSCD30[i][0]*1000, parseFloat(jSCD30[i][1])];
        xyHumidityData[i] = [jSCD30[i][0]*1000, parseFloat(jSCD30[i][2])];
    }

    j["occupancy_data"] = xyOccupancyData;
    j["people_threshold"] = parseInt(jOccupancy[0][2]);  // people_threshold
    j["people_max_allow"] = parseInt(jOccupancy[0][3]);  // people_max_allow
    j["CO2_data"] = xyCO2Data;
    j["humidity_data"] = xyHumidityData;

    showChartEx(j);
}

function showChart(j) {
    var dom = document.getElementById(j["element"]);
    var myChart = echarts.init(dom);
    var app = {};
    var option;

    option = {
        color:['#808080','#00FF00','#0060FF'],
        title: {
            text: j["title"],
            left: 'center'
        },
        legend: {
            data: j["legend"],
            left: 0,
            top: 10
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'line',
                snap: true
            },
            formatter: function (a) {
                return new Date(parseInt(a[0].value, 10)).toISOString().substr(11, 8);
            },
        },
        toolbox: {
            right: 10,
            feature: {
                saveAsImage: {}
            }
        },
        visualMap: {
            top: 50,
            left: 100,
            pieces: [{
                lt: j["people_threshold"],
                color: '#808080'
            }, {
                gte: j["people_threshold"],
                lte: j["people_max_allow"],
                color: '#FBDB0F'
            }, {
                gt: j["people_max_allow"],
                color: '#FD0100'
            }],
            outOfRange: {
                color: '#999'
            }
        },
        dataZoom: [{
            type: 'inside',
            start: 6/24*100 + 0.001,
            end: 20/24*100 + 0.001
        }, {
            type: 'slider',
            labelFormatter: function (value, valueStr, startOrEnd) {
                return new Date(parseInt(value, 10)).toISOString().substr(11, 5);
            }
        }],
        xAxis: {
            type: 'value',
            min: 0,
            max: (23*60*60 + 59*60 + 59) * 1000,
            axisLabel: {
                formatter: function (value) {
                    return new Date(parseInt(value, 10)).toISOString().substr(11, 5);
                }
            }
        },
        yAxis: {
            name: j["label"][0],
            type: 'value',
            axisLine: {
                show: true
            },
            axisLabel: {
                formatter: '{value} ' + j["label_format"][0]
            }
        },
        series: [{
            name: j["legend"][0],
            data: j["occupancy_data"],
            type: 'line',
            step: 'end',
            //areaStyle: {},
            showBackground: true,
            backgroundStyle: {
                color: 'rgba(180, 180, 180, 0.2)'
            },
        }]
    };

    if (option && typeof option === 'object') {
        myChart.setOption(option);
    }
}


function showChartEx(j) {
    var dom = document.getElementById(j["element"]);
    var myChart = echarts.init(dom);
    var app = {};
    var option;

    var hourStart = 6;
    var hourEnd = 21;
    var dataHourMin = (new Date (j["occupancy_data"][0][0])).getHours();
    var dataHourMax = (new Date (j["occupancy_data"][j["occupancy_data"].length - 1][0])).getHours() + 1;
    var dataHourSpan = dataHourMax - dataHourMin;
    var dataZoomStart = Math.max(0, (hourStart - dataHourMin)) / dataHourSpan * 100 - 1;
    var dataZoomEnd = Math.min(dataHourSpan, (hourEnd - dataHourMin)) / dataHourSpan * 100 + 2;

    option = {
        color:['#808080','#00FF00','#0060FF'],
        title: {
            text: j["title"],
            left: 'center'
        },
        legend: {
            data: j["legend"],
            left: 0,
            top: 10
        },
        tooltip: {
            show: j["show_tooltip"],
            trigger: 'axis',
            axisPointer: {
                type: 'line',
                snap: true,
                label: {
                    show: false
                }
            }
        },
        toolbox: {
            right: 10,
            feature: {
                saveAsImage: {}
            }
        },
        visualMap: [{
            show: j["show_visualMap"],
            top: 50,
            left: 95,
            seriesIndex: 0,
            pieces: [{
                lt: j["people_threshold"],
                color: '#808080'
            }, {
                gte: j["people_threshold"],
                lte: j["people_max_allow"],
                color: '#FBDB0F'
            }, {
                gt: j["people_max_allow"],
                color: '#FD0100'
            }],
            outOfRange: {
                color: '#999'
            }
        }, {
            show: j["show_visualMap"],
            top: 50,
            right: 95,
            seriesIndex: 1,
            pieces: [{
                lt: 1000,
                color: '#00FF00'
            }, {
                gte: 1000,
                lte: 2500,
                color: '#FFE800'
            }, {
                gte: 2500,
                lte: 5000,
                color: '#FD0100'
            }, {
                gt: 5000,
                color: '#A228FF'
            }],
            outOfRange: {
                color: '#999'
            }
        }, {
            show: false,
            seriesIndex: 2,
            inRange:{
                color: '#00A5EF'
            }
        }],
        dataZoom: [{
            show: j["show_dataZoom"],
            type: 'slider',
            start: dataZoomStart,
            end:   dataZoomEnd,
            xAxisIndex: 0,
            filterMode: 'none',
        }, {
            show: false,
            type: 'slider',
            yAxisIndex: 0,
            filterMode: 'none'
        }, {
            type: 'inside',
            xAxisIndex: 0,
            filterMode: 'none'
        }],
        xAxis: {
            type: 'time',
            min: j["occupancy_data"][0][0]
        },
        yAxis: [{
            name: j["label"][0],
            type: 'value',
            position: 'left',
            offset: 5,
            axisLine: {
                show: true,
                lineStyle: {
                    color: '#03CE07'
                }
            },
            axisLabel: {
                formatter: '{value} ' + j["label_format"][0]
            }
        },{
            name: j["label"][1],
            type: 'value',
            position: 'right',
            offset: 5,
            axisLine: {
                show: true,
                lineStyle: {
                    color: '#00FF00'
                }
            },
            axisLabel: {
                formatter: '{value} ' + j["label_format"][1]
            }
        },{
            name: j["label"][2],
            type: 'value',
            position: 'right',
            offset: 40,
            axisLine: {
                show: false,
                lineStyle: {
                    color: '#0060FF'
                }
            },
            axisLabel: {
                formatter: '{value} ' + j["label_format"][2]
            }
        }],
        series: [{
            name: j["legend"][0],
            data: j["occupancy_data"],
            type: 'line',
            step: 'end',
            yAxisIndex: 0,
            showBackground: true,
            backgroundStyle: {
                color: 'rgba(180, 180, 180, 0.2)'
            }
        }, {
            name: j["legend"][1],
            data: j["CO2_data"],
            type: 'line',
            yAxisIndex: 1,
            showBackground: true,
            backgroundStyle: {
                color: 'rgba(180, 180, 180, 0.2)'
            }
        }, {
            name: j["legend"][2],
            data: j["humidity_data"],
            type: 'line',
            yAxisIndex: 2,
            showBackground: true,
            backgroundStyle: {
                color: 'rgba(180, 180, 180, 0.2)'
            }
        }]
    };

    if (option && typeof option === 'object') {
        myChart.setOption(option);
    }
}






















function updateChartWithData(element) {
    console.log(element);
    var j = {
        "element": element
    };

    updateHalfDoughnutChart(j);
}

function updateHalfDoughnutChart(j) {
    const xyOccupancyData = [];
    const xyCO2Data = [];
    const xyHumidityData = [];
    const dataList = [];

    // const jOccupancy = JSON.parse(j["device_data"])[0];
    // for (let i = 0; i < jOccupancy.length; i++) {
    //     xyOccupancyData[i] = [jOccupancy[i][0]*1000, parseInt(jOccupancy[i][1])];
    // }

    // const jSCD30 = JSON.parse(j["device_data"])[1];
    // for (let i = 0; i < jSCD30.length; i++) {
    //     xyCO2Data[i] = [jSCD30[i][0]*1000, parseFloat(jSCD30[i][1])];
    //     xyHumidityData[i] = [jSCD30[i][0]*1000, parseFloat(jSCD30[i][2])];
    // }

    // j["occupancy_data"] = xyOccupancyData;
    // j["people_threshold"] = parseInt(jOccupancy[0][2]);  // people_threshold
    // j["people_max_allow"] = parseInt(jOccupancy[0][3]);  // people_max_allow
    // j["CO2_data"] = xyCO2Data;
    // j["humidity_data"] = xyHumidityData;

    showHalfDoughnutChart(j);
}


function showHalfDoughnutChart(j) {
    var dom = document.getElementById(j["element"]);
    var myChart = echarts.init(dom);

    var option = {
    tooltip: { trigger: 'item' },
    title: { text: 'World Population' },
    legend: { top: '5%', left: 'center' },
    series: [
        {
        name: 'Access From',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '70%'],
        startAngle: 180,
        endAngle: 360,
        label: {
            show: true,
            position: 'inside',
            formatter: '{c}',
            color: '#fff',
            fontSize: 30,
            fontWeight: 'bold'
        },
        data: [
            { value: 5, name: 'Free', itemStyle: { color: '#4CAF50' } },
            { value: 19, name: 'Occupied', itemStyle: { color: '#F44336' } }
        ]
        }
    ],
    graphic: [
        {
        type: 'text',
        left: '44%',
        top: '10%',
        style: {
            text: 'Available: 6',
            font: 'bold 22px sans-serif',
            fill: '#4CAF50',
            textAlign: 'center'
        }
        }
    ]
    };

    myChart.setOption(option);
}
