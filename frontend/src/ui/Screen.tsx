import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { dogRefreshControl, DogRefreshOverlay } from '@/ui/DogRefresh';

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
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: background ?? colors.brandBackground, paddingTop: insets.top + 8 },
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
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={[styles.container, { backgroundColor: background ?? colors.brandBackground }, style]}
        contentContainerStyle={[{ paddingTop: insets.top + 8, paddingBottom: 24 }, contentContainerStyle]}
        refreshControl={onRefresh ? dogRefreshControl(!!refreshing, onRefresh) : undefined}
      >
        {children}
      </ScrollView>
      <DogRefreshOverlay refreshing={!!refreshing} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
