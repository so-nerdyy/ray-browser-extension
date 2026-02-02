/**
 * API Key Setup E2E Tests
 * Tests for API key configuration and setup end-to-end scenarios
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock E2E test framework (this would be imported from actual source)
const mockE2ETestFramework = {
  // Browser automation controller
  browser: {
    // Open extension popup
    openExtensionPopup: async () => {
      return new Promise((resolve, reject) => {
        chrome.action.openPopup(() => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve({ success: true });
          }
        });
      });
    },
    
    // Find element in popup
    findPopupElement: async (selector) => {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'findElement',
          data: { selector }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response && response.success) {
            resolve(response.element);
          } else {
            reject(new Error(`Element not found in popup: ${selector}`));
          }
        });
      });
    },
    
    // Click element in popup
    clickPopupElement: async (selector) => {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'clickElement',
          data: { selector }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response && response.success) {
            resolve(response);
          } else {
            reject(new Error(`Failed to click element in popup: ${selector}`));
          }
        });
      });
    },
    
    // Fill input field in popup
    fillPopupInput: async (selector, value) => {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'fillInput',
          data: { selector, value }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response && response.success) {
            resolve(response);
          } else {
            reject(new Error(`Failed to fill input in popup: ${selector}`));
          }
        });
      });
    },
    
    // Get popup content
    getPopupContent: async () => {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'getPopupContent'
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });
    },
    
    // Wait for popup to be ready
    waitForPopupReady: async (timeout = 5000) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkReady = () => {
          chrome.runtime.sendMessage({
            type: 'checkPopupReady'
          }, (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else if (response && response.ready) {
              resolve(response);
            } else if (Date.now() - startTime > timeout) {
              reject(new Error(`Popup ready timeout after ${timeout}ms`));
            } else {
              setTimeout(checkReady, 100);
            }
          });
        };
        
        checkReady();
      });
    }
  },
  
  // API key manager
  apiKeyManager: {
    // Store API key
    storeApiKey: async (apiKey) => {
      return new Promise((resolve, reject) => {
        chrome.storage.local.set({ 
          openrouter_api_key: apiKey,
          api_key_set: true,
          api_key_set_date: new Date().toISOString()
        }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve({ success: true });
          }
        });
      });
    },
    
    // Get API key
    getApiKey: async () => {
      return new Promise((resolve, reject) => {
        chrome.storage.local.get(['openrouter_api_key', 'api_key_set', 'api_key_set_date'], (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      });
    },
    
    // Validate API key format
    validateApiKeyFormat: (apiKey) => {
      if (!apiKey || typeof apiKey !== 'string') {
        return { valid: false, error: 'API key is required' };
      }
      
      if (apiKey.length < 20) {
        return { valid: false, error: 'API key is too short' };
      }
      
      if (!/^[a-zA-Z0-9_-]+$/.test(apiKey)) {
        return { valid: false, error: 'API key contains invalid characters' };
      }
      
      return { valid: true };
    },
    
    // Test API key with OpenRouter
    testApiKey: async (apiKey) => {
      return new Promise((resolve, reject) => {
        // Mock API validation
        setTimeout(() => {
          if (apiKey === 'valid_test_key_123456789012345') {
            resolve({ valid: true, message: 'API key is valid' });
          } else if (apiKey === 'invalid_test_key') {
            resolve({ valid: false, error: 'Invalid API key' });
          } else {
            resolve({ valid: false, error: 'API key validation failed' });
          }
        }, 1000);
      });
    }
  },
  
  // Command processor
  commandProcessor: {
    // Process setup API key command
    processSetupCommand: async (command) => {
      if (!command || typeof command !== 'string') {
        throw new Error('Invalid command: command must be a non-empty string');
      }
      
      // Parse setup command
      const setupMatch = command.match(/(?:setup|configure|set)\s+(?:api\s+)?key\s+(.+?)(?:\s|$)/i);
      if (!setupMatch) {
        throw new Error('Invalid setup command format');
      }
      
      const apiKey = setupMatch[1].trim().replace(/^["']|["']$/g, ''); // Remove quotes
      
      return {
        type: 'setup_api_key',
        apiKey: apiKey,
        originalCommand: command
      };
    },
    
    // Execute setup command
    executeSetup: async (command) => {
      const parsedCommand = mockE2ETestFramework.commandProcessor.processSetupCommand(command);
      
      // Validate API key format
      const formatValidation = mockE2ETestFramework.apiKeyManager.validateApiKeyFormat(parsedCommand.apiKey);
      if (!formatValidation.valid) {
        throw new Error(formatValidation.error);
      }
      
      // Test API key
      const testResult = await mockE2ETestFramework.apiKeyManager.testApiKey(parsedCommand.apiKey);
      if (!testResult.valid) {
        throw new Error(testResult.error);
      }
      
      // Store API key
      await mockE2ETestFramework.apiKeyManager.storeApiKey(parsedCommand.apiKey);
      
      return {
        success: true,
        command: parsedCommand,
        result: {
          apiKey: parsedCommand.apiKey,
          validated: true,
          stored: true
        }
      };
    }
  },
  
  // Test utilities
  utils: {
    // Simulate popup HTML structure
    setupPopupPage: () => {
      document.body.innerHTML = `
        <div class="popup-container">
          <h2>Ray Extension</h2>
          <div id="setup-section" class="setup-section">
            <h3>API Key Setup</h3>
            <div class="form-group">
              <label for="api-key-input">OpenRouter API Key:</label>
              <input type="password" id="api-key-input" placeholder="Enter your API key">
            </div>
            <div class="form-actions">
              <button id="save-key-btn" class="btn-primary">Save API Key</button>
              <button id="test-key-btn" class="btn-secondary">Test API Key</button>
            </div>
            <div id="api-key-status" class="status-message"></div>
          </div>
          <div id="main-section" class="main-section" style="display: none;">
            <h3>Ready to Use</h3>
            <p>API key is configured and ready to use.</p>
            <div class="form-actions">
              <button id="change-key-btn" class="btn-secondary">Change API Key</button>
            </div>
          </div>
        </div>
      `;
    },
    
    // Verify API key is stored
    verifyApiKeyStored: async (expectedApiKey) => {
      const storedData = await mockE2ETestFramework.apiKeyManager.getApiKey();
      return storedData.openrouter_api_key === expectedApiKey && storedData.api_key_set === true;
    },
    
    // Verify popup shows main section
    verifyPopupMainSection: async () => {
      const popupContent = await mockE2ETestFramework.browser.getPopupContent();
      return popupContent.mainSectionVisible === true;
    },
    
    // Verify popup shows setup section
    verifyPopupSetupSection: async () => {
      const popupContent = await mockE2ETestFramework.browser.getPopupContent();
      return popupContent.setupSectionVisible === true;
    }
  }
};

describe('API Key Setup E2E Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Setup mock popup page
    mockE2ETestFramework.utils.setupPopupPage();
    
    // Mock runtime messages for popup interactions
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      switch (message.type) {
        case 'findElement':
          const element = document.querySelector(message.data.selector);
          callback(element ? { success: true, element } : { success: false });
          break;
        case 'clickElement':
          const clickedElement = document.querySelector(message.data.selector);
          if (clickedElement) {
            clickedElement.click();
            callback({ success: true, element: message.data.selector });
          } else {
            callback({ success: false });
          }
          break;
        case 'fillInput':
          const inputElement = document.querySelector(message.data.selector);
          if (inputElement) {
            inputElement.value = message.data.value;
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
            callback({ success: true, element: message.data.selector, value: message.data.value });
          } else {
            callback({ success: false });
          }
          break;
        case 'getPopupContent':
          const setupSection = document.getElementById('setup-section');
          const mainSection = document.getElementById('main-section');
          callback({
            setupSectionVisible: setupSection.style.display !== 'none',
            mainSectionVisible: mainSection.style.display !== 'none'
          });
          break;
        case 'checkPopupReady':
          callback({ ready: true });
          break;
        default:
          callback({ success: false });
      }
    });
    
    // Mock storage operations
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      const result = {};
      keys.forEach(key => {
        if (key === 'openrouter_api_key') {
          result[key] = chrome.storage.local._data[key] || null;
        } else if (key === 'api_key_set') {
          result[key] = chrome.storage.local._data[key] || false;
        } else if (key === 'api_key_set_date') {
          result[key] = chrome.storage.local._data[key] || null;
        }
      });
      callback(result);
    });
    
    chrome.storage.local.set.mockImplementation((items, callback) => {
      Object.assign(chrome.storage.local._data, items);
      if (callback) callback();
    });
    
    // Initialize storage data
    chrome.storage.local._data = {};
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Basic API Key Setup', () => {
    test('should setup valid API key', async () => {
      const command = 'Setup API key valid_test_key_123456789012345';
      const expectedApiKey = 'valid_test_key_123456789012345';
      
      const result = await mockE2ETestFramework.commandProcessor.executeSetup(command);
      
      expect(result.success).toBe(true);
      expect(result.command.type).toBe('setup_api_key');
      expect(result.command.apiKey).toBe(expectedApiKey);
      expect(result.result.apiKey).toBe(expectedApiKey);
      expect(result.result.validated).toBe(true);
      expect(result.result.stored).toBe(true);
      
      const isStored = await mockE2ETestFramework.utils.verifyApiKeyStored(expectedApiKey);
      expect(isStored).toBe(true);
    });
    
    test('should configure API key with quotes', async () => {
      const command = 'Configure API key "valid_test_key_123456789012345"';
      const expectedApiKey = 'valid_test_key_123456789012345';
      
      const result = await mockE2ETestFramework.commandProcessor.executeSetup(command);
      
      expect(result.success).toBe(true);
      expect(result.command.apiKey).toBe(expectedApiKey);
      
      const isStored = await mockE2ETestFramework.utils.verifyApiKeyStored(expectedApiKey);
      expect(isStored).toBe(true);
    });
    
    test('should set API key with alternative command', async () => {
      const command = 'Set key valid_test_key_123456789012345';
      const expectedApiKey = 'valid_test_key_123456789012345';
      
      const result = await mockE2ETestFramework.commandProcessor.executeSetup(command);
      
      expect(result.success).toBe(true);
      expect(result.command.apiKey).toBe(expectedApiKey);
      
      const isStored = await mockE2ETestFramework.utils.verifyApiKeyStored(expectedApiKey);
      expect(isStored).toBe(true);
    });
  });
  
  describe('API Key Validation', () => {
    test('should reject invalid API key format', async () => {
      const command = 'Setup API key short_key';
      
      await expect(mockE2ETestFramework.commandProcessor.executeSetup(command)).rejects.toThrow('API key is too short');
    });
    
    test('should reject API key with invalid characters', async () => {
      const command = 'Setup API key invalid@key#$%';
      
      await expect(mockE2ETestFramework.commandProcessor.executeSetup(command)).rejects.toThrow('API key contains invalid characters');
    });
    
    test('should reject empty API key', async () => {
      const command = 'Setup API key ""';
      
      await expect(mockE2ETestFramework.commandProcessor.executeSetup(command)).rejects.toThrow('API key is required');
    });
    
    test('should reject API key validation failure', async () => {
      const command = 'Setup API key invalid_test_key';
      
      await expect(mockE2ETestFramework.commandProcessor.executeSetup(command)).rejects.toThrow('Invalid API key');
    });
  });
  
  describe('Popup UI Interaction', () => {
    test('should open extension popup', async () => {
      const result = await mockE2ETestFramework.browser.openExtensionPopup();
      
      expect(result.success).toBe(true);
    });
    
    test('should fill API key in popup input', async () => {
      const apiKey = 'valid_test_key_123456789012345';
      
      const result = await mockE2ETestFramework.browser.fillPopupInput('#api-key-input', apiKey);
      
      expect(result.success).toBe(true);
      expect(result.element).toBe('#api-key-input');
      expect(result.value).toBe(apiKey);
    });
    
    test('should click save button in popup', async () => {
      const result = await mockE2ETestFramework.browser.clickPopupElement('#save-key-btn');
      
      expect(result.success).toBe(true);
      expect(result.element).toBe('#save-key-btn');
    });
    
    test('should click test button in popup', async () => {
      const result = await mockE2ETestFramework.browser.clickPopupElement('#test-key-btn');
      
      expect(result.success).toBe(true);
      expect(result.element).toBe('#test-key-btn');
    });
    
    test('should show setup section initially', async () => {
      const isSetupVisible = await mockE2ETestFramework.utils.verifyPopupSetupSection();
      expect(isSetupVisible).toBe(true);
    });
  });
  
  describe('Complete Setup Workflow', () => {
    test('should complete full API key setup workflow', async () => {
      const apiKey = 'valid_test_key_123456789012345';
      
      // Open popup
      await mockE2ETestFramework.browser.openExtensionPopup();
      
      // Wait for popup to be ready
      await mockE2ETestFramework.browser.waitForPopupReady();
      
      // Verify setup section is visible
      const isSetupVisible = await mockE2ETestFramework.utils.verifyPopupSetupSection();
      expect(isSetupVisible).toBe(true);
      
      // Fill API key
      const fillResult = await mockE2ETestFramework.browser.fillPopupInput('#api-key-input', apiKey);
      expect(fillResult.success).toBe(true);
      
      // Test API key
      const testResult = await mockE2ETestFramework.browser.clickPopupElement('#test-key-btn');
      expect(testResult.success).toBe(true);
      
      // Save API key
      const saveResult = await mockE2ETestFramework.browser.clickPopupElement('#save-key-btn');
      expect(saveResult.success).toBe(true);
      
      // Verify API key is stored
      const isStored = await mockE2ETestFramework.utils.verifyApiKeyStored(apiKey);
      expect(isStored).toBe(true);
      
      // Verify main section is now visible
      const isMainVisible = await mockE2ETestFramework.utils.verifyPopupMainSection();
      expect(isMainVisible).toBe(true);
    });
    
    test('should handle API key change workflow', async () => {
      const initialApiKey = 'valid_test_key_123456789012345';
      const newApiKey = 'new_valid_key_098765432109876';
      
      // Setup initial API key
      await mockE2ETestFramework.commandProcessor.executeSetup(`Setup API key ${initialApiKey}`);
      
      // Verify initial key is stored
      const isInitialStored = await mockE2ETestFramework.utils.verifyApiKeyStored(initialApiKey);
      expect(isInitialStored).toBe(true);
      
      // Open popup and verify main section is visible
      await mockE2ETestFramework.browser.openExtensionPopup();
      const isMainVisible = await mockE2ETestFramework.utils.verifyPopupMainSection();
      expect(isMainVisible).toBe(true);
      
      // Click change API key button
      const changeResult = await mockE2ETestFramework.browser.clickPopupElement('#change-key-btn');
      expect(changeResult.success).toBe(true);
      
      // Verify setup section is now visible
      const isSetupVisible = await mockE2ETestFramework.utils.verifyPopupSetupSection();
      expect(isSetupVisible).toBe(true);
      
      // Fill new API key
      const fillResult = await mockE2ETestFramework.browser.fillPopupInput('#api-key-input', newApiKey);
      expect(fillResult.success).toBe(true);
      
      // Save new API key
      const saveResult = await mockE2ETestFramework.browser.clickPopupElement('#save-key-btn');
      expect(saveResult.success).toBe(true);
      
      // Verify new API key is stored
      const isNewStored = await mockE2ETestFramework.utils.verifyApiKeyStored(newApiKey);
      expect(isNewStored).toBe(true);
    });
  });
  
  describe('Error Handling', () => {
    test('should reject invalid setup command format', async () => {
      const command = 'Invalid setup command';
      
      await expect(mockE2ETestFramework.commandProcessor.executeSetup(command)).rejects.toThrow('Invalid setup command format');
    });
    
    test('should handle popup open failure', async () => {
      const error = new Error('Failed to open popup');
      
      chrome.action.openPopup.mockImplementation((callback) => {
        chrome.runtime.lastError = error;
        callback();
      });
      
      await expect(mockE2ETestFramework.browser.openExtensionPopup()).rejects.toThrow('Failed to open popup');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
    
    test('should handle element not found in popup', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'findElement') {
          callback({ success: false }); // Element not found
        }
      });
      
      await expect(mockE2ETestFramework.browser.findPopupElement('#non-existent')).rejects.toThrow('Element not found in popup: #non-existent');
    });
    
    test('should handle storage errors', async () => {
      const error = new Error('Storage access denied');
      
      chrome.storage.local.set.mockImplementation((items, callback) => {
        chrome.runtime.lastError = error;
        if (callback) callback();
      });
      
      const command = 'Setup API key valid_test_key_123456789012345';
      
      await expect(mockE2ETestFramework.commandProcessor.executeSetup(command)).rejects.toThrow('Storage access denied');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('Performance and Timing', () => {
    test('should complete API key setup within acceptable time', async () => {
      const command = 'Setup API key valid_test_key_123456789012345';
      const startTime = Date.now();
      
      const result = await mockE2ETestFramework.commandProcessor.executeSetup(command);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds (includes API validation)
    });
    
    test('should handle popup ready timeout', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'checkPopupReady') {
          // Never respond to simulate timeout
          // callback would not be called
        }
      });
      
      await expect(mockE2ETestFramework.browser.waitForPopupReady(1000)).rejects.toThrow('Popup ready timeout after 1000ms');
    });
  });
}); * API Key Setup E2E Tests
 * Tests for API key configuration and setup end-to-end scenarios
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock E2E test framework (this would be imported from actual source)
const mockE2ETestFramework = {
  // Browser automation controller
  browser: {
    // Open extension popup
    openExtensionPopup: async () => {
      return new Promise((resolve, reject) => {
        chrome.action.openPopup(() => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve({ success: true });
          }
        });
      });
    },
    
    // Find element in popup
    findPopupElement: async (selector) => {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'findElement',
          data: { selector }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response && response.success) {
            resolve(response.element);
          } else {
            reject(new Error(`Element not found in popup: ${selector}`));
          }
        });
      });
    },
    
    // Click element in popup
    clickPopupElement: async (selector) => {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'clickElement',
          data: { selector }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response && response.success) {
            resolve(response);
          } else {
            reject(new Error(`Failed to click element in popup: ${selector}`));
          }
        });
      });
    },
    
    // Fill input field in popup
    fillPopupInput: async (selector, value) => {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'fillInput',
          data: { selector, value }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response && response.success) {
            resolve(response);
          } else {
            reject(new Error(`Failed to fill input in popup: ${selector}`));
          }
        });
      });
    },
    
    // Get popup content
    getPopupContent: async () => {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'getPopupContent'
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });
    },
    
    // Wait for popup to be ready
    waitForPopupReady: async (timeout = 5000) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkReady = () => {
          chrome.runtime.sendMessage({
            type: 'checkPopupReady'
          }, (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else if (response && response.ready) {
              resolve(response);
            } else if (Date.now() - startTime > timeout) {
              reject(new Error(`Popup ready timeout after ${timeout}ms`));
            } else {
              setTimeout(checkReady, 100);
            }
          });
        };
        
        checkReady();
      });
    }
  },
  
  // API key manager
  apiKeyManager: {
    // Store API key
    storeApiKey: async (apiKey) => {
      return new Promise((resolve, reject) => {
        chrome.storage.local.set({ 
          openrouter_api_key: apiKey,
          api_key_set: true,
          api_key_set_date: new Date().toISOString()
        }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve({ success: true });
          }
        });
      });
    },
    
    // Get API key
    getApiKey: async () => {
      return new Promise((resolve, reject) => {
        chrome.storage.local.get(['openrouter_api_key', 'api_key_set', 'api_key_set_date'], (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      });
    },
    
    // Validate API key format
    validateApiKeyFormat: (apiKey) => {
      if (!apiKey || typeof apiKey !== 'string') {
        return { valid: false, error: 'API key is required' };
      }
      
      if (apiKey.length < 20) {
        return { valid: false, error: 'API key is too short' };
      }
      
      if (!/^[a-zA-Z0-9_-]+$/.test(apiKey)) {
        return { valid: false, error: 'API key contains invalid characters' };
      }
      
      return { valid: true };
    },
    
    // Test API key with OpenRouter
    testApiKey: async (apiKey) => {
      return new Promise((resolve, reject) => {
        // Mock API validation
        setTimeout(() => {
          if (apiKey === 'valid_test_key_123456789012345') {
            resolve({ valid: true, message: 'API key is valid' });
          } else if (apiKey === 'invalid_test_key') {
            resolve({ valid: false, error: 'Invalid API key' });
          } else {
            resolve({ valid: false, error: 'API key validation failed' });
          }
        }, 1000);
      });
    }
  },
  
  // Command processor
  commandProcessor: {
    // Process setup API key command
    processSetupCommand: async (command) => {
      if (!command || typeof command !== 'string') {
        throw new Error('Invalid command: command must be a non-empty string');
      }
      
      // Parse setup command
      const setupMatch = command.match(/(?:setup|configure|set)\s+(?:api\s+)?key\s+(.+?)(?:\s|$)/i);
      if (!setupMatch) {
        throw new Error('Invalid setup command format');
      }
      
      const apiKey = setupMatch[1].trim().replace(/^["']|["']$/g, ''); // Remove quotes
      
      return {
        type: 'setup_api_key',
        apiKey: apiKey,
        originalCommand: command
      };
    },
    
    // Execute setup command
    executeSetup: async (command) => {
      const parsedCommand = mockE2ETestFramework.commandProcessor.processSetupCommand(command);
      
      // Validate API key format
      const formatValidation = mockE2ETestFramework.apiKeyManager.validateApiKeyFormat(parsedCommand.apiKey);
      if (!formatValidation.valid) {
        throw new Error(formatValidation.error);
      }
      
      // Test API key
      const testResult = await mockE2ETestFramework.apiKeyManager.testApiKey(parsedCommand.apiKey);
      if (!testResult.valid) {
        throw new Error(testResult.error);
      }
      
      // Store API key
      await mockE2ETestFramework.apiKeyManager.storeApiKey(parsedCommand.apiKey);
      
      return {
        success: true,
        command: parsedCommand,
        result: {
          apiKey: parsedCommand.apiKey,
          validated: true,
          stored: true
        }
      };
    }
  },
  
  // Test utilities
  utils: {
    // Simulate popup HTML structure
    setupPopupPage: () => {
      document.body.innerHTML = `
        <div class="popup-container">
          <h2>Ray Extension</h2>
          <div id="setup-section" class="setup-section">
            <h3>API Key Setup</h3>
            <div class="form-group">
              <label for="api-key-input">OpenRouter API Key:</label>
              <input type="password" id="api-key-input" placeholder="Enter your API key">
            </div>
            <div class="form-actions">
              <button id="save-key-btn" class="btn-primary">Save API Key</button>
              <button id="test-key-btn" class="btn-secondary">Test API Key</button>
            </div>
            <div id="api-key-status" class="status-message"></div>
          </div>
          <div id="main-section" class="main-section" style="display: none;">
            <h3>Ready to Use</h3>
            <p>API key is configured and ready to use.</p>
            <div class="form-actions">
              <button id="change-key-btn" class="btn-secondary">Change API Key</button>
            </div>
          </div>
        </div>
      `;
    },
    
    // Verify API key is stored
    verifyApiKeyStored: async (expectedApiKey) => {
      const storedData = await mockE2ETestFramework.apiKeyManager.getApiKey();
      return storedData.openrouter_api_key === expectedApiKey && storedData.api_key_set === true;
    },
    
    // Verify popup shows main section
    verifyPopupMainSection: async () => {
      const popupContent = await mockE2ETestFramework.browser.getPopupContent();
      return popupContent.mainSectionVisible === true;
    },
    
    // Verify popup shows setup section
    verifyPopupSetupSection: async () => {
      const popupContent = await mockE2ETestFramework.browser.getPopupContent();
      return popupContent.setupSectionVisible === true;
    }
  }
};

describe('API Key Setup E2E Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Setup mock popup page
    mockE2ETestFramework.utils.setupPopupPage();
    
    // Mock runtime messages for popup interactions
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      switch (message.type) {
        case 'findElement':
          const element = document.querySelector(message.data.selector);
          callback(element ? { success: true, element } : { success: false });
          break;
        case 'clickElement':
          const clickedElement = document.querySelector(message.data.selector);
          if (clickedElement) {
            clickedElement.click();
            callback({ success: true, element: message.data.selector });
          } else {
            callback({ success: false });
          }
          break;
        case 'fillInput':
          const inputElement = document.querySelector(message.data.selector);
          if (inputElement) {
            inputElement.value = message.data.value;
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
            callback({ success: true, element: message.data.selector, value: message.data.value });
          } else {
            callback({ success: false });
          }
          break;
        case 'getPopupContent':
          const setupSection = document.getElementById('setup-section');
          const mainSection = document.getElementById('main-section');
          callback({
            setupSectionVisible: setupSection.style.display !== 'none',
            mainSectionVisible: mainSection.style.display !== 'none'
          });
          break;
        case 'checkPopupReady':
          callback({ ready: true });
          break;
        default:
          callback({ success: false });
      }
    });
    
    // Mock storage operations
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      const result = {};
      keys.forEach(key => {
        if (key === 'openrouter_api_key') {
          result[key] = chrome.storage.local._data[key] || null;
        } else if (key === 'api_key_set') {
          result[key] = chrome.storage.local._data[key] || false;
        } else if (key === 'api_key_set_date') {
          result[key] = chrome.storage.local._data[key] || null;
        }
      });
      callback(result);
    });
    
    chrome.storage.local.set.mockImplementation((items, callback) => {
      Object.assign(chrome.storage.local._data, items);
      if (callback) callback();
    });
    
    // Initialize storage data
    chrome.storage.local._data = {};
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Basic API Key Setup', () => {
    test('should setup valid API key', async () => {
      const command = 'Setup API key valid_test_key_123456789012345';
      const expectedApiKey = 'valid_test_key_123456789012345';
      
      const result = await mockE2ETestFramework.commandProcessor.executeSetup(command);
      
      expect(result.success).toBe(true);
      expect(result.command.type).toBe('setup_api_key');
      expect(result.command.apiKey).toBe(expectedApiKey);
      expect(result.result.apiKey).toBe(expectedApiKey);
      expect(result.result.validated).toBe(true);
      expect(result.result.stored).toBe(true);
      
      const isStored = await mockE2ETestFramework.utils.verifyApiKeyStored(expectedApiKey);
      expect(isStored).toBe(true);
    });
    
    test('should configure API key with quotes', async () => {
      const command = 'Configure API key "valid_test_key_123456789012345"';
      const expectedApiKey = 'valid_test_key_123456789012345';
      
      const result = await mockE2ETestFramework.commandProcessor.executeSetup(command);
      
      expect(result.success).toBe(true);
      expect(result.command.apiKey).toBe(expectedApiKey);
      
      const isStored = await mockE2ETestFramework.utils.verifyApiKeyStored(expectedApiKey);
      expect(isStored).toBe(true);
    });
    
    test('should set API key with alternative command', async () => {
      const command = 'Set key valid_test_key_123456789012345';
      const expectedApiKey = 'valid_test_key_123456789012345';
      
      const result = await mockE2ETestFramework.commandProcessor.executeSetup(command);
      
      expect(result.success).toBe(true);
      expect(result.command.apiKey).toBe(expectedApiKey);
      
      const isStored = await mockE2ETestFramework.utils.verifyApiKeyStored(expectedApiKey);
      expect(isStored).toBe(true);
    });
  });
  
  describe('API Key Validation', () => {
    test('should reject invalid API key format', async () => {
      const command = 'Setup API key short_key';
      
      await expect(mockE2ETestFramework.commandProcessor.executeSetup(command)).rejects.toThrow('API key is too short');
    });
    
    test('should reject API key with invalid characters', async () => {
      const command = 'Setup API key invalid@key#$%';
      
      await expect(mockE2ETestFramework.commandProcessor.executeSetup(command)).rejects.toThrow('API key contains invalid characters');
    });
    
    test('should reject empty API key', async () => {
      const command = 'Setup API key ""';
      
      await expect(mockE2ETestFramework.commandProcessor.executeSetup(command)).rejects.toThrow('API key is required');
    });
    
    test('should reject API key validation failure', async () => {
      const command = 'Setup API key invalid_test_key';
      
      await expect(mockE2ETestFramework.commandProcessor.executeSetup(command)).rejects.toThrow('Invalid API key');
    });
  });
  
  describe('Popup UI Interaction', () => {
    test('should open extension popup', async () => {
      const result = await mockE2ETestFramework.browser.openExtensionPopup();
      
      expect(result.success).toBe(true);
    });
    
    test('should fill API key in popup input', async () => {
      const apiKey = 'valid_test_key_123456789012345';
      
      const result = await mockE2ETestFramework.browser.fillPopupInput('#api-key-input', apiKey);
      
      expect(result.success).toBe(true);
      expect(result.element).toBe('#api-key-input');
      expect(result.value).toBe(apiKey);
    });
    
    test('should click save button in popup', async () => {
      const result = await mockE2ETestFramework.browser.clickPopupElement('#save-key-btn');
      
      expect(result.success).toBe(true);
      expect(result.element).toBe('#save-key-btn');
    });
    
    test('should click test button in popup', async () => {
      const result = await mockE2ETestFramework.browser.clickPopupElement('#test-key-btn');
      
      expect(result.success).toBe(true);
      expect(result.element).toBe('#test-key-btn');
    });
    
    test('should show setup section initially', async () => {
      const isSetupVisible = await mockE2ETestFramework.utils.verifyPopupSetupSection();
      expect(isSetupVisible).toBe(true);
    });
  });
  
  describe('Complete Setup Workflow', () => {
    test('should complete full API key setup workflow', async () => {
      const apiKey = 'valid_test_key_123456789012345';
      
      // Open popup
      await mockE2ETestFramework.browser.openExtensionPopup();
      
      // Wait for popup to be ready
      await mockE2ETestFramework.browser.waitForPopupReady();
      
      // Verify setup section is visible
      const isSetupVisible = await mockE2ETestFramework.utils.verifyPopupSetupSection();
      expect(isSetupVisible).toBe(true);
      
      // Fill API key
      const fillResult = await mockE2ETestFramework.browser.fillPopupInput('#api-key-input', apiKey);
      expect(fillResult.success).toBe(true);
      
      // Test API key
      const testResult = await mockE2ETestFramework.browser.clickPopupElement('#test-key-btn');
      expect(testResult.success).toBe(true);
      
      // Save API key
      const saveResult = await mockE2ETestFramework.browser.clickPopupElement('#save-key-btn');
      expect(saveResult.success).toBe(true);
      
      // Verify API key is stored
      const isStored = await mockE2ETestFramework.utils.verifyApiKeyStored(apiKey);
      expect(isStored).toBe(true);
      
      // Verify main section is now visible
      const isMainVisible = await mockE2ETestFramework.utils.verifyPopupMainSection();
      expect(isMainVisible).toBe(true);
    });
    
    test('should handle API key change workflow', async () => {
      const initialApiKey = 'valid_test_key_123456789012345';
      const newApiKey = 'new_valid_key_098765432109876';
      
      // Setup initial API key
      await mockE2ETestFramework.commandProcessor.executeSetup(`Setup API key ${initialApiKey}`);
      
      // Verify initial key is stored
      const isInitialStored = await mockE2ETestFramework.utils.verifyApiKeyStored(initialApiKey);
      expect(isInitialStored).toBe(true);
      
      // Open popup and verify main section is visible
      await mockE2ETestFramework.browser.openExtensionPopup();
      const isMainVisible = await mockE2ETestFramework.utils.verifyPopupMainSection();
      expect(isMainVisible).toBe(true);
      
      // Click change API key button
      const changeResult = await mockE2ETestFramework.browser.clickPopupElement('#change-key-btn');
      expect(changeResult.success).toBe(true);
      
      // Verify setup section is now visible
      const isSetupVisible = await mockE2ETestFramework.utils.verifyPopupSetupSection();
      expect(isSetupVisible).toBe(true);
      
      // Fill new API key
      const fillResult = await mockE2ETestFramework.browser.fillPopupInput('#api-key-input', newApiKey);
      expect(fillResult.success).toBe(true);
      
      // Save new API key
      const saveResult = await mockE2ETestFramework.browser.clickPopupElement('#save-key-btn');
      expect(saveResult.success).toBe(true);
      
      // Verify new API key is stored
      const isNewStored = await mockE2ETestFramework.utils.verifyApiKeyStored(newApiKey);
      expect(isNewStored).toBe(true);
    });
  });
  
  describe('Error Handling', () => {
    test('should reject invalid setup command format', async () => {
      const command = 'Invalid setup command';
      
      await expect(mockE2ETestFramework.commandProcessor.executeSetup(command)).rejects.toThrow('Invalid setup command format');
    });
    
    test('should handle popup open failure', async () => {
      const error = new Error('Failed to open popup');
      
      chrome.action.openPopup.mockImplementation((callback) => {
        chrome.runtime.lastError = error;
        callback();
      });
      
      await expect(mockE2ETestFramework.browser.openExtensionPopup()).rejects.toThrow('Failed to open popup');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
    
    test('should handle element not found in popup', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'findElement') {
          callback({ success: false }); // Element not found
        }
      });
      
      await expect(mockE2ETestFramework.browser.findPopupElement('#non-existent')).rejects.toThrow('Element not found in popup: #non-existent');
    });
    
    test('should handle storage errors', async () => {
      const error = new Error('Storage access denied');
      
      chrome.storage.local.set.mockImplementation((items, callback) => {
        chrome.runtime.lastError = error;
        if (callback) callback();
      });
      
      const command = 'Setup API key valid_test_key_123456789012345';
      
      await expect(mockE2ETestFramework.commandProcessor.executeSetup(command)).rejects.toThrow('Storage access denied');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('Performance and Timing', () => {
    test('should complete API key setup within acceptable time', async () => {
      const command = 'Setup API key valid_test_key_123456789012345';
      const startTime = Date.now();
      
      const result = await mockE2ETestFramework.commandProcessor.executeSetup(command);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds (includes API validation)
    });
    
    test('should handle popup ready timeout', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'checkPopupReady') {
          // Never respond to simulate timeout
          // callback would not be called
        }
      });
      
      await expect(mockE2ETestFramework.browser.waitForPopupReady(1000)).rejects.toThrow('Popup ready timeout after 1000ms');
    });
  });
});
