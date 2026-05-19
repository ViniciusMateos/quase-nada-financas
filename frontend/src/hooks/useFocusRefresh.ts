import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Dispara `callback` toda vez que a tela ganha foco, EXCETO na 1ª montagem
 * (porque o useEffect inicial do hook de dados já carrega).
 *
 * Use isso pra manter dados frescos sem o usuário precisar dar pull-to-refresh
 * ao voltar pra tela depois de uma mutação em outra tela
 * (ex: conectar conta, editar transação, sincronizar).
 */
export function useFocusRefresh(callback: () => void | Promise<void>) {
  const firstFocusRef = useRef(true);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useFocusEffect(
    useCallback(() => {
      if (firstFocusRef.current) {
        firstFocusRef.current = false;
        return;
      }
      void callbackRef.current();
    }, [])
  );
}
