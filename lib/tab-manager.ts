/**
 * Tab manager for multi-tab workflows
 * Manages tab creation, switching, and cleanup
 */

import { TabInfo } from './automation-types';
import { chromeApi } from './chrome-api-wrappers';

export interface TabOptions {
  active?: boolean;
  pinned?: boolean;
  windowId?: number;
  index?: number;
  url?: string;
}

export interface TabGroup {
  id: string;
  name: string;
  tabs: number[];
  windowId: number;
}

export class TabManager {
  private tabGroups: Map<string, TabGroup> = new Map();
  private tabWorkflows: Map<number, string> = new Map();
  private tabListeners: Map<number, (() => void)[]> = new Map();

  /**
   * Create a new tab
   */
  async createTab(url: string, options: TabOptions = {}): Promise<TabInfo> {
    try {
      const tab = await chromeApi.createTab(url, options.active !== false);
      
      // Track tab if it's part of a workflow
      if (options.windowId) {
        this.tabWorkflows.set(tab.id, options.windowId.toString());
      }
      
      return tab;
    } catch (error) {
      throw new Error(`Failed to create tab: ${error.message}`);
    }
  }

  /**
   * Get a tab by ID
   */
  async getTab(tabId: number): Promise<TabInfo> {
    try {
      return await chromeApi.getTab(tabId);
    } catch (error) {
      throw new Error(`Failed to get tab: ${error.message}`);
    }
  }

  /**
   * Get the active tab
   */
  async getActiveTab(): Promise<TabInfo> {
    try {
      return await chromeApi.getActiveTab();
    } catch (error) {
      throw new Error(`Failed to get active tab: ${error.message}`);
    }
  }

  /**
   * Switch to a specific tab
   */
  async switchToTab(tabId: number): Promise<TabInfo> {
    try {
      await chromeApi.switchToTab(tabId);
      return await chromeApi.getTab(tabId);
    } catch (error) {
      throw new Error(`Failed to switch to tab: ${error.message}`);
    }
  }

  /**
   * Close a tab
   */
  async closeTab(tabId: number): Promise<boolean> {
    try {
      await chromeApi.closeTab(tabId);
      
      // Clean up tracking
      this.tabWorkflows.delete(tabId);
      this.tabListeners.delete(tabId);
      
      return true;
    } catch (error) {
      throw new Error(`Failed to close tab: ${error.message}`);
    }
  }

  /**
   * Close multiple tabs
   */
  async closeTabs(tabIds: number[]): Promise<boolean[]> {
    const results: boolean[] = [];
    
    for (const tabId of tabIds) {
      try {
        await this.closeTab(tabId);
        results.push(true);
      } catch (error) {
        console.error(`Failed to close tab ${tabId}:`, error);
        results.push(false);
      }
    }
    
    return results;
  }

  /**
   * Get all tabs in the current window
   */
  async getAllTabs(): Promise<TabInfo[]> {
    try {
      return await chromeApi.getAllTabs();
    } catch (error) {
      throw new Error(`Failed to get all tabs: ${error.message}`);
    }
  }

  /**
   * Get tabs by URL pattern
   */
  async getTabsByUrl(urlPattern: string): Promise<TabInfo[]> {
    try {
      const allTabs = await this.getAllTabs();
      const regex = new RegExp(urlPattern);
      
      return allTabs.filter(tab => regex.test(tab.url));
    } catch (error) {
      throw new Error(`Failed to get tabs by URL: ${error.message}`);
    }
  }

  /**
   * Get tabs by title pattern
   */
  async getTabsByTitle(titlePattern: string): Promise<TabInfo[]> {
    try {
      const allTabs = await this.getAllTabs();
      const regex = new RegExp(titlePattern);
      
      return allTabs.filter(tab => regex.test(tab.title));
    } catch (error) {
      throw new Error(`Failed to get tabs by title: ${error.message}`);
    }
  }

  /**
   * Duplicate a tab
   */
  async duplicateTab(tabId: number, active: boolean = false): Promise<TabInfo> {
    try {
      const tab = await chromeApi.getTab(tabId);
      return await this.createTab(tab.url, { active });
    } catch (error) {
      throw new Error(`Failed to duplicate tab: ${error.message}`);
    }
  }

