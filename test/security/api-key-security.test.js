/**
 * API Key Security Validation Tests
 * Tests for API key security measures and validation
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock security validation module
const mockSecurityValidator = {
  // API key security validator
  apiKeySecurity: {
    // Validate API key format and strength
    validateApiKeyStrength: (apiKey) => {
      if (!apiKey || typeof apiKey !== 'string') {
        return {
          valid: false,
          strength: 'none',
          issues: ['API key is required']
        };
      }
      
      const issues = [];
      let strength = 0;
      
      // Length check
      if (apiKey.length < 20) {
        issues.push('API key is too short (minimum 20 characters)');
      } else if (apiKey.length >= 32) {
        strength += 2;
      } else {
        strength += 1;
      }
      
      // Character variety check
      if (/[a-z]/.test(apiKey)) strength += 1;
      if (/[A-Z]/.test(apiKey)) strength += 1;
      if (/[0-9]/.test(apiKey)) strength += 1;
      if (/[^a-zA-Z0-9]/.test(apiKey)) strength += 1;
      
      // Common patterns check
      if (/^[a-zA-Z]+$/.test(apiKey)) {
        issues.push('API key should contain numbers and special characters');
      }
      
      if (/^[0-9]+$/.test(apiKey)) {
        issues.push('API key should contain letters and special characters');
      }
      
      // Sequential characters check
      if (/(.)\1{4,}/.test(apiKey)) {
        issues.push('API key contains repeated characters');
      }
      
      // Dictionary words check (simplified)
      const commonWords = ['password', 'secret', 'key', 'admin', 'test'];
      const lowerKey = apiKey.toLowerCase();
      for (const word of commonWords) {
        if (lowerKey.includes(word)) {
          issues.push(`API key contains common word: ${word}`);
          break;
        }
      }
      
      // Determine strength level
      let strengthLevel = 'weak';
      if (strength >= 6) {
        strengthLevel = 'strong';
      } else if (strength >= 4) {
        strengthLevel = 'medium';
      }
      
      return {
        valid: issues.length === 0,
        strength: strengthLevel,
        score: strength,
        issues: issues
      };
    },
    
    // Check for API key exposure in storage
    checkApiKeyExposure: async () => {
      return new Promise((resolve) => {
        chrome.storage.local.get(['openrouter_api_key'], (result) => {
          const apiKey = result.openrouter_api_key;
          
          if (!apiKey) {
            resolve({
              exposed: false,
              locations: [],
              riskLevel: 'none'
            });
            return;
          }
          
          const locations = [];
          let riskLevel = 'low';
          
          // Check if API key is stored in plain text
          if (apiKey && typeof apiKey === 'string') {
            locations.push({
              type: 'storage',
              location: 'chrome.storage.local',
              encrypted: false,
              risk: 'medium'
            });
            riskLevel = 'medium';
          }
          
          // Check for API key in memory (simplified check)
          if (typeof window !== 'undefined' && window.apiKey) {
            locations.push({
              type: 'memory',
              location: 'window.global',
              encrypted: false,
              risk: 'high'
            });
            riskLevel = 'high';
          }
          
          // Check for API key in console logs (simplified)
          if (console.log.calls && console.log.calls.some(call => 
            call.args && call.args.some(arg => 
              typeof arg === 'string' && arg.includes(apiKey.substring(0, 8))
            )
          )) {
            locations.push({
              type: 'logs',
              location: 'console.log',
              encrypted: false,
              risk: 'high'
            });
            riskLevel = 'high';
          }
          
          resolve({
            exposed: locations.length > 0,
            locations: locations,
            riskLevel: riskLevel
          });
        });
      });
    },
    
    // Validate API key transmission security
    validateApiKeyTransmission: (request) => {
      const issues = [];
      
      // Check if API key is sent over HTTPS
      if (request.url && !request.url.startsWith('https://')) {
        issues.push('API key transmitted over insecure connection (non-HTTPS)');
      }
      
      // Check if API key is in URL parameters
      if (request.url && request.url.includes('api_key=')) {
        issues.push('API key exposed in URL parameters');
      }
      
      // Check if API key is in request headers
      if (request.headers) {
        const apiKeyHeaders = ['authorization', 'x-api-key', 'api-key'];
        for (const header of apiKeyHeaders) {
          if (request.headers[header]) {
            // Check if header value is properly formatted
            if (request.headers[header].includes('Bearer ')) {
              // Good practice - Bearer token
            } else if (request.headers[header].length < 20) {
              issues.push(`API key in ${header} header appears to be too short`);
            }
          }
        }
      }
      
      // Check for API key in request body
      if (request.body && typeof request.body === 'string') {
        if (request.body.includes('api_key') || request.body.includes('apiKey')) {
          issues.push('API key found in request body');
        }
      }
      
      return {
        secure: issues.length === 0,
        issues: issues
      };
    },
    
    // Check for API key leakage in browser data
    checkApiKeyLeakage: async () => {
      return new Promise((resolve) => {
        const leakagePoints = [];
        
        // Check localStorage
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            
            if (key.includes('api') || key.includes('key') || 
                (value && value.length > 20 && /^[a-zA-Z0-9_-]+$/.test(value))) {
              leakagePoints.push({
                type: 'localStorage',
                key: key,
                encrypted: false,
                risk: 'medium'
              });
            }
          }
        } catch (error) {
          // localStorage access denied
        }
        
        // Check sessionStorage
        try {
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            const value = sessionStorage.getItem(key);
            
            if (key.includes('api') || key.includes('key') || 
                (value && value.length > 20 && /^[a-zA-Z0-9_-]+$/.test(value))) {
              leakagePoints.push({
                type: 'sessionStorage',
                key: key,
                encrypted: false,
                risk: 'medium'
              });
            }
          }
        } catch (error) {
          // sessionStorage access denied
        }
        
        // Check cookies (simplified)
        if (document.cookie) {
          const cookies = document.cookie.split(';');
          for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name.includes('api') || name.includes('key') || 
                (value && value.length > 20 && /^[a-zA-Z0-9_-]+$/.test(value))) {
              leakagePoints.push({
                type: 'cookie',
                key: name,
                encrypted: false,
                secure: document.cookie.includes('Secure'),
                httpOnly: document.cookie.includes('HttpOnly'),
                risk: 'high'
              });
            }
          }
        }
        
        resolve({
          hasLeakage: leakagePoints.length > 0,
          leakagePoints: leakagePoints,
          riskLevel: leakagePoints.length > 2 ? 'high' : leakagePoints.length > 0 ? 'medium' : 'low'
        });
      });
    },
    
    // Validate API key rotation policy
    validateApiKeyRotation: async () => {
      return new Promise((resolve) => {
        chrome.storage.local.get(['api_key_set_date', 'api_key_last_rotated'], (result) => {
          const setDate = result.api_key_set_date;
          const lastRotated = result.api_key_last_rotated;
          
          const now = new Date();
          const issues = [];
          
          if (!setDate) {
            issues.push('API key creation date not recorded');
          } else {
            const createdDate = new Date(setDate);
            const daysSinceCreation = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
            
            if (daysSinceCreation > 90) {
              issues.push(`API key is ${daysSinceCreation} days old (recommend rotation every 90 days)`);
            }
          }
          
          if (lastRotated) {
            const rotatedDate = new Date(lastRotated);
            const daysSinceRotation = Math.floor((now - rotatedDate) / (1000 * 60 * 60 * 24));
            
            if (daysSinceRotation > 90) {
              issues.push(`API key last rotated ${daysSinceRotation} days ago (recommend rotation every 90 days)`);
            }
          } else if (setDate) {
            const createdDate = new Date(setDate);
            const daysSinceCreation = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
            
            if (daysSinceCreation > 90) {
              issues.push('API key has never been rotated');
            }
          }
          
          resolve({
            valid: issues.length === 0,
            issues: issues,
            lastRotated: lastRotated,
            setDate: setDate
          });
        });
      });
    }
  }
};

describe('API Key Security Validation Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Initialize storage
    chrome.storage.local._data = {};
    
    // Mock console.log to track API key exposure
    const originalLog = console.log;
    console.log = jest.fn();
    console.log.calls = [];
    
    // Restore original console.log after tests
    afterEach(() => {
      console.log = originalLog;
    });
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('API Key Strength Validation', () => {
    test('should reject weak API keys', () => {
      const weakKeys = [
        'short',
        '12345678901234567890',
        'abcdefghijklmnopqrstu',
        'ALLUPPERCASEKEY1234567890',
        'alllowercasekey1234567890',
        'password1234567890',
        'secretkey1234567890'
      ];
      
      weakKeys.forEach(apiKey => {
        const result = mockSecurityValidator.apiKeySecurity.validateApiKeyStrength(apiKey);
        expect(result.valid).toBe(false);
        expect(result.strength).toBe('weak');
        expect(result.issues.length).toBeGreaterThan(0);
      });
    });
    
    test('should accept strong API keys', () => {
      const strongKeys = [
        'sk-1234567890abcdefABCDEF',
        'rk_live_1234567890abcdefABCDEF',
        'AKIAIOSFODNN7EXAMPLE',
        'v1.2.34567890abcdefABCDEF!@#'
      ];
      
      strongKeys.forEach(apiKey => {
        const result = mockSecurityValidator.apiKeySecurity.validateApiKeyStrength(apiKey);
        expect(result.valid).toBe(true);
        expect(result.strength).toBeOneOf(['medium', 'strong']);
        expect(result.score).toBeGreaterThanOrEqual(4);
      });
    });
    
    test('should identify repeated characters', () => {
      const apiKey = 'sk-11111111111111111111';
      const result = mockSecurityValidator.apiKeySecurity.validateApiKeyStrength(apiKey);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('API key contains repeated characters');
    });
    
    test('should calculate strength score correctly', () => {
      const apiKey = 'sk-AbCd1234!@#$';
      const result = mockSecurityValidator.apiKeySecurity.validateApiKeyStrength(apiKey);
      
      expect(result.score).toBeGreaterThan(0);
      expect(['weak', 'medium', 'strong']).toContain(result.strength);
    });
  });
  
  describe('API Key Exposure Detection', () => {
    test('should detect API key in chrome storage', async () => {
      const testApiKey = 'sk-1234567890abcdefABCDEF';
      chrome.storage.local._data.openrouter_api_key = testApiKey;
      
      const result = await mockSecurityValidator.apiKeySecurity.checkApiKeyExposure();
      
      expect(result.exposed).toBe(true);
      expect(result.riskLevel).toBe('medium');
      expect(result.locations).toHaveLength(1);
      expect(result.locations[0].type).toBe('storage');
      expect(result.locations[0].encrypted).toBe(false);
    });
    
    test('should detect API key in global window object', async () => {
      const testApiKey = 'sk-1234567890abcdefABCDEF';
      window.apiKey = testApiKey;
      chrome.storage.local._data.openrouter_api_key = testApiKey;
      
      const result = await mockSecurityValidator.apiKeySecurity.checkApiKeyExposure();
      
      expect(result.exposed).toBe(true);
      expect(result.riskLevel).toBe('high');
      expect(result.locations.some(loc => loc.type === 'memory')).toBe(true);
      
      // Clean up
      delete window.apiKey;
    });
    
    test('should detect API key in console logs', async () => {
      const testApiKey = 'sk-1234567890abcdefABCDEF';
      chrome.storage.local._data.openrouter_api_key = testApiKey;
      
      // Log API key to console
      console.log('API Key:', testApiKey);
      
      const result = await mockSecurityValidator.apiKeySecurity.checkApiKeyExposure();
      
      expect(result.exposed).toBe(true);
      expect(result.riskLevel).toBe('high');
      expect(result.locations.some(loc => loc.type === 'logs')).toBe(true);
    });
    
    test('should report no exposure when API key is not stored', async () => {
      const result = await mockSecurityValidator.apiKeySecurity.checkApiKeyExposure();
      
      expect(result.exposed).toBe(false);
      expect(result.riskLevel).toBe('none');
      expect(result.locations).toHaveLength(0);
    });
  });
  
  describe('API Key Transmission Security', () => {
    test('should detect insecure transmission', () => {
      const insecureRequest = {
        url: 'http://api.example.com/endpoint',
        headers: {
          'authorization': 'Bearer sk-1234567890abcdefABCDEF'
        }
      };
      
      const result = mockSecurityValidator.apiKeySecurity.validateApiKeyTransmission(insecureRequest);
      
      expect(result.secure).toBe(false);
      expect(result.issues).toContain('API key transmitted over insecure connection (non-HTTPS)');
    });
    
    test('should detect API key in URL parameters', () => {
      const requestWithUrlKey = {
        url: 'https://api.example.com/endpoint?api_key=sk-1234567890abcdefABCDEF',
        headers: {}
      };
      
      const result = mockSecurityValidator.apiKeySecurity.validateApiKeyTransmission(requestWithUrlKey);
      
      expect(result.secure).toBe(false);
      expect(result.issues).toContain('API key exposed in URL parameters');
    });
    
    test('should detect API key in request body', () => {
      const requestWithBodyKey = {
        url: 'https://api.example.com/endpoint',
        headers: {},
        body: JSON.stringify({
          api_key: 'sk-1234567890abcdefABCDEF',
          data: 'test'
        })
      };
      
      const result = mockSecurityValidator.apiKeySecurity.validateApiKeyTransmission(requestWithBodyKey);
      
      expect(result.secure).toBe(false);
      expect(result.issues).toContain('API key found in request body');
    });
    
    test('should validate secure transmission', () => {
      const secureRequest = {
        url: 'https://api.example.com/endpoint',
        headers: {
          'authorization': 'Bearer sk-1234567890abcdefABCDEF'
        }
      };
      
      const result = mockSecurityValidator.apiKeySecurity.validateApiKeyTransmission(secureRequest);
      
      expect(result.secure).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });
  
  describe('API Key Leakage Detection', () => {
    test('should detect API key in localStorage', async () => {
      const testApiKey = 'sk-1234567890abcdefABCDEF';
      localStorage.setItem('api_key', testApiKey);
      
      const result = await mockSecurityValidator.apiKeySecurity.checkApiKeyLeakage();
      
      expect(result.hasLeakage).toBe(true);
      expect(result.leakagePoints.some(point => point.type === 'localStorage')).toBe(true);
      
      // Clean up
      localStorage.removeItem('api_key');
    });
    
    test('should detect API key in sessionStorage', async () => {
      const testApiKey = 'sk-1234567890abcdefABCDEF';
      sessionStorage.setItem('auth_token', testApiKey);
      
      const result = await mockSecurityValidator.apiKeySecurity.checkApiKeyLeakage();
      
      expect(result.hasLeakage).toBe(true);
      expect(result.leakagePoints.some(point => point.type === 'sessionStorage')).toBe(true);
      
      // Clean up
      sessionStorage.removeItem('auth_token');
    });
    
    test('should detect API key in cookies', async () => {
      // Mock document.cookie
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'api_key=sk-1234567890abcdefABCDEF; session_id=abc123'
      });
      
      const result = await mockSecurityValidator.apiKeySecurity.checkApiKeyLeakage();
      
      expect(result.hasLeakage).toBe(true);
      expect(result.leakagePoints.some(point => point.type === 'cookie')).toBe(true);
      
      // Clean up
      document.cookie = 'api_key=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    });
    
    test('should report no leakage when API key is properly stored', async () => {
      const result = await mockSecurityValidator.apiKeySecurity.checkApiKeyLeakage();
      
      expect(result.hasLeakage).toBe(false);
      expect(result.riskLevel).toBe('low');
      expect(result.leakagePoints).toHaveLength(0);
    });
  });
  
  describe('API Key Rotation Policy', () => {
    test('should validate recent API key creation', async () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      
      chrome.storage.local._data.api_key_set_date = recentDate.toISOString();
      
      const result = await mockSecurityValidator.apiKeySecurity.validateApiKeyRotation();
      
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
    
    test('should detect old API key needing rotation', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000); // 100 days ago
      
      chrome.storage.local._data.api_key_set_date = oldDate.toISOString();
      
      const result = await mockSecurityValidator.apiKeySecurity.validateApiKeyRotation();
      
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]).toContain('days old (recommend rotation every 90 days)');
    });
    
    test('should detect API key that has never been rotated', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000); // 100 days ago
      
      chrome.storage.local._data.api_key_set_date = oldDate.toISOString();
      // No api_key_last_rotated set
      
      const result = await mockSecurityValidator.apiKeySecurity.validateApiKeyRotation();
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('API key has never been rotated');
    });
    
    test('should handle missing creation date', async () => {
      const result = await mockSecurityValidator.apiKeySecurity.validateApiKeyRotation();
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('API key creation date not recorded');
    });
  });
  
  describe('Security Best Practices', () => {
    test('should enforce minimum API key length', () => {
      const shortKey = 'short';
      const result = mockSecurityValidator.apiKeySecurity.validateApiKeyStrength(shortKey);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('API key is too short (minimum 20 characters)');
    });
    
    test('should recommend character variety in API keys', () => {
      const numericKey = '123456789012345678901234567890';
      const result = mockSecurityValidator.apiKeySecurity.validateApiKeyStrength(numericKey);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('API key should contain letters and special characters');
    });
    
    test('should detect common words in API keys', () => {
      const weakKey = 'password12345678901234567890';
      const result = mockSecurityValidator.apiKeySecurity.validateApiKeyStrength(weakKey);
      
      expect(result.valid).toBe(false);
      expect(result.issues.some(issue => issue.includes('contains common word'))).toBe(true);
    });
  });
}); * API Key Security Validation Tests
 * Tests for API key security measures and validation
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock security validation module
const mockSecurityValidator = {
  // API key security validator
  apiKeySecurity: {
    // Validate API key format and strength
    validateApiKeyStrength: (apiKey) => {
      if (!apiKey || typeof apiKey !== 'string') {
        return {
          valid: false,
          strength: 'none',
          issues: ['API key is required']
        };
      }
      
      const issues = [];
      let strength = 0;
      
      // Length check
      if (apiKey.length < 20) {
        issues.push('API key is too short (minimum 20 characters)');
      } else if (apiKey.length >= 32) {
        strength += 2;
      } else {
        strength += 1;
      }
      
      // Character variety check
      if (/[a-z]/.test(apiKey)) strength += 1;
      if (/[A-Z]/.test(apiKey)) strength += 1;
      if (/[0-9]/.test(apiKey)) strength += 1;
      if (/[^a-zA-Z0-9]/.test(apiKey)) strength += 1;
      
      // Common patterns check
      if (/^[a-zA-Z]+$/.test(apiKey)) {
        issues.push('API key should contain numbers and special characters');
      }
      
      if (/^[0-9]+$/.test(apiKey)) {
        issues.push('API key should contain letters and special characters');
      }
      
      // Sequential characters check
      if (/(.)\1{4,}/.test(apiKey)) {
        issues.push('API key contains repeated characters');
      }
      
      // Dictionary words check (simplified)
      const commonWords = ['password', 'secret', 'key', 'admin', 'test'];
      const lowerKey = apiKey.toLowerCase();
      for (const word of commonWords) {
        if (lowerKey.includes(word)) {
          issues.push(`API key contains common word: ${word}`);
          break;
        }
      }
      
      // Determine strength level
      let strengthLevel = 'weak';
      if (strength >= 6) {
        strengthLevel = 'strong';
      } else if (strength >= 4) {
        strengthLevel = 'medium';
      }
      
      return {
        valid: issues.length === 0,
        strength: strengthLevel,
        score: strength,
        issues: issues
      };
    },
    
    // Check for API key exposure in storage
    checkApiKeyExposure: async () => {
      return new Promise((resolve) => {
        chrome.storage.local.get(['openrouter_api_key'], (result) => {
          const apiKey = result.openrouter_api_key;
          
          if (!apiKey) {
            resolve({
              exposed: false,
              locations: [],
              riskLevel: 'none'
            });
            return;
          }
          
          const locations = [];
          let riskLevel = 'low';
          
          // Check if API key is stored in plain text
          if (apiKey && typeof apiKey === 'string') {
            locations.push({
              type: 'storage',
              location: 'chrome.storage.local',
              encrypted: false,
              risk: 'medium'
            });
            riskLevel = 'medium';
          }
          
          // Check for API key in memory (simplified check)
          if (typeof window !== 'undefined' && window.apiKey) {
            locations.push({
              type: 'memory',
              location: 'window.global',
              encrypted: false,
              risk: 'high'
            });
            riskLevel = 'high';
          }
          
          // Check for API key in console logs (simplified)
          if (console.log.calls && console.log.calls.some(call => 
            call.args && call.args.some(arg => 
              typeof arg === 'string' && arg.includes(apiKey.substring(0, 8))
            )
          )) {
            locations.push({
              type: 'logs',
              location: 'console.log',
              encrypted: false,
              risk: 'high'
            });
            riskLevel = 'high';
          }
          
          resolve({
            exposed: locations.length > 0,
            locations: locations,
            riskLevel: riskLevel
          });
        });
      });
    },
    
    // Validate API key transmission security
    validateApiKeyTransmission: (request) => {
      const issues = [];
      
      // Check if API key is sent over HTTPS
      if (request.url && !request.url.startsWith('https://')) {
        issues.push('API key transmitted over insecure connection (non-HTTPS)');
      }
      
      // Check if API key is in URL parameters
      if (request.url && request.url.includes('api_key=')) {
        issues.push('API key exposed in URL parameters');
      }
      
      // Check if API key is in request headers
      if (request.headers) {
        const apiKeyHeaders = ['authorization', 'x-api-key', 'api-key'];
        for (const header of apiKeyHeaders) {
          if (request.headers[header]) {
            // Check if header value is properly formatted
            if (request.headers[header].includes('Bearer ')) {
              // Good practice - Bearer token
            } else if (request.headers[header].length < 20) {
              issues.push(`API key in ${header} header appears to be too short`);
            }
          }
        }
      }
      
      // Check for API key in request body
      if (request.body && typeof request.body === 'string') {
        if (request.body.includes('api_key') || request.body.includes('apiKey')) {
          issues.push('API key found in request body');
        }
      }
      
      return {
        secure: issues.length === 0,
        issues: issues
      };
    },
    
    // Check for API key leakage in browser data
    checkApiKeyLeakage: async () => {
      return new Promise((resolve) => {
        const leakagePoints = [];
        
        // Check localStorage
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            
            if (key.includes('api') || key.includes('key') || 
                (value && value.length > 20 && /^[a-zA-Z0-9_-]+$/.test(value))) {
              leakagePoints.push({
                type: 'localStorage',
                key: key,
                encrypted: false,
                risk: 'medium'
              });
            }
          }
        } catch (error) {
          // localStorage access denied
        }
        
        // Check sessionStorage
        try {
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            const value = sessionStorage.getItem(key);
            
            if (key.includes('api') || key.includes('key') || 
                (value && value.length > 20 && /^[a-zA-Z0-9_-]+$/.test(value))) {
              leakagePoints.push({
                type: 'sessionStorage',
                key: key,
                encrypted: false,
                risk: 'medium'
              });
            }
          }
        } catch (error) {
          // sessionStorage access denied
        }
        
        // Check cookies (simplified)
        if (document.cookie) {
          const cookies = document.cookie.split(';');
          for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name.includes('api') || name.includes('key') || 
                (value && value.length > 20 && /^[a-zA-Z0-9_-]+$/.test(value))) {
              leakagePoints.push({
                type: 'cookie',
                key: name,
                encrypted: false,
                secure: document.cookie.includes('Secure'),
                httpOnly: document.cookie.includes('HttpOnly'),
                risk: 'high'
              });
            }
          }
        }
        
        resolve({
          hasLeakage: leakagePoints.length > 0,
          leakagePoints: leakagePoints,
          riskLevel: leakagePoints.length > 2 ? 'high' : leakagePoints.length > 0 ? 'medium' : 'low'
        });
      });
    },
    
    // Validate API key rotation policy
    validateApiKeyRotation: async () => {
      return new Promise((resolve) => {
        chrome.storage.local.get(['api_key_set_date', 'api_key_last_rotated'], (result) => {
          const setDate = result.api_key_set_date;
          const lastRotated = result.api_key_last_rotated;
          
          const now = new Date();
          const issues = [];
          
          if (!setDate) {
            issues.push('API key creation date not recorded');
          } else {
            const createdDate = new Date(setDate);
            const daysSinceCreation = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
            
            if (daysSinceCreation > 90) {
              issues.push(`API key is ${daysSinceCreation} days old (recommend rotation every 90 days)`);
            }
          }
          
          if (lastRotated) {
            const rotatedDate = new Date(lastRotated);
            const daysSinceRotation = Math.floor((now - rotatedDate) / (1000 * 60 * 60 * 24));
            
            if (daysSinceRotation > 90) {
              issues.push(`API key last rotated ${daysSinceRotation} days ago (recommend rotation every 90 days)`);
            }
          } else if (setDate) {
            const createdDate = new Date(setDate);
            const daysSinceCreation = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
            
            if (daysSinceCreation > 90) {
              issues.push('API key has never been rotated');
            }
          }
          
          resolve({
            valid: issues.length === 0,
            issues: issues,
            lastRotated: lastRotated,
            setDate: setDate
          });
        });
      });
    }
  }
};

describe('API Key Security Validation Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Initialize storage
    chrome.storage.local._data = {};
    
    // Mock console.log to track API key exposure
    const originalLog = console.log;
    console.log = jest.fn();
    console.log.calls = [];
    
    // Restore original console.log after tests
    afterEach(() => {
      console.log = originalLog;
    });
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('API Key Strength Validation', () => {
    test('should reject weak API keys', () => {
      const weakKeys = [
        'short',
        '12345678901234567890',
        'abcdefghijklmnopqrstu',
        'ALLUPPERCASEKEY1234567890',
        'alllowercasekey1234567890',
        'password1234567890',
        'secretkey1234567890'
      ];
      
      weakKeys.forEach(apiKey => {
        const result = mockSecurityValidator.apiKeySecurity.validateApiKeyStrength(apiKey);
        expect(result.valid).toBe(false);
        expect(result.strength).toBe('weak');
        expect(result.issues.length).toBeGreaterThan(0);
      });
    });
    
    test('should accept strong API keys', () => {
      const strongKeys = [
        'sk-1234567890abcdefABCDEF',
        'rk_live_1234567890abcdefABCDEF',
        'AKIAIOSFODNN7EXAMPLE',
        'v1.2.34567890abcdefABCDEF!@#'
      ];
      
      strongKeys.forEach(apiKey => {
        const result = mockSecurityValidator.apiKeySecurity.validateApiKeyStrength(apiKey);
        expect(result.valid).toBe(true);
        expect(result.strength).toBeOneOf(['medium', 'strong']);
        expect(result.score).toBeGreaterThanOrEqual(4);
      });
    });
    
    test('should identify repeated characters', () => {
      const apiKey = 'sk-11111111111111111111';
      const result = mockSecurityValidator.apiKeySecurity.validateApiKeyStrength(apiKey);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('API key contains repeated characters');
    });
    
    test('should calculate strength score correctly', () => {
      const apiKey = 'sk-AbCd1234!@#$';
      const result = mockSecurityValidator.apiKeySecurity.validateApiKeyStrength(apiKey);
      
      expect(result.score).toBeGreaterThan(0);
      expect(['weak', 'medium', 'strong']).toContain(result.strength);
    });
  });
  
  describe('API Key Exposure Detection', () => {
    test('should detect API key in chrome storage', async () => {
      const testApiKey = 'sk-1234567890abcdefABCDEF';
      chrome.storage.local._data.openrouter_api_key = testApiKey;
      
      const result = await mockSecurityValidator.apiKeySecurity.checkApiKeyExposure();
      
      expect(result.exposed).toBe(true);
      expect(result.riskLevel).toBe('medium');
      expect(result.locations).toHaveLength(1);
      expect(result.locations[0].type).toBe('storage');
      expect(result.locations[0].encrypted).toBe(false);
    });
    
    test('should detect API key in global window object', async () => {
      const testApiKey = 'sk-1234567890abcdefABCDEF';
      window.apiKey = testApiKey;
      chrome.storage.local._data.openrouter_api_key = testApiKey;
      
      const result = await mockSecurityValidator.apiKeySecurity.checkApiKeyExposure();
      
      expect(result.exposed).toBe(true);
      expect(result.riskLevel).toBe('high');
      expect(result.locations.some(loc => loc.type === 'memory')).toBe(true);
      
      // Clean up
      delete window.apiKey;
    });
    
    test('should detect API key in console logs', async () => {
      const testApiKey = 'sk-1234567890abcdefABCDEF';
      chrome.storage.local._data.openrouter_api_key = testApiKey;
      
      // Log API key to console
      console.log('API Key:', testApiKey);
      
      const result = await mockSecurityValidator.apiKeySecurity.checkApiKeyExposure();
      
      expect(result.exposed).toBe(true);
      expect(result.riskLevel).toBe('high');
      expect(result.locations.some(loc => loc.type === 'logs')).toBe(true);
    });
    
    test('should report no exposure when API key is not stored', async () => {
      const result = await mockSecurityValidator.apiKeySecurity.checkApiKeyExposure();
      
      expect(result.exposed).toBe(false);
      expect(result.riskLevel).toBe('none');
      expect(result.locations).toHaveLength(0);
    });
  });
  
  describe('API Key Transmission Security', () => {
    test('should detect insecure transmission', () => {
      const insecureRequest = {
        url: 'http://api.example.com/endpoint',
        headers: {
          'authorization': 'Bearer sk-1234567890abcdefABCDEF'
        }
      };
      
      const result = mockSecurityValidator.apiKeySecurity.validateApiKeyTransmission(insecureRequest);
      
      expect(result.secure).toBe(false);
      expect(result.issues).toContain('API key transmitted over insecure connection (non-HTTPS)');
    });
    
    test('should detect API key in URL parameters', () => {
      const requestWithUrlKey = {
        url: 'https://api.example.com/endpoint?api_key=sk-1234567890abcdefABCDEF',
        headers: {}
      };
      
      const result = mockSecurityValidator.apiKeySecurity.validateApiKeyTransmission(requestWithUrlKey);
      
      expect(result.secure).toBe(false);
      expect(result.issues).toContain('API key exposed in URL parameters');
    });
    
    test('should detect API key in request body', () => {
      const requestWithBodyKey = {
        url: 'https://api.example.com/endpoint',
        headers: {},
        body: JSON.stringify({
          api_key: 'sk-1234567890abcdefABCDEF',
          data: 'test'
        })
      };
      
      const result = mockSecurityValidator.apiKeySecurity.validateApiKeyTransmission(requestWithBodyKey);
      
      expect(result.secure).toBe(false);
      expect(result.issues).toContain('API key found in request body');
    });
    
    test('should validate secure transmission', () => {
      const secureRequest = {
        url: 'https://api.example.com/endpoint',
        headers: {
          'authorization': 'Bearer sk-1234567890abcdefABCDEF'
        }
      };
      
      const result = mockSecurityValidator.apiKeySecurity.validateApiKeyTransmission(secureRequest);
      
      expect(result.secure).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });
  
  describe('API Key Leakage Detection', () => {
    test('should detect API key in localStorage', async () => {
      const testApiKey = 'sk-1234567890abcdefABCDEF';
      localStorage.setItem('api_key', testApiKey);
      
      const result = await mockSecurityValidator.apiKeySecurity.checkApiKeyLeakage();
      
      expect(result.hasLeakage).toBe(true);
      expect(result.leakagePoints.some(point => point.type === 'localStorage')).toBe(true);
      
      // Clean up
      localStorage.removeItem('api_key');
    });
    
    test('should detect API key in sessionStorage', async () => {
      const testApiKey = 'sk-1234567890abcdefABCDEF';
      sessionStorage.setItem('auth_token', testApiKey);
      
      const result = await mockSecurityValidator.apiKeySecurity.checkApiKeyLeakage();
      
      expect(result.hasLeakage).toBe(true);
      expect(result.leakagePoints.some(point => point.type === 'sessionStorage')).toBe(true);
      
      // Clean up
      sessionStorage.removeItem('auth_token');
    });
    
    test('should detect API key in cookies', async () => {
      // Mock document.cookie
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'api_key=sk-1234567890abcdefABCDEF; session_id=abc123'
      });
      
      const result = await mockSecurityValidator.apiKeySecurity.checkApiKeyLeakage();
      
      expect(result.hasLeakage).toBe(true);
      expect(result.leakagePoints.some(point => point.type === 'cookie')).toBe(true);
      
      // Clean up
      document.cookie = 'api_key=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    });
    
    test('should report no leakage when API key is properly stored', async () => {
      const result = await mockSecurityValidator.apiKeySecurity.checkApiKeyLeakage();
      
      expect(result.hasLeakage).toBe(false);
      expect(result.riskLevel).toBe('low');
      expect(result.leakagePoints).toHaveLength(0);
    });
  });
  
  describe('API Key Rotation Policy', () => {
    test('should validate recent API key creation', async () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      
      chrome.storage.local._data.api_key_set_date = recentDate.toISOString();
      
      const result = await mockSecurityValidator.apiKeySecurity.validateApiKeyRotation();
      
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
    
    test('should detect old API key needing rotation', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000); // 100 days ago
      
      chrome.storage.local._data.api_key_set_date = oldDate.toISOString();
      
      const result = await mockSecurityValidator.apiKeySecurity.validateApiKeyRotation();
      
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]).toContain('days old (recommend rotation every 90 days)');
    });
    
    test('should detect API key that has never been rotated', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000); // 100 days ago
      
      chrome.storage.local._data.api_key_set_date = oldDate.toISOString();
      // No api_key_last_rotated set
      
      const result = await mockSecurityValidator.apiKeySecurity.validateApiKeyRotation();
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('API key has never been rotated');
    });
    
    test('should handle missing creation date', async () => {
      const result = await mockSecurityValidator.apiKeySecurity.validateApiKeyRotation();
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('API key creation date not recorded');
    });
  });
  
  describe('Security Best Practices', () => {
    test('should enforce minimum API key length', () => {
      const shortKey = 'short';
      const result = mockSecurityValidator.apiKeySecurity.validateApiKeyStrength(shortKey);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('API key is too short (minimum 20 characters)');
    });
    
    test('should recommend character variety in API keys', () => {
      const numericKey = '123456789012345678901234567890';
      const result = mockSecurityValidator.apiKeySecurity.validateApiKeyStrength(numericKey);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('API key should contain letters and special characters');
    });
    
    test('should detect common words in API keys', () => {
      const weakKey = 'password12345678901234567890';
      const result = mockSecurityValidator.apiKeySecurity.validateApiKeyStrength(weakKey);
      
      expect(result.valid).toBe(false);
      expect(result.issues.some(issue => issue.includes('contains common word'))).toBe(true);
    });
  });
});
