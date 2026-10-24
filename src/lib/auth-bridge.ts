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
    if (typeof window !== "undefined") {
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.sessionStorage.setItem("logout_manual", "true");
      } catch {}
      if ("caches" in window) {
        window.caches.keys().then((keys) => Promise.all(keys.map((k) => window.caches.delete(k)))).catch(() => {});
      }
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
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
