/**
 * OpenRouter Client Unit Tests
 * Tests for OpenRouter API communication and error handling
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { createMockFetch, generateTestCommand, setupTest, teardownTest, expectError } = require('../utils/test-helpers');

// Mock OpenRouter client module (this would be imported from the actual source)
const mockOpenRouterClient = {
  // Make API request to OpenRouter
  makeRequest: async (apiKey, command, model = 'anthropic/claude-3-haiku') => {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('API key is required and must be a string');
    }
    
    if (!command || typeof command !== 'object') {
      throw new Error('Command is required and must be an object');
    }
    
    const requestBody = {
      model: model,
      messages: [
        {
          role: 'user',
          content: `Parse this browser automation command and provide structured actions: ${JSON.stringify(command)}`
        }
      ],
      max_tokens: 1000,
      temperature: 0.1
    };
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://ray-extension.com',
          'X-Title': 'Ray Chrome Extension'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API key');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else if (response.status >= 500) {
          throw new Error('OpenRouter server error. Please try again later.');
        } else {
          throw new Error(`API request failed with status ${response.status}`);
        }
      }
      
      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from OpenRouter');
      }
      
      return {
        success: true,
        actions: JSON.parse(data.choices[0].message.content),
        usage: data.usage
      };
      
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw error;
    }
  },
  
  // Validate API key format
  validateApiKey: (apiKey) => {
    if (!apiKey || typeof apiKey !== 'string') {
      return { valid: false, error: 'API key is required and must be a string' };
    }
    
    if (apiKey.length < 20) {
      return { valid: false, error: 'API key appears to be too short' };
    }
    
    if (!apiKey.startsWith('sk-or-')) {
      return { valid: false, error: 'API key must start with "sk-or-"' };
    }
    
    return { valid: true };
  },
  
  // Test API connection
  testConnection: async (apiKey) => {
    const validation = mockOpenRouterClient.validateApiKey(apiKey);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API key');
        } else {
          throw new Error(`Connection test failed with status ${response.status}`);
        }
      }
      
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw error;
    }
  }
};

describe('OpenRouter Client', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('validateApiKey', () => {
    test('should validate correct API key format', () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      const result = mockOpenRouterClient.validateApiKey(apiKey);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
    
    test('should reject empty API key', () => {
      const result = mockOpenRouterClient.validateApiKey('');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key is required and must be a string');
    });
    
    test('should reject null API key', () => {
      const result = mockOpenRouterClient.validateApiKey(null);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key is required and must be a string');
    });
    
    test('should reject undefined API key', () => {
      const result = mockOpenRouterClient.validateApiKey(undefined);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key is required and must be a string');
    });
    
    test('should reject non-string API key', () => {
      const result = mockOpenRouterClient.validateApiKey(12345);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key is required and must be a string');
    });
    
    test('should reject API key that is too short', () => {
      const apiKey = 'sk-or-short';
      const result = mockOpenRouterClient.validateApiKey(apiKey);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key appears to be too short');
    });
    
    test('should reject API key with wrong prefix', () => {
      const apiKey = 'sk-wrong-prefix-key-12345';
      const result = mockOpenRouterClient.validateApiKey(apiKey);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key must start with "sk-or-"');
    });
  });
  
  describe('testConnection', () => {
    test('should test connection successfully', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      const mockResponse = { ok: true, status: 200 };
      
      global.fetch.mockResolvedValue(mockResponse);
      
      const result = await mockOpenRouterClient.testConnection(apiKey);
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Connection successful');
      expect(fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/models',
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
    });
    
    test('should handle invalid API key during connection test', async () => {
      const apiKey = 'sk-or-v1-invalid-key';
      const mockResponse = { ok: false, status: 401 };
      
      global.fetch.mockResolvedValue(mockResponse);
      
      await expect(mockOpenRouterClient.testConnection(apiKey)).rejects.toThrow('Invalid API key');
    });
    
    test('should handle network errors during connection test', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      
      global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
      
      await expect(mockOpenRouterClient.testConnection(apiKey)).rejects.toThrow('Network error. Please check your internet connection.');
    });
    
    test('should handle other HTTP errors during connection test', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      const mockResponse = { ok: false, status: 500 };
      
      global.fetch.mockResolvedValue(mockResponse);
      
      await expect(mockOpenRouterClient.testConnection(apiKey)).rejects.toThrow('Connection test failed with status 500');
    });
    
    test('should validate API key before testing connection', async () => {
      const apiKey = 'invalid-key';
      
      await expect(mockOpenRouterClient.testConnection(apiKey)).rejects.toThrow('API key must start with "sk-or-"');
      expect(fetch).not.toHaveBeenCalled();
    });
  });
  
  describe('makeRequest', () => {
    test('should make successful API request', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      const command = { type: 'navigate', url: 'https://example.com' };
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify([{ type: 'navigate', url: 'https://example.com' }])
            }
          }],
          usage: { total_tokens: 100 }
        })
      };
      
      global.fetch.mockResolvedValue(mockResponse);
      
      const result = await mockOpenRouterClient.makeRequest(apiKey, command);
      
      expect(result.success).toBe(true);
      expect(result.actions).toEqual([{ type: 'navigate', url: 'https://example.com' }]);
      expect(result.usage).toEqual({ total_tokens: 100 });
      
      expect(fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://ray-extension.com',
            'X-Title': 'Ray Chrome Extension'
          },
          body: expect.stringContaining('"model":"anthropic/claude-3-haiku"')
        }
      );
    });
    
    test('should handle custom model parameter', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      const command = { type: 'navigate', url: 'https://example.com' };
      const customModel = 'anthropic/claude-3-opus';
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify([{ type: 'navigate', url: 'https://example.com' }])
            }
          }],
          usage: { total_tokens: 100 }
        })
      };
      
      global.fetch.mockResolvedValue(mockResponse);
      
      await mockOpenRouterClient.makeRequest(apiKey, command, customModel);
      
      expect(fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          body: expect.stringContaining(`"model":"${customModel}"`)
        })
      );
    });
    
    test('should reject invalid API key', async () => {
      const command = { type: 'navigate', url: 'https://example.com' };
      
      await expect(mockOpenRouterClient.makeRequest(null, command)).rejects.toThrow('API key is required and must be a string');
      await expect(mockOpenRouterClient.makeRequest('', command)).rejects.toThrow('API key is required and must be a string');
      await expect(mockOpenRouterClient.makeRequest(123, command)).rejects.toThrow('API key is required and must be a string');
    });
    
    test('should reject invalid command', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      
      await expect(mockOpenRouterClient.makeRequest(apiKey, null)).rejects.toThrow('Command is required and must be an object');
      await expect(mockOpenRouterClient.makeRequest(apiKey, undefined)).rejects.toThrow('Command is required and must be an object');
      await expect(mockOpenRouterClient.makeRequest(apiKey, 'invalid')).rejects.toThrow('Command is required and must be an object');
    });
    
    test('should handle 401 unauthorized error', async () => {
      const apiKey = 'sk-or-v1-invalid-key';
      const command = { type: 'navigate', url: 'https://example.com' };
      const mockResponse = { ok: false, status: 401 };
      
      global.fetch.mockResolvedValue(mockResponse);
      
      await expect(mockOpenRouterClient.makeRequest(apiKey, command)).rejects.toThrow('Invalid API key');
    });
    
    test('should handle 429 rate limit error', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      const command = { type: 'navigate', url: 'https://example.com' };
      const mockResponse = { ok: false, status: 429 };
      
      global.fetch.mockResolvedValue(mockResponse);
      
      await expect(mockOpenRouterClient.makeRequest(apiKey, command)).rejects.toThrow('Rate limit exceeded. Please try again later.');
    });
    
    test('should handle 500 server error', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      const command = { type: 'navigate', url: 'https://example.com' };
      const mockResponse = { ok: false, status: 500 };
      
      global.fetch.mockResolvedValue(mockResponse);
      
      await expect(mockOpenRouterClient.makeRequest(apiKey, command)).rejects.toThrow('OpenRouter server error. Please try again later.');
    });
    
    test('should handle other HTTP errors', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      const command = { type: 'navigate', url: 'https://example.com' };
      const mockResponse = { ok: false, status: 400 };
      
      global.fetch.mockResolvedValue(mockResponse);
      
      await expect(mockOpenRouterClient.makeRequest(apiKey, command)).rejects.toThrow('API request failed with status 400');
    });
    
    test('should handle network errors', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      const command = { type: 'navigate', url: 'https://example.com' };
      
      global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
      
      await expect(mockOpenRouterClient.makeRequest(apiKey, command)).rejects.toThrow('Network error. Please check your internet connection.');
    });
    
    test('should handle invalid response format', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      const command = { type: 'navigate', url: 'https://example.com' };
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ invalid: 'response' })
      };
      
      global.fetch.mockResolvedValue(mockResponse);
      
      await expect(mockOpenRouterClient.makeRequest(apiKey, command)).rejects.toThrow('Invalid response format from OpenRouter');
    });
    
    test('should handle JSON parsing errors in response', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      const command = { type: 'navigate', url: 'https://example.com' };
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'invalid json content'
            }
          }]
        })
      };
      
      global.fetch.mockResolvedValue(mockResponse);
      
      await expect(mockOpenRouterClient.makeRequest(apiKey, command)).rejects.toThrow();
    });
  });
  
  describe('Integration scenarios', () => {
    test('should complete full API workflow', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      const command = { type: 'navigate', url: 'https://example.com' };
      
      // Mock successful validation
      const validation = mockOpenRouterClient.validateApiKey(apiKey);
      expect(validation.valid).toBe(true);
      
      // Mock successful connection test
      const mockConnectionResponse = { ok: true, status: 200 };
      global.fetch.mockResolvedValue(mockConnectionResponse);
      const connectionResult = await mockOpenRouterClient.testConnection(apiKey);
      expect(connectionResult.success).toBe(true);
      
      // Mock successful API request
      const mockRequestResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify([{ type: 'navigate', url: 'https://example.com' }])
            }
          }],
          usage: { total_tokens: 100 }
        })
      };
      global.fetch.mockResolvedValue(mockRequestResponse);
      
      const requestResult = await mockOpenRouterClient.makeRequest(apiKey, command);
      
      expect(requestResult.success).toBe(true);
      expect(requestResult.actions).toEqual([{ type: 'navigate', url: 'https://example.com' }]);
      expect(requestResult.usage).toEqual({ total_tokens: 100 });
    });
    
    test('should handle complex multi-step command', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      const command = {
        type: 'multi-step',
        steps: [
          { type: 'navigate', url: 'https://google.com' },
          { type: 'search', query: 'Chrome extensions' },
          { type: 'click', element: 'first result' }
        ]
      };
      
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify([
                { type: 'navigate', url: 'https://google.com' },
                { type: 'search', query: 'Chrome extensions' },
                { type: 'click', element: 'first result' }
              ])
            }
          }],
          usage: { total_tokens: 150 }
        })
      };
      
      global.fetch.mockResolvedValue(mockResponse);
      
      const result = await mockOpenRouterClient.makeRequest(apiKey, command);
      
      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(3);
      expect(result.actions[0]).toEqual({ type: 'navigate', url: 'https://google.com' });
      expect(result.actions[1]).toEqual({ type: 'search', query: 'Chrome extensions' });
      expect(result.actions[2]).toEqual({ type: 'click', element: 'first result' });
    });
  });
}); * OpenRouter Client Unit Tests
 * Tests for OpenRouter API communication and error handling
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { createMockFetch, generateTestCommand, setupTest, teardownTest, expectError } = require('../utils/test-helpers');

// Mock OpenRouter client module (this would be imported from the actual source)
const mockOpenRouterClient = {
  // Make API request to OpenRouter
  makeRequest: async (apiKey, command, model = 'anthropic/claude-3-haiku') => {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('API key is required and must be a string');
    }
    
    if (!command || typeof command !== 'object') {
      throw new Error('Command is required and must be an object');
    }
    
    const requestBody = {
      model: model,
      messages: [
        {
          role: 'user',
          content: `Parse this browser automation command and provide structured actions: ${JSON.stringify(command)}`
        }
      ],
      max_tokens: 1000,
      temperature: 0.1
    };
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://ray-extension.com',
          'X-Title': 'Ray Chrome Extension'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API key');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else if (response.status >= 500) {
          throw new Error('OpenRouter server error. Please try again later.');
        } else {
          throw new Error(`API request failed with status ${response.status}`);
        }
      }
      
      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from OpenRouter');
      }
      
      return {
        success: true,
        actions: JSON.parse(data.choices[0].message.content),
        usage: data.usage
      };
      
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw error;
    }
  },
  
  // Validate API key format
  validateApiKey: (apiKey) => {
    if (!apiKey || typeof apiKey !== 'string') {
      return { valid: false, error: 'API key is required and must be a string' };
    }
    
    if (apiKey.length < 20) {
      return { valid: false, error: 'API key appears to be too short' };
    }
    
    if (!apiKey.startsWith('sk-or-')) {
      return { valid: false, error: 'API key must start with "sk-or-"' };
    }
    
    return { valid: true };
  },
  
  // Test API connection
  testConnection: async (apiKey) => {
    const validation = mockOpenRouterClient.validateApiKey(apiKey);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API key');
        } else {
          throw new Error(`Connection test failed with status ${response.status}`);
        }
      }
      
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw error;
    }
  }
};

describe('OpenRouter Client', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('validateApiKey', () => {
    test('should validate correct API key format', () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      const result = mockOpenRouterClient.validateApiKey(apiKey);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
    
    test('should reject empty API key', () => {
      const result = mockOpenRouterClient.validateApiKey('');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key is required and must be a string');
    });
    
    test('should reject null API key', () => {
      const result = mockOpenRouterClient.validateApiKey(null);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key is required and must be a string');
    });
    
    test('should reject undefined API key', () => {
      const result = mockOpenRouterClient.validateApiKey(undefined);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key is required and must be a string');
    });
    
    test('should reject non-string API key', () => {
      const result = mockOpenRouterClient.validateApiKey(12345);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key is required and must be a string');
    });
    
    test('should reject API key that is too short', () => {
      const apiKey = 'sk-or-short';
      const result = mockOpenRouterClient.validateApiKey(apiKey);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key appears to be too short');
    });
    
    test('should reject API key with wrong prefix', () => {
      const apiKey = 'sk-wrong-prefix-key-12345';
      const result = mockOpenRouterClient.validateApiKey(apiKey);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key must start with "sk-or-"');
    });
  });
  
  describe('testConnection', () => {
    test('should test connection successfully', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      const mockResponse = { ok: true, status: 200 };
      
      global.fetch.mockResolvedValue(mockResponse);
      
      const result = await mockOpenRouterClient.testConnection(apiKey);
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Connection successful');
      expect(fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/models',
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
    });
    
    test('should handle invalid API key during connection test', async () => {
      const apiKey = 'sk-or-v1-invalid-key';
      const mockResponse = { ok: false, status: 401 };
      
      global.fetch.mockResolvedValue(mockResponse);
      
      await expect(mockOpenRouterClient.testConnection(apiKey)).rejects.toThrow('Invalid API key');
    });
    
    test('should handle network errors during connection test', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      
      global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
      
      await expect(mockOpenRouterClient.testConnection(apiKey)).rejects.toThrow('Network error. Please check your internet connection.');
    });
    
    test('should handle other HTTP errors during connection test', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      const mockResponse = { ok: false, status: 500 };
      
      global.fetch.mockResolvedValue(mockResponse);
      
      await expect(mockOpenRouterClient.testConnection(apiKey)).rejects.toThrow('Connection test failed with status 500');
    });
    
    test('should validate API key before testing connection', async () => {
      const apiKey = 'invalid-key';
      
      await expect(mockOpenRouterClient.testConnection(apiKey)).rejects.toThrow('API key must start with "sk-or-"');
      expect(fetch).not.toHaveBeenCalled();
    });
  });
  
  describe('makeRequest', () => {
    test('should make successful API request', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      const command = { type: 'navigate', url: 'https://example.com' };
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify([{ type: 'navigate', url: 'https://example.com' }])
            }
          }],
          usage: { total_tokens: 100 }
        })
      };
      
      global.fetch.mockResolvedValue(mockResponse);
      
      const result = await mockOpenRouterClient.makeRequest(apiKey, command);
      
      expect(result.success).toBe(true);
      expect(result.actions).toEqual([{ type: 'navigate', url: 'https://example.com' }]);
      expect(result.usage).toEqual({ total_tokens: 100 });
      
      expect(fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://ray-extension.com',
            'X-Title': 'Ray Chrome Extension'
          },
          body: expect.stringContaining('"model":"anthropic/claude-3-haiku"')
        }
      );
    });
    
    test('should handle custom model parameter', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      const command = { type: 'navigate', url: 'https://example.com' };
      const customModel = 'anthropic/claude-3-opus';
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify([{ type: 'navigate', url: 'https://example.com' }])
            }
          }],
          usage: { total_tokens: 100 }
        })
      };
      
      global.fetch.mockResolvedValue(mockResponse);
      
      await mockOpenRouterClient.makeRequest(apiKey, command, customModel);
      
      expect(fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          body: expect.stringContaining(`"model":"${customModel}"`)
        })
      );
    });
    
    test('should reject invalid API key', async () => {
      const command = { type: 'navigate', url: 'https://example.com' };
      
      await expect(mockOpenRouterClient.makeRequest(null, command)).rejects.toThrow('API key is required and must be a string');
      await expect(mockOpenRouterClient.makeRequest('', command)).rejects.toThrow('API key is required and must be a string');
      await expect(mockOpenRouterClient.makeRequest(123, command)).rejects.toThrow('API key is required and must be a string');
    });
    
    test('should reject invalid command', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      
      await expect(mockOpenRouterClient.makeRequest(apiKey, null)).rejects.toThrow('Command is required and must be an object');
      await expect(mockOpenRouterClient.makeRequest(apiKey, undefined)).rejects.toThrow('Command is required and must be an object');
      await expect(mockOpenRouterClient.makeRequest(apiKey, 'invalid')).rejects.toThrow('Command is required and must be an object');
    });
    
    test('should handle 401 unauthorized error', async () => {
      const apiKey = 'sk-or-v1-invalid-key';
      const command = { type: 'navigate', url: 'https://example.com' };
      const mockResponse = { ok: false, status: 401 };
      
      global.fetch.mockResolvedValue(mockResponse);
      
      await expect(mockOpenRouterClient.makeRequest(apiKey, command)).rejects.toThrow('Invalid API key');
    });
    
    test('should handle 429 rate limit error', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      const command = { type: 'navigate', url: 'https://example.com' };
      const mockResponse = { ok: false, status: 429 };
      
      global.fetch.mockResolvedValue(mockResponse);
      
      await expect(mockOpenRouterClient.makeRequest(apiKey, command)).rejects.toThrow('Rate limit exceeded. Please try again later.');
    });
    
    test('should handle 500 server error', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      const command = { type: 'navigate', url: 'https://example.com' };
      const mockResponse = { ok: false, status: 500 };
      
      global.fetch.mockResolvedValue(mockResponse);
      
      await expect(mockOpenRouterClient.makeRequest(apiKey, command)).rejects.toThrow('OpenRouter server error. Please try again later.');
    });
    
    test('should handle other HTTP errors', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      const command = { type: 'navigate', url: 'https://example.com' };
      const mockResponse = { ok: false, status: 400 };
      
      global.fetch.mockResolvedValue(mockResponse);
      
      await expect(mockOpenRouterClient.makeRequest(apiKey, command)).rejects.toThrow('API request failed with status 400');
    });
    
    test('should handle network errors', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      const command = { type: 'navigate', url: 'https://example.com' };
      
      global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
      
      await expect(mockOpenRouterClient.makeRequest(apiKey, command)).rejects.toThrow('Network error. Please check your internet connection.');
    });
    
    test('should handle invalid response format', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      const command = { type: 'navigate', url: 'https://example.com' };
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ invalid: 'response' })
      };
      
      global.fetch.mockResolvedValue(mockResponse);
      
      await expect(mockOpenRouterClient.makeRequest(apiKey, command)).rejects.toThrow('Invalid response format from OpenRouter');
    });
    
    test('should handle JSON parsing errors in response', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      const command = { type: 'navigate', url: 'https://example.com' };
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'invalid json content'
            }
          }]
        })
      };
      
      global.fetch.mockResolvedValue(mockResponse);
      
      await expect(mockOpenRouterClient.makeRequest(apiKey, command)).rejects.toThrow();
    });
  });
  
  describe('Integration scenarios', () => {
    test('should complete full API workflow', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      const command = { type: 'navigate', url: 'https://example.com' };
      
      // Mock successful validation
      const validation = mockOpenRouterClient.validateApiKey(apiKey);
      expect(validation.valid).toBe(true);
      
      // Mock successful connection test
      const mockConnectionResponse = { ok: true, status: 200 };
      global.fetch.mockResolvedValue(mockConnectionResponse);
      const connectionResult = await mockOpenRouterClient.testConnection(apiKey);
      expect(connectionResult.success).toBe(true);
      
      // Mock successful API request
      const mockRequestResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify([{ type: 'navigate', url: 'https://example.com' }])
            }
          }],
          usage: { total_tokens: 100 }
        })
      };
      global.fetch.mockResolvedValue(mockRequestResponse);
      
      const requestResult = await mockOpenRouterClient.makeRequest(apiKey, command);
      
      expect(requestResult.success).toBe(true);
      expect(requestResult.actions).toEqual([{ type: 'navigate', url: 'https://example.com' }]);
      expect(requestResult.usage).toEqual({ total_tokens: 100 });
    });
    
    test('should handle complex multi-step command', async () => {
      const apiKey = 'sk-or-v1-valid-key-12345';
      const command = {
        type: 'multi-step',
        steps: [
          { type: 'navigate', url: 'https://google.com' },
          { type: 'search', query: 'Chrome extensions' },
          { type: 'click', element: 'first result' }
        ]
      };
      
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify([
                { type: 'navigate', url: 'https://google.com' },
                { type: 'search', query: 'Chrome extensions' },
                { type: 'click', element: 'first result' }
              ])
            }
          }],
          usage: { total_tokens: 150 }
        })
      };
      
      global.fetch.mockResolvedValue(mockResponse);
      
      const result = await mockOpenRouterClient.makeRequest(apiKey, command);
      
      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(3);
      expect(result.actions[0]).toEqual({ type: 'navigate', url: 'https://google.com' });
      expect(result.actions[1]).toEqual({ type: 'search', query: 'Chrome extensions' });
      expect(result.actions[2]).toEqual({ type: 'click', element: 'first result' });
    });
  });
});
