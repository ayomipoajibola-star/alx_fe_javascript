// ============================================
// SERVER INTERACTION FUNCTIONS
// ============================================

/**
 * Fetch quotes from the server (mock API)
 * This function simulates fetching data from a server
 */
async function fetchQuotesFromServer() {
    console.log('fetchQuotesFromServer: Starting server fetch...');
    
    showLoading('Fetching quotes from server...');
    
    try {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 700));
        
        // Check if we're online
        if (!navigator.onLine) {
            throw new Error('Network is offline');
        }
        
        // Simulate server response with JSONPlaceholder
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.QUOTES_ENDPOINT}?_limit=10`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            // Simulate network conditions
            signal: AbortSignal.timeout(5000)
        });
        
        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }
        
        const serverData = await response.json();
        
        // Transform server data to our quote format
        const serverQuotes = serverData.map(item => ({
            id: `server-${item.id}`,
            text: item.title,
            author: 'Unknown',
            category: item.userId % 2 === 0 ? 'Wisdom' : 'Inspiration',
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            isLocal: false,
            source: 'server',
            version: 1
        }));
        
        // Add some simulated conflicts
        if (appState.quotes.length > 0 && Math.random() > 0.7) {
            // Create a conflict by modifying an existing quote
            const conflictQuote = { ...appState.quotes[0] };
            conflictQuote.text = conflictQuote.text + ' (Server Modified)';
            conflictQuote.lastUpdated = new Date().toISOString();
            conflictQuote.version = (conflictQuote.version || 1) + 1;
            conflictQuote.source = 'server';
            conflictQuote.id = conflictQuote.id.replace('local-', 'server-');
            
            serverQuotes.push(conflictQuote);
        }
        
        console.log(`fetchQuotesFromServer: Successfully fetched ${serverQuotes.length} quotes`);
        
        // Add to sync history
        addToSyncHistory('fetch', true, `Fetched ${serverQuotes.length} quotes from server`);
        
        return serverQuotes;
        
    } catch (error) {
        console.error('fetchQuotesFromServer: Error fetching from server:', error);
        
        // Add to sync history
        addToSyncHistory('fetch', false, error.message);
        
        // Return simulated data for offline/error scenario
        console.log('fetchQuotesFromServer: Returning simulated data for offline mode');
        
        return generateSimulatedServerQuotes();
        
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
            createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
            lastUpdated: new Date().toISOString(),
            isLocal: false,
            source: 'server-simulated',
            version: 2
        },
        {
            id: `server-sim-${Date.now()}-2`,
            text: "The way to get started is to quit talking and begin doing.",
            author: "Walt Disney",
            category: "Action",
            createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
            lastUpdated: new Date().toISOString(),
            isLocal: false,
            source: 'server-simulated',
            version: 1
        },
        {
            id: `server-sim-${Date.now()}-3`,
            text: "If life were predictable it would cease to be life, and be without flavor.",
            author: "Eleanor Roosevelt",
            category: "Life",
            createdAt: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
            lastUpdated: new Date().toISOString(),
            isLocal: false,
            source: 'server-simulated',
            version: 3
        }
    ];
    
    return simulatedQuotes;
}

/**
 * Send quotes to server (mock API)
 */
async function sendQuotesToServer(quotesToSend) {
    console.log(`sendQuotesToServer: Sending ${quotesToSend.length} quotes to server`);
    
    showLoading('Sending quotes to server...');
    
    try {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
        
        // Check if we're online
        if (!navigator.onLine) {
            throw new Error('Network is offline');
        }
        
        // Simulate server request
        const promises = quotesToSend.map(async (quote) => {
            const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.QUOTES_ENDPOINT}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: quote.text,
                    body: quote.author ? `By ${quote.author}` : 'Anonymous',
                    userId: 1
                })
            });
            
            if (!response.ok) {
                throw new Error(`Failed to send quote ${quote.id}`);
            }
            
            return await response.json();
        });
        
        const results = await Promise.allSettled(promises);
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        console.log(`sendQuotesToServer: Successfully sent ${successful} quotes, ${failed} failed`);
        
        // Add to sync history
        addToSyncHistory('send', true, `Sent ${successful} quotes to server (${failed} failed)`);
        
        return {
            success: successful,
            failed: failed,
            total: quotesToSend.length
        };
        
    } catch (error) {
        console.error('sendQuotesToServer: Error sending to server:', error);
        
        // Add to sync history
        addToSyncHistory('send', false, error.message);
        
        throw error;
        
    } finally {
        hideLoading();
    }
}

/**
 * Check server status
 */
async function checkServerStatus() {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/posts/1`, {
            method: 'HEAD',
            signal: AbortSignal.timeout(3000)
        });
        
        return {
            online: true,
            status: response.status,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        return {
            online: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

// ============================================
// MODIFIED SYNC FUNCTION TO USE fetchQuotesFromServer
// ============================================

/**
 * Main sync function (updated to use fetchQuotesFromServer)
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
        
        // 1. Check server status first
        const serverStatus = await checkServerStatus();
        if (!serverStatus.online) {
            throw new Error('Server is not reachable');
        }
        
        // 2. Push local changes to server
        await pushLocalChanges();
        
        // 3. Fetch updates from server using the new function
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
 * Modified fetchFromServer to use fetchQuotesFromServer
 */
async function fetchFromServer() {
    console.log('Fetching quotes from server...');
    
    try {
        // Use the new fetchQuotesFromServer function
        const serverQuotes = await fetchQuotesFromServer();
        
        console.log(`Fetched ${serverQuotes.length} quotes from server`);
        return serverQuotes;
        
    } catch (error) {
        console.error('Error fetching from server:', error);
        throw new Error('Failed to fetch from server');
    }
}

// ============================================
// NEW SERVER SYNC UI FUNCTIONS
// ============================================

/**
 * Fetch and display quotes from server
 */
async function fetchAndDisplayServerQuotes() {
    try {
        showLoading('Loading quotes from server...');
        
        const serverQuotes = await fetchQuotesFromServer();
        
        if (serverQuotes.length > 0) {
            // Show server quotes in a special view
            displayServerQuotes(serverQuotes);
            
            showNotification(`Loaded ${serverQuotes.length} quotes from server`, 'success');
        } else {
            showNotification('No quotes available on server', 'info');
        }
        
    } catch (error) {
        console.error('Error fetching server quotes:', error);
        showNotification('Failed to load quotes from server', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Display server quotes in a special view
 */
function displayServerQuotes(serverQuotes) {
    const container = document.createElement('div');
    container.className = 'server-quotes-view';
    container.innerHTML = `
        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3><i class="fas fa-server"></i> Server Quotes (${serverQuotes.length})</h3>
            <div class="quotes-list" style="max-height: 400px; overflow-y: auto; margin-top: 15px;">
                ${serverQuotes.map(quote => `
                    <div class="quote-item" style="padding: 15px; border-bottom: 1px solid #e5e7eb;">
                        <div style="font-style: italic; margin-bottom: 5px;">"${quote.text}"</div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: #6b7280;">
                            <span>${quote.author} • ${quote.category}</span>
                            <span>v${quote.version}</span>
                        </div>
                        <button onclick="importServerQuote('${quote.id}')" 
                                style="margin-top: 10px; padding: 5px 10px; background: #10b981; color: white; border: none; border-radius: 5px; cursor: pointer;">
                            <i class="fas fa-download"></i> Import
                        </button>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top: 20px; text-align: center;">
                <button onclick="importAllServerQuotes()" 
                        style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    <i class="fas fa-download"></i> Import All
                </button>
                <button onclick="this.closest('.server-quotes-view').remove()" 
                        style="padding: 10px 20px; background: #6b7280; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">
                    <i class="fas fa-times"></i> Close
                </button>
            </div>
        </div>
    `;
    
    // Add to main content
    const main = document.querySelector('main');
    main.insertBefore(container, main.firstChild);
}

/**
 * Import single quote from server
 */
function importServerQuote(quoteId) {
    // This would be implemented to import a specific quote
    showNotification('Import feature would be implemented here', 'info');
}

/**
 * Import all server quotes
 */
function importAllServerQuotes() {
    // This would be implemented to import all quotes
    showNotification('Bulk import feature would be implemented here', 'info');
}

// ============================================
// UPDATED EVENT LISTENERS TO INCLUDE SERVER FETCH
// ============================================

/**
 * Setup event listeners (updated)
 */
function setupEventListeners() {
    // ... existing event listeners ...
    
    // Add server fetch button if it exists
    const fetchServerBtn = document.getElementById('fetchServerBtn');
    if (fetchServerBtn) {
        fetchServerBtn.addEventListener('click', fetchAndDisplayServerQuotes);
    }
    
    // Add periodic server fetch
    setInterval(async () => {
        if (appState.isOnline && !appState.isSyncing) {
            await fetchQuotesFromServer();
        }
    }, 60000); // Check for server updates every minute
}

// ============================================
// MODIFIED INITIALIZATION
// ============================================

/**
 * Initialize the application (updated)
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
    
    // Initial fetch from server
    await performInitialServerFetch();
    
    // Update UI
    updateUI();
    
    console.log('Application initialized successfully');
    console.log('App State:', appState);
}

/**
 * Perform initial server fetch
 */
async function performInitialServerFetch() {
    try {
        const serverQuotes = await fetchQuotesFromServer();
        
        if (serverQuotes.length > 0) {
            // Merge with local quotes
            await mergeData(serverQuotes);
            
            // Update UI
            updateUI();
            
            showNotification(`Loaded ${serverQuotes.length} quotes from server`, 'success');
        }
    } catch (error) {
        console.error('Initial server fetch failed:', error);
        showNotification('Could not connect to server. Working offline.', 'warning');
    }
}

// Make the function available globally
window.fetchQuotesFromServer = fetchQuotesFromServer;
window.fetchAndDisplayServerQuotes = fetchAndDisplayServerQuotes;
