/**




import { TabInfo, AutomationError } from './automation-types';

export class ChromeApiWrapper {
  private static instance: ChromeApiWrapper;
  
  private constructor() {}
  
  /**
  
  
  static getInstance(): ChromeApiWrapper {
    if (!ChromeApiWrapper.instance) {
      ChromeApiWrapper.instance = new ChromeApiWrapper();
    }
    return ChromeApiWrapper.instance;
  }

  /**
  
  
  
  
  
  
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
  
  
  
  
  async closeTab(tabId: number): Promise<void> {
    try {
      await chrome.tabs.remove(tabId);
    } catch (error) {
      throw this.createAutomationError('CLOSE_TAB_FAILED', 
        `Failed to close tab ${tabId}: ${error.message}`, error);
    }
  }

  /**
  
  
  
  
  async switchToTab(tabId: number): Promise<void> {
    try {
      await chrome.tabs.update(tabId, { active: true });
    } catch (error) {
      throw this.createAutomationError('SWITCH_TAB_FAILED', 
        `Failed to switch to tab ${tabId}: ${error.message}`, error);
    }
  }

  /**
  
  
  
  
  
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
  
  
  
  
  
  async setStorageData(key: string, value: any): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      throw this.createAutomationError('STORAGE_SET_FAILED', 
        `Failed to set storage data for key ${key}: ${error.message}`, error);
    }
  }

  /**
  
  
  
  
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
  
  
  
  
  async tabExists(tabId: number): Promise<boolean> {
    try {
      await chrome.tabs.get(tabId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
  
  
  
  
  
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
  
  
  
  private async ensureTabExists(tabId: number): Promise<void> {
    const exists = await this.tabExists(tabId);
    if (!exists) {
      throw this.createAutomationError('TAB_NOT_FOUND', 
        `Tab with ID ${tabId} does not exist`);
    }
  }

  /**
  
  
  
  
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
