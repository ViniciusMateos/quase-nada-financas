import { lightPalette } from './palettes';

/**
 * Tema "legado" (light) ainda exportado para compatibilidade com módulos antigos.
 * Em código novo prefira `useTheme()` do `ThemeContext`.
 */
export const theme = {
  colors: lightPalette,
  spacing: { space1: 4, space2: 8, space3: 12, space4: 16, space5: 20, space6: 24, space8: 32, space10: 40, space12: 48, space16: 64 },
  radius: { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, full: 9999 },
  shadows: {
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
  },
};
