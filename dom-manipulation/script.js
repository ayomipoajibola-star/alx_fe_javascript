// ============================================
// MODULE 1: DATA MANAGEMENT & STORAGE
// ============================================

class QuoteStorage {
    constructor() {
        this.STORAGE_KEYS = {
            LOCAL_QUOTES: 'dynamic_quote_generator_quotes',
            SESSION_QUOTES: 'session_quotes',
            USER_PREFS: 'quote_generator_prefs',
            LAST_VIEWED: 'last_viewed_quote'
        };
        
        this.quotes = this.loadQuotes();
        this.sessionQuotes = this.loadSessionQuotes();
        this.userPreferences = this.loadUserPreferences();
    }

    // ========== LOCAL STORAGE METHODS ==========
    
    loadQuotes() {
        try {
            const storedQuotes = localStorage.getItem(this.STORAGE_KEYS.LOCAL_QUOTES);
            if (storedQuotes) {
                return JSON.parse(storedQuotes);
            }
        } catch (error) {
            console.error('Error loading quotes from localStorage:', error);
            this.showNotification('Error loading saved quotes', 'error');
        }
        
        // Return default quotes if no stored data
        return this.getDefaultQuotes();
    }

    saveQuotes() {
        try {
            localStorage.setItem(this.STORAGE_KEYS.LOCAL_QUOTES, JSON.stringify(this.quotes));
            this.updateStorageStats();
            return true;
        } catch (error) {
            console.error('Error saving quotes to localStorage:', error);
            this.showNotification('Error saving quotes', 'error');
            return false;
        }
    }

    // ========== SESSION STORAGE METHODS ==========
    
    loadSessionQuotes() {
        try {
            const sessionData = sessionStorage.getItem(this.STORAGE_KEYS.SESSION_QUOTES);
            return sessionData ? JSON.parse(sessionData) : [];
        } catch (error) {
            console.error('Error loading session quotes:', error);
            return [];
        }
    }

    saveSessionQuotes() {
        try {
            sessionStorage.setItem(this.STORAGE_KEYS.SESSION_QUOTES, JSON.stringify(this.sessionQuotes));
            this.updateStorageStats();
            return true;
        } catch (error) {
            console.error('Error saving session quotes:', error);
            return false;
        }
    }

    addQuoteToSession(quote) {
        this.sessionQuotes.push(quote);
        return this.saveSessionQuotes();
    }

    // ========== USER PREFERENCES ==========
    
    loadUserPreferences() {
        try {
            const prefs = localStorage.getItem(this.STORAGE_KEYS.USER_PREFS);
            return prefs ? JSON.parse(prefs) : {
                defaultCategory: 'All',
                autoSave: true,
                exportFormat: 'pretty'
            };
        } catch (error) {
            console.error('Error loading user preferences:', error);
            return {};
        }
    }

    saveUserPreferences() {
        try {
            localStorage.setItem(this.STORAGE_KEYS.USER_PREFS, JSON.stringify(this.userPreferences));
            return true;
        } catch (error) {
            console.error('Error saving user preferences:', error);
            return false;
        }
    }

    // ========== QUOTE MANAGEMENT ==========
    
    addQuote(quote, storageType = 'local') {
        const newQuote = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            text: quote.text,
            category: quote.category,
            createdAt: new Date().toISOString(),
            storageType: storageType
        };

        if (storageType === 'session') {
            this.addQuoteToSession(newQuote);
            this.showNotification('Quote added to session storage (temporary)', 'info');
        } else {
            this.quotes.push(newQuote);
            const saved = this.saveQuotes();
            if (saved) {
                this.showNotification('Quote saved to local storage', 'success');
            }
        }
        
