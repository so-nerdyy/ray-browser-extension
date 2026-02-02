/**
 * Wait strategies for browser automation
 * Provides robust element waiting and timeout handling
 */

import { ElementSelector, WaitStrategy } from './automation-types';
import { chromeApi } from './chrome-api-wrappers';
import { domSelectors } from './dom-selectors';

export interface WaitOptions {
  timeout?: number;
  interval?: number;
  message?: string;
  throwOnTimeout?: boolean;
}

export interface WaitForNavigationOptions {
  timeout?: number;
  url?: string;
  urlContains?: string;
  urlPattern?: RegExp;
}

export interface WaitForConditionOptions {
  timeout?: number;
  interval?: number;
  message?: string;
}

export class WaitStrategies {
  private readonly DEFAULT_TIMEOUT = 10000;
  private readonly DEFAULT_INTERVAL = 100;
  private readonly NAVIGATION_TIMEOUT = 30000;

  /**
   * Wait for an element to appear
   */
  async waitForElement(
    selector: ElementSelector, 
    options: WaitOptions = {},
    tabId?: number
  ): Promise<Element> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    const timeout = options.timeout || this.DEFAULT_TIMEOUT;
    const interval = options.interval || this.DEFAULT_INTERVAL;
    const message = options.message || `Element not found: ${selector.value}`;
    const throwOnTimeout = options.throwOnTimeout !== false;
    
    const waitFunction = (selector: ElementSelector, opts: WaitOptions) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkElement = async () => {
          try {
            const element = await domSelectors.findElement(selector);
            if (element) {
              resolve(element);
              return;
            }
            
            if (Date.now() - startTime > opts.timeout!) {
              if (opts.throwOnTimeout !== false) {
                reject(new Error(opts.message || `Element not found within timeout`));
              } else {
                resolve(null);
              }
              return;
            }
            
            setTimeout(checkElement, opts.interval!);
          } catch (error) {
            if (Date.now() - startTime > opts.timeout!) {
              if (opts.throwOnTimeout !== false) {
                reject(new Error(opts.message || `Element not found within timeout`));
              } else {
                resolve(null);
              }
              return;
            }
            
            setTimeout(checkElement, opts.interval!);
          }
        };
        
