/**
 * Settings Panel Component
 * Handles extension settings, API key management, and user preferences
 */

export interface ExtensionSettings {
  apiKey?: string;
  theme: 'system' | 'light' | 'dark';
  notificationsEnabled: boolean;
  automationTimeout: number;
  autoSaveCommands: boolean;
  showAdvancedOptions: boolean;
}

export interface SettingsPanelEvents {
  settingsChange: (settings: ExtensionSettings) => void;
  apiKeyChange: (apiKey: string) => void;
  themeChange: (theme: 'system' | 'light' | 'dark') => void;
  panelShow: () => void;
  panelHide: () => void;
}

export interface ApiKeyTestResult {
  success: boolean;
  message: string;
  details?: any;
}

export class SettingsPanel {
  private panel: HTMLElement;
  private settingsBtn: HTMLElement;
  private closeBtn: HTMLElement;
  private apiKeyInput: HTMLInputElement;
  private toggleApiKeyBtn: HTMLElement;
  private testApiBtn: HTMLElement;
  private saveApiBtn: HTMLElement;
  private themeSelect: HTMLSelectElement;
  private notificationsCheckbox: HTMLInputElement;
  private timeoutInput: HTMLInputElement;
  private settings: ExtensionSettings;
  private events: Partial<SettingsPanelEvents>;
  private isVisible = false;
  private apiKeyVisible = false;

  constructor(
    panelId: string,
    settingsBtnId: string,
    closeBtnId: string,
    apiKeyInputId: string,
    toggleApiKeyBtnId: string,
    testApiBtnId: string,
    saveApiBtnId: string,
    themeSelectId: string,
    notificationsCheckboxId: string,
    timeoutInputId: string,
    events: Partial<SettingsPanelEvents> = {}
  ) {
    // Get DOM elements
    this.panel = document.getElementById(panelId) as HTMLElement;
    this.settingsBtn = document.getElementById(settingsBtnId) as HTMLElement;
    this.closeBtn = document.getElementById(closeBtnId) as HTMLElement;
    this.apiKeyInput = document.getElementById(apiKeyInputId) as HTMLInputElement;
    this.toggleApiKeyBtn = document.getElementById(toggleApiKeyBtnId) as HTMLElement;
    this.testApiBtn = document.getElementById(testApiBtnId) as HTMLElement;
    this.saveApiBtn = document.getElementById(saveApiBtnId) as HTMLElement;
    this.themeSelect = document.getElementById(themeSelectId) as HTMLSelectElement;
    this.notificationsCheckbox = document.getElementById(notificationsCheckboxId) as HTMLInputElement;
    this.timeoutInput = document.getElementById(timeoutInputId) as HTMLInputElement;

    if (!this.panel || !this.settingsBtn || !this.closeBtn || !this.apiKeyInput ||
        !this.toggleApiKeyBtn || !this.testApiBtn || !this.saveApiBtn ||
        !this.themeSelect || !this.notificationsCheckbox || !this.timeoutInput) {
      throw new Error('Required DOM elements not found');
    }

    this.events = events;

    // Initialize default settings
    this.settings = {
      theme: 'system',
      notificationsEnabled: true,
      automationTimeout: 30,
      autoSaveCommands: true,
      showAdvancedOptions: false
    };

    // Initialize the component
    this.init();
  }

  private init(): void {
    // Load saved settings
    this.loadSettings();

    // Set up event listeners
    this.setupEventListeners();

    // Apply initial settings
    this.applySettings();

    // Hide panel initially
    this.hide();
  }

