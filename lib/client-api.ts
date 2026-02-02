/**
 * Client API for the Ray Browser Extension
 * Provides a simple interface for other agents to interact with the browser automation engine
 */

import { AutomationCommand, AutomationResponse, WorkflowStep, WorkflowExecutionResult } from './automation-types';

export interface ClientOptions {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export class RayBrowserClient {
  private isExtensionContext: boolean;
  private defaultOptions: ClientOptions = {
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000
  };

  constructor(options: Partial<ClientOptions> = {}) {
    this.defaultOptions = { ...this.defaultOptions, ...options };
    this.isExtensionContext = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
  }

  /**
   * Execute a single automation command
   */
  async executeCommand(command: AutomationCommand, options?: Partial<ClientOptions>): Promise<AutomationResponse> {
    const opts = { ...this.defaultOptions, ...options };
    
    if (this.isExtensionContext) {
      return this.executeCommandInExtension(command, opts);
    } else {
      throw new Error('Ray Browser Client must be used within a Chrome Extension context');
    }
  }

  /**
   * Execute multiple automation commands
   */
  async executeCommands(commands: AutomationCommand[], options?: Partial<ClientOptions>): Promise<AutomationResponse[]> {
    const opts = { ...this.defaultOptions, ...options };
    
    if (this.isExtensionContext) {
      return this.executeCommandsInExtension(commands, opts);
    } else {
      throw new Error('Ray Browser Client must be used within a Chrome Extension context');
    }
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflowId: string, steps: WorkflowStep[], options?: Partial<ClientOptions>): Promise<WorkflowExecutionResult> {
    const opts = { ...this.defaultOptions, ...options };
    
    if (this.isExtensionContext) {
      return this.executeWorkflowInExtension(workflowId, steps, opts);
    } else {
      throw new Error('Ray Browser Client must be used within a Chrome Extension context');
    }
  }

  /**
   * Create a new tab
   */
  async createTab(url?: string): Promise<number> {
    if (this.isExtensionContext) {
      return this.createTabInExtension(url);
    } else {
      throw new Error('Ray Browser Client must be used within a Chrome Extension context');
    }
  }

  /**
   * Switch to a tab
   */
  async switchToTab(tabId: number): Promise<void> {
    if (this.isExtensionContext) {
      return this.switchToTabInExtension(tabId);
    } else {
      throw new Error('Ray Browser Client must be used within a Chrome Extension context');
    }
  }

  /**
   * Close a tab
   */
  async closeTab(tabId: number): Promise<void> {
    if (this.isExtensionContext) {
      return this.closeTabInExtension(tabId);
    } else {
      throw new Error('Ray Browser Client must be used within a Chrome Extension context');
    }
  }

  /**
   * Get all tabs
   */
  async getAllTabs(): Promise<chrome.tabs.Tab[]> {
    if (this.isExtensionContext) {
      return this.getAllTabsInExtension();
    } else {
      throw new Error('Ray Browser Client must be used within a Chrome Extension context');
    }
  }

  /**
   * Get workflow state
   */
  async getWorkflowState(workflowId: string): Promise<any> {
    if (this.isExtensionContext) {
      return this.getWorkflowStateInExtension(workflowId);
    } else {
      throw new Error('Ray Browser Client must be used within a Chrome Extension context');
    }
  }

  /**
   * Set workflow state
   */
  async setWorkflowState(workflowId: string, state: any): Promise<void> {
    if (this.isExtensionContext) {
      return this.setWorkflowStateInExtension(workflowId, state);
    } else {
      throw new Error('Ray Browser Client must be used within a Chrome Extension context');
    }
  }

  /**
   * Clear workflow state
   */
  async clearWorkflowState(workflowId: string): Promise<void> {
    if (this.isExtensionContext) {
      return this.clearWorkflowStateInExtension(workflowId);
    } else {
      throw new Error('Ray Browser Client must be used within a Chrome Extension context');
    }
  }

