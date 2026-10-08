/**
 * Sistema de Logging e Rastreamento de Erros do Front-End (ThicketHubFront).
 *
 * Captura, formata e armazena os erros de requisições HTTP, runtime e validações,
 * facilitando o diagnóstico durante a integração com o back-end Java.
 */

export interface RegistroErroFront {
  timestamp: string;
  origem: "HTTP" | "RUNTIME" | "VALIDACAO" | "AUTH";
  mensagem: string;
  detalhes?: unknown;
  statusHttp?: number | undefined;
  url?: string | undefined;
  metodo?: string | undefined;
  stack?: string | undefined;
}

const BUFFER_MAX_ERROS = 50;
const historicoErros: RegistroErroFront[] = [];

/**
 * Registra um erro de forma estruturada no console e na memória.
 */
export function logErroFront(erro: {
  origem: RegistroErroFront["origem"];
  mensagem: string;
  detalhes?: unknown;
  statusHttp?: number | undefined;
  url?: string | undefined;
  metodo?: string | undefined;
  erroOriginal?: unknown;
}) {
  const timestamp = new Date().toISOString();
  const stack = erro.erroOriginal instanceof Error ? erro.erroOriginal.stack : undefined;

  const registro: RegistroErroFront = {
    timestamp,
    origem: erro.origem,
    mensagem: erro.mensagem,
    detalhes: erro.detalhes,
    statusHttp: erro.statusHttp,
    url: erro.url,
    metodo: erro.metodo,
    stack,
  };

  historicoErros.unshift(registro);
  if (historicoErros.length > BUFFER_MAX_ERROS) {
    historicoErros.pop();
  }

  // Estilização no console do navegador
  if (typeof console !== "undefined") {
    const estiloTag = "background: #dc2626; color: white; font-weight: bold; padding: 2px 6px; border-radius: 4px;";
    const estiloUrl = "color: #3b82f6; font-weight: bold;";
    const estiloStatus = erro.statusHttp && erro.statusHttp >= 500 ? "color: #ef4444; font-weight: bold;" : "color: #f59e0b; font-weight: bold;";

    console.groupCollapsed(
      `%c[ERRO FRONT-END - ${erro.origem}]%c ${erro.mensagem} ${erro.url ? `%c[${erro.metodo ?? "GET"} ${erro.url}]` : ""} ${erro.statusHttp ? `%c(Status ${erro.statusHttp})` : ""}`,
      estiloTag,
      "color: inherit; font-weight: bold;",
      estiloUrl,
      estiloStatus,
    );
    console.error("Mensagem:", erro.mensagem);
    if (erro.statusHttp) console.error("HTTP Status:", erro.statusHttp);
    if (erro.url) console.error("URL:", erro.url);
    if (erro.detalhes) console.error("Detalhes:", erro.detalhes);
    if (stack) console.error("Stack Trace:", stack);
    if (erro.erroOriginal) console.error("Objeto do Erro:", erro.erroOriginal);
    console.groupEnd();
  }
}

/**
 * Disponibiliza no objeto global `window` para inspeção rápida pelo DevTools.
 */
if (typeof window !== "undefined") {
  (window as unknown as { __LOGS_ERRO_FRONTEND__: typeof historicoErros }).__LOGS_ERRO_FRONTEND__ = historicoErros;
}

export function obterHistoricoErros(): readonly RegistroErroFront[] {
  return historicoErros;
}
