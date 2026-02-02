/**
 * Chrome Extension API Integration
 * Provides a wrapper for Chrome Extension APIs with error handling and type safety
 */

export interface ChromeApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface StorageData {
  [key: string]: any;
}

export class ChromeApiWrapper {
  private static instance: ChromeApiWrapper;

  private constructor() {}

  public static getInstance(): ChromeApiWrapper {
    if (!ChromeApiWrapper.instance) {
      ChromeApiWrapper.instance = new ChromeApiWrapper();
    }
    return ChromeApiWrapper.instance;
  }

  /**
   * Storage API wrapper
   */
  public async storageGet(keys: string | string[] | object): Promise<StorageData> {
    try {
      return new Promise((resolve, reject) => {
        chrome.storage.local.get(keys, (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(result);
          }
        });
      });
    } catch (error) {
      throw new Error(`Storage get failed: ${error}`);
    }
  }

  public async storageSet(items: StorageData): Promise<void> {
    try {
      return new Promise((resolve, reject) => {
        chrome.storage.local.set(items, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      throw new Error(`Storage set failed: ${error}`);
    }
  }

  public async storageRemove(keys: string | string[]): Promise<void> {
    try {
      return new Promise((resolve, reject) => {
        chrome.storage.local.remove(keys, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      throw new Error(`Storage remove failed: ${error}`);
    }
  }

  public async storageClear(): Promise<void> {
    try {
      return new Promise((resolve, reject) => {
        chrome.storage.local.clear(() => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      throw new Error(`Storage clear failed: ${error}`);
    }
  }

  /**
   * Runtime API wrapper
   */
  public async runtimeSendMessage(message: any): Promise<ChromeApiResponse> {
    try {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
    } catch (error) {
      throw new Error(`Runtime send message failed: ${error}`);
    }
  }

  public runtimeOnMessage(callback: (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => void): void {
    try {
      chrome.runtime.onMessage.addListener(callback);
    } catch (error) {
      throw new Error(`Runtime on message failed: ${error}`);
    }
  }

  public runtimeOnConnect(callback: (port: chrome.runtime.Port) => void): void {
    try {
      chrome.runtime.onConnect.addListener(callback);
    } catch (error) {
      throw new Error(`Runtime on connect failed: ${error}`);
    }
  }

  public getRuntimeId(): string {
    try {
      return chrome.runtime.id;
    } catch (error) {
      throw new Error(`Failed to get runtime ID: ${error}`);
    }
  }

  public getURL(path: string): string {
    try {
      return chrome.runtime.getURL(path);
    } catch (error) {
      throw new Error(`Failed to get URL: ${error}`);
    }
  }

  /**
   * Tabs API wrapper
   */
  public async tabsQuery(query: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
    try {
      return new Promise((resolve, reject) => {
        chrome.tabs.query(query, (tabs) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(tabs);
          }
        });
      });
    } catch (error) {
      throw new Error(`Tabs query failed: ${error}`);
    }
  }

  public async tabsCreate(createProperties: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab> {
    try {
      return new Promise((resolve, reject) => {
        chrome.tabs.create(createProperties, (tab) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(tab);
          }
        });
      });
    } catch (error) {
      throw new Error(`Tabs create failed: ${error}`);
    }
  }

  public async tabsUpdate(tabId: number, updateProperties: chrome.tabs.UpdateProperties): Promise<chrome.tabs.Tab> {
    try {
      return new Promise((resolve, reject) => {
        chrome.tabs.update(tabId, updateProperties, (tab) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(tab);
          }
        });
      });
    } catch (error) {
      throw new Error(`Tabs update failed: ${error}`);
    }
  }

  public async tabsSendMessage(tabId: number, message: any, options?: chrome.tabs.MessageSendOptions): Promise<any> {
    try {
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, message, options, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
    } catch (error) {
      throw new Error(`Tabs send message failed: ${error}`);
    }
  }

  /**
   * Notifications API wrapper
   */
  public async notificationsCreate(notificationId: string | chrome.notifications.NotificationOptions, options?: chrome.notifications.NotificationOptions): Promise<string> {
    try {
      return new Promise((resolve, reject) => {
        if (typeof notificationId === 'string') {
          chrome.notifications.create(notificationId, options!, (id) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(id);
            }
          });
        } else {
          chrome.notifications.create(notificationId, (id) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(id);
            }
          });
        }
      });
    } catch (error) {
      throw new Error(`Notifications create failed: ${error}`);
    }
  }

  public async notificationsClear(notificationId?: string): Promise<boolean> {
    try {
      return new Promise((resolve, reject) => {
        chrome.notifications.clear(notificationId, (wasCleared) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(wasCleared);
          }
        });
      });
    } catch (error) {
      throw new Error(`Notifications clear failed: ${error}`);
    }
  }

  /**
   * Permissions API wrapper
   */
  public async permissionsRequest(permissions: string | string[]): Promise<boolean> {
    try {
      return new Promise((resolve, reject) => {
        chrome.permissions.request(permissions, (granted) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(granted);
          }
        });
      });
    } catch (error) {
      throw new Error(`Permissions request failed: ${error}`);
    }
  }

  public async permissionsContains(permissions: string | string[]): Promise<boolean> {
    try {
      return new Promise((resolve, reject) => {
        chrome.permissions.contains(permissions, (contains) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(contains);
          }
        });
      });
    } catch (error) {
      throw new Error(`Permissions contains failed: ${error}`);
    }
  }

  /**
   * Storage change listener wrapper
   */
  public storageOnChanged(callback: (changes: { [key: string]: chrome.storage.StorageChange }, namespace: string) => void): void {
    try {
      chrome.storage.onChanged.addListener(callback);
    } catch (error) {
      throw new Error(`Storage on changed failed: ${error}`);
    }
  }

  /**
   * Check if Chrome APIs are available
   */
  public isChromeExtensionContext(): boolean {
    return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
  }

  /**
   * Get extension manifest
   */
  public getManifest(): chrome.runtime.Manifest {
    try {
      return chrome.runtime.getManifest();
    } catch (error) {
      throw new Error(`Failed to get manifest: ${error}`);
    }
  }

  /**
   * Execute script in tab
   */
  public async tabsExecuteScript(tabId: number, details: chrome.tabs.ExecuteScriptDetails): Promise<any[]> {
    try {
      return new Promise((resolve, reject) => {
        chrome.tabs.executeScript(tabId, details, (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(result);
          }
        });
      });
    } catch (error) {
      throw new Error(`Tabs execute script failed: ${error}`);
    }
  }

  /**
   * Connect to background script
   */
  public runtimeConnect(name?: string): chrome.runtime.Port {
    try {
      return chrome.runtime.connect({ name });
    } catch (error) {
      throw new Error(`Runtime connect failed: ${error}`);
    }
  }

  /**
   * Get current active tab
   */
  public async getActiveTab(): Promise<chrome.tabs.Tab> {
    try {
      const tabs = await this.tabsQuery({ active: true, currentWindow: true });
      if (tabs.length === 0) {
        throw new Error('No active tab found');
      }
      return tabs[0];
    } catch (error) {
      throw new Error(`Failed to get active tab: ${error}`);
    }
  }
}

// Export singleton instance
export const chromeApi = ChromeApiWrapper.getInstance();
