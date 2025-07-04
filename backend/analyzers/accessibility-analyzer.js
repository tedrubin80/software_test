// FILE LOCATION: /backend/analyzers/accessibility-analyzer.js
// Accessibility analyzer using axe-core for WCAG compliance

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
                'valid-lang': { enabled: true },
                'video-caption': { enabled: true }
            }
        };
    }

    async analyze(code, options = {}) {
        try {
            // Check if code is HTML
            if (!this.isHTML(code, options)) {
                return this.createResult([], code, 'Not HTML code');
            }

            // Create a virtual DOM
            const dom = new JSDOM(code, {
                url: 'http://localhost',
                contentType: 'text/html',
                pretendToBeVisual: true,
                resources: 'usable'
            });

            // Configure axe-core
            const window = dom.window;
            const document = window.document;
            
            // Run axe-core analysis
            const results = await this.runAxeCore(document, window);
            const issues = this.processResults(results, options);
            
            // Clean up
            dom.window.close();
            
            return this.createResult(issues, code);
        } catch (error) {
            console.error('Accessibility analysis error:', error);
            return this.createResult([], code, error.message);
        }
    }

    async runAxeCore(document, window) {
        // Inject axe-core into the virtual DOM
        const axeSource = require('axe-core/axe.min.js');
        const script = document.createElement('script');
        script.textContent = axeSource;
        document.head.appendChild(script);

        // Run analysis
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                window.axe.run(document, this.axeConfig, (err, results) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(results);
                    }
                });
            }, 100); // Small delay to ensure DOM is ready
        });
    }

    isHTML(code, options) {
        if (options.language === 'html' || options.fileType === 'html') {
            return true;
        }

        const htmlPatterns = [
            /<!DOCTYPE\s+html/i,
            /<html[\s>]/i,
            /<(head|body|div|span|p|a|img)[\s>]/i
        ];

        return htmlPatterns.some(pattern => pattern.test(code));
    }

    processResults(results, options) {
        const issues = [];

        // Process violations
        if (results.violations) {
            results.violations.forEach(violation => {
                violation.nodes.forEach(node => {
                    issues.push({
                        type: this.categorizeIssue(violation.id),
                        severity: this.mapImpact(violation.impact),
                        rule: violation.id,
                        description: violation.description,
                        help: violation.help,
                        helpUrl: violation.helpUrl,
                        element: node.html,
                        selector: node.target.join(' '),
                        fix: this.getSuggestion(violation.id, node)
                    });
                });
            });
        }

        // Filter by requested types if specified
        if (options.types && options.types.length > 0) {
            return issues.filter(issue => options.types.includes(issue.type));
        }

        return issues;
    }

    categorizeIssue(ruleId) {
        const categories = {
            // Images and media
            'area-alt': 'images',
            'image-alt': 'images',
            'input-image-alt': 'images',
            'object-alt': 'images',
            'role-img-alt': 'images',
            'video-caption': 'media',
            
            // ARIA
            'aria-allowed-attr': 'aria',
            'aria-required-attr': 'aria',
            'aria-required-children': 'aria',
            'aria-required-parent': 'aria',
            'aria-roles': 'aria',
            'aria-valid-attr': 'aria',
            'aria-valid-attr-value': 'aria',
            
            // Forms
            'button-name': 'forms',
            'label': 'forms',
            'select-name': 'forms',
            'form-field-multiple-labels': 'forms',
            
            // Navigation
            'skip-link': 'navigation',
            'link-name': 'navigation',
            'frame-title': 'navigation',
            
            // Structure
            'document-title': 'structure',
            'duplicate-id': 'structure',
            'empty-heading': 'structure',
            'html-has-lang': 'structure',
            'html-lang-valid': 'structure',
            'list': 'structure',
            'listitem': 'structure',
            
            // Color and contrast
            'color-contrast': 'contrast',
            
            // Keyboard
            'scrollable-region-focusable': 'keyboard',
            'tabindex': 'keyboard',
            
            // Other
            'meta-refresh': 'timing',
            'meta-viewport': 'mobile',
            'valid-lang': 'language'
        };

        return categories[ruleId] || 'general';
    }

    mapImpact(impact) {
        switch (impact) {
            case 'critical':
                return 'critical';
            case 'serious':
                return 'high';
            case 'moderate':
                return 'medium';
            case 'minor':
                return 'low';
            default:
                return 'medium';
        }
    }

    getSuggestion(ruleId, node) {
        const suggestions = {
            'image-alt': 'Add descriptive alt text that conveys the meaning of the image',
            'button-name': 'Add text content or aria-label to identify the button',
            'link-name': 'Add meaningful link text that describes the destination',
            'label': 'Associate a label with this form control using for/id or aria-label',
            'color-contrast': 'Increase contrast ratio to at least 4.5:1 for normal text, 3:1 for large text',
            'document-title': 'Add a descriptive <title> element in the <head>',
            'html-has-lang': 'Add lang attribute to the <html> element (e.g., lang="en")',
            'duplicate-id': 'Change duplicate ID to ensure each ID is unique',
            'empty-heading': 'Add content to the heading or remove it if not needed',
            'aria-valid-attr': 'Use only valid ARIA attributes',
            'meta-viewport': 'Add <meta name="viewport" content="width=device-width, initial-scale=1">',
            'skip-link': 'Add a skip navigation link at the beginning of the page'
        };

        return suggestions[ruleId] || node.failureSummary || 'Follow WCAG 2.1 guidelines';
    }

    createResult(issues, code, error = null) {
        const score = this.calculateScore(issues);
        const summary = error || this.generateSummary(issues);
        const wcagCompliance = this.assessWCAGCompliance(issues);

        return {
            analyzer: 'accessibility',
            score,
            summary,
            issues,
            wcagCompliance,
            stats: {
                totalIssues: issues.length,
                criticalIssues: issues.filter(i => i.severity === 'critical').length,
                highSeverity: issues.filter(i => i.severity === 'high').length,
                mediumSeverity: issues.filter(i => i.severity === 'medium').length,
                lowSeverity: issues.filter(i => i.severity === 'low').length,
                byType: this.groupByType(issues)
            },
            recommendations: this.generateRecommendations(issues, wcagCompliance)
        };
    }

    assessWCAGCompliance(issues) {
        const criticalCount = issues.filter(i => i.severity === 'critical').length;
        const highCount = issues.filter(i => i.severity === 'high').length;

        return {
            levelA: criticalCount === 0,
            levelAA: criticalCount === 0 && highCount === 0,
            levelAAA: issues.length === 0,
            score: this.calculateWCAGScore(issues)
        };
    }

    calculateWCAGScore(issues) {
        const weights = {
            critical: 25,
            high: 15,
            medium: 5,
            low: 2
        };

        const totalPenalty = issues.reduce((sum, issue) => {
            return sum + (weights[issue.severity] || 0);
        }, 0);

        return Math.max(0, Math.round(100 - totalPenalty));
    }

    calculateScore(issues) {
        return this.calculateWCAGScore(issues);
    }

    generateSummary(issues) {
        if (issues.length === 0) {
            return 'Excellent! Your content is fully accessible.';
        }

        const critical = issues.filter(i => i.severity === 'critical').length;
        const high = issues.filter(i => i.severity === 'high').length;

        if (critical > 0) {
            return `Found ${critical} critical accessibility barrier${critical > 1 ? 's' : ''} that prevent access for users with disabilities.`;
        } else if (high > 0) {
            return `Found ${high} serious accessibility issue${high > 1 ? 's' : ''} that significantly impact users.`;
        } else {
            return `Found ${issues.length} accessibility improvement${issues.length > 1 ? 's' : ''} to enhance user experience.`;
        }
    }

    groupByType(issues) {
        const groups = {};
        issues.forEach(issue => {
            groups[issue.type] = (groups[issue.type] || 0) + 1;
        });
        return groups;
    }

    generateRecommendations(issues, wcagCompliance) {
        const recommendations = [];

        if (!wcagCompliance.levelA) {
            recommendations.push('Critical: Fix Level A issues immediately for basic accessibility');
        }

        if (!wcagCompliance.levelAA && wcagCompliance.levelA) {
            recommendations.push('Important: Address Level AA issues for legal compliance');
        }

        const types = this.groupByType(issues);

        if (types.images > 0) {
            recommendations.push('Add alternative text to all informative images');
        }

        if (types.forms > 0) {
            recommendations.push('Ensure all form controls have accessible labels');
        }

        if (types.contrast > 0) {
            recommendations.push('Improve color contrast for better readability');
        }

        if (types.keyboard > 0) {
            recommendations.push('Ensure all interactive elements are keyboard accessible');
        }

        if (types.aria > 0) {
            recommendations.push('Fix ARIA implementation to properly convey information');
        }

        if (issues.length === 0) {
            recommendations.push('Great job! Consider usability testing with real users');
            recommendations.push('Add ARIA landmarks for better screen reader navigation');
        }

        return recommendations;
    }
}

module.exports = { AccessibilityAnalyzer };