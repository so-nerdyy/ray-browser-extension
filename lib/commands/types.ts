/**
 * Command type definitions for natural language processing
 */

import { AutomationCommand, ParsedCommand, ExecutionContext } from '../shared/contracts';

// Command intent types
export type CommandIntent = 
  | 'navigate'
  | 'click'
  | 'fill'
  | 'scroll'
  | 'submit'
  | 'extract'
  | 'wait'
  | 'search'
  | 'login'
  | 'logout'
  | 'select'
  | 'hover'
  | 'drag'
  | 'upload'
  | 'download'
  | 'screenshot'
  | 'unknown';

// Entity types extracted from natural language
export interface CommandEntities {
  urls?: string[];
  selectors?: string[];
  text?: string[];
  numbers?: number[];
  dates?: Date[];
  coordinates?: { x: number; y: number }[];
  fileTypes?: string[];
  waitTimes?: number[];
  directions?: 'up' | 'down' | 'left' | 'right';
}

// Command parameters
export interface CommandParameters {
  // Navigation parameters
  url?: string;
  newTab?: boolean;
  
  // Interaction parameters
  selector?: string;
  value?: string;
  text?: string;
  
  // Form parameters
  fieldName?: string;
  fieldType?: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' | 'checkbox' | 'radio';
  
  // Scrolling parameters
  direction?: 'up' | 'down' | 'left' | 'right';
  amount?: number | 'page' | 'to_element' | 'to_top' | 'to_bottom';
  
  // Waiting parameters
  duration?: number;
  condition?: string;
  timeout?: number;
  
  // Extraction parameters
  extractType?: 'text' | 'html' | 'attributes' | 'links' | 'images' | 'data';
  outputFormat?: 'json' | 'text' | 'csv';
  
  // Search parameters
  query?: string;
  searchEngine?: 'google' | 'bing' | 'duckduckgo' | 'custom';
  
  // File parameters
  filePath?: string;
  fileName?: string;
  
  // Screenshot parameters
  fullPage?: boolean;
  region?: { x: number; y: number; width: number; height: number };
  format?: 'png' | 'jpeg';
  
  // Custom options
  options?: Record<string, any>;
}

// Parsed command with enhanced information
export interface EnhancedParsedCommand extends ParsedCommand {
  intent: CommandIntent;
  entities: CommandEntities;
  parameters: CommandParameters;
  originalText: string;
  language: string;
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedDuration?: number;
  requiredPermissions: string[];
  securityLevel: 'low' | 'medium' | 'high';
}

// Command pattern for matching
export interface CommandPattern {
  id: string;
  pattern: RegExp;
  intent: CommandIntent;
  parameters: CommandParameters;
  examples: string[];
  confidence: number;
  requiredEntities: string[];
  optionalEntities: string[];
}

// Multi-step command workflow
export interface CommandWorkflow {
  id: string;
  name: string;
  description: string;
  steps: AutomationCommand[];
  conditions?: WorkflowCondition[];
  variables?: Record<string, any>;
  estimatedDuration: number;
  requiredPermissions: string[];
}

// Workflow conditions
export interface WorkflowCondition {
  type: 'url' | 'element' | 'text' | 'custom';
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'exists' | 'not_exists';
  value: string;
  selector?: string;
}

// Command context for parsing
export interface CommandContext {
  currentUrl?: string;
  pageTitle?: string;
  pageLanguage?: string;
  availableElements?: ElementInfo[];
  previousCommands?: string[];
  userPreferences?: UserPreferences;
  sessionInfo?: SessionInfo;
}

// Element information from the page
export interface ElementInfo {
  selector: string;
  text: string;
  type: string;
  id?: string;
  classes?: string[];
  attributes?: Record<string, string>;
  visible: boolean;
  clickable: boolean;
  fillable: boolean;
}

// User preferences
export interface UserPreferences {
  language: string;
  defaultSearchEngine: string;
  securityLevel: 'low' | 'medium' | 'high';
  enableAutoCorrection: boolean;
  enableSuggestions: boolean;
  customPatterns?: CommandPattern[];
}

// Session information
export interface SessionInfo {
  id: string;
  startTime: number;
  commandCount: number;
  successRate: number;
  averageResponseTime: number;
  lastActivity: number;
}

// Parsing result
export interface ParsingResult {
  commands: EnhancedParsedCommand[];
  workflows: CommandWorkflow[];
  confidence: number;
  requiresClarification: boolean;
  clarificationQuestions?: string[];
  suggestions?: string[];
  errors: string[];
  warnings: string[];
  processingTime: number;
}

// Language detection result
export interface LanguageDetection {
  language: string;
  confidence: number;
  alternatives: Array<{ language: string; confidence: number }>;
}

// Command classification
export interface CommandClassification {
  category: 'navigation' | 'interaction' | 'data_extraction' | 'form_handling' | 'utility' | 'security';
  subcategory: string;
  riskLevel: 'low' | 'medium' | 'high';
  requiresConfirmation: boolean;
}

// Error types for command parsing
export interface CommandParsingError {
  code: string;
  message: string;
  position?: number;
  suggestion?: string;
  severity: 'error' | 'warning' | 'info';
} * Command type definitions for natural language processing
 */

