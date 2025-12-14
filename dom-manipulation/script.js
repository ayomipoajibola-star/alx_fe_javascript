// Initial quotes database
let quotes = [
    {
        text: "The only way to do great work is to love what you do.",
        category: "Inspiration"
    },
    {
        text: "Life is what happens to you while you're busy making other plans.",
        category: "Life"
    },
    {
        text: "The future belongs to those who believe in the beauty of their dreams.",
        category: "Dreams"
    },
    {
        text: "It does not matter how slowly you go as long as you do not stop.",
        category: "Perseverance"
    },
    {
        text: "In the middle of difficulty lies opportunity.",
        category: "Opportunity"
    },
    {
        text: "The best time to plant a tree was 20 years ago. The second best time is now.",
        category: "Wisdom"
    },
    {
        text: "Be the change that you wish to see in the world.",
        category: "Change"
    },
    {
        text: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
        category: "Success"
    }
];

// Load quotes from localStorage if available
function loadQuotesFromStorage() {
    const savedQuotes = localStorage.getItem('quotes');
    if (savedQuotes) {
        quotes = JSON.parse(savedQuotes);
        console.log('Quotes loaded from localStorage');
    }
}

// Save quotes to localStorage
function saveQuotesToStorage() {
    localStorage.setItem('quotes', JSON.stringify(quotes));
    console.log('Quotes saved to localStorage');
}

// Initialize
loadQuotesFromStorage();

// DOM Elements
const quoteTextElement = document.getElementById('quoteText');
const quoteCategoryElement = document.getElementById('quoteCategory');
const newQuoteBtn = document.getElementById('newQuote');
const addQuoteForm = document.getElementById('addQuoteForm');
const toggleFormBtn = document.getElementById('toggleForm');
const addQuoteBtn = document.getElementById('addQuoteBtn');
const newQuoteTextInput = document.getElementById('newQuoteText');
const newQuoteCategoryInput = document.getElementById('newQuoteCategory');
const categoryFilterElement = document.getElementById('categoryFilter');
const showAllQuotesBtn = document.getElementById('showAllQuotes');
const clearLocalBtn = document.getElementById('clearLocal');
const quotesListElement = document.getElementById('quotesList');

// Current category filter
let currentCategory = 'All';
let filteredQuotes = [...quotes];

// Get all unique categories
function getAllCategories() {
    const categories = new Set(['All']);
    quotes.forEach(quote => categories.add(quote.category));
    return Array.from(categories);
}

// Create category filter buttons
function createCategoryFilter() {
    const categories = getAllCategories();
    categoryFilterElement.innerHTML = '';
    
    categories.forEach(category => {
        const button = document.createElement('button');
        button.className = `category-btn ${category === currentCategory ? 'active' : ''}`;
        button.textContent = category;
        button.addEventListener('click', () => {
            currentCategory = category;
            filterQuotesByCategory();
            updateCategoryFilterButtons();
        });
        categoryFilterElement.appendChild(button);
    });
}

