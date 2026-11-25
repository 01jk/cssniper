/**
 * Settings Page - Bot Configuration
 * New Multi-Account Architecture
 */

let currentSettings = null;

// Temporary state to hold account lists during editing
let scannerAccounts = [];
let marketDataAccounts = [];
let autoBuyAccounts = [];

async function renderSettings() {
    const container = document.getElementById('app');
    
    // Store current scroll position if we're re-rendering
    const isReRender = container.innerHTML !== '';
    const mainContent = document.querySelector('main');
    const scrollTop = isReRender ? (mainContent ? mainContent.scrollTop : (window.pageYOffset || document.documentElement.scrollTop)) : 0;
    
    showLoading(container);

    try {
        // Load current settings from API
        currentSettings = await API.getSettings();

        // --- MIGRATION / INITIALIZATION LOGIC ---

        // 1. Scanner Accounts
        if (currentSettings?.scanner?.accounts && currentSettings.scanner.accounts.length > 0) {
            scannerAccounts = [...currentSettings.scanner.accounts];
        } else {
            // Fallback: Populate from old fields
            const oldKey = currentSettings?.scanner?.api_key || '';
            const oldProxies = currentSettings?.scanner?.monitoring_proxies || [];

            if (oldProxies.length > 0) {
                scannerAccounts = oldProxies.map(p => ({ api_key: oldKey, proxy: p }));
            } else if (oldKey) {
                // Key but no proxies
                scannerAccounts = [{ api_key: oldKey, proxy: '' }];
            } else {
                scannerAccounts = [];
            }
        }

        // 2. Market Data Accounts
        if (currentSettings?.market_data?.accounts && currentSettings.market_data.accounts.length > 0) {
            marketDataAccounts = [...currentSettings.market_data.accounts];
        } else {
            // Fallback: Populate from old fields
            const oldKey = currentSettings?.scanner?.api_key || ''; // Use same key by default
            const oldProxies = currentSettings?.market_data?.proxies || [];

            if (oldProxies.length > 0) {
                marketDataAccounts = oldProxies.map(p => ({ api_key: oldKey, proxy: p }));
            } else {
                marketDataAccounts = [];
            }
        }

        // 3. Auto Buy Accounts
        if (currentSettings?.auto_buy?.accounts && currentSettings.auto_buy.accounts.length > 0) {
            autoBuyAccounts = [...currentSettings.auto_buy.accounts];
        } else {
            // Fallback
            const oldKey = currentSettings?.scanner?.api_key || '';
            const oldSniperProxy = currentSettings?.scanner?.sniper_proxy || '';

            if (oldKey || oldSniperProxy) {
                autoBuyAccounts = [{ api_key: oldKey, proxy: oldSniperProxy }];
            } else {
                autoBuyAccounts = [];
            }
        }

        // Other generic settings
        const telegramToken = currentSettings?.bot?.telegram_bot_token || '';
        const telegramChatId = currentSettings?.bot?.telegram_chat_id || '';

        const minPoll = currentSettings?.scanner?.poll_interval_min || 0.5;
        const maxPoll = currentSettings?.scanner?.poll_interval_max || 0.6;
        const minDelay = currentSettings?.scanner?.pre_delay_min || 0.1;
        const maxDelay = currentSettings?.scanner?.pre_delay_max || 0.15;
        const baseDelay = currentSettings?.scanner?.base_delay || 30.0;
        const useProxies = currentSettings?.scanner?.use_proxies || false;


        container.innerHTML = `
            <div class="space-y-6 pb-20">
                <h1 class="text-3xl font-bold">Bot Configuration</h1>
                
                <form id="settings-form" onsubmit="saveSettings(event)" class="space-y-6">
                    
                    <!-- 1. Scanner Accounts Section -->
                    <div class="bg-gray-800 p-6 rounded-lg border border-gray-700">
                        <div class="flex justify-between items-center mb-4">
                            <div>
                                <h2 class="text-xl font-bold">📡 Scanner Accounts</h2>
                                <p class="text-sm text-gray-400">Accounts used for monitoring listings.</p>
                            </div>
                            <button type="button" onclick="addAccount('scanner')" class="btn btn-sm btn-primary">+ Add Account</button>
                        </div>
                        
                        <div id="scanner-accounts-list" class="space-y-3">
                            ${renderAccountList('scanner', scannerAccounts)}
                        </div>
                    </div>

                    <!-- 2. Market Data Accounts Section -->
                    <div class="bg-gray-800 p-6 rounded-lg border border-gray-700">
                        <div class="flex justify-between items-center mb-4">
                            <div>
                                <h2 class="text-xl font-bold">📊 Market Data Accounts</h2>
                                <p class="text-sm text-gray-400">Accounts used for fetching buy orders & price lists.</p>
                            </div>
                            <button type="button" onclick="addAccount('marketData')" class="btn btn-sm btn-primary">+ Add Account</button>
                        </div>
                        
                        <div id="market-data-accounts-list" class="space-y-3">
                            ${renderAccountList('marketData', marketDataAccounts)}
                        </div>
                    </div>

                    <!-- 3. Auto Buy Accounts Section -->
                    <div class="bg-gray-800 p-6 rounded-lg border border-gray-700">
                        <div class="flex justify-between items-center mb-4">
                            <div>
                                <h2 class="text-xl font-bold">🛒 Auto Buy Accounts</h2>
                                <p class="text-sm text-gray-400">Accounts used for purchasing items.</p>
                            </div>
                            <button type="button" onclick="addAccount('autoBuy')" class="btn btn-sm btn-primary">+ Add Account</button>
                        </div>
                        
                        <div id="auto-buy-accounts-list" class="space-y-3">
                            ${renderAccountList('autoBuy', autoBuyAccounts)}
                        </div>
                    </div>

                    <!-- Telegram Settings -->
                    <div class="bg-gray-800 p-6 rounded-lg border border-gray-700">
                        <h2 class="text-xl font-bold mb-4">📱 Telegram Bot</h2>
                        <div class="space-y-4">
                            <div>
                                <label class="form-label">Bot Token</label>
                                <div class="relative">
                                    <input type="password" id="tg-token-input" name="telegram_bot_token" class="form-input pr-12" 
                                        value="${telegramToken}" placeholder="Enter your Telegram bot token">
                                    <button type="button" onclick="togglePasswordVisibility('tg-token-input', 'tg-token-toggle')" 
                                        class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                                        <span id="tg-token-toggle">👁️</span>
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label class="form-label">Chat ID</label>
                                <input type="text" name="telegram_chat_id" class="form-input" 
                                    value="${telegramChatId}" placeholder="['123456789']">
                            </div>
                        </div>
                    </div>
                    
                    <!-- Performance Settings -->
                    <div class="bg-gray-800 p-6 rounded-lg border border-gray-700">
                        <h2 class="text-xl font-bold mb-4">⚡ Performance & Delays</h2>
                        
                        <div class="space-y-5">
                            <!-- Min Poll Interval -->
                            <div>
                                <label class="form-label flex justify-between">
                                    <span>Min Poll Interval (s)</span>
                                    <span id="min-poll-value" class="text-red-400 font-mono">${minPoll.toFixed(2)}</span>
                                </label>
                                <input type="range" name="min_poll_interval" class="slider w-full" 
                                    min="0" max="2" step="0.01" value="${minPoll}"
                                    oninput="updateSliderValue('min-poll-value', this.value)">
                            </div>
                            
                            <!-- Max Poll Interval -->
                            <div>
                                <label class="form-label flex justify-between">
                                    <span>Max Poll Interval (s)</span>
                                    <span id="max-poll-value" class="text-red-400 font-mono">${maxPoll.toFixed(2)}</span>
                                </label>
                                <input type="range" name="max_poll_interval" class="slider w-full" 
                                    min="0" max="2" step="0.01" value="${maxPoll}"
                                    oninput="updateSliderValue('max-poll-value', this.value)">
                            </div>
                            
                            <!-- Min/Max Pre-Delay -->
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="form-label flex justify-between">
                                        <span>Min Pre-Delay (s)</span>
                                        <span id="min-delay-value" class="text-red-400 font-mono">${minDelay.toFixed(2)}</span>
                                    </label>
                                    <input type="range" name="min_pre_delay" class="slider w-full" 
                                        min="0" max="1" step="0.01" value="${minDelay}"
                                        oninput="updateSliderValue('min-delay-value', this.value)">
                                </div>
                                <div>
                                    <label class="form-label flex justify-between">
                                        <span>Max Pre-Delay (s)</span>
                                        <span id="max-delay-value" class="text-red-400 font-mono">${maxDelay.toFixed(2)}</span>
                                    </label>
                                    <input type="range" name="max_pre_delay" class="slider w-full" 
                                        min="0" max="1" step="0.01" value="${maxDelay}"
                                        oninput="updateSliderValue('max-delay-value', this.value)">
                                </div>
                            </div>
                            
                            <!-- Base Delay -->
                            <div>
                                <label class="form-label flex justify-between">
                                    <span>Base Delay / 429 Wait (s)</span>
                                    <span id="base-delay-value" class="text-red-400 font-mono">${baseDelay.toFixed(2)}</span>
                                </label>
                                <input type="range" name="base_delay" class="slider w-full" 
                                    min="0" max="60" step="0.1" value="${baseDelay}"
                                    oninput="updateSliderValue('base-delay-value', this.value)">
                            </div>
                            
                             <div>
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" name="use_proxies" class="w-5 h-5" ${useProxies ? 'checked' : ''}>
                                    <span class="text-sm">Use Proxies (Enable/Disable Rotation Logic)</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Save Button -->
                    <div class="sticky bottom-6 z-10">
                        <button type="submit" class="btn btn-success w-full py-3 shadow-lg text-lg font-bold">
                            💾 Save All Configuration
                        </button>
                    </div>
                </form>
            </div>
        `;

        // Restore scroll position if this was a re-render
        if (isReRender && scrollTop > 0) {
            setTimeout(() => {
                const currentMainContent = document.querySelector('main');
                if (currentMainContent) {
                    currentMainContent.scrollTop = scrollTop;
                } else {
                    window.scrollTo(0, scrollTop);
                }
            }, 50);
        }

    } catch (error) {
        console.error(error);
        container.innerHTML = `
            <div class="text-center text-red-400">
                <p class="text-xl mb-2">❌ Error loading settings</p>
                <p class="text-sm">${error.message}</p>
            </div>
        `;
    }
}

