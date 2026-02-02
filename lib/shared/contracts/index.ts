/**
 * Shared contracts and interfaces for the Ray Chrome Extension
 * These contracts define the communication protocols between different agents
 */

// Command processing contract (Casey ↔ Dakota)
export interface AutomationCommand {
  id: string;
  type: 'navigate' | 'click' | 'fill' | 'scroll' | 'submit' | 'extract' | 'wait';
  selector?: string;
  value?: string;
  url?: string;
  tabId?: number;
  timeout?: number;
  options?: Record<string, any>;
}

// UI feedback contract (Blake ↔ Casey)
export interface UIStatus {
  status: 'idle' | 'processing' | 'success' | 'error' | 'waiting';
  message: string;
  progress?: number;
  currentStep?: string;
  totalSteps?: number;
  timestamp: number;
}

// Security contract (Ellis ↔ All)
export interface SecurityValidation {
  isValid: boolean;
  errors: string[];
  permissions: string[];
  warnings: string[];
  requiresUserAction?: boolean;
}

// Message passing protocol
export interface AgentMessage {
  from: string;
  to: string;
  type: 'command' | 'status' | 'error' | 'security' | 'test' | 'response';
  payload: any;
  timestamp: number;
  id: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
}

// Command types for natural language processing
export interface ParsedCommand {
  intent: string;
  entities: Record<string, any>;
  parameters: Record<string, any>;
  confidence: number;
  requiresClarification: boolean;
  clarificationQuestion?: string;
}

// Execution context for workflows
export interface ExecutionContext {
  id: string;
  userId: string;
  tabId?: number;
  url?: string;
  timestamp: number;
  variables: Record<string, any>;
  history: AutomationCommand[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
}

// OpenRouter API response types
export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
}

export interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: OpenRouterMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Error types
export interface RayError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
  stack?: string;
}

// Learning system data
export interface CommandPattern {
  id: string;
  pattern: string;
  intent: string;
  parameters: Record<string, any>;
  successCount: number;
  failureCount: number;
  lastUsed: number;
  confidence: number;
}

// Cache entry
export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
} * Shared contracts and interfaces for the Ray Chrome Extension
 * These contracts define the communication protocols between different agents
 */

// Command processing contract (Casey ↔ Dakota)
export interface AutomationCommand {
  id: string;
  type: 'navigate' | 'click' | 'fill' | 'scroll' | 'submit' | 'extract' | 'wait';
  selector?: string;
  value?: string;
  url?: string;
  tabId?: number;
  timeout?: number;
  options?: Record<string, any>;
}

// UI feedback contract (Blake ↔ Casey)
export interface UIStatus {
  status: 'idle' | 'processing' | 'success' | 'error' | 'waiting';
  message: string;
  progress?: number;
  currentStep?: string;
  totalSteps?: number;
  timestamp: number;
}

// Security contract (Ellis ↔ All)
export interface SecurityValidation {
  isValid: boolean;
  errors: string[];
  permissions: string[];
  warnings: string[];
  requiresUserAction?: boolean;
}

// Message passing protocol
export interface AgentMessage {
  from: string;
  to: string;
  type: 'command' | 'status' | 'error' | 'security' | 'test' | 'response';
  payload: any;
  timestamp: number;
  id: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
}

// Command types for natural language processing
export interface ParsedCommand {
  intent: string;
  entities: Record<string, any>;
  parameters: Record<string, any>;
  confidence: number;
  requiresClarification: boolean;
  clarificationQuestion?: string;
}

// Execution context for workflows
export interface ExecutionContext {
  id: string;
  userId: string;
  tabId?: number;
  url?: string;
  timestamp: number;
  variables: Record<string, any>;
  history: AutomationCommand[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
}

// OpenRouter API response types
export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
}

export interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: OpenRouterMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Error types
export interface RayError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
  stack?: string;
}

// Learning system data
export interface CommandPattern {
  id: string;
  pattern: string;
  intent: string;
  parameters: Record<string, any>;
  successCount: number;
  failureCount: number;
  lastUsed: number;
  confidence: number;
}

// Cache entry
export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
}
