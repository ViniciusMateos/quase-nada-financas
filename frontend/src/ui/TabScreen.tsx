import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { dogRefreshControl, DogRefreshOverlay } from '@/ui/DogRefresh';

type CommonProps = {
  children: ReactNode;
  style?: ViewStyle;
};

type ScrollProps = CommonProps & {
  refreshing?: boolean;
  onRefresh?: () => void;
  contentContainerStyle?: ViewStyle;
};

const HORIZONTAL = 16;

export function TabScreen({ children, style }: CommonProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.brandBackground }]}>
      <View style={[{ flex: 1, paddingHorizontal: HORIZONTAL }, style]}>{children}</View>
    </View>
  );
}

export function TabScreenScroll({ children, refreshing, onRefresh, contentContainerStyle, style }: ScrollProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.brandBackground }]}>
      <ScrollView
        style={[{ flex: 1 }, style]}
        contentContainerStyle={[{ paddingHorizontal: HORIZONTAL, paddingBottom: 32 }, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
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
