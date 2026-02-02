/**
 * Progress reporting for browser automation
 * Handles status reporting to Casey and other components
 */

import { AutomationResponse, WorkflowState } from './automation-types';
import { chromeApi } from './chrome-api-wrappers';

export interface ProgressReport {
  workflowId?: string;
  stepNumber?: number;
  type: 'workflow_start' | 'workflow_complete' | 'workflow_error' | 'workflow_cancelled' | 'step_start' | 'step_complete' | 'step_error';
  timestamp: number;
  data?: any;
  message?: string;
}

export interface ProgressOptions {
  reportToCasey?: boolean;
  reportToBlake?: boolean;
  reportToBackground?: boolean;
  includeDetails?: boolean;
  throttleMs?: number;
}

export interface WorkflowProgress {
  workflowId: string;
  name: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep: number;
  totalSteps: number;
  startTime: number;
  endTime?: number;
  duration?: number;
  successRate?: number;
  averageStepDuration?: number;
  errors: string[];
  warnings: string[];
}

export interface StepProgress {
  stepNumber: number;
  type: string;
  status: 'started' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  duration?: number;
  error?: string;
  data?: any;
}

export class ProgressReporting {
  private progressHistory: Map<string, ProgressReport[]> = new Map();
  private workflowProgress: Map<string, WorkflowProgress> = new Map();
  private stepProgress: Map<string, StepProgress[]> = new Map();
  private lastReportTime: Map<string, number> = new Map();
  private defaultOptions: ProgressOptions = {
    reportToCasey: true,
    reportToBlake: true,
    reportToBackground: true,
    includeDetails: true,
    throttleMs: 100
  };

  /**
   * Report workflow start
   */
  async reportWorkflowStart(
    workflowId: string, 
    name: string, 
    totalSteps: number, 
    options: ProgressOptions = {}
  ): Promise<void> {
    const report: ProgressReport = {
      workflowId,
      type: 'workflow_start',
      timestamp: Date.now(),
      data: {
        name,
        totalSteps
      }
    };
    
    await this.sendReport(report, options);
    this.updateWorkflowProgress(workflowId, {
      name,
      status: 'running',
      currentStep: 0,
      totalSteps,
      startTime: Date.now()
    });
  }

  /**
   * Report workflow completion
   */
  async reportWorkflowComplete(
    workflowId: string, 
    results: AutomationResponse[], 
    options: ProgressOptions = {}
  ): Promise<void> {
    const report: ProgressReport = {
      workflowId,
      type: 'workflow_complete',
      timestamp: Date.now(),
      data: {
        results,
        successCount: results.filter(r => r.success).length,
        errorCount: results.filter(r => !r.success).length
      }
    };
    
    await this.sendReport(report, options);
    this.updateWorkflowProgress(workflowId, {
      status: 'completed',
      endTime: Date.now(),
      duration: Date.now() - (this.workflowProgress.get(workflowId)?.startTime || Date.now())
    });
  }

  /**
   * Report workflow error
   */
  async reportWorkflowError(
    workflowId: string, 
    error: string, 
    options: ProgressOptions = {}
  ): Promise<void> {
    const report: ProgressReport = {
      workflowId,
      type: 'workflow_error',
      timestamp: Date.now(),
      message: error,
      data: {
        error
      }
    };
    
    await this.sendReport(report, options);
    this.updateWorkflowProgress(workflowId, {
      status: 'failed',
      endTime: Date.now(),
      duration: Date.now() - (this.workflowProgress.get(workflowId)?.startTime || Date.now())
    });
  }

  /**
   * Report workflow cancellation
   */
  async reportWorkflowCancelled(
    workflowId: string, 
    options: ProgressOptions = {}
  ): Promise<void> {
    const report: ProgressReport = {
      workflowId,
      type: 'workflow_cancelled',
      timestamp: Date.now(),
      data: {
        cancelledAt: Date.now()
      }
    };
    
    await this.sendReport(report, options);
    this.updateWorkflowProgress(workflowId, {
      status: 'cancelled',
      endTime: Date.now(),
      duration: Date.now() - (this.workflowProgress.get(workflowId)?.startTime || Date.now())
    });
  }

