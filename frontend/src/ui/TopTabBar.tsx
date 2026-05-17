import { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '@/contexts/ThemeContext';

const ROUTE_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap; label: string }> = {
  Dashboard: { icon: 'grid-outline', iconActive: 'grid', label: 'Início' },
  Transacoes: { icon: 'swap-horizontal-outline', iconActive: 'swap-horizontal', label: 'Transações' },
  Categorias: { icon: 'pricetags-outline', iconActive: 'pricetags', label: 'Categorias' },
  Assinaturas: { icon: 'repeat-outline', iconActive: 'repeat', label: 'Assinaturas' },
  Parcelamentos: { icon: 'card-outline', iconActive: 'card', label: 'Parcelamentos' },
  Investimentos: { icon: 'trending-up-outline', iconActive: 'trending-up', label: 'Investir' },
  Contas: { icon: 'wallet-outline', iconActive: 'wallet', label: 'Contas' },
  Configuracoes: { icon: 'settings-outline', iconActive: 'settings', label: 'Ajustes' },
};

type Props = BottomTabBarProps & { topInset?: number };

export function TopTabBar({ state, navigation, topInset = 0 }: Props) {
  const { colors, radius, shadows, mode } = useTheme();
  const { width: screenW } = useWindowDimensions();

  const activeRouteName = state.routes[state.index]?.name ?? state.routes[0].name;
  const orderedNames = state.routes.map((r) => r.name);

  const scrollRef = useRef<ScrollView | null>(null);
  const tabLayoutsRef = useRef<Record<string, { x: number; width: number }>>({});
  const [, forceRender] = useState(0);

  const recordLayout = (name: string, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    const cur = tabLayoutsRef.current[name];
    if (cur && cur.x === x && cur.width === width) return;
    tabLayoutsRef.current[name] = { x, width };
    forceRender((n) => n + 1);
  };

  // Centraliza pill ativa quando muda. Como o componente é renderizado UMA VEZ
  // pelo Tab.Navigator (via prop `tabBar`), ele persiste entre trocas de tela
  // e o scrollX anterior é mantido naturalmente — a animação parte de onde o
  // usuário estava olhando até centralizar a aba ativa.
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    function tryScroll() {
      const layout = tabLayoutsRef.current[activeRouteName];
      if (!layout || !scrollRef.current) {
        if (!cancelled && tries++ < 12) setTimeout(tryScroll, 50);
        return;
      }
      const target = Math.max(0, layout.x + layout.width / 2 - screenW / 2);
      scrollRef.current.scrollTo({ x: target, animated: true });
    }
    tryScroll();
    return () => {
      cancelled = true;
    };
  }, [activeRouteName, screenW]);

  return (
    <View style={{ backgroundColor: colors.brandBackground, paddingTop: topInset }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {orderedNames.map((name) => {
          const meta = ROUTE_META[name];
          if (!meta) return null;
          const focused = name === activeRouteName;
          const accent = colors.brandPrimaryDark;

          const bg = focused
            ? mode === 'dark'
              ? 'rgba(34, 197, 94, 0.18)'
              : 'rgba(34, 197, 94, 0.14)'
            : colors.brandSurface;
          const border = focused ? accent : colors.brandDivider;
          const fg = focused ? accent : colors.brandTextSecondary;

          return (
            <Pressable
              key={name}
              onLayout={(e) => recordLayout(name, e)}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: state.routes.find((r) => r.name === name)?.key ?? name,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(name);
                }
              }}
              style={[
                styles.pill,
                {
                  backgroundColor: bg,
                  borderColor: border,
                  borderRadius: radius.full,
                  ...(focused
                    ? {
                        shadowColor: accent,
                        shadowOpacity: mode === 'dark' ? 0.55 : 0.28,
                        shadowRadius: 12,
                        shadowOffset: { width: 0, height: 0 },
                        elevation: 6,
                      }
                    : shadows.card),
                },
              ]}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
            >
              <Ionicons name={focused ? meta.iconActive : meta.icon} size={16} color={fg} />
              <Text style={[styles.label, { color: fg }]} numberOfLines={1}>
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
        <View style={{ width: 12 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: { marginBottom: 8 },
  scrollContent: { gap: 8, paddingHorizontal: 16, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
  },
  label: { fontSize: 13, fontWeight: '700' },
});
