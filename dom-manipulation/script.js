// ============================================
// MODULE 1: CATEGORY MANAGEMENT
// ============================================

class CategoryManager {
    constructor(storage) {
        this.storage = storage;
        this.categories = new Set(['all']);
        this.categoryStats = {};
        this.initializeCategories();
    }

    /**
     * Initialize categories from storage
     */
    initializeCategories() {
        const quotes = this.storage.getAllQuotes();
        this.categories = new Set(['all', ...quotes.map(quote => quote.category)]);
        this.updateCategoryStats();
    }

    /**
     * Populate categories in the dropdown menu
     * This is the required populateCategories function
     */
    populateCategories() {
        const categoryFilter = document.getElementById('categoryFilter');
        const categoryButtons = document.getElementById('categoryButtons');
        
        if (!categoryFilter || !categoryButtons) {
            console.error('Category filter elements not found');
            return;
        }
        
        // Clear existing options (keep the first "All Categories" option)
        while (categoryFilter.options.length > 1) {
            categoryFilter.remove(1);
        }
        
        // Clear category buttons
        categoryButtons.innerHTML = '';
        
        // Get all unique categories and sort them
        const sortedCategories = Array.from(this.categories)
            .filter(cat => cat !== 'all')
            .sort((a, b) => a.localeCompare(b));
        
        // Add categories to dropdown
        sortedCategories.forEach(category => {
            // Add to dropdown
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilter.appendChild(option);
            
            // Add as button
            const button = document.createElement('button');
            button.className = 'filter-btn';
            button.dataset.category = category;
            button.innerHTML = `
                ${category}
                <span class="count">${this.categoryStats[category] || 0}</span>
            `;
            
            // Add click event
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleCategorySelection(category);
            });
            
            categoryButtons.appendChild(button);
        });
        
        // Update category suggestions in the add quote form
        this.updateCategorySuggestions(sortedCategories);
        
        // Update stats display
        this.updateCategoryStatsDisplay();
        
        console.log(`Populated ${sortedCategories.length} categories`);
    }

    /**
     * Handle category selection
     * @param {string} category - Selected category
     */
    handleCategorySelection(category) {
        // Update dropdown
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
            categoryFilter.value = category;
        }
        
        // Update button states
        this.updateCategoryButtonStates(category);
        
        // Trigger filter update
        const event = new Event('change');
        categoryFilter?.dispatchEvent(event);
        
        // Update last selected filter
        this.saveLastSelectedFilter(category);
        
        console.log(`Category selected: ${category}`);
    }

    /**
     * Update category button active states
     * @param {string} selectedCategory - Currently selected category
     */
    updateCategoryButtonStates(selectedCategory) {
        const buttons = document.querySelectorAll('#categoryButtons .filter-btn');
        buttons.forEach(button => {
            const buttonCategory = button.dataset.category;
            button.classList.toggle('active', buttonCategory === selectedCategory);
        });
    }

    /**
     * Update category statistics
     */
    updateCategoryStats() {
        const quotes = this.storage.getAllQuotes();
        this.categoryStats = {};
        
        quotes.forEach(quote => {
            this.categoryStats[quote.category] = (this.categoryStats[quote.category] || 0) + 1;
        });
    }

    /**
     * Update category stats display
     */
    updateCategoryStatsDisplay() {
        const statsElement = document.getElementById('categoryStats');
        if (!statsElement) return;
        
        const statsHTML = Object.entries(this.categoryStats)
            .map(([category, count]) => `
                <div class="stat-item">
                    <span class="stat-category">${category}</span>
                    <span class="stat-count">${count} quote${count !== 1 ? 's' : ''}</span>
                </div>
            `)
            .join('');
        
        statsElement.innerHTML = statsHTML;
    }

    /**
     * Update category suggestions in the add quote form
     * @param {Array} categories - Array of categories
     */
    updateCategorySuggestions(categories) {
        const datalist = document.getElementById('categorySuggestions');
        if (!datalist) return;
        
        datalist.innerHTML = categories
            .map(category => `<option value="${category}">${category}</option>`)
            .join('');
        
        // Also update the existing categories display
        this.updateExistingCategoriesDisplay(categories);
    }

    /**
     * Update existing categories display
     * @param {Array} categories - Array of categories
     */
    updateExistingCategoriesDisplay(categories) {
        const container = document.getElementById('existingCategories');
        if (!container) return;
        
        container.innerHTML = categories
            .map(category => `
                <span class="category-tag" data-category="${category}">
                    ${category}
                    <span class="tag-count">${this.categoryStats[category] || 0}</span>
                </span>
            `)
            .join('');
        
        // Add click handlers to tags
        container.querySelectorAll('.category-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                const category = tag.dataset.category;
                document.getElementById('newQuoteCategory').value = category;
            });
        });
    }

    /**
     * Save last selected filter to localStorage
     * @param {string} category - Selected category
     */
    saveLastSelectedFilter(category) {
        try {
            localStorage.setItem('lastSelectedCategory', category);
        } catch (error) {
            console.error('Error saving last selected filter:', error);
        }
    }

    /**
     * Load last selected filter from localStorage
     * @returns {string} Last selected category
     */
    loadLastSelectedFilter() {
        try {
            return localStorage.getItem('lastSelectedCategory') || 'all';
        } catch (error) {
            console.error('Error loading last selected filter:', error);
            return 'all';
        }
    }

    /**
     * Add a new category to the system
     * @param {string} category - New category to add
     * @returns {boolean} Success status
     */
    addCategory(category) {
        if (!category || category.trim() === '') {
            return false;
        }
        
        const normalizedCategory = category.trim();
        
        // Check if category already exists
        if (this.categories.has(normalizedCategory)) {
            return false;
        }
        
        // Add to categories set
        this.categories.add(normalizedCategory);
        
        // Update stats
        this.categoryStats[normalizedCategory] = 0;
        
        // Update UI
        this.populateCategories();
        
        // Save to storage
        this.saveCategoriesToStorage();
        
        console.log(`New category added: ${normalizedCategory}`);
        return true;
    }

    /**
     * Remove a category from the system
     * @param {string} category - Category to remove
     * @returns {boolean} Success status
     */
    removeCategory(category) {
        if (category === 'all' || !this.categories.has(category)) {
            return false;
        }
        
        // Check if category has quotes
        if (this.categoryStats[category] > 0) {
            console.warn(`Cannot remove category "${category}" - it has ${this.categoryStats[category]} quotes`);
            return false;
        }
        
        // Remove from categories set
        this.categories.delete(category);
        
        // Remove from stats
        delete this.categoryStats[category];
        
        // Update UI
        this.populateCategories();
        
        // Save to storage
        this.saveCategoriesToStorage();
        
        console.log(`Category removed: ${category}`);
        return true;
    }

    /**
     * Rename a category
     * @param {string} oldCategory - Old category name
     * @param {string} newCategory - New category name
     * @returns {boolean} Success status
     */
    renameCategory(oldCategory, newCategory) {
        if (oldCategory === 'all' || !this.categories.has(oldCategory)) {
            return false;
        }
        
        const normalizedNewCategory = newCategory.trim();
        
        // Check if new category already exists
        if (this.categories.has(normalizedNewCategory)) {
            return false;
        }
        
        // Update quotes with the new category
        this.updateQuotesCategory(oldCategory, normalizedNewCategory);
        
        // Update categories set
        this.categories.delete(oldCategory);
        this.categories.add(normalizedNewCategory);
        
        // Update stats
        this.categoryStats[normalizedNewCategory] = this.categoryStats[oldCategory];
        delete this.categoryStats[oldCategory];
        
        // Update UI
        this.populateCategories();
        
        // Save to storage
        this.saveCategoriesToStorage();
        
        console.log(`Category renamed: ${oldCategory} -> ${normalizedNewCategory}`);
        return true;
    }

    /**
     * Update quotes when a category is renamed
     * @param {string} oldCategory - Old category name
     * @param {string} newCategory - New category name
     */
    updateQuotesCategory(oldCategory, newCategory) {
        const quotes = this.storage.getAllQuotes();
        quotes.forEach(quote => {
            if (quote.category === oldCategory) {
                quote.category = newCategory;
            }
        });
        
        this.storage.saveQuotes();
    }

    /**
     * Save categories to localStorage
     */
    saveCategoriesToStorage() {
        try {
            const categoriesArray = Array.from(this.categories);
            localStorage.setItem('quoteCategories', JSON.stringify(categoriesArray));
        } catch (error) {
            console.error('Error saving categories to storage:', error);
        }
    }

    /**
     * Load categories from localStorage
     */
    loadCategoriesFromStorage() {
        try {
            const storedCategories = localStorage.getItem('quoteCategories');
            if (storedCategories) {
                const categoriesArray = JSON.parse(storedCategories);
                this.categories = new Set(categoriesArray);
                this.updateCategoryStats();
            }
        } catch (error) {
            console.error('Error loading categories from storage:', error);
        }
    }

    /**
     * Get category statistics for display
     * @returns {Array} Array of category statistics
     */
    getCategoryStatistics() {
        return Object.entries(this.categoryStats)
            .map(([category, count]) => ({
                category,
                count,
                percentage: Math.round((count / this.storage.getAllQuotes().length) * 100) || 0
            }))
            .sort((a, b) => b.count - a.count);
    }

    /**
     * Search categories by keyword
     * @param {string} keyword - Search keyword
     * @returns {Array} Matching categories
     */
    searchCategories(keyword) {
        if (!keyword) return Array.from(this.categories);
        
        return Array.from(this.categories)
            .filter(category => 
                category.toLowerCase().includes(keyword.toLowerCase())
            )
            .sort();
    }

    /**
     * Get most popular categories
     * @param {number} limit - Maximum number of categories to return
     * @returns {Array} Popular categories
     */
    getPopularCategories(limit = 5) {
        return this.getCategoryStatistics()
            .slice(0, limit)
            .map(stat => stat.category);
    }

    /**
     * Initialize category management
     */
    initialize() {
        this.loadCategoriesFromStorage();
        this.populateCategories();
        
        // Set up category filter event listener
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => {
                this.handleCategorySelection(e.target.value);
            });
        }
        
        // Load last selected filter
        const lastSelected = this.loadLastSelectedFilter();
        if (lastSelected !== 'all') {
            this.handleCategorySelection(lastSelected);
        }
        
        console.log('Category Manager initialized');
    }
}

