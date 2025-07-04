// FILE LOCATION: /backend/analyzers/htmlhint-analyzer.js
// HTMLHint analyzer for HTML validation

const HTMLHint = require('htmlhint').HTMLHint;

class HTMLHintAnalyzer {
    constructor() {
        this.rules = {
            // Tag rules
            'tagname-lowercase': true,
            'tag-pair': true,
            'tag-self-close': true,
            'empty-tag-not-self-closed': true,
            
            // Attribute rules
            'attr-lowercase': true,
            'attr-no-duplication': true,
            'attr-no-unnecessary-whitespace': true,
            'attr-unsafe-chars': true,
            'attr-value-double-quotes': true,
            'attr-value-not-empty': true,
            'alt-require': true,
            
            // ID & Class rules
            'id-class-ad-disabled': true,
            'id-class-value': 'dash',
            'id-unique': true,
            
            // Structure rules
            'doctype-first': true,
            'doctype-html5': true,
            'head-script-disabled': true,
            'html-lang-require': true,
            'title-require': true,
            
            // Style rules
            'inline-style-disabled': false,
            'inline-script-disabled': false,
            'style-disabled': false,
            
            // Special character rules
            'spec-char-escape': true,
            
            // Link rules
            'href-abs-or-rel': false,
            
            // Script rules
            'src-not-empty': true,
            'script-disabled': false
        };
    }

    async analyze(code, options = {}) {
        try {
            // Check if code is HTML
            if (!this.isHTML(code, options)) {
                return this.createResult([], code, 'Not HTML code');
            }

            const results = HTMLHint.verify(code, this.rules);
            const issues = this.processResults(results, options);
            
            return this.createResult(issues, code);
        } catch (error) {
            console.error('HTMLHint analysis error:', error);
            return this.createResult([], code, error.message);
        }
    }

    isHTML(code, options) {
        // If explicitly marked as HTML, trust it
        if (options.language === 'html' || options.fileType === 'html') {
            return true;
        }

        // Check for HTML patterns
        const htmlPatterns = [
            /<!DOCTYPE\s+html/i,
            /<html[\s>]/i,
            /<(head|body|div|span|p|a|img|script|style|meta|link)[\s>]/i,
            /<\/\s*(html|head|body|div|span|p|a|script|style)\s*>/i
        ];

        return htmlPatterns.some(pattern => pattern.test(code));
    }

    processResults(results, options) {
        const typeMap = {
            'tagname-lowercase': 'structure',
            'tag-pair': 'structure',
            'attr-lowercase': 'style',
            'attr-no-duplication': 'logic',
            'alt-require': 'accessibility',
            'id-unique': 'logic',
            'doctype-first': 'structure',
            'html-lang-require': 'accessibility',
            'title-require': 'seo',
            'inline-style-disabled': 'maintainability',
            'spec-char-escape': 'security',
            'src-not-empty': 'quality'
        };

        return results
            .filter(result => {
                if (options.types && options.types.length > 0) {
                    const resultType = typeMap[result.rule.id] || 'quality';
                    return options.types.includes(resultType);
                }
                return true;
            })
            .map(result => ({
                type: typeMap[result.rule.id] || 'quality',
                severity: this.mapSeverity(result.type),
                line: result.line,
                column: result.col,
                rule: result.rule.id,
                description: result.message,
                evidence: result.evidence,
                fix: this.getSuggestion(result.rule.id, result)
            }));
    }

    mapSeverity(htmlhintType) {
        switch (htmlhintType) {
            case 'error':
                return 'high';
            case 'warning':
                return 'medium';
            default:
                return 'low';
        }
    }

