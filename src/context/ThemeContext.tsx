import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

interface ThemeConfig {
  primaryColor: string;
  backgroundColor: string;
  headerColor: string;
  sidebarColor: string;
  borderColor: string;
  accentColor: string;
  successColor: string;
  fontSans: string;
  fontMono: string;
  cardRadius?: string;
  glowIntensity?: string;
  backgroundImage?: string;
}

interface LayoutConfig {
  sidebarEnabled: boolean;
  defaultView: 'grid' | 'list' | 'dense';
}

interface SystemConfig {
  theme: ThemeConfig;
  layout: LayoutConfig;
}

interface ThemeContextType {
  config: SystemConfig;
  updateConfig: (newConfig: SystemConfig) => Promise<void>;
  resetToDefault: () => Promise<void>;
  isLoading: boolean;
}

const defaultTheme: ThemeConfig = {
  primaryColor: "#6366f1",
  backgroundColor: "#0a0a0b",
  headerColor: "#0e0e0f",
  sidebarColor: "#0c0c0d",
  borderColor: "#2a2a2c",
  accentColor: "#6366f1",
  successColor: "#00ff9d",
  fontSans: "Outfit",
  fontMono: "JetBrains Mono",
  cardRadius: "0.75rem",
  glowIntensity: "0.5",
  backgroundImage: ""
};

const defaultLayout: LayoutConfig = {
  sidebarEnabled: true,
  defaultView: 'grid'
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<SystemConfig>({
    theme: defaultTheme,
    layout: defaultLayout
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/config`);
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        applyTheme(data.theme);
      }
    } catch (error) {
      console.error("Failed to fetch theme config", error);
      applyTheme(defaultTheme);
    } finally {
      setIsLoading(false);
    }
  };

  const applyTheme = (theme: ThemeConfig) => {
    const root = document.documentElement;
    root.style.setProperty('--color-brand-bg', theme.backgroundColor);
    root.style.setProperty('--color-brand-header', theme.headerColor);
    root.style.setProperty('--color-brand-sidebar', theme.sidebarColor);
    root.style.setProperty('--color-brand-border', theme.borderColor);
    root.style.setProperty('--color-brand-accent', theme.accentColor);
    root.style.setProperty('--color-brand-success', theme.successColor);
    root.style.setProperty('--font-sans', `"${theme.fontSans}", ui-sans-serif, system-ui, sans-serif`);
    root.style.setProperty('--font-mono', `"${theme.fontMono}", ui-monospace, SFMono-Regular, monospace`);
    root.style.setProperty('--card-radius', theme.cardRadius || "0.75rem");
    root.style.setProperty('--glow-opacity', theme.glowIntensity || "0.5");
    root.style.setProperty('--bg-image', theme.backgroundImage ? `url(${theme.backgroundImage})` : 'none');
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const updateConfig = async (newConfig: SystemConfig) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        applyTheme(data.theme);
      }
    } catch (error) {
      console.error("Failed to update config", error);
    }
  };

  const resetToDefault = async () => {
    const defaultConfig = { theme: defaultTheme, layout: defaultLayout };
    await updateConfig(defaultConfig);
  };

  return (
    <ThemeContext.Provider value={{ config, updateConfig, resetToDefault, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
