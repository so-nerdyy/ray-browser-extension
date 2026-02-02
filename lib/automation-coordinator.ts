/**
 * Automation coordinator for browser automation
 * Integrates all components and provides a unified interface
 */

import { AutomationCommand, AutomationResponse, AutomationOptions, WorkflowStep, WorkflowExecutionResult } from './automation-types';
import { browserAutomation } from './browser-automation';
import { workflowExecutor } from './workflow-executor';
import { tabManager } from './tab-manager';
import { stateTracker } from './state-tracker';
import { errorRecovery } from './error-recovery';
import { progressReporting } from './progress-reporting';
import { automationOptimization } from './automation-optimization';

export interface CoordinatorOptions extends AutomationOptions {
  enableOptimization?: boolean;
  enableProgressReporting?: boolean;
  enableErrorRecovery?: boolean;
  enableStateTracking?: boolean;
  enableTabManagement?: boolean;
  enableWorkflowExecution?: boolean;
}

export interface ExecutionStats {
  totalCommands: number;
  successfulCommands: number;
  failedCommands: number;
  totalDuration: number;
  averageDuration: number;
  memoryUsage: any;
  cacheStatistics: any;
}

export class AutomationCoordinator {
  private isInitialized = false;
  private defaultOptions: CoordinatorOptions = {
    enableOptimization: true,
    enableProgressReporting: true,
    enableErrorRecovery: true,
    enableStateTracking: true,
    enableTabManagement: true,
    enableWorkflowExecution: true,
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000
  };

  /**
   * Initialize the automation coordinator
   */
  async initialize(options: Partial<CoordinatorOptions> = {}): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.defaultOptions = { ...this.defaultOptions, ...options };

