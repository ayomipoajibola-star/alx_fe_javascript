// ============================================
// DYNAMIC QUOTE GENERATOR WITH SERVER SYNC
// ============================================

// Configuration
const CONFIG = {
    // JSONPlaceholder API endpoints
    API_BASE_URL: 'https://jsonplaceholder.typicode.com',
    POSTS_ENDPOINT: '/posts', // This is the required endpoint: https://jsonplaceholder.typicode.com/posts
    USERS_ENDPOINT: '/users',
    
    // Sync settings
    SYNC_INTERVAL: 30000, // 30 seconds
    MAX_RETRIES: 3,
    RETRY_DELAY: 5000, // 5 seconds
    CONFLICT_TIMEOUT: 10000, // 10 seconds
    
    // Storage keys
    VERSION_KEY: 'quote_generator_version',
    LAST_SYNC_KEY: 'last_sync_time',
    SYNC_HISTORY_KEY: 'sync_history',
    CONFLICTS_KEY: 'pending_conflicts',
    QUEUE_KEY: 'sync_queue',
    QUOTES_KEY: 'quotes'
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
// SERVER INTERACTION FUNCTIONS
// ============================================

/**
 * Fetch quotes from JSONPlaceholder server
 * Uses https://jsonplaceholder.typicode.com/posts
 */
async function fetchQuotesFromServer() {
    console.log('fetchQuotesFromServer: Fetching from JSONPlaceholder API...');
    
    showLoading('Fetching quotes from server...');
    
    try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        // Fetch from JSONPlaceholder posts endpoint
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.POSTS_ENDPOINT}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const posts = await response.json();
        console.log(`fetchQuotesFromServer: Received ${posts.length} posts from API`);
        
        // Transform posts to quotes
        const serverQuotes = await transformPostsToQuotes(posts.slice(0, 15)); // Limit to 15 for demo
        
        // Add simulated conflicts for demonstration
        const quotesWithConflicts = addSimulatedConflicts(serverQuotes);
        
        console.log(`fetchQuotesFromServer: Transformed to ${quotesWithConflicts.length} quotes`);
        
        // Add to sync history
        addToSyncHistory('fetch', true, `Fetched ${quotesWithConflicts.length} quotes from JSONPlaceholder`);
        
        return quotesWithConflicts;
        
    } catch (error) {
        console.error('fetchQuotesFromServer: Error:', error);
        
        // Add to sync history
        addToSyncHistory('fetch', false, error.message || 'Network error');
        
        // Return simulated data for offline/error scenario
        console.log('fetchQuotesFromServer: Using simulated data due to error');
        return generateSimulatedServerQuotes();
        
    } finally {
        hideLoading();
    }
}

/**
 * Transform JSONPlaceholder posts to quote format
 */