  /**
   * Report step start
   */
  async reportStepStart(
    workflowId: string, 
    stepNumber: number, 
    stepType: string, 
    options: ProgressOptions = {}
  ): Promise<void> {
    const report: ProgressReport = {
      workflowId,
      stepNumber,
      type: 'step_start',
      timestamp: Date.now(),
      data: {
        stepType
      }
    };
    
    await this.sendReport(report, options);
    this.updateStepProgress(workflowId, stepNumber, {
      type: stepType,
      status: 'started',
      startTime: Date.now()
    });
  }

  /**
   * Report step completion
   */
  async reportStepComplete(
    workflowId: string, 
    stepNumber: number, 
    result: AutomationResponse, 
    options: ProgressOptions = {}
  ): Promise<void> {
    const report: ProgressReport = {
      workflowId,
      stepNumber,
      type: 'step_complete',
      timestamp: Date.now(),
      data: {
        result: options.includeDetails ? result : {
          success: result.success,
          timestamp: result.timestamp
        }
      }
    };
    
    await this.sendReport(report, options);
    
    const stepProgress = this.stepProgress.get(workflowId) || [];
    const currentStep = stepProgress.find(s => s.stepNumber === stepNumber);
    
    if (currentStep) {
      currentStep.status = 'completed';
      currentStep.endTime = Date.now();
      currentStep.duration = Date.now() - currentStep.startTime;
      currentStep.data = result;
    }
    
    this.updateWorkflowProgress(workflowId, {
      currentStep: stepNumber
    });
  }

  /**
   * Report step error
   */
  async reportStepError(
    workflowId: string, 
    stepNumber: number, 
    error: string, 
    options: ProgressOptions = {}
  ): Promise<void> {
    const report: ProgressReport = {
      workflowId,
      stepNumber,
      type: 'step_error',
      timestamp: Date.now(),
      message: error,
      data: {
        error
      }
    };
    
    await this.sendReport(report, options);
    
    const stepProgress = this.stepProgress.get(workflowId) || [];
    const currentStep = stepProgress.find(s => s.stepNumber === stepNumber);
    
    if (currentStep) {
      currentStep.status = 'failed';
      currentStep.endTime = Date.now();
      currentStep.duration = Date.now() - currentStep.startTime;
      currentStep.error = error;
    }
    
    this.updateWorkflowProgress(workflowId, {
      currentStep: stepNumber
    });
  }

  /**
   * Send progress report
   */
  private async sendReport(report: ProgressReport, options: ProgressOptions): Promise<void> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    
    // Check throttling
    const lastTime = this.lastReportTime.get(report.workflowId || 'global') || 0;
    const now = Date.now();
    
    if (now - lastTime < (mergedOptions.throttleMs || 100)) {
      return; // Throttled
    }
    
    this.lastReportTime.set(report.workflowId || 'global', now);
    
    // Add to history
    if (!this.progressHistory.has(report.workflowId)) {
      this.progressHistory.set(report.workflowId, []);
    }
    
    this.progressHistory.get(report.workflowId)!.push(report);
    
    // Keep only recent reports
    const history = this.progressHistory.get(report.workflowId)!;
    if (history.length > 100) {
      history.splice(0, history.length - 100);
      this.progressHistory.set(report.workflowId, history);
    }
    
    // Send to Casey
    if (mergedOptions.reportToCasey !== false) {
      try {
        await this.sendToCasey(report, mergedOptions);
      } catch (error) {
        console.error('Failed to send report to Casey:', error);
      }
    }
    
    // Send to Blake
    if (mergedOptions.reportToBlake !== false) {
      try {
        await this.sendToBlake(report, mergedOptions);
      } catch (error) {
        console.error('Failed to send report to Blake:', error);
      }
    }
    