// --- Helper Functions for Account Lists ---

function renderAccountList(type, accounts) {
    if (!accounts || accounts.length === 0) {
        return `<div class="text-gray-500 text-sm italic text-center py-2">No accounts configured</div>`;
    }

    return accounts.map((acc, index) => {
        const inputId = `apikey-${type}-${index}`;
        const iconId = `icon-${type}-${index}`;

        return `
        <div class="grid grid-cols-12 gap-2 items-center bg-gray-900 p-3 rounded border border-gray-700">
            <div class="col-span-4 relative">
                <input type="password" 
                    id="${inputId}"
                    class="form-input bg-gray-800 text-sm pr-10" 
                    placeholder="API Key" 
                    value="${acc.api_key || ''}" 
                    oninput="updateAccountInline('${type}', ${index}, 'api_key', this.value)"
                    onchange="updateAccount('${type}', ${index}, 'api_key', this.value)"
                >
                <button type="button" onclick="togglePasswordVisibility('${inputId}', '${iconId}')" 
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    <span id="${iconId}">👁️</span>
                </button>
            </div>
            <div class="col-span-7">
                <input type="text" 
                    class="form-input bg-gray-800 text-sm font-mono" 
                    placeholder="http://user:pass@host:port" 
                    value="${acc.proxy || ''}" 
                    oninput="updateAccountInline('${type}', ${index}, 'proxy', this.value)"
                    onchange="updateAccount('${type}', ${index}, 'proxy', this.value)"
                >
            </div>
            <div class="col-span-1 text-right">
                <button type="button" onclick="removeAccount('${type}', ${index})" class="text-red-400 hover:text-red-300">
                    🗑️
                </button>
            </div>
        </div>
        `;
    }).join('');
}

