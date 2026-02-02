/**
 * Chrome Extension API abstraction layer
 * Provides wrapper functions for commonly used Chrome APIs with error handling
 */

import { TabInfo, AutomationError } from './automation-types';

export class ChromeApiWrapper {
  private static instance: ChromeApiWrapper;
  
  private constructor() {}
  
  /**
   * Get singleton instance of ChromeApiWrapper
   */
  static getInstance(): ChromeApiWrapper {
    if (!ChromeApiWrapper.instance) {
      ChromeApiWrapper.instance = new ChromeApiWrapper();
    }
    return ChromeApiWrapper.instance;
  }

  /**
   * Execute script in a tab using chrome.scripting.executeScript
   * @param tabId The ID of the tab to execute script in
   * @param func The function to execute
   * @param args Arguments to pass to the function
   * @returns Promise with the result of the script execution
   */
  async executeScript(tabId: number, func: Function, args: any[] = []): Promise<any> {
    try {
      // Check if tab exists before executing script
      await this.ensureTabExists(tabId);
      
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func,
        args
      });
      
      return results[0]?.result;
    } catch (error) {
      throw this.createAutomationError('SCRIPT_EXECUTION_FAILED', 
        `Failed to execute script in tab ${tabId}: ${error.message}`, error);
    }
  }

  /**
   * Navigate to a URL in a specific tab
   * @param tabId The ID of the tab to navigate
   * @param url The URL to navigate to
   * @returns Promise that resolves when navigation completes
   */
  async navigateToUrl(tabId: number, url: string): Promise<void> {
    try {
      // Check if tab exists before navigating
      await this.ensureTabExists(tabId);
      
      await chrome.tabs.update(tabId, { url });
    } catch (error) {
      throw this.createAutomationError('NAVIGATION_FAILED', 
        `Failed to navigate tab ${tabId} to ${url}: ${error.message}`, error);
    }
  }

  /**
   * Get the currently active tab
   * @returns Promise with the active tab information
   */
  async getActiveTab(): Promise<TabInfo> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        throw this.createAutomationError('NO_ACTIVE_TAB', 
          'No active tab found in current window');
      }
      
      return this.convertToTabInfo(tab);
    } catch (error) {
      throw this.createAutomationError('GET_ACTIVE_TAB_FAILED', 
        `Failed to get active tab: ${error.message}`, error);
    }
  }

  /**
   * Get tab information by ID
   * @param tabId The ID of the tab
   * @returns Promise with tab information
   */
  async getTab(tabId: number): Promise<TabInfo> {
    try {
      const tab = await chrome.tabs.get(tabId);
      return this.convertToTabInfo(tab);
    } catch (error) {
      throw this.createAutomationError('GET_TAB_FAILED', 
        `Failed to get tab ${tabId}: ${error.message}`, error);
    }
  }

  /**
   * Create a new tab
   * @param url The URL to open in the new tab
   * @param active Whether the tab should be active
   * @returns Promise with the new tab information
   */
  async createTab(url: string, active: boolean = true): Promise<TabInfo> {
    try {
      const tab = await chrome.tabs.create({ url, active });
      return this.convertToTabInfo(tab);
    } catch (error) {
      throw this.createAutomationError('CREATE_TAB_FAILED', 
        `Failed to create tab with URL ${url}: ${error.message}`, error);
    }
  }

  /**
   * Close a tab
   * @param tabId The ID of the tab to close
   * @returns Promise that resolves when the tab is closed
   */
  async closeTab(tabId: number): Promise<void> {
    try {
      await chrome.tabs.remove(tabId);
    } catch (error) {
      throw this.createAutomationError('CLOSE_TAB_FAILED', 
        `Failed to close tab ${tabId}: ${error.message}`, error);
    }
  }

  /**
   * Switch to a specific tab
   * @param tabId The ID of the tab to switch to
   * @returns Promise that resolves when the tab is activated
   */
  async switchToTab(tabId: number): Promise<void> {
    try {
      await chrome.tabs.update(tabId, { active: true });
    } catch (error) {
      throw this.createAutomationError('SWITCH_TAB_FAILED', 
        `Failed to switch to tab ${tabId}: ${error.message}`, error);
    }
  }

  /**
   * Send a message to a content script
   * @param tabId The ID of the tab to send the message to
   * @param message The message to send
   * @returns Promise with the response from the content script
   */
  async sendMessage(tabId: number, message: any): Promise<any> {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      return response;
    } catch (error) {
      throw this.createAutomationError('MESSAGE_SEND_FAILED', 
        `Failed to send message to tab ${tabId}: ${error.message}`, error);
    }
  }

  /**
   * Get all tabs in the current window
   * @returns Promise with an array of tab information
   */
  async getAllTabs(): Promise<TabInfo[]> {
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      return tabs.map(tab => this.convertToTabInfo(tab));
    } catch (error) {
      throw this.createAutomationError('GET_ALL_TABS_FAILED', 
        `Failed to get all tabs: ${error.message}`, error);
    }
  }

  /**
   * Store data in Chrome storage
   * @param key The key to store data under
   * @param value The value to store
   * @returns Promise that resolves when data is stored
   */
  async setStorageData(key: string, value: any): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      throw this.createAutomationError('STORAGE_SET_FAILED', 
        `Failed to set storage data for key ${key}: ${error.message}`, error);
    }
  }

  /**
   * Retrieve data from Chrome storage
   * @param key The key to retrieve data for
   * @returns Promise with the retrieved data
   */
  async getStorageData(key: string): Promise<any> {
    try {
      const result = await chrome.storage.local.get(key);
      return result[key];
    } catch (error) {
      throw this.createAutomationError('STORAGE_GET_FAILED', 
        `Failed to get storage data for key ${key}: ${error.message}`, error);
    }
  }

  /**
   * Check if a tab exists
   * @param tabId The ID of the tab to check
   * @returns Promise that resolves to true if the tab exists, false otherwise
   */
  async tabExists(tabId: number): Promise<boolean> {
    try {
      await chrome.tabs.get(tabId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Wait for a tab to finish loading
   * @param tabId The ID of the tab to wait for
   * @param timeout Maximum time to wait in milliseconds
   * @returns Promise that resolves when the tab is loaded
   */
  async waitForTabToLoad(tabId: number, timeout: number = 30000): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(this.createAutomationError('TAB_LOAD_TIMEOUT', 
          `Tab ${tabId} did not load within ${timeout}ms`));
      }, timeout);

      try {
        // Check if tab exists
        await this.ensureTabExists(tabId);
        
        // Set up listener for tab update
        const listener = (updatedTabId: number, changeInfo: any) => {
          if (updatedTabId === tabId && changeInfo.status === 'complete') {
            clearTimeout(timeoutId);
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };

        chrome.tabs.onUpdated.addListener(listener);

        // Check if tab is already loaded
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === 'complete') {
          clearTimeout(timeoutId);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      } catch (error) {
        clearTimeout(timeoutId);
        reject(this.createAutomationError('WAIT_FOR_TAB_FAILED', 
          `Failed to wait for tab ${tabId} to load: ${error.message}`, error));
      }
    });
  }

  /**
   * Ensure a tab exists, throw an error if it doesn't
   * @param tabId The ID of the tab to check
   */
  private async ensureTabExists(tabId: number): Promise<void> {
    const exists = await this.tabExists(tabId);
    if (!exists) {
      throw this.createAutomationError('TAB_NOT_FOUND', 
        `Tab with ID ${tabId} does not exist`);
    }
  }

  /**
   * Convert Chrome tab object to our TabInfo interface
   * @param tab The Chrome tab object
   * @returns TabInfo object
   */
  private convertToTabInfo(tab: chrome.tabs.Tab): TabInfo {
    return {
      id: tab.id!,
      url: tab.url || '',
      title: tab.title || '',
      active: tab.active || false,
      windowId: tab.windowId!
    };
  }

  /**
   * Create a standardized automation error
   * @param code Error code
   * @param message Error message
   * @param originalError Original error object
   * @returns AutomationError object
   */
  private createAutomationError(code: string, message: string, originalError?: any): AutomationError {
    return {
      code,
      message,
      details: originalError ? {
        name: originalError.name,
        stack: originalError.stack
      } : undefined
    };
  }
}

