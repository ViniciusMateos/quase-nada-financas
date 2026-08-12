import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';

// Altura da faixa das pills (linha da pill + margem), abaixo do safe-area.
export const PILL_AREA_HEIGHT = 46;

/**
 * Altura total da barra de abas flutuante (TopTabBar). O conteúdo das abas usa
 * isso como paddingTop pra começar ABAIXO da barra (mas ainda scrollar por baixo
 * dela, com o fade). Espelha exatamente o paddingTop que a TopTabBar aplica:
 * `(isDemo ? 0 : insets.top) + 8`, mais a faixa das pills.
 */
export function useTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  const { isDemo } = useAuth();
  return (isDemo ? 0 : insets.top) + 8 + PILL_AREA_HEIGHT;
}
