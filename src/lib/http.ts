import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

import { mockAdapter } from "./mock-api";
import { logErroFront } from "./logger";
import type { ApiResponse } from "@/types";

export function getApiBaseUrl(): string {
  const envUrl = (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "";
  if (!envUrl) return "";
  if (
    typeof window !== "undefined" &&
    window.location.hostname &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    // Quando acessado por IP da rede local (ex: 10.26.4.137), substitui localhost pelo host acessado
    return envUrl.replace(/localhost|127\.0\.0\.1/, window.location.hostname);
  }
  return envUrl;
}

export const API_BASE_URL = (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "";
/** Sem VITE_API_BASE_URL configurada, a aplicação roda com dados de demonstração locais. */
export const USANDO_DEMO = API_BASE_URL.trim() === "";

export const http: AxiosInstance = axios.create({
  baseURL: USANDO_DEMO ? "/demo-api" : getApiBaseUrl(),
  timeout: 20_000,
  headers: { "Content-Type": "application/json" },
});

if (USANDO_DEMO) {
  http.defaults.adapter = mockAdapter;
}

// ---------------------------------------------------------------------------
// Normalização de respostas do back-end Java
// ---------------------------------------------------------------------------

/**
 * O back-end Java retorna:
 *   { data, mensagem, erros: List<String>, status: int }
 *
 * O front-end interno usa:
 *   { success: boolean, data, message: string|null, errors: string[]|null }
 *
 * Este interceptor de resposta normaliza o envelope **apenas no modo real**
 * (USANDO_DEMO === false), convertendo também todos os valores de enum que
 * chegam em UPPER_CASE para lowercase, para que o restante da UI continue
 * funcionando sem alterações.
 */

/** Conjunto de valores de enum Java que precisam ser normalizados para lowercase. */
const ENUM_JAVA_UPPERCASE = new Set([
  // StatusChamado
  "ABERTO", "EM_ATENDIMENTO", "EM_ANDAMENTO", "AGUARDANDO",
  "PAUSADO", "RESOLVIDO", "CONCLUIDO", "FECHADO", "CANCELADO",
  // PrioridadeChamado
  "BAIXA", "MEDIA", "ALTA", "CRITICA",
  // Papel
  "USUARIO", "TECNICO", "ADMIN", "SUPERUSUARIO",
  // TipoVinculo
  "RELACIONADO", "DUPLICADO", "FILHO", "PAI",
  // TipoHistorico
  "ABERTURA", "ASSUNCAO", "STATUS", "ENCAMINHAMENTO", "COMENTARIO",
  "PAUSA", "RETOMADA", "RESOLUCAO", "REABERTURA", "VINCULO", "DEVOLUCAO",
]);

/** Converte recursivamente strings UPPER_CASE de enum Java para lowercase. */
function normalizarEnums(valor: unknown): unknown {
  if (typeof valor === "string") {
    return ENUM_JAVA_UPPERCASE.has(valor) ? valor.toLowerCase() : valor;
  }
  if (Array.isArray(valor)) {
    return valor.map(normalizarEnums);
  }
  if (valor !== null && typeof valor === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      result[k] = normalizarEnums(v);
    }
    return result;
  }
  return valor;
}

/**
 * Transforma o envelope Java `{data, mensagem, erros, status}` para o
 * formato interno `{success, data, message, errors}`.
 */
function normalizarEnvelope(raw: unknown): ApiResponse<unknown> {
  if (raw !== null && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    // Já no formato interno (modo demo)
    if ("success" in obj) return obj as unknown as ApiResponse<unknown>;
    // Formato Java
    const data = normalizarEnums(obj["data"]);
    const message = (obj["mensagem"] as string | null | undefined) ?? null;
    const errors = (obj["erros"] as string[] | null | undefined) ?? null;
    return { success: true, data, message, errors };
  }
  return { success: true, data: raw, message: null, errors: null };
}

if (!USANDO_DEMO) {
  http.interceptors.response.use((response) => {
    response.data = normalizarEnvelope(response.data);
    return response;
  });
}

const ENUMS_LOWERCASE_TO_UPPERCASE: Record<string, string> = {
  // StatusChamado
  aberto: "ABERTO",
  em_atendimento: "EM_ATENDIMENTO",
  em_andamento: "EM_ANDAMENTO",
  aguardando: "AGUARDANDO",
  pausado: "PAUSADO",
  resolvido: "RESOLVIDO",
  concluido: "CONCLUIDO",
  fechado: "FECHADO",
  cancelado: "CANCELADO",
  // PrioridadeChamado
  baixa: "BAIXA",
  media: "MEDIA",
  alta: "ALTA",
  critica: "CRITICA",
  // Papel
  usuario: "USUARIO",
  tecnico: "TECNICO",
  admin: "ADMIN",
  superusuario: "SUPERUSUARIO",
  // TipoVinculo
  relacionado: "RELACIONADO",
  duplicado: "DUPLICADO",
  filho: "FILHO",
  pai: "PAI",
};

/** Chaves de propriedades de DTO conhecidas por receberem Enums no backend. */
const CHAVES_ENUM_CONHECIDAS = new Set([
  "prioridade",
  "status",
  "papel",
  "tipoVinculo",
  "tipo",
]);

/** Converte recursivamente strings lowercase de enums para UPPER_CASE antes de enviar ao Java. */
function normalizarEnumsParaEnvio(valor: unknown, chaveAtual?: string): unknown {
  if (typeof valor === "string") {
    const valLower = valor.toLowerCase();
    if (chaveAtual && CHAVES_ENUM_CONHECIDAS.has(chaveAtual) && ENUMS_LOWERCASE_TO_UPPERCASE[valLower]) {
      return ENUMS_LOWERCASE_TO_UPPERCASE[valLower];
    }
    if (ENUMS_LOWERCASE_TO_UPPERCASE[valLower]) {
      return ENUMS_LOWERCASE_TO_UPPERCASE[valLower];
    }
    return valor;
  }
  if (Array.isArray(valor)) {
    return valor.map((item) => normalizarEnumsParaEnvio(item, chaveAtual));
  }
  if (valor !== null && typeof valor === "object" && !(valor instanceof FormData) && !(valor instanceof Blob)) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      result[k] = normalizarEnumsParaEnvio(v, k);
    }
    return result;
  }
  return valor;
}