// ============================================
// MODULE 2: FILTER SYSTEM WITH CATEGORY SUPPORT
// ============================================

class QuoteFilterSystem {
    constructor(storage, categoryManager) {
        this.storage = storage;
        this.categoryManager = categoryManager;
        this.currentFilter = 'all';
        this.filteredQuotes = [];
        
        this.initializeFilterSystem();
    }

    /**
     * Initialize filter system
     */
    initializeFilterSystem() {
        this.setupFilterListeners();
        this.applyFilter(this.currentFilter);
    }

    /**
     * Setup filter event listeners
     */
    setupFilterListeners() {
        // Category filter dropdown
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => {
                this.applyFilter(e.target.value);
            });
        }
        
        // Search filter
        const searchInput = document.getElementById('searchInput');
        const searchButton = document.getElementById('searchButton');
        
        if (searchInput && searchButton) {
            searchButton.addEventListener('click', () => this.handleSearch());
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleSearch();
            });
        }
        
        // Clear search button
        const clearSearch = document.getElementById('clearSearch');
        if (clearSearch) {
            clearSearch.addEventListener('click', () => this.clearSearch());
        }
    }

    /**
     * Apply category filter
     * @param {string} category - Category to filter by
     */
    applyFilter(category) {
        this.currentFilter = category;
        
        if (category === 'all') {
            this.filteredQuotes = this.storage.getAllQuotes();
        } else {
            this.filteredQuotes = this.storage.getAllQuotes()
                .filter(quote => quote.category === category);
        }
        
        this.displayFilteredQuotes();
        this.updateFilterDisplay();
        
        // Save filter preference
        this.saveFilterPreference(category);
    }

    /**
     * Handle search functionality
     */
    handleSearch() {
        const searchInput = document.getElementById('searchInput');
        if (!searchInput) return;
        
        const searchTerm = searchInput.value.trim().toLowerCase();
        
        if (!searchTerm) {
            this.applyFilter(this.currentFilter);
            return;
        }
        
        this.filteredQuotes = this.storage.getAllQuotes()
            .filter(quote => 
                quote.text.toLowerCase().includes(searchTerm) ||
                quote.author?.toLowerCase().includes(searchTerm) ||
                quote.category.toLowerCase().includes(searchTerm) ||
                quote.tags?.some(tag => tag.toLowerCase().includes(searchTerm))
            );
        
        this.displayFilteredQuotes();
        this.updateFilterDisplay();
        
        // Show search results count
        this.showNotification(`Found ${this.filteredQuotes.length} matches for "${searchTerm}"`, 'info');
    }

    /**
     * Clear search and restore current filter
     */
    clearSearch() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
        }
        
        this.applyFilter(this.currentFilter);
    }

    /**
     * Display filtered quotes
     */
    displayFilteredQuotes() {
        const container = document.getElementById('quotesGridContainer');
        if (!container) return;
        
        if (this.filteredQuotes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">🔍</div>
                    <h3>No quotes found</h3>
                    <p>${this.currentFilter === 'all' ? 'Add some quotes to get started!' : 'No quotes in this category'}</p>
                </div>
            `;
            return;
        }
        
        // Create quotes grid using map
        const quotesHTML = this.filteredQuotes
            .map((quote, index) => this.createQuoteCard(quote, index))
            .join('');
        
        container.innerHTML = `<div class="quotes-grid">${quotesHTML}</div>`;
        
        // Add event listeners to quote cards
        this.addQuoteCardListeners();
    }

    /**
     * Create quote card HTML
     * @param {Object} quote - Quote object
     * @param {number} index - Quote index
     * @returns {string} HTML string
     */
    createQuoteCard(quote, index) {
        return `
            <div class="quote-card" data-id="${quote.id}" data-index="${index}">
                <div class="quote-text">"${quote.text}"</div>
                <div class="quote-author">— ${quote.author || 'Unknown'}</div>
                <div class="quote-meta">
                    <span class="quote-category">${quote.category}</span>
                    <span class="quote-date">${new Date(quote.createdAt).toLocaleDateString()}</span>
                </div>
                <div class="quote-actions">
                    <button class="action-btn edit-quote" data-id="${quote.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="action-btn delete-quote" data-id="${quote.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Add event listeners to quote cards
     */
    addQuoteCardListeners() {
        // Delete buttons
        document.querySelectorAll('.delete-quote').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const quoteId = e.currentTarget.dataset.id;
                this.handleDeleteQuote(quoteId);
            });
        });
        
        // Edit buttons
        document.querySelectorAll('.edit-quote').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const quoteId = e.currentTarget.dataset.id;
                this.handleEditQuote(quoteId);
            });
        });
    }

    /**
     * Handle quote deletion
     * @param {string} quoteId - Quote ID to delete
     */
    handleDeleteQuote(quoteId) {
        if (confirm('Are you sure you want to delete this quote?')) {
            // Find quote to get its category for stats update
            const quote = this.filteredQuotes.find(q => q.id === quoteId);
            
            // Delete from storage
            this.storage.deleteQuote(quoteId);
            
            // Update categories
            this.categoryManager.initializeCategories();
            this.categoryManager.populateCategories();
            
            // Re-apply current filter
            this.applyFilter(this.currentFilter);
            
            this.showNotification('Quote deleted successfully', 'warning');
        }
    }

    /**
     * Handle quote editing
     * @param {string} quoteId - Quote ID to edit
     */
    handleEditQuote(quoteId) {
        const quote = this.filteredQuotes.find(q => q.id === quoteId);
        if (!quote) return;
        
        // Populate edit form
        document.getElementById('newQuoteText').value = quote.text;
        document.getElementById('newQuoteAuthor').value = quote.author || '';
        document.getElementById('newQuoteCategory').value = quote.category;
        
        // Show add quote form
        document.getElementById('addQuoteForm').classList.add('active');
        
        // Change button text to "Update Quote"
        const addButton = document.getElementById('addQuoteBtn');
        addButton.innerHTML = '<i class="fas fa-save"></i> Update Quote';
        addButton.dataset.editId = quoteId;
        
        this.showNotification(`Editing quote from ${quote.category}`, 'info');
    }

    /**
     * Update filter display information
     */
    updateFilterDisplay() {
        // Update filtered count
        const filteredCount = document.getElementById('filteredCount');
        if (filteredCount) {
            filteredCount.textContent = this.filteredQuotes.length;
        }
        
        // Update current filter display
        const currentFilterDisplay = document.getElementById('currentFilterDisplay');
        if (currentFilterDisplay) {
            currentFilterDisplay.textContent = 
                this.currentFilter === 'all' ? 'All Categories' : this.currentFilter;
        }
        
        // Update category quote count
        const categoryQuoteCount = document.getElementById('categoryQuoteCount');
        if (categoryQuoteCount) {
            const count = this.currentFilter === 'all' 
                ? this.storage.getAllQuotes().length
                : this.filteredQuotes.length;
            categoryQuoteCount.textContent = count;
        }
        
        // Update selected category
        const selectedCategory = document.getElementById('selectedCategory');
        if (selectedCategory) {
            selectedCategory.textContent = 
                this.currentFilter === 'all' ? 'All' : this.currentFilter;
        }
    }

    /**
     * Save filter preference to localStorage
     * @param {string} category - Selected category
     */
    saveFilterPreference(category) {
        try {
            localStorage.setItem('lastFilter', category);
        } catch (error) {
            console.error('Error saving filter preference:', error);
        }
    }

    /**
     * Load filter preference from localStorage
     * @returns {string} Last filter preference
     */
    loadFilterPreference() {
        try {
            return localStorage.getItem('lastFilter') || 'all';
        } catch (error) {
            console.error('Error loading filter preference:', error);
            return 'all';
        }
    }

    /**
     * Show notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type (success, error, info, warning)
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    /**
     * Get notification icon based on type
     * @param {string} type - Notification type
     * @returns {string} Icon class
     */
    getNotificationIcon(type) {
        switch(type) {
            case 'success': return 'check-circle';
            case 'error': return 'exclamation-circle';
            case 'warning': return 'exclamation-triangle';
            default: return 'info-circle';
        }
    }

    /**
     * Initialize filter system
     */
    initialize() {
        // Load last filter preference
        this.currentFilter = this.loadFilterPreference();
        
        // Apply initial filter
        this.applyFilter(this.currentFilter);
        
        console.log('Quote Filter System initialized');
    }
}

