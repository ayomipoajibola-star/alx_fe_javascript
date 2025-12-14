// ============================================
// DYNAMIC QUOTE GENERATOR WITH SERVER SYNC
// ============================================

// Configuration
const CONFIG = {
    // Mock API endpoints (using JSONPlaceholder for simulation)
    API_BASE_URL: 'https://jsonplaceholder.typicode.com',
    QUOTES_ENDPOINT: '/posts', // We'll use posts as quotes for simulation
    SYNC_INTERVAL: 30000, // 30 seconds
    MAX_RETRIES: 3,
    RETRY_DELAY: 5000, // 5 seconds
    CONFLICT_TIMEOUT: 10000, // 10 seconds
    VERSION_KEY: 'quote_generator_version',
    LAST_SYNC_KEY: 'last_sync_time',
    SYNC_HISTORY_KEY: 'sync_history',
    CONFLICTS_KEY: 'pending_conflicts',
    QUEUE_KEY: 'sync_queue'
};

// Application state
let appState = {
    quotes: [],
    localChanges: [],
    conflicts: [],
    syncQueue: [],
    syncHistory: [],
    serverVersion: 0,
    lastSync: null,
    isOnline: true,
    isSyncing: false,
    retryCount: 0,
    syncTimer: null,
    currentQuote: null
};

// DOM Elements
let domElements = {};

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the application
 */
async function init() {
    console.log('Initializing Dynamic Quote Generator with Server Sync...');
    
    // Initialize DOM elements
    initDOMElements();
    
    // Load data from localStorage
    loadAppState();
    
    // Setup event listeners
    setupEventListeners();
    
    // Start sync interval
    startSyncInterval();
    
    // Check online status
    updateOnlineStatus();
    
    // Initial sync
    await performInitialSync();
    
    // Update UI
    updateUI();
    
    console.log('Application initialized successfully');
    console.log('App State:', appState);
}

/**
 * Initialize DOM elements
 */
function initDOMElements() {
    // Quote Display elements
    domElements.quoteDisplay = document.getElementById('quoteDisplay');
    domElements.quoteText = document.getElementById('quoteText');
    domElements.quoteCategory = document.getElementById('quoteCategory');
    domElements.quoteSource = document.getElementById('quoteSource');
    domElements.syncBadge = document.getElementById('syncBadge');
    
    // Sync controls
    domElements.manualSync = document.getElementById('manualSync');
    domElements.viewConflicts = document.getElementById('viewConflicts');
    domElements.syncHistory = document.getElementById('syncHistory');
    domElements.forceSync = document.getElementById('forceSync');
    
    // Sync info
    domElements.syncStatus = document.getElementById('syncStatus');
    domElements.lastSyncTime = document.getElementById('lastSyncTime');
    domElements.totalQuotes = document.getElementById('totalQuotes');
    domElements.localChanges = document.getElementById('localChanges');
    domElements.serverVersion = document.getElementById('serverVersion');
    domElements.conflictCount = document.getElementById('conflictCount');
    domElements.syncHistoryList = document.getElementById('syncHistoryList');
    
    // Conflict resolution
    domElements.conflictResolution = document.getElementById('conflictResolution');
    domElements.conflictList = document.getElementById('conflictList');
    domElements.resolveAllConflicts = document.getElementById('resolveAllConflicts');
    domElements.dismissConflicts = document.getElementById('dismissConflicts');
    
    // Form elements
    domElements.newQuoteBtn = document.getElementById('newQuote');
    domElements.toggleForm = document.getElementById('toggleForm');
    domElements.exportData = document.getElementById('exportData');
    domElements.clearData = document.getElementById('clearData');
    domElements.addQuoteForm = document.getElementById('addQuoteForm');
    domElements.addQuoteBtn = document.getElementById('addQuoteBtn');
    domElements.cancelAddBtn = document.getElementById('cancelAddBtn');
    domElements.newQuoteText = document.getElementById('newQuoteText');
    domElements.newQuoteAuthor = document.getElementById('newQuoteAuthor');
    domElements.newQuoteCategory = document.getElementById('newQuoteCategory');
    
    // Status elements
    domElements.offlineBanner = document.getElementById('offlineBanner');
    domElements.loadingOverlay = document.getElementById('loadingOverlay');
    domElements.loadingMessage = document.getElementById('loadingMessage');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Quote controls
    domElements.newQuoteBtn.addEventListener('click', showRandomQuote);
    domElements.toggleForm.addEventListener('click', toggleAddQuoteForm);
    domElements.exportData.addEventListener('click', exportData);
    domElements.clearData.addEventListener('click', clearAllData);
    
    // Sync controls
    domElements.manualSync.addEventListener('click', manualSync);
    domElements.viewConflicts.addEventListener('click', showConflictResolution);
    domElements.syncHistory.addEventListener('click', showSyncHistory);
    domElements.forceSync.addEventListener('click', forceSync);
    
    // Conflict resolution
    domElements.resolveAllConflicts.addEventListener('click', resolveAllConflicts);
    domElements.dismissConflicts.addEventListener('click', dismissConflicts);
    
    // Form controls
    domElements.addQuoteBtn.addEventListener('click', addQuote);
    domElements.cancelAddBtn.addEventListener('click', toggleAddQuoteForm);
    
    // Online/offline detection
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Before unload - attempt to sync
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Visibility change - sync when tab becomes visible
    document.addEventListener('visibilitychange', handleVisibilityChange);
}

