/**
 * Content Script Message Handler Unit Tests
 * Tests for content script message handling and DOM manipulation
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockEvent, createMockMessage } = require('../utils/test-helpers');

// Mock content script module (this would be imported from the actual source)
const mockContentScript = {
  // Message handling
  messageHandlers: {
    navigate: async (data) => {
      if (!data.url) {
        throw new Error('URL is required for navigation');
      }
      window.location.href = data.url;
      return { success: true, url: data.url };
    },
    
    click: async (data) => {
      if (!data.element) {
        throw new Error('Element selector is required for click');
      }
      
      const element = document.querySelector(data.element);
      if (!element) {
        throw new Error(`Element not found: ${data.element}`);
      }
      
      element.click();
      return { success: true, element: data.element };
    },
    
    fill: async (data) => {
      if (!data.field) {
        throw new Error('Field selector is required for fill');
      }
      
      if (!data.value) {
        throw new Error('Value is required for fill');
      }
      
      const element = document.querySelector(data.field);
      if (!element) {
        throw new Error(`Field not found: ${data.field}`);
      }
      
      if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
        element.value = data.value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        throw new Error('Field must be an input or textarea element');
      }
      
      return { success: true, field: data.field, value: data.value };
    },
    
    search: async (data) => {
      if (!data.query) {
        throw new Error('Query is required for search');
      }
      
      // Look for common search input selectors
      const searchSelectors = [
        'input[name="q"]',
        'input[name="query"]',
        'input[placeholder*="search"]',
        'input[type="search"]',
        '#search',
        '.search-input',
        'input[aria-label*="search"]'
      ];
      
      let searchInput = null;
      for (const selector of searchSelectors) {
        searchInput = document.querySelector(selector);
        if (searchInput) break;
      }
      
      if (!searchInput) {
        throw new Error('Search input not found');
      }
      
      searchInput.value = data.query;
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Look for search button
      const searchButton = document.querySelector('button[type="submit"], input[type="submit"], .search-button');
      if (searchButton) {
        searchButton.click();
      } else {
        // Try to submit the form
        const form = searchInput.closest('form');
        if (form) {
          form.submit();
        }
      }
      
      return { success: true, query: data.query };
    },
    
    getText: async (data) => {
      if (!data.element) {
        throw new Error('Element selector is required for getText');
      }
      
      const element = document.querySelector(data.element);
      if (!element) {
        throw new Error(`Element not found: ${data.element}`);
      }
      
      return { success: true, text: element.textContent.trim() };
    },
    
    waitForElement: async (data) => {
      if (!data.element) {
        throw new Error('Element selector is required for waitForElement');
      }
      
      const timeout = data.timeout || 5000;
      const startTime = Date.now();
      
      return new Promise((resolve, reject) => {
        const checkElement = () => {
          const element = document.querySelector(data.element);
          if (element) {
            resolve({ success: true, element: data.element });
          } else if (Date.now() - startTime > timeout) {
            reject(new Error(`Element not found within timeout: ${data.element}`));
          } else {
            setTimeout(checkElement, 100);
          }
        };
        
        checkElement();
      });
    }
  },
  
  // Main message handler
  handleMessage: async (message, sender, sendResponse) => {
    try {
      if (!message || !message.type) {
        throw new Error('Message must have a type');
      }
      
      const handler = mockContentScript.messageHandlers[message.type];
      if (!handler) {
        throw new Error(`Unknown message type: ${message.type}`);
      }
      
      const result = await handler(message.data);
      sendResponse({ success: true, result });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  },
  
  // Initialize content script
  initialize: () => {
    // Add message listener
    chrome.runtime.onMessage.addListener(mockContentScript.handleMessage);
    
    // Notify background script that content script is ready
    chrome.runtime.sendMessage({ type: 'contentScriptReady' });
  },
  
  // Cleanup
  cleanup: () => {
    chrome.runtime.onMessage.removeListener(mockContentScript.handleMessage);
  }
};

describe('Content Script Message Handler', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Set up basic DOM structure
    document.body.innerHTML = `
      <form id="test-form">
        <input type="text" name="username" id="username" placeholder="Username">
        <input type="search" name="q" id="search" placeholder="Search">
        <textarea name="message" id="message" placeholder="Message"></textarea>
        <button type="submit" id="submit-btn">Submit</button>
        <div id="result">Result text</div>
      </form>
    `;
    
    // Mock window.location
    delete window.location;
    window.location = { href: 'http://example.com' };
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Message Handlers', () => {
    describe('navigate', () => {
      test('should navigate to new URL', async () => {
        const data = { url: 'https://example.com' };
        const result = await mockContentScript.messageHandlers.navigate(data);
        
        expect(result.success).toBe(true);
        expect(result.url).toBe('https://example.com');
        expect(window.location.href).toBe('https://example.com');
      });
      
      test('should reject navigation without URL', async () => {
        const data = {};
        
        await expect(mockContentScript.messageHandlers.navigate(data)).rejects.toThrow('URL is required for navigation');
      });
    });
    
    describe('click', () => {
      test('should click element successfully', async () => {
        const data = { element: '#submit-btn' };
        const mockButton = document.querySelector('#submit-btn');
        const clickSpy = jest.spyOn(mockButton, 'click');
        
        const result = await mockContentScript.messageHandlers.click(data);
        
        expect(result.success).toBe(true);
        expect(result.element).toBe('#submit-btn');
        expect(clickSpy).toHaveBeenCalled();
      });
      
      test('should reject click without element selector', async () => {
        const data = {};
        
        await expect(mockContentScript.messageHandlers.click(data)).rejects.toThrow('Element selector is required for click');
      });
      
      test('should reject click for non-existent element', async () => {
        const data = { element: '#non-existent' };
        
        await expect(mockContentScript.messageHandlers.click(data)).rejects.toThrow('Element not found: #non-existent');
      });
    });
    
    describe('fill', () => {
      test('should fill input field successfully', async () => {
        const data = { field: '#username', value: 'testuser' };
        const mockInput = document.querySelector('#username');
        const inputSpy = jest.spyOn(mockInput, 'value', 'set');
        
        const result = await mockContentScript.messageHandlers.fill(data);
        
        expect(result.success).toBe(true);
        expect(result.field).toBe('#username');
        expect(result.value).toBe('testuser');
        expect(mockInput.value).toBe('testuser');
      });
      
      test('should fill textarea successfully', async () => {
        const data = { field: '#message', value: 'test message' };
        const mockTextarea = document.querySelector('#message');
        
        const result = await mockContentScript.messageHandlers.fill(data);
        
        expect(result.success).toBe(true);
        expect(result.field).toBe('#message');
        expect(result.value).toBe('test message');
        expect(mockTextarea.value).toBe('test message');
      });
      
      test('should reject fill without field selector', async () => {
        const data = { value: 'test' };
        
        await expect(mockContentScript.messageHandlers.fill(data)).rejects.toThrow('Field selector is required for fill');
      });
      
      test('should reject fill without value', async () => {
        const data = { field: '#username' };
        
        await expect(mockContentScript.messageHandlers.fill(data)).rejects.toThrow('Value is required for fill');
      });
      
      test('should reject fill for non-existent element', async () => {
        const data = { field: '#non-existent', value: 'test' };
        
        await expect(mockContentScript.messageHandlers.fill(data)).rejects.toThrow('Field not found: #non-existent');
      });
      
      test('should reject fill for non-input element', async () => {
        const data = { field: '#result', value: 'test' };
        
        await expect(mockContentScript.messageHandlers.fill(data)).rejects.toThrow('Field must be an input or textarea element');
      });
    });
    
    describe('search', () => {
      test('should perform search successfully', async () => {
        const data = { query: 'test search' };
        const mockSearchInput = document.querySelector('#search');
        const mockForm = document.querySelector('#test-form');
        const formSpy = jest.spyOn(mockForm, 'submit');
        
        const result = await mockContentScript.messageHandlers.search(data);
        
        expect(result.success).toBe(true);
        expect(result.query).toBe('test search');
        expect(mockSearchInput.value).toBe('test search');
        expect(formSpy).toHaveBeenCalled();
      });
      
      test('should reject search without query', async () => {
        const data = {};
        
        await expect(mockContentScript.messageHandlers.search(data)).rejects.toThrow('Query is required for search');
      });
      
      test('should reject search when no search input found', async () => {
        // Remove search input from DOM
        document.querySelector('#search').remove();
        
        const data = { query: 'test search' };
        
        await expect(mockContentScript.messageHandlers.search(data)).rejects.toThrow('Search input not found');
      });
    });
    
    describe('getText', () => {
      test('should get text from element successfully', async () => {
        const data = { element: '#result' };
        const result = await mockContentScript.messageHandlers.getText(data);
        
        expect(result.success).toBe(true);
        expect(result.text).toBe('Result text');
      });
      
      test('should reject getText without element selector', async () => {
        const data = {};
        
        await expect(mockContentScript.messageHandlers.getText(data)).rejects.toThrow('Element selector is required for getText');
      });
      
      test('should reject getText for non-existent element', async () => {
        const data = { element: '#non-existent' };
        
        await expect(mockContentScript.messageHandlers.getText(data)).rejects.toThrow('Element not found: #non-existent');
      });
    });
    
    describe('waitForElement', () => {
      test('should wait for existing element', async () => {
        const data = { element: '#result' };
        const result = await mockContentScript.messageHandlers.waitForElement(data);
        
        expect(result.success).toBe(true);
        expect(result.element).toBe('#result');
      });
      
      test('should wait for dynamically added element', async () => {
        const data = { element: '#dynamic-element', timeout: 1000 };
        
        // Add element after a delay
        setTimeout(() => {
          const div = document.createElement('div');
          div.id = 'dynamic-element';
          div.textContent = 'Dynamic content';
          document.body.appendChild(div);
        }, 200);
        
        const result = await mockContentScript.messageHandlers.waitForElement(data);
        
        expect(result.success).toBe(true);
        expect(result.element).toBe('#dynamic-element');
        expect(document.querySelector('#dynamic-element')).toBeTruthy();
      });
      
      test('should timeout waiting for element', async () => {
        const data = { element: '#non-existent', timeout: 100 };
        
        await expect(mockContentScript.messageHandlers.waitForElement(data)).rejects.toThrow('Element not found within timeout: #non-existent');
      });
      
      test('should reject waitForElement without selector', async () => {
        const data = {};
        
        await expect(mockContentScript.messageHandlers.waitForElement(data)).rejects.toThrow('Element selector is required for waitForElement');
      });
    });
  });
  
  describe('Main Message Handler', () => {
    test('should handle valid message successfully', async () => {
      const message = createMockMessage('click', { element: '#submit-btn' });
      const sendResponse = jest.fn();
      
      await mockContentScript.handleMessage(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        result: { success: true, element: '#submit-btn' }
      });
    });
    
    test('should handle message without type', async () => {
      const message = { data: { element: '#submit-btn' } };
      const sendResponse = jest.fn();
      
      await mockContentScript.handleMessage(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Message must have a type'
      });
    });
    
    test('should handle unknown message type', async () => {
      const message = createMockMessage('unknownType', { data: 'test' });
      const sendResponse = jest.fn();
      
      await mockContentScript.handleMessage(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Unknown message type: unknownType'
      });
    });
    
    test('should handle handler errors gracefully', async () => {
      const message = createMockMessage('click', {}); // Missing element
      const sendResponse = jest.fn();
      
      await mockContentScript.handleMessage(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Element selector is required for click'
      });
    });
  });
  
  describe('Initialization and Cleanup', () => {
    test('should initialize content script', () => {
      mockContentScript.initialize();
      
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(mockContentScript.handleMessage);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'contentScriptReady'
      });
    });
    
    test('should cleanup content script', () => {
      mockContentScript.cleanup();
      
      expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalledWith(mockContentScript.handleMessage);
    });
  });
  
  describe('Integration Scenarios', () => {
    test('should handle form filling workflow', async () => {
      // Fill username
      const fillResult = await mockContentScript.messageHandlers.fill({
        field: '#username',
        value: 'testuser'
      });
      expect(fillResult.success).toBe(true);
      
      // Fill message
      const messageResult = await mockContentScript.messageHandlers.fill({
        field: '#message',
        value: 'test message'
      });
      expect(messageResult.success).toBe(true);
      
      // Click submit button
      const clickResult = await mockContentScript.messageHandlers.click({
        element: '#submit-btn'
      });
      expect(clickResult.success).toBe(true);
      
      // Verify values
      expect(document.querySelector('#username').value).toBe('testuser');
      expect(document.querySelector('#message').value).toBe('test message');
    });
    
    test('should handle search workflow', async () => {
      const searchResult = await mockContentScript.messageHandlers.search({
        query: 'Chrome extensions'
      });
      
      expect(searchResult.success).toBe(true);
      expect(searchResult.query).toBe('Chrome extensions');
      expect(document.querySelector('#search').value).toBe('Chrome extensions');
    });
    
    test('should handle dynamic content workflow', async () => {
      // Add dynamic element after delay
      setTimeout(() => {
        const div = document.createElement('div');
        div.id = 'dynamic-content';
        div.textContent = 'Dynamic result';
        document.body.appendChild(div);
      }, 100);
      
      // Wait for element
      const waitResult = await mockContentScript.messageHandlers.waitForElement({
        element: '#dynamic-content',
        timeout: 1000
      });
      expect(waitResult.success).toBe(true);
      
      // Get text from element
      const textResult = await mockContentScript.messageHandlers.getText({
        element: '#dynamic-content'
      });
      expect(textResult.success).toBe(true);
      expect(textResult.text).toBe('Dynamic result');
    });
  });
}); * Content Script Message Handler Unit Tests
 * Tests for content script message handling and DOM manipulation
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockEvent, createMockMessage } = require('../utils/test-helpers');

// Mock content script module (this would be imported from the actual source)
const mockContentScript = {
  // Message handling
  messageHandlers: {
    navigate: async (data) => {
      if (!data.url) {
        throw new Error('URL is required for navigation');
      }
      window.location.href = data.url;
      return { success: true, url: data.url };
    },
    
    click: async (data) => {
      if (!data.element) {
        throw new Error('Element selector is required for click');
      }
      
      const element = document.querySelector(data.element);
      if (!element) {
        throw new Error(`Element not found: ${data.element}`);
      }
      
      element.click();
      return { success: true, element: data.element };
    },
    
    fill: async (data) => {
      if (!data.field) {
        throw new Error('Field selector is required for fill');
      }
      
      if (!data.value) {
        throw new Error('Value is required for fill');
      }
      
      const element = document.querySelector(data.field);
      if (!element) {
        throw new Error(`Field not found: ${data.field}`);
      }
      
      if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
        element.value = data.value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        throw new Error('Field must be an input or textarea element');
      }
      
      return { success: true, field: data.field, value: data.value };
    },
    
    search: async (data) => {
      if (!data.query) {
        throw new Error('Query is required for search');
      }
      
      // Look for common search input selectors
      const searchSelectors = [
        'input[name="q"]',
        'input[name="query"]',
        'input[placeholder*="search"]',
        'input[type="search"]',
        '#search',
        '.search-input',
        'input[aria-label*="search"]'
      ];
      
      let searchInput = null;
      for (const selector of searchSelectors) {
        searchInput = document.querySelector(selector);
        if (searchInput) break;
      }
      
      if (!searchInput) {
        throw new Error('Search input not found');
      }
      
      searchInput.value = data.query;
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Look for search button
      const searchButton = document.querySelector('button[type="submit"], input[type="submit"], .search-button');
      if (searchButton) {
        searchButton.click();
      } else {
        // Try to submit the form
        const form = searchInput.closest('form');
        if (form) {
          form.submit();
        }
      }
      
      return { success: true, query: data.query };
    },
    
    getText: async (data) => {
      if (!data.element) {
        throw new Error('Element selector is required for getText');
      }
      
      const element = document.querySelector(data.element);
      if (!element) {
        throw new Error(`Element not found: ${data.element}`);
      }
      
      return { success: true, text: element.textContent.trim() };
    },
    
    waitForElement: async (data) => {
      if (!data.element) {
        throw new Error('Element selector is required for waitForElement');
      }
      
      const timeout = data.timeout || 5000;
      const startTime = Date.now();
      
      return new Promise((resolve, reject) => {
        const checkElement = () => {
          const element = document.querySelector(data.element);
          if (element) {
            resolve({ success: true, element: data.element });
          } else if (Date.now() - startTime > timeout) {
            reject(new Error(`Element not found within timeout: ${data.element}`));
          } else {
            setTimeout(checkElement, 100);
          }
        };
        
        checkElement();
      });
    }
  },
  
  // Main message handler
  handleMessage: async (message, sender, sendResponse) => {
    try {
      if (!message || !message.type) {
        throw new Error('Message must have a type');
      }
      
      const handler = mockContentScript.messageHandlers[message.type];
      if (!handler) {
        throw new Error(`Unknown message type: ${message.type}`);
      }
      
      const result = await handler(message.data);
      sendResponse({ success: true, result });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  },
  
  // Initialize content script
  initialize: () => {
    // Add message listener
    chrome.runtime.onMessage.addListener(mockContentScript.handleMessage);
    
    // Notify background script that content script is ready
    chrome.runtime.sendMessage({ type: 'contentScriptReady' });
  },
  
  // Cleanup
  cleanup: () => {
    chrome.runtime.onMessage.removeListener(mockContentScript.handleMessage);
  }
};

describe('Content Script Message Handler', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Set up basic DOM structure
    document.body.innerHTML = `
      <form id="test-form">
        <input type="text" name="username" id="username" placeholder="Username">
        <input type="search" name="q" id="search" placeholder="Search">
        <textarea name="message" id="message" placeholder="Message"></textarea>
        <button type="submit" id="submit-btn">Submit</button>
        <div id="result">Result text</div>
      </form>
    `;
    
    // Mock window.location
    delete window.location;
    window.location = { href: 'http://example.com' };
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Message Handlers', () => {
    describe('navigate', () => {
      test('should navigate to new URL', async () => {
        const data = { url: 'https://example.com' };
        const result = await mockContentScript.messageHandlers.navigate(data);
        
        expect(result.success).toBe(true);
        expect(result.url).toBe('https://example.com');
        expect(window.location.href).toBe('https://example.com');
      });
      
      test('should reject navigation without URL', async () => {
        const data = {};
        
        await expect(mockContentScript.messageHandlers.navigate(data)).rejects.toThrow('URL is required for navigation');
      });
    });
    
    describe('click', () => {
      test('should click element successfully', async () => {
        const data = { element: '#submit-btn' };
        const mockButton = document.querySelector('#submit-btn');
        const clickSpy = jest.spyOn(mockButton, 'click');
        
        const result = await mockContentScript.messageHandlers.click(data);
        
        expect(result.success).toBe(true);
        expect(result.element).toBe('#submit-btn');
        expect(clickSpy).toHaveBeenCalled();
      });
      
      test('should reject click without element selector', async () => {
        const data = {};
        
        await expect(mockContentScript.messageHandlers.click(data)).rejects.toThrow('Element selector is required for click');
      });
      
      test('should reject click for non-existent element', async () => {
        const data = { element: '#non-existent' };
        
        await expect(mockContentScript.messageHandlers.click(data)).rejects.toThrow('Element not found: #non-existent');
      });
    });
    
    describe('fill', () => {
      test('should fill input field successfully', async () => {
        const data = { field: '#username', value: 'testuser' };
        const mockInput = document.querySelector('#username');
        const inputSpy = jest.spyOn(mockInput, 'value', 'set');
        
        const result = await mockContentScript.messageHandlers.fill(data);
        
        expect(result.success).toBe(true);
        expect(result.field).toBe('#username');
        expect(result.value).toBe('testuser');
        expect(mockInput.value).toBe('testuser');
      });
      
      test('should fill textarea successfully', async () => {
        const data = { field: '#message', value: 'test message' };
        const mockTextarea = document.querySelector('#message');
        
        const result = await mockContentScript.messageHandlers.fill(data);
        
        expect(result.success).toBe(true);
        expect(result.field).toBe('#message');
        expect(result.value).toBe('test message');
        expect(mockTextarea.value).toBe('test message');
      });
      
      test('should reject fill without field selector', async () => {
        const data = { value: 'test' };
        
        await expect(mockContentScript.messageHandlers.fill(data)).rejects.toThrow('Field selector is required for fill');
      });
      
      test('should reject fill without value', async () => {
        const data = { field: '#username' };
        
        await expect(mockContentScript.messageHandlers.fill(data)).rejects.toThrow('Value is required for fill');
      });
      
      test('should reject fill for non-existent element', async () => {
        const data = { field: '#non-existent', value: 'test' };
        
        await expect(mockContentScript.messageHandlers.fill(data)).rejects.toThrow('Field not found: #non-existent');
      });
      
      test('should reject fill for non-input element', async () => {
        const data = { field: '#result', value: 'test' };
        
        await expect(mockContentScript.messageHandlers.fill(data)).rejects.toThrow('Field must be an input or textarea element');
      });
    });
    
    describe('search', () => {
      test('should perform search successfully', async () => {
        const data = { query: 'test search' };
        const mockSearchInput = document.querySelector('#search');
        const mockForm = document.querySelector('#test-form');
        const formSpy = jest.spyOn(mockForm, 'submit');
        
        const result = await mockContentScript.messageHandlers.search(data);
        
        expect(result.success).toBe(true);
        expect(result.query).toBe('test search');
        expect(mockSearchInput.value).toBe('test search');
        expect(formSpy).toHaveBeenCalled();
      });
      
      test('should reject search without query', async () => {
        const data = {};
        
        await expect(mockContentScript.messageHandlers.search(data)).rejects.toThrow('Query is required for search');
      });
      
      test('should reject search when no search input found', async () => {
        // Remove search input from DOM
        document.querySelector('#search').remove();
        
        const data = { query: 'test search' };
        
        await expect(mockContentScript.messageHandlers.search(data)).rejects.toThrow('Search input not found');
      });
    });
    
    describe('getText', () => {
      test('should get text from element successfully', async () => {
        const data = { element: '#result' };
        const result = await mockContentScript.messageHandlers.getText(data);
        
        expect(result.success).toBe(true);
        expect(result.text).toBe('Result text');
      });
      
      test('should reject getText without element selector', async () => {
        const data = {};
        
        await expect(mockContentScript.messageHandlers.getText(data)).rejects.toThrow('Element selector is required for getText');
      });
      
      test('should reject getText for non-existent element', async () => {
        const data = { element: '#non-existent' };
        
        await expect(mockContentScript.messageHandlers.getText(data)).rejects.toThrow('Element not found: #non-existent');
      });
    });
    
    describe('waitForElement', () => {
      test('should wait for existing element', async () => {
        const data = { element: '#result' };
        const result = await mockContentScript.messageHandlers.waitForElement(data);
        
        expect(result.success).toBe(true);
        expect(result.element).toBe('#result');
      });
      
      test('should wait for dynamically added element', async () => {
        const data = { element: '#dynamic-element', timeout: 1000 };
        
        // Add element after a delay
        setTimeout(() => {
          const div = document.createElement('div');
          div.id = 'dynamic-element';
          div.textContent = 'Dynamic content';
          document.body.appendChild(div);
        }, 200);
        
        const result = await mockContentScript.messageHandlers.waitForElement(data);
        
        expect(result.success).toBe(true);
        expect(result.element).toBe('#dynamic-element');
        expect(document.querySelector('#dynamic-element')).toBeTruthy();
      });
      
      test('should timeout waiting for element', async () => {
        const data = { element: '#non-existent', timeout: 100 };
        
        await expect(mockContentScript.messageHandlers.waitForElement(data)).rejects.toThrow('Element not found within timeout: #non-existent');
      });
      
      test('should reject waitForElement without selector', async () => {
        const data = {};
        
        await expect(mockContentScript.messageHandlers.waitForElement(data)).rejects.toThrow('Element selector is required for waitForElement');
      });
    });
  });
  
  describe('Main Message Handler', () => {
    test('should handle valid message successfully', async () => {
      const message = createMockMessage('click', { element: '#submit-btn' });
      const sendResponse = jest.fn();
      
      await mockContentScript.handleMessage(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        result: { success: true, element: '#submit-btn' }
      });
    });
    
    test('should handle message without type', async () => {
      const message = { data: { element: '#submit-btn' } };
      const sendResponse = jest.fn();
      
      await mockContentScript.handleMessage(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Message must have a type'
      });
    });
    
    test('should handle unknown message type', async () => {
      const message = createMockMessage('unknownType', { data: 'test' });
      const sendResponse = jest.fn();
      
      await mockContentScript.handleMessage(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Unknown message type: unknownType'
      });
    });
    
    test('should handle handler errors gracefully', async () => {
      const message = createMockMessage('click', {}); // Missing element
      const sendResponse = jest.fn();
      
      await mockContentScript.handleMessage(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Element selector is required for click'
      });
    });
  });
  
  describe('Initialization and Cleanup', () => {
    test('should initialize content script', () => {
      mockContentScript.initialize();
      
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(mockContentScript.handleMessage);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'contentScriptReady'
      });
    });
    
    test('should cleanup content script', () => {
      mockContentScript.cleanup();
      
      expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalledWith(mockContentScript.handleMessage);
    });
  });
  
  describe('Integration Scenarios', () => {
    test('should handle form filling workflow', async () => {
      // Fill username
      const fillResult = await mockContentScript.messageHandlers.fill({
        field: '#username',
        value: 'testuser'
      });
      expect(fillResult.success).toBe(true);
      
      // Fill message
      const messageResult = await mockContentScript.messageHandlers.fill({
        field: '#message',
        value: 'test message'
      });
      expect(messageResult.success).toBe(true);
      
      // Click submit button
      const clickResult = await mockContentScript.messageHandlers.click({
        element: '#submit-btn'
      });
      expect(clickResult.success).toBe(true);
      
      // Verify values
      expect(document.querySelector('#username').value).toBe('testuser');
      expect(document.querySelector('#message').value).toBe('test message');
    });
    
    test('should handle search workflow', async () => {
      const searchResult = await mockContentScript.messageHandlers.search({
        query: 'Chrome extensions'
      });
      
      expect(searchResult.success).toBe(true);
      expect(searchResult.query).toBe('Chrome extensions');
      expect(document.querySelector('#search').value).toBe('Chrome extensions');
    });
    
    test('should handle dynamic content workflow', async () => {
      // Add dynamic element after delay
      setTimeout(() => {
        const div = document.createElement('div');
        div.id = 'dynamic-content';
        div.textContent = 'Dynamic result';
        document.body.appendChild(div);
      }, 100);
      
      // Wait for element
      const waitResult = await mockContentScript.messageHandlers.waitForElement({
        element: '#dynamic-content',
        timeout: 1000
      });
      expect(waitResult.success).toBe(true);
      
      // Get text from element
      const textResult = await mockContentScript.messageHandlers.getText({
        element: '#dynamic-content'
      });
      expect(textResult.success).toBe(true);
      expect(textResult.text).toBe('Dynamic result');
    });
  });
});
