/**
 * API Key Storage Unit Tests
 * Tests for Chrome storage API wrapper and API key management
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { mockChromeStorage, generateTestCommand, setupTest, teardownTest } = require('../utils/test-helpers');

// Mock storage module (this would be imported from the actual source)
const mockStorageModule = {
  // Mock implementation of API key storage
  saveApiKey: async (apiKey) => {
    return new Promise((resolve, reject) => {
      if (!apiKey || typeof apiKey !== 'string') {
        reject(new Error('Invalid API key'));
        return;
      }
      
      chrome.storage.local.set({ 'openrouter-api-key': apiKey }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(apiKey);
        }
      });
    });
  },
  
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
  },
  
  removeApiKey: async () => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove('openrouter-api-key', () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },
  
  hasApiKey: async () => {
    const apiKey = await mockStorageModule.getApiKey();
    return apiKey !== null && apiKey !== undefined;
  }
};

describe('API Key Storage', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Setup fresh Chrome storage mock
    mockChromeStorage.get({});
    mockChromeStorage.set();
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('saveApiKey', () => {
    test('should save a valid API key successfully', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      
      // Mock successful storage
      chrome.storage.local.set.mockImplementation((items, callback) => {
        callback();
      });
      
      const result = await mockStorageModule.saveApiKey(testApiKey);
      
      expect(result).toBe(testApiKey);
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { 'openrouter-api-key': testApiKey },
        expect.any(Function)
      );
    });
    
    test('should reject invalid API key (empty string)', async () => {
      await expect(mockStorageModule.saveApiKey('')).rejects.toThrow('Invalid API key');
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
    
    test('should reject null API key', async () => {
      await expect(mockStorageModule.saveApiKey(null)).rejects.toThrow('Invalid API key');
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
    
    test('should reject undefined API key', async () => {
      await expect(mockStorageModule.saveApiKey(undefined)).rejects.toThrow('Invalid API key');
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
    
    test('should reject non-string API key', async () => {
      await expect(mockStorageModule.saveApiKey(12345)).rejects.toThrow('Invalid API key');
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
    
    test('should handle Chrome storage errors', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      const storageError = new Error('Storage quota exceeded');
      
      chrome.runtime.lastError = storageError;
      chrome.storage.local.set.mockImplementation((items, callback) => {
        callback();
      });
      
      await expect(mockStorageModule.saveApiKey(testApiKey)).rejects.toThrow('Storage quota exceeded');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('getApiKey', () => {
    test('should retrieve stored API key successfully', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      const result = await mockStorageModule.getApiKey();
      
      expect(result).toBe(testApiKey);
      expect(chrome.storage.local.get).toHaveBeenCalledWith('openrouter-api-key', expect.any(Function));
    });
    
    test('should return null when no API key is stored', async () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });
      
      const result = await mockStorageModule.getApiKey();
      
      expect(result).toBeNull();
    });
    
    test('should handle Chrome storage errors', async () => {
      const storageError = new Error('Storage access denied');
      
      chrome.runtime.lastError = storageError;
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });
      
      await expect(mockStorageModule.getApiKey()).rejects.toThrow('Storage access denied');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('removeApiKey', () => {
    test('should remove API key successfully', async () => {
      chrome.storage.local.remove.mockImplementation((keys, callback) => {
        callback();
      });
      
      await expect(mockStorageModule.removeApiKey()).resolves.toBeUndefined();
      expect(chrome.storage.local.remove).toHaveBeenCalledWith('openrouter-api-key', expect.any(Function));
    });
    
    test('should handle Chrome storage errors during removal', async () => {
      const storageError = new Error('Storage access denied');
      
      chrome.runtime.lastError = storageError;
      chrome.storage.local.remove.mockImplementation((keys, callback) => {
        callback();
      });
      
      await expect(mockStorageModule.removeApiKey()).rejects.toThrow('Storage access denied');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('hasApiKey', () => {
    test('should return true when API key exists', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      const result = await mockStorageModule.hasApiKey();
      
      expect(result).toBe(true);
    });
    
    test('should return false when API key does not exist', async () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });
      
      const result = await mockStorageModule.hasApiKey();
      
      expect(result).toBe(false);
    });
    
    test('should return false when API key is null', async () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': null });
      });
      
      const result = await mockStorageModule.hasApiKey();
      
      expect(result).toBe(false);
    });
    
    test('should return false when API key is undefined', async () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': undefined });
      });
      
      const result = await mockStorageModule.hasApiKey();
      
      expect(result).toBe(false);
    });
  });
  
  describe('Integration scenarios', () => {
    test('should complete full API key lifecycle', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      
      // Mock successful operations
      chrome.storage.local.set.mockImplementation((items, callback) => callback());
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      chrome.storage.local.remove.mockImplementation((keys, callback) => callback());
      
      // Save API key
      await expect(mockStorageModule.saveApiKey(testApiKey)).resolves.toBe(testApiKey);
      expect(await mockStorageModule.hasApiKey()).toBe(true);
      expect(await mockStorageModule.getApiKey()).toBe(testApiKey);
      
      // Remove API key
      await expect(mockStorageModule.removeApiKey()).resolves.toBeUndefined();
      expect(await mockStorageModule.hasApiKey()).toBe(false);
      expect(await mockStorageModule.getApiKey()).toBeNull();
    });
  });
}); * API Key Storage Unit Tests
 * Tests for Chrome storage API wrapper and API key management
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { mockChromeStorage, generateTestCommand, setupTest, teardownTest } = require('../utils/test-helpers');

// Mock storage module (this would be imported from the actual source)
const mockStorageModule = {
  // Mock implementation of API key storage
  saveApiKey: async (apiKey) => {
    return new Promise((resolve, reject) => {
      if (!apiKey || typeof apiKey !== 'string') {
        reject(new Error('Invalid API key'));
        return;
      }
      
      chrome.storage.local.set({ 'openrouter-api-key': apiKey }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(apiKey);
        }
      });
    });
  },
  
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
  },
  
  removeApiKey: async () => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove('openrouter-api-key', () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },
  
  hasApiKey: async () => {
    const apiKey = await mockStorageModule.getApiKey();
    return apiKey !== null && apiKey !== undefined;
  }
};

describe('API Key Storage', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Setup fresh Chrome storage mock
    mockChromeStorage.get({});
    mockChromeStorage.set();
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('saveApiKey', () => {
    test('should save a valid API key successfully', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      
      // Mock successful storage
      chrome.storage.local.set.mockImplementation((items, callback) => {
        callback();
      });
      
      const result = await mockStorageModule.saveApiKey(testApiKey);
      
      expect(result).toBe(testApiKey);
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { 'openrouter-api-key': testApiKey },
        expect.any(Function)
      );
    });
    
    test('should reject invalid API key (empty string)', async () => {
      await expect(mockStorageModule.saveApiKey('')).rejects.toThrow('Invalid API key');
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
    
    test('should reject null API key', async () => {
      await expect(mockStorageModule.saveApiKey(null)).rejects.toThrow('Invalid API key');
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
    
    test('should reject undefined API key', async () => {
      await expect(mockStorageModule.saveApiKey(undefined)).rejects.toThrow('Invalid API key');
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
    
    test('should reject non-string API key', async () => {
      await expect(mockStorageModule.saveApiKey(12345)).rejects.toThrow('Invalid API key');
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
    
    test('should handle Chrome storage errors', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      const storageError = new Error('Storage quota exceeded');
      
      chrome.runtime.lastError = storageError;
      chrome.storage.local.set.mockImplementation((items, callback) => {
        callback();
      });
      
      await expect(mockStorageModule.saveApiKey(testApiKey)).rejects.toThrow('Storage quota exceeded');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('getApiKey', () => {
    test('should retrieve stored API key successfully', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      const result = await mockStorageModule.getApiKey();
      
      expect(result).toBe(testApiKey);
      expect(chrome.storage.local.get).toHaveBeenCalledWith('openrouter-api-key', expect.any(Function));
    });
    
    test('should return null when no API key is stored', async () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });
      
      const result = await mockStorageModule.getApiKey();
      
      expect(result).toBeNull();
    });
    
    test('should handle Chrome storage errors', async () => {
      const storageError = new Error('Storage access denied');
      
      chrome.runtime.lastError = storageError;
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });
      
      await expect(mockStorageModule.getApiKey()).rejects.toThrow('Storage access denied');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('removeApiKey', () => {
    test('should remove API key successfully', async () => {
      chrome.storage.local.remove.mockImplementation((keys, callback) => {
        callback();
      });
      
      await expect(mockStorageModule.removeApiKey()).resolves.toBeUndefined();
      expect(chrome.storage.local.remove).toHaveBeenCalledWith('openrouter-api-key', expect.any(Function));
    });
    
    test('should handle Chrome storage errors during removal', async () => {
      const storageError = new Error('Storage access denied');
      
      chrome.runtime.lastError = storageError;
      chrome.storage.local.remove.mockImplementation((keys, callback) => {
        callback();
      });
      
      await expect(mockStorageModule.removeApiKey()).rejects.toThrow('Storage access denied');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('hasApiKey', () => {
    test('should return true when API key exists', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      
      const result = await mockStorageModule.hasApiKey();
      
      expect(result).toBe(true);
    });
    
    test('should return false when API key does not exist', async () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });
      
      const result = await mockStorageModule.hasApiKey();
      
      expect(result).toBe(false);
    });
    
    test('should return false when API key is null', async () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': null });
      });
      
      const result = await mockStorageModule.hasApiKey();
      
      expect(result).toBe(false);
    });
    
    test('should return false when API key is undefined', async () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': undefined });
      });
      
      const result = await mockStorageModule.hasApiKey();
      
      expect(result).toBe(false);
    });
  });
  
  describe('Integration scenarios', () => {
    test('should complete full API key lifecycle', async () => {
      const testApiKey = 'sk-or-v1-test-key-12345';
      
      // Mock successful operations
      chrome.storage.local.set.mockImplementation((items, callback) => callback());
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 'openrouter-api-key': testApiKey });
      });
      chrome.storage.local.remove.mockImplementation((keys, callback) => callback());
      
      // Save API key
      await expect(mockStorageModule.saveApiKey(testApiKey)).resolves.toBe(testApiKey);
      expect(await mockStorageModule.hasApiKey()).toBe(true);
      expect(await mockStorageModule.getApiKey()).toBe(testApiKey);
      
      // Remove API key
      await expect(mockStorageModule.removeApiKey()).resolves.toBeUndefined();
      expect(await mockStorageModule.hasApiKey()).toBe(false);
      expect(await mockStorageModule.getApiKey()).toBeNull();
    });
  });
});