/**
 * Load application state from localStorage
 */
function loadAppState() {
    try {
        // Load quotes
        const savedQuotes = localStorage.getItem('quotes');
        if (savedQuotes) {
            appState.quotes = JSON.parse(savedQuotes);
        } else {
            appState.quotes = getDefaultQuotes();
        }
        
        // Load local changes
        const savedChanges = localStorage.getItem(CONFIG.QUEUE_KEY);
        if (savedChanges) {
            appState.localChanges = JSON.parse(savedChanges);
        }
        
        // Load conflicts
        const savedConflicts = localStorage.getItem(CONFIG.CONFLICTS_KEY);
        if (savedConflicts) {
            appState.conflicts = JSON.parse(savedConflicts);
        }
        
        // Load sync history
        const savedHistory = localStorage.getItem(CONFIG.SYNC_HISTORY_KEY);
        if (savedHistory) {
            appState.syncHistory = JSON.parse(savedHistory);
        }
        
        // Load server version
        const savedVersion = localStorage.getItem(CONFIG.VERSION_KEY);
        if (savedVersion) {
            appState.serverVersion = parseInt(savedVersion);
        }
        
        // Load last sync time
        const lastSync = localStorage.getItem(CONFIG.LAST_SYNC_KEY);
        if (lastSync) {
            appState.lastSync = new Date(lastSync);
        }
        
    } catch (error) {
        console.error('Error loading app state:', error);
        resetAppState();
    }
}

/**
 * Save application state to localStorage
 */
function saveAppState() {
    try {
        localStorage.setItem('quotes', JSON.stringify(appState.quotes));
        localStorage.setItem(CONFIG.QUEUE_KEY, JSON.stringify(appState.localChanges));
        localStorage.setItem(CONFIG.CONFLICTS_KEY, JSON.stringify(appState.conflicts));
        localStorage.setItem(CONFIG.SYNC_HISTORY_KEY, JSON.stringify(appState.syncHistory));
        localStorage.setItem(CONFIG.VERSION_KEY, appState.serverVersion.toString());
        
        if (appState.lastSync) {
            localStorage.setItem(CONFIG.LAST_SYNC_KEY, appState.lastSync.toISOString());
        }
    } catch (error) {
        console.error('Error saving app state:', error);
        showNotification('Error saving data to local storage', 'error');
    }
}

/**
 * Reset application state
 */
function resetAppState() {
    appState = {
        quotes: getDefaultQuotes(),
        localChanges: [],
        conflicts: [],
        syncQueue: [],
        syncHistory: [],
        serverVersion: 0,
        lastSync: null,
        isOnline: true,
        isSyncing: false,
        retryCount: 0,
        syncTimer: null,
        currentQuote: null
    };
}

// ============================================
// SERVER SYNC FUNCTIONS
// ============================================

/**
 * Start periodic sync interval
 */
function startSyncInterval() {
    if (appState.syncTimer) {
        clearInterval(appState.syncTimer);
    }
    
    appState.syncTimer = setInterval(async () => {
        if (appState.isOnline && !appState.isSyncing) {
            await syncWithServer();
        }
    }, CONFIG.SYNC_INTERVAL);
}

/**
 * Perform initial sync
 */
async function performInitialSync() {
    showLoading('Initializing sync with server...');
    
    try {
        // Fetch from server
        const serverQuotes = await fetchFromServer();
        
        if (serverQuotes.length > 0) {
            // Merge server data with local data
            await mergeData(serverQuotes);
            
            // Update server version
            appState.serverVersion++;
            
            // Save app state
            saveAppState();
            
            // Add to sync history
            addToSyncHistory('initial', true, 'Initial sync completed');
            
            showNotification('Initial sync completed successfully', 'success');
        }
    } catch (error) {
        console.error('Initial sync failed:', error);
        addToSyncHistory('initial', false, error.message);
        showNotification('Initial sync failed. Working offline.', 'warning');
    } finally {
        hideLoading();
    }
}

