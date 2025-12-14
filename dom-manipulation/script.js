// ============================================
// MODULE 1: DATA TRANSFORMATION WITH MAP
// ============================================

class DataTransformer {
    constructor(storage) {
        this.storage = storage;
    }

    // ========== MAP FUNCTION IMPLEMENTATIONS ==========
    
    /**
     * Transform quotes using map to extract specific properties
     * @param {Function} transformFn - Function to apply to each quote
     * @returns {Array} Transformed array
     */
    transformQuotes(transformFn) {
        const quotes = this.storage.getAllQuotes();
        return quotes.map(transformFn);
    }

    /**
     * Map quotes to simplified format for display
     * @returns {Array} Array of simplified quote objects
     */
    getSimplifiedQuotes() {
        return this.transformQuotes(quote => ({
            id: quote.id,
            text: quote.text.length > 100 ? quote.text.substring(0, 100) + '...' : quote.text,
            category: quote.category,
            author: quote.author || 'Unknown',
            displayDate: new Date(quote.createdAt).toLocaleDateString()
        }));
    }

    /**
     * Map quotes to category statistics
     * @returns {Array} Array of category statistics
     */
    getCategoryStatistics() {
        const quotes = this.storage.getAllQuotes();
        
        // First, group by category using reduce
        const categoryMap = quotes.reduce((acc, quote) => {
            acc[quote.category] = (acc[quote.category] || 0) + 1;
            return acc;
        }, {});
        
        // Then transform to array using map
        return Object.entries(categoryMap).map(([category, count]) => ({
            category,
            count,
            percentage: Math.round((count / quotes.length) * 100)
        }));
    }

    /**
     * Map quotes to storage statistics
     * @returns {Array} Array of storage statistics
     */
    getStorageStatistics() {
        const quotes = this.storage.getAllQuotes();
        return quotes.map(quote => ({
            id: quote.id,
            storageType: quote.storageType,
            sizeEstimate: JSON.stringify(quote).length,
            isLocal: quote.storageType === 'local'
        }));
    }

    /**
     * Map quotes to searchable format
     * @returns {Array} Array of searchable quote data
     */
    getSearchableData() {
        return this.transformQuotes(quote => ({
            id: quote.id,
            searchText: `${quote.text} ${quote.category} ${quote.author || ''}`.toLowerCase(),
            tags: quote.tags || [],
            fullText: quote.text,
            category: quote.category
        }));
    }

    /**
     * Map categories with their quotes using nested maps
     * @returns {Array} Array of categories with their quotes
     */
    getCategoriesWithQuotes() {
        const quotes = this.storage.getAllQuotes();
        const categories = [...new Set(quotes.map(q => q.category))];
        
        return categories.map(category => {
            const categoryQuotes = quotes
                .filter(q => q.category === category)
                .map(quote => ({
                    id: quote.id,
                    text: quote.text,
                    author: quote.author || 'Unknown',
                    date: new Date(quote.createdAt).toLocaleDateString()
                }));
            
            return {
                category,
                quoteCount: categoryQuotes.length,
                quotes: categoryQuotes,
                latestQuote: categoryQuotes[categoryQuotes.length - 1]
            };
        });
    }

    /**
     * Map quotes to export format with metadata
     * @returns {Array} Array of export-ready quote objects
     */
    getExportData() {
        return this.transformQuotes(quote => ({
            ...quote,
            exportDate: new Date().toISOString(),
            formattedDate: new Date(quote.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }),
            wordCount: quote.text.split(' ').length,
            characterCount: quote.text.length,
            isFeatured: (quote.popularity || 0) > 80
        }));
    }

    /**
     * Transform filter results using map
     * @param {Array} filteredQuotes - Array of filtered quotes
     * @returns {Array} Transformed results for display
     */
    transformFilterResults(filteredQuotes) {
        return filteredQuotes.map((quote, index) => ({
            index: index + 1,
            ...quote,
            displayIndex: `#${index + 1}`,
            isEven: index % 2 === 0,
            highlightClass: quote.popularity > 90 ? 'highlight-popular' : 'normal'
        }));
    }
}

// ============================================
// MODULE 2: ENHANCED FILTERING SYSTEM WITH MAP
// ============================================

class EnhancedFilterSystem {
    constructor(storage, dataTransformer) {
        this.storage = storage;
        this.transformer = dataTransformer;
        this.currentFilters = {
            category: 'all',
            searchQuery: '',
            storageTypes: ['local', 'session'],
            sortBy: 'date-desc',
            dateRange: 'all'
        };
        
        this.initializeFilterElements();
    }

