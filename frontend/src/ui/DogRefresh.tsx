import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, RefreshControl } from 'react-native';
import { LoadingDog } from '@/ui/LoadingDog';
import { useTheme } from '@/contexts/ThemeContext';

const HEADER_HEIGHT = 48;

/**
 * RefreshControl usado só como GATILHO da pull-to-refresh. Mantemos
 * `refreshing={false}` de propósito: o controle nativo, mesmo com tint
 * transparente, reserva ~60px de inset enquanto `refreshing=true` — o que
 * criava um gap invisível gigante ACIMA do cachorro (nativo + dog empilhados).
 * Como o gesto de puxar dispara `onRefresh` independente do valor de
 * `refreshing`, deixamos o nativo sem "segurar" e o único indicador é o
 * <DogRefreshHeader/>. Sem gap fantasma.
 */
export function dogRefreshControl(_refreshing: boolean, onRefresh: () => void) {
  return (
    <RefreshControl
      refreshing={false}
      onRefresh={onRefresh}
      tintColor="transparent"
      colors={['transparent']}
      style={{ backgroundColor: 'transparent' }}
    />
  );
}

/**
 * Cachorro no topo da lista durante o refresh. Anima a altura (0 → HEADER_HEIGHT)
 * pra os componentes descerem suave quando ele entra e subirem suave quando sai —
 * em vez de pular. Renderize como PRIMEIRO filho do conteúdo do ScrollView/SectionList.
 */
export function DogRefreshHeader({ refreshing }: { refreshing: boolean }) {
  const { colors } = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (refreshing) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(progress, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [refreshing, progress]);

  if (!mounted) return null;

  return (
    <Animated.View
      style={{
        height: progress.interpolate({ inputRange: [0, 1], outputRange: [0, HEADER_HEIGHT] }),
        opacity: progress,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <LoadingDog size={30} color={colors.brandPrimaryDark} />
    </Animated.View>
  );
}

/** Descontinuado — virou no-op. Use <DogRefreshHeader/> dentro do scroll. */
export function DogRefreshOverlay(_props: { refreshing: boolean }) {
  return null;
}
