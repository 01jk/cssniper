/**
 * Main Application Router & Controller
 */

class App {
    constructor() {
        this.currentPage = null;
        this.init();
    }

    async init() {
        // Setup navigation
        this.setupNavigation();

        // Setup bot status polling
        this.setupBotStatus();

        // Initial route
        this.route();

        // Handle hash changes
        window.addEventListener('hashchange', () => this.route());
    }

    setupNavigation() {
        const links = document.querySelectorAll('.nav-link');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const hash = link.getAttribute('href');
                window.location.hash = hash;
            });
        });
    }

    async setupBotStatus() {
        // Initial check
        await this.updateBotStatus();
        this.updateBalance();

        // Poll bot status every 3 seconds
        setInterval(() => this.updateBotStatus(), 3000);

        // Poll balance every 60 seconds
        setInterval(() => this.updateBalance(), 60000);

        // Setup toggle button
        document.getElementById('bot-toggle-btn').addEventListener('click', async () => {
            const btn = document.getElementById('bot-toggle-btn');
            const indicator = document.getElementById('bot-indicator');

            try {
                const status = await API.getBotStatus();

                if (status.running) {
                    // Stop bot
                    btn.disabled = true;
                    btn.textContent = 'Stopping...';
                    await API.stopBot();
                    showToast('Bot stopped successfully', 'success');
                } else {
                    // Start bot
                    btn.disabled = true;
                    btn.textContent = 'Starting...';
                    await API.startBot();
                    showToast('Bot starting...', 'info');
                }

                // Refresh status
                setTimeout(() => this.updateBotStatus(), 1000);

            } catch (error) {
                showToast(`Error: ${error.message}`, 'error');
            } finally {
                btn.disabled = false;
            }
        });
    }

    async updateBotStatus() {
        try {
            const status = await API.getBotStatus();
            const indicator = document.getElementById('bot-indicator');
            const btn = document.getElementById('bot-toggle-btn');

            if (status.running) {
                indicator.innerHTML = `
                    <span class="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                    <span class="text-xs text-gray-400">Running (PID: ${status.pid})</span>
                `;
                btn.innerHTML = '⏹ Stop Bot';
                btn.className = 'w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors';
            } else {
                indicator.innerHTML = `
                    <span class="w-2 h-2 rounded-full bg-red-500 mr-2"></span>
                    <span class="text-xs text-gray-400">Stopped</span>
                `;
                btn.innerHTML = '▶ Start Bot';
                btn.className = 'w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors';
            }
        } catch (error) {
            console.error('Failed to update bot status:', error);
        }
    }

    async updateBalance() {
        const balanceEl = document.querySelector('#balance-section .text-xl');
        if (!balanceEl) return;

        try {
            const data = await API.getCSFloatBalance();
            const balanceUSD = (data.balance / 100).toFixed(2);
            balanceEl.textContent = `$${balanceUSD}`;
            balanceEl.classList.remove('text-red-400');
            balanceEl.classList.add('text-green-400');
        } catch (error) {
            console.error('Failed to fetch balance:', error);
            balanceEl.textContent = '$---';
            // Optional: indicate error visually
            // balanceEl.classList.add('text-red-400'); 
        }
    }

    route() {
        const hash = window.location.hash.slice(1) || 'dashboard';
        const [page, ...params] = hash.split('?');

        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${page}`) {
                link.classList.add('active');
            }
        });

        // Parse query params
        const queryParams = new URLSearchParams(params.join('?'));

        // Render page
        const appContainer = document.getElementById('app');
        showLoading(appContainer);

        switch (page) {
            case 'dashboard':
                renderDashboard();
                break;
            case 'targets':
                // Try to get config from URL param first, then from localStorage, then default to 'Default'
                let config = queryParams.get('config');
                if (!config) {
                    config = localStorage.getItem('currentConfig') || 'Default';
                }
                renderTargets(config);
                break;
            case 'history':
                renderHistory();
                break;
            case 'settings':
                renderSettings();
                break;
            default:
                appContainer.innerHTML = '<div class="text-center text-gray-400">Page not found</div>';
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
