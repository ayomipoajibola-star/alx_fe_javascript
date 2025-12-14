// ============================================
// DYNAMIC QUOTE GENERATOR
// ============================================

// Quote database
let quotes = [];

// DOM Elements
let quoteDisplay = null;
let quoteTextElement = null;
let quoteCategoryElement = null;
let quoteAuthorElement = null;
let categoryFilter = null;
let categoryButtons = null;

// Current filter state
let currentCategory = 'all';
let filteredQuotes = [];

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the application
 */
function init() {
    console.log('Initializing Dynamic Quote Generator...');
    
    // Load quotes from localStorage
    loadQuotesFromStorage();
    
    // Initialize DOM elements
    initializeDOMElements();
    
    // Setup event listeners
    setupEventListeners();
    
    // Populate categories
    populateCategories();
    
    // Show initial quote
    showRandomQuote();
    
    // Update statistics
    updateStats();
    
    console.log('Application initialized successfully');
    console.log('Total quotes:', quotes.length);
    console.log('Categories:', getAllCategories());
}

/**
 * Initialize DOM elements
 */
function initializeDOMElements() {
    // Get the main quote display container - THIS IS THE REQUIRED ELEMENT
    quoteDisplay = document.getElementById('quoteDisplay');
    
    // Get elements inside quoteDisplay
    quoteTextElement = document.getElementById('quoteText');
    quoteCategoryElement = document.getElementById('quoteCategory');
    quoteAuthorElement = document.getElementById('quoteAuthor');
    
    // Get filter elements
    categoryFilter = document.getElementById('categoryFilter');
    categoryButtons = document.getElementById('categoryButtons');
    
    // Log for debugging
    if (!quoteDisplay) {
        console.error('ERROR: quoteDisplay element not found in DOM');
    } else {
        console.log('quoteDisplay element found:', quoteDisplay);
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // New quote button
    const newQuoteBtn = document.getElementById('newQuote');
    if (newQuoteBtn) {
        newQuoteBtn.addEventListener('click', showRandomQuote);
    }
    
    // Add quote form
    const addQuoteBtn = document.getElementById('addQuoteBtn');
    if (addQuoteBtn) {
        addQuoteBtn.addEventListener('click', addQuote);
    }
    
    // Toggle form button
    const toggleFormBtn = document.getElementById('toggleForm');
    if (toggleFormBtn) {
        toggleFormBtn.addEventListener('click', toggleAddQuoteForm);
    }
    
    // Export button
    const exportBtn = document.getElementById('exportJson');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportQuotes);
    }
    
    // Show all quotes button
    const showAllBtn = document.getElementById('showAllQuotes');
    if (showAllBtn) {
        showAllBtn.addEventListener('click', () => {
            currentCategory = 'all';
            filterQuotes();
            updateCategoryFilterUI();
            showRandomQuote();
        });
    }
    
    // Clear all button
    const clearAllBtn = document.getElementById('clearAll');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', clearAllData);
    }
    
    // Category filter change
    if (categoryFilter) {
        categoryFilter.addEventListener('change', function() {
            currentCategory = this.value;
            filterQuotes();
            updateCategoryFilterUI();
            showRandomQuote();
        });
    }
    
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    if (searchInput && searchButton) {
        searchButton.addEventListener('click', handleSearch);
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') handleSearch();
        });
    }
    
    // Clear search
    const clearSearch = document.getElementById('clearSearch');
    if (clearSearch) {
        clearSearch.addEventListener('click', clearSearchQuery);
    }
    
    // Import JSON
    const importFile = document.getElementById('importFile');
    if (importFile) {
        importFile.addEventListener('change', importFromJsonFile);
    }
    
    // Import from text
    const importBtn = document.getElementById('importJsonBtn');
    if (importBtn) {
        importBtn.addEventListener('click', importFromJsonText);
    }
    
    // Copy to clipboard
    const copyBtn = document.getElementById('copyJsonBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', copyQuotesToClipboard);
    }
}

// ============================================
// QUOTE DISPLAY FUNCTIONS
// ============================================

/**
 * Show a random quote in the quoteDisplay element
 */