    initializeFilterElements() {
        this.categoryFilter = document.getElementById('categoryFilter');
        this.searchInput = document.getElementById('searchInput');
        this.searchButton = document.getElementById('searchButton');
        this.clearSearch = document.getElementById('clearSearch');
        this.resetFilters = document.getElementById('resetFilters');
        
        // Bind events
        this.categoryFilter.addEventListener('change', (e) => this.handleCategoryChange(e));
        this.searchButton.addEventListener('click', () => this.handleSearch());
        this.clearSearch.addEventListener('click', () => this.clearSearchQuery());
        this.resetFilters.addEventListener('click', () => this.resetAllFilters());
        
        // Map all sort buttons and bind events
        this.sortButtons = document.querySelectorAll('.sort-btn');
        this.sortButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const sortBy = e.target.dataset.sort;
                this.handleSortChange(sortBy);
            });
        });
    }

    // ========== MAP-BASED FILTERING ==========
    
    /**
     * Apply all active filters using map and filter
     * @returns {Array} Filtered and sorted quotes
     */
    applyFilters() {
        let quotes = this.storage.getAllQuotes();
        
        // Apply category filter using filter
        if (this.currentFilters.category !== 'all') {
            quotes = quotes.filter(quote => quote.category === this.currentFilters.category);
        }
        
        // Apply search filter using filter and map
        if (this.currentFilters.searchQuery) {
            const query = this.currentFilters.searchQuery.toLowerCase();
            quotes = quotes.filter(quote => 
                `${quote.text} ${quote.category} ${quote.author || ''}`
                    .toLowerCase()
                    .includes(query)
            );
        }
        
        // Apply storage type filter using filter
        const storageFilters = this.currentFilters.storageTypes;
        if (storageFilters.length < 2) {
            quotes = quotes.filter(quote => storageFilters.includes(quote.storageType));
        }
        
        // Sort quotes using map for custom sorting
        quotes = this.sortQuotes(quotes);
        
        // Transform for display using map
        return this.transformer.transformFilterResults(quotes);
    }

    /**
     * Advanced search with map for highlighting matches
     * @param {string} query - Search query
     * @returns {Array} Search results with highlights
     */
    advancedSearch(query) {
        const allQuotes = this.storage.getAllQuotes();
        const searchableData = this.transformer.getSearchableData();
        
        return searchableData
            .map((data, index) => ({
                ...data,
                originalQuote: allQuotes[index],
                matchScore: this.calculateMatchScore(data.searchText, query)
            }))
            .filter(data => data.matchScore > 0)
            .sort((a, b) => b.matchScore - a.matchScore)
            .map(result => ({
                ...result.originalQuote,
                matchScore: result.matchScore,
                highlightedText: this.highlightMatches(result.originalQuote.text, query)
            }));
    }

    /**
     * Calculate match score for search
     * @param {string} text - Text to search in
     * @param {string} query - Search query
     * @returns {number} Match score
     */
    calculateMatchScore(text, query) {
        if (!query) return 0;
        
        const queryWords = query.toLowerCase().split(' ');
        const textWords = text.toLowerCase().split(' ');
        
        // Calculate score based on word matches
        return queryWords.reduce((score, word) => {
            if (text.includes(word)) {
                return score + (word.length * 2); // Weight by word length
            }
            return score;
        }, 0);
    }

    /**
     * Highlight search matches in text
     * @param {string} text - Original text
     * @param {string} query - Search query
     * @returns {string} Text with highlighted matches
     */
    highlightMatches(text, query) {
        if (!query) return text;
        
        const queryWords = query.split(' ').filter(word => word.length > 0);
        let highlighted = text;
        
        queryWords.forEach(word => {
            const regex = new RegExp(`(${word})`, 'gi');
            highlighted = highlighted.replace(regex, '<mark>$1</mark>');
        });
        
        return highlighted;
    }

    /**
     * Sort quotes using custom comparison with map for preprocessing
     * @param {Array} quotes - Array of quotes
     * @returns {Array} Sorted quotes
     */
    sortQuotes(quotes) {
        // Pre-process quotes with map for sorting
        const processedQuotes = quotes.map(quote => ({
            ...quote,
            sortKey: this.getSortKey(quote)
        }));
        
        // Sort based on current sortBy
        processedQuotes.sort((a, b) => {
            switch(this.currentFilters.sortBy) {
                case 'date-desc':
                    return new Date(b.createdAt) - new Date(a.createdAt);
                case 'date-asc':
                    return new Date(a.createdAt) - new Date(b.createdAt);
                case 'category':
                    return a.category.localeCompare(b.category);
                case 'popularity':
                    return (b.popularity || 0) - (a.popularity || 0);
                case 'length':
                    return b.text.length - a.text.length;
                case 'author':
                    return (a.author || '').localeCompare(b.author || '');
                default:
                    return 0;
            }
        });
        
        // Remove sortKey and return
        return processedQuotes.map(({sortKey, ...quote}) => quote);
    }

    /**
     * Get sort key for quote based on current sort
     * @param {Object} quote - Quote object
     * @returns {string} Sort key
     */
    getSortKey(quote) {
        switch(this.currentFilters.sortBy) {
            case 'date-desc':
            case 'date-asc':
                return new Date(quote.createdAt).getTime();
            case 'category':
                return quote.category;
            case 'popularity':
                return String(100 - (quote.popularity || 0)).padStart(3, '0');
            case 'length':
                return String(10000 - quote.text.length).padStart(5, '0');
            case 'author':
                return quote.author || 'zzz';
            default:
                return '';
        }
    }

    /**
     * Get unique categories using map and Set
     * @returns {Array} Array of unique categories
     */
    getUniqueCategories() {
        const quotes = this.storage.getAllQuotes();
        return [...new Set(quotes.map(quote => quote.category))].sort();
    }

    /**
     * Update category filter dropdown using map
     */
    updateCategoryFilter() {
        const categories = ['all', ...this.getUniqueCategories()];
        
        // Clear existing options
        this.categoryFilter.innerHTML = '';
        
        // Create options using map
        const options = categories.map(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category === 'all' ? 'All Categories' : category;
            if (category === this.currentFilters.category) {
                option.selected = true;
            }
            return option;
        });
        
        // Append all options
        options.forEach(option => this.categoryFilter.appendChild(option));
    }

    // ========== EVENT HANDLERS ==========
    
    handleCategoryChange(event) {
        this.currentFilters.category = event.target.value;
        this.displayFilteredResults();
    }

    handleSearch() {
        const query = this.searchInput.value.trim();
        this.currentFilters.searchQuery = query;
        
        if (query) {
            const results = this.advancedSearch(query);
            this.displaySearchResults(results);
        } else {
            this.displayFilteredResults();
        }
    }

    clearSearchQuery() {
        this.searchInput.value = '';
        this.currentFilters.searchQuery = '';
        this.displayFilteredResults();
    }

    handleSortChange(sortBy) {
        this.currentFilters.sortBy = sortBy;
        
        // Update button states using map
        this.sortButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.sort === sortBy);
        });
        
        this.displayFilteredResults();
    }

    resetAllFilters() {
        this.currentFilters = {
            category: 'all',
            searchQuery: '',
            storageTypes: ['local', 'session'],
            sortBy: 'date-desc',
            dateRange: 'all'
        };
        
        this.searchInput.value = '';
        this.updateCategoryFilter();
        
        // Reset sort buttons
        this.sortButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.sort === 'date-desc');
        });
        
        this.displayFilteredResults();
    }

    // ========== DISPLAY METHODS ==========
    
    displayFilteredResults() {
        const filteredQuotes = this.applyFilters();
        this.renderQuotesGrid(filteredQuotes);
        this.updateStatsDisplay(filteredQuotes);
    }

    displaySearchResults(results) {
        this.renderQuotesGrid(results, true);
        this.updateStatsDisplay(results);
        
        // Show search-specific info
        if (results.length > 0) {
            this.showNotification(`Found ${results.length} matches for "${this.currentFilters.searchQuery}"`, 'success');
        } else {
            this.showNotification(`No matches found for "${this.currentFilters.searchQuery}"`, 'info');
        }
    }

    renderQuotesGrid(quotes, isSearch = false) {
        const container = document.getElementById('quotesGridContainer');
        
        if (quotes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">🔍</div>
                    <h3>No quotes found</h3>
                    <p>${isSearch ? 'Try a different search term' : 'Try adjusting your filters or add some quotes'}</p>
                </div>
            `;
            return;
        }
        
        // Create grid using map
        const gridHTML = `
            <div class="quotes-grid">
                ${quotes.map((quote, index) => this.createQuoteCard(quote, index, isSearch)).join('')}
            </div>
        `;
        
        container.innerHTML = gridHTML;
        
        // Add event listeners to cards
        this.addQuoteCardEventListeners();
    }

    createQuoteCard(quote, index, isSearch = false) {
        const highlightClass = quote.matchScore > 50 ? 'highlight-high' : 
                              quote.matchScore > 20 ? 'highlight-medium' : '';
        
        return `
            <div class="quote-card ${highlightClass}" data-id="${quote.id}">
                <div class="quote-text">
                    ${isSearch && quote.highlightedText ? quote.highlightedText : `"${quote.text}"`}
                </div>
                <div class="quote-author">— ${quote.author || 'Unknown'}</div>
                <div class="quote-meta">
                    <span class="quote-category">${quote.category}</span>
                    <span class="quote-date">${new Date(quote.createdAt).toLocaleDateString()}</span>
                </div>
                ${quote.matchScore ? `
                    <div class="search-match" style="margin-top: 10px; font-size: 0.8rem; color: #10b981;">
                        <i class="fas fa-search"></i> Match: ${quote.matchScore}%
                    </div>
                ` : ''}
                ${quote.displayIndex ? `
                    <div class="quote-index" style="position: absolute; top: 10px; right: 10px; background: #667eea; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.8rem;">
                        ${quote.displayIndex}
                    </div>
                ` : ''}
            </div>
        `;
    }

    updateStatsDisplay(quotes) {
        // Update various stats displays using map
        const stats = {
            total: quotes.length,
            categories: [...new Set(quotes.map(q => q.category))].length,
            averageLength: Math.round(quotes.reduce((sum, q) => sum + q.text.length, 0) / quotes.length) || 0,
            storageTypes: {
                local: quotes.filter(q => q.storageType === 'local').length,
                session: quotes.filter(q => q.storageType === 'session').length
            }
        };
        
        // Update DOM elements
        document.getElementById('filteredCount').textContent = stats.total;
        document.getElementById('categoryQuoteCount').textContent = stats.categories;
        
        // Update category stats display
        const categoryStats = this.transformer.getCategoryStatistics();
        this.displayCategoryStats(categoryStats);
    }

    displayCategoryStats(stats) {
        const container = document.getElementById('categoryButtons');
        if (!container) return;
        
        container.innerHTML = stats.map(stat => `
            <button class="filter-btn ${this.currentFilters.category === stat.category ? 'active' : ''}" 
                    data-category="${stat.category}">
                ${stat.category}
                <span class="count">${stat.count}</span>
                <span class="percentage">${stat.percentage}%</span>
            </button>
        `).join('');
        
        // Add event listeners to category buttons
        container.querySelectorAll('.filter-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const category = e.currentTarget.dataset.category;
                this.currentFilters.category = category;
                this.updateCategoryFilter();
                this.displayFilteredResults();
            });
        });
    }

    addQuoteCardEventListeners() {
        document.querySelectorAll('.quote-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    const quoteId = card.dataset.id;
                    this.showQuoteDetail(quoteId);
                }
            });
        });
    }

    showQuoteDetail(quoteId) {
        const quotes = this.storage.getAllQuotes();
        const quote = quotes.find(q => q.id === quoteId);
        
        if (quote) {
            // Show quote in main display
            document.getElementById('quoteText').textContent = `"${quote.text}"`;
            document.getElementById('quoteCategory').textContent = quote.category;
            document.getElementById('quoteSource').textContent = quote.author || 'Unknown';
            
            this.showNotification(`Showing quote from ${quote.category}`, 'info');
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 
                               type === 'error' ? 'exclamation-circle' : 
                               type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // ========== INITIALIZATION ==========
    
    initialize() {
        this.updateCategoryFilter();
        this.displayFilteredResults();
        
        // Initialize with category statistics
        const categoryStats = this.transformer.getCategoryStatistics();
        this.displayCategoryStats(categoryStats);
        
        console.log('Enhanced Filter System initialized with map functionality');
    }
}

// ============================================
// ENHANCED STORAGE CLASS WITH MAP METHODS
// ============================================

class EnhancedQuoteStorage {
    constructor() {
        this.STORAGE_KEYS = {
            LOCAL_QUOTES: 'dynamic_quote_generator_quotes_v3',
            USER_PREFERENCES: 'quote_generator_prefs_v3'
        };
        
        this.quotes = this.loadQuotes();
    }

    // ========== MAP-BASED DATA METHODS ==========
    
    /**
     * Get all quotes with optional transformation
     * @param {Function} transformFn - Optional transformation function
     * @returns {Array} Array of quotes (transformed if function provided)
     */
    getAllQuotes(transformFn = null) {
        const quotes = this.loadQuotes();
        return transformFn ? quotes.map(transformFn) : quotes;
    }

    /**
     * Get quotes by category using map and filter
     * @param {string} category - Category to filter by
     * @returns {Array} Array of quotes in category
     */
    getQuotesByCategory(category) {
        if (category === 'all') return this.getAllQuotes();
        return this.getAllQuotes().filter(quote => quote.category === category);
    }

    /**
     * Get unique categories using map and Set
     * @returns {Array} Array of unique categories
     */
    getAllCategories() {
        const quotes = this.getAllQuotes();
        return ['all', ...new Set(quotes.map(quote => quote.category))];
    }

    /**
     * Get category statistics using map and reduce
     * @returns {Object} Category statistics
     */
    getCategoryStats() {
        const quotes = this.getAllQuotes();
        return quotes.reduce((stats, quote) => {
            stats[quote.category] = (stats[quote.category] || 0) + 1;
            return stats;
        }, {});
    }

    /**
     * Search quotes with ranking using map
     * @param {string} query - Search query
     * @returns {Array} Search results with scores
     */
    searchQuotes(query) {
        if (!query) return this.getAllQuotes();
        
        const searchableQuotes = this.getAllQuotes().map(quote => ({
            ...quote,
            searchScore: this.calculateSearchScore(quote, query)
        }));
        
        return searchableQuotes
            .filter(quote => quote.searchScore > 0)
            .sort((a, b) => b.searchScore - a.searchScore);
    }

    /**
     * Calculate search score for a quote
     * @param {Object} quote - Quote object
     * @param {string} query - Search query
     * @returns {number} Search score
     */
    calculateSearchScore(quote, query) {
        const searchFields = [
            quote.text,
            quote.category,
            quote.author || '',
            ...(quote.tags || [])
        ].join(' ').toLowerCase();
        
        const queryWords = query.toLowerCase().split(' ');
        let score = 0;
        
        queryWords.forEach(word => {
            if (searchFields.includes(word)) {
                score += 10;
                // Bonus for exact matches in text
                if (quote.text.toLowerCase().includes(word)) {
                    score += 5;
                }
                // Bonus for category matches
                if (quote.category.toLowerCase().includes(word)) {
                    score += 3;
                }
            }
        });
        
        return score;
    }

    /**
     * Get quotes sorted by various criteria using map
     * @param {string} sortBy - Sort criteria
     * @returns {Array} Sorted quotes
     */
    getSortedQuotes(sortBy = 'date-desc') {
        const quotes = this.getAllQuotes();
        
        // Add sort keys using map
        const quotesWithSortKeys = quotes.map(quote => ({
            ...quote,
            sortKey: this.getQuoteSortKey(quote, sortBy)
        }));
        
        // Sort based on sort key
        quotesWithSortKeys.sort((a, b) => {
            if (typeof a.sortKey === 'number') {
                return sortBy.includes('desc') ? b.sortKey - a.sortKey : a.sortKey - b.sortKey;
            }
            return sortBy.includes('desc') 
                ? b.sortKey.localeCompare(a.sortKey)
                : a.sortKey.localeCompare(b.sortKey);
        });
        
        // Remove sort keys
        return quotesWithSortKeys.map(({sortKey, ...quote}) => quote);
    }

    /**
     * Get sort key for a quote
     * @param {Object} quote - Quote object
     * @param {string} sortBy - Sort criteria
     * @returns {string|number} Sort key
     */
    getQuoteSortKey(quote, sortBy) {
        switch(sortBy.replace('-desc', '').replace('-asc', '')) {
            case 'date':
                return new Date(quote.createdAt).getTime();
            case 'category':
                return quote.category;
            case 'author':
                return quote.author || 'zzz';
            case 'length':
                return quote.text.length;
            case 'popularity':
                return quote.popularity || 0;
            default:
                return 0;
        }
    }

    /**
     * Export quotes in various formats using map
     * @param {string} format - Export format
     * @returns {string} Exported data
     */
    exportQuotes(format = 'json') {
        const quotes = this.getAllQuotes();
        
        switch(format) {
            case 'json':
                const exportData = {
                    version: '3.0',
                    exportDate: new Date().toISOString(),
                    totalQuotes: quotes.length,
                    quotes: quotes.map(quote => ({
                        text: quote.text,
                        author: quote.author,
                        category: quote.category,
                        tags: quote.tags || [],
                        createdAt: quote.createdAt
                    })),
                    statistics: {
                        categories: this.getCategoryStats(),
                        totalCharacters: quotes.reduce((sum, q) => sum + q.text.length, 0),
                        averageLength: Math.round(quotes.reduce((sum, q) => sum + q.text.length, 0) / quotes.length)
                    }
                };
                return JSON.stringify(exportData, null, 2);
                
            case 'csv':
                const headers = ['Text', 'Author', 'Category', 'Date'];
                const csvRows = quotes.map(quote => [
                    `"${quote.text.replace(/"/g, '""')}"`,
                    `"${quote.author || 'Unknown'}"`,
                    `"${quote.category}"`,
                    `"${new Date(quote.createdAt).toLocaleDateString()}"`
                ].join(','));
                return [headers.join(','), ...csvRows].join('\n');
                
            case 'html':
                const htmlQuotes = quotes.map(quote => `
                    <div class="exported-quote">
                        <blockquote>"${quote.text}"</blockquote>
                        <cite>— ${quote.author || 'Unknown'}</cite>
                        <div class="category">${quote.category}</div>
                        <div class="date">${new Date(quote.createdAt).toLocaleDateString()}</div>
                    </div>
                `).join('\n');
                return `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Exported Quotes</title>
                        <style>
                            .exported-quote { margin: 20px; padding: 20px; border-left: 4px solid #667eea; }
                            blockquote { font-style: italic; font-size: 1.2em; }
                            cite { display: block; margin-top: 10px; color: #666; }
                            .category { display: inline-block; background: #667eea; color: white; padding: 5px 10px; border-radius: 3px; }
                        </style>
                    </head>
                    <body>
                        <h1>Exported Quotes</h1>
                        ${htmlQuotes}
                    </body>
                    </html>
                `;
                
            default:
                return '';
        }
    }

    // ========== STORAGE METHODS ==========
    
    loadQuotes() {
        try {
            const storedQuotes = localStorage.getItem(this.STORAGE_KEYS.LOCAL_QUOTES);
            if (storedQuotes) {
                return JSON.parse(storedQuotes);
            }
        } catch (error) {
            console.error('Error loading quotes:', error);
        }
        
        return this.getDefaultQuotes();
    }

    saveQuotes() {
        try {
            localStorage.setItem(this.STORAGE_KEYS.LOCAL_QUOTES, JSON.stringify(this.quotes));
            return true;
        } catch (error) {
            console.error('Error saving quotes:', error);
            return false;
        }
    }

    addQuote(quote) {
        const newQuote = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            ...quote,
            createdAt: new Date().toISOString(),
            storageType: 'local',
            popularity: Math.floor(Math.random() * 100)
        };
        
        this.quotes.push(newQuote);
        this.saveQuotes();
        return newQuote;
    }

    // ========== DEFAULT DATA ==========
    
    getDefaultQuotes() {
        return [
            {
                id: '1',
                text: "The only way to do great work is to love what you do.",
                author: "Steve Jobs",
                category: "Inspiration",
                createdAt: new Date().toISOString(),
                storageType: "local",
                popularity: 95,
                tags: ["work", "passion", "success"]
            },
            {
                id: '2',
                text: "Life is what happens to you while you're busy making other plans.",
                author: "Allen Saunders",
                category: "Life",
                createdAt: new Date().toISOString(),
                storageType: "local",
                popularity: 88,
                tags: ["life", "plans", "wisdom"]
            },
            {
                id: '3',
                text: "The future belongs to those who believe in the beauty of their dreams.",
                author: "Eleanor Roosevelt",
                category: "Dreams",
                createdAt: new Date().toISOString(),
                storageType: "local",
                popularity: 92,
                tags: ["future", "dreams", "hope"]
            },
            {
                id: '4',
                text: "It does not matter how slowly you go as long as you do not stop.",
                author: "Confucius",
                category: "Perseverance",
                createdAt: new Date().toISOString(),
                storageType: "local",
                popularity: 85,
                tags: ["perseverance", "progress", "determination"]
            },
            {
                id: '5',
                text: "In the middle of difficulty lies opportunity.",
                author: "Albert Einstein",
                category: "Opportunity",
                createdAt: new Date().toISOString(),
                storageType: "local",
                popularity: 90,
                tags: ["opportunity", "challenge", "growth"]
            },
            {
                id: '6',
                text: "Be yourself; everyone else is already taken.",
                author: "Oscar Wilde",
                category: "Humor",
                createdAt: new Date().toISOString(),
                storageType: "local",
                popularity: 87,
                tags: ["humor", "authenticity", "self"]
            }
        ];
    }
}