        this.updateStatsDisplay();
        return newQuote;
    }

    deleteQuote(quoteId, storageType = 'local') {
        if (storageType === 'session') {
            this.sessionQuotes = this.sessionQuotes.filter(q => q.id !== quoteId);
            this.saveSessionQuotes();
        } else {
            this.quotes = this.quotes.filter(q => q.id !== quoteId);
            this.saveQuotes();
        }
        
        this.updateStatsDisplay();
        this.showNotification('Quote deleted', 'warning');
    }

    getAllQuotes() {
        return [...this.sessionQuotes, ...this.quotes];
    }

    getQuotesByCategory(category) {
        const allQuotes = this.getAllQuotes();
        if (category === 'All') return allQuotes;
        return allQuotes.filter(quote => quote.category === category);
    }

    getAllCategories() {
        const allQuotes = this.getAllQuotes();
        const categories = new Set(['All']);
        allQuotes.forEach(quote => categories.add(quote.category));
        return Array.from(categories);
    }

    // ========== EXPORT/IMPORT FUNCTIONALITY ==========
    
    exportToJson(format = 'pretty') {
        const exportData = {
            version: '2.0',
            exportDate: new Date().toISOString(),
            totalQuotes: this.quotes.length,
            totalSessionQuotes: this.sessionQuotes.length,
            quotes: this.quotes,
            sessionQuotes: this.sessionQuotes,
            metadata: {
                generator: 'Dynamic Quote Generator',
                exportFormat: format
            }
        };

        const jsonString = format === 'pretty' 
            ? JSON.stringify(exportData, null, 2)
            : JSON.stringify(exportData);

        return jsonString;
    }

    importFromJson(jsonData, merge = true) {
        try {
            const importedData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            
            let importedCount = 0;
            let sessionImportedCount = 0;

            // Handle different import formats
            if (Array.isArray(importedData)) {
                // Simple array format
                importedData.forEach(quote => {
                    this.addQuote(quote, 'local');
                    importedCount++;
                });
            } else if (importedData.quotes || importedData.sessionQuotes) {
                // Full export format
                if (importedData.quotes && Array.isArray(importedData.quotes)) {
                    importedData.quotes.forEach(quote => {
                        if (!merge || !this.quotes.some(q => q.text === quote.text && q.category === quote.category)) {
                            this.quotes.push({
                                ...quote,
                                id: Date.now() + Math.random().toString(36).substr(2, 9)
                            });
                            importedCount++;
                        }
                    });
                    this.saveQuotes();
                }

                if (importedData.sessionQuotes && Array.isArray(importedData.sessionQuotes)) {
                    importedData.sessionQuotes.forEach(quote => {
                        if (!merge || !this.sessionQuotes.some(q => q.text === quote.text)) {
                            this.sessionQuotes.push({
                                ...quote,
                                id: Date.now() + Math.random().toString(36).substr(2, 9)
                            });
                            sessionImportedCount++;
                        }
                    });
                    this.saveSessionQuotes();
                }
            }

            this.updateStatsDisplay();
            this.showNotification(
                `Imported ${importedCount} local quotes and ${sessionImportedCount} session quotes`,
                'success'
            );
            
            return { importedCount, sessionImportedCount };
            
        } catch (error) {
            console.error('Error importing JSON:', error);
            this.showNotification('Invalid JSON format', 'error');
            return { importedCount: 0, sessionImportedCount: 0 };
        }
    }

    // ========== STORAGE UTILITIES ==========
    
    clearAllData() {
        localStorage.removeItem(this.STORAGE_KEYS.LOCAL_QUOTES);
        sessionStorage.removeItem(this.STORAGE_KEYS.SESSION_QUOTES);
        localStorage.removeItem(this.STORAGE_KEYS.USER_PREFS);
        
        this.quotes = this.getDefaultQuotes();
        this.sessionQuotes = [];
        this.userPreferences = this.loadUserPreferences();
        
        this.updateStatsDisplay();
        this.showNotification('All data cleared successfully', 'warning');
    }

    getStorageUsage() {
        const localStorageSize = JSON.stringify(localStorage).length;
        const sessionStorageSize = JSON.stringify(sessionStorage).length;
        
        return {
            local: Math.round(localStorageSize / 1024 * 100) / 100,
            session: Math.round(sessionStorageSize / 1024 * 100) / 100,
            total: Math.round((localStorageSize + sessionStorageSize) / 1024 * 100) / 100
        };
    }

    updateStorageStats() {
        const usage = this.getStorageUsage();
        
        // Update display elements if they exist
        if (document.getElementById('localStorageUsage')) {
            document.getElementById('localStorageUsage').textContent = `${usage.local} KB`;
        }
        if (document.getElementById('sessionStorageUsage')) {
            document.getElementById('sessionStorageUsage').textContent = `${usage.session} KB`;
        }
        if (document.getElementById('storageStatus')) {
            document.getElementById('storageStatus').textContent = 
                `Storage: ${usage.total} KB used`;
        }
        if (document.getElementById('storageCapacity')) {
            // Check browser storage capacity
            try {
                let storage = '';
                for (let i = 0; i < 10000; i++) {
                    storage += '0123456789';
                }
                localStorage.setItem('test', storage);
                localStorage.removeItem('test');
                document.getElementById('storageCapacity').textContent = '5-10MB typically available';
            } catch (e) {
                document.getElementById('storageCapacity').textContent = 'Storage capacity limited';
            }
        }
    }

    updateStatsDisplay() {
        const allQuotes = this.getAllQuotes();
        const categories = this.getAllCategories();
        
        if (document.getElementById('totalQuotes')) {
            document.getElementById('totalQuotes').textContent = allQuotes.length;
        }
        if (document.getElementById('totalCategories')) {
            document.getElementById('totalCategories').textContent = categories.length - 1; // Exclude "All"
        }
        
        this.updateStorageStats();
    }

    // ========== HELPER METHODS ==========
    
    getDefaultQuotes() {
        return [
            {
                id: '1',
                text: "The only way to do great work is to love what you do.",
                category: "Inspiration",
                createdAt: new Date().toISOString(),
                storageType: "local"
            },
            {
                id: '2',
                text: "Life is what happens to you while you're busy making other plans.",
                category: "Life",
                createdAt: new Date().toISOString(),
                storageType: "local"
            },
            {
                id: '3',
                text: "The future belongs to those who believe in the beauty of their dreams.",
                category: "Dreams",
                createdAt: new Date().toISOString(),
                storageType: "local"
            },
            {
                id: '4',
                text: "It does not matter how slowly you go as long as you do not stop.",
                category: "Perseverance",
                createdAt: new Date().toISOString(),
                storageType: "local"
            }
        ];
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => {
            setTimeout(() => notification.remove(), 100);
        });

        // Create new notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        // Remove notification after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => notification.remove(), 300);
            }
        }, 3000);
    }
}