  /**
   * Get progress information
   */
  async getProgressInformation(): Promise<any> {
    if (this.isExtensionContext) {
      return this.getProgressInformationInExtension();
    } else {
      throw new Error('Ray Browser Client must be used within a Chrome Extension context');
    }
  }

  /**
   * Get optimization statistics
   */
  async getOptimizationStatistics(): Promise<any> {
    if (this.isExtensionContext) {
      return this.getOptimizationStatisticsInExtension();
    } else {
      throw new Error('Ray Browser Client must be used within a Chrome Extension context');
    }
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    if (this.isExtensionContext) {
      return this.clearCacheInExtension();
    } else {
      throw new Error('Ray Browser Client must be used within a Chrome Extension context');
    }
  }

  /**
   * Get error recovery strategies
   */
  async getErrorRecoveryStrategies(): Promise<any> {
    if (this.isExtensionContext) {
      return this.getErrorRecoveryStrategiesInExtension();
    } else {
      throw new Error('Ray Browser Client must be used within a Chrome Extension context');
    }
  }

  /**
   * Get execution stats
   */
  async getExecutionStats(): Promise<any> {
    if (this.isExtensionContext) {
      return this.getExecutionStatsInExtension();
    } else {
      throw new Error('Ray Browser Client must be used within a Chrome Extension context');
    }
  }

  /**
   * Reset the automation engine
   */
  async reset(): Promise<void> {
    if (this.isExtensionContext) {
      return this.resetInExtension();
    } else {
      throw new Error('Ray Browser Client must be used within a Chrome Extension context');
    }
  }

  /**
   * Check if the client is ready
   */
  isReady(): boolean {
    return this.isExtensionContext;
  }

  // Private methods for extension context

