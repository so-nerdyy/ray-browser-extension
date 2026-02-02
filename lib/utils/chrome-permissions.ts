/**
 * Chrome Permissions API Wrapper
 * Provides type-safe utilities for permission management
 */

import type { PermissionRequest } from '../types/chrome-api';

/**
 * Request permissions
 */
export async function requestPermissions(
  permissions: PermissionRequest
): Promise<boolean> {
  try {
    return await chrome.permissions.request(permissions);
  } catch (error) {
    console.error('Failed to request permissions:', error);
    return false;
  }
}

/**
 * Check if permissions are granted
 */
export async function hasPermissions(
  permissions: PermissionRequest
): Promise<boolean> {
  try {
    return await chrome.permissions.contains(permissions);
  } catch (error) {
    console.error('Failed to check permissions:', error);
    return false;
  }
}

/**
 * Get all granted permissions
 */
export async function getAllPermissions(): Promise<chrome.permissions.Permissions> {
  try {
    return await chrome.permissions.getAll();
  } catch (error) {
    console.error('Failed to get all permissions:', error);
    return { permissions: [], origins: [] };
  }
}

/**
 * Remove permissions
 */
export async function removePermissions(
  permissions: PermissionRequest
): Promise<boolean> {
  try {
    return await chrome.permissions.remove(permissions);
  } catch (error) {
    console.error('Failed to remove permissions:', error);
    return false;
  }
}

/**
 * Check if a specific permission is granted
 */
export async function hasPermission(permission: string): Promise<boolean> {
  return await hasPermissions({ permissions: [permission] });
}

/**
 * Check if a specific origin is granted
 */
export async function hasOrigin(origin: string): Promise<boolean> {
  return await hasPermissions({ origins: [origin] });
}

/**
 * Request a specific permission
 */
export async function requestPermission(permission: string): Promise<boolean> {
  return await requestPermissions({ permissions: [permission] });
}

/**
 * Request a specific origin
 */
export async function requestOrigin(origin: string): Promise<boolean> {
  return await requestPermissions({ origins: [origin] });
}

/**
 * Remove a specific permission
 */
export async function removePermission(permission: string): Promise<boolean> {
  return await removePermissions({ permissions: [permission] });
}

/**
 * Remove a specific origin
 */
export async function removeOrigin(origin: string): Promise<boolean> {
  return await removePermissions({ origins: [origin] });
}

/**
 * Request active tab permission
 */
export async function requestActiveTabPermission(): Promise<boolean> {
  return await requestPermission('activeTab');
}

/**
 * Check if active tab permission is granted
 */
export async function hasActiveTabPermission(): Promise<boolean> {
  return await hasPermission('activeTab');
}

/**
 * Request scripting permission
 */
export async function requestScriptingPermission(): Promise<boolean> {
  return await requestPermission('scripting');
}

/**
 * Check if scripting permission is granted
 */
export async function hasScriptingPermission(): Promise<boolean> {
  return await hasPermission('scripting');
}

/**
 * Request storage permission
 */
export async function requestStoragePermission(): Promise<boolean> {
  return await requestPermission('storage');
}

/**
 * Check if storage permission is granted
 */
export async function hasStoragePermission(): Promise<boolean> {
  return await hasPermission('storage');
}

/**
 * Request tabs permission
 */
export async function requestTabsPermission(): Promise<boolean> {
  return await requestPermission('tabs');
}

/**
 * Check if tabs permission is granted
 */
export async function hasTabsPermission(): Promise<boolean> {
  return await hasPermission('tabs');
}

/**
 * Request all URLs permission
 */
export async function requestAllUrlsPermission(): Promise<boolean> {
  return await requestOrigin('<all_urls>');
}

/**
 * Check if all URLs permission is granted
 */
export async function hasAllUrlsPermission(): Promise<boolean> {
  return await hasOrigin('<all_urls>');
}

/**
 * Request permissions for a specific domain
 */
export async function requestDomainPermission(domain: string): Promise<boolean> {
  const origin = domain.startsWith('http') ? domain : `*://${domain}/*`;
  return await requestOrigin(origin);
}

