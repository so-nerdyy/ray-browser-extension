/**
 * Chrome API Mock for Testing
 * This file provides comprehensive mocks for Chrome Extension APIs
 */

// Mock Chrome APIs
global.chrome = {
  // Storage API mock
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        const result = {};
        if (callback) callback(result);
        return Promise.resolve(result);
      }),
      set: jest.fn((items, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      remove: jest.fn((keys, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      clear: jest.fn((callback) => {
        if (callback) callback();
        return Promise.resolve();
      })
    },
    sync: {
      get: jest.fn((keys, callback) => {
        const result = {};
        if (callback) callback(result);
        return Promise.resolve(result);
      }),
      set: jest.fn((items, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      remove: jest.fn((keys, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      clear: jest.fn((callback) => {
        if (callback) callback();
        return Promise.resolve();
      })
    }
  },

  // Runtime API mock
  runtime: {
    getURL: jest.fn((path) => `chrome-extension://test-id/${path}`),
    sendMessage: jest.fn((message, callback) => {
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
  },

  // Tabs API mock
  tabs: {
    create: jest.fn((createProperties, callback) => {
      const tab = {
        id: 1,
        url: createProperties.url || 'about:blank',
        active: true,
        windowId: 1
      };
      if (callback) callback(tab);
      return Promise.resolve(tab);
    }),
    update: jest.fn((tabId, updateProperties, callback) => {
      const tab = {
        id: tabId,
        url: updateProperties.url || 'about:blank',
        active: updateProperties.active || false
      };
      if (callback) callback(tab);
      return Promise.resolve(tab);
    }),
    query: jest.fn((queryInfo, callback) => {
      const tabs = [{
        id: 1,
        url: 'http://example.com',
        active: true,
        windowId: 1
      }];
      if (callback) callback(tabs);
      return Promise.resolve(tabs);
    }),
    sendMessage: jest.fn((tabId, message, callback) => {
      if (callback) callback({});
      return Promise.resolve({});
    }),
    executeScript: jest.fn((tabId, details, callback) => {
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
  },

  // Windows API mock
  windows: {
    create: jest.fn((createData, callback) => {
      const window = {
        id: 1,
        tabs: [{ id: 1, url: createData.url || 'about:blank' }],
        focused: true
      };
      if (callback) callback(window);
      return Promise.resolve(window);
    }),
    update: jest.fn((windowId, updateInfo, callback) => {
      const window = {
        id: windowId,
        focused: updateInfo.focused || false
      };
      if (callback) callback(window);
      return Promise.resolve(window);
    }),
    getCurrent: jest.fn((callback) => {
      const window = { id: 1, focused: true };
      if (callback) callback(window);
      return Promise.resolve(window);
    })
  },

  // Action API mock (replaces browserAction)
  action: {
    setBadgeText: jest.fn((details, callback) => {
      if (callback) callback();
      return Promise.resolve();
    }),
    setBadgeBackgroundColor: jest.fn((details, callback) => {
      if (callback) callback();
      return Promise.resolve();
    }),
    setTitle: jest.fn((details, callback) => {
      if (callback) callback();
      return Promise.resolve();
    }),
    setIcon: jest.fn((details, callback) => {
      if (callback) callback();
      return Promise.resolve();
    }),
    onClicked: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },

  // Permissions API mock
  permissions: {
    request: jest.fn((permissions, callback) => {
      if (callback) callback(true);
      return Promise.resolve(true);
    }),
    contains: jest.fn((permissions, callback) => {
      if (callback) callback(true);
      return Promise.resolve(true);
    }),
    getAll: jest.fn((callback) => {
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
  },

  // Scripting API mock
  scripting: {
    executeScript: jest.fn((injection, callback) => {
      const result = [{ result: 'success' }];
      if (callback) callback(result);
      return Promise.resolve(result);
    }),
    insertCSS: jest.fn((injection, callback) => {
      if (callback) callback();
      return Promise.resolve();
    })
  }
};

// Setup global test environment
require('./test-config.ts'); * Chrome API Mock for Testing
 * This file provides comprehensive mocks for Chrome Extension APIs
 */

// Mock Chrome APIs
global.chrome = {
  // Storage API mock
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        const result = {};
        if (callback) callback(result);
        return Promise.resolve(result);
      }),
      set: jest.fn((items, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      remove: jest.fn((keys, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      clear: jest.fn((callback) => {
        if (callback) callback();
        return Promise.resolve();
      })
    },
    sync: {
      get: jest.fn((keys, callback) => {
        const result = {};
        if (callback) callback(result);
        return Promise.resolve(result);
      }),
      set: jest.fn((items, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      remove: jest.fn((keys, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      clear: jest.fn((callback) => {
        if (callback) callback();
        return Promise.resolve();
      })
    }
  },

  // Runtime API mock
  runtime: {
    getURL: jest.fn((path) => `chrome-extension://test-id/${path}`),
    sendMessage: jest.fn((message, callback) => {
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
  },

  // Tabs API mock
  tabs: {
    create: jest.fn((createProperties, callback) => {
      const tab = {
        id: 1,
        url: createProperties.url || 'about:blank',
        active: true,
        windowId: 1
      };
      if (callback) callback(tab);
      return Promise.resolve(tab);
    }),
    update: jest.fn((tabId, updateProperties, callback) => {
      const tab = {
        id: tabId,
        url: updateProperties.url || 'about:blank',
        active: updateProperties.active || false
      };
      if (callback) callback(tab);
      return Promise.resolve(tab);
    }),
    query: jest.fn((queryInfo, callback) => {
      const tabs = [{
        id: 1,
        url: 'http://example.com',
        active: true,
        windowId: 1
      }];
      if (callback) callback(tabs);
      return Promise.resolve(tabs);
    }),
    sendMessage: jest.fn((tabId, message, callback) => {
      if (callback) callback({});
      return Promise.resolve({});
    }),
    executeScript: jest.fn((tabId, details, callback) => {
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
  },

  // Windows API mock
  windows: {
    create: jest.fn((createData, callback) => {
      const window = {
        id: 1,
        tabs: [{ id: 1, url: createData.url || 'about:blank' }],
        focused: true
      };
      if (callback) callback(window);
      return Promise.resolve(window);
    }),
    update: jest.fn((windowId, updateInfo, callback) => {
      const window = {
        id: windowId,
        focused: updateInfo.focused || false
      };
      if (callback) callback(window);
      return Promise.resolve(window);
    }),
    getCurrent: jest.fn((callback) => {
      const window = { id: 1, focused: true };
      if (callback) callback(window);
      return Promise.resolve(window);
    })
  },

  // Action API mock (replaces browserAction)
  action: {
    setBadgeText: jest.fn((details, callback) => {
      if (callback) callback();
      return Promise.resolve();
    }),
    setBadgeBackgroundColor: jest.fn((details, callback) => {
      if (callback) callback();
      return Promise.resolve();
    }),
    setTitle: jest.fn((details, callback) => {
      if (callback) callback();
      return Promise.resolve();
    }),
    setIcon: jest.fn((details, callback) => {
      if (callback) callback();
      return Promise.resolve();
    }),
    onClicked: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },

  // Permissions API mock
  permissions: {
    request: jest.fn((permissions, callback) => {
      if (callback) callback(true);
      return Promise.resolve(true);
    }),
    contains: jest.fn((permissions, callback) => {
      if (callback) callback(true);
      return Promise.resolve(true);
    }),
    getAll: jest.fn((callback) => {
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
  },

  // Scripting API mock
  scripting: {
    executeScript: jest.fn((injection, callback) => {
      const result = [{ result: 'success' }];
      if (callback) callback(result);
      return Promise.resolve(result);
    }),
    insertCSS: jest.fn((injection, callback) => {
      if (callback) callback();
      return Promise.resolve();
    })
  }
};

// Setup global test environment
require('./test-config.ts');