// Export singleton instance for convenience
export const chromeApi = ChromeApiWrapper.getInstance(); * Chrome Extension API abstraction layer
 * Provides wrapper functions for commonly used Chrome APIs with error handling
 */

import { TabInfo, AutomationError } from './automation-types';

export class ChromeApiWrapper {
  private static instance: ChromeApiWrapper;
  
  private constructor() {}
  
  /**
   * Get singleton instance of ChromeApiWrapper
   */
  static getInstance(): ChromeApiWrapper {
    if (!ChromeApiWrapper.instance) {
      ChromeApiWrapper.instance = new ChromeApiWrapper();
    }
    return ChromeApiWrapper.instance;
  }

  /**
   * Execute script in a tab using chrome.scripting.executeScript
   * @param tabId The ID of the tab to execute script in
   * @param func The function to execute
   * @param args Arguments to pass to the function
   * @returns Promise with the result of the script execution
   */
  async executeScript(tabId: number, func: Function, args: any[] = []): Promise<any> {
    try {
      // Check if tab exists before executing script
      await this.ensureTabExists(tabId);
      
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func,
        args
      });
      
      return results[0]?.result;
    } catch (error) {
      throw this.createAutomationError('SCRIPT_EXECUTION_FAILED', 
        `Failed to execute script in tab ${tabId}: ${error.message}`, error);
    }
  }

  /**
   * Navigate to a URL in a specific tab
   * @param tabId The ID of the tab to navigate
   * @param url The URL to navigate to
   * @returns Promise that resolves when navigation completes
   */
  async navigateToUrl(tabId: number, url: string): Promise<void> {
    try {
      // Check if tab exists before navigating
      await this.ensureTabExists(tabId);
      
      await chrome.tabs.update(tabId, { url });
    } catch (error) {
      throw this.createAutomationError('NAVIGATION_FAILED', 
        `Failed to navigate tab ${tabId} to ${url}: ${error.message}`, error);
    }
  }

  /**
   * Get the currently active tab
   * @returns Promise with the active tab information
   */
  async getActiveTab(): Promise<TabInfo> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        throw this.createAutomationError('NO_ACTIVE_TAB', 
          'No active tab found in current window');
      }
      
      return this.convertToTabInfo(tab);
    } catch (error) {
      throw this.createAutomationError('GET_ACTIVE_TAB_FAILED', 
        `Failed to get active tab: ${error.message}`, error);
    }
  }

  /**
   * Get tab information by ID
   * @param tabId The ID of the tab
   * @returns Promise with tab information
   */
  async getTab(tabId: number): Promise<TabInfo> {
    try {
      const tab = await chrome.tabs.get(tabId);
      return this.convertToTabInfo(tab);
    } catch (error) {
      throw this.createAutomationError('GET_TAB_FAILED', 
        `Failed to get tab ${tabId}: ${error.message}`, error);
    }
  }

  /**
   * Create a new tab
   * @param url The URL to open in the new tab
   * @param active Whether the tab should be active
   * @returns Promise with the new tab information
   */
  async createTab(url: string, active: boolean = true): Promise<TabInfo> {
    try {
      const tab = await chrome.tabs.create({ url, active });
      return this.convertToTabInfo(tab);
    } catch (error) {
      throw this.createAutomationError('CREATE_TAB_FAILED', 
        `Failed to create tab with URL ${url}: ${error.message}`, error);
    }
  }

  /**
   * Close a tab
   * @param tabId The ID of the tab to close
   * @returns Promise that resolves when the tab is closed
   */
  async closeTab(tabId: number): Promise<void> {
    try {
      await chrome.tabs.remove(tabId);
    } catch (error) {
      throw this.createAutomationError('CLOSE_TAB_FAILED', 
        `Failed to close tab ${tabId}: ${error.message}`, error);
    }
  }

  /**
   * Switch to a specific tab
   * @param tabId The ID of the tab to switch to
   * @returns Promise that resolves when the tab is activated
   */
  async switchToTab(tabId: number): Promise<void> {
    try {
      await chrome.tabs.update(tabId, { active: true });
    } catch (error) {
      throw this.createAutomationError('SWITCH_TAB_FAILED', 
        `Failed to switch to tab ${tabId}: ${error.message}`, error);
    }
  }

  /**
   * Send a message to a content script
   * @param tabId The ID of the tab to send the message to
   * @param message The message to send
   * @returns Promise with the response from the content script
   */
  async sendMessage(tabId: number, message: any): Promise<any> {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      return response;
    } catch (error) {
      throw this.createAutomationError('MESSAGE_SEND_FAILED', 
        `Failed to send message to tab ${tabId}: ${error.message}`, error);
    }
  }

  /**
   * Get all tabs in the current window
   * @returns Promise with an array of tab information
   */
  async getAllTabs(): Promise<TabInfo[]> {
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      return tabs.map(tab => this.convertToTabInfo(tab));
    } catch (error) {
      throw this.createAutomationError('GET_ALL_TABS_FAILED', 
        `Failed to get all tabs: ${error.message}`, error);
    }
  }

  /**
   * Store data in Chrome storage
   * @param key The key to store data under
   * @param value The value to store
   * @returns Promise that resolves when data is stored
   */
  async setStorageData(key: string, value: any): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      throw this.createAutomationError('STORAGE_SET_FAILED', 
        `Failed to set storage data for key ${key}: ${error.message}`, error);
    }
  }

  /**
   * Retrieve data from Chrome storage
   * @param key The key to retrieve data for
   * @returns Promise with the retrieved data
   */
  async getStorageData(key: string): Promise<any> {
    try {
      const result = await chrome.storage.local.get(key);
      return result[key];
    } catch (error) {
      throw this.createAutomationError('STORAGE_GET_FAILED', 
        `Failed to get storage data for key ${key}: ${error.message}`, error);
    }
  }

  /**
   * Check if a tab exists
   * @param tabId The ID of the tab to check
   * @returns Promise that resolves to true if the tab exists, false otherwise
   */
  async tabExists(tabId: number): Promise<boolean> {
    try {
      await chrome.tabs.get(tabId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Wait for a tab to finish loading
   * @param tabId The ID of the tab to wait for
   * @param timeout Maximum time to wait in milliseconds
   * @returns Promise that resolves when the tab is loaded
   */
  async waitForTabToLoad(tabId: number, timeout: number = 30000): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(this.createAutomationError('TAB_LOAD_TIMEOUT', 
          `Tab ${tabId} did not load within ${timeout}ms`));
      }, timeout);

      try {
        // Check if tab exists
        await this.ensureTabExists(tabId);
        
        // Set up listener for tab update
        const listener = (updatedTabId: number, changeInfo: any) => {
          if (updatedTabId === tabId && changeInfo.status === 'complete') {
            clearTimeout(timeoutId);
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };

        chrome.tabs.onUpdated.addListener(listener);

        // Check if tab is already loaded
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === 'complete') {
          clearTimeout(timeoutId);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      } catch (error) {
        clearTimeout(timeoutId);
        reject(this.createAutomationError('WAIT_FOR_TAB_FAILED', 
          `Failed to wait for tab ${tabId} to load: ${error.message}`, error));
      }
    });
  }

  /**
   * Ensure a tab exists, throw an error if it doesn't
   * @param tabId The ID of the tab to check
   */
  private async ensureTabExists(tabId: number): Promise<void> {
    const exists = await this.tabExists(tabId);
    if (!exists) {
      throw this.createAutomationError('TAB_NOT_FOUND', 
        `Tab with ID ${tabId} does not exist`);
    }
  }

  /**
   * Convert Chrome tab object to our TabInfo interface
   * @param tab The Chrome tab object
   * @returns TabInfo object
   */
  private convertToTabInfo(tab: chrome.tabs.Tab): TabInfo {
    return {
      id: tab.id!,
      url: tab.url || '',
      title: tab.title || '',
      active: tab.active || false,
      windowId: tab.windowId!
    };
  }

  /**
   * Create a standardized automation error
   * @param code Error code
   * @param message Error message
   * @param originalError Original error object
   * @returns AutomationError object
   */
  private createAutomationError(code: string, message: string, originalError?: any): AutomationError {
    return {
      code,
      message,
      details: originalError ? {
        name: originalError.name,
        stack: originalError.stack
      } : undefined
    };
  }
}

// Export singleton instance for convenience
export const chromeApi = ChromeApiWrapper.getInstance();