// ============================================
// ENHANCED STORAGE CLASS
// ============================================

class QuoteStorage {
    constructor() {
        this.STORAGE_KEYS = {
            QUOTES: 'dynamic_quotes_v3',
            CATEGORIES: 'quote_categories',
            SETTINGS: 'quote_settings'
        };
        
        this.quotes = this.loadQuotes();
    }

    /**
     * Load quotes from localStorage
     * @returns {Array} Array of quotes
     */
    loadQuotes() {
        try {
            const storedQuotes = localStorage.getItem(this.STORAGE_KEYS.QUOTES);
            return storedQuotes ? JSON.parse(storedQuotes) : this.getDefaultQuotes();
        } catch (error) {
            console.error('Error loading quotes:', error);
            return this.getDefaultQuotes();
        }
    }

    /**
     * Save quotes to localStorage
     * @returns {boolean} Success status
     */
    saveQuotes() {
        try {
            localStorage.setItem(this.STORAGE_KEYS.QUOTES, JSON.stringify(this.quotes));
            return true;
        } catch (error) {
            console.error('Error saving quotes:', error);
            return false;
        }
    }

    /**
     * Get all quotes
     * @returns {Array} All quotes
     */
    getAllQuotes() {
        return this.quotes;
    }

    /**
     * Add a new quote
     * @param {Object} quoteData - Quote data
     * @returns {Object} Added quote
     */
    addQuote(quoteData) {
        const newQuote = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            text: quoteData.text,
            author: quoteData.author || 'Unknown',
            category: quoteData.category,
            createdAt: new Date().toISOString(),
            tags: quoteData.tags || [],
            popularity: Math.floor(Math.random() * 100)
        };
        