// ============================================
// MODULE 2: UI MANAGEMENT
// ============================================

class QuoteUI {
    constructor(storage) {
        this.storage = storage;
        this.currentCategory = 'All';
        this.currentQuote = null;
        
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        // Quote display elements
        this.quoteTextElement = document.getElementById('quoteText');
        this.quoteCategoryElement = document.getElementById('quoteCategory');
        
        // Control buttons
        this.newQuoteBtn = document.getElementById('newQuote');
        this.toggleFormBtn = document.getElementById('toggleForm');
        this.addQuoteBtn = document.getElementById('addQuoteBtn');
        this.exportJsonBtn = document.getElementById('exportJsonBtn');
        this.copyJsonBtn = document.getElementById('copyJsonBtn');
        this.importJsonBtn = document.getElementById('importJsonBtn');
        this.showAllQuotesBtn = document.getElementById('showAllQuotes');
        this.clearAllBtn = document.getElementById('clearAll');
        
        // Form elements
        this.addQuoteForm = document.getElementById('addQuoteForm');
        this.newQuoteTextInput = document.getElementById('newQuoteText');
        this.newQuoteCategoryInput = document.getElementById('newQuoteCategory');
        
        // Import/export elements
        this.importFileInput = document.getElementById('importFile');
        this.importJsonText = document.getElementById('importJsonText');
        this.exportFormatSelect = document.getElementById('exportFormat');
        
        // Display elements
        this.categoryFilterElement = document.getElementById('categoryFilter');
        this.quotesListElement = document.getElementById('quotesList');
    }

