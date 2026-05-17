import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

export function TextField({
  label,
  error,
  secure = false,
  ...props
}: TextInputProps & { label: string; error?: string | null; secure?: boolean }) {
  const { colors, radius } = useTheme();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const hasError = Boolean(error);

  const labelColor = hasError
    ? colors.brandTextError
    : focused
    ? colors.brandPrimaryDark
    : colors.brandTextSecondary;
  const borderColor = hasError ? colors.brandError : focused ? colors.brandPrimary : colors.brandDivider;
  const borderWidth = focused && !hasError ? 2 : 1;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          { borderRadius: radius.md, backgroundColor: colors.brandSurface, borderColor, borderWidth },
        ]}
      >
        <TextInput
          {...props}
          secureTextEntry={secure && !visible}
          placeholderTextColor={colors.brandTextSecondary}
          onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
          style={[styles.input, { color: colors.brandTextPrimary }]}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
            onPress={() => setVisible((value) => !value)}
            style={styles.eye}
          >
            <Ionicons name={visible ? 'eye-outline' : 'eye-off-outline'} size={22} color={colors.brandTextSecondary} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={[styles.errorText, { color: colors.brandTextError }]}>! {error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 12, fontWeight: '600' },
  inputWrap: { minHeight: 52, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, paddingHorizontal: 16, fontSize: 15 },
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontWeight: '700', fontSize: 12 },
});