    // Send to background script
    if (mergedOptions.reportToBackground !== false) {
      try {
        await this.sendToBackground(report, mergedOptions);
      } catch (error) {
        console.error('Failed to send report to background:', error);
      }
    }
  }

  /**
   * Send report to Casey
   */
  private async sendToCasey(report: ProgressReport, options: ProgressOptions): Promise<void> {
    // This would send the report to Casey's command parser
    // For now, we'll use Chrome storage as a proxy
    const caseyReports = await chromeApi.getStorageData('casey_reports') || [];
    caseyReports.push(report);
    await chromeApi.setStorageData('casey_reports', caseyReports);
  }

  /**
   * Send report to Blake
   */
  private async sendToBlake(report: ProgressReport, options: ProgressOptions): Promise<void> {
    // This would send the report to Blake's UI components
    // For now, we'll use Chrome storage as a proxy
    const blakeReports = await chromeApi.getStorageData('blake_reports') || [];
    blakeReports.push(report);
    await chromeApi.setStorageData('blake_reports', blakeReports);
  }

  /**
   * Send report to background script
   */
  private async sendToBackground(report: ProgressReport, options: ProgressOptions): Promise<void> {
    try {
      const tab = await chromeApi.getActiveTab();
      await chromeApi.sendMessage(tab.id, {
        type: 'progress_report',
        data: report,
        options
      });
    } catch (error) {
      console.error('Failed to send report to background:', error);
    }
  }

  /**
   * Update workflow progress
   */
  private updateWorkflowProgress(workflowId: string, updates: Partial<WorkflowProgress>): void {
    const current = this.workflowProgress.get(workflowId) || {
      workflowId,
      name: '',
      status: 'running',
      currentStep: 0,
      totalSteps: 0,
      startTime: Date.now(),
      errors: [],
      warnings: []
    };
    
    Object.assign(current, updates);
    this.workflowProgress.set(workflowId, current);
  }

  /**
   * Update step progress
   */
  private updateStepProgress(workflowId: string, stepNumber: number, updates: Partial<StepProgress>): void {
    const steps = this.stepProgress.get(workflowId) || [];
    let step = steps.find(s => s.stepNumber === stepNumber);
    
    if (!step) {
      step = {
        stepNumber,
        type: '',
        status: 'started',
        startTime: Date.now()
      };
      steps.push(step);
      this.stepProgress.set(workflowId, steps);
    }
    
    Object.assign(step, updates);
  }

  /**
   * Get workflow progress
   */
  getWorkflowProgress(workflowId: string): WorkflowProgress | undefined {
    return this.workflowProgress.get(workflowId);
  }

  /**
   * Get step progress
   */
  getStepProgress(workflowId: string, stepNumber: number): StepProgress | undefined {
    const steps = this.stepProgress.get(workflowId) || [];
    return steps.find(s => s.stepNumber === stepNumber);
  }

  /**
   * Get progress history
   */
  getProgressHistory(workflowId?: string): ProgressReport[] {
    if (workflowId) {
      return this.progressHistory.get(workflowId) || [];
    }
    
    // Return all reports if no workflow ID
    const allReports: ProgressReport[] = [];
    this.progressHistory.forEach(reports => {
      allReports.push(...reports);
    });
    
    return allReports;
  }

  /**
   * Get progress statistics
   */
  getProgressStatistics(workflowId?: string): any {
    const allWorkflows = Array.from(this.workflowProgress.values());
    const allSteps = Array.from(this.stepProgress.values()).flat();
    
    let stats = {
      totalWorkflows: allWorkflows.length,
      totalSteps: allSteps.length,
      activeWorkflows: allWorkflows.filter(w => w.status === 'running').length,
      completedWorkflows: allWorkflows.filter(w => w.status === 'completed').length,
      failedWorkflows: allWorkflows.filter(w => w.status === 'failed').length,
      averageWorkflowDuration: 0,
      averageStepDuration: 0,
      totalReports: 0
    };
    
    if (workflowId) {
      const workflow = this.workflowProgress.get(workflowId);
      const steps = this.stepProgress.get(workflowId) || [];
      
      if (workflow) {
        stats = {
          ...stats,
          workflowName: workflow.name,
          workflowStatus: workflow.status,
          workflowDuration: workflow.duration,
          workflowSuccessRate: steps.length > 0 ? steps.filter(s => s.status === 'completed').length / steps.length : 0,
          currentStep: workflow.currentStep,
          totalSteps: workflow.totalSteps,
          completedSteps: steps.filter(s => s.status === 'completed').length,
          failedSteps: steps.filter(s => s.status === 'failed').length,
          averageStepDuration: steps.length > 0 ? steps.reduce((sum, s) => sum + (s.duration || 0), 0) / steps.length : 0
        };
      }
    }
    
    return stats;
  }

  /**
   * Set default options
   */
  setDefaultOptions(options: Partial<ProgressOptions>): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  /**
   * Clear progress history
   */
  clearProgressHistory(workflowId?: string): void {
    if (workflowId) {
      this.progressHistory.delete(workflowId);
      this.workflowProgress.delete(workflowId);
      this.stepProgress.delete(workflowId);
    } else {
      this.progressHistory.clear();
      this.workflowProgress.clear();
      this.stepProgress.clear();
    }
  }

  /**
   * Export progress data
   */
  async exportProgressData(workflowId?: string): Promise<any> {
    const data = {
      exportedAt: Date.now(),
      workflows: workflowId ? [this.workflowProgress.get(workflowId)] : Array.from(this.workflowProgress.values()),
      steps: workflowId ? this.stepProgress.get(workflowId) || [] : Array.from(this.stepProgress.values()).flat(),
      history: workflowId ? this.progressHistory.get(workflowId) || [] : this.getProgressHistory(),
      statistics: this.getProgressStatistics(workflowId)
    };
    
    // Export to storage
    await chromeApi.setStorageData(`progress_export_${Date.now()}`, data);
    
    return data;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.progressHistory.clear();
    this.workflowProgress.clear();
    this.stepProgress.clear();
    this.lastReportTime.clear();
  }
}