        checkElement();
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, waitFunction, [selector, {
        timeout,
        interval,
        message,
        throwOnTimeout
      }]);
    } catch (error) {
      throw new Error(`Failed to wait for element: ${error.message}`);
    }
  }

  /**
   * Wait for an element to become visible
   */
  async waitForElementVisible(
    selector: ElementSelector, 
    options: WaitOptions = {},
    tabId?: number
  ): Promise<Element> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    const timeout = options.timeout || this.DEFAULT_TIMEOUT;
    const interval = options.interval || this.DEFAULT_INTERVAL;
    const message = options.message || `Element not visible: ${selector.value}`;
    
    const waitFunction = (selector: ElementSelector, opts: WaitOptions) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkElement = async () => {
          try {
            const element = await domSelectors.findElement(selector);
            if (!element) {
              if (Date.now() - startTime > opts.timeout!) {
                reject(new Error(opts.message || `Element not found within timeout`));
                return;
              }
              
              setTimeout(checkElement, opts.interval!);
              return;
            }
            
            // Check if element is visible
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            const isVisible = (
              rect.width > 0 &&
              rect.height > 0 &&
              style.visibility !== 'hidden' &&
              style.display !== 'none' &&
              style.opacity !== '0'
            );
            
            if (isVisible) {
              resolve(element);
              return;
            }
            
            if (Date.now() - startTime > opts.timeout!) {
              reject(new Error(opts.message || `Element did not become visible within timeout`));
              return;
            }
            
            setTimeout(checkElement, opts.interval!);
          } catch (error) {
            if (Date.now() - startTime > opts.timeout!) {
              reject(new Error(opts.message || `Element did not become visible within timeout`));
              return;
            }
            
            setTimeout(checkElement, opts.interval!);
          }
        };
        
        checkElement();
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, waitFunction, [selector, {
        timeout,
        interval,
        message,
        throwOnTimeout: true
      }]);
    } catch (error) {
      throw new Error(`Failed to wait for element visibility: ${error.message}`);
    }
  }

  /**
   * Wait for an element to become hidden
   */
  async waitForElementHidden(
    selector: ElementSelector, 
    options: WaitOptions = {},
    tabId?: number
  ): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    const timeout = options.timeout || this.DEFAULT_TIMEOUT;
    const interval = options.interval || this.DEFAULT_INTERVAL;
    const message = options.message || `Element not hidden: ${selector.value}`;
    
    const waitFunction = (selector: ElementSelector, opts: WaitOptions) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkElement = async () => {
          try {
            const element = await domSelectors.findElement(selector);
            
            if (!element) {
              resolve(true);
              return;
            }
            
            // Check if element is hidden
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            const isHidden = (
              rect.width === 0 ||
              rect.height === 0 ||
              style.visibility === 'hidden' ||
              style.display === 'none' ||
              style.opacity === '0'
            );
            
            if (isHidden) {
              resolve(true);
              return;
            }
            
            if (Date.now() - startTime > opts.timeout!) {
              reject(new Error(opts.message || `Element did not become hidden within timeout`));
              return;
            }
            
            setTimeout(checkElement, opts.interval!);
          } catch (error) {
            if (Date.now() - startTime > opts.timeout!) {
              reject(new Error(opts.message || `Element did not become hidden within timeout`));
              return;
            }
            
            setTimeout(checkElement, opts.interval!);
          }
        };
        
        checkElement();
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, waitFunction, [selector, {
        timeout,
        interval,
        message,
        throwOnTimeout: true
      }]);
    } catch (error) {
      throw new Error(`Failed to wait for element to be hidden: ${error.message}`);
    }
  }

  /**
   * Wait for an element to become clickable
   */
  async waitForElementClickable(
    selector: ElementSelector, 
    options: WaitOptions = {},
    tabId?: number
  ): Promise<Element> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    const timeout = options.timeout || this.DEFAULT_TIMEOUT;
    const interval = options.interval || this.DEFAULT_INTERVAL;
    const message = options.message || `Element not clickable: ${selector.value}`;
    
    const waitFunction = (selector: ElementSelector, opts: WaitOptions) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkElement = async () => {
          try {
            const element = await domSelectors.findElement(selector);
            if (!element) {
              if (Date.now() - startTime > opts.timeout!) {
                reject(new Error(opts.message || `Element not found within timeout`));
                return;
              }
              
              setTimeout(checkElement, opts.interval!);
              return;
            }
            
            // Check if element is visible and not disabled
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            const isVisible = (
              rect.width > 0 &&
              rect.height > 0 &&
              style.visibility !== 'hidden' &&
              style.display !== 'none' &&
              style.opacity !== '0'
            );
            
            const isDisabled = (element as HTMLInputElement).disabled;
            
            // Check if element is obscured by another element
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const elementAtPoint = document.elementFromPoint(centerX, centerY);
            const isObscured = elementAtPoint !== element && !element.contains(elementAtPoint);
            
            if (isVisible && !isDisabled && !isObscured) {
              resolve(element);
              return;
            }
            
            if (Date.now() - startTime > opts.timeout!) {
              reject(new Error(opts.message || `Element did not become clickable within timeout`));
              return;
            }
            
            setTimeout(checkElement, opts.interval!);
          } catch (error) {
            if (Date.now() - startTime > opts.timeout!) {
              reject(new Error(opts.message || `Element did not become clickable within timeout`));
              return;
            }
            
            setTimeout(checkElement, opts.interval!);
          }
        };
        
        checkElement();
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, waitFunction, [selector, {
        timeout,
        interval,
        message,
        throwOnTimeout: true
      }]);
    } catch (error) {
      throw new Error(`Failed to wait for element to be clickable: ${error.message}`);
    }
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation(options: WaitForNavigationOptions = {}, tabId?: number): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    const timeout = options.timeout || this.NAVIGATION_TIMEOUT;
    
    return new Promise(async (resolve, reject) => {
      try {
        // Get current URL
        const currentTab = await chromeApi.getTab(targetTabId);
        const startUrl = currentTab.url;
        
        // Wait for URL change
        const checkNavigation = async () => {
          try {
            const tab = await chromeApi.getTab(targetTabId);
            const currentUrl = tab.url;
            
            // Check if URL changed
            if (currentUrl !== startUrl) {
              // Check URL conditions
              if (options.url && currentUrl !== options.url) {
                setTimeout(checkNavigation, 100);
                return;
              }
              
              if (options.urlContains && !currentUrl.includes(options.urlContains)) {
                setTimeout(checkNavigation, 100);
                return;
              }
              
              if (options.urlPattern && !options.urlPattern.test(currentUrl)) {
                setTimeout(checkNavigation, 100);
                return;
              }
              
              // Wait for page to load
              await chromeApi.waitForTabToLoad(targetTabId, 5000);
              resolve(true);
              return;
            }
            
            setTimeout(checkNavigation, 100);
          } catch (error) {
            reject(error);
          }
        };
        
        // Start checking
        setTimeout(checkNavigation, 100);
        
        // Set timeout
        setTimeout(() => {
          reject(new Error(`Navigation did not complete within timeout`));
        }, timeout);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Wait for a custom condition
   */
  async waitForCondition(
    condition: () => boolean | Promise<boolean>, 
    options: WaitForConditionOptions = {},
    tabId?: number
  ): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    const timeout = options.timeout || this.DEFAULT_TIMEOUT;
    const interval = options.interval || this.DEFAULT_INTERVAL;
    const message = options.message || 'Condition not met within timeout';
    
    const waitFunction = (conditionStr: string, opts: WaitForConditionOptions) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        // Evaluate the condition function
        const conditionFunc = new Function('return ' + conditionStr)();
        
        const checkCondition = async () => {
          try {
            const result = await conditionFunc();
            
            if (result) {
              resolve(true);
              return;
            }
            
            if (Date.now() - startTime > opts.timeout!) {
              reject(new Error(opts.message || 'Condition not met within timeout'));
              return;
            }
            
            setTimeout(checkCondition, opts.interval!);
          } catch (error) {
            if (Date.now() - startTime > opts.timeout!) {
              reject(new Error(opts.message || 'Condition not met within timeout'));
              return;
            }
            
            setTimeout(checkCondition, opts.interval!);
          }
        };
        
        checkCondition();
      });
    };
    
    try {
      // Convert function to string for execution
      const conditionStr = condition.toString();
      return await chromeApi.executeScript(targetTabId, waitFunction, [conditionStr, {
        timeout,
        interval,
        message
      }]);
    } catch (error) {
      throw new Error(`Failed to wait for condition: ${error.message}`);
    }
  }

  /**
   * Wait for a specific amount of time
   */
  async wait(duration: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, duration));
  }

  /**
   * Wait for multiple elements
   */
  async waitForElements(
    selectors: ElementSelector[], 
    options: WaitOptions = {},
    tabId?: number
  ): Promise<Element[]> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    const timeout = options.timeout || this.DEFAULT_TIMEOUT;
    const interval = options.interval || this.DEFAULT_INTERVAL;
    const message = options.message || 'Elements not found within timeout';
    
    const waitFunction = (selectors: ElementSelector[], opts: WaitOptions) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkElements = async () => {
          try {
            const elements: Element[] = [];
            let allFound = true;
            
            for (const selector of selectors) {
              try {
                const element = await domSelectors.findElement(selector);
                if (element) {
                  elements.push(element);
                } else {
                  allFound = false;
                  break;
                }
              } catch (error) {
                allFound = false;
                break;
              }
            }
            
            if (allFound) {
              resolve(elements);
              return;
            }
            
            if (Date.now() - startTime > opts.timeout!) {
              reject(new Error(opts.message || 'Elements not found within timeout'));
              return;
            }
            
            setTimeout(checkElements, opts.interval!);
          } catch (error) {
            if (Date.now() - startTime > opts.timeout!) {
              reject(new Error(opts.message || 'Elements not found within timeout'));
              return;
            }
            
            setTimeout(checkElements, opts.interval!);
          }
        };
        
        checkElements();
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, waitFunction, [selectors, {
        timeout,
        interval,
        message,
        throwOnTimeout: true
      }]);
    } catch (error) {
      throw new Error(`Failed to wait for elements: ${error.message}`);
    }
  }

  /**
   * Wait for AJAX requests to complete
   */
  async waitForAjax(options: WaitOptions = {}, tabId?: number): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    const timeout = options.timeout || this.DEFAULT_TIMEOUT;
    const interval = options.interval || this.DEFAULT_INTERVAL;
    const message = options.message || 'AJAX requests did not complete within timeout';
    
    const waitFunction = (opts: WaitOptions) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkAjax = () => {
          // Check if jQuery is available and has active requests
          if (typeof window.jQuery !== 'undefined' && window.jQuery.active > 0) {
            if (Date.now() - startTime > opts.timeout!) {
              reject(new Error(opts.message || 'AJAX requests did not complete within timeout'));
              return;
            }
            
            setTimeout(checkAjax, opts.interval!);
            return;
          }
          
          // Check for native XMLHttpRequest
          const originalXHROpen = XMLHttpRequest.prototype.open;
          let activeRequests = 0;
          
          XMLHttpRequest.prototype.open = function() {
            activeRequests++;
            this.addEventListener('loadend', () => {
              activeRequests--;
            });
            return originalXHROpen.apply(this, arguments);
          };
          
          if (activeRequests > 0) {
            if (Date.now() - startTime > opts.timeout!) {
              reject(new Error(opts.message || 'AJAX requests did not complete within timeout'));
              return;
            }
            
            setTimeout(checkAjax, opts.interval!);
            return;
          }
          
          resolve(true);
        };
        
        checkAjax();
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, waitFunction, [{
        timeout,
        interval,
        message,
        throwOnTimeout: true
      }]);
    } catch (error) {
      throw new Error(`Failed to wait for AJAX: ${error.message}`);
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // No specific cleanup needed for WaitStrategies
  }
}

