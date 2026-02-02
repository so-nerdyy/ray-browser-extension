/**
 * Ray Extension - Popup Application
 * Main application logic for the extension popup
 * This file will be expanded by Blake (UI/Popup Development agent)
 */

import { getCurrentTab } from '../lib/utils/chrome-tabs';
import { getStorageValue, setStorageValue } from '../lib/utils/chrome-storage';
import type { ExtensionMessage, AutomationCommand } from '../lib/types/chrome-api';

/**
 * Popup application class
 */
class RayPopupApp {
  private commandInput: HTMLTextAreaElement;
  private executeButton: HTMLButtonElement;
  private clearButton: HTMLButtonElement;
  private settingsButton: HTMLButtonElement;
  private statusIndicator: HTMLElement;
  private feedbackSection: HTMLElement;
  private feedbackContent: HTMLElement;
  private closeFeedbackButton: HTMLButtonElement;
  private versionText: HTMLElement;
  private helpLink: HTMLAnchorElement;
  private aboutLink: HTMLAnchorElement;

  constructor() {
    // Cache DOM elements
    this.commandInput = document.getElementById('commandInput') as HTMLTextAreaElement;
    this.executeButton = document.getElementById('executeButton') as HTMLButtonElement;
    this.clearButton = document.getElementById('clearButton') as HTMLButtonElement;
    this.settingsButton = document.getElementById('settingsButton') as HTMLButtonElement;
    this.statusIndicator = document.getElementById('statusIndicator') as HTMLElement;
    this.feedbackSection = document.getElementById('feedbackSection') as HTMLElement;
    this.feedbackContent = document.getElementById('feedbackContent') as HTMLElement;
    this.closeFeedbackButton = document.getElementById('closeFeedback') as HTMLButtonElement;
    this.versionText = document.getElementById('versionText') as HTMLElement;
    this.helpLink = document.getElementById('helpLink') as HTMLAnchorElement;
    this.aboutLink = document.getElementById('aboutLink') as HTMLAnchorElement;

    this.initialize();
  }

  /**
   * Initialize the popup application
   */
  private async initialize(): Promise<void> {
    console.log('Ray Extension - Popup app initializing');

    try {
      // Set version
      this.setVersion();

      // Load settings
      await this.loadSettings();

      // Set up event listeners
      this.setupEventListeners();

      // Check current tab status
      await this.checkTabStatus();

      console.log('Ray Extension - Popup app ready');
    } catch (error) {
      console.error('Ray Extension - Failed to initialize popup:', error);
      this.showError('Failed to initialize popup');
    }
  }

  /**
   * Set the extension version
   */
  private setVersion(): void {
    const version = chrome.runtime.getManifest().version;
    if (this.versionText) {
      this.versionText.textContent = `v${version}`;
    }
  }

