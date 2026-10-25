import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Clock,
  Download,
  FileText,
  LayoutGrid,
  PieChart as PieChartIcon,
  Printer,
  Star,
  Table as TableIcon,
  TrendingUp,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { MensagemErro } from "@/components/comum/MensagemErro";
import { SkeletonTabela } from "@/components/comum/Skeletons";
import { AppLayout } from "@/components/layout/AppLayout";
import { RotaProtegida } from "@/components/layout/RotaProtegida";
import { ModalRelatorioExecutivo } from "@/components/relatorios/ModalRelatorioExecutivo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRIORIDADE_LABEL, SETORES, STATUS_LABEL, STATUS_OPCOES, PRIORIDADE_OPCOES } from "@/lib/dominio";
import { dataHora } from "@/lib/format";
import { listarServicos } from "@/services/catalogo";
import { obterRelatorios } from "@/services/relatorios";
import { listarUsuarios } from "@/services/usuarios";
import { useAuthStore } from "@/stores/auth";
import type { FiltrosRelatorio, PrioridadeChamado, Relatorios, StatusChamado } from "@/types";

export const Route = createFileRoute("/relatorios")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Relatórios gerenciais — Central de Chamados" },
      {
        name: "description",
        content:
          "Relatórios de chamados por setor, status, prioridade, desempenho dos técnicos, cumprimento de SLA e satisfação.",
      },
      { property: "og:title", content: "Relatórios gerenciais — Central de Chamados" },
      {
        property: "og:description",
        content: "Indicadores institucionais de atendimento, SLA e satisfação dos usuários.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RotaProtegida permissao="relatorios:ler">
      <RelatoriosPage />
    </RotaProtegida>
  ),
});

const FILTROS_INICIAIS: FiltrosRelatorio = {
  de: "",
  ate: "",
  setor: "",
  status: "",
  prioridade: "",
  tecnicoId: "",
  servicoId: "",
};

function percentual(cumprido: number, total: number) {
  if (!total) return "—";
  return `${Math.round((cumprido / total) * 100)}%`;
}

function csvLinhas(r: Relatorios): string[][] {
  const linhas: string[][] = [["Relatório", "Chave", "Métrica", "Valor"]];
  for (const l of r.porSetor) {
    linhas.push(["Chamados por setor", l.chave, "Total", String(l.total)]);
    linhas.push(["Chamados por setor", l.chave, "Resolvidos", String(l.resolvidos)]);
    linhas.push(["Chamados por setor", l.chave, "Atrasados", String(l.atrasados)]);
  }
  for (const l of r.porStatus) linhas.push(["Chamados por status", l.chave, "Total", String(l.total)]);
  for (const l of r.porPrioridade) {
    linhas.push(["Chamados por prioridade", l.chave, "Total", String(l.total)]);
    linhas.push(["SLA por prioridade", l.chave, "Cumprimento", percentual(l.slaCumprido, l.slaTotal)]);
  }
  for (const l of r.porServico) linhas.push(["Chamados por serviço", l.chave, "Total", String(l.total)]);
  for (const t of r.tecnicos) {
    linhas.push(["Desempenho do técnico", t.chave, "Atendidos", String(t.atendidos)]);
    linhas.push(["Desempenho do técnico", t.chave, "Em aberto", String(t.emAberto)]);
    linhas.push(["Desempenho do técnico", t.chave, "Tempo médio (h)", String(t.tempoMedioResolucaoHoras)]);
    linhas.push(["SLA por técnico", t.chave, "Cumprimento", percentual(t.slaCumprido, t.slaTotal)]);
  }
  linhas.push(["Período", "Resolvidos", "Total", String(r.periodo.resolvidos)]);
  linhas.push(["Período", "Cancelados", "Total", String(r.periodo.cancelados)]);
  linhas.push(["Período", "Reabertos", "Total", String(r.periodo.reabertos)]);
  linhas.push(["Tempos", "Atendimento", "Média (h)", String(r.tempos.medioAtendimentoHoras)]);
  linhas.push(["Tempos", "Resolução", "Média (h)", String(r.tempos.medioResolucaoHoras)]);
  linhas.push(["Usuários", "Cadastrados", "Total", String(r.usuarios.cadastrados)]);
  linhas.push(["Usuários", "Ativos", "Total", String(r.usuarios.ativos)]);
  linhas.push(["Satisfação", "Média", "Nota", String(r.satisfacao.media)]);
  for (const d of r.satisfacao.distribuicao) {
    linhas.push(["Satisfação", `Nota ${d.nota}`, "Avaliações", String(d.total)]);
  }
  for (const e of r.encaminhamentos) {
    linhas.push(["Encaminhamentos", e.protocolo, `${e.autorNome} — ${dataHora(e.criadoEm)}`, e.descricao]);
  }
  return linhas;
}

