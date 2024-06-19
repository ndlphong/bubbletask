// Some notes:
// - The code is written in vanilla JavaScript
// - The code uses the ApexCharts library for creating the bubble charts
// - The code uses the XLSX library for reading Excel files
// - The code uses the html2canvas library for downloading the charts as images
// - The code uses the CSS custom properties to get the colors and fonts from the CSS
// - The code uses the riskColors object to map the risks to colors
// - The downScallingFactor is fine tuned to the point where it looks right
// - The code uses the processChartData function to process the original data

// Changes upcoming:
// - Make texts align to the center of the bubbles
// - Edit the overlapping bubbles in the chart so the biggest bubble is always on the bottom

document.getElementById('upload').addEventListener('change', handleFile, false);

var chart, newChart;
var originalData = [], newOriginalData = [];
var sizeData = [], newSizeData = [];
let downScallingFactor = 1.3; // Fine tuned to the point where it looks right
let newDownScallingFactor = 1.7; // Fine tuned to the point where it looks right

let primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
let colorLabel = getComputedStyle(document.documentElement).getPropertyValue('--color-label').trim();
let colorText = getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim();
let labelColor = getComputedStyle(document.documentElement).getPropertyValue('--color-label').trim();
let fontFamily = getComputedStyle(document.documentElement).getPropertyValue('--font-family').trim();

// Define the color mapping
const riskColors = {
    "Accreditation": "#cc3300",
    "AI, Content and Channel": "#009900",
    "Capability": "#996633",
    "Competitive Marketplace": "#0000ff",
    "Customer Expectations": "#cc0099",
    "Portfolio": "#999966",
    "Reputation & Responsibility": "#009999"
};

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
        
        // Show the slider containers
        document.getElementById('slider-container').style.display = 'block';
        document.getElementById('new-slider-container').style.display = 'block';
        
        // Reset charts and related data
        resetCharts();
        
        // Process the jsonData to fit the chart data structure
        processChartData(jsonData);
        processNewChartData(jsonData); // For the new chart
    };
    reader.readAsArrayBuffer(file);
}

function resetCharts() {
    if (chart) {
        chart.destroy();
        chart = null;
    }
    if (newChart) {
        newChart.destroy();
        newChart = null;
    }
    originalData = [];
    newOriginalData = [];
    document.getElementById('myRange').value = 2.5;
    document.getElementById('demo').innerHTML = 2.5;
    document.getElementById('newRange').value = 2.5;
    document.getElementById('newDemo').innerHTML = 2.5;
}

function processChartData(jsonData) {
    // Original processChartData logic
    const headers = jsonData[0];
    const data = jsonData.slice(1);

    // Find the smallest size in the dataset directly from the data array
    const sizeIndex = headers.indexOf('Size');
    const minSize = Math.min(...data.map(row => parseFloat(row[sizeIndex])));
    sizeData = data.map(row => parseFloat(row[sizeIndex]));

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
            z: minSize + ((d.z - minSize) / newDownScallingFactor),
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
    updateChart(originalData);
    
    adjustSliderMaxValue("#chart", sizeData);

    // Call updateBubbleSizes on page load to set the correct initial size
    updateBubbleSizes(parseFloat(slider.value));
}