// Export singleton instance for convenience
export const progressReporting = new ProgressReporting(); * Progress reporting for browser automation
 * Handles status reporting to Casey and other components
 */

import { AutomationResponse, WorkflowState } from './automation-types';
import { chromeApi } from './chrome-api-wrappers';

export interface ProgressReport {
  workflowId?: string;
  stepNumber?: number;
  type: 'workflow_start' | 'workflow_complete' | 'workflow_error' | 'workflow_cancelled' | 'step_start' | 'step_complete' | 'step_error';
  timestamp: number;
  data?: any;
  message?: string;
}

export interface ProgressOptions {
  reportToCasey?: boolean;
  reportToBlake?: boolean;
  reportToBackground?: boolean;
  includeDetails?: boolean;
  throttleMs?: number;
}

export interface WorkflowProgress {
  workflowId: string;
  name: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep: number;
  totalSteps: number;
  startTime: number;
  endTime?: number;
  duration?: number;
  successRate?: number;
  averageStepDuration?: number;
  errors: string[];
  warnings: string[];
}

export interface StepProgress {
  stepNumber: number;
  type: string;
  status: 'started' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  duration?: number;
  error?: string;
  data?: any;
}

export class ProgressReporting {
  private progressHistory: Map<string, ProgressReport[]> = new Map();
  private workflowProgress: Map<string, WorkflowProgress> = new Map();
  private stepProgress: Map<string, StepProgress[]> = new Map();
  private lastReportTime: Map<string, number> = new Map();
  private defaultOptions: ProgressOptions = {
    reportToCasey: true,
    reportToBlake: true,
    reportToBackground: true,
    includeDetails: true,
    throttleMs: 100
  };

  /**
   * Report workflow start
   */
  async reportWorkflowStart(
    workflowId: string, 
    name: string, 
    totalSteps: number, 
    options: ProgressOptions = {}
  ): Promise<void> {
    const report: ProgressReport = {
      workflowId,
      type: 'workflow_start',
      timestamp: Date.now(),
      data: {
        name,
        totalSteps
      }
    };
    
    await this.sendReport(report, options);
    this.updateWorkflowProgress(workflowId, {
      name,
      status: 'running',
      currentStep: 0,
      totalSteps,
      startTime: Date.now()
    });
  }

