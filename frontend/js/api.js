/**
 * API Client for CSFloat Sniper
 * Wraps all fetch calls to the FastAPI backend
 */

const API_BASE = '/api';

class API {
    /**
     * Generic fetch wrapper with error handling
     */
    static async request(endpoint, options = {}) {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
                const errorMessage = typeof error.detail === 'object'
                    ? JSON.stringify(error.detail)
                    : (error.detail || `HTTP ${response.status}`);
                throw new Error(errorMessage);
            }

            return await response.json();
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    }

    // ============================================================================
    // Configs
    // ============================================================================

    static async getConfigs() {
        return await this.request('/configs');
    }

    static async getConfigTargets(configName) {
        return await this.request(`/configs/${encodeURIComponent(configName)}/targets`);
    }

    static async deleteConfig(configName) {
        return await this.request(`/configs/${encodeURIComponent(configName)}`, {
            method: 'DELETE'
        });
    }

    static async toggleConfigActive(configName, active) {
        return await this.request(`/configs/${encodeURIComponent(configName)}/toggle?active=${active}`, {
            method: 'PATCH'
        });
    }

    // ============================================================================
    // Targets
    // ============================================================================

    static async createTarget(targetData) {
        return await this.request('/targets', {
            method: 'POST',
            body: JSON.stringify(targetData)
        });
    }

    static async updateTarget(targetId, updateData) {
        return await this.request(`/targets/${targetId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });
    }

    static async deleteTarget(targetId) {
        return await this.request(`/targets/${targetId}`, {
            method: 'DELETE'
        });
    }

    // ============================================================================
    // History & Stats
    // ============================================================================

    static async getHistory(limit = 100) {
        return await this.request(`/history?limit=${limit}`);
    }

    static async getDashboardStats() {
        return await this.request('/dashboard/stats');
    }

    // ============================================================================
    // Bot Control
    // ============================================================================

    static async getBotStatus() {
        return await this.request('/bot/status');
    }

    static async startBot() {
        return await this.request('/bot/start', { method: 'POST' });
    }

    static async stopBot() {
        return await this.request('/bot/stop', { method: 'POST' });
    }

    // ============================================================================
    // Account / Balance
    // ============================================================================

    static async getCSFloatBalance() {
        return await this.request('/csfloat/balance');
    }

    // ============================================================================
    // Static Data
    // ============================================================================

    static async getSkins() {
        return await this.request('/data/skins');
    }

    static async getSkinsCategorized() {
        return await this.request('/data/skins/categorized');
    }

    static async getStickers() {
        return await this.request('/data/stickers');
    }

    static async getCharms() {
        return await this.request('/data/charms');
    }

    // ============================================================================
    // Settings
    // ============================================================================

    static async getSettings() {
        return await this.request('/settings');
    }

    static async updateSettings(settings) {
        return await this.request('/settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        });
    }

    // ============================================================================
    // Logs
    // ============================================================================

    static async getLogs(lines = 20) {
        return await this.request(`/logs?lines=${lines}`);
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? '✅' :
        type === 'error' ? '❌' :
            type === 'info' ? 'ℹ️' : '📢';

    toast.innerHTML = `
        <span class="text-xl">${icon}</span>
        <span class="flex-1">${message}</span>
        <button onclick="this.parentElement.remove()" class="text-white opacity-70 hover:opacity-100">✕</button>
    `;

    container.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * Show loading spinner
 */
function showLoading(container) {
    container.innerHTML = `
        <div class="flex items-center justify-center h-64">
            <div class="text-center">
                <div class="spinner mx-auto mb-4"></div>
                <p class="text-gray-400">Loading...</p>
            </div>
        </div>
    `;
}

/**
 * Format date to readable string
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } else {
        return date.toLocaleString('ru-RU', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

/**
 * Debounce function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
