import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { palettes, Palette, ThemeMode } from '@/theme/palettes';

const STORAGE_KEY = 'qnf:theme-mode';

interface ThemeValue {
  mode: ThemeMode;
  colors: Palette;
  radius: { xs: number; sm: number; md: number; lg: number; xl: number; full: number };
  spacing: Record<string, number>;
  shadows: {
    card: object;
    glow: object;
  };
  setMode(mode: ThemeMode): void;
  toggle(): void;
}

const radius = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, full: 9999 };
const spacing = { space1: 4, space2: 8, space3: 12, space4: 16, space5: 20, space6: 24, space8: 32, space10: 40, space12: 48, space16: 64 };

function makeShadows(mode: ThemeMode) {
  if (mode === 'dark') {
    return {
      card: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 18,
        elevation: 6,
      },
      glow: {
        shadowColor: '#22C55E',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.55,
        shadowRadius: 16,
        elevation: 8,
      },
    };
  }
  return {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 3,
    },
    glow: {
      shadowColor: '#22C55E',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 12,
      elevation: 6,
    },
  };
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [previousBg, setPreviousBg] = useState<string | null>(null);
  const fadeOpacity = useSharedValue(0);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') setModeState(saved);
    });
  }, []);

  const triggerCrossfade = useCallback(
    (fromMode: ThemeMode) => {
      setPreviousBg(palettes[fromMode].brandBackground);
      fadeOpacity.value = 1;
      fadeOpacity.value = withTiming(0, { duration: 380 });
    },
    [fadeOpacity]
  );

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState((curr) => {
        if (next !== curr) triggerCrossfade(curr);
        AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
        return next;
      });
    },
    [triggerCrossfade]
  );

  const toggle = useCallback(() => {
    setModeState((curr) => {
      const next = curr === 'dark' ? 'light' : 'dark';
      triggerCrossfade(curr);
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
      return next;
    });
  }, [triggerCrossfade]);

  const value = useMemo<ThemeValue>(
    () => ({
      mode,
      colors: palettes[mode],
      radius,
      spacing,
      shadows: makeShadows(mode),
      setMode,
      toggle,
    }),
    [mode, setMode, toggle]
  );

  const overlayStyle = useAnimatedStyle(() => ({ opacity: fadeOpacity.value }));

  return (
    <ThemeContext.Provider value={value}>
      {children}
      {previousBg ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: previousBg, zIndex: 9999 },
            overlayStyle,
          ]}
        />
      ) : null}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
