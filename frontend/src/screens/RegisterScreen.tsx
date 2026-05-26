import { useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { normalizeError } from '@/lib/errorMap';
import { LoadingDog } from '@/ui/LoadingDog';
import { DemoEntryButton } from '@/ui/DemoEntryButton';

export default function RegisterScreen() {
  const navigation = useNavigation<any>();
  const { register, loading } = useAuth();
  const { colors, mode, toggle } = useTheme();
  const isDark = mode === 'dark';
  const { width } = useWindowDimensions();
  const logoSize = Math.min(width * 0.32, 120);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; form?: string }>({});

  const styles = useMemo(() => makeStyles(colors), [colors]);

  async function submit() {
    const next: typeof errors = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (trimmedName.length < 2) next.name = 'Nome deve ter ao menos 2 caracteres';
    if (!trimmedEmail.includes('@')) next.email = 'Digite um e-mail válido';
    if (password.length < 8) next.password = 'A senha precisa ter ao menos 8 caracteres';
    setErrors(next);
    if (Object.keys(next).length) return;

    try {
      await register({ name: trimmedName, email: trimmedEmail, password });
    } catch (err) {
      setErrors({ form: normalizeError(err).message });
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Image
            source={require('../../assets/logo.png')}
            style={{ width: logoSize, height: logoSize, resizeMode: 'contain', alignSelf: 'center', marginBottom: 24, tintColor: colors.brandPrimaryDark }}
            accessibilityLabel="Logo Quase Nada Finanças"
          />

          <View style={styles.header}>
            <Text style={styles.title}>Criar conta</Text>
            <Text style={styles.subtitle}>Bem-vindo ao Quase Nada Finanças</Text>
          </View>

          {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}

          <View style={styles.field}>
            <Text style={styles.label}>Nome</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder="Seu nome"
              placeholderTextColor={colors.brandTextSecondary}
              value={name}
              onChangeText={(t) => { setName(t); if (errors.name) setErrors((p) => ({ ...p, name: undefined })); }}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!loading}
            />
            {errors.name ? <Text style={styles.fieldError}>{errors.name}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              placeholder="seu@email.com"
              placeholderTextColor={colors.brandTextSecondary}
              value={email}
              onChangeText={(t) => { setEmail(t); if (errors.email) setErrors((p) => ({ ...p, email: undefined })); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <View style={[styles.inputWrapper, errors.password && styles.inputError]}>
              <TextInput
                style={styles.inputInner}
                placeholder="Mínimo 8 caracteres"
                placeholderTextColor={colors.brandTextSecondary}
                value={password}
                onChangeText={(t) => { setPassword(t); if (errors.password) setErrors((p) => ({ ...p, password: undefined })); }}
                secureTextEntry={!showPassword}
                onSubmitEditing={submit}
                editable={!loading}
              />
              <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={8} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.brandTextSecondary} />
              </Pressable>
            </View>
            {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}
          </View>

          <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={submit} disabled={loading}>
            {loading ? <LoadingDog size={28} color="#FFFFFF" /> : <Text style={styles.buttonText}>Criar conta</Text>}
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Já tenho conta </Text>
            <Pressable onPress={() => navigation.navigate('Login')} disabled={loading} hitSlop={8}>
              <Text style={styles.footerLink}>Entrar</Text>
            </Pressable>
          </View>

          <DemoEntryButton style={{ marginTop: 16 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {navigation.canGoBack() ? (
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={28} color={colors.brandTextSecondary} />
        </Pressable>
      ) : null}
      <Pressable style={styles.themeToggle} onPress={toggle} hitSlop={8} accessibilityLabel="Alternar tema">
        <Image
          source={isDark ? require('../../assets/icon-tema-claro.png') : require('../../assets/icon-tema-escuro.png')}
          style={{ width: 26, height: 26, tintColor: colors.brandTextSecondary }}
        />
      </Pressable>
    </SafeAreaView>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.brandBackground },
    flex: { flex: 1 },
    themeToggle: { position: 'absolute', top: 56, right: 24, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
    backBtn: { position: 'absolute', top: 56, left: 16, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
    container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 48, paddingBottom: 32, justifyContent: 'center' },
    header: { marginBottom: 32 },
    title: { fontSize: 32, fontWeight: '800', color: c.brandTextPrimary, marginBottom: 8 },
    subtitle: { fontSize: 16, color: c.brandTextSecondary },
    formError: { color: c.brandTextError, fontWeight: '700', marginBottom: 16 },
    field: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '600', color: c.brandTextSecondary, marginBottom: 8 },
    input: { backgroundColor: c.brandSurface, borderWidth: 1, borderColor: c.brandDivider, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: c.brandTextPrimary, minHeight: 50 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.brandSurface, borderWidth: 1, borderColor: c.brandDivider, borderRadius: 12, minHeight: 50 },
    inputInner: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: c.brandTextPrimary },
    eyeBtn: { paddingRight: 14 },
    inputError: { borderColor: c.brandError },
    fieldError: { color: c.brandTextError, fontSize: 12, marginTop: 6, marginLeft: 4 },
    button: { backgroundColor: c.brandPrimaryDark, borderRadius: 12, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8, minHeight: 52 },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
    footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 28 },
    footerText: { color: c.brandTextSecondary, fontSize: 15 },
    footerLink: { color: c.brandPrimaryDark, fontSize: 15, fontWeight: '700' },
  });
}
