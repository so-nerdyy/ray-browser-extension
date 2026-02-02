/**
 * State tracker for workflow execution
 * Manages workflow state and context across multiple steps
 */

import { WorkflowState, AutomationResponse } from './automation-types';
import { chromeApi } from './chrome-api-wrappers';

export interface StateSnapshot {
  workflowId: string;
  timestamp: number;
  state: WorkflowState;
  context: Record<string, any>;
}

export interface StepContext {
  stepNumber: number;
  command: any;
  result: AutomationResponse;
  timestamp: number;
  duration: number;
}

export class StateTracker {
  private workflowStates: Map<string, WorkflowState> = new Map();
  private workflowContexts: Map<string, Record<string, any>> = new Map();
  private stepHistory: Map<string, StepContext[]> = new Map();
  private stateSnapshots: Map<string, StateSnapshot[]> = new Map();
  private maxSnapshots = 10;
  private persistenceEnabled = true;

  /**
   * Initialize a workflow state
   */
  async initializeWorkflow(workflowId: string, initialContext: Record<string, any> = {}): Promise<void> {
    const state: WorkflowState = {
      id: workflowId,
      name: '',
      currentStep: 0,
      totalSteps: 0,
      status: 'running',
      startTime: Date.now(),
      context: initialContext,
      results: []
    };
    
    this.workflowStates.set(workflowId, state);
    this.workflowContexts.set(workflowId, { ...initialContext });
    this.stepHistory.set(workflowId, []);
    
    // Create initial snapshot
    await this.createSnapshot(workflowId);
    
    // Persist to storage if enabled
    if (this.persistenceEnabled) {
      await this.persistWorkflowState(workflowId, state);
    }
  }

  /**
   * Update workflow state
   */
  async updateWorkflowState(workflowId: string, updates: Partial<WorkflowState>): Promise<void> {
    const state = this.workflowStates.get(workflowId);
    
    if (!state) {
      throw new Error(`Workflow state not found: ${workflowId}`);
    }
    
    // Update state with provided updates
    Object.assign(state, updates);
    
    // Create snapshot after significant updates
    if (updates.status || updates.currentStep) {
      await this.createSnapshot(workflowId);
    }
    
    // Persist to storage if enabled
    if (this.persistenceEnabled) {
      await this.persistWorkflowState(workflowId, state);
    }
  }

  /**
   * Update step information
   */
  async updateStep(workflowId: string, stepNumber: number, command: any): Promise<void> {
    const state = this.workflowStates.get(workflowId);
    
    if (!state) {
      throw new Error(`Workflow state not found: ${workflowId}`);
    }
    
    // Update current step
    state.currentStep = stepNumber;
    
    // Add to step history
    const stepContext: StepContext = {
      stepNumber,
      command,
      result: {} as AutomationResponse,
      timestamp: Date.now(),
      duration: 0
    };
    
    const history = this.stepHistory.get(workflowId) || [];
    history.push(stepContext);
    this.stepHistory.set(workflowId, history);
    
    // Create snapshot
    await this.createSnapshot(workflowId);
    
    // Persist to storage if enabled
    if (this.persistenceEnabled) {
      await this.persistWorkflowState(workflowId, state);
      await this.persistStepHistory(workflowId, history);
    }
  }

  /**
   * Update step result
   */
  async updateStepResult(workflowId: string, stepNumber: number, result: AutomationResponse): Promise<void> {
    const history = this.stepHistory.get(workflowId) || [];
    const stepContext = history.find(ctx => ctx.stepNumber === stepNumber);
    
    if (stepContext) {
      stepContext.result = result;
      stepContext.duration = Date.now() - stepContext.timestamp;
      
      // Update workflow results
      const state = this.workflowStates.get(workflowId);
      if (state) {
        state.results = history.map(ctx => ctx.result);
      }
      
      // Create snapshot
      await this.createSnapshot(workflowId);
      
      // Persist to storage if enabled
      if (this.persistenceEnabled) {
        await this.persistWorkflowState(workflowId, state);
        await this.persistStepHistory(workflowId, history);
      }
    }
  }

