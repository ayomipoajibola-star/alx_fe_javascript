// ============================================
// UPDATED SYNC FUNCTION WITH ALERT
// ============================================

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
        
        // Show success notification - USING ALERT AS REQUIRED
        showSyncSuccessAlert(syncResult);
        
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
 * Show sync success alert
 */
function showSyncSuccessAlert(syncResult) {
    let alertMessage = 'Quotes synced with server!\n\n';
    
    if (syncResult.newQuotes > 0) {
        alertMessage += `✓ Added ${syncResult.newQuotes} new quotes from server\n`;
    }
    
    if (syncResult.updatedQuotes > 0) {
        alertMessage += `✓ Updated ${syncResult.updatedQuotes} existing quotes\n`;
    }
    
    if (syncResult.conflicts > 0) {
        alertMessage += `⚠ Found ${syncResult.conflicts} conflicts (resolved with server version)\n`;
    }
    
    alertMessage += `\nTotal quotes: ${appState.quotes.length}\n`;
    alertMessage += `Last sync: ${new Date().toLocaleTimeString()}`;
    
    // Show alert dialog
    alert(alertMessage);
    
    // Also show a notification for better UX
    let notificationMessage = 'Quotes synced with server!';
    if (syncResult.newQuotes > 0) {
        notificationMessage += ` Added ${syncResult.newQuotes} new quotes.`;
    }
    
    showNotification(notificationMessage, 'success');
}

// ============================================
// ADDITIONAL ALERT FUNCTIONS FOR USER FEEDBACK
// ============================================

/**
 * Alert for conflict resolution
 */
function showConflictAlert(conflictCount) {
    if (conflictCount > 0) {
        alert(`⚠ ${conflictCount} conflicts detected!\n\nPlease review and resolve conflicts in the Conflict Resolution panel.`);
    }
}

/**
 * Alert for offline mode
 */
function showOfflineAlert() {
    if (!appState.isOnline) {
        alert('⚠ You are currently offline!\n\nYour changes will be queued and synced when you reconnect to the internet.');
    }
}

/**
 * Alert for data export
 */
function showExportAlert(quoteCount) {
    alert(`✅ Data exported successfully!\n\nExported ${quoteCount} quotes to JSON file.\n\nFile includes:\n- All quotes\n- Sync history\n- Conflict resolutions\n- Local changes`);
}

/**
 * Alert for data import
 */
function showImportAlert(importedCount) {
    alert(`✅ Data imported successfully!\n\nImported ${importedCount} quotes from JSON file.\n\nNext steps:\n1. Review imported quotes\n2. Sync with server if needed\n3. Resolve any conflicts`);
}

/**
 * Alert for force sync confirmation
 */
function showForceSyncAlert() {
    const confirmed = confirm('⚠ FORCE SYNC WARNING!\n\nThis will:\n1. Replace ALL local quotes with server data\n2. Clear ALL pending changes\n3. Override ALL conflicts with server version\n\nAre you sure you want to continue?');
    
    if (confirmed) {
        alert('Force sync initiated...\n\nAll local data will be replaced with server data.');
        return true;
    }
    return false;
}

/**
 * Alert for clear all data confirmation
 */
function showClearDataAlert() {
    const confirmed = confirm('⚠ DANGER: Clear All Data!\n\nThis will:\n1. Delete ALL quotes\n2. Clear ALL sync history\n3. Remove ALL conflicts\n4. Reset to default quotes\n\nTHIS ACTION CANNOT BE UNDONE!\n\nAre you absolutely sure?');
    
    if (confirmed) {
        alert('All data will be cleared. This action cannot be undone!');
        return true;
    }
    return false;
}

// ============================================
// UPDATED SYNC CONTROL FUNCTIONS WITH ALERTS
// ============================================

/**
 * Manual sync trigger with alert
 */
async function manualSyncWithAlert() {
    if (appState.isSyncing) {
        showNotification('Sync already in progress', 'warning');
        return;
    }
    
    const confirmed = confirm('Start manual sync with JSONPlaceholder server?\n\nThis will:\n1. Fetch new quotes from server\n2. Upload your local changes\n3. Merge and resolve conflicts\n\nProceed?');
    
    if (confirmed) {
        alert('Starting manual sync with server...');
        const result = await syncQuotes();
        
        if (result.success) {
            // Update last sync time display
            const lastSyncElement = document.getElementById('lastSyncTime');
            if (lastSyncElement) {
                lastSyncElement.textContent = `Last sync: ${formatTimeSince(new Date())}`;
            }
        }
    }
}

/**
 * Force sync with alert confirmation
 */
async function forceSync() {
    if (appState.isSyncing) {
        showNotification('Sync already in progress', 'warning');
        return;
    }
    
    if (showForceSyncAlert()) {
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
            
            // Show success alert
            alert('✅ Force sync completed!\n\nAll local data has been replaced with server data from JSONPlaceholder.');
            
        } catch (error) {
            console.error('Force sync failed:', error);
            addToSyncHistory('force', false, error.message);
            alert(`❌ Force sync failed!\n\nError: ${error.message}\n\nPlease check your internet connection and try again.`);
        } finally {
            hideLoading();
        }
    }
}