    try {
      // Initialize core automation
      await browserAutomation.initialize();

      // Initialize optimization if enabled
      if (this.defaultOptions.enableOptimization) {
        await automationOptimization.initialize();
      }

      // Initialize tab manager if enabled
      if (this.defaultOptions.enableTabManagement) {
        await tabManager.initialize();
      }

      // Initialize state tracker if enabled
      if (this.defaultOptions.enableStateTracking) {
        await stateTracker.initialize();
      }

      // Initialize error recovery if enabled
      if (this.defaultOptions.enableErrorRecovery) {
        await errorRecovery.initialize();
      }

      // Initialize progress reporting if enabled
      if (this.defaultOptions.enableProgressReporting) {
        await progressReporting.initialize();
      }

      // Initialize workflow executor if enabled
      if (this.defaultOptions.enableWorkflowExecution) {
        await workflowExecutor.initialize();
      }

      this.isInitialized = true;
      console.log('Automation coordinator initialized');
    } catch (error) {
      console.error('Failed to initialize automation coordinator:', error);
      throw error;
    }
  }

  /**
   * Execute a single automation command
   */
  async executeCommand(command: AutomationCommand, options?: Partial<AutomationOptions>): Promise<AutomationResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    let response: AutomationResponse;
    let success = false;

    try {
      // Report progress if enabled
      if (this.defaultOptions.enableProgressReporting) {
        progressReporting.reportProgress('command', 'started', {
          commandType: command.type,
          selector: command.selector,
          value: command.value
        });
      }

      // Check cache if optimization is enabled
      if (this.defaultOptions.enableOptimization) {
        const cacheKey = this.getCommandCacheKey(command);
        const cachedResult = automationOptimization.getCached(cacheKey);
        
        if (cachedResult) {
          response = cachedResult;
          success = true;
          
          // Report cache hit
          if (this.defaultOptions.enableProgressReporting) {
            progressReporting.reportProgress('command', 'cache_hit', {
              commandType: command.type,
              cacheKey
            });
          }
          
          return response;
        }
      }

      // Execute the command
      response = await browserAutomation.executeCommand(command, options);
      success = response.success;

      // Cache the result if optimization is enabled and command was successful
      if (this.defaultOptions.enableOptimization && success) {
        const cacheKey = this.getCommandCacheKey(command);
        automationOptimization.setCached(cacheKey, response);
      }

      // Update state if tracking is enabled
      if (this.defaultOptions.enableStateTracking && success) {
        await stateTracker.updateState(command, response);
      }

    } catch (error) {
      success = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Try error recovery if enabled
      if (this.defaultOptions.enableErrorRecovery) {
        const recoveryResult = await errorRecovery.attemptRecovery(command, error as Error);
        
        if (recoveryResult.success) {
          response = recoveryResult;
          success = true;
        } else {
          response = {
            success: false,
            error: `Command failed and recovery failed: ${errorMessage}`,
            timestamp: Date.now()
          };
        }
      } else {
        response = {
          success: false,
          error: errorMessage,
          timestamp: Date.now()
        };
      }
    } finally {
      const endTime = Date.now();
      
      // Record metrics if optimization is enabled
      if (this.defaultOptions.enableOptimization) {
        automationOptimization.recordMetrics(
          command.type,
          startTime,
          endTime,
          success,
          success ? undefined : new Error(response.error || 'Unknown error')
        );
      }

      // Report progress if enabled
      if (this.defaultOptions.enableProgressReporting) {
        progressReporting.reportProgress('command', success ? 'completed' : 'failed', {
          commandType: command.type,
          duration: endTime - startTime,
          success
        });
      }
    }

    return response;
  }

  /**
   * Execute multiple commands
   */
  async executeCommands(commands: AutomationCommand[], options?: Partial<AutomationOptions>): Promise<AutomationResponse[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const results: AutomationResponse[] = [];

    for (const command of commands) {
      const result = await this.executeCommand(command, options);
      results.push(result);
      
      // Stop execution if command failed and options don't specify continue on error
      if (!result.success && !options?.continueOnError) {
        break;
      }
    }

    return results;
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflowId: string, steps: WorkflowStep[], options?: Partial<AutomationOptions>): Promise<WorkflowExecutionResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.defaultOptions.enableWorkflowExecution) {
      return {
        success: false,
        workflowId,
        error: 'Workflow execution is disabled',
        executedSteps: [],
        timestamp: Date.now()
      };
    }

    try {
      // Report progress if enabled
      if (this.defaultOptions.enableProgressReporting) {
        progressReporting.reportProgress('workflow', 'started', {
          workflowId,
          stepCount: steps.length
        });
      }

      // Execute the workflow
      const result = await workflowExecutor.executeWorkflow(workflowId, steps, options);

      // Report progress if enabled
      if (this.defaultOptions.enableProgressReporting) {
        progressReporting.reportProgress('workflow', result.success ? 'completed' : 'failed', {
          workflowId,
          success: result.success,
          executedSteps: result.executedSteps.length
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Report progress if enabled
      if (this.defaultOptions.enableProgressReporting) {
        progressReporting.reportProgress('workflow', 'failed', {
          workflowId,
          error: errorMessage
        });
      }

      return {
        success: false,
        workflowId,
        error: errorMessage,
        executedSteps: [],
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): ExecutionStats {
    const optimizationStats = this.defaultOptions.enableOptimization 
      ? automationOptimization.getOptimizationStatistics()
      : null;

    const memoryUsage = this.defaultOptions.enableOptimization
      ? automationOptimization.getMemoryUsage()
      : null;

    return {
      totalCommands: 0, // This would be tracked in a real implementation
      successfulCommands: 0,
      failedCommands: 0,
      totalDuration: 0,
      averageDuration: 0,
      memoryUsage,
      cacheStatistics: optimizationStats?.cache
    };
  }

  /**
   * Get cache key for a command
   */
  private getCommandCacheKey(command: AutomationCommand): string {
    return `${command.type}_${command.selector || ''}_${command.value || ''}`;
  }

  /**
   * Create a new tab
   */
  async createTab(url?: string): Promise<number> {
    if (!this.defaultOptions.enableTabManagement) {
      throw new Error('Tab management is disabled');
    }

    return await tabManager.createTab(url);
  }

  /**
   * Switch to a tab
   */
  async switchToTab(tabId: number): Promise<void> {
    if (!this.defaultOptions.enableTabManagement) {
      throw new Error('Tab management is disabled');
    }

    await tabManager.switchToTab(tabId);
  }

  /**
   * Close a tab
   */
  async closeTab(tabId: number): Promise<void> {
    if (!this.defaultOptions.enableTabManagement) {
      throw new Error('Tab management is disabled');
    }

    await tabManager.closeTab(tabId);
  }

  /**
   * Get all tabs
   */
  async getAllTabs(): Promise<chrome.tabs.Tab[]> {
    if (!this.defaultOptions.enableTabManagement) {
      throw new Error('Tab management is disabled');
    }

    return await tabManager.getAllTabs();
  }

  /**
   * Get workflow state
   */
  async getWorkflowState(workflowId: string): Promise<any> {
    if (!this.defaultOptions.enableStateTracking) {
      throw new Error('State tracking is disabled');
    }

    return await stateTracker.getWorkflowState(workflowId);
  }

  /**
   * Set workflow state
   */
  async setWorkflowState(workflowId: string, state: any): Promise<void> {
    if (!this.defaultOptions.enableStateTracking) {
      throw new Error('State tracking is disabled');
    }

    await stateTracker.setWorkflowState(workflowId, state);
  }

  /**
   * Clear workflow state
   */
  async clearWorkflowState(workflowId: string): Promise<void> {
    if (!this.defaultOptions.enableStateTracking) {
      throw new Error('State tracking is disabled');
    }

    await stateTracker.clearWorkflowState(workflowId);
  }

  /**
   * Get progress information
   */
  getProgressInformation(): any {
    if (!this.defaultOptions.enableProgressReporting) {
      throw new Error('Progress reporting is disabled');
    }

    return progressReporting.getProgressInformation();
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStatistics(): any {
    if (!this.defaultOptions.enableOptimization) {
      throw new Error('Optimization is disabled');
    }

    return automationOptimization.getOptimizationStatistics();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    if (!this.defaultOptions.enableOptimization) {
      throw new Error('Optimization is disabled');
    }

    automationOptimization.clearCache();
  }

  /**
   * Get error recovery strategies
   */
  getErrorRecoveryStrategies(): any {
    if (!this.defaultOptions.enableErrorRecovery) {
      throw new Error('Error recovery is disabled');
    }

    return errorRecovery.getRecoveryStrategies();
  }

  /**
   * Set coordinator options
   */
  setOptions(options: Partial<CoordinatorOptions>): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  /**
   * Get coordinator options
   */
  getOptions(): CoordinatorOptions {
    return { ...this.defaultOptions };
  }

  /**
   * Check if coordinator is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Reset the coordinator
   */
  async reset(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // Cleanup components
      if (this.defaultOptions.enableOptimization) {
        await automationOptimization.cleanup();
      }

      if (this.defaultOptions.enableTabManagement) {
        await tabManager.cleanup();
      }

      if (this.defaultOptions.enableStateTracking) {
        await stateTracker.cleanup();
      }

      if (this.defaultOptions.enableErrorRecovery) {
        await errorRecovery.cleanup();
      }

      if (this.defaultOptions.enableProgressReporting) {
        await progressReporting.cleanup();
      }

      if (this.defaultOptions.enableWorkflowExecution) {
        await workflowExecutor.cleanup();
      }

      // Reset core automation
      await browserAutomation.cleanup();

      this.isInitialized = false;
      console.log('Automation coordinator reset');
    } catch (error) {
      console.error('Failed to reset automation coordinator:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.reset();
  }
}

// Export singleton instance for convenience
export const automationCoordinator = new AutomationCoordinator(); * Automation coordinator for browser automation
 * Integrates all components and provides a unified interface
 */

import { AutomationCommand, AutomationResponse, AutomationOptions, WorkflowStep, WorkflowExecutionResult } from './automation-types';
import { browserAutomation } from './browser-automation';
import { workflowExecutor } from './workflow-executor';
import { tabManager } from './tab-manager';
import { stateTracker } from './state-tracker';
import { errorRecovery } from './error-recovery';
import { progressReporting } from './progress-reporting';
import { automationOptimization } from './automation-optimization';

export interface CoordinatorOptions extends AutomationOptions {
  enableOptimization?: boolean;
  enableProgressReporting?: boolean;
  enableErrorRecovery?: boolean;
  enableStateTracking?: boolean;
  enableTabManagement?: boolean;
  enableWorkflowExecution?: boolean;
}

export interface ExecutionStats {
  totalCommands: number;
  successfulCommands: number;
  failedCommands: number;
  totalDuration: number;
  averageDuration: number;
  memoryUsage: any;
  cacheStatistics: any;
}

export class AutomationCoordinator {
  private isInitialized = false;
  private defaultOptions: CoordinatorOptions = {
    enableOptimization: true,
    enableProgressReporting: true,
    enableErrorRecovery: true,
    enableStateTracking: true,
    enableTabManagement: true,
    enableWorkflowExecution: true,
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000
  };

  /**
   * Initialize the automation coordinator
   */
  async initialize(options: Partial<CoordinatorOptions> = {}): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.defaultOptions = { ...this.defaultOptions, ...options };

    try {
      // Initialize core automation
      await browserAutomation.initialize();

      // Initialize optimization if enabled
      if (this.defaultOptions.enableOptimization) {
        await automationOptimization.initialize();
      }

      // Initialize tab manager if enabled
      if (this.defaultOptions.enableTabManagement) {
        await tabManager.initialize();
      }

      // Initialize state tracker if enabled
      if (this.defaultOptions.enableStateTracking) {
        await stateTracker.initialize();
      }

      // Initialize error recovery if enabled
      if (this.defaultOptions.enableErrorRecovery) {
        await errorRecovery.initialize();
      }

      // Initialize progress reporting if enabled
      if (this.defaultOptions.enableProgressReporting) {
        await progressReporting.initialize();
      }

      // Initialize workflow executor if enabled
      if (this.defaultOptions.enableWorkflowExecution) {
        await workflowExecutor.initialize();
      }

      this.isInitialized = true;
      console.log('Automation coordinator initialized');
    } catch (error) {
      console.error('Failed to initialize automation coordinator:', error);
      throw error;
    }
  }

  /**
   * Execute a single automation command
   */
  async executeCommand(command: AutomationCommand, options?: Partial<AutomationOptions>): Promise<AutomationResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    let response: AutomationResponse;
    let success = false;

    try {
      // Report progress if enabled
      if (this.defaultOptions.enableProgressReporting) {
        progressReporting.reportProgress('command', 'started', {
          commandType: command.type,
          selector: command.selector,
          value: command.value
        });
      }

      // Check cache if optimization is enabled
      if (this.defaultOptions.enableOptimization) {
        const cacheKey = this.getCommandCacheKey(command);
        const cachedResult = automationOptimization.getCached(cacheKey);
        
        if (cachedResult) {
          response = cachedResult;
          success = true;
          
          // Report cache hit
          if (this.defaultOptions.enableProgressReporting) {
            progressReporting.reportProgress('command', 'cache_hit', {
              commandType: command.type,
              cacheKey
            });
          }
          
          return response;
        }
      }

      // Execute the command
      response = await browserAutomation.executeCommand(command, options);
      success = response.success;

      // Cache the result if optimization is enabled and command was successful
      if (this.defaultOptions.enableOptimization && success) {
        const cacheKey = this.getCommandCacheKey(command);
        automationOptimization.setCached(cacheKey, response);
      }

      // Update state if tracking is enabled
      if (this.defaultOptions.enableStateTracking && success) {
        await stateTracker.updateState(command, response);
      }

    } catch (error) {
      success = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Try error recovery if enabled
      if (this.defaultOptions.enableErrorRecovery) {
        const recoveryResult = await errorRecovery.attemptRecovery(command, error as Error);
        
        if (recoveryResult.success) {
          response = recoveryResult;
          success = true;
        } else {
          response = {
            success: false,
            error: `Command failed and recovery failed: ${errorMessage}`,
            timestamp: Date.now()
          };
        }
      } else {
        response = {
          success: false,
          error: errorMessage,
          timestamp: Date.now()
        };
      }
    } finally {
      const endTime = Date.now();
      
      // Record metrics if optimization is enabled
      if (this.defaultOptions.enableOptimization) {
        automationOptimization.recordMetrics(
          command.type,
          startTime,
          endTime,
          success,
          success ? undefined : new Error(response.error || 'Unknown error')
        );
      }

      // Report progress if enabled
      if (this.defaultOptions.enableProgressReporting) {
        progressReporting.reportProgress('command', success ? 'completed' : 'failed', {
          commandType: command.type,
          duration: endTime - startTime,
          success
        });
      }
    }

    return response;
  }

  /**
   * Execute multiple commands
   */
  async executeCommands(commands: AutomationCommand[], options?: Partial<AutomationOptions>): Promise<AutomationResponse[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const results: AutomationResponse[] = [];

    for (const command of commands) {
      const result = await this.executeCommand(command, options);
      results.push(result);
      
      // Stop execution if command failed and options don't specify continue on error
      if (!result.success && !options?.continueOnError) {
        break;
      }
    }

    return results;
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflowId: string, steps: WorkflowStep[], options?: Partial<AutomationOptions>): Promise<WorkflowExecutionResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.defaultOptions.enableWorkflowExecution) {
      return {
        success: false,
        workflowId,
        error: 'Workflow execution is disabled',
        executedSteps: [],
        timestamp: Date.now()
      };
    }

    try {
      // Report progress if enabled
      if (this.defaultOptions.enableProgressReporting) {
        progressReporting.reportProgress('workflow', 'started', {
          workflowId,
          stepCount: steps.length
        });
      }

      // Execute the workflow
      const result = await workflowExecutor.executeWorkflow(workflowId, steps, options);

      // Report progress if enabled
      if (this.defaultOptions.enableProgressReporting) {
        progressReporting.reportProgress('workflow', result.success ? 'completed' : 'failed', {
          workflowId,
          success: result.success,
          executedSteps: result.executedSteps.length
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Report progress if enabled
      if (this.defaultOptions.enableProgressReporting) {
        progressReporting.reportProgress('workflow', 'failed', {
          workflowId,
          error: errorMessage
        });
      }

      return {
        success: false,
        workflowId,
        error: errorMessage,
        executedSteps: [],
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): ExecutionStats {
    const optimizationStats = this.defaultOptions.enableOptimization 
      ? automationOptimization.getOptimizationStatistics()
      : null;

    const memoryUsage = this.defaultOptions.enableOptimization
      ? automationOptimization.getMemoryUsage()
      : null;

    return {
      totalCommands: 0, // This would be tracked in a real implementation
      successfulCommands: 0,
      failedCommands: 0,
      totalDuration: 0,
      averageDuration: 0,
      memoryUsage,
      cacheStatistics: optimizationStats?.cache
    };
  }

  /**
   * Get cache key for a command
   */
  private getCommandCacheKey(command: AutomationCommand): string {
    return `${command.type}_${command.selector || ''}_${command.value || ''}`;
  }

  /**
   * Create a new tab
   */
  async createTab(url?: string): Promise<number> {
    if (!this.defaultOptions.enableTabManagement) {
      throw new Error('Tab management is disabled');
    }

    return await tabManager.createTab(url);
  }

  /**
   * Switch to a tab
   */
  async switchToTab(tabId: number): Promise<void> {
    if (!this.defaultOptions.enableTabManagement) {
      throw new Error('Tab management is disabled');
    }

    await tabManager.switchToTab(tabId);
  }

  /**
   * Close a tab
   */
  async closeTab(tabId: number): Promise<void> {
    if (!this.defaultOptions.enableTabManagement) {
      throw new Error('Tab management is disabled');
    }

    await tabManager.closeTab(tabId);
  }

  /**
   * Get all tabs
   */
  async getAllTabs(): Promise<chrome.tabs.Tab[]> {
    if (!this.defaultOptions.enableTabManagement) {
      throw new Error('Tab management is disabled');
    }

    return await tabManager.getAllTabs();
  }

  /**
   * Get workflow state
   */
  async getWorkflowState(workflowId: string): Promise<any> {
    if (!this.defaultOptions.enableStateTracking) {
      throw new Error('State tracking is disabled');
    }

    return await stateTracker.getWorkflowState(workflowId);
  }

  /**
   * Set workflow state
   */
  async setWorkflowState(workflowId: string, state: any): Promise<void> {
    if (!this.defaultOptions.enableStateTracking) {
      throw new Error('State tracking is disabled');
    }

    await stateTracker.setWorkflowState(workflowId, state);
  }

  /**
   * Clear workflow state
   */
  async clearWorkflowState(workflowId: string): Promise<void> {
    if (!this.defaultOptions.enableStateTracking) {
      throw new Error('State tracking is disabled');
    }

    await stateTracker.clearWorkflowState(workflowId);
  }

  /**
   * Get progress information
   */
  getProgressInformation(): any {
    if (!this.defaultOptions.enableProgressReporting) {
      throw new Error('Progress reporting is disabled');
    }

    return progressReporting.getProgressInformation();
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStatistics(): any {
    if (!this.defaultOptions.enableOptimization) {
      throw new Error('Optimization is disabled');
    }

    return automationOptimization.getOptimizationStatistics();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    if (!this.defaultOptions.enableOptimization) {
      throw new Error('Optimization is disabled');
    }

    automationOptimization.clearCache();
  }

  /**
   * Get error recovery strategies
   */
  getErrorRecoveryStrategies(): any {
    if (!this.defaultOptions.enableErrorRecovery) {
      throw new Error('Error recovery is disabled');
    }

    return errorRecovery.getRecoveryStrategies();
  }

  /**
   * Set coordinator options
   */
  setOptions(options: Partial<CoordinatorOptions>): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  /**
   * Get coordinator options
   */
  getOptions(): CoordinatorOptions {
    return { ...this.defaultOptions };
  }

  /**
   * Check if coordinator is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Reset the coordinator
   */
  async reset(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // Cleanup components
      if (this.defaultOptions.enableOptimization) {
        await automationOptimization.cleanup();
      }

      if (this.defaultOptions.enableTabManagement) {
        await tabManager.cleanup();
      }

      if (this.defaultOptions.enableStateTracking) {
        await stateTracker.cleanup();
      }

      if (this.defaultOptions.enableErrorRecovery) {
        await errorRecovery.cleanup();
      }

      if (this.defaultOptions.enableProgressReporting) {
        await progressReporting.cleanup();
      }

      if (this.defaultOptions.enableWorkflowExecution) {
        await workflowExecutor.cleanup();
      }

      // Reset core automation
      await browserAutomation.cleanup();

      this.isInitialized = false;
      console.log('Automation coordinator reset');
    } catch (error) {
      console.error('Failed to reset automation coordinator:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.reset();
  }
}

// Export singleton instance for convenience
export const automationCoordinator = new AutomationCoordinator();