// ============================================
// MAIN APPLICATION WITH MAP INTEGRATION
// ============================================

class DynamicQuoteGenerator {
    constructor() {
        this.storage = new EnhancedQuoteStorage();
        this.dataTransformer = new DataTransformer(this.storage);
        this.filterSystem = new EnhancedFilterSystem(this.storage, this.dataTransformer);
        
        this.initializeUI();
        this.bindEvents();
    }

    initializeUI() {
        // Get DOM elements
        this.quoteTextElement = document.getElementById('quoteText');
        this.quoteCategoryElement = document.getElementById('quoteCategory');
        this.quoteSourceElement = document.getElementById('quoteSource');
        
        // Form elements
        this.newQuoteTextInput = document.getElementById('newQuoteText');
        this.newQuoteAuthorInput = document.getElementById('newQuoteAuthor');
        this.newQuoteCategoryInput = document.getElementById('newQuoteCategory');
        
        // Action buttons
        this.addQuoteBtn = document.getElementById('addQuoteBtn');
        this.toggleFormBtn = document.getElementById('toggleForm');
        this.exportJsonBtn = document.getElementById('exportJson');
        
        // Initialize map-based displays
        this.initializeMapBasedDisplays();
    }

    initializeMapBasedDisplays() {
        // Initialize category suggestions using map
        this.updateCategorySuggestions();
        
        // Initialize stats display
        this.updateStatsDisplay();
    }

