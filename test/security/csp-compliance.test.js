/**
 * CSP Compliance Tests
 * Tests for Content Security Policy compliance and validation
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock CSP validation module
const mockCSPValidator = {
  // CSP validator
  csp: {
    // Validate CSP headers
    validateCSPHeaders: (headers) => {
      const validation = {
        valid: true,
        issues: [],
        recommendations: [],
        score: 0
      };
      
      const cspHeader = headers['content-security-policy'] || headers['Content-Security-Policy'];
      
      if (!cspHeader) {
        validation.valid = false;
        validation.issues.push('CSP header is missing');
        validation.recommendations.push('Implement Content Security Policy header');
        return validation;
      }
      
      // Parse CSP directives
      const directives = cspHeader.split(';').map(dir => dir.trim());
      const directiveMap = {};
      
      directives.forEach(directive => {
        const [name, ...values] = directive.split(' ');
        directiveMap[name] = values.join(' ');
      });
      
      // Check for essential directives
      const essentialDirectives = ['default-src', 'script-src', 'style-src'];
      essentialDirectives.forEach(directive => {
        if (!directiveMap[directive]) {
          validation.issues.push(`Missing essential CSP directive: ${directive}`);
          validation.valid = false;
        } else {
          validation.score += 10;
        }
      });
      
      // Check for unsafe directives
      if (directiveMap['script-src'] && directiveMap['script-src'].includes("'unsafe-inline'")) {
        validation.issues.push("script-src contains 'unsafe-inline'");
        validation.recommendations.push("Remove 'unsafe-inline' from script-src");
        validation.score -= 20;
      }
      
      if (directiveMap['script-src'] && directiveMap['script-src'].includes("'unsafe-eval'")) {
        validation.issues.push("script-src contains 'unsafe-eval'");
        validation.recommendations.push("Remove 'unsafe-eval' from script-src");
        validation.score -= 30;
      }
      
      if (directiveMap['default-src'] && directiveMap['default-src'].includes('*')) {
        validation.issues.push("default-src contains wildcard '*'");
        validation.recommendations.push("Replace wildcard '*' with specific domains");
        validation.score -= 15;
      }
      
      // Check for nonces or hashes
      const hasNonce = directiveMap['script-src'] && directiveMap['script-src'].includes("'nonce-");
      const hasHash = directiveMap['script-src'] && 
                     (directiveMap['script-src'].includes("'sha256-") ||
                      directiveMap['script-src'].includes("'sha384-") ||
                      directiveMap['script-src'].includes("'sha512-"));
      
      if (hasNonce || hasHash) {
        validation.score += 15;
      } else if (!directiveMap['script-src'] || 
                 !directiveMap['script-src'].includes("'unsafe-inline'")) {
        validation.recommendations.push('Consider using nonces or hashes for inline scripts');
      }
      
      // Check for HTTPS enforcement
      const hasHTTPS = Object.values(directiveMap).some(value => 
        value.includes('https:') && !value.includes('http:')
      );
      
      if (hasHTTPS) {
        validation.score += 10;
      } else {
        validation.recommendations.push('Enforce HTTPS in CSP directives');
      }
      
      // Calculate final score
      validation.score = Math.max(0, Math.min(100, validation.score));
      
      return validation;
    },
    
    // Validate inline script compliance
    validateInlineScripts: (htmlContent) => {
      const validation = {
        compliant: true,
        violations: [],
        recommendations: []
      };
      
      // Check for inline scripts
      const inlineScriptRegex = /<script[^>]*>([^<]*)<\/script>/gi;
      const inlineScripts = htmlContent.match(inlineScriptRegex) || [];
      
      if (inlineScripts.length > 0) {
        validation.compliant = false;
        validation.violations.push(`Found ${inlineScripts.length} inline script(s)`);
        validation.recommendations.push('Move inline scripts to external files');
        validation.recommendations.push('Use CSP nonces or hashes for necessary inline scripts');
      }
      
      // Check for inline event handlers
      const inlineEventRegex = /on\w+\s*=\s*["'][^"']*["']/gi;
      const inlineEvents = htmlContent.match(inlineEventRegex) || [];
      
      if (inlineEvents.length > 0) {
        validation.compliant = false;
        validation.violations.push(`Found ${inlineEvents.length} inline event handler(s)`);
        validation.recommendations.push('Replace inline event handlers with addEventListener');
      }
      
      // Check for javascript: URLs
      const javascriptURLRegex = /javascript\s*:/gi;
      const javascriptURLs = htmlContent.match(javascriptURLRegex) || [];
      
      if (javascriptURLs.length > 0) {
        validation.compliant = false;
        validation.violations.push(`Found ${javascriptURLs.length} javascript: URL(s)`);
        validation.recommendations.push('Replace javascript: URLs with event handlers');
      }
      
      return validation;
    },
    
    // Validate dynamic code execution
    validateDynamicCode: (code) => {
      const validation = {
        safe: true,
        risks: [],
        recommendations: []
      };
      
      // Check for eval usage
      const evalRegex = /\beval\s*\(/gi;
      const evalMatches = code.match(evalRegex) || [];
      
      if (evalMatches.length > 0) {
        validation.safe = false;
        validation.risks.push(`Found ${evalMatches.length} eval() usage(s)`);
        validation.recommendations.push('Avoid using eval() function');
      }
      
      // Check for Function constructor
      const functionRegex = /\bnew\s+Function\s*\(/gi;
      const functionMatches = code.match(functionRegex) || [];
      
      if (functionMatches.length > 0) {
        validation.safe = false;
        validation.risks.push(`Found ${functionMatches.length} Function constructor usage(s)`);
        validation.recommendations.push('Avoid using Function constructor');
      }
      
      // Check for setTimeout with string
      const setTimeoutRegex = /\bsetTimeout\s*\(\s*["']/gi;
      const setTimeoutMatches = code.match(setTimeoutRegex) || [];
      
      if (setTimeoutMatches.length > 0) {
        validation.safe = false;
        validation.risks.push(`Found ${setTimeoutMatches.length} setTimeout with string argument(s)`);
        validation.recommendations.push('Use function references instead of strings in setTimeout');
      }
      
      // Check for setInterval with string
      const setIntervalRegex = /\bsetInterval\s*\(\s*["']/gi;
      const setIntervalMatches = code.match(setIntervalRegex) || [];
      
      if (setIntervalMatches.length > 0) {
        validation.safe = false;
        validation.risks.push(`Found ${setIntervalMatches.length} setInterval with string argument(s)`);
        validation.recommendations.push('Use function references instead of strings in setInterval');
      }
      
      return validation;
    },
    
    // Validate resource loading
    validateResourceLoading: (resources) => {
      const validation = {
        secure: true,
        violations: [],
        recommendations: []
      };
      
      resources.forEach(resource => {
        // Check for HTTP resources
        if (resource.url && resource.url.startsWith('http://')) {
          validation.secure = false;
          validation.violations.push(`Insecure resource loaded: ${resource.url}`);
          validation.recommendations.push('Use HTTPS for all resources');
        }
        
        // Check for mixed content
        if (resource.type === 'script' && resource.url && !resource.url.startsWith('https://')) {
          validation.secure = false;
          validation.violations.push(`Mixed content script: ${resource.url}`);
          validation.recommendations.push('Load all scripts over HTTPS');
        }
        
        // Check for external resources without integrity
        if (resource.external && !resource.integrity) {
          validation.violations.push(`External resource without integrity: ${resource.url}`);
          validation.recommendations.push('Add integrity attributes to external resources');
        }
      });
      
      return validation;
    },
    
    // Validate CSP nonce usage
    validateNonceUsage: (htmlContent, cspHeader) => {
      const validation = {
        valid: true,
        issues: [],
        recommendations: []
      };
      
      // Extract nonces from CSP
      const nonceRegex = /'nonce-([^']+)'/gi;
      const cspNonces = [];
      let match;
      
      while ((match = nonceRegex.exec(cspHeader)) !== null) {
        cspNonces.push(match[1]);
      }
      
      // Extract nonces from HTML
      const htmlNonceRegex = /nonce\s*=\s*["']([^"']+)["']/gi;
      const htmlNonces = [];
      
      while ((match = htmlNonceRegex.exec(htmlContent)) !== null) {
        htmlNonces.push(match[1]);
      }
      
      // Check if nonces in HTML match CSP
      htmlNonces.forEach(nonce => {
        if (!cspNonces.includes(nonce)) {
          validation.valid = false;
          validation.issues.push(`HTML nonce not found in CSP: ${nonce}`);
        }
      });
      
      // Check if CSP nonces are used in HTML
      cspNonces.forEach(nonce => {
        if (!htmlNonces.includes(nonce)) {
          validation.recommendations.push(`CSP nonce not used in HTML: ${nonce}`);
        }
      });
      
      // Check for nonce uniqueness
      const uniqueNonces = [...new Set(htmlNonces)];
      if (uniqueNonces.length < htmlNonces.length) {
        validation.issues.push('Duplicate nonces found in HTML');
        validation.valid = false;
      }
      
      return validation;
    },
    
    // Validate CSP in extension context
    validateExtensionCSP: (manifest) => {
      const validation = {
        compliant: true,
        violations: [],
        recommendations: [],
        score: 0
      };
      
      // Check manifest CSP
      if (manifest.content_security_policy) {
        const cspValidation = mockCSPValidator.csp.validateCSPHeaders({
          'content-security-policy': manifest.content_security_policy
        });
        
        validation.compliant = validation.compliant && cspValidation.valid;
        validation.violations.push(...cspValidation.issues);
        validation.recommendations.push(...cspValidation.recommendations);
        validation.score += cspValidation.score;
      } else {
        validation.recommendations.push('Add content_security_policy to manifest');
        validation.score -= 20;
      }
      
      // Check for extension-specific CSP issues
      if (manifest.content_security_policy) {
        const csp = manifest.content_security_policy;
        
        // Check for unsafe-eval in extension context
        if (csp.includes("'unsafe-eval'")) {
          validation.compliant = false;
          validation.violations.push("Extension CSP contains 'unsafe-eval'");
          validation.score -= 30;
        }
        
        // Check for script-src 'self' only
        if (csp.includes("script-src 'self'")) {
          validation.score += 15;
        } else if (csp.includes('script-src')) {
          validation.recommendations.push('Restrict script-src to \'self\' in extension');
        }
        
        // Check for object-src 'none'
        if (csp.includes("object-src 'none'")) {
          validation.score += 10;
        } else {
          validation.recommendations.push("Set object-src to 'none' in extension CSP");
        }
      }
      
      // Calculate final score
      validation.score = Math.max(0, Math.min(100, validation.score));
      
      return validation;
    }
  }
};

describe('CSP Compliance Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('CSP Header Validation', () => {
    test('should validate comprehensive CSP header', () => {
      const headers = {
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'nonce-abc123'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.openrouter.ai"
      };
      
      const result = mockCSPValidator.csp.validateCSPHeaders(headers);
      
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.score).toBeGreaterThan(50);
    });
    
    test('should detect missing CSP header', () => {
      const headers = {};
      
      const result = mockCSPValidator.csp.validateCSPHeaders(headers);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('CSP header is missing');
      expect(result.recommendations).toContain('Implement Content Security Policy header');
    });
    
    test('should detect unsafe-inline in script-src', () => {
      const headers = {
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'"
      };
      
      const result = mockCSPValidator.csp.validateCSPHeaders(headers);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain("script-src contains 'unsafe-inline'");
      expect(result.recommendations).toContain("Remove 'unsafe-inline' from script-src");
    });
    
    test('should detect unsafe-eval in script-src', () => {
      const headers = {
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval'"
      };
      
      const result = mockCSPValidator.csp.validateCSPHeaders(headers);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain("script-src contains 'unsafe-eval'");
      expect(result.recommendations).toContain("Remove 'unsafe-eval' from script-src");
    });
    
    test('should detect wildcard in default-src', () => {
      const headers = {
        'Content-Security-Policy': "default-src *; script-src 'self'"
      };
      
      const result = mockCSPValidator.csp.validateCSPHeaders(headers);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain("default-src contains wildcard '*'");
      expect(result.recommendations).toContain("Replace wildcard '*' with specific domains");
    });
    
    test('should reward nonce usage', () => {
      const headers = {
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'nonce-abc123'"
      };
      
      const result = mockCSPValidator.csp.validateCSPHeaders(headers);
      
      expect(result.score).toBeGreaterThan(30); // Base score + nonce bonus
    });
  });
  
  describe('Inline Script Validation', () => {
    test('should detect inline scripts', () => {
      const htmlContent = `
        <html>
          <head>
            <script>alert('Hello World');</script>
            <script src="external.js"></script>
          </head>
          <body>
            <script>console.log('Inline script');</script>
          </body>
        </html>
      `;
      
      const result = mockCSPValidator.csp.validateInlineScripts(htmlContent);
      
      expect(result.compliant).toBe(false);
      expect(result.violations).toContain('Found 2 inline script(s)');
      expect(result.recommendations).toContain('Move inline scripts to external files');
    });
    
    test('should detect inline event handlers', () => {
      const htmlContent = `
        <html>
          <body>
            <button onclick="alert('Clicked')">Click me</button>
            <div onmouseover="this.style.color='red'">Hover me</div>
            <img onload="console.log('Image loaded')" src="image.jpg">
          </body>
        </html>
      `;
      
      const result = mockCSPValidator.csp.validateInlineScripts(htmlContent);
      
      expect(result.compliant).toBe(false);
      expect(result.violations).toContain('Found 3 inline event handler(s)');
      expect(result.recommendations).toContain('Replace inline event handlers with addEventListener');
    });
    
    test('should detect javascript: URLs', () => {
      const htmlContent = `
        <html>
          <body>
            <a href="javascript:alert('Hello')">Link</a>
            <iframe src="javascript:'<div>Content</div>'"></iframe>
          </body>
        </html>
      `;
      
      const result = mockCSPValidator.csp.validateInlineScripts(htmlContent);
      
      expect(result.compliant).toBe(false);
      expect(result.violations).toContain('Found 2 javascript: URL(s)');
      expect(result.recommendations).toContain('Replace javascript: URLs with event handlers');
    });
    
    test('should validate CSP-compliant HTML', () => {
      const htmlContent = `
        <html>
          <head>
            <script src="external.js"></script>
            <link rel="stylesheet" href="styles.css">
          </head>
          <body>
            <button id="btn">Click me</button>
          </body>
        </html>
      `;
      
      const result = mockCSPValidator.csp.validateInlineScripts(htmlContent);
      
      expect(result.compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });
  
  describe('Dynamic Code Validation', () => {
    test('should detect eval usage', () => {
      const code = `
        function processData(data) {
          const result = eval('(' + data + ')');
          return result;
        }
        
        const dynamic = eval('Math.random()');
      `;
      
      const result = mockCSPValidator.csp.validateDynamicCode(code);
      
      expect(result.safe).toBe(false);
      expect(result.risks).toContain('Found 2 eval() usage(s)');
      expect(result.recommendations).toContain('Avoid using eval() function');
    });
    
    test('should detect Function constructor usage', () => {
      const code = `
        const dynamicFunction = new Function('a', 'b', 'return a + b');
        const anotherFunc = new Function('console.log("Hello")');
      `;
      
      const result = mockCSPValidator.csp.validateDynamicCode(code);
      
      expect(result.safe).toBe(false);
      expect(result.risks).toContain('Found 2 Function constructor usage(s)');
      expect(result.recommendations).toContain('Avoid using Function constructor');
    });
    
    test('should detect setTimeout with string', () => {
      const code = `
        setTimeout('alert("Delayed")', 1000);
        setTimeout('console.log("Another")', 2000);
        setTimeout(function() { console.log("Safe"); }, 3000);
      `;
      
      const result = mockCSPValidator.csp.validateDynamicCode(code);
      
      expect(result.safe).toBe(false);
      expect(result.risks).toContain('Found 2 setTimeout with string argument(s)');
      expect(result.recommendations).toContain('Use function references instead of strings in setTimeout');
    });
    
    test('should detect setInterval with string', () => {
      const code = `
        setInterval('updateClock()', 1000);
        setInterval(function() { console.log("Safe"); }, 2000);
      `;
      
      const result = mockCSPValidator.csp.validateDynamicCode(code);
      
      expect(result.safe).toBe(false);
      expect(result.risks).toContain('Found 1 setInterval with string argument(s)');
      expect(result.recommendations).toContain('Use function references instead of strings in setInterval');
    });
    
    test('should validate safe dynamic code', () => {
      const code = `
        function processData(data) {
          return JSON.parse(data);
        }
        
        setTimeout(function() { console.log("Safe"); }, 1000);
        setInterval(function() { updateUI(); }, 1000);
      `;
      
      const result = mockCSPValidator.csp.validateDynamicCode(code);
      
      expect(result.safe).toBe(true);
      expect(result.risks).toHaveLength(0);
    });
  });
  
  describe('Resource Loading Validation', () => {
    test('should detect insecure HTTP resources', () => {
      const resources = [
        { url: 'http://example.com/script.js', type: 'script' },
        { url: 'https://secure.com/style.css', type: 'style' },
        { url: 'http://insecure.com/image.jpg', type: 'image' }
      ];
      
      const result = mockCSPValidator.csp.validateResourceLoading(resources);
      
      expect(result.secure).toBe(false);
      expect(result.violations).toContain('Insecure resource loaded: http://example.com/script.js');
      expect(result.violations).toContain('Insecure resource loaded: http://insecure.com/image.jpg');
      expect(result.recommendations).toContain('Use HTTPS for all resources');
    });
    
    test('should detect mixed content', () => {
      const resources = [
        { url: 'https://secure.com/script.js', type: 'script' },
        { url: 'http://mixed.com/script.js', type: 'script' }
      ];
      
      const result = mockCSPValidator.csp.validateResourceLoading(resources);
      
      expect(result.secure).toBe(false);
      expect(result.violations).toContain('Mixed content script: http://mixed.com/script.js');
      expect(result.recommendations).toContain('Load all scripts over HTTPS');
    });
    
    test('should detect external resources without integrity', () => {
      const resources = [
        { url: 'https://cdn.com/lib.js', type: 'script', external: true },
        { url: 'https://cdn.com/lib.js', type: 'script', external: true, integrity: 'sha384-abc123' }
      ];
      
      const result = mockCSPValidator.csp.validateResourceLoading(resources);
      
      expect(result.violations).toContain('External resource without integrity: https://cdn.com/lib.js');
      expect(result.recommendations).toContain('Add integrity attributes to external resources');
    });
    
    test('should validate secure resource loading', () => {
      const resources = [
        { url: 'https://secure.com/script.js', type: 'script', external: true, integrity: 'sha384-abc123' },
        { url: 'https://secure.com/style.css', type: 'style', external: true, integrity: 'sha256-def456' },
        { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', type: 'image' }
      ];
      
      const result = mockCSPValidator.csp.validateResourceLoading(resources);
      
      expect(result.secure).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });
  
  describe('CSP Nonce Validation', () => {
    test('should validate matching nonces', () => {
      const htmlContent = `
        <html>
          <head>
            <script nonce="abc123">console.log('Safe');</script>
          </head>
          <body>
            <script nonce="def456">console.log('Another');</script>
          </body>
        </html>
      `;
      
      const cspHeader = "script-src 'self' 'nonce-abc123' 'nonce-def456'";
      
      const result = mockCSPValidator.csp.validateNonceUsage(htmlContent, cspHeader);
      
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
    
    test('should detect HTML nonce not in CSP', () => {
      const htmlContent = `
        <html>
          <script nonce="abc123">console.log('Test');</script>
        </html>
      `;
      
      const cspHeader = "script-src 'self' 'nonce-def456'";
      
      const result = mockCSPValidator.csp.validateNonceUsage(htmlContent, cspHeader);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('HTML nonce not found in CSP: abc123');
    });
    
    test('should detect duplicate nonces', () => {
      const htmlContent = `
        <html>
          <script nonce="abc123">console.log('Test 1');</script>
          <script nonce="abc123">console.log('Test 2');</script>
        </html>
      `;
      
      const cspHeader = "script-src 'self' 'nonce-abc123'";
      
      const result = mockCSPValidator.csp.validateNonceUsage(htmlContent, cspHeader);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Duplicate nonces found in HTML');
    });
    
    test('should detect unused CSP nonces', () => {
      const htmlContent = `
        <html>
          <script nonce="abc123">console.log('Test');</script>
        </html>
      `;
      
      const cspHeader = "script-src 'self' 'nonce-abc123' 'nonce-unused123'";
      
      const result = mockCSPValidator.csp.validateNonceUsage(htmlContent, cspHeader);
      
      expect(result.valid).toBe(true);
      expect(result.recommendations).toContain('CSP nonce not used in HTML: unused123');
    });
  });
  
  describe('Extension CSP Validation', () => {
    test('should validate compliant extension manifest', () => {
      const manifest = {
        content_security_policy: "script-src 'self'; object-src 'none'; connect-src 'self' https://api.openrouter.ai"
      };
      
      const result = mockCSPValidator.csp.validateExtensionCSP(manifest);
      
      expect(result.compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.score).toBeGreaterThan(50);
    });
    
    test('should detect missing CSP in manifest', () => {
      const manifest = {};
      
      const result = mockCSPValidator.csp.validateExtensionCSP(manifest);
      
      expect(result.compliant).toBe(true);
      expect(result.recommendations).toContain('Add content_security_policy to manifest');
      expect(result.score).toBeLessThan(0);
    });
    
    test('should detect unsafe-eval in extension CSP', () => {
      const manifest = {
        content_security_policy: "script-src 'self' 'unsafe-eval'; object-src 'none'"
      };
      
      const result = mockCSPValidator.csp.validateExtensionCSP(manifest);
      
      expect(result.compliant).toBe(false);
      expect(result.violations).toContain("Extension CSP contains 'unsafe-eval'");
      expect(result.score).toBeLessThan(0);
    });
    
    test('should reward restrictive script-src', () => {
      const manifest = {
        content_security_policy: "script-src 'self'; object-src 'none'"
      };
      
      const result = mockCSPValidator.csp.validateExtensionCSP(manifest);
      
      expect(result.score).toBeGreaterThan(20); // Base score + script-src 'self' bonus
    });
    
    test('should recommend object-src none', () => {
      const manifest = {
        content_security_policy: "script-src 'self'"
      };
      
      const result = mockCSPValidator.csp.validateExtensionCSP(manifest);
      
      expect(result.recommendations).toContain("Set object-src to 'none' in extension CSP");
    });
  });
  
  describe('CSP Security Best Practices', () => {
    test('should enforce strict CSP policies', () => {
      const strictCSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://api.openrouter.ai; font-src 'self'; object-src 'none'; frame-ancestors 'none';";
      
      const result = mockCSPValidator.csp.validateCSPHeaders({
        'Content-Security-Policy': strictCSP
      });
      
      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThan(70);
    });
    
    test('should identify weak CSP policies', () => {
      const weakCSP = "default-src *; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'";
      
      const result = mockCSPValidator.csp.validateCSPHeaders({
        'Content-Security-Policy': weakCSP
      });
      
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(2);
      expect(result.score).toBeLessThan(0);
    });
    
    test('should validate CSP in extension context', () => {
      const extensionManifest = {
        content_security_policy: "script-src 'self'; object-src 'none'; connect-src 'self' https://api.openrouter.ai"
      };
      
      const result = mockCSPValidator.csp.validateExtensionCSP(extensionManifest);
      
      expect(result.compliant).toBe(true);
      expect(result.score).toBeGreaterThan(40);
    });
  });
}); * CSP Compliance Tests
 * Tests for Content Security Policy compliance and validation
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock CSP validation module
const mockCSPValidator = {
  // CSP validator
  csp: {
    // Validate CSP headers
    validateCSPHeaders: (headers) => {
      const validation = {
        valid: true,
        issues: [],
        recommendations: [],
        score: 0
      };
      
      const cspHeader = headers['content-security-policy'] || headers['Content-Security-Policy'];
      
      if (!cspHeader) {
        validation.valid = false;
        validation.issues.push('CSP header is missing');
        validation.recommendations.push('Implement Content Security Policy header');
        return validation;
      }
      
      // Parse CSP directives
      const directives = cspHeader.split(';').map(dir => dir.trim());
      const directiveMap = {};
      
      directives.forEach(directive => {
        const [name, ...values] = directive.split(' ');
        directiveMap[name] = values.join(' ');
      });
      
      // Check for essential directives
      const essentialDirectives = ['default-src', 'script-src', 'style-src'];
      essentialDirectives.forEach(directive => {
        if (!directiveMap[directive]) {
          validation.issues.push(`Missing essential CSP directive: ${directive}`);
          validation.valid = false;
        } else {
          validation.score += 10;
        }
      });
      
      // Check for unsafe directives
      if (directiveMap['script-src'] && directiveMap['script-src'].includes("'unsafe-inline'")) {
        validation.issues.push("script-src contains 'unsafe-inline'");
        validation.recommendations.push("Remove 'unsafe-inline' from script-src");
        validation.score -= 20;
      }
      
      if (directiveMap['script-src'] && directiveMap['script-src'].includes("'unsafe-eval'")) {
        validation.issues.push("script-src contains 'unsafe-eval'");
        validation.recommendations.push("Remove 'unsafe-eval' from script-src");
        validation.score -= 30;
      }
      
      if (directiveMap['default-src'] && directiveMap['default-src'].includes('*')) {
        validation.issues.push("default-src contains wildcard '*'");
        validation.recommendations.push("Replace wildcard '*' with specific domains");
        validation.score -= 15;
      }
      
      // Check for nonces or hashes
      const hasNonce = directiveMap['script-src'] && directiveMap['script-src'].includes("'nonce-");
      const hasHash = directiveMap['script-src'] && 
                     (directiveMap['script-src'].includes("'sha256-") ||
                      directiveMap['script-src'].includes("'sha384-") ||
                      directiveMap['script-src'].includes("'sha512-"));
      
      if (hasNonce || hasHash) {
        validation.score += 15;
      } else if (!directiveMap['script-src'] || 
                 !directiveMap['script-src'].includes("'unsafe-inline'")) {
        validation.recommendations.push('Consider using nonces or hashes for inline scripts');
      }
      
      // Check for HTTPS enforcement
      const hasHTTPS = Object.values(directiveMap).some(value => 
        value.includes('https:') && !value.includes('http:')
      );
      
      if (hasHTTPS) {
        validation.score += 10;
      } else {
        validation.recommendations.push('Enforce HTTPS in CSP directives');
      }
      
      // Calculate final score
      validation.score = Math.max(0, Math.min(100, validation.score));
      
      return validation;
    },
    
    // Validate inline script compliance
    validateInlineScripts: (htmlContent) => {
      const validation = {
        compliant: true,
        violations: [],
        recommendations: []
      };
      
      // Check for inline scripts
      const inlineScriptRegex = /<script[^>]*>([^<]*)<\/script>/gi;
      const inlineScripts = htmlContent.match(inlineScriptRegex) || [];
      
      if (inlineScripts.length > 0) {
        validation.compliant = false;
        validation.violations.push(`Found ${inlineScripts.length} inline script(s)`);
        validation.recommendations.push('Move inline scripts to external files');
        validation.recommendations.push('Use CSP nonces or hashes for necessary inline scripts');
      }
      
      // Check for inline event handlers
      const inlineEventRegex = /on\w+\s*=\s*["'][^"']*["']/gi;
      const inlineEvents = htmlContent.match(inlineEventRegex) || [];
      
      if (inlineEvents.length > 0) {
        validation.compliant = false;
        validation.violations.push(`Found ${inlineEvents.length} inline event handler(s)`);
        validation.recommendations.push('Replace inline event handlers with addEventListener');
      }
      
      // Check for javascript: URLs
      const javascriptURLRegex = /javascript\s*:/gi;
      const javascriptURLs = htmlContent.match(javascriptURLRegex) || [];
      
      if (javascriptURLs.length > 0) {
        validation.compliant = false;
        validation.violations.push(`Found ${javascriptURLs.length} javascript: URL(s)`);
        validation.recommendations.push('Replace javascript: URLs with event handlers');
      }
      
      return validation;
    },
    
    // Validate dynamic code execution
    validateDynamicCode: (code) => {
      const validation = {
        safe: true,
        risks: [],
        recommendations: []
      };
      
      // Check for eval usage
      const evalRegex = /\beval\s*\(/gi;
      const evalMatches = code.match(evalRegex) || [];
      
      if (evalMatches.length > 0) {
        validation.safe = false;
        validation.risks.push(`Found ${evalMatches.length} eval() usage(s)`);
        validation.recommendations.push('Avoid using eval() function');
      }
      
      // Check for Function constructor
      const functionRegex = /\bnew\s+Function\s*\(/gi;
      const functionMatches = code.match(functionRegex) || [];
      
      if (functionMatches.length > 0) {
        validation.safe = false;
        validation.risks.push(`Found ${functionMatches.length} Function constructor usage(s)`);
        validation.recommendations.push('Avoid using Function constructor');
      }
      
      // Check for setTimeout with string
      const setTimeoutRegex = /\bsetTimeout\s*\(\s*["']/gi;
      const setTimeoutMatches = code.match(setTimeoutRegex) || [];
      
      if (setTimeoutMatches.length > 0) {
        validation.safe = false;
        validation.risks.push(`Found ${setTimeoutMatches.length} setTimeout with string argument(s)`);
        validation.recommendations.push('Use function references instead of strings in setTimeout');
      }
      
      // Check for setInterval with string
      const setIntervalRegex = /\bsetInterval\s*\(\s*["']/gi;
      const setIntervalMatches = code.match(setIntervalRegex) || [];
      
      if (setIntervalMatches.length > 0) {
        validation.safe = false;
        validation.risks.push(`Found ${setIntervalMatches.length} setInterval with string argument(s)`);
        validation.recommendations.push('Use function references instead of strings in setInterval');
      }
      
      return validation;
    },
    
    // Validate resource loading
    validateResourceLoading: (resources) => {
      const validation = {
        secure: true,
        violations: [],
        recommendations: []
      };
      
      resources.forEach(resource => {
        // Check for HTTP resources
        if (resource.url && resource.url.startsWith('http://')) {
          validation.secure = false;
          validation.violations.push(`Insecure resource loaded: ${resource.url}`);
          validation.recommendations.push('Use HTTPS for all resources');
        }
        
        // Check for mixed content
        if (resource.type === 'script' && resource.url && !resource.url.startsWith('https://')) {
          validation.secure = false;
          validation.violations.push(`Mixed content script: ${resource.url}`);
          validation.recommendations.push('Load all scripts over HTTPS');
        }
        
        // Check for external resources without integrity
        if (resource.external && !resource.integrity) {
          validation.violations.push(`External resource without integrity: ${resource.url}`);
          validation.recommendations.push('Add integrity attributes to external resources');
        }
      });
      
      return validation;
    },
    
    // Validate CSP nonce usage
    validateNonceUsage: (htmlContent, cspHeader) => {
      const validation = {
        valid: true,
        issues: [],
        recommendations: []
      };
      
      // Extract nonces from CSP
      const nonceRegex = /'nonce-([^']+)'/gi;
      const cspNonces = [];
      let match;
      
      while ((match = nonceRegex.exec(cspHeader)) !== null) {
        cspNonces.push(match[1]);
      }
      
      // Extract nonces from HTML
      const htmlNonceRegex = /nonce\s*=\s*["']([^"']+)["']/gi;
      const htmlNonces = [];
      
      while ((match = htmlNonceRegex.exec(htmlContent)) !== null) {
        htmlNonces.push(match[1]);
      }
      
      // Check if nonces in HTML match CSP
      htmlNonces.forEach(nonce => {
        if (!cspNonces.includes(nonce)) {
          validation.valid = false;
          validation.issues.push(`HTML nonce not found in CSP: ${nonce}`);
        }
      });
      
      // Check if CSP nonces are used in HTML
      cspNonces.forEach(nonce => {
        if (!htmlNonces.includes(nonce)) {
          validation.recommendations.push(`CSP nonce not used in HTML: ${nonce}`);
        }
      });
      
      // Check for nonce uniqueness
      const uniqueNonces = [...new Set(htmlNonces)];
      if (uniqueNonces.length < htmlNonces.length) {
        validation.issues.push('Duplicate nonces found in HTML');
        validation.valid = false;
      }
      
      return validation;
    },
    
    // Validate CSP in extension context
    validateExtensionCSP: (manifest) => {
      const validation = {
        compliant: true,
        violations: [],
        recommendations: [],
        score: 0
      };
      
      // Check manifest CSP
      if (manifest.content_security_policy) {
        const cspValidation = mockCSPValidator.csp.validateCSPHeaders({
          'content-security-policy': manifest.content_security_policy
        });
        
        validation.compliant = validation.compliant && cspValidation.valid;
        validation.violations.push(...cspValidation.issues);
        validation.recommendations.push(...cspValidation.recommendations);
        validation.score += cspValidation.score;
      } else {
        validation.recommendations.push('Add content_security_policy to manifest');
        validation.score -= 20;
      }
      
      // Check for extension-specific CSP issues
      if (manifest.content_security_policy) {
        const csp = manifest.content_security_policy;
        
        // Check for unsafe-eval in extension context
        if (csp.includes("'unsafe-eval'")) {
          validation.compliant = false;
          validation.violations.push("Extension CSP contains 'unsafe-eval'");
          validation.score -= 30;
        }
        
        // Check for script-src 'self' only
        if (csp.includes("script-src 'self'")) {
          validation.score += 15;
        } else if (csp.includes('script-src')) {
          validation.recommendations.push('Restrict script-src to \'self\' in extension');
        }
        
        // Check for object-src 'none'
        if (csp.includes("object-src 'none'")) {
          validation.score += 10;
        } else {
          validation.recommendations.push("Set object-src to 'none' in extension CSP");
        }
      }
      
      // Calculate final score
      validation.score = Math.max(0, Math.min(100, validation.score));
      
      return validation;
    }
  }
};

describe('CSP Compliance Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('CSP Header Validation', () => {
    test('should validate comprehensive CSP header', () => {
      const headers = {
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'nonce-abc123'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.openrouter.ai"
      };
      
      const result = mockCSPValidator.csp.validateCSPHeaders(headers);
      
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.score).toBeGreaterThan(50);
    });
    
    test('should detect missing CSP header', () => {
      const headers = {};
      
      const result = mockCSPValidator.csp.validateCSPHeaders(headers);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('CSP header is missing');
      expect(result.recommendations).toContain('Implement Content Security Policy header');
    });
    
    test('should detect unsafe-inline in script-src', () => {
      const headers = {
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'"
      };
      
      const result = mockCSPValidator.csp.validateCSPHeaders(headers);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain("script-src contains 'unsafe-inline'");
      expect(result.recommendations).toContain("Remove 'unsafe-inline' from script-src");
    });
    
    test('should detect unsafe-eval in script-src', () => {
      const headers = {
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval'"
      };
      
      const result = mockCSPValidator.csp.validateCSPHeaders(headers);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain("script-src contains 'unsafe-eval'");
      expect(result.recommendations).toContain("Remove 'unsafe-eval' from script-src");
    });
    
    test('should detect wildcard in default-src', () => {
      const headers = {
        'Content-Security-Policy': "default-src *; script-src 'self'"
      };
      
      const result = mockCSPValidator.csp.validateCSPHeaders(headers);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain("default-src contains wildcard '*'");
      expect(result.recommendations).toContain("Replace wildcard '*' with specific domains");
    });
    
    test('should reward nonce usage', () => {
      const headers = {
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'nonce-abc123'"
      };
      
      const result = mockCSPValidator.csp.validateCSPHeaders(headers);
      
      expect(result.score).toBeGreaterThan(30); // Base score + nonce bonus
    });
  });
  
  describe('Inline Script Validation', () => {
    test('should detect inline scripts', () => {
      const htmlContent = `
        <html>
          <head>
            <script>alert('Hello World');</script>
            <script src="external.js"></script>
          </head>
          <body>
            <script>console.log('Inline script');</script>
          </body>
        </html>
      `;
      
      const result = mockCSPValidator.csp.validateInlineScripts(htmlContent);
      
      expect(result.compliant).toBe(false);
      expect(result.violations).toContain('Found 2 inline script(s)');
      expect(result.recommendations).toContain('Move inline scripts to external files');
    });
    
    test('should detect inline event handlers', () => {
      const htmlContent = `
        <html>
          <body>
            <button onclick="alert('Clicked')">Click me</button>
            <div onmouseover="this.style.color='red'">Hover me</div>
            <img onload="console.log('Image loaded')" src="image.jpg">
          </body>
        </html>
      `;
      
      const result = mockCSPValidator.csp.validateInlineScripts(htmlContent);
      
      expect(result.compliant).toBe(false);
      expect(result.violations).toContain('Found 3 inline event handler(s)');
      expect(result.recommendations).toContain('Replace inline event handlers with addEventListener');
    });
    
    test('should detect javascript: URLs', () => {
      const htmlContent = `
        <html>
          <body>
            <a href="javascript:alert('Hello')">Link</a>
            <iframe src="javascript:'<div>Content</div>'"></iframe>
          </body>
        </html>
      `;
      
      const result = mockCSPValidator.csp.validateInlineScripts(htmlContent);
      
      expect(result.compliant).toBe(false);
      expect(result.violations).toContain('Found 2 javascript: URL(s)');
      expect(result.recommendations).toContain('Replace javascript: URLs with event handlers');
    });
    
    test('should validate CSP-compliant HTML', () => {
      const htmlContent = `
        <html>
          <head>
            <script src="external.js"></script>
            <link rel="stylesheet" href="styles.css">
          </head>
          <body>
            <button id="btn">Click me</button>
          </body>
        </html>
      `;
      
      const result = mockCSPValidator.csp.validateInlineScripts(htmlContent);
      
      expect(result.compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });
  
  describe('Dynamic Code Validation', () => {
    test('should detect eval usage', () => {
      const code = `
        function processData(data) {
          const result = eval('(' + data + ')');
          return result;
        }
        
        const dynamic = eval('Math.random()');
      `;
      
      const result = mockCSPValidator.csp.validateDynamicCode(code);
      
      expect(result.safe).toBe(false);
      expect(result.risks).toContain('Found 2 eval() usage(s)');
      expect(result.recommendations).toContain('Avoid using eval() function');
    });
    
    test('should detect Function constructor usage', () => {
      const code = `
        const dynamicFunction = new Function('a', 'b', 'return a + b');
        const anotherFunc = new Function('console.log("Hello")');
      `;
      
      const result = mockCSPValidator.csp.validateDynamicCode(code);
      
      expect(result.safe).toBe(false);
      expect(result.risks).toContain('Found 2 Function constructor usage(s)');
      expect(result.recommendations).toContain('Avoid using Function constructor');
    });
    
    test('should detect setTimeout with string', () => {
      const code = `
        setTimeout('alert("Delayed")', 1000);
        setTimeout('console.log("Another")', 2000);
        setTimeout(function() { console.log("Safe"); }, 3000);
      `;
      
      const result = mockCSPValidator.csp.validateDynamicCode(code);
      
      expect(result.safe).toBe(false);
      expect(result.risks).toContain('Found 2 setTimeout with string argument(s)');
      expect(result.recommendations).toContain('Use function references instead of strings in setTimeout');
    });
    
    test('should detect setInterval with string', () => {
      const code = `
        setInterval('updateClock()', 1000);
        setInterval(function() { console.log("Safe"); }, 2000);
      `;
      
      const result = mockCSPValidator.csp.validateDynamicCode(code);
      
      expect(result.safe).toBe(false);
      expect(result.risks).toContain('Found 1 setInterval with string argument(s)');
      expect(result.recommendations).toContain('Use function references instead of strings in setInterval');
    });
    
    test('should validate safe dynamic code', () => {
      const code = `
        function processData(data) {
          return JSON.parse(data);
        }
        
        setTimeout(function() { console.log("Safe"); }, 1000);
        setInterval(function() { updateUI(); }, 1000);
      `;
      
      const result = mockCSPValidator.csp.validateDynamicCode(code);
      
      expect(result.safe).toBe(true);
      expect(result.risks).toHaveLength(0);
    });
  });
  
  describe('Resource Loading Validation', () => {
    test('should detect insecure HTTP resources', () => {
      const resources = [
        { url: 'http://example.com/script.js', type: 'script' },
        { url: 'https://secure.com/style.css', type: 'style' },
        { url: 'http://insecure.com/image.jpg', type: 'image' }
      ];
      
      const result = mockCSPValidator.csp.validateResourceLoading(resources);
      
      expect(result.secure).toBe(false);
      expect(result.violations).toContain('Insecure resource loaded: http://example.com/script.js');
      expect(result.violations).toContain('Insecure resource loaded: http://insecure.com/image.jpg');
      expect(result.recommendations).toContain('Use HTTPS for all resources');
    });
    
    test('should detect mixed content', () => {
      const resources = [
        { url: 'https://secure.com/script.js', type: 'script' },
        { url: 'http://mixed.com/script.js', type: 'script' }
      ];
      
      const result = mockCSPValidator.csp.validateResourceLoading(resources);
      
      expect(result.secure).toBe(false);
      expect(result.violations).toContain('Mixed content script: http://mixed.com/script.js');
      expect(result.recommendations).toContain('Load all scripts over HTTPS');
    });
    
    test('should detect external resources without integrity', () => {
      const resources = [
        { url: 'https://cdn.com/lib.js', type: 'script', external: true },
        { url: 'https://cdn.com/lib.js', type: 'script', external: true, integrity: 'sha384-abc123' }
      ];
      
      const result = mockCSPValidator.csp.validateResourceLoading(resources);
      
      expect(result.violations).toContain('External resource without integrity: https://cdn.com/lib.js');
      expect(result.recommendations).toContain('Add integrity attributes to external resources');
    });
    
    test('should validate secure resource loading', () => {
      const resources = [
        { url: 'https://secure.com/script.js', type: 'script', external: true, integrity: 'sha384-abc123' },
        { url: 'https://secure.com/style.css', type: 'style', external: true, integrity: 'sha256-def456' },
        { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', type: 'image' }
      ];
      
      const result = mockCSPValidator.csp.validateResourceLoading(resources);
      
      expect(result.secure).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });
  
  describe('CSP Nonce Validation', () => {
    test('should validate matching nonces', () => {
      const htmlContent = `
        <html>
          <head>
            <script nonce="abc123">console.log('Safe');</script>
          </head>
          <body>
            <script nonce="def456">console.log('Another');</script>
          </body>
        </html>
      `;
      
      const cspHeader = "script-src 'self' 'nonce-abc123' 'nonce-def456'";
      
      const result = mockCSPValidator.csp.validateNonceUsage(htmlContent, cspHeader);
      
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
    
    test('should detect HTML nonce not in CSP', () => {
      const htmlContent = `
        <html>
          <script nonce="abc123">console.log('Test');</script>
        </html>
      `;
      
      const cspHeader = "script-src 'self' 'nonce-def456'";
      
      const result = mockCSPValidator.csp.validateNonceUsage(htmlContent, cspHeader);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('HTML nonce not found in CSP: abc123');
    });
    
    test('should detect duplicate nonces', () => {
      const htmlContent = `
        <html>
          <script nonce="abc123">console.log('Test 1');</script>
          <script nonce="abc123">console.log('Test 2');</script>
        </html>
      `;
      
      const cspHeader = "script-src 'self' 'nonce-abc123'";
      
      const result = mockCSPValidator.csp.validateNonceUsage(htmlContent, cspHeader);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Duplicate nonces found in HTML');
    });
    
    test('should detect unused CSP nonces', () => {
      const htmlContent = `
        <html>
          <script nonce="abc123">console.log('Test');</script>
        </html>
      `;
      
      const cspHeader = "script-src 'self' 'nonce-abc123' 'nonce-unused123'";
      
      const result = mockCSPValidator.csp.validateNonceUsage(htmlContent, cspHeader);
      
      expect(result.valid).toBe(true);
      expect(result.recommendations).toContain('CSP nonce not used in HTML: unused123');
    });
  });
  
  describe('Extension CSP Validation', () => {
    test('should validate compliant extension manifest', () => {
      const manifest = {
        content_security_policy: "script-src 'self'; object-src 'none'; connect-src 'self' https://api.openrouter.ai"
      };
      
      const result = mockCSPValidator.csp.validateExtensionCSP(manifest);
      
      expect(result.compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.score).toBeGreaterThan(50);
    });
    
    test('should detect missing CSP in manifest', () => {
      const manifest = {};
      
      const result = mockCSPValidator.csp.validateExtensionCSP(manifest);
      
      expect(result.compliant).toBe(true);
      expect(result.recommendations).toContain('Add content_security_policy to manifest');
      expect(result.score).toBeLessThan(0);
    });
    
    test('should detect unsafe-eval in extension CSP', () => {
      const manifest = {
        content_security_policy: "script-src 'self' 'unsafe-eval'; object-src 'none'"
      };
      
      const result = mockCSPValidator.csp.validateExtensionCSP(manifest);
      
      expect(result.compliant).toBe(false);
      expect(result.violations).toContain("Extension CSP contains 'unsafe-eval'");
      expect(result.score).toBeLessThan(0);
    });
    
    test('should reward restrictive script-src', () => {
      const manifest = {
        content_security_policy: "script-src 'self'; object-src 'none'"
      };
      
      const result = mockCSPValidator.csp.validateExtensionCSP(manifest);
      
      expect(result.score).toBeGreaterThan(20); // Base score + script-src 'self' bonus
    });
    
    test('should recommend object-src none', () => {
      const manifest = {
        content_security_policy: "script-src 'self'"
      };
      
      const result = mockCSPValidator.csp.validateExtensionCSP(manifest);
      
      expect(result.recommendations).toContain("Set object-src to 'none' in extension CSP");
    });
  });
  
  describe('CSP Security Best Practices', () => {
    test('should enforce strict CSP policies', () => {
      const strictCSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://api.openrouter.ai; font-src 'self'; object-src 'none'; frame-ancestors 'none';";
      
      const result = mockCSPValidator.csp.validateCSPHeaders({
        'Content-Security-Policy': strictCSP
      });
      
      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThan(70);
    });
    
    test('should identify weak CSP policies', () => {
      const weakCSP = "default-src *; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'";
      
      const result = mockCSPValidator.csp.validateCSPHeaders({
        'Content-Security-Policy': weakCSP
      });
      
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(2);
      expect(result.score).toBeLessThan(0);
    });
    
    test('should validate CSP in extension context', () => {
      const extensionManifest = {
        content_security_policy: "script-src 'self'; object-src 'none'; connect-src 'self' https://api.openrouter.ai"
      };
      
      const result = mockCSPValidator.csp.validateExtensionCSP(extensionManifest);
      
      expect(result.compliant).toBe(true);
      expect(result.score).toBeGreaterThan(40);
    });
  });
});
