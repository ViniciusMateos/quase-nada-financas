export type DemoEnterOrigin = { x: number; y: number };
type Listener = (origin?: DemoEnterOrigin) => void;

const demoEnterListeners = new Set<Listener>();

/**
 * Emitter de UI a nível de módulo (mesmo padrão de authEvents). Usado pra
 * disparar a animação de entrada no modo demonstração a partir de qualquer
 * tela, sendo orquestrada pelo overlay montado na raiz (App.tsx).
 *
 * O `origin` (pageX/pageY) é opcional: quando informado, o círculo verde cresce
 * a partir daquele ponto (efeito ripple). Sem origin, expande do centro.
 */
export const uiEvents = {
  onDemoEnter(listener: Listener) {
    demoEnterListeners.add(listener);
    return () => {
      demoEnterListeners.delete(listener);
    };
  },
  triggerDemoEnter(origin?: DemoEnterOrigin) {
    demoEnterListeners.forEach((listener) => listener(origin));
  },
};
