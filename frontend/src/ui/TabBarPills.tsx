import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

const ROUTE_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap; label: string }> = {
  Dashboard: { icon: 'grid-outline', iconActive: 'grid', label: 'Início' },
  Contas: { icon: 'wallet-outline', iconActive: 'wallet', label: 'Contas' },
  Transacoes: { icon: 'swap-horizontal-outline', iconActive: 'swap-horizontal', label: 'Transações' },
  Investimentos: { icon: 'trending-up-outline', iconActive: 'trending-up', label: 'Investir' },
  Configuracoes: { icon: 'settings-outline', iconActive: 'settings', label: 'Ajustes' },
};

export function TabBarPills({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, radius, shadows, mode } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.wrapper,
        { paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.brandBackground },
      ]}
    >
      <View
        style={[
          styles.bar,
          {
            backgroundColor: mode === 'dark' ? colors.brandSurface : '#FFFFFF',
            borderRadius: radius.full,
            borderColor: colors.brandDivider,
            ...shadows.card,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const meta = ROUTE_META[route.name] ?? { icon: 'ellipse-outline', iconActive: 'ellipse', label: route.name };
          const { options } = descriptors[route.key];
          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const tintBg = mode === 'dark' ? 'rgba(34, 197, 94, 0.16)' : 'rgba(34, 197, 94, 0.14)';
          const activeBg = focused ? tintBg : 'transparent';
          const activeText = focused ? colors.brandPrimaryDark : colors.brandTextSecondary;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? meta.label}
              onPress={onPress}
              style={[
                styles.tab,
                {
                  backgroundColor: activeBg,
                  borderRadius: radius.full,
                },
                focused && {
                  shadowColor: colors.brandPrimary,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: mode === 'dark' ? 0.55 : 0.3,
                  shadowRadius: 10,
                },
              ]}
            >
              <Ionicons
                name={focused ? meta.iconActive : meta.icon}
                size={focused ? 20 : 22}
                color={activeText}
              />
              {focused ? (
                <Text style={[styles.label, { color: activeText }]} numberOfLines={1}>
                  {meta.label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 16, paddingTop: 6 },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 6, borderWidth: 1, gap: 4 },
  tab: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  label: { fontSize: 12, fontWeight: '700' },
});
