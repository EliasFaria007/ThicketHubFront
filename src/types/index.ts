export type Papel = "usuario" | "tecnico" | "admin" | "superusuario";

/**
 * Status do fluxo institucional conforme o back-end Java (normalizados para lowercase).
 * O back-end Java possui: ABERTO, EM_ATENDIMENTO, EM_ANDAMENTO, AGUARDANDO,
 *                         PAUSADO, RESOLVIDO, CONCLUIDO, FECHADO, CANCELADO.
 * O modo demo usa apenas o subconjunto: aguardando, em_andamento, pausado, resolvido, cancelado.
 */
export type StatusChamado =
  | "aberto"
  | "em_atendimento"
  | "em_andamento"
  | "aguardando"
  | "pausado"
  | "resolvido"
  | "concluido"
  | "fechado"
  | "cancelado";

export type PrioridadeChamado = "baixa" | "media" | "alta" | "critica";

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string | null;
  errors: string[] | null;
}

export interface Paginacao<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface User {
  id: number | string;
  nome: string;
  email: string;
  telefone?: string | null | undefined;
  localidade?: string | null | undefined;
  papel: Papel;
  setor: string;
  /** Setores que o técnico pode visualizar/atender (liberados pelo admin). */
  setoresLiberados: string[];
  /** Permissão de cadastro de usuários concedida ao técnico pelo admin. */
  podeCadastrarUsuarios?: boolean | undefined;
  ativo: boolean;
  criadoEm: string;
  criadoPorNome?: string | null | undefined;
  termosAceitosEm?: string | null | undefined;
  termosVersao?: string | null | undefined;
  primeiroAcessoConcluido?: boolean | undefined;
  senhaTemporaria?: string | null | undefined;
  assinatura?: string | null | undefined;
  incluirAssinaturaPadrao?: boolean | undefined;
}

/** Item do catálogo de serviços — criado e mantido apenas pelo superusuário. */
export interface Servico {
  id: string;
  nome: string;
  setor: string;
  prioridade: PrioridadeChamado;
  slaAtendimentoHoras: number;
  slaResolucaoHoras: number;
  ativo: boolean;
}

export interface SlaPrioridade {
  atendimentoHoras: number;
  resolucaoHoras: number;
}

export type SlaConfig = Record<PrioridadeChamado, SlaPrioridade>;

export interface Comentario {
  id: string;
  chamadoId: string;
  autor: Pick<User, "id" | "nome" | "papel">;
  mensagem: string;
  criadoEm: string;
  interno: boolean;
  anexos?: Anexo[];
}

export interface HistoricoItem {
  id: string;
  tipo:
    | "criacao"
    | "comentario"
    | "status"
    | "prioridade"
    | "encaminhamento"
    | "assuncao"
    | "devolucao"
    | "atendimento"
    | "reabertura"
    | "avaliacao";
  descricao: string;
  autorNome: string;
  criadoEm: string;
}

export interface Anexo {
  id: string;
  nome: string;
  tamanho: number;
  url: string;
}

export interface Chamado {
  id: string;
  protocolo: string;
  titulo: string;
  descricao: string;
  status: StatusChamado;
  prioridade: PrioridadeChamado;
  setor: string;
  servicoId: string;
  servicoNome: string;
  solicitante: Pick<User, "id" | "nome" | "email">;
  tecnico: Pick<User, "id" | "nome"> | null;
  /** Fila de destino quando o chamado não está assumido por um técnico. */
  filaSetor: string | null;
  criadoEm: string;
  atualizadoEm: string;
  /** Controle de concorrência otimista. */
  versao: number;
  slaAtendimentoHoras: number;
  slaResolucaoHoras: number;
  /** Tempo de SLA já consumido (ms), sem contar períodos pausados. */
  slaConsumidoMs: number;
  /** Momento em que o cronômetro voltou a contar; null = pausado. */
  slaRodandoDesde: string | null;
  primeiraRespostaEm: string | null;
  oQueFoiFeito: string | null;
  resolvidoEm: string | null;
  motivoReabertura: string | null;
  avaliacao: number | null;
  relacionados: string[];
  duplicadoDe: string | null;
  comentarios?: Comentario[];
  historico?: HistoricoItem[];
  anexos?: Anexo[];
}

export interface Metricas {
  // Campos retornados pelo back-end Java (MetricasResponse)
  totalChamados: number;
  abertos: number;
  emAndamento: number;
  resolvidos: number;
  fechados: number;
  cancelados: number;
  pausados: number;
  totalUsuarios: number;
  totalTecnicos: number;
  totalAdmins: number;
  percentualSlaAtendido: number;
  // Campos opcionais — sintetizados pelo adapter em services/chamados.ts
  atrasados?: number;
  porStatus?: { status: StatusChamado; total: number }[];
  porSetor?: { setor: string; total: number }[];
  ultimos7Dias?: { dia: string; total: number }[];
}

export interface FiltrosChamados {
  status?: StatusChamado | "";
  prioridade?: PrioridadeChamado | "";
  setor?: string;
  servicoId?: string;
  fila?: "geral" | "minha" | "resolvidos" | "";
  q?: string;
  page: number;
  limit: number;
  // "dataAbertura" é o nome do campo na entidade Java Chamado (Spring Data usa o nome do campo, não da coluna)
  ordenarPor?: "dataAbertura" | "prioridade" | "atualizadoEm";
  ordem?: "asc" | "desc";
}