  /**
   * Reload a tab
   */
  async reloadTab(tabId: number, bypassCache: boolean = false): Promise<boolean> {
    try {
      const reloadFunction = (tabId: number, bypass: boolean) => {
        return new Promise((resolve, reject) => {
          chrome.tabs.reload(tabId, { bypassCache: bypass }, () => {
            resolve(true);
          });
        });
      };
      
      return await chromeApi.executeScript(-1, reloadFunction, [tabId, bypassCache]);
    } catch (error) {
      throw new Error(`Failed to reload tab: ${error.message}`);
    }
  }

  /**
   * Go back in a tab
   */
  async goBack(tabId: number): Promise<boolean> {
    try {
      const goBackFunction = (tabId: number) => {
        return new Promise((resolve, reject) => {
          chrome.tabs.goBack(tabId, () => {
            resolve(true);
          });
        });
      };
      
      return await chromeApi.executeScript(-1, goBackFunction, [tabId]);
    } catch (error) {
      throw new Error(`Failed to go back: ${error.message}`);
    }
  }

  /**
   * Go forward in a tab
   */
  async goForward(tabId: number): Promise<boolean> {
    try {
      const goForwardFunction = (tabId: number) => {
        return new Promise((resolve, reject) => {
          chrome.tabs.goForward(tabId, () => {
            resolve(true);
          });
        });
      };
      
      return await chromeApi.executeScript(-1, goForwardFunction, [tabId]);
    } catch (error) {
      throw new Error(`Failed to go forward: ${error.message}`);
    }
  }

  /**
   * Create a tab group
   */
  async createTabGroup(name: string, urls: string[]): Promise<TabGroup> {
    try {
      const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const tabs: TabInfo[] = [];
      
      // Create tabs for each URL
      for (let i = 0; i < urls.length; i++) {
        const tab = await this.createTab(urls[i], { active: i === 0 });
        tabs.push(tab);
        this.tabWorkflows.set(tab.id, groupId);
      }
      
      const tabGroup: TabGroup = {
        id: groupId,
        name,
        tabs: tabs.map(tab => tab.id),
        windowId: tabs[0].windowId
      };
      
      this.tabGroups.set(groupId, tabGroup);
      
      return tabGroup;
    } catch (error) {
      throw new Error(`Failed to create tab group: ${error.message}`);
    }
  }

  /**
   * Get a tab group
   */
  getTabGroup(groupId: string): TabGroup | undefined {
    return this.tabGroups.get(groupId);
  }

  /**
   * Get all tab groups
   */
  getAllTabGroups(): TabGroup[] {
    return Array.from(this.tabGroups.values());
  }

  /**
   * Close a tab group
   */
  async closeTabGroup(groupId: string): Promise<boolean> {
    try {
      const tabGroup = this.tabGroups.get(groupId);
      
      if (!tabGroup) {
        throw new Error(`Tab group not found: ${groupId}`);
      }
      
      // Close all tabs in the group
      await this.closeTabs(tabGroup.tabs);
      
      // Remove the group
      this.tabGroups.delete(groupId);
      
      return true;
    } catch (error) {
      throw new Error(`Failed to close tab group: ${error.message}`);
    }
  }

  /**
   * Switch to tab group
   */
  async switchToTabGroup(groupId: string): Promise<boolean> {
    try {
      const tabGroup = this.tabGroups.get(groupId);
      
      if (!tabGroup) {
        throw new Error(`Tab group not found: ${groupId}`);
      }
      
      // Switch to the first tab in the group
      if (tabGroup.tabs.length > 0) {
        await this.switchToTab(tabGroup.tabs[0]);
      }
      
      return true;
    } catch (error) {
      throw new Error(`Failed to switch to tab group: ${error.message}`);
    }
  }

  /**
   * Add a tab to a group
   */
  async addTabToGroup(groupId: string, url: string): Promise<boolean> {
    try {
      const tabGroup = this.tabGroups.get(groupId);
      
      if (!tabGroup) {
        throw new Error(`Tab group not found: ${groupId}`);
      }
      
      const tab = await this.createTab(url);
      tabGroup.tabs.push(tab.id);
      this.tabWorkflows.set(tab.id, groupId);
      
      return true;
    } catch (error) {
      throw new Error(`Failed to add tab to group: ${error.message}`);
    }
  }