  /**
   * Report workflow completion
   */
  async reportWorkflowComplete(
    workflowId: string, 
    results: AutomationResponse[], 
    options: ProgressOptions = {}
  ): Promise<void> {
    const report: ProgressReport = {
      workflowId,
      type: 'workflow_complete',
      timestamp: Date.now(),
      data: {
        results,
        successCount: results.filter(r => r.success).length,
        errorCount: results.filter(r => !r.success).length
      }
    };
    
    await this.sendReport(report, options);
    this.updateWorkflowProgress(workflowId, {
      status: 'completed',
      endTime: Date.now(),
      duration: Date.now() - (this.workflowProgress.get(workflowId)?.startTime || Date.now())
    });
  }

  /**
   * Report workflow error
   */
  async reportWorkflowError(
    workflowId: string, 
    error: string, 
    options: ProgressOptions = {}
  ): Promise<void> {
    const report: ProgressReport = {
      workflowId,
      type: 'workflow_error',
      timestamp: Date.now(),
      message: error,
      data: {
        error
      }
    };
    
    await this.sendReport(report, options);
    this.updateWorkflowProgress(workflowId, {
      status: 'failed',
      endTime: Date.now(),
      duration: Date.now() - (this.workflowProgress.get(workflowId)?.startTime || Date.now())
    });
  }

  /**
   * Report workflow cancellation
   */
  async reportWorkflowCancelled(
    workflowId: string, 
    options: ProgressOptions = {}
  ): Promise<void> {
    const report: ProgressReport = {
      workflowId,
      type: 'workflow_cancelled',
      timestamp: Date.now(),
      data: {
        cancelledAt: Date.now()
      }
    };
    
    await this.sendReport(report, options);
    this.updateWorkflowProgress(workflowId, {
      status: 'cancelled',
      endTime: Date.now(),
      duration: Date.now() - (this.workflowProgress.get(workflowId)?.startTime || Date.now())
    });
  }

  /**
   * Report step start
   */
  async reportStepStart(
    workflowId: string, 
    stepNumber: number, 
    stepType: string, 
    options: ProgressOptions = {}
  ): Promise<void> {
    const report: ProgressReport = {
      workflowId,
      stepNumber,
      type: 'step_start',
      timestamp: Date.now(),
      data: {
        stepType
      }
    };
    
    await this.sendReport(report, options);
    this.updateStepProgress(workflowId, stepNumber, {
      type: stepType,
      status: 'started',
      startTime: Date.now()
    });
  }

  /**
   * Report step completion
   */
  async reportStepComplete(
    workflowId: string, 
    stepNumber: number, 
    result: AutomationResponse, 
    options: ProgressOptions = {}
  ): Promise<void> {
    const report: ProgressReport = {
      workflowId,
      stepNumber,
      type: 'step_complete',
      timestamp: Date.now(),
      data: {
        result: options.includeDetails ? result : {
          success: result.success,
          timestamp: result.timestamp
        }
      }
    };
    
    await this.sendReport(report, options);
    
    const stepProgress = this.stepProgress.get(workflowId) || [];
    const currentStep = stepProgress.find(s => s.stepNumber === stepNumber);
    
    if (currentStep) {
      currentStep.status = 'completed';
      currentStep.endTime = Date.now();
      currentStep.duration = Date.now() - currentStep.startTime;
      currentStep.data = result;
    }
    
    this.updateWorkflowProgress(workflowId, {
      currentStep: stepNumber
    });
  }

