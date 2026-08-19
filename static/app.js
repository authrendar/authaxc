// State Management
let licensesList = [];
let usersList = [];
let appsList = [];
let logsList = [];
let activeAppId = null;

// DOM Elements
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const adminDisplayName = document.getElementById('admin-display-name');
const logoutBtn = document.getElementById('logout-btn');
const refreshBtn = document.getElementById('refresh-btn');

// App Selector Elements
const appSelector = document.getElementById('app-selector');
const btnCreateAppModal = document.getElementById('btn-create-app-modal');
const createAppModal = document.getElementById('create-app-modal');
const btnCloseAppModal = document.getElementById('btn-close-app-modal');
const createAppForm = document.getElementById('create-app-form');
const newAppName = document.getElementById('new-app-name');
const btnDeleteApp = document.getElementById('btn-delete-app');

// User Management Elements
const userTableBody = document.getElementById('user-table-body');
const noUsersMsg = document.getElementById('no-users-msg');
const userSearchInput = document.getElementById('user-search-input');
const btnCreateUserModal = document.getElementById('btn-create-user-modal');
const createUserModal = document.getElementById('create-user-modal');

// Logs Management Elements
const logsTableBody = document.getElementById('logs-table-body');
const noLogsMsg = document.getElementById('no-logs-msg');
const btnCloseUserModal = document.getElementById('btn-close-user-modal');
const createUserForm = document.getElementById('create-user-form');
const newUsername = document.getElementById('new-username');
const newPassword = document.getElementById('new-password');
const userDuration = document.getElementById('user-duration');
const userNote = document.getElementById('user-note');

// App Info & Settings Elements
const activeAppTitle = document.getElementById('active-app-title');
const activeAppNames = document.querySelectorAll('.active-app-name-display');
const settingsAppName = document.getElementById('settings-app-name');
const settingsAppId = document.getElementById('settings-app-id');
const settingsAppSecret = document.getElementById('settings-app-secret');
const btnToggleSecret = document.getElementById('btn-toggle-secret');

// Stats Elements
const statTotalApps = document.getElementById('stat-total-apps');
const statActiveApps = document.getElementById('stat-active-apps');
const statActiveSessions = document.getElementById('stat-active-sessions');

// Search and Filter Elements
const searchInput = document.getElementById('search-input');
const filterStatus = document.getElementById('filter-status');
const licenseTableBody = document.getElementById('license-table-body');
const noLicensesMsg = document.getElementById('no-licenses-msg');

// Tabs
const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');

// Generate Form / Modal Elements
const generateForm = document.getElementById('generate-form');
const durationSelect = document.getElementById('duration');
const countInput = document.getElementById('count');
const noteInput = document.getElementById('note');
const generatedKeysWrapper = document.getElementById('generated-keys-wrapper');
const generatedKeysList = document.getElementById('generated-keys-list');
const copyAllBtn = document.getElementById('copy-all-btn');
const generateKeysModal = document.getElementById('generate-keys-modal');
const btnGenerateKeysModal = document.getElementById('btn-generate-keys-modal');
const btnCloseGenerateModal = document.getElementById('btn-close-generate-modal');

// Toast Element
const toast = document.getElementById('toast');

// Error message parser for FastAPI validation errors
function getErrorMessage(data, defaultMsg = 'An error occurred.') {
    if (!data) return defaultMsg;
    if (typeof data === 'string') return data;
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail)) {
        return data.detail.map(err => {
            const field = err.loc ? err.loc[err.loc.length - 1] : '';
            return field ? `${field}: ${err.msg}` : err.msg;
        }).join(', ');
    }
    if (data.detail && typeof data.detail === 'object') {
        return JSON.stringify(data.detail);
    }
    return data.message || defaultMsg;
}

// Notification Store
let notificationsList = [];

function addSystemNotification(msg, isError = false) {
    const text = getErrorMessage(msg, 'System event logged.');
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const notif = { id: Date.now(), text, isError, time: now };
    notificationsList.unshift(notif);
    
    // Limit to 20 notifications
    if (notificationsList.length > 20) notificationsList.pop();
    
    renderNotifications();
}

function renderNotifications() {
    const listEl = document.getElementById('notification-list');
    const badgeEl = document.getElementById('notification-badge');
    
    if (!listEl || !badgeEl) return;
    
    if (notificationsList.length === 0) {
        listEl.innerHTML = '<div class="notification-empty">No new notifications</div>';
        badgeEl.classList.add('hidden');
        badgeEl.textContent = '0';
        return;
    }
    
    badgeEl.classList.remove('hidden');
    badgeEl.textContent = notificationsList.length;
    
    listEl.innerHTML = notificationsList.map(n => `
        <div class="notification-item">
            <div class="notification-icon ${n.isError ? 'error' : 'success'}">
                <i class="fa-solid ${n.isError ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i>
            </div>
            <div>
                <div class="notification-text">${n.text}</div>
                <div class="notification-time">${n.time}</div>
            </div>
        </div>
    `).join('');
}

// Modern Toast Notification System
function showToast(message, isError = false) {
    const cleanMsg = getErrorMessage(message, 'An error occurred');
    const container = document.getElementById('toast-container');
    if (container) {
        const toastEl = document.createElement('div');
        toastEl.className = `toast ${isError ? 'error' : 'success'}`;
        toastEl.innerHTML = `
            <i class="fa-solid ${isError ? 'fa-triangle-exclamation text-rose' : 'fa-circle-check text-emerald'}"></i>
            <span style="flex:1;">${cleanMsg}</span>
        `;
        container.appendChild(toastEl);
        setTimeout(() => {
            toastEl.style.opacity = '0';
            toastEl.style.transform = 'translateY(10px)';
            toastEl.style.transition = 'all 0.25s ease';
            setTimeout(() => toastEl.remove(), 250);
        }, 3200);
    }
    addSystemNotification(cleanMsg, isError);
}
window.showToast = showToast;

// Telemetry & Activations Analytics Canvas Chart
function renderAnalyticsChart() {
    const canvas = document.getElementById('analytics-chart-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);
    
    const days = 7;
    const labels = [];
    const points = [];
    
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString([], { weekday: 'short' }));
        const dayStr = d.toISOString().split('T')[0];
        let count = 0;
        if (licensesList && licensesList.length) {
            licensesList.forEach(l => {
                if (l.created_at && l.created_at.startsWith(dayStr)) count++;
            });
        }
        points.push(count);
    }
    
    const maxVal = Math.max(5, ...points);
    const paddingBottom = 30;
    const paddingTop = 20;
    const paddingLeft = 30;
    const paddingRight = 20;
    const chartW = width - paddingLeft - paddingRight;
    const chartH = height - paddingTop - paddingBottom;
    
    // Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = paddingTop + (chartH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(width - paddingRight, y);
        ctx.stroke();
    }
    
    const coords = points.map((val, idx) => {
        const x = paddingLeft + (chartW / (points.length - 1)) * idx;
        const y = paddingTop + chartH - (val / maxVal) * chartH;
        return { x, y, val };
    });
    
    // Gradient Area
    ctx.beginPath();
    ctx.moveTo(coords[0].x, coords[0].y);
    for (let i = 1; i < coords.length; i++) {
        const prev = coords[i - 1];
        const curr = coords[i];
        const cpX = (prev.x + curr.x) / 2;
        ctx.bezierCurveTo(cpX, prev.y, cpX, curr.y, curr.x, curr.y);
    }
    ctx.lineTo(coords[coords.length - 1].x, paddingTop + chartH);
    ctx.lineTo(coords[0].x, paddingTop + chartH);
    ctx.closePath();
    
    const grad = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartH);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
    ctx.fillStyle = grad;
    ctx.fill();
    
    // Smooth Line
    ctx.beginPath();
    ctx.moveTo(coords[0].x, coords[0].y);
    for (let i = 1; i < coords.length; i++) {
        const prev = coords[i - 1];
        const curr = coords[i];
        const cpX = (prev.x + curr.x) / 2;
        ctx.bezierCurveTo(cpX, prev.y, cpX, curr.y, curr.x, curr.y);
    }
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    
    // Points & Labels
    coords.forEach((pt, idx) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#08090D';
        ctx.stroke();
        
        ctx.fillStyle = '#64748b';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(labels[idx], pt.x, height - 10);
    });
}
window.renderAnalyticsChart = renderAnalyticsChart;
window.addEventListener('resize', () => {
    if (document.getElementById('tab-overview')?.classList.contains('active-content')) {
        renderAnalyticsChart();
    }
});

// Initial Authentication Check
async function checkAuth() {
    try {
        const response = await fetch('/api/admin/apps');
        if (response.ok) {
            appsList = await response.json();
            showDashboard();
        } else {
            showLogin();
        }
    } catch (error) {
        showLogin();
    }
}

// UI Transition Helpers
function showLogin() {
    dashboardView.classList.add('hidden');
    loginView.classList.remove('hidden');
    if (loginError) loginError.classList.add('hidden');
    if (authLoginForm) authLoginForm.reset();
    if (authRegisterForm) authRegisterForm.reset();
}

async function showDashboard() {
    loginView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    
    const savedAdmin = localStorage.getItem('admin_user') || 'Admin';
    adminDisplayName.textContent = savedAdmin;
    
    await fetchApps();
    switchTab('overview');
}