// Export singleton instance for convenience
export const waitStrategies = new WaitStrategies(); * Wait strategies for browser automation
 * Provides robust element waiting and timeout handling
 */

import { ElementSelector, WaitStrategy } from './automation-types';
import { chromeApi } from './chrome-api-wrappers';
import { domSelectors } from './dom-selectors';

export interface WaitOptions {
  timeout?: number;
  interval?: number;
  message?: string;
  throwOnTimeout?: boolean;
}

export interface WaitForNavigationOptions {
  timeout?: number;
  url?: string;
  urlContains?: string;
  urlPattern?: RegExp;
}

export interface WaitForConditionOptions {
  timeout?: number;
  interval?: number;
  message?: string;
}

export class WaitStrategies {
  private readonly DEFAULT_TIMEOUT = 10000;
  private readonly DEFAULT_INTERVAL = 100;
  private readonly NAVIGATION_TIMEOUT = 30000;

  /**
   * Wait for an element to appear
   */
  async waitForElement(
    selector: ElementSelector, 
    options: WaitOptions = {},
    tabId?: number
  ): Promise<Element> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    const timeout = options.timeout || this.DEFAULT_TIMEOUT;
    const interval = options.interval || this.DEFAULT_INTERVAL;
    const message = options.message || `Element not found: ${selector.value}`;
    const throwOnTimeout = options.throwOnTimeout !== false;
    
