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
    console.log(file);
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

    originalData = data.map(row => {
        return {
            name: row[headers.indexOf('Name')],
            velocity: parseFloat(row[headers.indexOf('Velocity')]),
            probability: parseFloat(row[headers.indexOf('Probability')]),
            size: parseFloat(row[headers.indexOf('Size')])
        };
    });

    // Split names into an array of words
    splitNames(originalData);

    // Find the smallest size in the dataset
    var minSize = Math.min(...originalData.map(d => d.size));

    // Convert data for ApexCharts
    var seriesData = originalData.map(d => ({
        x: d.velocity,
        y: d.probability,
        z: minSize + ((d.size - minSize) / downScallingFactor),
        name: d.name,
        originalSize: d.size
    }));

    updateChart(seriesData);
    // Call updateBubbleSizes on page load to set the correct initial size
    updateBubbleSizes(parseFloat(slider.value));
}

function splitNames(dataArray) {
    dataArray.forEach(item => {
        item.name = item.name.split(' ');  // Split the name into an array of words
    });
    return dataArray;
}

function updateChart(seriesData) {
    if (chart) {
        chart.updateSeries([{name: 'Size', data: seriesData}]);
    } else {
        var options = {
            chart: {
                type: 'bubble',
                height: '90%',
                width: '100%',
                id: 'myChart',  // Assigning an ID to the chart
                animations: {
                    enabled: false,
                },
                toolbar: {
                    show: false // Disable the toolbar
                }
            },
            dataLabels: {
                enabled: true,
                style: {
                    colors: [colorText],
                    fontSize: '15px',
                },
                formatter: function(val, opts) {
                    return opts.w.config.series[opts.seriesIndex].data[opts.dataPointIndex].name;
                }
            },
            series: [{
                name: 'Size',
                data: seriesData
            }],
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
                        fontSize: '15px',
                    }
                }
            },
            yaxis: {
                max: 50,
                title: {
                    text: 'Probability',
                    style: {
                        color: colorText,
                        fontSize: '15px',
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
                }
            },
            plotOptions: {
                bubble: {
                    zScaling: false,
                }
            },
            title: {
                text: 'Risk Analysis Bubble Chart',
                align: 'center',
                style: {
                    color: colorText,
                    fontSize: '24px',
                    fontWeight: 'bold'
                }
            },
            tooltip: {
                enabled: true,
                custom: function({ series, seriesIndex, dataPointIndex, w }) {
                    var data = w.config.series[seriesIndex].data[dataPointIndex];
                    return `
                        <div style="padding: 10px; background: rgba(255, 255, 255, 0.9); border: 1px solid #ccc; border-radius: 5px; display: flex; gap: 3px">
                            <div style="font-size: 16px; font-weight: bold; color: #333;">Bubble Size:</div>
                            <div style="font-size: 16px; color: #666;">${data.originalSize}</div>
                        </div>
                    `;
                }
            }
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
    var newSeriesData = originalData.map(item => {
        var minSize = Math.min(...originalData.map(d => d.size));
        return {
            x: item.velocity,
            y: item.probability,
            z: (minSize + ((item.size - minSize) / downScallingFactor)) * multiplier, // Adjust size based on the slider's value
            name: item.name,
            originalSize: item.size
        };
    });
    chart.updateSeries([{name: 'Size', data: newSeriesData}]);
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