import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeError } from '@/lib/errorMap';
import { theme } from '@/theme/theme';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';

type AuthMode = 'login' | 'register';

export default function LoginScreen() {
  const { login, register, loading } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string; form?: string }>({});

  const copy = useMemo(() => {
    if (mode === 'register') {
      return {
        title: 'Criar conta',
        subtitle: 'Cadastre seu email e senha para começar',
        button: 'Cadastrar',
        toggleText: 'Já tem conta?',
        toggleAction: 'Entrar'
      };
    }
    return {
      title: 'Quase Nada Finanças',
      subtitle: 'Entre na sua conta',
      button: 'Entrar',
      toggleText: 'Ainda não tem conta?',
      toggleAction: 'Criar conta'
    };
  }, [mode]);

  function toggleMode() {
    setErrors({});
    setMode((current) => (current === 'login' ? 'register' : 'login'));
  }

  async function submit() {
    const nextErrors: typeof errors = {};
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail.includes('@')) nextErrors.email = 'Digite um email válido';
    if (password.length < 8) nextErrors.password = 'A senha precisa ter pelo menos 8 caracteres';
    if (mode === 'register' && password !== confirmPassword) nextErrors.confirmPassword = 'As senhas não conferem';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      if (mode === 'register') {
        await register({ email: trimmedEmail, password });
      } else {
        await login({ email: trimmedEmail, password });
      }
    } catch (err) {
      setErrors({ form: normalizeError(err).message });
    }
  }

  const disabled = !email || !password || (mode === 'register' && !confirmPassword);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.logo}><Text style={styles.logoText}>QNF</Text></View>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.subtitle}>{copy.subtitle}</Text>
      <View style={styles.form}>
        <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} error={errors.email} />
        <TextField label="Senha" value={password} onChangeText={setPassword} secure error={errors.password} />
        {mode === 'register' ? (
          <TextField label="Confirmar senha" value={confirmPassword} onChangeText={setConfirmPassword} secure error={errors.confirmPassword} />
        ) : null}
        {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}
        <Button label={copy.button} onPress={submit} loading={loading} disabled={disabled} />
        <Pressable onPress={toggleMode} style={styles.toggle} disabled={loading}>
          <Text style={styles.toggleText}>{copy.toggleText} <Text style={styles.toggleAction}>{copy.toggleAction}</Text></Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.brandBackground, padding: 24, justifyContent: 'center' },
  logo: { alignSelf: 'center', width: 72, height: 72, borderRadius: 24, backgroundColor: theme.colors.brandPrimaryDark, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#FFFFFF', fontWeight: '900', fontSize: 24 },
  title: { marginTop: 20, fontSize: 28, fontWeight: '800', color: theme.colors.brandTextPrimary, textAlign: 'center' },
  subtitle: { marginTop: 8, color: theme.colors.brandTextSecondary, textAlign: 'center', fontSize: 15 },
  form: { marginTop: 40, gap: 16 },
  formError: { color: theme.colors.brandTextError, fontWeight: '700', textAlign: 'center' },
  toggle: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  toggleText: { color: theme.colors.brandTextSecondary, fontWeight: '600' },
  toggleAction: { color: theme.colors.brandPrimaryDark, fontWeight: '800' }
});
