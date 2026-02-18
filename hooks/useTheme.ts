import { useColorScheme } from 'nativewind';
import { useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// Types
// ============================================================================

export type ThemePreference = 'light' | 'dark' | 'system';

// ============================================================================
// Storage
// ============================================================================

const THEME_STORAGE_KEY = '@opic_app_theme_preference';

export async function loadThemePreference(): Promise<ThemePreference> {
  try {
    const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'system';
  } catch {
    return 'system';
  }
}

// ============================================================================
// Color Palettes
// ============================================================================

export type ThemeColors = {
  surface: string;
  surfaceSecondary: string;
  surfaceElevated: string;
  card: string;
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;
  border: string;
  borderLight: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  secondaryLight: string;
  error: string;
  success: string;
  warning: string;
  info: string;
  accentRedBg: string;
  accentBlueBg: string;
  accentPinkBg: string;
  accentYellowBg: string;
  accentGreenBg: string;
  accentRedText: string;
  accentBlueText: string;
  accentGreenText: string;
  accentYellowText: string;
  gray50: string;
  gray100: string;
  gray200: string;
  gray300: string;
  gray400: string;
  gray500: string;
  gray600: string;
  gray700: string;
  gray800: string;
  gray900: string;
  white: string;
  black: string;
  overlay: string;
  shadowColor: string;
};

const LIGHT_COLORS: ThemeColors = {
  // Surfaces
  surface: '#FFFFFF',
  surfaceSecondary: '#FAFAFA',
  surfaceElevated: '#FFFFFF',
  card: '#FFFFFF',

  // Text
  textPrimary: '#171717',
  textSecondary: '#737373',
  textDisabled: '#A3A3A3',

  // Borders
  border: '#E5E5E5',
  borderLight: '#F5F5F5',

  // Primary
  primary: '#D4707F',
  primaryLight: '#FDE8EB',
  primaryDark: '#B85A69',

  // Secondary
  secondary: '#F5A623',
  secondaryLight: '#FEF3C7',

  // Status
  error: '#F87171',
  success: '#34D399',
  warning: '#FBBF24',
  info: '#E88B9A',

  // Accent backgrounds (soft tints)
  accentRedBg: '#FEE2E2',
  accentBlueBg: '#DBEAFE',
  accentPinkBg: '#FFF0F2',
  accentYellowBg: '#FEF3C7',
  accentGreenBg: '#D1FAE5',

  // Accent text (on accent backgrounds)
  accentRedText: '#991B1B',
  accentBlueText: '#1E40AF',
  accentGreenText: '#065F46',
  accentYellowText: '#92400E',

  // Grayscale (for specific shade needs)
  gray50: '#FAFAFA',
  gray100: '#F5F5F5',
  gray200: '#E5E5E5',
  gray300: '#D4D4D4',
  gray400: '#A3A3A3',
  gray500: '#737373',
  gray600: '#525252',
  gray700: '#404040',
  gray800: '#262626',
  gray900: '#171717',

  // Fixed (never change with theme)
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.5)',
  shadowColor: '#000000',
};

const DARK_COLORS: ThemeColors = {
  // Surfaces
  surface: '#171717',
  surfaceSecondary: '#262626',
  surfaceElevated: '#262626',
  card: '#262626',

  // Text
  textPrimary: '#FAFAFA',
  textSecondary: '#A3A3A3',
  textDisabled: '#737373',

  // Borders
  border: '#404040',
  borderLight: '#262626',

  // Primary (slightly lighter for dark bg contrast)
  primary: '#E88B9A',
  primaryLight: '#3D1520',
  primaryDark: '#D4707F',

  // Secondary
  secondary: '#F5A623',
  secondaryLight: '#422006',

  // Status (same or slightly adjusted)
  error: '#F87171',
  success: '#34D399',
  warning: '#FBBF24',
  info: '#E88B9A',

  // Accent backgrounds (dark muted tints)
  accentRedBg: '#4C1D1D',
  accentBlueBg: '#1E3A5F',
  accentPinkBg: '#3D1520',
  accentYellowBg: '#422006',
  accentGreenBg: '#14332A',

  // Accent text (lighter for dark bg)
  accentRedText: '#FCA5A5',
  accentBlueText: '#93C5FD',
  accentGreenText: '#6EE7B7',
  accentYellowText: '#FCD34D',

  // Grayscale (inverted for dark mode)
  gray50: '#171717',
  gray100: '#262626',
  gray200: '#404040',
  gray300: '#525252',
  gray400: '#737373',
  gray500: '#A3A3A3',
  gray600: '#D4D4D4',
  gray700: '#E5E5E5',
  gray800: '#F5F5F5',
  gray900: '#FAFAFA',

  // Fixed (never change with theme)
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.7)',
  shadowColor: '#000000',
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Returns theme-aware color tokens.
 * Use in components with StyleSheet.create or inline styles.
 */
export function useThemeColors(): ThemeColors {
  const { colorScheme } = useColorScheme();
  return useMemo(
    () => (colorScheme === 'dark' ? DARK_COLORS : LIGHT_COLORS),
    [colorScheme],
  );
}

/**
 * Returns isDark boolean for conditional rendering.
 */
export function useIsDark(): boolean {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark';
}

/**
 * Theme control for settings screen.
 * Provides setThemePreference with AsyncStorage persistence.
 */
export function useThemeControl() {
  const { colorScheme, setColorScheme, toggleColorScheme } = useColorScheme();

  const setThemePreference = useCallback(
    async (preference: ThemePreference) => {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, preference);
      setColorScheme(preference);
    },
    [setColorScheme],
  );

  return {
    colorScheme,
    setThemePreference,
    toggleColorScheme,
  };
}

// ============================================================================
// Exports for testing
// ============================================================================

export { LIGHT_COLORS, DARK_COLORS };
