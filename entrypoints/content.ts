/**
 * Content Script - Browser Automator
 * Handles DOM manipulation and automation commands on web pages
 */

import type { AutomationCommand, AutomationResponse, ExtensionMessage } from '../lib/types/chrome-api';

/**
 * Initialize the content script
 */
function initialize(): void {
  console.log('Ray Extension - Content script initialized on:', window.location.href);

  // Set up message listener for background script communication
  chrome.runtime.onMessage.addListener(handleMessage);

  // Inject Ray automation utilities into the page
  injectRayUtilities();

  console.log('Ray Extension - Content script ready');
}

/**
 * Handle messages from background script
 */
async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
): Promise<boolean> {
  console.log('Ray Extension - Content script message:', message.type);

  try {
    switch (message.type) {
      case 'EXECUTE_COMMAND':
        await handleExecuteCommand(message, sender, sendResponse);
        break;

      case 'TAB_UPDATED':
        await handleTabUpdated(message, sender, sendResponse);
        break;

      default:
        console.warn('Ray Extension - Unknown message type:', message.type);
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Ray Extension - Content script error:', error);
    sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }

  return true; // Keep message channel open for async response
}

/**
 * Handle automation command execution
 */
async function handleExecuteCommand(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
): Promise<void> {
  const command = message.payload as AutomationCommand;
  console.log('Ray Extension - Executing command:', command.type);

  try {
    let result: any;

    switch (command.type) {
      case 'navigate':
        result = await handleNavigate(command);
        break;

      case 'click':
        result = await handleClick(command);
        break;

      case 'fill':
        result = await handleFill(command);
        break;

      case 'scroll':
        result = await handleScroll(command);
        break;

      case 'submit':
        result = await handleSubmit(command);
        break;

      case 'wait':
        result = await handleWait(command);
        break;

      case 'extract':
        result = await handleExtract(command);
        break;

      default:
        throw new Error(`Unknown command type: ${command.type}`);
    }

    const response: AutomationResponse = {
      id: command.id,
      success: true,
      result,
      timestamp: Date.now()
    };

    sendResponse(response);
  } catch (error) {
    const response: AutomationResponse = {
      id: command.id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    };

    sendResponse(response);
  }
}

/**
 * Handle tab updated notification
 */
async function handleTabUpdated(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
): Promise<void> {
  console.log('Ray Extension - Tab updated notification:', message.payload);
  sendResponse({ success: true });
}

/**
 * Handle navigate command
 */
async function handleNavigate(command: AutomationCommand): Promise<any> {
  if (!command.url) {
    throw new Error('URL is required for navigate command');
  }

  window.location.href = command.url;
  return { url: command.url, navigated: true };
}

/**
 * Handle click command
 */
async function handleClick(command: AutomationCommand): Promise<any> {
  if (!command.selector) {
    throw new Error('Selector is required for click command');
  }

  const element = document.querySelector(command.selector);
  if (!element) {
    throw new Error(`Element not found: ${command.selector}`);
  }

  const htmlElement = element as HTMLElement;
  htmlElement.click();

  return {
    selector: command.selector,
    clicked: true,
    tagName: element.tagName,
    textContent: element.textContent?.substring(0, 100)
  };
}

/**
 * Handle fill command
 */
async function handleFill(command: AutomationCommand): Promise<any> {
  if (!command.selector) {
    throw new Error('Selector is required for fill command');
  }

  if (!command.value) {
    throw new Error('Value is required for fill command');
  }

  const element = document.querySelector(command.selector) as HTMLInputElement | HTMLTextAreaElement;
  if (!element) {
    throw new Error(`Element not found: ${command.selector}`);
  }

  // Set value and trigger events
  element.value = command.value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));

  return {
    selector: command.selector,
    value: command.value,
    filled: true,
    tagName: element.tagName
  };
}

/**
 * Handle scroll command
 */
async function handleScroll(command: AutomationCommand): Promise<any> {
  const selector = command.selector;
  let element: Element | Window = window;

  if (selector) {
    const foundElement = document.querySelector(selector);
    if (!foundElement) {
      throw new Error(`Element not found: ${command.selector}`);
    }
    element = foundElement;
  }

  // Scroll to top of element or page
  if (element instanceof Window) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    element.scrollIntoView({ behavior: 'smooth' });
  }

  return {
    selector: selector || 'window',
    scrolled: true
  };
}

/**
 * Handle submit command
 */
async function handleSubmit(command: AutomationCommand): Promise<any> {
  const selector = command.selector || 'form';
  const element = document.querySelector(selector) as HTMLFormElement;

  if (!element) {
    throw new Error(`Form not found: ${selector}`);
  }

  element.submit();

  return {
    selector: selector,
    submitted: true,
    action: element.action
  };
}

/**
 * Handle wait command
 */
async function handleWait(command: AutomationCommand): Promise<any> {
  const duration = command.timeout || 1000;

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        waited: true,
        duration: duration
      });
    }, duration);
  });
}

/**
 * Handle extract command
 */
async function handleExtract(command: AutomationCommand): Promise<any> {
  if (!command.selector) {
    throw new Error('Selector is required for extract command');
  }

  const element = document.querySelector(command.selector);
  if (!element) {
    throw new Error(`Element not found: ${command.selector}`);
  }

  const extracted = {
    text: element.textContent?.trim() || '',
    innerHTML: element.innerHTML,
    tagName: element.tagName,
    className: element.className,
    id: element.id,
    attributes: Array.from(element.attributes).reduce((acc, attr) => {
      acc[attr.name] = attr.value;
      return acc;
    }, {} as Record<string, string>)
  };

  return {
    selector: command.selector,
    extracted,
    success: true
  };
}

/**
 * Inject Ray utilities into the page context
 */
function injectRayUtilities(): void {
  const script = document.createElement('script');
  script.textContent = `
    // Ray Extension - Page Utilities
    window.RayExtension = {
      version: '${chrome.runtime.getManifest().version}',
      isReady: true,

      // Utility functions for page interaction
      utils: {
        waitForElement: function(selector, timeout = 5000) {
          return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
              resolve(element);
              return;
            }

            const observer = new MutationObserver(() => {
              const element = document.querySelector(selector);
              if (element) {
                observer.disconnect();
                resolve(element);
              }
            });

            observer.observe(document.body, {
              childList: true,
              subtree: true
            });

            setTimeout(() => {
              observer.disconnect();
              reject(new Error('Element not found within timeout'));
            }, timeout);
          });
        },

        isVisible: function(element) {
          const style = window.getComputedStyle(element);
          return style.display !== 'none' &&
                 style.visibility !== 'hidden' &&
                 style.opacity !== '0';
        },

        scrollToElement: function(element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };

    console.log('Ray Extension - Page utilities injected');
  `;

  // Inject into page context
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

// Initialize the content script
initialize();