// Switch tabs logic
function switchTab(tabId) {
    navItems.forEach(item => {
        if (item.getAttribute('data-tab') === tabId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    tabContents.forEach(content => {
        if (content.id === `tab-${tabId}`) {
            content.classList.add('active-content');
            content.classList.remove('hidden');
        } else {
            content.classList.remove('active-content');
            content.classList.add('hidden');
        }
    });

    if (tabId === 'overview') {
        fetchStats();
        setTimeout(renderAnalyticsChart, 50);
    } else if (tabId === 'settings') {
        fetch2FAStatus();
        fetchDbStatus();
    }
}

async function fetchDbStatus() {
    try {
        const res = await fetch('/api/admin/system/db_status');
        if (res.ok) {
            const data = await res.json();
            const activeDbEl = document.getElementById('diag-active-db');
            const listEl = document.getElementById('diag-cluster-dbs');
            if (activeDbEl) activeDbEl.textContent = data.current_database || 'N/A';
            if (listEl && data.cluster_databases) {
                listEl.innerHTML = data.cluster_databases.map(d => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: var(--radius-sm);">
                        <div>
                            <span class="font-mono font-bold" style="color: ${d.is_current ? 'var(--accent)' : 'var(--text-primary)'};">${d.name}</span>
                            ${d.is_current ? '<span class="badge badge-active" style="margin-left: 8px;">CONNECTED</span>' : ''}
                        </div>
                        <div style="font-size: 0.82rem; color: var(--text-muted); display: flex; gap: 14px;">
                            <span>Apps: <strong style="color:var(--text-primary);">${d.apps_count}</strong></span>
                            <span>Licenses: <strong style="color:var(--text-primary);">${d.licenses_count}</strong></span>
                            <span>Users: <strong style="color:var(--text-primary);">${d.users_count}</strong></span>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch(e) {
        console.error('Failed to fetch DB status:', e);
    }
}
window.fetchDbStatus = fetchDbStatus;

// Global Escape Key Listener for Modals & Mobile Drawer
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay:not(#login-view)').forEach(modal => {
            modal.classList.add('hidden');
        });
        toggleMobileSidebar(false);
    }
});



// Fetch all applications
async function fetchApps() {
    try {
        const response = await fetch('/api/admin/apps');
        if (response.ok) {
            appsList = await response.json();
            renderAppSelector();
        } else if (response.status === 401) {
            showLogin();
        }
    } catch (e) {
        showToast('Failed to fetch applications.', true);
    }
}

// Populate application selector dropdown
function renderAppSelector() {
    appSelector.innerHTML = '';
    const listContainer = document.getElementById('applications-list-container');
    if(listContainer) listContainer.innerHTML = '';
    
    if (appsList.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '-- Create an App first --';
        appSelector.appendChild(option);
        
        if (activeAppTitle) activeAppTitle.textContent = '---';
        if (activeAppNames) activeAppNames.forEach(el => el.textContent = '---');
        
        if (settingsAppName) {
            settingsAppName.value = '';
            settingsAppName.textContent = '---';
        }
        if (settingsAppId) {
            settingsAppId.value = '';
            settingsAppId.textContent = '---';
        }
        if (settingsAppSecret) {
            settingsAppSecret.value = '';
            settingsAppSecret.textContent = '---';
        }
        window.rawClientSecret = '';
        
        if(statTotalApps) statTotalApps.textContent = '0';
        if(statActiveApps) statActiveApps.textContent = '0';
        
        if(listContainer) {
            listContainer.innerHTML = `
                <div style="padding: 24px; text-align: center; background: rgba(255,255,255,0.02); border: 1px dashed var(--border); border-radius: var(--radius-sm);">
                    <i class="fa-solid fa-cube text-cyan" style="font-size: 1.8rem; margin-bottom: 8px; display: block;"></i>
                    <span style="font-weight: 600; display: block; margin-bottom: 4px;">No Applications Found</span>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px;">Create your first application to start generating license keys.</p>
                    <button class="btn btn-primary btn-sm" onclick="document.getElementById('btn-create-app-modal')?.click()"><i class="fa-solid fa-plus"></i> Create Application</button>
                </div>
            `;
        }
        
        licensesList = [];
        usersList = [];
        renderLicensesTable();
        renderUsersTable();
        return;
    }
    
    if(statTotalApps) statTotalApps.textContent = appsList.length;
    if(statActiveApps) statActiveApps.textContent = appsList.length; // Assume all active for now
    
    appsList.forEach(app => {
        const option = document.createElement('option');
        option.value = app.id;
        option.textContent = app.name;
        appSelector.appendChild(option);
        
        if(listContainer) {
            const isSelected = activeAppId === app.id;
            const card = document.createElement('div');
            card.className = 'app-card';
            card.innerHTML = `
                <div class="app-card-top">
                    <span class="app-card-title">${app.name}</span>
                    <span class="status-badge active">Active</span>
                </div>
                <div class="app-stats-row">
                    <div class="app-stat-col"><span>App Version</span><strong>1.0</strong></div>
                    <div class="app-stat-col"><span>Users</span><strong>---</strong></div>
                    <div class="app-stat-col"><span>Application Standing</span><strong>Good</strong></div>
                </div>
                <div class="app-actions">
                    ${isSelected ? '<button class="btn btn-green"><i class="fa-solid fa-file"></i> Selected</button>' : `<button class="btn btn-secondary" onclick="selectApp('${app.id}')">Select</button>`}
                    <button class="btn btn-purple" onclick="renameAppPrompt('${app.id}', '${app.name}')"><i class="fa-solid fa-pen-to-square"></i> Rename</button>
                    <button class="btn btn-teal"><i class="fa-solid fa-pen-to-square"></i> Edit Description</button>
                    <button class="btn btn-orange"><i class="fa-solid fa-circle-pause"></i> Pause</button>
                    <button class="btn btn-red" onclick="deleteAppWithConfirm('${app.id}', '${app.name}')"><i class="fa-solid fa-trash-can"></i> Delete</button>
                </div>
            `;
            listContainer.appendChild(card);
        }
    });
    
    if (!activeAppId || !appsList.find(a => a.id === activeAppId)) {
        activeAppId = appsList[0].id;
    }
    
    appSelector.value = activeAppId;
    updateActiveAppDisplay();
}

window.selectApp = function(id) {
    activeAppId = id;
    appSelector.value = id;
    updateActiveAppDisplay();
    renderAppSelector(); // re-render to update the Selected button state
};

window.renameAppPrompt = async function(id, oldName) {
    const newName = prompt('Enter new application name:', oldName);
    if(newName && newName.trim() !== '' && newName !== oldName) {
        try {
            const response = await fetch(`/api/admin/apps/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName.trim() })
            });
            if(response.ok) {
                showToast('Application renamed successfully');
                await fetchApps();
            } else {
                showToast('Failed to rename application', true);
            }
        } catch(e) {
            showToast('Server error', true);
        }
    }
};

window.deleteAppWithConfirm = async function(id, name) {
    if(confirm(`Are you sure you want to delete "${name}"? This is permanent.`)) {
        try {
            const response = await fetch(`/api/admin/apps/${id}`, { method: 'DELETE' });
            if(response.ok) {
                showToast('Application deleted successfully');
                if(activeAppId === id) activeAppId = null;
                await fetchApps();
            } else {
                showToast('Failed to delete application', true);
            }
        } catch(e) {
            showToast('Server error', true);
        }
    }
};

// License Table State
let selectedLicenseKeys = new Set();
let licenseCurrentPage = 1;
let licensePerPage = 25;
let expiringLicensesList = [];

// Stats Helper - Fetches live aggregated dashboard metrics
async function fetchStats() {
    if (!activeAppId) return;
    try {
        const response = await fetch(`/api/admin/stats?app_id=${activeAppId}`);
        if (response.ok) {
            const data = await response.json();
            const s = data.stats || {};
            
            const totalLicEl = document.getElementById('stat-total-licenses');
            const activeLicEl = document.getElementById('stat-active-licenses');
            const unusedLicEl = document.getElementById('stat-unused-licenses');
            const expiredLicEl = document.getElementById('stat-expired-licenses');
            const bannedLicEl = document.getElementById('stat-banned-licenses');
            const pausedLicEl = document.getElementById('stat-paused-licenses');
            const sessionsEl = document.getElementById('stat-active-sessions');
            const todayActEl = document.getElementById('stat-today-activations');
            const expiringEl = document.getElementById('stat-expiring-soon');
            
            if (totalLicEl) totalLicEl.textContent = s.total_licenses || 0;
            if (activeLicEl) activeLicEl.textContent = s.active_licenses || 0;
            if (unusedLicEl) unusedLicEl.textContent = s.unused_licenses || 0;
            if (expiredLicEl) expiredLicEl.textContent = s.expired_licenses || 0;
            if (bannedLicEl) bannedLicEl.textContent = s.banned_licenses || 0;
            if (pausedLicEl) pausedLicEl.textContent = s.paused_licenses || 0;
            if (sessionsEl) sessionsEl.textContent = s.active_sessions || 0;
            if (todayActEl) todayActEl.textContent = s.today_activations || 0;
            if (expiringEl) expiringEl.textContent = s.expiring_soon || 0;
            renderAnalyticsChart();
        }
    } catch(e) {
        console.error('Failed to fetch stats:', e);
    }
}

// Update UI displays based on selected app
function updateActiveAppDisplay() {
    const activeApp = appsList.find(a => a.id === activeAppId);
    if (!activeApp) return;
    
    if (activeAppTitle) activeAppTitle.textContent = activeApp.name;
    if (activeAppNames) activeAppNames.forEach(el => el.textContent = activeApp.name);
    
    // Update settings credentials
    if (settingsAppName) {
        settingsAppName.value = activeApp.name;
        settingsAppName.textContent = activeApp.name;
    }
    if (settingsAppId) {
        settingsAppId.value = activeApp.id;
        settingsAppId.textContent = activeApp.id;
    }
    document.querySelectorAll('.active-app-id-text').forEach(el => el.textContent = activeApp.id);
    document.querySelectorAll('.api-domain-text').forEach(el => el.textContent = window.location.origin);
    window.rawClientSecret = activeApp.secret;
    
    // Update prefix in generate modal from app rules
    const genPrefixInput = document.getElementById('gen-custom-prefix');
    if (genPrefixInput && (!genPrefixInput.value || genPrefixInput.value === 'AXC' || genPrefixInput.value === 'AnikXCheats')) {
        genPrefixInput.value = (activeApp.rules && activeApp.rules.key_prefix) ? activeApp.rules.key_prefix : 'AXC';
    }
    
    // Mask the secret by default
    if (settingsAppSecret) {
        settingsAppSecret.value = activeApp.secret;
        settingsAppSecret.textContent = activeApp.secret;
        settingsAppSecret.type = 'password';
    }

    if (btnToggleSecret && settingsAppSecret) {
        btnToggleSecret.onclick = () => {
            if (settingsAppSecret.type === 'password') {
                settingsAppSecret.type = 'text';
                btnToggleSecret.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
            } else {
                settingsAppSecret.type = 'password';
                btnToggleSecret.innerHTML = '<i class="fa-solid fa-eye"></i>';
            }
        };
    }
    
    window.copyToClipboard = function(elementId, isSecret = false) {
        const el = document.getElementById(elementId);
        if(el) {
            let text = (el.value !== undefined && el.value !== '') ? el.value : el.textContent;
            if(isSecret && window.rawClientSecret) {
                text = window.rawClientSecret;
            }
            navigator.clipboard.writeText(text || '');
            showToast('Copied to clipboard!');
        }
    };
    
    // Refresh stats
    fetchStats();
    
    // Refresh current tab data
    const activeNav = document.querySelector('.nav-item.active');
    const activeTab = activeNav ? activeNav.getAttribute('data-tab') : 'overview';
    if (activeTab === 'overview') {
        fetchLicenses();
        fetchUsers();
    } else if (activeTab === 'licenses') {
        fetchLicenses();
    } else if (activeTab === 'expiring-soon') {
        fetchExpiringSoon();
    } else if (activeTab === 'users') {
        fetchUsers();
    } else if (activeTab === 'logs') {
        fetchLogs();
    } else if (activeTab === 'web-admins') {
        fetchPlatformAdmins();
    } else if (activeTab === 'variables') {
        fetchVariables();
    } else if (activeTab === 'webhooks') {
        fetchWebhooks();
    } else if (activeTab === 'subscriptions') {
        fetchSubscriptions();
    } else if (activeTab === 'tokens') {
        fetchTokens();
        populateSubscriptionSelects();
    } else if (activeTab === 'settings') {
        fetch2FAStatus();
    } else if (activeTab === 'sessions') {
        fetchSessions();
    } else if (activeTab === 'files') {
        fetchFiles();
    } else if (activeTab === 'chats') {
        fetchChats();
    } else if (activeTab === 'rules') {
        fetchRules();
    } else if (activeTab === 'resources') {
        fetchResources();
    }
}

// Fetch license keys for active app
async function fetchLicenses() {
    if (!activeAppId) return;
    
    try {
        const response = await fetch(`/api/admin/licenses?app_id=${activeAppId}`);
        if (response.ok) {
            licensesList = await response.json();
            renderLicensesTable();
            fetchStats();
        } else if (response.status === 401) {
            showToast('Session expired! Please login again.', true);
            showLogin();
        } else {
            showToast('Failed to fetch licenses.', true);
        }
    } catch (error) {
        showToast('Server connection error!', true);
    }
}

// Helper to format remaining time string
function formatRemainingTime(expiresAt, status) {
    if (status === 'BANNED') return '<span class="badge badge-banned">Banned</span>';
    if (status === 'REVOKED') return '<span class="badge badge-revoked">Revoked</span>';
    if (status === 'PAUSED') return '<span class="badge badge-paused">Paused</span>';
    if (!expiresAt) return '<span class="text-cyan">Unused</span>';
    if (expiresAt === 'Lifetime') return '<span class="text-emerald font-bold">Lifetime</span>';
    
    try {
        const exp = new Date(expiresAt).getTime();
        const now = Date.now();
        const diffMs = exp - now;
        
        if (diffMs <= 0) return '<span class="text-red">Expired</span>';
        
        const totalSeconds = Math.floor(diffMs / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        
        if (days > 0) {
            return `<span class="text-emerald font-bold">${days}d ${hours.toString().padStart(2, '0')}h</span>`;
        } else if (hours > 0) {
            return `<span class="text-orange font-bold">${hours}h ${minutes.toString().padStart(2, '0')}m</span>`;
        } else {
            return `<span class="text-red font-bold">${minutes}m</span>`;
        }
    } catch(e) {
        return 'N/A';
    }
}

// Render Licenses in UI with Filter, Search, Bulk selection & Pagination
function renderLicensesTable() {
    if (!licenseTableBody) return;
    licenseTableBody.innerHTML = '';
    
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const statusFilter = filterStatus ? filterStatus.value.toLowerCase() : 'all';
    
    const filtered = licensesList.filter(lic => {
        const status = (lic.status || 'UNUSED').toLowerCase();
        
        // Search filter
        const matchesSearch = !query || 
            (lic.key && lic.key.toLowerCase().includes(query)) ||
            (lic.used_by && lic.used_by.toLowerCase().includes(query)) ||
            (lic.hwid && lic.hwid.toLowerCase().includes(query)) ||
            (lic.note && lic.note.toLowerCase().includes(query));
            
        // Status filter
        let matchesStatus = true;
        if (statusFilter !== 'all') {
            if (statusFilter === 'used') {
                matchesStatus = lic.is_used === true;
            } else {
                matchesStatus = status === statusFilter;
            }
        }
        
        return matchesSearch && matchesStatus;
    });
    
    // Pagination calculation
    const totalCount = filtered.length;
    const perPageSelect = document.getElementById('licenses-per-page');
    if (perPageSelect) licensePerPage = parseInt(perPageSelect.value) || 25;
    
    const totalPages = Math.max(1, Math.ceil(totalCount / licensePerPage));
    if (licenseCurrentPage > totalPages) licenseCurrentPage = totalPages;
    if (licenseCurrentPage < 1) licenseCurrentPage = 1;
    
    const startIndex = (licenseCurrentPage - 1) * licensePerPage;
    const paginatedItems = filtered.slice(startIndex, startIndex + licensePerPage);
    
    // Update pagination controls
    const pagInfoEl = document.getElementById('licenses-pagination-info');
    const pagBtnsEl = document.getElementById('licenses-pagination-buttons');
    if (pagInfoEl) {
        pagInfoEl.textContent = totalCount === 0 
            ? 'Showing 0 to 0 of 0 licenses' 
            : `Showing ${startIndex + 1} to ${Math.min(startIndex + licensePerPage, totalCount)} of ${totalCount} licenses`;
    }
    
    if (pagBtnsEl) {
        pagBtnsEl.innerHTML = `
            <button class="btn-page" onclick="changeLicensePage(${licenseCurrentPage - 1})" ${licenseCurrentPage <= 1 ? 'disabled' : ''}>
                <i class="fa-solid fa-chevron-left"></i>
            </button>
            <span style="font-size:0.8rem; padding: 4px 8px; color:var(--text-main); font-weight:600;">Page ${licenseCurrentPage} / ${totalPages}</span>
            <button class="btn-page" onclick="changeLicensePage(${licenseCurrentPage + 1})" ${licenseCurrentPage >= totalPages ? 'disabled' : ''}>
                <i class="fa-solid fa-chevron-right"></i>
            </button>
        `;
    }
    
    updateBulkActionBar();
    
    const mobileContainer = document.getElementById('mobile-licenses-list');
    if (mobileContainer) mobileContainer.innerHTML = '';
    
    if (filtered.length === 0) {
        if (noLicensesMsg) noLicensesMsg.classList.remove('hidden');
    } else {
        if (noLicensesMsg) noLicensesMsg.classList.add('hidden');
        
        paginatedItems.forEach(lic => {
            const tr = document.createElement('tr');
            const isSelected = selectedLicenseKeys.has(lic.key);
            const status = lic.status || 'UNUSED';
            
            let expiryText = '—';
            if (lic.expires_at) {
                if (lic.expires_at === 'Lifetime') {
                    expiryText = '<span class="text-emerald font-semibold">Lifetime</span>';
                } else {
                    const date = new Date(lic.expires_at);
                    expiryText = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                }
            }
            
            let statusBadge = `<span class="badge badge-${status.toLowerCase()}">${status}</span>`;
            const remainingDisplay = formatRemainingTime(lic.expires_at, status);
            
            // Format duration string
            let durationText = 'Lifetime';
            if (lic.duration_days && lic.duration_days > 0) {
                if (lic.duration_days >= 1) {
                    durationText = `${Number.isInteger(lic.duration_days) ? lic.duration_days : lic.duration_days.toFixed(1)} Days`;
                } else {
                    const hours = Math.round(lic.duration_days * 24);
                    durationText = `${hours} Hours`;
                }
            }
            
            // Actions
            const pauseBtn = lic.is_paused 
                ? `<button onclick="togglePauseLicense('${lic.key}', true)" class="btn-action reset-btn" title="Unpause License"><i class="fa-solid fa-play"></i></button>`
                : `<button onclick="togglePauseLicense('${lic.key}', false)" class="btn-action" title="Pause License"><i class="fa-solid fa-pause"></i></button>`;
                
            const banBtn = lic.is_banned
                ? `<button onclick="toggleBanLicense('${lic.key}', true)" class="btn-action reset-btn" title="Unban License"><i class="fa-solid fa-unlock"></i></button>`
                : `<button onclick="toggleBanLicense('${lic.key}', false)" class="btn-action ban-btn" title="Ban License"><i class="fa-solid fa-ban"></i></button>`;
                
            const resetHwidBtn = lic.hwid 
                ? `<button onclick="resetHwid('${lic.key}')" class="btn-action" title="Reset HWID"><i class="fa-solid fa-arrows-rotate"></i></button>`
                : '';
                
            const extendBtn = `<button onclick="showExtendModal('${lic.key}')" class="btn-action reset-btn" title="Extend Duration"><i class="fa-solid fa-clock-rotate-left"></i></button>`;
            const detailBtn = `<button onclick="showLicenseDetails('${lic.key}')" class="btn-action" title="View Full Details"><i class="fa-solid fa-eye"></i></button>`;
            const deleteBtn = `<button onclick="deleteLicense('${lic.key}')" class="btn-action ban-btn" title="Delete License"><i class="fa-solid fa-trash-can"></i></button>`;
            
            tr.innerHTML = `
                <td style="text-align:center;">
                    <input type="checkbox" class="license-checkbox" data-key="${lic.key}" ${isSelected ? 'checked' : ''} onchange="toggleLicenseSelect('${lic.key}', this.checked)">
                </td>
                <td class="license-key-cell">
                    <span style="cursor:pointer;" onclick="showLicenseDetails('${lic.key}')" title="Click to view details">${lic.key}</span>
                    <i class="fa-regular fa-copy" style="margin-left:6px; cursor:pointer; font-size:0.75rem; color:var(--text-muted);" onclick="navigator.clipboard.writeText('${lic.key}'); showToast('Copied key!');" title="Copy key"></i>
                </td>
                <td>${statusBadge}</td>
                <td>${durationText}</td>
                <td>${lic.used_by || '<span class="text-muted">—</span>'}</td>
                <td style="font-family: var(--font-mono); font-size: 0.78rem;" title="${lic.hwid || ''}">${lic.hwid ? lic.hwid.substring(0, 12) + '...' : '<span class="text-muted">—</span>'}</td>
                <td>${expiryText}</td>
                <td>${remainingDisplay}</td>
                <td>
                    <div class="action-buttons">
                        ${detailBtn}
                        ${extendBtn}
                        ${resetHwidBtn}
                        ${pauseBtn}
                        ${banBtn}
                        ${deleteBtn}
                    </div>
                </td>
            `;
            licenseTableBody.appendChild(tr);

            // Populate Mobile Card
            if (mobileContainer) {
                const card = document.createElement('div');
                card.className = 'mobile-card-item';
                card.innerHTML = `
                    <div class="mobile-card-header">
                        <div class="mobile-card-title">
                            <input type="checkbox" class="license-checkbox" data-key="${lic.key}" ${isSelected ? 'checked' : ''} onchange="toggleLicenseSelect('${lic.key}', this.checked)">
                            <span onclick="showLicenseDetails('${lic.key}')">${lic.key}</span>
                            <i class="fa-regular fa-copy cursor-pointer text-muted" onclick="navigator.clipboard.writeText('${lic.key}'); showToast('Copied key!');"></i>
                        </div>
                        ${statusBadge}
                    </div>
                    <div class="mobile-card-grid">
                        <div class="mobile-card-field">
                            <span class="mobile-card-label">User</span>
                            <span class="mobile-card-val">${lic.used_by || '—'}</span>
                        </div>
                        <div class="mobile-card-field">
                            <span class="mobile-card-label">Remaining</span>
                            <span class="mobile-card-val">${remainingDisplay}</span>
                        </div>
                        <div class="mobile-card-field">
                            <span class="mobile-card-label">Duration</span>
                            <span class="mobile-card-val">${durationText}</span>
                        </div>
                        <div class="mobile-card-field">
                            <span class="mobile-card-label">Expires</span>
                            <span class="mobile-card-val" style="font-size:0.75rem;">${lic.expires_at ? (lic.expires_at === 'Lifetime' ? 'Lifetime' : new Date(lic.expires_at).toLocaleDateString()) : '—'}</span>
                        </div>
                    </div>
                    <div class="mobile-card-actions">
                        ${detailBtn}
                        ${extendBtn}
                        ${resetHwidBtn}
                        ${pauseBtn}
                        ${banBtn}
                        ${deleteBtn}
                    </div>
                `;
                mobileContainer.appendChild(card);
            }
        });
    }
}

// Fetch registered users for active app
async function fetchUsers() {
    if (!activeAppId) return;
    try {
        const response = await fetch(`/api/admin/users?app_id=${activeAppId}`);
        if (response.ok) {
            usersList = await response.json();
            renderUsersTable();
        } else if (response.status === 401) {
            showLogin();
        } else {
            showToast('Failed to fetch users.', true);
        }
    } catch (e) {
        showToast('Server connection error!', true);
    }
}

// Render Users list in table
function renderUsersTable() {
    if (!userTableBody) return;
    userTableBody.innerHTML = '';
    const query = userSearchInput ? userSearchInput.value.toLowerCase().trim() : '';
    
    const filtered = usersList.filter(user => {
        return user.username.toLowerCase().includes(query) || 
               user.license_key.toLowerCase().includes(query);
    });
    
    const mobileUsersContainer = document.getElementById('mobile-users-list');
    if (mobileUsersContainer) mobileUsersContainer.innerHTML = '';
    
    if (filtered.length === 0) {
        if (noUsersMsg) noUsersMsg.classList.remove('hidden');
    } else {
        if (noUsersMsg) noUsersMsg.classList.add('hidden');
        
        filtered.forEach(user => {
            const tr = document.createElement('tr');
            
            tr.innerHTML = `
                <td style="font-weight: 600;">${user.username}</td>
                <td class="license-key-cell" style="font-size:0.85rem;">${user.license_key}</td>
                <td style="font-family: var(--font-mono); font-size: 0.8rem;">${user.hwid || '<span class="text-muted">—</span>'}</td>
                <td>${new Date(user.created_at).toLocaleDateString()}</td>
                <td><span class="badge badge-used">Registered</span></td>
                <td>
                    <div class="action-buttons">
                        ${user.hwid ? `<button onclick="resetUserHwid('${user.username}')" class="btn-action" title="Reset HWID"><i class="fa-solid fa-arrows-rotate"></i></button>` : ''}
                        <button onclick="deleteUser('${user.username}')" class="btn-action ban-btn" title="Delete User"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </td>
            `;
            userTableBody.appendChild(tr);

            if (mobileUsersContainer) {
                const card = document.createElement('div');
                card.className = 'mobile-card-item';
                card.innerHTML = `
                    <div class="mobile-card-header">
                        <div class="mobile-card-title">
                            <span>${user.username}</span>
                        </div>
                        <span class="badge badge-used">Registered</span>
                    </div>
                    <div class="mobile-card-grid">
                        <div class="mobile-card-field">
                            <span class="mobile-card-label">License Key</span>
                            <span class="mobile-card-val font-mono" style="color:var(--accent); font-size:0.8rem;">${user.license_key}</span>
                        </div>
                        <div class="mobile-card-field">
                            <span class="mobile-card-label">Registered Date</span>
                            <span class="mobile-card-val" style="font-size:0.75rem;">${new Date(user.created_at).toLocaleDateString()}</span>
                        </div>
                        <div class="mobile-card-field" style="grid-column: 1 / -1;">
                            <span class="mobile-card-label">Hardware Signature (HWID)</span>
                            <span class="mobile-card-val font-mono" style="font-size:0.75rem;">${user.hwid || '—'}</span>
                        </div>
                    </div>
                    <div class="mobile-card-actions">
                        ${user.hwid ? `<button onclick="resetUserHwid('${user.username}')" class="btn btn-secondary btn-sm"><i class="fa-solid fa-arrows-rotate"></i> Reset HWID</button>` : ''}
                        <button onclick="deleteUser('${user.username}')" class="btn btn-red btn-sm"><i class="fa-solid fa-trash-can"></i> Delete</button>
                    </div>
                `;
                mobileUsersContainer.appendChild(card);
            }
        });
    }
    updateStats();
}

// Fetch logs for active app
async function fetchLogs() {
    if (!activeAppId) return;
    try {
        const response = await fetch(`/api/admin/logs?app_id=${activeAppId}`);
        if (response.ok) {
            logsList = await response.json();
            renderLogsTable();
        } else if (response.status === 401) {
            showLogin();
        } else {
            showToast('Failed to fetch logs.', true);
        }
    } catch (error) {
        showToast('Server connection error!', true);
    }
}

// Render logs table
function renderLogsTable() {
    if (!logsTableBody) return;
    logsTableBody.innerHTML = '';
    
    if (logsList.length === 0) {
        if (noLogsMsg) noLogsMsg.classList.remove('hidden');
        else logsTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px; color: var(--text-muted);">No event logs recorded.</td></tr>';
    } else {
        if (noLogsMsg) noLogsMsg.classList.add('hidden');
        
        logsList.forEach(log => {
            const tr = document.createElement('tr');
            tr.className = 'log-item-row';
            
            const date = new Date(log.timestamp);
            const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
            
            let eventBadge = '';
            const ev = log.event.toLowerCase();
            if (ev.includes('ban')) {
                eventBadge = `<span class="badge badge-banned">${log.event}</span>`;
            } else if (ev.includes('unban') || ev.includes('reset') || ev.includes('create') || ev.includes('generate')) {
                eventBadge = `<span class="badge badge-used">${log.event}</span>`;
            } else {
                eventBadge = `<span class="badge badge-unused">${log.event}</span>`;
            }
            
            tr.innerHTML = `
                <td style="color: var(--text-muted); font-size: 0.85rem;">${timeStr}</td>
                <td>${eventBadge}</td>
                <td style="font-family: var(--font-mono); font-size: 0.85rem; max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${log.details}">${log.details}</td>
            `;
            logsTableBody.appendChild(tr);
        });
    }
}

// Global actions for user scope
async function deleteUser(username) {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) return;
    try {
        const response = await fetch(`/api/admin/users/${username}?app_id=${activeAppId}`, { method: 'DELETE' });
        if (response.ok) {
            showToast('User deleted successfully.');
            fetchUsers();
        } else {
            showToast('Failed to delete user.', true);
        }
    } catch (e) {
        showToast('Server connection error!', true);
    }
}

async function resetUserHwid(username) {
    try {
        const response = await fetch(`/api/admin/users/${username}/reset_hwid?app_id=${activeAppId}`, { method: 'POST' });
        if (response.ok) {
            showToast('User HWID reset successful.');
            fetchUsers();
        } else {
            showToast('Failed to reset HWID.', true);
        }
    } catch (e) {
        showToast('Server connection error!', true);
    }
}

window.deleteUser = deleteUser;
window.resetUserHwid = resetUserHwid;

// Pagination handler
window.changeLicensePage = function(newPage) {
    licenseCurrentPage = newPage;
    renderLicensesTable();
};

// Selection Handlers
window.toggleLicenseSelect = function(key, isChecked) {
    if (isChecked) {
        selectedLicenseKeys.add(key);
    } else {
        selectedLicenseKeys.delete(key);
    }
    updateBulkActionBar();
};

window.toggleSelectAllLicenses = function(isChecked) {
    const checkboxes = document.querySelectorAll('.license-checkbox');
    checkboxes.forEach(cb => {
        const key = cb.getAttribute('data-key');
        cb.checked = isChecked;
        if (key) {
            if (isChecked) selectedLicenseKeys.add(key);
            else selectedLicenseKeys.delete(key);
        }
    });
    updateBulkActionBar();
};

const selectAllEl = document.getElementById('select-all-licenses');
if (selectAllEl) {
    selectAllEl.addEventListener('change', (e) => {
        window.toggleSelectAllLicenses(e.target.checked);
    });
}

function updateBulkActionBar() {
    const bar = document.getElementById('bulk-actions-bar');
    const countEl = document.getElementById('bulk-selected-count');
    const selectAllCb = document.getElementById('select-all-licenses');
    
    const count = selectedLicenseKeys.size;
    if (countEl) countEl.textContent = count;
    
    if (bar) {
        if (count > 0) {
            bar.classList.remove('hidden');
        } else {
            bar.classList.add('hidden');
        }
    }
    
    if (selectAllCb) {
        const visibleCheckboxes = document.querySelectorAll('.license-checkbox');
        if (visibleCheckboxes.length > 0) {
            const allChecked = Array.from(visibleCheckboxes).every(cb => cb.checked);
            selectAllCb.checked = allChecked;
        } else {
            selectAllCb.checked = false;
        }
    }
}

function clearLicenseSelection() {
    selectedLicenseKeys.clear();
    const selectAllCb = document.getElementById('select-all-licenses');
    if (selectAllCb) selectAllCb.checked = false;
    const checkboxes = document.querySelectorAll('.license-checkbox');
    checkboxes.forEach(cb => cb.checked = false);
    updateBulkActionBar();
}
window.clearLicenseSelection = clearLicenseSelection;

const btnClearSel = document.getElementById('btn-clear-selection');
if (btnClearSel) btnClearSel.addEventListener('click', clearLicenseSelection);

// Reusable Confirmation Modal Helper
let pendingConfirmCallback = null;
function showConfirmModal({ title = 'Confirmation Required', message = 'Are you sure you want to proceed?', icon = 'fa-triangle-exclamation', confirmText = 'Confirm', confirmClass = 'btn-red', onConfirm }) {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-modal-title');
    const msgEl = document.getElementById('confirm-modal-message');
    const btnAction = document.getElementById('btn-action-confirm');
    
    if (!modal) {
        if (confirm(message)) {
            if (onConfirm) onConfirm();
        }
        return;
    }
    
    if (titleEl) titleEl.innerHTML = `<i class="fa-solid ${icon} text-orange"></i> ${title}`;
    if (msgEl) msgEl.textContent = message;
    if (btnAction) {
        btnAction.textContent = confirmText;
        btnAction.className = `btn ${confirmClass}`;
    }
    
    pendingConfirmCallback = onConfirm;
    modal.classList.remove('hidden');
}
window.showConfirmModal = showConfirmModal;

const btnCloseConfirm = document.getElementById('btn-close-confirm-modal');
const btnCancelConfirm = document.getElementById('btn-cancel-confirm');
const btnActionConfirm = document.getElementById('btn-action-confirm');

if (btnCloseConfirm) btnCloseConfirm.onclick = () => document.getElementById('confirm-modal')?.classList.add('hidden');
if (btnCancelConfirm) btnCancelConfirm.onclick = () => document.getElementById('confirm-modal')?.classList.add('hidden');
if (btnActionConfirm) {
    btnActionConfirm.onclick = async () => {
        document.getElementById('confirm-modal')?.classList.add('hidden');
        if (pendingConfirmCallback) {
            await pendingConfirmCallback();
            pendingConfirmCallback = null;
        }
    };
}

// License Pause / Unpause
async function togglePauseLicense(key, isCurrentlyPaused) {
    const endpoint = isCurrentlyPaused ? `/api/admin/licenses/${key}/unpause` : `/api/admin/licenses/${key}/pause`;
    try {
        const res = await fetch(endpoint, { method: 'POST' });
        if (res.ok) {
            showToast(isCurrentlyPaused ? 'License unpaused!' : 'License paused!');
            await fetchLicenses();
            closeDetailModal();
        } else {
            showToast('Failed to change pause state', true);
        }
    } catch(e) {
        showToast('Server connection error!', true);
    }
}
window.togglePauseLicense = togglePauseLicense;

// License Ban / Unban
async function toggleBanLicense(key, isCurrentlyBanned) {
    const actionName = isCurrentlyBanned ? 'unban' : 'ban';
    showConfirmModal({
        title: `${actionName.toUpperCase()} License`,
        message: `Are you sure you want to ${actionName} license key "${key}"?`,
        confirmText: `${actionName.charAt(0).toUpperCase() + actionName.slice(1)} License`,
        confirmClass: isCurrentlyBanned ? 'btn-green' : 'btn-red',
        onConfirm: async () => {
            try {
                const endpoint = isCurrentlyBanned ? `/api/admin/licenses/${key}/unban` : `/api/admin/licenses/${key}/ban`;
                const res = await fetch(endpoint, { method: 'POST' });
                if (res.ok) {
                    showToast(`License ${actionName}ned successfully!`);
                    await fetchLicenses();
                    closeDetailModal();
                } else {
                    showToast(`Failed to ${actionName} license`, true);
                }
            } catch(e) {
                showToast('Server connection error!', true);
            }
        }
    });
}
window.toggleBanLicense = toggleBanLicense;

// License Revoke
async function revokeLicense(key) {
    showConfirmModal({
        title: 'Revoke License',
        message: `Are you sure you want to REVOKE license key "${key}"? This will permanently blacklist it.`,
        confirmText: 'Revoke Key',
        confirmClass: 'btn-red',
        onConfirm: async () => {
            try {
                const res = await fetch(`/api/admin/licenses/${key}/revoke`, { method: 'POST' });
                if (res.ok) {
                    showToast('License revoked successfully!');
                    await fetchLicenses();
                    closeDetailModal();
                } else {
                    showToast('Failed to revoke license', true);
                }
            } catch(e) {
                showToast('Server connection error!', true);
            }
        }
    });
}
window.revokeLicense = revokeLicense;

// HWID Reset
async function resetHwid(key) {
    try {
        const response = await fetch(`/api/admin/licenses/${key}/reset_hwid`, { method: 'POST' });
        if (response.ok) {
            showToast('HWID reset successful.');
            await fetchLicenses();
            const detailModal = document.getElementById('license-detail-modal');
            if (detailModal && !detailModal.classList.contains('hidden')) {
                showLicenseDetails(key);
            }
        } else {
            showToast('Failed to reset HWID.', true);
        }
    } catch (e) {
        showToast('Server connection error!', true);
    }
}
window.resetHwid = resetHwid;

// Delete single license
async function deleteLicense(key) {
    showConfirmModal({
        title: 'Delete License',
        message: `Are you sure you want to permanently delete license "${key}" and its associated user account?`,
        confirmText: 'Delete License',
        confirmClass: 'btn-red',
        onConfirm: async () => {
            try {
                const response = await fetch(`/api/admin/licenses/${key}`, { method: 'DELETE' });
                if (response.ok) {
                    showToast('License deleted successfully.');
                    selectedLicenseKeys.delete(key);
                    await fetchLicenses();
                    closeDetailModal();
                } else {
                    showToast('Failed to delete license.', true);
                }
            } catch (e) {
                showToast('Server connection error!', true);
            }
        }
    });
}
window.deleteLicense = deleteLicense;

// ==========================================
// LICENSE DETAILS MODAL
// ==========================================
async function showLicenseDetails(key) {
    const modal = document.getElementById('license-detail-modal');
    if (!modal) return;
    
    try {
        const response = await fetch(`/api/admin/licenses/${key}`);
        if (!response.ok) return showToast('Failed to load license details', true);
        
        const data = await response.json();
        const lic = data.license || {};
        const user = data.user;
        const sessions = data.sessions || [];
        
        document.getElementById('detail-key-display').textContent = lic.key;
        
        const badgeEl = document.getElementById('detail-status-badge');
        if (badgeEl) {
            badgeEl.className = `badge badge-${(lic.status || 'UNUSED').toLowerCase()}`;
            badgeEl.textContent = lic.status || 'UNUSED';
        }
        
        document.getElementById('detail-user').textContent = lic.used_by || 'Unassigned (No User)';
        
        const remainingEl = document.getElementById('detail-remaining');
        if (remainingEl) {
            remainingEl.innerHTML = formatRemainingTime(lic.expires_at, lic.status);
        }
        
        let durationText = 'Lifetime';
        if (lic.duration_days && lic.duration_days > 0) {
            durationText = lic.duration_days >= 1 ? `${lic.duration_days} Days` : `${Math.round(lic.duration_days * 24)} Hours`;
        }
        document.getElementById('detail-duration').textContent = durationText;
        
        document.getElementById('detail-expires').textContent = lic.expires_at 
            ? (lic.expires_at === 'Lifetime' ? 'Never (Lifetime)' : new Date(lic.expires_at).toLocaleString()) 
            : 'Not yet activated';
            
        document.getElementById('detail-created').textContent = lic.created_at ? new Date(lic.created_at).toLocaleString() : 'N/A';
        document.getElementById('detail-note').textContent = lic.note || 'None';
        document.getElementById('detail-hwid').textContent = lic.hwid || 'No hardware fingerprint bound';
        
        // Sessions
        const sessBox = document.getElementById('detail-sessions-container');
        if (sessBox) {
            if (sessions.length === 0) {
                sessBox.innerHTML = '<div class="text-muted" style="font-size:0.8rem;">No login sessions recorded yet.</div>';
            } else {
                sessBox.innerHTML = sessions.map(s => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:0.8rem;">
                        <span><i class="fa-solid fa-desktop" style="color:var(--color-cyan); margin-right:4px;"></i> ${s.username}</span>
                        <span class="text-muted font-mono" style="font-size:0.75rem;">${s.hwid ? s.hwid.substring(0, 14) + '...' : 'No HWID'}</span>
                        <span class="text-muted">${new Date(s.login_time).toLocaleString()}</span>
                    </div>
                `).join('');
            }
        }
        
        // Contextual Actions Footer
        const actionsContainer = document.getElementById('detail-actions-container');
        if (actionsContainer) {
            actionsContainer.innerHTML = `
                <button class="btn btn-secondary btn-sm" onclick="showExtendModal('${lic.key}')"><i class="fa-solid fa-clock-rotate-left"></i> Extend</button>
                <button class="btn btn-secondary btn-sm" onclick="resetHwid('${lic.key}')" ${!lic.hwid ? 'disabled' : ''}><i class="fa-solid fa-arrows-rotate"></i> Reset HWID</button>
                <button class="btn btn-secondary btn-sm" onclick="togglePauseLicense('${lic.key}', ${lic.is_paused})"><i class="fa-solid ${lic.is_paused ? 'fa-play' : 'fa-pause'}"></i> ${lic.is_paused ? 'Unpause' : 'Pause'}</button>
                <button class="btn btn-secondary btn-sm" onclick="toggleBanLicense('${lic.key}', ${lic.is_banned})"><i class="fa-solid ${lic.is_banned ? 'fa-unlock' : 'fa-ban'}"></i> ${lic.is_banned ? 'Unban' : 'Ban'}</button>
                <button class="btn btn-purple btn-sm" onclick="revokeLicense('${lic.key}')"><i class="fa-solid fa-ban"></i> Revoke</button>
                <button class="btn btn-red btn-sm" onclick="deleteLicense('${lic.key}')"><i class="fa-solid fa-trash-can"></i> Delete</button>
            `;
        }
        
        modal.classList.remove('hidden');
    } catch(e) {
        showToast('Server connection error!', true);
    }
}
window.showLicenseDetails = showLicenseDetails;

function closeDetailModal() {
    document.getElementById('license-detail-modal')?.classList.add('hidden');
}
window.closeDetailModal = closeDetailModal;

const btnCloseDetailModal = document.getElementById('btn-close-detail-modal');
if (btnCloseDetailModal) btnCloseDetailModal.onclick = closeDetailModal;

const btnCopyDetailKey = document.getElementById('btn-copy-detail-key');
if (btnCopyDetailKey) {
    btnCopyDetailKey.onclick = () => {
        const k = document.getElementById('detail-key-display')?.textContent;
        if (k && k !== '---') {
            navigator.clipboard.writeText(k);
            showToast('Key copied to clipboard!');
        }
    };
}

// ==========================================
// EXTEND LICENSE MODAL
// ==========================================
function showExtendModal(key, isBulk = false) {
    const modal = document.getElementById('extend-license-modal');
    if (!modal) return;
    
    document.getElementById('extend-target-key').value = key || '';
    document.getElementById('extend-is-bulk').value = isBulk ? 'true' : 'false';
    
    const descEl = document.getElementById('extend-modal-desc');
    if (descEl) {
        descEl.textContent = isBulk 
            ? `Grant additional time to all ${selectedLicenseKeys.size} selected licenses.`
            : `Grant additional time to license key "${key}".`;
    }
    
    // Reset custom fields
    document.getElementById('extend-preset-select').value = '7';
    document.getElementById('custom-extend-wrapper').classList.add('hidden');
    document.getElementById('extend-custom-days').value = 0;
    document.getElementById('extend-custom-hours').value = 0;
    document.getElementById('extend-custom-minutes').value = 0;
    
    modal.classList.remove('hidden');
}
window.showExtendModal = showExtendModal;

const extendPresetSelect = document.getElementById('extend-preset-select');
if (extendPresetSelect) {
    extendPresetSelect.addEventListener('change', (e) => {
        const customWrap = document.getElementById('custom-extend-wrapper');
        if (customWrap) {
            if (e.target.value === 'custom') {
                customWrap.classList.remove('hidden');
            } else {
                customWrap.classList.add('hidden');
            }
        }
    });
}

const btnCloseExtendModal = document.getElementById('btn-close-extend-modal');
if (btnCloseExtendModal) {
    btnCloseExtendModal.onclick = () => document.getElementById('extend-license-modal')?.classList.add('hidden');
}

const extendForm = document.getElementById('extend-form');
if (extendForm) {
    extendForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const key = document.getElementById('extend-target-key').value;
        const isBulk = document.getElementById('extend-is-bulk').value === 'true';
        const preset = document.getElementById('extend-preset-select').value;
        
        let days = 0, hours = 0, minutes = 0;
        if (preset === 'custom') {
            days = parseFloat(document.getElementById('extend-custom-days').value) || 0;
            hours = parseFloat(document.getElementById('extend-custom-hours').value) || 0;
            minutes = parseFloat(document.getElementById('extend-custom-minutes').value) || 0;
        } else {
            days = parseFloat(preset) || 0;
        }
        
        if (days === 0 && hours === 0 && minutes === 0) {
            return showToast('Please select or specify an extension duration', true);
        }
        
        if (isBulk) {
            // Bulk Extend
            try {
                const res = await fetch('/api/admin/licenses/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        app_id: activeAppId,
                        action: 'extend',
                        keys: Array.from(selectedLicenseKeys),
                        extend_days: days,
                        extend_hours: hours,
                        extend_minutes: minutes
                    })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast(`Extended ${data.updated} licenses successfully!`);
                    document.getElementById('extend-license-modal')?.classList.add('hidden');
                    clearLicenseSelection();
                    await fetchLicenses();
                } else {
                    showToast(data.detail || 'Bulk extend failed', true);
                }
            } catch(e) {
                showToast('Server connection error!', true);
            }
        } else {
            // Single Extend
            try {
                const res = await fetch(`/api/admin/licenses/${key}/extend`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ days, hours, minutes })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast('License extended successfully!');
                    document.getElementById('extend-license-modal')?.classList.add('hidden');
                    await fetchLicenses();
                    const detailModal = document.getElementById('license-detail-modal');
                    if (detailModal && !detailModal.classList.contains('hidden')) {
                        showLicenseDetails(key);
                    }
                } else {
                    showToast(data.detail || 'Failed to extend license', true);
                }
            } catch(e) {
                showToast('Server connection error!', true);
            }
        }
    });
}

