import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// Push tokens NÃO funcionam no Expo Go (SDK 53+ removeu o módulo nativo).
// Só em build de desenvolvimento/produção (EAS). Detecta e evita o crash
// "Cannot find native module 'ExpoPushTokenManager'".
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Pede permissão e retorna o Expo Push Token, ou null se não disponível
 * (Expo Go, emulador, permissão negada, etc). Importa expo-notifications
 * dinamicamente pra não tocar no módulo nativo em ambientes que não o têm.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (isExpoGo) return null;

  try {
    const Notifications = await import('expo-notifications');
    const Device = await import('expo-device');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (!Device.isDevice) return null;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return token.data;
  } catch {
    return null;
  }
}
