let lineChart = null;
let barChart = null;

const fieldSelect = document.getElementById('fieldSelect');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const updateBtn = document.getElementById('updateBtn');
const errorToast = document.getElementById('errorMessage');

const today = new Date();
const past30 = new Date();
past30.setDate(today.getDate() - 30);

startDateInput.value = past30.toISOString().split('T')[0];
endDateInput.value = today.toISOString().split('T')[0];

async function fetchData() {
    const field = fieldSelect.value;
    const start = startDateInput.value;
    const end = endDateInput.value;

    try {
        const [dataRes, metricsRes] = await Promise.all([
            fetch(`/api/measurements?field=${field}&start_date=${start}&end_date=${end}`),
            fetch(`/api/measurements/metrics?field=${field}`)
        ]);

        const data = await dataRes.json();
        const metrics = await metricsRes.json();

        if (!dataRes.ok) throw new Error(data.error || 'Failed to fetch data');
        if (!metricsRes.ok) throw new Error(metrics.error || 'Failed to fetch metrics');

        updateCharts(data, field);
        updateMetrics(metrics.metrics);
        hideError();
    } catch (err) {
        showError(err.message);
    }
}

function updateCharts(data, field) {
    const labels = data.map(d => new Date(d.timestamp).toLocaleDateString());
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
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
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
                backgroundColor: 'rgba(16, 185, 129, 0.8)',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}

function updateMetrics(metrics) {
    document.getElementById('avgValue').textContent = metrics.average;
    document.getElementById('minValue').textContent = metrics.min;
    document.getElementById('maxValue').textContent = metrics.max;
    document.getElementById('stdDevValue').textContent = metrics.stdDev;
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
    if (!authToken) {
        showError('Пожалуйста, войдите в систему');
        return;
    }

    const city = cityInput.value;
    if (!city) return showError('Please enter a city');

    weatherStatus.textContent = 'Recording...';
    try {
        const res = await fetch('/api/measurements/weather', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ city })
        });
        const result = await res.json();

        if (!res.ok) throw new Error(result.error);

        weatherStatus.textContent = `Success: Recorded ${result.data.temp}°C for ${result.data.city}`;
        fetchData(); // Refresh dashboard
    } catch (err) {
        weatherStatus.textContent = '';
        showError(err.message);
    }
});

// Обработчики аутентификации
loginBtn.addEventListener('click', () => {
    loginModal.classList.remove('hidden');
});

registerBtn.addEventListener('click', () => {
    registerModal.classList.remove('hidden');
});

logoutBtn.addEventListener('click', () => {
    logout();
});

loginClose.addEventListener('click', () => {
    loginModal.classList.add('hidden');
});

registerClose.addEventListener('click', () => {
    registerModal.classList.add('hidden');
});

window.addEventListener('click', (e) => {
    if (e.target === loginModal) {
        loginModal.classList.add('hidden');
    }
    if (e.target === registerModal) {
        registerModal.classList.add('hidden');
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await login();
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await register();
});

// Функции аутентификации
async function login() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const res = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error);

        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('authToken', authToken);

        loginModal.classList.add('hidden');
        showUserInfo();
        fetchData();
    } catch (err) {
        showError(err.message);
    }
}

async function register() {
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    try {
        const res = await fetch('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error);

        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('authToken', authToken);

        registerModal.classList.add('hidden');
        showUserInfo();
        fetchData();
    } catch (err) {
        showError(err.message);
    }
}

async function verifyToken() {
    try {
        const res = await fetch('/auth/verify', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (res.ok) {
            const data = await res.json();
            currentUser = data.user;
            showUserInfo();
            fetchData();
        } else {
            logout();
        }
    } catch (err) {
        logout();
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    showAuthButtons();
    hideError();
    // Очистить графики
    if (lineChart) lineChart.destroy();
    if (barChart) barChart.destroy();
    document.getElementById('metricsDisplay').innerHTML = `
        <div class="metric-item">
            <span class="label">Average</span>
            <span class="value" id="avgValue">-</span>
        </div>
        <div class="metric-item">
            <span class="label">Minimum</span>
            <span class="value" id="minValue">-</span>
        </div>
        <div class="metric-item">
            <span class="label">Maximum</span>
            <span class="value" id="maxValue">-</span>
        </div>
        <div class="metric-item">
            <span class="label">Std. Deviation</span>
            <span class="value" id="stdDevValue">-</span>
        </div>
    `;
}

function showAuthButtons() {
    loginBtn.classList.remove('hidden');
    registerBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    userInfo.classList.add('hidden');
}

function showUserInfo() {
    loginBtn.classList.add('hidden');
    registerBtn.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
    userInfo.classList.remove('hidden');
    userInfo.textContent = `Привет, ${currentUser.username}!`;
}

// Обработчик для кнопки обновления
updateBtn.addEventListener('click', () => {
    if (!authToken) {
        showError('Пожалуйста, войдите в систему');
        return;
    }
    fetchData();
});

if (authToken) {
    verifyToken();
} else {
    showAuthButtons();
}