/**
 * Export data with alert
 */
function exportData() {
    const confirmed = confirm('Export all data to JSON file?\n\nThis will include:\n- All quotes (local and server)\n- Sync history\n- Conflicts\n- Local changes\n\nProceed?');
    
    if (confirmed) {
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
        
        showExportAlert(appState.quotes.length);
    }
}

/**
 * Clear all data with alert
 */
function clearAllData() {
    if (showClearDataAlert()) {
        resetAppState();
        saveAppState();
        updateUI();
        showRandomQuote();
        alert('✅ All data cleared!\n\nThe application has been reset to default state.');
    }
}

// ============================================
// UPDATED EVENT LISTENERS WITH ALERT SUPPORT
// ============================================

/**
 * Setup event listeners with alert support
 */
function setupEventListeners() {
    // Quote controls
    domElements.newQuoteBtn.addEventListener('click', showRandomQuote);
    domElements.toggleForm.addEventListener('click', toggleAddQuoteForm);
    domElements.exportData.addEventListener('click', exportData);
    domElements.clearData.addEventListener('click', clearAllData);
    
    // Sync controls - using manual sync with alert
    domElements.manualSync.addEventListener('click', manualSyncWithAlert);
    domElements.viewConflicts.addEventListener('click', showConflictResolution);
    domElements.syncHistory.addEventListener('click', showSyncHistory);
    domElements.forceSync.addEventListener('click', forceSync);
    
    // Conflict resolution
    domElements.resolveAllConflicts.addEventListener('click', resolveAllConflicts);
    domElements.dismissConflicts.addEventListener('click', dismissConflicts);
    
    // Form controls
    domElements.addQuoteBtn.addEventListener('click', addQuote);
    domElements.cancelAddBtn.addEventListener('click', toggleAddQuoteForm);
    
    // Online/offline detection with alert
    window.addEventListener('online', () => {
        updateOnlineStatus();
        if (appState.localChanges.length > 0) {
            alert('🌐 Back online!\n\nYou have pending changes that will be synced automatically.');
            setTimeout(() => {
                syncQuotes();
            }, 2000);
        }
    });
    
    window.addEventListener('offline', () => {
        updateOnlineStatus();
        showOfflineAlert();
    });
    
    // Before unload - attempt to sync
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Visibility change - sync when tab becomes visible
    document.addEventListener('visibilitychange', handleVisibilityChange);
}

// ============================================
// INITIALIZATION WITH ALERT
// ============================================

/**
 * Initialize the application with welcome alert
 */
async function init() {
    console.log('Initializing Dynamic Quote Generator with JSONPlaceholder Sync...');
    
    // Show welcome alert
    alert('🌟 Welcome to Dynamic Quote Generator!\n\nThis app features:\n1. Real-time sync with JSONPlaceholder API\n2. Conflict resolution system\n3. Offline support with queued changes\n4. Data import/export capabilities\n\nClick "Sync Now" to start!');
    
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
        showOfflineAlert();
    }
    
    // Update UI
    updateUI();
    
    console.log('Application initialized successfully');
    console.log('Using JSONPlaceholder API:', `${CONFIG.API_BASE_URL}${CONFIG.POSTS_ENDPOINT}`);
}

/**
 * Perform initial sync with alert
 */
async function performInitialSync() {
    showLoading('Performing initial sync with JSONPlaceholder...');
    
    try {
        const syncResult = await syncQuotes();
        
        if (syncResult.success) {
            console.log('Initial sync successful:', syncResult);
        } else {
            console.warn('Initial sync had issues:', syncResult);
            alert('⚠ Initial sync completed with some issues\n\nSome data may not have synced correctly. Check the sync history for details.');
        }
        
    } catch (error) {
        console.error('Initial sync failed:', error);
        alert('❌ Initial sync failed!\n\nUnable to connect to JSONPlaceholder server.\n\nYou can:\n1. Check your internet connection\n2. Try syncing manually later\n3. Work in offline mode\n\nError: ' + error.message);
    } finally {
        hideLoading();
    }
}

// ============================================
// GLOBAL EXPORTS WITH ALERT FUNCTIONS
// ============================================

// Make functions available globally
window.syncQuotes = syncQuotes;
window.manualSyncWithAlert = manualSyncWithAlert;
window.forceSync = forceSync;
window.resolveConflictById = resolveConflictById;
window.dismissConflict = dismissConflict;
window.showConflictResolution = showConflictResolution;
window.fetchQuotesFromServer = fetchQuotesFromServer;
window.showSyncSuccessAlert = showSyncSuccessAlert;

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

console.log('Dynamic Quote Generator with JSONPlaceholder Sync loaded');
console.log('Using API endpoint:', `${CONFIG.API_BASE_URL}${CONFIG.POSTS_ENDPOINT}`);