const CORES_NOTAS: Record<number, string> = {
  1: "#ef4444",
  2: "#f97316",
  3: "#eab308",
  4: "#3b82f6",
  5: "#10b981",
};

const CORES_PIE = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#64748b",
  "#ef4444",
];

function RelatoriosPage() {
  const user = useAuthStore((s) => s.user);
  const [filtros, setFiltros] = useState<FiltrosRelatorio>(FILTROS_INICIAIS);
  const [modoExibicao, setModoExibicao] = useState<"todos" | "graficos" | "tabelas">("todos");
  const [modalExecutivoAberta, setModalExecutivoAberta] = useState(false);

  const { data, isPending, isError, error, isFetching } = useQuery({
    queryKey: ["relatorios", filtros],
    queryFn: () => obterRelatorios(filtros),
    placeholderData: keepPreviousData,
  });

  const { data: servicos } = useQuery({ queryKey: ["servicos"], queryFn: () => listarServicos() });
  const { data: tecnicos } = useQuery({
    queryKey: ["usuarios", "tecnicos-relatorio"],
    queryFn: () => listarUsuarios({ papel: "tecnico", page: 1, limit: 100 }),
  });

  const csv = useMemo(() => (data ? csvLinhas(data) : []), [data]);

  const dadosEvolucao = useMemo(() => data?.evolucaoMensal ?? [], [data]);

  const dadosPrioridade = useMemo(() => {
    if (!data?.porPrioridade) return [];
    return data.porPrioridade.map((p) => ({
      ...p,
      prioridadeNome: PRIORIDADE_LABEL[p.chave as PrioridadeChamado] ?? p.chave,
      percentualSla: p.slaTotal ? Math.round((p.slaCumprido / p.slaTotal) * 100) : 100,
    }));
  }, [data]);

  const dadosStatus = useMemo(() => {
    if (!data?.porStatus) return [];
    return data.porStatus.map((s) => ({
      ...s,
      nome: STATUS_LABEL[s.chave as StatusChamado] ?? s.chave,
    }));
  }, [data]);

  const dadosSatisfacao = useMemo(() => {
    if (!data?.satisfacao?.distribuicao) return [];
    return data.satisfacao.distribuicao.map((d) => ({
      ...d,
      rotulo: `${d.nota} ★`,
    }));
  }, [data]);

  function exportarCsv() {
    const conteudo = csv
      .map((linha) => linha.map((celula) => `"${String(celula ?? "").replaceAll('"', '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([`\uFEFF${conteudo}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorios-chamados-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function definir<K extends keyof FiltrosRelatorio>(chave: K, valor: FiltrosRelatorio[K]) {
    setFiltros((atual) => ({ ...atual, [chave]: valor }));
  }

  return (
    <AppLayout
      titulo="Relatórios gerenciais"
      descricao="Indicadores de atendimento, SLA, desempenho e satisfação"
      acoes={
        <div className="hidden gap-2 sm:flex print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalExecutivoAberta(true)}
            disabled={!data}
          >
            <FileText aria-hidden className="mr-1.5 size-4" /> Relatório Executivo (PDF)
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer aria-hidden className="mr-1.5 size-4" /> Imprimir
          </Button>
          <Button size="sm" onClick={exportarCsv} disabled={!data}>
            <Download aria-hidden className="mr-1.5 size-4" /> Exportar CSV
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <section className="surface-card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
          <div className="space-y-1.5">
            <Label htmlFor="rel-de">Data inicial</Label>
            <Input id="rel-de" type="date" value={filtros.de ?? ""} onChange={(e) => definir("de", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rel-ate">Data final</Label>
            <Input id="rel-ate" type="date" value={filtros.ate ?? ""} onChange={(e) => definir("ate", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rel-setor">Setor</Label>
            <select
              id="rel-setor"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={filtros.setor ?? ""}
              onChange={(e) => definir("setor", e.target.value)}
            >
              <option value="">Todos</option>
              {SETORES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rel-status">Status</Label>
            <select
              id="rel-status"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={filtros.status ?? ""}
              onChange={(e) => definir("status", e.target.value as StatusChamado | "")}
            >
              <option value="">Todos</option>
              {STATUS_OPCOES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rel-prioridade">Prioridade</Label>
            <select
              id="rel-prioridade"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={filtros.prioridade ?? ""}
              onChange={(e) => definir("prioridade", e.target.value as PrioridadeChamado | "")}
            >
              <option value="">Todas</option>
              {PRIORIDADE_OPCOES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rel-tecnico">Técnico</Label>
            <select
              id="rel-tecnico"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={filtros.tecnicoId ?? ""}
              onChange={(e) => definir("tecnicoId", e.target.value)}
            >
              <option value="">Todos</option>
              {(tecnicos?.items ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rel-servico">Serviço do catálogo</Label>
            <select
              id="rel-servico"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={filtros.servicoId ?? ""}
              onChange={(e) => definir("servicoId", e.target.value)}
            >
              <option value="">Todos</option>
              {(servicos ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="w-full" onClick={() => setFiltros(FILTROS_INICIAIS)}>
              Limpar filtros
            </Button>
          </div>
        </section>

        {isError ? (
          <div className="surface-card p-4">
            <MensagemErro erro={error} />
          </div>
        ) : isPending ? (
          <div className="surface-card">
            <SkeletonTabela />
          </div>
        ) : (
          <div className="space-y-6" aria-busy={isFetching}>
            {/* Barra de controle de visualização */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 print:hidden">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Activity className="size-4 text-primary" />
                <span>Painel de Inteligência Operacional & Tomada de Decisão</span>
              </div>
              <div className="flex gap-1.5">
                <Button
                  variant={modoExibicao === "todos" ? "default" : "outline"}
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => setModoExibicao("todos")}
                >
                  <LayoutGrid className="size-3.5" />
                  Painel Completo
                </Button>
                <Button
                  variant={modoExibicao === "graficos" ? "default" : "outline"}
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => setModoExibicao("graficos")}
                >
                  <BarChart3 className="size-3.5" />
                  Apenas Gráficos
                </Button>
                <Button
                  variant={modoExibicao === "tabelas" ? "default" : "outline"}
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => setModoExibicao("tabelas")}
                >
                  <TableIcon className="size-3.5" />
                  Apenas Tabelas
                </Button>
              </div>
            </div>

            {/* Indicadores Principais (KPIs Executivos) */}
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Kpi titulo="Chamados no filtro" valor={data.totalChamados} />
              <Kpi titulo="Tempo médio de atendimento" valor={`${data.tempos.medioAtendimentoHoras} h`} />
              <Kpi titulo="Tempo médio de resolução" valor={`${data.tempos.medioResolucaoHoras} h`} />
              <Kpi
                titulo="Resolução 1º Contato (FCR)"
                valor={data.fcrTaxa !== undefined ? `${data.fcrTaxa}%` : "—"}
                detalhe="Resolvidos sem reencaminhamento"
              />
              <Kpi
                titulo="Satisfação média (CSAT)"
                valor={data.satisfacao.avaliacoes ? `${data.satisfacao.media} / 5` : "Sem avaliações"}
                detalhe={`${data.satisfacao.avaliacoes} avaliação(ões)`}
              />
            </section>

            {/* SEÇÃO 1: GRÁFICOS INSTITUCIONAIS */}
            {modoExibicao !== "tabelas" && (
              <div className="space-y-6">
                {/* 1.1 Evolução Mensal de Chamados */}
                {dadosEvolucao.length > 0 && (
                  <section className="surface-card overflow-hidden p-5">
                    <header className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="size-4 text-primary" />
                        <h2 className="text-sm font-semibold text-foreground">
                          Evolução Histórica Mensal (Abertos vs. Resolvidos)
                        </h2>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Tendência contínua de fluxo de demanda e vazão operacional
                      </span>
                    </header>
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dadosEvolucao} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="gradAbertos" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                            </linearGradient>
                            <linearGradient id="gradResolvidos" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "var(--card)",
                              borderColor: "var(--border)",
                              borderRadius: "0.5rem",
                              fontSize: "12px",
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                          <Area
                            type="monotone"
                            dataKey="abertos"
                            name="Chamados Abertos"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#gradAbertos)"
                          />
                          <Area
                            type="monotone"
                            dataKey="resolvidos"
                            name="Chamados Resolvidos"
                            stroke="#10b981"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#gradResolvidos)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                )}

                {/* 1.2 Grid de Gráficos 2 Colunas (Setor & SLA) */}
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Setor */}
                  <section className="surface-card overflow-hidden p-5">
                    <header className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="size-4 text-primary" />
                        <h2 className="text-sm font-semibold text-foreground">
                          Demandas e Resoluções por Setor
                        </h2>
                      </div>
                    </header>
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.porSetor} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="chave" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={45} />
                          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "var(--card)",
                              borderColor: "var(--border)",
                              borderRadius: "0.5rem",
                              fontSize: "12px",
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                          <Bar dataKey="total" name="Total Abertos" fill="#64748b" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="resolvidos" name="Resolvidos" fill="#10b981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="atrasados" name="Atrasados" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>

                  {/* SLA por Prioridade */}
                  <section className="surface-card overflow-hidden p-5">
                    <header className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="size-4 text-primary" />
                        <h2 className="text-sm font-semibold text-foreground">
                          Eficiência de SLA por Prioridade
                        </h2>
                      </div>
                    </header>
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dadosPrioridade} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="prioridadeNome" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "var(--card)",
                              borderColor: "var(--border)",
                              borderRadius: "0.5rem",
                              fontSize: "12px",
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                          <Bar dataKey="total" name="Total de Chamados" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="slaCumprido" name="Cumprido no Prazo" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                </div>

                {/* 1.3 Grid de Gráficos (Satisfação & Status) */}
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Satisfação CSAT */}
                  <section className="surface-card overflow-hidden p-5">
                    <header className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star className="size-4 text-warning fill-warning" />
                        <h2 className="text-sm font-semibold text-foreground">
                          Distribuição de Satisfação (Notas 1 a 5)
                        </h2>
                      </div>
                      <span className="text-xs font-semibold text-primary">
                        Média: {data.satisfacao.media || 0}/5
                      </span>
                    </header>
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dadosSatisfacao} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="rotulo" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "var(--card)",
                              borderColor: "var(--border)",
                              borderRadius: "0.5rem",
                              fontSize: "12px",
                            }}
                          />
                          <Bar dataKey="total" name="Avaliações" radius={[4, 4, 0, 0]}>
                            {dadosSatisfacao.map((entry) => (
                              <Cell
                                key={`cell-${entry.nota}`}
                                fill={CORES_NOTAS[entry.nota] ?? "#3b82f6"}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>

                  {/* Status Geral */}
                  <section className="surface-card overflow-hidden p-5">
                    <header className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PieChartIcon className="size-4 text-primary" />
                        <h2 className="text-sm font-semibold text-foreground">
                          Composição Atual por Status
                        </h2>
                      </div>
                    </header>
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dadosStatus}
                            dataKey="total"
                            nameKey="nome"
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={3}
                          >
                            {dadosStatus.map((_, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={CORES_PIE[index % CORES_PIE.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "var(--card)",
                              borderColor: "var(--border)",
                              borderRadius: "0.5rem",
                              fontSize: "12px",
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                </div>

                {/* 1.4 Produtividade dos Técnicos */}
                {data.tecnicos.length > 0 && (
                  <section className="surface-card overflow-hidden p-5">
                    <header className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="size-4 text-primary" />
                        <h2 className="text-sm font-semibold text-foreground">
                          Produtividade da Equipe Técnica (Atendidos vs. Em Aberto)
                        </h2>
                      </div>
                    </header>
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.tecnicos} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="chave" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={45} />
                          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "var(--card)",
                              borderColor: "var(--border)",
                              borderRadius: "0.5rem",
                              fontSize: "12px",
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                          <Bar dataKey="atendidos" name="Atendidos / Concluídos" fill="#10b981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="emAberto" name="Em Aberto" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                )}

                {/* 1.5 Mapa de Calor de Horários de Pico (Heatmap Semanal) */}
                <section className="surface-card overflow-hidden p-5">
                  <header className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="size-4 text-primary" />
                      <h2 className="text-sm font-semibold text-foreground">
                        Concentração de Demandas por Horário e Dia da Semana (Heatmap)
                      </h2>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Dimensionamento de equipe e prevenção de filas de espera
                    </span>
                  </header>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] border-collapse text-center text-xs">
                      <thead>
                        <tr>
                          <th className="p-2 text-left font-medium text-muted-foreground">Dia</th>
                          {[7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((h) => (
                            <th key={h} className="p-2 font-medium text-muted-foreground">
                              {h}h
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { diaNum: 1, nome: "Segunda" },
                          { diaNum: 2, nome: "Terça" },
                          { diaNum: 3, nome: "Quarta" },
                          { diaNum: 4, nome: "Quinta" },
                          { diaNum: 5, nome: "Sexta" },
                          { diaNum: 6, nome: "Sábado" },
                          { diaNum: 7, nome: "Domingo" },
                        ].map((d) => (
                          <tr key={d.diaNum} className="border-t border-border/50">
                            <td className="p-2 text-left font-semibold text-foreground">{d.nome}</td>
                            {[7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((h) => {
                              const item = (data.mapaCalor ?? []).find(
                                (m) => m.diaSemana === d.diaNum && m.hora === h,
                              );
                              const total = item?.total ?? 0;
                              let bg = "bg-muted/30 text-muted-foreground";
                              if (total > 0 && total <= 5) bg = "bg-primary/20 text-primary font-medium";
                              else if (total > 5 && total <= 15) bg = "bg-amber-500/30 text-amber-700 dark:text-amber-300 font-semibold";
                              else if (total > 15) bg = "bg-red-500/30 text-red-700 dark:text-red-300 font-bold";

                              return (
                                <td key={h} className="p-1">
                                  <div
                                    className={`flex h-8 w-full items-center justify-center rounded transition-colors ${bg}`}
                                    title={`${d.nome} às ${h}h: ${total} chamado(s)`}
                                  >
                                    {total > 0 ? total : "—"}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="size-3 rounded bg-muted/30 border border-border" /> Baixo (0)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-3 rounded bg-primary/20" /> Regular (1 a 5)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-3 rounded bg-amber-500/30" /> Alto (6 a 15)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-3 rounded bg-red-500/30" /> Crítico (&gt;15)
                    </span>
                  </div>
                </section>
              </div>
            )}

            {/* SEÇÃO 2: TABELAS GERENCIAIS DETALHADAS */}
            {modoExibicao !== "graficos" && (
              <div className="space-y-6 pt-2">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <TableIcon className="size-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    Tabelas de Auditoria e Dados Tabulados
                  </h3>
                </div>

                <Tabela
                  titulo="Chamados por setor"
                  colunas={["Setor", "Total", "Resolvidos", "Atrasados"]}
                  linhas={data.porSetor.map((l) => [l.chave, l.total, l.resolvidos, l.atrasados])}
                />

                <div className="grid gap-4 lg:grid-cols-2">
                  <Tabela
                    titulo="Chamados por status"
                    colunas={["Status", "Total"]}
                    linhas={data.porStatus.map((l) => [STATUS_LABEL[l.chave as StatusChamado] ?? l.chave, l.total])}
                  />
                  <Tabela
                    titulo="Cumprimento de SLA por prioridade"
                    colunas={["Prioridade", "Total", "SLA cumprido"]}
                    linhas={data.porPrioridade.map((l) => [
                      PRIORIDADE_LABEL[l.chave as PrioridadeChamado] ?? l.chave,
                      l.total,
                      percentual(l.slaCumprido, l.slaTotal),
                    ])}
                  />
                </div>

                <Tabela
                  titulo="Desempenho dos técnicos"
                  colunas={["Técnico", "Atendidos", "Em aberto", "Tempo médio de resolução", "SLA cumprido"]}
                  linhas={data.tecnicos.map((t) => [
                    t.chave,
                    t.atendidos,
                    t.emAberto,
                    `${t.tempoMedioResolucaoHoras} h`,
                    percentual(t.slaCumprido, t.slaTotal),
                  ])}
                />

                <div className="grid gap-4 lg:grid-cols-2">
                  <Tabela
                    titulo="Chamados por serviço do catálogo"
                    colunas={["Serviço", "Total"]}
                    linhas={data.porServico.map((l) => [l.chave, l.total])}
                  />
                  <Tabela
                    titulo="Resolvidos, cancelados e reabertos"
                    colunas={["Indicador", "Total"]}
                    linhas={[
                      ["Resolvidos", data.periodo.resolvidos],
                      ["Cancelados", data.periodo.cancelados],
                      ["Reabertos", data.periodo.reabertos],
                    ]}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Tabela
                    titulo="Usuários cadastrados e ativos"
                    colunas={["Indicador", "Total"]}
                    linhas={[
                      ["Cadastrados", data.usuarios.cadastrados],
                      ["Ativos", data.usuarios.ativos],
                    ]}
                  />
                  <Tabela
                    titulo="Satisfação dos usuários"
                    colunas={["Nota", "Avaliações"]}
                    linhas={data.satisfacao.distribuicao.map((d) => [`${d.nota} estrela(s)`, d.total])}
                  />
                </div>

                <Tabela
                  titulo="Encaminhamentos"
                  colunas={["Protocolo", "Registro", "Responsável", "Data"]}
                  linhas={data.encaminhamentos.map((e) => [
                    e.protocolo,
                    e.descricao,
                    e.autorNome,
                    dataHora(e.criadoEm),
                  ])}
                  vazio="Nenhum encaminhamento no período filtrado."
                />
              </div>
            )}
          </div>
        )}
      </div>

      {data && (
        <ModalRelatorioExecutivo
          aberto={modalExecutivoAberta}
          aoMudarAberto={setModalExecutivoAberta}
          relatorios={data}
          filtros={filtros}
          usuarioLogado={user ?? undefined}
        />
      )}
    </AppLayout>
  );
}

function Kpi({ titulo, valor, detalhe }: { titulo: string; valor: string | number; detalhe?: string }) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{valor}</p>
      {detalhe ? <p className="text-xs text-muted-foreground">{detalhe}</p> : null}
    </div>
  );
}

function Tabela({
  titulo,
  colunas,
  linhas,
  vazio = "Sem dados para os filtros aplicados.",
}: {
  titulo: string;
  colunas: string[];
  linhas: (string | number)[][];
  vazio?: string;
}) {
  return (
    <section className="surface-card overflow-hidden">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <BarChart3 aria-hidden className="size-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
      </header>
      {linhas.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{titulo}</caption>
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {colunas.map((c) => (
                  <th key={c} scope="col" className="px-4 py-3 font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {linhas.map((linha, i) => (
                <tr key={i} className="transition-soft hover:bg-muted/50">
                  {linha.map((celula, j) => (
                    <td key={j} className="px-4 py-3 text-foreground">
                      {celula}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