function showRandomQuote() {
    console.log('showRandomQuote called');
    console.log('Current category:', currentCategory);
    console.log('Filtered quotes count:', filteredQuotes.length);
    
    if (!quoteDisplay || !quoteTextElement || !quoteCategoryElement) {
        console.error('Required DOM elements not found');
        return;
    }
    
    // Use filtered quotes if available, otherwise all quotes
    const quotePool = filteredQuotes.length > 0 ? filteredQuotes : quotes;
    
    if (quotePool.length === 0) {
        console.log('No quotes available');
        
        // Update quoteDisplay with message
        quoteTextElement.textContent = "No quotes available. Add some quotes to get started!";
        quoteCategoryElement.textContent = "Empty";
        if (quoteAuthorElement) {
            quoteAuthorElement.textContent = "Add quotes using the form below";
        }
        
        // Add visual feedback
        quoteDisplay.style.borderLeftColor = '#ef4444';
        return;
    }
    
    // Get random quote
    const randomIndex = Math.floor(Math.random() * quotePool.length);
    const quote = quotePool[randomIndex];
    
    console.log('Displaying quote:', quote);
    
    // Animate quote display
    quoteDisplay.style.opacity = '0.7';
    quoteDisplay.style.transform = 'scale(0.98)';
    
    setTimeout(() => {
        // Update quoteDisplay content
        quoteTextElement.textContent = `"${quote.text}"`;
        quoteCategoryElement.textContent = quote.category;
        
        if (quoteAuthorElement) {
            quoteAuthorElement.textContent = quote.author ? `— ${quote.author}` : '— Unknown';
        }
        
        // Update storage type indicator if it exists
        const storageTypeElement = document.getElementById('quoteStorageType');
        if (storageTypeElement) {
            storageTypeElement.textContent = quote.storageType === 'session' ? 'Session Storage' : 'Local Storage';
        }
        
        // Animate back
        quoteDisplay.style.opacity = '1';
        quoteDisplay.style.transform = 'scale(1)';
        quoteDisplay.style.borderLeftColor = '#667eea';
        quoteDisplay.style.transition = 'all 0.5s ease';
        
        // Save to session storage as last viewed
        saveLastViewedQuote(quote);
        
        // Update last viewed display
        updateLastViewedDisplay(quote);
        
    }, 300);
}

/**
 * Save last viewed quote to session storage
 */
function saveLastViewedQuote(quote) {
    try {
        sessionStorage.setItem('lastViewedQuote', JSON.stringify(quote));
    } catch (error) {
        console.error('Error saving last viewed quote:', error);
    }
}

/**
 * Update last viewed display
 */
function updateLastViewedDisplay(quote) {
    const lastViewedElement = document.getElementById('lastViewedQuote');
    if (lastViewedElement) {
        const shortText = quote.text.length > 30 
            ? quote.text.substring(0, 30) + '...' 
            : quote.text;
        lastViewedElement.textContent = `${quote.category}: "${shortText}"`;
    }
}

/**
 * Create quote display HTML dynamically (alternative approach)
 */
function createQuoteDisplay() {
    // This function creates the quoteDisplay structure if it doesn't exist
    const mainContainer = document.querySelector('main');
    if (!mainContainer) return;
    
    // Create quoteDisplay div
    const quoteDisplayDiv = document.createElement('div');
    quoteDisplayDiv.id = 'quoteDisplay';
    quoteDisplayDiv.className = 'quote-display';
    
    // Create inner structure
    quoteDisplayDiv.innerHTML = `
        <div id="quoteText">Click "Show New Quote" to begin!</div>
        <div id="quoteCategory">General</div>
        <div class="quote-author">
            <span id="quoteSource">Dynamic Quote Generator</span>
            <span class="storage-badge" id="quoteStorageType">Local Storage</span>
        </div>
    `;
    
    // Insert at the beginning of main
    mainContainer.insertBefore(quoteDisplayDiv, mainContainer.firstChild);
    
    // Re-initialize elements
    initializeDOMElements();
}

// ============================================
// CATEGORY MANAGEMENT
// ============================================

/**
 * Populate categories in the dropdown and buttons
 * This is the required populateCategories function
 */
