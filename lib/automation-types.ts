/**
 * Type definitions for browser automation commands and responses
 */

// Base automation command interface
export interface AutomationCommand {
  id: string;
  type: AutomationCommandType;
  timestamp: number;
}

// Navigation command
export interface NavigateCommand extends AutomationCommand {
  type: 'navigate';
  url: string;
  tabId?: number;
}

// Click command
export interface ClickCommand extends AutomationCommand {
  type: 'click';
  selector: string;
  tabId?: number;
  waitForSelector?: boolean;
  timeout?: number;
}

// Form fill command
export interface FillFormCommand extends AutomationCommand {
  type: 'fillForm';
  selector: string;
  value: string;
  tabId?: number;
  clearFirst?: boolean;
}

// Type command
export interface TypeCommand extends AutomationCommand {
  type: 'type';
  selector: string;
  text: string;
  tabId?: number;
  clearFirst?: boolean;
  delay?: number;
}

// Scroll command
export interface ScrollCommand extends AutomationCommand {
  type: 'scroll';
  direction: 'up' | 'down' | 'left' | 'right' | 'top' | 'bottom';
  amount?: number;
  selector?: string;
  tabId?: number;
}

// Wait command
export interface WaitCommand extends AutomationCommand {
  type: 'wait';
  duration: number;
  tabId?: number;
}

// Wait for element command
export interface WaitForElementCommand extends AutomationCommand {
  type: 'waitForElement';
  selector: string;
  timeout?: number;
  tabId?: number;
}

// Extract text command
export interface ExtractTextCommand extends AutomationCommand {
  type: 'extractText';
  selector: string;
  attribute?: string;
  tabId?: number;
}

// Screenshot command
export interface ScreenshotCommand extends AutomationCommand {
  type: 'screenshot';
  format?: 'png' | 'jpeg';
  quality?: number;
  tabId?: number;
}

// Create tab command
export interface CreateTabCommand extends AutomationCommand {
  type: 'createTab';
  url: string;
  active?: boolean;
}

// Close tab command
export interface CloseTabCommand extends AutomationCommand {
  type: 'closeTab';
  tabId: number;
}

// Switch tab command
export interface SwitchTabCommand extends AutomationCommand {
  type: 'switchTab';
  tabId: number;
}

// Workflow command for multi-step operations
export interface WorkflowCommand extends AutomationCommand {
  type: 'workflow';
  name: string;
  steps: AutomationCommand[];
  context?: Record<string, any>;
}

// Union type for all automation commands
export type AutomationCommandType =
  | 'navigate'
  | 'click'
  | 'fillForm'
  | 'type'
  | 'scroll'
  | 'wait'
  | 'waitForElement'
  | 'extractText'
  | 'screenshot'
  | 'createTab'
  | 'closeTab'
  | 'switchTab'
  | 'workflow';

export type AnyAutomationCommand =
  | NavigateCommand
  | ClickCommand
  | FillFormCommand
  | TypeCommand
  | ScrollCommand
  | WaitCommand
  | WaitForElementCommand
  | ExtractTextCommand
  | ScreenshotCommand
  | CreateTabCommand
  | CloseTabCommand
  | SwitchTabCommand
  | WorkflowCommand;

// Response types
export interface AutomationResponse {
  commandId: string;
  success: boolean;
  timestamp: number;
  data?: any;
  error?: AutomationError;
}

export interface AutomationError {
  code: string;
  message: string;
  details?: any;
}

// Tab information
export interface TabInfo {
  id: number;
  url: string;
  title: string;
  active: boolean;
  windowId: number;
}

// Workflow execution state
export interface WorkflowState {
  id: string;
  name: string;
  currentStep: number;
  totalSteps: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: number;
  endTime?: number;
  context: Record<string, any>;
  results: AutomationResponse[];
}

// Element selector strategies
export type SelectorStrategy =
  | 'css'
  | 'xpath'
  | 'text'
  | 'attribute'
  | 'index';

export interface ElementSelector {
  strategy: SelectorStrategy;
  value: string;
  attribute?: string;
  index?: number;
}

// Wait strategies
export type WaitStrategy =
  | 'visible'
  | 'present'
  | 'clickable'
  | 'hidden';

// Performance metrics
export interface PerformanceMetrics {
  commandType: string;
  startTime: number;
  endTime: number;
  duration: number;
  memoryUsage?: number;
  success: boolean;
}

// Automation configuration
export interface AutomationConfig {
  defaultTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  enablePerformanceMonitoring: boolean;
  enableSelectorCaching: boolean;
  maxConcurrentWorkflows: number;
}

// Base command options
export interface AutomationOptions {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  continueOnError?: boolean;
}

// Workflow step
export interface WorkflowStep {
  id: string;
  name: string;
  command: AnyAutomationCommand;
  dependencies?: string[];
  condition?: string;
}

// Workflow execution result
export interface WorkflowExecutionResult {
  success: boolean;
  workflowId: string;
  executedSteps: WorkflowStep[];
  results: AutomationResponse[];
  error?: string;
  timestamp: number;
}
