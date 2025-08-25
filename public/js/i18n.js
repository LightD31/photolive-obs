/**
 * Simple i18n utility for PhotoLive OBS
 */
class I18n {
    constructor() {
        this.currentLanguage = 'en';
        this.translations = {};
        this.fallbackLanguage = 'en';
    }

    async init(language = null) {
        // Get language from localStorage, parameter, or detect from browser
        this.currentLanguage = language || 
                              localStorage.getItem('photolive-language') || 
                              this.detectBrowserLanguage() || 
                              'en';
        
        try {
            await this.loadTranslations(this.currentLanguage);
            
            // Load fallback if different from current
            if (this.currentLanguage !== this.fallbackLanguage) {
                await this.loadTranslations(this.fallbackLanguage);
            }
            
            this.updatePageLanguage();
        } catch (error) {
            console.warn('Failed to load translations:', error);
            // Try to load fallback
            if (this.currentLanguage !== this.fallbackLanguage) {
                this.currentLanguage = this.fallbackLanguage;
                await this.loadTranslations(this.fallbackLanguage);
                this.updatePageLanguage();
            }
        }
    }

    detectBrowserLanguage() {
        // Always default to English
        return 'en';
    }

    async loadTranslations(language) {
        try {
            const response = await fetch(`/api/locales/${language}`);
            if (!response.ok) {
                throw new Error(`Failed to load ${language} translations`);
            }
            const translations = await response.json();
            this.translations[language] = translations;
        } catch (error) {
            console.error(`Error loading ${language} translations:`, error);
            throw error;
        }
    }

    async setLanguage(language) {
        if (language === this.currentLanguage) return;
        
        this.currentLanguage = language;
        localStorage.setItem('photolive-language', language);
        
        if (!this.translations[language]) {
            await this.loadTranslations(language);
        }
        
        this.updatePageLanguage();
        this.translatePage();
        
        // Emit event for other components
        document.dispatchEvent(new CustomEvent('languageChanged', { 
            detail: { language: language }
        }));
    }

    updatePageLanguage() {
        document.documentElement.lang = this.currentLanguage;
    }

    t(key, params = {}) {
        const translation = this.getTranslation(key);
        return this.interpolate(translation, params);
    }

    getTranslation(key) {
        const keys = key.split('.');
        let current = this.translations[this.currentLanguage];
        
        // Try current language first
        for (const k of keys) {
            if (current && typeof current === 'object' && k in current) {
                current = current[k];
            } else {
                current = null;
                break;
            }
        }
        
        // Fallback to default language if not found
        if (current === null && this.currentLanguage !== this.fallbackLanguage) {
            current = this.translations[this.fallbackLanguage];
            for (const k of keys) {
                if (current && typeof current === 'object' && k in current) {
                    current = current[k];
                } else {
                    current = null;
                    break;
                }
            }
        }
        
        return current || key;
    }

    interpolate(text, params) {
        if (typeof text !== 'string') return text;
        
        return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return params[key] !== undefined ? params[key] : match;
        });
    }

    translatePage() {
        // Translate elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            
            if (element.tagName === 'INPUT' && element.type === 'text') {
                element.placeholder = translation;
            } else {
                element.textContent = translation;
            }
        });

        // Translate title
        const titleKey = document.body.getAttribute('data-i18n-title');
        if (titleKey) {
            document.title = this.t(titleKey);
        }

        // Translate elements with data-i18n-* attributes
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = this.t(key);
        });

        document.querySelectorAll('[data-i18n-alt]').forEach(element => {
            const key = element.getAttribute('data-i18n-alt');
            element.alt = this.t(key);
        });
    }

    getCurrentLanguage() {
        return this.currentLanguage;
    }

    getAvailableLanguages() {
        return ['en', 'fr'];
    }
}

// Global instance
window.i18n = new I18n();