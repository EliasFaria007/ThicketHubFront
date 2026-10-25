import { PRIORIDADE_LABEL, STATUS_LABEL } from "./dominio";
import { extrairTextoEImagemAssinatura } from "./assinatura";
import { extrairRegistrosAtendimento, type RegistroAtendimentoItem } from "./registros-atendimento";
import { extrairAnexosEOQueFoiFeito } from "@/services/chamados";
import type { Anexo, Chamado, PrioridadeChamado, Relatorios, StatusChamado } from "@/types";

export interface MetricasExecutivas {
  totalChamados: number;
  totalResolvidos: number;
  totalCancelados: number;
  totalReabertos: number;
  taxaResolucaoPercentual: number;
  cumprimentoSlaPercentual: number;
  tempoMedioAtendimentoFormatado: string;
  tempoMedioResolucaoFormatado: string;
  satisfacaoMedia: number;
  totalAvaliacoes: number;
  percentualSatisfeitos: number;
}

export interface DadosOrdemServico {
  protocolo: string;
  titulo: string;
  descricaoLimpa: string;
  solicitanteNome: string;
  solicitanteEmail?: string;
  solicitanteSetor?: string;
  tecnicoNome: string;
  tecnicoEmail?: string;
  servicoNome: string;
  setor: string;
  statusFormatado: string;
  prioridadeFormatada: string;
  criadoEmFormatado: string;
  resolvidoEmFormatado?: string;
  prazoSlaFormatado?: string;
  slaStatus: string;
  anexos: Anexo[];
  registrosAtendimento: RegistroAtendimentoItem[];
  temAssinaturaDigital: boolean;
  assinaturaImagem?: string;
  emitidoPor?: string;
  emitidoEmFormatado: string;
}

/**
 * Converte horas fracionadas (ex: 1.5) para formato amigável (ex: "1h 30min" ou "45min").
 */
export function formatarHorasLegivel(horas: number): string {
  if (!horas || horas <= 0) return "0min";
  const minutosTotais = Math.round(horas * 60);
  const h = Math.floor(minutosTotais / 60);
  const m = minutosTotais % 60;

  if (h === 0) return `${m}min`;
  return `${h}h ${String(m).padStart(2, "0")}min`;
}

/**
 * Calcula os indicadores e KPIs consolidados para o Relatório Executivo.
 */
export function calcularMetricasExecutivas(r: Relatorios): MetricasExecutivas {
  const total = r.totalChamados || 0;
  const resolvidos = r.periodo?.resolvidos ?? 0;
  const taxaResolucao = total > 0 ? Math.round((resolvidos / total) * 100) : 0;

  // Cálculo ponderado de cumprimento de SLA por prioridade ou técnicos
  let slaTotalGeral = 0;
  let slaCumpridoGeral = 0;
  if (r.porPrioridade && r.porPrioridade.length > 0) {
    for (const p of r.porPrioridade) {
      slaTotalGeral += p.slaTotal || 0;
      slaCumpridoGeral += p.slaCumprido || 0;
    }
  } else if (r.tecnicos && r.tecnicos.length > 0) {
    for (const t of r.tecnicos) {
      slaTotalGeral += t.slaTotal || 0;
      slaCumpridoGeral += t.slaCumprido || 0;
    }
  }

  const cumprimentoSlaPercentual =
    slaTotalGeral > 0 ? Math.round((slaCumpridoGeral / slaTotalGeral) * 100) : 100;

  // Avaliações de satisfação
  const totalAvaliacoes = r.satisfacao?.avaliacoes || 0;
  let avaliacoesPositivas = 0;
  if (r.satisfacao?.distribuicao) {
    for (const d of r.satisfacao.distribuicao) {
      if (d.nota >= 4) {
        avaliacoesPositivas += d.total || 0;
      }
    }
  }
  const percentualSatisfeitos =
    totalAvaliacoes > 0 ? Math.round((avaliacoesPositivas / totalAvaliacoes) * 100) : 100;

  return {
    totalChamados: total,
    totalResolvidos: resolvidos,
    totalCancelados: r.periodo?.cancelados ?? 0,
    totalReabertos: r.periodo?.reabertos ?? 0,
    taxaResolucaoPercentual: taxaResolucao,
    cumprimentoSlaPercentual,
    tempoMedioAtendimentoFormatado: formatarHorasLegivel(r.tempos?.medioAtendimentoHoras ?? 0),
    tempoMedioResolucaoFormatado: formatarHorasLegivel(r.tempos?.medioResolucaoHoras ?? 0),
    satisfacaoMedia: r.satisfacao?.media ?? 5,
    totalAvaliacoes,
    percentualSatisfeitos,
  };
}

