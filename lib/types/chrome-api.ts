/**
 * Chrome Extension API Type Definitions
 * Provides type-safe interfaces for Chrome Extension APIs used across the project
 */

export interface TabInfo {
  id: number;
  url: string;
  title: string;
  active: boolean;
  windowId: number;
}

export interface ScriptInjectionOptions {
  target: {
    tabId: number;
    frameIds?: number[];
    allFrames?: boolean;
  };
  func: () => any;
  args?: any[];
  world?: 'ISOLATED' | 'MAIN';
}

export interface StorageOptions {
  area?: 'local' | 'sync';
}

export interface StorageData {
  [key: string]: any;
}

export interface PermissionRequest {
  permissions: string[];
  origins?: string[];
}

/**
 * Message passing interface for extension communication
 */
export interface ExtensionMessage {
  type: string;
  payload: any;
  tabId?: number;
  frameId?: number;
  timestamp?: number;
}

/**
 * Automation command interface for browser automation
 */
export interface AutomationCommand {
  id: string;
  type: 'navigate' | 'click' | 'fill' | 'scroll' | 'submit' | 'wait' | 'extract';
  selector?: string;
  value?: string;
  url?: string;
  tabId?: number;
  timeout?: number;
  options?: Record<string, any>;
}

/**
 * Response interface for automation commands
 */
export interface AutomationResponse {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
  timestamp: number;
} * Chrome Extension API Type Definitions
 * Provides type-safe interfaces for Chrome Extension APIs used across the project
 */

export interface TabInfo {
  id: number;
  url: string;
  title: string;
  active: boolean;
  windowId: number;
}

export interface ScriptInjectionOptions {
  target: {
    tabId: number;
    frameIds?: number[];
    allFrames?: boolean;
  };
  func: () => any;
  args?: any[];
  world?: 'ISOLATED' | 'MAIN';
}

export interface StorageOptions {
  area?: 'local' | 'sync';
}

export interface StorageData {
  [key: string]: any;
}

export interface PermissionRequest {
  permissions: string[];
  origins?: string[];
}

/**
 * Message passing interface for extension communication
 */
export interface ExtensionMessage {
  type: string;
  payload: any;
  tabId?: number;
  frameId?: number;
  timestamp?: number;
}

/**
 * Automation command interface for browser automation
 */
export interface AutomationCommand {
  id: string;
  type: 'navigate' | 'click' | 'fill' | 'scroll' | 'submit' | 'wait' | 'extract';
  selector?: string;
  value?: string;
  url?: string;
  tabId?: number;
  timeout?: number;
  options?: Record<string, any>;
}

/**
 * Response interface for automation commands
 */
export interface AutomationResponse {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
  timestamp: number;
}