// ==========================================
// BULK ACTIONS HANDLER
// ==========================================
async function applyBulkAction() {
    const actionSelect = document.getElementById('bulk-action-select');
    const action = actionSelect ? actionSelect.value : '';
    
    if (!action) return showToast('Please select a bulk action to perform', true);
    if (selectedLicenseKeys.size === 0) return showToast('No licenses selected', true);
    
    const count = selectedLicenseKeys.size;
    
    if (action === 'extend') {
        showExtendModal(null, true);
        return;
    }
    
    const actionLabels = {
        delete: `permanently DELETE ${count} licenses and their user accounts`,
        revoke: `REVOKE ${count} licenses`,
        ban: `BAN ${count} licenses`,
        unban: `UNBAN ${count} licenses`,
        pause: `PAUSE ${count} licenses`,
        unpause: `UNPAUSE ${count} licenses`,
        reset_hwid: `RESET HWID for ${count} licenses`
    };
    
    showConfirmModal({
        title: `Bulk ${action.toUpperCase()}`,
        message: `Are you sure you want to ${actionLabels[action] || action}?`,
        confirmText: `Confirm ${action.charAt(0).toUpperCase() + action.slice(1)}`,
        confirmClass: action === 'delete' || action === 'revoke' || action === 'ban' ? 'btn-red' : 'btn-blue',
        onConfirm: async () => {
            try {
                const res = await fetch('/api/admin/licenses/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        app_id: activeAppId,
                        action: action,
                        keys: Array.from(selectedLicenseKeys)
                    })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast(`Successfully performed ${action} on ${data.updated} licenses!`);
                    clearLicenseSelection();
                    await fetchLicenses();
                } else {
                    showToast(data.detail || 'Bulk action failed', true);
                }
            } catch(e) {
                showToast('Server connection error!', true);
            }
        }
    });
}
window.applyBulkAction = applyBulkAction;

