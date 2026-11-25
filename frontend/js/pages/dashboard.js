/**
 * Dashboard Page
 * Shows overview stats and metrics
 */

let logRefreshInterval = null;

async function renderDashboard() {
    const container = document.getElementById('app');

    try {
        const [stats, balanceData] = await Promise.all([
            API.getDashboardStats(),
            API.getCSFloatBalance().catch(() => ({ balance: 0 }))
        ]);

        const balanceUSD = (balanceData.balance / 100).toFixed(2);

        container.innerHTML = `
            <div class="space-y-6">
                <h1 class="text-3xl font-bold">Real-time Overview</h1>
                
                <!-- Stats Cards -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div class="bg-gray-800 p-6 rounded-lg border border-gray-700">
                        <div class="text-sm text-gray-400 mb-2">Balance</div>
                        <div class="text-3xl font-bold text-green-400">$${balanceUSD}</div>
                        <div class="text-xs text-gray-500 mt-1">CSFloat</div>
                    </div>
                    
                    <div class="bg-gray-800 p-6 rounded-lg border border-gray-700">
                        <div class="text-sm text-gray-400 mb-2">Items Found (24h)</div>
                        <div class="text-3xl font-bold text-blue-400">${stats.items_found_24h}</div>
                        <div class="text-xs text-gray-500 mt-1">Last 24 hours</div>
                    </div>
                    
                    <div class="bg-gray-800 p-6 rounded-lg border border-gray-700">
                        <div class="text-sm text-gray-400 mb-2">Items Bought (24h)</div>
                        <div class="text-3xl font-bold text-purple-400">${stats.items_bought_24h}</div>
                        <div class="text-xs text-gray-500 mt-1">Auto-purchased</div>
                    </div>
                    
                    <div class="bg-gray-800 p-6 rounded-lg border border-gray-700">
                        <div class="text-sm text-gray-400 mb-2">Active Targets</div>
                        <div class="text-3xl font-bold text-yellow-400">${stats.active_targets}/${stats.total_targets}</div>
                        <div class="text-xs text-gray-500 mt-1">Monitoring</div>
                    </div>
                </div>
                
                <!-- Quick Actions -->
                <div class="bg-gray-800 p-6 rounded-lg border border-gray-700">
                    <h2 class="text-xl font-bold mb-4">Quick Actions</h2>
                    <div class="flex gap-4">
                        <button onclick="window.location.hash='targets'" class="btn btn-primary">
                            🎯 Manage Targets
                        </button>
                        <button onclick="window.location.hash='history'" class="btn btn-secondary">
                            📜 View History
                        </button>
                        <button onclick="window.location.hash='settings'" class="btn btn-secondary">
                            ⚙️ Settings
                        </button>
                    </div>
                </div>
                
                <!-- Live Log -->
                <div class="bg-gray-800 p-6 rounded-lg border border-gray-700">
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-xl font-bold">📋 Live Log (Last 20 lines)</h2>
                        <button onclick="refreshLogs()" class="text-sm text-blue-400 hover:text-blue-300">
                            🔄 Refresh
                        </button>
                    </div>
                    <div id="log-container" class="bg-gray-900 p-4 rounded-lg font-mono text-xs max-h-96 overflow-y-auto">
                        <div class="text-gray-400">Loading logs...</div>
                    </div>
                </div>
            </div>
        `;

        // Load logs initially
        await refreshLogs();

        // Auto-refresh logs every 5 seconds
        if (logRefreshInterval) {
            clearInterval(logRefreshInterval);
        }
        logRefreshInterval = setInterval(refreshLogs, 5000);

    } catch (error) {
        container.innerHTML = `
            <div class="text-center text-red-400">
                <p class="text-xl mb-2">❌ Error loading dashboard</p>
                <p class="text-sm">${error.message}</p>
            </div>
        `;
    }
}

async function refreshLogs() {
    const logContainer = document.getElementById('log-container');
    if (!logContainer) return;

    try {
        const response = await API.getLogs(20);
        const logs = response.logs || [];

        if (logs.length === 0) {
            logContainer.innerHTML = '<div class="text-gray-500">No logs available yet.</div>';
            return;
        }

        // Format logs with color coding based on level
        logContainer.innerHTML = logs.map(line => {
            let colorClass = 'text-gray-300';

            if (line.includes('ERROR')) {
                colorClass = 'text-red-400';
            } else if (line.includes('WARNING')) {
                colorClass = 'text-yellow-400';
            } else if (line.includes('INFO')) {
                colorClass = 'text-blue-300';
            } else if (line.includes('MATCH FOUND') || line.includes('FOUND LOT')) {
                colorClass = 'text-green-400 font-bold';
            }

            // Escape HTML
            const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            return `<div class="${colorClass}">${escaped}</div>`;
        }).join('');

        // Auto-scroll to bottom
        logContainer.scrollTop = logContainer.scrollHeight;

    } catch (error) {
        logContainer.innerHTML = `<div class="text-red-400">Error loading logs: ${error.message}</div>`;
    }
}

// Cleanup interval on page change
window.addEventListener('hashchange', () => {
    if (logRefreshInterval && !window.location.hash.includes('dashboard')) {
        clearInterval(logRefreshInterval);
        logRefreshInterval = null;
    }
});