/**
 * Manual sync trigger
 */
async function manualSync() {
    if (appState.isSyncing) {
        showNotification('Sync already in progress', 'warning');
        return;
    }
    
    await syncWithServer();
}

/**
 * Force sync (ignore conflicts)
 */
async function forceSync() {
    if (appState.isSyncing) {
        showNotification('Sync already in progress', 'warning');
        return;
    }
    
    if (confirm('Force sync will override local changes with server data. Continue?')) {
        showLoading('Forcing sync with server...');
        
        try {
            // Fetch from server
            const serverQuotes = await fetchFromServer();
            
            // Replace local quotes with server quotes
            appState.quotes = serverQuotes.map(quote => ({
                ...quote,
                lastSynced: new Date().toISOString()
            }));
            
            // Clear local changes and conflicts
            appState.localChanges = [];
            appState.conflicts = [];
            appState.serverVersion++;
            
            // Save state
            saveAppState();
            
            // Add to history
            addToSyncHistory('force', true, 'Force sync completed');
            
            // Update UI
            updateUI();
            showRandomQuote();
            
            showNotification('Force sync completed successfully', 'success');
            
        } catch (error) {
            console.error('Force sync failed:', error);
            addToSyncHistory('force', false, error.message);
            showNotification('Force sync failed', 'error');
        } finally {
            hideLoading();
        }
    }
}

/**
 * Main sync function
 */
async function syncWithServer() {
    if (!appState.isOnline) {
        showNotification('Cannot sync while offline', 'warning');
        return;
    }
    
    if (appState.isSyncing) {
        console.log('Sync already in progress');
        return;
    }
    
    appState.isSyncing = true;
    updateSyncStatus('syncing');
    
    try {
        showLoading('Syncing with server...');
        
        // 1. Push local changes to server
        await pushLocalChanges();
        
        // 2. Pull updates from server
        const serverQuotes = await fetchFromServer();
        
        // 3. Merge data and resolve conflicts
        await mergeData(serverQuotes);
        
        // 4. Update sync timestamp
        appState.lastSync = new Date();
        appState.serverVersion++;
        
        // 5. Save state
        saveAppState();
        
        // 6. Update UI
        updateUI();
        
        // 7. Add to history
        addToSyncHistory('auto', true, 'Sync completed successfully');
        
        showNotification('Sync completed successfully', 'success');
        
        // Reset retry count on success
        appState.retryCount = 0;
        
    } catch (error) {
        console.error('Sync failed:', error);
        
        // Increment retry count
        appState.retryCount++;
        
        // Add to history
        addToSyncHistory('auto', false, error.message);
        
        // Show error notification
        showNotification(`Sync failed (attempt ${appState.retryCount}/${CONFIG.MAX_RETRIES})`, 'error');
        
        // Retry logic
        if (appState.retryCount < CONFIG.MAX_RETRIES) {
            setTimeout(() => {
                if (appState.isOnline) {
                    syncWithServer();
                }
            }, CONFIG.RETRY_DELAY);
        }
        
    } finally {
        appState.isSyncing = false;
        updateSyncStatus(appState.isOnline ? 'connected' : 'disconnected');
        hideLoading();
    }
}

/**
 * Push local changes to server
 */
async function pushLocalChanges() {
    if (appState.localChanges.length === 0) {
        return;
    }
    
    console.log(`Pushing ${appState.localChanges.length} local changes to server`);
    
    // In a real app, you would send changes to the server
    // For simulation, we'll just mark them as synced
    
    const successfulChanges = [];
    
    for (const change of appState.localChanges) {
        try {
            // Simulate API call
            await simulateAPICall('POST', change);
            
            // Mark quote as synced
            const quoteIndex = appState.quotes.findIndex(q => q.id === change.id);
            if (quoteIndex !== -1) {
                appState.quotes[quoteIndex].lastSynced = new Date().toISOString();
                appState.quotes[quoteIndex].isLocal = false;
            }
            
            successfulChanges.push(change.id);
            
        } catch (error) {
            console.error(`Failed to sync change ${change.id}:`, error);
            // Keep in queue for retry
        }
    }
    
    // Remove successfully synced changes
    appState.localChanges = appState.localChanges.filter(change => 
        !successfulChanges.includes(change.id)
    );
    
    console.log(`Successfully pushed ${successfulChanges.length} changes`);
}

