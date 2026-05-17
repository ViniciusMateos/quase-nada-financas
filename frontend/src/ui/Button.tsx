import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = 'primary' | 'secondary' | 'destructive';

export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  icon,
  style,
}: {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, radius } = useTheme();
  const isDisabled = disabled || loading;

  let bg: string;
  let borderColor: string | undefined;
  let borderWidth = 0;
  let labelColor = colors.brandTextOnPrimary;
  if (variant === 'primary') {
    bg = colors.brandPrimaryDark;
    labelColor = '#FFFFFF';
  } else if (variant === 'destructive') {
    bg = colors.brandError;
    labelColor = '#FFFFFF';
  } else {
    bg = 'transparent';
    borderColor = colors.brandPrimary;
    borderWidth = 1.5;
    labelColor = colors.brandPrimaryDark;
  }

  if (isDisabled) {
    bg = colors.brandDivider;
    borderColor = colors.brandDivider;
    labelColor = colors.brandTextDisabled;
  }

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = () => {
    if (!isDisabled) scale.value = withTiming(0.96, { duration: 90 });
  };
  const handlePressOut = () => {
    if (!isDisabled) scale.value = withSpring(1, { damping: 14, stiffness: 320 });
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      style={[
        styles.base,
        { backgroundColor: bg, borderColor, borderWidth, borderRadius: radius.lg },
        animStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.brandPrimaryDark : '#FFFFFF'} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={20} color={labelColor} /> : null}
          <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 52, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  label: { fontSize: 15, fontWeight: '700' },
});
