// FILE LOCATION: /backend/analyzers/eslint-analyzer.js
// ESLint code analyzer for JavaScript/TypeScript

const { ESLint } = require('eslint');

class ESLintAnalyzer {
    constructor() {
        this.eslint = new ESLint({
            useEslintrc: false,
            overrideConfig: {
                env: {
                    browser: true,
                    es2021: true,
                    node: true
                },
                extends: ['eslint:recommended'],
                parserOptions: {
                    ecmaVersion: 'latest',
                    sourceType: 'module',
                    ecmaFeatures: {
                        jsx: true
                    }
                },
                rules: {
                    // Error prevention
                    'no-unused-vars': 'warn',
                    'no-console': 'warn',
                    'no-debugger': 'error',
                    'no-alert': 'warn',
                    
                    // Best practices
                    'eqeqeq': ['error', 'always'],
                    'curly': ['error', 'all'],
                    'no-eval': 'error',
                    'no-implied-eval': 'error',
                    'no-loop-func': 'error',
                    'no-return-await': 'error',
                    
                    // Security
                    'no-script-url': 'error',
                    'no-proto': 'error',
                    
                    // Style
                    'semi': ['error', 'always'],
                    'quotes': ['error', 'single', { avoidEscape: true }],
                    'indent': ['error', 2],
                    'comma-dangle': ['error', 'never'],
                    
                    // ES6
                    'prefer-const': 'warn',
                    'no-var': 'warn',
                    'arrow-spacing': 'error',
                    'template-curly-spacing': 'error'
                }
            }
        });
    }

    async analyze(code, options = {}) {
        try {
            // Check if code is JavaScript/TypeScript
            if (!this.isJavaScript(code, options)) {
                return this.createResult([], code, 'Not JavaScript code');
            }

            const results = await this.eslint.lintText(code);
            const issues = this.processResults(results[0], options);
            
            return this.createResult(issues, code);
        } catch (error) {
            console.error('ESLint analysis error:', error);
            return this.createResult([], code, error.message);
        }
    }

    isJavaScript(code, options) {
        // Simple heuristic to detect if code is JavaScript
        const jsPatterns = [
            /^\s*(?:var|let|const|function|class|import|export|if|for|while|do|switch)/m,
            /^\s*(?:\/\/|\/\*)/m,
            /[;{}()[\]]/,
            /=>|===|!==|&&|\|\|/
        ];

        // If explicitly marked as JS, trust it
        if (options.language === 'javascript' || options.fileType === 'js') {
            return true;
        }

        // Check for HTML/CSS patterns that would indicate it's not JS
        const notJsPatterns = [
            /^\s*<(!DOCTYPE|html|head|body|div|span|p|a|img|script|style)/mi,
            /^\s*[.#][\w-]+\s*{/m,
            /^\s*@(media|import|keyframes|font-face)/m
        ];

        for (const pattern of notJsPatterns) {
            if (pattern.test(code)) {
                return false;
            }
        }

        // Check for JS patterns
        return jsPatterns.some(pattern => pattern.test(code));
    }

    processResults(result, options) {
        if (!result || !result.messages) {
            return [];
        }

        const severityMap = {
            0: 'off',
            1: 'warning',
            2: 'error'
        };

        const typeMap = {
            'no-unused-vars': 'quality',
            'no-console': 'quality',
            'no-debugger': 'quality',
            'no-alert': 'quality',
            'eqeqeq': 'logic',
            'no-eval': 'security',
            'no-implied-eval': 'security',
            'no-script-url': 'security',
            'prefer-const': 'modernization',
            'no-var': 'modernization',
            'semi': 'style',
            'quotes': 'style',
            'indent': 'style'
        };

        return result.messages
            .filter(msg => {
                // Filter by analysis types if specified
                if (options.types && options.types.length > 0) {
                    const msgType = typeMap[msg.ruleId] || 'quality';
                    return options.types.includes(msgType);
                }
                return true;
            })
            .map(msg => ({
                type: typeMap[msg.ruleId] || 'quality',
                severity: this.mapSeverity(severityMap[msg.severity]),
                line: msg.line,
                column: msg.column,
                rule: msg.ruleId,
                description: msg.message,
                fix: msg.fix ? 'Auto-fixable' : this.getSuggestion(msg.ruleId)
            }));
    }

    mapSeverity(eslintSeverity) {
        switch (eslintSeverity) {
            case 'error':
                return 'high';
            case 'warning':
                return 'medium';
            default:
                return 'low';
        }
    }

    getSuggestion(ruleId) {
        const suggestions = {
            'no-unused-vars': 'Remove unused variable or use it in your code',
            'no-console': 'Remove console statements or use a proper logging library',
            'no-debugger': 'Remove debugger statement before production',
            'no-alert': 'Replace alert with a proper UI notification',
            'eqeqeq': 'Use === or !== for strict equality checks',
            'no-eval': 'Avoid eval() - use alternative approaches',
            'prefer-const': 'Use const for variables that are never reassigned',
            'no-var': 'Use let or const instead of var',
            'semi': 'Add or remove semicolon as per style guide',
            'quotes': 'Use consistent quote style throughout your code'
        };

        return suggestions[ruleId] || 'Follow ESLint recommendation';
    }

    createResult(issues, code, error = null) {
        const score = this.calculateScore(issues);
        const summary = error || this.generateSummary(issues);

        return {
            analyzer: 'eslint',
            score,
            summary,
            issues,
            stats: {
                totalIssues: issues.length,
                highSeverity: issues.filter(i => i.severity === 'high').length,
                mediumSeverity: issues.filter(i => i.severity === 'medium').length,
                lowSeverity: issues.filter(i => i.severity === 'low').length,
                byType: this.groupByType(issues)
            },
            recommendations: this.generateRecommendations(issues)
        };
    }

    calculateScore(issues) {
        if (issues.length === 0) return 100;

        const weights = {
            high: 10,
            medium: 5,
            low: 2
        };

        const totalPenalty = issues.reduce((sum, issue) => {
            return sum + (weights[issue.severity] || 0);
        }, 0);

        return Math.max(0, Math.round(100 - totalPenalty));
    }

    generateSummary(issues) {
        if (issues.length === 0) {
            return 'Excellent! No ESLint issues found.';
        }

        const high = issues.filter(i => i.severity === 'high').length;
        const medium = issues.filter(i => i.severity === 'medium').length;

        if (high > 0) {
            return `Found ${high} critical issue${high > 1 ? 's' : ''} that should be fixed immediately.`;
        } else if (medium > 0) {
            return `Found ${medium} issue${medium > 1 ? 's' : ''} that should be addressed.`;
        } else {
            return `Found ${issues.length} minor style issue${issues.length > 1 ? 's' : ''}.`;
        }
    }

    groupByType(issues) {
        const groups = {};
        issues.forEach(issue => {
            groups[issue.type] = (groups[issue.type] || 0) + 1;
        });
        return groups;
    }

    generateRecommendations(issues) {
        const recommendations = [];
        const types = this.groupByType(issues);

        if (types.security > 0) {
            recommendations.push('Priority: Fix security vulnerabilities immediately');
        }

        if (types.logic > 0) {
            recommendations.push('Review logic errors to prevent runtime issues');
        }

        if (types.modernization > 5) {
            recommendations.push('Consider modernizing your JavaScript syntax');
        }

        if (types.style > 10) {
            recommendations.push('Configure ESLint rules to match your team\'s style guide');
        }

        if (issues.length === 0) {
            recommendations.push('Great job! Keep following best practices');
        }

        return recommendations;
    }
}

module.exports = { ESLintAnalyzer };