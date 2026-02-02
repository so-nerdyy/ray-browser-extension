/**
 * Background Service Worker
 * Handles extension lifecycle, message routing, and background operations
 */

import { getCurrentTab } from '../lib/utils/chrome-tabs';
import { getStorageValue, setStorageValue } from '../lib/utils/chrome-storage';
import { hasPermissions } from '../lib/utils/chrome-permissions';
import type { ExtensionMessage, AutomationCommand, AutomationResponse } from '../lib/types/chrome-api';

/**
 * Initialize the service worker
 */
async function initialize(): Promise<void> {
  console.log('Ray Extension - Service Worker initialized');

  // Check required permissions
  const requiredPermissions = {
    permissions: ['tabs', 'scripting', 'storage', 'activeTab'],
    origins: ['<all_urls>']
  };

  const hasRequiredPermissions = await hasPermissions(requiredPermissions);
  if (!hasRequiredPermissions) {
    console.warn('Ray Extension - Missing required permissions');
  }

  // Initialize storage if needed
  await initializeStorage();

  console.log('Ray Extension - Service worker ready');
}

/**
 * Initialize extension storage with default values
 */
async function initializeStorage(): Promise<void> {
  try {
    const isInitialized = await getStorageValue<boolean>('ray-initialized', false);

    if (!isInitialized) {
      await setStorageValue('ray-initialized', true);
      await setStorageValue('ray-settings', {
        enabled: true,
        debugMode: false,
        autoConfirm: false,
        maxRetries: 3,
        defaultTimeout: 10000
      });

      console.log('Ray Extension - Storage initialized with defaults');
    }
  } catch (error) {
    console.error('Ray Extension - Failed to initialize storage:', error);
  }
}

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Ray Extension - Installed:', details.reason);

  if (details.reason === 'install') {
    await initializeStorage();

    // Open welcome page on first install
    try {
      const tab = await chrome.tabs.create({
        url: chrome.runtime.getURL('popup/welcome.html'),
        active: true
      });
      console.log('Ray Extension - Welcome tab created:', tab.id);
    } catch (error) {
      console.error('Ray Extension - Failed to create welcome tab:', error);
    }
  } else if (details.reason === 'update') {
    console.log('Ray Extension - Updated to version:', chrome.runtime.getManifest().version);
  }
});

/**
 * Handle extension startup
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log('Ray Extension - Service worker started');
  await initialize();
});

/**
 * Handle messages from other parts of the extension
 */
chrome.runtime.onMessage.addListener(
  async (message: ExtensionMessage, sender, sendResponse) => {
    console.log('Ray Extension - Message received:', message.type, 'from:', sender.tab?.id);

    try {
      switch (message.type) {
        case 'GET_TAB_INFO':
          await handleGetTabInfo(message, sender, sendResponse);
          break;

        case 'EXECUTE_AUTOMATION':
          await handleExecuteAutomation(message, sender, sendResponse);
          break;

        case 'GET_SETTINGS':
          await handleGetSettings(message, sender, sendResponse);
          break;

        case 'UPDATE_SETTINGS':
          await handleUpdateSettings(message, sender, sendResponse);
          break;

        default:
          console.warn('Ray Extension - Unknown message type:', message.type);
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Ray Extension - Message handling error:', error);
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }

    // Return true to indicate async response
    return true;
  }
);

/**
 * Handle get tab info request
 */
async function handleGetTabInfo(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
): Promise<void> {
  try {
    const tabId = message.tabId || sender.tab?.id;
    if (!tabId) {
      sendResponse({ success: false, error: 'No tab ID available' });
      return;
    }

    const tab = await getCurrentTab();
    sendResponse({ success: true, data: tab });
  } catch (error) {
    sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Handle automation command execution
 */
async function handleExecuteAutomation(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
): Promise<void> {
  try {
    const command = message.payload as AutomationCommand;
    const tabId = command.tabId || sender.tab?.id;

    if (!tabId) {
      sendResponse({ success: false, error: 'No tab ID available' });
      return;
    }

    // Forward command to content script
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'EXECUTE_COMMAND',
      payload: command
    });

    sendResponse(response);
  } catch (error) {
    sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Handle get settings request
 */
async function handleGetSettings(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
): Promise<void> {
  try {
    const settings = await getStorageValue('ray-settings', {});
    sendResponse({ success: true, data: settings });
  } catch (error) {
    sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Handle update settings request
 */
async function handleUpdateSettings(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
): Promise<void> {
  try {
    const newSettings = message.payload;
    const currentSettings = await getStorageValue('ray-settings', {});
    const updatedSettings = { ...currentSettings, ...newSettings };

    await setStorageValue('ray-settings', updatedSettings);
    sendResponse({ success: true, data: updatedSettings });
  } catch (error) {
    sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Handle browser action click (extension icon)
 */
chrome.action.onClicked.addListener(async (tab) => {
  console.log('Ray Extension - Action clicked for tab:', tab.id);

  try {
    // Open popup (this is the default behavior, but we can add custom logic)
    await chrome.action.openPopup();
  } catch (error) {
    console.error('Ray Extension - Failed to open popup:', error);
  }
});

/**
 * Handle tab updates for automation context
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    console.log('Ray Extension - Tab updated:', tabId, tab.url);

    // Send notification to content script if needed
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'TAB_UPDATED',
        payload: { url: tab.url, title: tab.title }
      });
    } catch (error) {
      // Content script might not be loaded yet, which is normal
      console.debug('Ray Extension - Could not notify content script:', error);
    }
  }
});

/**
 * Initialize the service worker
 */
initialize().catch(error => {
  console.error('Ray Extension - Failed to initialize service worker:', error);
});

