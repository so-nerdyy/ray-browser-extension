/**
 * Chrome API Mocks for Testing
 * This file provides comprehensive TypeScript mocks for Chrome Extension APIs
 */

// Mock Chrome Storage API
export const mockChromeStorage = {
  local: {
    get: jest.fn((keys: string | string[] | object | null, callback?: (items: { [key: string]: any }) => void) => {
      const result = {};
      if (callback) callback(result);
      return Promise.resolve(result);
    }),
    set: jest.fn((items: { [key: string]: any }, callback?: () => void) => {
      if (callback) callback();
      return Promise.resolve();
    }),
    remove: jest.fn((keys: string | string[], callback?: () => void) => {
      if (callback) callback();
      return Promise.resolve();
    }),
    clear: jest.fn((callback?: () => void) => {
      if (callback) callback();
      return Promise.resolve();
    })
  },
  sync: {
    get: jest.fn((keys: string | string[] | object | null, callback?: (items: { [key: string]: any }) => void) => {
      const result = {};
      if (callback) callback(result);
      return Promise.resolve(result);
    }),
    set: jest.fn((items: { [key: string]: any }, callback?: () => void) => {
      if (callback) callback();
      return Promise.resolve();
    }),
    remove: jest.fn((keys: string | string[], callback?: () => void) => {
      if (callback) callback();
      return Promise.resolve();
    }),
    clear: jest.fn((callback?: () => void) => {
      if (callback) callback();
      return Promise.resolve();
    })
  }
};

// Mock Chrome Runtime API
export const mockChromeRuntime = {
  getURL: jest.fn((path: string) => `chrome-extension://test-id/${path}`),
  sendMessage: jest.fn((message: any, callback?: (response: any) => void) => {
    if (callback) callback({});
    return Promise.resolve({});
  }),
  onMessage: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    hasListener: jest.fn()
  },
  onInstalled: {
    addListener: jest.fn(),
    removeListener: jest.fn()
  },
  onStartup: {
    addListener: jest.fn(),
    removeListener: jest.fn()
  },
  id: 'test-extension-id',
  lastError: null
};

// Mock Chrome Tabs API
export const mockChromeTabs = {
  create: jest.fn((createProperties: chrome.tabs.CreateProperties, callback?: (tab: chrome.tabs.Tab) => void) => {
    const tab: chrome.tabs.Tab = {
      id: 1,
      url: createProperties.url || 'about:blank',
      active: true,
      windowId: 1,
      index: 0,
      highlighted: false,
      pinned: false,
      selected: true
    };
    if (callback) callback(tab);
    return Promise.resolve(tab);
  }),
  update: jest.fn((tabId: number, updateProperties: chrome.tabs.UpdateProperties, callback?: (tab: chrome.tabs.Tab) => void) => {
    const tab: chrome.tabs.Tab = {
      id: tabId,
      url: updateProperties.url || 'about:blank',
      active: updateProperties.active || false,
      windowId: 1,
      index: 0,
      highlighted: false,
      pinned: false,
      selected: false
    };
    if (callback) callback(tab);
    return Promise.resolve(tab);
  }),
  query: jest.fn((queryInfo: chrome.tabs.QueryInfo, callback?: (tabs: chrome.tabs.Tab[]) => void) => {
    const tabs: chrome.tabs.Tab[] = [{
      id: 1,
      url: 'http://example.com',
      active: true,
      windowId: 1,
      index: 0,
      highlighted: false,
      pinned: false,
      selected: true
    }];
    if (callback) callback(tabs);
    return Promise.resolve(tabs);
  }),
  sendMessage: jest.fn((tabId: number, message: any, callback?: (response: any) => void) => {
    if (callback) callback({});
    return Promise.resolve({});
  }),
  executeScript: jest.fn((tabId: number, details: chrome.tabs.InjectDetails, callback?: (result: any[]) => void) => {
    const result = [{ result: 'success' }];
    if (callback) callback(result);
    return Promise.resolve(result);
  }),
  onUpdated: {
    addListener: jest.fn(),
    removeListener: jest.fn()
  },
  onCreated: {
    addListener: jest.fn(),
    removeListener: jest.fn()
  },
  onRemoved: {
    addListener: jest.fn(),
    removeListener: jest.fn()
  }
};

