/**
 * Multi-Tab Workflows Integration Tests
 * Tests for automation workflows spanning multiple tabs
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock multi-tab workflow module (this would be imported from actual source)
const mockMultiTabWorkflow = {
  // Active workflow tracking
  activeWorkflows: new Map(),
  
  // Tab management
  createTab: async (url, windowId) => {
    return new Promise((resolve, reject) => {
      chrome.tabs.create({ url, windowId }, (tab) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(tab);
        }
      });
    });
  },
  
  // Workflow execution
  executeWorkflow: async (workflow) => {
    const workflowId = Date.now().toString();
    
    try {
      mockMultiTabWorkflow.activeWorkflows.set(workflowId, {
        status: 'running',
        steps: workflow.steps,
        currentStep: 0,
        results: []
      });
      
      const results = [];
      
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        
        // Update workflow status
        const workflowData = mockMultiTabWorkflow.activeWorkflows.get(workflowId);
        workflowData.currentStep = i;
        
        const result = await mockMultiTabWorkflow.executeStep(step, workflowId);
        results.push(result);
        
        // Check if step failed
        if (!result.success) {
          throw new Error(`Step ${i + 1} failed: ${result.error}`);
        }
        
        // Add delay between steps
        if (i < workflow.steps.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Mark workflow as completed
      const workflowData = mockMultiTabWorkflow.activeWorkflows.get(workflowId);
      workflowData.status = 'completed';
      workflowData.results = results;
      
      return {
        success: true,
        workflowId: workflowId,
        results: results
      };
    } catch (error) {
      // Mark workflow as failed
      const workflowData = mockMultiTabWorkflow.activeWorkflows.get(workflowId);
      if (workflowData) {
        workflowData.status = 'failed';
        workflowData.error = error.message;
      }
      
      return {
        success: false,
        workflowId: workflowId,
        error: error.message
      };
    }
  },
  
  // Execute individual step
  executeStep: async (step, workflowId) => {
    switch (step.type) {
      case 'createTab':
        return await mockMultiTabWorkflow.createTabInWindow(step.url, step.windowId);
      case 'switchToTab':
        return await mockMultiTabWorkflow.switchToTab(step.tabId);
      case 'closeTab':
        return await mockMultiTabWorkflow.closeTab(step.tabId);
      case 'waitForTab':
        return await mockMultiTabWorkflow.waitForTabLoad(step.tabId);
      case 'executeInTab':
        return await mockMultiTabWorkflow.executeInTab(step.tabId, step.action);
      default:
        return { success: false, error: `Unknown step type: ${step.type}` };
    }
  },
  
  // Create tab in specific window
  createTabInWindow: async (url, windowId) => {
    return new Promise((resolve, reject) => {
      chrome.tabs.create({ url, windowId }, (tab) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve({ success: true, tabId: tab.id, url: tab.url });
        }
      });
    });
  },
  
  // Switch to specific tab
  switchToTab: async (tabId) => {
    return new Promise((resolve, reject) => {
      chrome.tabs.update(tabId, { active: true }, (tab) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve({ success: true, tabId: tab.id, active: true });
        }
      });
    });
  },
  
  // Close tab
  closeTab: async (tabId) => {
    return new Promise((resolve, reject) => {
      chrome.tabs.remove(tabId, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve({ success: true, tabId: tabId, closed: true });
        }
      });
    });
  },
  
  // Wait for tab to load
  waitForTabLoad: async (tabId) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Tab ${tabId} did not load within timeout`));
      }, 5000);
      
      const checkTab = () => {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            clearTimeout(timeout);
            reject(chrome.runtime.lastError);
          } else if (tab.status === 'complete') {
            clearTimeout(timeout);
            resolve({ success: true, tabId: tab.id, status: tab.status });
          } else {
            setTimeout(checkTab, 100);
          }
        });
      };
      
      checkTab();
    });
  },
  
  // Execute action in tab
  executeInTab: async (tabId, action) => {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, {
        type: 'executeAction',
        data: { action }
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  },
  
  // Get workflow status
  getWorkflowStatus: (workflowId) => {
    return mockMultiTabWorkflow.activeWorkflows.get(workflowId);
  },
  
  // Cleanup completed workflows
  cleanupWorkflows: () => {
    const now = Date.now();
    for (const [id, workflow] of mockMultiTabWorkflow.activeWorkflows.entries()) {
      // Clean up workflows older than 1 hour
      if (now - parseInt(id) > 3600000) {
        mockMultiTabWorkflow.activeWorkflows.delete(id);
      }
    }
  }
};

describe('Multi-Tab Workflows', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
    mockMultiTabWorkflow.activeWorkflows.clear();
  });
  
  describe('Tab Creation and Management', () => {
    test('should create tab in specific window', async () => {
      const url = 'https://example.com';
      const windowId = 1;
      const mockTab = createMockTab({ url, windowId });
      
      chrome.tabs.create.mockImplementation((createProperties, callback) => {
        callback(mockTab);
      });
      
      const result = await mockMultiTabWorkflow.createTabInWindow(url, windowId);
      
      expect(result.success).toBe(true);
      expect(result.tabId).toBe(mockTab.id);
      expect(result.url).toBe(url);
      expect(chrome.tabs.create).toHaveBeenCalledWith({ url, windowId }, expect.any(Function));
    });
    
    test('should handle tab creation errors', async () => {
      const url = 'https://example.com';
      const windowId = 1;
      const error = new Error('Tab creation failed');
      
      chrome.runtime.lastError = error;
      chrome.tabs.create.mockImplementation((createProperties, callback) => {
        callback(null);
      });
      
      await expect(mockMultiTabWorkflow.createTabInWindow(url, windowId)).rejects.toThrow('Tab creation failed');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
    
    test('should switch to specific tab', async () => {
      const tabId = 123;
      const mockTab = createMockTab({ id: tabId, active: true });
      
      chrome.tabs.update.mockImplementation((id, updateProperties, callback) => {
        callback(mockTab);
      });
      
      const result = await mockMultiTabWorkflow.switchToTab(tabId);
      
      expect(result.success).toBe(true);
      expect(result.tabId).toBe(tabId);
      expect(result.active).toBe(true);
      expect(chrome.tabs.update).toHaveBeenCalledWith(tabId, { active: true }, expect.any(Function));
    });
    
    test('should close specific tab', async () => {
      const tabId = 123;
      
      chrome.tabs.remove.mockImplementation((id, callback) => {
        callback();
      });
      
      const result = await mockMultiTabWorkflow.closeTab(tabId);
      
      expect(result.success).toBe(true);
      expect(result.tabId).toBe(tabId);
      expect(result.closed).toBe(true);
      expect(chrome.tabs.remove).toHaveBeenCalledWith(tabId, expect.any(Function));
    });
  });
  
  describe('Tab Loading and Waiting', () => {
    test('should wait for tab to load successfully', async () => {
      const tabId = 123;
      const mockTab = createMockTab({ id: tabId, status: 'complete' });
      
      chrome.tabs.get.mockImplementation((id, callback) => {
        callback(mockTab);
      });
      
      const result = await mockMultiTabWorkflow.waitForTabLoad(tabId);
      
      expect(result.success).toBe(true);
      expect(result.tabId).toBe(tabId);
      expect(result.status).toBe('complete');
    });
    
    test('should timeout waiting for tab to load', async () => {
      const tabId = 123;
      const mockTab = createMockTab({ id: tabId, status: 'loading' });
      
      chrome.tabs.get.mockImplementation((id, callback) => {
        // Always return loading status
        callback(mockTab);
      });
      
      await expect(mockMultiTabWorkflow.waitForTabLoad(tabId)).rejects.toThrow('Tab 123 did not load within timeout');
    });
  });
  
  describe('Tab Action Execution', () => {
    test('should execute action in specific tab', async () => {
      const tabId = 123;
      const action = { type: 'click', element: '#test-button' };
      const response = { success: true, element: '#test-button' };
      
      chrome.tabs.sendMessage.mockImplementation((id, message, callback) => {
        callback(response);
      });
      
      const result = await mockMultiTabWorkflow.executeInTab(tabId, action);
      
      expect(result).toEqual(response);
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        tabId,
        {
          type: 'executeAction',
          data: { action }
        },
        expect.any(Function)
      );
    });
    
    test('should handle action execution errors', async () => {
      const tabId = 123;
      const action = { type: 'click', element: '#non-existent' };
      const error = new Error('Element not found');
      
      chrome.runtime.lastError = error;
      chrome.tabs.sendMessage.mockImplementation((id, message, callback) => {
        callback(null);
      });
      
      await expect(mockMultiTabWorkflow.executeInTab(tabId, action)).rejects.toThrow('Element not found');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('Workflow Execution', () => {
    test('should execute simple multi-tab workflow', async () => {
      const workflow = {
        name: 'Simple Tab Workflow',
        steps: [
          { type: 'createTab', url: 'https://example.com' },
          { type: 'waitForTab', tabId: 'previous' }
        ]
      };
      
      // Mock successful step execution
      const mockTab1 = createMockTab({ id: 1, url: 'https://example.com' });
      const mockTab2 = createMockTab({ id: 1, status: 'complete' });
      
      chrome.tabs.create.mockImplementation((createProperties, callback) => {
        callback(mockTab1);
      });
      
      chrome.tabs.get.mockImplementation((id, callback) => {
        callback(mockTab2);
      });
      
      const result = await mockMultiTabWorkflow.executeWorkflow(workflow);
      
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(true);
      
      // Check workflow status
      const workflowStatus = mockMultiTabWorkflow.getWorkflowStatus(result.workflowId);
      expect(workflowStatus.status).toBe('completed');
      expect(workflowStatus.currentStep).toBe(1); // Last step
    });
    
    test('should execute complex multi-tab workflow', async () => {
      const workflow = {
        name: 'Complex Tab Workflow',
        steps: [
          { type: 'createTab', url: 'https://google.com' },
          { type: 'waitForTab', tabId: 'previous' },
          { type: 'executeInTab', tabId: 'previous', action: { type: 'fill', field: '#search', value: 'test query' } },
          { type: 'createTab', url: 'https://example.com', windowId: 1 },
          { type: 'switchToTab', tabId: 1 }
        ]
      };
      
      // Mock successful step execution
      const mockTabs = [
        createMockTab({ id: 1, url: 'https://google.com' }),
        createMockTab({ id: 1, status: 'complete' }),
        { success: true, field: '#search', value: 'test query' },
        createMockTab({ id: 2, url: 'https://example.com' }),
        createMockTab({ id: 1, active: true })
      ];
      
      chrome.tabs.create.mockImplementation((createProperties, callback) => {
        if (createProperties.url === 'https://google.com') {
          callback(mockTabs[0]);
        } else {
          callback(mockTabs[3]);
        }
      });
      
      chrome.tabs.get.mockImplementation((id, callback) => {
        callback(mockTabs[1]);
      });
      
      chrome.tabs.sendMessage.mockImplementation((id, message, callback) => {
        callback(mockTabs[2]);
      });
      
      chrome.tabs.update.mockImplementation((id, updateProperties, callback) => {
        callback(mockTabs[4]);
      });
      
      const result = await mockMultiTabWorkflow.executeWorkflow(workflow);
      
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(5);
      
      // Verify all steps were executed
      result.results.forEach((stepResult, index) => {
        expect(stepResult.success).toBe(true);
      });
    });
    
    test('should handle workflow execution failures', async () => {
      const workflow = {
        name: 'Failing Tab Workflow',
        steps: [
          { type: 'createTab', url: 'https://example.com' },
          { type: 'executeInTab', tabId: 'previous', action: { type: 'invalid' } }
        ]
      };
      
      // Mock first step success, second step failure
      const mockTab = createMockTab({ id: 1, url: 'https://example.com' });
      
      chrome.tabs.create.mockImplementation((createProperties, callback) => {
        callback(mockTab);
      });
      
      const result = await mockMultiTabWorkflow.executeWorkflow(workflow);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Step 2 failed');
      
      // Check workflow status
      const workflowStatus = mockMultiTabWorkflow.getWorkflowStatus(result.workflowId);
      expect(workflowStatus.status).toBe('failed');
      expect(workflowStatus.error).toContain('Step 2 failed');
    });
  });
  
  describe('Workflow Status Tracking', () => {
    test('should track workflow progress', async () => {
      const workflow = {
        name: 'Progress Tracking Workflow',
        steps: [
          { type: 'createTab', url: 'https://example.com' },
          { type: 'waitForTab', tabId: 'previous' },
          { type: 'closeTab', tabId: 'previous' }
        ]
      };
      
      // Mock step execution with delays
      const mockTab = createMockTab({ id: 1, url: 'https://example.com' });
      const mockTabComplete = createMockTab({ id: 1, status: 'complete' });
      
      chrome.tabs.create.mockImplementation((createProperties, callback) => {
        setTimeout(() => callback(mockTab), 50);
      });
      
      chrome.tabs.get.mockImplementation((id, callback) => {
        setTimeout(() => callback(mockTabComplete), 50);
      });
      
      chrome.tabs.remove.mockImplementation((id, callback) => {
        setTimeout(() => callback(), 50);
      });
      
      // Start workflow execution
      const workflowPromise = mockMultiTabWorkflow.executeWorkflow(workflow);
      
      // Check initial status
      let workflowStatus = mockMultiTabWorkflow.getWorkflowStatus('current');
      expect(workflowStatus.status).toBe('running');
      expect(workflowStatus.currentStep).toBe(0);
      
      // Wait for completion
      await workflowPromise;
      
      // Check final status
      workflowStatus = mockMultiTabWorkflow.getWorkflowStatus('current');
      expect(workflowStatus.status).toBe('completed');
      expect(workflowStatus.currentStep).toBe(2); // Last step
    });
    
    test('should cleanup old workflows', async () => {
      // Create old workflow (1 hour ago)
      const oldWorkflowId = (Date.now() - 3700000).toString();
      mockMultiTabWorkflow.activeWorkflows.set(oldWorkflowId, {
        status: 'completed',
        steps: [],
        currentStep: 0,
        results: []
      });
      
      // Create recent workflow
      const recentWorkflowId = Date.now().toString();
      mockMultiTabWorkflow.activeWorkflows.set(recentWorkflowId, {
        status: 'running',
        steps: [],
        currentStep: 0,
        results: []
      });
      
      // Cleanup
      mockMultiTabWorkflow.cleanupWorkflows();
      
      // Verify old workflow was removed, recent remains
      expect(mockMultiTabWorkflow.activeWorkflows.has(oldWorkflowId)).toBe(false);
      expect(mockMultiTabWorkflow.activeWorkflows.has(recentWorkflowId)).toBe(true);
    });
  });
  
  describe('Error Handling and Recovery', () => {
    test('should handle tab creation failure in workflow', async () => {
      const workflow = {
        name: 'Tab Creation Failure Workflow',
        steps: [
          { type: 'createTab', url: 'https://example.com' }
        ]
      };
      
      // Mock tab creation failure
      chrome.runtime.lastError = new Error('Tab creation failed');
      chrome.tabs.create.mockImplementation((createProperties, callback) => {
        callback(null);
      });
      
      const result = await mockMultiTabWorkflow.executeWorkflow(workflow);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Step 1 failed');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
    
    test('should handle tab switching failure', async () => {
      const tabId = 123;
      const error = new Error('Tab not found');
      
      chrome.runtime.lastError = error;
      chrome.tabs.update.mockImplementation((id, updateProperties, callback) => {
        callback(null);
      });
      
      await expect(mockMultiTabWorkflow.switchToTab(tabId)).rejects.toThrow('Tab not found');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
    
    test('should handle tab action execution failure', async () => {
      const tabId = 123;
      const action = { type: 'click', element: '#test-button' };
      const error = new Error('Content script not injected');
      
      chrome.runtime.lastError = error;
      chrome.tabs.sendMessage.mockImplementation((id, message, callback) => {
        callback(null);
      });
      
      await expect(mockMultiTabWorkflow.executeInTab(tabId, action)).rejects.toThrow('Content script not injected');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('Integration Scenarios', () => {
    test('should complete research workflow across multiple tabs', async () => {
      const workflow = {
        name: 'Research Workflow',
        steps: [
          { type: 'createTab', url: 'https://google.com' },
          { type: 'waitForTab', tabId: 'previous' },
          { type: 'executeInTab', tabId: 'previous', action: { type: 'fill', field: '#search', value: 'Chrome extensions' } },
          { type: 'createTab', url: 'https://github.com', windowId: 1 },
          { type: 'waitForTab', tabId: 'previous' },
          { type: 'executeInTab', tabId: 'previous', action: { type: 'click', element: '#search-button' } },
          { type: 'switchToTab', tabId: 1 }
        ]
      };
      
      // Mock all step executions
      const mockGoogleTab = createMockTab({ id: 1, url: 'https://google.com' });
      const mockGithubTab = createMockTab({ id: 2, url: 'https://github.com' });
      
      chrome.tabs.create.mockImplementation((createProperties, callback) => {
        if (createProperties.url === 'https://google.com') {
          callback(mockGoogleTab);
        } else {
          callback(mockGithubTab);
        }
      });
      
      chrome.tabs.get.mockImplementation((id, callback) => {
        callback(createMockTab({ id, status: 'complete' }));
      });
      
      chrome.tabs.sendMessage.mockImplementation((id, message, callback) => {
        if (message.data.action.type === 'fill') {
          callback({ success: true, field: '#search', value: 'Chrome extensions' });
        } else {
          callback({ success: true, element: '#search-button' });
        }
      });
      
      chrome.tabs.update.mockImplementation((id, updateProperties, callback) => {
        callback(createMockTab({ id, active: true }));
      });
      
      const result = await mockMultiTabWorkflow.executeWorkflow(workflow);
      
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(7);
      
      // Verify all steps completed successfully
      result.results.forEach((stepResult) => {
        expect(stepResult.success).toBe(true);
      });
    });
    
    test('should handle concurrent workflows', async () => {
      const workflow1 = {
        name: 'Concurrent Workflow 1',
        steps: [
          { type: 'createTab', url: 'https://example1.com' }
        ]
      };
      
      const workflow2 = {
        name: 'Concurrent Workflow 2',
        steps: [
          { type: 'createTab', url: 'https://example2.com' }
        ]
      };
      
      // Mock tab creation
      chrome.tabs.create.mockImplementation((createProperties, callback) => {
        const mockTab = createMockTab({ url: createProperties.url });
        setTimeout(() => callback(mockTab), 50);
      });
      
      // Execute both workflows concurrently
      const [result1, result2] = await Promise.all([
        mockMultiTabWorkflow.executeWorkflow(workflow1),
        mockMultiTabWorkflow.executeWorkflow(workflow2)
      ]);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(mockMultiTabWorkflow.activeWorkflows.size).toBe(2);
    });
  });
}); * Multi-Tab Workflows Integration Tests
 * Tests for automation workflows spanning multiple tabs
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock multi-tab workflow module (this would be imported from actual source)
const mockMultiTabWorkflow = {
  // Active workflow tracking
  activeWorkflows: new Map(),
  
  // Tab management
  createTab: async (url, windowId) => {
    return new Promise((resolve, reject) => {
      chrome.tabs.create({ url, windowId }, (tab) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(tab);
        }
      });
    });
  },
  
  // Workflow execution
  executeWorkflow: async (workflow) => {
    const workflowId = Date.now().toString();
    
    try {
      mockMultiTabWorkflow.activeWorkflows.set(workflowId, {
        status: 'running',
        steps: workflow.steps,
        currentStep: 0,
        results: []
      });
      
      const results = [];
      
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        
        // Update workflow status
        const workflowData = mockMultiTabWorkflow.activeWorkflows.get(workflowId);
        workflowData.currentStep = i;
        
        const result = await mockMultiTabWorkflow.executeStep(step, workflowId);
        results.push(result);
        
        // Check if step failed
        if (!result.success) {
          throw new Error(`Step ${i + 1} failed: ${result.error}`);
        }
        
        // Add delay between steps
        if (i < workflow.steps.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Mark workflow as completed
      const workflowData = mockMultiTabWorkflow.activeWorkflows.get(workflowId);
      workflowData.status = 'completed';
      workflowData.results = results;
      
      return {
        success: true,
        workflowId: workflowId,
        results: results
      };
    } catch (error) {
      // Mark workflow as failed
      const workflowData = mockMultiTabWorkflow.activeWorkflows.get(workflowId);
      if (workflowData) {
        workflowData.status = 'failed';
        workflowData.error = error.message;
      }
      
      return {
        success: false,
        workflowId: workflowId,
        error: error.message
      };
    }
  },
  
  // Execute individual step
  executeStep: async (step, workflowId) => {
    switch (step.type) {
      case 'createTab':
        return await mockMultiTabWorkflow.createTabInWindow(step.url, step.windowId);
      case 'switchToTab':
        return await mockMultiTabWorkflow.switchToTab(step.tabId);
      case 'closeTab':
        return await mockMultiTabWorkflow.closeTab(step.tabId);
      case 'waitForTab':
        return await mockMultiTabWorkflow.waitForTabLoad(step.tabId);
      case 'executeInTab':
        return await mockMultiTabWorkflow.executeInTab(step.tabId, step.action);
      default:
        return { success: false, error: `Unknown step type: ${step.type}` };
    }
  },
  
  // Create tab in specific window
  createTabInWindow: async (url, windowId) => {
    return new Promise((resolve, reject) => {
      chrome.tabs.create({ url, windowId }, (tab) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve({ success: true, tabId: tab.id, url: tab.url });
        }
      });
    });
  },
  
  // Switch to specific tab
  switchToTab: async (tabId) => {
    return new Promise((resolve, reject) => {
      chrome.tabs.update(tabId, { active: true }, (tab) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve({ success: true, tabId: tab.id, active: true });
        }
      });
    });
  },
  
  // Close tab
  closeTab: async (tabId) => {
    return new Promise((resolve, reject) => {
      chrome.tabs.remove(tabId, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve({ success: true, tabId: tabId, closed: true });
        }
      });
    });
  },
  
  // Wait for tab to load
  waitForTabLoad: async (tabId) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Tab ${tabId} did not load within timeout`));
      }, 5000);
      
      const checkTab = () => {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            clearTimeout(timeout);
            reject(chrome.runtime.lastError);
          } else if (tab.status === 'complete') {
            clearTimeout(timeout);
            resolve({ success: true, tabId: tab.id, status: tab.status });
          } else {
            setTimeout(checkTab, 100);
          }
        });
      };
      
      checkTab();
    });
  },
  
  // Execute action in tab
  executeInTab: async (tabId, action) => {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, {
        type: 'executeAction',
        data: { action }
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  },
  
  // Get workflow status
  getWorkflowStatus: (workflowId) => {
    return mockMultiTabWorkflow.activeWorkflows.get(workflowId);
  },
  
  // Cleanup completed workflows
  cleanupWorkflows: () => {
    const now = Date.now();
    for (const [id, workflow] of mockMultiTabWorkflow.activeWorkflows.entries()) {
      // Clean up workflows older than 1 hour
      if (now - parseInt(id) > 3600000) {
        mockMultiTabWorkflow.activeWorkflows.delete(id);
      }
    }
  }
};

describe('Multi-Tab Workflows', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
    mockMultiTabWorkflow.activeWorkflows.clear();
  });
  
  describe('Tab Creation and Management', () => {
    test('should create tab in specific window', async () => {
      const url = 'https://example.com';
      const windowId = 1;
      const mockTab = createMockTab({ url, windowId });
      
      chrome.tabs.create.mockImplementation((createProperties, callback) => {
        callback(mockTab);
      });
      
      const result = await mockMultiTabWorkflow.createTabInWindow(url, windowId);
      
      expect(result.success).toBe(true);
      expect(result.tabId).toBe(mockTab.id);
      expect(result.url).toBe(url);
      expect(chrome.tabs.create).toHaveBeenCalledWith({ url, windowId }, expect.any(Function));
    });
    
    test('should handle tab creation errors', async () => {
      const url = 'https://example.com';
      const windowId = 1;
      const error = new Error('Tab creation failed');
      
      chrome.runtime.lastError = error;
      chrome.tabs.create.mockImplementation((createProperties, callback) => {
        callback(null);
      });
      
      await expect(mockMultiTabWorkflow.createTabInWindow(url, windowId)).rejects.toThrow('Tab creation failed');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
    
    test('should switch to specific tab', async () => {
      const tabId = 123;
      const mockTab = createMockTab({ id: tabId, active: true });
      
      chrome.tabs.update.mockImplementation((id, updateProperties, callback) => {
        callback(mockTab);
      });
      
      const result = await mockMultiTabWorkflow.switchToTab(tabId);
      
      expect(result.success).toBe(true);
      expect(result.tabId).toBe(tabId);
      expect(result.active).toBe(true);
      expect(chrome.tabs.update).toHaveBeenCalledWith(tabId, { active: true }, expect.any(Function));
    });
    
    test('should close specific tab', async () => {
      const tabId = 123;
      
      chrome.tabs.remove.mockImplementation((id, callback) => {
        callback();
      });
      
      const result = await mockMultiTabWorkflow.closeTab(tabId);
      
      expect(result.success).toBe(true);
      expect(result.tabId).toBe(tabId);
      expect(result.closed).toBe(true);
      expect(chrome.tabs.remove).toHaveBeenCalledWith(tabId, expect.any(Function));
    });
  });
  
  describe('Tab Loading and Waiting', () => {
    test('should wait for tab to load successfully', async () => {
      const tabId = 123;
      const mockTab = createMockTab({ id: tabId, status: 'complete' });
      
      chrome.tabs.get.mockImplementation((id, callback) => {
        callback(mockTab);
      });
      
      const result = await mockMultiTabWorkflow.waitForTabLoad(tabId);
      
      expect(result.success).toBe(true);
      expect(result.tabId).toBe(tabId);
      expect(result.status).toBe('complete');
    });
    
    test('should timeout waiting for tab to load', async () => {
      const tabId = 123;
      const mockTab = createMockTab({ id: tabId, status: 'loading' });
      
      chrome.tabs.get.mockImplementation((id, callback) => {
        // Always return loading status
        callback(mockTab);
      });
      
      await expect(mockMultiTabWorkflow.waitForTabLoad(tabId)).rejects.toThrow('Tab 123 did not load within timeout');
    });
  });
  
  describe('Tab Action Execution', () => {
    test('should execute action in specific tab', async () => {
      const tabId = 123;
      const action = { type: 'click', element: '#test-button' };
      const response = { success: true, element: '#test-button' };
      
      chrome.tabs.sendMessage.mockImplementation((id, message, callback) => {
        callback(response);
      });
      
      const result = await mockMultiTabWorkflow.executeInTab(tabId, action);
      
      expect(result).toEqual(response);
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        tabId,
        {
          type: 'executeAction',
          data: { action }
        },
        expect.any(Function)
      );
    });
    
    test('should handle action execution errors', async () => {
      const tabId = 123;
      const action = { type: 'click', element: '#non-existent' };
      const error = new Error('Element not found');
      
      chrome.runtime.lastError = error;
      chrome.tabs.sendMessage.mockImplementation((id, message, callback) => {
        callback(null);
      });
      
      await expect(mockMultiTabWorkflow.executeInTab(tabId, action)).rejects.toThrow('Element not found');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('Workflow Execution', () => {
    test('should execute simple multi-tab workflow', async () => {
      const workflow = {
        name: 'Simple Tab Workflow',
        steps: [
          { type: 'createTab', url: 'https://example.com' },
          { type: 'waitForTab', tabId: 'previous' }
        ]
      };
      
      // Mock successful step execution
      const mockTab1 = createMockTab({ id: 1, url: 'https://example.com' });
      const mockTab2 = createMockTab({ id: 1, status: 'complete' });
      
      chrome.tabs.create.mockImplementation((createProperties, callback) => {
        callback(mockTab1);
      });
      
      chrome.tabs.get.mockImplementation((id, callback) => {
        callback(mockTab2);
      });
      
      const result = await mockMultiTabWorkflow.executeWorkflow(workflow);
      
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(true);
      
      // Check workflow status
      const workflowStatus = mockMultiTabWorkflow.getWorkflowStatus(result.workflowId);
      expect(workflowStatus.status).toBe('completed');
      expect(workflowStatus.currentStep).toBe(1); // Last step
    });
    
    test('should execute complex multi-tab workflow', async () => {
      const workflow = {
        name: 'Complex Tab Workflow',
        steps: [
          { type: 'createTab', url: 'https://google.com' },
          { type: 'waitForTab', tabId: 'previous' },
          { type: 'executeInTab', tabId: 'previous', action: { type: 'fill', field: '#search', value: 'test query' } },
          { type: 'createTab', url: 'https://example.com', windowId: 1 },
          { type: 'switchToTab', tabId: 1 }
        ]
      };
      
      // Mock successful step execution
      const mockTabs = [
        createMockTab({ id: 1, url: 'https://google.com' }),
        createMockTab({ id: 1, status: 'complete' }),
        { success: true, field: '#search', value: 'test query' },
        createMockTab({ id: 2, url: 'https://example.com' }),
        createMockTab({ id: 1, active: true })
      ];
      
      chrome.tabs.create.mockImplementation((createProperties, callback) => {
        if (createProperties.url === 'https://google.com') {
          callback(mockTabs[0]);
        } else {
          callback(mockTabs[3]);
        }
      });
      
      chrome.tabs.get.mockImplementation((id, callback) => {
        callback(mockTabs[1]);
      });
      
      chrome.tabs.sendMessage.mockImplementation((id, message, callback) => {
        callback(mockTabs[2]);
      });
      
      chrome.tabs.update.mockImplementation((id, updateProperties, callback) => {
        callback(mockTabs[4]);
      });
      
      const result = await mockMultiTabWorkflow.executeWorkflow(workflow);
      
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(5);
      
      // Verify all steps were executed
      result.results.forEach((stepResult, index) => {
        expect(stepResult.success).toBe(true);
      });
    });
    
    test('should handle workflow execution failures', async () => {
      const workflow = {
        name: 'Failing Tab Workflow',
        steps: [
          { type: 'createTab', url: 'https://example.com' },
          { type: 'executeInTab', tabId: 'previous', action: { type: 'invalid' } }
        ]
      };
      
      // Mock first step success, second step failure
      const mockTab = createMockTab({ id: 1, url: 'https://example.com' });
      
      chrome.tabs.create.mockImplementation((createProperties, callback) => {
        callback(mockTab);
      });
      
      const result = await mockMultiTabWorkflow.executeWorkflow(workflow);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Step 2 failed');
      
      // Check workflow status
      const workflowStatus = mockMultiTabWorkflow.getWorkflowStatus(result.workflowId);
      expect(workflowStatus.status).toBe('failed');
      expect(workflowStatus.error).toContain('Step 2 failed');
    });
  });
  
  describe('Workflow Status Tracking', () => {
    test('should track workflow progress', async () => {
      const workflow = {
        name: 'Progress Tracking Workflow',
        steps: [
          { type: 'createTab', url: 'https://example.com' },
          { type: 'waitForTab', tabId: 'previous' },
          { type: 'closeTab', tabId: 'previous' }
        ]
      };
      
      // Mock step execution with delays
      const mockTab = createMockTab({ id: 1, url: 'https://example.com' });
      const mockTabComplete = createMockTab({ id: 1, status: 'complete' });
      
      chrome.tabs.create.mockImplementation((createProperties, callback) => {
        setTimeout(() => callback(mockTab), 50);
      });
      
      chrome.tabs.get.mockImplementation((id, callback) => {
        setTimeout(() => callback(mockTabComplete), 50);
      });
      
      chrome.tabs.remove.mockImplementation((id, callback) => {
        setTimeout(() => callback(), 50);
      });
      
      // Start workflow execution
      const workflowPromise = mockMultiTabWorkflow.executeWorkflow(workflow);
      
      // Check initial status
      let workflowStatus = mockMultiTabWorkflow.getWorkflowStatus('current');
      expect(workflowStatus.status).toBe('running');
      expect(workflowStatus.currentStep).toBe(0);
      
      // Wait for completion
      await workflowPromise;
      
      // Check final status
      workflowStatus = mockMultiTabWorkflow.getWorkflowStatus('current');
      expect(workflowStatus.status).toBe('completed');
      expect(workflowStatus.currentStep).toBe(2); // Last step
    });
    
    test('should cleanup old workflows', async () => {
      // Create old workflow (1 hour ago)
      const oldWorkflowId = (Date.now() - 3700000).toString();
      mockMultiTabWorkflow.activeWorkflows.set(oldWorkflowId, {
        status: 'completed',
        steps: [],
        currentStep: 0,
        results: []
      });
      
      // Create recent workflow
      const recentWorkflowId = Date.now().toString();
      mockMultiTabWorkflow.activeWorkflows.set(recentWorkflowId, {
        status: 'running',
        steps: [],
        currentStep: 0,
        results: []
      });
      
      // Cleanup
      mockMultiTabWorkflow.cleanupWorkflows();
      
      // Verify old workflow was removed, recent remains
      expect(mockMultiTabWorkflow.activeWorkflows.has(oldWorkflowId)).toBe(false);
      expect(mockMultiTabWorkflow.activeWorkflows.has(recentWorkflowId)).toBe(true);
    });
  });
  
  describe('Error Handling and Recovery', () => {
    test('should handle tab creation failure in workflow', async () => {
      const workflow = {
        name: 'Tab Creation Failure Workflow',
        steps: [
          { type: 'createTab', url: 'https://example.com' }
        ]
      };
      
      // Mock tab creation failure
      chrome.runtime.lastError = new Error('Tab creation failed');
      chrome.tabs.create.mockImplementation((createProperties, callback) => {
        callback(null);
      });
      
      const result = await mockMultiTabWorkflow.executeWorkflow(workflow);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Step 1 failed');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
    
    test('should handle tab switching failure', async () => {
      const tabId = 123;
      const error = new Error('Tab not found');
      
      chrome.runtime.lastError = error;
      chrome.tabs.update.mockImplementation((id, updateProperties, callback) => {
        callback(null);
      });
      
      await expect(mockMultiTabWorkflow.switchToTab(tabId)).rejects.toThrow('Tab not found');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
    
    test('should handle tab action execution failure', async () => {
      const tabId = 123;
      const action = { type: 'click', element: '#test-button' };
      const error = new Error('Content script not injected');
      
      chrome.runtime.lastError = error;
      chrome.tabs.sendMessage.mockImplementation((id, message, callback) => {
        callback(null);
      });
      
      await expect(mockMultiTabWorkflow.executeInTab(tabId, action)).rejects.toThrow('Content script not injected');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('Integration Scenarios', () => {
    test('should complete research workflow across multiple tabs', async () => {
      const workflow = {
        name: 'Research Workflow',
        steps: [
          { type: 'createTab', url: 'https://google.com' },
          { type: 'waitForTab', tabId: 'previous' },
          { type: 'executeInTab', tabId: 'previous', action: { type: 'fill', field: '#search', value: 'Chrome extensions' } },
          { type: 'createTab', url: 'https://github.com', windowId: 1 },
          { type: 'waitForTab', tabId: 'previous' },
          { type: 'executeInTab', tabId: 'previous', action: { type: 'click', element: '#search-button' } },
          { type: 'switchToTab', tabId: 1 }
        ]
      };
      
      // Mock all step executions
      const mockGoogleTab = createMockTab({ id: 1, url: 'https://google.com' });
      const mockGithubTab = createMockTab({ id: 2, url: 'https://github.com' });
      
      chrome.tabs.create.mockImplementation((createProperties, callback) => {
        if (createProperties.url === 'https://google.com') {
          callback(mockGoogleTab);
        } else {
          callback(mockGithubTab);
        }
      });
      
      chrome.tabs.get.mockImplementation((id, callback) => {
        callback(createMockTab({ id, status: 'complete' }));
      });
      
      chrome.tabs.sendMessage.mockImplementation((id, message, callback) => {
        if (message.data.action.type === 'fill') {
          callback({ success: true, field: '#search', value: 'Chrome extensions' });
        } else {
          callback({ success: true, element: '#search-button' });
        }
      });
      
      chrome.tabs.update.mockImplementation((id, updateProperties, callback) => {
        callback(createMockTab({ id, active: true }));
      });
      
      const result = await mockMultiTabWorkflow.executeWorkflow(workflow);
      
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(7);
      
      // Verify all steps completed successfully
      result.results.forEach((stepResult) => {
        expect(stepResult.success).toBe(true);
      });
    });
    
    test('should handle concurrent workflows', async () => {
      const workflow1 = {
        name: 'Concurrent Workflow 1',
        steps: [
          { type: 'createTab', url: 'https://example1.com' }
        ]
      };
      
      const workflow2 = {
        name: 'Concurrent Workflow 2',
        steps: [
          { type: 'createTab', url: 'https://example2.com' }
        ]
      };
      
      // Mock tab creation
      chrome.tabs.create.mockImplementation((createProperties, callback) => {
        const mockTab = createMockTab({ url: createProperties.url });
        setTimeout(() => callback(mockTab), 50);
      });
      
      // Execute both workflows concurrently
      const [result1, result2] = await Promise.all([
        mockMultiTabWorkflow.executeWorkflow(workflow1),
        mockMultiTabWorkflow.executeWorkflow(workflow2)
      ]);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(mockMultiTabWorkflow.activeWorkflows.size).toBe(2);
    });
  });
});
