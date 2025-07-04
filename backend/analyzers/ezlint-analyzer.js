const axe = require('axe-core');
const { JSDOM } = require('jsdom');

class AccessibilityAnalyzer {
    constructor() {
        this.axeConfig = {
            rules: {
                // Critical WCAG 2.1 Level A & AA rules
                'area-alt': { enabled: true },
                'aria-allowed-attr': { enabled: true },
                'aria-required-attr': { enabled: true },
                'aria-required-children': { enabled: true },
                'aria-required-parent': { enabled: true },
                'aria-roles': { enabled: true },
                'aria-valid-attr': { enabled: true },
                'aria-valid-attr-value': { enabled: true },
                'button-name': { enabled: true },
                'color-contrast': { enabled: true },
                'document-title': { enabled: true },
                'duplicate-id': { enabled: true },
                'empty-heading': { enabled: true },
                'form-field-multiple-labels': { enabled: true },
                'frame-title': { enabled: true },
                'html-has-lang': { enabled: true },
                'html-lang-valid': { enabled: true },
                'image-alt': { enabled: true },
                'input-image-alt': { enabled: true },
                'label': { enabled: true },
                'link-name': { enabled: true },
                'list': { enabled: true },
                'listitem': { enabled: true },
                'meta-refresh': { enabled: true },
                'meta-viewport': { enabled: true },
                'object-alt': { enabled: true },
                'role-img-alt': { enabled: true },
                'scrollable-region-focusable': { enabled: true },
                'select-name': { enabled: true },
                'skip-link': { enabled: true },
                'tabindex': { enabled: true },
     