/**
 * Fetch quotes from server
 */
async function fetchFromServer() {
    console.log('Fetching quotes from server...');
    
    try {
        // Simulate API call with random delay
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
        
        // For simulation, we'll create some server quotes
        // In a real app, this would be an actual API call
        const serverQuotes = generateServerQuotes();
        
        console.log(`Fetched ${serverQuotes.length} quotes from server`);
        return serverQuotes;
        
    } catch (error) {
        console.error('Error fetching from server:', error);
        throw new Error('Failed to fetch from server');
    }
}

/**
 * Merge server data with local data
 */
async function mergeData(serverQuotes) {
    console.log('Merging server data with local data...');
    
    const newConflicts = [];
    
    // Create a map of local quotes by ID for easy lookup
    const localQuotesMap = new Map();
    appState.quotes.forEach(quote => {
        if (quote.id) {
            localQuotesMap.set(quote.id, quote);
        }
    });
    
    // Process server quotes
    for (const serverQuote of serverQuotes) {
        const localQuote = localQuotesMap.get(serverQuote.id);
        
        if (localQuote) {
            // Quote exists locally, check for conflicts
            if (hasConflict(localQuote, serverQuote)) {
                newConflicts.push({
                    id: serverQuote.id,
                    local: { ...localQuote },
                    server: { ...serverQuote },
                    timestamp: new Date().toISOString(),
                    resolved: false
                });
                
                // For simulation, server wins by default
                // In a real app, you might have more sophisticated conflict resolution
                const mergedQuote = resolveConflict(localQuote, serverQuote, 'server');
                const index = appState.quotes.findIndex(q => q.id === serverQuote.id);
                if (index !== -1) {
                    appState.quotes[index] = mergedQuote;
                }
                
            } else {
                // No conflict, update local quote with server data
                const index = appState.quotes.findIndex(q => q.id === serverQuote.id);
                if (index !== -1) {
                    appState.quotes[index] = {
                        ...serverQuote,
                        lastSynced: new Date().toISOString()
                    };
                }
            }
            
            // Remove from map since it's been processed
            localQuotesMap.delete(serverQuote.id);
            
        } else {
            // New quote from server, add it
            appState.quotes.push({
                ...serverQuote,
                lastSynced: new Date().toISOString(),
                isLocal: false
            });
        }
    }
    
    // Add any remaining local quotes (they don't exist on server)
    // These will stay as local changes
    
    // Add new conflicts to the conflicts array
    if (newConflicts.length > 0) {
        appState.conflicts = [...appState.conflicts, ...newConflicts];
        console.log(`Found ${newConflicts.length} new conflicts`);
        
        // Show conflict notification
        if (newConflicts.length > 0) {
            showConflictNotification(newConflicts.length);
        }
    }
}

/**
 * Check if there's a conflict between local and server versions
 */
function hasConflict(localQuote, serverQuote) {
    if (!localQuote.lastSynced || !serverQuote.lastUpdated) {
        return false;
    }
    
    const localTime = new Date(localQuote.lastSynced).getTime();
    const serverTime = new Date(serverQuote.lastUpdated).getTime();
    
    // Conflict if both were modified after last sync
    return localTime > serverTime && localQuote.lastSynced !== serverQuote.lastUpdated;
}

/**
 * Resolve a conflict between local and server versions
 */
function resolveConflict(localQuote, serverQuote, strategy = 'server') {
    console.log(`Resolving conflict with strategy: ${strategy}`);
    
    switch (strategy) {
        case 'server':
            // Server wins
            return {
                ...serverQuote,
                lastSynced: new Date().toISOString(),
                resolvedAt: new Date().toISOString(),
                resolution: 'server'
            };
            
        case 'local':
            // Local wins
            return {
                ...localQuote,
                lastSynced: new Date().toISOString(),
                resolvedAt: new Date().toISOString(),
                resolution: 'local'
            };
            
        case 'merge':
            // Merge both (prefer server for simulation)
            return {
                ...serverQuote,
                text: localQuote.text !== serverQuote.text ? 
                    `${serverQuote.text} (merged with: ${localQuote.text})` : serverQuote.text,
                lastSynced: new Date().toISOString(),
                resolvedAt: new Date().toISOString(),
                resolution: 'merge'
            };
            
        default:
            return serverQuote;
    }
}

/**
 * Add entry to sync history
 */
