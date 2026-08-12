import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { dogRefreshControl, DogRefreshHeader } from '@/ui/DogRefresh';
import { useTabBarHeight } from '@/ui/tabBarLayout';

type CommonProps = {
  children: ReactNode;
  style?: ViewStyle;
};

type ScrollProps = CommonProps & {
  refreshing?: boolean;
  loading?: boolean;
  onRefresh?: () => void;
  contentContainerStyle?: ViewStyle;
};

const HORIZONTAL = 16;

export function TabScreen({ children, style }: CommonProps) {
  const { colors } = useTheme();
  const topPad = useTabBarHeight();
  return (
    <View style={[styles.container, { backgroundColor: colors.brandBackground }]}>
      <View style={[{ flex: 1, paddingHorizontal: HORIZONTAL, paddingTop: topPad }, style]}>{children}</View>
    </View>
  );
}

export function TabScreenScroll({ children, refreshing, loading, onRefresh, contentContainerStyle, style }: ScrollProps) {
  const { colors } = useTheme();
  const topPad = useTabBarHeight();
  return (
    <View style={[styles.container, { backgroundColor: colors.brandBackground }]}>
      <ScrollView
        style={[{ flex: 1 }, style]}
        contentContainerStyle={[{ paddingHorizontal: HORIZONTAL, paddingTop: topPad, paddingBottom: 32 }, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
        refreshControl={onRefresh ? dogRefreshControl(!!refreshing, onRefresh) : undefined}
      >
        <DogRefreshHeader refreshing={!!refreshing || !!loading} />
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
