/**
 * Core browser automation engine
 * Executes automation commands using Chrome Extension APIs
 */

import { 
  AnyAutomationCommand, 
  AutomationResponse, 
  AutomationError, 
  TabInfo,
  AutomationConfig 
} from './automation-types';
import { chromeApi } from './chrome-api-wrappers';

export class BrowserAutomation {
  private config: AutomationConfig;
  
  constructor(config?: Partial<AutomationConfig>) {
    this.config = {
      defaultTimeout: 10000,
      retryAttempts: 3,
      retryDelay: 1000,
      enablePerformanceMonitoring: true,
      enableSelectorCaching: true,
      maxConcurrentWorkflows: 5,
      ...config
    };
  }

  /**
   * Execute an automation command
   * @param command The automation command to execute
   * @returns Promise with the execution response
   */
  async executeCommand(command: AnyAutomationCommand): Promise<AutomationResponse> {
    const startTime = Date.now();
    
    try {
      let result: any;
      
      switch (command.type) {
        case 'navigate':
          result = await this.executeNavigate(command);
          break;
          
        case 'click':
          result = await this.executeClick(command);
          break;
          
        case 'fillForm':
          result = await this.executeFillForm(command);
          break;
          
        case 'type':
          result = await this.executeType(command);
          break;
          
        case 'scroll':
          result = await this.executeScroll(command);
          break;
          
        case 'wait':
          result = await this.executeWait(command);
          break;
          
        case 'waitForElement':
          result = await this.executeWaitForElement(command);
          break;
          
        case 'extractText':
          result = await this.executeExtractText(command);
          break;
          
        case 'screenshot':
          result = await this.executeScreenshot(command);
          break;
          
        case 'createTab':
          result = await this.executeCreateTab(command);
          break;
          
        case 'closeTab':
          result = await this.executeCloseTab(command);
          break;
          
        case 'switchTab':
          result = await this.executeSwitchTab(command);
          break;
          
        case 'workflow':
          result = await this.executeWorkflow(command);
          break;
          
        default:
          throw new Error(`Unknown command type: ${(command as any).type}`);
      }
      
      const endTime = Date.now();
      
      return {
        commandId: command.id,
        success: true,
        timestamp: endTime,
        data: result
      };
      
    } catch (error) {
      const endTime = Date.now();
      
      return {
        commandId: command.id,
        success: false,
        timestamp: endTime,
        error: {
          code: 'COMMAND_EXECUTION_FAILED',
          message: error.message,
          details: error
        }
      };
    }
  }

  /**
   * Execute navigation command
   */
  private async executeNavigate(command: any): Promise<TabInfo> {
    const tabId = command.tabId || (await chromeApi.getActiveTab()).id;
    await chromeApi.navigateToUrl(tabId, command.url);
    
    // Wait for navigation to complete
    await chromeApi.waitForTabToLoad(tabId, this.config.defaultTimeout);
    
    return await chromeApi.getTab(tabId);
  }