/**
 * Prepara e estrutura todos os dados para visualização e impressão da Ordem de Serviço (O.S.).
 */
export function obterDadosOrdemServico(
  chamado: Chamado,
  usuarioLogado?: { nome?: string; papel?: string },
): DadosOrdemServico {
  const agora = new Date();
  const formatarData = (d?: string | null) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return d;
    }
  };

  // Anexos de ambos os campos + chamados.anexos
  const { oQueFoiFeito: descLimpa, anexos: anexosDescricao } = extrairAnexosEOQueFoiFeito(chamado.descricao);
  const { anexos: anexosAtendimento } = extrairAnexosEOQueFoiFeito(chamado.oQueFoiFeito);
  const anexosDiretos = Array.isArray(chamado.anexos) ? chamado.anexos : [];
  const todosAnexos = [...anexosDiretos, ...anexosDescricao, ...anexosAtendimento];

  // Remove duplicados de anexos por url ou id
  const anexosUnicos = todosAnexos.filter(
    (a, idx, arr) => arr.findIndex((x) => (x.id && x.id === a.id) || (x.url && x.url === a.url)) === idx,
  );

  // Registros de atendimento
  const registros = extrairRegistrosAtendimento(chamado.oQueFoiFeito);

  // Assinatura digital do técnico (procura nos registros ou campo oQueFoiFeito)
  const assExtraida = extrairTextoEImagemAssinatura(chamado.oQueFoiFeito);
  const temAssinaturaDigital = Boolean(assExtraida.imagem);

  // Status SLA
  let slaStatus = "Dentro do prazo";
  if (chamado.status === "resolvido" || chamado.status === "concluido" || chamado.status === "fechado") {
    slaStatus = chamado.slaViolado ? "Resolvido fora do prazo" : "Cumprido no prazo";
  } else if (chamado.slaViolado) {
    slaStatus = "Prazo violado (Atrasado)";
  }

  return {
    protocolo: chamado.protocolo,
    titulo: chamado.titulo,
    descricaoLimpa: descLimpa || chamado.descricao || "",
    solicitanteNome: chamado.solicitanteNome || "Solicitante não identificado",
    solicitanteEmail: chamado.solicitanteEmail,
    solicitanteSetor: chamado.setor,
    tecnicoNome: chamado.tecnicoNome || "Não atribuído",
    tecnicoEmail: chamado.tecnicoEmail,
    servicoNome: chamado.servicoNome || "Serviço geral",
    setor: chamado.setor,
    statusFormatado: STATUS_LABEL[chamado.status as StatusChamado] || chamado.status,
    prioridadeFormatada: PRIORIDADE_LABEL[chamado.prioridade as PrioridadeChamado] || chamado.prioridade,
    criadoEmFormatado: formatarData(chamado.criadoEm),
    resolvidoEmFormatado: chamado.resolvidoEm ? formatarData(chamado.resolvidoEm) : undefined,
    prazoSlaFormatado: chamado.prazoSla ? formatarData(chamado.prazoSla) : undefined,
    slaStatus,
    anexos: anexosUnicos,
    registrosAtendimento: registros,
    temAssinaturaDigital,
    assinaturaImagem: assExtraida.imagem ?? undefined,
    emitidoPor: usuarioLogado?.nome ? `${usuarioLogado.nome} (${usuarioLogado.papel || "Operador"})` : undefined,
    emitidoEmFormatado: agora.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}
