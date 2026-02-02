/**
 * Execution Status Component
 * Displays real-time progress, status updates, and step-by-step execution tracking
 */

export type StatusType = 'idle' | 'processing' | 'success' | 'error';

export interface StatusUpdate {
  status: StatusType;
  message: string;
  progress?: number;
  currentStep?: string;
  timestamp?: number;
}

export interface ExecutionStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  duration?: number;
  error?: string;
}

export interface ExecutionStatusOptions {
  showProgress?: boolean;
  showSteps?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number;
  maxSteps?: number;
}

export interface ExecutionStatusEvents {
  statusChange: (status: StatusUpdate) => void;
  stepComplete: (step: ExecutionStep) => void;
  executionComplete: (status: StatusUpdate) => void;
}

export class ExecutionStatus {
  private container: HTMLElement;
  private statusIcon: HTMLElement;
  private statusText: HTMLElement;
  private progressContainer: HTMLElement;
  private progressFill: HTMLElement;
  private progressText: HTMLElement;
  private stepDetails: HTMLElement;
  private currentStepElement: HTMLElement;
  private options: Required<ExecutionStatusOptions>;
  private events: Partial<ExecutionStatusEvents>;
  private currentStatus: StatusUpdate;
  private executionSteps: ExecutionStep[] = [];
  private autoHideTimer: number | null = null;
  private startTime: number | null = null;

  constructor(
    containerId: string,
    statusIconId: string,
    statusTextId: string,
    progressContainerId: string,
    progressFillId: string,
    progressTextId: string,
    stepDetailsId: string,
    currentStepId: string,
    options: ExecutionStatusOptions = {},
    events: Partial<ExecutionStatusEvents> = {}
  ) {
    // Get DOM elements
    this.container = document.getElementById(containerId) as HTMLElement;
    this.statusIcon = document.getElementById(statusIconId) as HTMLElement;
    this.statusText = document.getElementById(statusTextId) as HTMLElement;
    this.progressContainer = document.getElementById(progressContainerId) as HTMLElement;
    this.progressFill = document.getElementById(progressFillId) as HTMLElement;
    this.progressText = document.getElementById(progressTextId) as HTMLElement;
    this.stepDetails = document.getElementById(stepDetailsId) as HTMLElement;
    this.currentStepElement = document.getElementById(currentStepId) as HTMLElement;

    if (!this.container || !this.statusIcon || !this.statusText ||
        !this.progressContainer || !this.progressFill || !this.progressText ||
        !this.stepDetails || !this.currentStepElement) {
      throw new Error('Required DOM elements not found');
    }

    // Set default options
    this.options = {
      showProgress: options.showProgress !== false, // Default to true
      showSteps: options.showSteps !== false, // Default to true
      autoHide: options.autoHide === true, // Default to false
      autoHideDelay: options.autoHideDelay || 3000, // Default 3 seconds
      maxSteps: options.maxSteps || 10 // Default 10 steps
    };

    this.events = events;

    // Initialize current status
    this.currentStatus = {
      status: 'idle',
      message: 'Ready to execute commands',
      timestamp: Date.now()
    };

    // Initialize the component
    this.init();
  }

  private init(): void {
    // Set initial status
    this.updateStatus(this.currentStatus);

    // Hide progress and steps initially
    this.progressContainer.hidden = !this.options.showProgress;
    this.stepDetails.hidden = !this.options.showSteps;
  }

  public updateStatus(statusUpdate: StatusUpdate): void {
    // Update current status
    this.currentStatus = {
      ...statusUpdate,
      timestamp: statusUpdate.timestamp || Date.now()
    };

    // Update UI elements
    this.updateStatusIcon(statusUpdate.status);
    this.updateStatusText(statusUpdate.message);

    if (statusUpdate.progress !== undefined && this.options.showProgress) {
      this.updateProgress(statusUpdate.progress);
    }

    if (statusUpdate.currentStep && this.options.showSteps) {
      this.updateCurrentStep(statusUpdate.currentStep);
    }

    // Show/hide container based on status
    this.updateContainerVisibility(statusUpdate.status);

    // Trigger events
    this.events.statusChange?.(this.currentStatus);

    // Handle completion
    if (statusUpdate.status === 'success' || statusUpdate.status === 'error') {
      this.handleExecutionComplete(statusUpdate);
    }
  }

  private updateStatusIcon(status: StatusType): void {
    // Remove all status classes
    this.statusIcon.classList.remove('idle', 'processing', 'success', 'error');

    // Add current status class
    this.statusIcon.classList.add(status);

    // Update icon based on status
    switch (status) {
      case 'idle':
        this.statusIcon.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        `;
        break;
      case 'processing':
        this.statusIcon.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6"></path>
            <path d="M1 20v-6h6"></path>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"></path>
          </svg>
        `;
        break;
      case 'success':
        this.statusIcon.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        `;
        break;
      case 'error':
        this.statusIcon.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        `;
        break;
    }
  }

