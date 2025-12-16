// API Base URL
const API_URL = window.location.origin + '/api';

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const registerScreen = document.getElementById('registerScreen');
const mainContainer = document.querySelector('.container');

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');

const loginError = document.getElementById('loginError');
const registerError = document.getElementById('registerError');
const registerSuccess = document.getElementById('registerSuccess');

const logoutBtn = document.querySelector('.logout-btn');
const currentTimeDisplay = document.getElementById('currentTime');

const clockButtons = document.querySelectorAll('.clock-buttons .btn');
const statusBadge = document.querySelector('.status-badge');
const lastActionText = document.querySelector('.last-action');

const todayTableBody = document.querySelector('.main-content table tbody');
const historyTableBody = document.querySelector('.card:last-child table tbody');

const summaryCards = document.querySelectorAll('.summary-card .value');
const filterDate = document.querySelector('.filter-section input[type="date"]');
const filterMonth = document.querySelector('.filter-section select');
const filterBtn = document.querySelector('.filter-section .btn-primary');
const resetBtn = document.querySelector('.filter-section .btn-secondary');

// State
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
let currentStatus = '退勤中';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (authToken && currentUser) {
        showMainScreen();
    } else {
        showLoginScreen();
    }
    updateClock();
    setInterval(updateClock, 1000);
});

// Clock Update
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    currentTimeDisplay.textContent = timeString;
}

// Screen Navigation
function showLoginScreen() {
    loginScreen.classList.remove('hidden');
    registerScreen.classList.add('hidden');
    mainContainer.classList.add('hidden');
}

function showRegisterScreen() {
    loginScreen.classList.add('hidden');
    registerScreen.classList.remove('hidden');
    mainContainer.classList.add('hidden');
}

function showMainScreen() {
    loginScreen.classList.add('hidden');
    registerScreen.classList.add('hidden');
    mainContainer.classList.remove('hidden');
    loadTodayAttendance();
    loadAttendanceHistory();
    updateSummary();
    addExportButton();
}

// Event Listeners
showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    showRegisterScreen();
    clearMessages();
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginScreen();
    clearMessages();
});

loginForm.addEventListener('submit', handleLogin);
registerForm.addEventListener('submit', handleRegister);
logoutBtn.addEventListener('click', handleLogout);

clockButtons.forEach(btn => {
    btn.addEventListener('click', handleClockAction);
});

filterBtn.addEventListener('click', handleFilter);
resetBtn.addEventListener('click', handleReset);

// データエクスポート機能
function addExportButton() {
    const filterSection = document.querySelector('.filter-section');
    if (!filterSection) return;

    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn-success';
    exportBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        CSVエクスポート
    `;
    exportBtn.addEventListener('click', handleExport);
    filterSection.appendChild(exportBtn);
}

async function handleExport() {
    const month = filterMonth.value;
    const year = filterDate.value ? new Date(filterDate.value).getFullYear() : '';

    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (year) params.append('year', year);

    try {
        const response = await fetch(`${API_URL}/attendance/export?${params}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) {
            throw new Error('Export failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_${year || 'all'}_${month || 'all'}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        alert('エクスポートに失敗しました');
        console.error('Export error:', error);
    }
}

// Auth Functions
async function handleRegister(e) {
    e.preventDefault();
    clearMessages();

    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const passwordConfirm = document.getElementById('registerPasswordConfirm').value;

    if (password !== passwordConfirm) {
        showError(registerError, 'パスワードが一致しません');
        return;
    }

    if (password.length < 6) {
        showError(registerError, 'パスワードは6文字以上で入力してください');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            showSuccess(registerSuccess, '登録が完了しました。ログインしてください。');
            registerForm.reset();
            setTimeout(() => {
                showLoginScreen();
                clearMessages();
            }, 2000);
        } else {
            showError(registerError, data.error || '登録に失敗しました');
        }
    } catch (error) {
        console.error('Register error:', error);
        showError(registerError, 'サーバーとの通信に失敗しました。もう一度お試しください。');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    clearMessages();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showMainScreen();
        } else {
            showError(loginError, data.error || 'ログインに失敗しました');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError(loginError, 'サーバーとの通信に失敗しました。接続を確認してください。');
    }
}

function handleLogout() {
    if (confirm('ログアウトしますか?')) {
        authToken = null;
        currentUser = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        showLoginScreen();
    }
}

