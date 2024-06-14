document.getElementById('upload').addEventListener('change', handleFile, false);

var chart;
var originalData = [];
let downScallingFactor = 3; // Fine tuned to the point where it looks right

let primaryColor = getComputedStyle(document.documentElement)
.getPropertyValue('--color-primary')
.trim();

let colorLabel = getComputedStyle(document.documentElement)
.getPropertyValue('--color-label')
.trim();

let colorText = getComputedStyle(document.documentElement)
.getPropertyValue('--color-text')
.trim();

let labelColor = getComputedStyle(document.documentElement)
.getPropertyValue('--color-label')
.trim();

let fontFamily = getComputedStyle(document.documentElement)
.getPropertyValue('--font-family')
.trim();


// Function to handle file upload
function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, {type: 'array'});

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert the worksheet to JSON data
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {header: 1});
        
        // Show the slider container
        document.getElementById('slider-container').style.display = 'block';
        
        // Reset chart and related data
        resetChart();
        
        // Process the jsonData to fit the chart data structure
        processChartData(jsonData);
    };
    reader.readAsArrayBuffer(file);
}

function resetChart() {
    if (chart) {
        chart.destroy();
        chart = null;
    }
    originalData = [];
    document.getElementById('myRange').value = 2.5;
    document.getElementById('demo').innerHTML = 2.5;
}

function processChartData(jsonData) {
    // Assume the first row is the header
    const headers = jsonData[0];
    const data = jsonData.slice(1);

    // Find the smallest size in the dataset directly from the data array
    const sizeIndex = headers.indexOf('Size');
    const minSize = Math.min(...data.map(row => parseFloat(row[sizeIndex])));
    console.log('Minimum size:', minSize);

    // Extract index of the Risk column
    const riskIndex = headers.indexOf('Risks');

    // Group data by risks
    const groupedData = {};
    data.forEach(row => {
        const risk = row[riskIndex];
        if (!groupedData[risk]) {
            groupedData[risk] = [];
        }
        groupedData[risk].push({
            name: row[headers.indexOf('Name')],
            x: parseFloat(row[headers.indexOf('Velocity')]),
            y: parseFloat(row[headers.indexOf('Probability')]),
            z: parseFloat(row[headers.indexOf('Size')])
        });
    });
    
    // Process each group to split names and calculate sizes
    const seriesData = Object.keys(groupedData).map(risk => {
        const dataArray = groupedData[risk];

        // Split names into an array of words
        dataArray.forEach(item => {
            item.name = item.name.split(' ');
        });

        // Convert data for ApexCharts with adjusted sizes
        const processedData = dataArray.map(d => ({
            x: d.x,
            y: d.y,
            z: minSize + ((d.z - minSize) / downScallingFactor),
            name: d.name,
        }));

        return {
            name: risk,
            data: processedData
        };
    });

    // Save original data for later use in updateBubbleSizes
    originalData = seriesData;
    // Update the chart with the new series data
    updateChart(seriesData);

    // Call updateBubbleSizes on page load to set the correct initial size
    updateBubbleSizes(parseFloat(slider.value));
}


// Split the name into an array of words
function splitNames(dataArray) {
    dataArray.forEach(item => {
        item.name = item.name.split(' '); 
    });
    return dataArray;
}

function updateChart(seriesData) {
    if (chart) {
        chart.updateSeries(seriesData);
    } else {
        var options = {
            chart: {
                type: 'bubble',
                height: '90%',
                width: '100%',
                id: 'myChart',
                animations: {
                    enabled: false,
                },
                toolbar: {
                    show: false
                }
            },
            grid: {
                show: true,
                xaxis: {
                    lines: {
                        show: true
                    }
                },   
                yaxis: {
                    lines: {
                        show: true
                    }
                }, 
            },
            dataLabels: {
                enabled: true,
                style: {
                    colors: ['white'],
                    fontSize: '15px',
                    fontWeight: '400',
                },
                formatter: function(val, opts) {
                    const dataPoint = opts.w.config.series[opts.seriesIndex].data[opts.dataPointIndex];
                    return dataPoint && dataPoint.name ? dataPoint.name : '';
                }
            },
            series: seriesData,
            xaxis: {
                min: 0.5,
                max: 3.5,
                tickAmount: 6,
                labels: {
                    formatter: function(val) {
                        if (val === 1) return 'More than 2 years';
                        if (val === 2) return '1-2 years';
                        if (val === 3) return 'Less than 1 year';
                        return '';
                    },
                    style: {
                        colors: colorText,
                        fontSize: '15px',
                    }
                },
                title: {
                    text: 'Velocity',
                    style: {
                        color: colorText,
                        fontSize: '20px',
                        fontWeight: '400',
                    }
                },
                axisTicks: {
                    show: true,
                    color: colorText
                },
                crosshairs: {
                    show: false
                },
            },
            yaxis: {
                max: 50,
                title: {
                    text: 'Probability',
                    style: {
                        color: colorText,
                        fontSize: '20px',
                        fontWeight: '400',
                    }
                },
                tickAmount: 5,
                labels: {
                    formatter: function(val) {
                        return val + '%';
                    },
                    style: {
                        colors: colorText,
                        fontSize: '15px',
                    }
                },
                axisTicks: {
                    show: true,
                    color: colorText
                },
            },
            plotOptions: {
                bubble: {
                    zScaling: false,
                }
            },
            tooltip: {
                enabled: false,
            },
            theme: {
                palette: ["#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF"]
            },
        };

        chart = new ApexCharts(document.querySelector("#chart"), options);
        chart.render();
    }
}


// Slider for adjusting bubble sizes
var slider = document.getElementById("myRange");
var output = document.getElementById("demo");
output.innerHTML = slider.value; // Display the default slider value

// Function to update the chart with new bubble sizes
function updateBubbleSizes(multiplier) {

    const newSeriesData = originalData.map(group => {
        var minSize = Math.min(...group.data.map(d => d.z));
        const adjustedData = group.data.map(item => ({
            x: item.x,
            y: item.y,
            z: (minSize + ((item.z - minSize) / downScallingFactor)) * multiplier,
            name: item.name,
        }));
        return {
            name: group.name,
            data: adjustedData
        };
    });
    
    chart.updateSeries(newSeriesData);
}

// Event listener for slider input
slider.oninput = function() {
    output.innerHTML = this.value;
    updateBubbleSizes(parseFloat(this.value)); // Convert slider value to float and update chart
};

document.getElementById('download-chart').addEventListener('click', function () {
    html2canvas(document.querySelector("#chart"), {backgroundColor: null}).then(canvas => {
        const imgURI = canvas.toDataURL("image/png");
        const a = document.createElement('a');
        a.href = imgURI;
        a.download = 'chart.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });
});