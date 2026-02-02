/**
 * OpenRouter API Integration Tests
 * Tests for integration between extension components and OpenRouter API
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { createMockFetch, setupTest, teardownTest, createMockTab } = require('../utils/test-helpers');

// Mock integration modules (these would be imported from actual source)
const mockStorageModule = {
  getApiKey: async () => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get('openrouter-api-key', (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result['openrouter-api-key'] || null);
        }
      });
    });
  }
};

const mockCommandParser = {
  parseCommand: (command) => {
    if (command.includes('go to') || command.includes('navigate to')) {
      const urlMatch = command.match(/(?:go to|navigate to)\s+(.+?)(?:\s|$)/i);
      return {
        type: 'navigate',
        url: urlMatch ? urlMatch[1] : 'example.com',
        originalCommand: command
      };
    }
    return {
      type: 'unknown',
      command: command,
      originalCommand: command
    };
  }
};

const mockOpenRouterClient = {
  makeRequest: async (apiKey, command) => {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-haiku',
        messages: [
          {
            role: 'user',
            content: `Parse this browser automation command: ${JSON.stringify(command)}`
          }
        ]
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      success: true,
      actions: JSON.parse(data.choices[0].message.content),
      usage: data.usage
    };
  }
};

const mockBackgroundScript = {
  processCommand: async (command) => {
    try {
      // Get API key
      const apiKey = await mockStorageModule.getApiKey();
      if (!apiKey) {
        throw new Error('API key not found');
      }
      
      // Parse command
      const parsedCommand = mockCommandParser.parseCommand(command);
      
      // Send to OpenRouter
      const response = await mockOpenRouterClient.makeRequest(apiKey, parsedCommand);
      
      return {
        success: true,
        actions: response.actions,
        usage: response.usage
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};

describe('OpenRouter API Integration', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('API Key Integration', () => {
    test('should retrieve API key from storage and use it for requests', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      const command = 'Go to google.com';
      
      // Mock storage to return API key
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      // Mock successful API response
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify([{ type: 'navigate', url: 'https://google.com' }])
            }
          }],
          usage: { total_tokens: 100 }
        })
      };
      global.fetch.mockResolvedValue(mockResponse);
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(true);
      expect(result.actions).toEqual([{ type: 'navigate', url: 'https://google.com' }]);
      expect(chrome.storage.local.get).toHaveBeenCalledWith('openrouter-api-key', expect.any(Function));
      expect(fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          headers: {
            'Authorization': `Bearer ${testApiKey}`,
            'Content-Type': 'application/json'
          }
        })
      );
    });
    
    test('should handle missing API key', async () => {
      const command = 'Go to google.com';
      
      // Mock storage to return no API key
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('API key not found');
      expect(fetch).not.toHaveBeenCalled();
    });
    
    test('should handle storage errors when getting API key', async () => {
      const command = 'Go to google.com';
      const storageError = new Error('Storage access denied');
      
      // Mock storage error
      chrome.runtime.lastError = storageError;
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage access denied');
      expect(fetch).not.toHaveBeenCalled();
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('Command Processing Integration', () => {
    test('should process navigation command end-to-end', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      const command = 'Go to https://example.com';
      
      // Mock storage
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      // Mock API response
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify([{ type: 'navigate', url: 'https://example.com' }])
            }
          }],
          usage: { total_tokens: 150 }
        })
      };
      global.fetch.mockResolvedValue(mockResponse);
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(true);
      expect(result.actions).toEqual([{ type: 'navigate', url: 'https://example.com' }]);
      expect(result.usage).toEqual({ total_tokens: 150 });
    });
    
    test('should process multi-step command end-to-end', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      const command = 'Go to google.com, search for Chrome extensions';
      
      // Mock storage
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      // Mock API response
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify([
                { type: 'navigate', url: 'https://google.com' },
                { type: 'search', query: 'Chrome extensions' }
              ])
            }
          }],
          usage: { total_tokens: 200 }
        })
      };
      global.fetch.mockResolvedValue(mockResponse);
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(true);
      expect(result.actions).toEqual([
        { type: 'navigate', url: 'https://google.com' },
        { type: 'search', query: 'Chrome extensions' }
      ]);
      expect(result.usage).toEqual({ total_tokens: 200 });
    });
  });
  
  describe('API Error Handling Integration', () => {
    test('should handle API authentication errors', async () => {
      const testApiKey = 'sk-or-v1-invalid-key';
      const command = 'Go to google.com';
      
      // Mock storage
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      // Mock API error response
      const mockResponse = {
        ok: false,
        status: 401
      };
      global.fetch.mockResolvedValue(mockResponse);
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('API request failed: 401');
    });
    
    test('should handle API rate limit errors', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      const command = 'Go to google.com';
      
      // Mock storage
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      // Mock API rate limit response
      const mockResponse = {
        ok: false,
        status: 429
      };
      global.fetch.mockResolvedValue(mockResponse);
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('API request failed: 429');
    });
    
    test('should handle API server errors', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      const command = 'Go to google.com';
      
      // Mock storage
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      // Mock API server error response
      const mockResponse = {
        ok: false,
        status: 500
      };
      global.fetch.mockResolvedValue(mockResponse);
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('API request failed: 500');
    });
    
    test('should handle network connectivity issues', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      const command = 'Go to google.com';
      
      // Mock storage
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      // Mock network error
      global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to fetch');
    });
  });
  
  describe('API Response Format Integration', () => {
    test('should handle valid API response format', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      const command = 'Go to google.com';
      
      // Mock storage
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      // Mock valid API response
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify([{ type: 'navigate', url: 'https://google.com' }])
            }
          }],
          usage: { total_tokens: 100, prompt_tokens: 50, completion_tokens: 50 }
        })
      };
      global.fetch.mockResolvedValue(mockResponse);
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(true);
      expect(result.actions).toEqual([{ type: 'navigate', url: 'https://google.com' }]);
      expect(result.usage).toEqual({
        total_tokens: 100,
        prompt_tokens: 50,
        completion_tokens: 50
      });
    });
    
    test('should handle malformed API response', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      const command = 'Go to google.com';
      
      // Mock storage
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      // Mock malformed API response
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          invalid: 'response format'
        })
      };
      global.fetch.mockResolvedValue(mockResponse);
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined(); // Should have some error about malformed response
    });
    
    test('should handle JSON parsing errors in API response', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      const command = 'Go to google.com';
      
      // Mock storage
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      // Mock API response with invalid JSON
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
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined(); // Should have JSON parsing error
    });
  });
  
  describe('Integration Scenarios', () => {
    test('should complete full workflow with valid API key and command', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      const command = 'Navigate to https://github.com';
      
      // Mock storage
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      // Mock successful API response
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify([{ type: 'navigate', url: 'https://github.com' }])
            }
          }],
          usage: { total_tokens: 120 }
        })
      };
      global.fetch.mockResolvedValue(mockResponse);
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(true);
      expect(result.actions).toEqual([{ type: 'navigate', url: 'https://github.com' }]);
      expect(result.usage).toEqual({ total_tokens: 120 });
    });
    
    test('should handle complex multi-step workflow', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      const command = 'Go to nytimes.com, find first article title, copy it';
      
      // Mock storage
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      // Mock complex API response
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify([
                { type: 'navigate', url: 'https://nytimes.com' },
                { type: 'waitForElement', element: 'article h1' },
                { type: 'getText', element: 'article h1' },
                { type: 'copy', text: 'extracted title' }
              ])
            }
          }],
          usage: { total_tokens: 250 }
        })
      };
      global.fetch.mockResolvedValue(mockResponse);
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(true);
      expect(result.actions).toEqual([
        { type: 'navigate', url: 'https://nytimes.com' },
        { type: 'waitForElement', element: 'article h1' },
        { type: 'getText', element: 'article h1' },
        { type: 'copy', text: 'extracted title' }
      ]);
      expect(result.usage).toEqual({ total_tokens: 250 });
    });
  });
}); * OpenRouter API Integration Tests
 * Tests for integration between extension components and OpenRouter API
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { createMockFetch, setupTest, teardownTest, createMockTab } = require('../utils/test-helpers');

// Mock integration modules (these would be imported from actual source)
const mockStorageModule = {
  getApiKey: async () => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get('openrouter-api-key', (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result['openrouter-api-key'] || null);
        }
      });
    });
  }
};

const mockCommandParser = {
  parseCommand: (command) => {
    if (command.includes('go to') || command.includes('navigate to')) {
      const urlMatch = command.match(/(?:go to|navigate to)\s+(.+?)(?:\s|$)/i);
      return {
        type: 'navigate',
        url: urlMatch ? urlMatch[1] : 'example.com',
        originalCommand: command
      };
    }
    return {
      type: 'unknown',
      command: command,
      originalCommand: command
    };
  }
};

const mockOpenRouterClient = {
  makeRequest: async (apiKey, command) => {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-haiku',
        messages: [
          {
            role: 'user',
            content: `Parse this browser automation command: ${JSON.stringify(command)}`
          }
        ]
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      success: true,
      actions: JSON.parse(data.choices[0].message.content),
      usage: data.usage
    };
  }
};

const mockBackgroundScript = {
  processCommand: async (command) => {
    try {
      // Get API key
      const apiKey = await mockStorageModule.getApiKey();
      if (!apiKey) {
        throw new Error('API key not found');
      }
      
      // Parse command
      const parsedCommand = mockCommandParser.parseCommand(command);
      
      // Send to OpenRouter
      const response = await mockOpenRouterClient.makeRequest(apiKey, parsedCommand);
      
      return {
        success: true,
        actions: response.actions,
        usage: response.usage
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};

describe('OpenRouter API Integration', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('API Key Integration', () => {
    test('should retrieve API key from storage and use it for requests', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      const command = 'Go to google.com';
      
      // Mock storage to return API key
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      // Mock successful API response
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify([{ type: 'navigate', url: 'https://google.com' }])
            }
          }],
          usage: { total_tokens: 100 }
        })
      };
      global.fetch.mockResolvedValue(mockResponse);
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(true);
      expect(result.actions).toEqual([{ type: 'navigate', url: 'https://google.com' }]);
      expect(chrome.storage.local.get).toHaveBeenCalledWith('openrouter-api-key', expect.any(Function));
      expect(fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          headers: {
            'Authorization': `Bearer ${testApiKey}`,
            'Content-Type': 'application/json'
          }
        })
      );
    });
    
    test('should handle missing API key', async () => {
      const command = 'Go to google.com';
      
      // Mock storage to return no API key
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('API key not found');
      expect(fetch).not.toHaveBeenCalled();
    });
    
    test('should handle storage errors when getting API key', async () => {
      const command = 'Go to google.com';
      const storageError = new Error('Storage access denied');
      
      // Mock storage error
      chrome.runtime.lastError = storageError;
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage access denied');
      expect(fetch).not.toHaveBeenCalled();
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('Command Processing Integration', () => {
    test('should process navigation command end-to-end', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      const command = 'Go to https://example.com';
      
      // Mock storage
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      // Mock API response
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify([{ type: 'navigate', url: 'https://example.com' }])
            }
          }],
          usage: { total_tokens: 150 }
        })
      };
      global.fetch.mockResolvedValue(mockResponse);
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(true);
      expect(result.actions).toEqual([{ type: 'navigate', url: 'https://example.com' }]);
      expect(result.usage).toEqual({ total_tokens: 150 });
    });
    
    test('should process multi-step command end-to-end', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      const command = 'Go to google.com, search for Chrome extensions';
      
      // Mock storage
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      // Mock API response
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify([
                { type: 'navigate', url: 'https://google.com' },
                { type: 'search', query: 'Chrome extensions' }
              ])
            }
          }],
          usage: { total_tokens: 200 }
        })
      };
      global.fetch.mockResolvedValue(mockResponse);
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(true);
      expect(result.actions).toEqual([
        { type: 'navigate', url: 'https://google.com' },
        { type: 'search', query: 'Chrome extensions' }
      ]);
      expect(result.usage).toEqual({ total_tokens: 200 });
    });
  });
  
  describe('API Error Handling Integration', () => {
    test('should handle API authentication errors', async () => {
      const testApiKey = 'sk-or-v1-invalid-key';
      const command = 'Go to google.com';
      
      // Mock storage
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      // Mock API error response
      const mockResponse = {
        ok: false,
        status: 401
      };
      global.fetch.mockResolvedValue(mockResponse);
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('API request failed: 401');
    });
    
    test('should handle API rate limit errors', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      const command = 'Go to google.com';
      
      // Mock storage
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      // Mock API rate limit response
      const mockResponse = {
        ok: false,
        status: 429
      };
      global.fetch.mockResolvedValue(mockResponse);
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('API request failed: 429');
    });
    
    test('should handle API server errors', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      const command = 'Go to google.com';
      
      // Mock storage
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      // Mock API server error response
      const mockResponse = {
        ok: false,
        status: 500
      };
      global.fetch.mockResolvedValue(mockResponse);
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('API request failed: 500');
    });
    
    test('should handle network connectivity issues', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      const command = 'Go to google.com';
      
      // Mock storage
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      // Mock network error
      global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to fetch');
    });
  });
  
  describe('API Response Format Integration', () => {
    test('should handle valid API response format', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      const command = 'Go to google.com';
      
      // Mock storage
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      // Mock valid API response
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify([{ type: 'navigate', url: 'https://google.com' }])
            }
          }],
          usage: { total_tokens: 100, prompt_tokens: 50, completion_tokens: 50 }
        })
      };
      global.fetch.mockResolvedValue(mockResponse);
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(true);
      expect(result.actions).toEqual([{ type: 'navigate', url: 'https://google.com' }]);
      expect(result.usage).toEqual({
        total_tokens: 100,
        prompt_tokens: 50,
        completion_tokens: 50
      });
    });
    
    test('should handle malformed API response', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      const command = 'Go to google.com';
      
      // Mock storage
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      // Mock malformed API response
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          invalid: 'response format'
        })
      };
      global.fetch.mockResolvedValue(mockResponse);
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined(); // Should have some error about malformed response
    });
    
    test('should handle JSON parsing errors in API response', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      const command = 'Go to google.com';
      
      // Mock storage
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      // Mock API response with invalid JSON
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
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined(); // Should have JSON parsing error
    });
  });
  
  describe('Integration Scenarios', () => {
    test('should complete full workflow with valid API key and command', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      const command = 'Navigate to https://github.com';
      
      // Mock storage
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      // Mock successful API response
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify([{ type: 'navigate', url: 'https://github.com' }])
            }
          }],
          usage: { total_tokens: 120 }
        })
      };
      global.fetch.mockResolvedValue(mockResponse);
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(true);
      expect(result.actions).toEqual([{ type: 'navigate', url: 'https://github.com' }]);
      expect(result.usage).toEqual({ total_tokens: 120 });
    });
    
    test('should handle complex multi-step workflow', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      const command = 'Go to nytimes.com, find first article title, copy it';
      
      // Mock storage
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      // Mock complex API response
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify([
                { type: 'navigate', url: 'https://nytimes.com' },
                { type: 'waitForElement', element: 'article h1' },
                { type: 'getText', element: 'article h1' },
                { type: 'copy', text: 'extracted title' }
              ])
            }
          }],
          usage: { total_tokens: 250 }
        })
      };
      global.fetch.mockResolvedValue(mockResponse);
      
      const result = await mockBackgroundScript.processCommand(command);
      
      expect(result.success).toBe(true);
      expect(result.actions).toEqual([
        { type: 'navigate', url: 'https://nytimes.com' },
        { type: 'waitForElement', element: 'article h1' },
        { type: 'getText', element: 'article h1' },
        { type: 'copy', text: 'extracted title' }
      ]);
      expect(result.usage).toEqual({ total_tokens: 250 });
    });
  });
});