  /**
   * Remove a tab from a group
   */
  async removeTabFromGroup(groupId: string, tabId: number): Promise<boolean> {
    try {
      const tabGroup = this.tabGroups.get(groupId);
      
      if (!tabGroup) {
        throw new Error(`Tab group not found: ${groupId}`);
      }
      
      const index = tabGroup.tabs.indexOf(tabId);
      
      if (index === -1) {
        throw new Error(`Tab not in group: ${tabId}`);
      }
      
      tabGroup.tabs.splice(index, 1);
      this.tabWorkflows.delete(tabId);
      
      return true;
    } catch (error) {
      throw new Error(`Failed to remove tab from group: ${error.message}`);
    }
  }

  /**
   * Add a tab event listener
   */
  addTabListener(tabId: number, listener: () => void): void {
    if (!this.tabListeners.has(tabId)) {
      this.tabListeners.set(tabId, []);
    }
    
    this.tabListeners.get(tabId)!.push(listener);
  }

  /**
   * Remove a tab event listener
   */
  removeTabListener(tabId: number, listener: () => void): void {
    const listeners = this.tabListeners.get(tabId);
    
    if (listeners) {
      const index = listeners.indexOf(listener);
      
      if (index !== -1) {
        listeners.splice(index, 1);
      }
      
      if (listeners.length === 0) {
        this.tabListeners.delete(tabId);
      }
    }
  }

  /**
   * Trigger tab event listeners
   */
  triggerTabListeners(tabId: number): void {
    const listeners = this.tabListeners.get(tabId);
    
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener();
        } catch (error) {
          console.error('Tab listener error:', error);
        }
      });
    }
  }

  /**
   * Get tabs by workflow
   */
  getTabsByWorkflow(workflowId: string): TabInfo[] {
    const tabIds: number[] = [];
    
    this.tabWorkflows.forEach((id, tabId) => {
      if (id === workflowId) {
        tabIds.push(tabId);
      }
    });
    
    return Array.from(this.tabWorkflows.keys()).filter(id => 
      this.tabWorkflows.get(id) === workflowId
    ).map(id => ({ id } as TabInfo));
  }

  /**
   * Clean up tabs for a workflow
   */
  async cleanupWorkflowTabs(workflowId: string): Promise<void> {
    const tabIds: number[] = [];
    
    this.tabWorkflows.forEach((id, tabId) => {
      if (id === workflowId) {
        tabIds.push(tabId);
      }
    });
    
    // Close tabs
    await this.closeTabs(tabIds);
    
    // Clean up listeners
    tabIds.forEach(tabId => {
      this.tabListeners.delete(tabId);
    });
  }

  /**
   * Get tab statistics
   */
  async getTabStatistics(): Promise<any> {
    try {
      const allTabs = await this.getAllTabs();
      
      const stats = {
        totalTabs: allTabs.length,
        activeTabs: allTabs.filter(tab => tab.active).length,
        tabGroups: this.tabGroups.size,
        workflows: new Set(Array.from(this.tabWorkflows.values())).size,
        tabsByUrl: {} as Record<string, number>,
        tabsByWindow: {} as Record<number, number>
      };
      
      // Group tabs by URL
      allTabs.forEach(tab => {
        const domain = new URL(tab.url).hostname;
        stats.tabsByUrl[domain] = (stats.tabsByUrl[domain] || 0) + 1;
      });
      
      // Group tabs by window
      allTabs.forEach(tab => {
        stats.tabsByWindow[tab.windowId] = (stats.tabsByWindow[tab.windowId] || 0) + 1;
      });
      
      return stats;
    } catch (error) {
      throw new Error(`Failed to get tab statistics: ${error.message}`);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      // Close all tab groups
      const groupIds = Array.from(this.tabGroups.keys());
      
      for (const groupId of groupIds) {
        try {
          await this.closeTabGroup(groupId);
        } catch (error) {
          console.error(`Failed to close tab group ${groupId}:`, error);
        }
      }
      
      // Clear all tracking
      this.tabGroups.clear();
      this.tabWorkflows.clear();
      this.tabListeners.clear();
    } catch (error) {
      throw new Error(`Failed to cleanup tab manager: ${error.message}`);
    }
  }
}

