import type { Chamado, PrioridadeChamado, StatusChamado } from "@/types";

export type SituacaoSla = "ok" | "atencao" | "atrasado" | "encerrado";

export const HORA_MS = 60 * 60 * 1000;

/** Prazos de resolução padrão por prioridade quando não definidos no serviço/chamado. */
const SLA_PADRAO_HORAS: Record<PrioridadeChamado, { atendimento: number; resolucao: number }> = {
  critica: { atendimento: 1, resolucao: 4 },
  alta: { atendimento: 2, resolucao: 8 },
  media: { atendimento: 4, resolucao: 24 },
  baixa: { atendimento: 8, resolucao: 48 },
};

/** Status em que o cronômetro do SLA fica pausado ou concluído. */
export function slaPausadoNoStatus(status: StatusChamado | string): boolean {
  const s = String(status).toLowerCase();
  return (
    s === "aguardando" ||
    s === "pausado" ||
    s === "resolvido" ||
    s === "concluido" ||
    s === "fechado" ||
    s === "cancelado"
  );
}

export type ChamadoSlaLike = {
  status: StatusChamado | string;
  prioridade?: PrioridadeChamado | string | null;
  slaConsumidoMs?: number | null;
  slaRodandoDesde?: string | null;
  slaResolucaoHoras?: number | null;
  slaAtendimentoHoras?: number | null;
  prazoLimite?: string | null;
  criadoEm?: string | null;
  dataAbertura?: string | null;
};

/** Tempo de SLA consumido até agora em milissegundos, ignorando períodos pausados. */
export function consumidoMs(
  chamado: Pick<ChamadoSlaLike, "slaConsumidoMs" | "slaRodandoDesde"> & Partial<Pick<ChamadoSlaLike, "status" | "criadoEm" | "dataAbertura">>,
  agora = Date.now(),
): number {
  const consumidoBase = Number(chamado.slaConsumidoMs) || 0;
  const statusPausado = chamado.status ? slaPausadoNoStatus(chamado.status) : false;

  if (statusPausado) {
    return consumidoBase;
  }

  if (chamado.slaRodandoDesde) {
    const inicio = new Date(chamado.slaRodandoDesde).getTime();
    if (!Number.isNaN(inicio)) {
      return consumidoBase + Math.max(0, agora - inicio);
    }
  }

  // Se não tem slaRodandoDesde mas o chamado está ativo, calcula desde a abertura
  if (chamado.status && !statusPausado) {
    const dataInicioStr = chamado.criadoEm || chamado.dataAbertura;
    if (dataInicioStr) {
      const dataInicio = new Date(dataInicioStr).getTime();
      if (!Number.isNaN(dataInicio)) {
        return Math.max(consumidoBase, agora - dataInicio);
      }
    }
  }

  return consumidoBase;
}

export interface ResumoSla {
  situacao: SituacaoSla;
  percentual: number;
  consumidoHoras: number;
  restanteHoras: number;
  atrasoHoras: number;
  pausado: boolean;
  limiteHoras: number;
  prazoLimiteDate: Date | null;
}

export function resumoSla(
  chamado: ChamadoSlaLike,
  agora = Date.now(),
): ResumoSla {
  const status = String(chamado.status || "aberto").toLowerCase() as StatusChamado;
  const prioridade = (String(chamado.prioridade || "media").toLowerCase() as PrioridadeChamado) || "media";
  const padrao = SLA_PADRAO_HORAS[prioridade] ?? SLA_PADRAO_HORAS.media;

  // 1. Determina o limite de resolução em horas
  let limiteHoras = Number(chamado.slaResolucaoHoras);
  const dataCriacaoStr = chamado.criadoEm || chamado.dataAbertura;
  const dataCriacao = dataCriacaoStr ? new Date(dataCriacaoStr).getTime() : NaN;
  const prazoLimiteTs = chamado.prazoLimite ? new Date(chamado.prazoLimite).getTime() : NaN;

  if (!limiteHoras || limiteHoras <= 0 || Number.isNaN(limiteHoras)) {
    // Tenta calcular pela diferença entre prazoLimite e dataCriacao
    if (!Number.isNaN(prazoLimiteTs) && !Number.isNaN(dataCriacao) && prazoLimiteTs > dataCriacao) {
      limiteHoras = Math.round((prazoLimiteTs - dataCriacao) / HORA_MS);
    } else {
      limiteHoras = padrao.resolucao;
    }
  }

  const limiteMs = Math.max(HORA_MS, limiteHoras * HORA_MS);

  // 2. Determina o tempo consumido
  const consumido = consumidoMs(chamado, agora);
  const pausado = chamado.slaRodandoDesde === null || slaPausadoNoStatus(status);

  // 3. Situação e percentual
  let situacao: SituacaoSla;
  let restanteHoras = 0;
  let atrasoHoras = 0;

  if (status === "resolvido" || status === "cancelado" || status === "concluido" || status === "fechado") {
    situacao = "encerrado";
  } else if (consumido > limiteMs || (!Number.isNaN(prazoLimiteTs) && agora > prazoLimiteTs && !pausado)) {
    situacao = "atrasado";
    atrasoHoras = Math.max(0, (consumido - limiteMs) / HORA_MS);
    if (!Number.isNaN(prazoLimiteTs) && agora > prazoLimiteTs) {
      atrasoHoras = Math.max(atrasoHoras, (agora - prazoLimiteTs) / HORA_MS);
    }
  } else {
    restanteHoras = Math.max(0, (limiteMs - consumido) / HORA_MS);
    if (!Number.isNaN(prazoLimiteTs) && prazoLimiteTs > agora) {
      restanteHoras = Math.min(restanteHoras, (prazoLimiteTs - agora) / HORA_MS);
    }
    const pctCalculado = Math.round((consumido / limiteMs) * 100);
    situacao = pctCalculado >= 80 ? "atencao" : "ok";
  }

  const percentual = limiteMs > 0 ? Math.min(999, Math.round((consumido / limiteMs) * 100)) : 0;

  return {
    situacao,
    percentual,
    consumidoHoras: Math.max(0, consumido / HORA_MS),
    restanteHoras,
    atrasoHoras,
    pausado: Boolean(pausado && situacao !== "encerrado"),
    limiteHoras,
    prazoLimiteDate: !Number.isNaN(prazoLimiteTs) ? new Date(prazoLimiteTs) : null,
  };
}

export function slaAtrasado(chamado: ChamadoSlaLike): boolean {
  return resumoSla(chamado).situacao === "atrasado";
}

/**
 * Formata duração em horas em texto legível para interface:
 * - Menos de 1h: "45 min"
 * - Entre 1h e 24h: "1h", "2h 30min", etc.
 * - 24h ou mais: "1 dia", "2 dias", "3 dias 6h", etc.
 */
export function horasLegivel(horas: number): string {
  if (horas === undefined || horas === null || Number.isNaN(horas) || horas <= 0) {
    return "0 min";
  }
  if (horas < 1) {
    return `${Math.max(1, Math.round(horas * 60))} min`;
  }
  if (horas < 24) {
    const h = Math.floor(horas);
    const m = Math.round((horas - h) * 60);
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  }
  const dias = Math.floor(horas / 24);
  const hRest = Math.round(horas % 24);
  if (hRest === 0) {
    return `${dias} dia${dias > 1 ? "s" : ""}`;
  }
  return `${dias}d ${hRest}h`;
}