/**
 * Check if permissions are granted for a specific domain
 */
export async function hasDomainPermission(domain: string): Promise<boolean> {
  const origin = domain.startsWith('http') ? domain : `*://${domain}/*`;
  return await hasOrigin(origin);
}

/**
 * Listen for permission changes
 */
export function onPermissionsChanged(
  callback: (permissions: chrome.permissions.Permissions) => void
): void {
  chrome.permissions.onAdded.addListener(callback);
  chrome.permissions.onRemoved.addListener(callback);
}

/**
 * Remove permission change listeners
 */
export function removePermissionsChangedListeners(): void {
  chrome.permissions.onAdded.removeListener(() => {});
  chrome.permissions.onRemoved.removeListener(() => {});
}

/**
 * Get optional permissions that can be requested
 */
export function getOptionalPermissions(): string[] {
  return [
    'activeTab',
    'scripting',
    'storage',
    'tabs',
    'webNavigation',
    'background',
    'notifications',
    'clipboardRead',
    'clipboardWrite'
  ];
}

/**
 * Get required permissions that must be in manifest
 */
export function getRequiredPermissions(): string[] {
  return [
    // These should be declared in manifest.json
    // 'tabs',
    // 'scripting',
    // 'storage',
    // 'activeTab'
  ];
}

/**
 * Validate permission format
 */
export function validatePermission(permission: string): boolean {
  const validPermissions = [
    ...getOptionalPermissions(),
    ...getRequiredPermissions()
  ];
  return validPermissions.includes(permission);
}

/**
 * Validate origin format
 */
export function validateOrigin(origin: string): boolean {
  // Basic validation for origin patterns
  const originPatterns = [
    /^<all_urls>$/,
    /^\*:\/\/\*\/\*$/,
    /^\*:\/\/\*\.[^\/]+\/\*$/,
    /^\*:\/\/[^\/]+\/\*$/,
    /^https?:\/\/\*\/\*$/,
    /^https?:\/\/\*\.[^\/]+\/\*$/,
    /^https?:\/\/[^\/]+\/\*$/
  ];
  
  return originPatterns.some(pattern => pattern.test(origin));
} * Chrome Permissions API Wrapper
 * Provides type-safe utilities for permission management
 */

import type { PermissionRequest } from '../types/chrome-api';

/**
 * Request permissions
 */
export async function requestPermissions(
  permissions: PermissionRequest
): Promise<boolean> {
  try {
    return await chrome.permissions.request(permissions);
  } catch (error) {
    console.error('Failed to request permissions:', error);
    return false;
  }
}

/**
 * Check if permissions are granted
 */
export async function hasPermissions(
  permissions: PermissionRequest
): Promise<boolean> {
  try {
    return await chrome.permissions.contains(permissions);
  } catch (error) {
    console.error('Failed to check permissions:', error);
    return false;
  }
}

/**
 * Get all granted permissions
 */
export async function getAllPermissions(): Promise<chrome.permissions.Permissions> {
  try {
    return await chrome.permissions.getAll();
  } catch (error) {
    console.error('Failed to get all permissions:', error);
    return { permissions: [], origins: [] };
  }
}

/**
 * Remove permissions
 */
export async function removePermissions(
  permissions: PermissionRequest
): Promise<boolean> {
  try {
    return await chrome.permissions.remove(permissions);
  } catch (error) {
    console.error('Failed to remove permissions:', error);
    return false;
  }
}

/**
 * Check if a specific permission is granted
 */
export async function hasPermission(permission: string): Promise<boolean> {
  return await hasPermissions({ permissions: [permission] });
}

/**
 * Check if a specific origin is granted
 */
export async function hasOrigin(origin: string): Promise<boolean> {
  return await hasPermissions({ origins: [origin] });
}

/**
 * Request a specific permission
 */
export async function requestPermission(permission: string): Promise<boolean> {
  return await requestPermissions({ permissions: [permission] });
}

/**
 * Request a specific origin
 */
export async function requestOrigin(origin: string): Promise<boolean> {
  return await requestPermissions({ origins: [origin] });
}

/**
 * Remove a specific permission
 */
