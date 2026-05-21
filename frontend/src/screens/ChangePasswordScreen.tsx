import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { normalizeError } from '@/lib/errorMap';
import { LoadingDog } from '@/ui/LoadingDog';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';

export default function ChangePasswordScreen() {
  const navigation = useNavigation<any>();
  const { changePassword } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string; form?: string }>({});

  async function submit() {
    const e: typeof errors = {};
    if (!current) e.current = 'Digite sua senha atual';
    if (next.length < 8) e.next = 'A nova senha precisa ter ao menos 8 caracteres';
    if (confirm !== next) e.confirm = 'As senhas não conferem';
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    try {
      await changePassword(current, next);
      Alert.alert('Pronto', 'Sua senha foi alterada.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      setErrors({ form: normalizeError(err).message });
      setCurrent('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen style={styles.padded}>
      <ScreenHeader title="Alterar senha" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}

          <Field
            label="Senha atual"
            value={current}
            onChangeText={(t) => { setCurrent(t); if (errors.current) setErrors((p) => ({ ...p, current: undefined })); }}
            secure={!show}
            error={errors.current}
            editable={!loading}
            colors={colors}
            styles={styles}
          />
          <Field
            label="Nova senha"
            value={next}
            onChangeText={(t) => { setNext(t); if (errors.next) setErrors((p) => ({ ...p, next: undefined })); }}
            secure={!show}
            error={errors.next}
            editable={!loading}
            placeholder="Mínimo 8 caracteres"
            colors={colors}
            styles={styles}
          />
          <Field
            label="Confirmar nova senha"
            value={confirm}
            onChangeText={(t) => { setConfirm(t); if (errors.confirm) setErrors((p) => ({ ...p, confirm: undefined })); }}
            secure={!show}
            error={errors.confirm}
            editable={!loading}
            onSubmitEditing={submit}
            colors={colors}
            styles={styles}
          />

          <Pressable onPress={() => setShow((s) => !s)} hitSlop={8} style={styles.showRow}>
            <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.brandTextSecondary} />
            <Text style={styles.showText}>{show ? 'Ocultar senhas' : 'Mostrar senhas'}</Text>
          </Pressable>

          <Pressable style={[styles.button, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading}>
            {loading ? <LoadingDog size={28} color="#FFFFFF" /> : <Text style={styles.buttonText}>Salvar nova senha</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Field({
  label,
  value,
  onChangeText,
  secure,
  error,
  editable,
  placeholder,
  onSubmitEditing,
  colors,
  styles,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  secure: boolean;
  error?: string;
  editable: boolean;
  placeholder?: string;
  onSubmitEditing?: () => void;
  colors: any;
  styles: any;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError]}
        placeholder={placeholder}
        placeholderTextColor={colors.brandTextSecondary}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        autoCapitalize="none"
        autoCorrect={false}
        editable={editable}
        onSubmitEditing={onSubmitEditing}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    padded: { paddingHorizontal: 16 },
    formError: { color: c.brandTextError, fontWeight: '700', marginBottom: 16 },
    field: { marginBottom: 18 },
    label: { fontSize: 14, fontWeight: '600', color: c.brandTextSecondary, marginBottom: 8 },
    input: { backgroundColor: c.brandSurface, borderWidth: 1, borderColor: c.brandDivider, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: c.brandTextPrimary, minHeight: 50 },
    inputError: { borderColor: c.brandError },
    fieldError: { color: c.brandTextError, fontSize: 12, marginTop: 6, marginLeft: 4 },
    showRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 8 },
    showText: { color: c.brandTextSecondary, fontSize: 13, fontWeight: '600' },
    button: { backgroundColor: c.brandPrimaryDark, borderRadius: 12, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8, minHeight: 52 },
    buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  });
}