const btnApplyBulk = document.getElementById('btn-apply-bulk-action');
if (btnApplyBulk) btnApplyBulk.addEventListener('click', applyBulkAction);

// ==========================================
// ONE-CLICK EXPIRED CLEANUP
// ==========================================
async function deleteExpiredLicenses() {
    if (!activeAppId) return showToast('Please select an application first', true);
    
    // Calculate how many are currently expired
    const expiredCount = licensesList.filter(l => (l.status || '').toUpperCase() === 'EXPIRED').length;
    
    showConfirmModal({
        title: 'Delete All Expired Licenses',
        message: `Are you sure you want to permanently delete all expired licenses (${expiredCount} found)? This action cannot be undone.`,
        confirmText: 'Delete All Expired',
        confirmClass: 'btn-red',
        onConfirm: async () => {
            try {
                const res = await fetch(`/api/admin/licenses/expired?app_id=${activeAppId}`, { method: 'DELETE' });
                const data = await res.json();
                if (res.ok) {
                    showToast(`Cleaned up ${data.deleted} expired licenses!`);
                    clearLicenseSelection();
                    await fetchLicenses();
                } else {
                    showToast(data.detail || 'Failed to delete expired licenses', true);
                }
            } catch(e) {
                showToast('Server connection error!', true);
            }
        }
    });
}
window.deleteExpiredLicenses = deleteExpiredLicenses;