        this.quotes.push(newQuote);
        this.saveQuotes();
        return newQuote;
    }

    /**
     * Delete a quote
     * @param {string} quoteId - Quote ID to delete
     * @returns {boolean} Success status
     */
    deleteQuote(quoteId) {
        const initialLength = this.quotes.length;
        this.quotes = this.quotes.filter(quote => quote.id !== quoteId);
        
        if (this.quotes.length < initialLength) {
            this.saveQuotes();
            return true;
        }
        
        return false;
    }

    /**
     * Update a quote
     * @param {string} quoteId - Quote ID to update
     * @param {Object} updates - Updates to apply
     * @returns {boolean} Success status
     */
    updateQuote(quoteId, updates) {
        const quoteIndex = this.quotes.findIndex(q => q.id === quoteId);
        
        if (quoteIndex !== -1) {
            this.quotes[quoteIndex] = {
                ...this.quotes[quoteIndex],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            
            this.saveQuotes();
            return true;
        }
        
        return false;
    }

    /**
     * Get default quotes
     * @returns {Array} Default quotes
     */
    getDefaultQuotes() {
        return [
            {
                id: '1',
                text: "The only way to do great work is to love what you do.",
                author: "Steve Jobs",
                category: "Inspiration",
                createdAt: new Date().toISOString(),
                tags: ["work", "passion"],
                popularity: 95
            },
            {
                id: '2',
                text: "Life is what happens to you while you're busy making other plans.",
                author: "Allen Saunders",
                category: "Life",
                createdAt: new Date().toISOString(),
                tags: ["life", "plans"],
                popularity: 88
            },
            {
                id: '3',
                text: "The future belongs to those who believe in the beauty of their dreams.",
                author: "Eleanor Roosevelt",
                category: "Dreams",
                createdAt: new Date().toISOString(),
                tags: ["future", "dreams"],
                popularity: 92
            },
            {
                id: '4',
                text: "It does not matter how slowly you go as long as you do not stop.",
                author: "Confucius",
                category: "Perseverance",
                createdAt: new Date().toISOString(),
                tags: ["perseverance", "progress"],
                popularity: 85
            },
            {
                id: '5',
                text: "In the middle of difficulty lies opportunity.",
                author: "Albert Einstein",
                category: "Opportunity",
                createdAt: new Date().toISOString(),
                tags: ["opportunity", "challenge"],
                popularity: 90
            }
        ];
    }

    /**
     * Get quotes by category
     * @param {string} category - Category to filter by
     * @returns {Array} Filtered quotes
     */
    getQuotesByCategory(category) {
        if (category === 'all') return this.quotes;
        return this.quotes.filter(quote => quote.category === category);
    }

    /**
     * Get unique categories from quotes
     * @returns {Array} Unique categories
     */
    getUniqueCategories() {
        const categories = new Set();
        this.quotes.forEach(quote => categories.add(quote.category));
        return Array.from(categories);
    }

    /**
     * Get category statistics
     * @returns {Object} Category statistics
     */
    getCategoryStats() {
        const stats = {};
        this.quotes.forEach(quote => {
            stats[quote.category] = (stats[quote.category] || 0) + 1;
        });
        return stats;
    }
}

