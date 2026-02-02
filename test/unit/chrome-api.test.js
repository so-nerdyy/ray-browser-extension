/**
 * Chrome API Wrapper Unit Tests
 * Tests for Chrome Extension API wrapper functions and utilities
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock Chrome API wrapper module (this would be imported from the actual source)
const mockChromeAPIWrapper = {
  // Tab management functions
  createTab: async (url, active = true) => {
    return new Promise((resolve, reject) => {
      if (!url || typeof url !== 'string') {
        reject(new Error('URL is required and must be a string'));
        return;
      }
      
      chrome.tabs.create({ url, active }, (tab) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(tab);
        }
      });
    });
  },
  
  updateTab: async (tabId, updateProperties) => {
    return new Promise((resolve, reject) => {
      if (!tabId || typeof tabId !== 'number') {
        reject(new Error('Tab ID is required and must be a number'));
        return;
      }
      
      chrome.tabs.update(tabId, updateProperties, (tab) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(tab);
        }
      });
    });
  },
  
  queryTabs: async (queryInfo) => {
    return new Promise((resolve, reject) => {
      chrome.tabs.query(queryInfo, (tabs) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(tabs);
        }
      });
    });
  },
  
  sendMessageToTab: async (tabId, message) => {
    return new Promise((resolve, reject) => {
      if (!tabId || typeof tabId !== 'number') {
        reject(new Error('Tab ID is required and must be a number'));
        return;
      }
      
      if (!message) {
        reject(new Error('Message is required'));
        return;
      }
      
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  },
  
  executeScriptInTab: async (tabId, details) => {
    return new Promise((resolve, reject) => {
      if (!tabId || typeof tabId !== 'number') {
        reject(new Error('Tab ID is required and must be a number'));
        return;
      }
      
      chrome.tabs.executeScript(tabId, details, (results) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(results);
        }
      });
    });
  },
  
  // Window management functions
  createWindow: async (createData) => {
    return new Promise((resolve, reject) => {
      chrome.windows.create(createData, (window) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(window);
        }
      });
    });
  },
  
  updateWindow: async (windowId, updateInfo) => {
    return new Promise((resolve, reject) => {
      if (!windowId || typeof windowId !== 'number') {
        reject(new Error('Window ID is required and must be a number'));
        return;
      }
      
      chrome.windows.update(windowId, updateInfo, (window) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(window);
        }
      });
    });
  },
  
  getCurrentWindow: async () => {
    return new Promise((resolve, reject) => {
      chrome.windows.getCurrent((window) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(window);
        }
      });
    });
  },
  
  // Storage functions
  getStorageData: async (keys) => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (data) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(data);
        }
      });
    });
  },
  
  setStorageData: async (data) => {
    return new Promise((resolve, reject) => {
      if (!data || typeof data !== 'object') {
        reject(new Error('Data is required and must be an object'));
        return;
      }
      
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },
  
  removeStorageData: async (keys) => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },
  
  // Runtime functions
  getExtensionURL: (path) => {
    return chrome.runtime.getURL(path);
  },
  
  sendMessage: async (message) => {
    return new Promise((resolve, reject) => {
      if (!message) {
        reject(new Error('Message is required'));
        return;
      }
      
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  },
  
  // Action functions
  setBadgeText: async (text) => {
    return new Promise((resolve, reject) => {
      chrome.action.setBadgeText({ text }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },
  
  setBadgeBackgroundColor: async (color) => {
    return new Promise((resolve, reject) => {
      chrome.action.setBadgeBackgroundColor({ color }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },
  
  // Permission functions
  requestPermissions: async (permissions) => {
    return new Promise((resolve, reject) => {
      chrome.permissions.request(permissions, (granted) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(granted);
        }
      });
    });
  },
  
  hasPermissions: async (permissions) => {
    return new Promise((resolve, reject) => {
      chrome.permissions.contains(permissions, (hasPermissions) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(hasPermissions);
        }
      });
    });
  }
};

describe('Chrome API Wrapper', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Tab Management', () => {
    describe('createTab', () => {
      test('should create a new tab successfully', async () => {
        const url = 'https://example.com';
        const mockTab = createMockTab({ url });
        
        chrome.tabs.create.mockImplementation((createProperties, callback) => {
          callback(mockTab);
        });
        
        const result = await mockChromeAPIWrapper.createTab(url);
        
        expect(result).toEqual(mockTab);
        expect(chrome.tabs.create).toHaveBeenCalledWith({ url, active: true }, expect.any(Function));
      });
      
      test('should create an inactive tab when specified', async () => {
        const url = 'https://example.com';
        const mockTab = createMockTab({ url, active: false });
        
        chrome.tabs.create.mockImplementation((createProperties, callback) => {
          callback(mockTab);
        });
        
        const result = await mockChromeAPIWrapper.createTab(url, false);
        
        expect(result).toEqual(mockTab);
        expect(chrome.tabs.create).toHaveBeenCalledWith({ url, active: false }, expect.any(Function));
      });
      
      test('should reject invalid URL', async () => {
        await expect(mockChromeAPIWrapper.createTab(null)).rejects.toThrow('URL is required and must be a string');
        await expect(mockChromeAPIWrapper.createTab(undefined)).rejects.toThrow('URL is required and must be a string');
        await expect(mockChromeAPIWrapper.createTab(123)).rejects.toThrow('URL is required and must be a string');
      });
      
      test('should handle Chrome API errors', async () => {
        const url = 'https://example.com';
        const error = new Error('Tab creation failed');
        
        chrome.runtime.lastError = error;
        chrome.tabs.create.mockImplementation((createProperties, callback) => {
          callback(null);
        });
        
        await expect(mockChromeAPIWrapper.createTab(url)).rejects.toThrow('Tab creation failed');
        
        // Reset lastError
        chrome.runtime.lastError = null;
      });
    });
    
    describe('updateTab', () => {
      test('should update a tab successfully', async () => {
        const tabId = 123;
        const updateProperties = { url: 'https://updated.com' };
        const mockTab = createMockTab({ id: tabId, ...updateProperties });
        
        chrome.tabs.update.mockImplementation((id, properties, callback) => {
          callback(mockTab);
        });
        
        const result = await mockChromeAPIWrapper.updateTab(tabId, updateProperties);
        
        expect(result).toEqual(mockTab);
        expect(chrome.tabs.update).toHaveBeenCalledWith(tabId, updateProperties, expect.any(Function));
      });
      
      test('should reject invalid tab ID', async () => {
        const updateProperties = { url: 'https://updated.com' };
        
        await expect(mockChromeAPIWrapper.updateTab(null, updateProperties)).rejects.toThrow('Tab ID is required and must be a number');
        await expect(mockChromeAPIWrapper.updateTab(undefined, updateProperties)).rejects.toThrow('Tab ID is required and must be a number');
        await expect(mockChromeAPIWrapper.updateTab('invalid', updateProperties)).rejects.toThrow('Tab ID is required and must be a number');
      });
    });
    
    describe('queryTabs', () => {
      test('should query tabs successfully', async () => {
        const queryInfo = { active: true };
        const mockTabs = [createMockTab(), createMockTab()];
        
        chrome.tabs.query.mockImplementation((info, callback) => {
          callback(mockTabs);
        });
        
        const result = await mockChromeAPIWrapper.queryTabs(queryInfo);
        
        expect(result).toEqual(mockTabs);
        expect(chrome.tabs.query).toHaveBeenCalledWith(queryInfo, expect.any(Function));
      });
    });
    
    describe('sendMessageToTab', () => {
      test('should send message to tab successfully', async () => {
        const tabId = 123;
        const message = { type: 'test', data: 'hello' };
        const response = { success: true };
        
        chrome.tabs.sendMessage.mockImplementation((id, msg, callback) => {
          callback(response);
        });
        
        const result = await mockChromeAPIWrapper.sendMessageToTab(tabId, message);
        
        expect(result).toEqual(response);
        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(tabId, message, expect.any(Function));
      });
      
      test('should reject invalid tab ID', async () => {
        const message = { type: 'test' };
        
        await expect(mockChromeAPIWrapper.sendMessageToTab(null, message)).rejects.toThrow('Tab ID is required and must be a number');
        await expect(mockChromeAPIWrapper.sendMessageToTab(undefined, message)).rejects.toThrow('Tab ID is required and must be a number');
      });
      
      test('should reject empty message', async () => {
        const tabId = 123;
        
        await expect(mockChromeAPIWrapper.sendMessageToTab(tabId, null)).rejects.toThrow('Message is required');
        await expect(mockChromeAPIWrapper.sendMessageToTab(tabId, undefined)).rejects.toThrow('Message is required');
      });
    });
    
    describe('executeScriptInTab', () => {
      test('should execute script in tab successfully', async () => {
        const tabId = 123;
        const details = { code: 'console.log("test")' };
        const results = [{ result: 'success' }];
        
        chrome.tabs.executeScript.mockImplementation((id, det, callback) => {
          callback(results);
        });
        
        const result = await mockChromeAPIWrapper.executeScriptInTab(tabId, details);
        
        expect(result).toEqual(results);
        expect(chrome.tabs.executeScript).toHaveBeenCalledWith(tabId, details, expect.any(Function));
      });
      
      test('should reject invalid tab ID', async () => {
        const details = { code: 'console.log("test")' };
        
        await expect(mockChromeAPIWrapper.executeScriptInTab(null, details)).rejects.toThrow('Tab ID is required and must be a number');
      });
    });
  });
  
  describe('Window Management', () => {
    describe('createWindow', () => {
      test('should create a new window successfully', async () => {
        const createData = { url: 'https://example.com', type: 'popup' };
        const mockWindow = createMockWindow(createData);
        
        chrome.windows.create.mockImplementation((data, callback) => {
          callback(mockWindow);
        });
        
        const result = await mockChromeAPIWrapper.createWindow(createData);
        
        expect(result).toEqual(mockWindow);
        expect(chrome.windows.create).toHaveBeenCalledWith(createData, expect.any(Function));
      });
    });
    
    describe('updateWindow', () => {
      test('should update a window successfully', async () => {
        const windowId = 456;
        const updateInfo = { focused: true };
        const mockWindow = createMockWindow({ id: windowId, ...updateInfo });
        
        chrome.windows.update.mockImplementation((id, info, callback) => {
          callback(mockWindow);
        });
        
        const result = await mockChromeAPIWrapper.updateWindow(windowId, updateInfo);
        
        expect(result).toEqual(mockWindow);
        expect(chrome.windows.update).toHaveBeenCalledWith(windowId, updateInfo, expect.any(Function));
      });
      
      test('should reject invalid window ID', async () => {
        const updateInfo = { focused: true };
        
        await expect(mockChromeAPIWrapper.updateWindow(null, updateInfo)).rejects.toThrow('Window ID is required and must be a number');
        await expect(mockChromeAPIWrapper.updateWindow(undefined, updateInfo)).rejects.toThrow('Window ID is required and must be a number');
      });
    });
    
    describe('getCurrentWindow', () => {
      test('should get current window successfully', async () => {
        const mockWindow = createMockWindow();
        
        chrome.windows.getCurrent.mockImplementation((callback) => {
          callback(mockWindow);
        });
        
        const result = await mockChromeAPIWrapper.getCurrentWindow();
        
        expect(result).toEqual(mockWindow);
        expect(chrome.windows.getCurrent).toHaveBeenCalledWith(expect.any(Function));
      });
    });
  });
  
  describe('Storage Management', () => {
    describe('getStorageData', () => {
      test('should get storage data successfully', async () => {
        const keys = ['test-key'];
        const data = { 'test-key': 'test-value' };
        
        chrome.storage.local.get.mockImplementation((k, callback) => {
          callback(data);
        });
        
        const result = await mockChromeAPIWrapper.getStorageData(keys);
        
        expect(result).toEqual(data);
        expect(chrome.storage.local.get).toHaveBeenCalledWith(keys, expect.any(Function));
      });
    });
    
    describe('setStorageData', () => {
      test('should set storage data successfully', async () => {
        const data = { 'test-key': 'test-value' };
        
        chrome.storage.local.set.mockImplementation((d, callback) => {
          callback();
        });
        
        await expect(mockChromeAPIWrapper.setStorageData(data)).resolves.toBeUndefined();
        expect(chrome.storage.local.set).toHaveBeenCalledWith(data, expect.any(Function));
      });
      
      test('should reject invalid data', async () => {
        await expect(mockChromeAPIWrapper.setStorageData(null)).rejects.toThrow('Data is required and must be an object');
        await expect(mockChromeAPIWrapper.setStorageData(undefined)).rejects.toThrow('Data is required and must be an object');
        await expect(mockChromeAPIWrapper.setStorageData('invalid')).rejects.toThrow('Data is required and must be an object');
      });
    });
    
    describe('removeStorageData', () => {
      test('should remove storage data successfully', async () => {
        const keys = ['test-key'];
        
        chrome.storage.local.remove.mockImplementation((k, callback) => {
          callback();
        });
        
        await expect(mockChromeAPIWrapper.removeStorageData(keys)).resolves.toBeUndefined();
        expect(chrome.storage.local.remove).toHaveBeenCalledWith(keys, expect.any(Function));
      });
    });
  });
  
  describe('Runtime Functions', () => {
    describe('getExtensionURL', () => {
      test('should get extension URL', () => {
        const path = 'popup.html';
        const expectedURL = 'chrome-extension://test-id/popup.html';
        
        const result = mockChromeAPIWrapper.getExtensionURL(path);
        
        expect(result).toBe(expectedURL);
        expect(chrome.runtime.getURL).toHaveBeenCalledWith(path);
      });
    });
    
    describe('sendMessage', () => {
      test('should send message successfully', async () => {
        const message = { type: 'test', data: 'hello' };
        const response = { success: true };
        
        chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
          callback(response);
        });
        
        const result = await mockChromeAPIWrapper.sendMessage(message);
        
        expect(result).toEqual(response);
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(message, expect.any(Function));
      });
      
      test('should reject empty message', async () => {
        await expect(mockChromeAPIWrapper.sendMessage(null)).rejects.toThrow('Message is required');
        await expect(mockChromeAPIWrapper.sendMessage(undefined)).rejects.toThrow('Message is required');
      });
    });
  });
  
  describe('Action Functions', () => {
    describe('setBadgeText', () => {
      test('should set badge text successfully', async () => {
        const text = 'Test';
        
        chrome.action.setBadgeText.mockImplementation((details, callback) => {
          callback();
        });
        
        await expect(mockChromeAPIWrapper.setBadgeText(text)).resolves.toBeUndefined();
        expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text }, expect.any(Function));
      });
    });
    
    describe('setBadgeBackgroundColor', () => {
      test('should set badge background color successfully', async () => {
        const color = '#FF0000';
        
        chrome.action.setBadgeBackgroundColor.mockImplementation((details, callback) => {
          callback();
        });
        
        await expect(mockChromeAPIWrapper.setBadgeBackgroundColor(color)).resolves.toBeUndefined();
        expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color }, expect.any(Function));
      });
    });
  });
  
  describe('Permission Functions', () => {
    describe('requestPermissions', () => {
      test('should request permissions successfully', async () => {
        const permissions = { permissions: ['tabs'] };
        const granted = true;
        
        chrome.permissions.request.mockImplementation((perms, callback) => {
          callback(granted);
        });
        
        const result = await mockChromeAPIWrapper.requestPermissions(permissions);
        
        expect(result).toBe(granted);
        expect(chrome.permissions.request).toHaveBeenCalledWith(permissions, expect.any(Function));
      });
    });
    
    describe('hasPermissions', () => {
      test('should check permissions successfully', async () => {
        const permissions = { permissions: ['tabs'] };
        const hasPermissions = true;
        
        chrome.permissions.contains.mockImplementation((perms, callback) => {
          callback(hasPermissions);
        });
        
        const result = await mockChromeAPIWrapper.hasPermissions(permissions);
        
        expect(result).toBe(hasPermissions);
        expect(chrome.permissions.contains).toHaveBeenCalledWith(permissions, expect.any(Function));
      });
    });
  });
  
  describe('Integration Scenarios', () => {
    test('should complete tab workflow', async () => {
      const url = 'https://example.com';
      const mockTab = createMockTab({ url });
      
      // Create tab
      chrome.tabs.create.mockImplementation((createProperties, callback) => {
        callback(mockTab);
      });
      
      const createdTab = await mockChromeAPIWrapper.createTab(url);
      expect(createdTab).toEqual(mockTab);
      
      // Update tab
      const updateProperties = { active: false };
      chrome.tabs.update.mockImplementation((id, properties, callback) => {
        callback({ ...mockTab, ...updateProperties });
      });
      
      const updatedTab = await mockChromeAPIWrapper.updateTab(mockTab.id, updateProperties);
      expect(updatedTab.active).toBe(false);
      
      // Send message to tab
      const message = { type: 'test' };
      const response = { success: true };
      chrome.tabs.sendMessage.mockImplementation((id, msg, callback) => {
        callback(response);
      });
      
      const messageResponse = await mockChromeAPIWrapper.sendMessageToTab(mockTab.id, message);
      expect(messageResponse).toEqual(response);
    });
    
    test('should handle error scenarios gracefully', async () => {
      const url = 'https://example.com';
      const error = new Error('Chrome API error');
      
      // Mock Chrome API error
      chrome.runtime.lastError = error;
      chrome.tabs.create.mockImplementation((createProperties, callback) => {
        callback(null);
      });
      
      await expect(mockChromeAPIWrapper.createTab(url)).rejects.toThrow('Chrome API error');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
}); * Chrome API Wrapper Unit Tests
 * Tests for Chrome Extension API wrapper functions and utilities
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock Chrome API wrapper module (this would be imported from the actual source)
const mockChromeAPIWrapper = {
  // Tab management functions
  createTab: async (url, active = true) => {
    return new Promise((resolve, reject) => {
      if (!url || typeof url !== 'string') {
        reject(new Error('URL is required and must be a string'));
        return;
      }
      
      chrome.tabs.create({ url, active }, (tab) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(tab);
        }
      });
    });
  },
  
  updateTab: async (tabId, updateProperties) => {
    return new Promise((resolve, reject) => {
      if (!tabId || typeof tabId !== 'number') {
        reject(new Error('Tab ID is required and must be a number'));
        return;
      }
      
      chrome.tabs.update(tabId, updateProperties, (tab) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(tab);
        }
      });
    });
  },
  
  queryTabs: async (queryInfo) => {
    return new Promise((resolve, reject) => {
      chrome.tabs.query(queryInfo, (tabs) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(tabs);
        }
      });
    });
  },
  
  sendMessageToTab: async (tabId, message) => {
    return new Promise((resolve, reject) => {
      if (!tabId || typeof tabId !== 'number') {
        reject(new Error('Tab ID is required and must be a number'));
        return;
      }
      
      if (!message) {
        reject(new Error('Message is required'));
        return;
      }
      
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  },
  
  executeScriptInTab: async (tabId, details) => {
    return new Promise((resolve, reject) => {
      if (!tabId || typeof tabId !== 'number') {
        reject(new Error('Tab ID is required and must be a number'));
        return;
      }
      
      chrome.tabs.executeScript(tabId, details, (results) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(results);
        }
      });
    });
  },
  
  // Window management functions
  createWindow: async (createData) => {
    return new Promise((resolve, reject) => {
      chrome.windows.create(createData, (window) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(window);
        }
      });
    });
  },
  
  updateWindow: async (windowId, updateInfo) => {
    return new Promise((resolve, reject) => {
      if (!windowId || typeof windowId !== 'number') {
        reject(new Error('Window ID is required and must be a number'));
        return;
      }
      
      chrome.windows.update(windowId, updateInfo, (window) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(window);
        }
      });
    });
  },
  
  getCurrentWindow: async () => {
    return new Promise((resolve, reject) => {
      chrome.windows.getCurrent((window) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(window);
        }
      });
    });
  },
  
  // Storage functions
  getStorageData: async (keys) => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (data) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(data);
        }
      });
    });
  },
  
  setStorageData: async (data) => {
    return new Promise((resolve, reject) => {
      if (!data || typeof data !== 'object') {
        reject(new Error('Data is required and must be an object'));
        return;
      }
      
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },
  
  removeStorageData: async (keys) => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },
  
  // Runtime functions
  getExtensionURL: (path) => {
    return chrome.runtime.getURL(path);
  },
  
  sendMessage: async (message) => {
    return new Promise((resolve, reject) => {
      if (!message) {
        reject(new Error('Message is required'));
        return;
      }
      
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  },
  
  // Action functions
  setBadgeText: async (text) => {
    return new Promise((resolve, reject) => {
      chrome.action.setBadgeText({ text }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },
  
  setBadgeBackgroundColor: async (color) => {
    return new Promise((resolve, reject) => {
      chrome.action.setBadgeBackgroundColor({ color }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },
  
  // Permission functions
  requestPermissions: async (permissions) => {
    return new Promise((resolve, reject) => {
      chrome.permissions.request(permissions, (granted) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(granted);
        }
      });
    });
  },
  
  hasPermissions: async (permissions) => {
    return new Promise((resolve, reject) => {
      chrome.permissions.contains(permissions, (hasPermissions) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(hasPermissions);
        }
      });
    });
  }
};

describe('Chrome API Wrapper', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Tab Management', () => {
    describe('createTab', () => {
      test('should create a new tab successfully', async () => {
        const url = 'https://example.com';
        const mockTab = createMockTab({ url });
        
        chrome.tabs.create.mockImplementation((createProperties, callback) => {
          callback(mockTab);
        });
        
        const result = await mockChromeAPIWrapper.createTab(url);
        
        expect(result).toEqual(mockTab);
        expect(chrome.tabs.create).toHaveBeenCalledWith({ url, active: true }, expect.any(Function));
      });
      
      test('should create an inactive tab when specified', async () => {
        const url = 'https://example.com';
        const mockTab = createMockTab({ url, active: false });
        
        chrome.tabs.create.mockImplementation((createProperties, callback) => {
          callback(mockTab);
        });
        
        const result = await mockChromeAPIWrapper.createTab(url, false);
        
        expect(result).toEqual(mockTab);
        expect(chrome.tabs.create).toHaveBeenCalledWith({ url, active: false }, expect.any(Function));
      });
      
      test('should reject invalid URL', async () => {
        await expect(mockChromeAPIWrapper.createTab(null)).rejects.toThrow('URL is required and must be a string');
        await expect(mockChromeAPIWrapper.createTab(undefined)).rejects.toThrow('URL is required and must be a string');
        await expect(mockChromeAPIWrapper.createTab(123)).rejects.toThrow('URL is required and must be a string');
      });
      
      test('should handle Chrome API errors', async () => {
        const url = 'https://example.com';
        const error = new Error('Tab creation failed');
        
        chrome.runtime.lastError = error;
        chrome.tabs.create.mockImplementation((createProperties, callback) => {
          callback(null);
        });
        
        await expect(mockChromeAPIWrapper.createTab(url)).rejects.toThrow('Tab creation failed');
        
        // Reset lastError
        chrome.runtime.lastError = null;
      });
    });
    
    describe('updateTab', () => {
      test('should update a tab successfully', async () => {
        const tabId = 123;
        const updateProperties = { url: 'https://updated.com' };
        const mockTab = createMockTab({ id: tabId, ...updateProperties });
        
        chrome.tabs.update.mockImplementation((id, properties, callback) => {
          callback(mockTab);
        });
        
        const result = await mockChromeAPIWrapper.updateTab(tabId, updateProperties);
        
        expect(result).toEqual(mockTab);
        expect(chrome.tabs.update).toHaveBeenCalledWith(tabId, updateProperties, expect.any(Function));
      });
      
      test('should reject invalid tab ID', async () => {
        const updateProperties = { url: 'https://updated.com' };
        
        await expect(mockChromeAPIWrapper.updateTab(null, updateProperties)).rejects.toThrow('Tab ID is required and must be a number');
        await expect(mockChromeAPIWrapper.updateTab(undefined, updateProperties)).rejects.toThrow('Tab ID is required and must be a number');
        await expect(mockChromeAPIWrapper.updateTab('invalid', updateProperties)).rejects.toThrow('Tab ID is required and must be a number');
      });
    });
    
    describe('queryTabs', () => {
      test('should query tabs successfully', async () => {
        const queryInfo = { active: true };
        const mockTabs = [createMockTab(), createMockTab()];
        
        chrome.tabs.query.mockImplementation((info, callback) => {
          callback(mockTabs);
        });
        
        const result = await mockChromeAPIWrapper.queryTabs(queryInfo);
        
        expect(result).toEqual(mockTabs);
        expect(chrome.tabs.query).toHaveBeenCalledWith(queryInfo, expect.any(Function));
      });
    });
    
    describe('sendMessageToTab', () => {
      test('should send message to tab successfully', async () => {
        const tabId = 123;
        const message = { type: 'test', data: 'hello' };
        const response = { success: true };
        
        chrome.tabs.sendMessage.mockImplementation((id, msg, callback) => {
          callback(response);
        });
        
        const result = await mockChromeAPIWrapper.sendMessageToTab(tabId, message);
        
        expect(result).toEqual(response);
        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(tabId, message, expect.any(Function));
      });
      
      test('should reject invalid tab ID', async () => {
        const message = { type: 'test' };
        
        await expect(mockChromeAPIWrapper.sendMessageToTab(null, message)).rejects.toThrow('Tab ID is required and must be a number');
        await expect(mockChromeAPIWrapper.sendMessageToTab(undefined, message)).rejects.toThrow('Tab ID is required and must be a number');
      });
      
      test('should reject empty message', async () => {
        const tabId = 123;
        
        await expect(mockChromeAPIWrapper.sendMessageToTab(tabId, null)).rejects.toThrow('Message is required');
        await expect(mockChromeAPIWrapper.sendMessageToTab(tabId, undefined)).rejects.toThrow('Message is required');
      });
    });
    
    describe('executeScriptInTab', () => {
      test('should execute script in tab successfully', async () => {
        const tabId = 123;
        const details = { code: 'console.log("test")' };
        const results = [{ result: 'success' }];
        
        chrome.tabs.executeScript.mockImplementation((id, det, callback) => {
          callback(results);
        });
        
        const result = await mockChromeAPIWrapper.executeScriptInTab(tabId, details);
        
        expect(result).toEqual(results);
        expect(chrome.tabs.executeScript).toHaveBeenCalledWith(tabId, details, expect.any(Function));
      });
      
      test('should reject invalid tab ID', async () => {
        const details = { code: 'console.log("test")' };
        
        await expect(mockChromeAPIWrapper.executeScriptInTab(null, details)).rejects.toThrow('Tab ID is required and must be a number');
      });
    });
  });
  
  describe('Window Management', () => {
    describe('createWindow', () => {
      test('should create a new window successfully', async () => {
        const createData = { url: 'https://example.com', type: 'popup' };
        const mockWindow = createMockWindow(createData);
        
        chrome.windows.create.mockImplementation((data, callback) => {
          callback(mockWindow);
        });
        
        const result = await mockChromeAPIWrapper.createWindow(createData);
        
        expect(result).toEqual(mockWindow);
        expect(chrome.windows.create).toHaveBeenCalledWith(createData, expect.any(Function));
      });
    });
    
    describe('updateWindow', () => {
      test('should update a window successfully', async () => {
        const windowId = 456;
        const updateInfo = { focused: true };
        const mockWindow = createMockWindow({ id: windowId, ...updateInfo });
        
        chrome.windows.update.mockImplementation((id, info, callback) => {
          callback(mockWindow);
        });
        
        const result = await mockChromeAPIWrapper.updateWindow(windowId, updateInfo);
        
        expect(result).toEqual(mockWindow);
        expect(chrome.windows.update).toHaveBeenCalledWith(windowId, updateInfo, expect.any(Function));
      });
      
      test('should reject invalid window ID', async () => {
        const updateInfo = { focused: true };
        
        await expect(mockChromeAPIWrapper.updateWindow(null, updateInfo)).rejects.toThrow('Window ID is required and must be a number');
        await expect(mockChromeAPIWrapper.updateWindow(undefined, updateInfo)).rejects.toThrow('Window ID is required and must be a number');
      });
    });
    
    describe('getCurrentWindow', () => {
      test('should get current window successfully', async () => {
        const mockWindow = createMockWindow();
        
        chrome.windows.getCurrent.mockImplementation((callback) => {
          callback(mockWindow);
        });
        
        const result = await mockChromeAPIWrapper.getCurrentWindow();
        
        expect(result).toEqual(mockWindow);
        expect(chrome.windows.getCurrent).toHaveBeenCalledWith(expect.any(Function));
      });
    });
  });
  
  describe('Storage Management', () => {
    describe('getStorageData', () => {
      test('should get storage data successfully', async () => {
        const keys = ['test-key'];
        const data = { 'test-key': 'test-value' };
        
        chrome.storage.local.get.mockImplementation((k, callback) => {
          callback(data);
        });
        
        const result = await mockChromeAPIWrapper.getStorageData(keys);
        
        expect(result).toEqual(data);
        expect(chrome.storage.local.get).toHaveBeenCalledWith(keys, expect.any(Function));
      });
    });
    
    describe('setStorageData', () => {
      test('should set storage data successfully', async () => {
        const data = { 'test-key': 'test-value' };
        
        chrome.storage.local.set.mockImplementation((d, callback) => {
          callback();
        });
        
        await expect(mockChromeAPIWrapper.setStorageData(data)).resolves.toBeUndefined();
        expect(chrome.storage.local.set).toHaveBeenCalledWith(data, expect.any(Function));
      });
      
      test('should reject invalid data', async () => {
        await expect(mockChromeAPIWrapper.setStorageData(null)).rejects.toThrow('Data is required and must be an object');
        await expect(mockChromeAPIWrapper.setStorageData(undefined)).rejects.toThrow('Data is required and must be an object');
        await expect(mockChromeAPIWrapper.setStorageData('invalid')).rejects.toThrow('Data is required and must be an object');
      });
    });
    
    describe('removeStorageData', () => {
      test('should remove storage data successfully', async () => {
        const keys = ['test-key'];
        
        chrome.storage.local.remove.mockImplementation((k, callback) => {
          callback();
        });
        
        await expect(mockChromeAPIWrapper.removeStorageData(keys)).resolves.toBeUndefined();
        expect(chrome.storage.local.remove).toHaveBeenCalledWith(keys, expect.any(Function));
      });
    });
  });
  
  describe('Runtime Functions', () => {
    describe('getExtensionURL', () => {
      test('should get extension URL', () => {
        const path = 'popup.html';
        const expectedURL = 'chrome-extension://test-id/popup.html';
        
        const result = mockChromeAPIWrapper.getExtensionURL(path);
        
        expect(result).toBe(expectedURL);
        expect(chrome.runtime.getURL).toHaveBeenCalledWith(path);
      });
    });
    
    describe('sendMessage', () => {
      test('should send message successfully', async () => {
        const message = { type: 'test', data: 'hello' };
        const response = { success: true };
        
        chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
          callback(response);
        });
        
        const result = await mockChromeAPIWrapper.sendMessage(message);
        
        expect(result).toEqual(response);
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(message, expect.any(Function));
      });
      
      test('should reject empty message', async () => {
        await expect(mockChromeAPIWrapper.sendMessage(null)).rejects.toThrow('Message is required');
        await expect(mockChromeAPIWrapper.sendMessage(undefined)).rejects.toThrow('Message is required');
      });
    });
  });
  
  describe('Action Functions', () => {
    describe('setBadgeText', () => {
      test('should set badge text successfully', async () => {
        const text = 'Test';
        
        chrome.action.setBadgeText.mockImplementation((details, callback) => {
          callback();
        });
        
        await expect(mockChromeAPIWrapper.setBadgeText(text)).resolves.toBeUndefined();
        expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text }, expect.any(Function));
      });
    });
    
    describe('setBadgeBackgroundColor', () => {
      test('should set badge background color successfully', async () => {
        const color = '#FF0000';
        
        chrome.action.setBadgeBackgroundColor.mockImplementation((details, callback) => {
          callback();
        });
        
        await expect(mockChromeAPIWrapper.setBadgeBackgroundColor(color)).resolves.toBeUndefined();
        expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color }, expect.any(Function));
      });
    });
  });
  
  describe('Permission Functions', () => {
    describe('requestPermissions', () => {
      test('should request permissions successfully', async () => {
        const permissions = { permissions: ['tabs'] };
        const granted = true;
        
        chrome.permissions.request.mockImplementation((perms, callback) => {
          callback(granted);
        });
        
        const result = await mockChromeAPIWrapper.requestPermissions(permissions);
        
        expect(result).toBe(granted);
        expect(chrome.permissions.request).toHaveBeenCalledWith(permissions, expect.any(Function));
      });
    });
    
    describe('hasPermissions', () => {
      test('should check permissions successfully', async () => {
        const permissions = { permissions: ['tabs'] };
        const hasPermissions = true;
        
        chrome.permissions.contains.mockImplementation((perms, callback) => {
          callback(hasPermissions);
        });
        
        const result = await mockChromeAPIWrapper.hasPermissions(permissions);
        
        expect(result).toBe(hasPermissions);
        expect(chrome.permissions.contains).toHaveBeenCalledWith(permissions, expect.any(Function));
      });
    });
  });
  
  describe('Integration Scenarios', () => {
    test('should complete tab workflow', async () => {
      const url = 'https://example.com';
      const mockTab = createMockTab({ url });
      
      // Create tab
      chrome.tabs.create.mockImplementation((createProperties, callback) => {
        callback(mockTab);
      });
      
      const createdTab = await mockChromeAPIWrapper.createTab(url);
      expect(createdTab).toEqual(mockTab);
      
      // Update tab
      const updateProperties = { active: false };
      chrome.tabs.update.mockImplementation((id, properties, callback) => {
        callback({ ...mockTab, ...updateProperties });
      });
      
      const updatedTab = await mockChromeAPIWrapper.updateTab(mockTab.id, updateProperties);
      expect(updatedTab.active).toBe(false);
      
      // Send message to tab
      const message = { type: 'test' };
      const response = { success: true };
      chrome.tabs.sendMessage.mockImplementation((id, msg, callback) => {
        callback(response);
      });
      
      const messageResponse = await mockChromeAPIWrapper.sendMessageToTab(mockTab.id, message);
      expect(messageResponse).toEqual(response);
    });
    
    test('should handle error scenarios gracefully', async () => {
      const url = 'https://example.com';
      const error = new Error('Chrome API error');
      
      // Mock Chrome API error
      chrome.runtime.lastError = error;
      chrome.tabs.create.mockImplementation((createProperties, callback) => {
        callback(null);
      });
      
      await expect(mockChromeAPIWrapper.createTab(url)).rejects.toThrow('Chrome API error');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
});
