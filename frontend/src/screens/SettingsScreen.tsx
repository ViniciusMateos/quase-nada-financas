import { useMemo, useState } from 'react';
import {
  Alert,
  GestureResponderEvent,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { demoStore } from '@/demo/demoStore';
import { OTA_VERSION, rodandoDeUpdate } from '@/constants/otaVersion';
import { normalizeError } from '@/lib/errorMap';
import { BottomSheet } from '@/ui/BottomSheet';
import { LoadingDog } from '@/ui/LoadingDog';
import { TabScreen } from '@/ui/TabScreen';

const AVATAR_COLORS = [
  '#22C55E', '#16A34A', '#0EA5E9',
  '#6366F1', '#8B5CF6', '#EC4899',
  '#F59E0B', '#EF4444', '#64748B',
];

// Duração compartilhada entre a expansão do picker e o deslize dos blocos
// abaixo dele — mesmo timing pra sensação de "uma animação só".
const PICKER_DUR_MS = 260;

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { user, logout, loading, savedAccounts, updateSavedAccount, deleteAccount, isDemo, enterDemo, exitDemo } = useAuth();
  const { colors, radius, shadows, mode, setMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const currentAccount = savedAccounts.find((a) => a.email === user?.email);

  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  // Em demo não há conta salva pra guardar a cor; mantemos na sessão (demoStore)
  // e num state local pra forçar o re-render ao escolher.
  const [demoColor, setDemoColor] = useState<string | null>(() => (isDemo ? demoStore.getAvatarColor() : null));

  const avatarColor = isDemo
    ? demoColor || colors.brandPrimaryDark
    : currentAccount?.color || colors.brandPrimaryDark;

  // Modal de exclusão de conta
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // O reanimated cuida das animações: o picker entra/sai com Fade, e os
  // Animated.View envolvendo cada bloco têm `layout={LinearTransition}` —
  // quando o card de cima cresce/encolhe, eles acompanham deslizando junto.
  function toggleColorPicker() {
    setColorPickerOpen((v) => !v);
  }

  function pickColor(color: string) {
    if (isDemo) {
      demoStore.setAvatarColor(color);
      setDemoColor(color);
    } else if (user?.email) {
      updateSavedAccount(user.email, { color });
    }
    setColorPickerOpen(false);
  }

  function confirmLogout() {
    Alert.alert('Sair da conta?', 'Você volta pra tela de contas e pode entrar de novo com Face ID.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logout },
    ]);
  }

  // Alert nativo confirmando a saída da demo — respeita o tema do app (claro
  // ou escuro), independente do tema do sistema.
  function confirmExitDemo() {
    Alert.alert(
      'Sair da demonstração?',
      'Você volta pra tela de contas. Pode entrar de novo a hora que quiser.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: exitDemo },
      ],
      { userInterfaceStyle: mode === 'dark' ? 'dark' : 'light' }
    );
  }

  function openDelete() {
    setDeletePassword('');
    setShowDeletePassword(false);
    setDeleteError(null);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (!deletePassword) { setDeleteError('Digite sua senha'); return; }
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount(deletePassword);
      // sucesso: AuthContext zera a sessão → navega pro hub automaticamente
    } catch (err) {
      setDeleteError(normalizeError(err).message);
      setDeletePassword('');
      setDeleting(false);
    }
  }

  return (
    <TabScreen>
      <Text style={styles.title}>Ajustes</Text>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        {/* Perfil + cor do avatar — Animated.View pra altura do card animar
            suavemente quando o color picker abre/fecha logo abaixo. */}
        <Animated.View style={[styles.card, { ...shadows.card }]} layout={LinearTransition.duration(PICKER_DUR_MS)}>
          <View style={styles.profileRow}>
            <View style={styles.avatarWrap}>
              <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                <Image source={require('../../assets/logo.png')} style={styles.avatarLogo} />
              </View>
              <Pressable
                style={[styles.editColorBtn, { backgroundColor: colors.brandSurface, borderColor: colors.brandDivider }]}
                onPress={toggleColorPicker}
                hitSlop={8}
                accessibilityLabel="Mudar cor do avatar"
              >
                <Ionicons name="pencil" size={13} color={colors.brandTextSecondary} />
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{user?.name || 'Conta'}</Text>
              <Text style={styles.email} numberOfLines={1}>{user?.email}</Text>
            </View>
          </View>

          {colorPickerOpen ? (
            <Animated.View
              style={styles.colorPicker}
              entering={FadeIn.duration(PICKER_DUR_MS)}
              exiting={FadeOut.duration(180)}
            >
              {AVATAR_COLORS.map((color) => (
                <Pressable
                  key={color}
                  style={[
                    styles.swatch,
                    { backgroundColor: color },
                    avatarColor === color && styles.swatchSelected,
                  ]}
                  onPress={() => pickColor(color)}
                  accessibilityLabel={`Cor ${color}`}
                />
              ))}
            </Animated.View>
          ) : null}
        </Animated.View>

        {/* Aparência — wrapper desliza junto quando o card de cima muda altura. */}
        <Animated.View layout={LinearTransition.duration(PICKER_DUR_MS)}>
          <Text style={styles.section}>Aparência</Text>
          <View style={[styles.card, { ...shadows.card }]}>
            <View style={styles.themeRow}>
              <ThemeChoice label="Claro" icon="sunny-outline" active={mode === 'light'} onPress={() => setMode('light')} />
              <ThemeChoice label="Escuro" icon="moon-outline" active={mode === 'dark'} onPress={() => setMode('dark')} />
            </View>
          </View>
        </Animated.View>

        {/* Conta — wrapper desliza junto. */}
        <Animated.View layout={LinearTransition.duration(PICKER_DUR_MS)}>
          <Text style={styles.section}>Conta</Text>
          {isDemo ? (
            <View style={[styles.menuCard, { ...shadows.card }]}>
              <MenuItem icon="play-circle-outline" label="Você está na demonstração" onPress={() => {}} colors={colors} styles={styles} />
            </View>
          ) : (
            <View style={[styles.menuCard, { ...shadows.card }]}>
              <MenuItem icon="key-outline" label="Alterar senha" onPress={() => navigation.navigate('ChangePassword')} colors={colors} styles={styles} />
              <View style={styles.divider} />
              <MenuItem icon="swap-horizontal-outline" label="Trocar de conta" onPress={logout} colors={colors} styles={styles} />
              <View style={styles.divider} />
              <MenuItem
                icon="play-circle-outline"
                label="Ver demonstração"
                onPress={(e) => enterDemo(e ? { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY } : undefined)}
                colors={colors}
                styles={styles}
              />
              <View style={styles.divider} />
              <MenuItem icon="trash-outline" label="Excluir conta" destructive onPress={openDelete} colors={colors} styles={styles} />
            </View>
          )}
        </Animated.View>

        {/* Sair — wrapper desliza junto. */}
        <Animated.View layout={LinearTransition.duration(PICKER_DUR_MS)}>
          {isDemo ? (
            <Pressable style={styles.logoutBtn} onPress={confirmExitDemo}>
              <Ionicons name="exit-outline" size={20} color={colors.brandError} />
              <Text style={styles.logoutText}>Sair da demonstração</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.logoutBtn} onPress={confirmLogout} disabled={loading}>
              {loading ? (
                <LoadingDog size={24} color={colors.brandError} />
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={20} color={colors.brandError} />
                  <Text style={styles.logoutText}>Sair</Text>
                </>
              )}
            </Pressable>
          )}
        </Animated.View>

        {/* Rodapé OTA — prova de que o bundle novo baixou (sobe +1 a cada eas update). */}
        <View style={styles.otaFooter}>
          <Ionicons name="cloud-done-outline" size={13} color={colors.brandTextSecondary} />
          <Text style={styles.otaText}>
            OTA #{OTA_VERSION}  ·  {rodandoDeUpdate() ? 'atualizado' : 'embutido'}
          </Text>
        </View>
      </ScrollView>

      {/* Sheet excluir conta — BottomSheet (fundo escurece no lugar + arrasta pra fechar) */}
      {deleteOpen && (
        <BottomSheet onClose={() => setDeleteOpen(false)} maxHeightFraction={0.7} asNativeModal>
          <Text style={styles.sheetTitle}>Excluir conta</Text>
          <Text style={styles.sheetWarning}>
            Essa ação é irreversível. Todas as suas contas conectadas, transações e regras serão apagadas pra sempre.
          </Text>

          {deleteError ? <Text style={styles.formError}>{deleteError}</Text> : null}

          <View style={[styles.inputWrapper, deleteError && styles.inputError]}>
            <TextInput
              style={styles.inputInner}
              placeholder="Confirme sua senha"
              placeholderTextColor={colors.brandTextSecondary}
              value={deletePassword}
              onChangeText={(t) => { setDeletePassword(t); if (deleteError) setDeleteError(null); }}
              secureTextEntry={!showDeletePassword}
              onSubmitEditing={handleDelete}
              autoFocus
              editable={!deleting}
            />
            <Pressable onPress={() => setShowDeletePassword((s) => !s)} hitSlop={8} style={{ paddingRight: 14 }}>
              <Ionicons name={showDeletePassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.brandTextSecondary} />
            </Pressable>
          </View>

          <View style={styles.sheetActions}>
            <Pressable style={[styles.cancelBtn]} onPress={() => setDeleteOpen(false)} disabled={deleting}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable style={[styles.deleteBtn, deleting && { opacity: 0.6 }]} onPress={handleDelete} disabled={deleting}>
              {deleting ? <LoadingDog size={24} color="#FFFFFF" /> : <Text style={styles.deleteText}>Excluir</Text>}
            </Pressable>
          </View>
        </BottomSheet>
      )}
    </TabScreen>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  destructive,
  colors,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: (e?: GestureResponderEvent) => void;
  destructive?: boolean;
  colors: any;
  styles: any;
}) {
  const tint = destructive ? colors.brandError : colors.brandTextPrimary;
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <Ionicons name={icon} size={20} color={destructive ? colors.brandError : colors.brandTextSecondary} />
      <Text style={[styles.menuItemText, { color: tint }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.brandTextSecondary} />
    </Pressable>
  );
}

