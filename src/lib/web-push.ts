export type StatusPermissaoWeb = NotificationPermission | "unsupported";

const CHAVE_STORAGE_PREFERENCIA = "thickethub:notificacoes_web_ativas";
const CHAVE_STORAGE_DISPENSADO = "thickethub:notificacoes_web_dispensado";

/**
 * Verifica se a Web Notification API é suportada no ambiente do navegador atual.
 */
export function suportaNotificacoesWeb(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Retorna o status atual da permissão de notificações do navegador.
 */
export function obterStatusPermissao(): StatusPermissaoWeb {
  if (!suportaNotificacoesWeb()) return "unsupported";
  return Notification.permission;
}

/**
 * Solicita explicitamente permissão ao usuário para emitir notificações no navegador.
 * Deve ser invocado exclusivamente a partir de um gesto/clique do usuário.
 */
export async function solicitarPermissaoNotificacoes(): Promise<StatusPermissaoWeb> {
  if (!suportaNotificacoesWeb()) return "unsupported";

  try {
    const permissao = await Notification.requestPermission();
    if (permissao === "granted") {
      salvarPreferenciaNotificacao(true);
    }
    return permissao;
  } catch (erro) {
    console.error("Erro ao solicitar permissão de notificações:", erro);
    return Notification.permission;
  }
}

/**
 * Salva a preferência de ativação das notificações web no armazenamento local.
 */
export function salvarPreferenciaNotificacao(ativa: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHAVE_STORAGE_PREFERENCIA, JSON.stringify(ativa));
  } catch (e) {
    console.warn("Não foi possível salvar preferência de notificação:", e);
  }
}

/**
 * Retorna se o usuário marcou para receber notificações web.
 */
export function obterPreferenciaNotificacao(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const salvo = localStorage.getItem(CHAVE_STORAGE_PREFERENCIA);
    if (salvo !== null) return JSON.parse(salvo);
  } catch {
    // Silencioso
  }
  return false;
}

/**
 * Marca que o usuário dispensou o banner de convite para ativar notificações.
 */
export function dispensarConviteNotificacao(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHAVE_STORAGE_DISPENSADO, "true");
  } catch {
    // Silencioso
  }
}

/**
 * Verifica se o banner de convite para ativar notificações foi dispensado.
 */
export function conviteFoiDispensado(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(CHAVE_STORAGE_DISPENSADO) === "true";
  } catch {
    return false;
  }
}

export interface OpcoesNotificacaoNativa {
  body?: string;
  tag?: string;
  icone?: string;
  url?: string;
  aoClicar?: () => void;
}

/**
 * Emite uma notificação nativa no sistema operacional se a permissão estiver concedida.
 */
export async function dispararNotificacaoNativa(
  titulo: string,
  opcoes?: OpcoesNotificacaoNativa,
): Promise<boolean> {
  if (!suportaNotificacoesWeb()) return false;
  if (Notification.permission !== "granted") return false;

  try {
    const icone = opcoes?.icone || "/favicon.ico";
    const notif = new Notification(titulo, {
      body: opcoes?.body,
      tag: opcoes?.tag,
      icon: icone,
      badge: icone,
    });

    notif.onclick = () => {
      window.focus();
      if (opcoes?.aoClicar) {
        opcoes.aoClicar();
      } else if (opcoes?.url) {
        window.location.href = opcoes.url;
      }
      notif.close();
    };

    return true;
  } catch (erro) {
    console.error("Falha ao disparar notificação nativa:", erro);
    return false;
  }
}
