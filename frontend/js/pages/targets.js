/**
 * Targets Manager Page
 * Main page for managing target configurations and items
 */

let currentConfig = 'Default';
let configs = [];
let targets = [];
let skins = [];
let categorizedSkins = {};
let stickers = [];
let charms = [];
let showConstructor = false;

async function renderTargets(configName = 'Default') {
    // Save current config to localStorage for persistence across page refreshes
    if (configName && configName !== 'Default') {
        localStorage.setItem('currentConfig', configName);
    }
    
    currentConfig = configName;
    const container = document.getElementById('app');

    try {
        // Load data
        [configs, targets, skins, categorizedSkins, stickers, charms] = await Promise.all([
            API.getConfigs(),
            API.getConfigTargets(configName),
            API.getSkins(),
            API.getSkinsCategorized(),
            API.getStickers(),
            API.getCharms()
        ]);

        // Ensure Default exists
        if (!configs.find(c => c.name === 'Default')) {
            configs.unshift({ name: 'Default', target_count: 0, active_count: 0 });
        }

        // Build page
        container.innerHTML = `
            <div class="space-y-6">
                <h1 class="text-3xl font-bold">Targets Manager</h1>
                
                <!-- Config Selector -->
                <div class="space-y-4">
                    <label class="text-sm text-gray-400">Select Config</label>
                    <div class="pill-nav">
                        ${configs.map(c => `
                            <button 
                                class="pill ${c.name === currentConfig ? 'active' : ''}"
                                onclick="switchConfig('${c.name}')"
                            >
                                ${c.name} ${c.target_count > 0 ? `(${c.target_count})` : ''}
                            </button>
                        `).join('')}
                        <button class="pill" onclick="createNewConfig()">➕</button>
                    </div>
                </div>
                
                ${renderToolbar()}
                
                ${showConstructor ? renderConstructor() : ''}
                
                ${renderTargetsTable()}
            </div>
        `;

        // Initialize tags if constructor is open
        if (showConstructor) {
            setupTagManagement();
        }

    } catch (error) {
        container.innerHTML = `
            <div class="text-center text-red-400">
                <p class="text-xl mb-2">❌ Error loading targets</p>
                <p class="text-sm">${error.message}</p>
            </div>
        `;
    }
}

function renderToolbar() {
    const config = configs.find(c => c.name === currentConfig);
    const isActive = config && config.active_count > 0;

    return `
        <div class="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <div class="flex items-center gap-4">
                <!-- Config Enabled -->
                <label class="flex items-center gap-2 cursor-pointer">
                    <input 
                        type="checkbox" 
                        ${isActive ? 'checked' : ''}
                        onchange="toggleConfigActive(this.checked)"
                        class="w-5 h-5 rounded border-gray-600 text-blue-600 focus:ring-blue-500"
                    >
                    <span class="text-sm font-medium">Config Enabled</span>
                </label>
                
                <div class="flex-1"></div>
                
                <!-- Add Target Button -->
                <button 
                    onclick="toggleConstructor()"
                    class="btn btn-primary"
                >
                    ${showConstructor ? '✕ Close' : '➕ Add Target'}
                </button>
                
                <!-- Delete/Clear Button -->
                ${currentConfig === 'Default' ? `
                    <button onclick="clearTargets()" class="btn btn-danger">
                        🧹 Clear All
                    </button>
                ` : `
                    <button onclick="deleteConfig()" class="btn btn-danger">
                        🗑️ Delete Config
                    </button>
                `}
            </div>
        </div>
    `;
}