// ============================================
// MAIN APPLICATION
// ============================================

class DynamicQuoteApp {
    constructor() {
        this.storage = new QuoteStorage();
        this.categoryManager = new CategoryManager(this.storage);
        this.filterSystem = new QuoteFilterSystem(this.storage, this.categoryManager);
        
        this.initializeApp();
    }

    /**
     * Initialize the application
     */
    initializeApp() {
        this.initializeUI();
        this.bindEvents();
        this.loadInitialData();
    }

    /**
     * Initialize UI components
     */
    initializeUI() {
        // Initialize category manager
        this.categoryManager.initialize();
        
        // Initialize filter system
        this.filterSystem.initialize();
        
        // Update stats display
        this.updateStatsDisplay();
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Add quote form
        const addQuoteBtn = document.getElementById('addQuoteBtn');
        const toggleFormBtn = document.getElementById('toggleForm');
        const cancelAddBtn = document.getElementById('cancelAddBtn');
        
        if (addQuoteBtn) {
            addQuoteBtn.addEventListener('click', (e) => this.handleAddQuote(e));
        }
        
        if (toggleFormBtn) {
            toggleFormBtn.addEventListener('click', () => this.toggleAddQuoteForm());
        }
        
        if (cancelAddBtn) {
            cancelAddBtn.addEventListener('click', () => this.toggleAddQuoteForm());
        }
        
        // New quote button
        const newQuoteBtn = document.getElementById('newQuote');
        if (newQuoteBtn) {
            newQuoteBtn.addEventListener('click', () => this.showRandomQuote());
        }
        
        // Show all quotes button
        const showAllBtn = document.getElementById('showAllQuotes');
        if (showAllBtn) {
            showAllBtn.addEventListener('click', () => this.showAllQuotes());
        }
        
        // Export button
        const exportBtn = document.getElementById('exportJson');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportQuotes());
        }
        
        // Clear all button
        const clearAllBtn = document.getElementById('clearAll');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => this.clearAllData());
        }
    }

    /**
     * Load initial data
     */
    loadInitialData() {
        // Show random quote on load
        this.showRandomQuote();
        
        // Update storage info
        this.updateStorageInfo();
        
        console.log('Dynamic Quote App initialized');
    }

    /**
     * Handle add quote form submission
     * @param {Event} e - Click event
     */
    handleAddQuote(e) {
        e.preventDefault();
        
        const quoteText = document.getElementById('newQuoteText').value.trim();
        const quoteAuthor = document.getElementById('newQuoteAuthor').value.trim();
        const quoteCategory = document.getElementById('newQuoteCategory').value.trim();
        
        // Validate inputs
        if (!quoteText) {
            this.showNotification('Please enter quote text', 'error');
            return;
        }
        
        if (!quoteCategory) {
            this.showNotification('Please enter a category', 'error');
            return;
        }
        
        // Check if we're editing or adding
        const isEditing = e.target.dataset.editId;
        
        if (isEditing) {
            // Update existing quote
            this.updateQuote(isEditing, { text: quoteText, author: quoteAuthor, category: quoteCategory });
        } else {
            // Add new quote
            const newQuote = this.storage.addQuote({
                text: quoteText,
                author: quoteAuthor,
                category: quoteCategory
            });
            
            // Add category if it's new
            this.categoryManager.addCategory(quoteCategory);
            
            this.showNotification(`Quote added to "${quoteCategory}"`, 'success');
        }
        
        // Clear form
        this.clearAddQuoteForm();
        
        // Update categories and filters
        this.categoryManager.populateCategories();
        this.filterSystem.applyFilter(this.filterSystem.currentFilter);
        
        // Update stats
        this.updateStatsDisplay();
    }

    /**
     * Update an existing quote
     * @param {string} quoteId - Quote ID to update
     * @param {Object} updates - Updates to apply
     */
    updateQuote(quoteId, updates) {
        const success = this.storage.updateQuote(quoteId, updates);
        
        if (success) {
            this.showNotification('Quote updated successfully', 'success');
            
            // Update categories if category changed
            if (updates.category) {
                this.categoryManager.addCategory(updates.category);
                this.categoryManager.populateCategories();
            }
        } else {
            this.showNotification('Failed to update quote', 'error');
        }
    }

    /**
     * Clear add quote form
     */
    clearAddQuoteForm() {
        document.getElementById('newQuoteText').value = '';
        document.getElementById('newQuoteAuthor').value = '';
        document.getElementById('newQuoteCategory').value = '';
        
        // Reset button text
        const addButton = document.getElementById('addQuoteBtn');
        addButton.innerHTML = '<i class="fas fa-plus"></i> Add Quote';
        delete addButton.dataset.editId;
        
        // Hide form
        this.toggleAddQuoteForm();
    }

    /**
     * Toggle add quote form visibility
     */
    toggleAddQuoteForm() {
        const form = document.getElementById('addQuoteForm');
        const toggleBtn = document.getElementById('toggleForm');
        
        if (form.classList.contains('active')) {
            form.classList.remove('active');
            toggleBtn.innerHTML = '<i class="fas fa-plus"></i> Add New Quote';
        } else {
            form.classList.add('active');
            toggleBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
            
            // Focus on first input
            document.getElementById('newQuoteText').focus();
        }
    }

    /**
     * Show random quote
     */
    showRandomQuote() {
        const quotes = this.storage.getAllQuotes();
        
        if (quotes.length === 0) {
            this.updateQuoteDisplay('No quotes available', 'General', 'Add some quotes!');
            return;
        }
        
        const randomIndex = Math.floor(Math.random() * quotes.length);
        const randomQuote = quotes[randomIndex];
        
        this.updateQuoteDisplay(
            randomQuote.text,
            randomQuote.category,
            randomQuote.author || 'Unknown'
        );
    }

    /**
     * Update quote display
     * @param {string} text - Quote text
     * @param {string} category - Quote category
     * @param {string} author - Quote author
     */
    updateQuoteDisplay(text, category, author) {
        const quoteText = document.getElementById('quoteText');
        const quoteCategory = document.getElementById('quoteCategory');
        const quoteSource = document.getElementById('quoteSource');
        
        if (quoteText) quoteText.textContent = `"${text}"`;
        if (quoteCategory) quoteCategory.textContent = category;
        if (quoteSource) quoteSource.textContent = `— ${author}`;
    }

    /**
     * Show all quotes
     */
    showAllQuotes() {
        this.filterSystem.applyFilter('all');
        this.showNotification('Showing all quotes', 'info');
    }

    /**
     * Export quotes to JSON
     */
    exportQuotes() {
        const quotes = this.storage.getAllQuotes();
        const exportData = {
            version: '3.0',
            exportDate: new Date().toISOString(),
            totalQuotes: quotes.length,
            quotes: quotes,
            categories: this.categoryManager.getCategoryStatistics()
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
        
        this.showNotification('Quotes exported successfully', 'success');
    }

    /**
     * Clear all data
     */
    clearAllData() {
        if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
            // Clear localStorage
            localStorage.clear();
            
            // Reset storage
            this.storage = new QuoteStorage();
            
            // Reset category manager
            this.categoryManager = new CategoryManager(this.storage);
            this.categoryManager.initialize();
            
            // Reset filter system
            this.filterSystem = new QuoteFilterSystem(this.storage, this.categoryManager);
            this.filterSystem.initialize();
            
            // Update UI
            this.updateStatsDisplay();
            this.showRandomQuote();
            
            this.showNotification('All data cleared', 'warning');
        }
    }

    /**
     * Update statistics display
     */
    updateStatsDisplay() {
        const totalQuotes = this.storage.getAllQuotes().length;
        const totalCategories = this.categoryManager.categories.size - 1; // Exclude 'all'
        
        // Update total quotes display
        const totalQuotesElement = document.getElementById('totalQuotes');
        if (totalQuotesElement) {
            totalQuotesElement.textContent = totalQuotes;
        }
        
        // Update total categories display
        const totalCategoriesElement = document.getElementById('totalCategories');
        if (totalCategoriesElement) {
            totalCategoriesElement.textContent = totalCategories;
        }
        
        // Update storage usage
        this.updateStorageInfo();
    }

    /**
     * Update storage information
     */
    updateStorageInfo() {
        try {
            const totalQuotes = this.storage.getAllQuotes().length;
            const storageSize = JSON.stringify(localStorage).length;
            
            const storageUsage = document.getElementById('localStorageUsage');
            if (storageUsage) {
                storageUsage.textContent = `${(storageSize / 1024).toFixed(2)} KB`;
            }
            
            const storageStatus = document.getElementById('storageStatus');
            if (storageStatus) {
                storageStatus.textContent = `${totalQuotes} quotes stored`;
            }
        } catch (error) {
            console.error('Error updating storage info:', error);
        }
    }

    /**
     * Show notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type
     */
    showNotification(message, type = 'info') {
        this.filterSystem.showNotification(message, type);
    }
}