// Export singleton instance for convenience
export const tabManager = new TabManager(); * Tab manager for multi-tab workflows
 * Manages tab creation, switching, and cleanup
 */

import { TabInfo } from './automation-types';
import { chromeApi } from './chrome-api-wrappers';

export interface TabOptions {
  active?: boolean;
  pinned?: boolean;
  windowId?: number;
  index?: number;
  url?: string;
}

export interface TabGroup {
  id: string;
  name: string;
  tabs: number[];
  windowId: number;
}

export class TabManager {
  private tabGroups: Map<string, TabGroup> = new Map();
  private tabWorkflows: Map<number, string> = new Map();
  private tabListeners: Map<number, (() => void)[]> = new Map();

  /**
   * Create a new tab
   */
  async createTab(url: string, options: TabOptions = {}): Promise<TabInfo> {
    try {
      const tab = await chromeApi.createTab(url, options.active !== false);
      
      // Track tab if it's part of a workflow
      if (options.windowId) {
        this.tabWorkflows.set(tab.id, options.windowId.toString());
      }
      
      return tab;
    } catch (error) {
      throw new Error(`Failed to create tab: ${error.message}`);
    }
  }

  /**
   * Get a tab by ID
   */
  async getTab(tabId: number): Promise<TabInfo> {
    try {
      return await chromeApi.getTab(tabId);
    } catch (error) {
      throw new Error(`Failed to get tab: ${error.message}`);
    }
  }

  /**
   * Get the active tab
   */
  async getActiveTab(): Promise<TabInfo> {
    try {
      return await chromeApi.getActiveTab();
    } catch (error) {
      throw new Error(`Failed to get active tab: ${error.message}`);
    }
  }

  /**
   * Switch to a specific tab
   */
  async switchToTab(tabId: number): Promise<TabInfo> {
    try {
      await chromeApi.switchToTab(tabId);
      return await chromeApi.getTab(tabId);
    } catch (error) {
      throw new Error(`Failed to switch to tab: ${error.message}`);
    }
  }

  /**
   * Close a tab
   */
  async closeTab(tabId: number): Promise<boolean> {
    try {
      await chromeApi.closeTab(tabId);
      
      // Clean up tracking
      this.tabWorkflows.delete(tabId);
      this.tabListeners.delete(tabId);
      
      return true;
    } catch (error) {
      throw new Error(`Failed to close tab: ${error.message}`);
    }
  }

  /**
   * Close multiple tabs
   */
  async closeTabs(tabIds: number[]): Promise<boolean[]> {
    const results: boolean[] = [];
    
    for (const tabId of tabIds) {
      try {
        await this.closeTab(tabId);
        results.push(true);
      } catch (error) {
        console.error(`Failed to close tab ${tabId}:`, error);
        results.push(false);
      }
    }
    
    return results;
  }

  /**
   * Get all tabs in the current window
   */
  async getAllTabs(): Promise<TabInfo[]> {
    try {
      return await chromeApi.getAllTabs();
    } catch (error) {
      throw new Error(`Failed to get all tabs: ${error.message}`);
    }
  }

  /**
   * Get tabs by URL pattern
   */
  async getTabsByUrl(urlPattern: string): Promise<TabInfo[]> {
    try {
      const allTabs = await this.getAllTabs();
      const regex = new RegExp(urlPattern);
      
      return allTabs.filter(tab => regex.test(tab.url));
    } catch (error) {
      throw new Error(`Failed to get tabs by URL: ${error.message}`);
    }
  }

  /**
   * Get tabs by title pattern
   */
  async getTabsByTitle(titlePattern: string): Promise<TabInfo[]> {
    try {
      const allTabs = await this.getAllTabs();
      const regex = new RegExp(titlePattern);
      
      return allTabs.filter(tab => regex.test(tab.title));
    } catch (error) {
      throw new Error(`Failed to get tabs by title: ${error.message}`);
    }
  }

  /**
   * Duplicate a tab
   */
  async duplicateTab(tabId: number, active: boolean = false): Promise<TabInfo> {
    try {
      const tab = await chromeApi.getTab(tabId);
      return await this.createTab(tab.url, { active });
    } catch (error) {
      throw new Error(`Failed to duplicate tab: ${error.message}`);
    }
  }