    updateCategorySuggestions() {
        const categories = this.storage.getAllCategories().filter(cat => cat !== 'all');
        const datalist = document.getElementById('categorySuggestions');
        
        datalist.innerHTML = categories
            .map(category => `<option value="${category}">${category}</option>`)
            .join('');
    }

    updateStatsDisplay() {
        // Get statistics using map methods
        const categoryStats = this.dataTransformer.getCategoryStatistics();
        const storageStats = this.dataTransformer.getStorageStatistics();
        
        // Update category stats
        this.displayCategoryStatistics(categoryStats);
        
        // Update storage stats
        this.displayStorageStatistics(storageStats);
    }

    displayCategoryStatistics(stats) {
        const container = document.getElementById('categoryButtons');
        if (!container) return;
        
        container.innerHTML = stats
            .map(stat => `
                <button class="filter-btn" data-category="${stat.category}">
                    ${stat.category}
                    <span class="count">${stat.count}</span>
                    <span class="percentage">${stat.percentage}%</span>
                </button>
            `)
            .join('');
    }

    displayStorageStatistics(stats) {
        const localQuotes = stats.filter(s => s.isLocal).length;
        const totalSize = stats.reduce((sum, s) => sum + s.sizeEstimate, 0);
        
        // Update DOM elements
        document.getElementById('localStorageUsage').textContent = 
            `${Math.round(totalSize / 1024 * 100) / 100} KB`;
        document.getElementById('totalQuotes').textContent = stats.length;
    }

