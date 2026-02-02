import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  extensionApi: 'chrome',
  manifest: {
    name: 'Ray - AI Browser Automation',
    description: 'AI-powered browser automation assistant',
    permissions: [
      'tabs',
      'scripting',
      'storage',
      'activeTab'
    ],
    host_permissions: [
      '<all_urls>'
    ],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'"
    }
  },
  vite: () => ({
    build: {
      target: 'esnext',
    },
  }),
});
// See https://wxt.dev/api/config.html
export default defineConfig({
  extensionApi: 'chrome',
  manifest: {
    name: 'Ray - AI Browser Automation',
    description: 'AI-powered browser automation assistant',
    permissions: [
      'tabs',
      'scripting',
      'storage',
      'activeTab'
    ],
    host_permissions: [
      '<all_urls>'
    ],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'"
    }
  },
  vite: () => ({
    build: {
      target: 'esnext',
    },
  }),
});
