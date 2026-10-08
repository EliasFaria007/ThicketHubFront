import type { Chamado, StatusChamado } from "@/types";

export type SituacaoSla = "ok" | "atencao" | "atrasado" | "encerrado";

const HORA_MS = 60 * 60 * 1000;

/** Status em que o cronômetro do SLA fica pausado. */
export function slaPausadoNoStatus(status: StatusChamado): boolean {
  return status === "aguardando" || status === "pausado" || status === "resolvido" || status === "cancelado";
}

/** Tempo de SLA consumido até agora, ignorando os períodos pausados. */
export function consumidoMs(chamado: Pick<Chamado, "slaConsumidoMs" | "slaRodandoDesde">, agora = Date.now()): number {
  const emCurso = chamado.slaRodandoDesde ? Math.max(0, agora - new Date(chamado.slaRodandoDesde).getTime()) : 0;
  return chamado.slaConsumidoMs + emCurso;
}

export interface ResumoSla {
  situacao: SituacaoSla;
  percentual: number;
  consumidoHoras: number;
  restanteHoras: number;
  pausado: boolean;
  limiteHoras: number;
}

export function resumoSla(
  chamado: Pick<
    Chamado,
    "slaConsumidoMs" | "slaRodandoDesde" | "slaResolucaoHoras" | "status"
  >,
  agora = Date.now(),
): ResumoSla {
  const limiteMs = chamado.slaResolucaoHoras * HORA_MS;
  const consumido = consumidoMs(chamado, agora);
  const percentual = limiteMs > 0 ? Math.min(999, Math.round((consumido / limiteMs) * 100)) : 0;
  const pausado = chamado.slaRodandoDesde === null;

  let situacao: SituacaoSla;
  if (chamado.status === "resolvido" || chamado.status === "cancelado") situacao = "encerrado";
  else if (consumido > limiteMs) situacao = "atrasado";
  else if (percentual >= 80) situacao = "atencao";
  else situacao = "ok";

  return {
    situacao,
    percentual,
    consumidoHoras: consumido / HORA_MS,
    restanteHoras: Math.max(0, (limiteMs - consumido) / HORA_MS),
    pausado,
    limiteHoras: chamado.slaResolucaoHoras,
  };
}

export function slaAtrasado(chamado: Parameters<typeof resumoSla>[0]): boolean {
  return resumoSla(chamado).situacao === "atrasado";
}

export function horasLegivel(horas: number): string {
  if (horas < 1) return `${Math.max(1, Math.round(horas * 60))} min`;
  if (horas < 48) return `${horas.toFixed(horas % 1 === 0 ? 0 : 1)}h`;
  return `${Math.round(horas / 24)} dias`;
}