function addToSyncHistory(type, success, message = '') {
    const historyEntry = {
        timestamp: new Date().toISOString(),
        type: type,
        success: success,
        message: message,
        changesCount: appState.localChanges.length,
        conflictsCount: appState.conflicts.length
    };
    
    appState.syncHistory.unshift(historyEntry);
    
    // Keep only last 50 entries
    if (appState.syncHistory.length > 50) {
        appState.syncHistory = appState.syncHistory.slice(0, 50);
    }
    
    // Update UI
    updateSyncHistoryDisplay();
}

// ============================================
// QUOTE MANAGEMENT
// ============================================

/**
 * Show random quote
 */
function showRandomQuote() {
    if (appState.quotes.length === 0) {
        domElements.quoteText.textContent = 'No quotes available. Add some quotes!';
        domElements.quoteCategory.textContent = 'Empty';
        domElements.quoteSource.textContent = 'Add quotes using the form below';
        return;
    }
    
    // Filter out quotes that are in conflict
    const availableQuotes = appState.quotes.filter(quote => 
        !appState.conflicts.some(conflict => conflict.id === quote.id)
    );
    
    const quotePool = availableQuotes.length > 0 ? availableQuotes : appState.quotes;
    const randomIndex = Math.floor(Math.random() * quotePool.length);
    const quote = quotePool[randomIndex];
    
    // Update quote display
    domElements.quoteText.textContent = `"${quote.text}"`;
    domElements.quoteCategory.textContent = quote.category || 'Uncategorized';
    domElements.quoteSource.textContent = quote.author ? `— ${quote.author}` : '— Unknown';
    
    // Update sync badge
    if (quote.isLocal) {
        domElements.syncBadge.innerHTML = '<i class="fas fa-clock"></i> Pending Sync';
        domElements.syncBadge.style.background = '#f59e0b';
        domElements.syncBadge.style.color = '#92400e';
    } else if (quote.lastSynced) {
        domElements.syncBadge.innerHTML = '<i class="fas fa-cloud"></i> Cloud Synced';
        domElements.syncBadge.style.background = '#10b981';
        domElements.syncBadge.style.color = '#065f46';
    }
    
    // Check if quote has conflicts
    const hasConflict = appState.conflicts.some(c => c.id === quote.id);
    if (hasConflict) {
        domElements.quoteDisplay.classList.add('conflict');
        domElements.syncBadge.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Has Conflict';
        domElements.syncBadge.style.background = '#ef4444';
        domElements.syncBadge.style.color = '#991b1b';
    } else {
        domElements.quoteDisplay.classList.remove('conflict');
    }
    
    // Store current quote
    appState.currentQuote = quote;
}

/**
 * Add new quote
 */
function addQuote() {
    const text = domElements.newQuoteText.value.trim();
    const author = domElements.newQuoteAuthor.value.trim();
    const category = domElements.newQuoteCategory.value.trim();
    const syncMode = document.querySelector('input[name="syncMode"]:checked').value;
    
    // Validate
    if (!text) {
        showNotification('Please enter quote text', 'error');
        return;
    }
    
    if (!category) {
        showNotification('Please enter a category', 'error');
        return;
    }
    
    // Create new quote
    const newQuote = {
        id: generateId(),
        text: text,
        author: author || 'Unknown',
        category: category,
        createdAt: new Date().toISOString(),
        lastSynced: null,
        isLocal: true
    };
    
    // Add to quotes
    appState.quotes.push(newQuote);
    
    // Handle sync mode
    if (syncMode === 'immediate' && appState.isOnline) {
        appState.localChanges.push({
            ...newQuote,
            action: 'create',
            timestamp: new Date().toISOString()
        });
        
        // Attempt immediate sync
        if (appState.isOnline) {
            syncWithServer();
        }
    } else {
        // Queue for later sync
        appState.localChanges.push({
            ...newQuote,
            action: 'create',
            timestamp: new Date().toISOString(),
            queued: true
        });
        
        showNotification('Quote added to sync queue', 'info');
    }
    
    // Clear form
    domElements.newQuoteText.value = '';
    domElements.newQuoteAuthor.value = '';
    domElements.newQuoteCategory.value = '';
    
    // Hide form
    toggleAddQuoteForm();
    
    // Save state
    saveAppState();
    
    // Update UI
    updateUI();
    showRandomQuote();
    
    showNotification('Quote added successfully', 'success');
}

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Get default quotes
 */