    bindEvents() {
        // Quote display
        document.getElementById('newQuote').addEventListener('click', () => this.showRandomQuote());
        
        // Form handling
        this.toggleFormBtn.addEventListener('click', () => this.toggleAddQuoteForm());
        this.addQuoteBtn.addEventListener('click', () => this.handleAddQuote());
        
        // Export functionality
        this.exportJsonBtn.addEventListener('click', () => this.handleExport());
        
        // Other buttons
        document.getElementById('showAllQuotes').addEventListener('click', () => this.showAllQuotes());
        document.getElementById('clearAll').addEventListener('click', () => this.handleClearAll());
    }

    showRandomQuote() {
        const quotes = this.storage.getAllQuotes();
        if (quotes.length === 0) {
            this.displayMessage("No quotes available. Add some quotes!");
            return;
        }
        
        const randomIndex = Math.floor(Math.random() * quotes.length);
        const quote = quotes[randomIndex];
        this.displayQuote(quote);
    }

    displayQuote(quote) {
        this.quoteTextElement.textContent = `"${quote.text}"`;
        this.quoteCategoryElement.textContent = quote.category;
        this.quoteSourceElement.textContent = `— ${quote.author || 'Unknown'}`;
        
        // Add animation
        this.quoteTextElement.style.opacity = '0';
        setTimeout(() => {
            this.quoteTextElement.style.opacity = '1';
            this.quoteTextElement.style.transition = 'opacity 0.5s ease';
        }, 50);
    }

