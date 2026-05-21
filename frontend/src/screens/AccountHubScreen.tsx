import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Keyboard,
  Modal,
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
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { normalizeError } from '@/lib/errorMap';
import { LoadingDog } from '@/ui/LoadingDog';
import type { SavedAccount } from '@/lib/savedAccounts';

export default function AccountHubScreen() {
  const navigation = useNavigation<any>();
  const { savedAccounts, loginWithSavedAccount, login, removeSavedAccount, loading } = useAuth();
  const { colors, mode, toggle } = useTheme();
  const isDark = mode === 'dark';
  const { width } = useWindowDimensions();
  const logoSize = Math.min(width * 0.26, 96);

  const [pwModalAccount, setPwModalAccount] = useState<SavedAccount | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Sobe o sheet quando o teclado abre (Modal + sheet no rodapé não reage sozinho).
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!pwModalAccount) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => {
      Animated.timing(keyboardOffset, {
        toValue: -e.endCoordinates.height,
        duration: e.duration || 250,
        useNativeDriver: true,
      }).start();
    });
    const hide = Keyboard.addListener(hideEvt, (e) => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: e.duration || 200,
        useNativeDriver: true,
      }).start();
    });
    return () => { show.remove(); hide.remove(); };
  }, [pwModalAccount, keyboardOffset]);

  async function handleTapAccount(account: SavedAccount) {
    // 1) Tenta Face ID. Se passar, login rápido via refresh token.
    try {
      const hasHw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHw && enrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: `Entrar como ${account.name || account.email}`,
          cancelLabel: 'Usar senha',
          fallbackLabel: 'Usar senha',
        });
        if (result.success) {
          try {
            await loginWithSavedAccount(account);
            return;
          } catch {
            // refresh token expirou/revogado → cai pra senha
            openPasswordModal(account);
            return;
          }
        }
      }
    } catch {
      // erro na biometria → cai pra senha
    }
    // 2) Sem biometria ou cancelou → senha
    openPasswordModal(account);
  }

  function openPasswordModal(account: SavedAccount) {
    keyboardOffset.setValue(0);
    setPwModalAccount(account);
    setPassword('');
    setShowPassword(false);
    setError(null);
  }

  async function handlePasswordLogin() {
    if (!pwModalAccount) return;
    if (!password) { setError('Digite sua senha'); return; }
    try {
      await login({ email: pwModalAccount.email, password });
      setPwModalAccount(null);
    } catch (err) {
      setError(normalizeError(err).message);
      setPassword('');
    }
  }

  function confirmRemove(account: SavedAccount) {
    Alert.alert(
      'Remover conta',
      `Remover "${account.email}" da lista? Você pode entrar de novo depois.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: () => removeSavedAccount(account.email) },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Image
          source={require('../../assets/logo.png')}
          style={{ width: logoSize, height: logoSize, resizeMode: 'contain', alignSelf: 'center', marginBottom: 20, tintColor: colors.brandPrimaryDark }}
          accessibilityLabel="Logo Quase Nada Finanças"
        />

        {savedAccounts.length > 0 ? (
          <>
            <Text style={styles.title}>Bem-vindo de volta</Text>
            <Text style={styles.subtitle}>Escolha uma conta para continuar</Text>

            <View style={styles.list}>
              {savedAccounts.map((account) => (
                <Pressable key={account.email} style={styles.card} onPress={() => handleTapAccount(account)} disabled={loading}>
                  <View style={[styles.cardAvatar, { backgroundColor: account.color || colors.brandPrimaryDark }]}>
                    <Image source={require('../../assets/logo.png')} style={styles.cardAvatarLogo} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName} numberOfLines={1}>{account.name || 'Conta'}</Text>
                    <Text style={styles.cardEmail} numberOfLines={1}>{account.email}</Text>
                  </View>
                  <Pressable onPress={() => confirmRemove(account)} hitSlop={10} style={styles.cardRemove}>
                    <Ionicons name="close" size={18} color={colors.brandTextSecondary} />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.title}>Olá!</Text>
            <Text style={styles.subtitle}>Entre para gerenciar suas finanças</Text>
          </>
        )}

        <Pressable style={styles.otherBtn} onPress={() => navigation.navigate('Login')} disabled={loading}>
          <Text style={styles.otherText}>{savedAccounts.length > 0 ? '+ Entrar com outra conta' : 'Fazer login'}</Text>
        </Pressable>

        <View style={styles.registerRow}>
          <Text style={styles.registerText}>Não tem conta? </Text>
          <Pressable onPress={() => navigation.navigate('Register')} hitSlop={8} disabled={loading}>
            <Text style={styles.registerLink}>Criar conta</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Modal de senha (fallback) */}
      <Modal visible={!!pwModalAccount} transparent animationType="slide" onRequestClose={() => setPwModalAccount(null)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPwModalAccount(null)} />
          <Animated.View style={[styles.sheet, { transform: [{ translateY: keyboardOffset }] }]}>
            <View style={styles.handle} />
            <View style={[styles.sheetAvatar, { backgroundColor: colors.brandPrimaryDark }]}>
              <Image source={require('../../assets/logo.png')} style={styles.sheetAvatarLogo} />
            </View>
            <Text style={styles.sheetName}>{pwModalAccount?.name || 'Conta'}</Text>
            <Text style={styles.sheetEmail}>{pwModalAccount?.email}</Text>

            {error ? <Text style={styles.formError}>{error}</Text> : null}

            <View style={[styles.inputWrapper, error && styles.inputError]}>
              <TextInput
                style={styles.inputInner}
                placeholder="Sua senha"
                placeholderTextColor={colors.brandTextSecondary}
                value={password}
                onChangeText={(t) => { setPassword(t); if (error) setError(null); }}
                secureTextEntry={!showPassword}
                onSubmitEditing={handlePasswordLogin}
                autoFocus
                editable={!loading}
              />
              <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={8} style={{ paddingRight: 14 }}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.brandTextSecondary} />
              </Pressable>
            </View>

            <Pressable style={[styles.sheetBtn, loading && { opacity: 0.6 }]} onPress={handlePasswordLogin} disabled={loading}>
              {loading ? <LoadingDog size={28} color="#FFFFFF" /> : <Text style={styles.sheetBtnText}>Entrar</Text>}
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

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
    themeToggle: { position: 'absolute', top: 56, right: 24, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
    container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 40, justifyContent: 'center' },
    title: { fontSize: 28, fontWeight: '800', color: c.brandTextPrimary, marginBottom: 6, textAlign: 'center' },
    subtitle: { fontSize: 15, color: c.brandTextSecondary, textAlign: 'center', marginBottom: 32 },
    list: { gap: 10, marginBottom: 24 },
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.brandSurface, borderRadius: 14, borderWidth: 1, borderColor: c.brandDivider, padding: 14, gap: 12 },
    cardAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    cardAvatarLogo: { width: 26, height: 26, resizeMode: 'contain', tintColor: '#FFFFFF' },
    cardName: { fontSize: 15, fontWeight: '700', color: c.brandTextPrimary, marginBottom: 2 },
    cardEmail: { fontSize: 13, color: c.brandTextSecondary },
    cardRemove: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
    otherBtn: { paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: c.brandDivider, alignItems: 'center', marginBottom: 20 },
    otherText: { fontSize: 15, fontWeight: '700', color: c.brandPrimaryDark },
    registerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    registerText: { color: c.brandTextSecondary, fontSize: 14 },
    registerLink: { color: c.brandPrimaryDark, fontSize: 14, fontWeight: '700' },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: c.brandSurface, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40, alignItems: 'center' },
    handle: { width: 40, height: 4, backgroundColor: c.brandDivider, borderRadius: 2, marginBottom: 16 },
    sheetAvatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    sheetAvatarLogo: { width: 38, height: 38, resizeMode: 'contain', tintColor: '#FFFFFF' },
    sheetName: { fontSize: 18, fontWeight: '800', color: c.brandTextPrimary, marginBottom: 4 },
    sheetEmail: { fontSize: 14, color: c.brandTextSecondary, marginBottom: 20 },
    formError: { color: c.brandTextError, fontWeight: '700', marginBottom: 12 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', backgroundColor: c.brandSurfaceAlt, borderWidth: 1, borderColor: c.brandDivider, borderRadius: 12, minHeight: 50, marginBottom: 16 },
    inputInner: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: c.brandTextPrimary },
    inputError: { borderColor: c.brandError },
    sheetBtn: { alignSelf: 'stretch', backgroundColor: c.brandPrimaryDark, borderRadius: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
    sheetBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  });
}