const btnDeleteExpired = document.getElementById('btn-delete-expired');
if (btnDeleteExpired) btnDeleteExpired.addEventListener('click', deleteExpiredLicenses);

// ==========================================
// EXPORT CSV
// ==========================================
function exportLicensesCSV() {
    if (licensesList.length === 0) return showToast('No licenses available to export', true);
    
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const statusFilter = filterStatus ? filterStatus.value.toLowerCase() : 'all';
    
    const filtered = licensesList.filter(lic => {
        const status = (lic.status || 'UNUSED').toLowerCase();
        const matchesSearch = !query || 
            (lic.key && lic.key.toLowerCase().includes(query)) ||
            (lic.used_by && lic.used_by.toLowerCase().includes(query)) ||
            (lic.hwid && lic.hwid.toLowerCase().includes(query));
        let matchesStatus = true;
        if (statusFilter !== 'all') {
            matchesStatus = status === statusFilter;
        }
        return matchesSearch && matchesStatus;
    });
    
    if (filtered.length === 0) return showToast('No licenses match current filter for export', true);
    
    const headers = ['License Key', 'Status', 'Duration (Days)', 'User', 'HWID', 'Created At', 'Expires At', 'Note'];
    const rows = filtered.map(l => [
        `"${l.key}"`,
        `"${l.status || 'UNUSED'}"`,
        `"${l.duration_days || 0}"`,
        `"${l.used_by || ''}"`,
        `"${l.hwid || ''}"`,
        `"${l.created_at || ''}"`,
        `"${l.expires_at || ''}"`,
        `"${(l.note || '').replace(/"/g, '""')}"`
    ]);
    
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `licenses_${activeAppId || 'export'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${filtered.length} licenses as CSV!`);
}
window.exportLicensesCSV = exportLicensesCSV;

const btnExportCsv = document.getElementById('btn-export-csv');
if (btnExportCsv) btnExportCsv.addEventListener('click', exportLicensesCSV);

const btnRefreshLicenses = document.getElementById('btn-refresh-licenses');
if (btnRefreshLicenses) btnRefreshLicenses.addEventListener('click', () => { fetchLicenses(); showToast('Licenses refreshed'); });

const perPageSelect = document.getElementById('licenses-per-page');
if (perPageSelect) perPageSelect.addEventListener('change', () => { licenseCurrentPage = 1; renderLicensesTable(); });

// ==========================================
// EXPIRING SOON VIEW
// ==========================================
async function fetchExpiringSoon() {
    if (!activeAppId) return;
    const timeframeSelect = document.getElementById('expiring-timeframe');
    const days = timeframeSelect ? timeframeSelect.value : 7;
    
    try {
        const res = await fetch(`/api/admin/licenses/expiring_soon?app_id=${activeAppId}&days=${days}`);
        if (res.ok) {
            const data = await res.json();
            expiringLicensesList = data.licenses || [];
            renderExpiringSoonTable();
        }
    } catch(e) {
        console.error('Failed to fetch expiring soon:', e);
    }
}
window.fetchExpiringSoon = fetchExpiringSoon;

