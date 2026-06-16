import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { dogRefreshControl, DogRefreshHeader } from '@/ui/DogRefresh';

// No modo demo a faixa do topo já consome o safe-area (notch); recontar o
// insets.top aqui criava um espaço vazio duplo entre a faixa e o conteúdo.
function useTopInset() {
  const insets = useSafeAreaInsets();
  const { isDemo } = useAuth();
  return (isDemo ? 0 : insets.top) + 8;
}

type CommonProps = {
  children: ReactNode;
  background?: string;
  style?: ViewStyle;
};

type ScrollProps = CommonProps & {
  refreshing?: boolean;
  onRefresh?: () => void;
  contentContainerStyle?: ViewStyle;
};

export function Screen({ children, background, style }: CommonProps) {
  const topInset = useTopInset();
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: background ?? colors.brandBackground, paddingTop: topInset },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function ScreenScroll({
  children,
  background,
  refreshing,
  onRefresh,
  contentContainerStyle,
  style,
}: ScrollProps) {
  const topInset = useTopInset();
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={[styles.container, { backgroundColor: background ?? colors.brandBackground }, style]}
        contentContainerStyle={[{ paddingTop: topInset, paddingBottom: 24 }, contentContainerStyle]}
        refreshControl={onRefresh ? dogRefreshControl(!!refreshing, onRefresh) : undefined}
      >
        <DogRefreshHeader refreshing={!!refreshing} />
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
