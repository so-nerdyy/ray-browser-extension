/**
 * Workflow executor for multi-step automation
 * Coordinates execution of complex automation workflows
 */

import { 
  AnyAutomationCommand, 
  WorkflowCommand, 
  AutomationResponse, 
  WorkflowState 
} from './automation-types';
import { browserAutomation } from './browser-automation';
import { tabManager } from './tab-manager';
import { stateTracker } from './state-tracker';
import { errorRecovery } from './error-recovery';
import { progressReporting } from './progress-reporting';

export interface WorkflowOptions {
  continueOnError?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  pauseOnStep?: boolean;
  reportProgress?: boolean;
}

export interface WorkflowStep {
  command: AnyAutomationCommand;
  condition?: () => boolean;
  retryCount?: number;
  maxRetries?: number;
  timeout?: number;
  skipOnFailure?: boolean;
}

export interface WorkflowContext {
  variables: Record<string, any>;
  previousResults: AutomationResponse[];
  currentStep: number;
  totalSteps: number;
  startTime: number;
  workflowId: string;
}

export class WorkflowExecutor {
  private activeWorkflows: Map<string, WorkflowState> = new Map();
  private workflowQueue: WorkflowCommand[] = [];
  private maxConcurrentWorkflows = 5;
  private isExecuting = false;

