// ============================================
// MODULE 1: ADVANCED FILTERING SYSTEM
// ============================================

class AdvancedFilterSystem {
    constructor(storage) {
        this.storage = storage;
        this.currentFilters = {
            category: 'all',
            searchQuery: '',
            storageTypes: ['local', 'session'],
            dateRange: 'all',
            sortBy: 'date-desc',
            preset: null
        };
        
        this.recentFilters = this.loadRecentFilters();
        this.filterHistory = [];
        this.filteredQuotes = [];
        this.currentPage = 1;
        this.quotesPerPage = 6;
        
        this.initializeFilterElements();
    }

    // ========== FILTER INITIALIZATION ==========
    
    initializeFilterElements() {
        // Main category filter
        this.categoryFilter = document.getElementById('categoryFilter');
        this.categoryButtons = document.getElementById('categoryButtons');
        this.searchInput = document.getElementById('searchInput');
        this.searchButton = document.getElementById('searchButton');
        this.clearSearch = document.getElementById('clearSearch');
        this.resetFilters = document.getElementById('resetFilters');
        
        // Advanced filter controls
        this.filterLocal = document.getElementById('filterLocal');
        this.filterSession = document.getElementById('filterSession');
        this.filterToday = document.getElementById('filterToday');
        this.filterThisWeek = document.getElementById('filterThisWeek');
        this.filterThisMonth = document.getElementById('filterThisMonth');
        
        // Sort controls
        this.sortButtons = document.querySelectorAll('.sort-btn');
        this.presetButtons = document.querySelectorAll('.preset-btn');
        
        // Display elements
        this.currentFilterDisplay = document.getElementById('currentFilterDisplay');
        this.filteredCount = document.getElementById('filteredCount');
        this.totalCategories = document.getElementById('totalCategories');
        this.selectedCategory = document.getElementById('selectedCategory');
        this.categoryQuoteCount = document.getElementById('categoryQuoteCount');
        this.recentFiltersContainer = document.getElementById('recentFilters');
        this.lastSavedFilter = document.getElementById('lastSavedFilter');
        this.totalQuotesStorage = document.getElementById('totalQuotesStorage');
        
        this.bindFilterEvents();
        this.loadSavedFilters();
    }