  /**
   * Update workflow context
   */
  async updateContext(workflowId: string, key: string, value: any): Promise<void> {
    const context = this.workflowContexts.get(workflowId);
    
    if (!context) {
      throw new Error(`Workflow context not found: ${workflowId}`);
    }
    
    context[key] = value;
    this.workflowContexts.set(workflowId, { ...context });
    
    // Also update workflow state context
    const state = this.workflowStates.get(workflowId);
    if (state) {
      state.context = { ...context };
      
      // Create snapshot
      await this.createSnapshot(workflowId);
      
      // Persist to storage if enabled
      if (this.persistenceEnabled) {
        await this.persistWorkflowState(workflowId, state);
        await this.persistWorkflowContext(workflowId, context);
      }
    }
  }

  /**
   * Get workflow state
   */
  getWorkflowState(workflowId: string): WorkflowState | undefined {
    return this.workflowStates.get(workflowId);
  }

  /**
   * Get workflow context
   */
  getWorkflowContext(workflowId: string): Record<string, any> | undefined {
    return this.workflowContexts.get(workflowId);
  }

  /**
   * Get step history
   */
  getStepHistory(workflowId: string): StepContext[] {
    return this.stepHistory.get(workflowId) || [];
  }

  /**
   * Get current step context
   */
  getCurrentStepContext(workflowId: string): StepContext | undefined {
    const history = this.stepHistory.get(workflowId) || [];
    return history[history.length - 1];
  }

  /**
   * Get context value
   */
  getContextValue(workflowId: string, key: string): any {
    const context = this.workflowContexts.get(workflowId);
    return context ? context[key] : undefined;
  }

  /**
   * Create a state snapshot
   */
  async createSnapshot(workflowId: string): Promise<void> {
    const state = this.workflowStates.get(workflowId);
    const context = this.workflowContexts.get(workflowId);
    
    if (!state || !context) {
      return;
    }
    
    const snapshot: StateSnapshot = {
      workflowId,
      timestamp: Date.now(),
      state: { ...state },
      context: { ...context }
    };
    
    const snapshots = this.stateSnapshots.get(workflowId) || [];
    snapshots.push(snapshot);
    
    // Keep only the most recent snapshots
    if (snapshots.length > this.maxSnapshots) {
      snapshots.splice(0, snapshots.length - this.maxSnapshots);
    }
    
    this.stateSnapshots.set(workflowId, snapshots);
    
    // Persist to storage if enabled
    if (this.persistenceEnabled) {
      await this.persistSnapshots(workflowId, snapshots);
    }
  }

  /**
   * Get state snapshots
   */
  getStateSnapshots(workflowId: string): StateSnapshot[] {
    return this.stateSnapshots.get(workflowId) || [];
  }

  /**
   * Restore from snapshot
   */
  async restoreFromSnapshot(workflowId: string, snapshotIndex: number = -1): Promise<boolean> {
    const snapshots = this.stateSnapshots.get(workflowId) || [];
    
    if (snapshots.length === 0) {
      return false;
    }
    
    const snapshot = snapshots[snapshotIndex === -1 ? snapshots.length - 1 : snapshotIndex];
    
    if (!snapshot) {
      return false;
    }
    
    // Restore state and context
    this.workflowStates.set(workflowId, { ...snapshot.state });
    this.workflowContexts.set(workflowId, { ...snapshot.context });
    
    // Persist to storage if enabled
    if (this.persistenceEnabled) {
      await this.persistWorkflowState(workflowId, snapshot.state);
      await this.persistWorkflowContext(workflowId, snapshot.context);
    }
    
    return true;
  }