// Mock Chrome Windows API
export const mockChromeWindows = {
  create: jest.fn((createData: chrome.windows.CreateData, callback?: (window: chrome.windows.Window) => void) => {
    const window: chrome.windows.Window = {
      id: 1,
      tabs: [{ id: 1, url: createData.url || 'about:blank', active: true, windowId: 1, index: 0, highlighted: false, pinned: false, selected: true }],
      focused: true,
      top: 0,
      left: 0,
      width: 800,
      height: 600,
      incognito: false,
      type: 'normal',
      state: 'normal',
      alwaysOnTop: false
    };
    if (callback) callback(window);
    return Promise.resolve(window);
  }),
  update: jest.fn((windowId: number, updateInfo: chrome.windows.UpdateInfo, callback?: (window: chrome.windows.Window) => void) => {
    const window: chrome.windows.Window = {
      id: windowId,
      tabs: [],
      focused: updateInfo.focused || false,
      top: 0,
      left: 0,
      width: 800,
      height: 600,
      incognito: false,
      type: 'normal',
      state: 'normal',
      alwaysOnTop: false
    };
    if (callback) callback(window);
    return Promise.resolve(window);
  }),
  getCurrent: jest.fn((callback?: (window: chrome.windows.Window) => void) => {
    const window: chrome.windows.Window = {
      id: 1,
      tabs: [],
      focused: true,
      top: 0,
      left: 0,
      width: 800,
      height: 600,
      incognito: false,
      type: 'normal',
      state: 'normal',
      alwaysOnTop: false
    };
    if (callback) callback(window);
    return Promise.resolve(window);
  })
};

// Mock Chrome Action API
export const mockChromeAction = {
  setBadgeText: jest.fn((details: chrome.action.BadgeTextDetails, callback?: () => void) => {
    if (callback) callback();
    return Promise.resolve();
  }),
  setBadgeBackgroundColor: jest.fn((details: chrome.action.BadgeBackgroundColorDetails, callback?: () => void) => {
    if (callback) callback();
    return Promise.resolve();
  }),
  setTitle: jest.fn((details: chrome.action.TitleDetails, callback?: () => void) => {
    if (callback) callback();
    return Promise.resolve();
  }),
  setIcon: jest.fn((details: chrome.action.IconDetails, callback?: () => void) => {
    if (callback) callback();
    return Promise.resolve();
  }),
  onClicked: {
    addListener: jest.fn(),
    removeListener: jest.fn()
  }
};

// Mock Chrome Permissions API
export const mockChromePermissions = {
  request: jest.fn((permissions: chrome.permissions.Permissions, callback?: (granted: boolean) => void) => {
    if (callback) callback(true);
    return Promise.resolve(true);
  }),
  contains: jest.fn((permissions: chrome.permissions.Permissions, callback?: (result: boolean) => void) => {
    if (callback) callback(true);
    return Promise.resolve(true);
  }),
  getAll: jest.fn((callback?: (permissions: string[]) => void) => {
    if (callback) callback(['activeTab', 'storage']);
    return Promise.resolve(['activeTab', 'storage']);
  }),
  onAdded: {
    addListener: jest.fn(),
    removeListener: jest.fn()
  },
  onRemoved: {
    addListener: jest.fn(),
    removeListener: jest.fn()
  }
};

// Mock Chrome Scripting API
export const mockChromeScripting = {
  executeScript: jest.fn((injection: chrome.scripting.ScriptInjection, callback?: (result: chrome.scripting.InjectionResult[]) => void) => {
    const result = [{ result: 'success' }];
    if (callback) callback(result);
    return Promise.resolve(result);
  }),
  insertCSS: jest.fn((injection: chrome.scripting.CSSInjection, callback?: () => void) => {
    if (callback) callback();
    return Promise.resolve();
  })
};

// Complete Chrome API mock object
export const mockChromeAPI = {
  storage: mockChromeStorage,
  runtime: mockChromeRuntime,
  tabs: mockChromeTabs,
  windows: mockChromeWindows,
  action: mockChromeAction,
  permissions: mockChromePermissions,
  scripting: mockChromeScripting
};

// Helper function to setup Chrome API mocks
export const setupChromeMocks = () => {
  global.chrome = mockChromeAPI;
  return mockChromeAPI;
};

// Helper function to reset Chrome API mocks
export const resetChromeMocks = () => {
  Object.keys(mockChromeAPI).forEach(api => {
    if (typeof mockChromeAPI[api] === 'object' && mockChromeAPI[api] !== null) {
      Object.keys(mockChromeAPI[api]).forEach(method => {
        if (jest.isMockFunction(mockChromeAPI[api][method])) {
          mockChromeAPI[api][method].mockReset();
        }
      });
    }
  });
};