  /**
   * Reload a tab
   */
  async reloadTab(tabId: number, bypassCache: boolean = false): Promise<boolean> {
    try {
      const reloadFunction = (tabId: number, bypass: boolean) => {
        return new Promise((resolve, reject) => {
          chrome.tabs.reload(tabId, { bypassCache: bypass }, () => {
            resolve(true);
          });
        });
      };
      
      return await chromeApi.executeScript(-1, reloadFunction, [tabId, bypassCache]);
    } catch (error) {
      throw new Error(`Failed to reload tab: ${error.message}`);
    }
  }

  /**
   * Go back in a tab
   */
  async goBack(tabId: number): Promise<boolean> {
    try {
      const goBackFunction = (tabId: number) => {
        return new Promise((resolve, reject) => {
          chrome.tabs.goBack(tabId, () => {
            resolve(true);
          });
        });
      };
      
      return await chromeApi.executeScript(-1, goBackFunction, [tabId]);
    } catch (error) {
      throw new Error(`Failed to go back: ${error.message}`);
    }
  }

  /**
   * Go forward in a tab
   */
  async goForward(tabId: number): Promise<boolean> {
    try {
      const goForwardFunction = (tabId: number) => {
        return new Promise((resolve, reject) => {
          chrome.tabs.goForward(tabId, () => {
            resolve(true);
          });
        });
      };
      
      return await chromeApi.executeScript(-1, goForwardFunction, [tabId]);
    } catch (error) {
      throw new Error(`Failed to go forward: ${error.message}`);
    }
  }

  /**
   * Create a tab group
   */
  async createTabGroup(name: string, urls: string[]): Promise<TabGroup> {
    try {
      const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const tabs: TabInfo[] = [];
      
      // Create tabs for each URL
      for (let i = 0; i < urls.length; i++) {
        const tab = await this.createTab(urls[i], { active: i === 0 });
        tabs.push(tab);
        this.tabWorkflows.set(tab.id, groupId);
      }
      
      const tabGroup: TabGroup = {
        id: groupId,
        name,
        tabs: tabs.map(tab => tab.id),
        windowId: tabs[0].windowId
      };
      
      this.tabGroups.set(groupId, tabGroup);
      
      return tabGroup;
    } catch (error) {
      throw new Error(`Failed to create tab group: ${error.message}`);
    }
  }

  /**
   * Get a tab group
   */
  getTabGroup(groupId: string): TabGroup | undefined {
    return this.tabGroups.get(groupId);
  }

  /**
   * Get all tab groups
   */
  getAllTabGroups(): TabGroup[] {
    return Array.from(this.tabGroups.values());
  }

  /**
   * Close a tab group
   */
  async closeTabGroup(groupId: string): Promise<boolean> {
    try {
      const tabGroup = this.tabGroups.get(groupId);
      
      if (!tabGroup) {
        throw new Error(`Tab group not found: ${groupId}`);
      }
      
      // Close all tabs in the group
      await this.closeTabs(tabGroup.tabs);
      
      // Remove the group
      this.tabGroups.delete(groupId);
      
      return true;
    } catch (error) {
      throw new Error(`Failed to close tab group: ${error.message}`);
    }
  }

  /**
   * Switch to tab group
   */
  async switchToTabGroup(groupId: string): Promise<boolean> {
    try {
      const tabGroup = this.tabGroups.get(groupId);
      
      if (!tabGroup) {
        throw new Error(`Tab group not found: ${groupId}`);
      }
      
      // Switch to the first tab in the group
      if (tabGroup.tabs.length > 0) {
        await this.switchToTab(tabGroup.tabs[0]);
      }
      
      return true;
    } catch (error) {
      throw new Error(`Failed to switch to tab group: ${error.message}`);
    }
  }

  /**
   * Add a tab to a group
   */
  async addTabToGroup(groupId: string, url: string): Promise<boolean> {
    try {
      const tabGroup = this.tabGroups.get(groupId);
      
      if (!tabGroup) {
        throw new Error(`Tab group not found: ${groupId}`);
      }
      
      const tab = await this.createTab(url);
      tabGroup.tabs.push(tab.id);
      this.tabWorkflows.set(tab.id, groupId);
      
      return true;
    } catch (error) {
      throw new Error(`Failed to add tab to group: ${error.message}`);
    }
  }