// Update category filter buttons active state
function updateCategoryFilterButtons() {
    const buttons = categoryFilterElement.querySelectorAll('.category-btn');
    buttons.forEach(button => {
        if (button.textContent === currentCategory) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

// Filter quotes by category
function filterQuotesByCategory() {
    if (currentCategory === 'All') {
        filteredQuotes = [...quotes];
    } else {
        filteredQuotes = quotes.filter(quote => quote.category === currentCategory);
    }
}

// Show random quote function
function showRandomQuote() {
    if (filteredQuotes.length === 0) {
        quoteTextElement.textContent = "No quotes available in this category. Add some quotes!";
        quoteCategoryElement.textContent = currentCategory;
        return;
    }
    
    const randomIndex = Math.floor(Math.random() * filteredQuotes.length);
    const randomQuote = filteredQuotes[randomIndex];
    
    // Fade out animation
    quoteTextElement.style.opacity = '0';
    quoteCategoryElement.style.opacity = '0';
    
    setTimeout(() => {
        quoteTextElement.textContent = randomQuote.text;
        quoteCategoryElement.textContent = randomQuote.category;
        
        // Fade in animation
        quoteTextElement.style.opacity = '1';
        quoteCategoryElement.style.opacity = '1';
        quoteTextElement.style.transition = 'opacity 0.5s ease';
        quoteCategoryElement.style.transition = 'opacity 0.5s ease';
        
        // Add slight animation
        quoteTextElement.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            quoteTextElement.style.transform = 'translateY(0)';
            quoteTextElement.style.transition = 'transform 0.3s ease';
        }, 50);
    }, 300);
}

// Create add quote form dynamically
function createAddQuoteForm() {
    // Form is already in HTML, just toggle visibility
    const isVisible = addQuoteForm.style.display === 'block';
    addQuoteForm.style.display = isVisible ? 'none' : 'block';
    toggleFormBtn.textContent = isVisible ? 'Add New Quote' : 'Hide Form';
    
    if (!isVisible) {
        // Focus on the first input
        setTimeout(() => {
            newQuoteTextInput.focus();
        }, 100);
    }
}

// Add new quote function
function addQuote() {
    const text = newQuoteTextInput.value.trim();
    const category = newQuoteCategoryInput.value.trim();
    
    if (!text || !category) {
        alert('Please enter both quote text and category');
        return;
    }
    
    // Create new quote object
    const newQuote = {
        text: text,
        category: category
    };
    
    // Add to quotes array
    quotes.push(newQuote);
    
    // Save to localStorage
    saveQuotesToStorage();
    
    // Update filtered quotes and UI
    filterQuotesByCategory();
    createCategoryFilter();
    
    // Clear form
    newQuoteTextInput.value = '';
    newQuoteCategoryInput.value = '';
    
    // Show success message
    const successMsg = document.createElement('div');
    successMsg.textContent = 'Quote added successfully!';
    successMsg.style.cssText = `
        background: #10b981;
        color: white;
        padding: 10px;
        border-radius: 5px;
        margin-top: 10px;
        text-align: center;
    `;
    addQuoteForm.appendChild(successMsg);
    
    setTimeout(() => {
        successMsg.remove();
    }, 3000);
    
    console.log('New quote added:', newQuote);
}

// Show all quotes with filtering options
function showAllQuotes() {
    quotesListElement.innerHTML = '';
    
    if (quotes.length === 0) {
        quotesListElement.innerHTML = '<p>No quotes available. Add some quotes to get started!</p>';
        return;
    }
    
    const heading = document.createElement('h2');
    heading.textContent = 'All Quotes';
    heading.style.cssText = `
        margin-bottom: 20px;
        color: #333;
        border-bottom: 2px solid #667eea;
        padding-bottom: 10px;
    `;
    quotesListElement.appendChild(heading);
    
    // Group quotes by category
    const quotesByCategory = {};
    quotes.forEach(quote => {
        if (!quotesByCategory[quote.category]) {
            quotesByCategory[quote.category] = [];
        }
        quotesByCategory[quote.category].push(quote);
    });
    
    // Display quotes by category
    Object.keys(quotesByCategory).forEach(category => {
        const categorySection = document.createElement('div');
        categorySection.className = 'category-section';
        categorySection.style.cssText = `
            margin-bottom: 25px;
        `;
        
        const categoryTitle = document.createElement('h3');
        categoryTitle.textContent = category;
        categoryTitle.style.cssText = `
            background: #667eea;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            margin-bottom: 10px;
            display: inline-block;
        `;
        categorySection.appendChild(categoryTitle);
        
        quotesByCategory[category].forEach((quote, index) => {
            const quoteItem = document.createElement('div');
            quoteItem.className = 'quote-item';
            
            const quoteText = document.createElement('p');
            quoteText.textContent = `"${quote.text}"`;
            quoteText.style.cssText = `
                margin-bottom: 5px;
                font-style: italic;
            `;
            
            const quoteCategory = document.createElement('small');
            quoteCategory.textContent = `Category: ${quote.category}`;
            quoteCategory.style.cssText = `
                color: #666;
                display: block;
                margin-bottom: 5px;
            `;
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.style.cssText = `
                background: #ef4444;
                color: white;
                border: none;
                padding: 5px 10px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 0.8rem;
                margin-top: 5px;
            `;
            deleteBtn.addEventListener('click', () => {
                deleteQuote(quote.text, category);
            });
            
            quoteItem.appendChild(quoteText);
            quoteItem.appendChild(quoteCategory);
            quoteItem.appendChild(deleteBtn);
            categorySection.appendChild(quoteItem);
        });
        
        quotesListElement.appendChild(categorySection);
    });
}

// Delete a quote
function deleteQuote(text, category) {
    const index = quotes.findIndex(q => q.text === text && q.category === category);
    if (index !== -1) {
        quotes.splice(index, 1);
        saveQuotesToStorage();
        filterQuotesByCategory();
        createCategoryFilter();
        showAllQuotes(); // Refresh the list
        console.log('Quote deleted');
    }
}

// Clear all quotes from localStorage
function clearLocalStorage() {
    if (confirm('Are you sure you want to clear all quotes? This action cannot be undone.')) {
        localStorage.removeItem('quotes');
        quotes = []; // Clear the array
        filteredQuotes = [];
        saveQuotesToStorage();
        createCategoryFilter();
        showRandomQuote();
        quotesListElement.innerHTML = '';
        console.log('All quotes cleared');
    }
}

// Event Listeners
newQuoteBtn.addEventListener('click', showRandomQuote);
toggleFormBtn.addEventListener('click', createAddQuoteForm);
addQuoteBtn.addEventListener('click', addQuote);
showAllQuotesBtn.addEventListener('click', showAllQuotes);
clearLocalBtn.addEventListener('click', clearLocalStorage);

// Allow Enter key to add quote in form
newQuoteTextInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addQuote();
    }
});

newQuoteCategoryInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addQuote();
    }
});

// Initialize application
function initApp() {
    filterQuotesByCategory();
    createCategoryFilter();
    showRandomQuote();
    
    console.log('Dynamic Quote Generator initialized');
    console.log('Total quotes:', quotes.length);
    console.log('Categories:', getAllCategories());
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

// Additional function to add quote from external source (for demonstration)
function addQuoteFromExternal(text, category) {
    const newQuote = {
        text: text,
        category: category
    };
    
    quotes.push(newQuote);
    saveQuotesToStorage();
    filterQuotesByCategory();
    createCategoryFilter();
    console.log('Quote added from external source:', newQuote);
}

// Export functions for testing or extension
window.DynamicQuoteGenerator = {
    showRandomQuote,
    addQuote,
    addQuoteFromExternal,
    getAllCategories,
    getQuotes: () => quotes,
    getFilteredQuotes: () => filteredQuotes
};
