import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';

export function ScreenHeader({
  title,
  onBack,
  rightAction,
}: {
  title?: string;
  onBack?: () => void;
  rightAction?: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; tint?: string };
}) {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const handleBack = onBack ?? (() => navigation.goBack());

  return (
    <View style={styles.row}>
      <Pressable
        onPress={handleBack}
        hitSlop={12}
        accessibilityLabel="Voltar"
        accessibilityRole="button"
        style={[styles.iconBtn, { backgroundColor: colors.brandSurface, borderColor: colors.brandDivider }]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.brandTextPrimary} />
      </Pressable>
      {title ? (
        <Text style={[styles.title, { color: colors.brandTextPrimary }]} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {rightAction ? (
        <Pressable
          onPress={rightAction.onPress}
          hitSlop={12}
          style={[styles.iconBtn, { backgroundColor: colors.brandSurface, borderColor: colors.brandDivider }]}
        >
          <Ionicons name={rightAction.icon} size={20} color={rightAction.tint ?? colors.brandTextPrimary} />
        </Pressable>
      ) : (
        <View style={styles.iconBtnPlaceholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, minHeight: 44 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  iconBtnPlaceholder: { width: 40, height: 40 },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800' },
});
