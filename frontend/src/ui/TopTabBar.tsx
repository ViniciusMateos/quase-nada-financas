import { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '@/contexts/ThemeContext';
import { GlassSurface } from '@/ui/GlassSurface';

const ROUTE_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap; label: string }> = {
  Dashboard: { icon: 'grid-outline', iconActive: 'grid', label: 'Início' },
  Transacoes: { icon: 'swap-horizontal-outline', iconActive: 'swap-horizontal', label: 'Transações' },
  Categorias: { icon: 'pricetags-outline', iconActive: 'pricetags', label: 'Categorias' },
  Assinaturas: { icon: 'repeat-outline', iconActive: 'repeat', label: 'Assinaturas' },
  Parcelamentos: { icon: 'card-outline', iconActive: 'card', label: 'Parcelamentos' },
  Investimentos: { icon: 'trending-up-outline', iconActive: 'trending-up', label: 'Investir' },
  Distribuicao: { icon: 'git-branch-outline', iconActive: 'git-branch', label: 'Distribuir' },
  Ativos: { icon: 'pie-chart-outline', iconActive: 'pie-chart', label: 'Ativos' },
  Contas: { icon: 'wallet-outline', iconActive: 'wallet', label: 'Contas' },
  Configuracoes: { icon: 'settings-outline', iconActive: 'settings', label: 'Ajustes' },
  Testes: { icon: 'flask-outline', iconActive: 'flask', label: 'Testes' },
};

type Props = BottomTabBarProps & { topInset?: number };

/** "#RRGGBB" → "#RRGGBB00" (mesma cor, alpha 0), pra o fade não puxar cinza. */
function toTransparent(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}00` : 'transparent';
}

export function TopTabBar({ state, navigation, topInset = 0 }: Props) {
  const { colors } = useTheme();
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

  // Centraliza a pill ativa quando muda.
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

  const bg = colors.brandBackground;
  const bgFade = toTransparent(bg);

  return (
    // Barra FLUTUANTE: o conteúdo das abas passa por baixo. O gradiente fica
    // opaco no topo (status bar) e some embaixo, então o conteúdo faz um fade
    // suave ao scrollar por trás — em vez do bloco preto bruto.
    // pointerEvents box-none: fora das pills, o toque passa pro conteúdo atrás.
    <LinearGradient
      colors={[bg, bg, bgFade]}
      locations={[0, 0.5, 1]}
      style={[styles.bar, { paddingTop: topInset }]}
      pointerEvents="box-none"
    >
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
          return (
            <TabPill
              key={name}
              meta={meta}
              focused={name === activeRouteName}
              onLayout={(e) => recordLayout(name, e)}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: state.routes.find((r) => r.name === name)?.key ?? name,
                  canPreventDefault: true,
                });
                if (name !== activeRouteName && !event.defaultPrevented) {
                  navigation.navigate(name);
                }
              }}
            />
          );
        })}
        <Animated.View style={{ width: 12 }} />
      </ScrollView>
    </LinearGradient>
  );
}

type PillMeta = { icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap; label: string };

/** Pill em Liquid Glass (fallback blur), com press suave (scale via spring). */
function TabPill({
  meta,
  focused,
  onLayout,
  onPress,
}: {
  meta: PillMeta;
  focused: boolean;
  onLayout: (e: LayoutChangeEvent) => void;
  onPress: () => void;
}) {
  const { colors, mode } = useTheme();
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const accent = colors.brandPrimaryDark;
  // Tint do vidro: verde na pill ativa, neutro nas demais (mesma cor de sempre).
  const tint = focused
    ? mode === 'dark'
      ? 'rgba(34, 197, 94, 0.30)'
      : 'rgba(34, 197, 94, 0.22)'
    : undefined;
  const border = focused ? accent : colors.brandDivider;
  const fg = focused ? accent : colors.brandTextSecondary;

  return (
    <Animated.View
      onLayout={onLayout}
      style={[
        aStyle,
        focused && {
          shadowColor: accent,
          shadowOpacity: mode === 'dark' ? 0.5 : 0.25,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 0 },
          elevation: 5,
        },
      ]}
    >
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.92, { damping: 16, stiffness: 420, mass: 0.5 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 340, mass: 0.5 });
        }}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={focused ? { selected: true } : {}}
      >
        <GlassSurface radius={999} variant="regular" tintColor={tint} style={[styles.pill, { borderColor: border }]}>
          <Ionicons name={focused ? meta.iconActive : meta.icon} size={16} color={fg} />
          <Text style={[styles.label, { color: fg }]} numberOfLines={1}>
            {meta.label}
          </Text>
        </GlassSurface>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
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
