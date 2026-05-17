export type ThemeMode = 'light' | 'dark';

export interface Palette {
  brandPrimary: string;
  brandPrimaryAction: string;
  brandPrimaryDark: string;
  brandPrimaryTint: string;
  brandAccent: string;
  brandSuccess: string;
  brandError: string;
  brandWarning: string;
  brandInfo: string;
  brandBackground: string;
  brandSurface: string;
  brandSurfaceAlt: string;
  brandDivider: string;
  brandSkeleton: string;
  brandSkeletonShimmer: string;
  brandTextPrimary: string;
  brandTextSecondary: string;
  brandTextDisabled: string;
  brandTextOnPrimary: string;
  brandTextError: string;
  brandTextPositive: string;
  brandTextNegative: string;
  brandOverlay: string;
  brandPillBg: string;
  brandPillBgActive: string;
  brandGlow: string;
}

export const lightPalette: Palette = {
  brandPrimary: '#22C55E',
  brandPrimaryAction: '#16A34A',
  brandPrimaryDark: '#15803D',
  brandPrimaryTint: '#DCFCE7',
  brandAccent: '#10B981',
  brandSuccess: '#16A34A',
  brandError: '#FF3B5C',
  brandWarning: '#FF9F0A',
  brandInfo: '#3B82F6',
  brandBackground: '#F5F7FA',
  brandSurface: '#FFFFFF',
  brandSurfaceAlt: '#F1F5F9',
  brandDivider: '#E8ECF0',
  brandSkeleton: '#E8ECF0',
  brandSkeletonShimmer: '#F0F4F8',
  brandTextPrimary: '#1A2030',
  brandTextSecondary: '#667085',
  brandTextDisabled: '#C4CAD4',
  brandTextOnPrimary: '#FFFFFF',
  brandTextError: '#D92D20',
  brandTextPositive: '#16A34A',
  brandTextNegative: '#D92D20',
  brandOverlay: 'rgba(26, 32, 48, 0.6)',
  brandPillBg: '#FFFFFF',
  brandPillBgActive: 'rgba(34, 197, 94, 0.15)',
  brandGlow: 'rgba(34, 197, 94, 0.35)',
};

export const darkPalette: Palette = {
  brandPrimary: '#22C55E',
  brandPrimaryAction: '#16A34A',
  brandPrimaryDark: '#22C55E',
  brandPrimaryTint: 'rgba(34, 197, 94, 0.18)',
  brandAccent: '#10B981',
  brandSuccess: '#22C55E',
  brandError: '#FF5C75',
  brandWarning: '#FFB341',
  brandInfo: '#60A5FA',
  brandBackground: '#000000',
  brandSurface: '#0F0F12',
  brandSurfaceAlt: '#16161B',
  brandDivider: '#1F1F26',
  brandSkeleton: '#1A1A20',
  brandSkeletonShimmer: '#22222A',
  brandTextPrimary: '#F4F4F6',
  brandTextSecondary: '#8A8A93',
  brandTextDisabled: '#3F3F46',
  brandTextOnPrimary: '#0A0A0C',
  brandTextError: '#FF5C75',
  brandTextPositive: '#22C55E',
  brandTextNegative: '#FF5C75',
  brandOverlay: 'rgba(0, 0, 0, 0.75)',
  brandPillBg: 'transparent',
  brandPillBgActive: 'rgba(34, 197, 94, 0.16)',
  brandGlow: 'rgba(34, 197, 94, 0.45)',
};

export const palettes: Record<ThemeMode, Palette> = {
  light: lightPalette,
  dark: darkPalette,
};
