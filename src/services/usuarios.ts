import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/http";
import type { Paginacao, Papel, User } from "@/types";

// ---------------------------------------------------------------------------
// Listagem e busca de usuários
// ---------------------------------------------------------------------------

/**
 * Lista usuários do sistema.
 * O back-end Java retorna List<UsuarioResponse> em GET /usuarios.
 * Se o modo demo (mock) for usado, pode retornar Paginacao<User> ou List<User>.
 */
export async function listarUsuarios(params?: { q?: string; papel?: Papel | ""; page?: number; limit?: number }) {
  const data = await apiGet<User[] | Paginacao<User>>("/usuarios", {
    q: params?.q || undefined,
    papel: params?.papel || undefined,
    page: params?.page,
    limit: params?.limit,
  });

  // Se já vier encapsulado em paginação (mock)
  if (data && typeof data === "object" && "items" in data) {
    return data as Paginacao<User>;
  }

  // Se for lista pura do backend Java
  const items = Array.isArray(data) ? data : [];
  return {
    items,
    page: 1,
    limit: items.length || 10,
    total: items.length,
    totalPages: 1,
  } as Paginacao<User>;
}

export function obterUsuario(id: string | number) {
  return apiGet<User>(`/usuarios/${id}`);
}

export function obterMeuPerfil() {
  return apiGet<User>("/usuarios/me");
}

export const obterUsuarioLogado = obterMeuPerfil;

// ---------------------------------------------------------------------------
// Criação e Atualização
// ---------------------------------------------------------------------------

export interface UsuarioPayload {
  nome: string;
  email: string;
  telefone?: string;
  localidade?: string;
  papel: Papel;
  setor: string;
  setoresLiberados?: string[];
  podeCadastrarUsuarios?: boolean;
  senhaInicial?: string;
  assinatura?: string | null | undefined;
  incluirAssinaturaPadrao?: boolean | undefined;
}

export function criarUsuario(payload: UsuarioPayload) {
  return apiPost<User>("/usuarios", {
    ...payload,
    papel: payload.papel.toUpperCase(),
  });
}

export function atualizarUsuario(
  id: string | number,
  payload: Partial<UsuarioPayload> & { ativo?: boolean },
) {
  return apiPut<User>(`/usuarios/${id}`, {
    ...payload,
    papel: payload.papel ? payload.papel.toUpperCase() : undefined,
  });
}

/**
 * Salva a assinatura e preferência de inclusão no corpo dos chamados.
 */
export function salvarAssinaturaUsuario(
  id: string | number,
  payload: {
    assinatura: string | null;
    incluirAssinaturaPadrao: boolean;
    nome?: string;
    email?: string;
  },
) {
  return apiPut<User>(`/usuarios/${id}`, {
    assinatura: payload.assinatura,
    incluirAssinaturaPadrao: payload.incluirAssinaturaPadrao,
    ...(payload.nome ? { nome: payload.nome } : {}),
    ...(payload.email ? { email: payload.email } : {}),
  });
}

export function desativarUsuario(id: string | number) {
  return apiPatch<void>(`/usuarios/${id}/desativar`);
}

export function excluirUsuario(id: string | number) {
  return apiDelete<void>(`/usuarios/${id}`);
}

export const deletarUsuario = excluirUsuario;

export function ativarUsuario(id: string | number) {
  return apiPatch<void>(`/usuarios/${id}/ativar`);
}

// ---------------------------------------------------------------------------
// Reset de Senha
// ---------------------------------------------------------------------------

/**
 * Reseta a senha de um usuário gerando uma senha temporária retornada no UsuarioResponse.
 * Endpoint: POST /usuarios/{id}/resetar-senha
 */
export async function resetarSenhaUsuario(id: string | number, payload?: { novaSenha?: string }) {
  const res = await apiPost<User & { senhaTemporaria?: string; novaSenha?: string; mensagem?: string }>(
    `/usuarios/${id}/resetar-senha`,
    payload ?? {},
  );
  return {
    novaSenha: res.senhaTemporaria || res.novaSenha || "",
    mensagem: res.mensagem || "Senha redefinida com sucesso.",
  };
}

// ---------------------------------------------------------------------------
// Importação em Lote
// ---------------------------------------------------------------------------

export interface UsuarioLoteItem {
  nome: string;
  email: string;
  setor?: string;
  papel?: Papel;
  telefone?: string;
  localidade?: string;
}

export interface ImportarLoteResponse {
  totalCriados: number;
  totalIgnorados: number;
  erros: { linha?: number; email: string; motivo: string }[];
  criados?: User[];
}

export function criarUsuariosEmLote(payload: { usuarios: UsuarioLoteItem[] }) {
  return apiPost<ImportarLoteResponse>("/usuarios/importar-lote", {
    usuarios: payload.usuarios.map((u) => ({
      ...u,
      papel: u.papel ? u.papel.toUpperCase() : "USUARIO",
    })),
  });
}

export function aceitarTermos(versao: string) {
  return apiPost<User>("/auth/termos", { versao });
}