function populateCategories() {
    console.log('populateCategories called');
    
    if (!categoryFilter || !categoryButtons) {
        console.error('Category filter elements not found');
        return;
    }
    
    // Get unique categories
    const categories = getAllCategories();
    console.log('Categories found:', categories);
    
    // Clear existing options (keep "All Categories")
    while (categoryFilter.options.length > 1) {
        categoryFilter.remove(1);
    }
    
    // Clear category buttons
    categoryButtons.innerHTML = '';
    
    // Add categories to dropdown
    categories.forEach(category => {
        if (category === 'all') return;
        
        // Add to dropdown
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
        
        // Add as button
        const button = document.createElement('button');
        button.className = `filter-btn ${category === currentCategory ? 'active' : ''}`;
        button.dataset.category = category;
        button.textContent = category;
        
        // Add quote count badge
        const quoteCount = getQuotesByCategory(category).length;
        if (quoteCount > 0) {
            const badge = document.createElement('span');
            badge.className = 'count';
            badge.textContent = `(${quoteCount})`;
            button.appendChild(badge);
        }
        
        // Add click event
        button.addEventListener('click', function() {
            currentCategory = this.dataset.category;
            filterQuotes();
            updateCategoryFilterUI();
            showRandomQuote();
        });
        
        categoryButtons.appendChild(button);
    });
    
    // Update category suggestions
    updateCategorySuggestions(categories);
    
    // Update category stats
    updateCategoryStats();
    
    console.log(`Populated ${categories.length - 1} categories`);
}

/**
 * Get all unique categories from quotes
 */
function getAllCategories() {
    const categories = new Set(['all']);
    quotes.forEach(quote => {
        if (quote.category && quote.category.trim() !== '') {
            categories.add(quote.category);
        }
    });
    return Array.from(categories);
}

/**
 * Get quotes by category
 */
function getQuotesByCategory(category) {
    if (category === 'all') return quotes;
    return quotes.filter(quote => quote.category === category);
}

/**
 * Update category filter UI
 */
function updateCategoryFilterUI() {
    if (!categoryFilter || !categoryButtons) return;
    
    // Update dropdown
    categoryFilter.value = currentCategory;
    
    // Update buttons
    const buttons = categoryButtons.querySelectorAll('.filter-btn');
    buttons.forEach(button => {
        const buttonCategory = button.dataset.category;
        button.classList.toggle('active', buttonCategory === currentCategory);
    });
    
    // Update category stats display
    updateCategoryStats();
}

/**
 * Update category statistics display
 */
function updateCategoryStats() {
    const categoryStatsElement = document.getElementById('categoryStats');
    if (!categoryStatsElement) return;
    
    const categories = getAllCategories().filter(cat => cat !== 'all');
    const stats = categories.map(category => {
        const count = getQuotesByCategory(category).length;
        return { category, count };
    });
    
    // Sort by count descending
    stats.sort((a, b) => b.count - a.count);
    
    const statsHTML = stats.map(stat => `
        <div class="stat-item">
            <span class="stat-category">${stat.category}</span>
            <span class="stat-count">${stat.count}</span>
        </div>
    `).join('');
    
    categoryStatsElement.innerHTML = statsHTML;
}

/**
 * Update category suggestions in add quote form
 */
function updateCategorySuggestions(categories) {
    const datalist = document.getElementById('categorySuggestions');
    if (!datalist) return;
    
    datalist.innerHTML = categories
        .filter(cat => cat !== 'all')
        .map(category => `<option value="${category}">${category}</option>`)
        .join('');
    
    // Update existing categories display
    updateExistingCategoriesDisplay(categories);
}

/**
 * Update existing categories display
 */
function updateExistingCategoriesDisplay(categories) {
    const container = document.getElementById('existingCategories');
    if (!container) return;
    
    container.innerHTML = categories
        .filter(cat => cat !== 'all')
        .map(category => {
            const count = getQuotesByCategory(category).length;
            return `
                <span class="category-tag" data-category="${category}">
                    ${category}
                    <span class="tag-count">${count}</span>
                </span>
            `;
        })
        .join('');
    
    // Add click handlers
    container.querySelectorAll('.category-tag').forEach(tag => {
        tag.addEventListener('click', function() {
            const category = this.dataset.category;
            const categoryInput = document.getElementById('newQuoteCategory');
            if (categoryInput) {
                categoryInput.value = category;
                categoryInput.focus();
            }
        });
    });
}