// Attendance Functions
async function handleClockAction(e) {
    const button = e.target;
    const type = button.textContent;
    const now = new Date();
    const time = now.toTimeString().split(' ')[0];

    try {
        button.disabled = true;
        const response = await fetch(`${API_URL}/attendance/clock`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ type, time })
        });

        const data = await response.json();

        if (response.ok) {
            updateStatus(type);
            loadTodayAttendance();
            loadAttendanceHistory();
            updateSummary();
        } else {
            alert(data.error || '打刻に失敗しました');
        }
    } catch (error) {
        alert('サーバーとの通信に失敗しました');
    } finally {
        button.disabled = false;
    }
}

function updateStatus(type) {
    currentStatus = type;
    statusBadge.className = 'status-badge';

    if (type === '出勤') {
        statusBadge.classList.add('working');
        statusBadge.textContent = '勤務中';
    } else if (type === '退勤') {
        statusBadge.classList.add('off');
        statusBadge.textContent = '退勤中';
    } else if (type === '休憩開始') {
        statusBadge.classList.add('break');
        statusBadge.textContent = '休憩中';
    } else if (type === '休憩終了') {
        statusBadge.classList.add('working');
        statusBadge.textContent = '勤務中';
    }

    const now = new Date();
    lastActionText.textContent = `最後の打刻: ${type} (${now.toLocaleTimeString('ja-JP')})`;
}

async function loadTodayAttendance() {
    try {
        const response = await fetch(`${API_URL}/attendance/today`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (response.ok) {
            if (data.details.length === 0) {
                todayTableBody.innerHTML = '<tr><td colspan="2">打刻データがありません</td></tr>';
            } else {
                todayTableBody.innerHTML = data.details.map(detail => `
                    <tr>
                        <td>${detail.type}</td>
                        <td>${detail.time}</td>
                    </tr>
                `).join('');

                const lastDetail = data.details[data.details.length - 1];
                updateStatus(lastDetail.type);
            }
        }
    } catch (error) {
        todayTableBody.innerHTML = '<tr><td colspan="2">データの読み込みに失敗しました</td></tr>';
    }
}

async function loadAttendanceHistory(filterParams = {}) {
    try {
        const response = await fetch(`${API_URL}/attendance/history`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (response.ok) {
            let records = data.records;

            if (filterParams.date) {
                records = records.filter(r => r.date === filterParams.date);
            }

            if (filterParams.month) {
                records = records.filter(r => r.date.substring(5, 7) === filterParams.month);
            }

            if (records.length === 0) {
                historyTableBody.innerHTML = '<tr><td colspan="5">データがありません</td></tr>';
            } else {
                historyTableBody.innerHTML = records.map(record => `
                    <tr>
                        <td>${record.date}</td>
                        <td>${record.clockIn || '-'}</td>
                        <td>${record.clockOut || '-'}</td>
                        <td>${record.breakTime || '0'} 分</td>
                        <td>${record.workHours || '-'} 時間</td>
                    </tr>
                `).join('');
            }
        }
    } catch (error) {
        historyTableBody.innerHTML = '<tr><td colspan="5">データの読み込みに失敗しました</td></tr>';
    }
}

async function updateSummary() {
    try {
        const response = await fetch(`${API_URL}/attendance/history`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (response.ok) {
            const now = new Date();
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();

            const monthRecords = data.records.filter(r => {
                const recordDate = new Date(r.date);
                return recordDate.getMonth() + 1 === currentMonth &&
                    recordDate.getFullYear() === currentYear;
            });

            const workDays = monthRecords.filter(r => r.clockIn).length;
            const totalHours = monthRecords.reduce((sum, r) => sum + (parseFloat(r.workHours) || 0), 0);
            const avgHours = workDays > 0 ? (totalHours / workDays).toFixed(1) : 0;

            summaryCards[0].textContent = `${workDays} 日`;
            summaryCards[1].textContent = `${totalHours.toFixed(1)} 時間`;
            summaryCards[2].textContent = `${avgHours} 時間`;
        }
    } catch (error) {
        console.error('Summary update failed:', error);
    }
}

function handleFilter() {
    const filterParams = {};

    if (filterDate.value) {
        filterParams.date = filterDate.value;
    }

    if (filterMonth.value) {
        filterParams.month = filterMonth.value;
    }

    loadAttendanceHistory(filterParams);
}

function handleReset() {
    filterDate.value = '';
    filterMonth.value = '';
    loadAttendanceHistory();
}

// Utility Functions
function showError(element, message) {
    element.textContent = message;
    element.style.display = 'block';
}

function showSuccess(element, message) {
    element.textContent = message;
    element.style.display = 'block';
}

function clearMessages() {
    loginError.style.display = 'none';
    registerError.style.display = 'none';
    registerSuccess.style.display = 'none';
}