    toggleAddQuoteForm() {
        const form = document.getElementById('addQuoteForm');
        form.classList.toggle('active');
    }

    handleAddQuote() {
        const text = this.newQuoteTextInput.value.trim();
        const author = this.newQuoteAuthorInput.value.trim();
        const category = this.newQuoteCategoryInput.value.trim();
        
        if (!text || !category) {
            this.displayMessage("Please enter both quote text and category", "error");
            return;
        }
        
        const newQuote = this.storage.addQuote({ text, author, category });
        
        // Clear form
        this.newQuoteTextInput.value = '';
        this.newQuoteAuthorInput.value = '';
        this.newQuoteCategoryInput.value = '';
        
        // Update displays
        this.updateCategorySuggestions();
        this.filterSystem.updateCategoryFilter();
        this.filterSystem.displayFilteredResults();
        
        // Show the new quote
        this.displayQuote(newQuote);
        
        this.displayMessage("Quote added successfully!", "success");
    }

    handleExport() {
        const exportData = this.storage.exportQuotes('json');
        const blob = new Blob([exportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `quotes_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.displayMessage("Quotes exported successfully!", "success");
    }

    showAllQuotes() {
        this.filterSystem.resetAllFilters();
        this.filterSystem.displayFilteredResults();
    }

    handleClearAll() {
        if (confirm("Are you sure you want to clear all data? This cannot be undone.")) {
            localStorage.clear();
            this.storage = new EnhancedQuoteStorage();
            this.filterSystem = new EnhancedFilterSystem(this.storage, this.dataTransformer);
            this.filterSystem.initialize();
            this.updateCategorySuggestions();
            this.displayMessage("All data cleared!", "warning");
        }
    }

    displayMessage(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    }

    // ========== DEMONSTRATION OF MAP METHODS ==========
    
    demonstrateMapMethods() {
        console.log("=== Demonstrating Map Methods ===");
        
        // 1. Basic map: Transform quotes to text only
        const quoteTexts = this.storage.getAllQuotes().map(quote => quote.text);
        console.log("Quote texts:", quoteTexts);
        
        // 2. Map with index: Add position to each quote
        const quotesWithPosition = this.storage.getAllQuotes().map((quote, index) => ({
            position: index + 1,
            ...quote,
            isFirst: index === 0,
            isLast: index === this.storage.getAllQuotes().length - 1
        }));
        console.log("Quotes with position:", quotesWithPosition);
        
        // 3. Nested map: Transform categories with their quotes
        const categoriesWithQuotes = this.storage.getAllCategories()
            .filter(cat => cat !== 'all')
            .map(category => ({
                category,
                quotes: this.storage.getQuotesByCategory(category)
                    .map(q => ({ text: q.text, author: q.author }))
            }));
        console.log("Categories with quotes:", categoriesWithQuotes);
        
        // 4. Map for data processing: Calculate statistics
        const quoteStats = this.storage.getAllQuotes().map(quote => ({
            id: quote.id,
            wordCount: quote.text.split(' ').length,
            charCount: quote.text.length,
            hasAuthor: !!quote.author,
            categoryLength: quote.category.length
        }));
        console.log("Quote statistics:", quoteStats);
        
        // 5. Map for UI preparation: Prepare data for display
        const displayData = this.storage.getAllQuotes().map((quote, index) => ({
            id: quote.id,
            displayText: `${index + 1}. "${quote.text}"`,
            displayAuthor: quote.author ? `— ${quote.author}` : '— Anonymous',
            displayCategory: `Category: ${quote.category}`,
            displayClass: index % 2 === 0 ? 'even' : 'odd'
        }));
        console.log("Display data:", displayData);
    }

    // ========== INITIALIZATION ==========
    
    initialize() {
        this.filterSystem.initialize();
        this.showRandomQuote();
        this.demonstrateMapMethods();
        
        console.log("Dynamic Quote Generator with Map Methods initialized");
    }
}

// ============================================
// APPLICATION START
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const app = new DynamicQuoteGenerator();
    app.initialize();
    
    // Make app available for debugging
    window.quoteApp = app;
});

// Export for testing
export { EnhancedQuoteStorage, DataTransformer, EnhancedFilterSystem, DynamicQuoteGenerator };
