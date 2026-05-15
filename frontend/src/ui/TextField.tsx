import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/theme/theme';

export function TextField({
  label,
  error,
  secure = false,
  ...props
}: TextInputProps & { label: string; error?: string | null; secure?: boolean }) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const hasError = Boolean(error);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, focused && styles.labelFocus, hasError && styles.labelError]}>{label}</Text>
      <View style={[styles.inputWrap, focused && styles.focus, hasError && styles.error]}>
        <TextInput
          {...props}
          secureTextEntry={secure && !visible}
          placeholderTextColor={theme.colors.brandTextSecondary}
          onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
          style={styles.input}
        />
        {secure ? (
          <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'} onPress={() => setVisible((value) => !value)} style={styles.eye}>
            <Ionicons name={visible ? 'eye-outline' : 'eye-off-outline'} size={22} color={theme.colors.brandTextSecondary} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>! {error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 12, fontWeight: '600', color: theme.colors.brandTextSecondary },
  labelFocus: { color: theme.colors.brandPrimaryDark },
  labelError: { color: theme.colors.brandTextError },
  inputWrap: { minHeight: 52, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.brandDivider, backgroundColor: theme.colors.brandSurface, flexDirection: 'row', alignItems: 'center' },
  focus: { borderWidth: 2, borderColor: theme.colors.brandPrimary },
  error: { borderColor: theme.colors.brandError },
  input: { flex: 1, paddingHorizontal: 16, fontSize: 15, color: theme.colors.brandTextPrimary },
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: theme.colors.brandTextError, fontWeight: '700', fontSize: 12 }
});
