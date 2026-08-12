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

// Toast helper
function showToast(message, isError = false) {
    const cleanMsg = getErrorMessage(message, 'An error occurred');
    if (toast) {
        toast.textContent = cleanMsg;
        toast.className = `toast-notification ${isError ? 'error' : ''}`;
        toast.classList.remove('hidden');
        setTimeout(() => {
            if (toast) toast.classList.add('hidden');
        }, 3200);
    }
    addSystemNotification(cleanMsg, isError);
}
window.showToast = showToast;

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
    
    switchTab('overview');
    await fetchApps();
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

    if (tabId === 'settings') {
        fetch2FAStatus();
    }
}


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
        
        if (settingsAppName) settingsAppName.textContent = '---';
        if (settingsAppId) settingsAppId.textContent = '---';
        if (settingsAppSecret) settingsAppSecret.textContent = '---';
        window.rawClientSecret = '';
        
        if(statTotalApps) statTotalApps.textContent = '0';
        if(statActiveApps) statActiveApps.textContent = '0';
        
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

// Stats helper
function updateStats() {
    const totalCount = licensesList.length;
    const usedCount = licensesList.filter(l => l.is_used && !l.is_banned).length;
    const bannedCount = licensesList.filter(l => l.is_banned).length;
    const usersCount = usersList.length;

    if(statActiveSessions) {
        statActiveSessions.textContent = usedCount + usersCount;
    }
}

