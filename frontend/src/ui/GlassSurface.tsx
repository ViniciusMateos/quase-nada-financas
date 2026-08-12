import { ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Superfície com efeito de vidro. Usa o **Liquid Glass** nativo (iOS 26+, via
 * expo-glass-effect) quando disponível; senão cai pro blur (expo-blur), mantendo
 * a estética translúcida em iOS mais antigos / Android.
 *
 * É só JS — pode ser usado/ajustado por OTA. O que exige build é o módulo nativo
 * (já incluído). Ex.: <GlassSurface radius={20} style={{padding:16}}>...</GlassSurface>
 */
const LIQUID = isLiquidGlassAvailable();

type Props = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** 'regular' = mais opaco/legível; 'clear' = mais transparente. */
  variant?: 'regular' | 'clear';
  /** Cor de tint opcional (só Liquid Glass). */
  tintColor?: string;
  /** Reage ao toque com brilho (só Liquid Glass). */
  interactive?: boolean;
};

export function GlassSurface({ children, style, radius = 20, variant = 'regular', tintColor, interactive }: Props) {
  const { mode } = useTheme();

  if (LIQUID) {
    return (
      <GlassView
        glassEffectStyle={variant}
        tintColor={tintColor}
        isInteractive={interactive}
        colorScheme={mode === 'dark' ? 'dark' : 'light'}
        style={[{ borderRadius: radius, overflow: 'hidden' }, style]}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView
      intensity={mode === 'dark' ? 40 : 55}
      tint={mode === 'dark' ? 'dark' : 'light'}
      style={[{ borderRadius: radius, overflow: 'hidden' }, style]}
    >
      {children}
    </BlurView>
  );
}

/** true se o Liquid Glass nativo está ativo neste device (iOS 26+). */
export const liquidGlassAvailable = LIQUID;
