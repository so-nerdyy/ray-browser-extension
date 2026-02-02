/**
 * Input Sanitization Tests
 * Tests for input validation and sanitization security measures
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock input sanitization module
const mockInputSanitizer = {
  // Input sanitizer
  sanitizer: {
    // Sanitize user input
    sanitizeInput: (input, options = {}) => {
      const defaults = {
        allowHTML: false,
        allowScripts: false,
        allowStyles: false,
        maxLength: 1000,
        allowedTags: [],
        allowedAttributes: []
      };
      
      const config = { ...defaults, ...options };
      
      if (typeof input !== 'string') {
        return { sanitized: '', valid: false, error: 'Input must be a string' };
      }
      
      let sanitized = input;
      const issues = [];
      
      // Check length
      if (sanitized.length > config.maxLength) {
        issues.push(`Input exceeds maximum length of ${config.maxLength}`);
        sanitized = sanitized.substring(0, config.maxLength);
      }
      
      // Remove potentially dangerous characters
      if (!config.allowScripts) {
        // Remove script tags and content
        sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        
        // Remove javascript: URLs
        sanitized = sanitized.replace(/javascript\s*:/gi, '');
        
        // Remove on* event handlers
        sanitized = sanitized.replace(/\bon\w+\s*=/gi, '');
        
        // Remove eval() calls
        sanitized = sanitized.replace(/\beval\s*\(/gi, 'blocked(');
        
        // Remove Function() constructor
        sanitized = sanitized.replace(/\bnew\s+Function\s*\(/gi, 'new blockedFunction(');
      }
      
      // Remove HTML if not allowed
      if (!config.allowHTML) {
        sanitized = sanitized.replace(/<[^>]*>/g, '');
      } else {
        // Allow only specific HTML tags
        if (config.allowedTags.length > 0) {
          const tagRegex = new RegExp(`<(?!\/?(?:${config.allowedTags.join('|')})\b)[^>]*>`, 'gi');
          sanitized = sanitized.replace(tagRegex, '');
        }
        
        // Remove dangerous attributes
        const dangerousAttrs = ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur'];
        dangerousAttrs.forEach(attr => {
          const attrRegex = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
          sanitized = sanitized.replace(attrRegex, '');
        });
        
        // Allow only specific attributes
        if (config.allowedAttributes.length > 0) {
          const attrRegex = new RegExp(`\\s(?!${config.allowedAttributes.join('|')})\\w+\\s*=\\s*["'][^"']*["']`, 'gi');
          sanitized = sanitized.replace(attrRegex, '');
        }
      }
      
      // Remove CSS if not allowed
      if (!config.allowStyles) {
        sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
        sanitized = sanitized.replace(/style\s*=\s*["'][^"']*["']/gi, '');
      }
      
      // Remove potential SQL injection patterns
      const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
        /(--)/g,
        /(\*|;|'|"|`|\\)/g
      ];
      
      sqlPatterns.forEach(pattern => {
        if (pattern.test(sanitized)) {
          issues.push('Potentially dangerous SQL pattern detected');
        }
        sanitized = sanitized.replace(pattern, '');
      });
      
      // Remove potential XSS patterns
      const xssPatterns = [
        /<iframe\b[^>]*>/gi,
        /<object\b[^>]*>/gi,
        /<embed\b[^>]*>/gi,
        /<link\b[^>]*>/gi,
        /<meta\b[^>]*>/gi,
        /vbscript\s*:/gi,
        /data\s*:\s*text\/html/gi
      ];
      
      xssPatterns.forEach(pattern => {
        if (pattern.test(sanitized)) {
          issues.push('Potentially dangerous XSS pattern detected');
        }
        sanitized = sanitized.replace(pattern, '');
      });
      
      // Normalize whitespace
      sanitized = sanitized.replace(/\s+/g, ' ').trim();
      
      return {
        original: input,
        sanitized: sanitized,
        valid: issues.length === 0,
        issues: issues,
        changed: sanitized !== input
      };
    },
    
    // Validate command input
    validateCommand: (command) => {
      const validation = {
        valid: true,
        issues: [],
        sanitized: command
      };
      
      if (!command || typeof command !== 'string') {
        validation.valid = false;
        validation.issues.push('Command must be a non-empty string');
        return validation;
      }
      
      // Check for command injection
      const injectionPatterns = [
        /;\s*(rm|del|format|shutdown|reboot)/gi,
        /\|\s*(rm|del|format|shutdown|reboot)/gi,
        /&&\s*(rm|del|format|shutdown|reboot)/gi,
        /`[^`]*`/g,
        /\$[^$]*\$/g
      ];
      
      injectionPatterns.forEach(pattern => {
        if (pattern.test(command)) {
          validation.valid = false;
          validation.issues.push('Potential command injection detected');
        }
      });
      
      // Check for path traversal
      const pathTraversalPatterns = [
        /\.\.\//g,
        /\.\.\\/g,
        /\.\.\//g,
        /\/\.\.\//g,
        /\\\.\.\\/g
      ];
      
      pathTraversalPatterns.forEach(pattern => {
        if (pattern.test(command)) {
          validation.valid = false;
          validation.issues.push('Path traversal pattern detected');
        }
      });
      
      // Check for excessive length
      if (command.length > 500) {
        validation.valid = false;
        validation.issues.push('Command exceeds maximum length');
      }
      
      // Sanitize the command
      validation.sanitized = command
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
        .replace(/[<>]/g, '') // Remove angle brackets
        .trim();
      
      return validation;
    },
    
    // Validate URL input
    validateURL: (url) => {
      const validation = {
        valid: true,
        issues: [],
        sanitized: url
      };
      
      if (!url || typeof url !== 'string') {
        validation.valid = false;
        validation.issues.push('URL must be a non-empty string');
        return validation;
      }
      
      // Check for javascript: protocol
      if (url.toLowerCase().startsWith('javascript:')) {
        validation.valid = false;
        validation.issues.push('JavaScript protocol not allowed');
      }
      
      // Check for data: URLs with HTML
      if (url.toLowerCase().startsWith('data:text/html')) {
        validation.valid = false;
        validation.issues.push('Data URLs with HTML content not allowed');
      }
      
      // Check for vbscript: protocol
      if (url.toLowerCase().startsWith('vbscript:')) {
        validation.valid = false;
        validation.issues.push('VBScript protocol not allowed');
      }
      
      // Check for file: protocol
      if (url.toLowerCase().startsWith('file:')) {
        validation.valid = false;
        validation.issues.push('File protocol not allowed');
      }
      
      // Check for XSS in URL
      const xssPatterns = [
        /<script\b[^>]*>/gi,
        /on\w+\s*=/gi,
        /["\s]*\.\s*["\s]*alert/gi
      ];
      
      xssPatterns.forEach(pattern => {
        if (pattern.test(url)) {
          validation.valid = false;
          validation.issues.push('XSS pattern detected in URL');
        }
      });
      
      try {
        // Validate URL format
        const urlObj = new URL(url);
        
        // Check for dangerous protocols
        const dangerousProtocols = ['javascript:', 'vbscript:', 'data:', 'file:', 'ftp:'];
        if (dangerousProtocols.includes(urlObj.protocol.toLowerCase())) {
          validation.valid = false;
          validation.issues.push(`Dangerous protocol: ${urlObj.protocol}`);
        }
        
        // Sanitize the URL
        validation.sanitized = urlObj.toString();
      } catch (error) {
        validation.valid = false;
        validation.issues.push('Invalid URL format');
      }
      
      return validation;
    },
    
    // Validate API key input
    validateAPIKey: (apiKey) => {
      const validation = {
        valid: true,
        issues: [],
        sanitized: apiKey
      };
      
      if (!apiKey || typeof apiKey !== 'string') {
        validation.valid = false;
        validation.issues.push('API key must be a non-empty string');
        return validation;
      }
      
      // Check for SQL injection patterns
      const sqlPatterns = [
        /['"]\s*;\s*/g,
        /['"]\s*(OR|AND)\s+/gi,
        /UNION\s+SELECT/gi,
        /DROP\s+TABLE/gi,
        /DELETE\s+FROM/gi,
        /INSERT\s+INTO/gi,
        /UPDATE\s+SET/gi
      ];
      
      sqlPatterns.forEach(pattern => {
        if (pattern.test(apiKey)) {
          validation.valid = false;
          validation.issues.push('SQL injection pattern detected in API key');
        }
      });
      
      // Check for script injection
      const scriptPatterns = [
        /<script\b[^>]*>/gi,
        /javascript\s*:/gi,
        /on\w+\s*=/gi
      ];
      
      scriptPatterns.forEach(pattern => {
        if (pattern.test(apiKey)) {
          validation.valid = false;
          validation.issues.push('Script injection pattern detected in API key');
        }
      });
      
      // Check for format
      if (!/^[a-zA-Z0-9_-]+$/.test(apiKey)) {
        validation.valid = false;
        validation.issues.push('API key contains invalid characters');
      }
      
      // Check length
      if (apiKey.length < 20) {
        validation.valid = false;
        validation.issues.push('API key is too short');
      } else if (apiKey.length > 200) {
        validation.valid = false;
        validation.issues.push('API key is too long');
      }
      
      // Sanitize the API key
      validation.sanitized = apiKey
        .replace(/[<>"']/g, '') // Remove potentially dangerous characters
        .trim();
      
      return validation;
    },
    
    // Validate form data
    validateFormData: (formData) => {
      const validation = {
        valid: true,
        issues: [],
        sanitized: {}
      };
      
      if (!formData || typeof formData !== 'object') {
        validation.valid = false;
        validation.issues.push('Form data must be an object');
        return validation;
      }
      
      Object.keys(formData).forEach(key => {
        const value = formData[key];
        
        if (typeof value !== 'string' && typeof value !== 'number') {
          validation.issues.push(`Invalid value type for field: ${key}`);
          validation.valid = false;
          return;
        }
        
        const stringValue = String(value);
        const sanitized = mockInputSanitizer.sanitizer.sanitizeInput(stringValue, {
          allowHTML: false,
          allowScripts: false,
          maxLength: 1000
        });
        
        validation.sanitized[key] = sanitized.sanitized;
        
        if (!sanitized.valid) {
          validation.issues.push(`Issues in field ${key}: ${sanitized.issues.join(', ')}`);
          validation.valid = false;
        }
      });
      
      return validation;
    }
  }
};

