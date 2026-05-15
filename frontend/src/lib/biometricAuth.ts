import * as LocalAuthentication from 'expo-local-authentication';
import { AppError } from '@/lib/errorMap';

export const biometricAuth = {
  async authenticate() {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware) {
      throw new AppError('BIOMETRIC_UNAVAILABLE', 'Este iPhone nao tem biometria disponivel.');
    }
    if (!isEnrolled) {
      throw new AppError('BIOMETRIC_NOT_ENROLLED', 'Configure o Face ID no iOS para usar esta funcao.');
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirmar ordem',
      cancelLabel: 'Cancelar',
      fallbackLabel: 'Usar codigo'
    });

    if (!result.success) {
      throw new AppError('BIOMETRIC_FAILED', 'Confirmacao biometrica cancelada.');
    }
  }
};
