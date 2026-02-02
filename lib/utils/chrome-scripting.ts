/**
 * Chrome Scripting API Wrapper
 * Provides type-safe utilities for script injection and execution
 */

import type { ScriptInjectionOptions } from '../types/chrome-api';

/**
 * Execute a function in the context of a tab
 */
export async function executeScript<T = any>(
  tabId: number,
  func: () => T,
  world?: 'ISOLATED' | 'MAIN'
): Promise<T[]> {
  try {
    const injection: chrome.scripting.ScriptInjection<T> = {
      target: { tabId },
      func,
      world
    };

    return await chrome.scripting.executeScript(injection);
  } catch (error) {
    console.error('Failed to execute script:', error);
    throw error;
  }
}

/**
 * Execute a function with arguments in the context of a tab
 */
export async function executeScriptWithArgs<T = any>(
  tabId: number,
  func: (...args: any[]) => T,
  args: any[],
  world?: 'ISOLATED' | 'MAIN'
): Promise<T[]> {
  try {
    const injection: chrome.scripting.ScriptInjection<T> = {
      target: { tabId },
      func,
      args,
      world
    };

    return await chrome.scripting.executeScript(injection);
  } catch (error) {
    console.error('Failed to execute script with args:', error);
    throw error;
  }
}

/**
 * Execute a function in all frames of a tab
 */
export async function executeScriptInAllFrames<T = any>(
  tabId: number,
  func: () => T,
  world?: 'ISOLATED' | 'MAIN'
): Promise<T[]> {
  try {
    const injection: chrome.scripting.ScriptInjection<T> = {
      target: { tabId, allFrames: true },
      func,
      world
    };

    return await chrome.scripting.executeScript(injection);
  } catch (error) {
    console.error('Failed to execute script in all frames:', error);
    throw error;
  }
}

/**
 * Execute a function in specific frames of a tab
 */
export async function executeScriptInFrames<T = any>(
  tabId: number,
  frameIds: number[],
  func: () => T,
  world?: 'ISOLATED' | 'MAIN'
): Promise<T[]> {
  try {
    const injection: chrome.scripting.ScriptInjection<T> = {
      target: { tabId, frameIds },
      func,
      world
    };

    return await chrome.scripting.executeScript(injection);
  } catch (error) {
    console.error('Failed to execute script in frames:', error);
    throw error;
  }
}

/**
 * Inject CSS into a tab
 */
export async function insertCSS(
  tabId: number,
  css: string,
  options?: { allFrames?: boolean; frameIds?: number[] }
): Promise<void> {
  try {
    const injection: chrome.scripting.CSSInjection = {
      target: { tabId },
      css
    };

    if (options?.allFrames) {
      injection.target.allFrames = true;
    }

    if (options?.frameIds) {
      injection.target.frameIds = options.frameIds;
    }

    await chrome.scripting.insertCSS(injection);
  } catch (error) {
    console.error('Failed to insert CSS:', error);
    throw error;
  }
}

/**
 * Remove previously injected CSS from a tab
 */
export async function removeCSS(
  tabId: number,
  css: string,
  options?: { allFrames?: boolean; frameIds?: number[] }
): Promise<void> {
  try {
    const injection: chrome.scripting.CSSInjection = {
      target: { tabId },
      css,
      origin: 'USER_AUTHORED' // Required for removeCSS
    };

    if (options?.allFrames) {
      injection.target.allFrames = true;
    }

    if (options?.frameIds) {
      injection.target.frameIds = options.frameIds;
    }

    await chrome.scripting.removeCSS(injection);
  } catch (error) {
    console.error('Failed to remove CSS:', error);
    throw error;
  }
}

/**
 * Execute a function and get the first result
 */
export async function executeScriptFirst<T = any>(
  tabId: number,
  func: () => T,
  world?: 'ISOLATED' | 'MAIN'
): Promise<T | null> {
  try {
    const results = await executeScript<T>(tabId, func, world);
    return results.length > 0 ? results[0].result : null;
  } catch (error) {
    console.error('Failed to execute script (first result):', error);
    return null;
  }
}

/**
 * Execute a function with arguments and get the first result
 */
export async function executeScriptWithArgsFirst<T = any>(
  tabId: number,
  func: (...args: any[]) => T,
  args: any[],
  world?: 'ISOLATED' | 'MAIN'
): Promise<T | null> {
  try {
    const results = await executeScriptWithArgs<T>(tabId, func, args, world);
    return results.length > 0 ? results[0].result : null;
  } catch (error) {
    console.error('Failed to execute script with args (first result):', error);
    return null;
  }
}

/**
 * Check if scripting API is available
 */
export function isScriptingAvailable(): boolean {
  return typeof chrome !== 'undefined' && chrome.scripting !== undefined;
}

/**
 * Get all frames in a tab
 */
export async function getFrames(tabId: number): Promise<chrome.webNavigation.GetAllFrameResultDetails[]> {
  try {
    return await chrome.webNavigation.getAllFrames({ tabId });
  } catch (error) {
    console.error('Failed to get frames:', error);
    return [];
  }
} * Chrome Scripting API Wrapper
 * Provides type-safe utilities for script injection and execution
 */