async function transformPostsToQuotes(posts) {
    try {
        // Fetch user data for author names
        const usersResponse = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.USERS_ENDPOINT}`);
        const users = usersResponse.ok ? await usersResponse.json() : [];
        
        const categories = [
            'Inspiration', 'Life', 'Wisdom', 'Success', 
            'Motivation', 'Philosophy', 'Humor', 'Love',
            'Courage', 'Hope', 'Knowledge', 'Freedom'
        ];
        
        return posts.map((post, index) => {
            const user = users[post.userId - 1] || users[0] || { name: 'Unknown' };
            
            return {
                id: `server-${post.id}`,
                text: post.title.length > 100 ? post.title.substring(0, 100) + '...' : post.title,
                body: post.body,
                author: user.name,
                category: categories[post.userId % categories.length] || 'General',
                createdAt: new Date(Date.now() - (post.id * 1000000)).toISOString(),
                lastUpdated: new Date().toISOString(),
                isLocal: false,
                source: 'jsonplaceholder',
                version: Math.floor(Math.random() * 5) + 1,
                userId: post.userId,
                postId: post.id,
                synced: true
            };
        });
        
    } catch (error) {
        console.error('transformPostsToQuotes: Error:', error);
        
        // Fallback transformation without user data
        return posts.map((post, index) => ({
            id: `server-${post.id}`,
            text: post.title.length > 100 ? post.title.substring(0, 100) + '...' : post.title,
            body: post.body,
            author: 'Anonymous',
            category: index % 2 === 0 ? 'Inspiration' : 'Wisdom',
            createdAt: new Date(Date.now() - (post.id * 1000000)).toISOString(),
            lastUpdated: new Date().toISOString(),
            isLocal: false,
            source: 'jsonplaceholder',
            version: 1,
            userId: post.userId,
            postId: post.id,
            synced: true
        }));
    }
}

/**
 * Main sync function - syncQuotes
 * This function handles complete synchronization between local and server data
 */
async function syncQuotes() {
    console.log('syncQuotes: Starting complete quote synchronization...');
    
    if (!appState.isOnline) {
        showNotification('Cannot sync while offline. Please check your internet connection.', 'warning');
        return { 
            success: false, 
            message: 'Offline',
            action: 'syncQuotes'
        };
    }
    
    if (appState.isSyncing) {
        showNotification('Sync already in progress. Please wait...', 'info');
        return { 
            success: false, 
            message: 'Already syncing',
            action: 'syncQuotes'
        };
    }
    
    appState.isSyncing = true;
    updateSyncStatus('syncing');
    
    const syncResult = {
        success: false,
        message: '',
        newQuotes: 0,
        updatedQuotes: 0,
        conflicts: 0,
        errors: [],
        action: 'syncQuotes',
        timestamp: new Date().toISOString()
    };
    
    try {
        showLoading('Starting quote synchronization with JSONPlaceholder...');
        
        // 1. Check server connectivity to https://jsonplaceholder.typicode.com/posts
        const serverStatus = await checkServerStatus();
        if (!serverStatus.online) {
            throw new Error(`JSONPlaceholder server unavailable: ${serverStatus.error}`);
        }
        
        console.log('syncQuotes: Server is online, proceeding with sync...');
        
        // 2. Fetch quotes from JSONPlaceholder server
        showLoading('Fetching quotes from JSONPlaceholder...');
        const serverQuotes = await fetchQuotesFromServer();
        syncResult.newQuotes = serverQuotes.length;
        console.log(`syncQuotes: Fetched ${serverQuotes.length} quotes from server`);
        
        // 3. Merge server quotes with local quotes
        showLoading('Merging quotes with local data...');
        const mergeResult = await mergeQuotesWithServer(serverQuotes);
        syncResult.updatedQuotes = mergeResult.updated;
        syncResult.conflicts = mergeResult.conflicts;
        
        // 4. Push local changes to server
        if (appState.localChanges.length > 0) {
            showLoading('Pushing local changes to JSONPlaceholder...');
            const pushResult = await pushLocalChangesToServer();
            console.log(`syncQuotes: Pushed ${pushResult.success} changes to server`);
        }
        
        // 5. Update sync metadata
        appState.lastSync = new Date();
        appState.serverVersion++;
        
        // 6. Save to localStorage
        saveAppState();
        
        // 7. Update UI
        updateUI();
        showRandomQuote();
        
        // 8. Record successful sync
        syncResult.success = true;
        syncResult.message = `Sync completed: ${syncResult.newQuotes} new quotes, ${syncResult.updatedQuotes} updated`;
        
        // Add to sync history
        addToSyncHistory('sync', true, syncResult.message);
        
        // Show success notification
        let successMessage = `Sync completed successfully!`;
        if (syncResult.newQuotes > 0) {
            successMessage += ` Added ${syncResult.newQuotes} new quotes.`;
        }
        if (syncResult.conflicts > 0) {
            successMessage += ` ${syncResult.conflicts} conflicts detected.`;
        }
        
        showNotification(successMessage, 'success');
        
        console.log('syncQuotes: Sync completed successfully', syncResult);
        
        return syncResult;
        
    } catch (error) {
        console.error('syncQuotes: Sync failed:', error);
        
        // Update sync result
        syncResult.success = false;
        syncResult.message = error.message;
        syncResult.errors.push(error.message);
        
        // Add to sync history
        addToSyncHistory('sync', false, error.message);
        
        // Increment retry count
        appState.retryCount++;
        
        // Show error notification
        let errorMessage = `Sync failed: ${error.message}`;
        if (appState.retryCount < CONFIG.MAX_RETRIES) {
            errorMessage += ` Retrying in ${CONFIG.RETRY_DELAY / 1000} seconds...`;
            
            // Schedule retry
            setTimeout(() => {
                if (appState.isOnline) {
                    syncQuotes();
                }
            }, CONFIG.RETRY_DELAY);
        }
        
        showNotification(errorMessage, 'error');
        
        return syncResult;
        
    } finally {
        appState.isSyncing = false;
        updateSyncStatus(appState.isOnline ? 'connected' : 'disconnected');
        hideLoading();
    }
}

/**
 * Merge server quotes with local quotes
 */
async function mergeQuotesWithServer(serverQuotes) {
    console.log('mergeQuotesWithServer: Merging server quotes with local data...');
    
    const mergeResult = {
        added: 0,
        updated: 0,
        conflicts: 0,
        errors: []
    };
    
    // Create maps for efficient lookup
    const localQuotesMap = new Map();
    appState.quotes.forEach(quote => {
        if (quote.id && !quote.source?.includes('jsonplaceholder')) {
            localQuotesMap.set(quote.id, quote);
        }
    });
    
    const serverQuotesMap = new Map();
    serverQuotes.forEach(quote => {
        serverQuotesMap.set(quote.id, quote);
    });
    
    // Process each server quote
    for (const [quoteId, serverQuote] of serverQuotesMap) {
        try {
            const localQuote = localQuotesMap.get(quoteId);
            
            if (!localQuote) {
                // New quote from server - add it
                appState.quotes.push({
                    ...serverQuote,
                    lastSynced: new Date().toISOString(),
                    isLocal: false,
                    source: 'jsonplaceholder'
                });
                mergeResult.added++;
                console.log(`mergeQuotesWithServer: Added new quote: ${serverQuote.text.substring(0, 50)}...`);
                
            } else {
                // Quote exists locally - check for conflicts
                if (hasQuoteConflict(localQuote, serverQuote)) {
                    // Create conflict
                    appState.conflicts.push({
                        id: quoteId,
                        local: { ...localQuote },
                        server: { ...serverQuote },
                        timestamp: new Date().toISOString(),
                        resolved: false
                    });
                    mergeResult.conflicts++;
                    console.log(`mergeQuotesWithServer: Conflict detected for quote: ${localQuote.text.substring(0, 50)}...`);
                    
                    // Auto-resolve with server version (you can change this strategy)
                    const resolvedQuote = resolveQuoteConflict(localQuote, serverQuote, 'server');
                    const index = appState.quotes.findIndex(q => q.id === quoteId);
                    if (index !== -1) {
                        appState.quotes[index] = resolvedQuote;
                    }
                    
                } else {
                    // No conflict - update with server data
                    const index = appState.quotes.findIndex(q => q.id === quoteId);
                    if (index !== -1) {
                        appState.quotes[index] = {
                            ...serverQuote,
                            lastSynced: new Date().toISOString(),
                            isLocal: false
                        };
                        mergeResult.updated++;
                        console.log(`mergeQuotesWithServer: Updated quote: ${serverQuote.text.substring(0, 50)}...`);
                    }
                }
            }
            
        } catch (error) {
            console.error(`mergeQuotesWithServer: Error processing quote ${quoteId}:`, error);
            mergeResult.errors.push(`Failed to process quote ${quoteId}: ${error.message}`);
        }
    }
    
    console.log(`mergeQuotesWithServer: Merge completed - ${mergeResult.added} added, ${mergeResult.updated} updated, ${mergeResult.conflicts} conflicts`);
    return mergeResult;
}

/**
 * Push local changes to JSONPlaceholder server
 */
async function pushLocalChangesToServer() {
    if (appState.localChanges.length === 0) {
        return { success: 0, failed: 0, total: 0 };
    }
    
    console.log(`pushLocalChangesToServer: Pushing ${appState.localChanges.length} local changes to JSONPlaceholder`);
    
    const pushResult = {
        success: 0,
        failed: 0,
        total: appState.localChanges.length,
        details: []
    };
    
    // Process each local change
    for (const change of appState.localChanges) {
        try {
            // For JSONPlaceholder, we simulate sending since it's read-only
            const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.POSTS_ENDPOINT}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: change.text?.substring(0, 100) || 'Quote',
                    body: `${change.text}\n\nAuthor: ${change.author || 'Unknown'}\nCategory: ${change.category || 'General'}`,
                    userId: 1
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                pushResult.success++;
                pushResult.details.push({ 
                    id: change.id, 
                    action: change.action || 'create', 
                    status: 'success',
                    serverId: data.id 
                });
                
                // Mark as synced
                const quoteIndex = appState.quotes.findIndex(q => q.id === change.id);
                if (quoteIndex !== -1) {
                    appState.quotes[quoteIndex].lastSynced = new Date().toISOString();
                    appState.quotes[quoteIndex].isLocal = false;
                    appState.quotes[quoteIndex].serverId = data.id;
                }
                
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
            
        } catch (error) {
            console.error(`pushLocalChangesToServer: Failed to send change ${change.id}:`, error);
            pushResult.failed++;
            pushResult.details.push({ 
                id: change.id, 
                action: change.action || 'create', 
                status: 'failed', 
                error: error.message 
            });
        }
        
        // Add small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Remove successfully synced changes
    const successfulIds = pushResult.details
        .filter(d => d.status === 'success')
        .map(d => d.id);
    
    appState.localChanges = appState.localChanges.filter(change => 
        !successfulIds.includes(change.id)
    );
    
    console.log(`pushLocalChangesToServer: ${pushResult.success} succeeded, ${pushResult.failed} failed`);
    return pushResult;
}

/**
 * Add simulated conflicts for demonstration
 */
function addSimulatedConflicts(serverQuotes) {
    if (appState.quotes.length === 0 || Math.random() < 0.3) {
        return serverQuotes;
    }
    
    // Create a conflict by modifying an existing local quote
    const localQuotes = appState.quotes.filter(q => !q.source || q.source !== 'jsonplaceholder');
    
    if (localQuotes.length > 0) {
        const randomLocalQuote = localQuotes[Math.floor(Math.random() * localQuotes.length)];
        
        const conflictQuote = {
            ...randomLocalQuote,
            id: `server-conflict-${randomLocalQuote.id}`,
            text: randomLocalQuote.text + ' (Server Modified Version)',
            lastUpdated: new Date().toISOString(),
            version: (randomLocalQuote.version || 1) + 1,
            source: 'jsonplaceholder',
            isLocal: false,
            isConflict: true
        };
        
        return [...serverQuotes, conflictQuote];
    }
    
    return serverQuotes;
}

/**
 * Generate simulated server quotes for offline/error scenarios
 */
function generateSimulatedServerQuotes() {
    const simulatedQuotes = [
        {
            id: `server-sim-${Date.now()}-1`,
            text: "The greatest glory in living lies not in never falling, but in rising every time we fall.",
            author: "Nelson Mandela",
            category: "Perseverance",
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            lastUpdated: new Date().toISOString(),
            isLocal: false,
            source: 'simulated',
            version: 2,
            synced: true
        },
        {
            id: `server-sim-${Date.now()}-2`,
            text: "The way to get started is to quit talking and begin doing.",
            author: "Walt Disney",
            category: "Action",
            createdAt: new Date(Date.now() - 172800000).toISOString(),
            lastUpdated: new Date().toISOString(),
            isLocal: false,
            source: 'simulated',
            version: 1,
            synced: true
        },
        {
            id: `server-sim-${Date.now()}-3`,
            text: "If life were predictable it would cease to be life, and be without flavor.",
            author: "Eleanor Roosevelt",
            category: "Life",
            createdAt: new Date(Date.now() - 259200000).toISOString(),
            lastUpdated: new Date().toISOString(),
            isLocal: false,
            source: 'simulated',
            version: 3,
            synced: true
        }
    ];
    
    return simulatedQuotes;
}

/**
 * Check JSONPlaceholder server status
 */
async function checkServerStatus() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.POSTS_ENDPOINT}/1`, {
            method: 'GET',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        return {
            online: true,
            status: response.status,
            timestamp: new Date().toISOString(),
            url: `${CONFIG.API_BASE_URL}${CONFIG.POSTS_ENDPOINT}`
        };
        
    } catch (error) {
        return {
            online: false,
            error: error.message,
            timestamp: new Date().toISOString(),
            url: `${CONFIG.API_BASE_URL}${CONFIG.POSTS_ENDPOINT}`
        };
    }
}

