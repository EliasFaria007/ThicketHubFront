import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type { Papel, User } from "@/types";
import type { LoginResponse } from "@/types";

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  hidratado: boolean;
  /**
   * Aceita tanto o formato do mock (token + user) quanto o formato plano do
   * back-end Java (accessToken + campos de usuário no nível raiz).
   */
  entrar: (payload: LoginResponse | { token: string; refreshToken: string; user: User }) => void;
  atualizarTokens: (payload: { token: string; refreshToken: string }) => void;
  atualizarUsuario: (user: User) => void;
  sair: () => void;
}

/** Armazenamento apenas no cliente — evita vazar sessão entre requisições SSR. */
const storage = createJSONStorage(() =>
  typeof window === "undefined"
    ? { getItem: () => null, setItem: () => {}, removeItem: () => {} }
    : window.localStorage,
);

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      hidratado: false,
      entrar: (payload) => {
        // Formato Java: {accessToken, refreshToken, id, nome, email, papel, setor, ...}
        if ("accessToken" in payload) {
          const {
            accessToken,
            refreshToken,
            id,
            nome,
            email,
            papel,
            setor,
            setoresLiberados,
            primeiroAcessoConcluido,
            assinatura,
            incluirAssinaturaPadrao,
            termosVersao,
            termosAceitosEm,
          } = payload as LoginResponse;
          const jaAceitouLocal =
            typeof window !== "undefined" && id
              ? window.localStorage.getItem(`termos_aceitos_${id}`)
              : null;
          const concluiuPrimeiro = primeiroAcessoConcluido ?? true;
          const versaoTermos =
            termosVersao ??
            (jaAceitouLocal === "1.0" || concluiuPrimeiro ? "1.0" : null);
          const user: User = {
            id,
            nome,
            email,
            papel,
            setor,
            setoresLiberados: setoresLiberados ?? [],
            podeCadastrarUsuarios: false,
            ativo: true,
            criadoEm: new Date().toISOString(),
            primeiroAcessoConcluido: concluiuPrimeiro,
            termosAceitosEm:
              termosAceitosEm ??
              (versaoTermos ? new Date().toISOString() : null),
            termosVersao: versaoTermos,
            assinatura: assinatura ?? null,
            incluirAssinaturaPadrao: incluirAssinaturaPadrao ?? true,
          };
          set({ token: accessToken, refreshToken, user });
        } else {
          // Formato mock: {token, refreshToken, user}
          const { token, refreshToken, user } = payload as { token: string; refreshToken: string; user: User };
          set({ token, refreshToken, user });
        }
      },
      atualizarTokens: ({ token, refreshToken }) => set({ token, refreshToken }),
      atualizarUsuario: (atualizado) =>
        set((state) => {
          if (!state.user) return { user: atualizado };
          const jaAceitouLocal =
            typeof window !== "undefined" && (atualizado.id || state.user.id)
              ? window.localStorage.getItem(`termos_aceitos_${atualizado.id ?? state.user.id}`)
              : null;
          const versaoTermos =
            atualizado.termosVersao ??
            state.user.termosVersao ??
            (jaAceitouLocal === "1.0" || state.user.primeiroAcessoConcluido ? "1.0" : null);
          return {
            user: {
              ...state.user,
              ...atualizado,
              termosVersao: versaoTermos,
              termosAceitosEm:
                atualizado.termosAceitosEm ??
                state.user.termosAceitosEm ??
                (versaoTermos ? new Date().toISOString() : null),
              primeiroAcessoConcluido:
                atualizado.primeiroAcessoConcluido ?? state.user.primeiroAcessoConcluido,
              assinatura:
                atualizado.assinatura !== undefined
                  ? atualizado.assinatura
                  : state.user.assinatura,
              incluirAssinaturaPadrao:
                atualizado.incluirAssinaturaPadrao !== undefined
                  ? atualizado.incluirAssinaturaPadrao
                  : state.user.incluirAssinaturaPadrao,
            },
          };
        }),
      sair: () => set({ token: null, refreshToken: null, user: null }),
    }),
    {
      name: "chamados.auth",
      storage,
      partialize: (state) => ({ token: state.token, refreshToken: state.refreshToken, user: state.user }),
    },
  ),
);

useAuthStore.persist.onFinishHydration(() => {
  useAuthStore.setState({ hidratado: true });
});
if (typeof window !== "undefined" && useAuthStore.persist.hasHydrated()) {
  useAuthStore.setState({ hidratado: true });
}

const BASE_USUARIO = ["chamados:ler", "chamados:criar", "chamados:comentar", "chamados:avaliar", "catalogo:ver"];
const BASE_TECNICO = [
  ...BASE_USUARIO,
  "chamados:atualizar",
  "chamados:encaminhar",
  "chamados:assumir",
  "chamados:fila",
  "auditoria:ler",
];
const BASE_ADMIN = [
  ...BASE_TECNICO,
  "usuarios:gerenciar",
  "chamados:reabrir",
  "auditoria:ler",
  "relatorios:ler",
];

export const PERMISSOES: Record<Papel, string[]> = {
  usuario: BASE_USUARIO,
  tecnico: BASE_TECNICO,
  admin: BASE_ADMIN,
  superusuario: [...BASE_ADMIN, "catalogo:gerenciar", "sla:configurar", "configuracoes:gerenciar"],
  super: [...BASE_ADMIN, "catalogo:gerenciar", "sla:configurar", "configuracoes:gerenciar"],
};

/** Superusuário tem acesso irrestrito; demais perfis seguem a matriz de permissões. */
export function podeExecutar(papel: Papel | undefined, permissao: string): boolean {
  if (!papel) return false;
  if (papel === "superusuario") return true;
  return PERMISSOES[papel].includes(permissao);
}

/** Cadastro de usuários: admin/super sempre; técnico apenas se liberado pelo admin. */
export function podeCadastrarUsuarios(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.papel === "superusuario" || user.papel === "admin") return true;
  return user.papel === "tecnico" && user.podeCadastrarUsuarios;
}

/** Técnico e admin só enxergam chamados das filas (setores) liberadas para eles. */
export function podeVerSetor(user: User | null | undefined, setor: string): boolean {
  if (!user) return false;
  if (user.papel === "superusuario") return true;
  if (user.papel === "tecnico" || user.papel === "admin") return user.setoresLiberados.includes(setor);
  return true;
}

/** Filas (setores) visíveis para o perfil em filtros e painéis. */
export function setoresVisiveisPara(user: User | null | undefined, setores: string[]): string[] {
  if (!user) return [];
  if (user.papel === "superusuario") return setores;
  if (user.papel === "tecnico" || user.papel === "admin") {
    return setores.filter((s) => user.setoresLiberados.includes(s));
  }
  return setores;
}