function ThemeChoice({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, radius, mode } = useTheme();
  const bg = active ? colors.brandPillBgActive : 'transparent';
  const border = active ? colors.brandPrimary : colors.brandDivider;
  const fg = active ? colors.brandPrimaryDark : colors.brandTextSecondary;
  return (
    <Pressable
      onPress={onPress}
      style={[
        themeStyles.choice,
        { backgroundColor: bg, borderColor: border, borderRadius: radius.md },
        active && {
          shadowColor: colors.brandPrimary,
          shadowOpacity: mode === 'dark' ? 0.5 : 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 0 },
        },
      ]}
    >
      <Ionicons name={icon} size={20} color={fg} />
      <Text style={[themeStyles.choiceLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const themeStyles = StyleSheet.create({
  choice: { flex: 1, paddingVertical: 14, alignItems: 'center', gap: 6, borderWidth: 1 },
  choiceLabel: { fontWeight: '700', fontSize: 14 },
});

function makeStyles(c: any) {
  return StyleSheet.create({
    title: { fontSize: 24, fontWeight: '800', color: c.brandTextPrimary, marginBottom: 12 },
    card: { backgroundColor: c.brandSurface, borderRadius: 16, padding: 16, marginBottom: 4 },
    themeRow: { flexDirection: 'row', gap: 10 },
    profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    avatarWrap: {},
    avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
    avatarLogo: { width: 32, height: 32, resizeMode: 'contain', tintColor: '#FFFFFF' },
    editColorBtn: { position: 'absolute', bottom: -4, right: -6, width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    name: { fontSize: 16, fontWeight: '800', color: c.brandTextPrimary },
    email: { marginTop: 4, fontSize: 13, color: c.brandTextSecondary },
    colorPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center', marginTop: 18, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.brandDivider },
    swatch: { width: 40, height: 40, borderRadius: 20 },
    swatchSelected: { borderWidth: 3, borderColor: c.brandSurface, transform: [{ scale: 1.12 }] },
    section: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, color: c.brandTextSecondary, marginTop: 22, marginBottom: 8, paddingLeft: 4 },
    menuCard: { backgroundColor: c.brandSurface, borderRadius: 16, overflow: 'hidden', marginBottom: 4 },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 16 },
    menuItemText: { flex: 1, fontSize: 16, fontWeight: '600' },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.brandDivider, marginLeft: 50 },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 28, paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: c.brandError, backgroundColor: 'rgba(239, 68, 68, 0.08)' },
    logoutText: { color: c.brandError, fontSize: 16, fontWeight: '700' },
    otaFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 22 },
    otaText: { color: c.brandTextSecondary, fontSize: 12, fontWeight: '600' },
    sheetTitle: { fontSize: 20, fontWeight: '800', color: c.brandTextPrimary, marginBottom: 10 },
    sheetWarning: { fontSize: 14, lineHeight: 20, color: c.brandTextSecondary, marginBottom: 18 },
    formError: { color: c.brandTextError, fontWeight: '700', marginBottom: 12 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.brandSurfaceAlt, borderWidth: 1, borderColor: c.brandDivider, borderRadius: 12, minHeight: 50, marginBottom: 20 },
    inputInner: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: c.brandTextPrimary },
    inputError: { borderColor: c.brandError },
    sheetActions: { flexDirection: 'row', gap: 12 },
    cancelBtn: { flex: 1, borderWidth: 1, borderColor: c.brandDivider, borderRadius: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
    cancelText: { fontSize: 16, fontWeight: '700', color: c.brandTextPrimary },
    deleteBtn: { flex: 1, backgroundColor: c.brandError, borderRadius: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
    deleteText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  });
}