    bindEvents() {
        // Quote display
        this.newQuoteBtn.addEventListener('click', () => this.showRandomQuote());
        
        // Form handling
        this.toggleFormBtn.addEventListener('click', () => this.toggleAddQuoteForm());
        this.addQuoteBtn.addEventListener('click', () => this.handleAddQuote());
        
        // Import/export
        this.exportJsonBtn.addEventListener('click', () => this.exportQuotesToFile());
        this.copyJsonBtn.addEventListener('click', () => this.copyQuotesToClipboard());
        this.importJsonBtn.addEventListener('click', () => this.handleImportQuotes());
        this.importFileInput.addEventListener('change', (e) => this.handleFileImport(e));
        
        // Data management
        this.showAllQuotesBtn.addEventListener('click', () => this.showAllQuotes());
        this.clearAllBtn.addEventListener('click', () => this.clearAllData());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
        
        // Form enter key
        this.newQuoteTextInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) this.handleAddQuote();
        });
    }

    // ========== QUOTE DISPLAY ==========
    
    showRandomQuote() {
        const quotes = this.storage.getQuotesByCategory(this.currentCategory);
        
        if (quotes.length === 0) {
            this.quoteTextElement.textContent = "No quotes available in this category. Add some quotes!";
            this.quoteCategoryElement.textContent = this.currentCategory;
            return;
        }
        
        const randomIndex = Math.floor(Math.random() * quotes.length);
        const randomQuote = quotes[randomIndex];
        this.currentQuote = randomQuote;
        
        // Save to session as last viewed
        sessionStorage.setItem('last_viewed_quote', JSON.stringify(randomQuote));
        document.getElementById('lastViewedQuote').textContent = 
            `${randomQuote.category} (${randomQuote.text.substring(0, 30)}...)`;
        
        // Animate quote display
        this.animateQuoteDisplay(randomQuote);
    }

    animateQuoteDisplay(quote) {
        // Fade out
        this.quoteTextElement.style.opacity = '0';
        this.quoteCategoryElement.style.opacity = '0';
        
        setTimeout(() => {
            this.quoteTextElement.textContent = `"${quote.text}"`;
            this.quoteCategoryElement.textContent = quote.category;
            this.quoteCategoryElement.innerHTML += 
                ` <span class="storage-badge">${quote.storageType === 'session' ? 'Session' : 'Saved'}</span>`;
            
            // Fade in with animation
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
        const isVisible = this.addQuoteForm.classList.contains('active');
        
        if (isVisible) {
            this.addQuoteForm.classList.remove('active');
            this.toggleFormBtn.innerHTML = '<span class="icon">➕</span> Add New Quote';
        } else {
            this.addQuoteForm.classList.add('active');
            this.toggleFormBtn.innerHTML = '<span class="icon">✖️</span> Hide Form';
            this.newQuoteTextInput.focus();
        }
    }

    handleAddQuote() {
        const text = this.newQuoteTextInput.value.trim();
        const category = this.newQuoteCategoryInput.value.trim();
        const storageType = document.querySelector('input[name="storageType"]:checked').value;
        
        if (!text || !category) {
            this.storage.showNotification('Please enter both quote text and category', 'error');
            return;
        }
        
        const quote = { text, category };
        this.storage.addQuote(quote, storageType);
        
        // Clear form
        this.newQuoteTextInput.value = '';
        this.newQuoteCategoryInput.value = '';
        
        // Update UI
        this.createCategoryFilter();
        this.showRandomQuote();
    }

    // ========== CATEGORY FILTER ==========
    
    createCategoryFilter() {
        const categories = this.storage.getAllCategories();
        this.categoryFilterElement.innerHTML = '';
        
        categories.forEach(category => {
            const button = document.createElement('button');
            button.className = `category-btn ${category === this.currentCategory ? 'active' : ''}`;
            button.textContent = category;
            button.addEventListener('click', () => {
                this.currentCategory = category;
                this.updateCategoryFilterButtons();
                this.showRandomQuote();
            });
            this.categoryFilterElement.appendChild(button);
        });
    }

    updateCategoryFilterButtons() {
        const buttons = this.categoryFilterElement.querySelectorAll('.category-btn');
        buttons.forEach(button => {
            button.classList.toggle('active', button.textContent === this.currentCategory);
        });
    }

    // ========== IMPORT/EXPORT ==========
    
    exportQuotesToFile() {
        const format = this.exportFormatSelect.value;
        const jsonString = this.storage.exportToJson(format);
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

    copyQuotesToClipboard() {
        const format = this.exportFormatSelect.value;
        const jsonString = this.storage.exportToJson(format);
        
        navigator.clipboard.writeText(jsonString).then(() => {
            this.storage.showNotification('JSON copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Failed to copy: ', err);
            this.storage.showNotification('Failed to copy to clipboard', 'error');
        });
    }

    handleImportQuotes() {
        const jsonText = this.importJsonText.value.trim();
        if (jsonText) {
            this.storage.importFromJson(jsonText);
            this.importJsonText.value = '';
        } else {
            this.storage.showNotification('Please paste JSON data or select a file', 'warning');
        }
    }

    handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (!file.name.endsWith('.json')) {
            this.storage.showNotification('Please select a JSON file', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = this.storage.importFromJson(e.target.result);
            if (result.importedCount > 0 || result.sessionImportedCount > 0) {
                this.createCategoryFilter();
                this.showRandomQuote();
            }
        };
        reader.readAsText(file);
        
        // Reset file input
        event.target.value = '';
    }

    // ========== QUOTE LIST DISPLAY ==========
    
    showAllQuotes() {
        this.quotesListElement.innerHTML = '';
        const allQuotes = this.storage.getAllQuotes();
        
        if (allQuotes.length === 0) {
            this.quotesListElement.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #64748b;">
                    <h3>No quotes yet!</h3>
                    <p>Add some quotes to get started.</p>
                </div>
            `;
            return;
        }
        
        const heading = document.createElement('h3');
        heading.textContent = `All Quotes (${allQuotes.length} total)`;
        heading.style.cssText = `
            margin-bottom: 20px;
            color: #334155;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        `;
        this.quotesListElement.appendChild(heading);
        
        // Group by category
        const quotesByCategory = {};
        allQuotes.forEach(quote => {
            if (!quotesByCategory[quote.category]) {
                quotesByCategory[quote.category] = [];
            }
            quotesByCategory[quote.category].push(quote);
        });
        
        // Display each category
        Object.entries(quotesByCategory).forEach(([category, quotes]) => {
            const categorySection = document.createElement('div');
            categorySection.className = 'category-section';
            categorySection.style.cssText = 'margin-bottom: 30px;';
            
            const categoryTitle = document.createElement('h4');
            categoryTitle.textContent = `${category} (${quotes.length})`;
            categoryTitle.style.cssText = `
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                margin-bottom: 15px;
                display: inline-flex;
                align-items: center;
                gap: 10px;
            `;
            
            const storageBadge = document.createElement('span');
            storageBadge.textContent = quotes.some(q => q.storageType === 'session') ? 'Mixed Storage' : 'Local Storage';
            storageBadge.style.cssText = `
                background: rgba(255,255,255,0.2);
                padding: 3px 10px;
                border-radius: 15px;
                font-size: 0.8rem;
            `;
            categoryTitle.appendChild(storageBadge);
            
            categorySection.appendChild(categoryTitle);
            
            // Display quotes in this category
            quotes.forEach((quote, index) => {
                const quoteItem = document.createElement('div');
                quoteItem.className = 'quote-item';
                
                const quoteContent = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1;">
                            <p style="font-size: 1.1rem; margin-bottom: 8px; color: #2d3748;">"${quote.text}"</p>
                            <div style="display: flex; gap: 15px; font-size: 0.9rem; color: #64748b;">
                                <span>Storage: <strong>${quote.storageType}</strong></span>
                                <span>Added: ${new Date(quote.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <button class="delete-quote-btn" data-id="${quote.id}" data-type="${quote.storageType}" 
                                style="background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; font-size: 0.9rem;">
                            Delete
                        </button>
                    </div>
                `;
                
                quoteItem.innerHTML = quoteContent;
                categorySection.appendChild(quoteItem);
            });
            
            this.quotesListElement.appendChild(categorySection);
        });
        
        // Add delete button handlers
        this.quotesListElement.querySelectorAll('.delete-quote-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const quoteId = e.target.dataset.id;
                const storageType = e.target.dataset.type;
                this.storage.deleteQuote(quoteId, storageType);
                this.showAllQuotes(); // Refresh the list
            });
        });
    }

    // ========== DATA MANAGEMENT ==========
    
    clearAllData() {
        if (confirm('⚠️ Are you sure you want to clear ALL data?\n\nThis will remove:\n• All saved quotes (local storage)\n• All session quotes\n• Your preferences\n\nThis action cannot be undone!')) {
            this.storage.clearAllData();
            this.createCategoryFilter();
            this.showRandomQuote();
            this.quotesListElement.innerHTML = '';
            this.addQuoteForm.classList.remove('active');
            this.toggleFormBtn.innerHTML = '<span class="icon">➕</span> Add New Quote';
        }
    }

    // ========== KEYBOARD SHORTCUTS ==========
    
    handleKeyboardShortcuts(event) {
        // Ctrl + N: New random quote
        if (event.ctrlKey && event.key === 'n') {
            event.preventDefault();
            this.showRandomQuote();
        }
        
        // Ctrl + S: Show all quotes
        if (event.ctrlKey && event.key === 's') {
            event.preventDefault();
            this.showAllQuotes();
        }
        
        // Ctrl + E: Export quotes
        if (event.ctrlKey && event.key === 'e') {
            event.preventDefault();
            this.exportQuotesToFile();
        }
        
        // Esc: Hide form
        if (event.key === 'Escape' && this.addQuoteForm.classList.contains('active')) {
            this.toggleAddQuoteForm();
        }
    }

    // ========== INITIALIZATION ==========
    
    initialize() {
        this.createCategoryFilter();
        this.showRandomQuote();
        this.storage.updateStatsDisplay();
        
        // Load last viewed quote from session
        const lastViewed = sessionStorage.getItem('last_viewed_quote');
        if (lastViewed) {
            try {
                const quote = JSON.parse(lastViewed);
                document.getElementById('lastViewedQuote').textContent = 
                    `${quote.category} (${quote.text.substring(0, 30)}...)`;
            } catch (e) {
                // Ignore parsing errors
            }
        }
        
        console.log('Dynamic Quote Generator v2.0 initialized');
        console.log('Total quotes:', this.storage.getAllQuotes().length);
        console.log('Categories:', this.storage.getAllCategories());
        
        // Display keyboard shortcuts hint
        setTimeout(() => {
            this.storage.showNotification('💡 Tip: Use Ctrl+N for new quote, Ctrl+S to show all quotes', 'info');
        }, 2000);
    }
}

// ============================================
// MAIN APPLICATION INITIALIZATION
// ============================================

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const storage = new QuoteStorage();
    const ui = new QuoteUI(storage);
    
    // Make instances available globally for debugging
    window.quoteStorage = storage;
    window.quoteUI = ui;
    
    ui.initialize();
});

// Export modules for testing
export { QuoteStorage, QuoteUI };