  /**
   * Report step error
   */
  async reportStepError(
    workflowId: string, 
    stepNumber: number, 
    error: string, 
    options: ProgressOptions = {}
  ): Promise<void> {
    const report: ProgressReport = {
      workflowId,
      stepNumber,
      type: 'step_error',
      timestamp: Date.now(),
      message: error,
      data: {
        error
      }
    };
    
    await this.sendReport(report, options);
    
    const stepProgress = this.stepProgress.get(workflowId) || [];
    const currentStep = stepProgress.find(s => s.stepNumber === stepNumber);
    
    if (currentStep) {
      currentStep.status = 'failed';
      currentStep.endTime = Date.now();
      currentStep.duration = Date.now() - currentStep.startTime;
      currentStep.error = error;
    }
    
    this.updateWorkflowProgress(workflowId, {
      currentStep: stepNumber
    });
  }

  /**
   * Send progress report
   */
  private async sendReport(report: ProgressReport, options: ProgressOptions): Promise<void> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    
    // Check throttling
    const lastTime = this.lastReportTime.get(report.workflowId || 'global') || 0;
    const now = Date.now();
    
    if (now - lastTime < (mergedOptions.throttleMs || 100)) {
      return; // Throttled
    }
    
    this.lastReportTime.set(report.workflowId || 'global', now);
    
    // Add to history
    if (!this.progressHistory.has(report.workflowId)) {
      this.progressHistory.set(report.workflowId, []);
    }
    
    this.progressHistory.get(report.workflowId)!.push(report);
    
    // Keep only recent reports
    const history = this.progressHistory.get(report.workflowId)!;
    if (history.length > 100) {
      history.splice(0, history.length - 100);
      this.progressHistory.set(report.workflowId, history);
    }
    
    // Send to Casey
    if (mergedOptions.reportToCasey !== false) {
      try {
        await this.sendToCasey(report, mergedOptions);
      } catch (error) {
        console.error('Failed to send report to Casey:', error);
      }
    }
    
    // Send to Blake
    if (mergedOptions.reportToBlake !== false) {
      try {
        await this.sendToBlake(report, mergedOptions);
      } catch (error) {
        console.error('Failed to send report to Blake:', error);
      }
    }
    
