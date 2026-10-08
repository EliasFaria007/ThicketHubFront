import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Download, Printer } from "lucide-react";
import { useMemo, useState } from "react";

import { MensagemErro } from "@/components/comum/MensagemErro";
import { SkeletonTabela } from "@/components/comum/Skeletons";
import { AppLayout } from "@/components/layout/AppLayout";
import { RotaProtegida } from "@/components/layout/RotaProtegida";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRIORIDADE_LABEL, SETORES, STATUS_LABEL, STATUS_OPCOES, PRIORIDADE_OPCOES } from "@/lib/dominio";
import { dataHora } from "@/lib/format";
import { listarServicos } from "@/services/catalogo";
import { obterRelatorios } from "@/services/relatorios";
import { listarUsuarios } from "@/services/usuarios";
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

function RelatoriosPage() {
  const [filtros, setFiltros] = useState<FiltrosRelatorio>(FILTROS_INICIAIS);

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
          <div className="space-y-4" aria-busy={isFetching}>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi titulo="Chamados no filtro" valor={data.totalChamados} />
              <Kpi titulo="Tempo médio de atendimento" valor={`${data.tempos.medioAtendimentoHoras} h`} />
              <Kpi titulo="Tempo médio de resolução" valor={`${data.tempos.medioResolucaoHoras} h`} />
              <Kpi
                titulo="Satisfação média"
                valor={data.satisfacao.avaliacoes ? `${data.satisfacao.media} / 5` : "Sem avaliações"}
                detalhe={`${data.satisfacao.avaliacoes} avaliação(ões)`}
              />
            </section>

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
