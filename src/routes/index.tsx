import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock, PlusCircle, Ticket } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { MensagemErro } from "@/components/comum/MensagemErro";
import { SkeletonKpis } from "@/components/comum/Skeletons";
import { AppLayout } from "@/components/layout/AppLayout";
import { RotaProtegida } from "@/components/layout/RotaProtegida";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL } from "@/lib/dominio";
import { obterMetricas } from "@/services/chamados";
import { useAuthStore } from "@/stores/auth";
import type { StatusChamado } from "@/types";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Painel de chamados — Central de Chamados" },
      {
        name: "description",
        content:
          "Acompanhe indicadores de chamados abertos, em andamento, resolvidos e atrasados da sua instituição.",
      },
      { property: "og:title", content: "Painel de chamados — Central de Chamados" },
      {
        property: "og:description",
        content: "Indicadores em tempo real do atendimento interno de chamados.",
      },
    ],
  }),
  component: () => (
    <RotaProtegida>
      <DashboardPage />
    </RotaProtegida>
  ),
});

/** Cada status ganha a própria cor semântica nas barras do painel. */
const COR_STATUS: Record<StatusChamado, string> = {
  aberto:         "var(--color-chart-3)",
  em_atendimento: "var(--color-chart-2)",
  em_andamento:   "var(--color-chart-2)",
  aguardando:     "var(--color-chart-3)",
  pausado:        "var(--color-chart-5)",
  resolvido:      "var(--color-chart-1)",
  concluido:      "var(--color-chart-1)",
  fechado:        "var(--color-chart-1)",
  cancelado:      "var(--color-chart-4)",
};

function DashboardPage() {
  const nome = useAuthStore((s) => s.user?.nome ?? "");
  const primeiroNome = nome.split(" ")[0] ?? "";

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["metricas"],
    queryFn: obterMetricas,
    staleTime: 60_000,
  });

  return (
    <AppLayout
      titulo={`Olá, ${primeiroNome || "servidor"}`}
      descricao="Panorama do atendimento de chamados da instituição"
      acoes={
        <Button asChild size="sm">
          <Link to="/chamados/novo">
            <PlusCircle className="size-4" /> Abrir chamado
          </Link>
        </Button>
      }
    >
      {isError ? (
        <MensagemErro erro={error} />
      ) : isPending ? (
        <SkeletonKpis />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi titulo="Aguardando atendimento" valor={data.abertos ?? 0} icone={Ticket} tom="secondary" />
            <Kpi titulo="Em andamento" valor={data.emAndamento ?? 0} icone={Clock} tom="warning" />
            <Kpi titulo="Resolvidos" valor={data.resolvidos ?? 0} icone={CheckCircle2} tom="success" />
            <Kpi titulo="Atrasados" valor={data.atrasados ?? 0} icone={AlertTriangle} tom="destructive" />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <section className="surface-card p-5 lg:col-span-3">
              <h2 className="text-base font-semibold text-foreground">Chamados por status</h2>
              <p className="text-sm text-muted-foreground">Distribuição atual da fila de atendimento</p>
              <div className="mt-5 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(data.porStatus ?? []).map((s) => ({ ...s, label: STATUS_LABEL[s.status] }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "8px",
                        fontSize: 13,
                      }}
                      formatter={(valor: number) => [`${valor} chamados`, "Total"]}
                    />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {(data.porStatus ?? []).map((s) => (
                        <Cell key={s.status} fill={COR_STATUS[s.status]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="surface-card p-5 lg:col-span-2">
              <h2 className="text-base font-semibold text-foreground">Volume por setor</h2>
              <p className="text-sm text-muted-foreground">Setores que mais demandam atendimento</p>
              {(data.porSetor ?? []).length === 0 ? (
                <p className="mt-5 text-sm text-muted-foreground">
                  Nenhum chamado registrado nos setores visíveis para o seu perfil.
                </p>
              ) : (
              <ul className="mt-5 space-y-4">
                {(data.porSetor ?? []).map((item) => {
                  return (
                    <li key={item.setor}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">{item.setor}</span>
                        <span className="text-muted-foreground">{item.total}</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(item.total / Math.max(...(data.porSetor ?? []).map((s) => s.total), 1)) * 100}%`,
                            backgroundColor: "var(--color-chart-2)",
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

const TONS = {
  secondary: "bg-secondary/12 text-secondary",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
  destructive: "bg-destructive-soft text-destructive",
} as const;

function Kpi({
  titulo,
  valor,
  icone: Icone,
  tom,
}: {
  titulo: string;
  valor: number;
  icone: typeof Ticket;
  tom: keyof typeof TONS;
}) {
  return (
    <article className="surface-card p-5 transition-soft hover:shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{titulo}</p>
        <span className={`grid size-9 place-items-center rounded-lg ${TONS[tom]}`} aria-hidden>
          <Icone className="size-4.5" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums text-foreground">{valor}</p>
    </article>
  );
}