  private setupEventListeners(): void {
    // Settings button
    this.settingsBtn.addEventListener('click', () => this.show());

    // Close button
    this.closeBtn.addEventListener('click', () => this.hide());

    // API key toggle
    this.toggleApiKeyBtn.addEventListener('click', () => this.toggleApiKeyVisibility());

    // API key test
    this.testApiBtn.addEventListener('click', () => this.testApiKey());

    // API key save
    this.saveApiBtn.addEventListener('click', () => this.saveApiKey());

    // Settings change handlers
    this.themeSelect.addEventListener('change', () => this.handleThemeChange());
    this.notificationsCheckbox.addEventListener('change', () => this.handleNotificationsChange());
    this.timeoutInput.addEventListener('change', () => this.handleTimeoutChange());

    // API key input changes
    this.apiKeyInput.addEventListener('input', () => this.handleApiKeyChange());

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });

    // Handle theme changes from system
    if (window.matchMedia) {
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      darkModeQuery.addEventListener('change', () => {
        if (this.settings.theme === 'system') {
          this.applyTheme();
        }
      });
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const result = await chrome.storage.local.get([
        'apiKey',
        'theme',
        'notificationsEnabled',
        'automationTimeout',
        'autoSaveCommands',
        'showAdvancedOptions'
      ]);

      this.settings = {
        ...this.settings,
        ...result
      };

      // Update UI with loaded settings
      this.updateUI();
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  private updateUI(): void {
    // Update API key (masked)
    if (this.settings.apiKey) {
      this.apiKeyInput.value = this.maskApiKey(this.settings.apiKey);
    } else {
      this.apiKeyInput.value = '';
    }

    // Update theme
    this.themeSelect.value = this.settings.theme;

    // Update notifications
    this.notificationsCheckbox.checked = this.settings.notificationsEnabled;

    // Update timeout
    this.timeoutInput.value = this.settings.automationTimeout.toString();
  }

  private maskApiKey(apiKey: string): string {
    if (!apiKey || apiKey.length < 8) return apiKey;
    return apiKey.substring(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.substring(apiKey.length - 4);
  }

  private toggleApiKeyVisibility(): void {
    this.apiKeyVisible = !this.apiKeyVisible;

    if (this.apiKeyVisible && this.settings.apiKey) {
      this.apiKeyInput.value = this.settings.apiKey;
      this.apiKeyInput.type = 'text';
      this.toggleApiKeyBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8-4.24-4.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      `;
    } else {
      this.apiKeyInput.value = this.settings.apiKey ? this.maskApiKey(this.settings.apiKey) : '';
      this.apiKeyInput.type = 'password';
      this.toggleApiKeyBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      `;
    }
  }

  private async testApiKey(): Promise<void> {
    const apiKey = this.apiKeyInput.value.trim();

    if (!apiKey) {
      this.showApiMessage('Please enter an API key', 'error');
      return;
    }

    // Show loading state
    this.testApiBtn.disabled = true;
    this.testApiBtn.textContent = 'Testing...';

    try {
      // Send message to background script to test API key
      const response = await chrome.runtime.sendMessage({
        type: 'testApiKey',
        apiKey: apiKey
      });

      if (response.success) {
        this.showApiMessage('API key is valid', 'success');
      } else {
        this.showApiMessage(`API key test failed: ${response.message}`, 'error');
      }
    } catch (error) {
      this.showApiMessage(`API key test failed: ${error}`, 'error');
    } finally {
      // Reset button state
      this.testApiBtn.disabled = false;
      this.testApiBtn.textContent = 'Test Connection';
    }
  }

  private async saveApiKey(): Promise<void> {
    const apiKey = this.apiKeyInput.value.trim();

    if (!apiKey) {
      this.showApiMessage('Please enter an API key', 'error');
      return;
    }

    // Validate API key format
    if (!this.validateApiKey(apiKey)) {
      this.showApiMessage('Invalid API key format', 'error');
      return;
    }

    try {
      // Save to storage
      await chrome.storage.local.set({ apiKey });

      // Update settings
      this.settings.apiKey = apiKey;

      // Update UI
      this.apiKeyInput.value = this.maskApiKey(apiKey);
      this.apiKeyInput.type = 'password';
      this.apiKeyVisible = false;

      // Show success message
      this.showApiMessage('API key saved successfully', 'success');

      // Trigger event
      this.events.apiKeyChange?.(apiKey);
      this.events.settingsChange?.(this.settings);
    } catch (error) {
      this.showApiMessage(`Failed to save API key: ${error}`, 'error');
    }
  }

  private validateApiKey(apiKey: string): boolean {
    // Basic validation - adjust based on actual API key format
    return apiKey.length >= 20 && /^[a-zA-Z0-9_-]+$/.test(apiKey);
  }

  private showApiMessage(message: string, type: 'success' | 'error'): void {
    // Create or update message element
    let messageElement = document.getElementById('api-key-message');
    if (!messageElement) {
      messageElement = document.createElement('div');
      messageElement.id = 'api-key-message';
      messageElement.className = 'api-key-message';

      // Insert after the API key help text
      const helpElement = document.getElementById('api-key-help');
      if (helpElement) {
        helpElement.parentNode?.insertBefore(messageElement, helpElement.nextSibling);
      }
    }

    messageElement.textContent = message;
    messageElement.className = `api-key-message ${type}`;
    messageElement.style.padding = '8px 12px';
    messageElement.style.marginTop = '8px';
    messageElement.style.borderRadius = 'var(--radius-md)';
    messageElement.style.fontSize = '12px';

    if (type === 'success') {
      messageElement.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
      messageElement.style.color = 'var(--success-color)';
      messageElement.style.border = '1px solid rgba(16, 185, 129, 0.2)';
    } else {
      messageElement.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
      messageElement.style.color = 'var(--error-color)';
      messageElement.style.border = '1px solid rgba(239, 68, 68, 0.2)';
    }

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (messageElement && messageElement.parentNode) {
        messageElement.parentNode.removeChild(messageElement);
      }
    }, 5000);
  }

  private handleThemeChange(): void {
    this.settings.theme = this.themeSelect.value as 'system' | 'light' | 'dark';
    this.applyTheme();
    this.saveSettings();
    this.events.themeChange?.(this.settings.theme);
    this.events.settingsChange?.(this.settings);
  }

  private handleNotificationsChange(): void {
    this.settings.notificationsEnabled = this.notificationsCheckbox.checked;
    this.saveSettings();
    this.events.settingsChange?.(this.settings);
  }

  private handleTimeoutChange(): void {
    const timeout = parseInt(this.timeoutInput.value);
    if (!isNaN(timeout) && timeout >= 5 && timeout <= 120) {
      this.settings.automationTimeout = timeout;
      this.saveSettings();
      this.events.settingsChange?.(this.settings);
    }
  }

  private handleApiKeyChange(): void {
    // Clear any existing API key message when user starts typing
    const messageElement = document.getElementById('api-key-message');
    if (messageElement && messageElement.parentNode) {
      messageElement.parentNode.removeChild(messageElement);
    }
  }

  private applyTheme(): void {
    const root = document.documentElement;

    if (this.settings.theme === 'system') {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', this.settings.theme);
    }
  }

  private applySettings(): void {
    this.applyTheme();

    // Apply other settings as needed
    if (this.settings.notificationsEnabled) {
      // Enable notifications
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      await chrome.storage.local.set({
        theme: this.settings.theme,
        notificationsEnabled: this.settings.notificationsEnabled,
        automationTimeout: this.settings.automationTimeout,
        autoSaveCommands: this.settings.autoSaveCommands,
        showAdvancedOptions: this.settings.showAdvancedOptions
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  public show(): void {
    this.panel.hidden = false;
    this.isVisible = true;
    this.events.panelShow?.();

    // Focus on first input
    setTimeout(() => {
      this.apiKeyInput.focus();
    }, 100);
  }

  public hide(): void {
    this.panel.hidden = true;
    this.isVisible = false;
    this.events.panelHide?.();
  }

  public toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  public getSettings(): ExtensionSettings {
    return { ...this.settings };
  }

  public async updateSettings(newSettings: Partial<ExtensionSettings>): Promise<void> {
    this.settings = { ...this.settings, ...newSettings };
    this.updateUI();
    this.applySettings();
    await this.saveSettings();
    this.events.settingsChange?.(this.settings);
  }

  public isPanelVisible(): boolean {
    return this.isVisible;
  }

  public hasApiKey(): boolean {
    return !!this.settings.apiKey;
  }

  public getApiKey(): string | undefined {
    return this.settings.apiKey;
  }

  public destroy(): void {
    // Remove event listeners
    this.settingsBtn.removeEventListener('click', () => this.show());
    this.closeBtn.removeEventListener('click', () => this.hide());
    this.toggleApiKeyBtn.removeEventListener('click', () => this.toggleApiKeyVisibility());
    this.testApiBtn.removeEventListener('click', () => this.testApiKey());
    this.saveApiBtn.removeEventListener('click', () => this.saveApiKey());
    this.themeSelect.removeEventListener('change', () => this.handleThemeChange());
    this.notificationsCheckbox.removeEventListener('change', () => this.handleNotificationsChange());
    this.timeoutInput.removeEventListener('change', () => this.handleTimeoutChange());
    this.apiKeyInput.removeEventListener('input', () => this.handleApiKeyChange());
  }
}
