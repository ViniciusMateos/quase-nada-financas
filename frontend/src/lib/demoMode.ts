/**
 * Flag global do modo demonstração. Vive no nível do módulo (igual a authEvents
 * e tokenStorage) pra que os services — que não são React — possam checar
 * sincronicamente se devem servir dados fictícios em vez de chamar a API.
 *
 * Quem ESCREVE é o AuthContext (enterDemo/exitDemo). Quem LÊ são os services.
 */
let active = false;

export const demoMode = {
  isActive(): boolean {
    return active;
  },
  set(value: boolean): void {
    active = value;
  },
};