    bindFilterEvents() {
        // Category filter dropdown
        this.categoryFilter.addEventListener('change', (e) => {
            this.currentFilters.category = e.target.value;
            this.applyFilters();
            this.saveCurrentFilters();
        });

        // Category buttons
        this.categoryButtons.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-btn')) {
                const category = e.target.dataset.category;
                this.currentFilters.category = category;
                this.updateCategoryFilterUI();
                this.applyFilters();
                this.saveCurrentFilters();
            }
        });

        // Search functionality
        this.searchButton.addEventListener('click', () => this.handleSearch());
        this.clearSearch.addEventListener('click', () => this.clearSearchQuery());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });

        // Advanced filters
        this.filterLocal.addEventListener('change', () => this.applyFilters());
        this.filterSession.addEventListener('change', () => this.applyFilters());
        this.filterToday.addEventListener('change', () => this.updateDateFilter());
        this.filterThisWeek.addEventListener('change', () => this.updateDateFilter());
        this.filterThisMonth.addEventListener('change', () => this.updateDateFilter());

        // Sort buttons
        this.sortButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const sortBy = e.target.dataset.sort || e.target.closest('.sort-btn').dataset.sort;
                this.currentFilters.sortBy = sortBy;
                this.updateSortButtons(sortBy);
                this.applyFilters();
            });
        });

        // Preset filters
        this.presetButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const preset = e.target.dataset.preset || e.target.closest('.preset-btn').dataset.preset;
                this.applyPresetFilter(preset);
            });
        });

        // Reset filters
        this.resetFilters.addEventListener('click', () => this.resetAllFilters());
    }

    // ========== CATEGORY MANAGEMENT ==========
    
    populateCategories() {
        const categories = this.storage.getAllCategories();
        this.totalCategories.textContent = categories.length - 1; // Exclude "All"
        
        // Clear existing options (keep "All" option)
        while (this.categoryFilter.options.length > 1) {
            this.categoryFilter.remove(1);
        }
        
        // Clear category buttons
        this.categoryButtons.innerHTML = '';
        
        // Add categories to dropdown and buttons
        categories.forEach(category => {
            if (category === 'all') return;
            
            // Add to dropdown
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            this.categoryFilter.appendChild(option);
            
            // Add as button
            const button = document.createElement('button');
            button.className = `filter-btn ${category === this.currentFilters.category ? 'active' : ''}`;
            button.dataset.category = category;
            button.textContent = category;
            
            // Add quote count badge
            const quoteCount = this.storage.getQuotesByCategory(category).length;
            const badge = document.createElement('span');
            badge.className = 'count';
            badge.textContent = quoteCount;
            button.appendChild(badge);
            
            this.categoryButtons.appendChild(button);
        });
        
        // Update selected category
        this.categoryFilter.value = this.currentFilters.category;
        this.selectedCategory.textContent = this.currentFilters.category === 'all' ? 'All' : this.currentFilters.category;
        
        // Update category quote count
        const categoryQuotes = this.currentFilters.category === 'all' 
            ? this.storage.getAllQuotes() 
            : this.storage.getQuotesByCategory(this.currentFilters.category);
        this.categoryQuoteCount.textContent = categoryQuotes.length;
        
        // Update data list for category suggestions
        this.updateCategorySuggestions(categories);
    }

    updateCategorySuggestions(categories) {
        const datalist = document.getElementById('categorySuggestions');
        datalist.innerHTML = '';
        
        categories.filter(cat => cat !== 'all').forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            datalist.appendChild(option);
        });
        
        // Update existing categories display
        this.updateExistingCategoriesDisplay(categories);
    }

    updateExistingCategoriesDisplay(categories) {
        const container = document.getElementById('existingCategories');
        container.innerHTML = '';
        
        categories.filter(cat => cat !== 'all').forEach(category => {
            const tag = document.createElement('span');
            tag.className = 'category-tag';
            tag.textContent = category;
            tag.addEventListener('click', () => {
                document.getElementById('newQuoteCategory').value = category;
            });
            container.appendChild(tag);
        });
    }

    // ========== FILTER APPLICATIONS ==========
    
    applyFilters() {
        let quotes = this.storage.getAllQuotes();
        
        // Apply category filter
        if (this.currentFilters.category !== 'all') {
            quotes = quotes.filter(quote => quote.category === this.currentFilters.category);
        }
        
        // Apply search query
        if (this.currentFilters.searchQuery) {
            const query = this.currentFilters.searchQuery.toLowerCase();
            quotes = quotes.filter(quote => 
                quote.text.toLowerCase().includes(query) ||
                quote.category.toLowerCase().includes(query) ||
                (quote.author && quote.author.toLowerCase().includes(query))
            );
        }
        
        // Apply storage type filters
        const storageFilters = [];
        if (this.filterLocal.checked) storageFilters.push('local');
        if (this.filterSession.checked) storageFilters.push('session');
        
        if (storageFilters.length < 2) {
            quotes = quotes.filter(quote => storageFilters.includes(quote.storageType));
        }
        
        // Apply date filter
        quotes = this.applyDateFilter(quotes);
        
        // Apply preset filters
        if (this.currentFilters.preset) {
            quotes = this.applyPresetFilterLogic(quotes, this.currentFilters.preset);
        }
        
        // Sort quotes
        quotes = this.sortQuotes(quotes, this.currentFilters.sortBy);
        
        this.filteredQuotes = quotes;
        this.updateFilterDisplay();
        this.displayFilteredQuotes();
        
        return quotes;
    }

    applyDateFilter(quotes) {
        const today = new Date();
        const oneDay = 24 * 60 * 60 * 1000;
        const oneWeek = 7 * oneDay;
        const oneMonth = 30 * oneDay;
        
        return quotes.filter(quote => {
            const quoteDate = new Date(quote.createdAt);
            const timeDiff = today - quoteDate;
            
            if (this.filterToday.checked && timeDiff <= oneDay) return true;
            if (this.filterThisWeek.checked && timeDiff <= oneWeek) return true;
            if (this.filterThisMonth.checked && timeDiff <= oneMonth) return true;
            
            // If no date filters checked, include all
            if (!this.filterToday.checked && !this.filterThisWeek.checked && !this.filterThisMonth.checked) {
                return true;
            }
            
            return false;
        });
    }

    updateDateFilter() {
        // Ensure only one date filter can be active at a time
        if (this.filterToday.checked) {
            this.filterThisWeek.checked = false;
            this.filterThisMonth.checked = false;
        } else if (this.filterThisWeek.checked) {
            this.filterToday.checked = false;
            this.filterThisMonth.checked = false;
        } else if (this.filterThisMonth.checked) {
            this.filterToday.checked = false;
            this.filterThisWeek.checked = false;
        }
        
        this.applyFilters();
    }

    applyPresetFilter(preset) {
        this.currentFilters.preset = preset;
        
        // Update preset button states
        this.presetButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.preset === preset);
        });
        
        // Apply specific preset logic
        switch(preset) {
            case 'popular':
                this.currentFilters.sortBy = 'popularity';
                break;
            case 'recent':
                this.currentFilters.sortBy = 'date-desc';
                this.filterToday.checked = false;
                this.filterThisWeek.checked = true;
                this.filterThisMonth.checked = false;
                break;
            case 'inspirational':
                this.currentFilters.category = 'Inspiration';
                break;
            case 'funny':
                this.currentFilters.category = 'Humor';
                break;
            case 'wisdom':
                this.currentFilters.category = 'Wisdom';
                break;
        }
        
        this.updateCategoryFilterUI();
        this.updateSortButtons(this.currentFilters.sortBy);
        this.applyFilters();
        this.saveCurrentFilters();
    }

    applyPresetFilterLogic(quotes, preset) {
        switch(preset) {
            case 'popular':
                // Simulate popularity based on length (for demo)
                return quotes.sort((a, b) => b.text.length - a.text.length);
            default:
                return quotes;
        }
    }

    // ========== SORTING ==========
    
    sortQuotes(quotes, sortBy) {
        switch(sortBy) {
            case 'date-desc':
                return quotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            case 'date-asc':
                return quotes.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            case 'category':
                return quotes.sort((a, b) => a.category.localeCompare(b.category));
            case 'random':
                return this.shuffleArray([...quotes]);
            case 'popularity':
                return quotes.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
            default:
                return quotes;
        }
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    updateSortButtons(activeSort) {
        this.sortButtons.forEach(button => {
            const sortType = button.dataset.sort;
            button.classList.toggle('active', sortType === activeSort);
        });
    }

    // ========== SEARCH FUNCTIONALITY ==========
    
    handleSearch() {
        this.currentFilters.searchQuery = this.searchInput.value.trim();
        this.applyFilters();
        this.addToRecentFilters('search', this.currentFilters.searchQuery);
        this.saveCurrentFilters();
    }

    clearSearchQuery() {
        this.searchInput.value = '';
        this.currentFilters.searchQuery = '';
        this.applyFilters();
        this.saveCurrentFilters();
    }

    // ========== FILTER DISPLAY ==========
    
    updateFilterDisplay() {
        // Update main display
        this.currentFilterDisplay.textContent = 
            this.currentFilters.category === 'all' ? 'All Categories' : this.currentFilters.category;
        
        if (this.currentFilters.searchQuery) {
            this.currentFilterDisplay.textContent += ` (Search: "${this.currentFilters.searchQuery}")`;
        }
        
        if (this.currentFilters.preset) {
            this.currentFilterDisplay.textContent += ` [${this.currentFilters.preset}]`;
        }
        
        // Update counts
        this.filteredCount.textContent = this.filteredQuotes.length;
        this.totalQuotesStorage.textContent = this.storage.getAllQuotes().length;
        
        // Update recent filters display
        this.updateRecentFiltersDisplay();
    }

    updateRecentFiltersDisplay() {
        this.recentFiltersContainer.innerHTML = '';
        
        this.recentFilters.slice(0, 5).forEach(filter => {
            const tag = document.createElement('span');
            tag.className = 'category-tag';
            tag.innerHTML = `
                <i class="fas fa-${filter.type === 'category' ? 'tag' : 'search'}"></i>
                ${filter.value}
                <span class="count">${filter.count}</span>
            `;
            tag.addEventListener('click', () => this.applyRecentFilter(filter));
            this.recentFiltersContainer.appendChild(tag);
        });
    }

    updateCategoryFilterUI() {
        // Update dropdown
        this.categoryFilter.value = this.currentFilters.category;
        
        // Update buttons
        const buttons = this.categoryButtons.querySelectorAll('.filter-btn');
        buttons.forEach(button => {
            button.classList.toggle('active', button.dataset.category === this.currentFilters.category);
        });
        
        // Update stats
        this.selectedCategory.textContent = this.currentFilters.category === 'all' ? 'All' : this.currentFilters.category;
        const categoryQuotes = this.currentFilters.category === 'all' 
            ? this.storage.getAllQuotes() 
            : this.storage.getQuotesByCategory(this.currentFilters.category);
        this.categoryQuoteCount.textContent = categoryQuotes.length;
    }

    // ========== QUOTE DISPLAY ==========
    
    displayFilteredQuotes() {
        const container = document.getElementById('quotesGridContainer');
        const pagination = document.getElementById('paginationControls');
        
        if (this.filteredQuotes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">🔍</div>
                    <h3>No quotes found</h3>
                    <p>Try adjusting your filters or add some quotes to get started.</p>
                    <button class="primary-btn" id="addMoreQuotesBtn" style="margin-top: 20px;">
                        <i class="fas fa-plus"></i> Add Quotes
                    </button>
                </div>
            `;
            
            // Add event listener to the button
            document.getElementById('addMoreQuotesBtn')?.addEventListener('click', () => {
                document.getElementById('toggleForm').click();
            });
            
            pagination.style.display = 'none';
            return;
        }
        
        // Calculate pagination
        const totalPages = Math.ceil(this.filteredQuotes.length / this.quotesPerPage);
        const startIndex = (this.currentPage - 1) * this.quotesPerPage;
        const endIndex = Math.min(startIndex + this.quotesPerPage, this.filteredQuotes.length);
        const pageQuotes = this.filteredQuotes.slice(startIndex, endIndex);
        
        // Create grid
        let gridHTML = '<div class="quotes-grid">';
        
        pageQuotes.forEach(quote => {
            gridHTML += `
                <div class="quote-card" data-id="${quote.id}">
                    <div class="quote-text">"${quote.text}"</div>
                    ${quote.author ? `<div class="quote-author">— ${quote.author}</div>` : ''}
                    <div class="quote-meta">
                        <span class="quote-category">${quote.category}</span>
                        <span class="quote-date">${new Date(quote.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div class="storage-indicator">
                        <i class="fas fa-${quote.storageType === 'local' ? 'save' : 'clock'}"></i>
                        ${quote.storageType === 'local' ? 'Saved' : 'Session'}
                    </div>
                    <div class="quote-actions" style="margin-top: 15px; display: flex; gap: 10px;">
                        <button class="sort-btn delete-quote" data-id="${quote.id}" data-type="${quote.storageType}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                        <button class="sort-btn edit-quote" data-id="${quote.id}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                    </div>
                </div>
            `;
        });
        
        gridHTML += '</div>';
        container.innerHTML = gridHTML;
        
        // Add event listeners to quote cards
        this.addQuoteCardEventListeners();
        
        // Update pagination
        this.updatePaginationControls(totalPages);
    }

    updatePaginationControls(totalPages) {
        const pagination = document.getElementById('paginationControls');
        
        if (totalPages <= 1) {
            pagination.style.display = 'none';
            return;
        }
        
        pagination.style.display = 'flex';
        
        let paginationHTML = `
            <button class="page-btn" id="prevPage" ${this.currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i> Prev
            </button>
        `;
        
        // Show page numbers
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="page-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}">
                    ${i}
                </button>
            `;
        }
        
        paginationHTML += `
            <button class="page-btn" id="nextPage" ${this.currentPage === totalPages ? 'disabled' : ''}>
                Next <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        pagination.innerHTML = paginationHTML;
        
        // Add pagination event listeners
        this.addPaginationEventListeners(totalPages);
    }

    addPaginationEventListeners(totalPages) {
        document.getElementById('prevPage')?.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.displayFilteredQuotes();
            }
        });
        
        document.getElementById('nextPage')?.addEventListener('click', () => {
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.displayFilteredQuotes();
            }
        });
        
        document.querySelectorAll('.page-btn[data-page]').forEach(button => {
            button.addEventListener('click', (e) => {
                const page = parseInt(e.target.dataset.page);
                if (page !== this.currentPage) {
                    this.currentPage = page;
                    this.displayFilteredQuotes();
                }
            });
        });
    }

    addQuoteCardEventListeners() {
        // Delete buttons
        document.querySelectorAll('.delete-quote').forEach(button => {
            button.addEventListener('click', (e) => {
                const quoteId = e.target.closest('.delete-quote').dataset.id;
                const storageType = e.target.closest('.delete-quote').dataset.type;
                
                if (confirm('Are you sure you want to delete this quote?')) {
                    this.storage.deleteQuote(quoteId, storageType);
                    this.populateCategories();
                    this.applyFilters();
                }
            });
        });
        
        // Edit buttons
        document.querySelectorAll('.edit-quote').forEach(button => {
            button.addEventListener('click', (e) => {
                const quoteId = e.target.closest('.edit-quote').dataset.id;
                // Implementation for edit functionality
                this.storage.showNotification('Edit functionality coming soon!', 'info');
            });
        });
    }

    // ========== FILTER PERSISTENCE ==========
    
    loadRecentFilters() {
        try {
            const saved = localStorage.getItem('quote_filter_history');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Error loading recent filters:', error);
            return [];
        }
    }

    saveRecentFilters() {
        try {
            localStorage.setItem('quote_filter_history', JSON.stringify(this.recentFilters));
        } catch (error) {
            console.error('Error saving recent filters:', error);
        }
    }

    addToRecentFilters(type, value) {
        // Check if filter already exists
        const existingIndex = this.recentFilters.findIndex(f => 
            f.type === type && f.value === value
        );
        
        if (existingIndex !== -1) {
            // Update count
            this.recentFilters[existingIndex].count++;
            this.recentFilters[existingIndex].lastUsed = new Date().toISOString();
        } else {
            // Add new filter
            this.recentFilters.unshift({
                type,
                value,
                count: 1,
                lastUsed: new Date().toISOString()
            });
        }
        
        // Keep only last 10 filters
        this.recentFilters = this.recentFilters.slice(0, 10);
        this.saveRecentFilters();
    }

    applyRecentFilter(filter) {
        if (filter.type === 'category') {
            this.currentFilters.category = filter.value;
            this.updateCategoryFilterUI();
        } else if (filter.type === 'search') {
            this.searchInput.value = filter.value;
            this.currentFilters.searchQuery = filter.value;
        }
        
        this.applyFilters();
        this.saveCurrentFilters();
    }

    loadSavedFilters() {
        try {
            const saved = localStorage.getItem('quote_current_filters');
            if (saved) {
                this.currentFilters = { ...this.currentFilters, ...JSON.parse(saved) };
                this.lastSavedFilter.textContent = new Date().toLocaleTimeString();
            }
        } catch (error) {
            console.error('Error loading saved filters:', error);
        }
    }

    saveCurrentFilters() {
        try {
            localStorage.setItem('quote_current_filters', JSON.stringify(this.currentFilters));
            this.lastSavedFilter.textContent = new Date().toLocaleTimeString();
        } catch (error) {
            console.error('Error saving current filters:', error);
        }
    }

    // ========== FILTER RESET ==========
    
    resetAllFilters() {
        this.currentFilters = {
            category: 'all',
            searchQuery: '',
            storageTypes: ['local', 'session'],
            dateRange: 'all',
            sortBy: 'date-desc',
            preset: null
        };
        
        // Reset UI elements
        this.searchInput.value = '';
        this.filterLocal.checked = true;
        this.filterSession.checked = true;
        this.filterToday.checked = false;
        this.filterThisWeek.checked = false;
        this.filterThisMonth.checked = false;
        
        // Update preset buttons
        this.presetButtons.forEach(btn => btn.classList.remove('active'));
        
        this.updateCategoryFilterUI();
        this.updateSortButtons('date-desc');
        this.applyFilters();
        this.saveCurrentFilters();
        
        this.storage.showNotification('All filters reset to default', 'info');
    }

    // ========== INITIALIZATION ==========
    
    initialize() {
        this.populateCategories();
        this.applyFilters();
        this.updateFilterDisplay();
        
        console.log('Advanced Filter System initialized');
        console.log('Current filters:', this.currentFilters);
        console.log('Recent filters:', this.recentFilters.length);
    }
}

// ============================================
// ENHANCED STORAGE CLASS (Updated)
// ============================================

class EnhancedQuoteStorage {
    constructor() {
        this.STORAGE_KEYS = {
            LOCAL_QUOTES: 'dynamic_quote_generator_quotes_v3',
            FILTER_HISTORY: 'quote_filter_history',
            CURRENT_FILTERS: 'quote_current_filters',
            USER_PREFERENCES: 'quote_generator_prefs_v3'
        };
        
        this.quotes = this.loadQuotes();
        this.userPreferences = this.loadUserPreferences();
        this.categories = this.extractCategories();
    }

    // ========== ENHANCED QUOTE MANAGEMENT ==========
    
    addQuote(quote, storageType = 'local') {
        const newQuote = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            text: quote.text,
            author: quote.author || 'Unknown',
            category: quote.category,
            createdAt: new Date().toISOString(),
            storageType: storageType,
            popularity: Math.floor(Math.random() * 100), // Simulated for demo
            tags: quote.tags || []
        };

        if (storageType === 'local') {
            this.quotes.push(newQuote);
            this.saveQuotes();
            this.showNotification(`Quote added to "${quote.category}" category`, 'success');
        } else {
            // Session storage handled separately
            this.showNotification('Quote added to session storage', 'info');
        }
        
        // Update categories
        this.updateCategories(quote.category);
        
        return newQuote;
    }

    updateCategories(newCategory) {
        if (!this.categories.includes(newCategory) && newCategory !== 'all') {
            this.categories.push(newCategory);
            this.saveUserPreferences();
        }
    }

    extractCategories() {
        const categories = new Set(['all']);
        this.quotes.forEach(quote => categories.add(quote.category));
        return Array.from(categories);
    }

    // ========== GETTER METHODS ==========
    
    getAllQuotes() {
        return [...this.quotes];
    }

    getQuotesByCategory(category) {
        if (category === 'all') return this.quotes;
        return this.quotes.filter(quote => quote.category === category);
    }

    getAllCategories() {
        return this.categories;
    }

    getCategoryStats() {
        const stats = {};
        this.categories.forEach(category => {
            if (category !== 'all') {
                stats[category] = this.getQuotesByCategory(category).length;
            }
        });
        return stats;
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

    loadUserPreferences() {
        try {
            const prefs = localStorage.getItem(this.STORAGE_KEYS.USER_PREFERENCES);
            return prefs ? JSON.parse(prefs) : {
                defaultCategory: 'all',
                recentCategories: [],
                favoriteQuotes: [],
                viewMode: 'grid'
            };
        } catch (error) {
            console.error('Error loading preferences:', error);
            return {};
        }
    }

    saveUserPreferences() {
        try {
            localStorage.setItem(this.STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(this.userPreferences));
            return true;
        } catch (error) {
            console.error('Error saving preferences:', error);
            return false;
        }
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
                tags: ["work", "passion"]
            },
            {
                id: '2',
                text: "Life is what happens to you while you're busy making other plans.",
                author: "Allen Saunders",
                category: "Life",
                createdAt: new Date().toISOString(),
                storageType: "local",
                popularity: 88,
                tags: ["life", "plans"]
            },
            {
                id: '3',
                text: "The future belongs to those who believe in the beauty of their dreams.",
                author: "Eleanor Roosevelt",
                category: "Dreams",
                createdAt: new Date().toISOString(),
                storageType: "local",
                popularity: 92,
                tags: ["future", "dreams"]
            },
            {
                id: '4',
                text: "It does not matter how slowly you go as long as you do not stop.",
                author: "Confucius",
                category: "Perseverance",
                createdAt: new Date().toISOString(),
                storageType: "local",
                popularity: 85,
                tags: ["perseverance", "progress"]
            },
            {
                id: '5',
                text: "In the middle of difficulty lies opportunity.",
                author: "Albert Einstein",
                category: "Opportunity",
                createdAt: new Date().toISOString(),
                storageType: "local",
                popularity: 90,
                tags: ["opportunity", "challenge"]
            },
            {
                id: '6',
                text: "Be yourself; everyone else is already taken.",
                author: "Oscar Wilde",
                category: "Humor",
                createdAt: new Date().toISOString(),
                storageType: "local",
                popularity: 87,
                tags: ["humor", "authenticity"]
            },
            {
                id: '7',
                text: "The best time to plant a tree was 20 years ago. The second best time is now.",
                author: "Chinese Proverb",
                category: "Wisdom",
                createdAt: new Date().toISOString(),
                storageType: "local",
                popularity: 94,
                tags: ["wisdom", "time"]
            },
            {
                id: '8',
                text: "You miss 100% of the shots you don't take.",
                author: "Wayne Gretzky",
                category: "Motivation",
                createdAt: new Date().toISOString(),
                storageType: "local",
                popularity: 89,
                tags: ["motivation", "action"]
            }
        ];
    }

    // ========== UTILITY METHODS ==========
    
    deleteQuote(quoteId, storageType = 'local') {
        if (storageType === 'local') {
            this.quotes = this.quotes.filter(q => q.id !== quoteId);
            this.saveQuotes();
            this.showNotification('Quote deleted successfully', 'warning');
        }
    }

    clearAllData() {
        if (confirm('⚠️ Are you sure you want to clear ALL data?\n\nThis will remove:\n• All saved quotes\n• All filter history\n• Your preferences')) {
            localStorage.removeItem(this.STORAGE_KEYS.LOCAL_QUOTES);
            localStorage.removeItem(this.STORAGE_KEYS.FILTER_HISTORY);
            localStorage.removeItem(this.STORAGE_KEYS.CURRENT_FILTERS);
            localStorage.removeItem(this.STORAGE_KEYS.USER_PREFERENCES);
            
            this.quotes = this.getDefaultQuotes();
            this.categories = this.extractCategories();
            this.userPreferences = this.loadUserPreferences();
            
            this.showNotification('All data cleared successfully', 'warning');
            return true;
        }
        return false;
    }

    showNotification(message, type = 'info') {
        // Notification implementation (same as before)
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// ============================================
// MAIN APPLICATION
// ============================================

class DynamicQuoteGenerator {
    constructor() {
        this.storage = new EnhancedQuoteStorage();
        this.filterSystem = new AdvancedFilterSystem(this.storage);
        
        this.initializeUI();
        this.bindEvents();
    }

    initializeUI() {
        // Get DOM elements
        this.quoteTextElement = document.getElementById('quoteText');
        this.quoteCategoryElement = document.getElementById('quoteCategory');
        this.quoteAuthorElement = document.getElementById('quoteAuthor');
        this.quoteSourceElement = document.getElementById('quoteSource');
        this.quoteStorageTypeElement = document.getElementById('quoteStorageType');
        
        // Form elements
        this.newQuoteTextInput = document.getElementById('newQuoteText');
        this.newQuoteAuthorInput = document.getElementById('newQuoteAuthor');
        this.newQuoteCategoryInput = document.getElementById('newQuoteCategory');
        this.addQuoteBtn = document.getElementById('addQuoteBtn');
        this.cancelAddBtn = document.getElementById('cancelAddBtn');
        this.toggleFormBtn = document.getElementById('toggleFormBtn');
        
        // Action buttons
        this.newQuoteBtn = document.getElementById('newQuote');
        this.showAllQuotesBtn = document.getElementById('showAllQuotes');
        this.exportJsonBtn = document.getElementById('exportJson');
        this.manageCategoriesBtn = document.getElementById('manageCategories');
        this.clearAllBtn = document.getElementById('clearAll');
    }

    bindEvents() {
        // Quote display
        this.newQuoteBtn.addEventListener('click', () => this.showRandomQuote());
        
        // Form handling
        this.toggleFormBtn?.addEventListener('click', () => this.toggleAddQuoteForm());
        this.addQuoteBtn.addEventListener('click', () => this.handleAddQuote());
        this.cancelAddBtn.addEventListener('click', () => this.toggleAddQuoteForm());
        
        // Action buttons
        this.showAllQuotesBtn.addEventListener('click', () => this.showAllQuotes());
        this.exportJsonBtn.addEventListener('click', () => this.exportQuotes());
        this.manageCategoriesBtn.addEventListener('click', () => this.manageCategories());
        this.clearAllBtn.addEventListener('click', () => this.handleClearAll());
        
        // Category input suggestions
        this.newQuoteCategoryInput.addEventListener('input', (e) => {
            this.filterSystem.updateExistingCategoriesDisplay(
                this.storage.getAllCategories()
            );
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + F: Focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                document.getElementById('searchInput').focus();
            }
            
            // Esc: Close form
            if (e.key === 'Escape' && document.getElementById('addQuoteForm').classList.contains('active')) {
                this.toggleAddQuoteForm();
            }
        });
    }

    // ========== QUOTE DISPLAY ==========
    
    showRandomQuote() {
        const allQuotes = this.storage.getAllQuotes();
        if (allQuotes.length === 0) {
            this.quoteTextElement.textContent = "No quotes available. Add some quotes to get started!";
            this.quoteCategoryElement.textContent = "General";
            return;
        }
        
        const randomIndex = Math.floor(Math.random() * allQuotes.length);
        const randomQuote = allQuotes[randomIndex];
        
        this.displayQuote(randomQuote);
    }

    displayQuote(quote) {
        // Animate quote display
        this.quoteTextElement.style.opacity = '0';
        this.quoteCategoryElement.style.opacity = '0';
        
        setTimeout(() => {
            this.quoteTextElement.textContent = `"${quote.text}"`;
            this.quoteCategoryElement.textContent = quote.category;
            this.quoteSourceElement.textContent = quote.author;
            this.quoteStorageTypeElement.textContent = quote.storageType === 'local' ? 'Local Storage' : 'Session Storage';
            
            // Fade in
            this.quoteTextElement.style.opacity = '1';
            this.quoteCategoryElement.style.opacity = '1';
            this.quoteTextElement.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            this.quoteCategoryElement.style.transition = 'opacity 0.5s ease';
            
            // Add bounce effect
            this.quoteTextElement.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.quoteTextElement.style.transform = 'scale(1)';
            }, 50);
        }, 300);
    }

    // ========== FORM HANDLING ==========
    
    toggleAddQuoteForm() {
        const form = document.getElementById('addQuoteForm');
        const isVisible = form.classList.contains('active');
        
        if (isVisible) {
            form.classList.remove('active');
            this.toggleFormBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Add New Quote';
        } else {
            form.classList.add('active');
            this.toggleFormBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
            this.newQuoteTextInput.focus();
        }
    }

    handleAddQuote() {
        const text = this.newQuoteTextInput.value.trim();
        const author = this.newQuoteAuthorInput.value.trim() || 'Unknown';
        const category = this.newQuoteCategoryInput.value.trim();
        const storageType = document.querySelector('input[name="storageType"]:checked').value;
        
        if (!text || !category) {
            this.storage.showNotification('Please enter both quote text and category', 'error');
            return;
        }
        
        const quote = { text, author, category };
        const newQuote = this.storage.addQuote(quote, storageType);
        
        // Clear form
        this.newQuoteTextInput.value = '';
        this.newQuoteAuthorInput.value = '';
        this.newQuoteCategoryInput.value = '';
        
        // Update filters and display
        this.filterSystem.populateCategories();
        this.filterSystem.applyFilters();
        
        // Display the newly added quote
        this.displayQuote(newQuote);
        
        // Add to recent filters
        this.filterSystem.addToRecentFilters('category', category);
    }

    // ========== VIEW MANAGEMENT ==========
    
    showAllQuotes() {
        // Reset filters to show all
        this.filterSystem.resetAllFilters();
        this.filterSystem.currentFilters.category = 'all';
        this.filterSystem.applyFilters();
    }

    // ========== DATA MANAGEMENT ==========
    
    exportQuotes() {
        const quotes = this.storage.getAllQuotes();
        const exportData = {
            version: '3.0',
            exportDate: new Date().toISOString(),
            totalQuotes: quotes.length,
            quotes: quotes,
            categories: this.storage.getAllCategories(),
            metadata: {
                generator: 'Dynamic Quote Generator v3.0',
                exportFormat: 'full'
            }
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
        
        this.storage.showNotification('Quotes exported successfully!', 'success');
    }

    manageCategories() {
        const categories = this.storage.getAllCategories().filter(cat => cat !== 'all');
        const stats = this.storage.getCategoryStats();
        
        let message = '📊 Category Statistics:\n\n';
        categories.forEach(category => {
            message += `${category}: ${stats[category] || 0} quotes\n`;
        });
        
        message += `\nTotal Categories: ${categories.length}`;
        message += `\nTotal Quotes: ${this.storage.getAllQuotes().length}`;
        
        alert(message);
    }

    handleClearAll() {
        if (this.storage.clearAllData()) {
            // Reset filter system
            this.filterSystem.resetAllFilters();
            this.filterSystem.populateCategories();
            this.filterSystem.applyFilters();
            this.showRandomQuote();
        }
    }

    // ========== INITIALIZATION ==========
    
    initialize() {
        // Initialize filter system
        this.filterSystem.initialize();
        
        // Show initial random quote
        this.showRandomQuote();
        
        // Update storage info
        document.getElementById('totalQuotesStorage').textContent = 
            this.storage.getAllQuotes().length;
        
        console.log('Dynamic Quote Generator v3.0 initialized');
        console.log('Total quotes:', this.storage.getAllQuotes().length);
        console.log('Categories:', this.storage.getAllCategories());
    }
}

// ============================================
// APPLICATION START
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const app = new DynamicQuoteGenerator();
    app.initialize();
    
    // Make app available globally for debugging
    window.quoteApp = app;
});

// Export modules for testing
export { EnhancedQuoteStorage, AdvancedFilterSystem, DynamicQuoteGenerator };