  /**
   * Execute a workflow command
   */
  async executeWorkflow(workflow: WorkflowCommand, options: WorkflowOptions = {}): Promise<AutomationResponse> {
    const workflowId = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Check if we can start a new workflow
      if (this.activeWorkflows.size >= this.maxConcurrentWorkflows) {
        throw new Error(`Maximum concurrent workflows (${this.maxConcurrentWorkflows}) reached`);
      }
      
      // Create workflow state
      const workflowState: WorkflowState = {
        id: workflowId,
        name: workflow.name,
        currentStep: 0,
        totalSteps: workflow.steps.length,
        status: 'running',
        startTime: Date.now(),
        context: workflow.context || {},
        results: []
      };
      
      this.activeWorkflows.set(workflowId, workflowState);
      
      // Initialize state tracker
      await stateTracker.initializeWorkflow(workflowId, workflow.context || {});
      
      // Report start
      if (options.reportProgress !== false) {
        await progressReporting.reportWorkflowStart(workflowId, workflow.name, workflow.steps.length);
      }
      
      // Execute workflow steps
      const results = await this.executeWorkflowSteps(workflow.steps, workflowId, options);
      
      // Update workflow state
      workflowState.status = 'completed';
      workflowState.endTime = Date.now();
      workflowState.results = results;
      
      // Report completion
      if (options.reportProgress !== false) {
        await progressReporting.reportWorkflowComplete(workflowId, results);
      }
      
      return {
        commandId: workflow.id,
        success: true,
        timestamp: Date.now(),
        data: {
          workflowId,
          results,
          duration: Date.now() - workflowState.startTime
        }
      };
      
    } catch (error) {
      // Update workflow state
      const workflowState = this.activeWorkflows.get(workflowId);
      if (workflowState) {
        workflowState.status = 'failed';
        workflowState.endTime = Date.now();
      }
      
      // Report error
      if (options.reportProgress !== false) {
        await progressReporting.reportWorkflowError(workflowId, error.message);
      }
      
      return {
        commandId: workflow.id,
        success: false,
        timestamp: Date.now(),
        error: {
          code: 'WORKFLOW_EXECUTION_FAILED',
          message: error.message,
          details: error
        }
      };
    } finally {
      // Clean up
      if (this.activeWorkflows.has(workflowId)) {
        this.activeWorkflows.delete(workflowId);
        await stateTracker.cleanupWorkflow(workflowId);
      }
    }
  }

  /**
   * Execute workflow steps
   */
  private async executeWorkflowSteps(
    steps: AnyAutomationCommand[], 
    workflowId: string, 
    options: WorkflowOptions
  ): Promise<AutomationResponse[]> {
    const results: AutomationResponse[] = [];
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepNumber = i + 1;
      
      try {
        // Update workflow state
        const workflowState = this.activeWorkflows.get(workflowId);
        if (workflowState) {
          workflowState.currentStep = stepNumber;
        }
        
        // Update state tracker
        await stateTracker.updateStep(workflowId, stepNumber, step);
        
        // Report step start
        if (options.reportProgress !== false) {
          await progressReporting.reportStepStart(workflowId, stepNumber, step.type);
        }
        
        // Check step condition if provided
        if (step.condition && !step.condition()) {
          console.log(`Skipping step ${stepNumber} due to condition`);
          continue;
        }
        
        // Execute step with timeout
        const stepTimeout = step.timeout || options.timeout || 30000;
        const result = await this.executeStepWithTimeout(step, stepTimeout, workflowId);
        
        results.push(result);
        
        // Update context with step result
        await stateTracker.updateContext(workflowId, `step_${stepNumber}_result`, result);
        
        // Report step completion
        if (options.reportProgress !== false) {
          await progressReporting.reportStepComplete(workflowId, stepNumber, result);
        }
        
        // Handle step failure
        if (!result.success) {
          if (options.continueOnError || step.skipOnFailure) {
            console.warn(`Step ${stepNumber} failed but continuing:`, result.error);
            continue;
          } else {
            throw new Error(`Step ${stepNumber} failed: ${result.error?.message}`);
          }
        }
        
        // Pause between steps if requested
        if (options.pauseOnStep) {
          await this.pauseForUserInput(workflowId, stepNumber);
        }
        
      } catch (error) {
        const errorResult: AutomationResponse = {
          commandId: step.id,
          success: false,
          timestamp: Date.now(),
          error: {
            code: 'STEP_EXECUTION_FAILED',
            message: error.message,
            details: error
          }
        };
        
        results.push(errorResult);
        
        // Report step error
        if (options.reportProgress !== false) {
          await progressReporting.reportStepError(workflowId, stepNumber, error.message);
        }
        
        // Attempt error recovery
        const recovered = await errorRecovery.attemptRecovery(workflowId, stepNumber, error, options);
        
        if (recovered) {
          console.log(`Recovered from error in step ${stepNumber}`);
          continue;
        } else {
          throw error;
        }
      }
    }
    
    return results;
  }

  /**
   * Execute a step with timeout
   */
  private async executeStepWithTimeout(
    step: AnyAutomationCommand, 
    timeout: number, 
    workflowId: string
  ): Promise<AutomationResponse> {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Step timed out after ${timeout}ms`));
      }, timeout);
      
      try {
        const result = await browserAutomation.executeCommand(step);
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Pause workflow for user input
   */
  private async pauseForUserInput(workflowId: string, stepNumber: number): Promise<void> {
    return new Promise((resolve) => {
      // Create a simple modal to pause execution
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border: 1px solid black;
        border-radius: 5px;
        z-index: 10000;
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
      `;
      
      modal.innerHTML = `
        <h3>Workflow Paused</h3>
        <p>Step ${stepNumber} completed. Click Continue to proceed.</p>
        <button id="continue-btn">Continue</button>
      `;
      
      document.body.appendChild(modal);
      
      const continueBtn = document.getElementById('continue-btn');
      continueBtn?.addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve();
      });
    });
  }

  /**
   * Cancel a running workflow
   */
  async cancelWorkflow(workflowId: string): Promise<boolean> {
    const workflowState = this.activeWorkflows.get(workflowId);
    
    if (!workflowState) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    
    if (workflowState.status === 'completed' || workflowState.status === 'failed') {
      throw new Error(`Workflow already finished: ${workflowState.status}`);
    }
    
    // Update workflow state
    workflowState.status = 'cancelled';
    workflowState.endTime = Date.now();
    
    // Report cancellation
    await progressReporting.reportWorkflowCancelled(workflowId);
    
    // Clean up
    this.activeWorkflows.delete(workflowId);
    await stateTracker.cleanupWorkflow(workflowId);
    
    return true;
  }

  /**
   * Get workflow state
   */
  getWorkflowState(workflowId: string): WorkflowState | undefined {
    return this.activeWorkflows.get(workflowId);
  }

  /**
   * Get all active workflows
   */
  getActiveWorkflows(): WorkflowState[] {
    return Array.from(this.activeWorkflows.values());
  }

  /**
   * Set maximum concurrent workflows
   */
  setMaxConcurrentWorkflows(max: number): void {
    this.maxConcurrentWorkflows = max;
  }

  /**
   * Queue a workflow for execution
   */
  queueWorkflow(workflow: WorkflowCommand): void {
    this.workflowQueue.push(workflow);
    
    // Start processing queue if not already running
    if (!this.isExecuting) {
      this.processQueue();
    }
  }

  /**
   * Process workflow queue
   */
  private async processQueue(): Promise<void> {
    if (this.isExecuting || this.workflowQueue.length === 0) {
      return;
    }
    
    this.isExecuting = true;
    
    try {
      while (this.workflowQueue.length > 0 && this.activeWorkflows.size < this.maxConcurrentWorkflows) {
        const workflow = this.workflowQueue.shift()!;
        
        // Execute workflow in background
        this.executeWorkflow(workflow).catch(error => {
          console.error('Queued workflow failed:', error);
        });
      }
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Create a workflow from steps
   */
  createWorkflow(name: string, steps: AnyAutomationCommand[], context?: Record<string, any>): WorkflowCommand {
    return {
      id: `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'workflow',
      name,
      steps,
      context,
      timestamp: Date.now()
    };
  }

  /**
   * Add conditional step to workflow
   */
  addConditionalStep(
    workflow: WorkflowCommand, 
    command: AnyAutomationCommand, 
    condition: () => boolean
  ): WorkflowCommand {
    const conditionalStep = {
      ...command,
      condition
    } as WorkflowStep;
    
    return {
      ...workflow,
      steps: [...workflow.steps, conditionalStep as any]
    };
  }

  /**
   * Add retry logic to workflow step
   */
  addRetryLogic(
    workflow: WorkflowCommand, 
    command: AnyAutomationCommand, 
    maxRetries: number = 3
  ): WorkflowCommand {
    const retryStep = {
      ...command,
      maxRetries,
      retryCount: 0
    } as WorkflowStep;
    
    return {
      ...workflow,
      steps: [...workflow.steps, retryStep as any]
    };
  }

  /**
   * Create a parallel workflow step
   */
  async executeParallelSteps(steps: AnyAutomationCommand[]): Promise<AutomationResponse[]> {
    const promises = steps.map(step => browserAutomation.executeCommand(step));
    return Promise.all(promises);
  }

  /**
   * Create a conditional workflow
   */
  createConditionalWorkflow(
    condition: () => boolean,
    trueSteps: AnyAutomationCommand[],
    falseSteps: AnyAutomationCommand[] = []
  ): WorkflowCommand {
    const steps = condition() ? trueSteps : falseSteps;
    
    return this.createWorkflow('Conditional Workflow', steps);
  }

  /**
   * Create a loop workflow
   */
  createLoopWorkflow(
    steps: AnyAutomationCommand[],
    iterations: number,
    context?: Record<string, any>
  ): WorkflowCommand {
    const loopSteps: AnyAutomationCommand[] = [];
    
    for (let i = 0; i < iterations; i++) {
      loopSteps.push(...steps);
    }
    
    return this.createWorkflow('Loop Workflow', loopSteps, context);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Cancel all active workflows
    const activeWorkflows = Array.from(this.activeWorkflows.keys());
    
    for (const workflowId of activeWorkflows) {
      try {
        await this.cancelWorkflow(workflowId);
      } catch (error) {
        console.error(`Failed to cancel workflow ${workflowId}:`, error);
      }
    }
    
    // Clear queue
    this.workflowQueue = [];
    
    // Clean up state tracker
    await stateTracker.cleanup();
  }
}

// Export singleton instance for convenience
export const workflowExecutor = new WorkflowExecutor(); * Workflow executor for multi-step automation
 * Coordinates execution of complex automation workflows
 */

import { 
  AnyAutomationCommand, 
  WorkflowCommand, 
  AutomationResponse, 
  WorkflowState 
} from './automation-types';
import { browserAutomation } from './browser-automation';
import { tabManager } from './tab-manager';
import { stateTracker } from './state-tracker';
import { errorRecovery } from './error-recovery';
import { progressReporting } from './progress-reporting';

export interface WorkflowOptions {
  continueOnError?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  pauseOnStep?: boolean;
  reportProgress?: boolean;
}

export interface WorkflowStep {
  command: AnyAutomationCommand;
  condition?: () => boolean;
  retryCount?: number;
  maxRetries?: number;
  timeout?: number;
  skipOnFailure?: boolean;
}

export interface WorkflowContext {
  variables: Record<string, any>;
  previousResults: AutomationResponse[];
  currentStep: number;
  totalSteps: number;
  startTime: number;
  workflowId: string;
}

export class WorkflowExecutor {
  private activeWorkflows: Map<string, WorkflowState> = new Map();
  private workflowQueue: WorkflowCommand[] = [];
  private maxConcurrentWorkflows = 5;
  private isExecuting = false;

  /**
   * Execute a workflow command
   */
  async executeWorkflow(workflow: WorkflowCommand, options: WorkflowOptions = {}): Promise<AutomationResponse> {
    const workflowId = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Check if we can start a new workflow
      if (this.activeWorkflows.size >= this.maxConcurrentWorkflows) {
        throw new Error(`Maximum concurrent workflows (${this.maxConcurrentWorkflows}) reached`);
      }
      
      // Create workflow state
      const workflowState: WorkflowState = {
        id: workflowId,
        name: workflow.name,
        currentStep: 0,
        totalSteps: workflow.steps.length,
        status: 'running',
        startTime: Date.now(),
        context: workflow.context || {},
        results: []
      };
      
      this.activeWorkflows.set(workflowId, workflowState);
      
      // Initialize state tracker
      await stateTracker.initializeWorkflow(workflowId, workflow.context || {});
      
      // Report start
      if (options.reportProgress !== false) {
        await progressReporting.reportWorkflowStart(workflowId, workflow.name, workflow.steps.length);
      }
      
      // Execute workflow steps
      const results = await this.executeWorkflowSteps(workflow.steps, workflowId, options);
      
      // Update workflow state
      workflowState.status = 'completed';
      workflowState.endTime = Date.now();
      workflowState.results = results;
      
      // Report completion
      if (options.reportProgress !== false) {
        await progressReporting.reportWorkflowComplete(workflowId, results);
      }
      
      return {
        commandId: workflow.id,
        success: true,
        timestamp: Date.now(),
        data: {
          workflowId,
          results,
          duration: Date.now() - workflowState.startTime
        }
      };
      
    } catch (error) {
      // Update workflow state
      const workflowState = this.activeWorkflows.get(workflowId);
      if (workflowState) {
        workflowState.status = 'failed';
        workflowState.endTime = Date.now();
      }
      
      // Report error
      if (options.reportProgress !== false) {
        await progressReporting.reportWorkflowError(workflowId, error.message);
      }
      
      return {
        commandId: workflow.id,
        success: false,
        timestamp: Date.now(),
        error: {
          code: 'WORKFLOW_EXECUTION_FAILED',
          message: error.message,
          details: error
        }
      };
    } finally {
      // Clean up
      if (this.activeWorkflows.has(workflowId)) {
        this.activeWorkflows.delete(workflowId);
        await stateTracker.cleanupWorkflow(workflowId);
      }
    }
  }

  /**
   * Execute workflow steps
   */
  private async executeWorkflowSteps(
    steps: AnyAutomationCommand[], 
    workflowId: string, 
    options: WorkflowOptions
  ): Promise<AutomationResponse[]> {
    const results: AutomationResponse[] = [];
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepNumber = i + 1;
      
      try {
        // Update workflow state
        const workflowState = this.activeWorkflows.get(workflowId);
        if (workflowState) {
          workflowState.currentStep = stepNumber;
        }
        
        // Update state tracker
        await stateTracker.updateStep(workflowId, stepNumber, step);
        
        // Report step start
        if (options.reportProgress !== false) {
          await progressReporting.reportStepStart(workflowId, stepNumber, step.type);
        }
        
        // Check step condition if provided
        if (step.condition && !step.condition()) {
          console.log(`Skipping step ${stepNumber} due to condition`);
          continue;
        }
        
        // Execute step with timeout
        const stepTimeout = step.timeout || options.timeout || 30000;
        const result = await this.executeStepWithTimeout(step, stepTimeout, workflowId);
        
        results.push(result);
        
        // Update context with step result
        await stateTracker.updateContext(workflowId, `step_${stepNumber}_result`, result);
        
        // Report step completion
        if (options.reportProgress !== false) {
          await progressReporting.reportStepComplete(workflowId, stepNumber, result);
        }
        
        // Handle step failure
        if (!result.success) {
          if (options.continueOnError || step.skipOnFailure) {
            console.warn(`Step ${stepNumber} failed but continuing:`, result.error);
            continue;
          } else {
            throw new Error(`Step ${stepNumber} failed: ${result.error?.message}`);
          }
        }
        
        // Pause between steps if requested
        if (options.pauseOnStep) {
          await this.pauseForUserInput(workflowId, stepNumber);
        }
        
      } catch (error) {
        const errorResult: AutomationResponse = {
          commandId: step.id,
          success: false,
          timestamp: Date.now(),
          error: {
            code: 'STEP_EXECUTION_FAILED',
            message: error.message,
            details: error
          }
        };
        
        results.push(errorResult);
        
        // Report step error
        if (options.reportProgress !== false) {
          await progressReporting.reportStepError(workflowId, stepNumber, error.message);
        }
        
        // Attempt error recovery
        const recovered = await errorRecovery.attemptRecovery(workflowId, stepNumber, error, options);
        
        if (recovered) {
          console.log(`Recovered from error in step ${stepNumber}`);
          continue;
        } else {
          throw error;
        }
      }
    }
    
    return results;
  }

  /**
   * Execute a step with timeout
   */
  private async executeStepWithTimeout(
    step: AnyAutomationCommand, 
    timeout: number, 
    workflowId: string
  ): Promise<AutomationResponse> {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Step timed out after ${timeout}ms`));
      }, timeout);
      
      try {
        const result = await browserAutomation.executeCommand(step);
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Pause workflow for user input
   */
  private async pauseForUserInput(workflowId: string, stepNumber: number): Promise<void> {
    return new Promise((resolve) => {
      // Create a simple modal to pause execution
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border: 1px solid black;
        border-radius: 5px;
        z-index: 10000;
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
      `;
      
      modal.innerHTML = `
        <h3>Workflow Paused</h3>
        <p>Step ${stepNumber} completed. Click Continue to proceed.</p>
        <button id="continue-btn">Continue</button>
      `;
      
      document.body.appendChild(modal);
      
      const continueBtn = document.getElementById('continue-btn');
      continueBtn?.addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve();
      });
    });
  }

  /**
   * Cancel a running workflow
   */
  async cancelWorkflow(workflowId: string): Promise<boolean> {
    const workflowState = this.activeWorkflows.get(workflowId);
    
    if (!workflowState) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    
    if (workflowState.status === 'completed' || workflowState.status === 'failed') {
      throw new Error(`Workflow already finished: ${workflowState.status}`);
    }
    
    // Update workflow state
    workflowState.status = 'cancelled';
    workflowState.endTime = Date.now();
    
    // Report cancellation
    await progressReporting.reportWorkflowCancelled(workflowId);
    
    // Clean up
    this.activeWorkflows.delete(workflowId);
    await stateTracker.cleanupWorkflow(workflowId);
    
    return true;
  }

  /**
   * Get workflow state
   */
  getWorkflowState(workflowId: string): WorkflowState | undefined {
    return this.activeWorkflows.get(workflowId);
  }

  /**
   * Get all active workflows
   */
  getActiveWorkflows(): WorkflowState[] {
    return Array.from(this.activeWorkflows.values());
  }

  /**
   * Set maximum concurrent workflows
   */
  setMaxConcurrentWorkflows(max: number): void {
    this.maxConcurrentWorkflows = max;
  }

  /**
   * Queue a workflow for execution
   */
  queueWorkflow(workflow: WorkflowCommand): void {
    this.workflowQueue.push(workflow);
    
    // Start processing queue if not already running
    if (!this.isExecuting) {
      this.processQueue();
    }
  }

  /**
   * Process workflow queue
   */
  private async processQueue(): Promise<void> {
    if (this.isExecuting || this.workflowQueue.length === 0) {
      return;
    }
    
    this.isExecuting = true;
    
    try {
      while (this.workflowQueue.length > 0 && this.activeWorkflows.size < this.maxConcurrentWorkflows) {
        const workflow = this.workflowQueue.shift()!;
        
        // Execute workflow in background
        this.executeWorkflow(workflow).catch(error => {
          console.error('Queued workflow failed:', error);
        });
      }
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Create a workflow from steps
   */
  createWorkflow(name: string, steps: AnyAutomationCommand[], context?: Record<string, any>): WorkflowCommand {
    return {
      id: `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'workflow',
      name,
      steps,
      context,
      timestamp: Date.now()
    };
  }

  /**
   * Add conditional step to workflow
   */
  addConditionalStep(
    workflow: WorkflowCommand, 
    command: AnyAutomationCommand, 
    condition: () => boolean
  ): WorkflowCommand {
    const conditionalStep = {
      ...command,
      condition
    } as WorkflowStep;
    
    return {
      ...workflow,
      steps: [...workflow.steps, conditionalStep as any]
    };
  }

  /**
   * Add retry logic to workflow step
   */
  addRetryLogic(
    workflow: WorkflowCommand, 
    command: AnyAutomationCommand, 
    maxRetries: number = 3
  ): WorkflowCommand {
    const retryStep = {
      ...command,
      maxRetries,
      retryCount: 0
    } as WorkflowStep;
    
    return {
      ...workflow,
      steps: [...workflow.steps, retryStep as any]
    };
  }

  /**
   * Create a parallel workflow step
   */
  async executeParallelSteps(steps: AnyAutomationCommand[]): Promise<AutomationResponse[]> {
    const promises = steps.map(step => browserAutomation.executeCommand(step));
    return Promise.all(promises);
  }

  /**
   * Create a conditional workflow
   */
  createConditionalWorkflow(
    condition: () => boolean,
    trueSteps: AnyAutomationCommand[],
    falseSteps: AnyAutomationCommand[] = []
  ): WorkflowCommand {
    const steps = condition() ? trueSteps : falseSteps;
    
    return this.createWorkflow('Conditional Workflow', steps);
  }

  /**
   * Create a loop workflow
   */
  createLoopWorkflow(
    steps: AnyAutomationCommand[],
    iterations: number,
    context?: Record<string, any>
  ): WorkflowCommand {
    const loopSteps: AnyAutomationCommand[] = [];
    
    for (let i = 0; i < iterations; i++) {
      loopSteps.push(...steps);
    }
    
    return this.createWorkflow('Loop Workflow', loopSteps, context);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Cancel all active workflows
    const activeWorkflows = Array.from(this.activeWorkflows.keys());
    
    for (const workflowId of activeWorkflows) {
      try {
        await this.cancelWorkflow(workflowId);
      } catch (error) {
        console.error(`Failed to cancel workflow ${workflowId}:`, error);
      }
    }
    
    // Clear queue
    this.workflowQueue = [];
    
    // Clean up state tracker
    await stateTracker.cleanup();
  }
}

// Export singleton instance for convenience
export const workflowExecutor = new WorkflowExecutor();
