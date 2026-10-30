import { PRIORIDADE_LABEL, STATUS_LABEL } from "./dominio";
import { extrairTextoEImagemAssinatura } from "./assinatura";
import { extrairRegistrosAtendimento, type RegistroAtendimentoItem } from "./registros-atendimento";
import { resumoSla } from "./sla";
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

  // Assinatura digital do técnico (procura no campo geral ou nos registros individuais)
  const assExtraida = extrairTextoEImagemAssinatura(chamado.oQueFoiFeito);
  let assinaturaImagem = assExtraida.imagem ?? undefined;
  if (!assinaturaImagem && registros.length > 0) {
    for (const r of registros) {
      const assReg = extrairTextoEImagemAssinatura(r.conteudo);
      if (assReg.imagem) {
        assinaturaImagem = assReg.imagem;
        break;
      }
    }
  }
  const temAssinaturaDigital = Boolean(assinaturaImagem);

  // Status SLA compatível com o motor de SLA do front e backend
  const sla = resumoSla(chamado);
  let slaStatus = "Dentro do prazo";
  const resolvido = chamado.status === "resolvido" || (chamado.status as string) === "concluido" || (chamado.status as string) === "fechado";

  if (resolvido) {
    slaStatus = sla.situacao === "atrasado" || (chamado as any).slaViolado ? "Resolvido fora do prazo" : "Cumprido no prazo";
  } else if (sla.situacao === "atrasado" || (chamado as any).slaViolado) {
    slaStatus = "Prazo violado (Atrasado)";
  } else if (sla.situacao === "atencao") {
    slaStatus = "Atenção (80% do tempo consumido)";
  }

  // Solicitante e Técnico (compatível com Chamado adaptado e ChamadoDetalheResponse bruto do backend)
  const solicitanteNome =
    chamado.solicitante?.nome || (chamado as any).solicitanteNome || "Solicitante não identificado";
  const solicitanteEmail = chamado.solicitante?.email || (chamado as any).solicitanteEmail;
  const tecnicoNome = chamado.tecnico?.nome || (chamado as any).tecnicoNome || "Não atribuído";
  const tecnicoEmail = (chamado.tecnico as any)?.email || (chamado as any).tecnicoEmail;
  const prazoLimite = (chamado as any).prazoLimite || (chamado as any).prazoSla;

  return {
    protocolo: chamado.protocolo,
    titulo: chamado.titulo,
    descricaoLimpa: descLimpa || chamado.descricao || "",
    solicitanteNome,
    solicitanteEmail,
    solicitanteSetor: chamado.setor,
    tecnicoNome,
    tecnicoEmail,
    servicoNome: chamado.servicoNome || "Serviço geral",
    setor: chamado.setor,
    statusFormatado: STATUS_LABEL[chamado.status as StatusChamado] || chamado.status,
    prioridadeFormatada: PRIORIDADE_LABEL[chamado.prioridade as PrioridadeChamado] || chamado.prioridade,
    criadoEmFormatado: formatarData(chamado.criadoEm || (chamado as any).dataAbertura),
    ...(chamado.resolvidoEm ? { resolvidoEmFormatado: formatarData(chamado.resolvidoEm) } : {}),
    ...(prazoLimite ? { prazoSlaFormatado: formatarData(prazoLimite) } : {}),
    slaStatus,
    anexos: anexosUnicos,
    registrosAtendimento: registros,
    temAssinaturaDigital,
    ...(assinaturaImagem ? { assinaturaImagem } : {}),
    ...(usuarioLogado?.nome ? { emitidoPor: `${usuarioLogado.nome} (${usuarioLogado.papel || "Operador"})` } : {}),
    emitidoEmFormatado: agora.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}