// ---------------------------------------------------------------------------
// Auth token injection & request normalization
// ---------------------------------------------------------------------------

type TokenProvider = () => { token: string | null; refreshToken: string | null };
let tokenProvider: TokenProvider = () => ({ token: null, refreshToken: null });
let onRefreshed: (tokens: { token: string; refreshToken: string }) => void = () => {};
let onLogout: () => void = () => {};

export function configurarAuthHttp(handlers: {
  getTokens: TokenProvider;
  onRefreshed: typeof onRefreshed;
  onLogout: typeof onLogout;
}) {
  tokenProvider = handlers.getTokens;
  onRefreshed = handlers.onRefreshed;
  onLogout = handlers.onLogout;
}

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { token } = tokenProvider();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);

  if (!USANDO_DEMO) {
    config.baseURL = getApiBaseUrl();
    if (config.data && typeof config.data === "object" && !(config.data instanceof FormData)) {
      config.data = normalizarEnumsParaEnvio(config.data);
    }
    if (config.params && typeof config.params === "object") {
      config.params = normalizarEnumsParaEnvio(config.params);
    }
  }

  return config;
});

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  errors: string[];
  status: number | undefined;

  constructor(message: string, errors: string[] = [], status?: number) {
    super(message);
    this.name = "ApiError";
    this.errors = errors;
    this.status = status;
  }
}