    const waitFunction = (selector: ElementSelector, opts: WaitOptions) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkElement = async () => {
          try {
            const element = await domSelectors.findElement(selector);
            if (element) {
              resolve(element);
              return;
            }
            
            if (Date.now() - startTime > opts.timeout!) {
              if (opts.throwOnTimeout !== false) {
                reject(new Error(opts.message || `Element not found within timeout`));
              } else {
                resolve(null);
              }
              return;
            }
            
            setTimeout(checkElement, opts.interval!);
          } catch (error) {
            if (Date.now() - startTime > opts.timeout!) {
              if (opts.throwOnTimeout !== false) {
                reject(new Error(opts.message || `Element not found within timeout`));
              } else {
                resolve(null);
              }
              return;
            }
            
            setTimeout(checkElement, opts.interval!);
          }
        };
        
        checkElement();
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, waitFunction, [selector, {
        timeout,
        interval,
        message,
        throwOnTimeout
      }]);
    } catch (error) {
      throw new Error(`Failed to wait for element: ${error.message}`);
    }
  }

  /**
   * Wait for an element to become visible
   */
  async waitForElementVisible(
    selector: ElementSelector, 
    options: WaitOptions = {},
    tabId?: number
  ): Promise<Element> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    const timeout = options.timeout || this.DEFAULT_TIMEOUT;
    const interval = options.interval || this.DEFAULT_INTERVAL;
    const message = options.message || `Element not visible: ${selector.value}`;
    
    const waitFunction = (selector: ElementSelector, opts: WaitOptions) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkElement = async () => {
          try {
            const element = await domSelectors.findElement(selector);
            if (!element) {
              if (Date.now() - startTime > opts.timeout!) {
                reject(new Error(opts.message || `Element not found within timeout`));
                return;
              }
              
              setTimeout(checkElement, opts.interval!);
              return;
            }
            
            // Check if element is visible
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            const isVisible = (
              rect.width > 0 &&
              rect.height > 0 &&
              style.visibility !== 'hidden' &&
              style.display !== 'none' &&
              style.opacity !== '0'
            );
            
            if (isVisible) {
              resolve(element);
              return;
            }
            
            if (Date.now() - startTime > opts.timeout!) {
              reject(new Error(opts.message || `Element did not become visible within timeout`));
              return;
            }
            
            setTimeout(checkElement, opts.interval!);
          } catch (error) {
            if (Date.now() - startTime > opts.timeout!) {
              reject(new Error(opts.message || `Element did not become visible within timeout`));
              return;
            }
            
            setTimeout(checkElement, opts.interval!);
          }
        };
        
        checkElement();
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, waitFunction, [selector, {
        timeout,
        interval,
        message,
        throwOnTimeout: true
      }]);
    } catch (error) {
      throw new Error(`Failed to wait for element visibility: ${error.message}`);
    }
  }

  /**
   * Wait for an element to become hidden
   */
  async waitForElementHidden(
    selector: ElementSelector, 
    options: WaitOptions = {},
    tabId?: number
  ): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    const timeout = options.timeout || this.DEFAULT_TIMEOUT;
    const interval = options.interval || this.DEFAULT_INTERVAL;
    const message = options.message || `Element not hidden: ${selector.value}`;
    
    const waitFunction = (selector: ElementSelector, opts: WaitOptions) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkElement = async () => {
          try {
            const element = await domSelectors.findElement(selector);
            
            if (!element) {
              resolve(true);
              return;
            }
            
            // Check if element is hidden
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            const isHidden = (
              rect.width === 0 ||
              rect.height === 0 ||
              style.visibility === 'hidden' ||
              style.display === 'none' ||
              style.opacity === '0'
            );
            
            if (isHidden) {
              resolve(true);
              return;
            }
            
            if (Date.now() - startTime > opts.timeout!) {
              reject(new Error(opts.message || `Element did not become hidden within timeout`));
              return;
            }
            
            setTimeout(checkElement, opts.interval!);
          } catch (error) {
            if (Date.now() - startTime > opts.timeout!) {
              reject(new Error(opts.message || `Element did not become hidden within timeout`));
              return;
            }
            
            setTimeout(checkElement, opts.interval!);
          }
        };
        
        checkElement();
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, waitFunction, [selector, {
        timeout,
        interval,
        message,
        throwOnTimeout: true
      }]);
    } catch (error) {
      throw new Error(`Failed to wait for element to be hidden: ${error.message}`);
    }
  }

  /**
   * Wait for an element to become clickable
   */
  async waitForElementClickable(
    selector: ElementSelector, 
    options: WaitOptions = {},
    tabId?: number
  ): Promise<Element> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    const timeout = options.timeout || this.DEFAULT_TIMEOUT;
    const interval = options.interval || this.DEFAULT_INTERVAL;
    const message = options.message || `Element not clickable: ${selector.value}`;
    
    const waitFunction = (selector: ElementSelector, opts: WaitOptions) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkElement = async () => {
          try {
            const element = await domSelectors.findElement(selector);
            if (!element) {
              if (Date.now() - startTime > opts.timeout!) {
                reject(new Error(opts.message || `Element not found within timeout`));
                return;
              }
              
              setTimeout(checkElement, opts.interval!);
              return;
            }
            
            // Check if element is visible and not disabled
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            const isVisible = (
              rect.width > 0 &&
              rect.height > 0 &&
              style.visibility !== 'hidden' &&
              style.display !== 'none' &&
              style.opacity !== '0'
            );
            
            const isDisabled = (element as HTMLInputElement).disabled;
            
            // Check if element is obscured by another element
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const elementAtPoint = document.elementFromPoint(centerX, centerY);
            const isObscured = elementAtPoint !== element && !element.contains(elementAtPoint);
            
            if (isVisible && !isDisabled && !isObscured) {
              resolve(element);
              return;
            }
            
            if (Date.now() - startTime > opts.timeout!) {
              reject(new Error(opts.message || `Element did not become clickable within timeout`));
              return;
            }
            
            setTimeout(checkElement, opts.interval!);
          } catch (error) {
            if (Date.now() - startTime > opts.timeout!) {
              reject(new Error(opts.message || `Element did not become clickable within timeout`));
              return;
            }
            
            setTimeout(checkElement, opts.interval!);
          }
        };
        
        checkElement();
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, waitFunction, [selector, {
        timeout,
        interval,
        message,
        throwOnTimeout: true
      }]);
    } catch (error) {
      throw new Error(`Failed to wait for element to be clickable: ${error.message}`);
    }
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation(options: WaitForNavigationOptions = {}, tabId?: number): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    const timeout = options.timeout || this.NAVIGATION_TIMEOUT;
    
    return new Promise(async (resolve, reject) => {
      try {
        // Get current URL
        const currentTab = await chromeApi.getTab(targetTabId);
        const startUrl = currentTab.url;
        
        // Wait for URL change
        const checkNavigation = async () => {
          try {
            const tab = await chromeApi.getTab(targetTabId);
            const currentUrl = tab.url;
            
            // Check if URL changed
            if (currentUrl !== startUrl) {
              // Check URL conditions
              if (options.url && currentUrl !== options.url) {
                setTimeout(checkNavigation, 100);
                return;
              }
              
              if (options.urlContains && !currentUrl.includes(options.urlContains)) {
                setTimeout(checkNavigation, 100);
                return;
              }
              
              if (options.urlPattern && !options.urlPattern.test(currentUrl)) {
                setTimeout(checkNavigation, 100);
                return;
              }
              
              // Wait for page to load
              await chromeApi.waitForTabToLoad(targetTabId, 5000);
              resolve(true);
              return;
            }
            
            setTimeout(checkNavigation, 100);
          } catch (error) {
            reject(error);
          }
        };
        
        // Start checking
        setTimeout(checkNavigation, 100);
        
        // Set timeout
        setTimeout(() => {
          reject(new Error(`Navigation did not complete within timeout`));
        }, timeout);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Wait for a custom condition
   */
  async waitForCondition(
    condition: () => boolean | Promise<boolean>, 
    options: WaitForConditionOptions = {},
    tabId?: number
  ): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    const timeout = options.timeout || this.DEFAULT_TIMEOUT;
    const interval = options.interval || this.DEFAULT_INTERVAL;
    const message = options.message || 'Condition not met within timeout';
    
    const waitFunction = (conditionStr: string, opts: WaitForConditionOptions) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        // Evaluate the condition function
        const conditionFunc = new Function('return ' + conditionStr)();
        
        const checkCondition = async () => {
          try {
            const result = await conditionFunc();
            
            if (result) {
              resolve(true);
              return;
            }
            
            if (Date.now() - startTime > opts.timeout!) {
              reject(new Error(opts.message || 'Condition not met within timeout'));
              return;
            }
            
            setTimeout(checkCondition, opts.interval!);
          } catch (error) {
            if (Date.now() - startTime > opts.timeout!) {
              reject(new Error(opts.message || 'Condition not met within timeout'));
              return;
            }
            
            setTimeout(checkCondition, opts.interval!);
          }
        };
        
        checkCondition();
      });
    };
    
    try {
      // Convert function to string for execution
      const conditionStr = condition.toString();
      return await chromeApi.executeScript(targetTabId, waitFunction, [conditionStr, {
        timeout,
        interval,
        message
      }]);
    } catch (error) {
      throw new Error(`Failed to wait for condition: ${error.message}`);
    }
  }

  /**
   * Wait for a specific amount of time
   */
  async wait(duration: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, duration));
  }

  /**
   * Wait for multiple elements
   */
  async waitForElements(
    selectors: ElementSelector[], 
    options: WaitOptions = {},
    tabId?: number
  ): Promise<Element[]> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    const timeout = options.timeout || this.DEFAULT_TIMEOUT;
    const interval = options.interval || this.DEFAULT_INTERVAL;
    const message = options.message || 'Elements not found within timeout';
    
    const waitFunction = (selectors: ElementSelector[], opts: WaitOptions) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkElements = async () => {
          try {
            const elements: Element[] = [];
            let allFound = true;
            
            for (const selector of selectors) {
              try {
                const element = await domSelectors.findElement(selector);
                if (element) {
                  elements.push(element);
                } else {
                  allFound = false;
                  break;
                }
              } catch (error) {
                allFound = false;
                break;
              }
            }
            
            if (allFound) {
              resolve(elements);
              return;
            }
            
            if (Date.now() - startTime > opts.timeout!) {
              reject(new Error(opts.message || 'Elements not found within timeout'));
              return;
            }
            
            setTimeout(checkElements, opts.interval!);
          } catch (error) {
            if (Date.now() - startTime > opts.timeout!) {
              reject(new Error(opts.message || 'Elements not found within timeout'));
              return;
            }
            
            setTimeout(checkElements, opts.interval!);
          }
        };
        
        checkElements();
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, waitFunction, [selectors, {
        timeout,
        interval,
        message,
        throwOnTimeout: true
      }]);
    } catch (error) {
      throw new Error(`Failed to wait for elements: ${error.message}`);
    }
  }

  /**
   * Wait for AJAX requests to complete
   */
  async waitForAjax(options: WaitOptions = {}, tabId?: number): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    const timeout = options.timeout || this.DEFAULT_TIMEOUT;
    const interval = options.interval || this.DEFAULT_INTERVAL;
    const message = options.message || 'AJAX requests did not complete within timeout';
    
    const waitFunction = (opts: WaitOptions) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkAjax = () => {
          // Check if jQuery is available and has active requests
          if (typeof window.jQuery !== 'undefined' && window.jQuery.active > 0) {
            if (Date.now() - startTime > opts.timeout!) {
              reject(new Error(opts.message || 'AJAX requests did not complete within timeout'));
              return;
            }
            
            setTimeout(checkAjax, opts.interval!);
            return;
          }
          
          // Check for native XMLHttpRequest
          const originalXHROpen = XMLHttpRequest.prototype.open;
          let activeRequests = 0;
          
          XMLHttpRequest.prototype.open = function() {
            activeRequests++;
            this.addEventListener('loadend', () => {
              activeRequests--;
            });
            return originalXHROpen.apply(this, arguments);
          };
          
          if (activeRequests > 0) {
            if (Date.now() - startTime > opts.timeout!) {
              reject(new Error(opts.message || 'AJAX requests did not complete within timeout'));
              return;
            }
            
            setTimeout(checkAjax, opts.interval!);
            return;
          }
          
          resolve(true);
        };
        
        checkAjax();
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, waitFunction, [{
        timeout,
        interval,
        message,
        throwOnTimeout: true
      }]);
    } catch (error) {
      throw new Error(`Failed to wait for AJAX: ${error.message}`);
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // No specific cleanup needed for WaitStrategies
  }
}

// Export singleton instance for convenience
export const waitStrategies = new WaitStrategies();