  /**
   * Execute click command
   */
  private async executeClick(command: any): Promise<boolean> {
    const tabId = command.tabId || (await chromeApi.getActiveTab()).id;
    
    if (command.waitForSelector !== false) {
      await this.waitForElement(tabId, command.selector, command.timeout || this.config.defaultTimeout);
    }
    
    const clickFunction = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      
      // Check if element is clickable
      const rect = element.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0;
      
      if (!isVisible) {
        throw new Error(`Element is not visible: ${selector}`);
      }
      
      // Create and dispatch click event
      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
      });
      
      element.dispatchEvent(clickEvent);
      
      // Also try direct click for better compatibility
      if (typeof element.click === 'function') {
        element.click();
      }
      
      return true;
    };
    
    return await chromeApi.executeScript(tabId, clickFunction, [command.selector]);
  }

  /**
   * Execute form fill command
   */
  private async executeFillForm(command: any): Promise<boolean> {
    const tabId = command.tabId || (await chromeApi.getActiveTab()).id;
    
    const fillFunction = (selector: string, value: string, clearFirst: boolean) => {
      const element = document.querySelector(selector) as HTMLInputElement;
      
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      
      if (clearFirst) {
        element.value = '';
      }
      
      // Set the value
      element.value = value;
      
      // Trigger events to ensure frameworks detect the change
      const events = ['input', 'change', 'blur'];
      events.forEach(eventType => {
        const event = new Event(eventType, { bubbles: true });
        element.dispatchEvent(event);
      });
      
      return true;
    };
    
    return await chromeApi.executeScript(
      tabId, 
      fillFunction, 
      [command.selector, command.value, command.clearFirst || false]
    );
  }

  /**
   * Execute type command
   */
  private async executeType(command: any): Promise<boolean> {
    const tabId = command.tabId || (await chromeApi.getActiveTab()).id;
    
    const typeFunction = async (selector: string, text: string, clearFirst: boolean, delay: number) => {
      const element = document.querySelector(selector) as HTMLInputElement;
      
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      
      if (clearFirst) {
        element.value = '';
      }
      
      // Focus the element
      element.focus();
      
      // Type each character with delay
      for (let i = 0; i < text.length; i++) {
        element.value += text[i];
        
        // Trigger input event
        const inputEvent = new Event('input', { bubbles: true });
        element.dispatchEvent(inputEvent);
        
        // Add delay between characters
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      // Trigger change event
      const changeEvent = new Event('change', { bubbles: true });
      element.dispatchEvent(changeEvent);
      
      return true;
    };
    
    return await chromeApi.executeScript(
      tabId, 
      typeFunction, 
      [command.selector, command.text, command.clearFirst || false, command.delay || 0]
    );
  }

  /**
   * Execute scroll command
   */
  private async executeScroll(command: any): Promise<boolean> {
    const tabId = command.tabId || (await chromeApi.getActiveTab()).id;
    
    const scrollFunction = (direction: string, amount?: number, selector?: string) => {
      let element: Element | Window = window;
      
      if (selector) {
        element = document.querySelector(selector) || window;
      }
      
      let scrollOptions: ScrollToOptions = { behavior: 'smooth' };
      
      switch (direction) {
        case 'up':
          scrollOptions.top = -(amount || 300);
          break;
        case 'down':
          scrollOptions.top = amount || 300;
          break;
        case 'left':
          scrollOptions.left = -(amount || 300);
          break;
        case 'right':
          scrollOptions.left = amount || 300;
          break;
        case 'top':
          scrollOptions.top = 0;
          scrollOptions.left = 0;
          break;
        case 'bottom':
          if (element === window) {
            scrollOptions.top = document.documentElement.scrollHeight;
          } else {
            scrollOptions.top = (element as Element).scrollHeight;
          }
          break;
      }
      
      if (element === window) {
        window.scrollBy(scrollOptions);
      } else {
        (element as Element).scrollBy(scrollOptions);
      }
      
      return true;
    };
    
    return await chromeApi.executeScript(
      tabId, 
      scrollFunction, 
      [command.direction, command.amount, command.selector]
    );
  }

  /**
   * Execute wait command
   */
  private async executeWait(command: any): Promise<boolean> {
    return new Promise(resolve => {
      setTimeout(() => resolve(true), command.duration);
    });
  }

  /**
   * Execute wait for element command
   */
  private async executeWaitForElement(command: any): Promise<boolean> {
    const tabId = command.tabId || (await chromeApi.getActiveTab()).id;
    return await this.waitForElement(tabId, command.selector, command.timeout || this.config.defaultTimeout);
  }

  /**
   * Execute extract text command
   */
  private async executeExtractText(command: any): Promise<string> {
    const tabId = command.tabId || (await chromeApi.getActiveTab()).id;
    
    const extractFunction = (selector: string, attribute?: string) => {
      const element = document.querySelector(selector);
      
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      
      if (attribute) {
        return element.getAttribute(attribute) || '';
      }
      
      return element.textContent || '';
    };
    
    return await chromeApi.executeScript(
      tabId, 
      extractFunction, 
      [command.selector, command.attribute]
    );
  }

  /**
   * Execute screenshot command
   */
  private async executeScreenshot(command: any): Promise<string> {
    const tabId = command.tabId || (await chromeApi.getActiveTab()).id;
    
    // Use Chrome's captureVisibleTab API
    const dataUrl = await chrome.tabs.captureVisibleTab(
      chrome.windows.WINDOW_ID_CURRENT,
      { format: command.format || 'png', quality: command.quality || 100 }
    );
    
    return dataUrl;
  }

  /**
   * Execute create tab command
   */
  private async executeCreateTab(command: any): Promise<TabInfo> {
    return await chromeApi.createTab(command.url, command.active !== false);
  }

  /**
   * Execute close tab command
   */
  private async executeCloseTab(command: any): Promise<boolean> {
    await chromeApi.closeTab(command.tabId);
    return true;
  }

  /**
   * Execute switch tab command
   */
  private async executeSwitchTab(command: any): Promise<TabInfo> {
    await chromeApi.switchToTab(command.tabId);
    return await chromeApi.getTab(command.tabId);
  }

  /**
   * Execute workflow command
   */
  private async executeWorkflow(command: any): Promise<any> {
    const results = [];
    
    for (let i = 0; i < command.steps.length; i++) {
      const step = command.steps[i];
      const result = await this.executeCommand(step);
      results.push(result);
      
      // Stop workflow if a step fails
      if (!result.success) {
        throw new Error(`Workflow step ${i + 1} failed: ${result.error?.message}`);
      }
    }
    
    return {
      steps: results,
      completed: true
    };
  }

  /**
   * Wait for an element to appear in the DOM
   */
  private async waitForElement(tabId: number, selector: string, timeout: number): Promise<boolean> {
    const waitFunction = (selector: string, timeoutMs: number) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkElement = () => {
          const element = document.querySelector(selector);
          
          if (element) {
            resolve(true);
            return;
          }
          
          if (Date.now() - startTime > timeoutMs) {
            reject(new Error(`Element not found within timeout: ${selector}`));
            return;
          }
          
          setTimeout(checkElement, 100);
        };
        
        checkElement();
      });
    };
    
    try {
      return await chromeApi.executeScript(tabId, waitFunction, [selector, timeout]);
    } catch (error) {
      throw new Error(`Failed to wait for element: ${error.message}`);
    }
  }
}

// Export singleton instance for convenience