function getDefaultQuotes() {
    return [
        {
            id: '1',
            text: "The only way to do great work is to love what you do.",
            author: "Steve Jobs",
            category: "Inspiration",
            createdAt: new Date().toISOString(),
            lastSynced: new Date().toISOString(),
            isLocal: false
        },
        {
            id: '2',
            text: "Life is what happens to you while you're busy making other plans.",
            author: "Allen Saunders",
            category: "Life",
            createdAt: new Date().toISOString(),
            lastSynced: new Date().toISOString(),
            isLocal: false
        }
    ];
}

/**
 * Generate server quotes for simulation
 */
function generateServerQuotes() {
    const serverQuotes = [
        {
            id: 'server-1',
            text: "The future belongs to those who believe in the beauty of their dreams.",
            author: "Eleanor Roosevelt",
            category: "Dreams",
            createdAt: new Date().toISOString(),
            lastUpdated: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
            version: 2
        },
        {
            id: 'server-2',
            text: "It does not matter how slowly you go as long as you do not stop.",
            author: "Confucius",
            category: "Perseverance",
            createdAt: new Date().toISOString(),
            lastUpdated: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
            version: 1
        },
        {
            id: '1', // Same ID as local quote to simulate conflict
            text: "The only way to do great work is to love what you do. (Server Updated)",
            author: "Steve Jobs",
            category: "Inspiration",
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(), // Updated now on server
            version: 3
        }
    ];
    
    return serverQuotes;
}

// ============================================
// CONFLICT RESOLUTION
// ============================================

/**
 * Show conflict resolution panel
 */
function showConflictResolution() {
    if (appState.conflicts.length === 0) {
        showNotification('No conflicts to resolve', 'info');
        return;
    }
    
    updateConflictList();
    domElements.conflictResolution.classList.add('active');
}

/**
 * Update conflict list display
 */