// Function to process the new chart data
function processNewChartData(jsonData) {
    const headers = jsonData[0];
    const data = jsonData.slice(1);

    const sizeIndex = headers.indexOf('Size');
    const velocityIndex = headers.indexOf('Velocity');
    const probabilityIndex = headers.indexOf('Probability');
    const riskIndex = headers.indexOf('Risks');

    const groupedData = {};
    data.forEach(row => {
        const risk = row[riskIndex];
        if (!groupedData[risk]) {
            groupedData[risk] = {
                names: [],
                velocities: [],
                probabilities: [],
                sizes: []
            };
        }
        groupedData[risk].names.push(row[headers.indexOf('Name')]);
        groupedData[risk].velocities.push(parseFloat(row[velocityIndex]));
        groupedData[risk].probabilities.push(parseFloat(row[probabilityIndex]));
        groupedData[risk].sizes.push(parseFloat(row[sizeIndex]));
    });

    // Calculate the minimum size across all data
    const size = data.map(row => parseFloat(row[sizeIndex]));
    const minSize = Math.min(...size);
    let sizeArr = [];

    const aggregatedData = Object.keys(groupedData).map(risk => {
        const dataArray = groupedData[risk];
        const highestVelocity = Math.max(...dataArray.velocities);
        const totalSize = dataArray.sizes.reduce((a, b) => a + b, 0);
        const averageProbability = dataArray.probabilities.reduce((a, b) => a + b, 0) / dataArray.probabilities.length;

        sizeArr.push(totalSize); // for restriction on the scalar line

        return {
            name: risk,
            data: [{
                x: highestVelocity,
                y: averageProbability,
                z: minSize + ((totalSize - minSize) / downScallingFactor), // Apply downscaling factor here
                name: risk.split(' ') // Split risk name for better display
            }]
        };
    });

    newSizeData = sizeArr;
    newOriginalData = aggregatedData;
    updateNewChart(aggregatedData);
    adjustSliderMaxValue("#new-chart", newSizeData);
    updateNewBubbleSizes(parseFloat(newSlider.value));
}