function renderExpiringSoonTable() {
    const tbody = document.getElementById('expiring-table-body');
    const noMsg = document.getElementById('no-expiring-msg');
    const mobileExpiringContainer = document.getElementById('mobile-expiring-list');
    if (mobileExpiringContainer) mobileExpiringContainer.innerHTML = '';
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (expiringLicensesList.length === 0) {
        if (noMsg) noMsg.classList.remove('hidden');
    } else {
        if (noMsg) noMsg.classList.add('hidden');
        expiringLicensesList.forEach(lic => {
            const tr = document.createElement('tr');
            const statusBadge = `<span class="badge badge-${(lic.status || 'ACTIVE').toLowerCase()}">${lic.status || 'ACTIVE'}</span>`;
            const remaining = formatRemainingTime(lic.expires_at, lic.status);
            
            tr.innerHTML = `
                <td class="license-key-cell">
                    <span style="cursor:pointer;" onclick="showLicenseDetails('${lic.key}')">${lic.key}</span>
                </td>
                <td>${lic.used_by || '<span class="text-muted">—</span>'}</td>
                <td>${new Date(lic.expires_at).toLocaleString()}</td>
                <td>${remaining}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="action-buttons">
                        <button onclick="showExtendModal('${lic.key}')" class="btn btn-primary btn-sm"><i class="fa-solid fa-clock-rotate-left"></i> Extend</button>
                        <button onclick="showLicenseDetails('${lic.key}')" class="btn btn-secondary btn-sm"><i class="fa-solid fa-eye"></i> View</button>
                        <button onclick="revokeLicense('${lic.key}')" class="btn btn-purple btn-sm"><i class="fa-solid fa-ban"></i> Revoke</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);

            if (mobileExpiringContainer) {
                const card = document.createElement('div');
                card.className = 'mobile-card-item';
                card.innerHTML = `
                    <div class="mobile-card-header">
                        <div class="mobile-card-title">
                            <span onclick="showLicenseDetails('${lic.key}')">${lic.key}</span>
                        </div>
                        ${statusBadge}
                    </div>
                    <div class="mobile-card-grid">
                        <div class="mobile-card-field">
                            <span class="mobile-card-label">User</span>
                            <span class="mobile-card-val">${lic.used_by || '—'}</span>
                        </div>
                        <div class="mobile-card-field">
                            <span class="mobile-card-label">Time Remaining</span>
                            <span class="mobile-card-val">${remaining}</span>
                        </div>
                        <div class="mobile-card-field" style="grid-column: 1 / -1;">
                            <span class="mobile-card-label">Expiration Date</span>
                            <span class="mobile-card-val" style="font-size:0.75rem;">${new Date(lic.expires_at).toLocaleString()}</span>
                        </div>
                    </div>
                    <div class="mobile-card-actions">
                        <button onclick="showExtendModal('${lic.key}')" class="btn btn-primary btn-sm"><i class="fa-solid fa-clock-rotate-left"></i> Extend</button>
                        <button onclick="showLicenseDetails('${lic.key}')" class="btn btn-secondary btn-sm"><i class="fa-solid fa-eye"></i> View</button>
                        <button onclick="revokeLicense('${lic.key}')" class="btn btn-purple btn-sm"><i class="fa-solid fa-ban"></i> Revoke</button>
                    </div>
                `;
                mobileExpiringContainer.appendChild(card);
            }
        });
    }
}

const expiringTimeframeSelect = document.getElementById('expiring-timeframe');
if (expiringTimeframeSelect) expiringTimeframeSelect.addEventListener('change', fetchExpiringSoon);

// Event Listeners
let isLoginMode = true;
let is2FAState = false;
// --- TABBED AUTH NAVIGATION & HANDLERS ---
const tabBtnLogin = document.getElementById('tab-btn-login');
const tabBtnRegister = document.getElementById('tab-btn-register');
const authLoginForm = document.getElementById('auth-login-form');
const authRegisterForm = document.getElementById('auth-register-form');

if (tabBtnLogin && tabBtnRegister) {
    tabBtnLogin.addEventListener('click', () => {
        isLoginMode = true;
        tabBtnLogin.classList.add('active');
        tabBtnRegister.classList.remove('active');
        
        authLoginForm.classList.remove('hidden');
        authRegisterForm.classList.add('hidden');
        if (loginError) loginError.classList.add('hidden');
    });

    tabBtnRegister.addEventListener('click', () => {
        isLoginMode = false;
        tabBtnRegister.classList.add('active');
        tabBtnLogin.classList.remove('active');
        
        authRegisterForm.classList.remove('hidden');
        authLoginForm.classList.add('hidden');
        if (loginError) loginError.classList.add('hidden');
    });
}

// Sign In Form Submit
if (authLoginForm) {
    authLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const usernameInput = document.getElementById('login-username').value.trim();
        const passwordInput = document.getElementById('login-password').value;
        const totpInput = document.getElementById('totp_code') ? document.getElementById('totp_code').value.trim() : '';
        
        if (loginError) loginError.classList.add('hidden');
        
        try {
            const payload = { username: usernameInput, password: passwordInput };
            if (is2FAState) payload.totp_code = totpInput;
            
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            
            if (response.ok) {
                localStorage.setItem('admin_user', usernameInput);
                showToast('Logged in successfully!');
                showDashboard();
            } else if (response.status === 403 && data.detail === "2FA_REQUIRED") {
                is2FAState = true;
                document.getElementById('login-2fa-group').style.display = 'block';
                document.getElementById('totp_code').focus();
                loginError.textContent = 'Enter your Authenticator Code.';
                loginError.classList.remove('hidden');
                loginError.style.color = 'var(--text-main)';
            } else {
                loginError.textContent = getErrorMessage(data, 'Invalid username or password!');
                loginError.classList.remove('hidden');
                loginError.style.color = 'var(--color-red)';
            }
        } catch (error) {
            loginError.textContent = 'Unable to connect to server!';
            loginError.classList.remove('hidden');
            loginError.style.color = 'var(--color-red)';
        }
    });
}

// Sign Up Form Submit
if (authRegisterForm) {
    authRegisterForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const usernameInput = document.getElementById('reg-username').value.trim();
        const passwordInput = document.getElementById('reg-password').value;
        const confirmInputEl = document.getElementById('reg-confirm-password');
        const confirmPasswordInput = confirmInputEl ? confirmInputEl.value : '';
        
        if (loginError) loginError.classList.add('hidden');

        if (confirmInputEl && passwordInput !== confirmPasswordInput) {
            loginError.textContent = 'Passwords do not match!';
            loginError.classList.remove('hidden');
            loginError.style.color = 'var(--color-red)';
            showToast('Passwords do not match!', true);
            return;
        }
        
        try {
            const response = await fetch('/api/admin/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: usernameInput, password: passwordInput })
            });
            const data = await response.json();
            
            if (response.ok) {
                showToast('Registered successfully! Please Sign In now.');
                if (tabBtnLogin) tabBtnLogin.click();
                document.getElementById('login-username').value = usernameInput;
                document.getElementById('login-password').value = '';
                authRegisterForm.reset();
            } else {
                loginError.textContent = getErrorMessage(data, 'Registration failed!');
                loginError.classList.remove('hidden');
                loginError.style.color = 'var(--color-red)';
            }
        } catch (error) {
            loginError.textContent = 'Unable to connect to server!';
            loginError.classList.remove('hidden');
            loginError.style.color = 'var(--color-red)';
        }
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/admin/logout', { method: 'POST' });
            localStorage.removeItem('admin_user');
            showToast('Logged out successfully.');
            showLogin();
        } catch (error) {
            showLogin();
        }
    });
}

if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
        const activeNav = document.querySelector('.nav-item.active');
        const activeTab = activeNav ? activeNav.getAttribute('data-tab') : 'overview';
        if (activeTab === 'overview') {
            fetchLicenses();
            fetchUsers();
        } else if (activeTab === 'licenses') {
            fetchLicenses();
        } else if (activeTab === 'users') {
            fetchUsers();
        } else if (activeTab === 'logs') {
            fetchLogs();
        }
    });
}

if (searchInput) searchInput.addEventListener('input', renderLicensesTable);
if (filterStatus) filterStatus.addEventListener('change', renderLicensesTable);
if (userSearchInput) userSearchInput.addEventListener('input', renderUsersTable);

// App Selector Change
appSelector.addEventListener('change', (e) => {
    activeAppId = e.target.value;
    if (activeAppId) {
        updateActiveAppDisplay();
    }
});

// App Creation Modal Toggles
btnCreateAppModal.addEventListener('click', () => {
    createAppModal.classList.remove('hidden');
});

btnCloseAppModal.addEventListener('click', () => {
    createAppModal.classList.add('hidden');
});

createAppForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = newAppName.value.trim();
    
    try {
        const response = await fetch('/api/admin/apps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast(`Application "${name}" created!`);
            createAppModal.classList.add('hidden');
            createAppForm.reset();
            activeAppId = data.app.id;
            await fetchApps();
        } else {
            showToast(data, true);
        }
    } catch (e) {
        showToast('Server connection error!', true);
    }
});

btnDeleteApp.addEventListener('click', async () => {
    if (!activeAppId) return;
    const activeApp = appsList.find(a => a.id === activeAppId);
    if (!activeApp) return;
    
    if (!confirm(`Are you sure you want to delete the application "${activeApp.name}"?\nThis will permanently delete all users and license keys under this app!`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/apps/${activeAppId}`, { method: 'DELETE' });
        if (response.ok) {
            showToast('Application deleted successfully.');
            activeAppId = null;
            await fetchApps();
        } else {
            showToast('Failed to delete application.', true);
        }
    } catch (e) {
        showToast('Server connection error!', true);
    }
});

// User Creation Modal Toggles
btnCreateUserModal.addEventListener('click', () => {
    if (!activeAppId) {
        showToast('Please select or create an application first.', true);
        return;
    }
    createUserModal.classList.remove('hidden');
});

btnCloseUserModal.addEventListener('click', () => {
    createUserModal.classList.add('hidden');
});

createUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = newUsername.value.trim();
    const password = newPassword.value;
    const duration = parseInt(userDuration.value);
    const note = userNote ? userNote.value.trim() : '';
    
    try {
        const subscriptionId = document.getElementById('user-subscription-id')?.value || null;
        const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                app_id: activeAppId,
                username,
                password,
                duration_days: duration,
                subscription_id: subscriptionId,
                note
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast(`User "${username}" created successfully!`);
            createUserModal.classList.add('hidden');
            createUserForm.reset();
            fetchUsers();
        } else {
            showToast(data, true);
        }
    } catch (e) {
        showToast('Server connection error!', true);
    }
});

// Tab navigation trigger
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = item.getAttribute('data-tab');
        switchTab(tabId);
        if (tabId === 'overview') {
            fetchLicenses();
            fetchUsers();
        } else if (tabId === 'licenses') {
            fetchLicenses();
        } else if (tabId === 'users') {
            fetchUsers();
        } else if (tabId === 'logs') {
            fetchLogs();
        } else if (tabId === 'subscriptions') {
            fetchSubscriptions();
        } else if (tabId === 'tokens') {
            fetchTokens();
        } else if (tabId === 'webhooks') {
            fetchWebhooks();
        } else if (tabId === 'variables') {
            fetchVariables();
        } else if (tabId === 'sessions') {
            fetchSessions();
        } else if (tabId === 'files') {
            fetchFiles();
        } else if (tabId === 'chats') {
            fetchChats();
        } else if (tabId === 'rules') {
            fetchRules();
        } else if (tabId === 'resources') {
            fetchResources();
        } else if (tabId === 'api-docs') {
            updateActiveAppDisplay();
        } else if (tabId === 'settings') {
            fetch2FAStatus();
        }
    });
});

// Duration preset change listener for Generate Keys modal
if (durationSelect) {
    durationSelect.addEventListener('change', (e) => {
        const customWrap = document.getElementById('custom-duration-wrapper');
        if (customWrap) {
            if (e.target.value === 'custom') {
                customWrap.classList.remove('hidden');
            } else {
                customWrap.classList.add('hidden');
            }
        }
    });
}

// Generate Keys form trigger
generateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeAppId) {
        showToast('Please select or create an application first.', true);
        return;
    }
    
    const count = parseInt(countInput.value) || 1;
    const note = noteInput ? noteInput.value.trim() : '';
    const customPrefix = document.getElementById('gen-custom-prefix')?.value?.trim() || null;
    const subscriptionId = document.getElementById('license-subscription-id')?.value || null;
    
    const durationVal = durationSelect.value;
    let duration_days = null;
    let duration_hours = null;
    let duration_minutes = null;
    
    if (durationVal === 'custom') {
        const days = parseFloat(document.getElementById('custom-days')?.value) || 0;
        const hours = parseFloat(document.getElementById('custom-hours')?.value) || 0;
        const minutes = parseFloat(document.getElementById('custom-minutes')?.value) || 0;
        
        if (days === 0 && hours === 0 && minutes === 0) {
            return showToast('Please enter a valid custom duration', true);
        }
        duration_days = days;
        duration_hours = hours;
        duration_minutes = minutes;
    } else {
        duration_days = parseFloat(durationVal);
    }
    
    try {
        const payload = {
            app_id: activeAppId,
            count: count,
            duration_days: duration_days,
            duration_hours: duration_hours,
            duration_minutes: duration_minutes,
            custom_prefix: customPrefix,
            subscription_id: subscriptionId,
            note: note
        };
        
        const response = await fetch('/api/admin/licenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast(`${count} license key${count > 1 ? 's' : ''} generated successfully!`);
            
            const listEl = document.getElementById('generated-keys-list');
            const wrapperEl = document.getElementById('generated-keys-wrapper');
            
            if (listEl) {
                listEl.innerHTML = '';
                data.keys.forEach(key => {
                    const li = document.createElement('li');
                    li.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:6px; border:1px solid var(--border-color);';
                    li.innerHTML = `
                        <span style="font-family:var(--font-mono); font-size:0.85rem; color:var(--color-cyan); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:70%;">${key}</span>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('${key}'); showToast('Key copied!');"><i class="fa-solid fa-copy"></i> Copy</button>
                    `;
                    listEl.appendChild(li);
                });
            }
            
            if (wrapperEl) wrapperEl.classList.remove('hidden');
            fetchLicenses();
            fetchStats();
        } else {
            showToast(data.detail || 'Failed to generate licenses', true);
        }
    } catch (error) {
        showToast('Server connection error!', true);
    }
});