    getSuggestion(ruleId, result) {
        const suggestions = {
            'tagname-lowercase': 'Use lowercase for all HTML tag names',
            'tag-pair': 'Ensure all tags are properly closed',
            'attr-lowercase': 'Use lowercase for all attribute names',
            'attr-no-duplication': 'Remove duplicate attributes',
            'alt-require': 'Add descriptive alt text for accessibility',
            'id-unique': 'Ensure all ID values are unique on the page',
            'doctype-first': 'Add <!DOCTYPE html> at the beginning',
            'html-lang-require': 'Add lang attribute to <html> tag',
            'title-require': 'Add <title> tag in <head> section',
            'inline-style-disabled': 'Move inline styles to external CSS',
            'spec-char-escape': 'Escape special characters like <, >, &',
            'src-not-empty': 'Add valid source URL or remove empty attribute'
        };

        return suggestions[ruleId] || 'Follow HTML best practices';
    }

    createResult(issues, code, error = null) {
        const score = this.calculateScore(issues);
        const summary = error || this.generateSummary(issues);
        const validation = this.validateStructure(code);

        return {
            analyzer: 'htmlhint',
            score,
            summary,
            issues,
            validation,
            stats: {
                totalIssues: issues.length,
                highSeverity: issues.filter(i => i.severity === 'high').length,
                mediumSeverity: issues.filter(i => i.severity === 'medium').length,
                lowSeverity: issues.filter(i => i.severity === 'low').length,
                byType: this.groupByType(issues)
            },
            recommendations: this.generateRecommendations(issues, validation)
        };
    }

    validateStructure(code) {
        const checks = {
            hasDoctype: /<!DOCTYPE\s+html/i.test(code),
            hasHtml: /<html[\s>]/i.test(code) && /<\/html>/i.test(code),
            hasHead: /<head[\s>]/i.test(code) && /<\/head>/i.test(code),
            hasBody: /<body[\s>]/i.test(code) && /<\/body>/i.test(code),
            hasTitle: /<title[\s>].*<\/title>/i.test(code),
            hasCharset: /<meta\s+charset=/i.test(code),
            hasViewport: /<meta\s+name=["']viewport["']/i.test(code),
            hasLang: /<html[^>]+lang=/i.test(code)
        };

        return {
            isValid: Object.values(checks).every(v => v),
            checks
        };
    }

    calculateScore(issues) {
        if (issues.length === 0) return 100;

        const weights = {
            high: 15,
            medium: 7,
            low: 3
        };

        const totalPenalty = issues.reduce((sum, issue) => {
            return sum + (weights[issue.severity] || 0);
        }, 0);

        return Math.max(0, Math.round(100 - totalPenalty));
    }

    generateSummary(issues) {
        if (issues.length === 0) {
            return 'Perfect! Your HTML follows all best practices.';
        }

        const accessibility = issues.filter(i => i.type === 'accessibility').length;
        const structure = issues.filter(i => i.type === 'structure').length;

        if (accessibility > 0) {
            return `Found ${accessibility} accessibility issue${accessibility > 1 ? 's' : ''} that affect users with disabilities.`;
        } else if (structure > 0) {
            return `Found ${structure} structural issue${structure > 1 ? 's' : ''} that may cause rendering problems.`;
        } else {
            return `Found ${issues.length} issue${issues.length > 1 ? 's' : ''} to improve HTML quality.`;
        }
    }

    groupByType(issues) {
        const groups = {};
        issues.forEach(issue => {
            groups[issue.type] = (groups[issue.type] || 0) + 1;
        });
        return groups;
    }

    generateRecommendations(issues, validation) {
        const recommendations = [];

        if (!validation.checks.hasDoctype) {
            recommendations.push('Critical: Add <!DOCTYPE html> declaration');
        }

        if (!validation.checks.hasViewport) {
            recommendations.push('Add viewport meta tag for mobile responsiveness');
        }

        const types = this.groupByType(issues);

        if (types.accessibility > 0) {
            recommendations.push('Improve accessibility for users with disabilities');
        }

        if (types.seo > 0) {
            recommendations.push('Fix SEO issues to improve search engine visibility');
        }

        if (types.security > 0) {
            recommendations.push('Address security issues to prevent XSS attacks');
        }

        if (issues.length === 0 && validation.isValid) {
            recommendations.push('Excellent HTML structure! Consider adding schema.org markup');
        }

        return recommendations;
    }
}

module.exports = { HTMLHintAnalyzer };