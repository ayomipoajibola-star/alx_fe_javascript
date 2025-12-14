// ============================================
// SYNC MANAGEMENT FUNCTIONS
// ============================================

/**
 * Main sync function that coordinates synchronization between local and server data
 * This function handles the complete sync process including fetching, merging, and conflict resolution
 */
async function syncQuotes() {
    console.log('syncQuotes: Starting complete quote synchronization...');
    
    if (!appState.isOnline) {
        showNotification('Cannot sync while offline. Please check your internet connection.', 'warning');
        return { success: false, message: 'Offline' };
    }
    
    if (appState.isSyncing) {
        showNotification('Sync already in progress. Please wait...', 'info');
        return { success: false, message: 'Already syncing' };
    }
    
    appState.isSyncing = true;
    updateSyncStatus('syncing');
    
    const syncResult = {
        success: false,
        message: '',
        newQuotes: 0,
        updatedQuotes: 0,
        conflicts: 0,
        errors: []
    };
    
    try {
        showLoading('Starting quote synchronization...');
        
        // 1. Check server connectivity
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
            showLoading('Pushing local changes to server...');
            const pushResult = await pushLocalChanges();
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
        syncResult.message = `Sync completed: ${syncResult.newQuotes} new, ${syncResult.updatedQuotes} updated`;
        
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

/**
 * Push local changes to server
 */
async function pushLocalChanges() {
    if (appState.localChanges.length === 0) {
        return { success: 0, failed: 0, total: 0 };
    }
    
    console.log(`pushLocalChanges: Pushing ${appState.localChanges.length} local changes`);
    
    const pushResult = {
        success: 0,
        failed: 0,
        total: appState.localChanges.length,
        details: []
    };
    
    // Group changes by type for batch processing
    const creates = appState.localChanges.filter(c => c.action === 'create');
    const updates = appState.localChanges.filter(c => c.action === 'update');
    const deletes = appState.localChanges.filter(c => c.action === 'delete');
    
    // Process creates
    for (const change of creates) {
        try {
            await sendQuoteToServer(change, 'POST');
            pushResult.success++;
            pushResult.details.push({ id: change.id, action: 'create', status: 'success' });
            
            // Mark as synced
            const quoteIndex = appState.quotes.findIndex(q => q.id === change.id);
            if (quoteIndex !== -1) {
                appState.quotes[quoteIndex].lastSynced = new Date().toISOString();
                appState.quotes[quoteIndex].isLocal = false;
            }
            
        } catch (error) {
            pushResult.failed++;
            pushResult.details.push({ 
                id: change.id, 
                action: 'create', 
                status: 'failed', 
                error: error.message 
            });
        }
    }
    
    // Process updates
    for (const change of updates) {
        try {
            await sendQuoteToServer(change, 'PUT');
            pushResult.success++;
            pushResult.details.push({ id: change.id, action: 'update', status: 'success' });
            
            // Mark as synced
            const quoteIndex = appState.quotes.findIndex(q => q.id === change.id);
            if (quoteIndex !== -1) {
                appState.quotes[quoteIndex].lastSynced = new Date().toISOString();
            }
            
        } catch (error) {
            pushResult.failed++;
            pushResult.details.push({ 
                id: change.id, 
                action: 'update', 
                status: 'failed', 
                error: error.message 
            });
        }
    }
    
    // Process deletes
    for (const change of deletes) {
        try {
            await sendQuoteToServer(change, 'DELETE');
            pushResult.success++;
            pushResult.details.push({ id: change.id, action: 'delete', status: 'success' });
            
            // Remove from local quotes
            appState.quotes = appState.quotes.filter(q => q.id !== change.id);
            
        } catch (error) {
            pushResult.failed++;
            pushResult.details.push({ 
                id: change.id, 
                action: 'delete', 
                status: 'failed', 
                error: error.message 
            });
        }
    }
    
    // Remove successfully synced changes
    const successfulIds = pushResult.details
        .filter(d => d.status === 'success')
        .map(d => d.id);
    
    appState.localChanges = appState.localChanges.filter(change => 
        !successfulIds.includes(change.id)
    );
    
    console.log(`pushLocalChanges: ${pushResult.success} succeeded, ${pushResult.failed} failed`);
    return pushResult;
}

/**
 * Send single quote to server
 */
async function sendQuoteToServer(quote, method = 'POST') {
    try {
        // For JSONPlaceholder, we can only simulate since it's read-only
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.POSTS_ENDPOINT}`, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title: quote.text?.substring(0, 100) || 'Quote',
                body: `${quote.text}\n\nAuthor: ${quote.author || 'Unknown'}\nCategory: ${quote.category || 'General'}`,
                userId: 1
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return { success: true, data };
        
    } catch (error) {
        console.error(`sendQuoteToServer: Failed to send quote ${quote.id}:`, error);
        throw error;
    }
}

/**
 * Schedule periodic sync
 */
function schedulePeriodicSync() {
    // Clear any existing timer
    if (appState.syncTimer) {
        clearInterval(appState.syncTimer);
    }
    
    // Schedule new sync interval
    appState.syncTimer = setInterval(async () => {
        if (appState.isOnline && !appState.isSyncing && appState.quotes.length > 0) {
            console.log('Scheduled sync triggered');
            await syncQuotes();
        }
    }, CONFIG.SYNC_INTERVAL);
    
    console.log(`Periodic sync scheduled every ${CONFIG.SYNC_INTERVAL / 1000} seconds`);
}

/**
 * Manual sync trigger
 */
async function manualSync() {
    if (appState.isSyncing) {
        showNotification('Sync already in progress', 'warning');
        return;
    }
    
    const result = await syncQuotes();
    
    if (result.success) {
        // Update last sync time display
        const lastSyncElement = document.getElementById('lastSyncTime');
        if (lastSyncElement) {
            lastSyncElement.textContent = `Last sync: ${formatTimeSince(new Date())}`;
        }
    }
}

/**
 * Force sync with conflict resolution
 */
async function forceSyncWithResolution() {
    if (appState.isSyncing) {
        showNotification('Sync already in progress', 'warning');
        return;
    }
    
    if (confirm('Force sync will override all local conflicts with server data. Continue?')) {
        showLoading('Force syncing with conflict resolution...');
        
        try {
            // Fetch from server
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
            addToSyncHistory('force', true, 'Force sync completed');
            
            showNotification('Force sync completed. All data replaced with server version.', 'success');
            
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
// UPDATED INITIALIZATION WITH SYNC
// ============================================

/**
 * Initialize the application with sync capabilities
 */
async function init() {
    console.log('Initializing Dynamic Quote Generator with Sync...');
    
    // Initialize DOM elements
    initDOMElements();
    
    // Load data from localStorage
    loadAppState();
    
    // Setup event listeners
    setupEventListeners();
    
    // Check online status
    updateOnlineStatus();
    
    // Schedule periodic sync
    schedulePeriodicSync();
    
    // Initial sync if online
    if (appState.isOnline) {
        await performInitialSync();
    } else {
        showNotification('Starting in offline mode. Sync when connected.', 'info');
    }
    
    // Update UI
    updateUI();
    
    console.log('Application initialized with sync capabilities');
}

/**
 * Perform initial sync
 */
async function performInitialSync() {
    showLoading('Performing initial sync...');
    
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

// ============================================
// UPDATED EVENT LISTENERS FOR SYNC
// ============================================

/**
 * Setup event listeners with sync controls
 */
function setupEventListeners() {
    // Existing event listeners...
    
    // Sync controls
    domElements.manualSync.addEventListener('click', manualSync);
    domElements.forceSync.addEventListener('click', forceSyncWithResolution);
    
    // Add sync button to header if it exists
    const quickSyncBtn = document.getElementById('quickSync');
    if (quickSyncBtn) {
        quickSyncBtn.addEventListener('click', async () => {
            await syncQuotes();
        });
    }
    
    // Sync on network reconnection
    window.addEventListener('online', async () => {
        updateOnlineStatus();
        if (appState.localChanges.length > 0) {
            showNotification('Back online. Syncing changes...', 'info');
            await syncQuotes();
        }
    });
}

// ============================================
// GLOBAL EXPORTS
// ============================================

// Make sync functions available globally
window.syncQuotes = syncQuotes;
window.manualSync = manualSync;
window.forceSyncWithResolution = forceSyncWithResolution;
window.schedulePeriodicSync = schedulePeriodicSync;

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

console.log('Dynamic Quote Generator with Sync loaded');
