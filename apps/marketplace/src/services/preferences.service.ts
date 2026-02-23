export type Theme = 'light' | 'dark' | 'auto';

export interface AccessibilitySettings {
  reduceMotion: boolean;
  highContrast: boolean;
  fontSize: 'normal' | 'large' | 'xlarge';
  letterSpacing: 'normal' | 'wide';
  dyslexicFont: boolean;
  underlineLinks: boolean;
  focusVisible: boolean;
}

class PreferencesService {
  private theme: Theme = 'auto';
  private accessibility: AccessibilitySettings = {
    reduceMotion: false,
    highContrast: false,
    fontSize: 'normal',
    letterSpacing: 'normal',
    dyslexicFont: false,
    underlineLinks: false,
    focusVisible: false,
  };

  constructor() {
    this.loadPreferences();
    this.applyTheme();
    this.applyAccessibility();
    this.watchSystemTheme();
  }

  private loadPreferences() {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) {
      this.theme = savedTheme;
    }

    const savedAccessibility = localStorage.getItem('accessibility');
    if (savedAccessibility) {
      // Merge with defaults so new fields are always present
      this.accessibility = { ...this.accessibility, ...JSON.parse(savedAccessibility) };
    }
  }

  private watchSystemTheme() {
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.theme === 'auto') {
          this.applyTheme();
        }
      });
    }
  }

  getTheme(): Theme {
    return this.theme;
  }

  setTheme(theme: Theme) {
    this.theme = theme;
    localStorage.setItem('theme', theme);
    this.applyTheme();
    this.notifyThemeChange();
  }

  private applyTheme() {
    const root = document.documentElement;
    let effectiveTheme = this.theme;

    if (effectiveTheme === 'auto') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    root.setAttribute('data-theme', effectiveTheme);
    // Sync the Tailwind 'dark' class
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }

  getAccessibility(): AccessibilitySettings {
    return { ...this.accessibility };
  }

  setAccessibility(settings: Partial<AccessibilitySettings>) {
    this.accessibility = { ...this.accessibility, ...settings };
    localStorage.setItem('accessibility', JSON.stringify(this.accessibility));
    this.applyAccessibility();
    this.notifyAccessibilityChange();
  }

  private applyAccessibility() {
    const root = document.documentElement;

    // Reduce motion
    root.style.setProperty(
      '--animation-duration',
      this.accessibility.reduceMotion ? '0.01ms' : '300ms',
    );

    // High contrast
    if (this.accessibility.highContrast) {
      root.setAttribute('data-contrast', 'high');
    } else {
      root.removeAttribute('data-contrast');
    }

    // Font size
    root.setAttribute('data-font-size', this.accessibility.fontSize);

    // Letter spacing
    if (this.accessibility.letterSpacing === 'wide') {
      root.setAttribute('data-letter-spacing', 'wide');
    } else {
      root.removeAttribute('data-letter-spacing');
    }

    // Dyslexic font
    if (this.accessibility.dyslexicFont) {
      root.setAttribute('data-font', 'dyslexic');
    } else {
      root.removeAttribute('data-font');
    }

    // Underline links
    if (this.accessibility.underlineLinks) {
      root.setAttribute('data-underline-links', 'true');
    } else {
      root.removeAttribute('data-underline-links');
    }

    // Focus visible
    if (this.accessibility.focusVisible) {
      root.setAttribute('data-focus-visible', 'true');
    } else {
      root.removeAttribute('data-focus-visible');
    }
  }

  private notifyThemeChange() {
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: this.theme }));
  }

  private notifyAccessibilityChange() {
    window.dispatchEvent(new CustomEvent('accessibility-changed', { detail: this.accessibility }));
  }

  // Museum selection
  getSelectedMuseumId(): string | null {
    const saved = localStorage.getItem('selectedMuseum');
    if (saved) {
      try {
        const museum = JSON.parse(saved);
        return museum._id || null;
      } catch {
        return null;
      }
    }
    return null;
  }

  getSelectedMuseum(): { _id: string; wikidataId?: string; name: string } | null {
    const saved = localStorage.getItem('selectedMuseum');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  }

  setSelectedMuseum(museum: { _id: string; wikidataId?: string; name: string }) {
    localStorage.setItem('selectedMuseum', JSON.stringify(museum));
    window.dispatchEvent(new CustomEvent('museum-changed', { detail: museum }));
  }

  clearSelectedMuseum() {
    localStorage.removeItem('selectedMuseum');
    window.dispatchEvent(new CustomEvent('museum-changed', { detail: null }));
  }
}

export const preferencesService = new PreferencesService();