// ============================================
// FILTER FUNCTIONS
// ============================================

/**
 * Filter quotes based on selected category
 * This is the required filterQuotes function
 */
function filterQuotes() {
    console.log('filterQuotes called with category:', currentCategory);
    
    if (currentCategory === 'all') {
        filteredQuotes = [...quotes];
    } else {
        filteredQuotes = quotes.filter(quote => quote.category === currentCategory);
    }
    
    // Update filtered count display
    updateFilteredCount();
    
    // Save last filter to localStorage
    saveLastFilter();
    
    // Update current filter display
    updateCurrentFilterDisplay();
    
    console.log(`Filtered ${filteredQuotes.length} quotes for category: ${currentCategory}`);
    
    return filteredQuotes;
}

/**
 * Update filtered count display
 */
function updateFilteredCount() {
    const filteredCountElement = document.getElementById('filteredCount');
    if (filteredCountElement) {
        filteredCountElement.textContent = filteredQuotes.length;
    }
}

/**
 * Save last filter to localStorage
 */
function saveLastFilter() {
    try {
        localStorage.setItem('lastSelectedFilter', currentCategory);
    } catch (error) {
        console.error('Error saving last filter:', error);
    }
}

/**
 * Update current filter display
 */
function updateCurrentFilterDisplay() {
    const currentFilterDisplay = document.getElementById('currentFilterDisplay');
    if (currentFilterDisplay) {
        currentFilterDisplay.textContent = 
            currentCategory === 'all' ? 'All Categories' : currentCategory;
    }
}

/**
 * Handle search functionality
 */
function handleSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    const query = searchInput.value.trim().toLowerCase();
    
    if (!query) {
        filterQuotes();
        showRandomQuote();
        return;
    }
    
    // Search in filtered quotes or all quotes
    const searchPool = filteredQuotes.length > 0 ? filteredQuotes : quotes;
    
    const searchResults = searchPool.filter(quote => 
        quote.text.toLowerCase().includes(query) ||
        quote.category.toLowerCase().includes(query) ||
        (quote.author && quote.author.toLowerCase().includes(query)) ||
        (quote.tags && quote.tags.some(tag => tag.toLowerCase().includes(query)))
    );
    
    // Update display with search results
    if (searchResults.length > 0) {
        // Temporarily show search results
        const originalQuotes = [...quotes];
        const originalFiltered = [...filteredQuotes];
        
        quotes = searchResults;
        filteredQuotes = searchResults;
        
        showRandomQuote();
        
        // Restore original arrays
        quotes = originalQuotes;
        filteredQuotes = originalFiltered;
        
        showNotification(`Found ${searchResults.length} matches for "${query}"`, 'success');
    } else {
        showNotification(`No matches found for "${query}"`, 'warning');
    }
}

/**
 * Clear search query
 */
function clearSearchQuery() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
    }
    filterQuotes();
    showRandomQuote();
}

// ============================================
// QUOTE MANAGEMENT
// ============================================

/**
 * Load quotes from localStorage
 */
function loadQuotesFromStorage() {
    try {
        const savedQuotes = localStorage.getItem('dynamicQuotes');
        if (savedQuotes) {
            quotes = JSON.parse(savedQuotes);
            console.log('Loaded quotes from localStorage:', quotes.length);
        } else {
            // Load default quotes
            quotes = getDefaultQuotes();
            saveQuotesToStorage();
            console.log('Loaded default quotes:', quotes.length);
        }
        
        // Load last selected filter
        const lastFilter = localStorage.getItem('lastSelectedFilter');
        if (lastFilter) {
            currentCategory = lastFilter;
        }
        
        // Load session quotes
        loadSessionQuotes();
        
    } catch (error) {
        console.error('Error loading quotes from storage:', error);
        quotes = getDefaultQuotes();
    }
}

