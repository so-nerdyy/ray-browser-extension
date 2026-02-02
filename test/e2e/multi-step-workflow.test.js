/**
 * Multi-Step Workflow E2E Tests
 * Tests for complex multi-step automation workflows end-to-end scenarios
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock E2E test framework (this would be imported from actual source)
const mockE2ETestFramework = {
  // Browser automation controller
  browser: {
    // Navigate to URL
    navigate: async (url) => {
      return new Promise((resolve, reject) => {
        chrome.tabs.update({ url }, (tab) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(tab);
          }
        });
      });
    },
    
    // Wait for navigation to complete
    waitForNavigation: async (tabId, timeout = 5000) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkNavigation = () => {
          chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else if (tab.status === 'complete') {
              resolve(tab);
            } else if (Date.now() - startTime > timeout) {
              reject(new Error(`Navigation timeout after ${timeout}ms`));
            } else {
              setTimeout(checkNavigation, 100);
            }
          });
        };
        
        checkNavigation();
      });
    },
    
    // Get current tab
    getCurrentTab: async () => {
      return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (tabs.length > 0) {
            resolve(tabs[0]);
          } else {
            reject(new Error('No active tab found'));
          }
        });
      });
    },
    
    // Create new tab
    createTab: async (url) => {
      return new Promise((resolve, reject) => {
        chrome.tabs.create({ url, active: true }, (tab) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(tab);
          }
        });
      });
    },
    
    // Fill form field
    fillField: async (tabId, selector, value) => {
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {
          type: 'fillField',
          data: { selector, value }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response && response.success) {
            resolve(response);
          } else {
            reject(new Error(`Failed to fill field: ${selector}`));
          }
        });
      });
    },
    
    // Click element
    clickElement: async (tabId, selector) => {
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {
          type: 'clickElement',
          data: { selector }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response && response.success) {
            resolve(response);
          } else {
            reject(new Error(`Failed to click element: ${selector}`));
          }
        });
      });
    },
    
    // Submit form
    submitForm: async (tabId, formSelector = 'form') => {
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {
          type: 'submitForm',
          data: { formSelector }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response && response.success) {
            resolve(response);
          } else {
            reject(new Error(`Failed to submit form: ${formSelector}`));
          }
        });
      });
    },
    
    // Wait for element to be visible
    waitForElement: async (tabId, selector, timeout = 5000) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkElement = () => {
          chrome.tabs.sendMessage(tabId, {
            type: 'checkElementVisible',
            data: { selector }
          }, (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else if (response && response.visible) {
              resolve(response);
            } else if (Date.now() - startTime > timeout) {
              reject(new Error(`Element visibility timeout after ${timeout}ms`));
            } else {
              setTimeout(checkElement, 100);
            }
          });
        };
        
        checkElement();
      });
    },
    
    // Get page content
    getPageContent: async (tabId) => {
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {
          type: 'getPageContent'
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });
    }
  },
  
  // Workflow engine
  workflowEngine: {
    // Execute workflow steps
    executeWorkflow: async (workflow) => {
      const results = [];
      
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        
        try {
          const result = await mockE2ETestFramework.workflowEngine.executeStep(step);
          results.push({
            step: i + 1,
            type: step.type,
            success: true,
            result: result
          });
        } catch (error) {
          results.push({
            step: i + 1,
            type: step.type,
            success: false,
            error: error.message
          });
          
          if (workflow.stopOnError) {
            break;
          }
        }
      }
      
      return {
        workflow: workflow.name,
        totalSteps: workflow.steps.length,
        results: results,
        success: results.every(r => r.success)
      };
    },
    
    // Execute individual step
    executeStep: async (step) => {
      const currentTab = await mockE2ETestFramework.browser.getCurrentTab();
      
      switch (step.type) {
        case 'navigate':
          await mockE2ETestFramework.browser.navigate(step.url);
          await mockE2ETestFramework.browser.waitForNavigation(currentTab.id);
          return { url: step.url, navigated: true };
          
        case 'fill':
          await mockE2ETestFramework.browser.fillField(
            currentTab.id,
            step.selector,
            step.value
          );
          return { selector: step.selector, value: step.value, filled: true };
          
        case 'click':
          await mockE2ETestFramework.browser.clickElement(
            currentTab.id,
            step.selector
          );
          return { selector: step.selector, clicked: true };
          
        case 'submit':
          await mockE2ETestFramework.browser.submitForm(
            currentTab.id,
            step.formSelector || 'form'
          );
          return { form: step.formSelector || 'form', submitted: true };
          
        case 'wait':
          await new Promise(resolve => setTimeout(resolve, step.duration || 1000));
          return { duration: step.duration || 1000, waited: true };
          
        case 'waitForElement':
          await mockE2ETestFramework.browser.waitForElement(
            currentTab.id,
            step.selector,
            step.timeout
          );
          return { selector: step.selector, elementFound: true };
          
        case 'verify':
          const content = await mockE2ETestFramework.browser.getPageContent(currentTab.id);
          const containsText = content.text && content.text.includes(step.text);
          if (!containsText) {
            throw new Error(`Expected text not found: ${step.text}`);
          }
          return { text: step.text, verified: true };
          
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }
    }
  },
  
  // Command processor
  commandProcessor: {
    // Process workflow command
    processWorkflowCommand: async (command) => {
      if (!command || typeof command !== 'string') {
        throw new Error('Invalid command: command must be a non-empty string');
      }
      
      // Parse workflow command
      const workflowMatch = command.match(/(?:execute|run)\s+(.+?)\s+workflow/i);
      if (!workflowMatch) {
        throw new Error('Invalid workflow command format');
      }
      
      const workflowName = workflowMatch[1].trim();
      
      // Get predefined workflow
      const workflow = mockE2ETestFramework.commandProcessor.getWorkflow(workflowName);
      if (!workflow) {
        throw new Error(`Unknown workflow: ${workflowName}`);
      }
      
      return {
        type: 'execute_workflow',
        workflow: workflow,
        originalCommand: command
      };
    },
    
    // Get predefined workflow
    getWorkflow: (name) => {
      const workflows = {
        'login': {
          name: 'login',
          stopOnError: true,
          steps: [
            { type: 'navigate', url: 'https://example.com/login' },
            { type: 'waitForElement', selector: '#username', timeout: 3000 },
            { type: 'fill', selector: '#username', value: 'testuser' },
            { type: 'fill', selector: '#password', value: 'testpass' },
            { type: 'click', selector: '#login-button' },
            { type: 'wait', duration: 2000 },
            { type: 'verify', text: 'Welcome' }
          ]
        },
        'search': {
          name: 'search',
          stopOnError: true,
          steps: [
            { type: 'navigate', url: 'https://example.com' },
            { type: 'waitForElement', selector: '#search-input', timeout: 3000 },
            { type: 'fill', selector: '#search-input', value: 'test query' },
            { type: 'click', selector: '#search-button' },
            { type: 'wait', duration: 1000 },
            { type: 'verify', text: 'Search results' }
          ]
        },
        'signup': {
          name: 'signup',
          stopOnError: true,
          steps: [
            { type: 'navigate', url: 'https://example.com/signup' },
            { type: 'waitForElement', selector: '#signup-form', timeout: 3000 },
            { type: 'fill', selector: '#name', value: 'Test User' },
            { type: 'fill', selector: '#email', value: 'test@example.com' },
            { type: 'fill', selector: '#password', value: 'password123' },
            { type: 'fill', selector: '#confirm-password', value: 'password123' },
            { type: 'click', selector: '#signup-button' },
            { type: 'wait', duration: 2000 },
            { type: 'verify', text: 'Account created' }
          ]
        }
      };
      
      return workflows[name];
    },
    
    // Execute workflow command
    executeWorkflow: async (command) => {
      const parsedCommand = mockE2ETestFramework.commandProcessor.processWorkflowCommand(command);
      
      // Execute workflow
      const result = await mockE2ETestFramework.workflowEngine.executeWorkflow(parsedCommand.workflow);
      
      return {
        success: result.success,
        command: parsedCommand,
        result: result
      };
    }
  },
  
  // Test utilities
  utils: {
    // Simulate page content
    setupPageContent: (url) => {
      let content = '';
      
      switch (url) {
        case 'https://example.com/login':
          content = `
            <html>
              <body>
                <h1>Login Page</h1>
                <form id="login-form">
                  <div class="form-group">
                    <label for="username">Username:</label>
                    <input type="text" id="username" name="username">
                  </div>
                  <div class="form-group">
                    <label for="password">Password:</label>
                    <input type="password" id="password" name="password">
                  </div>
                  <div class="form-group">
                    <button type="button" id="login-button">Login</button>
                  </div>
                </form>
              </body>
            </html>
          `;
          break;
        case 'https://example.com':
          content = `
            <html>
              <body>
                <h1>Home Page</h1>
                <div class="search-container">
                  <input type="text" id="search-input" placeholder="Search...">
                  <button type="button" id="search-button">Search</button>
                </div>
              </body>
            </html>
          `;
          break;
        case 'https://example.com/signup':
          content = `
            <html>
              <body>
                <h1>Sign Up Page</h1>
                <form id="signup-form">
                  <div class="form-group">
                    <label for="name">Name:</label>
                    <input type="text" id="name" name="name">
                  </div>
                  <div class="form-group">
                    <label for="email">Email:</label>
                    <input type="email" id="email" name="email">
                  </div>
                  <div class="form-group">
                    <label for="password">Password:</label>
                    <input type="password" id="password" name="password">
                  </div>
                  <div class="form-group">
                    <label for="confirm-password">Confirm Password:</label>
                    <input type="password" id="confirm-password" name="confirm-password">
                  </div>
                  <div class="form-group">
                    <button type="button" id="signup-button">Sign Up</button>
                  </div>
                </form>
              </body>
            </html>
          `;
          break;
        default:
          content = '<html><body><h1>Default Page</h1></body></html>';
      }
      
      document.documentElement.innerHTML = content;
    },
    
    // Verify workflow step execution
    verifyWorkflowStep: (result, expectedType, expectedSuccess = true) => {
      return result.type === expectedType && result.success === expectedSuccess;
    }
  }
};

describe('Multi-Step Workflow E2E Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Mock content script responses
    chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      switch (message.type) {
        case 'fillField':
          const field = document.querySelector(message.data.selector);
          if (field) {
            field.value = message.data.value;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
            callback({ success: true, field: message.data.selector, value: message.data.value });
          } else {
            callback({ success: false });
          }
          break;
        case 'clickElement':
          const element = document.querySelector(message.data.selector);
          if (element) {
            element.click();
            callback({ success: true, element: message.data.selector });
          } else {
            callback({ success: false });
          }
          break;
        case 'submitForm':
          const form = document.querySelector(message.data.formSelector);
          if (form) {
            form.submit();
            callback({ success: true, form: message.data.formSelector });
          } else {
            callback({ success: false });
          }
          break;
        case 'checkElementVisible':
          const element = document.querySelector(message.data.selector);
          callback({ visible: !!element && element.offsetParent !== null });
          break;
        case 'getPageContent':
          callback({ text: document.body.innerText, html: document.documentElement.outerHTML });
          break;
        default:
          callback({ success: false });
      }
    });
    
    // Mock tab operations
    chrome.tabs.query.mockImplementation((queryInfo, callback) => {
      callback([createMockTab({ id: 1, url: 'http://example.com', status: 'complete' })]);
    });
    
    chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
      // Setup page content based on URL
      mockE2ETestFramework.utils.setupPageContent(updateProperties.url);
      callback(createMockTab({ id: tabId, ...updateProperties, status: 'complete' }));
    });
    
    chrome.tabs.get.mockImplementation((tabId, callback) => {
      callback(createMockTab({ id: tabId, status: 'complete' }));
    });
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Login Workflow', () => {
    test('should execute login workflow successfully', async () => {
      const command = 'Execute login workflow';
      
      const result = await mockE2ETestFramework.commandProcessor.executeWorkflow(command);
      
      expect(result.success).toBe(true);
      expect(result.command.workflow.name).toBe('login');
      expect(result.result.totalSteps).toBe(7);
      
      // Verify each step executed successfully
      expect(result.result.results.every(r => r.success)).toBe(true);
      
      // Verify specific steps
      const navigateStep = result.result.results.find(r => r.type === 'navigate');
      expect(navigateStep.result.url).toBe('https://example.com/login');
      
      const fillUsernameStep = result.result.results.find(r => r.type === 'fill' && r.result.selector === '#username');
      expect(fillUsernameStep.result.value).toBe('testuser');
      
      const fillPasswordStep = result.result.results.find(r => r.type === 'fill' && r.result.selector === '#password');
      expect(fillPasswordStep.result.value).toBe('testpass');
    });
    
    test('should handle login workflow with missing element', async () => {
      const command = 'Execute login workflow';
      
      // Mock missing username element
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'checkElementVisible' && message.data.selector === '#username') {
          callback({ visible: false }); // Element not visible
        } else if (message.type === 'fillField' && message.data.selector === '#username') {
          callback({ success: false }); // Field not found
        } else {
          // Default behavior for other messages
          switch (message.type) {
            case 'fillField':
              const field = document.querySelector(message.data.selector);
              if (field) {
                field.value = message.data.value;
                field.dispatchEvent(new Event('input', { bubbles: true }));
                field.dispatchEvent(new Event('change', { bubbles: true }));
                callback({ success: true, field: message.data.selector, value: message.data.value });
              } else {
                callback({ success: false });
              }
              break;
            case 'clickElement':
              const element = document.querySelector(message.data.selector);
              if (element) {
                element.click();
                callback({ success: true, element: message.data.selector });
              } else {
                callback({ success: false });
              }
              break;
            case 'getPageContent':
              callback({ text: document.body.innerText, html: document.documentElement.outerHTML });
              break;
            default:
              callback({ success: false });
          }
        }
      });
      
      const result = await mockE2ETestFramework.commandProcessor.executeWorkflow(command);
      
      expect(result.success).toBe(false);
      expect(result.result.results.some(r => !r.success)).toBe(true);
    });
  });
  
  describe('Search Workflow', () => {
    test('should execute search workflow successfully', async () => {
      const command = 'Run search workflow';
      
      const result = await mockE2ETestFramework.commandProcessor.executeWorkflow(command);
      
      expect(result.success).toBe(true);
      expect(result.command.workflow.name).toBe('search');
      expect(result.result.totalSteps).toBe(6);
      
      // Verify each step executed successfully
      expect(result.result.results.every(r => r.success)).toBe(true);
      
      // Verify specific steps
      const navigateStep = result.result.results.find(r => r.type === 'navigate');
      expect(navigateStep.result.url).toBe('https://example.com');
      
      const fillSearchStep = result.result.results.find(r => r.type === 'fill');
      expect(fillSearchStep.result.value).toBe('test query');
      
      const clickSearchStep = result.result.results.find(r => r.type === 'click');
      expect(clickSearchStep.result.selector).toBe('#search-button');
    });
    
    test('should handle search workflow with verification failure', async () => {
      const command = 'Run search workflow';
      
      // Mock page content without expected text
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'getPageContent') {
          callback({ text: 'Page content without expected text', html: document.documentElement.outerHTML });
        } else {
          // Default behavior for other messages
          switch (message.type) {
            case 'fillField':
              const field = document.querySelector(message.data.selector);
              if (field) {
                field.value = message.data.value;
                field.dispatchEvent(new Event('input', { bubbles: true }));
                field.dispatchEvent(new Event('change', { bubbles: true }));
                callback({ success: true, field: message.data.selector, value: message.data.value });
              } else {
                callback({ success: false });
              }
              break;
            case 'clickElement':
              const element = document.querySelector(message.data.selector);
              if (element) {
                element.click();
                callback({ success: true, element: message.data.selector });
              } else {
                callback({ success: false });
              }
              break;
            case 'checkElementVisible':
              const element = document.querySelector(message.data.selector);
              callback({ visible: !!element && element.offsetParent !== null });
              break;
            default:
              callback({ success: false });
          }
        }
      });
      
      const result = await mockE2ETestFramework.commandProcessor.executeWorkflow(command);
      
      expect(result.success).toBe(false);
      expect(result.result.results.some(r => !r.success)).toBe(true);
      
      const verifyStep = result.result.results.find(r => r.type === 'verify');
      expect(verifyStep.success).toBe(false);
      expect(verifyStep.error).toContain('Expected text not found: Search results');
    });
  });
  
  describe('Signup Workflow', () => {
    test('should execute signup workflow successfully', async () => {
      const command = 'Execute signup workflow';
      
      const result = await mockE2ETestFramework.commandProcessor.executeWorkflow(command);
      
      expect(result.success).toBe(true);
      expect(result.command.workflow.name).toBe('signup');
      expect(result.result.totalSteps).toBe(9);
      
      // Verify each step executed successfully
      expect(result.result.results.every(r => r.success)).toBe(true);
      
      // Verify specific steps
      const navigateStep = result.result.results.find(r => r.type === 'navigate');
      expect(navigateStep.result.url).toBe('https://example.com/signup');
      
      const fillNameStep = result.result.results.find(r => r.type === 'fill' && r.result.selector === '#name');
      expect(fillNameStep.result.value).toBe('Test User');
      
      const fillEmailStep = result.result.results.find(r => r.type === 'fill' && r.result.selector === '#email');
      expect(fillEmailStep.result.value).toBe('test@example.com');
    });
  });
  
  describe('Error Handling', () => {
    test('should reject invalid workflow command format', async () => {
      const command = 'Invalid workflow command';
      
      await expect(mockE2ETestFramework.commandProcessor.executeWorkflow(command)).rejects.toThrow('Invalid workflow command format');
    });
    
    test('should reject unknown workflow', async () => {
      const command = 'Execute unknown workflow';
      
      await expect(mockE2ETestFramework.commandProcessor.executeWorkflow(command)).rejects.toThrow('Unknown workflow: unknown');
    });
    
    test('should handle Chrome API errors during workflow', async () => {
      const command = 'Execute login workflow';
      const error = new Error('Tab communication failed');
      
      chrome.runtime.lastError = error;
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback(null); // Trigger error
      });
      
      const result = await mockE2ETestFramework.commandProcessor.executeWorkflow(command);
      
      expect(result.success).toBe(false);
      expect(result.result.results.some(r => !r.success)).toBe(true);
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
    
    test('should handle navigation timeout during workflow', async () => {
      const command = 'Execute login workflow';
      
      // Mock navigation timeout
      chrome.tabs.get.mockImplementation((tabId, callback) => {
        // Always return loading status to simulate timeout
        callback(createMockTab({ id: tabId, status: 'loading' }));
      });
      
      const result = await mockE2ETestFramework.commandProcessor.executeWorkflow(command);
      
      expect(result.success).toBe(false);
      expect(result.result.results.some(r => !r.success)).toBe(true);
      
      const navigateStep = result.result.results.find(r => r.type === 'navigate');
      expect(navigateStep.success).toBe(false);
      expect(navigateStep.error).toContain('Navigation timeout');
    });
  });
  
  describe('Performance and Timing', () => {
    test('should complete workflow within acceptable time', async () => {
      const command = 'Execute search workflow';
      const startTime = Date.now();
      
      // Mock fast operations
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        switch (message.type) {
          case 'fillField':
            setTimeout(() => {
              const field = document.querySelector(message.data.selector);
              if (field) {
                field.value = message.data.value;
                field.dispatchEvent(new Event('input', { bubbles: true }));
                field.dispatchEvent(new Event('change', { bubbles: true }));
                callback({ success: true, field: message.data.selector, value: message.data.value });
              } else {
                callback({ success: false });
              }
            }, 50);
            break;
          case 'clickElement':
            setTimeout(() => {
              const element = document.querySelector(message.data.selector);
              if (element) {
                element.click();
                callback({ success: true, element: message.data.selector });
              } else {
                callback({ success: false });
              }
            }, 50);
            break;
          case 'getPageContent':
            setTimeout(() => {
              callback({ text: 'Page content with Search results', html: document.documentElement.outerHTML });
            }, 50);
            break;
          case 'checkElementVisible':
            setTimeout(() => {
              const element = document.querySelector(message.data.selector);
              callback({ visible: !!element && element.offsetParent !== null });
            }, 50);
            break;
          default:
            callback({ success: false });
        }
      });
      
      const result = await mockE2ETestFramework.commandProcessor.executeWorkflow(command);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });
    
    test('should handle wait steps correctly', async () => {
      const workflow = {
        name: 'wait-test',
        stopOnError: true,
        steps: [
          { type: 'wait', duration: 500 },
          { type: 'wait', duration: 300 }
        ]
      };
      
      const startTime = Date.now();
      const result = await mockE2ETestFramework.workflowEngine.executeWorkflow(workflow);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.success).toBe(true);
      expect(result.totalSteps).toBe(2);
      expect(duration).toBeGreaterThan(700); // Should wait at least 800ms (500 + 300)
      expect(duration).toBeLessThan(1000); // But not too much longer
    });
  });
}); * Multi-Step Workflow E2E Tests
 * Tests for complex multi-step automation workflows end-to-end scenarios
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock E2E test framework (this would be imported from actual source)
const mockE2ETestFramework = {
  // Browser automation controller
  browser: {
    // Navigate to URL
    navigate: async (url) => {
      return new Promise((resolve, reject) => {
        chrome.tabs.update({ url }, (tab) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(tab);
          }
        });
      });
    },
    
    // Wait for navigation to complete
    waitForNavigation: async (tabId, timeout = 5000) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkNavigation = () => {
          chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else if (tab.status === 'complete') {
              resolve(tab);
            } else if (Date.now() - startTime > timeout) {
              reject(new Error(`Navigation timeout after ${timeout}ms`));
            } else {
              setTimeout(checkNavigation, 100);
            }
          });
        };
        
        checkNavigation();
      });
    },
    
    // Get current tab
    getCurrentTab: async () => {
      return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (tabs.length > 0) {
            resolve(tabs[0]);
          } else {
            reject(new Error('No active tab found'));
          }
        });
      });
    },
    
    // Create new tab
    createTab: async (url) => {
      return new Promise((resolve, reject) => {
        chrome.tabs.create({ url, active: true }, (tab) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(tab);
          }
        });
      });
    },
    
    // Fill form field
    fillField: async (tabId, selector, value) => {
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {
          type: 'fillField',
          data: { selector, value }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response && response.success) {
            resolve(response);
          } else {
            reject(new Error(`Failed to fill field: ${selector}`));
          }
        });
      });
    },
    
    // Click element
    clickElement: async (tabId, selector) => {
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {
          type: 'clickElement',
          data: { selector }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response && response.success) {
            resolve(response);
          } else {
            reject(new Error(`Failed to click element: ${selector}`));
          }
        });
      });
    },
    
    // Submit form
    submitForm: async (tabId, formSelector = 'form') => {
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {
          type: 'submitForm',
          data: { formSelector }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response && response.success) {
            resolve(response);
          } else {
            reject(new Error(`Failed to submit form: ${formSelector}`));
          }
        });
      });
    },
    
    // Wait for element to be visible
    waitForElement: async (tabId, selector, timeout = 5000) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkElement = () => {
          chrome.tabs.sendMessage(tabId, {
            type: 'checkElementVisible',
            data: { selector }
          }, (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else if (response && response.visible) {
              resolve(response);
            } else if (Date.now() - startTime > timeout) {
              reject(new Error(`Element visibility timeout after ${timeout}ms`));
            } else {
              setTimeout(checkElement, 100);
            }
          });
        };
        
        checkElement();
      });
    },
    
    // Get page content
    getPageContent: async (tabId) => {
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {
          type: 'getPageContent'
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });
    }
  },
  
  // Workflow engine
  workflowEngine: {
    // Execute workflow steps
    executeWorkflow: async (workflow) => {
      const results = [];
      
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        
        try {
          const result = await mockE2ETestFramework.workflowEngine.executeStep(step);
          results.push({
            step: i + 1,
            type: step.type,
            success: true,
            result: result
          });
        } catch (error) {
          results.push({
            step: i + 1,
            type: step.type,
            success: false,
            error: error.message
          });
          
          if (workflow.stopOnError) {
            break;
          }
        }
      }
      
      return {
        workflow: workflow.name,
        totalSteps: workflow.steps.length,
        results: results,
        success: results.every(r => r.success)
      };
    },
    
    // Execute individual step
    executeStep: async (step) => {
      const currentTab = await mockE2ETestFramework.browser.getCurrentTab();
      
      switch (step.type) {
        case 'navigate':
          await mockE2ETestFramework.browser.navigate(step.url);
          await mockE2ETestFramework.browser.waitForNavigation(currentTab.id);
          return { url: step.url, navigated: true };
          
        case 'fill':
          await mockE2ETestFramework.browser.fillField(
            currentTab.id,
            step.selector,
            step.value
          );
          return { selector: step.selector, value: step.value, filled: true };
          
        case 'click':
          await mockE2ETestFramework.browser.clickElement(
            currentTab.id,
            step.selector
          );
          return { selector: step.selector, clicked: true };
          
        case 'submit':
          await mockE2ETestFramework.browser.submitForm(
            currentTab.id,
            step.formSelector || 'form'
          );
          return { form: step.formSelector || 'form', submitted: true };
          
        case 'wait':
          await new Promise(resolve => setTimeout(resolve, step.duration || 1000));
          return { duration: step.duration || 1000, waited: true };
          
        case 'waitForElement':
          await mockE2ETestFramework.browser.waitForElement(
            currentTab.id,
            step.selector,
            step.timeout
          );
          return { selector: step.selector, elementFound: true };
          
        case 'verify':
          const content = await mockE2ETestFramework.browser.getPageContent(currentTab.id);
          const containsText = content.text && content.text.includes(step.text);
          if (!containsText) {
            throw new Error(`Expected text not found: ${step.text}`);
          }
          return { text: step.text, verified: true };
          
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }
    }
  },
  
  // Command processor
  commandProcessor: {
    // Process workflow command
    processWorkflowCommand: async (command) => {
      if (!command || typeof command !== 'string') {
        throw new Error('Invalid command: command must be a non-empty string');
      }
      
      // Parse workflow command
      const workflowMatch = command.match(/(?:execute|run)\s+(.+?)\s+workflow/i);
      if (!workflowMatch) {
        throw new Error('Invalid workflow command format');
      }
      
      const workflowName = workflowMatch[1].trim();
      
      // Get predefined workflow
      const workflow = mockE2ETestFramework.commandProcessor.getWorkflow(workflowName);
      if (!workflow) {
        throw new Error(`Unknown workflow: ${workflowName}`);
      }
      
      return {
        type: 'execute_workflow',
        workflow: workflow,
        originalCommand: command
      };
    },
    
    // Get predefined workflow
    getWorkflow: (name) => {
      const workflows = {
        'login': {
          name: 'login',
          stopOnError: true,
          steps: [
            { type: 'navigate', url: 'https://example.com/login' },
            { type: 'waitForElement', selector: '#username', timeout: 3000 },
            { type: 'fill', selector: '#username', value: 'testuser' },
            { type: 'fill', selector: '#password', value: 'testpass' },
            { type: 'click', selector: '#login-button' },
            { type: 'wait', duration: 2000 },
            { type: 'verify', text: 'Welcome' }
          ]
        },
        'search': {
          name: 'search',
          stopOnError: true,
          steps: [
            { type: 'navigate', url: 'https://example.com' },
            { type: 'waitForElement', selector: '#search-input', timeout: 3000 },
            { type: 'fill', selector: '#search-input', value: 'test query' },
            { type: 'click', selector: '#search-button' },
            { type: 'wait', duration: 1000 },
            { type: 'verify', text: 'Search results' }
          ]
        },
        'signup': {
          name: 'signup',
          stopOnError: true,
          steps: [
            { type: 'navigate', url: 'https://example.com/signup' },
            { type: 'waitForElement', selector: '#signup-form', timeout: 3000 },
            { type: 'fill', selector: '#name', value: 'Test User' },
            { type: 'fill', selector: '#email', value: 'test@example.com' },
            { type: 'fill', selector: '#password', value: 'password123' },
            { type: 'fill', selector: '#confirm-password', value: 'password123' },
            { type: 'click', selector: '#signup-button' },
            { type: 'wait', duration: 2000 },
            { type: 'verify', text: 'Account created' }
          ]
        }
      };
      
      return workflows[name];
    },
    
    // Execute workflow command
    executeWorkflow: async (command) => {
      const parsedCommand = mockE2ETestFramework.commandProcessor.processWorkflowCommand(command);
      
      // Execute workflow
      const result = await mockE2ETestFramework.workflowEngine.executeWorkflow(parsedCommand.workflow);
      
      return {
        success: result.success,
        command: parsedCommand,
        result: result
      };
    }
  },
  
  // Test utilities
  utils: {
    // Simulate page content
    setupPageContent: (url) => {
      let content = '';
      
      switch (url) {
        case 'https://example.com/login':
          content = `
            <html>
              <body>
                <h1>Login Page</h1>
                <form id="login-form">
                  <div class="form-group">
                    <label for="username">Username:</label>
                    <input type="text" id="username" name="username">
                  </div>
                  <div class="form-group">
                    <label for="password">Password:</label>
                    <input type="password" id="password" name="password">
                  </div>
                  <div class="form-group">
                    <button type="button" id="login-button">Login</button>
                  </div>
                </form>
              </body>
            </html>
          `;
          break;
        case 'https://example.com':
          content = `
            <html>
              <body>
                <h1>Home Page</h1>
                <div class="search-container">
                  <input type="text" id="search-input" placeholder="Search...">
                  <button type="button" id="search-button">Search</button>
                </div>
              </body>
            </html>
          `;
          break;
        case 'https://example.com/signup':
          content = `
            <html>
              <body>
                <h1>Sign Up Page</h1>
                <form id="signup-form">
                  <div class="form-group">
                    <label for="name">Name:</label>
                    <input type="text" id="name" name="name">
                  </div>
                  <div class="form-group">
                    <label for="email">Email:</label>
                    <input type="email" id="email" name="email">
                  </div>
                  <div class="form-group">
                    <label for="password">Password:</label>
                    <input type="password" id="password" name="password">
                  </div>
                  <div class="form-group">
                    <label for="confirm-password">Confirm Password:</label>
                    <input type="password" id="confirm-password" name="confirm-password">
                  </div>
                  <div class="form-group">
                    <button type="button" id="signup-button">Sign Up</button>
                  </div>
                </form>
              </body>
            </html>
          `;
          break;
        default:
          content = '<html><body><h1>Default Page</h1></body></html>';
      }
      
      document.documentElement.innerHTML = content;
    },
    
    // Verify workflow step execution
    verifyWorkflowStep: (result, expectedType, expectedSuccess = true) => {
      return result.type === expectedType && result.success === expectedSuccess;
    }
  }
};

describe('Multi-Step Workflow E2E Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Mock content script responses
    chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      switch (message.type) {
        case 'fillField':
          const field = document.querySelector(message.data.selector);
          if (field) {
            field.value = message.data.value;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
            callback({ success: true, field: message.data.selector, value: message.data.value });
          } else {
            callback({ success: false });
          }
          break;
        case 'clickElement':
          const element = document.querySelector(message.data.selector);
          if (element) {
            element.click();
            callback({ success: true, element: message.data.selector });
          } else {
            callback({ success: false });
          }
          break;
        case 'submitForm':
          const form = document.querySelector(message.data.formSelector);
          if (form) {
            form.submit();
            callback({ success: true, form: message.data.formSelector });
          } else {
            callback({ success: false });
          }
          break;
        case 'checkElementVisible':
          const element = document.querySelector(message.data.selector);
          callback({ visible: !!element && element.offsetParent !== null });
          break;
        case 'getPageContent':
          callback({ text: document.body.innerText, html: document.documentElement.outerHTML });
          break;
        default:
          callback({ success: false });
      }
    });
    
    // Mock tab operations
    chrome.tabs.query.mockImplementation((queryInfo, callback) => {
      callback([createMockTab({ id: 1, url: 'http://example.com', status: 'complete' })]);
    });
    
    chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
      // Setup page content based on URL
      mockE2ETestFramework.utils.setupPageContent(updateProperties.url);
      callback(createMockTab({ id: tabId, ...updateProperties, status: 'complete' }));
    });
    
    chrome.tabs.get.mockImplementation((tabId, callback) => {
      callback(createMockTab({ id: tabId, status: 'complete' }));
    });
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Login Workflow', () => {
    test('should execute login workflow successfully', async () => {
      const command = 'Execute login workflow';
      
      const result = await mockE2ETestFramework.commandProcessor.executeWorkflow(command);
      
      expect(result.success).toBe(true);
      expect(result.command.workflow.name).toBe('login');
      expect(result.result.totalSteps).toBe(7);
      
      // Verify each step executed successfully
      expect(result.result.results.every(r => r.success)).toBe(true);
      
      // Verify specific steps
      const navigateStep = result.result.results.find(r => r.type === 'navigate');
      expect(navigateStep.result.url).toBe('https://example.com/login');
      
      const fillUsernameStep = result.result.results.find(r => r.type === 'fill' && r.result.selector === '#username');
      expect(fillUsernameStep.result.value).toBe('testuser');
      
      const fillPasswordStep = result.result.results.find(r => r.type === 'fill' && r.result.selector === '#password');
      expect(fillPasswordStep.result.value).toBe('testpass');
    });
    
    test('should handle login workflow with missing element', async () => {
      const command = 'Execute login workflow';
      
      // Mock missing username element
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'checkElementVisible' && message.data.selector === '#username') {
          callback({ visible: false }); // Element not visible
        } else if (message.type === 'fillField' && message.data.selector === '#username') {
          callback({ success: false }); // Field not found
        } else {
          // Default behavior for other messages
          switch (message.type) {
            case 'fillField':
              const field = document.querySelector(message.data.selector);
              if (field) {
                field.value = message.data.value;
                field.dispatchEvent(new Event('input', { bubbles: true }));
                field.dispatchEvent(new Event('change', { bubbles: true }));
                callback({ success: true, field: message.data.selector, value: message.data.value });
              } else {
                callback({ success: false });
              }
              break;
            case 'clickElement':
              const element = document.querySelector(message.data.selector);
              if (element) {
                element.click();
                callback({ success: true, element: message.data.selector });
              } else {
                callback({ success: false });
              }
              break;
            case 'getPageContent':
              callback({ text: document.body.innerText, html: document.documentElement.outerHTML });
              break;
            default:
              callback({ success: false });
          }
        }
      });
      
      const result = await mockE2ETestFramework.commandProcessor.executeWorkflow(command);
      
      expect(result.success).toBe(false);
      expect(result.result.results.some(r => !r.success)).toBe(true);
    });
  });
  
  describe('Search Workflow', () => {
    test('should execute search workflow successfully', async () => {
      const command = 'Run search workflow';
      
      const result = await mockE2ETestFramework.commandProcessor.executeWorkflow(command);
      
      expect(result.success).toBe(true);
      expect(result.command.workflow.name).toBe('search');
      expect(result.result.totalSteps).toBe(6);
      
      // Verify each step executed successfully
      expect(result.result.results.every(r => r.success)).toBe(true);
      
      // Verify specific steps
      const navigateStep = result.result.results.find(r => r.type === 'navigate');
      expect(navigateStep.result.url).toBe('https://example.com');
      
      const fillSearchStep = result.result.results.find(r => r.type === 'fill');
      expect(fillSearchStep.result.value).toBe('test query');
      
      const clickSearchStep = result.result.results.find(r => r.type === 'click');
      expect(clickSearchStep.result.selector).toBe('#search-button');
    });
    
    test('should handle search workflow with verification failure', async () => {
      const command = 'Run search workflow';
      
      // Mock page content without expected text
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'getPageContent') {
          callback({ text: 'Page content without expected text', html: document.documentElement.outerHTML });
        } else {
          // Default behavior for other messages
          switch (message.type) {
            case 'fillField':
              const field = document.querySelector(message.data.selector);
              if (field) {
                field.value = message.data.value;
                field.dispatchEvent(new Event('input', { bubbles: true }));
                field.dispatchEvent(new Event('change', { bubbles: true }));
                callback({ success: true, field: message.data.selector, value: message.data.value });
              } else {
                callback({ success: false });
              }
              break;
            case 'clickElement':
              const element = document.querySelector(message.data.selector);
              if (element) {
                element.click();
                callback({ success: true, element: message.data.selector });
              } else {
                callback({ success: false });
              }
              break;
            case 'checkElementVisible':
              const element = document.querySelector(message.data.selector);
              callback({ visible: !!element && element.offsetParent !== null });
              break;
            default:
              callback({ success: false });
          }
        }
      });
      
      const result = await mockE2ETestFramework.commandProcessor.executeWorkflow(command);
      
      expect(result.success).toBe(false);
      expect(result.result.results.some(r => !r.success)).toBe(true);
      
      const verifyStep = result.result.results.find(r => r.type === 'verify');
      expect(verifyStep.success).toBe(false);
      expect(verifyStep.error).toContain('Expected text not found: Search results');
    });
  });
  
  describe('Signup Workflow', () => {
    test('should execute signup workflow successfully', async () => {
      const command = 'Execute signup workflow';
      
      const result = await mockE2ETestFramework.commandProcessor.executeWorkflow(command);
      
      expect(result.success).toBe(true);
      expect(result.command.workflow.name).toBe('signup');
      expect(result.result.totalSteps).toBe(9);
      
      // Verify each step executed successfully
      expect(result.result.results.every(r => r.success)).toBe(true);
      
      // Verify specific steps
      const navigateStep = result.result.results.find(r => r.type === 'navigate');
      expect(navigateStep.result.url).toBe('https://example.com/signup');
      
      const fillNameStep = result.result.results.find(r => r.type === 'fill' && r.result.selector === '#name');
      expect(fillNameStep.result.value).toBe('Test User');
      
      const fillEmailStep = result.result.results.find(r => r.type === 'fill' && r.result.selector === '#email');
      expect(fillEmailStep.result.value).toBe('test@example.com');
    });
  });
  
  describe('Error Handling', () => {
    test('should reject invalid workflow command format', async () => {
      const command = 'Invalid workflow command';
      
      await expect(mockE2ETestFramework.commandProcessor.executeWorkflow(command)).rejects.toThrow('Invalid workflow command format');
    });
    
    test('should reject unknown workflow', async () => {
      const command = 'Execute unknown workflow';
      
      await expect(mockE2ETestFramework.commandProcessor.executeWorkflow(command)).rejects.toThrow('Unknown workflow: unknown');
    });
    
    test('should handle Chrome API errors during workflow', async () => {
      const command = 'Execute login workflow';
      const error = new Error('Tab communication failed');
      
      chrome.runtime.lastError = error;
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback(null); // Trigger error
      });
      
      const result = await mockE2ETestFramework.commandProcessor.executeWorkflow(command);
      
      expect(result.success).toBe(false);
      expect(result.result.results.some(r => !r.success)).toBe(true);
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
    
    test('should handle navigation timeout during workflow', async () => {
      const command = 'Execute login workflow';
      
      // Mock navigation timeout
      chrome.tabs.get.mockImplementation((tabId, callback) => {
        // Always return loading status to simulate timeout
        callback(createMockTab({ id: tabId, status: 'loading' }));
      });
      
      const result = await mockE2ETestFramework.commandProcessor.executeWorkflow(command);
      
      expect(result.success).toBe(false);
      expect(result.result.results.some(r => !r.success)).toBe(true);
      
      const navigateStep = result.result.results.find(r => r.type === 'navigate');
      expect(navigateStep.success).toBe(false);
      expect(navigateStep.error).toContain('Navigation timeout');
    });
  });
  
  describe('Performance and Timing', () => {
    test('should complete workflow within acceptable time', async () => {
      const command = 'Execute search workflow';
      const startTime = Date.now();
      
      // Mock fast operations
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        switch (message.type) {
          case 'fillField':
            setTimeout(() => {
              const field = document.querySelector(message.data.selector);
              if (field) {
                field.value = message.data.value;
                field.dispatchEvent(new Event('input', { bubbles: true }));
                field.dispatchEvent(new Event('change', { bubbles: true }));
                callback({ success: true, field: message.data.selector, value: message.data.value });
              } else {
                callback({ success: false });
              }
            }, 50);
            break;
          case 'clickElement':
            setTimeout(() => {
              const element = document.querySelector(message.data.selector);
              if (element) {
                element.click();
                callback({ success: true, element: message.data.selector });
              } else {
                callback({ success: false });
              }
            }, 50);
            break;
          case 'getPageContent':
            setTimeout(() => {
              callback({ text: 'Page content with Search results', html: document.documentElement.outerHTML });
            }, 50);
            break;
          case 'checkElementVisible':
            setTimeout(() => {
              const element = document.querySelector(message.data.selector);
              callback({ visible: !!element && element.offsetParent !== null });
            }, 50);
            break;
          default:
            callback({ success: false });
        }
      });
      
      const result = await mockE2ETestFramework.commandProcessor.executeWorkflow(command);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });
    
    test('should handle wait steps correctly', async () => {
      const workflow = {
        name: 'wait-test',
        stopOnError: true,
        steps: [
          { type: 'wait', duration: 500 },
          { type: 'wait', duration: 300 }
        ]
      };
      
      const startTime = Date.now();
      const result = await mockE2ETestFramework.workflowEngine.executeWorkflow(workflow);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.success).toBe(true);
      expect(result.totalSteps).toBe(2);
      expect(duration).toBeGreaterThan(700); // Should wait at least 800ms (500 + 300)
      expect(duration).toBeLessThan(1000); // But not too much longer
    });
  });
});