function updateAccountInline(type, index, field, value) {
    if (type === 'scanner') scannerAccounts[index][field] = value;
    if (type === 'marketData') marketDataAccounts[index][field] = value;
    if (type === 'autoBuy') autoBuyAccounts[index][field] = value;
    
    // Don't re-render anything - just update the data in memory
    // This allows continuous typing without losing focus
}

function updateAccount(type, index, field, value) {
    if (type === 'scanner') scannerAccounts[index][field] = value;
    if (type === 'marketData') marketDataAccounts[index][field] = value;
    if (type === 'autoBuy') autoBuyAccounts[index][field] = value;
    
    // Don't re-render on input - just update the data
    // This prevents losing focus while typing
    return false;
}

function addAccount(type) {
    const newAcc = { api_key: '', proxy: '' };
    if (type === 'scanner') scannerAccounts.push(newAcc);
    if (type === 'marketData') marketDataAccounts.push(newAcc);
    if (type === 'autoBuy') autoBuyAccounts.push(newAcc);

    // Store current scroll position of the main content area
    const mainContent = document.querySelector('main');
    const scrollTop = mainContent ? mainContent.scrollTop : (window.pageYOffset || document.documentElement.scrollTop);

    // Re-render just the list
    const listEl = document.getElementById(`${type === 'scanner' ? 'scanner' : type === 'marketData' ? 'market-data' : 'auto-buy'}-accounts-list`);
    if (listEl) {
        listEl.innerHTML = renderAccountList(type,
            type === 'scanner' ? scannerAccounts :
                type === 'marketData' ? marketDataAccounts : autoBuyAccounts
        );
    }

    // Restore scroll position immediately
    if (mainContent) {
        mainContent.scrollTop = scrollTop;
    } else {
        window.scrollTo(0, scrollTop);
    }
}

