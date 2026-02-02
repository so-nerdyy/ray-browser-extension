/**
 * Element interaction utilities for browser automation
 * Provides robust click, type, and other user interaction methods
 */

import { ElementSelector } from './automation-types';
import { chromeApi } from './chrome-api-wrappers';

export interface ClickOptions {
  button?: number;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  force?: boolean;
  doubleClick?: boolean;
  rightClick?: boolean;
  holdDuration?: number;
}

export interface TypeOptions {
  clearFirst?: boolean;
  delay?: number;
  humanLike?: boolean;
  triggerEvents?: boolean;
  caseSensitive?: boolean;
}

export interface ScrollOptions {
  behavior?: 'auto' | 'smooth';
  block?: 'start' | 'center' | 'end' | 'nearest';
  inline?: 'start' | 'center' | 'end' | 'nearest';
}

export interface DragOptions {
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  duration?: number;
  steps?: number;
}

export interface HoverOptions {
  duration?: number;
  moveDelay?: number;
}

export class ElementInteraction {
  private readonly DEFAULT_DELAY = 50;
  private readonly DEFAULT_HOVER_DURATION = 500;
  private readonly DEFAULT_DRAG_DURATION = 1000;
  private readonly DEFAULT_DRAG_STEPS = 10;

  /**
   * Click an element with various options
   */
  async click(
    selector: string, 
    options: ClickOptions = {}, 
    tabId?: number
  ): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    
    const clickFunction = (selector: string, opts: ClickOptions) => {
      return new Promise((resolve, reject) => {
        try {
          const element = document.querySelector(selector);
          if (!element) {
            reject(new Error(`Element not found: ${selector}`));
            return;
          }
          
          // Check if element is visible and clickable
          const rect = element.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0;
          
          if (!isVisible && !opts.force) {
            reject(new Error(`Element is not visible: ${selector}`));
            return;
          }
          
          // Scroll element into view
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Wait for scroll to complete
          setTimeout(() => {
            try {
              // Create mouse events
              const mouseEvents = [];
              
              // Mouse enter
              mouseEvents.push(new MouseEvent('mouseenter', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
              }));
              
              // Mouse move
              mouseEvents.push(new MouseEvent('mousemove', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
              }));
              
              // Mouse down
              mouseEvents.push(new MouseEvent('mousedown', {
                view: window,
                bubbles: true,
                cancelable: true,
                button: opts.button || 0,
                ctrlKey: opts.ctrlKey || false,
                shiftKey: opts.shiftKey || false,
                altKey: opts.altKey || false,
                metaKey: opts.metaKey || false,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
              }));
              
              // Mouse up
              mouseEvents.push(new MouseEvent('mouseup', {
                view: window,
                bubbles: true,
                cancelable: true,
                button: opts.button || 0,
                ctrlKey: opts.ctrlKey || false,
                shiftKey: opts.shiftKey || false,
                altKey: opts.altKey || false,
                metaKey: opts.metaKey || false,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
              }));
              
              // Click event
              const clickEvent = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true,
                button: opts.button || 0,
                ctrlKey: opts.ctrlKey || false,
                shiftKey: opts.shiftKey || false,
                altKey: opts.altKey || false,
                metaKey: opts.metaKey || false,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
              });
              
              if (opts.rightClick) {
                // Context menu event for right click
                const contextEvent = new MouseEvent('contextmenu', {
                  view: window,
                  bubbles: true,
                  cancelable: true,
                  button: 2,
                  clientX: rect.left + rect.width / 2,
                  clientY: rect.top + rect.height / 2
                });
                mouseEvents.push(contextEvent);
              }
              
              // Dispatch events with delays to simulate natural interaction
              mouseEvents.forEach((event, index) => {
                setTimeout(() => {
                  element.dispatchEvent(event);
                }, index * 50);
              });
              
              // Handle double click
              if (opts.doubleClick) {
                setTimeout(() => {
                  const dblClickEvent = new MouseEvent('dblclick', {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    button: opts.button || 0,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2
                  });
                  element.dispatchEvent(dblClickEvent);
                }, mouseEvents.length * 50);
              }
              
              // Also try direct click for better compatibility
              if (typeof (element as any).click === 'function') {
                setTimeout(() => {
                  (element as any).click();
                }, mouseEvents.length * 50);
              }
              
              resolve(true);
            } catch (error) {
              reject(error);
            }
          }, 300);
        } catch (error) {
          reject(error);
        }
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, clickFunction, [selector, options]);
    } catch (error) {
      throw new Error(`Failed to click element: ${error.message}`);
    }
  }

  /**
   * Type text into an input field
   */
  async type(
    selector: string, 
    text: string, 
    options: TypeOptions = {}, 
    tabId?: number
  ): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    
    const typeFunction = async (selector: string, text: string, opts: TypeOptions) => {
      return new Promise((resolve, reject) => {
        try {
          const element = document.querySelector(selector) as HTMLInputElement;
          if (!element) {
            reject(new Error(`Element not found: ${selector}`));
            return;
          }
          
          // Check if element is a text input
          const validTypes = ['text', 'password', 'email', 'search', 'tel', 'url', 'number'];
          if (element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA') {
            reject(new Error(`Element is not a text input: ${selector}`));
            return;
          }
          
          if (element.tagName === 'INPUT' && !validTypes.includes(element.type)) {
            reject(new Error(`Element is not a text input: ${selector}`));
            return;
          }
          
          // Focus the element
          element.focus();
          
          // Clear first if requested
          if (opts.clearFirst !== false) {
            element.value = '';
          }
          
          // Type each character with optional delay
          const typeChar = (index: number) => {
            if (index >= text.length) {
              // Trigger change event
              if (opts.triggerEvents !== false) {
                const changeEvent = new Event('change', { bubbles: true });
                element.dispatchEvent(changeEvent);
              }
              
              // Blur the element
              element.blur();
              resolve(true);
              return;
            }
            
            const char = text[index];
            
            // Dispatch key events
            const keyDownEvent = new KeyboardEvent('keydown', {
              key: char,
              code: char,
              bubbles: true,
              cancelable: true
            });
            
            const inputEvent = new InputEvent('input', {
              data: char,
              bubbles: true,
              cancelable: true
            });
            
            const keyUpEvent = new KeyboardEvent('keyup', {
              key: char,
              code: char,
              bubbles: true,
              cancelable: true
            });
            
            element.dispatchEvent(keyDownEvent);
            element.value += char;
            element.dispatchEvent(inputEvent);
            element.dispatchEvent(keyUpEvent);
            
            // Schedule next character
            const delay = opts.humanLike 
              ? (opts.delay || Math.random() * 100 + 50)
              : (opts.delay || this.DEFAULT_DELAY);
              
            setTimeout(() => typeChar(index + 1), delay);
          };
          
          // Start typing
          typeChar(0);
        } catch (error) {
          reject(error);
        }
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, typeFunction, [selector, text, options]);
    } catch (error) {
      throw new Error(`Failed to type text: ${error.message}`);
    }
  }

  /**
   * Hover over an element
   */
  async hover(
    selector: string, 
    options: HoverOptions = {}, 
    tabId?: number
  ): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    
    const hoverFunction = (selector: string, opts: HoverOptions) => {
      return new Promise((resolve, reject) => {
        try {
          const element = document.querySelector(selector);
          if (!element) {
            reject(new Error(`Element not found: ${selector}`));
            return;
          }
          
          const rect = element.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          
          // Scroll element into view
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          setTimeout(() => {
            try {
              // Mouse enter
              const mouseEnterEvent = new MouseEvent('mouseenter', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: centerX,
                clientY: centerY
              });
              
              // Mouse move
              const mouseMoveEvent = new MouseEvent('mousemove', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: centerX,
                clientY: centerY
              });
              
              // Mouse over
              const mouseOverEvent = new MouseEvent('mouseover', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: centerX,
                clientY: centerY
              });
              
              element.dispatchEvent(mouseEnterEvent);
              element.dispatchEvent(mouseMoveEvent);
              element.dispatchEvent(mouseOverEvent);
              
              // Hold hover for specified duration
              const duration = opts.duration || this.DEFAULT_HOVER_DURATION;
              
              if (duration > 0) {
                setTimeout(() => {
                  resolve(true);
                }, duration);
              } else {
                resolve(true);
              }
            } catch (error) {
              reject(error);
            }
          }, 300);
        } catch (error) {
          reject(error);
        }
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, hoverFunction, [selector, options]);
    } catch (error) {
      throw new Error(`Failed to hover over element: ${error.message}`);
    }
  }

  /**
   * Drag and drop functionality
   */
  async drag(
    selector: string, 
    options: DragOptions = {}, 
    tabId?: number
  ): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    
    const dragFunction = (selector: string, opts: DragOptions) => {
      return new Promise((resolve, reject) => {
        try {
          const element = document.querySelector(selector);
          if (!element) {
            reject(new Error(`Element not found: ${selector}`));
            return;
          }
          
          const rect = element.getBoundingClientRect();
          const startX = opts.fromX || rect.left + rect.width / 2;
          const startY = opts.fromY || rect.top + rect.height / 2;
          const endX = opts.toX || startX + 100;
          const endY = opts.toY || startY;
          const duration = opts.duration || this.DEFAULT_DRAG_DURATION;
          const steps = opts.steps || this.DEFAULT_DRAG_STEPS;
          
          // Scroll element into view
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          setTimeout(() => {
            try {
              // Mouse down
              const mouseDownEvent = new MouseEvent('mousedown', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: startX,
                clientY: startY,
                button: 0
              });
              
              // Drag start
              const dragStartEvent = new DragEvent('dragstart', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: startX,
                clientY: startY,
                dataTransfer: new DataTransfer()
              });
              
              element.dispatchEvent(mouseDownEvent);
              element.dispatchEvent(dragStartEvent);
              
              // Simulate drag movement
              const stepDuration = duration / steps;
              const deltaX = (endX - startX) / steps;
              const deltaY = (endY - startY) / steps;
              
              let currentStep = 0;
              
              const moveStep = () => {
                if (currentStep >= steps) {
                  // Mouse up
                  const mouseUpEvent = new MouseEvent('mouseup', {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: endX,
                    clientY: endY,
                    button: 0
                  });
                  
                  // Drop event
                  const dropEvent = new DragEvent('drop', {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: endX,
                    clientY: endY,
                    dataTransfer: new DataTransfer()
                  });
                  
                  element.dispatchEvent(mouseUpEvent);
                  document.elementFromPoint(endX, endY)?.dispatchEvent(dropEvent);
                  
                  resolve(true);
                  return;
                }
                
                currentStep++;
                const currentX = startX + deltaX * currentStep;
                const currentY = startY + deltaY * currentStep;
                
                const mouseMoveEvent = new MouseEvent('mousemove', {
                  view: window,
                  bubbles: true,
                  cancelable: true,
                  clientX: currentX,
                  clientY: currentY,
                  button: 0
                });
                
                const dragEvent = new DragEvent('drag', {
                  view: window,
                  bubbles: true,
                  cancelable: true,
                  clientX: currentX,
                  clientY: currentY,
                  dataTransfer: new DataTransfer()
                });
                
                element.dispatchEvent(mouseMoveEvent);
                element.dispatchEvent(dragEvent);
                
                setTimeout(moveStep, stepDuration);
              };
              
              // Start moving
              setTimeout(moveStep, stepDuration);
            } catch (error) {
              reject(error);
            }
          }, 300);
        } catch (error) {
          reject(error);
        }
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, dragFunction, [selector, options]);
    } catch (error) {
      throw new Error(`Failed to drag element: ${error.message}`);
    }
  }

  /**
   * Scroll to an element
   */
  async scrollToElement(
    selector: string, 
    options: ScrollOptions = {}, 
    tabId?: number
  ): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    
    const scrollFunction = (selector: string, opts: ScrollOptions) => {
      return new Promise((resolve, reject) => {
        try {
          const element = document.querySelector(selector);
          if (!element) {
            reject(new Error(`Element not found: ${selector}`));
            return;
          }
          
          const scrollOptions: ScrollIntoViewOptions = {
            behavior: opts.behavior || 'smooth',
            block: opts.block || 'center',
            inline: opts.inline || 'nearest'
          };
          
          element.scrollIntoView(scrollOptions);
          
          // Wait for scroll to complete
          setTimeout(() => {
            resolve(true);
          }, 500);
        } catch (error) {
          reject(error);
        }
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, scrollFunction, [selector, options]);
    } catch (error) {
      throw new Error(`Failed to scroll to element: ${error.message}`);
    }
  }

  /**
   * Check if an element is visible
   */
  async isElementVisible(selector: string, tabId?: number): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    
    const checkVisibilityFunction = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) {
        return false;
      }
      
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        style.opacity !== '0'
      );
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, checkVisibilityFunction, [selector]);
    } catch (error) {
      throw new Error(`Failed to check element visibility: ${error.message}`);
    }
  }

  /**
   * Get element position and size
   */
  async getElementBounds(selector: string, tabId?: number): Promise<any> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    
    const getBoundsFunction = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      
      const rect = element.getBoundingClientRect();
      
      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom
      };
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, getBoundsFunction, [selector]);
    } catch (error) {
      throw new Error(`Failed to get element bounds: ${error.message}`);
    }
  }

  /**
   * Wait for an element to become visible
   */
  async waitForElementVisible(
    selector: string, 
    timeout: number = 10000, 
    tabId?: number
  ): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    
    const waitFunction = (selector: string, timeoutMs: number) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkElement = () => {
          const element = document.querySelector(selector);
          
          if (!element) {
            if (Date.now() - startTime > timeoutMs) {
              reject(new Error(`Element not found within timeout: ${selector}`));
              return;
            }
            
            setTimeout(checkElement, 100);
            return;
          }
          
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
            resolve(true);
            return;
          }
          
          if (Date.now() - startTime > timeoutMs) {
            reject(new Error(`Element did not become visible within timeout: ${selector}`));
            return;
          }
          
          setTimeout(checkElement, 100);
        };
        
        checkElement();
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, waitFunction, [selector, timeout]);
    } catch (error) {
      throw new Error(`Failed to wait for element visibility: ${error.message}`);
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // No specific cleanup needed for ElementInteraction
  }
}