/**
 * Save quotes to localStorage
 */
function saveQuotesToStorage() {
    try {
        localStorage.setItem('dynamicQuotes', JSON.stringify(quotes));
        updateStorageStats();
        return true;
    } catch (error) {
        console.error('Error saving quotes to localStorage:', error);
        showNotification('Error saving quotes', 'error');
        return false;
    }
}

/**
 * Get default quotes
 */
function getDefaultQuotes() {
    return [
        {
            id: Date.now().toString(),
            text: "The only way to do great work is to love what you do.",
            author: "Steve Jobs",
            category: "Inspiration",
            createdAt: new Date().toISOString(),
            storageType: "local"
        },
        {
            id: (Date.now() + 1).toString(),
            text: "Life is what happens to you while you're busy making other plans.",
            author: "Allen Saunders",
            category: "Life",
            createdAt: new Date().toISOString(),
            storageType: "local"
        },
        {
            id: (Date.now() + 2).toString(),
            text: "The future belongs to those who believe in the beauty of their dreams.",
            author: "Eleanor Roosevelt",
            category: "Dreams",
            createdAt: new Date().toISOString(),
            storageType: "local"
        },
        {
            id: (Date.now() + 3).toString(),
            text: "It does not matter how slowly you go as long as you do not stop.",
            author: "Confucius",
            category: "Perseverance",
            createdAt: new Date().toISOString(),
            storageType: "local"
        },
        {
            id: (Date.now() + 4).toString(),
            text: "In the middle of difficulty lies opportunity.",
            author: "Albert Einstein",
            category: "Opportunity",
            createdAt: new Date().toISOString(),
            storageType: "local"
        }
    ];
}

/**
 * Load session quotes
 */
function loadSessionQuotes() {
    try {
        const sessionQuotes = sessionStorage.getItem('sessionQuotes');
        if (sessionQuotes) {
            const parsedQuotes = JSON.parse(sessionQuotes);
            quotes.push(...parsedQuotes);
            console.log('Loaded session quotes:', parsedQuotes.length);
        }
    } catch (error) {
        console.error('Error loading session quotes:', error);
    }
}

/**
 * Add a new quote
 * This is the required addQuote function
 */
function addQuote() {
    console.log('addQuote called');
    
    // Get form values
    const textInput = document.getElementById('newQuoteText');
    const authorInput = document.getElementById('newQuoteAuthor');
    const categoryInput = document.getElementById('newQuoteCategory');
    
    if (!textInput || !categoryInput) {
        console.error('Form elements not found');
        return;
    }
    
    const text = textInput.value.trim();
    const author = authorInput ? authorInput.value.trim() : '';
    const category = categoryInput.value.trim();
    
    // Validate inputs
    if (!text) {
        showNotification('Please enter quote text', 'error');
        textInput.focus();
        return;
    }
    
    if (!category) {
        showNotification('Please enter a category', 'error');
        categoryInput.focus();
        return;
    }
    
    // Get storage type
    const storageType = document.querySelector('input[name="storageType"]:checked')?.value || 'local';
    
    // Create new quote
    const newQuote = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        text: text,
        author: author || 'Unknown',
        category: category,
        createdAt: new Date().toISOString(),
        storageType: storageType
    };
    
    // Add to quotes array
    quotes.push(newQuote);
    
    // Save based on storage type
    if (storageType === 'local') {
        saveQuotesToStorage();
        showNotification(`Quote added to "${category}"`, 'success');
    } else {
        saveSessionQuotes();
        showNotification(`Quote added to session storage`, 'info');
    }
    
    // Clear form
    textInput.value = '';
    if (authorInput) authorInput.value = '';
    categoryInput.value = '';
    
    // Update categories if new
    updateCategoriesOnNewQuote(category);
    
    // Update UI
    filterQuotes();
    updateCategoryFilterUI();
    showRandomQuote();
    updateStats();
    
    console.log('New quote added:', newQuote);
}

/**
 * Update categories when a new quote is added
 */
