/**
 * Error recovery for browser automation
 * Handles automation failures and provides recovery strategies
 */

import { AutomationResponse, AutomationError } from './automation-types';
import { chromeApi } from './chrome-api-wrappers';
import { waitStrategies } from './wait-strategies';
import { domSelectors } from './dom-selectors';

export interface RecoveryStrategy {
  name: string;
  description: string;
  canRecover: (error: Error, context: any) => boolean;
  recover: (error: Error, context: any) => Promise<boolean>;
  maxRetries?: number;
  retryDelay?: number;
}

export interface RecoveryContext {
  workflowId?: string;
  stepNumber?: number;
  command?: any;
  tabId?: number;
  selector?: string;
  element?: Element;
  originalError?: Error;
  retryCount?: number;
  maxRetries?: number;
}

export interface RecoveryOptions {
  enableRecovery?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  fallbackSelectors?: string[];
  customStrategies?: RecoveryStrategy[];
}

export class ErrorRecovery {
  private defaultStrategies: RecoveryStrategy[] = [
    {
      name: 'element_not_found',
      description: 'Element not found - try alternative selectors',
      canRecover: (error, context) => {
        return error.message.includes('not found') && context.selector;
      },
      recover: async (error, context) => {
        const recoveryContext = context as RecoveryContext;
        
        // Try alternative selectors
        if (recoveryContext.fallbackSelectors) {
          for (const fallbackSelector of recoveryContext.fallbackSelectors) {
            try {
              const element = await domSelectors.findElement({
                strategy: 'css',
                value: fallbackSelector
              });
              
              if (element) {
                console.log(`Recovered using fallback selector: ${fallbackSelector}`);
                return true;
              }
            } catch (e) {
              continue;
            }
          }
        }
        
        // Try waiting for element to appear
        try {
          await waitStrategies.waitForElement({
            strategy: 'css',
            value: recoveryContext.selector!
          }, {
            timeout: 5000,
            interval: 500
          }, recoveryContext.tabId);
          
          const element = await domSelectors.findElement({
            strategy: 'css',
            value: recoveryContext.selector!
          });
          
          if (element) {
            console.log('Recovered by waiting for element to appear');
            return true;
          }
        } catch (e) {
          // Final fallback - try XPath
          try {
            const element = await domSelectors.findElement({
              strategy: 'xpath',
              value: `//${recoveryContext.selector}`
            });
            
            if (element) {
              console.log('Recovered using XPath selector');
              return true;
            }
          } catch (xpathError) {
            console.error('All recovery attempts failed');
            return false;
          }
        }
        
        return false;
      },
      maxRetries: 3,
      retryDelay: 1000
    },
    {
      name: 'element_not_visible',
      description: 'Element not visible - try scrolling and waiting',
      canRecover: (error, context) => {
        return error.message.includes('not visible') && context.selector;
      },
      recover: async (error, context) => {
        const recoveryContext = context as RecoveryContext;
        
        // Try scrolling to element
        try {
          await waitStrategies.waitForElementVisible({
            strategy: 'css',
            value: recoveryContext.selector!
          }, {
            timeout: 3000,
            interval: 500
          }, recoveryContext.tabId);
          
          console.log('Recovered by waiting for element to become visible');
          return true;
        } catch (e) {
          // Try scrolling to top and then waiting
          try {
            const scrollFunction = () => {
              window.scrollTo(0, 0);
              return true;
            };
            
            await chromeApi.executeScript(recoveryContext.tabId!, scrollFunction);
            
            await waitStrategies.wait(1000);
            
            await waitStrategies.waitForElementVisible({
              strategy: 'css',
              value: recoveryContext.selector!
            }, {
                timeout: 3000,
                interval: 500
              }, recoveryContext.tabId);
            
            console.log('Recovered by scrolling to top and waiting');
            return true;
          } catch (scrollError) {
            console.error('Scroll recovery failed:', scrollError);
            return false;
          }
        }
      },
      maxRetries: 2,
      retryDelay: 1500
    },
    {
      name: 'element_not_clickable',
      description: 'Element not clickable - try alternative click methods',
      canRecover: (error, context) => {
        return error.message.includes('not clickable') && context.selector;
      },
      recover: async (error, context) => {
        const recoveryContext = context as RecoveryContext;
        
        // Try JavaScript click
        try {
          const jsClickFunction = (selector: string) => {
            const element = document.querySelector(selector);
            if (element && typeof (element as any).click === 'function') {
              (element as any).click();
              return true;
            }
            return false;
          };
          
          const result = await chromeApi.executeScript(
            recoveryContext.tabId!, 
            jsClickFunction, 
            [recoveryContext.selector]
          );
          
          if (result) {
            console.log('Recovered using JavaScript click');
            return true;
          }
        } catch (e) {
          // Try mouse event click
          try {
            const mouseClickFunction = (selector: string) => {
              const element = document.querySelector(selector);
              if (element) {
                const rect = element.getBoundingClientRect();
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  clientX: rect.left + rect.width / 2,
                  clientY: rect.top + rect.height / 2
                });
                
                element.dispatchEvent(clickEvent);
                return true;
              }
              return false;
            };
            
            const result = await chromeApi.executeScript(
              recoveryContext.tabId!, 
              mouseClickFunction, 
              [recoveryContext.selector]
            );
            
            if (result) {
              console.log('Recovered using mouse event click');
              return true;
            }
          } catch (mouseError) {
            console.error('Mouse click recovery failed:', mouseError);
            return false;
          }
        }
      },
      maxRetries: 2,
      retryDelay: 500
    },
    {
      name: 'navigation_timeout',
      description: 'Navigation timeout - try waiting longer or reloading',
      canRecover: (error, context) => {
        return error.message.includes('timeout') && error.message.includes('navigation');
      },
      recover: async (error, context) => {
        const recoveryContext = context as RecoveryContext;
        
        // Try waiting longer for navigation
        try {
          await waitStrategies.waitForNavigation({
            timeout: 30000
          }, recoveryContext.tabId);
          
          console.log('Recovered by waiting longer for navigation');
          return true;
        } catch (e) {
          // Try reloading the page
          try {
            await chromeApi.executeScript(recoveryContext.tabId!, () => {
              window.location.reload();
              return true;
            });
            
            console.log('Recovered by reloading page');
            return true;
          } catch (reloadError) {
            console.error('Navigation recovery failed:', reloadError);
            return false;
          }
        }
      },
      maxRetries: 2,
      retryDelay: 2000
    },
    {
      name: 'form_validation_failed',
      description: 'Form validation failed - try clearing and refilling',
      canRecover: (error, context) => {
        return error.message.includes('validation') && context.command;
      },
      recover: async (error, context) => {
        const recoveryContext = context as RecoveryContext;
        
        // Try clearing form and refilling
        try {
          const clearAndRefillFunction = (selector: string, value: string) => {
            const element = document.querySelector(selector) as HTMLInputElement;
            if (element) {
              element.value = '';
              element.focus();
              
              // Trigger events
              element.dispatchEvent(new Event('input', { bubbles: true }));
              element.dispatchEvent(new Event('change', { bubbles: true }));
              
              // Wait a bit then fill
              setTimeout(() => {
                element.value = value;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
              }, 100);
              
              return true;
            }
            return false;
          };
          
          const command = recoveryContext.command;
          if (command && command.selector && command.value) {
            const result = await chromeApi.executeScript(
              recoveryContext.tabId!, 
              clearAndRefillFunction, 
              [command.selector, command.value]
            );
            
            if (result) {
              console.log('Recovered by clearing and refilling form');
              return true;
            }
          }
          
          return false;
        } catch (e) {
          console.error('Form recovery failed:', e);
          return false;
        }
      },
      maxRetries: 2,
      retryDelay: 1000
    },
    {
      name: 'permission_denied',
      description: 'Permission denied - try requesting permission',
      canRecover: (error, context) => {
        return error.message.includes('permission') || error.message.includes('denied');
      },
      recover: async (error, context) => {
        const recoveryContext = context as RecoveryContext;
        
        // Try requesting permission
        try {
          // This would need to be implemented based on the specific permission needed
          console.log('Permission denied - manual intervention may be required');
          return false;
        } catch (e) {
          console.error('Permission recovery failed:', e);
          return false;
        }
      },
      maxRetries: 1,
      retryDelay: 0
    }
  ];

  private customStrategies: Map<string, RecoveryStrategy> = new Map();

  /**
   * Attempt to recover from an error
   */
  async attemptRecovery(
    workflowId: string, 
    stepNumber: number, 
    error: Error, 
    options: RecoveryOptions = {}
  ): Promise<boolean> {
    const context: RecoveryContext = {
      workflowId,
      stepNumber,
      command: options.command,
      tabId: options.tabId,
      selector: options.selector,
      originalError: error,
      retryCount: 0,
      maxRetries: options.maxRetries || 3
    };
    
    // If recovery is disabled, return false
    if (options.enableRecovery === false) {
      console.log('Error recovery disabled');
      return false;
    }
    
    // Try custom strategies first
    if (options.customStrategies) {
      for (const strategy of options.customStrategies) {
        if (strategy.canRecover(error, context)) {
          console.log(`Attempting custom recovery strategy: ${strategy.name}`);
          
          try {
            const recovered = await strategy.recover(error, context);
            if (recovered) {
              console.log(`Successfully recovered using strategy: ${strategy.name}`);
              return true;
            }
          } catch (recoveryError) {
            console.error(`Custom recovery strategy ${strategy.name} failed:`, recoveryError);
          }
        }
      }
    }
    
    // Try default strategies
    for (const strategy of this.defaultStrategies) {
      if (strategy.canRecover(error, context)) {
        console.log(`Attempting recovery strategy: ${strategy.name}`);
        
        try {
          const recovered = await strategy.recover(error, {
            ...context,
            retryCount: context.retryCount || 0,
            maxRetries: strategy.maxRetries || options.maxRetries || 3
          });
          
          if (recovered) {
            console.log(`Successfully recovered using strategy: ${strategy.name}`);
            return true;
          }
        } catch (recoveryError) {
          console.error(`Recovery strategy ${strategy.name} failed:`, recoveryError);
        }
      }
    }
    
    console.error('All recovery strategies failed');
    return false;
  }

  /**
   * Add a custom recovery strategy
   */
  addCustomStrategy(strategy: RecoveryStrategy): void {
    this.customStrategies.set(strategy.name, strategy);
  }

  /**
   * Remove a custom recovery strategy
   */
  removeCustomStrategy(name: string): boolean {
    return this.customStrategies.delete(name);
  }

  /**
   * Get all recovery strategies
   */
  getAllStrategies(): RecoveryStrategy[] {
    return [...this.defaultStrategies, ...Array.from(this.customStrategies.values())];
  }

  /**
   * Get recovery strategy by name
   */
  getStrategy(name: string): RecoveryStrategy | undefined {
    return this.defaultStrategies.find(s => s.name === name) || 
           this.customStrategies.get(name);
  }

  /**
   * Create a recovery context
   */
  createRecoveryContext(
    workflowId: string,
    stepNumber: number,
    command: any,
    tabId: number,
    selector?: string,
    originalError?: Error,
    retryCount?: number,
    maxRetries?: number
  ): RecoveryContext {
    return {
      workflowId,
      stepNumber,
      command,
      tabId,
      selector,
      originalError,
      retryCount: retryCount || 0,
      maxRetries: maxRetries || 3
    };
  }

  /**
   * Check if recovery is possible
   */
  canRecover(error: Error, context: RecoveryContext): boolean {
    // Check custom strategies
    for (const strategy of this.customStrategies.values()) {
      if (strategy.canRecover(error, context)) {
        return true;
      }
    }
    
    // Check default strategies
    for (const strategy of this.defaultStrategies) {
      if (strategy.canRecover(error, context)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStatistics(workflowId?: string): any {
    // This would need to track recovery attempts over time
    // For now, return basic statistics
    return {
      totalStrategies: this.defaultStrategies.length + this.customStrategies.size,
      customStrategies: this.customStrategies.size,
      defaultStrategies: this.defaultStrategies.length,
      availableStrategies: this.getAllStrategies().map(s => s.name)
    };
  }

  /**
   * Create a retry wrapper for automation commands
   */
  createRetryWrapper<T extends any[]>(
    command: (...args: T) => Promise<any>,
    options: RecoveryOptions = {}
  ): (...args: T) => Promise<any> {
    return async (...commandArgs: T) => {
      let lastError: Error | null = null;
      const maxRetries = options.maxRetries || 3;
      const retryDelay = options.retryDelay || 1000;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await command(...commandArgs);
          
          // If successful, return the result
          if (result && result.success !== false) {
            return result;
          }
          
          // If this is the last attempt, return the result even if failed
          if (attempt === maxRetries) {
            return result;
          }
          
          // Store the error for recovery attempt
          lastError = new Error(result?.error?.message || 'Command failed');
          
        } catch (error) {
          lastError = error;
          
          // If this is the last attempt, throw the error
          if (attempt === maxRetries) {
            throw error;
          }
        }
        
        // Wait before retry (except on last attempt)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
      
      // Try recovery if all retries failed
      if (lastError && options.enableRecovery !== false) {
        const context = this.createRecoveryContext(
          'unknown',
          0,
          { args: commandArgs },
          -1,
          commandArgs[0]?.selector,
          lastError,
          maxRetries
        );
        
        const recovered = await this.attemptRecovery('unknown', 0, lastError, options);
        
        if (recovered) {
          // Try the command one more time after recovery
          return await command(...commandArgs);
        }
      }
      
      // Return the last error if all failed
      throw lastError || new Error('Command failed after all retries');
    };
  }

  /**
   * Handle automation errors with context
   */
  async handleAutomationError(
    error: Error, 
    context: RecoveryContext, 
    options: RecoveryOptions = {}
  ): Promise<AutomationResponse> {
    console.error('Automation error:', error);
    
    // Try recovery
    if (options.enableRecovery !== false) {
      const recovered = await this.attemptRecovery(
        context.workflowId || 'unknown',
        context.stepNumber || 0,
        error,
        options
      );
      
      if (recovered) {
        return {
          commandId: context.command?.id || 'unknown',
          success: true,
          timestamp: Date.now(),
          data: {
            recovered: true,
            originalError: error.message
          }
        };
      }
    }
    
    // Return error response
    return {
      commandId: context.command?.id || 'unknown',
      success: false,
      timestamp: Date.now(),
      error: {
        code: 'AUTOMATION_ERROR',
        message: error.message,
        details: {
          context,
          recoveryAttempted: options.enableRecovery !== false
        }
      }
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.customStrategies.clear();
  }
}

// Export singleton instance for convenience
export const errorRecovery = new ErrorRecovery(); * Error recovery for browser automation
 * Handles automation failures and provides recovery strategies
 */

import { AutomationResponse, AutomationError } from './automation-types';
import { chromeApi } from './chrome-api-wrappers';
import { waitStrategies } from './wait-strategies';
import { domSelectors } from './dom-selectors';

export interface RecoveryStrategy {
  name: string;
  description: string;
  canRecover: (error: Error, context: any) => boolean;
  recover: (error: Error, context: any) => Promise<boolean>;
  maxRetries?: number;
  retryDelay?: number;
}

export interface RecoveryContext {
  workflowId?: string;
  stepNumber?: number;
  command?: any;
  tabId?: number;
  selector?: string;
  element?: Element;
  originalError?: Error;
  retryCount?: number;
  maxRetries?: number;
}

export interface RecoveryOptions {
  enableRecovery?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  fallbackSelectors?: string[];
  customStrategies?: RecoveryStrategy[];
}

export class ErrorRecovery {
  private defaultStrategies: RecoveryStrategy[] = [
    {
      name: 'element_not_found',
      description: 'Element not found - try alternative selectors',
      canRecover: (error, context) => {
        return error.message.includes('not found') && context.selector;
      },
      recover: async (error, context) => {
        const recoveryContext = context as RecoveryContext;
        
        // Try alternative selectors
        if (recoveryContext.fallbackSelectors) {
          for (const fallbackSelector of recoveryContext.fallbackSelectors) {
            try {
              const element = await domSelectors.findElement({
                strategy: 'css',
                value: fallbackSelector
              });
              
              if (element) {
                console.log(`Recovered using fallback selector: ${fallbackSelector}`);
                return true;
              }
            } catch (e) {
              continue;
            }
          }
        }
        
        // Try waiting for element to appear
        try {
          await waitStrategies.waitForElement({
            strategy: 'css',
            value: recoveryContext.selector!
          }, {
            timeout: 5000,
            interval: 500
          }, recoveryContext.tabId);
          
          const element = await domSelectors.findElement({
            strategy: 'css',
            value: recoveryContext.selector!
          });
          
          if (element) {
            console.log('Recovered by waiting for element to appear');
            return true;
          }
        } catch (e) {
          // Final fallback - try XPath
          try {
            const element = await domSelectors.findElement({
              strategy: 'xpath',
              value: `//${recoveryContext.selector}`
            });
            
            if (element) {
              console.log('Recovered using XPath selector');
              return true;
            }
          } catch (xpathError) {
            console.error('All recovery attempts failed');
            return false;
          }
        }
        
        return false;
      },
      maxRetries: 3,
      retryDelay: 1000
    },
    {
      name: 'element_not_visible',
      description: 'Element not visible - try scrolling and waiting',
      canRecover: (error, context) => {
        return error.message.includes('not visible') && context.selector;
      },
      recover: async (error, context) => {
        const recoveryContext = context as RecoveryContext;
        
        // Try scrolling to element
        try {
          await waitStrategies.waitForElementVisible({
            strategy: 'css',
            value: recoveryContext.selector!
          }, {
            timeout: 3000,
            interval: 500
          }, recoveryContext.tabId);
          
          console.log('Recovered by waiting for element to become visible');
          return true;
        } catch (e) {
          // Try scrolling to top and then waiting
          try {
            const scrollFunction = () => {
              window.scrollTo(0, 0);
              return true;
            };
            
            await chromeApi.executeScript(recoveryContext.tabId!, scrollFunction);
            
            await waitStrategies.wait(1000);
            
            await waitStrategies.waitForElementVisible({
              strategy: 'css',
              value: recoveryContext.selector!
            }, {
                timeout: 3000,
                interval: 500
              }, recoveryContext.tabId);
            
            console.log('Recovered by scrolling to top and waiting');
            return true;
          } catch (scrollError) {
            console.error('Scroll recovery failed:', scrollError);
            return false;
          }
        }
      },
      maxRetries: 2,
      retryDelay: 1500
    },
    {
      name: 'element_not_clickable',
      description: 'Element not clickable - try alternative click methods',
      canRecover: (error, context) => {
        return error.message.includes('not clickable') && context.selector;
      },
      recover: async (error, context) => {
        const recoveryContext = context as RecoveryContext;
        
        // Try JavaScript click
        try {
          const jsClickFunction = (selector: string) => {
            const element = document.querySelector(selector);
            if (element && typeof (element as any).click === 'function') {
              (element as any).click();
              return true;
            }
            return false;
          };
          
          const result = await chromeApi.executeScript(
            recoveryContext.tabId!, 
            jsClickFunction, 
            [recoveryContext.selector]
          );
          
          if (result) {
            console.log('Recovered using JavaScript click');
            return true;
          }
        } catch (e) {
          // Try mouse event click
          try {
            const mouseClickFunction = (selector: string) => {
              const element = document.querySelector(selector);
              if (element) {
                const rect = element.getBoundingClientRect();
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  clientX: rect.left + rect.width / 2,
                  clientY: rect.top + rect.height / 2
                });
                
                element.dispatchEvent(clickEvent);
                return true;
              }
              return false;
            };
            
            const result = await chromeApi.executeScript(
              recoveryContext.tabId!, 
              mouseClickFunction, 
              [recoveryContext.selector]
            );
            
            if (result) {
              console.log('Recovered using mouse event click');
              return true;
            }
          } catch (mouseError) {
            console.error('Mouse click recovery failed:', mouseError);
            return false;
          }
        }
      },
      maxRetries: 2,
      retryDelay: 500
    },
    {
      name: 'navigation_timeout',
      description: 'Navigation timeout - try waiting longer or reloading',
      canRecover: (error, context) => {
        return error.message.includes('timeout') && error.message.includes('navigation');
      },
      recover: async (error, context) => {
        const recoveryContext = context as RecoveryContext;
        
        // Try waiting longer for navigation
        try {
          await waitStrategies.waitForNavigation({
            timeout: 30000
          }, recoveryContext.tabId);
          
          console.log('Recovered by waiting longer for navigation');
          return true;
        } catch (e) {
          // Try reloading the page
          try {
            await chromeApi.executeScript(recoveryContext.tabId!, () => {
              window.location.reload();
              return true;
            });
            
            console.log('Recovered by reloading page');
            return true;
          } catch (reloadError) {
            console.error('Navigation recovery failed:', reloadError);
            return false;
          }
        }
      },
      maxRetries: 2,
      retryDelay: 2000
    },
    {
      name: 'form_validation_failed',
      description: 'Form validation failed - try clearing and refilling',
      canRecover: (error, context) => {
        return error.message.includes('validation') && context.command;
      },
      recover: async (error, context) => {
        const recoveryContext = context as RecoveryContext;
        
        // Try clearing form and refilling
        try {
          const clearAndRefillFunction = (selector: string, value: string) => {
            const element = document.querySelector(selector) as HTMLInputElement;
            if (element) {
              element.value = '';
              element.focus();
              
              // Trigger events
              element.dispatchEvent(new Event('input', { bubbles: true }));
              element.dispatchEvent(new Event('change', { bubbles: true }));
              
              // Wait a bit then fill
              setTimeout(() => {
                element.value = value;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
              }, 100);
              
              return true;
            }
            return false;
          };
          
          const command = recoveryContext.command;
          if (command && command.selector && command.value) {
            const result = await chromeApi.executeScript(
              recoveryContext.tabId!, 
              clearAndRefillFunction, 
              [command.selector, command.value]
            );
            
            if (result) {
              console.log('Recovered by clearing and refilling form');
              return true;
            }
          }
          
          return false;
        } catch (e) {
          console.error('Form recovery failed:', e);
          return false;
        }
      },
      maxRetries: 2,
      retryDelay: 1000
    },
    {
      name: 'permission_denied',
      description: 'Permission denied - try requesting permission',
      canRecover: (error, context) => {
        return error.message.includes('permission') || error.message.includes('denied');
      },
      recover: async (error, context) => {
        const recoveryContext = context as RecoveryContext;
        
        // Try requesting permission
        try {
          // This would need to be implemented based on the specific permission needed
          console.log('Permission denied - manual intervention may be required');
          return false;
        } catch (e) {
          console.error('Permission recovery failed:', e);
          return false;
        }
      },
      maxRetries: 1,
      retryDelay: 0
    }
  ];

  private customStrategies: Map<string, RecoveryStrategy> = new Map();

  /**
   * Attempt to recover from an error
   */
  async attemptRecovery(
    workflowId: string, 
    stepNumber: number, 
    error: Error, 
    options: RecoveryOptions = {}
  ): Promise<boolean> {
    const context: RecoveryContext = {
      workflowId,
      stepNumber,
      command: options.command,
      tabId: options.tabId,
      selector: options.selector,
      originalError: error,
      retryCount: 0,
      maxRetries: options.maxRetries || 3
    };
    
    // If recovery is disabled, return false
    if (options.enableRecovery === false) {
      console.log('Error recovery disabled');
      return false;
    }
    
    // Try custom strategies first
    if (options.customStrategies) {
      for (const strategy of options.customStrategies) {
        if (strategy.canRecover(error, context)) {
          console.log(`Attempting custom recovery strategy: ${strategy.name}`);
          
          try {
            const recovered = await strategy.recover(error, context);
            if (recovered) {
              console.log(`Successfully recovered using strategy: ${strategy.name}`);
              return true;
            }
          } catch (recoveryError) {
            console.error(`Custom recovery strategy ${strategy.name} failed:`, recoveryError);
          }
        }
      }
    }
    
    // Try default strategies
    for (const strategy of this.defaultStrategies) {
      if (strategy.canRecover(error, context)) {
        console.log(`Attempting recovery strategy: ${strategy.name}`);
        
        try {
          const recovered = await strategy.recover(error, {
            ...context,
            retryCount: context.retryCount || 0,
            maxRetries: strategy.maxRetries || options.maxRetries || 3
          });
          
          if (recovered) {
            console.log(`Successfully recovered using strategy: ${strategy.name}`);
            return true;
          }
        } catch (recoveryError) {
          console.error(`Recovery strategy ${strategy.name} failed:`, recoveryError);
        }
      }
    }
    
    console.error('All recovery strategies failed');
    return false;
  }

  /**
   * Add a custom recovery strategy
   */
  addCustomStrategy(strategy: RecoveryStrategy): void {
    this.customStrategies.set(strategy.name, strategy);
  }

  /**
   * Remove a custom recovery strategy
   */
  removeCustomStrategy(name: string): boolean {
    return this.customStrategies.delete(name);
  }

  /**
   * Get all recovery strategies
   */
  getAllStrategies(): RecoveryStrategy[] {
    return [...this.defaultStrategies, ...Array.from(this.customStrategies.values())];
  }

  /**
   * Get recovery strategy by name
   */
  getStrategy(name: string): RecoveryStrategy | undefined {
    return this.defaultStrategies.find(s => s.name === name) || 
           this.customStrategies.get(name);
  }

  /**
   * Create a recovery context
   */
  createRecoveryContext(
    workflowId: string,
    stepNumber: number,
    command: any,
    tabId: number,
    selector?: string,
    originalError?: Error,
    retryCount?: number,
    maxRetries?: number
  ): RecoveryContext {
    return {
      workflowId,
      stepNumber,
      command,
      tabId,
      selector,
      originalError,
      retryCount: retryCount || 0,
      maxRetries: maxRetries || 3
    };
  }

  /**
   * Check if recovery is possible
   */
  canRecover(error: Error, context: RecoveryContext): boolean {
    // Check custom strategies
    for (const strategy of this.customStrategies.values()) {
      if (strategy.canRecover(error, context)) {
        return true;
      }
    }
    
    // Check default strategies
    for (const strategy of this.defaultStrategies) {
      if (strategy.canRecover(error, context)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStatistics(workflowId?: string): any {
    // This would need to track recovery attempts over time
    // For now, return basic statistics
    return {
      totalStrategies: this.defaultStrategies.length + this.customStrategies.size,
      customStrategies: this.customStrategies.size,
      defaultStrategies: this.defaultStrategies.length,
      availableStrategies: this.getAllStrategies().map(s => s.name)
    };
  }

  /**
   * Create a retry wrapper for automation commands
   */
  createRetryWrapper<T extends any[]>(
    command: (...args: T) => Promise<any>,
    options: RecoveryOptions = {}
  ): (...args: T) => Promise<any> {
    return async (...commandArgs: T) => {
      let lastError: Error | null = null;
      const maxRetries = options.maxRetries || 3;
      const retryDelay = options.retryDelay || 1000;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await command(...commandArgs);
          
          // If successful, return the result
          if (result && result.success !== false) {
            return result;
          }
          
          // If this is the last attempt, return the result even if failed
          if (attempt === maxRetries) {
            return result;
          }
          
          // Store the error for recovery attempt
          lastError = new Error(result?.error?.message || 'Command failed');
          
        } catch (error) {
          lastError = error;
          
          // If this is the last attempt, throw the error
          if (attempt === maxRetries) {
            throw error;
          }
        }
        
        // Wait before retry (except on last attempt)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
      
      // Try recovery if all retries failed
      if (lastError && options.enableRecovery !== false) {
        const context = this.createRecoveryContext(
          'unknown',
          0,
          { args: commandArgs },
          -1,
          commandArgs[0]?.selector,
          lastError,
          maxRetries
        );
        
        const recovered = await this.attemptRecovery('unknown', 0, lastError, options);
        
        if (recovered) {
          // Try the command one more time after recovery
          return await command(...commandArgs);
        }
      }
      
      // Return the last error if all failed
      throw lastError || new Error('Command failed after all retries');
    };
  }

  /**
   * Handle automation errors with context
   */
  async handleAutomationError(
    error: Error, 
    context: RecoveryContext, 
    options: RecoveryOptions = {}
  ): Promise<AutomationResponse> {
    console.error('Automation error:', error);
    
    // Try recovery
    if (options.enableRecovery !== false) {
      const recovered = await this.attemptRecovery(
        context.workflowId || 'unknown',
        context.stepNumber || 0,
        error,
        options
      );
      
      if (recovered) {
        return {
          commandId: context.command?.id || 'unknown',
          success: true,
          timestamp: Date.now(),
          data: {
            recovered: true,
            originalError: error.message
          }
        };
      }
    }
    
    // Return error response
    return {
      commandId: context.command?.id || 'unknown',
      success: false,
      timestamp: Date.now(),
      error: {
        code: 'AUTOMATION_ERROR',
        message: error.message,
        details: {
          context,
          recoveryAttempted: options.enableRecovery !== false
        }
      }
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.customStrategies.clear();
  }
}

// Export singleton instance for convenience
export const errorRecovery = new ErrorRecovery();
