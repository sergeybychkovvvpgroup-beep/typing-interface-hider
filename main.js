'use strict';

const { Plugin, PluginSettingTab, Setting, Notice } = require('obsidian');

const DEFAULT_SETTINGS = {
  restoreAfterIdle: true,
  idleDelayMs: 1000,
  fadeDurationMs: 780,
  onlyInMarkdownEditor: true,
  hideOnAnyEditorKey: true,
  hideOnScroll: false,
  hideSidebars: true,
  hideRibbon: true,
  hideTabHeaders: true,
  hideViewHeader: true,
  hideStatusbar: true,
  hideTitlebar: true,
  hideScrollbars: false
};

module.exports = class TypingInterfaceHiderPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.hideTimer = null;
    this.hidden = false;

    this.addSettingTab(new TypingInterfaceHiderSettingTab(this.app, this));
    this.applyOptionClasses();
    this.applyTimingVariables();

    this.registerDomEvent(document, 'keydown', (event) => this.onKeyDown(event), true);
    this.registerDomEvent(document, 'input', (event) => this.onTextInput(event), true);
    this.registerDomEvent(document, 'compositionstart', (event) => this.onTextInput(event), true);
    this.registerDomEvent(document, 'paste', (event) => this.onTextInput(event), true);
    this.registerDomEvent(document, 'wheel', (event) => this.onScrollActivity(event), true);
    this.registerDomEvent(document, 'scroll', (event) => this.onScrollActivity(event), true);
    this.registerDomEvent(document, 'touchmove', (event) => this.onScrollActivity(event), true);

    // Any non-scroll mouse/touch action brings Obsidian UI back immediately.
    this.registerDomEvent(document, 'mousemove', () => this.showInterface(), true);
    this.registerDomEvent(document, 'pointerdown', () => this.showInterface(), true);
    this.registerDomEvent(window, 'blur', () => this.showInterface());

    this.addCommand({
      id: 'show-interface-now',
      name: 'Show interface now',
      callback: () => this.showInterface()
    });

    this.addCommand({
      id: 'hide-interface-now',
      name: 'Hide interface now',
      callback: () => this.hideInterface()
    });
  }

  onunload() {
    this.clearTimer();
    this.removeClasses();
  }

  onKeyDown(event) {
    if (!this.shouldReactToEvent(event)) return;
    if (!this.settings.hideOnAnyEditorKey && !this.isTextChangingKey(event)) return;
    this.hideInterface();
  }

  onTextInput(event) {
    if (!this.shouldReactToEvent(event)) return;
    this.hideInterface();
  }

  onScrollActivity(event) {
    if (!this.settings.hideOnScroll) {
      this.showInterface();
      return;
    }
    if (!this.shouldReactToEvent(event)) return;
    this.hideInterface({ restoreAfterIdle: false });
  }

  shouldReactToEvent(event) {
    if (event.defaultPrevented) return false;
    if (this.isModifierOnlyKey(event)) return false;
    if (this.isInsideIgnoredUi(event.target)) return false;
    if (this.settings.onlyInMarkdownEditor && !this.isMarkdownEditorActive()) return false;
    return this.isEditorTarget(event.target);
  }

  isModifierOnlyKey(event) {
    return ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Escape'].includes(event.key);
  }

  isTextChangingKey(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    if (event.key && event.key.length === 1) return true;
    return [
      'Backspace', 'Delete', 'Enter', 'Tab', 'Space',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End', 'PageUp', 'PageDown'
    ].includes(event.key);
  }

  isInsideIgnoredUi(target) {
    if (!(target instanceof Element)) return false;
    return !!target.closest('.modal-container, .menu, .suggestion-container, .prompt, .notice-container, .setting-item');
  }

  isEditorTarget(target) {
    if (!(target instanceof Element)) return false;
    return !!target.closest('.markdown-source-view, .cm-editor, .cm-content, .markdown-preview-view')
      && !target.closest('input, textarea, select, button');
  }

  isMarkdownEditorActive() {
    const activeView = this.app.workspace.getActiveViewOfType(require('obsidian').MarkdownView);
    return !!activeView;
  }

  hideInterface(options = {}) {
    const restoreAfterIdle = options.restoreAfterIdle !== false;
    this.applyOptionClasses();
    this.applyTimingVariables();
    if (!this.hidden) {
      document.body.classList.add('typing-interface-hider-active');
      this.hidden = true;
    }
    if (restoreAfterIdle) {
      this.restartTimer();
    } else {
      this.clearTimer();
    }
  }

  showInterface() {
    this.clearTimer();
    if (this.hidden) {
      document.body.classList.remove('typing-interface-hider-active');
      this.hidden = false;
    }
  }

  restartTimer() {
    this.clearTimer();
    if (!this.settings.restoreAfterIdle) return;
    const delay = Math.max(100, Number(this.settings.idleDelayMs) || DEFAULT_SETTINGS.idleDelayMs);
    this.hideTimer = window.setTimeout(() => this.showInterface(), delay);
  }

  clearTimer() {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  applyTimingVariables() {
    const duration = Math.max(80, Number(this.settings.fadeDurationMs) || DEFAULT_SETTINGS.fadeDurationMs);
    document.body.style.setProperty('--typing-interface-hider-duration', `${duration}ms`);
  }

  applyOptionClasses() {
    const classMap = {
      hideSidebars: 'typing-interface-hider-hide-sidebars',
      hideRibbon: 'typing-interface-hider-hide-ribbon',
      hideTabHeaders: 'typing-interface-hider-hide-tab-headers',
      hideViewHeader: 'typing-interface-hider-hide-view-header',
      hideStatusbar: 'typing-interface-hider-hide-statusbar',
      hideTitlebar: 'typing-interface-hider-hide-titlebar',
      hideScrollbars: 'typing-interface-hider-hide-scrollbars'
    };

    for (const [key, className] of Object.entries(classMap)) {
      document.body.classList.toggle(className, !!this.settings[key]);
    }
  }

  removeClasses() {
    document.body.classList.remove(
      'typing-interface-hider-active',
      'typing-interface-hider-hide-sidebars',
      'typing-interface-hider-hide-ribbon',
      'typing-interface-hider-hide-tab-headers',
      'typing-interface-hider-hide-view-header',
      'typing-interface-hider-hide-statusbar',
      'typing-interface-hider-hide-titlebar',
      'typing-interface-hider-hide-scrollbars'
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.applyOptionClasses();
    this.applyTimingVariables();
    new Notice('Typing Interface Hider settings saved');
  }
};

class TypingInterfaceHiderSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Typing Interface Hider' });

    new Setting(containerEl)
      .setName('Return UI automatically after idle')
      .setDesc('Controls automatic restore after typing/keyboard activity. Scroll hiding has its own reading-friendly behavior and stays hidden until mouse movement, click, window blur, or the “Show interface now” command.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.restoreAfterIdle)
        .onChange(async (value) => {
          this.plugin.settings.restoreAfterIdle = value;
          if (!value) this.plugin.clearTimer();
          await this.plugin.saveSettings();
          this.display();
        }));

    const idleDelaySetting = new Setting(containerEl)
      .setName('Idle return delay, ms')
      .setDesc('How long to wait after the last key before restoring the interface. Used only for typing/keyboard activity when automatic idle return is enabled. Default: 1000.')
      .addText((text) => {
        text
          .setPlaceholder('1000')
          .setValue(String(this.plugin.settings.idleDelayMs))
          .onChange(async (value) => {
            const parsed = Number.parseInt(value, 10);
            if (!Number.isNaN(parsed)) {
              this.plugin.settings.idleDelayMs = Math.max(100, parsed);
              await this.plugin.saveSettings();
            }
          });
        text.inputEl.disabled = !this.plugin.settings.restoreAfterIdle;
      });

    idleDelaySetting.settingEl.classList.toggle('is-disabled', !this.plugin.settings.restoreAfterIdle);

    new Setting(containerEl)
      .setName('Fade duration, ms')
      .setDesc('Pure fade-out/fade-in time. Text stays in the same place. Default: 780.')
      .addText((text) => text
        .setPlaceholder('780')
        .setValue(String(this.plugin.settings.fadeDurationMs))
        .onChange(async (value) => {
          const parsed = Number.parseInt(value, 10);
          if (!Number.isNaN(parsed)) {
            this.plugin.settings.fadeDurationMs = Math.max(80, parsed);
            await this.plugin.saveSettings();
          }
        }));

    new Setting(containerEl)
      .setName('Only in Markdown notes')
      .setDesc('Do not hide the interface while typing in search, settings, plugin dialogs, etc.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.onlyInMarkdownEditor)
        .onChange(async (value) => {
          this.plugin.settings.onlyInMarkdownEditor = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Hide on navigation keys too')
      .setDesc('If enabled, arrows/Home/End/etc. in the editor also keep the interface hidden.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.hideOnAnyEditorKey)
        .onChange(async (value) => {
          this.plugin.settings.hideOnAnyEditorKey = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Hide while scrolling')
      .setDesc('If enabled, scrolling a Markdown note hides the interface too, including in reading view. After scrolling, the interface stays hidden until mouse movement, click, window blur, or the “Show interface now” command.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.hideOnScroll)
        .onChange(async (value) => {
          this.plugin.settings.hideOnScroll = value;
          await this.plugin.saveSettings();
        }));

    const toggles = [
      ['hideSidebars', 'Hide sidebars'],
      ['hideRibbon', 'Hide left ribbon'],
      ['hideTabHeaders', 'Hide tab headers'],
      ['hideViewHeader', 'Hide note header'],
      ['hideStatusbar', 'Hide status bar'],
      ['hideTitlebar', 'Hide window title bar'],
      ['hideScrollbars', 'Hide scrollbars']
    ];

    for (const [key, label] of toggles) {
      new Setting(containerEl)
        .setName(label)
        .addToggle((toggle) => toggle
          .setValue(this.plugin.settings[key])
          .onChange(async (value) => {
            this.plugin.settings[key] = value;
            await this.plugin.saveSettings();
          }));
    }
  }
}