export interface RegistroAuditoria {
  id: string;
  acao: string;
  detalhe: string;
  usuarioId: string;
  usuarioNome: string;
  ip: string;
  criadoEm: string;
}

/**
 * Resposta de login do back-end Java (AuthResponse).
 * O campo `accessToken` é mapeado para `token` no store de autenticação.
 */
export interface LoginResponse {
  /** JWT de acesso (curta duração — 15 min por padrão). */
  accessToken: string;
  refreshToken: string;
  id: number;
  nome: string;
  email: string;
  papel: Papel;
  setor: string;
  primeiroAcessoConcluido: boolean;
  setoresLiberados: string[];
  assinatura?: string | null | undefined;
  incluirAssinaturaPadrao?: boolean | undefined;
  termosVersao?: string | null | undefined;
  termosAceitosEm?: string | null | undefined;
}

/** Notificação interna exibida no sino da barra superior. */
export interface Notificacao {
  id: string;
  usuarioId: string;
  chamadoId: string;
  protocolo: string;
  evento:
    | "criacao"
    | "comentario"
    | "status"
    | "pausa"
    | "retomada"
    | "encaminhamento"
    | "assuncao"
    | "devolucao"
    | "resolucao"
    | "reabertura"
    | "avaliacao";
  titulo: string;
  lida: boolean;
  criadoEm: string;
}

export interface FiltrosRelatorio {
  de?: string;
  ate?: string;
  setor?: string;
  status?: StatusChamado | "";
  prioridade?: PrioridadeChamado | "";
  tecnicoId?: string;
  servicoId?: string;
}

export interface Relatorios {
  totalChamados: number;
  porSetor: { chave: string; total: number; resolvidos: number; atrasados: number }[];
  porStatus: { chave: string; total: number }[];
  porPrioridade: { chave: string; total: number; slaCumprido: number; slaTotal: number }[];
  porServico: { chave: string; total: number }[];
  tecnicos: {
    chave: string;
    atendidos: number;
    emAberto: number;
    tempoMedioResolucaoHoras: number;
    slaCumprido: number;
    slaTotal: number;
  }[];
  periodo: { resolvidos: number; cancelados: number; reabertos: number };
  tempos: { medioAtendimentoHoras: number; medioResolucaoHoras: number };
  usuarios: { cadastrados: number; ativos: number };
  satisfacao: { media: number; avaliacoes: number; distribuicao: { nota: number; total: number }[] };
  encaminhamentos: { protocolo: string; descricao: string; autorNome: string; criadoEm: string }[];
  evolucaoMensal?: { periodo: string; abertos: number; resolvidos: number }[];
  mapaCalor?: { diaSemana: number; hora: number; total: number }[];
  fcrTaxa?: number;
}

export interface ConfiguracaoGeral {
  justificativaNotaBaixaObrigatoria: boolean;
  alertaNotaBaixaAtivo: boolean;
  fechamentoInatividadeAtivo: boolean;
  diasInatividadeFechamento: number;
  webhookAtivo: boolean;
  webhookUrl: string;
  webhookNivelMinimo: "CRITICA" | "ALTA" | "TODAS" | string;
}

export const TERMOS_VERSAO = "1.0";

// ---------------------------------------------------------------------------
// Base de Conhecimento / FAQ
// ---------------------------------------------------------------------------

export interface ArtigoBaseConhecimento {
  id: string;
  titulo: string;
  slug: string;
  resumo: string;
  conteudo: string;
  setor: string;
  categoria: string;
  tags: string[];
  utilSim: number;
  utilNao: number;
  autorNome: string;
  anexoPdfNome?: string | undefined;
  anexoPdfTamanho?: number | undefined;
  anexoPdfBase64?: string | undefined;
  criadoEm: string;
  atualizadoEm: string;
}

export interface FiltrosBaseConhecimento {
  busca?: string | undefined;
  setor?: string | undefined;
  categoria?: string | undefined;
}

// ---------------------------------------------------------------------------
// Integração Corporativa LDAP / Active Directory
// ---------------------------------------------------------------------------

export interface ConfiguracaoLdap {
  ativo: boolean;
  servidor: string;
  porta: number;
  usarSsl: boolean;
  baseDn: string;
  dominio: string;
  usuarioBind: string;
  senhaBind?: string;
  filtroUsuario: string;
  grupoTecnico: string;
  grupoAdmin: string;
  grupoSuper: string;
  sincronizacaoAutomatica: boolean;
  intervaloMinutos: number;
  ultimaSincronizacaoEm?: string;
  totalUsuariosSincronizados?: number;
}

export interface ResultadoTesteLdap {
  sucesso: boolean;
  mensagem: string;
  tempoRespostaMs: number;
  detalhes?: {
    servidorAcessivel: boolean;
    bindAutenticado: boolean;
    usuariosEncontrados: number;
  };
}

// ---------------------------------------------------------------------------
// Integração de E-mail (SMTP & Mail-to-Ticket)
// ---------------------------------------------------------------------------

export interface ConfiguracaoEmail {
  ativo: boolean;
  servidorSmtp: string;
  portaSmtp: number;
  usarTls: boolean;
  usuarioSmtp: string;
  senhaSmtp?: string;
  remetenteNome: string;
  remetenteEmail: string;
  mailToTicketAtivo: boolean;
  servidorImap?: string;
  portaImap?: number;
  usuarioImap?: string;
  senhaImap?: string;
  setorPadrao?: string;
}

export interface ResultadoTesteEmail {
  sucesso: boolean;
  mensagem: string;
}