  /**
   * Get workflow statistics
   */
  getWorkflowStatistics(workflowId: string): any {
    const state = this.workflowStates.get(workflowId);
    const history = this.stepHistory.get(workflowId) || [];
    
    if (!state) {
      return null;
    }
    
    const now = Date.now();
    const duration = state.endTime ? state.endTime - state.startTime : now - state.startTime;
    const completedSteps = history.filter(ctx => ctx.result.success).length;
    const failedSteps = history.filter(ctx => !ctx.result.success).length;
    const averageStepDuration = history.length > 0 
      ? history.reduce((sum, ctx) => sum + ctx.duration, 0) / history.length 
      : 0;
    
    return {
      workflowId,
      name: state.name,
      status: state.status,
      duration,
      totalSteps: state.totalSteps,
      currentStep: state.currentStep,
      completedSteps,
      failedSteps,
      successRate: history.length > 0 ? completedSteps / history.length : 0,
      averageStepDuration,
      snapshots: this.stateSnapshots.get(workflowId)?.length || 0
    };
  }

  /**
   * Get all workflow states
   */
  getAllWorkflowStates(): WorkflowState[] {
    return Array.from(this.workflowStates.values());
  }

  /**
   * Get active workflow states
   */
  getActiveWorkflowStates(): WorkflowState[] {
    return Array.from(this.workflowStates.values()).filter(
      state => state.status === 'running'
    );
  }

