import { RefreshControl, StyleSheet, View } from 'react-native';
import { LoadingDog } from '@/ui/LoadingDog';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * RefreshControl com o spinner nativo escondido (tint transparente). O feedback
 * visual do cachorro vem do <DogRefreshOverlay/>, já que o RefreshControl nativo
 * não permite trocar o ícone por uma imagem custom.
 */
export function dogRefreshControl(refreshing: boolean, onRefresh: () => void) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor="transparent"
      colors={['transparent']}
      style={{ backgroundColor: 'transparent' }}
    />
  );
}

/** Cachorro girando fixado no topo, exibido enquanto refreshing está ativo. */
export function DogRefreshOverlay({ refreshing }: { refreshing: boolean }) {
  const { colors } = useTheme();
  if (!refreshing) return null;
  return (
    <View pointerEvents="none" style={styles.overlay}>
      <LoadingDog size={38} color={colors.brandPrimaryDark} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
});