describe('Input Sanitization Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Basic Input Sanitization', () => {
    test('should sanitize script tags', () => {
      const input = '<script>alert("XSS")</script>Hello World';
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input);
      
      expect(result.sanitized).toBe('Hello World');
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Potentially dangerous XSS pattern detected');
      expect(result.changed).toBe(true);
    });
    
    test('should remove javascript: URLs', () => {
      const input = 'javascript:alert("XSS")';
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input);
      
      expect(result.sanitized).toBe('alert("XSS")');
      expect(result.valid).toBe(false);
      expect(result.changed).toBe(true);
    });
    
    test('should remove event handlers', () => {
      const input = '<div onclick="alert(\'XSS\')">Click me</div>';
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input);
      
      expect(result.sanitized).not.toContain('onclick');
      expect(result.changed).toBe(true);
    });
    
    test('should block eval() calls', () => {
      const input = 'eval("malicious code")';
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input);
      
      expect(result.sanitized).toBe('blocked("malicious code")');
      expect(result.changed).toBe(true);
    });
    
    test('should block Function() constructor', () => {
      const input = 'new Function("malicious code")';
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input);
      
      expect(result.sanitized).toBe('new blockedFunction("malicious code")');
      expect(result.changed).toBe(true);
    });
    
    test('should handle safe input', () => {
      const input = 'Hello World';
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input);
      
      expect(result.sanitized).toBe('Hello World');
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.changed).toBe(false);
    });
  });
  
  describe('HTML Input Handling', () => {
    test('should remove all HTML when not allowed', () => {
      const input = '<div><span>Hello</span></div>';
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input, { allowHTML: false });
      
      expect(result.sanitized).toBe('Hello');
      expect(result.changed).toBe(true);
    });
    
    test('should allow specific HTML tags', () => {
      const input = '<div><p>Hello</p><script>alert("XSS")</script></div>';
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input, {
        allowHTML: true,
        allowedTags: ['div', 'p']
      });
      
      expect(result.sanitized).toBe('<div><p>Hello</p></div>');
      expect(result.changed).toBe(true);
    });
    
    test('should remove dangerous attributes', () => {
      const input = '<div onclick="alert(\'XSS\')" onload="malicious()">Hello</div>';
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input, {
        allowHTML: true,
        allowedTags: ['div']
      });
      
      expect(result.sanitized).toBe('<div>Hello</div>');
      expect(result.changed).toBe(true);
    });
    
    test('should allow specific attributes', () => {
      const input = '<div id="test" class="example" onclick="alert(\'XSS\')">Hello</div>';
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input, {
        allowHTML: true,
        allowedTags: ['div'],
        allowedAttributes: ['id', 'class']
      });
      
      expect(result.sanitized).toBe('<div id="test" class="example">Hello</div>');
      expect(result.changed).toBe(true);
    });
  });
  
  describe('SQL Injection Prevention', () => {
    test('should detect SQL injection patterns', () => {
      const inputs = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "1' UNION SELECT * FROM users --",
        "'; DELETE FROM users; --"
      ];
      
      inputs.forEach(input => {
        const result = mockInputSanitizer.sanitizer.sanitizeInput(input);
        
        expect(result.valid).toBe(false);
        expect(result.issues.some(issue => 
          issue.includes('Potentially dangerous SQL pattern')
        )).toBe(true);
      });
    });
    
    test('should remove SQL injection characters', () => {
      const input = "test'; DROP TABLE users; --";
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input);
      
      expect(result.sanitized).not.toContain(';');
      expect(result.sanitized).not.toContain('DROP');
      expect(result.sanitized).not.toContain('--');
    });
    
    test('should handle safe database queries', () => {
      const input = 'SELECT * FROM users WHERE id = 1';
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input);
      
      expect(result.valid).toBe(false); // Even safe SQL should be flagged in user input
      expect(result.issues.some(issue => 
        issue.includes('Potentially dangerous SQL pattern')
      )).toBe(true);
    });
  });
  
  describe('Command Validation', () => {
    test('should detect command injection', () => {
      const commands = [
        'ls; rm -rf /',
        'dir && del /s /q *.*',
        'cat file.txt | format c:',
        'echo `rm -rf /`'
      ];
      
      commands.forEach(command => {
        const result = mockInputSanitizer.sanitizer.validateCommand(command);
        
        expect(result.valid).toBe(false);
        expect(result.issues).toContain('Potential command injection detected');
      });
    });
    
    test('should detect path traversal', () => {
      const commands = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32',
        '/etc/../../root',
        'folder/../../../secret'
      ];
      
      commands.forEach(command => {
        const result = mockInputSanitizer.sanitizer.validateCommand(command);
        
        expect(result.valid).toBe(false);
        expect(result.issues).toContain('Path traversal pattern detected');
      });
    });
    
    test('should validate safe commands', () => {
      const commands = [
        'ls -la',
        'dir /b',
        'cd /home/user',
        'cat file.txt'
      ];
      
      commands.forEach(command => {
        const result = mockInputSanitizer.sanitizer.validateCommand(command);
        
        expect(result.valid).toBe(true);
        expect(result.issues).toHaveLength(0);
      });
    });
    
    test('should handle excessive command length', () => {
      const longCommand = 'a'.repeat(501);
      const result = mockInputSanitizer.sanitizer.validateCommand(longCommand);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Command exceeds maximum length');
    });
  });
  
  describe('URL Validation', () => {
    test('should reject dangerous protocols', () => {
      const urls = [
        'javascript:alert("XSS")',
        'vbscript:msgbox("XSS")',
        'data:text/html,<script>alert("XSS")</script>',
        'file:///etc/passwd'
      ];
      
      urls.forEach(url => {
        const result = mockInputSanitizer.sanitizer.validateURL(url);
        
        expect(result.valid).toBe(false);
      });
    });
    
    test('should detect XSS in URLs', () => {
      const urls = [
        'https://example.com/<script>alert("XSS")</script>',
        'https://example.com/?param=<script>alert("XSS")</script>',
        'https://example.com/?onclick=alert("XSS")'
      ];
      
      urls.forEach(url => {
        const result = mockInputSanitizer.sanitizer.validateURL(url);
        
        expect(result.valid).toBe(false);
        expect(result.issues).toContain('XSS pattern detected in URL');
      });
    });
    
    test('should validate safe URLs', () => {
      const urls = [
        'https://example.com',
        'https://api.openrouter.ai/v1/chat',
        'http://localhost:3000',
        'https://subdomain.example.com/path?param=value'
      ];
      
      urls.forEach(url => {
        const result = mockInputSanitizer.sanitizer.validateURL(url);
        
        expect(result.valid).toBe(true);
        expect(result.issues).toHaveLength(0);
      });
    });
    
    test('should handle invalid URL format', () => {
      const invalidUrls = [
        'not-a-url',
        'https://',
        '://missing-protocol.com',
        'https://[invalid-ipv6'
      ];
      
      invalidUrls.forEach(url => {
        const result = mockInputSanitizer.sanitizer.validateURL(url);
        
        expect(result.valid).toBe(false);
        expect(result.issues).toContain('Invalid URL format');
      });
    });
  });
  
  describe('API Key Validation', () => {
    test('should detect SQL injection in API keys', () => {
      const apiKeys = [
        "'; DROP TABLE api_keys; --",
        "' OR '1'='1",
        "key' UNION SELECT * FROM users --"
      ];
      
      apiKeys.forEach(apiKey => {
        const result = mockInputSanitizer.sanitizer.validateAPIKey(apiKey);
        
        expect(result.valid).toBe(false);
        expect(result.issues).toContain('SQL injection pattern detected in API key');
      });
    });
    
    test('should detect script injection in API keys', () => {
      const apiKeys = [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        'key" onclick="alert("XSS")'
      ];
      
      apiKeys.forEach(apiKey => {
        const result = mockInputSanitizer.sanitizer.validateAPIKey(apiKey);
        
        expect(result.valid).toBe(false);
        expect(result.issues).toContain('Script injection pattern detected in API key');
      });
    });
    
    test('should validate API key format', () => {
      const invalidKeys = [
        'key with spaces',
        'key@with#special$chars',
        'short',
        'key that is way too long and exceeds the maximum allowed length for an api key which should be reasonable'
      ];
      
      invalidKeys.forEach(apiKey => {
        const result = mockInputSanitizer.sanitizer.validateAPIKey(apiKey);
        
        expect(result.valid).toBe(false);
      });
    });
    
    test('should validate correct API keys', () => {
      const validKeys = [
        'sk-1234567890abcdefABCDEF',
        'rk_live_1234567890abcdefABCDEF',
        'AKIAIOSFODNN7EXAMPLE',
        'v1.2.34567890abcdefABCDEF'
      ];
      
      validKeys.forEach(apiKey => {
        const result = mockInputSanitizer.sanitizer.validateAPIKey(apiKey);
        
        expect(result.valid).toBe(true);
        expect(result.issues).toHaveLength(0);
      });
    });
  });
  
  describe('Form Data Validation', () => {
    test('should validate form object', () => {
      const formData = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Hello World'
      };
      
      const result = mockInputSanitizer.sanitizer.validateFormData(formData);
      
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(Object.keys(result.sanitized)).toHaveLength(3);
    });
    
    test('should detect malicious form data', () => {
      const formData = {
        name: '<script>alert("XSS")</script>',
        email: 'test@example.com',
        message: "'; DROP TABLE users; --"
      };
      
      const result = mockInputSanitizer.sanitizer.validateFormData(formData);
      
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });
    
    test('should handle invalid form data types', () => {
      const formData = {
        name: null,
        email: undefined,
        message: { object: 'invalid' }
      };
      
      const result = mockInputSanitizer.sanitizer.validateFormData(formData);
      
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });
    
    test('should sanitize form fields', () => {
      const formData = {
        name: '<b>John Doe</b>',
        email: 'john@example.com',
        message: 'Hello <script>alert("XSS")</script>World'
      };
      
      const result = mockInputSanitizer.sanitizer.validateFormData(formData);
      
      expect(result.sanitized.name).toBe('John Doe');
      expect(result.sanitized.message).toBe('Hello World');
    });
  });
  
  describe('Input Length Validation', () => {
    test('should enforce maximum length', () => {
      const longInput = 'a'.repeat(1001);
      const result = mockInputSanitizer.sanitizer.sanitizeInput(longInput);
      
      expect(result.sanitized.length).toBe(1000);
      expect(result.issues).toContain(`Input exceeds maximum length of 1000`);
      expect(result.changed).toBe(true);
    });
    
    test('should handle custom length limit', () => {
      const input = 'a'.repeat(101);
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input, { maxLength: 100 });
      
      expect(result.sanitized.length).toBe(100);
      expect(result.issues).toContain(`Input exceeds maximum length of 100`);
    });
    
    test('should accept valid length input', () => {
      const input = 'a'.repeat(500);
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input);
      
      expect(result.sanitized.length).toBe(500);
      expect(result.valid).toBe(true);
    });
  });
  
  describe('Input Sanitization Best Practices', () => {
    test('should handle null and undefined input', () => {
      const nullResult = mockInputSanitizer.sanitizer.sanitizeInput(null);
      expect(nullResult.valid).toBe(false);
      expect(nullResult.error).toBe('Input must be a string');
      
      const undefinedResult = mockInputSanitizer.sanitizer.sanitizeInput(undefined);
      expect(undefinedResult.valid).toBe(false);
      expect(undefinedResult.error).toBe('Input must be a string');
    });
    
    test('should normalize whitespace', () => {
      const input = '  Hello    World  \n  ';
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input);
      
      expect(result.sanitized).toBe('Hello World');
      expect(result.changed).toBe(true);
    });
    
    test('should remove control characters', () => {
      const input = 'Hello\x00World\x1F';
      const result = mockInputSanitizer.sanitizer.validateCommand(input);
      
      expect(result.sanitized).toBe('HelloWorld');
      expect(result.changed).toBe(true);
    });
    
    test('should handle empty input', () => {
      const input = '';
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input);
      
      expect(result.sanitized).toBe('');
      expect(result.valid).toBe(true);
      expect(result.changed).toBe(false);
    });
  });
}); * Input Sanitization Tests
 * Tests for input validation and sanitization security measures
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock input sanitization module
const mockInputSanitizer = {
  // Input sanitizer
  sanitizer: {
    // Sanitize user input
    sanitizeInput: (input, options = {}) => {
      const defaults = {
        allowHTML: false,
        allowScripts: false,
        allowStyles: false,
        maxLength: 1000,
        allowedTags: [],
        allowedAttributes: []
      };
      
      const config = { ...defaults, ...options };
      
      if (typeof input !== 'string') {
        return { sanitized: '', valid: false, error: 'Input must be a string' };
      }
      
      let sanitized = input;
      const issues = [];
      
      // Check length
      if (sanitized.length > config.maxLength) {
        issues.push(`Input exceeds maximum length of ${config.maxLength}`);
        sanitized = sanitized.substring(0, config.maxLength);
      }
      
      // Remove potentially dangerous characters
      if (!config.allowScripts) {
        // Remove script tags and content
        sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        
        // Remove javascript: URLs
        sanitized = sanitized.replace(/javascript\s*:/gi, '');
        
        // Remove on* event handlers
        sanitized = sanitized.replace(/\bon\w+\s*=/gi, '');
        
        // Remove eval() calls
        sanitized = sanitized.replace(/\beval\s*\(/gi, 'blocked(');
        
        // Remove Function() constructor
        sanitized = sanitized.replace(/\bnew\s+Function\s*\(/gi, 'new blockedFunction(');
      }
      
      // Remove HTML if not allowed
      if (!config.allowHTML) {
        sanitized = sanitized.replace(/<[^>]*>/g, '');
      } else {
        // Allow only specific HTML tags
        if (config.allowedTags.length > 0) {
          const tagRegex = new RegExp(`<(?!\/?(?:${config.allowedTags.join('|')})\b)[^>]*>`, 'gi');
          sanitized = sanitized.replace(tagRegex, '');
        }
        
        // Remove dangerous attributes
        const dangerousAttrs = ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur'];
        dangerousAttrs.forEach(attr => {
          const attrRegex = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
          sanitized = sanitized.replace(attrRegex, '');
        });
        
        // Allow only specific attributes
        if (config.allowedAttributes.length > 0) {
          const attrRegex = new RegExp(`\\s(?!${config.allowedAttributes.join('|')})\\w+\\s*=\\s*["'][^"']*["']`, 'gi');
          sanitized = sanitized.replace(attrRegex, '');
        }
      }
      
      // Remove CSS if not allowed
      if (!config.allowStyles) {
        sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
        sanitized = sanitized.replace(/style\s*=\s*["'][^"']*["']/gi, '');
      }
      
      // Remove potential SQL injection patterns
      const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
        /(--)/g,
        /(\*|;|'|"|`|\\)/g
      ];
      
      sqlPatterns.forEach(pattern => {
        if (pattern.test(sanitized)) {
          issues.push('Potentially dangerous SQL pattern detected');
        }
        sanitized = sanitized.replace(pattern, '');
      });
      
      // Remove potential XSS patterns
      const xssPatterns = [
        /<iframe\b[^>]*>/gi,
        /<object\b[^>]*>/gi,
        /<embed\b[^>]*>/gi,
        /<link\b[^>]*>/gi,
        /<meta\b[^>]*>/gi,
        /vbscript\s*:/gi,
        /data\s*:\s*text\/html/gi
      ];
      
      xssPatterns.forEach(pattern => {
        if (pattern.test(sanitized)) {
          issues.push('Potentially dangerous XSS pattern detected');
        }
        sanitized = sanitized.replace(pattern, '');
      });
      
      // Normalize whitespace
      sanitized = sanitized.replace(/\s+/g, ' ').trim();
      
      return {
        original: input,
        sanitized: sanitized,
        valid: issues.length === 0,
        issues: issues,
        changed: sanitized !== input
      };
    },
    
    // Validate command input
    validateCommand: (command) => {
      const validation = {
        valid: true,
        issues: [],
        sanitized: command
      };
      
      if (!command || typeof command !== 'string') {
        validation.valid = false;
        validation.issues.push('Command must be a non-empty string');
        return validation;
      }
      
      // Check for command injection
      const injectionPatterns = [
        /;\s*(rm|del|format|shutdown|reboot)/gi,
        /\|\s*(rm|del|format|shutdown|reboot)/gi,
        /&&\s*(rm|del|format|shutdown|reboot)/gi,
        /`[^`]*`/g,
        /\$[^$]*\$/g
      ];
      
      injectionPatterns.forEach(pattern => {
        if (pattern.test(command)) {
          validation.valid = false;
          validation.issues.push('Potential command injection detected');
        }
      });
      
      // Check for path traversal
      const pathTraversalPatterns = [
        /\.\.\//g,
        /\.\.\\/g,
        /\.\.\//g,
        /\/\.\.\//g,
        /\\\.\.\\/g
      ];
      
      pathTraversalPatterns.forEach(pattern => {
        if (pattern.test(command)) {
          validation.valid = false;
          validation.issues.push('Path traversal pattern detected');
        }
      });
      
      // Check for excessive length
      if (command.length > 500) {
        validation.valid = false;
        validation.issues.push('Command exceeds maximum length');
      }
      
      // Sanitize the command
      validation.sanitized = command
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
        .replace(/[<>]/g, '') // Remove angle brackets
        .trim();
      
      return validation;
    },
    
    // Validate URL input
    validateURL: (url) => {
      const validation = {
        valid: true,
        issues: [],
        sanitized: url
      };
      
      if (!url || typeof url !== 'string') {
        validation.valid = false;
        validation.issues.push('URL must be a non-empty string');
        return validation;
      }
      
      // Check for javascript: protocol
      if (url.toLowerCase().startsWith('javascript:')) {
        validation.valid = false;
        validation.issues.push('JavaScript protocol not allowed');
      }
      
      // Check for data: URLs with HTML
      if (url.toLowerCase().startsWith('data:text/html')) {
        validation.valid = false;
        validation.issues.push('Data URLs with HTML content not allowed');
      }
      
      // Check for vbscript: protocol
      if (url.toLowerCase().startsWith('vbscript:')) {
        validation.valid = false;
        validation.issues.push('VBScript protocol not allowed');
      }
      
      // Check for file: protocol
      if (url.toLowerCase().startsWith('file:')) {
        validation.valid = false;
        validation.issues.push('File protocol not allowed');
      }
      
      // Check for XSS in URL
      const xssPatterns = [
        /<script\b[^>]*>/gi,
        /on\w+\s*=/gi,
        /["\s]*\.\s*["\s]*alert/gi
      ];
      
      xssPatterns.forEach(pattern => {
        if (pattern.test(url)) {
          validation.valid = false;
          validation.issues.push('XSS pattern detected in URL');
        }
      });
      
      try {
        // Validate URL format
        const urlObj = new URL(url);
        
        // Check for dangerous protocols
        const dangerousProtocols = ['javascript:', 'vbscript:', 'data:', 'file:', 'ftp:'];
        if (dangerousProtocols.includes(urlObj.protocol.toLowerCase())) {
          validation.valid = false;
          validation.issues.push(`Dangerous protocol: ${urlObj.protocol}`);
        }
        
        // Sanitize the URL
        validation.sanitized = urlObj.toString();
      } catch (error) {
        validation.valid = false;
        validation.issues.push('Invalid URL format');
      }
      
      return validation;
    },
    
    // Validate API key input
    validateAPIKey: (apiKey) => {
      const validation = {
        valid: true,
        issues: [],
        sanitized: apiKey
      };
      
      if (!apiKey || typeof apiKey !== 'string') {
        validation.valid = false;
        validation.issues.push('API key must be a non-empty string');
        return validation;
      }
      
      // Check for SQL injection patterns
      const sqlPatterns = [
        /['"]\s*;\s*/g,
        /['"]\s*(OR|AND)\s+/gi,
        /UNION\s+SELECT/gi,
        /DROP\s+TABLE/gi,
        /DELETE\s+FROM/gi,
        /INSERT\s+INTO/gi,
        /UPDATE\s+SET/gi
      ];
      
      sqlPatterns.forEach(pattern => {
        if (pattern.test(apiKey)) {
          validation.valid = false;
          validation.issues.push('SQL injection pattern detected in API key');
        }
      });
      
      // Check for script injection
      const scriptPatterns = [
        /<script\b[^>]*>/gi,
        /javascript\s*:/gi,
        /on\w+\s*=/gi
      ];
      
      scriptPatterns.forEach(pattern => {
        if (pattern.test(apiKey)) {
          validation.valid = false;
          validation.issues.push('Script injection pattern detected in API key');
        }
      });
      
      // Check for format
      if (!/^[a-zA-Z0-9_-]+$/.test(apiKey)) {
        validation.valid = false;
        validation.issues.push('API key contains invalid characters');
      }
      
      // Check length
      if (apiKey.length < 20) {
        validation.valid = false;
        validation.issues.push('API key is too short');
      } else if (apiKey.length > 200) {
        validation.valid = false;
        validation.issues.push('API key is too long');
      }
      
      // Sanitize the API key
      validation.sanitized = apiKey
        .replace(/[<>"']/g, '') // Remove potentially dangerous characters
        .trim();
      
      return validation;
    },
    
    // Validate form data
    validateFormData: (formData) => {
      const validation = {
        valid: true,
        issues: [],
        sanitized: {}
      };
      
      if (!formData || typeof formData !== 'object') {
        validation.valid = false;
        validation.issues.push('Form data must be an object');
        return validation;
      }
      
      Object.keys(formData).forEach(key => {
        const value = formData[key];
        
        if (typeof value !== 'string' && typeof value !== 'number') {
          validation.issues.push(`Invalid value type for field: ${key}`);
          validation.valid = false;
          return;
        }
        
        const stringValue = String(value);
        const sanitized = mockInputSanitizer.sanitizer.sanitizeInput(stringValue, {
          allowHTML: false,
          allowScripts: false,
          maxLength: 1000
        });
        
        validation.sanitized[key] = sanitized.sanitized;
        
        if (!sanitized.valid) {
          validation.issues.push(`Issues in field ${key}: ${sanitized.issues.join(', ')}`);
          validation.valid = false;
        }
      });
      
      return validation;
    }
  }
};

describe('Input Sanitization Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Basic Input Sanitization', () => {
    test('should sanitize script tags', () => {
      const input = '<script>alert("XSS")</script>Hello World';
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input);
      
      expect(result.sanitized).toBe('Hello World');
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Potentially dangerous XSS pattern detected');
      expect(result.changed).toBe(true);
    });
    
    test('should remove javascript: URLs', () => {
      const input = 'javascript:alert("XSS")';
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input);
      
      expect(result.sanitized).toBe('alert("XSS")');
      expect(result.valid).toBe(false);
      expect(result.changed).toBe(true);
    });
    
    test('should remove event handlers', () => {
      const input = '<div onclick="alert(\'XSS\')">Click me</div>';
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input);
      
      expect(result.sanitized).not.toContain('onclick');
      expect(result.changed).toBe(true);
    });
    
    test('should block eval() calls', () => {
      const input = 'eval("malicious code")';
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input);
      
      expect(result.sanitized).toBe('blocked("malicious code")');
      expect(result.changed).toBe(true);
    });
    
    test('should block Function() constructor', () => {
      const input = 'new Function("malicious code")';
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input);
      
      expect(result.sanitized).toBe('new blockedFunction("malicious code")');
      expect(result.changed).toBe(true);
    });
    
    test('should handle safe input', () => {
      const input = 'Hello World';
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input);
      
      expect(result.sanitized).toBe('Hello World');
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.changed).toBe(false);
    });
  });
  
  describe('HTML Input Handling', () => {
    test('should remove all HTML when not allowed', () => {
      const input = '<div><span>Hello</span></div>';
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input, { allowHTML: false });
      
      expect(result.sanitized).toBe('Hello');
      expect(result.changed).toBe(true);
    });
    
    test('should allow specific HTML tags', () => {
      const input = '<div><p>Hello</p><script>alert("XSS")</script></div>';
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input, {
        allowHTML: true,
        allowedTags: ['div', 'p']
      });
      
      expect(result.sanitized).toBe('<div><p>Hello</p></div>');
      expect(result.changed).toBe(true);
    });
    
    test('should remove dangerous attributes', () => {
      const input = '<div onclick="alert(\'XSS\')" onload="malicious()">Hello</div>';
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input, {
        allowHTML: true,
        allowedTags: ['div']
      });
      
      expect(result.sanitized).toBe('<div>Hello</div>');
      expect(result.changed).toBe(true);
    });
    
    test('should allow specific attributes', () => {
      const input = '<div id="test" class="example" onclick="alert(\'XSS\')">Hello</div>';
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input, {
        allowHTML: true,
        allowedTags: ['div'],
        allowedAttributes: ['id', 'class']
      });
      
      expect(result.sanitized).toBe('<div id="test" class="example">Hello</div>');
      expect(result.changed).toBe(true);
    });
  });
  
  describe('SQL Injection Prevention', () => {
    test('should detect SQL injection patterns', () => {
      const inputs = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "1' UNION SELECT * FROM users --",
        "'; DELETE FROM users; --"
      ];
      
      inputs.forEach(input => {
        const result = mockInputSanitizer.sanitizer.sanitizeInput(input);
        
        expect(result.valid).toBe(false);
        expect(result.issues.some(issue => 
          issue.includes('Potentially dangerous SQL pattern')
        )).toBe(true);
      });
    });
    
    test('should remove SQL injection characters', () => {
      const input = "test'; DROP TABLE users; --";
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input);
      
      expect(result.sanitized).not.toContain(';');
      expect(result.sanitized).not.toContain('DROP');
      expect(result.sanitized).not.toContain('--');
    });
    
    test('should handle safe database queries', () => {
      const input = 'SELECT * FROM users WHERE id = 1';
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input);
      
      expect(result.valid).toBe(false); // Even safe SQL should be flagged in user input
      expect(result.issues.some(issue => 
        issue.includes('Potentially dangerous SQL pattern')
      )).toBe(true);
    });
  });
  
  describe('Command Validation', () => {
    test('should detect command injection', () => {
      const commands = [
        'ls; rm -rf /',
        'dir && del /s /q *.*',
        'cat file.txt | format c:',
        'echo `rm -rf /`'
      ];
      
      commands.forEach(command => {
        const result = mockInputSanitizer.sanitizer.validateCommand(command);
        
        expect(result.valid).toBe(false);
        expect(result.issues).toContain('Potential command injection detected');
      });
    });
    
    test('should detect path traversal', () => {
      const commands = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32',
        '/etc/../../root',
        'folder/../../../secret'
      ];
      
      commands.forEach(command => {
        const result = mockInputSanitizer.sanitizer.validateCommand(command);
        
        expect(result.valid).toBe(false);
        expect(result.issues).toContain('Path traversal pattern detected');
      });
    });
    
    test('should validate safe commands', () => {
      const commands = [
        'ls -la',
        'dir /b',
        'cd /home/user',
        'cat file.txt'
      ];
      
      commands.forEach(command => {
        const result = mockInputSanitizer.sanitizer.validateCommand(command);
        
        expect(result.valid).toBe(true);
        expect(result.issues).toHaveLength(0);
      });
    });
    
    test('should handle excessive command length', () => {
      const longCommand = 'a'.repeat(501);
      const result = mockInputSanitizer.sanitizer.validateCommand(longCommand);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Command exceeds maximum length');
    });
  });
  
  describe('URL Validation', () => {
    test('should reject dangerous protocols', () => {
      const urls = [
        'javascript:alert("XSS")',
        'vbscript:msgbox("XSS")',
        'data:text/html,<script>alert("XSS")</script>',
        'file:///etc/passwd'
      ];
      
      urls.forEach(url => {
        const result = mockInputSanitizer.sanitizer.validateURL(url);
        
        expect(result.valid).toBe(false);
      });
    });
    
    test('should detect XSS in URLs', () => {
      const urls = [
        'https://example.com/<script>alert("XSS")</script>',
        'https://example.com/?param=<script>alert("XSS")</script>',
        'https://example.com/?onclick=alert("XSS")'
      ];
      
      urls.forEach(url => {
        const result = mockInputSanitizer.sanitizer.validateURL(url);
        
        expect(result.valid).toBe(false);
        expect(result.issues).toContain('XSS pattern detected in URL');
      });
    });
    
    test('should validate safe URLs', () => {
      const urls = [
        'https://example.com',
        'https://api.openrouter.ai/v1/chat',
        'http://localhost:3000',
        'https://subdomain.example.com/path?param=value'
      ];
      
      urls.forEach(url => {
        const result = mockInputSanitizer.sanitizer.validateURL(url);
        
        expect(result.valid).toBe(true);
        expect(result.issues).toHaveLength(0);
      });
    });
    
    test('should handle invalid URL format', () => {
      const invalidUrls = [
        'not-a-url',
        'https://',
        '://missing-protocol.com',
        'https://[invalid-ipv6'
      ];
      
      invalidUrls.forEach(url => {
        const result = mockInputSanitizer.sanitizer.validateURL(url);
        
        expect(result.valid).toBe(false);
        expect(result.issues).toContain('Invalid URL format');
      });
    });
  });
  
  describe('API Key Validation', () => {
    test('should detect SQL injection in API keys', () => {
      const apiKeys = [
        "'; DROP TABLE api_keys; --",
        "' OR '1'='1",
        "key' UNION SELECT * FROM users --"
      ];
      
      apiKeys.forEach(apiKey => {
        const result = mockInputSanitizer.sanitizer.validateAPIKey(apiKey);
        
        expect(result.valid).toBe(false);
        expect(result.issues).toContain('SQL injection pattern detected in API key');
      });
    });
    
    test('should detect script injection in API keys', () => {
      const apiKeys = [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        'key" onclick="alert("XSS")'
      ];
      
      apiKeys.forEach(apiKey => {
        const result = mockInputSanitizer.sanitizer.validateAPIKey(apiKey);
        
        expect(result.valid).toBe(false);
        expect(result.issues).toContain('Script injection pattern detected in API key');
      });
    });
    
    test('should validate API key format', () => {
      const invalidKeys = [
        'key with spaces',
        'key@with#special$chars',
        'short',
        'key that is way too long and exceeds the maximum allowed length for an api key which should be reasonable'
      ];
      
      invalidKeys.forEach(apiKey => {
        const result = mockInputSanitizer.sanitizer.validateAPIKey(apiKey);
        
        expect(result.valid).toBe(false);
      });
    });
    
    test('should validate correct API keys', () => {
      const validKeys = [
        'sk-1234567890abcdefABCDEF',
        'rk_live_1234567890abcdefABCDEF',
        'AKIAIOSFODNN7EXAMPLE',
        'v1.2.34567890abcdefABCDEF'
      ];
      
      validKeys.forEach(apiKey => {
        const result = mockInputSanitizer.sanitizer.validateAPIKey(apiKey);
        
        expect(result.valid).toBe(true);
        expect(result.issues).toHaveLength(0);
      });
    });
  });
  
  describe('Form Data Validation', () => {
    test('should validate form object', () => {
      const formData = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Hello World'
      };
      
      const result = mockInputSanitizer.sanitizer.validateFormData(formData);
      
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(Object.keys(result.sanitized)).toHaveLength(3);
    });
    
    test('should detect malicious form data', () => {
      const formData = {
        name: '<script>alert("XSS")</script>',
        email: 'test@example.com',
        message: "'; DROP TABLE users; --"
      };
      
      const result = mockInputSanitizer.sanitizer.validateFormData(formData);
      
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });
    
    test('should handle invalid form data types', () => {
      const formData = {
        name: null,
        email: undefined,
        message: { object: 'invalid' }
      };
      
      const result = mockInputSanitizer.sanitizer.validateFormData(formData);
      
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });
    
    test('should sanitize form fields', () => {
      const formData = {
        name: '<b>John Doe</b>',
        email: 'john@example.com',
        message: 'Hello <script>alert("XSS")</script>World'
      };
      
      const result = mockInputSanitizer.sanitizer.validateFormData(formData);
      
      expect(result.sanitized.name).toBe('John Doe');
      expect(result.sanitized.message).toBe('Hello World');
    });
  });
  
  describe('Input Length Validation', () => {
    test('should enforce maximum length', () => {
      const longInput = 'a'.repeat(1001);
      const result = mockInputSanitizer.sanitizer.sanitizeInput(longInput);
      
      expect(result.sanitized.length).toBe(1000);
      expect(result.issues).toContain(`Input exceeds maximum length of 1000`);
      expect(result.changed).toBe(true);
    });
    
    test('should handle custom length limit', () => {
      const input = 'a'.repeat(101);
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input, { maxLength: 100 });
      
      expect(result.sanitized.length).toBe(100);
      expect(result.issues).toContain(`Input exceeds maximum length of 100`);
    });
    
    test('should accept valid length input', () => {
      const input = 'a'.repeat(500);
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input);
      
      expect(result.sanitized.length).toBe(500);
      expect(result.valid).toBe(true);
    });
  });
  
  describe('Input Sanitization Best Practices', () => {
    test('should handle null and undefined input', () => {
      const nullResult = mockInputSanitizer.sanitizer.sanitizeInput(null);
      expect(nullResult.valid).toBe(false);
      expect(nullResult.error).toBe('Input must be a string');
      
      const undefinedResult = mockInputSanitizer.sanitizer.sanitizeInput(undefined);
      expect(undefinedResult.valid).toBe(false);
      expect(undefinedResult.error).toBe('Input must be a string');
    });
    
    test('should normalize whitespace', () => {
      const input = '  Hello    World  \n  ';
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input);
      
      expect(result.sanitized).toBe('Hello World');
      expect(result.changed).toBe(true);
    });
    
    test('should remove control characters', () => {
      const input = 'Hello\x00World\x1F';
      const result = mockInputSanitizer.sanitizer.validateCommand(input);
      
      expect(result.sanitized).toBe('HelloWorld');
      expect(result.changed).toBe(true);
    });
    
    test('should handle empty input', () => {
      const input = '';
      const result = mockInputSanitizer.sanitizer.sanitizeInput(input);
      
      expect(result.sanitized).toBe('');
      expect(result.valid).toBe(true);
      expect(result.changed).toBe(false);
    });
  });
});