function mensagemAmigavel(error: AxiosError<ApiResponse<unknown>>): ApiError {
  const status = error.response?.status;
  const body = error.response?.data as Record<string, unknown> | null | undefined;

  // Formato interno: {message, errors}
  const msgInterno = body?.["message"] as string | undefined;
  const errosInterno = (body?.["errors"] as string[] | undefined) ?? [];

  // Formato ProblemDetail RFC-7807 retornado pelo GlobalExceptionHandler do Spring:
  // {title, detail, erros: string[], status}
  const detail = body?.["detail"] as string | undefined;
  const errosProblem = (body?.["erros"] as string[] | undefined) ?? [];

  const mensagem = msgInterno || detail;
  const errors = errosInterno.length > 0 ? errosInterno : errosProblem;

  if (mensagem) return new ApiError(mensagem, errors, status);
  if (errors.length > 0) return new ApiError(errors[0]!, errors, status);
  if (error.code === "ECONNABORTED") {
    return new ApiError("A requisição demorou demais. Tente novamente.", [], status);
  }
  switch (status) {
    case 400:
      return new ApiError("Dados inválidos. Revise as informações enviadas.", errors, status);
    case 401:
      return new ApiError("Sua sessão expirou. Entre novamente.", errors, status);
    case 403:
      return new ApiError("Você não tem permissão para esta ação.", errors, status);
    case 404:
      return new ApiError("Registro não encontrado.", errors, status);
    case 422:
      return new ApiError("Não foi possível validar os dados enviados.", errors, status);
    case 500:
    case 502:
    case 503:
      return new ApiError("O serviço está indisponível no momento.", errors, status);
    default:
      return new ApiError("Não foi possível concluir a operação. Verifique sua conexão.", errors, status);
  }
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

let refreshEmAndamento: Promise<string | null> | null = null;

async function renovarToken(): Promise<string | null> {
  const { refreshToken } = tokenProvider();
  if (!refreshToken) return null;
  try {
    const { data } = await axios.request<ApiResponse<{ token: string; refreshToken: string }>>({
      ...(USANDO_DEMO ? { adapter: mockAdapter, baseURL: "/demo-api" } : { baseURL: getApiBaseUrl() }),
      url: "/auth/refresh",
      method: "POST",
      data: { refreshToken },
    });
    if (!data.success) return null;
    onRefreshed(data.data);
    return data.data.token;
  } catch {
    return null;
  }
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const config = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const ehLogin = config?.url?.includes("/auth/");

    if (error.response?.status === 401 && config && !config._retry && !ehLogin) {
      config._retry = true;
      refreshEmAndamento = refreshEmAndamento ?? renovarToken();
      const novoToken = await refreshEmAndamento;
      refreshEmAndamento = null;
      if (novoToken) {
        config.headers.set("Authorization", `Bearer ${novoToken}`);
        return http.request(config);
      }
      onLogout();
    }

    let apiError: ApiError;

    // Para erros do back-end Java que chegam com ProblemDetail (não envolvidos no ApiResponse),
    // extraímos a mensagem do campo `detail` ou dos erros de validação específicos.
    if (!USANDO_DEMO && error.response?.data && typeof error.response.data === "object") {
      const raw = error.response.data as unknown as Record<string, unknown>;
      if (!("success" in raw) && !("mensagem" in raw)) {
        const errosArray = (raw["erros"] as string[] | undefined) ?? [];
        const detail = (raw["detail"] as string | undefined) ?? (errosArray.length > 0 ? errosArray.join(", ") : null) ?? (raw["title"] as string | undefined) ?? null;
        if (detail) {
          apiError = new ApiError(detail, errosArray, error.response.status);
        } else {
          apiError = mensagemAmigavel(error);
        }
      } else {
        apiError = mensagemAmigavel(error);
      }
    } else {
      apiError = mensagemAmigavel(error);
    }

    // Registra no sistema de log de erros do front-end
    logErroFront({
      origem: "HTTP",
      mensagem: apiError.message,
      detalhes: error.response?.data ?? error.message,
      statusHttp: error.response?.status,
      url: config?.url,
      metodo: config?.method?.toUpperCase(),
      erroOriginal: error,
    });

    throw apiError;
  },
);

// ---------------------------------------------------------------------------
// Helpers de requisição
// ---------------------------------------------------------------------------

/** Desempacota o envelope padrão { success, data, message, errors }. */
export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await http.get<ApiResponse<T>>(url, { params });
  if (!data.success) throw new ApiError(data.message ?? "Falha na requisição", data.errors ?? []);
  return data.data;
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await http.post<ApiResponse<T>>(url, body);
  if (!data.success) throw new ApiError(data.message ?? "Falha na requisição", data.errors ?? []);
  return data.data;
}

export async function apiPut<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await http.put<ApiResponse<T>>(url, body);
  if (!data.success) throw new ApiError(data.message ?? "Falha na requisição", data.errors ?? []);
  return data.data;
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await http.patch<ApiResponse<T>>(url, body);
  if (!data.success) throw new ApiError(data.message ?? "Falha na requisição", data.errors ?? []);
  return data.data;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const { data } = await http.delete<ApiResponse<T>>(url);
  if (!data.success) throw new ApiError(data.message ?? "Falha na requisição", data.errors ?? []);
  return data.data;
}
