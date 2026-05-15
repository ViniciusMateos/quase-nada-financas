import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/theme/theme';

type Variant = 'primary' | 'secondary' | 'destructive';

export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  icon,
  style
}: {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [styles.base, styles[variant], pressed && !isDisabled && styles.pressed, isDisabled && styles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? theme.colors.brandPrimaryDark : '#FFFFFF'} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={20} color={variant === 'primary' || variant === 'destructive' ? '#FFFFFF' : theme.colors.brandPrimaryDark} /> : null}
          <Text style={[styles.label, variant === 'secondary' && styles.secondaryLabel, isDisabled && styles.disabledLabel]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 52, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  primary: { backgroundColor: theme.colors.brandPrimaryDark },
  secondary: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: theme.colors.brandPrimary },
  destructive: { backgroundColor: theme.colors.brandError },
  pressed: { opacity: 0.86 },
  disabled: { backgroundColor: theme.colors.brandDivider, borderColor: theme.colors.brandDivider },
  label: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryLabel: { color: theme.colors.brandPrimaryDark },
  disabledLabel: { color: theme.colors.brandTextDisabled }
});