function updateChart(seriesData) {
    // Original updateChart logic
    const seriesColors = seriesData.map(serie => riskColors[serie.name]);

    if (chart) {
        chart.updateSeries(seriesData);
        chart.updateOptions({
            colors: seriesColors
        });
    } else {
        var options = {
            colors: seriesColors,

            chart: {
                type: 'bubble',
                height: '1080',
                width: '100%',
                id: 'myChart',
                animations: {
                    enabled: false,
                },
                toolbar: {
                    show: false
                },
                events: {
                    legendClick: function(chartContext, seriesIndex, config) {
                        setTimeout(() => centerTextLabels("#chart"), 0);
                    },
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
                textAnchor: 'middle',
                // offsetY: -15,
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
            legend: {
                fontSize: '15px',
                markers: {
                    width: 15,
                    height: 15,
                },
                itemMargin: {
                    horizontal: 8,
                }
            }
        };

        chart = new ApexCharts(document.querySelector("#chart"), options);
        chart.render();
    }
}

function updateNewChart(seriesData) {
    // New chart logic similar to updateChart
    const seriesColors = seriesData.map(serie => riskColors[serie.name]);

    if (newChart) {
        newChart.updateSeries(seriesData);
        newChart.updateOptions({
            colors: seriesColors
        });
    } else {
        var options = {
            colors: seriesColors,
            chart: {
                type: 'bubble',
                height: '900',
                width: '100%',
                id: 'myNewChart',
                animations: {
                    enabled: false,
                },
                toolbar: {
                    show: false
                },
                events: {
                    legendClick: function(chartContext, seriesIndex, config) {
                        setTimeout(() => centerTextLabels("#new-chart"), 0);
                    },
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
                // offsetY: -10,
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
            legend: {
                fontSize: '15px',
                markers: {
                    width: 15,
                    height: 15,
                },
                itemMargin: {
                    horizontal: 8,
                }
            }
        };
        newChart = new ApexCharts(document.querySelector("#new-chart"), options);
        newChart.render();

        
    }
}

// Slider for adjusting bubble sizes
var slider = document.getElementById("myRange");
var output = document.getElementById("demo");
output.innerHTML = slider.value; // Display the default slider value

var newSlider = document.getElementById("newRange");
var newOutput = document.getElementById("newDemo");
newOutput.innerHTML = newSlider.value; // Display the default slider value

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
    centerTextLabels("#chart");
}

// Function to update the new chart with new bubble sizes
function updateNewBubbleSizes(multiplier) {
    const newSeriesData = newOriginalData.map(group => {
        var minSize = Math.min(...group.data.map(d => d.z));
        const adjustedData = group.data.map(item => ({
            x: item.x,
            y: item.y,
            z: (minSize + ((item.z - minSize) / newDownScallingFactor)) * multiplier,
            name: item.name,
        }));
        return {
            name: group.name,
            data: adjustedData
        };
    });
    
    newChart.updateSeries(newSeriesData);
    centerTextLabels("#new-chart");
}

// Event listener for slider input
slider.oninput = function() {
    output.innerHTML = this.value;
    updateBubbleSizes(parseFloat(this.value)); // Convert slider value to float and update chart
};

newSlider.oninput = function() {
    newOutput.innerHTML = this.value;
    updateNewBubbleSizes(parseFloat(this.value)); // Convert slider value to float and update chart
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

// Event listener for the new chart download
document.getElementById('download-new-chart').addEventListener('click', function () {
    html2canvas(document.querySelector("#new-chart"), {backgroundColor: null}).then(canvas => {
        const imgURI = canvas.toDataURL("image/png");
        const a = document.createElement('a');
        a.href = imgURI;
        a.download = 'new-chart.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });
});


function centerTextLabels(chartTag){
    const chart = document.querySelector(chartTag);
	chart.querySelectorAll('.apexcharts-datalabels text').forEach(node => {
		const y0 = parseFloat(node.getAttribute("y"));
		let totalDy = 0;
		node.childNodes.forEach(
			childNode => {
				totalDy += parseFloat(childNode.getAttribute?.("dy") ?? "0");
			}
		);
		if(totalDy !== 0){
			node.setAttribute("y", (y0 - totalDy/2).toFixed(2));
		}
	});
    console.log(`Updated ${chartTag}`)
}

// Random function that finds the smallest text size in the chart
function getMinimumTextBoundingBoxSize(chartTag) {
    const chart = document.querySelector(chartTag);
    let minWidth = 0;
    let minHeight = 0;
    chart.querySelectorAll('.apexcharts-datalabels text').forEach(node => {
        const bbox = node.getBBox();
        if (bbox.width > minWidth) {
            minWidth = bbox.width;
        }
        if (bbox.height > minHeight) {
            minHeight = bbox.height;
        }
    });

    // Return the larger dimension to ensure both width and height fit
    console.log(`Width: ${minWidth}, Height: ${minHeight}, MIN: ${Math.max(minWidth, minHeight)}`);
    return Math.max(minWidth, minHeight);
}

let resizeTimeout;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        centerTextLabels("#chart");
        centerTextLabels("#new-chart");
    }, 200); // Adjust the delay as needed
});


function determineMaxScalingFactor(chartTag, sizeData) {
    const minTextSize = getMinimumTextBoundingBoxSize(chartTag);

    console.log(sizeData);
    // Find the smallest bubble size from the original data
    minBubbleSize = Math.min(...sizeData) * 2;

    console.log(`${minTextSize}, ${minBubbleSize}`)

    // Calculate the maximum scaling factor that keeps the minimum bubble size >= minTextSize
    return minTextSize * Math.sqrt(2) / (minBubbleSize);
}

function adjustSliderMaxValue(chartTag, sizeData) {
    const minScalingFactor = determineMaxScalingFactor(chartTag, sizeData);
    const maxScalingFactor = minScalingFactor + 3;
    const defaultScalingFactor = minScalingFactor + 0.2;

    const slider = document.querySelector(`${chartTag} ~ .slidecontainer .slider`);
    const output = document.querySelector(`${chartTag} ~ .slidecontainer .slider-text span`);

    slider.min = minScalingFactor.toFixed(1);
    slider.max = maxScalingFactor.toFixed(1);
    slider.value = defaultScalingFactor.toFixed(1);
    output.innerHTML = defaultScalingFactor.toFixed(1);

    console.log(`Slider adjusted: min=${slider.min}, max=${slider.max}, value=${slider.value}`);
}

