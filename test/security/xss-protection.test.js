/**
 * XSS Protection Tests
 * Tests for Cross-Site Scripting (XSS) protection measures
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock XSS protection module
const mockXSSProtection = {
  // XSS protection
  xss: {
    // Detect XSS patterns in input
    detectXSSPatterns: (input) => {
      const detection = {
        hasXSS: false,
        patterns: [],
        severity: 'none',
        details: []
      };
      
      if (!input || typeof input !== 'string') {
        return detection;
      }
      
      // XSS pattern categories
      const xssPatterns = {
        script: {
          patterns: [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /<script\b[^>]*>/gi,
            /<\/script>/gi
          ],
          severity: 'high',
          description: 'Script tag injection'
        },
        eventHandler: {
          patterns: [
            /\bon\w+\s*=\s*["'][^"']*["']/gi,
            /\bon\w+\s*=\s*[^>\s]*/gi
          ],
          severity: 'medium',
          description: 'Event handler injection'
        },
        javascriptProtocol: {
          patterns: [
            /javascript\s*:/gi,
            /data\s*:\s*text\/html/gi
          ],
          severity: 'high',
          description: 'JavaScript protocol injection'
        },
        eval: {
          patterns: [
            /\beval\s*\(/gi,
            /\bnew\s+Function\s*\(/gi,
            /\bsetTimeout\s*\(\s*["']/gi,
            /\bsetInterval\s*\(\s*["']/gi
          ],
          severity: 'high',
          description: 'Dynamic code execution'
        },
        iframe: {
          patterns: [
            /<iframe\b[^>]*>/gi,
            /<frame\b[^>]*>/gi
          ],
          severity: 'medium',
          description: 'I/frame injection'
        },
        object: {
          patterns: [
            /<object\b[^>]*>/gi,
            /<embed\b[^>]*>/gi
          ],
          severity: 'medium',
          description: 'Object/embed injection'
        },
        meta: {
          patterns: [
            /<meta\b[^>]*http-equiv[^>]*>/gi,
            /<meta\b[^>]*refresh[^>]*>/gi
          ],
          severity: 'low',
          description: 'Meta tag injection'
        },
        form: {
          patterns: [
            /<form\b[^>]*action\s*=\s*["']javascript:/gi,
            /<input\b[^>]*on\w+\s*=/gi
          ],
          severity: 'medium',
          description: 'Form-based injection'
        },
        css: {
          patterns: [
            /<style\b[^>]*>.*?<\/style>/gi,
            /<link\b[^>]*href\s*=\s*["']javascript:/gi,
            /expression\s*\(/gi
          ],
          severity: 'low',
          description: 'CSS-based injection'
        },
        encoding: {
          patterns: [
            /&#\d+;/g,
            /&#x[0-9a-f]+;/gi,
            /\\u[0-9a-f]{4}/gi,
            /\\x[0-9a-f]{2}/gi
          ],
          severity: 'medium',
          description: 'Encoded script injection'
        }
      };
      
      // Check each pattern category
      Object.entries(xssPatterns).forEach(([category, config]) => {
        config.patterns.forEach(pattern => {
          const matches = input.match(pattern);
          if (matches && matches.length > 0) {
            detection.hasXSS = true;
            detection.patterns.push({
              category: category,
              pattern: pattern.source,
              matches: matches,
              severity: config.severity,
              description: config.description
            });
            
            // Update overall severity
            if (detection.severity === 'none' || 
                (config.severity === 'high' && detection.severity !== 'high') ||
                (config.severity === 'medium' && detection.severity === 'low')) {
              detection.severity = config.severity;
            }
          }
        });
      });
      
      return detection;
    },
    
    // Sanitize XSS from input
    sanitizeXSS: (input, options = {}) => {
      const defaults = {
        removeScripts: true,
        removeEventHandlers: true,
        removeJavaScriptProtocols: true,
        removeDynamicCode: true,
        removeIframes: true,
        allowSafeHTML: false,
        allowedTags: []
      };
      
      const config = { ...defaults, ...options };
      let sanitized = input;
      const removed = [];
      
      if (!input || typeof input !== 'string') {
        return { sanitized: '', removed: [], hasXSS: false };
      }
      
      // Remove script tags
      if (config.removeScripts) {
        const scriptRegex = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
        const scriptMatches = sanitized.match(scriptRegex);
        if (scriptMatches) {
          removed.push(...scriptMatches.map(match => ({ type: 'script', content: match })));
          sanitized = sanitized.replace(scriptRegex, '');
        }
      }
      
      // Remove event handlers
      if (config.removeEventHandlers) {
        const eventHandlerRegex = /\bon\w+\s*=\s*["'][^"']*["']/gi;
        const eventMatches = sanitized.match(eventHandlerRegex);
        if (eventMatches) {
          removed.push(...eventMatches.map(match => ({ type: 'event', content: match })));
          sanitized = sanitized.replace(eventHandlerRegex, '');
        }
      }
      
      // Remove JavaScript protocols
      if (config.removeJavaScriptProtocols) {
        const jsProtocolRegex = /javascript\s*:/gi;
        const jsMatches = sanitized.match(jsProtocolRegex);
        if (jsMatches) {
          removed.push(...jsMatches.map(match => ({ type: 'protocol', content: match })));
          sanitized = sanitized.replace(jsProtocolRegex, '');
        }
        
        // Remove data:text/html URLs
        const dataHTMLRegex = /data\s*:\s*text\/html/gi;
        const dataMatches = sanitized.match(dataHTMLRegex);
        if (dataMatches) {
          removed.push(...dataMatches.map(match => ({ type: 'data-url', content: match })));
          sanitized = sanitized.replace(dataHTMLRegex, '');
        }
      }
      
      // Remove dynamic code execution
      if (config.removeDynamicCode) {
        const evalRegex = /\beval\s*\(/gi;
        const functionRegex = /\bnew\s+Function\s*\(/gi;
        const setTimeoutRegex = /\bsetTimeout\s*\(\s*["']/gi;
        const setIntervalRegex = /\bsetInterval\s*\(\s*["']/gi;
        
        [evalRegex, functionRegex, setTimeoutRegex, setIntervalRegex].forEach(regex => {
          const matches = sanitized.match(regex);
          if (matches) {
            removed.push(...matches.map(match => ({ type: 'dynamic', content: match })));
            sanitized = sanitized.replace(regex, 'blocked(');
          }
        });
      }
      
      // Remove iframes and objects
      if (config.removeIframes) {
        const iframeRegex = /<iframe\b[^>]*>/gi;
        const frameRegex = /<frame\b[^>]*>/gi;
        const objectRegex = /<object\b[^>]*>/gi;
        const embedRegex = /<embed\b[^>]*>/gi;
        
        [iframeRegex, frameRegex, objectRegex, embedRegex].forEach(regex => {
          const matches = sanitized.match(regex);
          if (matches) {
            removed.push(...matches.map(match => ({ type: 'embed', content: match })));
            sanitized = sanitized.replace(regex, '');
          }
        });
      }
      
      // Handle HTML tag restrictions
      if (!config.allowSafeHTML) {
        // Remove all HTML tags
        sanitized = sanitized.replace(/<[^>]*>/g, '');
      } else if (config.allowedTags.length > 0) {
        // Allow only specific tags
        const allowedTagRegex = new RegExp(`<(?!\/?(?:${config.allowedTags.join('|')})\\b)[^>]*>`, 'gi');
        const disallowedMatches = sanitized.match(allowedTagRegex);
        if (disallowedMatches) {
          removed.push(...disallowedMatches.map(match => ({ type: 'disallowed-tag', content: match })));
          sanitized = sanitized.replace(allowedTagRegex, '');
        }
      }
      
      return {
        original: input,
        sanitized: sanitized,
        removed: removed,
        hasXSS: removed.length > 0,
        changed: sanitized !== input
      };
    },
    
    // Validate content security policy for XSS
    validateCSPForXSS: (cspHeader) => {
      const validation = {
        preventsXSS: true,
        issues: [],
        recommendations: [],
        score: 0
      };
      
      if (!cspHeader) {
        validation.preventsXSS = false;
        validation.issues.push('No CSP header present');
        validation.recommendations.push('Implement Content Security Policy');
        return validation;
      }
      
      // Parse CSP directives
      const directives = cspHeader.split(';').map(dir => dir.trim());
      const directiveMap = {};
      
      directives.forEach(directive => {
        const [name, ...values] = directive.split(' ');
        directiveMap[name] = values.join(' ');
      });
      
      // Check script-src directive
      if (!directiveMap['script-src']) {
        validation.preventsXSS = false;
        validation.issues.push('Missing script-src directive');
        validation.recommendations.push('Add script-src directive to CSP');
      } else {
        // Check for unsafe values
        const scriptSrc = directiveMap['script-src'];
        
        if (scriptSrc.includes("'unsafe-inline'")) {
          validation.preventsXSS = false;
          validation.issues.push("script-src allows 'unsafe-inline'");
          validation.recommendations.push("Remove 'unsafe-inline' from script-src");
          validation.score -= 30;
        }
        
        if (scriptSrc.includes("'unsafe-eval'")) {
          validation.preventsXSS = false;
          validation.issues.push("script-src allows 'unsafe-eval'");
          validation.recommendations.push("Remove 'unsafe-eval' from script-src");
          validation.score -= 40;
        }
        
        if (scriptSrc.includes('*')) {
          validation.preventsXSS = false;
          validation.issues.push("script-src allows wildcard '*'");
          validation.recommendations.push("Replace wildcard '*' with specific domains");
          validation.score -= 20;
        }
        
        // Reward restrictive script-src
        if (scriptSrc.includes("'self'") && !scriptSrc.includes("'unsafe-inline'")) {
          validation.score += 30;
        }
      }
      
      // Check object-src directive
      if (!directiveMap['object-src']) {
        validation.recommendations.push("Add object-src 'none' to CSP");
        validation.score -= 10;
      } else if (directiveMap['object-src'].includes("'none'")) {
        validation.score += 20;
      }
      
      // Check default-src directive
      if (!directiveMap['default-src']) {
        validation.recommendations.push('Add default-src directive to CSP');
        validation.score -= 10;
      }
      
      // Calculate final score
      validation.score = Math.max(0, Math.min(100, validation.score));
      
      return validation;
    },
    
    // Test XSS in different contexts
    testXSSInContext: (input, context = 'html') => {
      const testCases = {
        html: {
          input: input,
          container: 'div',
          test: () => {
            const div = document.createElement('div');
            div.innerHTML = input;
            return div.innerHTML;
          }
        },
        attribute: {
          input: input,
          container: 'input',
          test: () => {
            const input = document.createElement('input');
            input.setAttribute('value', input);
            return input.getAttribute('value');
          }
        },
        script: {
          input: input,
          container: 'script',
          test: () => {
            try {
              eval(input);
              return 'executed';
            } catch (e) {
              return 'blocked';
            }
          }
        },
        url: {
          input: input,
          container: 'a',
          test: () => {
            const a = document.createElement('a');
            a.href = input;
            return a.href;
          }
        }
      };
      
      const testCase = testCases[context];
      if (!testCase) {
        return { error: 'Unknown test context' };
      }
      
      const detection = mockXSSProtection.xss.detectXSSPatterns(testCase.input);
      const result = {
        context: context,
        input: testCase.input,
        detected: detection.hasXSS,
        patterns: detection.patterns,
        severity: detection.severity,
        executed: false,
        output: null
      };
      
      // Execute the test if it's safe to do so
      if (context === 'script') {
        // For script context, we don't actually execute
        result.executed = false;
        result.output = 'blocked';
      } else {
        try {
          result.output = testCase.test();
          result.executed = true;
        } catch (error) {
          result.executed = false;
          result.output = 'error';
        }
      }
      
      return result;
    },
    
    // Generate XSS test payload
    generateXSSPayloads: () => {
      return {
        basic: [
          '<script>alert("XSS")</script>',
          '<img src=x onerror=alert("XSS")>',
          '<svg onload=alert("XSS")>',
          '<iframe src="javascript:alert(\'XSS\')"></iframe>',
          '<body onload=alert("XSS")>'
        ],
        encoded: [
          '&#60;script&#62;alert("XSS")&#60;/script&#62;',
          '%3Cscript%3Ealert("XSS")%3C/script%3E',
          '\\x3Cscript\\x3Ealert("XSS")\\x3C/script\\x3E',
          '\\u003Cscript\\u003Ealert("XSS")\\u003C/script\\u003E'
        ],
        advanced: [
          '<script>String.fromCharCode(88,83,83)</script>',
          '<img src=x onerror="eval(String.fromCharCode(88,83,83))">',
          '<svg><script>alert(1)</script></svg>',
          '<math><maction action=javascript:alert(1)>XSS</maction></math>',
          '<details open ontoggle=alert(1)>XSS</details>'
        ],
        context: {
          attribute: [
            '"><script>alert("XSS")</script>',
            '" onmouseover="alert(\'XSS\')"',
            "' onfocus='alert(\"XSS\")' "
          ],
          url: [
            'javascript:alert("XSS")',
            'data:text/html,<script>alert("XSS")</script>',
            'vbscript:msgbox("XSS")'
          ],
          css: [
            '<style>@import "javascript:alert(\'XSS\')";</style>',
            '<div style="background:url(javascript:alert(\'XSS\'))">',
            '<style>body{expression(alert("XSS"))}</style>'
          ]
        }
      };
    }
  }
};

describe('XSS Protection Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Mock DOM methods for testing
    global.document = {
      createElement: jest.fn((tag) => {
        const element = {
          innerHTML: '',
          setAttribute: jest.fn(),
          getAttribute: jest.fn(),
          href: ''
        };
        
        // Mock actual behavior for dangerous operations
        if (tag === 'div' && typeof arguments[1] === 'string') {
          element.innerHTML = arguments[1];
        }
        
        return element;
      })
    };
    
    global.eval = jest.fn(() => {
      throw new Error('eval blocked');
    });
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('XSS Pattern Detection', () => {
    test('should detect script tag injection', () => {
      const inputs = [
        '<script>alert("XSS")</script>',
        '<script src="malicious.js"></script>',
        '<SCRIPT>alert("XSS")</SCRIPT>'
      ];
      
      inputs.forEach(input => {
        const result = mockXSSProtection.xss.detectXSSPatterns(input);
        
        expect(result.hasXSS).toBe(true);
        expect(result.patterns.some(p => p.category === 'script')).toBe(true);
        expect(result.severity).toBe('high');
      });
    });
    
    test('should detect event handler injection', () => {
      const inputs = [
        '<img onclick="alert(\'XSS\')" src="image.jpg">',
        '<div onload="alert(\'XSS\')">Content</div>',
        '<body onmouseover="alert(\'XSS\')">'
      ];
      
      inputs.forEach(input => {
        const result = mockXSSProtection.xss.detectXSSPatterns(input);
        
        expect(result.hasXSS).toBe(true);
        expect(result.patterns.some(p => p.category === 'eventHandler')).toBe(true);
        expect(result.severity).toBe('medium');
      });
    });
    
    test('should detect JavaScript protocol injection', () => {
      const inputs = [
        'javascript:alert("XSS")',
        'JAVASCRIPT:alert("XSS")',
        '<a href="javascript:alert(\'XSS\')">Link</a>',
        'data:text/html,<script>alert("XSS")</script>'
      ];
      
      inputs.forEach(input => {
        const result = mockXSSProtection.xss.detectXSSPatterns(input);
        
        expect(result.hasXSS).toBe(true);
        expect(result.patterns.some(p => p.category === 'javascriptProtocol')).toBe(true);
        expect(result.severity).toBe('high');
      });
    });
    
    test('should detect dynamic code execution', () => {
      const inputs = [
        'eval("alert(\'XSS\')")',
        'new Function("alert(\'XSS\')")',
        'setTimeout("alert(\'XSS\')", 100)',
        'setInterval("alert(\'XSS\')", 100)'
      ];
      
      inputs.forEach(input => {
        const result = mockXSSProtection.xss.detectXSSPatterns(input);
        
        expect(result.hasXSS).toBe(true);
        expect(result.patterns.some(p => p.category === 'eval')).toBe(true);
        expect(result.severity).toBe('high');
      });
    });
    
    test('should detect iframe and object injection', () => {
      const inputs = [
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        '<object data="text/html,<script>alert(\'XSS\')</script>"></object>',
        '<embed src="javascript:alert(\'XSS\')" type="text/html">'
      ];
      
      inputs.forEach(input => {
        const result = mockXSSProtection.xss.detectXSSPatterns(input);
        
        expect(result.hasXSS).toBe(true);
        expect(result.patterns.some(p => ['iframe', 'object'].includes(p.category))).toBe(true);
        expect(result.severity).toBe('medium');
      });
    });
    
    test('should detect encoded XSS', () => {
      const inputs = [
        '&#60;script&#62;alert("XSS")&#60;/script&#62;',
        '%3Cscript%3Ealert("XSS")%3C/script%3E',
        '\\x3Cscript\\x3Ealert("XSS")\\x3C/script\\x3E',
        '\\u003Cscript\\u003Ealert("XSS")\\u003C/script\\u003E'
      ];
      
      inputs.forEach(input => {
        const result = mockXSSProtection.xss.detectXSSPatterns(input);
        
        expect(result.hasXSS).toBe(true);
        expect(result.patterns.some(p => p.category === 'encoding')).toBe(true);
        expect(result.severity).toBe('medium');
      });
    });
    
    test('should handle safe input', () => {
      const inputs = [
        'Hello World',
        'This is safe content',
        'Regular text without scripts',
        'Normal HTML: <p>Paragraph</p>'
      ];
      
      inputs.forEach(input => {
        const result = mockXSSProtection.xss.detectXSSPatterns(input);
        
        expect(result.hasXSS).toBe(false);
        expect(result.patterns).toHaveLength(0);
        expect(result.severity).toBe('none');
      });
    });
  });
  
  describe('XSS Sanitization', () => {
    test('should remove script tags', () => {
      const input = '<div><script>alert("XSS")</script><p>Content</p></div>';
      const result = mockXSSProtection.xss.sanitizeXSS(input);
      
      expect(result.sanitized).toBe('<div><p>Content</p></div>');
      expect(result.hasXSS).toBe(true);
      expect(result.removed.some(r => r.type === 'script')).toBe(true);
      expect(result.changed).toBe(true);
    });
    
    test('should remove event handlers', () => {
      const input = '<img onclick="alert(\'XSS\')" onload="alert(\'XSS\')" src="image.jpg">';
      const result = mockXSSProtection.xss.sanitizeXSS(input);
      
      expect(result.sanitized).not.toContain('onclick');
      expect(result.sanitized).not.toContain('onload');
      expect(result.hasXSS).toBe(true);
      expect(result.removed.some(r => r.type === 'event')).toBe(true);
    });
    
    test('should remove JavaScript protocols', () => {
      const input = '<a href="javascript:alert(\'XSS\')">Link</a>';
      const result = mockXSSProtection.xss.sanitizeXSS(input);
      
      expect(result.sanitized).not.toContain('javascript:');
      expect(result.hasXSS).toBe(true);
      expect(result.removed.some(r => r.type === 'protocol')).toBe(true);
    });
    
    test('should block dynamic code execution', () => {
      const input = 'eval("alert(\'XSS\')"); new Function("alert(\'XSS\')")';
      const result = mockXSSProtection.xss.sanitizeXSS(input);
      
      expect(result.sanitized).toContain('blocked(');
      expect(result.hasXSS).toBe(true);
      expect(result.removed.some(r => r.type === 'dynamic')).toBe(true);
    });
    
    test('should remove iframes and objects', () => {
      const input = '<iframe src="javascript:alert(\'XSS\')"></iframe><object data="malicious"></object>';
      const result = mockXSSProtection.xss.sanitizeXSS(input);
      
      expect(result.sanitized).not.toContain('<iframe');
      expect(result.sanitized).not.toContain('<object');
      expect(result.hasXSS).toBe(true);
      expect(result.removed.some(r => r.type === 'embed')).toBe(true);
    });
    
    test('should allow safe HTML when configured', () => {
      const input = '<div><p>Safe content</p><span>More content</span></div>';
      const result = mockXSSProtection.xss.sanitizeXSS(input, {
        allowSafeHTML: true,
        allowedTags: ['div', 'p', 'span']
      });
      
      expect(result.sanitized).toBe(input);
      expect(result.hasXSS).toBe(false);
      expect(result.removed).toHaveLength(0);
      expect(result.changed).toBe(false);
    });
    
    test('should remove disallowed HTML tags', () => {
      const input = '<div><p>Safe</p><script>alert("XSS")</script><span>Content</span></div>';
      const result = mockXSSProtection.xss.sanitizeXSS(input, {
        allowSafeHTML: true,
        allowedTags: ['div', 'p', 'span']
      });
      
      expect(result.sanitized).toBe('<div><p>Safe</p><span>Content</span></div>');
      expect(result.hasXSS).toBe(true);
      expect(result.removed.some(r => r.type === 'script')).toBe(true);
    });
  });
  
  describe('CSP XSS Protection Validation', () => {
    test('should validate strong CSP against XSS', () => {
      const csp = "script-src 'self'; object-src 'none'; default-src 'self'";
      const result = mockXSSProtection.xss.validateCSPForXSS(csp);
      
      expect(result.preventsXSS).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.score).toBeGreaterThan(40);
    });
    
    test('should detect unsafe-inline in CSP', () => {
      const csp = "script-src 'self' 'unsafe-inline'; object-src 'none'";
      const result = mockXSSProtection.xss.validateCSPForXSS(csp);
      
      expect(result.preventsXSS).toBe(false);
      expect(result.issues).toContain("script-src allows 'unsafe-inline'");
      expect(result.recommendations).toContain("Remove 'unsafe-inline' from script-src");
      expect(result.score).toBeLessThan(0);
    });
    
    test('should detect unsafe-eval in CSP', () => {
      const csp = "script-src 'self' 'unsafe-eval'; object-src 'none'";
      const result = mockXSSProtection.xss.validateCSPForXSS(csp);
      
      expect(result.preventsXSS).toBe(false);
      expect(result.issues).toContain("script-src allows 'unsafe-eval'");
      expect(result.recommendations).toContain("Remove 'unsafe-eval' from script-src");
      expect(result.score).toBeLessThan(0);
    });
    
    test('should detect wildcard in script-src', () => {
      const csp = "script-src *; object-src 'none'";
      const result = mockXSSProtection.xss.validateCSPForXSS(csp);
      
      expect(result.preventsXSS).toBe(false);
      expect(result.issues).toContain("script-src allows wildcard '*'");
      expect(result.recommendations).toContain("Replace wildcard '*' with specific domains");
      expect(result.score).toBeLessThan(0);
    });
    
    test('should detect missing CSP header', () => {
      const result = mockXSSProtection.xss.validateCSPForXSS(null);
      
      expect(result.preventsXSS).toBe(false);
      expect(result.issues).toContain('No CSP header present');
      expect(result.recommendations).toContain('Implement Content Security Policy');
    });
    
    test('should reward restrictive CSP directives', () => {
      const csp = "script-src 'self'; object-src 'none'; default-src 'self'";
      const result = mockXSSProtection.xss.validateCSPForXSS(csp);
      
      expect(result.preventsXSS).toBe(true);
      expect(result.score).toBeGreaterThan(40); // script-src 'self' + object-src 'none'
    });
  });
  
  describe('XSS Context Testing', () => {
    test('should test XSS in HTML context', () => {
      const input = '<script>alert("XSS")</script>';
      const result = mockXSSProtection.xss.testXSSInContext(input, 'html');
      
      expect(result.context).toBe('html');
      expect(result.detected).toBe(true);
      expect(result.patterns.some(p => p.category === 'script')).toBe(true);
      expect(result.severity).toBe('high');
    });
    
    test('should test XSS in attribute context', () => {
      const input = '"><script>alert("XSS")</script>';
      const result = mockXSSProtection.xss.testXSSInContext(input, 'attribute');
      
      expect(result.context).toBe('attribute');
      expect(result.detected).toBe(true);
      expect(result.severity).toBe('high');
    });
    
    test('should test XSS in script context', () => {
      const input = 'alert("XSS")';
      const result = mockXSSProtection.xss.testXSSInContext(input, 'script');
      
      expect(result.context).toBe('script');
      expect(result.output).toBe('blocked');
      expect(result.executed).toBe(false);
    });
    
    test('should test XSS in URL context', () => {
      const input = 'javascript:alert("XSS")';
      const result = mockXSSProtection.xss.testXSSInContext(input, 'url');
      
      expect(result.context).toBe('url');
      expect(result.detected).toBe(true);
      expect(result.patterns.some(p => p.category === 'javascriptProtocol')).toBe(true);
    });
  });
  
  describe('XSS Payload Generation', () => {
    test('should generate basic XSS payloads', () => {
      const payloads = mockXSSProtection.xss.generateXSSPayloads();
      
      expect(payloads.basic).toContain('<script>alert("XSS")</script>');
      expect(payloads.basic).toContain('<img src=x onerror=alert("XSS")>');
      expect(payloads.basic).toContain('<svg onload=alert("XSS")>');
      expect(payloads.basic.length).toBeGreaterThan(4);
    });
    
    test('should generate encoded XSS payloads', () => {
      const payloads = mockXSSProtection.xss.generateXSSPayloads();
      
      expect(payloads.encoded).toContain('&#60;script&#62;alert("XSS")&#60;/script&#62;');
      expect(payloads.encoded).toContain('%3Cscript%3Ealert("XSS")%3C/script%3E');
      expect(payloads.encoded).toContain('\\x3Cscript\\x3Ealert("XSS")\\x3C/script\\x3E');
      expect(payloads.encoded.length).toBeGreaterThan(3);
    });
    
    test('should generate advanced XSS payloads', () => {
      const payloads = mockXSSProtection.xss.generateXSSPayloads();
      
      expect(payloads.advanced).toContain('String.fromCharCode(88,83,83)');
      expect(payloads.advanced).toContain('<svg><script>alert(1)</script></svg>');
      expect(payloads.advanced).toContain('<details open ontoggle=alert(1)>XSS</details>');
      expect(payloads.advanced.length).toBeGreaterThan(3);
    });
    
    test('should generate context-specific payloads', () => {
      const payloads = mockXSSProtection.xss.generateXSSPayloads();
      
      // Attribute context payloads
      expect(payloads.context.attribute).toContain('"><script>alert("XSS")</script>');
      expect(payloads.context.attribute).toContain('" onmouseover="alert(\'XSS\')"');
      
      // URL context payloads
      expect(payloads.context.url).toContain('javascript:alert("XSS")');
      expect(payloads.context.url).toContain('data:text/html,<script>alert("XSS")</script>');
      
      // CSS context payloads
      expect(payloads.context.css).toContain('<style>@import "javascript:alert(\'XSS\')";</style>');
      expect(payloads.context.css).toContain('<div style="background:url(javascript:alert(\'XSS\'))">');
    });
  });
  
  describe('XSS Protection Best Practices', () => {
    test('should handle null and undefined input', () => {
      const nullResult = mockXSSProtection.xss.detectXSSPatterns(null);
      expect(nullResult.hasXSS).toBe(false);
      expect(nullResult.patterns).toHaveLength(0);
      
      const undefinedResult = mockXSSProtection.xss.detectXSSPatterns(undefined);
      expect(undefinedResult.hasXSS).toBe(false);
      expect(undefinedResult.patterns).toHaveLength(0);
    });
    
    test('should handle empty input', () => {
      const result = mockXSSProtection.xss.detectXSSPatterns('');
      expect(result.hasXSS).toBe(false);
      expect(result.patterns).toHaveLength(0);
    });
    
    test('should detect multiple XSS patterns in single input', () => {
      const input = '<script>alert("XSS")</script><img onclick="alert(\'XSS\')" src="x">';
      const result = mockXSSProtection.xss.detectXSSPatterns(input);
      
      expect(result.hasXSS).toBe(true);
      expect(result.patterns.length).toBeGreaterThan(1);
      expect(result.patterns.some(p => p.category === 'script')).toBe(true);
      expect(result.patterns.some(p => p.category === 'eventHandler')).toBe(true);
    });
    
    test('should prioritize high severity patterns', () => {
      const input = '<script>alert("XSS")</script><div onclick="alert(\'XSS\')">';
      const result = mockXSSProtection.xss.detectXSSPatterns(input);
      
      expect(result.severity).toBe('high'); // script tag is high severity
    });
  });
}); * XSS Protection Tests
 * Tests for Cross-Site Scripting (XSS) protection measures
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock XSS protection module
const mockXSSProtection = {
  // XSS protection
  xss: {
    // Detect XSS patterns in input
    detectXSSPatterns: (input) => {
      const detection = {
        hasXSS: false,
        patterns: [],
        severity: 'none',
        details: []
      };
      
      if (!input || typeof input !== 'string') {
        return detection;
      }
      
      // XSS pattern categories
      const xssPatterns = {
        script: {
          patterns: [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /<script\b[^>]*>/gi,
            /<\/script>/gi
          ],
          severity: 'high',
          description: 'Script tag injection'
        },
        eventHandler: {
          patterns: [
            /\bon\w+\s*=\s*["'][^"']*["']/gi,
            /\bon\w+\s*=\s*[^>\s]*/gi
          ],
          severity: 'medium',
          description: 'Event handler injection'
        },
        javascriptProtocol: {
          patterns: [
            /javascript\s*:/gi,
            /data\s*:\s*text\/html/gi
          ],
          severity: 'high',
          description: 'JavaScript protocol injection'
        },
        eval: {
          patterns: [
            /\beval\s*\(/gi,
            /\bnew\s+Function\s*\(/gi,
            /\bsetTimeout\s*\(\s*["']/gi,
            /\bsetInterval\s*\(\s*["']/gi
          ],
          severity: 'high',
          description: 'Dynamic code execution'
        },
        iframe: {
          patterns: [
            /<iframe\b[^>]*>/gi,
            /<frame\b[^>]*>/gi
          ],
          severity: 'medium',
          description: 'I/frame injection'
        },
        object: {
          patterns: [
            /<object\b[^>]*>/gi,
            /<embed\b[^>]*>/gi
          ],
          severity: 'medium',
          description: 'Object/embed injection'
        },
        meta: {
          patterns: [
            /<meta\b[^>]*http-equiv[^>]*>/gi,
            /<meta\b[^>]*refresh[^>]*>/gi
          ],
          severity: 'low',
          description: 'Meta tag injection'
        },
        form: {
          patterns: [
            /<form\b[^>]*action\s*=\s*["']javascript:/gi,
            /<input\b[^>]*on\w+\s*=/gi
          ],
          severity: 'medium',
          description: 'Form-based injection'
        },
        css: {
          patterns: [
            /<style\b[^>]*>.*?<\/style>/gi,
            /<link\b[^>]*href\s*=\s*["']javascript:/gi,
            /expression\s*\(/gi
          ],
          severity: 'low',
          description: 'CSS-based injection'
        },
        encoding: {
          patterns: [
            /&#\d+;/g,
            /&#x[0-9a-f]+;/gi,
            /\\u[0-9a-f]{4}/gi,
            /\\x[0-9a-f]{2}/gi
          ],
          severity: 'medium',
          description: 'Encoded script injection'
        }
      };
      
      // Check each pattern category
      Object.entries(xssPatterns).forEach(([category, config]) => {
        config.patterns.forEach(pattern => {
          const matches = input.match(pattern);
          if (matches && matches.length > 0) {
            detection.hasXSS = true;
            detection.patterns.push({
              category: category,
              pattern: pattern.source,
              matches: matches,
              severity: config.severity,
              description: config.description
            });
            
            // Update overall severity
            if (detection.severity === 'none' || 
                (config.severity === 'high' && detection.severity !== 'high') ||
                (config.severity === 'medium' && detection.severity === 'low')) {
              detection.severity = config.severity;
            }
          }
        });
      });
      
      return detection;
    },
    
    // Sanitize XSS from input
    sanitizeXSS: (input, options = {}) => {
      const defaults = {
        removeScripts: true,
        removeEventHandlers: true,
        removeJavaScriptProtocols: true,
        removeDynamicCode: true,
        removeIframes: true,
        allowSafeHTML: false,
        allowedTags: []
      };
      
      const config = { ...defaults, ...options };
      let sanitized = input;
      const removed = [];
      
      if (!input || typeof input !== 'string') {
        return { sanitized: '', removed: [], hasXSS: false };
      }
      
      // Remove script tags
      if (config.removeScripts) {
        const scriptRegex = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
        const scriptMatches = sanitized.match(scriptRegex);
        if (scriptMatches) {
          removed.push(...scriptMatches.map(match => ({ type: 'script', content: match })));
          sanitized = sanitized.replace(scriptRegex, '');
        }
      }
      
      // Remove event handlers
      if (config.removeEventHandlers) {
        const eventHandlerRegex = /\bon\w+\s*=\s*["'][^"']*["']/gi;
        const eventMatches = sanitized.match(eventHandlerRegex);
        if (eventMatches) {
          removed.push(...eventMatches.map(match => ({ type: 'event', content: match })));
          sanitized = sanitized.replace(eventHandlerRegex, '');
        }
      }
      
      // Remove JavaScript protocols
      if (config.removeJavaScriptProtocols) {
        const jsProtocolRegex = /javascript\s*:/gi;
        const jsMatches = sanitized.match(jsProtocolRegex);
        if (jsMatches) {
          removed.push(...jsMatches.map(match => ({ type: 'protocol', content: match })));
          sanitized = sanitized.replace(jsProtocolRegex, '');
        }
        
        // Remove data:text/html URLs
        const dataHTMLRegex = /data\s*:\s*text\/html/gi;
        const dataMatches = sanitized.match(dataHTMLRegex);
        if (dataMatches) {
          removed.push(...dataMatches.map(match => ({ type: 'data-url', content: match })));
          sanitized = sanitized.replace(dataHTMLRegex, '');
        }
      }
      
      // Remove dynamic code execution
      if (config.removeDynamicCode) {
        const evalRegex = /\beval\s*\(/gi;
        const functionRegex = /\bnew\s+Function\s*\(/gi;
        const setTimeoutRegex = /\bsetTimeout\s*\(\s*["']/gi;
        const setIntervalRegex = /\bsetInterval\s*\(\s*["']/gi;
        
        [evalRegex, functionRegex, setTimeoutRegex, setIntervalRegex].forEach(regex => {
          const matches = sanitized.match(regex);
          if (matches) {
            removed.push(...matches.map(match => ({ type: 'dynamic', content: match })));
            sanitized = sanitized.replace(regex, 'blocked(');
          }
        });
      }
      
      // Remove iframes and objects
      if (config.removeIframes) {
        const iframeRegex = /<iframe\b[^>]*>/gi;
        const frameRegex = /<frame\b[^>]*>/gi;
        const objectRegex = /<object\b[^>]*>/gi;
        const embedRegex = /<embed\b[^>]*>/gi;
        
        [iframeRegex, frameRegex, objectRegex, embedRegex].forEach(regex => {
          const matches = sanitized.match(regex);
          if (matches) {
            removed.push(...matches.map(match => ({ type: 'embed', content: match })));
            sanitized = sanitized.replace(regex, '');
          }
        });
      }
      
      // Handle HTML tag restrictions
      if (!config.allowSafeHTML) {
        // Remove all HTML tags
        sanitized = sanitized.replace(/<[^>]*>/g, '');
      } else if (config.allowedTags.length > 0) {
        // Allow only specific tags
        const allowedTagRegex = new RegExp(`<(?!\/?(?:${config.allowedTags.join('|')})\\b)[^>]*>`, 'gi');
        const disallowedMatches = sanitized.match(allowedTagRegex);
        if (disallowedMatches) {
          removed.push(...disallowedMatches.map(match => ({ type: 'disallowed-tag', content: match })));
          sanitized = sanitized.replace(allowedTagRegex, '');
        }
      }
      
      return {
        original: input,
        sanitized: sanitized,
        removed: removed,
        hasXSS: removed.length > 0,
        changed: sanitized !== input
      };
    },
    
    // Validate content security policy for XSS
    validateCSPForXSS: (cspHeader) => {
      const validation = {
        preventsXSS: true,
        issues: [],
        recommendations: [],
        score: 0
      };
      
      if (!cspHeader) {
        validation.preventsXSS = false;
        validation.issues.push('No CSP header present');
        validation.recommendations.push('Implement Content Security Policy');
        return validation;
      }
      
      // Parse CSP directives
      const directives = cspHeader.split(';').map(dir => dir.trim());
      const directiveMap = {};
      
      directives.forEach(directive => {
        const [name, ...values] = directive.split(' ');
        directiveMap[name] = values.join(' ');
      });
      
      // Check script-src directive
      if (!directiveMap['script-src']) {
        validation.preventsXSS = false;
        validation.issues.push('Missing script-src directive');
        validation.recommendations.push('Add script-src directive to CSP');
      } else {
        // Check for unsafe values
        const scriptSrc = directiveMap['script-src'];
        
        if (scriptSrc.includes("'unsafe-inline'")) {
          validation.preventsXSS = false;
          validation.issues.push("script-src allows 'unsafe-inline'");
          validation.recommendations.push("Remove 'unsafe-inline' from script-src");
          validation.score -= 30;
        }
        
        if (scriptSrc.includes("'unsafe-eval'")) {
          validation.preventsXSS = false;
          validation.issues.push("script-src allows 'unsafe-eval'");
          validation.recommendations.push("Remove 'unsafe-eval' from script-src");
          validation.score -= 40;
        }
        
        if (scriptSrc.includes('*')) {
          validation.preventsXSS = false;
          validation.issues.push("script-src allows wildcard '*'");
          validation.recommendations.push("Replace wildcard '*' with specific domains");
          validation.score -= 20;
        }
        
        // Reward restrictive script-src
        if (scriptSrc.includes("'self'") && !scriptSrc.includes("'unsafe-inline'")) {
          validation.score += 30;
        }
      }
      
      // Check object-src directive
      if (!directiveMap['object-src']) {
        validation.recommendations.push("Add object-src 'none' to CSP");
        validation.score -= 10;
      } else if (directiveMap['object-src'].includes("'none'")) {
        validation.score += 20;
      }
      
      // Check default-src directive
      if (!directiveMap['default-src']) {
        validation.recommendations.push('Add default-src directive to CSP');
        validation.score -= 10;
      }
      
      // Calculate final score
      validation.score = Math.max(0, Math.min(100, validation.score));
      
      return validation;
    },
    
    // Test XSS in different contexts
    testXSSInContext: (input, context = 'html') => {
      const testCases = {
        html: {
          input: input,
          container: 'div',
          test: () => {
            const div = document.createElement('div');
            div.innerHTML = input;
            return div.innerHTML;
          }
        },
        attribute: {
          input: input,
          container: 'input',
          test: () => {
            const input = document.createElement('input');
            input.setAttribute('value', input);
            return input.getAttribute('value');
          }
        },
        script: {
          input: input,
          container: 'script',
          test: () => {
            try {
              eval(input);
              return 'executed';
            } catch (e) {
              return 'blocked';
            }
          }
        },
        url: {
          input: input,
          container: 'a',
          test: () => {
            const a = document.createElement('a');
            a.href = input;
            return a.href;
          }
        }
      };
      
      const testCase = testCases[context];
      if (!testCase) {
        return { error: 'Unknown test context' };
      }
      
      const detection = mockXSSProtection.xss.detectXSSPatterns(testCase.input);
      const result = {
        context: context,
        input: testCase.input,
        detected: detection.hasXSS,
        patterns: detection.patterns,
        severity: detection.severity,
        executed: false,
        output: null
      };
      
      // Execute the test if it's safe to do so
      if (context === 'script') {
        // For script context, we don't actually execute
        result.executed = false;
        result.output = 'blocked';
      } else {
        try {
          result.output = testCase.test();
          result.executed = true;
        } catch (error) {
          result.executed = false;
          result.output = 'error';
        }
      }
      
      return result;
    },
    
    // Generate XSS test payload
    generateXSSPayloads: () => {
      return {
        basic: [
          '<script>alert("XSS")</script>',
          '<img src=x onerror=alert("XSS")>',
          '<svg onload=alert("XSS")>',
          '<iframe src="javascript:alert(\'XSS\')"></iframe>',
          '<body onload=alert("XSS")>'
        ],
        encoded: [
          '&#60;script&#62;alert("XSS")&#60;/script&#62;',
          '%3Cscript%3Ealert("XSS")%3C/script%3E',
          '\\x3Cscript\\x3Ealert("XSS")\\x3C/script\\x3E',
          '\\u003Cscript\\u003Ealert("XSS")\\u003C/script\\u003E'
        ],
        advanced: [
          '<script>String.fromCharCode(88,83,83)</script>',
          '<img src=x onerror="eval(String.fromCharCode(88,83,83))">',
          '<svg><script>alert(1)</script></svg>',
          '<math><maction action=javascript:alert(1)>XSS</maction></math>',
          '<details open ontoggle=alert(1)>XSS</details>'
        ],
        context: {
          attribute: [
            '"><script>alert("XSS")</script>',
            '" onmouseover="alert(\'XSS\')"',
            "' onfocus='alert(\"XSS\")' "
          ],
          url: [
            'javascript:alert("XSS")',
            'data:text/html,<script>alert("XSS")</script>',
            'vbscript:msgbox("XSS")'
          ],
          css: [
            '<style>@import "javascript:alert(\'XSS\')";</style>',
            '<div style="background:url(javascript:alert(\'XSS\'))">',
            '<style>body{expression(alert("XSS"))}</style>'
          ]
        }
      };
    }
  }
};

describe('XSS Protection Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Mock DOM methods for testing
    global.document = {
      createElement: jest.fn((tag) => {
        const element = {
          innerHTML: '',
          setAttribute: jest.fn(),
          getAttribute: jest.fn(),
          href: ''
        };
        
        // Mock actual behavior for dangerous operations
        if (tag === 'div' && typeof arguments[1] === 'string') {
          element.innerHTML = arguments[1];
        }
        
        return element;
      })
    };
    
    global.eval = jest.fn(() => {
      throw new Error('eval blocked');
    });
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('XSS Pattern Detection', () => {
    test('should detect script tag injection', () => {
      const inputs = [
        '<script>alert("XSS")</script>',
        '<script src="malicious.js"></script>',
        '<SCRIPT>alert("XSS")</SCRIPT>'
      ];
      
      inputs.forEach(input => {
        const result = mockXSSProtection.xss.detectXSSPatterns(input);
        
        expect(result.hasXSS).toBe(true);
        expect(result.patterns.some(p => p.category === 'script')).toBe(true);
        expect(result.severity).toBe('high');
      });
    });
    
    test('should detect event handler injection', () => {
      const inputs = [
        '<img onclick="alert(\'XSS\')" src="image.jpg">',
        '<div onload="alert(\'XSS\')">Content</div>',
        '<body onmouseover="alert(\'XSS\')">'
      ];
      
      inputs.forEach(input => {
        const result = mockXSSProtection.xss.detectXSSPatterns(input);
        
        expect(result.hasXSS).toBe(true);
        expect(result.patterns.some(p => p.category === 'eventHandler')).toBe(true);
        expect(result.severity).toBe('medium');
      });
    });
    
    test('should detect JavaScript protocol injection', () => {
      const inputs = [
        'javascript:alert("XSS")',
        'JAVASCRIPT:alert("XSS")',
        '<a href="javascript:alert(\'XSS\')">Link</a>',
        'data:text/html,<script>alert("XSS")</script>'
      ];
      
      inputs.forEach(input => {
        const result = mockXSSProtection.xss.detectXSSPatterns(input);
        
        expect(result.hasXSS).toBe(true);
        expect(result.patterns.some(p => p.category === 'javascriptProtocol')).toBe(true);
        expect(result.severity).toBe('high');
      });
    });
    
    test('should detect dynamic code execution', () => {
      const inputs = [
        'eval("alert(\'XSS\')")',
        'new Function("alert(\'XSS\')")',
        'setTimeout("alert(\'XSS\')", 100)',
        'setInterval("alert(\'XSS\')", 100)'
      ];
      
      inputs.forEach(input => {
        const result = mockXSSProtection.xss.detectXSSPatterns(input);
        
        expect(result.hasXSS).toBe(true);
        expect(result.patterns.some(p => p.category === 'eval')).toBe(true);
        expect(result.severity).toBe('high');
      });
    });
    
    test('should detect iframe and object injection', () => {
      const inputs = [
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        '<object data="text/html,<script>alert(\'XSS\')</script>"></object>',
        '<embed src="javascript:alert(\'XSS\')" type="text/html">'
      ];
      
      inputs.forEach(input => {
        const result = mockXSSProtection.xss.detectXSSPatterns(input);
        
        expect(result.hasXSS).toBe(true);
        expect(result.patterns.some(p => ['iframe', 'object'].includes(p.category))).toBe(true);
        expect(result.severity).toBe('medium');
      });
    });
    
    test('should detect encoded XSS', () => {
      const inputs = [
        '&#60;script&#62;alert("XSS")&#60;/script&#62;',
        '%3Cscript%3Ealert("XSS")%3C/script%3E',
        '\\x3Cscript\\x3Ealert("XSS")\\x3C/script\\x3E',
        '\\u003Cscript\\u003Ealert("XSS")\\u003C/script\\u003E'
      ];
      
      inputs.forEach(input => {
        const result = mockXSSProtection.xss.detectXSSPatterns(input);
        
        expect(result.hasXSS).toBe(true);
        expect(result.patterns.some(p => p.category === 'encoding')).toBe(true);
        expect(result.severity).toBe('medium');
      });
    });
    
    test('should handle safe input', () => {
      const inputs = [
        'Hello World',
        'This is safe content',
        'Regular text without scripts',
        'Normal HTML: <p>Paragraph</p>'
      ];
      
      inputs.forEach(input => {
        const result = mockXSSProtection.xss.detectXSSPatterns(input);
        
        expect(result.hasXSS).toBe(false);
        expect(result.patterns).toHaveLength(0);
        expect(result.severity).toBe('none');
      });
    });
  });
  
  describe('XSS Sanitization', () => {
    test('should remove script tags', () => {
      const input = '<div><script>alert("XSS")</script><p>Content</p></div>';
      const result = mockXSSProtection.xss.sanitizeXSS(input);
      
      expect(result.sanitized).toBe('<div><p>Content</p></div>');
      expect(result.hasXSS).toBe(true);
      expect(result.removed.some(r => r.type === 'script')).toBe(true);
      expect(result.changed).toBe(true);
    });
    
    test('should remove event handlers', () => {
      const input = '<img onclick="alert(\'XSS\')" onload="alert(\'XSS\')" src="image.jpg">';
      const result = mockXSSProtection.xss.sanitizeXSS(input);
      
      expect(result.sanitized).not.toContain('onclick');
      expect(result.sanitized).not.toContain('onload');
      expect(result.hasXSS).toBe(true);
      expect(result.removed.some(r => r.type === 'event')).toBe(true);
    });
    
    test('should remove JavaScript protocols', () => {
      const input = '<a href="javascript:alert(\'XSS\')">Link</a>';
      const result = mockXSSProtection.xss.sanitizeXSS(input);
      
      expect(result.sanitized).not.toContain('javascript:');
      expect(result.hasXSS).toBe(true);
      expect(result.removed.some(r => r.type === 'protocol')).toBe(true);
    });
    
    test('should block dynamic code execution', () => {
      const input = 'eval("alert(\'XSS\')"); new Function("alert(\'XSS\')")';
      const result = mockXSSProtection.xss.sanitizeXSS(input);
      
      expect(result.sanitized).toContain('blocked(');
      expect(result.hasXSS).toBe(true);
      expect(result.removed.some(r => r.type === 'dynamic')).toBe(true);
    });
    
    test('should remove iframes and objects', () => {
      const input = '<iframe src="javascript:alert(\'XSS\')"></iframe><object data="malicious"></object>';
      const result = mockXSSProtection.xss.sanitizeXSS(input);
      
      expect(result.sanitized).not.toContain('<iframe');
      expect(result.sanitized).not.toContain('<object');
      expect(result.hasXSS).toBe(true);
      expect(result.removed.some(r => r.type === 'embed')).toBe(true);
    });
    
    test('should allow safe HTML when configured', () => {
      const input = '<div><p>Safe content</p><span>More content</span></div>';
      const result = mockXSSProtection.xss.sanitizeXSS(input, {
        allowSafeHTML: true,
        allowedTags: ['div', 'p', 'span']
      });
      
      expect(result.sanitized).toBe(input);
      expect(result.hasXSS).toBe(false);
      expect(result.removed).toHaveLength(0);
      expect(result.changed).toBe(false);
    });
    
    test('should remove disallowed HTML tags', () => {
      const input = '<div><p>Safe</p><script>alert("XSS")</script><span>Content</span></div>';
      const result = mockXSSProtection.xss.sanitizeXSS(input, {
        allowSafeHTML: true,
        allowedTags: ['div', 'p', 'span']
      });
      
      expect(result.sanitized).toBe('<div><p>Safe</p><span>Content</span></div>');
      expect(result.hasXSS).toBe(true);
      expect(result.removed.some(r => r.type === 'script')).toBe(true);
    });
  });
  
  describe('CSP XSS Protection Validation', () => {
    test('should validate strong CSP against XSS', () => {
      const csp = "script-src 'self'; object-src 'none'; default-src 'self'";
      const result = mockXSSProtection.xss.validateCSPForXSS(csp);
      
      expect(result.preventsXSS).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.score).toBeGreaterThan(40);
    });
    
    test('should detect unsafe-inline in CSP', () => {
      const csp = "script-src 'self' 'unsafe-inline'; object-src 'none'";
      const result = mockXSSProtection.xss.validateCSPForXSS(csp);
      
      expect(result.preventsXSS).toBe(false);
      expect(result.issues).toContain("script-src allows 'unsafe-inline'");
      expect(result.recommendations).toContain("Remove 'unsafe-inline' from script-src");
      expect(result.score).toBeLessThan(0);
    });
    
    test('should detect unsafe-eval in CSP', () => {
      const csp = "script-src 'self' 'unsafe-eval'; object-src 'none'";
      const result = mockXSSProtection.xss.validateCSPForXSS(csp);
      
      expect(result.preventsXSS).toBe(false);
      expect(result.issues).toContain("script-src allows 'unsafe-eval'");
      expect(result.recommendations).toContain("Remove 'unsafe-eval' from script-src");
      expect(result.score).toBeLessThan(0);
    });
    
    test('should detect wildcard in script-src', () => {
      const csp = "script-src *; object-src 'none'";
      const result = mockXSSProtection.xss.validateCSPForXSS(csp);
      
      expect(result.preventsXSS).toBe(false);
      expect(result.issues).toContain("script-src allows wildcard '*'");
      expect(result.recommendations).toContain("Replace wildcard '*' with specific domains");
      expect(result.score).toBeLessThan(0);
    });
    
    test('should detect missing CSP header', () => {
      const result = mockXSSProtection.xss.validateCSPForXSS(null);
      
      expect(result.preventsXSS).toBe(false);
      expect(result.issues).toContain('No CSP header present');
      expect(result.recommendations).toContain('Implement Content Security Policy');
    });
    
    test('should reward restrictive CSP directives', () => {
      const csp = "script-src 'self'; object-src 'none'; default-src 'self'";
      const result = mockXSSProtection.xss.validateCSPForXSS(csp);
      
      expect(result.preventsXSS).toBe(true);
      expect(result.score).toBeGreaterThan(40); // script-src 'self' + object-src 'none'
    });
  });
  
  describe('XSS Context Testing', () => {
    test('should test XSS in HTML context', () => {
      const input = '<script>alert("XSS")</script>';
      const result = mockXSSProtection.xss.testXSSInContext(input, 'html');
      
      expect(result.context).toBe('html');
      expect(result.detected).toBe(true);
      expect(result.patterns.some(p => p.category === 'script')).toBe(true);
      expect(result.severity).toBe('high');
    });
    
    test('should test XSS in attribute context', () => {
      const input = '"><script>alert("XSS")</script>';
      const result = mockXSSProtection.xss.testXSSInContext(input, 'attribute');
      
      expect(result.context).toBe('attribute');
      expect(result.detected).toBe(true);
      expect(result.severity).toBe('high');
    });
    
    test('should test XSS in script context', () => {
      const input = 'alert("XSS")';
      const result = mockXSSProtection.xss.testXSSInContext(input, 'script');
      
      expect(result.context).toBe('script');
      expect(result.output).toBe('blocked');
      expect(result.executed).toBe(false);
    });
    
    test('should test XSS in URL context', () => {
      const input = 'javascript:alert("XSS")';
      const result = mockXSSProtection.xss.testXSSInContext(input, 'url');
      
      expect(result.context).toBe('url');
      expect(result.detected).toBe(true);
      expect(result.patterns.some(p => p.category === 'javascriptProtocol')).toBe(true);
    });
  });
  
  describe('XSS Payload Generation', () => {
    test('should generate basic XSS payloads', () => {
      const payloads = mockXSSProtection.xss.generateXSSPayloads();
      
      expect(payloads.basic).toContain('<script>alert("XSS")</script>');
      expect(payloads.basic).toContain('<img src=x onerror=alert("XSS")>');
      expect(payloads.basic).toContain('<svg onload=alert("XSS")>');
      expect(payloads.basic.length).toBeGreaterThan(4);
    });
    
    test('should generate encoded XSS payloads', () => {
      const payloads = mockXSSProtection.xss.generateXSSPayloads();
      
      expect(payloads.encoded).toContain('&#60;script&#62;alert("XSS")&#60;/script&#62;');
      expect(payloads.encoded).toContain('%3Cscript%3Ealert("XSS")%3C/script%3E');
      expect(payloads.encoded).toContain('\\x3Cscript\\x3Ealert("XSS")\\x3C/script\\x3E');
      expect(payloads.encoded.length).toBeGreaterThan(3);
    });
    
    test('should generate advanced XSS payloads', () => {
      const payloads = mockXSSProtection.xss.generateXSSPayloads();
      
      expect(payloads.advanced).toContain('String.fromCharCode(88,83,83)');
      expect(payloads.advanced).toContain('<svg><script>alert(1)</script></svg>');
      expect(payloads.advanced).toContain('<details open ontoggle=alert(1)>XSS</details>');
      expect(payloads.advanced.length).toBeGreaterThan(3);
    });
    
    test('should generate context-specific payloads', () => {
      const payloads = mockXSSProtection.xss.generateXSSPayloads();
      
      // Attribute context payloads
      expect(payloads.context.attribute).toContain('"><script>alert("XSS")</script>');
      expect(payloads.context.attribute).toContain('" onmouseover="alert(\'XSS\')"');
      
      // URL context payloads
      expect(payloads.context.url).toContain('javascript:alert("XSS")');
      expect(payloads.context.url).toContain('data:text/html,<script>alert("XSS")</script>');
      
      // CSS context payloads
      expect(payloads.context.css).toContain('<style>@import "javascript:alert(\'XSS\')";</style>');
      expect(payloads.context.css).toContain('<div style="background:url(javascript:alert(\'XSS\'))">');
    });
  });
  
  describe('XSS Protection Best Practices', () => {
    test('should handle null and undefined input', () => {
      const nullResult = mockXSSProtection.xss.detectXSSPatterns(null);
      expect(nullResult.hasXSS).toBe(false);
      expect(nullResult.patterns).toHaveLength(0);
      
      const undefinedResult = mockXSSProtection.xss.detectXSSPatterns(undefined);
      expect(undefinedResult.hasXSS).toBe(false);
      expect(undefinedResult.patterns).toHaveLength(0);
    });
    
    test('should handle empty input', () => {
      const result = mockXSSProtection.xss.detectXSSPatterns('');
      expect(result.hasXSS).toBe(false);
      expect(result.patterns).toHaveLength(0);
    });
    
    test('should detect multiple XSS patterns in single input', () => {
      const input = '<script>alert("XSS")</script><img onclick="alert(\'XSS\')" src="x">';
      const result = mockXSSProtection.xss.detectXSSPatterns(input);
      
      expect(result.hasXSS).toBe(true);
      expect(result.patterns.length).toBeGreaterThan(1);
      expect(result.patterns.some(p => p.category === 'script')).toBe(true);
      expect(result.patterns.some(p => p.category === 'eventHandler')).toBe(true);
    });
    
    test('should prioritize high severity patterns', () => {
      const input = '<script>alert("XSS")</script><div onclick="alert(\'XSS\')">';
      const result = mockXSSProtection.xss.detectXSSPatterns(input);
      
      expect(result.severity).toBe('high'); // script tag is high severity
    });
  });
});