import { AutomationCommand, ParsedCommand, ExecutionContext } from '../shared/contracts';

// Command intent types
export type CommandIntent = 
  | 'navigate'
  | 'click'
  | 'fill'
  | 'scroll'
  | 'submit'
  | 'extract'
  | 'wait'
  | 'search'
  | 'login'
  | 'logout'
  | 'select'
  | 'hover'
  | 'drag'
  | 'upload'
  | 'download'
  | 'screenshot'
  | 'unknown';

// Entity types extracted from natural language
export interface CommandEntities {
  urls?: string[];
  selectors?: string[];
  text?: string[];
  numbers?: number[];
  dates?: Date[];
  coordinates?: { x: number; y: number }[];
  fileTypes?: string[];
  waitTimes?: number[];
  directions?: 'up' | 'down' | 'left' | 'right';
}

// Command parameters
export interface CommandParameters {
  // Navigation parameters
  url?: string;
  newTab?: boolean;
  
  // Interaction parameters
  selector?: string;
  value?: string;
  text?: string;
  
  // Form parameters
  fieldName?: string;
  fieldType?: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' | 'checkbox' | 'radio';
  
  // Scrolling parameters
  direction?: 'up' | 'down' | 'left' | 'right';
  amount?: number | 'page' | 'to_element' | 'to_top' | 'to_bottom';
  
  // Waiting parameters
  duration?: number;
  condition?: string;
  timeout?: number;
  
  // Extraction parameters
  extractType?: 'text' | 'html' | 'attributes' | 'links' | 'images' | 'data';
  outputFormat?: 'json' | 'text' | 'csv';
  
  // Search parameters
  query?: string;
  searchEngine?: 'google' | 'bing' | 'duckduckgo' | 'custom';
  
  // File parameters
  filePath?: string;
  fileName?: string;
  
  // Screenshot parameters
  fullPage?: boolean;
  region?: { x: number; y: number; width: number; height: number };
  format?: 'png' | 'jpeg';
  
  // Custom options
  options?: Record<string, any>;
}

// Parsed command with enhanced information
export interface EnhancedParsedCommand extends ParsedCommand {
  intent: CommandIntent;
  entities: CommandEntities;
  parameters: CommandParameters;
  originalText: string;
  language: string;
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedDuration?: number;
  requiredPermissions: string[];
  securityLevel: 'low' | 'medium' | 'high';
}

// Command pattern for matching
export interface CommandPattern {
  id: string;
  pattern: RegExp;
  intent: CommandIntent;
  parameters: CommandParameters;
  examples: string[];
  confidence: number;
  requiredEntities: string[];
  optionalEntities: string[];
}

// Multi-step command workflow
export interface CommandWorkflow {
  id: string;
  name: string;
  description: string;
  steps: AutomationCommand[];
  conditions?: WorkflowCondition[];
  variables?: Record<string, any>;
  estimatedDuration: number;
  requiredPermissions: string[];
}

// Workflow conditions
export interface WorkflowCondition {
  type: 'url' | 'element' | 'text' | 'custom';
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'exists' | 'not_exists';
  value: string;
  selector?: string;
}

// Command context for parsing
export interface CommandContext {
  currentUrl?: string;
  pageTitle?: string;
  pageLanguage?: string;
  availableElements?: ElementInfo[];
  previousCommands?: string[];
  userPreferences?: UserPreferences;
  sessionInfo?: SessionInfo;
}

// Element information from the page
export interface ElementInfo {
  selector: string;
  text: string;
  type: string;
  id?: string;
  classes?: string[];
  attributes?: Record<string, string>;
  visible: boolean;
  clickable: boolean;
  fillable: boolean;
}

// User preferences
export interface UserPreferences {
  language: string;
  defaultSearchEngine: string;
  securityLevel: 'low' | 'medium' | 'high';
  enableAutoCorrection: boolean;
  enableSuggestions: boolean;
  customPatterns?: CommandPattern[];
}

// Session information
export interface SessionInfo {
  id: string;
  startTime: number;
  commandCount: number;
  successRate: number;
  averageResponseTime: number;
  lastActivity: number;
}

// Parsing result
export interface ParsingResult {
  commands: EnhancedParsedCommand[];
  workflows: CommandWorkflow[];
  confidence: number;
  requiresClarification: boolean;
  clarificationQuestions?: string[];
  suggestions?: string[];
  errors: string[];
  warnings: string[];
  processingTime: number;
}

// Language detection result
export interface LanguageDetection {
  language: string;
  confidence: number;
  alternatives: Array<{ language: string; confidence: number }>;
}

// Command classification
export interface CommandClassification {
  category: 'navigation' | 'interaction' | 'data_extraction' | 'form_handling' | 'utility' | 'security';
  subcategory: string;
  riskLevel: 'low' | 'medium' | 'high';
  requiresConfirmation: boolean;
}

// Error types for command parsing
export interface CommandParsingError {
  code: string;
  message: string;
  position?: number;
  suggestion?: string;
  severity: 'error' | 'warning' | 'info';
}