// Update UI displays based on selected app
function updateActiveAppDisplay() {
    const activeApp = appsList.find(a => a.id === activeAppId);
    if (!activeApp) return;
    
    if (activeAppTitle) activeAppTitle.textContent = activeApp.name;
    if (activeAppNames) activeAppNames.forEach(el => el.textContent = activeApp.name);
    
    // Update settings credentials
    if (settingsAppName) settingsAppName.textContent = activeApp.name;
    if (settingsAppId) settingsAppId.textContent = activeApp.id;
    document.querySelectorAll('.active-app-id-text').forEach(el => el.textContent = activeApp.id);
    window.rawClientSecret = activeApp.secret;
    
    // Mask the secret by default
    if (settingsAppSecret) {
        settingsAppSecret.textContent = activeApp.secret;
        settingsAppSecret.style.webkitTextSecurity = 'disc';
    }
    
    window.copyToClipboard = function(elementId, isSecret = false) {
        const el = document.getElementById(elementId);
        if(el) {
            let text = el.textContent;
            if(isSecret && window.rawClientSecret) {
                text = window.rawClientSecret;
            }
            navigator.clipboard.writeText(text);
            showToast('Copied to clipboard!');
        }
    };
    
    // Refresh current tab data
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

// Render Licenses in UI
function renderLicensesTable() {
    if (!licenseTableBody) return;
    licenseTableBody.innerHTML = '';
    
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const statusFilter = filterStatus ? filterStatus.value : 'all';
    
    const filtered = licensesList.filter(lic => {
        const matchesSearch = lic.key.toLowerCase().includes(query) || 
                              (lic.used_by && lic.used_by.toLowerCase().includes(query));
        
        let matchesStatus = true;
        if (statusFilter === 'unused') {
            matchesStatus = !lic.is_used && !lic.is_banned;
        } else if (statusFilter === 'used') {
            matchesStatus = lic.is_used && !lic.is_banned;
        } else if (statusFilter === 'banned') {
            matchesStatus = lic.is_banned;
        }
        
        return matchesSearch && matchesStatus;
    });
    
    updateStats();
    
    if (filtered.length === 0) {
        if (noLicensesMsg) noLicensesMsg.classList.remove('hidden');
    } else {
        if (noLicensesMsg) noLicensesMsg.classList.add('hidden');
        
        filtered.forEach(lic => {
            const tr = document.createElement('tr');
            
            let expiryText = 'N/A';
            if (lic.expires_at) {
                if (lic.expires_at === 'Lifetime') {
                    expiryText = '<span class="text-emerald">Lifetime</span>';
                } else {
                    const date = new Date(lic.expires_at);
                    expiryText = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                }
            }
            
            let statusBadge = '';
            if (lic.is_banned) {
                statusBadge = '<span class="badge badge-banned">Banned</span>';
            } else if (lic.is_used) {
                statusBadge = '<span class="badge badge-used">Active</span>';
            } else {
                statusBadge = '<span class="badge badge-unused">Unused</span>';
            }
            
            const banAction = lic.is_banned 
                ? `<button onclick="unbanLicense('${lic.key}')" class="btn-action reset-btn" title="Unban"><i class="fa-solid fa-unlock"></i></button>`
                : `<button onclick="banLicense('${lic.key}')" class="btn-action ban-btn" title="Ban"><i class="fa-solid fa-ban"></i></button>`;
                
            const resetHwidAction = lic.hwid 
                ? `<button onclick="resetHwid('${lic.key}')" class="btn-action" title="Reset HWID"><i class="fa-solid fa-arrows-rotate"></i></button>`
                : '';
            
            tr.innerHTML = `
                <td class="license-key-cell">${lic.key}</td>
                <td>${lic.used_by || '<span class="text-muted">—</span>'}</td>
                <td>${lic.duration_days === 0 ? 'Lifetime' : lic.duration_days + ' Days'}</td>
                <td style="font-family: var(--font-mono); font-size: 0.8rem;">${lic.hwid || '<span class="text-muted">—</span>'}</td>
                <td>${expiryText}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="action-buttons">
                        ${banAction}
                        ${resetHwidAction}
                        <button onclick="deleteLicense('${lic.key}')" class="btn-action ban-btn" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </td>
            `;
            licenseTableBody.appendChild(tr);
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

// Global Actions for Keys
async function banLicense(key) {
    try {
        const response = await fetch(`/api/admin/licenses/${key}/ban`, { method: 'POST' });
        if (response.ok) {
            showToast('License key has been banned.');
            fetchLicenses();
        } else {
            showToast('Failed to ban license.', true);
        }
    } catch (e) {
        showToast('Server connection error!', true);
    }
}

async function unbanLicense(key) {
    try {
        const response = await fetch(`/api/admin/licenses/${key}/unban`, { method: 'POST' });
        if (response.ok) {
            showToast('License key has been unbanned.');
            fetchLicenses();
        } else {
            showToast('Failed to unban license.', true);
        }
    } catch (e) {
        showToast('Server connection error!', true);
    }
}

async function resetHwid(key) {
    try {
        const response = await fetch(`/api/admin/licenses/${key}/reset_hwid`, { method: 'POST' });
        if (response.ok) {
            showToast('HWID reset successful.');
            fetchLicenses();
        } else {
            showToast('Failed to reset HWID.', true);
        }
    } catch (e) {
        showToast('Server connection error!', true);
    }
}

async function deleteLicense(key) {
    if (!confirm('Are you sure you want to delete this license and its associated user account?')) return;
    try {
        const response = await fetch(`/api/admin/licenses/${key}`, { method: 'DELETE' });
        if (response.ok) {
            showToast('License deleted successfully.');
            fetchLicenses();
        } else {
            showToast('Failed to delete license.', true);
        }
    } catch (e) {
        showToast('Server connection error!', true);
    }
}

// Expose actions to global window scope
window.banLicense = banLicense;
window.unbanLicense = unbanLicense;
window.resetHwid = resetHwid;
window.deleteLicense = deleteLicense;

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

// Generate Keys form trigger
generateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeAppId) {
        showToast('Please select or create an application first.', true);
        return;
    }
    
    const duration = parseInt(durationSelect.value);
    const count = parseInt(countInput.value);
    const note = noteInput ? noteInput.value.trim() : '';
    
    const subscriptionId = document.getElementById('license-subscription-id')?.value || null;
    
    try {
        const response = await fetch('/api/admin/licenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ app_id: activeAppId, duration_days: duration, count, subscription_id: subscriptionId, note })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast(`${count} license keys generated!`);
            
            const listEl = document.getElementById('generated-keys-list');
            const wrapperEl = document.getElementById('generated-keys-wrapper');
            
            if (listEl) {
                listEl.innerHTML = '';
                data.keys.forEach(key => {
                    const li = document.createElement('li');
                    li.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:6px; border:1px solid var(--border-color);';
                    li.innerHTML = `
                        <span style="font-family:var(--font-mono); font-size:0.85rem; color:var(--text-main); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:70%;">${key}</span>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('${key}'); showToast('Key copied!');"><i class="fa-solid fa-copy"></i> Copy</button>
                    `;
                    listEl.appendChild(li);
                });
            }
            
            if (wrapperEl) wrapperEl.classList.remove('hidden');
            if (generateForm) generateForm.reset();
            if (countInput) countInput.value = 1;
            if (durationSelect) durationSelect.value = 30;
            fetchLicenses();
        } else {
            showToast(data, true);
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
        generatedKeysWrapper.classList.add('hidden');
        generateForm.reset();
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
    item.addEventListener('click', () => {
        if (window.innerWidth <= 1024) {
            toggleMobileSidebar(false);
        }
    });
});

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