  private updateStatusText(message: string): void {
    this.statusText.textContent = message;
  }

  private updateProgress(progress: number): void {
    // Ensure progress is within bounds
    const clampedProgress = Math.max(0, Math.min(100, progress));

    // Update progress bar
    this.progressFill.style.width = `${clampedProgress}%`;

    // Update progress text
    this.progressText.textContent = `${Math.round(clampedProgress)}%`;

    // Update ARIA attribute
    this.progressContainer.setAttribute('aria-valuenow', clampedProgress.toString());
  }

  private updateCurrentStep(stepName: string): void {
    this.currentStepElement.textContent = stepName;
  }

  private updateContainerVisibility(status: StatusType): void {
    if (status === 'idle') {
      this.container.hidden = true;
    } else {
      this.container.hidden = false;
    }
  }

  private handleExecutionComplete(statusUpdate: StatusUpdate): void {
    // Calculate total execution time
    const totalTime = this.startTime ? Date.now() - this.startTime : 0;

    // Update final status message with timing
    if (statusUpdate.status === 'success') {
      this.updateStatusText(`${statusUpdate.message} (completed in ${this.formatDuration(totalTime)})`);
    } else if (statusUpdate.status === 'error') {
      this.updateStatusText(`${statusUpdate.message} (failed after ${this.formatDuration(totalTime)})`);
    }

    // Trigger completion event
    this.events.executionComplete?.(statusUpdate);

    // Auto-hide if enabled
    if (this.options.autoHide) {
      this.scheduleAutoHide();
    }
  }

  private scheduleAutoHide(): void {
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
    }

    this.autoHideTimer = window.setTimeout(() => {
      this.hide();
    }, this.options.autoHideDelay);
  }

  private formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    } else if (milliseconds < 60000) {
      return `${(milliseconds / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(milliseconds / 60000);
      const seconds = Math.floor((milliseconds % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    }
  }

  public startExecution(message: string = 'Starting execution...', steps?: string[]): void {
    // Reset state
    this.executionSteps = [];
    this.startTime = Date.now();

    // Clear auto-hide timer
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }

    // Create steps if provided
    if (steps && steps.length > 0) {
      steps.slice(0, this.options.maxSteps).forEach((stepName, index) => {
        this.executionSteps.push({
          id: `step-${index}`,
          name: stepName,
          status: 'pending'
        });
      });
    }

    // Update status
    this.updateStatus({
      status: 'processing',
      message,
      progress: 0
    });
  }

  public updateExecutionProgress(progress: number, message?: string, currentStep?: string): void {
    this.updateStatus({
      status: 'processing',
      message: message || this.currentStatus.message,
      progress,
      currentStep
    });
  }

  public addExecutionStep(stepName: string): string {
    const stepId = `step-${this.executionSteps.length}`;
    const step: ExecutionStep = {
      id: stepId,
      name: stepName,
      status: 'pending'
    };

    this.executionSteps.push(step);
    return stepId;
  }

  public startStep(stepId: string): void {
    const step = this.executionSteps.find(s => s.id === stepId);
    if (step) {
      step.status = 'running';
      step.startTime = Date.now();
      this.updateCurrentStep(step.name);
    }
  }

  public completeStep(stepId: string, success: boolean = true, error?: string): void {
    const step = this.executionSteps.find(s => s.id === stepId);
    if (step) {
      step.status = success ? 'completed' : 'failed';
      step.endTime = Date.now();

      if (step.startTime) {
        step.duration = step.endTime - step.startTime;
      }

      if (!success && error) {
        step.error = error;
      }

      // Trigger step complete event
      this.events.stepComplete?.(step);
    }
  }

  public completeExecution(success: boolean, message?: string): void {
    const status: StatusType = success ? 'success' : 'error';
    const defaultMessage = success ? 'Execution completed successfully' : 'Execution failed';

    this.updateStatus({
      status,
      message: message || defaultMessage,
      progress: 100
    });
  }

  public setError(message: string, error?: Error): void {
    this.updateStatus({
      status: 'error',
      message,
      progress: this.currentStatus.progress
    });
  }

  public reset(): void {
    // Clear auto-hide timer
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }

    // Reset state
    this.executionSteps = [];
    this.startTime = null;

    // Reset UI
    this.updateStatus({
      status: 'idle',
      message: 'Ready to execute commands'
    });

    this.updateProgress(0);
    this.updateCurrentStep('');
  }

  public show(): void {
    this.container.hidden = false;
  }

  public hide(): void {
    this.container.hidden = true;
  }

  public isVisible(): boolean {
    return !this.container.hidden;
  }

  public getCurrentStatus(): StatusUpdate {
    return { ...this.currentStatus };
  }

  public getExecutionSteps(): ExecutionStep[] {
    return [...this.executionSteps];
  }

  public getExecutionTime(): number {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime;
  }

  public destroy(): void {
    // Clear auto-hide timer
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
    }

    // Remove event listeners and clean up
    this.executionSteps = [];
    this.startTime = null;
  }
}