  /**
   * Search workflow states
   */
  searchWorkflowStates(query: string): WorkflowState[] {
    const allStates = this.getAllWorkflowStates();
    const lowerQuery = query.toLowerCase();
    
    return allStates.filter(state => 
      state.name.toLowerCase().includes(lowerQuery) ||
      state.id.toLowerCase().includes(lowerQuery) ||
      (state.context && JSON.stringify(state.context).toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Export workflow state
   */
  async exportWorkflowState(workflowId: string): Promise<any> {
    const state = this.workflowStates.get(workflowId);
    const context = this.workflowContexts.get(workflowId);
    const history = this.stepHistory.get(workflowId);
    const snapshots = this.stateSnapshots.get(workflowId);
    
    if (!state) {
      throw new Error(`Workflow state not found: ${workflowId}`);
    }
    
    return {
      state,
      context,
      history,
      snapshots,
      statistics: this.getWorkflowStatistics(workflowId),
      exportedAt: Date.now()
    };
  }

  /**
   * Import workflow state
   */
  async importWorkflowState(exportedState: any): Promise<string> {
    const workflowId = `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Import state
    if (exportedState.state) {
      this.workflowStates.set(workflowId, exportedState.state);
    }
    
    // Import context
    if (exportedState.context) {
      this.workflowContexts.set(workflowId, exportedState.context);
    }
    
    // Import history
    if (exportedState.history) {
      this.stepHistory.set(workflowId, exportedState.history);
    }
    
    // Import snapshots
    if (exportedState.snapshots) {
      this.stateSnapshots.set(workflowId, exportedState.snapshots);
    }
    
    // Persist to storage if enabled
    if (this.persistenceEnabled) {
      await this.persistWorkflowState(workflowId, exportedState.state);
      await this.persistWorkflowContext(workflowId, exportedState.context);
      await this.persistStepHistory(workflowId, exportedState.history);
      await this.persistSnapshots(workflowId, exportedState.snapshots);
    }
    
    return workflowId;
  }

  /**
   * Persist workflow state to storage
   */
  private async persistWorkflowState(workflowId: string, state: WorkflowState): Promise<void> {
    try {
      await chromeApi.setStorageData(`workflow_state_${workflowId}`, state);
    } catch (error) {
      console.error(`Failed to persist workflow state: ${error.message}`);
    }
  }

  /**
   * Persist workflow context to storage
   */
  private async persistWorkflowContext(workflowId: string, context: Record<string, any>): Promise<void> {
    try {
      await chromeApi.setStorageData(`workflow_context_${workflowId}`, context);
    } catch (error) {
      console.error(`Failed to persist workflow context: ${error.message}`);
    }
  }

  /**
   * Persist step history to storage
   */
  private async persistStepHistory(workflowId: string, history: StepContext[]): Promise<void> {
    try {
      await chromeApi.setStorageData(`step_history_${workflowId}`, history);
    } catch (error) {
      console.error(`Failed to persist step history: ${error.message}`);
    }
  }

  /**
   * Persist snapshots to storage
   */
  private async persistSnapshots(workflowId: string, snapshots: StateSnapshot[]): Promise<void> {
    try {
      await chromeApi.setStorageData(`state_snapshots_${workflowId}`, snapshots);
    } catch (error) {
      console.error(`Failed to persist snapshots: ${error.message}`);
    }
  }

  /**
   * Load workflow state from storage
   */
  async loadWorkflowState(workflowId: string): Promise<boolean> {
    try {
      const state = await chromeApi.getStorageData(`workflow_state_${workflowId}`);
      if (state) {
        this.workflowStates.set(workflowId, state);
      }
      
      const context = await chromeApi.getStorageData(`workflow_context_${workflowId}`);
      if (context) {
        this.workflowContexts.set(workflowId, context);
      }
      
      const history = await chromeApi.getStorageData(`step_history_${workflowId}`);
      if (history) {
        this.stepHistory.set(workflowId, history);
      }
      
      const snapshots = await chromeApi.getStorageData(`state_snapshots_${workflowId}`);
      if (snapshots) {
        this.stateSnapshots.set(workflowId, snapshots);
      }
      
      return true;
    } catch (error) {
      console.error(`Failed to load workflow state: ${error.message}`);
      return false;
    }
  }

  /**
   * Clean up workflow state
   */
  async cleanupWorkflow(workflowId: string): Promise<void> {
    // Update state
    const state = this.workflowStates.get(workflowId);
    if (state) {
      state.status = 'completed';
      state.endTime = Date.now();
    }
    
    // Create final snapshot
    await this.createSnapshot(workflowId);
    
    // Remove from memory
    this.workflowStates.delete(workflowId);
    this.workflowContexts.delete(workflowId);
    this.stepHistory.delete(workflowId);
    this.stateSnapshots.delete(workflowId);
    
    // Clean up storage if enabled
    if (this.persistenceEnabled) {
      try {
        await chromeApi.setStorageData(`workflow_state_${workflowId}`, null);
        await chromeApi.setStorageData(`workflow_context_${workflowId}`, null);
        await chromeApi.setStorageData(`step_history_${workflowId}`, null);
        await chromeApi.setStorageData(`state_snapshots_${workflowId}`, null);
      } catch (error) {
        console.error(`Failed to cleanup workflow storage: ${error.message}`);
      }
    }
  }

  /**
   * Clean up all workflow states
   */
  async cleanup(): Promise<void> {
    const workflowIds = Array.from(this.workflowStates.keys());
    
    for (const workflowId of workflowIds) {
      await this.cleanupWorkflow(workflowId);
    }
    
    // Clear all collections
    this.workflowStates.clear();
    this.workflowContexts.clear();
    this.stepHistory.clear();
    this.stateSnapshots.clear();
  }

  /**
   * Enable/disable persistence
   */
  setPersistenceEnabled(enabled: boolean): void {
    this.persistenceEnabled = enabled;
  }

  /**
   * Set maximum snapshots
   */
  setMaxSnapshots(max: number): void {
    this.maxSnapshots = max;
  }

  /**
   * Get memory usage statistics
   */
  getMemoryUsage(): any {
    const totalStates = this.workflowStates.size;
    const totalContexts = this.workflowContexts.size;
    const totalHistories = this.stepHistory.size;
    const totalSnapshots = Array.from(this.stateSnapshots.values())
      .reduce((sum, snapshots) => sum + snapshots.length, 0);
    
    return {
      totalStates,
      totalContexts,
      totalHistories,
      totalSnapshots,
      estimatedMemoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    
    // Estimate state size
    this.workflowStates.forEach(state => {
      totalSize += JSON.stringify(state).length * 2; // Rough estimate
    });
    
    // Estimate context size
    this.workflowContexts.forEach(context => {
      totalSize += JSON.stringify(context).length * 2;
    });
    
    // Estimate history size
    this.stepHistory.forEach(history => {
      totalSize += JSON.stringify(history).length * 2;
    });
    
    // Estimate snapshots size
    this.stateSnapshots.forEach(snapshots => {
      totalSize += JSON.stringify(snapshots).length * 2;
    });
    
    return totalSize;
  }
}

// Export singleton instance for convenience
export const stateTracker = new StateTracker(); * State tracker for workflow execution
 * Manages workflow state and context across multiple steps
 */

import { WorkflowState, AutomationResponse } from './automation-types';
import { chromeApi } from './chrome-api-wrappers';

export interface StateSnapshot {
  workflowId: string;
  timestamp: number;
  state: WorkflowState;
  context: Record<string, any>;
}

export interface StepContext {
  stepNumber: number;
  command: any;
  result: AutomationResponse;
  timestamp: number;
  duration: number;
}

export class StateTracker {
  private workflowStates: Map<string, WorkflowState> = new Map();
  private workflowContexts: Map<string, Record<string, any>> = new Map();
  private stepHistory: Map<string, StepContext[]> = new Map();
  private stateSnapshots: Map<string, StateSnapshot[]> = new Map();
  private maxSnapshots = 10;
  private persistenceEnabled = true;

  /**
   * Initialize a workflow state
   */
  async initializeWorkflow(workflowId: string, initialContext: Record<string, any> = {}): Promise<void> {
    const state: WorkflowState = {
      id: workflowId,
      name: '',
      currentStep: 0,
      totalSteps: 0,
      status: 'running',
      startTime: Date.now(),
      context: initialContext,
      results: []
    };
    
    this.workflowStates.set(workflowId, state);
    this.workflowContexts.set(workflowId, { ...initialContext });
    this.stepHistory.set(workflowId, []);
    
    // Create initial snapshot
    await this.createSnapshot(workflowId);
    
    // Persist to storage if enabled
    if (this.persistenceEnabled) {
      await this.persistWorkflowState(workflowId, state);
    }
  }

  /**
   * Update workflow state
   */
  async updateWorkflowState(workflowId: string, updates: Partial<WorkflowState>): Promise<void> {
    const state = this.workflowStates.get(workflowId);
    
    if (!state) {
      throw new Error(`Workflow state not found: ${workflowId}`);
    }
    
    // Update state with provided updates
    Object.assign(state, updates);
    
    // Create snapshot after significant updates
    if (updates.status || updates.currentStep) {
      await this.createSnapshot(workflowId);
    }
    
    // Persist to storage if enabled
    if (this.persistenceEnabled) {
      await this.persistWorkflowState(workflowId, state);
    }
  }

  /**
   * Update step information
   */
  async updateStep(workflowId: string, stepNumber: number, command: any): Promise<void> {
    const state = this.workflowStates.get(workflowId);
    
    if (!state) {
      throw new Error(`Workflow state not found: ${workflowId}`);
    }
    
    // Update current step
    state.currentStep = stepNumber;
    
    // Add to step history
    const stepContext: StepContext = {
      stepNumber,
      command,
      result: {} as AutomationResponse,
      timestamp: Date.now(),
      duration: 0
    };
    
    const history = this.stepHistory.get(workflowId) || [];
    history.push(stepContext);
    this.stepHistory.set(workflowId, history);
    
    // Create snapshot
    await this.createSnapshot(workflowId);
    
    // Persist to storage if enabled
    if (this.persistenceEnabled) {
      await this.persistWorkflowState(workflowId, state);
      await this.persistStepHistory(workflowId, history);
    }
  }

  /**
   * Update step result
   */
  async updateStepResult(workflowId: string, stepNumber: number, result: AutomationResponse): Promise<void> {
    const history = this.stepHistory.get(workflowId) || [];
    const stepContext = history.find(ctx => ctx.stepNumber === stepNumber);
    
    if (stepContext) {
      stepContext.result = result;
      stepContext.duration = Date.now() - stepContext.timestamp;
      
      // Update workflow results
      const state = this.workflowStates.get(workflowId);
      if (state) {
        state.results = history.map(ctx => ctx.result);
      }
      
      // Create snapshot
      await this.createSnapshot(workflowId);
      
      // Persist to storage if enabled
      if (this.persistenceEnabled) {
        await this.persistWorkflowState(workflowId, state);
        await this.persistStepHistory(workflowId, history);
      }
    }
  }

  /**
   * Update workflow context
   */
  async updateContext(workflowId: string, key: string, value: any): Promise<void> {
    const context = this.workflowContexts.get(workflowId);
    
    if (!context) {
      throw new Error(`Workflow context not found: ${workflowId}`);
    }
    
    context[key] = value;
    this.workflowContexts.set(workflowId, { ...context });
    
    // Also update workflow state context
    const state = this.workflowStates.get(workflowId);
    if (state) {
      state.context = { ...context };
      
      // Create snapshot
      await this.createSnapshot(workflowId);
      
      // Persist to storage if enabled
      if (this.persistenceEnabled) {
        await this.persistWorkflowState(workflowId, state);
        await this.persistWorkflowContext(workflowId, context);
      }
    }
  }

  /**
   * Get workflow state
   */
  getWorkflowState(workflowId: string): WorkflowState | undefined {
    return this.workflowStates.get(workflowId);
  }

  /**
   * Get workflow context
   */
  getWorkflowContext(workflowId: string): Record<string, any> | undefined {
    return this.workflowContexts.get(workflowId);
  }

  /**
   * Get step history
   */
  getStepHistory(workflowId: string): StepContext[] {
    return this.stepHistory.get(workflowId) || [];
  }

  /**
   * Get current step context
   */
  getCurrentStepContext(workflowId: string): StepContext | undefined {
    const history = this.stepHistory.get(workflowId) || [];
    return history[history.length - 1];
  }

  /**
   * Get context value
   */
  getContextValue(workflowId: string, key: string): any {
    const context = this.workflowContexts.get(workflowId);
    return context ? context[key] : undefined;
  }

  /**
   * Create a state snapshot
   */
  async createSnapshot(workflowId: string): Promise<void> {
    const state = this.workflowStates.get(workflowId);
    const context = this.workflowContexts.get(workflowId);
    
    if (!state || !context) {
      return;
    }
    
    const snapshot: StateSnapshot = {
      workflowId,
      timestamp: Date.now(),
      state: { ...state },
      context: { ...context }
    };
    
    const snapshots = this.stateSnapshots.get(workflowId) || [];
    snapshots.push(snapshot);
    
    // Keep only the most recent snapshots
    if (snapshots.length > this.maxSnapshots) {
      snapshots.splice(0, snapshots.length - this.maxSnapshots);
    }
    
    this.stateSnapshots.set(workflowId, snapshots);
    
    // Persist to storage if enabled
    if (this.persistenceEnabled) {
      await this.persistSnapshots(workflowId, snapshots);
    }
  }

  /**
   * Get state snapshots
   */
  getStateSnapshots(workflowId: string): StateSnapshot[] {
    return this.stateSnapshots.get(workflowId) || [];
  }

  /**
   * Restore from snapshot
   */
  async restoreFromSnapshot(workflowId: string, snapshotIndex: number = -1): Promise<boolean> {
    const snapshots = this.stateSnapshots.get(workflowId) || [];
    
    if (snapshots.length === 0) {
      return false;
    }
    
    const snapshot = snapshots[snapshotIndex === -1 ? snapshots.length - 1 : snapshotIndex];
    
    if (!snapshot) {
      return false;
    }
    
    // Restore state and context
    this.workflowStates.set(workflowId, { ...snapshot.state });
    this.workflowContexts.set(workflowId, { ...snapshot.context });
    
    // Persist to storage if enabled
    if (this.persistenceEnabled) {
      await this.persistWorkflowState(workflowId, snapshot.state);
      await this.persistWorkflowContext(workflowId, snapshot.context);
    }
    
    return true;
  }

  /**
   * Get workflow statistics
   */
  getWorkflowStatistics(workflowId: string): any {
    const state = this.workflowStates.get(workflowId);
    const history = this.stepHistory.get(workflowId) || [];
    
    if (!state) {
      return null;
    }
    
    const now = Date.now();
    const duration = state.endTime ? state.endTime - state.startTime : now - state.startTime;
    const completedSteps = history.filter(ctx => ctx.result.success).length;
    const failedSteps = history.filter(ctx => !ctx.result.success).length;
    const averageStepDuration = history.length > 0 
      ? history.reduce((sum, ctx) => sum + ctx.duration, 0) / history.length 
      : 0;
    
    return {
      workflowId,
      name: state.name,
      status: state.status,
      duration,
      totalSteps: state.totalSteps,
      currentStep: state.currentStep,
      completedSteps,
      failedSteps,
      successRate: history.length > 0 ? completedSteps / history.length : 0,
      averageStepDuration,
      snapshots: this.stateSnapshots.get(workflowId)?.length || 0
    };
  }

  /**
   * Get all workflow states
   */
  getAllWorkflowStates(): WorkflowState[] {
    return Array.from(this.workflowStates.values());
  }

  /**
   * Get active workflow states
   */
  getActiveWorkflowStates(): WorkflowState[] {
    return Array.from(this.workflowStates.values()).filter(
      state => state.status === 'running'
    );
  }

  /**
   * Search workflow states
   */
  searchWorkflowStates(query: string): WorkflowState[] {
    const allStates = this.getAllWorkflowStates();
    const lowerQuery = query.toLowerCase();
    
    return allStates.filter(state => 
      state.name.toLowerCase().includes(lowerQuery) ||
      state.id.toLowerCase().includes(lowerQuery) ||
      (state.context && JSON.stringify(state.context).toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Export workflow state
   */
  async exportWorkflowState(workflowId: string): Promise<any> {
    const state = this.workflowStates.get(workflowId);
    const context = this.workflowContexts.get(workflowId);
    const history = this.stepHistory.get(workflowId);
    const snapshots = this.stateSnapshots.get(workflowId);
    
    if (!state) {
      throw new Error(`Workflow state not found: ${workflowId}`);
    }
    
    return {
      state,
      context,
      history,
      snapshots,
      statistics: this.getWorkflowStatistics(workflowId),
      exportedAt: Date.now()
    };
  }

  /**
   * Import workflow state
   */
  async importWorkflowState(exportedState: any): Promise<string> {
    const workflowId = `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Import state
    if (exportedState.state) {
      this.workflowStates.set(workflowId, exportedState.state);
    }
    
    // Import context
    if (exportedState.context) {
      this.workflowContexts.set(workflowId, exportedState.context);
    }
    
    // Import history
    if (exportedState.history) {
      this.stepHistory.set(workflowId, exportedState.history);
    }
    
    // Import snapshots
    if (exportedState.snapshots) {
      this.stateSnapshots.set(workflowId, exportedState.snapshots);
    }
    
    // Persist to storage if enabled
    if (this.persistenceEnabled) {
      await this.persistWorkflowState(workflowId, exportedState.state);
      await this.persistWorkflowContext(workflowId, exportedState.context);
      await this.persistStepHistory(workflowId, exportedState.history);
      await this.persistSnapshots(workflowId, exportedState.snapshots);
    }
    
    return workflowId;
  }

  /**
   * Persist workflow state to storage
   */
  private async persistWorkflowState(workflowId: string, state: WorkflowState): Promise<void> {
    try {
      await chromeApi.setStorageData(`workflow_state_${workflowId}`, state);
    } catch (error) {
      console.error(`Failed to persist workflow state: ${error.message}`);
    }
  }

  /**
   * Persist workflow context to storage
   */
  private async persistWorkflowContext(workflowId: string, context: Record<string, any>): Promise<void> {
    try {
      await chromeApi.setStorageData(`workflow_context_${workflowId}`, context);
    } catch (error) {
      console.error(`Failed to persist workflow context: ${error.message}`);
    }
  }

  /**
   * Persist step history to storage
   */
  private async persistStepHistory(workflowId: string, history: StepContext[]): Promise<void> {
    try {
      await chromeApi.setStorageData(`step_history_${workflowId}`, history);
    } catch (error) {
      console.error(`Failed to persist step history: ${error.message}`);
    }
  }

  /**
   * Persist snapshots to storage
   */
  private async persistSnapshots(workflowId: string, snapshots: StateSnapshot[]): Promise<void> {
    try {
      await chromeApi.setStorageData(`state_snapshots_${workflowId}`, snapshots);
    } catch (error) {
      console.error(`Failed to persist snapshots: ${error.message}`);
    }
  }

  /**
   * Load workflow state from storage
   */
  async loadWorkflowState(workflowId: string): Promise<boolean> {
    try {
      const state = await chromeApi.getStorageData(`workflow_state_${workflowId}`);
      if (state) {
        this.workflowStates.set(workflowId, state);
      }
      
      const context = await chromeApi.getStorageData(`workflow_context_${workflowId}`);
      if (context) {
        this.workflowContexts.set(workflowId, context);
      }
      
      const history = await chromeApi.getStorageData(`step_history_${workflowId}`);
      if (history) {
        this.stepHistory.set(workflowId, history);
      }
      
      const snapshots = await chromeApi.getStorageData(`state_snapshots_${workflowId}`);
      if (snapshots) {
        this.stateSnapshots.set(workflowId, snapshots);
      }
      
      return true;
    } catch (error) {
      console.error(`Failed to load workflow state: ${error.message}`);
      return false;
    }
  }

  /**
   * Clean up workflow state
   */
  async cleanupWorkflow(workflowId: string): Promise<void> {
    // Update state
    const state = this.workflowStates.get(workflowId);
    if (state) {
      state.status = 'completed';
      state.endTime = Date.now();
    }
    
    // Create final snapshot
    await this.createSnapshot(workflowId);
    
    // Remove from memory
    this.workflowStates.delete(workflowId);
    this.workflowContexts.delete(workflowId);
    this.stepHistory.delete(workflowId);
    this.stateSnapshots.delete(workflowId);
    
    // Clean up storage if enabled
    if (this.persistenceEnabled) {
      try {
        await chromeApi.setStorageData(`workflow_state_${workflowId}`, null);
        await chromeApi.setStorageData(`workflow_context_${workflowId}`, null);
        await chromeApi.setStorageData(`step_history_${workflowId}`, null);
        await chromeApi.setStorageData(`state_snapshots_${workflowId}`, null);
      } catch (error) {
        console.error(`Failed to cleanup workflow storage: ${error.message}`);
      }
    }
  }

  /**
   * Clean up all workflow states
   */
  async cleanup(): Promise<void> {
    const workflowIds = Array.from(this.workflowStates.keys());
    
    for (const workflowId of workflowIds) {
      await this.cleanupWorkflow(workflowId);
    }
    
    // Clear all collections
    this.workflowStates.clear();
    this.workflowContexts.clear();
    this.stepHistory.clear();
    this.stateSnapshots.clear();
  }

  /**
   * Enable/disable persistence
   */
  setPersistenceEnabled(enabled: boolean): void {
    this.persistenceEnabled = enabled;
  }

  /**
   * Set maximum snapshots
   */
  setMaxSnapshots(max: number): void {
    this.maxSnapshots = max;
  }

  /**
   * Get memory usage statistics
   */
  getMemoryUsage(): any {
    const totalStates = this.workflowStates.size;
    const totalContexts = this.workflowContexts.size;
    const totalHistories = this.stepHistory.size;
    const totalSnapshots = Array.from(this.stateSnapshots.values())
      .reduce((sum, snapshots) => sum + snapshots.length, 0);
    
    return {
      totalStates,
      totalContexts,
      totalHistories,
      totalSnapshots,
      estimatedMemoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    
    // Estimate state size
    this.workflowStates.forEach(state => {
      totalSize += JSON.stringify(state).length * 2; // Rough estimate
    });
    
    // Estimate context size
    this.workflowContexts.forEach(context => {
      totalSize += JSON.stringify(context).length * 2;
    });
    
    // Estimate history size
    this.stepHistory.forEach(history => {
      totalSize += JSON.stringify(history).length * 2;
    });
    
    // Estimate snapshots size
    this.stateSnapshots.forEach(snapshots => {
      totalSize += JSON.stringify(snapshots).length * 2;
    });
    
    return totalSize;
  }
}

// Export singleton instance for convenience
export const stateTracker = new StateTracker();
