// ============================================
// DYNAMIC QUOTE GENERATOR WITH SERVER SYNC
// ============================================

// Configuration
const CONFIG = {
    // JSONPlaceholder API endpoints
    API_BASE_URL: 'https://jsonplaceholder.typicode.com',
    POSTS_ENDPOINT: '/posts', // This is the required endpoint
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
        // Add timeout for the fetch request
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
        const serverQuotes = await transformPostsToQuotes(posts.slice(0, 20)); // Limit to 20 for demo
        
        // Simulate server conflicts for demonstration
        const quotesWithConflicts = addSimulatedConflicts(serverQuotes);
        
        console.log(`fetchQuotesFromServer: Transformed to ${quotesWithConflicts.length} quotes`);
        
        // Add to sync history
        addToSyncHistory('fetch', true, `Fetched ${quotesWithConflicts.length} quotes from server`);
        
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
            'Motivation', 'Philosophy', 'Humor', 'Love'
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
                postId: post.id
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
            postId: post.id
        }));
    }
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
 * Send quotes to JSONPlaceholder server (simulated)
 */
async function sendQuotesToServer(quotesToSend) {
    console.log(`sendQuotesToServer: Attempting to send ${quotesToSend.length} quotes`);
    
    showLoading('Sending quotes to server...');
    
    const results = {
        success: 0,
        failed: 0,
        details: []
    };
    
    try {
        // JSONPlaceholder is a read-only API, so we simulate sending
        for (const quote of quotesToSend) {
            try {
                // Simulate API call to JSONPlaceholder
                const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.POSTS_ENDPOINT}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        title: quote.text.substring(0, 100),
                        body: `${quote.text}\n\n- ${quote.author} (${quote.category})`,
                        userId: 1
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    results.success++;
                    results.details.push({
                        id: quote.id,
                        status: 'success',
                        serverId: data.id
                    });
                    
                    // Mark as synced
                    const quoteIndex = appState.quotes.findIndex(q => q.id === quote.id);
                    if (quoteIndex !== -1) {
                        appState.quotes[quoteIndex].lastSynced = new Date().toISOString();
                        appState.quotes[quoteIndex].isLocal = false;
                        appState.quotes[quoteIndex].serverId = data.id;
                    }
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
                
            } catch (error) {
                console.error(`Failed to send quote ${quote.id}:`, error);
                results.failed++;
                results.details.push({
                    id: quote.id,
                    status: 'failed',
                    error: error.message
                });
            }
            
            // Add small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log(`sendQuotesToServer: ${results.success} succeeded, ${results.failed} failed`);
        
        // Add to sync history
        addToSyncHistory('send', results.success > 0, 
            `Sent ${results.success}/${quotesToSend.length} quotes to server`);
        
        return results;
        
    } catch (error) {
        console.error('sendQuotesToServer: General error:', error);
        
        // Add to sync history
        addToSyncHistory('send', false, error.message);
        
        throw error;
        
    } finally {
        hideLoading();
    }
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
            version: 2
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
            version: 1
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
            version: 3
        },
        {
            id: `server-sim-${Date.now()}-4`,
            text: "Life is what happens when you're busy making other plans.",
            author: "John Lennon",
            category: "Life",
            createdAt: new Date(Date.now() - 345600000).toISOString(),
            lastUpdated: new Date().toISOString(),
            isLocal: false,
            source: 'simulated',
            version: 1
        },
        {
            id: `server-sim-${Date.now()}-5`,
            text: "The future belongs to those who believe in the beauty of their dreams.",
            author: "Eleanor Roosevelt",
            category: "Dreams",
            createdAt: new Date(Date.now() - 432000000).toISOString(),
            lastUpdated: new Date().toISOString(),
            isLocal: false,
            source: 'simulated',
            version: 2
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
    
    // Start sync interval
    startSyncInterval();
    
    // Check online status
    updateOnlineStatus();
    
    // Initial sync with JSONPlaceholder
    await performInitialJSONPlaceholderSync();
    
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

// ============================================
// SERVER SYNC FUNCTIONS
// ============================================

/**
 * Perform initial sync with JSONPlaceholder
 */
async function performInitialJSONPlaceholderSync() {
    showLoading('Connecting to JSONPlaceholder API...');
    
    try {
        // Check server status
        const serverStatus = await checkServerStatus();
        
        if (serverStatus.online) {
            console.log('JSONPlaceholder server is online:', serverStatus.url);
            
            // Fetch quotes from JSONPlaceholder
            const serverQuotes = await fetchQuotesFromServer();
            
            if (serverQuotes.length > 0) {
                // Merge with local quotes
                await mergeData(serverQuotes);
                
                // Update server version
                appState.serverVersion++;
                appState.lastSync = new Date();
                
                // Save app state
                saveAppState();
                
                // Add to sync history
                addToSyncHistory('initial', true, 
                    `Initial sync with JSONPlaceholder completed. Received ${serverQuotes.length} quotes.`);
                
                showNotification(`Connected to JSONPlaceholder API. Loaded ${serverQuotes.length} quotes.`, 'success');
            }
        } else {
            console.log('JSONPlaceholder server is offline');
            addToSyncHistory('initial', false, 'JSONPlaceholder server unavailable');
            showNotification('JSONPlaceholder API unavailable. Working in offline mode.', 'warning');
        }
        
    } catch (error) {
        console.error('Initial JSONPlaceholder sync failed:', error);
        addToSyncHistory('initial', false, error.message);
        showNotification('Could not connect to JSONPlaceholder API. Working offline.', 'warning');
    } finally {
        hideLoading();
    }
}

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
        showLoading('Forcing sync with JSONPlaceholder...');
        
        try {
            // Fetch from JSONPlaceholder
            const serverQuotes = await fetchQuotesFromServer();
            
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
            addToSyncHistory('force', true, 'Force sync with JSONPlaceholder completed');
            
            // Update UI
            updateUI();
            showRandomQuote();
            
            showNotification('Force sync with JSONPlaceholder completed', 'success');
            
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
 * Main sync function with JSONPlaceholder
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
        showLoading('Syncing with JSONPlaceholder...');
        
        // 1. Check server status
        const serverStatus = await checkServerStatus();
        if (!serverStatus.online) {
            throw new Error('JSONPlaceholder server is not reachable');
        }
        
        // 2. Push local changes to server
        if (appState.localChanges.length > 0) {
            await pushLocalChanges();
        }
        
        // 3. Fetch updates from JSONPlaceholder
        const serverQuotes = await fetchQuotesFromServer();
        
        // 4. Merge data and resolve conflicts
        await mergeData(serverQuotes);
        
        // 5. Update sync timestamp
        appState.lastSync = new Date();
        appState.serverVersion++;
        
        // 6. Save state
        saveAppState();
        
        // 7. Update UI
        updateUI();
        
        // 8. Add to history
        addToSyncHistory('auto', true, 'Sync with JSONPlaceholder completed');
        
        showNotification('Sync with JSONPlaceholder completed', 'success');
        
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
    
    console.log(`Pushing ${appState.localChanges.length} local changes to JSONPlaceholder`);
    
    const results = await sendQuotesToServer(appState.localChanges);
    
    // Remove successfully synced changes
    const successfulIds = results.details
        .filter(d => d.status === 'success')
        .map(d => d.id);
    
    appState.localChanges = appState.localChanges.filter(change => 
        !successfulIds.includes(change.id)
    );
    
    console.log(`Successfully pushed ${successfulIds.length} changes to JSONPlaceholder`);
}

/**
 * Merge server data with local data
 */
async function mergeData(serverQuotes) {
    console.log('Merging JSONPlaceholder data with local data...');
    
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
                
                // Server wins by default for JSONPlaceholder data
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
        console.log(`Found ${newConflicts.length} new conflicts with JSONPlaceholder data`);
        
        // Show conflict notification
        if (newConflicts.length > 0) {
            showConflictNotification(newConflicts.length);
        }
    }
}

