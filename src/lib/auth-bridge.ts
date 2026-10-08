import { configurarAuthHttp } from "./http";
import { definirAtorDemo } from "./mock-api";
import { useAuthStore } from "@/stores/auth";

/** Liga o store de autenticação aos interceptors do Axios (token + refresh + logout). */
configurarAuthHttp({
  getTokens: () => {
    const { token, refreshToken } = useAuthStore.getState();
    return { token, refreshToken };
  },
  onRefreshed: (tokens) => useAuthStore.getState().atualizarTokens(tokens),
  onLogout: () => {
    useAuthStore.getState().sair();
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.assign("/login");
    }
  },
});

/**
 * Modo demonstração: o backend simulado vive em memória e é reiniciado a cada
 * recarga da página. Reaplicamos o usuário da sessão persistida para que as
 * regras de visibilidade continuem valendo depois de um F5.
 */
definirAtorDemo(useAuthStore.getState().user);
useAuthStore.subscribe((estado) => definirAtorDemo(estado.user));

export {};