// ============================================
// GLOBAL FUNCTIONS (Required by the task)
// ============================================

/**
 * Global populateCategories function as required by the task
 * This function populates the category dropdown from the quotes array
 */
function populateCategories() {
    try {
        // Get the quotes array from localStorage or use default
        const quotes = JSON.parse(localStorage.getItem('dynamic_quotes_v3')) || [];
        
        // Get unique categories using Set and map
        const categories = ['all', ...new Set(quotes.map(quote => quote.category))];
        
        // Get the category filter element
        const categoryFilter = document.getElementById('categoryFilter');
        if (!categoryFilter) {
            console.error('Category filter element not found');
            return;
        }
        
        // Clear existing options (keep the first one)
        while (categoryFilter.options.length > 1) {
            categoryFilter.remove(1);
        }
        
        // Add categories to dropdown
        categories.forEach(category => {
            if (category === 'all') return; // Skip "all" as it's already there
            
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilter.appendChild(option);
        });
        
        console.log(`populateCategories: Added ${categories.length - 1} categories to dropdown`);
        
    } catch (error) {
        console.error('Error in populateCategories:', error);
    }
}

/**
 * Global filterQuotes function as required by the task
 * This function filters quotes based on selected category
 */
function filterQuotes() {
    try {
        const categoryFilter = document.getElementById('categoryFilter');
        if (!categoryFilter) return;
        
        const selectedCategory = categoryFilter.value;
        
        // Get all quotes
        const quotes = JSON.parse(localStorage.getItem('dynamic_quotes_v3')) || [];
        
        // Filter quotes based on selected category
        let filteredQuotes;
        if (selectedCategory === 'all') {
            filteredQuotes = quotes;
        } else {
            filteredQuotes = quotes.filter(quote => quote.category === selectedCategory);
        }
        
        // Update quote count display
        const filteredCount = document.getElementById('filteredCount');
        if (filteredCount) {
            filteredCount.textContent = filteredQuotes.length;
        }
        
        // Update current filter display
        const currentFilterDisplay = document.getElementById('currentFilterDisplay');
        if (currentFilterDisplay) {
            currentFilterDisplay.textContent = selectedCategory === 'all' ? 'All Categories' : selectedCategory;
        }
        
        // Save last selected filter to localStorage
        localStorage.setItem('lastSelectedFilter', selectedCategory);
        
        console.log(`filterQuotes: Filtered ${filteredQuotes.length} quotes for category "${selectedCategory}"`);
        
        // Return filtered quotes for further processing
        return filteredQuotes;
        
    } catch (error) {
        console.error('Error in filterQuotes:', error);
        return [];
    }
}