// ============================================
// CONFLICT RESOLUTION FUNCTIONS
// ============================================

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
            // Server wins (JSONPlaceholder data)
            return {
                ...serverQuote,
                lastSynced: new Date().toISOString(),
                resolvedAt: new Date().toISOString(),
                resolution: 'server',
                source: 'jsonplaceholder'
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
            // Merge both (prefer server for JSONPlaceholder)
            return {
                ...serverQuote,
                text: localQuote.text !== serverQuote.text ? 
                    `${serverQuote.text} (merged: ${localQuote.text.substring(0, 50)}...)` : serverQuote.text,
                lastSynced: new Date().toISOString(),
                resolvedAt: new Date().toISOString(),
                resolution: 'merge'
            };
            
        default:
            return serverQuote;
    }
}

// ============================================
// QUOTE MANAGEMENT FUNCTIONS
// ============================================

/**
 * Show random quote
 */
function showRandomQuote() {
    if (appState.quotes.length === 0) {
        domElements.quoteText.textContent = 'No quotes available. Add some quotes or sync with server!';
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
// UI MANAGEMENT FUNCTIONS
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
        server: 'JSONPlaceholder'
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
                <small>${entry.message || ''}</small>
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
        showNotification('All conflicts resolved (JSONPlaceholder version)', 'success');
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
        
        saveAppState();
        updateUI();
        showRandomQuote();
        showNotification('All data cleared', 'warning');
    }
}

// ============================================
// GLOBAL EXPORTS
// ============================================

// Make functions available globally
window.resolveConflictById = resolveConflictById;
window.dismissConflict = dismissConflict;
window.showConflictResolution = showConflictResolution;
window.fetchQuotesFromServer = fetchQuotesFromServer;

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

console.log('Dynamic Quote Generator with JSONPlaceholder Sync loaded');
console.log('Using API endpoint:', `${CONFIG.API_BASE_URL}${CONFIG.POSTS_ENDPOINT}`);
