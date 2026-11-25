/**
 * Sales & Discovery History Page
 */

let historyData = [];
let configList = [];
let targetsData = [];
let selectedSimConfig = 'Default';
let simMarkupPct = 0;
let simMarkupMult = 1.10; // Default 1.10x
let showSimulator = true; // Default open

async function renderHistory() {
    const container = document.getElementById('app');

    try {
        // Fetch history AND configs
        const [history, configs] = await Promise.all([
            API.getHistory(100),
            API.getConfigs()
        ]);

        historyData = history;
        configList = configs;

        // Ensure selected config exists, otherwise default to first
        if (!configList.some(c => c.name === selectedSimConfig)) {
            selectedSimConfig = configList.length > 0 ? configList[0].name : 'Default';
        }

        // Fetch targets for the selected config to populate dropdown initially
        targetsData = await API.getConfigTargets(selectedSimConfig);

        container.innerHTML = `
            <div class="space-y-6">
                <h1 class="text-3xl font-bold">Sales & Discovery History</h1>
                
                <!-- Calculator -->
                <div id="calculator-container">
                    ${renderCalculator()}
                </div>

                ${history.length === 0 ? `
                    <div class="bg-gray-800 p-12 rounded-lg border border-gray-700 text-center">
                        <p class="text-gray-400 text-lg">No history records found.</p>
                        <p class="text-sm text-gray-500 mt-2">Items will appear here once the bot finds them.</p>
                    </div>
                ` : `
                    <div class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                        <div class="overflow-x-auto">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Time</th>
                                        <th>Item</th>
                                        <th>Wear (Float)</th>
                                        <th>Seed</th>
                                        <th>Base Price</th>
                                        <th>Markup (Sim)</th>
                                        <th>Profit (Sim)</th>
                                        <th>Link</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody id="history-table-body">
                                    ${renderHistoryRows()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `}
            </div>
        `;

        // Initial run to set values
        updateSimulation();

    } catch (error) {
        container.innerHTML = `
            <div class="text-center text-red-400">
                <p class="text-xl mb-2">❌ Error loading history</p>
                <p class="text-sm">${error.message}</p>
            </div>
        `;
    }
}

function renderCalculator() {
    return `
        <div class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <button 
                onclick="toggleSimulator()"
                class="w-full px-4 py-3 flex items-center justify-between bg-gray-750 hover:bg-gray-700 transition-colors"
            >
                <div class="flex items-center gap-2">
                    <span class="text-blue-400">📈</span>
                    <span class="font-semibold">Overpay Calculator (Simulator)</span>
                </div>
                <span class="text-gray-400 transform transition-transform ${showSimulator ? 'rotate-180' : ''}" id="sim-arrow">▼</span>
            </button>
            
            <div id="sim-content" class="${showSimulator ? '' : 'hidden'} border-t border-gray-700 p-4 space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <!-- Config Selection -->
                    <div>
                        <label class="text-xs text-gray-400 mb-1 block">Config Source</label>
                        <select onchange="changeSimConfig(this.value)" class="form-input w-full text-sm">
                            ${configList.map(c => `
                                <option value="${c.name}" ${c.name === selectedSimConfig ? 'selected' : ''}>
                                    ${c.name} (${c.target_count} targets)
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <!-- Target Selection -->
                    <div>
                        <label class="text-xs text-gray-400 mb-1 block">Pre-fill from Target</label>
                        <select id="sim-target-select" onchange="prefillCalculator(this.value)" class="form-input w-full text-sm">
                            <option value="">Custom / Manual</option>
                            ${targetsData.map(t => `
                                <option value="${t.id}">${t.item_name} (Mk: ${t.markup_pct}%, x${t.markup_mult})</option>
                            `).join('')}
                        </select>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <!-- Add Percentage -->
                    <div>
                        <label class="text-xs text-gray-400 mb-1 block">Add Percentage (%)</label>
                        <div class="flex items-center gap-2">
                            <div class="relative flex-1">
                                <input 
                                    type="number" 
                                    id="sim-pct"
                                    value="${simMarkupPct}" 
                                    oninput="updateSimulation()"
                                    class="form-input w-full text-sm"
                                    step="1"
                                >
                            </div>
                        </div>
                    </div>

                    <!-- Multiplier -->
                    <div>
                        <label class="text-xs text-gray-400 mb-1 block">Markup Multiplier (x)</label>
                        <div class="flex items-center gap-2">
                            <div class="relative flex-1">
                                <input 
                                    type="number" 
                                    id="sim-mult"
                                    value="${simMarkupMult}" 
                                    oninput="updateSimulation()"
                                    class="form-input w-full text-sm"
                                    step="0.01" min="1"
                                >
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function changeSimConfig(configName) {
    selectedSimConfig = configName;
    const targetSelect = document.getElementById('sim-target-select');

    // Disable select while loading
    if (targetSelect) {
        targetSelect.disabled = true;
        targetSelect.innerHTML = '<option>Loading...</option>';
    }

    try {
        targetsData = await API.getConfigTargets(configName);

        // Re-render the whole calculator to update dropdowns correctly
        const calcContainer = document.getElementById('calculator-container');
        if (calcContainer) {
            calcContainer.innerHTML = renderCalculator();
        }
    } catch (e) {
        showToast('Error loading targets: ' + e.message, 'error');
        if (targetSelect) targetSelect.disabled = false;
    }
}

function renderHistoryRows() {
    return historyData.map((h, index) => {
        // Will be updated by JS, but render initial simulation state
        return `
            <tr data-price="${h.price}">
                <td class="text-sm text-gray-400">${formatDate(h.timestamp)}</td>
                <td>
                    <div class="font-medium text-blue-400">${h.item_name}</div>
                    ${h.stickers && h.stickers.length > 0 ? `
                        <div class="text-xs text-gray-500 mt-1">
                            ${h.stickers.map(s => s.name || '').join(', ')}
                        </div>
                    ` : ''}
                </td>
                <td class="text-sm">${h.wear_name} (${h.float_value.toFixed(4)})</td>
                <td class="text-sm text-gray-400">${h.paint_seed || '-'}</td>
                <td class="text-sm font-medium">$${h.price.toFixed(2)}</td>
                
                <!-- Simulation Columns -->
                <td class="text-sm font-bold sim-markup-cell" id="sim-markup-${index}">
                    ...
                </td>
                <td class="text-sm sim-profit-cell" id="sim-profit-${index}">
                    ...
                </td>

                <td>
                    <a href="https://csfloat.com/item/${h.asset_id}" target="_blank" class="text-blue-400 hover:text-blue-300 text-sm underline">
                        View
                    </a>
                </td>
                <td>
                    ${h.purchased ? `
                        <button class="btn btn-sm btn-secondary opacity-50 cursor-not-allowed">Bought</button>
                    ` : `
                        <a href="https://csfloat.com/item/${h.asset_id}/buy" target="_blank" class="btn btn-sm btn-primary">
                            Buy
                        </a>
                    `}
                </td>
            </tr>
        `;
    }).join('');
}

function toggleSimulator() {
    showSimulator = !showSimulator;
    const content = document.getElementById('sim-content');
    const arrow = document.getElementById('sim-arrow');

    if (showSimulator) {
        content.classList.remove('hidden');
        arrow.classList.add('rotate-180');
    } else {
        content.classList.add('hidden');
        arrow.classList.remove('rotate-180');
    }
}

function updateSimulation() {
    const pctInput = document.getElementById('sim-pct');
    const multInput = document.getElementById('sim-mult');

    if (!pctInput || !multInput) return;

    simMarkupPct = parseFloat(pctInput.value) || 0;
    simMarkupMult = parseFloat(multInput.value) || 1.0;

    // Update all rows
    const rows = document.querySelectorAll('#history-table-body tr');
    rows.forEach((row, index) => {
        const price = parseFloat(row.dataset.price);

        // Calculation
        // Formula: Price * Mult * (1 + Pct/100)
        // Note: Logic allows simulated compounding of both
        const markupPrice = price * simMarkupMult * (1 + simMarkupPct / 100);
        const profit = markupPrice - price;
        const profitPct = (profit / price * 100).toFixed(0);

        const markupCell = document.getElementById(`sim-markup-${index}`);
        const profitCell = document.getElementById(`sim-profit-${index}`);

        if (markupCell) {
            markupCell.textContent = `$${markupPrice.toFixed(2)}`;
        }

        if (profitCell) {
            profitCell.className = `text-sm sim-profit-cell ${profit > 0 ? 'text-green-400' : 'text-gray-400'}`;
            profitCell.textContent = profit > 0 ? `+$${profit.toFixed(2)} (${profitPct}%)` : '$0.00';
        }
    });
}

function prefillCalculator(targetId) {
    if (!targetId) return;

    const target = targetsData.find(t => t.id == targetId);
    if (target) {
        document.getElementById('sim-pct').value = target.markup_pct;
        document.getElementById('sim-mult').value = target.markup_mult;
        updateSimulation();
    }
}