const btnCopyAll = document.getElementById('copy-all-btn');
if (btnCopyAll) {
    btnCopyAll.addEventListener('click', () => {
        const listEl = document.getElementById('generated-keys-list');
        if (!listEl) return;
        const keys = Array.from(listEl.querySelectorAll('li span')).map(span => span.textContent);
        navigator.clipboard.writeText(keys.join('\n'));
        showToast('All license keys copied to clipboard!');
    });
}

// Toggle Client Secret visibility
if (btnToggleSecret) {
    btnToggleSecret.addEventListener('click', () => {
        const isShowing = btnToggleSecret.classList.toggle('showing-secret');
        if (isShowing) {
            btnToggleSecret.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Hide';
            settingsAppSecret.style.webkitTextSecurity = 'none';
        } else {
            btnToggleSecret.innerHTML = '<i class="fa-solid fa-eye"></i> Show';
            settingsAppSecret.style.webkitTextSecurity = 'disc';
        }
    });
}

// Generate Keys Modal Open/Close triggers
if (btnGenerateKeysModal) {
    btnGenerateKeysModal.addEventListener('click', () => {
        if (!activeAppId) {
            showToast('Please select or create an application first.', true);
            return;
        }
        if (generatedKeysWrapper) generatedKeysWrapper.classList.add('hidden');
        if (document.getElementById('custom-duration-wrapper')) {
            document.getElementById('custom-duration-wrapper').classList.add('hidden');
        }
        if (durationSelect) durationSelect.value = '30';
        if (countInput) countInput.value = '1';
        
        // Auto-fill prefix
        const activeApp = appsList.find(a => a.id === activeAppId);
        const prefixInput = document.getElementById('gen-custom-prefix');
        if (prefixInput && activeApp) {
            prefixInput.value = (activeApp.rules && activeApp.rules.key_prefix) ? activeApp.rules.key_prefix : 'AXC';
        }
        
        generateKeysModal.classList.remove('hidden');
    });
}

if (btnCloseGenerateModal) {
    btnCloseGenerateModal.addEventListener('click', () => {
        generateKeysModal.classList.add('hidden');
        fetchLicenses();
    });
}

// Run check on initialization
checkAuth();

// ==========================================
// PLATFORM ADMINS MANAGEMENT
// ==========================================
let platformAdminsList = [];
const adminsTableBody = document.getElementById('admins-table-body');
const noAdminsMsg = document.getElementById('no-admins-msg');

async function fetchPlatformAdmins() {
    try {
        const response = await fetch('/api/admin/platform_users');
        if (response.ok) {
            platformAdminsList = await response.json();
            renderPlatformAdmins();
        } else {
            showToast('Failed to fetch platform admins', true);
        }
    } catch (e) {
        showToast('Server connection error!', true);
    }
}

function renderPlatformAdmins() {
    if (!adminsTableBody) return;
    adminsTableBody.innerHTML = '';
    
    if (platformAdminsList.length === 0) {
        if (noAdminsMsg) noAdminsMsg.classList.remove('hidden');
    } else {
        if (noAdminsMsg) noAdminsMsg.classList.add('hidden');
        
        const currentUser = localStorage.getItem('admin_user');
        
        platformAdminsList.forEach(admin => {
            const tr = document.createElement('tr');
            const date = new Date(admin.created_at || new Date());
            const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const isMe = admin.username === currentUser;
            
            tr.innerHTML = `
                <td><strong>${admin.username}</strong> ${isMe ? '<span class="badge badge-used" style="margin-left: 5px; font-size: 0.6rem;">You</span>' : ''}</td>
                <td>${formattedDate}</td>
                <td><span class="badge badge-unused">Admin</span></td>
                <td>
                    <div class="action-buttons" style="justify-content: center;">
                        <button onclick="deletePlatformAdmin('${admin.username}')" class="btn-action ban-btn" title="Delete Admin" ${isMe ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </td>
            `;
            adminsTableBody.appendChild(tr);
        });
    }
}

window.deletePlatformAdmin = async function(username) {
    if(confirm(`Are you sure you want to permanently delete the admin account '${username}'?`)) {
        try {
            const response = await fetch(`/api/admin/platform_users/${username}`, { method: 'DELETE' });
            if(response.ok) {
                showToast('Admin account deleted successfully');
                await fetchPlatformAdmins();
            } else {
                const data = await response.json();
                showToast(data.detail || 'Failed to delete admin', true);
            }
        } catch(e) {
            showToast('Server connection error!', true);
        }
    }
};

// ==========================================
// TWO-FACTOR AUTHENTICATION (2FA) SETTINGS
// ==========================================
async function fetch2FAStatus() {
    const statusText = document.getElementById('2fa-status-text');
    const btnEnable = document.getElementById('btn-enable-2fa');
    const btnDisable = document.getElementById('btn-disable-2fa');
    if (!statusText) return;

    try {
        const response = await fetch('/api/admin/2fa/status');
        if (response.ok) {
            const data = await response.json();
            
            if (document.getElementById('2fa-setup-panel')) document.getElementById('2fa-setup-panel').classList.add('hidden');
            if (document.getElementById('2fa-disable-panel')) document.getElementById('2fa-disable-panel').classList.add('hidden');
            
            if (data.is_2fa_enabled) {
                statusText.innerHTML = '<i class="fa-solid fa-shield-check" style="color:var(--color-green);"></i> 2FA is Currently <strong>Enabled</strong>';
                if (btnEnable) btnEnable.classList.add('hidden');
                if (btnDisable) btnDisable.classList.remove('hidden');
            } else {
                statusText.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:var(--color-orange);"></i> 2FA is Currently <strong>Disabled</strong>';
                if (btnEnable) btnEnable.classList.remove('hidden');
                if (btnDisable) btnDisable.classList.add('hidden');
            }
        } else {
            statusText.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:var(--color-orange);"></i> 2FA is Currently <strong>Disabled</strong>';
            if (btnEnable) btnEnable.classList.remove('hidden');
            if (btnDisable) btnDisable.classList.add('hidden');
        }
    } catch (e) {
        statusText.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="color:var(--color-red);"></i> Failed to fetch 2FA status';
    }
}

if (document.getElementById('btn-enable-2fa')) {
    document.getElementById('btn-enable-2fa').addEventListener('click', async () => {
        try {
            const response = await fetch('/api/admin/2fa/setup', { method: 'POST' });
            if (response.ok) {
                const data = await response.json();
                // We use an external API to generate the QR code image from the OTP URI
                document.getElementById('2fa-qr-code').src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.uri)}`;
                document.getElementById('2fa-setup-panel').classList.remove('hidden');
                document.getElementById('setup-2fa-code').value = '';
            } else {
                showToast('Failed to setup 2FA', true);
            }
        } catch(e) {
            showToast('Server connection error', true);
        }
    });
}

if (document.getElementById('btn-verify-2fa')) {
    document.getElementById('btn-verify-2fa').addEventListener('click', async () => {
        const code = document.getElementById('setup-2fa-code').value.trim();
        if(!code) return showToast('Please enter the code', true);
        
        try {
            const response = await fetch('/api/admin/2fa/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });
            const data = await response.json();
            if (response.ok) {
                showToast('2FA Enabled Successfully!');
                fetch2FAStatus();
            } else {
                showToast(data.detail || 'Invalid code', true);
            }
        } catch(e) {
            showToast('Server connection error', true);
        }
    });
}

if (document.getElementById('btn-disable-2fa')) {
    document.getElementById('btn-disable-2fa').addEventListener('click', () => {
        document.getElementById('2fa-disable-panel').classList.remove('hidden');
        document.getElementById('disable-2fa-code').value = '';
    });
}

if (document.getElementById('btn-confirm-disable-2fa')) {
    document.getElementById('btn-confirm-disable-2fa').addEventListener('click', async () => {
        const code = document.getElementById('disable-2fa-code').value.trim();
        if(!code) return showToast('Please enter the code', true);
        
        try {
            const response = await fetch('/api/admin/2fa/disable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });
            const data = await response.json();
            if (response.ok) {
                showToast('2FA Disabled Successfully!');
                fetch2FAStatus();
            } else {
                showToast(data.detail || 'Invalid code', true);
            }
        } catch(e) {
            showToast('Server connection error', true);
        }
    });
}

// ==========================================
// VARIABLES MANAGEMENT
// ==========================================
let variablesList = [];
const variablesTableBody = document.getElementById('variables-table-body');
const noVariablesMsg = document.getElementById('no-variables-msg');
const createVariableModal = document.getElementById('create-variable-modal');
const btnCreateVariable = document.getElementById('btn-create-variable');
const btnCloseVariableModal = document.getElementById('btn-close-variable-modal');
const createVariableForm = document.getElementById('create-variable-form');

async function fetchVariables() {
    if (!activeAppId) return;
    try {
        const response = await fetch(`/api/admin/variables?app_id=${activeAppId}`);
        if (response.ok) {
            variablesList = await response.json();
            renderVariables();
        } else {
            showToast('Failed to fetch variables', true);
        }
    } catch (e) {
        showToast('Server connection error!', true);
    }
}

function renderVariables() {
    if (!variablesTableBody) return;
    variablesTableBody.innerHTML = '';
    
    if (variablesList.length === 0) {
        if (noVariablesMsg) noVariablesMsg.classList.remove('hidden');
    } else {
        if (noVariablesMsg) noVariablesMsg.classList.add('hidden');
        
        variablesList.forEach(variable => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${variable.name}</strong></td>
                <td style="font-family: monospace; font-size: 0.85rem; color: var(--color-green);">${variable.value}</td>
                <td>
                    <div class="action-buttons" style="justify-content: center;">
                        <button onclick="deleteVariable('${variable.name}')" class="btn-action ban-btn" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </td>
            `;
            variablesTableBody.appendChild(tr);
        });
    }
}

if(btnCreateVariable) {
    btnCreateVariable.addEventListener('click', () => {
        if(!activeAppId) return showToast('Please select an application', true);
        createVariableForm.reset();
        createVariableModal.classList.remove('hidden');
    });
}

if(btnCloseVariableModal) {
    btnCloseVariableModal.addEventListener('click', () => {
        createVariableModal.classList.add('hidden');
    });
}

if(createVariableForm) {
    createVariableForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-variable-name').value;
        const value = document.getElementById('new-variable-value').value;
        try {
            const response = await fetch('/api/admin/variables', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ app_id: activeAppId, name, value })
            });
            
            if(response.ok) {
                showToast('Variable created successfully!');
                createVariableModal.classList.add('hidden');
                fetchVariables();
            } else {
                const data = await response.json();
                showToast(data.detail || 'Failed to create variable', true);
            }
        } catch(e) {
            showToast('Server connection error', true);
        }
    });
}

window.deleteVariable = async function(name) {
    if(confirm(`Delete variable '${name}'?`)) {
        try {
            const response = await fetch(`/api/admin/variables/${name}?app_id=${activeAppId}`, { method: 'DELETE' });
            if(response.ok) {
                showToast('Variable deleted');
                fetchVariables();
            } else {
                showToast('Failed to delete variable', true);
            }
        } catch(e) {
            showToast('Server connection error', true);
        }
    }
};

// ==========================================
// WEBHOOKS MANAGEMENT
// ==========================================
let webhooksList = [];
const webhooksTableBody = document.getElementById('webhooks-table-body');
const noWebhooksMsg = document.getElementById('no-webhooks-msg');
const createWebhookModal = document.getElementById('create-webhook-modal');
const btnCreateWebhook = document.getElementById('btn-create-webhook');
const btnCloseWebhookModal = document.getElementById('btn-close-webhook-modal');
const createWebhookForm = document.getElementById('create-webhook-form');

async function fetchWebhooks() {
    if (!activeAppId) return;
    try {
        const response = await fetch(`/api/admin/webhooks?app_id=${activeAppId}`);
        if (response.ok) {
            webhooksList = await response.json();
            renderWebhooks();
        } else {
            showToast('Failed to fetch webhooks', true);
        }
    } catch (e) {
        showToast('Server connection error!', true);
    }
}