function removeAccount(type, index) {
    // Store current scroll position of the main content area
    const mainContent = document.querySelector('main');
    const scrollTop = mainContent ? mainContent.scrollTop : (window.pageYOffset || document.documentElement.scrollTop);

    if (type === 'scanner') scannerAccounts.splice(index, 1);
    if (type === 'marketData') marketDataAccounts.splice(index, 1);
    if (type === 'autoBuy') autoBuyAccounts.splice(index, 1);

    const listEl = document.getElementById(`${type === 'scanner' ? 'scanner' : type === 'marketData' ? 'market-data' : 'auto-buy'}-accounts-list`);
    if (listEl) {
        listEl.innerHTML = renderAccountList(type,
            type === 'scanner' ? scannerAccounts :
                type === 'marketData' ? marketDataAccounts : autoBuyAccounts
        );
    }

    // Restore scroll position immediately
    if (mainContent) {
        mainContent.scrollTop = scrollTop;
    } else {
        window.scrollTo(0, scrollTop);
    }
}

// --- Standard Settings Functions ---

function updateSliderValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = parseFloat(value).toFixed(2);
    }
}

function togglePasswordVisibility(inputId, toggleIconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(toggleIconId);

    if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = '🙈';
    } else {
        input.type = 'password';
        icon.textContent = '👁️';
    }
}

async function saveSettings(event) {
    event.preventDefault();
    
    // Store current scroll position of the main content area
    const mainContent = document.querySelector('main');
    const scrollTop = mainContent ? mainContent.scrollTop : (window.pageYOffset || document.documentElement.scrollTop);
    
    const form = event.target;
    const formData = new FormData(form);

    try {
        // Parse telegram chat ID
        let chatIdValue = formData.get('telegram_chat_id').trim();
        let parsedChatId;

        if (chatIdValue.startsWith('[')) {
            parsedChatId = chatIdValue; // Already array string
        } else if (chatIdValue.includes(',')) {
            const ids = chatIdValue.split(',').map(id => `'${id.trim()}'`);
            parsedChatId = `[${ids.join(', ')}]`;
        } else {
            parsedChatId = chatIdValue;
        }

        // Rebuild settings object with new account structures
        const settings = {
            ...currentSettings,
            scanner: {
                ...currentSettings.scanner,
                // -- New Structure --
                accounts: scannerAccounts.filter(a => a.api_key || a.proxy), // Filter empty
                // -- Keep legacy fields updated for safety --
                api_key: scannerAccounts.length > 0 ? scannerAccounts[0].api_key : '',
                monitoring_proxies: scannerAccounts.map(a => a.proxy).filter(p => p),
                sniper_proxy: autoBuyAccounts.length > 0 ? autoBuyAccounts[0].proxy : '',

                poll_interval_min: parseFloat(formData.get('min_poll_interval')),
                poll_interval_max: parseFloat(formData.get('max_poll_interval')),
                pre_delay_min: parseFloat(formData.get('min_pre_delay')),
                pre_delay_max: parseFloat(formData.get('max_pre_delay')),
                base_delay: parseFloat(formData.get('base_delay')),
                use_proxies: formData.get('use_proxies') === 'on'
            },
            market_data: {
                ...currentSettings.market_data,
                accounts: marketDataAccounts.filter(a => a.api_key || a.proxy),
                proxies: marketDataAccounts.map(a => a.proxy).filter(p => p)
            },
            auto_buy: {
                accounts: autoBuyAccounts.filter(a => a.api_key || a.proxy),
            },
            bot: {
                ...currentSettings.bot,
                telegram_bot_token: formData.get('telegram_bot_token'),
                telegram_chat_id: parsedChatId
            }
        };

        await API.updateSettings(settings);
        showToast('Settings saved successfully! Restart bot for changes to take effect.', 'success');

        // Reload to ensure sync but preserve scroll position
        setTimeout(() => {
            renderSettings().then(() => {
                // Restore scroll position after re-render
                const currentMainContent = document.querySelector('main');
                if (currentMainContent) {
                    currentMainContent.scrollTop = scrollTop;
                } else {
                    window.scrollTo(0, scrollTop);
                }
            });
        }, 1000);

    } catch (error) {
        showToast(`Failed to save settings: ${error.message}`, 'error');
        // Restore scroll position even on error
        const currentMainContent = document.querySelector('main');
        if (currentMainContent) {
            currentMainContent.scrollTop = scrollTop;
        } else {
            window.scrollTo(0, scrollTop);
        }
    }
}
