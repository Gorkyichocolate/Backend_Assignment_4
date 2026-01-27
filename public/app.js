let lineChart = null;
let barChart = null;

const fieldSelect = document.getElementById('fieldSelect');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const updateBtn = document.getElementById('updateBtn');
const errorToast = document.getElementById('errorMessage');

function toDateInputValue(date) {
    const tzOffsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffsetMs).toISOString().split('T')[0];
}

// Set default date range (last 30 days) using local date
const today = new Date();
const past30 = new Date();
past30.setDate(today.getDate() - 30);

startDateInput.value = toDateInputValue(past30);
endDateInput.value = toDateInputValue(today);

async function fetchData() {
    const field = fieldSelect.value;
    const start = startDateInput.value;
    const end = endDateInput.value;

    console.log('Fetching data:', { field, start, end });

    try {
        const [dataRes, metricsRes] = await Promise.all([
            fetch(`/api/measurements?field=${field}&start_date=${start}&end_date=${end}`),
            fetch(`/api/measurements/metrics?field=${field}&start_date=${start}&end_date=${end}`)
        ]);

        if (!dataRes.ok) {
            const error = await dataRes.json();
            throw new Error(error.error || 'Failed to fetch data');
        }

        if (!metricsRes.ok) {
            const error = await metricsRes.json();
            throw new Error(error.error || 'Failed to fetch metrics');
        }

        const data = await dataRes.json();
        const metrics = await metricsRes.json();

        console.log('Data received:', { data, metrics });

        updateCharts(data, field);
        updateMetrics(metrics.data);
        hideError();
    } catch (err) {
        console.error('Error:', err);
        showError(err.message);
    }
}

function updateCharts(data, field) {
    const labels = data.map(d => new Date(d.timestamp).toLocaleDateString('en-US'));
    const values = data.map(d => d[field]);

    if (lineChart) lineChart.destroy();
    const lineCtx = document.getElementById('lineChart').getContext('2d');
    lineChart = new Chart(lineCtx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: field,
                data: values,
                borderColor: '#333333',
                backgroundColor: 'rgba(51, 51, 51, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: true }
            },
            scales: {
                y: {
                    grid: { color: '#e0e0e0' },
                    ticks: { color: '#333333' }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#333333',
                        autoSkip: false,
                        maxRotation: 60,
                        minRotation: 45
                    }
                }
            }
        }
    });

    if (barChart) barChart.destroy();
    const barCtx = document.getElementById('barChart').getContext('2d');
    barChart = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: field,
                data: values,
                backgroundColor: 'rgba(51, 51, 51, 0.8)',
                borderRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: true }
            },
            scales: {
                y: {
                    grid: { color: '#e0e0e0' },
                    ticks: { color: '#333333' }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#333333',
                        autoSkip: false,
                        maxRotation: 60,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

function formatMetric(value) {
    return Number.isFinite(value) ? value.toFixed(2) : '-';
}

function updateMetrics(metrics) {
    document.getElementById('avgValue').textContent = formatMetric(metrics.average);
    document.getElementById('minValue').textContent = formatMetric(metrics.min);
    document.getElementById('maxValue').textContent = formatMetric(metrics.max);
    document.getElementById('stdDevValue').textContent = formatMetric(metrics.stdDev);
}

function showError(msg) {
    errorToast.textContent = msg;
    errorToast.style.display = 'block';
    setTimeout(hideError, 5000);
}

function hideError() {
    errorToast.style.display = 'none';
}

updateBtn.addEventListener('click', fetchData);

const weatherBtn = document.getElementById('weatherBtn');
const cityInput = document.getElementById('cityInput');
const weatherStatus = document.getElementById('weatherStatus');

weatherBtn.addEventListener('click', async () => {
    const city = cityInput.value;
    if (!city) {
        showError('Please enter a city');
        return;
    }

    const start = startDateInput.value;
    const end = endDateInput.value;
    if (!start || !end) {
        showError('Please select start and end dates');
        return;
    }

    weatherStatus.textContent = 'Recording...';
    try {
        const res = await fetch('/api/measurements/weather', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ city, start_date: start, end_date: end })
        });
        const result = await res.json();

        if (!res.ok) throw new Error(result.error);

        weatherStatus.textContent = `Success: Recorded ${result.data.temp}°C for ${result.data.city}`;
        cityInput.value = '';
        fetchData(); // Refresh dashboard
    } catch (err) {
        weatherStatus.textContent = '';
        showError(err.message);
    }
});

// Load initial data on page load
fetchData();