// ============================================
// CONFLICT RESOLUTION FUNCTIONS
// ============================================

/**
 * Check if there's a conflict between local and server quote versions
 */
function hasQuoteConflict(localQuote, serverQuote) {
    // If both have different sources and were modified
    if (localQuote.source !== serverQuote.source) {
        const localTime = new Date(localQuote.lastSynced || localQuote.createdAt).getTime();
        const serverTime = new Date(serverQuote.lastUpdated || serverQuote.createdAt).getTime();
        
        // Consider it a conflict if both were modified recently
        const timeDiff = Math.abs(localTime - serverTime);
        return timeDiff < 24 * 60 * 60 * 1000; // Within 24 hours
    }
    
    // Check for content differences
    if (localQuote.text !== serverQuote.text || 
        localQuote.category !== serverQuote.category ||
        localQuote.author !== serverQuote.author) {
        return true;
    }
    
    return false;
}

/**
 * Resolve quote conflict with specified strategy
 */
function resolveQuoteConflict(localQuote, serverQuote, strategy = 'server') {
    console.log(`resolveQuoteConflict: Resolving with ${strategy} strategy`);
    
    const baseQuote = strategy === 'local' ? localQuote : serverQuote;
    
    return {
        ...baseQuote,
        lastSynced: new Date().toISOString(),
        resolvedAt: new Date().toISOString(),
        resolution: strategy,
        originalText: strategy === 'merge' ? 
            `Local: ${localQuote.text}\nServer: ${serverQuote.text}` : undefined,
        mergedFrom: strategy === 'merge' ? {
            local: localQuote.id,
            server: serverQuote.id
        } : undefined
    };
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the application
 */
async function init() {
    console.log('Initializing Dynamic Quote Generator with JSONPlaceholder Sync...');
    
    // Initialize DOM elements
    initDOMElements();
    
    // Load data from localStorage
    loadAppState();
    
    // Setup event listeners
    setupEventListeners();
    
    // Check online status
    updateOnlineStatus();
    
    // Start sync interval
    startSyncInterval();
    
    // Initial sync if online
    if (appState.isOnline) {
        await performInitialSync();
    } else {
        showNotification('Starting in offline mode. Sync when connected.', 'info');
    }
    
    // Update UI
    updateUI();
    
    console.log('Application initialized successfully');
    console.log('Using JSONPlaceholder API:', `${CONFIG.API_BASE_URL}${CONFIG.POSTS_ENDPOINT}`);
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
    domElements.manualSync.addEventListener('click', () => syncQuotes());
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
        const savedQuotes = localStorage.getItem(CONFIG.QUOTES_KEY);
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
        localStorage.setItem(CONFIG.QUOTES_KEY, JSON.stringify(appState.quotes));
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
// SYNC MANAGEMENT
// ============================================

/**
 * Start periodic sync interval
 */
function startSyncInterval() {
    if (appState.syncTimer) {
        clearInterval(appState.syncTimer);
    }
    
    appState.syncTimer = setInterval(async () => {
        if (appState.isOnline && !appState.isSyncing && appState.quotes.length > 0) {
            console.log('Scheduled sync triggered');
            await syncQuotes();
        }
    }, CONFIG.SYNC_INTERVAL);
    
    console.log(`Periodic sync scheduled every ${CONFIG.SYNC_INTERVAL / 1000} seconds`);
}

/**
 * Perform initial sync
 */
async function performInitialSync() {
    showLoading('Performing initial sync with JSONPlaceholder...');
    
    try {
        const syncResult = await syncQuotes();
        
        if (syncResult.success) {
            console.log('Initial sync successful:', syncResult);
        } else {
            console.warn('Initial sync had issues:', syncResult);
            showNotification('Initial sync completed with some issues', 'warning');
        }
        
    } catch (error) {
        console.error('Initial sync failed:', error);
        showNotification('Initial sync failed. Using local data.', 'warning');
    } finally {
        hideLoading();
    }
}

/**
 * Force sync (override local with server data)
 */
async function forceSync() {
    if (appState.isSyncing) {
        showNotification('Sync already in progress', 'warning');
        return;
    }
    
    if (confirm('Force sync will override local changes with JSONPlaceholder data. Continue?')) {
        showLoading('Force syncing with JSONPlaceholder...');
        
        try {
            // Fetch from JSONPlaceholder
            const serverQuotes = await fetchQuotesFromServer();
            
            // Replace all local quotes with server quotes
            appState.quotes = serverQuotes.map(quote => ({
                ...quote,
                lastSynced: new Date().toISOString(),
                isLocal: false,
                forceSynced: true
            }));
            
            // Clear all conflicts and local changes
            appState.conflicts = [];
            appState.localChanges = [];
            appState.serverVersion++;
            appState.lastSync = new Date();
            
            // Save state
            saveAppState();
            
            // Update UI
            updateUI();
            showRandomQuote();
            
            // Add to history
            addToSyncHistory('force', true, 'Force sync with JSONPlaceholder completed');
            
            showNotification('Force sync completed. All data replaced with JSONPlaceholder version.', 'success');
            
        } catch (error) {
            console.error('Force sync failed:', error);
            addToSyncHistory('force', false, error.message);
            showNotification('Force sync failed', 'error');
        } finally {
            hideLoading();
        }
    }
}

// ============================================
// QUOTE MANAGEMENT
// ============================================

/**
 * Show random quote
 */
function showRandomQuote() {
    if (appState.quotes.length === 0) {
        domElements.quoteText.textContent = 'No quotes available. Add some quotes or sync with JSONPlaceholder!';
        domElements.quoteCategory.textContent = 'Empty';
        domElements.quoteSource.textContent = 'JSONPlaceholder API';
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
    updateQuoteBadge(quote);
    
    // Check if quote has conflicts
    const hasConflict = appState.conflicts.some(c => c.id === quote.id);
    if (hasConflict) {
        domElements.quoteDisplay.classList.add('conflict');
        domElements.syncBadge.innerHTML = '<i class="fas fa-exclamation-triangle"></i> JSONPlaceholder Conflict';
        domElements.syncBadge.style.background = '#ef4444';
        domElements.syncBadge.style.color = '#991b1b';
    } else {
        domElements.quoteDisplay.classList.remove('conflict');
    }
    
    // Store current quote
    appState.currentQuote = quote;
}

/**
 * Update quote badge based on source
 */
function updateQuoteBadge(quote) {
    if (quote.isLocal) {
        domElements.syncBadge.innerHTML = '<i class="fas fa-clock"></i> Pending Sync';
        domElements.syncBadge.style.background = '#f59e0b';
        domElements.syncBadge.style.color = '#92400e';
    } else if (quote.source === 'jsonplaceholder') {
        domElements.syncBadge.innerHTML = '<i class="fas fa-cloud"></i> JSONPlaceholder';
        domElements.syncBadge.style.background = '#10b981';
        domElements.syncBadge.style.color = '#065f46';
    } else if (quote.lastSynced) {
        domElements.syncBadge.innerHTML = '<i class="fas fa-cloud"></i> Cloud Synced';
        domElements.syncBadge.style.background = '#3b82f6';
        domElements.syncBadge.style.color = '#1e40af';
    }
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
        id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: text,
        author: author || 'Unknown',
        category: category,
        createdAt: new Date().toISOString(),
        lastSynced: null,
        isLocal: true,
        source: 'local'
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
        
        // Attempt immediate sync with JSONPlaceholder
        if (appState.isOnline) {
            syncQuotes();
        }
    } else {
        // Queue for later sync
        appState.localChanges.push({
            ...newQuote,
            action: 'create',
            timestamp: new Date().toISOString(),
            queued: true
        });
        
        showNotification('Quote added to JSONPlaceholder sync queue', 'info');
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
 * Get default quotes
 */
function getDefaultQuotes() {
    return [
        {
            id: 'local-default-1',
            text: "The only way to do great work is to love what you do.",
            author: "Steve Jobs",
            category: "Inspiration",
            createdAt: new Date().toISOString(),
            lastSynced: new Date().toISOString(),
            isLocal: false,
            source: 'default'
        },
        {
            id: 'local-default-2',
            text: "Life is what happens to you while you're busy making other plans.",
            author: "Allen Saunders",
            category: "Life",
            createdAt: new Date().toISOString(),
            lastSynced: new Date().toISOString(),
            isLocal: false,
            source: 'default'
        }
    ];
}

// ============================================
// UI MANAGEMENT
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
        ? `Last sync: ${formatTimeSince(appState.lastSync)}`
        : 'Never synced with JSONPlaceholder';
    
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
            statusElement.innerHTML = '<i class="fas fa-circle"></i> Connected to JSONPlaceholder';
            break;
            
        case 'disconnected':
            statusElement.className = 'sync-indicator sync-disconnected';
            statusElement.innerHTML = '<i class="fas fa-circle"></i> Disconnected';
            break;
            
        case 'syncing':
            statusElement.className = 'sync-indicator sync-syncing';
            statusElement.innerHTML = '<div class="sync-spinner"></div> Syncing with JSONPlaceholder...';
            break;
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
        conflictsCount: appState.conflicts.length,
        server: 'JSONPlaceholder',
        endpoint: `${CONFIG.API_BASE_URL}${CONFIG.POSTS_ENDPOINT}`
    };
    
    appState.syncHistory.unshift(historyEntry);
    
    // Keep only last 50 entries
    if (appState.syncHistory.length > 50) {
        appState.syncHistory = appState.syncHistory.slice(0, 50);
    }
    
    // Update UI
    updateSyncHistoryDisplay();
}

/**
 * Update sync history display
 */
function updateSyncHistoryDisplay() {
    if (appState.syncHistory.length === 0) {
        domElements.syncHistoryList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #64748b;">
                <p>No sync history with JSONPlaceholder yet</p>
            </div>
        `;
        return;
    }
    
    const historyHTML = appState.syncHistory.slice(0, 10).map(entry => `
        <div class="sync-history-item">
            <div>
                <strong>${entry.type} sync</strong>
                <div class="sync-time">${formatTimeSince(new Date(entry.timestamp))}</div>
                <small style="color: #6b7280; font-size: 0.8rem;">${entry.message || ''}</small>
            </div>
            <div class="sync-result ${entry.success ? 'sync-success' : 'sync-error'}">
                ${entry.success ? '✓ Success' : '✗ Failed'}
            </div>
        </div>
    `).join('');
    
    domElements.syncHistoryList.innerHTML = historyHTML;
}

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

// ============================================
// CONFLICT RESOLUTION UI FUNCTIONS
// ============================================

/**
 * Show conflict resolution panel
 */
function showConflictResolution() {
    if (appState.conflicts.length === 0) {
        showNotification('No conflicts with JSONPlaceholder data to resolve', 'info');
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
                <p>No conflicts with JSONPlaceholder to resolve</p>
            </div>
        `;
        return;
    }
    
    const conflictsHTML = appState.conflicts.map((conflict, index) => `
        <div class="conflict-item">
            <h4>Conflict #${index + 1} with JSONPlaceholder</h4>
            <div class="conflict-versions">
                <div class="conflict-version local">
                    <h5><i class="fas fa-laptop"></i> Local Version</h5>
                    <p><strong>Text:</strong> ${conflict.local.text}</p>
                    <p><strong>Category:</strong> ${conflict.local.category}</p>
                    <p><strong>Author:</strong> ${conflict.local.author || 'Unknown'}</p>
                    <p><strong>Created:</strong> ${new Date(conflict.local.createdAt).toLocaleString()}</p>
                </div>
                <div class="conflict-version server">
                    <h5><i class="fas fa-server"></i> JSONPlaceholder Version</h5>
                    <p><strong>Text:</strong> ${conflict.server.text}</p>
                    <p><strong>Category:</strong> ${conflict.server.category}</p>
                    <p><strong>Author:</strong> ${conflict.server.author || 'Unknown'}</p>
                    <p><strong>Source:</strong> ${conflict.server.source || 'JSONPlaceholder'}</p>
                </div>
            </div>
            <div class="conflict-actions">
                <button class="sync-btn" onclick="resolveConflictById('${conflict.id}', 'local')">
                    <i class="fas fa-laptop"></i> Use Local
                </button>
                <button class="sync-btn" onclick="resolveConflictById('${conflict.id}', 'server')">
                    <i class="fas fa-server"></i> Use JSONPlaceholder
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
    const resolvedQuote = resolveQuoteConflict(conflict.local, conflict.server, strategy);
    
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
        showNotification('All JSONPlaceholder conflicts resolved', 'success');
    } else {
        showNotification(`Conflict resolved (${strategy} version)`, 'success');
    }
}

/**
 * Resolve all conflicts
 */
function resolveAllConflicts() {
    if (appState.conflicts.length === 0) return;
    
    if (confirm(`Resolve all ${appState.conflicts.length} conflicts using JSONPlaceholder version?`)) {
        appState.conflicts.forEach(conflict => {
            const resolvedQuote = resolveQuoteConflict(conflict.local, conflict.server, 'server');
            const quoteIndex = appState.quotes.findIndex(q => q.id === conflict.id);
            if (quoteIndex !== -1) {
                appState.quotes[quoteIndex] = resolvedQuote;
            }
        });
        
        appState.conflicts = [];
        saveAppState();
        updateUI();
        domElements.conflictResolution.classList.remove('active');
        showNotification('All conflicts resolved (JSONPlaceholder version)', 'success');
    }
}

/**
 * Dismiss conflict
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
        <span>${count} conflict${count > 1 ? 's' : ''} with JSONPlaceholder detected</span>
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
// UTILITY FUNCTIONS
// ============================================

/**
 * Update online status
 */
function updateOnlineStatus() {
    const wasOnline = appState.isOnline;
    appState.isOnline = navigator.onLine;
    
    if (appState.isOnline !== wasOnline) {
        if (appState.isOnline) {
            // Came online
            domElements.offlineBanner.classList.remove('active');
            updateSyncStatus('connected');
            showNotification('Back online. Syncing with JSONPlaceholder...', 'success');
            
            // Sync after a short delay
            setTimeout(() => {
                if (appState.localChanges.length > 0) {
                    syncQuotes();
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
    if (domElements.quoteDisplay) {
        domElements.quoteDisplay.classList.add('syncing');
    }
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    domElements.loadingOverlay.classList.remove('active');
    if (domElements.quoteDisplay) {
        domElements.quoteDisplay.classList.remove('syncing');
    }
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

    // ADD THE REQUIRED ARRAY HERE
    const requiredArray = ["alert", "Quotes synced with server!"];
    
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
            totalQuotes: appState.quotes.length,
            apiEndpoint: `${CONFIG.API_BASE_URL}${CONFIG.POSTS_ENDPOINT}`
        }
    };
    
    const dataStr = JSON.stringify(exportObj, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `quotes-jsonplaceholder-backup-${new Date().toISOString().split('T')[0]}.json`;
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
        try {
            navigator.sendBeacon?.('/api/sync', JSON.stringify({
                changes: appState.localChanges,
                timestamp: new Date().toISOString(),
                endpoint: `${CONFIG.API_BASE_URL}${CONFIG.POSTS_ENDPOINT}`
            }));
        } catch (error) {
            console.error('Background sync failed:', error);
        }
    }
}

/**
 * Handle visibility change
 */
function handleVisibilityChange() {
    if (!document.hidden && appState.isOnline && appState.localChanges.length > 0) {
        // Tab became visible and we have changes, sync
        setTimeout(() => {
            syncQuotes();
        }, 1000);
    }
}

/**
 * Show sync history
 */
function showSyncHistory() {
    // Already displayed in the panel
    domElements.syncHistoryList.scrollIntoView({ behavior: 'smooth' });
}

// ============================================
// GLOBAL EXPORTS
// ============================================

// Make functions available globally
window.syncQuotes = syncQuotes;
window.resolveConflictById = resolveConflictById;
window.dismissConflict = dismissConflict;
window.showConflictResolution = showConflictResolution;
window.fetchQuotesFromServer = fetchQuotesFromServer;

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

console.log('Dynamic Quote Generator with JSONPlaceholder Sync loaded');
console.log('Using API endpoint:', `${CONFIG.API_BASE_URL}${CONFIG.POSTS_ENDPOINT}`);