// Export singleton instance for convenience
export const elementInteraction = new ElementInteraction(); * Element interaction utilities for browser automation
 * Provides robust click, type, and other user interaction methods
 */

import { ElementSelector } from './automation-types';
import { chromeApi } from './chrome-api-wrappers';

export interface ClickOptions {
  button?: number;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  force?: boolean;
  doubleClick?: boolean;
  rightClick?: boolean;
  holdDuration?: number;
}

export interface TypeOptions {
  clearFirst?: boolean;
  delay?: number;
  humanLike?: boolean;
  triggerEvents?: boolean;
  caseSensitive?: boolean;
}

export interface ScrollOptions {
  behavior?: 'auto' | 'smooth';
  block?: 'start' | 'center' | 'end' | 'nearest';
  inline?: 'start' | 'center' | 'end' | 'nearest';
}

export interface DragOptions {
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  duration?: number;
  steps?: number;
}

export interface HoverOptions {
  duration?: number;
  moveDelay?: number;
}

export class ElementInteraction {
  private readonly DEFAULT_DELAY = 50;
  private readonly DEFAULT_HOVER_DURATION = 500;
  private readonly DEFAULT_DRAG_DURATION = 1000;
  private readonly DEFAULT_DRAG_STEPS = 10;

  /**
   * Click an element with various options
   */
  async click(
    selector: string, 
    options: ClickOptions = {}, 
    tabId?: number
  ): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    
    const clickFunction = (selector: string, opts: ClickOptions) => {
      return new Promise((resolve, reject) => {
        try {
          const element = document.querySelector(selector);
          if (!element) {
            reject(new Error(`Element not found: ${selector}`));
            return;
          }
          
          // Check if element is visible and clickable
          const rect = element.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0;
          
          if (!isVisible && !opts.force) {
            reject(new Error(`Element is not visible: ${selector}`));
            return;
          }
          
          // Scroll element into view
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Wait for scroll to complete
          setTimeout(() => {
            try {
              // Create mouse events
              const mouseEvents = [];
              
              // Mouse enter
              mouseEvents.push(new MouseEvent('mouseenter', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
              }));
              
              // Mouse move
              mouseEvents.push(new MouseEvent('mousemove', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
              }));
              
              // Mouse down
              mouseEvents.push(new MouseEvent('mousedown', {
                view: window,
                bubbles: true,
                cancelable: true,
                button: opts.button || 0,
                ctrlKey: opts.ctrlKey || false,
                shiftKey: opts.shiftKey || false,
                altKey: opts.altKey || false,
                metaKey: opts.metaKey || false,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
              }));
              
              // Mouse up
              mouseEvents.push(new MouseEvent('mouseup', {
                view: window,
                bubbles: true,
                cancelable: true,
                button: opts.button || 0,
                ctrlKey: opts.ctrlKey || false,
                shiftKey: opts.shiftKey || false,
                altKey: opts.altKey || false,
                metaKey: opts.metaKey || false,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
              }));
              
              // Click event
              const clickEvent = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true,
                button: opts.button || 0,
                ctrlKey: opts.ctrlKey || false,
                shiftKey: opts.shiftKey || false,
                altKey: opts.altKey || false,
                metaKey: opts.metaKey || false,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
              });
              
              if (opts.rightClick) {
                // Context menu event for right click
                const contextEvent = new MouseEvent('contextmenu', {
                  view: window,
                  bubbles: true,
                  cancelable: true,
                  button: 2,
                  clientX: rect.left + rect.width / 2,
                  clientY: rect.top + rect.height / 2
                });
                mouseEvents.push(contextEvent);
              }
              
              // Dispatch events with delays to simulate natural interaction
              mouseEvents.forEach((event, index) => {
                setTimeout(() => {
                  element.dispatchEvent(event);
                }, index * 50);
              });
              
              // Handle double click
              if (opts.doubleClick) {
                setTimeout(() => {
                  const dblClickEvent = new MouseEvent('dblclick', {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    button: opts.button || 0,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2
                  });
                  element.dispatchEvent(dblClickEvent);
                }, mouseEvents.length * 50);
              }
              
              // Also try direct click for better compatibility
              if (typeof (element as any).click === 'function') {
                setTimeout(() => {
                  (element as any).click();
                }, mouseEvents.length * 50);
              }
              
              resolve(true);
            } catch (error) {
              reject(error);
            }
          }, 300);
        } catch (error) {
          reject(error);
        }
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, clickFunction, [selector, options]);
    } catch (error) {
      throw new Error(`Failed to click element: ${error.message}`);
    }
  }

  /**
   * Type text into an input field
   */
  async type(
    selector: string, 
    text: string, 
    options: TypeOptions = {}, 
    tabId?: number
  ): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    
    const typeFunction = async (selector: string, text: string, opts: TypeOptions) => {
      return new Promise((resolve, reject) => {
        try {
          const element = document.querySelector(selector) as HTMLInputElement;
          if (!element) {
            reject(new Error(`Element not found: ${selector}`));
            return;
          }
          
          // Check if element is a text input
          const validTypes = ['text', 'password', 'email', 'search', 'tel', 'url', 'number'];
          if (element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA') {
            reject(new Error(`Element is not a text input: ${selector}`));
            return;
          }
          
          if (element.tagName === 'INPUT' && !validTypes.includes(element.type)) {
            reject(new Error(`Element is not a text input: ${selector}`));
            return;
          }
          
          // Focus the element
          element.focus();
          
          // Clear first if requested
          if (opts.clearFirst !== false) {
            element.value = '';
          }
          
          // Type each character with optional delay
          const typeChar = (index: number) => {
            if (index >= text.length) {
              // Trigger change event
              if (opts.triggerEvents !== false) {
                const changeEvent = new Event('change', { bubbles: true });
                element.dispatchEvent(changeEvent);
              }
              
              // Blur the element
              element.blur();
              resolve(true);
              return;
            }
            
            const char = text[index];
            
            // Dispatch key events
            const keyDownEvent = new KeyboardEvent('keydown', {
              key: char,
              code: char,
              bubbles: true,
              cancelable: true
            });
            
            const inputEvent = new InputEvent('input', {
              data: char,
              bubbles: true,
              cancelable: true
            });
            
            const keyUpEvent = new KeyboardEvent('keyup', {
              key: char,
              code: char,
              bubbles: true,
              cancelable: true
            });
            
            element.dispatchEvent(keyDownEvent);
            element.value += char;
            element.dispatchEvent(inputEvent);
            element.dispatchEvent(keyUpEvent);
            
            // Schedule next character
            const delay = opts.humanLike 
              ? (opts.delay || Math.random() * 100 + 50)
              : (opts.delay || this.DEFAULT_DELAY);
              
            setTimeout(() => typeChar(index + 1), delay);
          };
          
          // Start typing
          typeChar(0);
        } catch (error) {
          reject(error);
        }
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, typeFunction, [selector, text, options]);
    } catch (error) {
      throw new Error(`Failed to type text: ${error.message}`);
    }
  }

  /**
   * Hover over an element
   */
  async hover(
    selector: string, 
    options: HoverOptions = {}, 
    tabId?: number
  ): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    
    const hoverFunction = (selector: string, opts: HoverOptions) => {
      return new Promise((resolve, reject) => {
        try {
          const element = document.querySelector(selector);
          if (!element) {
            reject(new Error(`Element not found: ${selector}`));
            return;
          }
          
          const rect = element.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          
          // Scroll element into view
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          setTimeout(() => {
            try {
              // Mouse enter
              const mouseEnterEvent = new MouseEvent('mouseenter', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: centerX,
                clientY: centerY
              });
              
              // Mouse move
              const mouseMoveEvent = new MouseEvent('mousemove', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: centerX,
                clientY: centerY
              });
              
              // Mouse over
              const mouseOverEvent = new MouseEvent('mouseover', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: centerX,
                clientY: centerY
              });
              
              element.dispatchEvent(mouseEnterEvent);
              element.dispatchEvent(mouseMoveEvent);
              element.dispatchEvent(mouseOverEvent);
              
              // Hold hover for specified duration
              const duration = opts.duration || this.DEFAULT_HOVER_DURATION;
              
              if (duration > 0) {
                setTimeout(() => {
                  resolve(true);
                }, duration);
              } else {
                resolve(true);
              }
            } catch (error) {
              reject(error);
            }
          }, 300);
        } catch (error) {
          reject(error);
        }
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, hoverFunction, [selector, options]);
    } catch (error) {
      throw new Error(`Failed to hover over element: ${error.message}`);
    }
  }

  /**
   * Drag and drop functionality
   */
  async drag(
    selector: string, 
    options: DragOptions = {}, 
    tabId?: number
  ): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    
    const dragFunction = (selector: string, opts: DragOptions) => {
      return new Promise((resolve, reject) => {
        try {
          const element = document.querySelector(selector);
          if (!element) {
            reject(new Error(`Element not found: ${selector}`));
            return;
          }
          
          const rect = element.getBoundingClientRect();
          const startX = opts.fromX || rect.left + rect.width / 2;
          const startY = opts.fromY || rect.top + rect.height / 2;
          const endX = opts.toX || startX + 100;
          const endY = opts.toY || startY;
          const duration = opts.duration || this.DEFAULT_DRAG_DURATION;
          const steps = opts.steps || this.DEFAULT_DRAG_STEPS;
          
          // Scroll element into view
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          setTimeout(() => {
            try {
              // Mouse down
              const mouseDownEvent = new MouseEvent('mousedown', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: startX,
                clientY: startY,
                button: 0
              });
              
              // Drag start
              const dragStartEvent = new DragEvent('dragstart', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: startX,
                clientY: startY,
                dataTransfer: new DataTransfer()
              });
              
              element.dispatchEvent(mouseDownEvent);
              element.dispatchEvent(dragStartEvent);
              
              // Simulate drag movement
              const stepDuration = duration / steps;
              const deltaX = (endX - startX) / steps;
              const deltaY = (endY - startY) / steps;
              
              let currentStep = 0;
              
              const moveStep = () => {
                if (currentStep >= steps) {
                  // Mouse up
                  const mouseUpEvent = new MouseEvent('mouseup', {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: endX,
                    clientY: endY,
                    button: 0
                  });
                  
                  // Drop event
                  const dropEvent = new DragEvent('drop', {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: endX,
                    clientY: endY,
                    dataTransfer: new DataTransfer()
                  });
                  
                  element.dispatchEvent(mouseUpEvent);
                  document.elementFromPoint(endX, endY)?.dispatchEvent(dropEvent);
                  
                  resolve(true);
                  return;
                }
                
                currentStep++;
                const currentX = startX + deltaX * currentStep;
                const currentY = startY + deltaY * currentStep;
                
                const mouseMoveEvent = new MouseEvent('mousemove', {
                  view: window,
                  bubbles: true,
                  cancelable: true,
                  clientX: currentX,
                  clientY: currentY,
                  button: 0
                });
                
                const dragEvent = new DragEvent('drag', {
                  view: window,
                  bubbles: true,
                  cancelable: true,
                  clientX: currentX,
                  clientY: currentY,
                  dataTransfer: new DataTransfer()
                });
                
                element.dispatchEvent(mouseMoveEvent);
                element.dispatchEvent(dragEvent);
                
                setTimeout(moveStep, stepDuration);
              };
              
              // Start moving
              setTimeout(moveStep, stepDuration);
            } catch (error) {
              reject(error);
            }
          }, 300);
        } catch (error) {
          reject(error);
        }
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, dragFunction, [selector, options]);
    } catch (error) {
      throw new Error(`Failed to drag element: ${error.message}`);
    }
  }

  /**
   * Scroll to an element
   */
  async scrollToElement(
    selector: string, 
    options: ScrollOptions = {}, 
    tabId?: number
  ): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    
    const scrollFunction = (selector: string, opts: ScrollOptions) => {
      return new Promise((resolve, reject) => {
        try {
          const element = document.querySelector(selector);
          if (!element) {
            reject(new Error(`Element not found: ${selector}`));
            return;
          }
          
          const scrollOptions: ScrollIntoViewOptions = {
            behavior: opts.behavior || 'smooth',
            block: opts.block || 'center',
            inline: opts.inline || 'nearest'
          };
          
          element.scrollIntoView(scrollOptions);
          
          // Wait for scroll to complete
          setTimeout(() => {
            resolve(true);
          }, 500);
        } catch (error) {
          reject(error);
        }
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, scrollFunction, [selector, options]);
    } catch (error) {
      throw new Error(`Failed to scroll to element: ${error.message}`);
    }
  }

  /**
   * Check if an element is visible
   */
  async isElementVisible(selector: string, tabId?: number): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    
    const checkVisibilityFunction = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) {
        return false;
      }
      
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        style.opacity !== '0'
      );
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, checkVisibilityFunction, [selector]);
    } catch (error) {
      throw new Error(`Failed to check element visibility: ${error.message}`);
    }
  }

  /**
   * Get element position and size
   */
  async getElementBounds(selector: string, tabId?: number): Promise<any> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    
    const getBoundsFunction = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      
      const rect = element.getBoundingClientRect();
      
      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom
      };
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, getBoundsFunction, [selector]);
    } catch (error) {
      throw new Error(`Failed to get element bounds: ${error.message}`);
    }
  }

  /**
   * Wait for an element to become visible
   */
  async waitForElementVisible(
    selector: string, 
    timeout: number = 10000, 
    tabId?: number
  ): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    
    const waitFunction = (selector: string, timeoutMs: number) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkElement = () => {
          const element = document.querySelector(selector);
          
          if (!element) {
            if (Date.now() - startTime > timeoutMs) {
              reject(new Error(`Element not found within timeout: ${selector}`));
              return;
            }
            
            setTimeout(checkElement, 100);
            return;
          }
          
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
            resolve(true);
            return;
          }
          
          if (Date.now() - startTime > timeoutMs) {
            reject(new Error(`Element did not become visible within timeout: ${selector}`));
            return;
          }
          
          setTimeout(checkElement, 100);
        };
        
        checkElement();
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, waitFunction, [selector, timeout]);
    } catch (error) {
      throw new Error(`Failed to wait for element visibility: ${error.message}`);
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // No specific cleanup needed for ElementInteraction
  }
}

// Export singleton instance for convenience
export const elementInteraction = new ElementInteraction();