function updateConflictList() {
    if (appState.conflicts.length === 0) {
        domElements.conflictList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #64748b;">
                <i class="fas fa-check-circle" style="font-size: 2rem; margin-bottom: 10px;"></i>
                <p>No conflicts to resolve</p>
            </div>
        `;
        return;
    }
    
    const conflictsHTML = appState.conflicts.map((conflict, index) => `
        <div class="conflict-item">
            <h4>Conflict #${index + 1}: ${conflict.local.text.substring(0, 50)}...</h4>
            <div class="conflict-versions">
                <div class="conflict-version local">
                    <h5><i class="fas fa-laptop"></i> Local Version</h5>
                    <p><strong>Text:</strong> ${conflict.local.text}</p>
                    <p><strong>Category:</strong> ${conflict.local.category}</p>
                    <p><strong>Author:</strong> ${conflict.local.author || 'Unknown'}</p>
                    <p><strong>Last Modified:</strong> ${new Date(conflict.local.lastSynced || conflict.local.createdAt).toLocaleString()}</p>
                </div>
                <div class="conflict-version server">
                    <h5><i class="fas fa-server"></i> Server Version</h5>
                    <p><strong>Text:</strong> ${conflict.server.text}</p>
                    <p><strong>Category:</strong> ${conflict.server.category}</p>
                    <p><strong>Author:</strong> ${conflict.server.author || 'Unknown'}</p>
                    <p><strong>Last Updated:</strong> ${new Date(conflict.server.lastUpdated).toLocaleString()}</p>
                </div>
            </div>
            <div class="conflict-actions">
                <button class="sync-btn" onclick="resolveConflictById('${conflict.id}', 'local')">
                    <i class="fas fa-laptop"></i> Use Local
                </button>
                <button class="sync-btn" onclick="resolveConflictById('${conflict.id}', 'server')">
                    <i class="fas fa-server"></i> Use Server
                </button>
                <button class="secondary-btn" onclick="resolveConflictById('${conflict.id}', 'merge')">
                    <i class="fas fa-merge"></i> Merge
                </button>
                <button class="warning-btn" onclick="dismissConflict('${conflict.id}')">
                    <i class="fas fa-times"></i> Dismiss
                </button>
            </div>
        </div>
    `).join('');
    
    domElements.conflictList.innerHTML = conflictsHTML;
}

/**
 * Resolve specific conflict
 */
function resolveConflictById(conflictId, strategy) {
    const conflictIndex = appState.conflicts.findIndex(c => c.id === conflictId);
    if (conflictIndex === -1) return;
    
    const conflict = appState.conflicts[conflictIndex];
    
    // Resolve the conflict
    const resolvedQuote = resolveConflict(conflict.local, conflict.server, strategy);
    
    // Update the quote in the main array
    const quoteIndex = appState.quotes.findIndex(q => q.id === conflictId);
    if (quoteIndex !== -1) {
        appState.quotes[quoteIndex] = resolvedQuote;
    }
    
    // Remove from conflicts
    appState.conflicts.splice(conflictIndex, 1);
    
    // Save state
    saveAppState();
    
    // Update UI
    updateUI();
    updateConflictList();
    
    // If no conflicts left, hide the panel
    if (appState.conflicts.length === 0) {
        domElements.conflictResolution.classList.remove('active');
        showNotification('All conflicts resolved', 'success');
    } else {
        showNotification(`Conflict resolved (${strategy} version)`, 'success');
    }
}

/**
 * Resolve all conflicts
 */
function resolveAllConflicts() {
    if (appState.conflicts.length === 0) return;
    
    if (confirm(`Resolve all ${appState.conflicts.length} conflicts using server version?`)) {
        appState.conflicts.forEach(conflict => {
            const resolvedQuote = resolveConflict(conflict.local, conflict.server, 'server');
            const quoteIndex = appState.quotes.findIndex(q => q.id === conflict.id);
            if (quoteIndex !== -1) {
                appState.quotes[quoteIndex] = resolvedQuote;
            }
        });
        
        appState.conflicts = [];
        saveAppState();
        updateUI();
        domElements.conflictResolution.classList.remove('active');
        showNotification('All conflicts resolved (server version)', 'success');
    }
}

/**
 * Dismiss conflict (keep local version)
 */
function dismissConflict(conflictId) {
    const conflictIndex = appState.conflicts.findIndex(c => c.id === conflictId);
    if (conflictIndex === -1) return;
    
    appState.conflicts.splice(conflictIndex, 1);
    saveAppState();
    updateConflictList();
    
    if (appState.conflicts.length === 0) {
        domElements.conflictResolution.classList.remove('active');
    }
    
    showNotification('Conflict dismissed', 'info');
}

/**
 * Dismiss all conflicts
 */
function dismissConflicts() {
    if (appState.conflicts.length === 0) return;
    
    if (confirm(`Dismiss all ${appState.conflicts.length} conflicts?`)) {
        appState.conflicts = [];
        saveAppState();
        updateUI();
        domElements.conflictResolution.classList.remove('active');
        showNotification('All conflicts dismissed', 'info');
    }
}

/**
 * Show conflict notification
 */
function showConflictNotification(count) {
    const notification = document.createElement('div');
    notification.className = 'notification warning';
    notification.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <span>${count} conflict${count > 1 ? 's' : ''} detected</span>
        <button onclick="showConflictResolution()" style="margin-left: 10px; background: white; color: #d97706; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">
            Resolve
        </button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// ============================================
// UI UPDATES
// ============================================

/**
 * Update all UI elements
 */
function updateUI() {
    // Update stats
    domElements.totalQuotes.textContent = appState.quotes.length;
    domElements.localChanges.textContent = appState.localChanges.length;
    domElements.serverVersion.textContent = appState.serverVersion;
    domElements.conflictCount.textContent = appState.conflicts.length;
    
    // Update sync status
    domElements.lastSyncTime.textContent = appState.lastSync 
        ? formatTimeSince(appState.lastSync)
        : 'Never synced';
    
    // Update sync history
    updateSyncHistoryDisplay();
    
    // Show random quote if none is displayed
    if (!appState.currentQuote && appState.quotes.length > 0) {
        showRandomQuote();
    }
}

/**
 * Update sync status display
 */
function updateSyncStatus(status) {
    const statusElement = domElements.syncStatus;
    
    switch (status) {
        case 'connected':
            statusElement.className = 'sync-indicator sync-connected';
            statusElement.innerHTML = '<i class="fas fa-circle"></i> Connected';
            break;
            
        case 'disconnected':
            statusElement.className = 'sync-indicator sync-disconnected';
            statusElement.innerHTML = '<i class="fas fa-circle"></i> Disconnected';
            break;
            
        case 'syncing':
            statusElement.className = 'sync-indicator sync-syncing';
            statusElement.innerHTML = '<div class="sync-spinner"></div> Syncing...';
            break;
    }
}

/**
 * Update sync history display
 */
function updateSyncHistoryDisplay() {
    if (appState.syncHistory.length === 0) {
        domElements.syncHistoryList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #64748b;">
                <p>No sync history yet</p>
            </div>
        `;
        return;
    }
    
    const historyHTML = appState.syncHistory.slice(0, 10).map(entry => `
        <div class="sync-history-item">
            <div>
                <strong>${entry.type} sync</strong>
                <div class="sync-time">${formatTimeSince(new Date(entry.timestamp))}</div>
            </div>
            <div class="sync-result ${entry.success ? 'sync-success' : 'sync-error'}">
                ${entry.success ? 'Success' : 'Failed'}
            </div>
        </div>
    `).join('');
    
    domElements.syncHistoryList.innerHTML = historyHTML;
}

