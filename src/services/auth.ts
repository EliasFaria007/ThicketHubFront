import { apiPost } from "@/lib/http";
import type { LoginResponse, User } from "@/types";

// ---------------------------------------------------------------------------
// Helpers de mapeamento: back-end Java → formato interno do front-end
// ---------------------------------------------------------------------------

/**
 * Constrói um objeto `User` a partir da resposta plana `AuthResponse` do
 * back-end Java.  O back-end não retorna um sub-objeto `user`; os campos
 * chegam no nível raiz junto com `accessToken` e `refreshToken`.
 */
export function authResponseParaUser(data: LoginResponse): User {
  return {
    id: data.id,
    nome: data.nome,
    email: data.email,
    papel: data.papel,
    setor: data.setor,
    setoresLiberados: data.setoresLiberados ?? [],
    podeCadastrarUsuarios: false, // informação não retornada pelo auth; será preenchida via /usuarios/me
    ativo: true,
    criadoEm: new Date().toISOString(),
    primeiroAcessoConcluido: data.primeiroAcessoConcluido,
    termosVersao: data.termosVersao ?? (data.primeiroAcessoConcluido ? "1.0" : null),
    termosAceitosEm: data.termosAceitosEm ?? (data.primeiroAcessoConcluido ? new Date().toISOString() : null),
    assinatura: data.assinatura,
    incluirAssinaturaPadrao: data.incluirAssinaturaPadrao ?? true,
  };
}

// ---------------------------------------------------------------------------
// Autenticação principal
// ---------------------------------------------------------------------------

/**
 * Login institucional.
 * Retorna o `LoginResponse` plano do Java; use `authResponseParaUser()` para
 * obter o objeto `User` e salvar no store.
 */
export function login(payload: { email: string; password: string }) {
  return apiPost<LoginResponse>("/auth/login", payload);
}

/**
 * Login institucional via Microsoft (Office 365 / Entra ID).
 * Envia o ID token ou credenciais institucionais Microsoft para autenticação e provisionamento no backend.
 */
export function loginMicrosoft(payload: { idToken: string; email?: string; nome?: string }) {
  return apiPost<LoginResponse>("/auth/microsoft", payload);
}

/**
 * Renova o access token usando o refresh token armazenado.
 * O back-end retorna o mesmo `AuthResponse` plano.
 */
export function refresh(refreshToken: string) {
  return apiPost<LoginResponse>("/auth/refresh", { refreshToken });
}

export function logout() {
  return apiPost<void>("/auth/logout");
}

// ---------------------------------------------------------------------------
// Primeiro acesso (troca de senha obrigatória)
// ---------------------------------------------------------------------------

/**
 * Conclui o primeiro acesso do usuário (define senha, telefone, setor, localidade).
 * Endpoint: POST /auth/primeiro-acesso
 * Requer que o usuário já esteja autenticado com o token temporário.
 */
export function completarCadastro(payload: {
  novaSenha?: string;
  telefone?: string;
  setor?: string;
  localidade?: string;
}) {
  return apiPost<LoginResponse>("/auth/primeiro-acesso", payload);
}

// ---------------------------------------------------------------------------
// Recuperação de senha via SMS
// ---------------------------------------------------------------------------

/**
 * Solicita o envio de um código SMS para recuperação de senha.
 * Endpoint: POST /auth/recuperacao-sms/solicitar
 *
 * ATENÇÃO: o back-end Java recebe `telefone` (não `email`), pois a busca é
 * feita pelo número de celular cadastrado.  A tela de recuperação deve
 * solicitar o telefone do usuário.
 *
 * Em modo demo (mock-api), a rota `/auth/solicitar-reset-sms` aceita `email`
 * para facilitar o fluxo de demonstração — esse comportamento é preservado.
 */
export interface SolicitarResetSmsResponse {
  telefoneMascarado?: string;
  codigoDemo?: string;
}

export function solicitarResetSenhaSms(payload: { telefone?: string; email?: string }) {
  return apiPost<SolicitarResetSmsResponse>("/auth/recuperacao-sms/solicitar", payload);
}

/**
 * Valida o código SMS recebido e obtém um ticket de sessão único para
 * autorizar a redefinição de senha.
 * Endpoint: POST /auth/recuperacao-sms/validar
 */
export function validarCodigoSms(payload: { telefone: string; codigo: string }) {
  return apiPost<string>("/auth/recuperacao-sms/validar", payload);
}

/**
 * Redefine a senha usando o ticket obtido em `validarCodigoSms`.
 * Endpoint: POST /auth/recuperacao-sms/redefinir-senha
 */
export function redefinirSenha(payload: { ticketValidacao: string; novaSenha: string }) {
  return apiPost<void>("/auth/recuperacao-sms/redefinir-senha", payload);
}

/**
 * Função compatível com o formulário de redefinição de senha via SMS.
 * Executa a validação do código SMS e o reset de senha sequencialmente.
 */
export async function confirmarResetSenhaSms(payload: { email?: string; telefone?: string; codigo: string; novaSenha: string }) {
  const tel = payload.telefone || payload.email || "";
  try {
    const ticket = await validarCodigoSms({
      telefone: tel,
      codigo: payload.codigo,
    });
    await redefinirSenha({
      ticketValidacao: ticket,
      novaSenha: payload.novaSenha,
    });
    return { mensagem: "Senha redefinida com sucesso." };
  } catch {
    return apiPost<{ mensagem: string }>("/auth/confirmar-reset-sms", payload);
  }
}

// ---------------------------------------------------------------------------
// Manutenção da conta
// ---------------------------------------------------------------------------

/**
 * Permite ao próprio usuário trocar sua senha enquanto está autenticado.
 * Endpoint: POST /usuarios/alterar-senha
 */
export function alterarSenha(payload: { senhaAtual: string; novaSenha: string }) {
  return apiPost<void>("/usuarios/alterar-senha", payload);
}