function updateCategoriesOnNewQuote(newCategory) {
    // This function is called by addQuote to update categories
    console.log('updateCategoriesOnNewQuote called with:', newCategory);
    
    // Check if category already exists
    const categories = getAllCategories();
    if (!categories.includes(newCategory)) {
        // Repopulate categories
        populateCategories();
        
        // Save categories to storage
        saveCategoriesToStorage(categories.concat(newCategory));
    }
}

/**
 * Save categories to storage
 */
function saveCategoriesToStorage(categoryList) {
    try {
        localStorage.setItem('quoteCategories', JSON.stringify(categoryList));
    } catch (error) {
        console.error('Error saving categories to storage:', error);
    }
}

/**
 * Save session quotes
 */
function saveSessionQuotes() {
    try {
        const sessionQuotes = quotes.filter(quote => quote.storageType === 'session');
        sessionStorage.setItem('sessionQuotes', JSON.stringify(sessionQuotes));
        updateStorageStats();
    } catch (error) {
        console.error('Error saving session quotes:', error);
    }
}

// ============================================
// IMPORT/EXPORT FUNCTIONS
// ============================================

/**
 * Export quotes to JSON file
 */
function exportQuotes() {
    const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        totalQuotes: quotes.length,
        quotes: quotes,
        categories: getAllCategories()
    };
    
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `quotes_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    
    showNotification('Quotes exported successfully!', 'success');
}

/**
 * Import quotes from JSON file
 * This is the required importFromJsonFile function
 */
function importFromJsonFile(event) {
    const fileReader = new FileReader();
    
    fileReader.onload = function(event) {
        try {
            const importedData = JSON.parse(event.target.result);
            let importedQuotes = [];
            
            // Handle different import formats
            if (Array.isArray(importedData)) {
                importedQuotes = importedData;
            } else if (importedData.quotes && Array.isArray(importedData.quotes)) {
                importedQuotes = importedData.quotes;
            }
            
            // Process imported quotes
            importedQuotes.forEach(quote => {
                // Add unique ID if missing
                if (!quote.id) {
                    quote.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                }
                
                // Set storage type
                quote.storageType = quote.storageType || 'local';
                
                // Add creation date if missing
                if (!quote.createdAt) {
                    quote.createdAt = new Date().toISOString();
                }
            });
            
            // Add to existing quotes
            quotes.push(...importedQuotes);
            
            // Save to storage
            saveQuotesToStorage();
            
            // Update UI
            populateCategories();
            filterQuotes();
            showRandomQuote();
            updateStats();
            
            showNotification(`Imported ${importedQuotes.length} quotes successfully!`, 'success');
            
        } catch (error) {
            console.error('Error importing JSON:', error);
            showNotification('Invalid JSON file format', 'error');
        }
    };
    
    fileReader.readAsText(event.target.files[0]);
}

/**
 * Import quotes from JSON text
 */
function importFromJsonText() {
    const jsonText = document.getElementById('importJsonText');
    if (!jsonText) return;
    
    const text = jsonText.value.trim();
    if (!text) {
        showNotification('Please enter JSON data', 'warning');
        return;
    }
    
    try {
        const importedData = JSON.parse(text);
        let importedQuotes = [];
        
        if (Array.isArray(importedData)) {
            importedQuotes = importedData;
        } else if (importedData.quotes) {
            importedQuotes = importedData.quotes;
        }
        
        if (importedQuotes.length > 0) {
            quotes.push(...importedQuotes);
            saveQuotesToStorage();
            populateCategories();
            filterQuotes();
            showRandomQuote();
            updateStats();
            jsonText.value = '';
            
            showNotification(`Imported ${importedQuotes.length} quotes from text`, 'success');
        } else {
            showNotification('No valid quotes found in JSON', 'warning');
        }
        
    } catch (error) {
        console.error('Error importing JSON text:', error);
        showNotification('Invalid JSON format', 'error');
    }
}

/**
 * Copy quotes to clipboard
 */
function copyQuotesToClipboard() {
    const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        totalQuotes: quotes.length,
        quotes: quotes
    };
    
    const jsonString = JSON.stringify(exportData, null, 2);
    
    navigator.clipboard.writeText(jsonString).then(() => {
        showNotification('JSON copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy: ', err);
        showNotification('Failed to copy to clipboard', 'error');
    });
}

// ============================================
// UI HELPER FUNCTIONS
// ============================================

/**
 * Toggle add quote form
 */
function toggleAddQuoteForm() {
    const form = document.getElementById('addQuoteForm');
    const toggleBtn = document.getElementById('toggleForm');
    
    if (!form || !toggleBtn) return;
    
    if (form.style.display === 'block' || form.classList.contains('active')) {
        form.style.display = 'none';
        form.classList.remove('active');
        toggleBtn.textContent = 'Add New Quote';
    } else {
        form.style.display = 'block';
        form.classList.add('active');
        toggleBtn.textContent = 'Hide Form';
        
        // Focus on first input
        const textInput = document.getElementById('newQuoteText');
        if (textInput) textInput.focus();
    }
}

/**
 * Update statistics display
 */
function updateStats() {
    // Update total quotes
    const totalQuotesElement = document.getElementById('totalQuotes');
    if (totalQuotesElement) {
        totalQuotesElement.textContent = quotes.length;
    }
    
    // Update total categories
    const totalCategoriesElement = document.getElementById('totalCategories');
    if (totalCategoriesElement) {
        const categories = getAllCategories();
        totalCategoriesElement.textContent = categories.length - 1; // Exclude "all"
    }
    
    // Update category quote count
    const categoryQuoteCount = document.getElementById('categoryQuoteCount');
    if (categoryQuoteCount) {
        const count = currentCategory === 'all' 
            ? quotes.length 
            : getQuotesByCategory(currentCategory).length;
        categoryQuoteCount.textContent = count;
    }
    
    // Update selected category
    const selectedCategory = document.getElementById('selectedCategory');
    if (selectedCategory) {
        selectedCategory.textContent = currentCategory === 'all' ? 'All' : currentCategory;
    }
}

/**
 * Update storage statistics
 */
function updateStorageStats() {
    try {
        // Calculate localStorage usage
        const localStorageSize = JSON.stringify(localStorage).length;
        const sessionStorageSize = JSON.stringify(sessionStorage).length;
        
        // Update display
        const localStorageElement = document.getElementById('localStorageUsage');
        const sessionStorageElement = document.getElementById('sessionStorageUsage');
        const storageStatusElement = document.getElementById('storageStatus');
        
        if (localStorageElement) {
            localStorageElement.textContent = `${(localStorageSize / 1024).toFixed(2)} KB`;
        }
        
        if (sessionStorageElement) {
            sessionStorageElement.textContent = `${(sessionStorageSize / 1024).toFixed(2)} KB`;
        }
        
        if (storageStatusElement) {
            storageStatusElement.textContent = `Storage: ${((localStorageSize + sessionStorageSize) / 1024).toFixed(2)} KB used`;
        }
        
    } catch (error) {
        console.error('Error updating storage stats:', error);
    }
}

/**
 * Clear all data
 */
function clearAllData() {
    if (confirm('Are you sure you want to clear all data? This cannot be undone!')) {
        // Clear localStorage
        localStorage.removeItem('dynamicQuotes');
        localStorage.removeItem('quoteCategories');
        localStorage.removeItem('lastSelectedFilter');
        
        // Clear sessionStorage
        sessionStorage.clear();
        
        // Reset arrays
        quotes = getDefaultQuotes();
        filteredQuotes = [];
        currentCategory = 'all';
        
        // Save default quotes
        saveQuotesToStorage();
        
        // Update UI
        populateCategories();
        filterQuotes();
        showRandomQuote();
        updateStats();
        
        showNotification('All data cleared successfully', 'warning');
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
    notification.textContent = message;
    
    // Add to body
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================================
// INITIALIZATION CALL
// ============================================

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Make functions available globally for testing
window.showRandomQuote = showRandomQuote;
window.addQuote = addQuote;
window.populateCategories = populateCategories;
window.filterQuotes = filterQuotes;
window.importFromJsonFile = importFromJsonFile;
window.updateCategoriesOnNewQuote = updateCategoriesOnNewQuote;

console.log('Dynamic Quote Generator script loaded');