    // Send to background script
    if (mergedOptions.reportToBackground !== false) {
      try {
        await this.sendToBackground(report, mergedOptions);
      } catch (error) {
        console.error('Failed to send report to background:', error);
      }
    }
  }

  /**
   * Send report to Casey
   */
  private async sendToCasey(report: ProgressReport, options: ProgressOptions): Promise<void> {
    // This would send the report to Casey's command parser
    // For now, we'll use Chrome storage as a proxy
    const caseyReports = await chromeApi.getStorageData('casey_reports') || [];
    caseyReports.push(report);
    await chromeApi.setStorageData('casey_reports', caseyReports);
  }

  /**
   * Send report to Blake
   */
  private async sendToBlake(report: ProgressReport, options: ProgressOptions): Promise<void> {
    // This would send the report to Blake's UI components
    // For now, we'll use Chrome storage as a proxy
    const blakeReports = await chromeApi.getStorageData('blake_reports') || [];
    blakeReports.push(report);
    await chromeApi.setStorageData('blake_reports', blakeReports);
  }

  /**
   * Send report to background script
   */
  private async sendToBackground(report: ProgressReport, options: ProgressOptions): Promise<void> {
    try {
      const tab = await chromeApi.getActiveTab();
      await chromeApi.sendMessage(tab.id, {
        type: 'progress_report',
        data: report,
        options
      });
    } catch (error) {
      console.error('Failed to send report to background:', error);
    }
  }

  /**
   * Update workflow progress
   */
  private updateWorkflowProgress(workflowId: string, updates: Partial<WorkflowProgress>): void {
    const current = this.workflowProgress.get(workflowId) || {
      workflowId,
      name: '',
      status: 'running',
      currentStep: 0,
      totalSteps: 0,
      startTime: Date.now(),
      errors: [],
      warnings: []
    };
    
    Object.assign(current, updates);
    this.workflowProgress.set(workflowId, current);
  }

  /**
   * Update step progress
   */
  private updateStepProgress(workflowId: string, stepNumber: number, updates: Partial<StepProgress>): void {
    const steps = this.stepProgress.get(workflowId) || [];
    let step = steps.find(s => s.stepNumber === stepNumber);
    
    if (!step) {
      step = {
        stepNumber,
        type: '',
        status: 'started',
        startTime: Date.now()
      };
      steps.push(step);
      this.stepProgress.set(workflowId, steps);
    }
    
    Object.assign(step, updates);
  }

  /**
   * Get workflow progress
   */
  getWorkflowProgress(workflowId: string): WorkflowProgress | undefined {
    return this.workflowProgress.get(workflowId);
  }

  /**
   * Get step progress
   */
  getStepProgress(workflowId: string, stepNumber: number): StepProgress | undefined {
    const steps = this.stepProgress.get(workflowId) || [];
    return steps.find(s => s.stepNumber === stepNumber);
  }

  /**
   * Get progress history
   */
  getProgressHistory(workflowId?: string): ProgressReport[] {
    if (workflowId) {
      return this.progressHistory.get(workflowId) || [];
    }
    
    // Return all reports if no workflow ID
    const allReports: ProgressReport[] = [];
    this.progressHistory.forEach(reports => {
      allReports.push(...reports);
    });
    
    return allReports;
  }

  /**
   * Get progress statistics
   */
  getProgressStatistics(workflowId?: string): any {
    const allWorkflows = Array.from(this.workflowProgress.values());
    const allSteps = Array.from(this.stepProgress.values()).flat();
    
    let stats = {
      totalWorkflows: allWorkflows.length,
      totalSteps: allSteps.length,
      activeWorkflows: allWorkflows.filter(w => w.status === 'running').length,
      completedWorkflows: allWorkflows.filter(w => w.status === 'completed').length,
      failedWorkflows: allWorkflows.filter(w => w.status === 'failed').length,
      averageWorkflowDuration: 0,
      averageStepDuration: 0,
      totalReports: 0
    };
    
    if (workflowId) {
      const workflow = this.workflowProgress.get(workflowId);
      const steps = this.stepProgress.get(workflowId) || [];
      
      if (workflow) {
        stats = {
          ...stats,
          workflowName: workflow.name,
          workflowStatus: workflow.status,
          workflowDuration: workflow.duration,
          workflowSuccessRate: steps.length > 0 ? steps.filter(s => s.status === 'completed').length / steps.length : 0,
          currentStep: workflow.currentStep,
          totalSteps: workflow.totalSteps,
          completedSteps: steps.filter(s => s.status === 'completed').length,
          failedSteps: steps.filter(s => s.status === 'failed').length,
          averageStepDuration: steps.length > 0 ? steps.reduce((sum, s) => sum + (s.duration || 0), 0) / steps.length : 0
        };
      }
    }
    
    return stats;
  }

  /**
   * Set default options
   */
  setDefaultOptions(options: Partial<ProgressOptions>): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  /**
   * Clear progress history
   */
  clearProgressHistory(workflowId?: string): void {
    if (workflowId) {
      this.progressHistory.delete(workflowId);
      this.workflowProgress.delete(workflowId);
      this.stepProgress.delete(workflowId);
    } else {
      this.progressHistory.clear();
      this.workflowProgress.clear();
      this.stepProgress.clear();
    }
  }

  /**
   * Export progress data
   */
  async exportProgressData(workflowId?: string): Promise<any> {
    const data = {
      exportedAt: Date.now(),
      workflows: workflowId ? [this.workflowProgress.get(workflowId)] : Array.from(this.workflowProgress.values()),
      steps: workflowId ? this.stepProgress.get(workflowId) || [] : Array.from(this.stepProgress.values()).flat(),
      history: workflowId ? this.progressHistory.get(workflowId) || [] : this.getProgressHistory(),
      statistics: this.getProgressStatistics(workflowId)
    };
    
    // Export to storage
    await chromeApi.setStorageData(`progress_export_${Date.now()}`, data);
    
    return data;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.progressHistory.clear();
    this.workflowProgress.clear();
    this.stepProgress.clear();
    this.lastReportTime.clear();
  }
}

// Export singleton instance for convenience
export const progressReporting = new ProgressReporting();