/**
 * Update online status
 */
function updateOnlineStatus() {
    const wasOnline = appState.isOnline;
    appState.isOnline = navigator.onLine;
    
    if (appState.isOnline !== wasOnline) {
        if (appState.isOnline) {
            // Came online - attempt to sync
            domElements.offlineBanner.classList.remove('active');
            updateSyncStatus('connected');
            showNotification('Back online. Syncing changes...', 'success');
            
            // Sync after a short delay
            setTimeout(() => {
                if (appState.localChanges.length > 0) {
                    syncWithServer();
                }
            }, 2000);
            
        } else {
            // Went offline
            domElements.offlineBanner.classList.add('active');
            updateSyncStatus('disconnected');
            showNotification('You are now offline. Changes will be queued.', 'warning');
        }
    }
}

/**
 * Show sync history
 */
function showSyncHistory() {
    // Already displayed in the panel
    domElements.syncHistoryList.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Toggle add quote form
 */
function toggleAddQuoteForm() {
    const isVisible = domElements.addQuoteForm.style.display === 'block';
    domElements.addQuoteForm.style.display = isVisible ? 'none' : 'block';
    domElements.toggleForm.innerHTML = isVisible 
        ? '<i class="fas fa-plus"></i> Add New Quote'
        : '<i class="fas fa-times"></i> Cancel';
}

/**
 * Show loading overlay
 */
function showLoading(message = 'Loading...') {
    domElements.loadingMessage.textContent = message;
    domElements.loadingOverlay.classList.add('active');
    domElements.quoteDisplay.classList.add('syncing');
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    domElements.loadingOverlay.classList.remove('active');
    domElements.quoteDisplay.classList.remove('syncing');
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => {
        notification.remove();
    });
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${getNotificationIcon(type)}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

/**
 * Get notification icon based on type
 */
function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        case 'warning': return 'exclamation-triangle';
        default: return 'info-circle';
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format time since
 */
function formatTimeSince(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
}

/**
 * Export data
 */
function exportData() {
    const exportObj = {
        quotes: appState.quotes,
        syncHistory: appState.syncHistory,
        conflicts: appState.conflicts,
        localChanges: appState.localChanges,
        metadata: {
            exportedAt: new Date().toISOString(),
            serverVersion: appState.serverVersion,
            totalQuotes: appState.quotes.length
        }
    };
    
    const dataStr = JSON.stringify(exportObj, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `quotes-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    showNotification('Data exported successfully', 'success');
}

/**
 * Clear all data
 */
function clearAllData() {
    if (confirm('Are you sure you want to clear ALL data? This cannot be undone!')) {
        resetAppState();
        saveAppState();
        updateUI();
        showRandomQuote();
        showNotification('All data cleared', 'warning');
    }
}

/**
 * Handle before unload
 */
function handleBeforeUnload(e) {
    if (appState.localChanges.length > 0 && appState.isOnline) {
        // Attempt a quick sync before leaving
        e.preventDefault();
        e.returnValue = 'You have unsynced changes. Are you sure you want to leave?';
        
        // Try to sync in the background
        navigator.sendBeacon?.('/api/sync', JSON.stringify({
            changes: appState.localChanges,
            timestamp: new Date().toISOString()
        }));
    }
}

/**
 * Handle visibility change
 */
function handleVisibilityChange() {
    if (!document.hidden && appState.isOnline && appState.localChanges.length > 0) {
        // Tab became visible and we have changes, sync
        setTimeout(() => {
            syncWithServer();
        }, 1000);
    }
}

/**
 * Simulate API call
 */
function simulateAPICall(method, data) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // Simulate random failures (10% chance)
            if (Math.random() < 0.1) {
                reject(new Error('Simulated API failure'));
            } else {
                resolve({ success: true, data: { ...data, syncedAt: new Date().toISOString() } });
            }
        }, 500 + Math.random() * 1000);
    });
}

// ============================================
// GLOBAL EXPORTS
// ============================================

// Make functions available globally
window.resolveConflictById = resolveConflictById;
window.dismissConflict = dismissConflict;
window.showConflictResolution = showConflictResolution;

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

console.log('Dynamic Quote Generator with Server Sync loaded');
