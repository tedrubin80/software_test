// File Location: testlab/frontend/assets/js/admin-ai.js

// AI Routing Management Module
const AIRoutingManager = {
    // State management
    config: {
        'unit-testing': {
            keywords: [],
            model: 'openai',
            confidence: 80,
            secondaryEnabled: true
        },
        'security-testing': {
            keywords: [],
            model: 'claude',
            confidence: 90,
            secondaryEnabled: true
        },
        'integration-testing': {
            keywords: [],
            model: 'claude',
            confidence: 75,
            secondaryEnabled: true
        },
        'e2e-testing': {
            keywords: [],
            model: 'openai',
            confidence: 80,
            secondaryEnabled: true
        },
        'performance-testing': {
            keywords: [],
            model: 'openai',
            confidence: 70,
            secondaryEnabled: false
        },
        'accessibility-testing': {
            keywords: [],
            model: 'claude',
            confidence: 75,
            secondaryEnabled: true
        },
        'code-review': {
            keywords: [],
            model: 'openai',
            confidence: 80,
            secondaryEnabled: true
        },
        'debugging': {
            keywords: [],
            model: 'claude',
            confidence: 85,
            secondaryEnabled: true
        }
    },

    // Initialize the module
    async init() {
        await this.checkAPIKeys();
        await this.loadConfig();
        this.setupEventListeners();
        this.startAutoSave();
        this.loadStatistics();
    },

    // Check API keys status
    async checkAPIKeys() {
        try {
            const response = await fetch('/api/ai/keys', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.configured === 0) {
                    this.showToast('⚠️ No API keys configured. AI routing may not work properly.', 'error');
                } else {
                    console.log(`✅ Found ${data.configured} configured API keys`);
                    
                    // Update UI to show which services are configured
                    const configuredServices = Object.keys(data.keys || {});
                    if (configuredServices.length > 0) {
                        const message = `API Keys loaded: ${configuredServices.join(', ')}`;
                        this.showToast(message, 'success');
                    }
                }
            }
        } catch (error) {
            console.error('Error checking API keys:', error);
        }
    },

    // Load configuration from backend
    async loadConfig() {
        try {
            const response = await fetch('/api/ai/routing-config', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                // Merge with existing config structure
                Object.keys(data).forEach(category => {
                    if (this.config[category]) {
                        this.config[category] = { ...this.config[category], ...data[category] };
                    }
                });
                this.updateUI();
            } else {
                throw new Error('Failed to load configuration');
            }
        } catch (error) {
            console.error('Error loading config:', error);
            this.showToast('Failed to load configuration', 'error');
        }
    },

    // Update UI with current configuration
    updateUI() {
        Object.keys(this.config).forEach(category => {
            this.updateCategoryDisplay(category);
        });
    },

    // Update specific category display
    updateCategoryDisplay(category) {
        // Update keywords
        const keywordsContainer = document.getElementById(`${category.split('-')[0]}-keywords`);
        if (keywordsContainer) {
            keywordsContainer.innerHTML = this.config[category].keywords.map(keyword => 
                `<span class="keyword-tag">${keyword} <span class="remove" onclick="AIRoutingManager.removeKeyword('${category}', '${keyword}')">×</span></span>`
            ).join('');
        }

        // Update model selection
        const modelOptions = document.querySelectorAll(`#${category} .model-option`);
        modelOptions.forEach(option => {
            option.classList.remove('selected');
            if (option.textContent.toLowerCase().includes(this.config[category].model)) {
                option.classList.add('selected');
            }
        });

        // Update badge
        const badge = document.querySelector(`#${category} .llm-badge`);
        if (badge) {
            badge.className = `llm-badge ${this.config[category].model}`;
            badge.textContent = this.config[category].model === 'openai' ? 'OpenAI GPT-4' : 'Claude 3';
        }

        // Update confidence slider
        const confidenceSlider = document.getElementById(`${category.split('-')[0]}-confidence`);
        if (confidenceSlider) {
            confidenceSlider.value = this.config[category].confidence;
            confidenceSlider.nextElementSibling.textContent = `${this.config[category].confidence}%`;
        }
    },

    // Setup event listeners
    setupEventListeners() {
        // Category expand/collapse
        document.querySelectorAll('.category-header').forEach(header => {
            header.addEventListener('click', (e) => {
                if (!e.target.closest('.llm-badge')) {
                    const card = header.closest('.category-card');
                    card.classList.toggle('expanded');
                }
            });
        });

        // Model selection
        document.querySelectorAll('.model-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const category = option.closest('.category-card').id;
                const model = option.textContent.toLowerCase().includes('openai') ? 'openai' : 'claude';
                this.selectModel(category, model);
            });
        });

        // Keyword input enter key
        document.querySelectorAll('input[id$="-keyword-input"]').forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const category = input.id.replace('-keyword-input', '-testing');
                    this.addKeyword(category);
                }
            });
        });

        // Confidence sliders
        document.querySelectorAll('input[type="range"]').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const value = e.target.value;
                e.target.nextElementSibling.textContent = `${value}%`;
                
                const category = e.target.id.replace('-confidence', '-testing');
                if (this.config[category]) {
                    this.config[category].confidence = parseInt(value);
                }
            });
        });

        // Toggle switches
        document.querySelectorAll('.toggle-switch input').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const category = e.target.closest('.category-card').id;
                if (this.config[category]) {
                    this.config[category].secondaryEnabled = e.target.checked;
                }
            });
        });
    },

    // Keyword management
    removeKeyword(category, keyword) {
        const index = this.config[category].keywords.indexOf(keyword);
        if (index > -1) {
            this.config[category].keywords.splice(index, 1);
            this.updateCategoryDisplay(category);
            this.showToast(`Removed keyword: ${keyword}`, 'success');
        }
    },

    addKeyword(category) {
        const input = document.getElementById(`${category.split('-')[0]}-keyword-input`);
        const keyword = input.value.trim().toLowerCase();

        if (keyword && !this.config[category].keywords.includes(keyword)) {
            this.config[category].keywords.push(keyword);
            this.updateCategoryDisplay(category);
            input.value = '';
            this.showToast(`Added keyword: ${keyword}`, 'success');
        }
    },

    // Model selection
    selectModel(category, model) {
        this.config[category].model = model;
        this.updateCategoryDisplay(category);
        this.showToast(`${category.replace('-', ' ')} now using ${model.toUpperCase()}`, 'success');
    },

    // Save all changes
    async saveAllChanges() {
        const btn = document.querySelector('.btn-primary');
        const originalText = btn.innerHTML;
        
        try {
            btn.innerHTML = '<span class="loading"></span> Saving...';
            btn.disabled = true;

            const response = await fetch('/api/ai/routing-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify(this.config)
            });

            if (response.ok) {
                this.showToast('All changes saved successfully!', 'success');
                // Clear draft
                localStorage.removeItem('ai-routing-draft');
            } else {
                throw new Error('Failed to save changes');
            }
        } catch (error) {
            this.showToast('Error saving changes: ' + error.message, 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    // Export configuration
    exportConfig() {
        const dataStr = JSON.stringify(this.config, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

        const exportFileDefaultName = `ai-routing-config-${new Date().toISOString().split('T')[0]}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();

        this.showToast('Configuration exported!', 'success');
    },

    // Load statistics
    async loadStatistics() {
        try {
            const response = await fetch('/api/ai/routing-stats', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });

            if (response.ok) {
                const stats = await response.json();
                this.updateStatistics(stats);
            }
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    },

    // Update statistics display
    updateStatistics(stats) {
        if (stats.totalQueries) {
            document.getElementById('total-queries').textContent = stats.totalQueries.toLocaleString();
        }
        if (stats.modelUsage) {
            document.getElementById('claude-usage').textContent = `${stats.modelUsage.claude}%`;
            document.getElementById('openai-usage').textContent = `${stats.modelUsage.openai}%`;
        }
        if (stats.averageConfidence) {
            document.getElementById('avg-confidence').textContent = `${stats.averageConfidence}%`;
        }
    },

    // Test routing
    async testRouting(query) {
        try {
            const response = await fetch('/api/ai/test-routing', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify({ query })
            });

            if (response.ok) {
                const result = await response.json();
                this.showTestResult(result);
            }
        } catch (error) {
            this.showToast('Error testing routing: ' + error.message, 'error');
        }
    },

    // Show test result
    showTestResult(result) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Routing Test Result</h3>
                <p><strong>Query:</strong> ${result.query}</p>
                <p><strong>Category:</strong> ${result.selectedCategory}</p>
                <p><strong>Model:</strong> ${result.selectedModel}</p>
                <p><strong>Confidence:</strong> ${(result.confidence * 100).toFixed(1)}%</p>
                <p><strong>Matched Keywords:</strong> ${result.matchedKeywords.join(', ')}</p>
                <button onclick="this.closest('.modal').remove()">Close</button>
            </div>
        `;
        document.body.appendChild(modal);
    },

    // Toast notifications
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toast-message');

        toast.className = `toast ${type}`;
        toastMessage.textContent = message;
        toast.style.display = 'block';

        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    },

    // Auto-save draft
    startAutoSave() {
        setInterval(() => {
            localStorage.setItem('ai-routing-draft', JSON.stringify(this.config));
        }, 30000);
    },

    // Load draft if exists
    loadDraft() {
        const draft = localStorage.getItem('ai-routing-draft');
        if (draft) {
            try {
                const draftConfig = JSON.parse(draft);
                if (confirm('Found unsaved changes. Would you like to restore them?')) {
                    this.config = draftConfig;
                    this.updateUI();
                }
            } catch (error) {
                console.error('Error loading draft:', error);
            }
        }
    }
};

// Make functions globally accessible for onclick handlers
window.AIRoutingManager = AIRoutingManager;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('ai-routing-tab')) {
        AIRoutingManager.init();
        AIRoutingManager.loadDraft();
    }
});

// Global functions for onclick handlers
function toggleCategory(categoryId) {
    const card = document.getElementById(categoryId);
    card.classList.toggle('expanded');
}

function removeKeyword(category, keyword) {
    AIRoutingManager.removeKeyword(category, keyword);
}

function addKeyword(category) {
    AIRoutingManager.addKeyword(category);
}

function selectModel(category, model) {
    AIRoutingManager.selectModel(category, model);
}

function saveAllChanges() {
    AIRoutingManager.saveAllChanges();
}

function exportConfig() {
    AIRoutingManager.exportConfig();
}