function renderConstructor() {
    // Determine mode and values
    const isEdit = !!editingTargetId;
    const target = isEdit ? targets.find(t => t.id === editingTargetId) : null;

    if (isEdit && !target) {
        console.error('Target not found for editing');
        editingTargetId = null;
        return renderConstructor(); // Retry in create mode
    }

    const values = {
        item_name: target ? target.item_name : '*',
        min_price: target ? target.min_price : 0.00,
        max_price: target ? target.max_price : 100.00,
        markup_pct: target ? target.markup_pct : 0,
        markup_mult: target ? target.markup_mult : 1.0,
        min_float: target ? target.min_float : 0.0000,
        max_float: target ? target.max_float : 1.0000,
        mode: target ? target.mode : 'Notify Only',
        is_stattrak: target ? (target.is_stattrak === true ? 'true' : target.is_stattrak === false ? 'false' : '') : '',
        paint_seed: target ? (target.paint_seed || '') : '',
        blue_gem_tier: target ? (target.blue_gem_tier || '') : '',
        float_rank: target ? (target.float_rank || '') : '',
        is_active: target ? target.is_active : true
    };

    // Prepare globals for tag management
    if (target) {
        // Check if stickers is array (legacy/simple) or object (slots)
        if (Array.isArray(target.stickers)) {
            selectedStickers = [...target.stickers];
        } else {
            selectedStickers = []; // Slots are handled separately in logic below
        }
        selectedCharms = target.charms ? [...target.charms] : [];
    } else {
        selectedStickers = [];
        selectedCharms = [];
    }

    return `
        <div class="bg-gray-800 p-6 rounded-lg border ${isEdit ? 'border-amber-500' : 'border-blue-500'}">
            <h3 class="text-xl font-bold mb-4">
                ${isEdit ? `✏️ Edit Target #${target.id}` : `🛠️ New Target: ${currentConfig}`}
            </h3>
            <form id="target-form" onsubmit="submitTarget(event)" class="space-y-4">
                <!-- Item Name -->
                <!-- Item Name -->
                <div>
                    <label class="form-label">Item Name</label>
                    <div class="relative group">
                        <input 
                            type="text" 
                            name="item_name" 
                            id="item-name-input"
                            class="form-input w-full" 
                            placeholder="Type to search skin..." 
                            value="${values.item_name}" 
                            required
                            autocomplete="off"
                            oninput="filterSkins(this.value)"
                            onfocus="filterSkins(this.value)"
                            onblur="setTimeout(() => document.getElementById('skin-dropdown').classList.add('hidden'), 200)"
                        >
                        <!-- Dropdown list -->
                        <div id="skin-dropdown" class="hidden absolute top-full left-0 z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                            <!-- Options will be populated here -->
                        </div>
                    </div>
                </div>
                
                <!-- Price & Markup -->
                <div class="grid grid-cols-4 gap-4">
                    <div>
                        <label class="form-label">Min Price ($)</label>
                        <input type="number" name="min_price" class="form-input" 
                            min="0" step="0.01" value="${values.min_price}" required>
                    </div>
                    <div>
                        <label class="form-label">Max Price ($)</label>
                        <input type="number" name="max_price" class="form-input" 
                            min="0" step="0.01" value="${values.max_price}" required>
                    </div>
                    <div>
                        <label class="form-label">Markup (%)</label>
                        <input type="number" name="markup_pct" class="form-input" 
                            min="0" step="1" value="${values.markup_pct}">
                    </div>
                    <div>
                        <label class="form-label">Multiplier (x)</label>
                        <input type="number" name="markup_mult" class="form-input" 
                            min="1" step="0.1" value="${values.markup_mult}">
                    </div>
                </div>
                
                <!-- Float Range -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Min Float</label>
                        <input type="number" name="min_float" class="form-input" 
                            min="0" max="1" step="0.0001" value="${values.min_float}">
                    </div>
                    <div>
                        <label class="form-label">Max Float</label>
                        <input type="number" name="max_float" class="form-input" 
                            min="0" max="1" step="0.0001" value="${values.max_float}">
                    </div>
                </div>
                
                <!-- Special Filters -->
                <div class="grid grid-cols-4 gap-4">
                    <div>
                        <label class="form-label">Mode</label>
                        <select name="mode" class="form-input">
                            <option value="Notify Only" ${values.mode === 'Notify Only' ? 'selected' : ''}>Notify Only</option>
                            <option value="Auto Buy" ${values.mode === 'Auto Buy' ? 'selected' : ''}>Auto Buy</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label">StatTrak</label>
                        <select name="is_stattrak" class="form-input">
                            <option value="" ${values.is_stattrak === '' ? 'selected' : ''}>Any</option>
                            <option value="true" ${values.is_stattrak === 'true' ? 'selected' : ''}>Yes (StatTrak Only)</option>
                            <option value="false" ${values.is_stattrak === 'false' ? 'selected' : ''}>No (Non-StatTrak)</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label">Paint Seed</label>
                        <input type="number" name="paint_seed" class="form-input" 
                            placeholder="Any" min="0" max="1000" value="${values.paint_seed}">
                    </div>
                    <div>
                        <label class="form-label">Blue Gem Tier</label>
                        <select name="blue_gem_tier" class="form-input">
                            <option value="" ${values.blue_gem_tier === '' ? 'selected' : ''}>Any Tier</option>
                            <option value="1" ${values.blue_gem_tier === 1 ? 'selected' : ''}>Tier 1</option>
                            <option value="2" ${values.blue_gem_tier === 2 ? 'selected' : ''}>Tier 2</option>
                            <option value="3" ${values.blue_gem_tier === 3 ? 'selected' : ''}>Tier 3</option>
                            <option value="4" ${values.blue_gem_tier === 4 ? 'selected' : ''}>Tier 4</option>
                        </select>
                    </div>
                </div>
                
                <!-- Stickers Section -->
                <div class="border-t border-gray-700 pt-4 mt-4">
                    <h4 class="text-lg font-semibold mb-3">Stickers Filtering</h4>
                    
                    <!-- Required Stickers (Match ALL) -->
                    <div class="mb-4">
                        <label class="form-label">Required Stickers (Match ALL)</label>
                        <p class="text-xs text-gray-400 mb-2">Type to search and add stickers (any slots)</p>
                        
                        <div class="relative group">
                            <!-- Helper logic: clicking container focuses input -->
                            <div class="form-input flex flex-wrap items-center gap-2 min-h-[42px] p-1.5 cursor-text focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 bg-gray-700 border border-gray-600 rounded-md"
                                    onclick="document.getElementById('sticker-search').focus()">
                                
                                <!-- Selected tags display (INSIDE container) -->
                                <div id="selected-stickers-container" class="contents"></div>
                                
                                <!-- Search input (INSIDE container) -->
                                <input 
                                    type="search" 
                                    id="sticker-search" 
                                    class="bg-transparent border-none outline-none text-white placeholder-gray-400 flex-1 min-w-[120px] h-full"
                                    placeholder="Type sticker name..." 
                                    autocomplete="off"
                                    oninput="filterStickers(this.value)"
                                    onfocus="filterStickers(this.value)"
                                    onblur="setTimeout(() => document.getElementById('sticker-dropdown').classList.add('hidden'), 200)"
                                >
                            </div>
                            
                            <!-- Dropdown list -->
                            <div id="sticker-dropdown" class="hidden absolute top-full left-0 z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                                <!-- Options will be populated here -->
                            </div>
                        </div>
                        
                        <!-- Hidden input to store selected values -->
                        <input type="hidden" name="required_stickers" id="required-stickers-value">
                    </div>
                    
                    <!-- Required Stickers by Slot -->
                    <div>
                        <label class="form-label">Required Stickers by Slot (Match ALL)</label>
                        <p class="text-xs text-gray-400 mb-2">Select specific stickers for specific slots (1-indexed)</p>
                        <div class="grid grid-cols-5 gap-3">
                            ${[1, 2, 3, 4, 5].map(slot => {
        // Determine value for this slot if editing
        let slotValue = '';
        if (target && target.stickers && !Array.isArray(target.stickers) && target.stickers[`slot_${slot}`]) {
            slotValue = target.stickers[`slot_${slot}`];
        }

        return `
                                <div class="relative">
                                    <label class="text-xs text-gray-400 mb-1 block">Slot ${slot}</label>
                                    <div class="relative group">
                                        <input 
                                            type="search" 
                                            name="slot_${slot}" 
                                            id="slot-input-${slot}"
                                            class="form-input text-sm w-full" 
                                            placeholder="Search..."
                                            value="${slotValue.replace(/"/g, '&quot;')}"
                                            autocomplete="off"
                                            oninput="filterSlotStickers(this.value, ${slot})"
                                            onfocus="filterSlotStickers(this.value, ${slot})"
                                            onblur="setTimeout(() => document.getElementById('slot-dropdown-${slot}').classList.add('hidden'), 200)"
                                        >
                                        <!-- Clear button for slot -->
                                        <button type="button" 
                                            class="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white ${slotValue ? '' : 'hidden'}"
                                            id="slot-clear-${slot}"
                                            onclick="clearSlot(${slot})">
                                            ✕
                                        </button>

                                        <!-- Dropdown -->
                                        <div id="slot-dropdown-${slot}" class="hidden absolute top-full left-0 z-50 w-full min-w-[200px] mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                                            <!-- Options here -->
                                        </div>
                                    </div>
                                </div>
                            `}).join('')}
                        </div>
                    </div>
                </div>
                
                <!-- Charms Section -->
                <div class="border-t border-gray-700 pt-4 mt-4">
                    <h4 class="text-lg font-semibold mb-3">Charms Filtering</h4>
                    
                    <!-- Required Charms (Match ALL) -->
                    <div>
                        <label class="form-label">Required Charms (Match ALL)</label>
                        <p class="text-xs text-gray-400 mb-2">Type to search and add charms</p>
                        
                        <div class="relative group">
                            <!-- Tags Input Container -->
                            <div class="form-input flex flex-wrap items-center gap-2 min-h-[42px] p-1.5 cursor-text focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 bg-gray-700 border border-gray-600 rounded-md"
                                    onclick="document.getElementById('charm-search').focus()">
                                
                                <!-- Selected tags display -->
                                <div id="selected-charms-container" class="contents"></div>
                                
                                <!-- Search input -->
                                <input 
                                    type="search" 
                                    id="charm-search" 
                                    class="bg-transparent border-none outline-none text-white placeholder-gray-400 flex-1 min-w-[120px] h-full"
                                    placeholder="Type charm name..." 
                                    autocomplete="off"
                                    oninput="filterCharms(this.value)"
                                    onfocus="filterCharms(this.value)"
                                    onblur="setTimeout(() => document.getElementById('charm-dropdown').classList.add('hidden'), 200)"
                                >
                            </div>
                            
                            <!-- Dropdown list -->
                            <div id="charm-dropdown" class="hidden absolute top-full left-0 z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                                <!-- Options will be populated here -->
                            </div>
                        </div>
                        
                        <!-- Hidden input to store selected values -->
                        <input type="hidden" name="required_charms" id="required-charms-value">
                    </div>
                </div>
                
                <!-- Active checkbox -->
                <div>
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" name="is_active" ${values.is_active ? 'checked' : ''} class="w-5 h-5">
                        <span class="text-sm">Active immediately</span>
                    </label>
                </div>
                
                <!-- Submit -->
                <div class="flex gap-2">
                    <button type="submit" class="btn ${isEdit ? 'btn-primary' : 'btn-success'}">
                        ${isEdit ? '💾 Update Target' : '💾 Save Target'}
                    </button>
                    <button type="button" onclick="cancelEditMode()" class="btn btn-secondary">
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    `;
}

// ============================================================================
// Tag Management for Multiselect with Custom Dropdown
// ============================================================================

let selectedStickers = [];
let selectedCharms = [];

// ============================================================================
// Fuzzy Search Implementation
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings
 * Measures how many single-character edits are needed to change one word into the other
 */
function levenshteinDistance(str1, str2) {
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2;
    if (len2 === 0) return len1;

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // deletion
                matrix[i][j - 1] + 1,      // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }

    return matrix[len1][len2];
}

/**
 * Calculate fuzzy match score between query and target
 * Returns a score between 0 and 1, where 1 is perfect match
 */
function fuzzyScore(query, target) {
    if (!query || !target) return 0;
    
    const queryLower = query.toLowerCase();
    const targetLower = target.toLowerCase();
    
    // Perfect match gets highest score
    if (targetLower === queryLower) return 1.0;
    
    // Check if query is a substring of target
    if (targetLower.includes(queryLower)) return 0.9;
    
    // Check if target is a substring of query
    if (queryLower.includes(targetLower)) return 0.8;
    
    // Split query into words and check if most words exist in target
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0);
    const targetWords = targetLower.split(/\s+/).filter(w => w.length > 0);
    
    let matchedWords = 0;
    let totalWordScore = 0;
    
    for (const queryWord of queryWords) {
        let bestWordScore = 0;
        
        for (const targetWord of targetWords) {
            // Exact word match
            if (targetWord === queryWord) {
                bestWordScore = 1.0;
                break;
            }
            // Substring match
            if (targetWord.includes(queryWord) || queryWord.includes(targetWord)) {
                bestWordScore = Math.max(bestWordScore, 0.8);
                continue;
            }
            // Fuzzy match using Levenshtein distance
            const distance = levenshteinDistance(queryWord, targetWord);
            const maxLength = Math.max(queryWord.length, targetWord.length);
            const similarity = 1 - (distance / maxLength);
            
            if (similarity > 0.6) { // Only count if similarity is good enough
                bestWordScore = Math.max(bestWordScore, similarity * 0.7);
            }
        }
        
        if (bestWordScore > 0) {
            matchedWords++;
            totalWordScore += bestWordScore;
        }
    }
    
    if (matchedWords === 0) return 0;
    
    // Calculate average word score and adjust for word coverage
    const avgWordScore = totalWordScore / queryWords.length;
    const wordCoverage = matchedWords / queryWords.length;
    
    return avgWordScore * wordCoverage;
}

/**
 * Filter skins using fuzzy search
 * Returns results sorted by relevance score
 */
function fuzzyFilterSkins(query, skins) {
    if (!query || query.trim() === '') {
        return skins.slice(0, 50); // Return first 50 if no query
    }
    
    const queryTrimmed = query.trim();
    const results = [];
    
    for (const skin of skins) {
        const score = fuzzyScore(queryTrimmed, skin);
        if (score > 0.3) { // Minimum threshold for fuzzy matching
            results.push({ skin, score });
        }
    }
    
    // Sort by score (highest first) and return skin names only
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 50).map(r => r.skin);
}

function setupTagManagement() {
    // Initial render of empty tags or pre-filled if editing
    renderStickerTags();
    renderCharmTags();
}

function filterSkins(query) {
    const dropdown = document.getElementById('skin-dropdown');
    if (!dropdown) return;

    // Default to empty if not loaded
    const sourceData = (typeof skins !== 'undefined' && Array.isArray(skins)) ? skins : [];
    const allOptions = ['*', ...sourceData];

    // If query is empty, show category browser
    if (!query || query.trim() === '') {
        dropdown.innerHTML = renderCategoryBrowser();
        return;
    }

    // Use fuzzy search for filtering
    const filtered = fuzzyFilterSkins(query, allOptions);

    if (filtered.length === 0) {
        dropdown.innerHTML = `<div class="px-4 py-2 text-sm text-gray-500">No matches found</div>`;
        dropdown.classList.remove('hidden');
        return;
    }

    dropdown.innerHTML = filtered.map(skin => {
        const display = skin === '*' ? '* (Any Skin)' : skin;
        // Escape quotes for onclick
        const safeSkin = skin.replace(/'/g, "\\'");
        return `
            <div class="px-4 py-2 hover:bg-gray-700 cursor-pointer text-sm" 
                 onclick="selectSkin('${safeSkin}')">
                ${display}
            </div>
        `;
    }).join('');

    dropdown.classList.remove('hidden');
}

function renderCategoryBrowser() {
    if (!categorizedSkins || Object.keys(categorizedSkins).length === 0) {
        return `<div class="px-4 py-2 text-sm text-gray-500">Loading categories...</div>`;
    }

    let html = '<div class="p-2">';
    
    // Add "Any Skin" option
    html += `
        <div class="px-4 py-2 hover:bg-gray-700 cursor-pointer text-sm font-semibold text-blue-400" 
             onclick="selectSkin('*')">
            * (Any Skin)
        </div>
    `;

    // Render categories
    Object.keys(categorizedSkins).sort().forEach(category => {
        html += `
            <div class="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                ${category}
            </div>
        `;
        
        // Render weapons in this category
        Object.keys(categorizedSkins[category]).sort().forEach(weapon => {
            const safeWeapon = weapon.replace(/'/g, "\\'");
            html += `
                <div class="px-6 py-2 hover:bg-gray-700 cursor-pointer text-sm text-gray-300" 
                     onclick="showWeaponSkins('${safeWeapon}', '${category.replace(/'/g, "\\'")}')">
                    🔫 ${weapon}
                </div>
            `;
        });
    });
    
    html += '</div>';
    return html;
}

function showWeaponSkins(weapon, category) {
    const dropdown = document.getElementById('skin-dropdown');
    if (!dropdown || !categorizedSkins[category] || !categorizedSkins[category][weapon]) return;

    const weaponSkins = categorizedSkins[category][weapon];
    
    let html = `
        <div class="p-2">
            <div class="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                ${weapon} Skins
            </div>
            <div class="px-4 py-2 hover:bg-gray-700 cursor-pointer text-sm text-blue-400" 
                 onclick="filterSkins('')">
                ← Back to Categories
            </div>
    `;

    weaponSkins.forEach(skinName => {
        const fullSkinName = `${weapon} | ${skinName}`;
        const safeSkinName = fullSkinName.replace(/'/g, "\\'");
        html += `
            <div class="px-4 py-2 hover:bg-gray-700 cursor-pointer text-sm" 
                 onclick="selectSkin('${safeSkinName}')">
                ${skinName}
            </div>
        `;
    });
    
    html += '</div>';
    dropdown.innerHTML = html;
}

function selectSkin(skinName) {
    const input = document.getElementById('item-name-input');
    const dropdown = document.getElementById('skin-dropdown');

    if (input) {
        input.value = skinName;
    }

    if (dropdown) {
        dropdown.classList.add('hidden');
    }
}

function filterStickers(query) {
    const dropdown = document.getElementById('sticker-dropdown');
    if (!dropdown) return;

    // Use global stickers array directly
    // Ensure stickers is loaded
    const sourceData = (typeof stickers !== 'undefined' && Array.isArray(stickers)) ? stickers : [];

    const filtered = sourceData.filter(s =>
        s && typeof s === 'string' && s.toLowerCase().includes(query.toLowerCase()) && !selectedStickers.includes(s)
    );

    if (filtered.length === 0) {
        dropdown.innerHTML = `<div class="px-4 py-2 text-sm text-gray-500">No matches found</div>`;
        dropdown.classList.remove('hidden');
        return;
    }

    // LIMIT RESULTS to avoid browser freeze
    const limited = filtered.slice(0, 50);

    dropdown.innerHTML = limited.map(sticker => {
        // Robust way: encode path handling special chars
        const encoded = encodeURIComponent(sticker);

        return `
            <div class="px-4 py-2 hover:bg-gray-700 cursor-pointer text-sm" 
                 onmousedown="selectSticker('${encoded}')">
                ${sticker}
            </div>
        `;
    }).join('');

    if (filtered.length > 50) {
        dropdown.innerHTML += `
            <div class="px-4 py-2 text-xs text-gray-500 text-center border-t border-gray-700">
                ... and ${filtered.length - 50} more
            </div>
        `;
    }

    dropdown.classList.remove('hidden');
}

function filterSlotStickers(query, slot) {
    const dropdown = document.getElementById(`slot-dropdown-${slot}`);
    if (!dropdown) return;

    // Show clear button if has value
    const clearBtn = document.getElementById(`slot-clear-${slot}`);
    if (clearBtn) {
        clearBtn.classList.toggle('hidden', !query);
    }

    const sourceData = (typeof stickers !== 'undefined' && Array.isArray(stickers)) ? stickers : [];

    const filtered = sourceData.filter(s =>
        s && typeof s === 'string' && s.toLowerCase().includes(query.toLowerCase())
    );

    if (filtered.length === 0) {
        dropdown.innerHTML = `<div class="px-4 py-2 text-sm text-gray-500">No matches found</div>`;
        dropdown.classList.remove('hidden');
        return;
    }

    const limited = filtered.slice(0, 50);

    dropdown.innerHTML = limited.map(sticker => {
        const encoded = encodeURIComponent(sticker);
        return `
            <div class="px-4 py-2 hover:bg-gray-700 cursor-pointer text-sm truncate" 
                 title="${sticker}"
                 onmousedown="selectSlotSticker('${encoded}', ${slot})">
                ${sticker}
            </div>
        `;
    }).join('');

    dropdown.classList.remove('hidden');
}

function selectSlotSticker(encodedSticker, slot) {
    const sticker = decodeURIComponent(encodedSticker);
    const input = document.getElementById(`slot-input-${slot}`);
    const dropdown = document.getElementById(`slot-dropdown-${slot}`);

    if (input) {
        input.value = sticker;
        // Trigger generic filter again to show clear button or update state if needed
        const clearBtn = document.getElementById(`slot-clear-${slot}`);
        if (clearBtn) clearBtn.classList.remove('hidden');
    }

    if (dropdown) {
        dropdown.classList.add('hidden');
    }
}

function clearSlot(slot) {
    const input = document.getElementById(`slot-input-${slot}`);
    const clearBtn = document.getElementById(`slot-clear-${slot}`);

    if (input) {
        input.value = '';
        input.focus();
    }

    if (clearBtn) {
        clearBtn.classList.add('hidden');
    }

    // Hide dropdown
    const dropdown = document.getElementById(`slot-dropdown-${slot}`);
    if (dropdown) dropdown.classList.add('hidden');
}

function filterCharms(query) {
    const dropdown = document.getElementById('charm-dropdown');
    if (!dropdown) return;

    const sourceData = (typeof charms !== 'undefined' && Array.isArray(charms)) ? charms : [];

    const filtered = sourceData.filter(c =>
        c.toLowerCase().includes(query.toLowerCase()) && !selectedCharms.includes(c)
    );

    if (filtered.length === 0) {
        dropdown.innerHTML = `<div class="px-4 py-2 text-sm text-gray-500">No matches found</div>`;
        dropdown.classList.remove('hidden');
        return;
    }

    // LIMIT RESULTS
    const limited = filtered.slice(0, 50);

    dropdown.innerHTML = limited.map(charm => {
        const encoded = encodeURIComponent(charm);
        return `
            <div class="px-4 py-2 hover:bg-gray-700 cursor-pointer text-sm" 
                 onmousedown="selectCharm('${encoded}')">
                ${charm}
            </div>
        `;
    }).join('');

    if (filtered.length > 50) {
        dropdown.innerHTML += `
            <div class="px-4 py-2 text-xs text-gray-500 text-center border-t border-gray-700">
                ... and ${filtered.length - 50} more
            </div>
        `;
    }

    dropdown.classList.remove('hidden');
}

function selectSticker(encodedSticker) {
    const sticker = decodeURIComponent(encodedSticker);
    if (!selectedStickers.includes(sticker)) {
        selectedStickers.push(sticker);
        renderStickerTags();
    }

    const input = document.getElementById('sticker-search');
    if (input) {
        input.value = '';
        input.focus();
    }

    const dropdown = document.getElementById('sticker-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
}

function selectCharm(encodedCharm) {
    const charm = decodeURIComponent(encodedCharm);
    if (!selectedCharms.includes(charm)) {
        selectedCharms.push(charm);
        renderCharmTags();
    }

    const input = document.getElementById('charm-search');
    if (input) {
        input.value = '';
        input.focus();
    }

    const dropdown = document.getElementById('charm-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
}

function renderStickerTags() {
    const container = document.getElementById('selected-stickers-container');
    const hiddenInput = document.getElementById('required-stickers-value');

    if (!container) return;

    container.innerHTML = selectedStickers.map(sticker => {
        const encoded = encodeURIComponent(sticker);
        return `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-600 text-white rounded text-sm whitespace-nowrap animate-[fadeIn_0.2s]">
            ${sticker}
            <button type="button" onclick="removeSticker('${encoded}'); event.stopPropagation();" class="hover:text-red-300 ml-1 font-bold">
                ×
            </button>
        </span>
    `}).join('');

    if (hiddenInput) {
        hiddenInput.value = JSON.stringify(selectedStickers);
    }
}

function renderCharmTags() {
    const container = document.getElementById('selected-charms-container');
    const hiddenInput = document.getElementById('required-charms-value');

    if (!container) return;

    container.innerHTML = selectedCharms.map(charm => {
        const encoded = encodeURIComponent(charm);
        return `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-600 text-white rounded text-sm whitespace-nowrap animate-[fadeIn_0.2s]">
            ${charm}
            <button type="button" onclick="removeCharm('${encoded}'); event.stopPropagation();" class="hover:text-red-300 ml-1 font-bold">
                ×
            </button>
        </span>
    `}).join('');

    if (hiddenInput) {
        hiddenInput.value = JSON.stringify(selectedCharms);
    }
}

function removeSticker(encodedSticker) {
    const sticker = decodeURIComponent(encodedSticker);
    selectedStickers = selectedStickers.filter(s => s !== sticker);
    renderStickerTags();
}

function removeCharm(encodedCharm) {
    const charm = decodeURIComponent(encodedCharm);
    selectedCharms = selectedCharms.filter(c => c !== charm);
    renderCharmTags();
}

function renderTargetsTable() {
    if (targets.length === 0) {
        return `
            <div class="bg-gray-800 p-12 rounded-lg border border-gray-700 text-center">
                <p class="text-gray-400 text-lg">No targets in this config.</p>
                <button onclick="toggleConstructor()" class="btn btn-primary mt-4">
                    ➕ Add Your First Target
                </button>
            </div>
        `;
    }

    return `
        <div class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Item Name</th>
                            <th>Min Price</th>
                            <th>Max Price</th>
                            <th>Min Float</th>
                            <th>Max Float</th>
                            <th>Paint Seed</th>
                            <th>Stickers</th>
                            <th>Charms</th>
                            <th>Blue Gem</th>
                            <th>Markup (%)</th>
                            <th>Multiplier (x)</th>
                            <th>Mode</th>
                            <th>StatTrak</th>
                            <th>Active</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${targets.map(target => `
                            <tr data-id="${target.id}">
                                <td class="text-gray-400">${target.id}</td>

                                <!-- Item Name -->
                                <td class="font-medium text-blue-400">
                                    ${target.item_name}
                                </td>

                                <!-- Min Price -->
                                <td class="text-center">
                                    $${target.min_price.toFixed(2)}
                                </td>

                                <!-- Max Price -->
                                <td class="text-center">
                                    $${target.max_price.toFixed(2)}
                                </td>

                                <!-- Min Float -->
                                <td class="text-center">
                                    ${target.min_float.toFixed(4)}
                                </td>

                                <!-- Max Float -->
                                <td class="text-center">
                                    ${target.max_float.toFixed(4)}
                                </td>

                                <!-- Paint Seed -->
                                <td class="text-center">
                                    ${target.paint_seed || 'Any'}
                                </td>

                                <!-- Stickers -->
                                <td class="text-xs">
                                    ${target.stickers ?
            (Array.isArray(target.stickers) ?
                target.stickers.join(', ') :
                Object.entries(target.stickers).map(([k, v]) => `${k.replace('slot_', 'S')}:${v}`).join(', ')
            ) : 'Any'}
                                </td>

                                <!-- Charms -->
                                <td class="text-xs">
                                    ${target.charms && target.charms.length > 0 ? target.charms.join(', ') : 'Any'}
                                </td>

                                <!-- Blue Gem Tier -->
                                <td>
                                    ${target.blue_gem_tier ? 'Tier ' + target.blue_gem_tier : 'Any Tier'}
                                </td>

                                <!-- Markup % -->
                                <td>
                                    ${target.markup_pct}%
                                </td>

                                <!-- Multiplier (x) -->
                                <td>
                                    ${target.markup_mult}x
                                </td>

                                <!-- Mode -->
                                <td>
                                    <span class="text-xs px-2 py-1 rounded ${target.mode === 'Auto Buy' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-300'}">
                                        ${target.mode}
                                    </span>
                                </td>

                                <!-- StatTrak -->
                                <td class="text-sm">
                                    ${target.is_stattrak === true ? '✓ Yes' : target.is_stattrak === false ? '✗ No' : 'Any'}
                                </td>

                                <!-- Active (checkbox) -->
                                <td>
                                    <input
                                        type="checkbox"
                                        ${target.is_active ? 'checked' : ''}
                                        onchange="toggleTargetActive(${target.id}, this.checked)"
                                        class="w-5 h-5 cursor-pointer"
                                    >
                                </td>

                                <!-- Actions -->
                                <td class="flex items-center gap-2">
                                    <button onclick="editTarget(${target.id})" class="text-blue-400 hover:text-blue-300" title="Edit Target">
                                        ✏️
                                    </button>
                                    <button onclick="deleteTargetById(${target.id})" class="text-red-400 hover:text-red-300" title="Delete Target">
                                        🗑️
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        `;
}

// ============================================================================
// Event Handlers
// ============================================================================

async function switchConfig(configName) {
    window.location.hash = `targets?config=${encodeURIComponent(configName)}`;
}

function toggleConstructor() {
    if (showConstructor) {
        // Closing
        showConstructor = false;
        editingTargetId = null;
    } else {
        // Opening new
        showConstructor = true;
        editingTargetId = null;
    }
    renderTargets(currentConfig);
}

function editTarget(targetId) {
    editingTargetId = targetId;
    showConstructor = true;

    // Smooth scroll to top
    renderTargets(currentConfig).then(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

function cancelEditMode() {
    showConstructor = false;
    editingTargetId = null;
    renderTargets(currentConfig);
}

async function submitTarget(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    try {
        // Parse required stickers from JSON (new tag-based system)
        const requiredStickersValue = formData.get('required_stickers');
        const requiredStickers = requiredStickersValue ? JSON.parse(requiredStickersValue) : [];

        // Parse slot-based stickers
        const slotStickers = {};
        for (let i = 1; i <= 5; i++) {
            const slotValue = formData.get(`slot_${i}`);
            if (slotValue) {
                slotStickers[`slot_${i}`] = slotValue;
            }
        }

        // Parse required charms from JSON (new tag-based system)
        const requiredCharmsValue = formData.get('required_charms');
        const requiredCharms = requiredCharmsValue ? JSON.parse(requiredCharmsValue) : [];

        // Combine stickers: if slot stickers exist, use them; otherwise use required stickers list
        let stickersData = null;
        if (Object.keys(slotStickers).length > 0) {
            stickersData = slotStickers; // Use slot-based filtering
        } else if (requiredStickers.length > 0) {
            stickersData = requiredStickers; // Use any-slot filtering
        }

        // Check if config is active
        const config = configs.find(c => c.name === currentConfig);
        const isConfigActive = config && config.active_count > 0;
        const targetRequestedActive = formData.get('is_active') === 'on';
        
        if (targetRequestedActive && !isConfigActive) {
            showToast('Warning: Config is disabled. Target will be created but inactive until config is enabled.', 'warning');
        }

        const targetData = {
            item_name: formData.get('item_name'),
            min_price: parseFloat(formData.get('min_price')),
            max_price: parseFloat(formData.get('max_price')),
            min_float: parseFloat(formData.get('min_float')),
            max_float: parseFloat(formData.get('max_float')),
            markup_pct: parseFloat(formData.get('markup_pct')),
            markup_mult: parseFloat(formData.get('markup_mult')),
            mode: formData.get('mode'),
            // Check if config is active before allowing target to be active
            is_active: targetRequestedActive && isConfigActive,
            config_name: currentConfig,
            is_stattrak: formData.get('is_stattrak') ? formData.get('is_stattrak') === 'true' : null,
            paint_seed: formData.get('paint_seed') ? parseInt(formData.get('paint_seed')) : null,
            blue_gem_tier: formData.get('blue_gem_tier') ? parseInt(formData.get('blue_gem_tier')) : null,
            stickers: stickersData,
            charms: requiredCharms.length > 0 ? requiredCharms : null
        };

        if (editingTargetId) {
            // Update existing
            await API.updateTarget(editingTargetId, targetData);
            showToast('Target updated successfully!', 'success');
        } else {
            // Create new
            await API.createTarget(targetData);
            showToast('Target added successfully!', 'success');
        }

        showConstructor = false;
        editingTargetId = null;
        renderTargets(currentConfig);

    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

async function toggleConfigActive(active) {
    try {
        await API.toggleConfigActive(currentConfig, active);
        showToast(`Config ${active ? 'enabled' : 'disabled'} `, 'success');
        renderTargets(currentConfig);
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

async function toggleTargetActive(targetId, active) {
    try {
        await API.updateTarget(targetId, { is_active: active });
        showToast('Target updated', 'success');
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
        renderTargets(currentConfig);
    }
}

async function deleteTargetById(targetId) {
    if (!confirm('Delete this target?')) return;

    try {
        await API.deleteTarget(targetId);
        showToast('Target deleted', 'success');
        renderTargets(currentConfig);
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

async function deleteConfig() {
    if (!confirm(`Delete config "${currentConfig}" and all its targets ? `)) return;

    try {
        await API.deleteConfig(currentConfig);
        showToast('Config deleted', 'success');
        window.location.hash = 'targets?config=Default';
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

async function clearTargets() {
    showConfirmDialog(
        'Подтвердите действие на localhost:8000',
        'Clear all targets in Default?',
        async () => {
            try {
                for (const target of targets) {
                    await API.deleteTarget(target.id);
                }
                showToast('All targets cleared', 'success');
                renderTargets(currentConfig);
            } catch (error) {
                showToast(`Error: ${error.message}`, 'error');
            }
        }
    );
}

function createNewConfig() {
    const name = prompt('Enter new config name (e.g. "Kato 14"):');
    if (!name || !name.trim()) return;

    if (configs.find(c => c.name === name.trim())) {
        showToast('Config already exists', 'error');
        return;
    }

    // Switch to new config (will be created when first target is added)
    window.location.hash = `targets?config=${encodeURIComponent(name.trim())}`;
}

// ============================================================================
// Inline Cell Editing
// ============================================================================

let editingCell = null;
let originalValue = null;

async function editCell(event, targetId, field, inputType, options = null) {
    // Prevent multiple edits at once
    if (editingCell) {
        return;
    }

    const cell = event.target.closest('td');
    editingCell = cell;

    // Get current value
    const target = targets.find(t => t.id === targetId);
    if (!target) return;

    let currentValue = target[field];
    originalValue = currentValue;

    // Format value for display/editing
    let displayValue = currentValue;
    if (field === 'min_price' || field === 'max_price') {
        displayValue = currentValue.toFixed(2);
    } else if (field === 'min_float' || field === 'max_float') {
        displayValue = currentValue.toFixed(4);
    } else if (field === 'markup_pct' || field === 'markup_mult') {
        displayValue = currentValue;
    } else if (field === 'paint_seed' || field === 'blue_gem_tier') {
        displayValue = currentValue || '';
    } else if (field === 'is_stattrak') {
        displayValue = currentValue === null ? 'null' : currentValue.toString();
    }

    // Create input element
    let inputHTML;

    if (inputType === 'select') {
        inputHTML = `<select class="cell-edit-input" style="width: 100%; padding: 4px;">
            ${options.map(opt => {
            let label = opt;
            let value = opt;

            // Custom labels for specific fields
            if (field === 'blue_gem_tier') {
                label = opt === '' ? 'Any Tier' : `Tier ${opt}`;
            } else if (field === 'is_stattrak') {
                if (opt === 'null') label = 'Any';
                else if (opt === 'true') label = '✓ Yes';
                else if (opt === 'false') label = '✗ No';
            }

            const selected = value === displayValue ? 'selected' : '';
            return `<option value="${value}" ${selected}>${label}</option>`;
        }).join('')}
        </select>`;
    } else if (inputType === 'number') {
        let step = '0.01';
        let min = 0;
        let max = '';

        if (field === 'min_float' || field === 'max_float') {
            step = '0.0001';
            max = '1';
        } else if (field === 'paint_seed') {
            step = '1';
            max = '1000';
        } else if (field === 'markup_pct') {
            step = '1';
        } else if (field === 'markup_mult') {
            step = '0.1';
            min = '1';
        }

        inputHTML = `<input type="number" class="cell-edit-input" value="${displayValue}" 
            step="${step}" min="${min}" ${max ? `max="${max}"` : ''} 
            style="width: 100%; padding: 4px;">`;
    } else {
        // Text input
        inputHTML = `<input type="text" class="cell-edit-input" value="${displayValue}" 
            style="width: 100%; padding: 4px;">`;
    }

    // Mark cell as being edited
    cell.classList.add('cell-editing');
    cell.innerHTML = inputHTML;

    const input = cell.querySelector('.cell-edit-input');
    input.focus();
    if (input.select) input.select();

    // Save on blur or Enter
    const saveEdit = async () => {
        let newValue = input.value;

        // Parse value based on field type
        if (field === 'min_price' || field === 'max_price' || field === 'markup_pct' || field === 'markup_mult') {
            newValue = parseFloat(newValue);
        } else if (field === 'min_float' || field === 'max_float') {
            newValue = parseFloat(newValue);
        } else if (field === 'paint_seed' || field === 'blue_gem_tier') {
            newValue = newValue === '' ? null : parseInt(newValue);
        } else if (field === 'is_stattrak') {
            if (newValue === 'null') newValue = null;
            else if (newValue === 'true') newValue = true;
            else if (newValue === 'false') newValue = false;
        }

        // Validate
        if ((field.includes('price') || field.includes('float') || field.includes('markup')) && isNaN(newValue)) {
            showToast('Invalid number format', 'error');
            cancelEdit();
            return;
        }

        // Check if value changed
        if (newValue === originalValue) {
            cancelEdit();
            return;
        }

        try {
            // Update via API
            await API.updateTarget(targetId, { [field]: newValue });

            // Update local data
            target[field] = newValue;

            // Clear editing state
            editingCell = null;
            originalValue = null;

            // Re-render table
            await renderTargets(currentConfig);

            showToast('Target updated successfully', 'success');
        } catch (error) {
            showToast(`Failed to update: ${error.message} `, 'error');
            cancelEdit();
        }
    };

    const cancelEdit = () => {
        editingCell = null;
        originalValue = null;
        renderTargets(currentConfig);
    };

    // Event listeners
    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    });
}

// ============================================================================
// Confirmation Dialog
// ============================================================================

/**
 * Shows a confirmation dialog with custom styling
 * @param {string} title - Dialog title
 * @param {string} message - Confirmation message
 * @param {Function} onConfirm - Callback function to execute on confirmation
 */
function showConfirmDialog(title, message, onConfirm) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '9999';

    // Create modal content
    overlay.innerHTML = `
        <div class="modal-content" style="max-width: 500px; background-color: rgb(17 24 39); border: 1px solid rgb(55 65 81);">
            <div style="position: relative;">
                <!-- Close button -->
                <button 
                    id="modal-close-btn"
                    style="position: absolute; top: -8px; right: -8px; background: transparent; border: none; color: rgb(156 163 175); font-size: 24px; cursor: pointer; line-height: 1;"
                    onmouseover="this.style.color='rgb(243 244 246)'"
                    onmouseout="this.style.color='rgb(156 163 175)'"
                >×</button>
                
                <!-- Title -->
                <h3 style="font-size: 1.25rem; font-weight: 600; color: rgb(243 244 246); margin-bottom: 16px;">
                    ${title}
                </h3>
                
                <!-- Message -->
                <p style="font-size: 0.875rem; color: rgb(209 213 219); margin-bottom: 24px;">
                    ${message}
                </p>
                
                <!-- Buttons -->
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button 
                        id="modal-ok-btn"
                        class="btn"
                        style="background-color: rgb(147 197 253); color: rgb(17 24 39); padding: 8px 24px; font-weight: 500; border-radius: 8px;"
                        onmouseover="this.style.backgroundColor='rgb(125 174 230)'"
                        onmouseout="this.style.backgroundColor='rgb(147 197 253)'"
                    >OK</button>
                    <button 
                        id="modal-cancel-btn"
                        class="btn"
                        style="background-color: rgb(14 165 233); color: white; padding: 8px 24px; font-weight: 500; border-radius: 8px;"
                        onmouseover="this.style.backgroundColor='rgb(2 132 199)'"
                        onmouseout="this.style.backgroundColor='rgb(14 165 233)'"
                    >Отмена</button>
                </div>
            </div>
        </div>
    `;

    // Add to DOM
    document.body.appendChild(overlay);

    // Close handler
    const closeDialog = () => {
        overlay.remove();
    };

    // Confirm handler
    const confirmHandler = () => {
        closeDialog();
        if (onConfirm) onConfirm();
    };

    // Event listeners
    overlay.querySelector('#modal-ok-btn').addEventListener('click', confirmHandler);
    overlay.querySelector('#modal-cancel-btn').addEventListener('click', closeDialog);
    overlay.querySelector('#modal-close-btn').addEventListener('click', closeDialog);

    // Click outside to close
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeDialog();
        }
    });

    // ESC to close
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeDialog();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}
