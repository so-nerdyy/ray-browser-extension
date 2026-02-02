/**
 * Chrome Tabs API Wrapper
 * Provides type-safe utilities for tab management operations
 */

import type { TabInfo } from '../types/chrome-api';

/**
 * Get the current active tab
 */
export async function getCurrentTab(): Promise<chrome.tabs.Tab | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  } catch (error) {
    console.error('Failed to get current tab:', error);
    return null;
  }
}

/**
 * Get all tabs in the current window
 */
export async function getAllTabs(): Promise<chrome.tabs.Tab[]> {
  try {
    return await chrome.tabs.query({ currentWindow: true });
  } catch (error) {
    console.error('Failed to get all tabs:', error);
    return [];
  }
}

/**
 * Create a new tab
 */
export async function createTab(url: string, active: boolean = true): Promise<chrome.tabs.Tab> {
  try {
    return await chrome.tabs.create({ url, active });
  } catch (error) {
    console.error('Failed to create tab:', error);
    throw error;
  }
}

/**
 * Navigate to a URL in the specified tab
 */
export async function navigateTab(tabId: number, url: string): Promise<chrome.tabs.Tab> {
  try {
    return await chrome.tabs.update(tabId, { url });
  } catch (error) {
    console.error('Failed to navigate tab:', error);
    throw error;
  }
}

/**
 * Reload the specified tab
 */
export async function reloadTab(tabId: number, bypassCache: boolean = false): Promise<void> {
  try {
    await chrome.tabs.reload(tabId, { bypassCache });
  } catch (error) {
    console.error('Failed to reload tab:', error);
    throw error;
  }
}

/**
 * Close the specified tab(s)
 */
export async function closeTab(tabIds: number | number[]): Promise<void> {
  try {
    await chrome.tabs.remove(tabIds);
  } catch (error) {
    console.error('Failed to close tab:', error);
    throw error;
  }
}

/**
 * Get tab information in a standardized format
 */
export async function getTabInfo(tabId: number): Promise<TabInfo | null> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.id || !tab.url || !tab.title || !tab.windowId) {
      return null;
    }

    return {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      active: tab.active,
      windowId: tab.windowId
    };
  } catch (error) {
    console.error('Failed to get tab info:', error);
    return null;
  }
}

/**
 * Execute a callback function when a tab is updated
 */
export function onTabUpdated(callback: (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void): void {
  chrome.tabs.onUpdated.addListener(callback);
}

/**
 * Execute a callback function when a tab is created
 */
export function onTabCreated(callback: (tab: chrome.tabs.Tab) => void): void {
  chrome.tabs.onCreated.addListener(callback);
}

/**
 * Execute a callback function when a tab is removed
 */
export function onTabRemoved(callback: (tabId: number, removeInfo: chrome.tabs.TabRemoveInfo) => void): void {
  chrome.tabs.onRemoved.addListener(callback);
}

/**
 * Remove tab event listeners
 */
export function removeTabListeners(): void {
  chrome.tabs.onUpdated.removeListener(() => {});
  chrome.tabs.onCreated.removeListener(() => {});
  chrome.tabs.onRemoved.removeListener(() => {});
} * Chrome Tabs API Wrapper
 * Provides type-safe utilities for tab management operations
 */

import type { TabInfo } from '../types/chrome-api';

/**
 * Get the current active tab
 */
export async function getCurrentTab(): Promise<chrome.tabs.Tab | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  } catch (error) {
    console.error('Failed to get current tab:', error);
    return null;
  }
}

/**
 * Get all tabs in the current window
 */
export async function getAllTabs(): Promise<chrome.tabs.Tab[]> {
  try {
    return await chrome.tabs.query({ currentWindow: true });
  } catch (error) {
    console.error('Failed to get all tabs:', error);
    return [];
  }
}

/**
 * Create a new tab
 */
export async function createTab(url: string, active: boolean = true): Promise<chrome.tabs.Tab> {
  try {
    return await chrome.tabs.create({ url, active });
  } catch (error) {
    console.error('Failed to create tab:', error);
    throw error;
  }
}

/**
 * Navigate to a URL in the specified tab
 */
export async function navigateTab(tabId: number, url: string): Promise<chrome.tabs.Tab> {
  try {
    return await chrome.tabs.update(tabId, { url });
  } catch (error) {
    console.error('Failed to navigate tab:', error);
    throw error;
  }
}

/**
 * Reload the specified tab
 */
export async function reloadTab(tabId: number, bypassCache: boolean = false): Promise<void> {
  try {
    await chrome.tabs.reload(tabId, { bypassCache });
  } catch (error) {
    console.error('Failed to reload tab:', error);
    throw error;
  }
}

/**
 * Close the specified tab(s)
 */
export async function closeTab(tabIds: number | number[]): Promise<void> {
  try {
    await chrome.tabs.remove(tabIds);
  } catch (error) {
    console.error('Failed to close tab:', error);
    throw error;
  }
}

/**
 * Get tab information in a standardized format
 */
export async function getTabInfo(tabId: number): Promise<TabInfo | null> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.id || !tab.url || !tab.title || !tab.windowId) {
      return null;
    }

    return {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      active: tab.active,
      windowId: tab.windowId
    };
  } catch (error) {
    console.error('Failed to get tab info:', error);
    return null;
  }
}

/**
 * Execute a callback function when a tab is updated
 */
export function onTabUpdated(callback: (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void): void {
  chrome.tabs.onUpdated.addListener(callback);
}

/**
 * Execute a callback function when a tab is created
 */
export function onTabCreated(callback: (tab: chrome.tabs.Tab) => void): void {
  chrome.tabs.onCreated.addListener(callback);
}

/**
 * Execute a callback function when a tab is removed
 */
export function onTabRemoved(callback: (tabId: number, removeInfo: chrome.tabs.TabRemoveInfo) => void): void {
  chrome.tabs.onRemoved.addListener(callback);
}

/**
 * Remove tab event listeners
 */
export function removeTabListeners(): void {
  chrome.tabs.onUpdated.removeListener(() => {});
  chrome.tabs.onCreated.removeListener(() => {});
  chrome.tabs.onRemoved.removeListener(() => {});
}
