import { create } from 'zustand';

export type ThemeName = 'dark' | 'light' | 'contrast';

export interface ThemeColors {
  navBg: string;
  sidebarBg: string;
  sidebarBorder: string;
  tabColor: string;
  tabActive: string;
  bodyBg: string;
  text: string;
  muted: string;
  cyan: string;
  mapStyle: string;
}

export const THEMES: Record<ThemeName, ThemeColors> = {
  dark: {
    navBg: 'rgba(5,13,26,.95)',
    sidebarBg: '#0a1828',
    sidebarBorder: 'rgba(0,212,232,.1)',
    tabColor: '#5d7a9a',
    tabActive: '#00d4e8',
    bodyBg: '#050d1a',
    text: '#e8eaf0',
    muted: '#5d7a9a',
    cyan: '#00d4e8',
    mapStyle: 'mapbox://styles/mapbox/dark-v11',
  },
  light: {
    navBg: 'rgba(255,255,255,.97)',
    sidebarBg: '#f8fafc',
    sidebarBorder: 'rgba(0,130,150,.15)',
    tabColor: '#607080',
    tabActive: '#007a8a',
    bodyBg: '#eef2f7',
    text: '#1a2a3a',
    muted: '#607080',
    cyan: '#007a8a',
    mapStyle: 'mapbox://styles/mapbox/light-v11',
  },
  contrast: {
    navBg: 'rgba(0,0,0,.99)',
    sidebarBg: '#0d0d0d',
    sidebarBorder: 'rgba(255,255,0,.25)',
    tabColor: '#bbbbbb',
    tabActive: '#00ffee',
    bodyBg: '#000000',
    text: '#ffffff',
    muted: '#cccccc',
    cyan: '#00ffee',
    mapStyle: 'mapbox://styles/mapbox/dark-v11',
  },
};

interface ThemeStore {
  theme: ThemeName;
  colors: ThemeColors;
  setTheme: (t: ThemeName) => void;
}

const STORAGE_KEY = 'fleet_theme';
const saved = (localStorage.getItem(STORAGE_KEY) as ThemeName) || 'dark';

function applyTheme(theme: ThemeName) {
  document.documentElement.setAttribute('data-theme', theme);
  document.body.style.background = THEMES[theme].bodyBg;
  localStorage.setItem(STORAGE_KEY, theme);
}

applyTheme(saved);

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: saved,
  colors: THEMES[saved],
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme, colors: THEMES[theme] });
  },
}));