  /**
   * Execute a command in extension context
   */
  private async executeCommandInExtension(command: AutomationCommand, options: ClientOptions): Promise<AutomationResponse> {
    const messageId = this.generateMessageId();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Command execution timed out after ${options.timeout}ms`));
      }, options.timeout);

      chrome.runtime.sendMessage(
        {
          type: 'executeCommand',
          id: messageId,
          data: command
        },
        (response) => {
          clearTimeout(timeout);
          
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response && response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || 'Unknown error'));
          }
        }
      );
    });
  }

  /**
   * Execute commands in extension context
   */
  private async executeCommandsInExtension(commands: AutomationCommand[], options: ClientOptions): Promise<AutomationResponse[]> {
    const messageId = this.generateMessageId();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Commands execution timed out after ${options.timeout}ms`));
      }, options.timeout);

      chrome.runtime.sendMessage(
        {
          type: 'executeCommands',
          id: messageId,
          data: commands
        },
        (response) => {
          clearTimeout(timeout);
          
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response && response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || 'Unknown error'));
          }
        }
      );
    });
  }

  /**
   * Execute workflow in extension context
   */
  private async executeWorkflowInExtension(workflowId: string, steps: WorkflowStep[], options: ClientOptions): Promise<WorkflowExecutionResult> {
    const messageId = this.generateMessageId();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Workflow execution timed out after ${options.timeout}ms`));
      }, options.timeout);

      chrome.runtime.sendMessage(
        {
          type: 'executeWorkflow',
          id: messageId,
          data: { workflowId, steps }
        },
        (response) => {
          clearTimeout(timeout);
          
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response && response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || 'Unknown error'));
          }
        }
      );
    });
  }

  /**
   * Create tab in extension context
   */
  private async createTabInExtension(url?: string): Promise<number> {
    const messageId = this.generateMessageId();
    
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'createTab',
          id: messageId,
          data: { url }
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response && response.success) {
            resolve(response.data.tabId);
          } else {
            reject(new Error(response?.error || 'Unknown error'));
          }
        }
      );
    });
  }

  /**
   * Switch to tab in extension context
   */
  private async switchToTabInExtension(tabId: number): Promise<void> {
    const messageId = this.generateMessageId();
    
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'switchToTab',
          id: messageId,
          data: { tabId }
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response && response.success) {
            resolve();
          } else {
            reject(new Error(response?.error || 'Unknown error'));
          }
        }
      );
    });
  }

  /**
   * Close tab in extension context
   */
  private async closeTabInExtension(tabId: number): Promise<void> {
    const messageId = this.generateMessageId();
    
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'closeTab',
          id: messageId,
          data: { tabId }
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response && response.success) {
            resolve();
          } else {
            reject(new Error(response?.error || 'Unknown error'));
          }
        }
      );
    });
  }

  /**
   * Get all tabs in extension context
   */
  private async getAllTabsInExtension(): Promise<chrome.tabs.Tab[]> {
    const messageId = this.generateMessageId();
    
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'getAllTabs',
          id: messageId
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response && response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || 'Unknown error'));
          }
        }
      );
    });
  }

  /**
   * Get workflow state in extension context
   */
  private async getWorkflowStateInExtension(workflowId: string): Promise<any> {
    const messageId = this.generateMessageId();
    
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'getWorkflowState',
          id: messageId,
          data: { workflowId }
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response && response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || 'Unknown error'));
          }
        }
      );
    });
  }

  /**
   * Set workflow state in extension context
   */
  private async setWorkflowStateInExtension(workflowId: string, state: any): Promise<void> {
    const messageId = this.generateMessageId();
    
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'setWorkflowState',
          id: messageId,
          data: { workflowId, state }
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response && response.success) {
            resolve();
          } else {
            reject(new Error(response?.error || 'Unknown error'));
          }
        }
      );
    });
  }

  /**
   * Clear workflow state in extension context
   */
  private async clearWorkflowStateInExtension(workflowId: string): Promise<void> {
    const messageId = this.generateMessageId();
    
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'clearWorkflowState',
          id: messageId,
          data: { workflowId }
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response && response.success) {
            resolve();
          } else {
            reject(new Error(response?.error || 'Unknown error'));
          }
        }
      );
    });
  }

  /**
   * Get progress information in extension context
   */
  private async getProgressInformationInExtension(): Promise<any> {
    const messageId = this.generateMessageId();
    
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'getProgressInformation',
          id: messageId
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response && response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || 'Unknown error'));
          }
        }
      );
    });
  }

  /**
   * Get optimization statistics in extension context
   */
  private async getOptimizationStatisticsInExtension(): Promise<any> {
    const messageId = this.generateMessageId();
    
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'getOptimizationStatistics',
          id: messageId
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response && response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || 'Unknown error'));
          }
        }
      );
    });
  }

  /**
   * Clear cache in extension context
   */
  private async clearCacheInExtension(): Promise<void> {
    const messageId = this.generateMessageId();
    
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'clearCache',
          id: messageId
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response && response.success) {
            resolve();
          } else {
            reject(new Error(response?.error || 'Unknown error'));
          }
        }
      );
    });
  }

  /**
   * Get error recovery strategies in extension context
   */
  private async getErrorRecoveryStrategiesInExtension(): Promise<any> {
    const messageId = this.generateMessageId();
    
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'getErrorRecoveryStrategies',
          id: messageId
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response && response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || 'Unknown error'));
          }
        }
      );
    });
  }

  /**
   * Get execution stats in extension context
   */
  private async getExecutionStatsInExtension(): Promise<any> {
    const messageId = this.generateMessageId();
    
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'getExecutionStats',
          id: messageId
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response && response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || 'Unknown error'));
          }
        }
      );
    });
  }

  /**
   * Reset in extension context
   */
  private async resetInExtension(): Promise<void> {
    const messageId = this.generateMessageId();
    
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'reset',
          id: messageId
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response && response.success) {
            resolve();
          } else {
            reject(new Error(response?.error || 'Unknown error'));
          }
        }
      );
    });
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance for convenience
