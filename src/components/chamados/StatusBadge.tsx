import {
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  Clock,
  Inbox,
  PauseCircle,
  PlayCircle,
  Timer,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

import { PRIORIDADE_LABEL, STATUS_LABEL } from "@/lib/dominio";
import { horasLegivel, resumoSla, type ChamadoSlaLike } from "@/lib/sla";
import { cn } from "@/lib/utils";
import type { PrioridadeChamado, StatusChamado } from "@/types";

const STATUS_ESTILO: Record<StatusChamado, string> = {
  aberto: "bg-secondary/12 text-secondary border-secondary/25",
  em_atendimento: "bg-accent-soft text-warning border-warning/30",
  em_andamento: "bg-accent-soft text-warning border-warning/30",
  aguardando: "bg-secondary/12 text-secondary border-secondary/25",
  pausado: "bg-muted text-muted-foreground border-border",
  resolvido: "bg-success-soft text-success border-success/30",
  concluido: "bg-success-soft text-success border-success/30",
  fechado: "bg-success-soft text-success border-success/30",
  cancelado: "bg-destructive-soft text-destructive border-destructive/30",
};

const STATUS_ICONE: Record<StatusChamado, typeof Clock> = {
  aberto: Inbox,
  em_atendimento: PlayCircle,
  em_andamento: PlayCircle,
  aguardando: Clock,
  pausado: PauseCircle,
  resolvido: CheckCircle2,
  concluido: CheckCircle2,
  fechado: CheckCircle,
  cancelado: XCircle,
};

export function StatusBadge({ status, className }: { status: StatusChamado; className?: string }) {
  const Icone = STATUS_ICONE[status] ?? Clock;
  const estilo = STATUS_ESTILO[status] ?? "bg-muted text-muted-foreground border-border";
  const label = STATUS_LABEL[status] ?? status;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
        estilo,
        className,
      )}
    >
      <Icone aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}

const PRIORIDADE_ESTILO: Record<PrioridadeChamado, string> = {
  baixa: "bg-muted text-muted-foreground border-border",
  media: "bg-primary-soft text-primary border-primary/25",
  alta: "bg-warning-soft text-warning border-warning/30",
  critica: "bg-destructive-soft text-destructive border-destructive/35",
};

export function PrioridadeBadge({
  prioridade,
  className,
}: {
  prioridade: PrioridadeChamado;
  className?: string;
}) {
  const estilo = PRIORIDADE_ESTILO[prioridade] ?? "bg-muted text-muted-foreground border-border";
  const label = PRIORIDADE_LABEL[prioridade] ?? prioridade;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
        estilo,
        className,
      )}
    >
      {(prioridade === "alta" || prioridade === "critica") && <AlertTriangle aria-hidden className="size-3.5" />}
      {label}
    </span>
  );
}

export type ChamadoSla = ChamadoSlaLike;

/** Situação do SLA considerando a regra de pausa (aguardando/pausado não consomem prazo). */
export function SlaBadge({ chamado, className }: { chamado: ChamadoSla; className?: string }) {
  const [agora, setAgora] = useState(() => Date.now());

  // Atualiza a cada 30 segundos para contagem viva em tempo real
  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const sla = resumoSla(chamado, agora);

  if (sla.situacao === "encerrado") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground",
          className,
        )}
      >
        <Timer aria-hidden className="size-3.5" /> SLA encerrado
      </span>
    );
  }

  const estilo =
    sla.situacao === "atrasado"
      ? "bg-destructive-soft text-destructive border-destructive/35 font-medium"
      : sla.situacao === "atencao"
        ? "bg-warning-soft text-warning border-warning/30 font-medium"
        : "bg-success-soft text-success border-success/30 font-medium";

  let texto: string;
  if (sla.situacao === "atrasado") {
    texto = `SLA atrasado · +${horasLegivel(sla.atrasoHoras)}`;
  } else {
    texto = `SLA ${sla.percentual}% · restam ${horasLegivel(sla.restanteHoras)}`;
  }

  const tooltipInfo = [
    `Prazo de resolução: ${horasLegivel(sla.limiteHoras)}`,
    `Consumido: ${horasLegivel(sla.consumidoHoras)} (${sla.percentual}%)`,
    sla.prazoLimiteDate
      ? `Limite: ${sla.prazoLimiteDate.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
      : null,
    sla.pausado ? "Cronômetro pausado" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold tabular-nums",
        estilo,
        className,
      )}
      title={tooltipInfo}
    >
      {sla.pausado ? <PauseCircle aria-hidden className="size-3.5" /> : <Timer aria-hidden className="size-3.5" />}
      {texto}
      {sla.pausado && sla.situacao !== "atrasado" ? " (pausado)" : ""}
    </span>
  );
}