import type { ScriptInjectionOptions } from '../types/chrome-api';

/**
 * Execute a function in the context of a tab
 */
export async function executeScript<T = any>(
  tabId: number,
  func: () => T,
  world?: 'ISOLATED' | 'MAIN'
): Promise<T[]> {
  try {
    const injection: chrome.scripting.ScriptInjection<T> = {
      target: { tabId },
      func,
      world
    };

    return await chrome.scripting.executeScript(injection);
  } catch (error) {
    console.error('Failed to execute script:', error);
    throw error;
  }
}

/**
 * Execute a function with arguments in the context of a tab
 */
export async function executeScriptWithArgs<T = any>(
  tabId: number,
  func: (...args: any[]) => T,
  args: any[],
  world?: 'ISOLATED' | 'MAIN'
): Promise<T[]> {
  try {
    const injection: chrome.scripting.ScriptInjection<T> = {
      target: { tabId },
      func,
      args,
      world
    };

    return await chrome.scripting.executeScript(injection);
  } catch (error) {
    console.error('Failed to execute script with args:', error);
    throw error;
  }
}

/**
 * Execute a function in all frames of a tab
 */
export async function executeScriptInAllFrames<T = any>(
  tabId: number,
  func: () => T,
  world?: 'ISOLATED' | 'MAIN'
): Promise<T[]> {
  try {
    const injection: chrome.scripting.ScriptInjection<T> = {
      target: { tabId, allFrames: true },
      func,
      world
    };

    return await chrome.scripting.executeScript(injection);
  } catch (error) {
    console.error('Failed to execute script in all frames:', error);
    throw error;
  }
}

/**
 * Execute a function in specific frames of a tab
 */
export async function executeScriptInFrames<T = any>(
  tabId: number,
  frameIds: number[],
  func: () => T,
  world?: 'ISOLATED' | 'MAIN'
): Promise<T[]> {
  try {
    const injection: chrome.scripting.ScriptInjection<T> = {
      target: { tabId, frameIds },
      func,
      world
    };

    return await chrome.scripting.executeScript(injection);
  } catch (error) {
    console.error('Failed to execute script in frames:', error);
    throw error;
  }
}

/**
 * Inject CSS into a tab
 */
export async function insertCSS(
  tabId: number,
  css: string,
  options?: { allFrames?: boolean; frameIds?: number[] }
): Promise<void> {
  try {
    const injection: chrome.scripting.CSSInjection = {
      target: { tabId },
      css
    };

    if (options?.allFrames) {
      injection.target.allFrames = true;
    }

    if (options?.frameIds) {
      injection.target.frameIds = options.frameIds;
    }

    await chrome.scripting.insertCSS(injection);
  } catch (error) {
    console.error('Failed to insert CSS:', error);
    throw error;
  }
}

/**
 * Remove previously injected CSS from a tab
 */
export async function removeCSS(
  tabId: number,
  css: string,
  options?: { allFrames?: boolean; frameIds?: number[] }
): Promise<void> {
  try {
    const injection: chrome.scripting.CSSInjection = {
      target: { tabId },
      css,
      origin: 'USER_AUTHORED' // Required for removeCSS
    };

    if (options?.allFrames) {
      injection.target.allFrames = true;
    }

    if (options?.frameIds) {
      injection.target.frameIds = options.frameIds;
    }

    await chrome.scripting.removeCSS(injection);
  } catch (error) {
    console.error('Failed to remove CSS:', error);
    throw error;
  }
}

/**
 * Execute a function and get the first result
 */
export async function executeScriptFirst<T = any>(
  tabId: number,
  func: () => T,
  world?: 'ISOLATED' | 'MAIN'
): Promise<T | null> {
  try {
    const results = await executeScript<T>(tabId, func, world);
    return results.length > 0 ? results[0].result : null;
  } catch (error) {
    console.error('Failed to execute script (first result):', error);
    return null;
  }
}

/**
 * Execute a function with arguments and get the first result
 */
export async function executeScriptWithArgsFirst<T = any>(
  tabId: number,
  func: (...args: any[]) => T,
  args: any[],
  world?: 'ISOLATED' | 'MAIN'
): Promise<T | null> {
  try {
    const results = await executeScriptWithArgs<T>(tabId, func, args, world);
    return results.length > 0 ? results[0].result : null;
  } catch (error) {
    console.error('Failed to execute script with args (first result):', error);
    return null;
  }
}

/**
 * Check if scripting API is available
 */
export function isScriptingAvailable(): boolean {
  return typeof chrome !== 'undefined' && chrome.scripting !== undefined;
}

/**
 * Get all frames in a tab
 */
export async function getFrames(tabId: number): Promise<chrome.webNavigation.GetAllFrameResultDetails[]> {
  try {
    return await chrome.webNavigation.getAllFrames({ tabId });
  } catch (error) {
    console.error('Failed to get frames:', error);
    return [];
  }
}
