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

// Toast helper
function showToast(message, isError = false) {
    toast.textContent = getErrorMessage(message, 'An error occurred');
    toast.className = `toast show ${isError ? 'toast-error' : 'toast-success'}`;
    setTimeout(() => {
        toast.className = 'toast hidden';
    }, 3000);
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
    loginForm.reset();
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
        } else {
            content.classList.remove('active-content');
        }
    });
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
    } else if (activeTab === 'settings') {
        fetch2FAStatus();
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
        noLogsMsg.classList.remove('hidden');
    } else {
        noLogsMsg.classList.add('hidden');
        
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
const toggleAuthModeBtn = document.getElementById('toggle-auth-mode');
const authSubtitle = document.getElementById('auth-subtitle');
const authSubmitBtn = document.getElementById('auth-submit-btn');

if (toggleAuthModeBtn) {
    toggleAuthModeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        
        // Reset 2FA state
        is2FAState = false;
        document.getElementById('login-2fa-group').style.display = 'none';
        document.getElementById('username').closest('.input-group').style.display = 'block';
        document.getElementById('password').closest('.input-group').style.display = 'block';
        
        if (isLoginMode) {
            authSubtitle.textContent = 'Sign in to your administration panel';
            authSubmitBtn.innerHTML = 'Login <i class="fa-solid fa-arrow-right-to-bracket"></i>';
            toggleAuthModeBtn.textContent = 'Need an account? Sign up';
        } else {
            authSubtitle.textContent = 'Create your administration account';
            authSubmitBtn.innerHTML = 'Sign Up <i class="fa-solid fa-user-plus"></i>';
            toggleAuthModeBtn.textContent = 'Already have an account? Log in';
        }
        if (loginError) loginError.classList.add('hidden');
    });
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const usernameInput = document.getElementById('username').value.trim();
    const passwordInput = document.getElementById('password').value;
    const totpInput = document.getElementById('totp_code').value.trim();
    
    loginError.classList.add('hidden');
    
    try {
        const endpoint = isLoginMode ? '/api/admin/login' : '/api/admin/register';
        const payload = { username: usernameInput, password: passwordInput };
        if (is2FAState && isLoginMode) {
            payload.totp_code = totpInput;
        }
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            if (isLoginMode) {
                localStorage.setItem('admin_user', usernameInput);
                showToast('Logged in successfully!');
                showDashboard();
                
                // Reset form state
                is2FAState = false;
                document.getElementById('login-2fa-group').style.display = 'none';
                document.getElementById('username').closest('.input-group').style.display = 'block';
                document.getElementById('password').closest('.input-group').style.display = 'block';
                document.getElementById('totp_code').value = '';
            } else {
                showToast('Registered successfully! Please log in.');
                // Switch back to login mode
                if (toggleAuthModeBtn) toggleAuthModeBtn.click();
                document.getElementById('password').value = '';
            }
        } else if (response.status === 403 && data.detail === "2FA_REQUIRED") {
            // Require 2FA code
            is2FAState = true;
            document.getElementById('username').closest('.input-group').style.display = 'none';
            document.getElementById('password').closest('.input-group').style.display = 'none';
            document.getElementById('login-2fa-group').style.display = 'block';
            document.getElementById('totp_code').focus();
            authSubmitBtn.innerHTML = 'Verify 2FA <i class="fa-solid fa-shield-halved"></i>';
            loginError.textContent = 'Enter your Authenticator Code.';
            loginError.classList.remove('hidden');
            loginError.style.color = 'var(--text-main)';
        } else {
            loginError.textContent = getErrorMessage(data, isLoginMode ? 'Invalid username or password!' : 'Registration failed!');
            loginError.classList.remove('hidden');
            loginError.style.color = 'var(--color-red)';
        }
    } catch (error) {
        loginError.textContent = 'Unable to connect to server!';
        loginError.classList.remove('hidden');
        loginError.style.color = 'var(--color-red)';
    }
});

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
        const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                app_id: activeAppId,
                username,
                password,
                duration_days: duration,
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
    
    try {
        const response = await fetch('/api/admin/licenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ app_id: activeAppId, duration_days: duration, count, note })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast(`${count} license keys generated!`);
            
            generatedKeysList.innerHTML = '';
            data.keys.forEach(key => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span style="font-size:0.8rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:70%;">${key}</span>
                    <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('${key}'); showToast('Key copied!');"><i class="fa-solid fa-copy"></i> Copy</button>
                `;
                generatedKeysList.appendChild(li);
            });
            
            if (generatedKeysWrapper) generatedKeysWrapper.classList.remove('hidden');
            if (generateForm) generateForm.reset();
            if (countInput) countInput.value = 1;
            if (durationSelect) durationSelect.value = 30;
        } else {
            showToast(data, true);
        }
    } catch (error) {
        showToast('Server connection error!', true);
    }
});

// Copy all generated keys button
if (copyAllBtn) {
    copyAllBtn.addEventListener('click', () => {
        const keys = Array.from(generatedKeysList.querySelectorAll('li span')).map(span => span.textContent);
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
    try {
        const response = await fetch('/api/admin/2fa/status');
        if (response.ok) {
            const data = await response.json();
            const statusText = document.getElementById('2fa-status-text');
            const btnEnable = document.getElementById('btn-enable-2fa');
            const btnDisable = document.getElementById('btn-disable-2fa');
            
            document.getElementById('2fa-setup-panel').classList.add('hidden');
            document.getElementById('2fa-disable-panel').classList.add('hidden');
            
            if (data.is_2fa_enabled) {
                statusText.innerHTML = '<i class="fa-solid fa-shield-check" style="color:var(--color-green);"></i> 2FA is Currently <strong>Enabled</strong>';
                btnEnable.classList.add('hidden');
                btnDisable.classList.remove('hidden');
            } else {
                statusText.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:var(--color-orange);"></i> 2FA is Currently <strong>Disabled</strong>';
                btnEnable.classList.remove('hidden');
                btnDisable.classList.add('hidden');
            }
        }
    } catch (e) {
        showToast('Failed to load 2FA status', true);
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