function renderWebhooks() {
    if (!webhooksTableBody) return;
    webhooksTableBody.innerHTML = '';
    
    if (webhooksList.length === 0) {
        if (noWebhooksMsg) noWebhooksMsg.classList.remove('hidden');
    } else {
        if (noWebhooksMsg) noWebhooksMsg.classList.add('hidden');
        
        webhooksList.forEach(webhook => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${webhook.name}</strong></td>
                <td style="font-family: monospace; font-size: 0.8rem; color: var(--color-blue);">${webhook.url}</td>
                <td>
                    <div class="action-buttons" style="justify-content: center;">
                        <button onclick="deleteWebhook('${webhook.name}')" class="btn-action ban-btn" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </td>
            `;
            webhooksTableBody.appendChild(tr);
        });
    }
}

if(btnCreateWebhook) {
    btnCreateWebhook.addEventListener('click', () => {
        if(!activeAppId) return showToast('Please select an application', true);
        createWebhookForm.reset();
        createWebhookModal.classList.remove('hidden');
    });
}

if(btnCloseWebhookModal) {
    btnCloseWebhookModal.addEventListener('click', () => {
        createWebhookModal.classList.add('hidden');
    });
}

if(createWebhookForm) {
    createWebhookForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-webhook-name').value;
        const url = document.getElementById('new-webhook-url').value;
        
        try {
            const response = await fetch('/api/admin/webhooks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ app_id: activeAppId, name, url })
            });
            
            if(response.ok) {
                showToast('Webhook created successfully!');
                createWebhookModal.classList.add('hidden');
                fetchWebhooks();
            } else {
                const data = await response.json();
                showToast(data.detail || 'Failed to create webhook', true);
            }
        } catch(e) {
            showToast('Server connection error', true);
        }
    });
}

window.deleteWebhook = async function(name) {
    if(confirm(`Delete webhook '${name}'?`)) {
        try {
            const response = await fetch(`/api/admin/webhooks/${name}?app_id=${activeAppId}`, { method: 'DELETE' });
            if(response.ok) {
                showToast('Webhook deleted');
                fetchWebhooks();
            } else {
                showToast('Failed to delete webhook', true);
            }
        } catch(e) {
            showToast('Server connection error', true);
        }
    }
};

// ==========================================
// PHASE 3 FEATURES
// ==========================================

// SESSIONS
window.fetchSessions = async function() {
    if(!activeAppId) return;
    try {
        const res = await fetch(`/api/admin/sessions?app_id=${activeAppId}`);
        const sessions = await res.json();
        const tbody = document.getElementById('sessions-table-body');
        tbody.innerHTML = '';
        if(sessions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:20px;">No active sessions</td></tr>';
        } else {
            sessions.forEach(s => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-family: monospace; font-size:0.8rem;">${s.session_id.substring(0, 10)}...</td>
                    <td><strong>${s.username}</strong></td>
                    <td style="font-family: monospace; font-size:0.8rem;">${s.hwid}</td>
                    <td>${new Date(s.login_time || s.login_at).toLocaleString()}</td>
                    <td>
                        <div class="action-buttons" style="justify-content:center;">
                            <button onclick="deleteSession('${s.session_id}')" class="btn-action ban-btn" title="Kill Session"><i class="fa-solid fa-power-off"></i></button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch(e) { console.error(e); }
}

window.deleteSession = async function(sessionId) {
    if(confirm('Kill this session?')) {
        await fetch(`/api/admin/sessions/${sessionId}?app_id=${activeAppId}`, {method: 'DELETE'});
        showToast('Session killed');
        fetchSessions();
    }
};

// FILES
window.fetchFiles = async function() {
    if(!activeAppId) return;
    try {
        const res = await fetch(`/api/admin/files?app_id=${activeAppId}`);
        const files = await res.json();
        const tbody = document.getElementById('files-table-body');
        tbody.innerHTML = '';
        if(files.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:20px;">No files uploaded</td></tr>';
        } else {
            files.forEach(f => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${f.filename}</strong></td>
                    <td>${(f.size/1024).toFixed(2)} KB</td>
                    <td>${new Date(f.uploaded_at).toLocaleString()}</td>
                    <td>
                        <div class="action-buttons" style="justify-content:center;">
                            <button onclick="deleteFile('${f.id}')" class="btn-action ban-btn"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch(e) {}
}

window.deleteFile = async function(fileId) {
    if(confirm('Delete file?')) {
        await fetch(`/api/admin/files/${fileId}?app_id=${activeAppId}`, {method: 'DELETE'});
        showToast('File deleted');
        fetchFiles();
    }
};

const btnUploadFileModal = document.getElementById('btn-upload-file-modal');
const uploadFileModal = document.getElementById('upload-file-modal');
const uploadFileForm = document.getElementById('upload-file-form');
if(btnUploadFileModal) btnUploadFileModal.onclick = () => { if(activeAppId) uploadFileModal.classList.remove('hidden'); else showToast('Select an app', true); };
if(document.getElementById('btn-close-file-modal')) document.getElementById('btn-close-file-modal').onclick = () => uploadFileModal.classList.add('hidden');

if(uploadFileForm) {
    uploadFileForm.onsubmit = async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('file-input');
        if(!fileInput.files[0]) return;
        const formData = new FormData();
        formData.append('app_id', activeAppId);
        formData.append('file', fileInput.files[0]);
        
        try {
            const res = await fetch('/api/admin/files', { method: 'POST', body: formData });
            if(res.ok) { showToast('File uploaded'); uploadFileModal.classList.add('hidden'); uploadFileForm.reset(); fetchFiles(); }
            else showToast('Upload failed', true);
        } catch(e) { showToast('Error', true); }
    };
}

// CHATS
window.fetchChats = async function() {
    if(!activeAppId) return;
    try {
        const res = await fetch(`/api/admin/chats?app_id=${activeAppId}`);
        const chats = await res.json();
        const tbody = document.getElementById('chats-table-body');
        tbody.innerHTML = '';
        if(chats.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:20px;">No messages</td></tr>';
        } else {
            chats.forEach(c => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${c.username}</strong></td>
                    <td>${c.message}</td>
                    <td>${new Date(c.timestamp).toLocaleString()}</td>
                    <td>
                        <div class="action-buttons" style="justify-content:center;">
                            <button onclick="deleteChat('${c.id}')" class="btn-action ban-btn"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch(e) {}
}

window.deleteChat = async function(msgId) {
    if(confirm('Delete message?')) {
        await fetch(`/api/admin/chats/${msgId}?app_id=${activeAppId}`, {method: 'DELETE'});
        fetchChats();
    }
};

// RESOURCES
window.fetchResources = async function() {
    if(!activeAppId) return;
    try {
        const res = await fetch(`/api/admin/resources?app_id=${activeAppId}`);
        const resources = await res.json();
        const tbody = document.getElementById('resources-table-body');
        tbody.innerHTML = '';
        if(resources.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:20px;">No resources found</td></tr>';
        } else {
            resources.forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${r.title}</strong></td>
                    <td style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.content}</td>
                    <td>
                        <div class="action-buttons" style="justify-content:center;">
                            <button onclick="deleteResource('${r.id}')" class="btn-action ban-btn"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch(e) {}
}

window.deleteResource = async function(resId) {
    if(confirm('Delete resource?')) {
        await fetch(`/api/admin/resources/${resId}?app_id=${activeAppId}`, {method: 'DELETE'});
        showToast('Resource deleted');
        fetchResources();
    }
};

const btnAddResourceModal = document.getElementById('btn-add-resource-modal');
const addResourceModal = document.getElementById('add-resource-modal');
const addResourceForm = document.getElementById('add-resource-form');
if(btnAddResourceModal) btnAddResourceModal.onclick = () => { if(activeAppId) addResourceModal.classList.remove('hidden'); else showToast('Select an app', true); };
if(document.getElementById('btn-close-resource-modal')) document.getElementById('btn-close-resource-modal').onclick = () => addResourceModal.classList.add('hidden');

if(addResourceForm) {
    addResourceForm.onsubmit = async (e) => {
        e.preventDefault();
        const title = document.getElementById('resource-title').value;
        const content = document.getElementById('resource-content').value;
        
        try {
            const res = await fetch('/api/admin/resources', { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({app_id: activeAppId, title, content}) 
            });
            if(res.ok) { showToast('Resource saved'); addResourceModal.classList.add('hidden'); addResourceForm.reset(); fetchResources(); }
            else showToast('Failed', true);
        } catch(e) { showToast('Error', true); }
    };
}

// RULES
window.fetchRules = async function() {
    if(!activeAppId) return;
    try {
        const activeApp = appsList.find(a => a.id === activeAppId) || {};
        const rules = activeApp.rules || { hwid_lock: true, block_vpn: false, block_dev_mode: false, key_prefix: "AnikXCheats" };
        
        const hwidEl = document.getElementById('rule-hwid-lock');
        const vpnEl = document.getElementById('rule-block-vpn');
        const devEl = document.getElementById('rule-block-dev');
        const prefixEl = document.getElementById('rule-key-prefix');
        
        if (hwidEl) hwidEl.checked = rules.hwid_lock !== false;
        if (vpnEl) vpnEl.checked = rules.block_vpn === true;
        if (devEl) devEl.checked = rules.block_dev_mode === true;
        if (prefixEl) prefixEl.value = rules.key_prefix || "AnikXCheats";
    } catch(e) {}
}

const rulesForm = document.getElementById('rules-form');
if(rulesForm) {
    rulesForm.onsubmit = async (e) => {
        e.preventDefault();
        if(!activeAppId) return showToast('Please select an application first', true);
        
        const hwidEl = document.getElementById('rule-hwid-lock');
        const vpnEl = document.getElementById('rule-block-vpn');
        const devEl = document.getElementById('rule-block-dev');
        const prefixEl = document.getElementById('rule-key-prefix');
        
        const hwid_lock = hwidEl ? hwidEl.checked : true;
        const block_vpn = vpnEl ? vpnEl.checked : false;
        const block_dev_mode = devEl ? devEl.checked : false;
        const key_prefix = (prefixEl ? prefixEl.value.trim() : "") || "AnikXCheats";
        
        try {
            const res = await fetch(`/api/admin/apps/${activeAppId}/rules`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ hwid_lock, block_vpn, block_dev_mode, key_prefix })
            });
            if(res.ok) {
                const data = await res.json();
                const activeApp = appsList.find(a => a.id === activeAppId);
                if(activeApp) {
                    activeApp.rules = data.rules || { hwid_lock, block_vpn, block_dev_mode, key_prefix };
                }
                showToast(`Key Prefix set to "${key_prefix}" & Rules saved!`);
                await fetchApps();
                fetchRules();
            } else { 
                const data = await res.json();
                showToast(data.detail || 'Failed to update rules', true); 
            }
        } catch(e) { showToast('Server error', true); }
    };
}

// ==========================================
// MOBILE NAVIGATION MENU TOGGLE
// ==========================================
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebarEl = document.querySelector('.sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

function toggleMobileSidebar(show) {
    if (!sidebarEl) return;
    if (show === undefined) {
        show = !sidebarEl.classList.contains('mobile-open');
    }
    
    if (show) {
        sidebarEl.classList.add('mobile-open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('hidden');
    } else {
        sidebarEl.classList.remove('mobile-open');
        if (sidebarOverlay) sidebarOverlay.classList.add('hidden');
    }
}

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMobileSidebar();
    });
}

if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
        toggleMobileSidebar(false);
    });
}

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = item.getAttribute('data-tab');
        if (tabId) {
            switchTab(tabId);
            if (activeAppId) {
                updateActiveAppDisplay();
            }
        }
        if (window.innerWidth <= 1024) {
            toggleMobileSidebar(false);
        }
    });
});
window.switchTab = switchTab;

// ==========================================
// NOTIFICATION BELL & DROPDOWN TOGGLE
// ==========================================
const notificationBellBtn = document.getElementById('notification-bell-btn');
const notificationDropdown = document.getElementById('notification-dropdown');
const clearNotificationsBtn = document.getElementById('clear-notifications-btn');

if (notificationBellBtn && notificationDropdown) {
    notificationBellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notificationDropdown.classList.toggle('hidden');
    });
    
    document.addEventListener('click', (e) => {
        if (!notificationDropdown.contains(e.target) && !notificationBellBtn.contains(e.target)) {
            notificationDropdown.classList.add('hidden');
        }
    });
}

if (clearNotificationsBtn) {
    clearNotificationsBtn.addEventListener('click', () => {
        notificationsList = [];
        renderNotifications();
    });
}