/**
 * Global function to update categories when a new quote is added
 * This updates the dropdown if a new category is introduced
 */
function updateCategoriesOnNewQuote(newCategory) {
    try {
        if (!newCategory) return;
        
        // Get current categories from localStorage
        const storedCategories = localStorage.getItem('quoteCategories');
        let categories = storedCategories ? JSON.parse(storedCategories) : [];
        
        // Check if category already exists
        if (!categories.includes(newCategory)) {
            // Add new category
            categories.push(newCategory);
            categories.sort();
            
            // Save updated categories
            localStorage.setItem('quoteCategories', JSON.stringify(categories));
            
            // Repopulate the dropdown
            populateCategories();
            
            console.log(`updateCategoriesOnNewQuote: Added new category "${newCategory}"`);
        }
    } catch (error) {
        console.error('Error in updateCategoriesOnNewQuote:', error);
    }
}

// ============================================
// APPLICATION INITIALIZATION
// ============================================

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the main app
    const app = new DynamicQuoteApp();
    
    // Make app available globally for debugging
    window.quoteApp = app;
    
    // Call global populateCategories function
    populateCategories();
    
    // Load last selected filter and apply it
    const lastFilter = localStorage.getItem('lastSelectedFilter') || 'all';
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.value = lastFilter;
        filterQuotes(); // Apply the filter
    }
    
    // Set up filter change listener
    if (categoryFilter) {
        categoryFilter.addEventListener('change', filterQuotes);
    }
    
    console.log('Dynamic Quote Generator fully initialized');
});

// Make functions available globally
window.populateCategories = populateCategories;
window.filterQuotes = filterQuotes;
window.updateCategoriesOnNewQuote = updateCategoriesOnNewQuote;