  /**
   * Remove a tab from a group
   */
  async removeTabFromGroup(groupId: string, tabId: number): Promise<boolean> {
    try {
      const tabGroup = this.tabGroups.get(groupId);
      
      if (!tabGroup) {
        throw new Error(`Tab group not found: ${groupId}`);
      }
      
      const index = tabGroup.tabs.indexOf(tabId);
      
      if (index === -1) {
        throw new Error(`Tab not in group: ${tabId}`);
      }
      
      tabGroup.tabs.splice(index, 1);
      this.tabWorkflows.delete(tabId);
      
      return true;
    } catch (error) {
      throw new Error(`Failed to remove tab from group: ${error.message}`);
    }
  }

  /**
   * Add a tab event listener
   */
  addTabListener(tabId: number, listener: () => void): void {
    if (!this.tabListeners.has(tabId)) {
      this.tabListeners.set(tabId, []);
    }
    
    this.tabListeners.get(tabId)!.push(listener);
  }

  /**
   * Remove a tab event listener
   */
  removeTabListener(tabId: number, listener: () => void): void {
    const listeners = this.tabListeners.get(tabId);
    
    if (listeners) {
      const index = listeners.indexOf(listener);
      
      if (index !== -1) {
        listeners.splice(index, 1);
      }
      
      if (listeners.length === 0) {
        this.tabListeners.delete(tabId);
      }
    }
  }

  /**
   * Trigger tab event listeners
   */
  triggerTabListeners(tabId: number): void {
    const listeners = this.tabListeners.get(tabId);
    
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener();
        } catch (error) {
          console.error('Tab listener error:', error);
        }
      });
    }
  }

  /**
   * Get tabs by workflow
   */
  getTabsByWorkflow(workflowId: string): TabInfo[] {
    const tabIds: number[] = [];
    
    this.tabWorkflows.forEach((id, tabId) => {
      if (id === workflowId) {
        tabIds.push(tabId);
      }
    });
    
    return Array.from(this.tabWorkflows.keys()).filter(id => 
      this.tabWorkflows.get(id) === workflowId
    ).map(id => ({ id } as TabInfo));
  }

  /**
   * Clean up tabs for a workflow
   */
  async cleanupWorkflowTabs(workflowId: string): Promise<void> {
    const tabIds: number[] = [];
    
    this.tabWorkflows.forEach((id, tabId) => {
      if (id === workflowId) {
        tabIds.push(tabId);
      }
    });
    
    // Close tabs
    await this.closeTabs(tabIds);
    
    // Clean up listeners
    tabIds.forEach(tabId => {
      this.tabListeners.delete(tabId);
    });
  }

  /**
   * Get tab statistics
   */
  async getTabStatistics(): Promise<any> {
    try {
      const allTabs = await this.getAllTabs();
      
      const stats = {
        totalTabs: allTabs.length,
        activeTabs: allTabs.filter(tab => tab.active).length,
        tabGroups: this.tabGroups.size,
        workflows: new Set(Array.from(this.tabWorkflows.values())).size,
        tabsByUrl: {} as Record<string, number>,
        tabsByWindow: {} as Record<number, number>
      };
      
      // Group tabs by URL
      allTabs.forEach(tab => {
        const domain = new URL(tab.url).hostname;
        stats.tabsByUrl[domain] = (stats.tabsByUrl[domain] || 0) + 1;
      });
      
      // Group tabs by window
      allTabs.forEach(tab => {
        stats.tabsByWindow[tab.windowId] = (stats.tabsByWindow[tab.windowId] || 0) + 1;
      });
      
      return stats;
    } catch (error) {
      throw new Error(`Failed to get tab statistics: ${error.message}`);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      // Close all tab groups
      const groupIds = Array.from(this.tabGroups.keys());
      
      for (const groupId of groupIds) {
        try {
          await this.closeTabGroup(groupId);
        } catch (error) {
          console.error(`Failed to close tab group ${groupId}:`, error);
        }
      }
      
      // Clear all tracking
      this.tabGroups.clear();
      this.tabWorkflows.clear();
      this.tabListeners.clear();
    } catch (error) {
      throw new Error(`Failed to cleanup tab manager: ${error.message}`);
    }
  }
}

// Export singleton instance for convenience
export const tabManager = new TabManager();