  /**
   * Load user settings
   */
  private async loadSettings(): Promise<void> {
    try {
      const settings = await getStorageValue('ray-settings', {
        enabled: true,
        debugMode: false,
        autoConfirm: false
      });

      // Apply settings to UI
      if (!settings.enabled) {
        this.setStatus('disabled');
        this.executeButton.disabled = true;
      }
    } catch (error) {
      console.error('Ray Extension - Failed to load settings:', error);
    }
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Execute button
    this.executeButton.addEventListener('click', () => {
      this.handleExecuteCommand();
    });

    // Clear button
    this.clearButton.addEventListener('click', () => {
      this.handleClearCommand();
    });

    // Settings button
    this.settingsButton.addEventListener('click', () => {
      this.handleOpenSettings();
    });

    // Close feedback
    this.closeFeedbackButton.addEventListener('click', () => {
      this.hideFeedback();
    });

    // Help and about links
    this.helpLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleOpenHelp();
    });

    this.aboutLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleOpenAbout();
    });

    // Command input events
    this.commandInput.addEventListener('input', () => {
      this.handleInputChange();
    });

    this.commandInput.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        this.handleExecuteCommand();
      }
    });
  }

  /**
   * Check current tab status
   */
  private async checkTabStatus(): Promise<void> {
    try {
      const tab = await getCurrentTab();
      if (tab && tab.url) {
        // Update status based on URL
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
          this.setStatus('restricted');
          this.executeButton.disabled = true;
          this.showInfo('Ray cannot work on Chrome internal pages');
        } else {
          this.setStatus('ready');
        }
      }
    } catch (error) {
      console.error('Ray Extension - Failed to check tab status:', error);
      this.setStatus('error');
    }
  }

  /**
   * Handle command execution
   */
  private async handleExecuteCommand(): Promise<void> {
    const command = this.commandInput.value.trim();

    if (!command) {
      this.showWarning('Please enter a command');
      return;
    }

    this.setStatus('processing');
    this.executeButton.disabled = true;
    this.showInfo('Processing command...');

    try {
      // Send command to background script
      const response = await this.sendMessage({
        type: 'EXECUTE_AUTOMATION',
        payload: {
          id: this.generateCommandId(),
          type: 'execute',
          command: command,
          tabId: await this.getCurrentTabId()
        } as AutomationCommand
      });

      if (response.success) {
        this.setStatus('success');
        this.showSuccess('Command executed successfully');
        this.commandInput.value = '';
      } else {
        this.setStatus('error');
        this.showError(response.error || 'Failed to execute command');
      }
    } catch (error) {
      this.setStatus('error');
      this.showError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      this.executeButton.disabled = false;

      // Reset status after delay
      setTimeout(() => {
        this.setStatus('ready');
      }, 3000);
    }
  }

  /**
   * Handle clear command
   */
  private handleClearCommand(): void {
    this.commandInput.value = '';
    this.commandInput.focus();
    this.hideFeedback();
  }

  /**
   * Handle open settings
   */
  private handleOpenSettings(): void {
    // This will be implemented by Blake
    console.log('Ray Extension - Settings requested');
    this.showInfo('Settings page coming soon!');
  }

  /**
   * Handle open help
   */
  private handleOpenHelp(): void {
    chrome.tabs.create({
      url: 'https://github.com/ray-extension/help'
    });
  }

  /**
   * Handle open about
   */
  private handleOpenAbout(): void {
    this.showInfo('Ray Extension v1.0.0 - AI Browser Automation Assistant');
  }

  /**
   * Handle input change
   */
  private handleInputChange(): void {
    const hasContent = this.commandInput.value.trim().length > 0;
    this.executeButton.disabled = !hasContent;
  }

  /**
   * Send message to background script
   */
  private async sendMessage(message: ExtensionMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Get current tab ID
   */
  private async getCurrentTabId(): Promise<number | undefined> {
    const tab = await getCurrentTab();
    return tab?.id;
  }

  /**
   * Generate unique command ID
   */
  private generateCommandId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set status indicator
   */
  private setStatus(status: 'ready' | 'processing' | 'success' | 'error' | 'disabled' | 'restricted'): void {
    if (!this.statusIndicator) return;

    // Remove all status classes
    this.statusIndicator.className = 'status-indicator';

    // Add new status class
    this.statusIndicator.classList.add(`status-${status}`);

    // Update status text
    const statusText = this.statusIndicator.querySelector('.status-text') as HTMLElement;
    if (statusText) {
      const statusMap = {
        ready: 'Ready',
        processing: 'Processing',
        success: 'Success',
        error: 'Error',
        disabled: 'Disabled',
        restricted: 'Restricted'
      };
      statusText.textContent = statusMap[status] || 'Unknown';
    }
  }

  /**
   * Show feedback message
   */
  private showFeedback(type: 'info' | 'success' | 'warning' | 'error', message: string): void {
    if (!this.feedbackSection || !this.feedbackContent) return;

    this.feedbackContent.className = `message message-${type}`;
    this.feedbackContent.textContent = message;
    this.feedbackSection.style.display = 'block';
  }

  /**
   * Show info message
   */
  private showInfo(message: string): void {
    this.showFeedback('info', message);
  }

  /**
   * Show success message
   */
  private showSuccess(message: string): void {
    this.showFeedback('success', message);
  }

  /**
   * Show warning message
   */
  private showWarning(message: string): void {
    this.showFeedback('warning', message);
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    this.showFeedback('error', message);
  }

  /**
   * Hide feedback
   */
  private hideFeedback(): void {
    if (this.feedbackSection) {
      this.feedbackSection.style.display = 'none';
    }
  }
}

// Initialize the popup app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new RayPopupApp();
});
