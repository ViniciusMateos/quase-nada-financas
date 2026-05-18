import { ComponentProps } from 'react';
import { View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

const ICON_MAP: Record<string, IoniconsName> = {
  'shopping-cart': 'cart',
  'utensils': 'restaurant',
  'car': 'car-sport',
  'home': 'home',
  'heart': 'heart',
  'book': 'school',
  'music': 'musical-notes',
  'shopping-bag': 'bag-handle',
  'shirt': 'shirt',
  'wrench': 'construct',
  'repeat': 'repeat',
  'trending-up': 'trending-up',
  'dollar-sign': 'cash',
  'briefcase': 'briefcase',
  'more-horizontal': 'sparkles',
};

export function categoryIonicon(icon?: string | null): IoniconsName {
  if (!icon) return 'sparkles';
  return ICON_MAP[icon] ?? 'sparkles';
}

type Props = {
  icon?: string | null;
  color?: string | null;
  size?: number;
  background?: string;
  padded?: boolean;
  style?: ViewStyle;
};

/**
 * Bolinha colorida com ícone Ionicons no centro. `color` define a cor do
 * ícone e (com 18% opacity) a cor do fundo. Default cinza/cinza-claro.
 */
export function CategoryIcon({ icon, color, size = 22, background, padded = true, style }: Props) {
  const fg = color || '#22C55E';
  const containerSize = padded ? Math.round(size * 1.85) : size;
  const bg = background ?? `${fg}26`; // hex alpha ~15%
  return (
    <View
      style={[
        {
          width: containerSize,
          height: containerSize,
          borderRadius: containerSize / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Ionicons name={categoryIonicon(icon)} size={size} color={fg} />
    </View>
  );
}