export async function removePermission(permission: string): Promise<boolean> {
  return await removePermissions({ permissions: [permission] });
}

/**
 * Remove a specific origin
 */
export async function removeOrigin(origin: string): Promise<boolean> {
  return await removePermissions({ origins: [origin] });
}

/**
 * Request active tab permission
 */
export async function requestActiveTabPermission(): Promise<boolean> {
  return await requestPermission('activeTab');
}

/**
 * Check if active tab permission is granted
 */
export async function hasActiveTabPermission(): Promise<boolean> {
  return await hasPermission('activeTab');
}

/**
 * Request scripting permission
 */
export async function requestScriptingPermission(): Promise<boolean> {
  return await requestPermission('scripting');
}

/**
 * Check if scripting permission is granted
 */
export async function hasScriptingPermission(): Promise<boolean> {
  return await hasPermission('scripting');
}

/**
 * Request storage permission
 */
export async function requestStoragePermission(): Promise<boolean> {
  return await requestPermission('storage');
}

/**
 * Check if storage permission is granted
 */
export async function hasStoragePermission(): Promise<boolean> {
  return await hasPermission('storage');
}

/**
 * Request tabs permission
 */
export async function requestTabsPermission(): Promise<boolean> {
  return await requestPermission('tabs');
}

/**
 * Check if tabs permission is granted
 */
export async function hasTabsPermission(): Promise<boolean> {
  return await hasPermission('tabs');
}

/**
 * Request all URLs permission
 */
export async function requestAllUrlsPermission(): Promise<boolean> {
  return await requestOrigin('<all_urls>');
}

/**
 * Check if all URLs permission is granted
 */
export async function hasAllUrlsPermission(): Promise<boolean> {
  return await hasOrigin('<all_urls>');
}

/**
 * Request permissions for a specific domain
 */
export async function requestDomainPermission(domain: string): Promise<boolean> {
  const origin = domain.startsWith('http') ? domain : `*://${domain}/*`;
  return await requestOrigin(origin);
}

/**
 * Check if permissions are granted for a specific domain
 */
export async function hasDomainPermission(domain: string): Promise<boolean> {
  const origin = domain.startsWith('http') ? domain : `*://${domain}/*`;
  return await hasOrigin(origin);
}

/**
 * Listen for permission changes
 */
export function onPermissionsChanged(
  callback: (permissions: chrome.permissions.Permissions) => void
): void {
  chrome.permissions.onAdded.addListener(callback);
  chrome.permissions.onRemoved.addListener(callback);
}

/**
 * Remove permission change listeners
 */
export function removePermissionsChangedListeners(): void {
  chrome.permissions.onAdded.removeListener(() => {});
  chrome.permissions.onRemoved.removeListener(() => {});
}

/**
 * Get optional permissions that can be requested
 */
export function getOptionalPermissions(): string[] {
  return [
    'activeTab',
    'scripting',
    'storage',
    'tabs',
    'webNavigation',
    'background',
    'notifications',
    'clipboardRead',
    'clipboardWrite'
  ];
}

/**
 * Get required permissions that must be in manifest
 */
export function getRequiredPermissions(): string[] {
  return [
    // These should be declared in manifest.json
    // 'tabs',
    // 'scripting',
    // 'storage',
    // 'activeTab'
  ];
}

/**
 * Validate permission format
 */
export function validatePermission(permission: string): boolean {
  const validPermissions = [
    ...getOptionalPermissions(),
    ...getRequiredPermissions()
  ];
  return validPermissions.includes(permission);
}

/**
 * Validate origin format
 */
export function validateOrigin(origin: string): boolean {
  // Basic validation for origin patterns
  const originPatterns = [
    /^<all_urls>$/,
    /^\*:\/\/\*\/\*$/,
    /^\*:\/\/\*\.[^\/]+\/\*$/,
    /^\*:\/\/[^\/]+\/\*$/,
    /^https?:\/\/\*\/\*$/,
    /^https?:\/\/\*\.[^\/]+\/\*$/,
    /^https?:\/\/[^\/]+\/\*$/
  ];
  
  return originPatterns.some(pattern => pattern.test(origin));
}
