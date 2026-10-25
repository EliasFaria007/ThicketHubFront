import { useState } from "react";
import {
  BarChart3,
  Check,
  Copy,
  Printer,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { PRIORIDADE_LABEL, STATUS_LABEL } from "@/lib/dominio";
import { calcularMetricasExecutivas } from "@/lib/exportacao-pdf";
import type { FiltrosRelatorio, PrioridadeChamado, Relatorios, StatusChamado } from "@/types";

interface ModalRelatorioExecutivoProps {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  relatorios: Relatorios;
  filtros: FiltrosRelatorio;
  usuarioLogado?: { nome?: string; papel?: string };
}

export function ModalRelatorioExecutivo({
  aberto,
  aoMudarAberto,
  relatorios,
  filtros,
  usuarioLogado,
}: ModalRelatorioExecutivoProps) {
  const [copiado, setCopiado] = useState(false);
  const metricas = calcularMetricasExecutivas(relatorios);

  const agora = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const periodoTexto =
    filtros.de && filtros.ate
      ? `De ${filtros.de.split("-").reverse().join("/")} até ${filtros.ate.split("-").reverse().join("/")}`
      : filtros.de
        ? `A partir de ${filtros.de.split("-").reverse().join("/")}`
        : filtros.ate
          ? `Até ${filtros.ate.split("-").reverse().join("/")}`
          : "Todo o histórico apurado";

  function imprimir() {
    const escHtml = (s: string) =>
      String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const PRINT_CSS = `
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      @page { size: A4; margin: 15mm 12mm; }
      body { font-family: system-ui, -apple-system, sans-serif; font-size: 11pt; color: #111; background: #fff; }
      h1 { font-size: 18pt; font-weight: 700; margin-bottom: 4px; }
      h2 { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 10px; }
      section { margin-bottom: 20px; break-inside: avoid; page-break-inside: avoid; }
      header { border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
      footer { border-top: 1px solid #ccc; padding-top: 10px; text-align: center; font-size: 8pt; color: #666; margin-top: 20px; }
      .brand { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
      .brand-badge { display: inline-flex; width: 26px; height: 26px; align-items: center; justify-content: center; background: #6366f1; color: #fff; font-weight: 900; font-size: 11pt; border-radius: 6px; }
      .brand-name { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: #6366f1; }
      .period-box { border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 6px; padding: 8px 12px; text-align: right; font-size: 8pt; min-width: 180px; }
      .period-box .label { font-weight: 600; text-transform: uppercase; font-size: 7pt; color: #64748b; display: block; }
      .period-box .value { font-weight: 600; display: block; font-size: 9pt; }
      .period-box .sub { font-size: 7pt; color: #64748b; margin-top: 2px; display: block; }
      .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 4px; }
      .kpi-card { border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 6px; padding: 10px; text-align: center; }
      .kpi-label { font-size: 7.5pt; font-weight: 600; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 4px; }
      .kpi-value { font-size: 20pt; font-weight: 700; color: #111; display: block; }
      .kpi-sub { font-size: 7.5pt; color: #64748b; margin-top: 2px; display: block; }
      table { width: 100%; border-collapse: collapse; font-size: 9pt; }
      thead { background: #f1f5f9; }
      th { padding: 6px 10px; text-align: left; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; }
      th:not(:first-child) { text-align: right; }
      td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; }
      td:not(:first-child) { text-align: right; }
      tr:last-child td { border-bottom: none; }
      .table-wrap { border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
    `;

    const setorRows = (relatorios.porSetor || [])
      .map((s) => {
        const pct = s.total > 0 ? Math.round((s.resolvidos / s.total) * 100) : 0;
        return `<tr>
          <td><strong>${escHtml(s.chave)}</strong></td>
          <td>${s.total}</td>
          <td>${s.resolvidos}</td>
          <td>${s.atrasados}</td>
          <td>${pct}%</td>
        </tr>`;
      })
      .join("") || `<tr><td colspan="5" style="text-align:center;color:#64748b;padding:12px">Nenhum chamado no período.</td></tr>`;

    const slaRows = (relatorios.porPrioridade || [])
      .map((p) => {
        const violados = Math.max(0, p.slaTotal - p.slaCumprido);
        const pct = p.slaTotal > 0 ? Math.round((p.slaCumprido / p.slaTotal) * 100) : 100;
        return `<tr>
          <td><strong>${escHtml(PRIORIDADE_LABEL[p.chave as PrioridadeChamado] || p.chave)}</strong></td>
          <td>${p.slaTotal}</td>
          <td>${p.slaCumprido}</td>
          <td>${violados}</td>
          <td>${pct}%</td>
        </tr>`;
      })
      .join("") || `<tr><td colspan="5" style="text-align:center;color:#64748b;padding:12px">Sem dados de SLA no período.</td></tr>`;

    const tecnicoRows = (relatorios.tecnicos || [])
      .map((t) => {
        const pct = t.slaTotal > 0 ? Math.round((t.slaCumprido / t.slaTotal) * 100) : 100;
        return `<tr>
          <td><strong>${escHtml(t.chave)}</strong></td>
          <td>${t.atendidos}</td>
          <td>${t.emAberto}</td>
          <td>${t.tempoMedioResolucaoHoras.toFixed(1)}h</td>
          <td>${pct}%</td>
        </tr>`;
      })
      .join("");

    const tecnicosSection = tecnicoRows
      ? `<section>
          <h2>4. Desempenho Individual da Equipe Técnica</h2>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Técnico</th><th>Atendidos</th><th>Em Aberto</th><th>Tempo Médio (h)</th><th>SLA Cumprido</th></tr></thead>
              <tbody>${tecnicoRows}</tbody>
            </table>
          </div>
        </section>`
      : "";

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Relatório Executivo — ThicketHub</title>
<style>${PRINT_CSS}</style>
</head>
<body>
<div class="brand">
  <span class="brand-badge">TH</span>
  <span class="brand-name">ThicketHub · Central de Atendimento e SLA</span>
</div>
<header>
  <div>
    <h1>RELATÓRIO GERENCIAL EXECUTIVO</h1>
    <p style="font-size:9pt;color:#64748b">Acompanhamento Operacional, Cumprimento de Metas e Indicadores de Qualidade</p>
  </div>
  <div class="period-box">
    <span class="label">Período</span>
    <span class="value">${escHtml(periodoTexto)}</span>
    <span class="sub">Emissão: ${escHtml(agora)}</span>
    ${usuarioLogado?.nome ? `<span class="sub">Emissor: ${escHtml(usuarioLogado.nome)}</span>` : ""}
  </div>
</header>

<section>
  <h2>1. Painel Geral de Indicadores de Desempenho</h2>
  <div class="kpi-grid">
    <div class="kpi-card">
      <span class="kpi-label">Total Chamados</span>
      <span class="kpi-value">${metricas.totalChamados}</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">Resolvidos</span>
      <span class="kpi-value">${metricas.totalResolvidos}</span>
      <span class="kpi-sub">${metricas.taxaResolucaoPercentual}% taxa</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">Aderência ao SLA</span>
      <span class="kpi-value">${metricas.cumprimentoSlaPercentual}%</span>
      <span class="kpi-sub">Dentro do prazo</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">Tempo 1º Atend.</span>
      <span class="kpi-value" style="font-size:14pt">${escHtml(metricas.tempoMedioAtendimentoFormatado)}</span>
      <span class="kpi-sub">Média de início</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">Tempo Resolução</span>
      <span class="kpi-value" style="font-size:14pt">${escHtml(metricas.tempoMedioResolucaoFormatado)}</span>
      <span class="kpi-sub">Média fechamento</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">Satisfação CSAT</span>
      <span class="kpi-value">${metricas.satisfacaoMedia.toFixed(1)} ★</span>
      <span class="kpi-sub">${metricas.percentualSatisfeitos}% aprovação</span>
    </div>
  </div>
</section>

<section>
  <h2>2. Distribuição e Resolução por Setor</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Setor</th><th>Chamados</th><th>Resolvidos</th><th>Atrasados</th><th>% Resolução</th></tr></thead>
      <tbody>${setorRows}</tbody>
    </table>
  </div>
</section>

<section>
  <h2>3. Níveis de Serviço (SLA) por Prioridade</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Prioridade</th><th>Total Apurado</th><th>SLA Cumprido</th><th>SLA Violado</th><th>Aderência %</th></tr></thead>
      <tbody>${slaRows}</tbody>
    </table>
  </div>
</section>

${tecnicosSection}

<footer>
  <p>ThicketHub Central de Chamados e Governança de TI · Documento oficial emitido em ${escHtml(agora)}.</p>
  <p style="font-family:monospace;font-size:7.5pt;margin-top:2px">Chave de integridade: TH-REL-${new Date().getTime().toString(36).toUpperCase()} · Válido para prestação de contas institucional</p>
</footer>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html; charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank", "width=920,height=740,menubar=no,toolbar=no");
    if (!win) {
      toast.error("Permita pop-ups neste site para imprimir o Relatório Executivo.");
      URL.revokeObjectURL(url);
      return;
    }
    win.addEventListener("load", () => {
      setTimeout(() => {
        win.print();
        URL.revokeObjectURL(url);
      }, 400);
    });
  }

  async function copiarResumo() {
    try {
      const texto = [
        `==================================================`,
        `RELATÓRIO GERENCIAL EXECUTIVO — THICKETHUB`,
        `Período: ${periodoTexto}`,
        `Emitido em ${agora} por ${usuarioLogado?.nome || "Administrador"}`,
        `==================================================`,
        `INDICADORES EXECUTIVOS:`,
        `• Total de Chamados: ${metricas.totalChamados}`,
        `• Resolvidos: ${metricas.totalResolvidos} (${metricas.taxaResolucaoPercentual}%)`,
        `• Cumprimento de SLA: ${metricas.cumprimentoSlaPercentual}%`,
        `• Tempo Médio de Resolução: ${metricas.tempoMedioResolucaoFormatado}`,
        `• Satisfação Média (CSAT): ${metricas.satisfacaoMedia.toFixed(1)} ★ (${metricas.percentualSatisfeitos}% aprovação)`,
        `--------------------------------------------------`,
        `CHAMADOS POR SETOR:`,
        ...(relatorios.porSetor || []).map(
          (s) => `• ${s.chave}: ${s.total} chamados (${s.resolvidos} resolvidos, ${s.atrasados} atrasados)`,
        ),
        `--------------------------------------------------`,
        `CUMPRIMENTO DE SLA POR PRIORIDADE:`,
        ...(relatorios.porPrioridade || []).map((p) => {
          const pct = p.slaTotal > 0 ? Math.round((p.slaCumprido / p.slaTotal) * 100) : 100;
          return `• ${PRIORIDADE_LABEL[p.chave as PrioridadeChamado] || p.chave}: ${pct}% dentro do prazo (${p.slaCumprido}/${p.slaTotal})`;
        }),
        `==================================================`,
      ].join("\n");

      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      toast.success("Resumo executivo copiado para a área de transferência.");
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o resumo.");
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={aoMudarAberto}>
      <DialogContent
        data-printable-document="relatorio-executivo"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden p-0 sm:max-w-5xl"
      >
        {/* Barra superior de ações (oculta na impressão) */}
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3 print:hidden">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-5 text-primary" />
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Relatório Executivo de Atendimento e SLA
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Visão consolidada para diretorias, lideranças e prestação de contas
              </DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copiarResumo} className="h-8 text-xs">
              {copiado ? <Check className="mr-1.5 size-3.5 text-emerald-600" /> : <Copy className="mr-1.5 size-3.5" />}
              {copiado ? "Copiado" : "Copiar Resumo"}
            </Button>
            <Button size="sm" onClick={imprimir} className="h-8 text-xs">
              <Printer className="mr-1.5 size-3.5" />
              Imprimir / Salvar PDF
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full"
              onClick={() => aoMudarAberto(false)}
              aria-label="Fechar modal"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Área do Documento A4 formatado */}
        <div className="flex-1 overflow-y-auto bg-card p-6 text-card-foreground print:overflow-visible print:bg-white print:p-0 print:text-black sm:p-8">
          <article className="mx-auto max-w-4xl space-y-6 rounded-lg border border-border bg-background p-6 shadow-xs print:max-w-none print:border-none print:p-0 print:shadow-none">
            {/* Cabeçalho Institucional do Relatório */}
            <header className="border-b-2 border-primary/20 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-black text-sm">
                      TH
                    </span>
                    <span className="text-xs font-bold tracking-widest text-primary uppercase">
                      ThicketHub · Central de Atendimento e SLA
                    </span>
                  </div>
                  <h1 className="text-xl font-bold tracking-tight text-foreground print:text-black">
                    RELATÓRIO GERENCIAL EXECUTIVO
                  </h1>
                  <p className="text-xs text-muted-foreground print:text-neutral-600">
                    Acompanhamento Operacional, Cumprimento de Metas e Indicadores de Qualidade
                  </p>
                </div>

                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-right text-xs print:border-neutral-300 print:bg-neutral-50">
                  <span className="block font-semibold text-muted-foreground uppercase text-[10px]">Período</span>
                  <span className="font-medium text-foreground print:text-black">{periodoTexto}</span>
                  <span className="mt-1 block text-[10px] text-muted-foreground">Emissão: {agora}</span>
                  {usuarioLogado?.nome && (
                    <span className="block text-[10px] text-muted-foreground">Emissor: {usuarioLogado.nome}</span>
                  )}
                </div>
              </div>
            </header>

            {/* Painel de Indicadores Executivos (KPIs) */}
            <section className="page-break-inside-avoid space-y-2">
              <h2 className="text-xs font-bold tracking-wide text-foreground uppercase print:text-black">
                1. Painel Geral de Indicadores de Desempenho
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-md border border-border/80 bg-muted/10 p-3 text-center print:border-neutral-300 print:bg-neutral-50">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Total Chamados</span>
                  <span className="text-2xl font-bold text-foreground print:text-black">{metricas.totalChamados}</span>
                </div>

                <div className="rounded-md border border-border/80 bg-muted/10 p-3 text-center print:border-neutral-300 print:bg-neutral-50">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Resolvidos</span>
                  <span className="text-2xl font-bold text-emerald-600 print:text-black">{metricas.totalResolvidos}</span>
                  <span className="text-[10px] text-muted-foreground block">{metricas.taxaResolucaoPercentual}% taxa</span>
                </div>

                <div className="rounded-md border border-border/80 bg-muted/10 p-3 text-center print:border-neutral-300 print:bg-neutral-50">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Aderência ao SLA</span>
                  <span
                    className={`text-2xl font-bold ${
                      metricas.cumprimentoSlaPercentual >= 90 ? "text-emerald-600" : "text-amber-600"
                    } print:text-black`}
                  >
                    {metricas.cumprimentoSlaPercentual}%
                  </span>
                  <span className="text-[10px] text-muted-foreground block">Dentro do prazo</span>
                </div>

                <div className="rounded-md border border-border/80 bg-muted/10 p-3 text-center print:border-neutral-300 print:bg-neutral-50">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Tempo 1º Atend.</span>
                  <span className="text-xl font-bold text-foreground print:text-black">
                    {metricas.tempoMedioAtendimentoFormatado}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">Média de início</span>
                </div>

                <div className="rounded-md border border-border/80 bg-muted/10 p-3 text-center print:border-neutral-300 print:bg-neutral-50">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Tempo Resolução</span>
                  <span className="text-xl font-bold text-foreground print:text-black">
                    {metricas.tempoMedioResolucaoFormatado}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">Média fechamento</span>
                </div>

                <div className="rounded-md border border-border/80 bg-muted/10 p-3 text-center print:border-neutral-300 print:bg-neutral-50">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Satisfação CSAT</span>
                  <span className="text-2xl font-bold text-amber-500 print:text-black">
                    {metricas.satisfacaoMedia.toFixed(1)} ★
                  </span>
                  <span className="text-[10px] text-muted-foreground block">{metricas.percentualSatisfeitos}% aprovação</span>
                </div>
              </div>
            </section>

            {/* Tabela 1: Atendimentos por Setor */}
            <section className="page-break-inside-avoid space-y-2">
              <h2 className="border-b border-border/60 pb-1 text-xs font-bold tracking-wide text-foreground uppercase print:border-neutral-300 print:text-black">
                2. Distribuição e Resolução por Setor
              </h2>
              <div className="overflow-x-auto rounded border border-border/60 print:border-neutral-300">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 font-semibold text-muted-foreground print:bg-neutral-100 print:text-black">
                    <tr>
                      <th className="px-3 py-2">Setor</th>
                      <th className="px-3 py-2 text-right">Chamados</th>
                      <th className="px-3 py-2 text-right">Resolvidos</th>
                      <th className="px-3 py-2 text-right">Atrasados</th>
                      <th className="px-3 py-2 text-right">% Resolução</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 print:divide-neutral-200">
                    {relatorios.porSetor && relatorios.porSetor.length > 0 ? (
                      relatorios.porSetor.map((s) => {
                        const pct = s.total > 0 ? Math.round((s.resolvidos / s.total) * 100) : 0;
                        return (
                          <tr key={s.chave}>
                            <td className="px-3 py-2 font-medium text-foreground print:text-black">{s.chave}</td>
                            <td className="px-3 py-2 text-right">{s.total}</td>
                            <td className="px-3 py-2 text-right text-emerald-600 print:text-black">{s.resolvidos}</td>
                            <td className="px-3 py-2 text-right text-rose-600 print:text-black">{s.atrasados}</td>
                            <td className="px-3 py-2 text-right font-semibold">{pct}%</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                          Nenhum chamado registrado para os setores no período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Tabela 2: Cumprimento de SLA por Prioridade */}
            <section className="page-break-inside-avoid space-y-2">
              <h2 className="border-b border-border/60 pb-1 text-xs font-bold tracking-wide text-foreground uppercase print:border-neutral-300 print:text-black">
                3. Níveis de Serviço (SLA) por Prioridade
              </h2>
              <div className="overflow-x-auto rounded border border-border/60 print:border-neutral-300">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 font-semibold text-muted-foreground print:bg-neutral-100 print:text-black">
                    <tr>
                      <th className="px-3 py-2">Prioridade</th>
                      <th className="px-3 py-2 text-right">Total Apurado</th>
                      <th className="px-3 py-2 text-right">SLA Cumprido</th>
                      <th className="px-3 py-2 text-right">SLA Violado</th>
                      <th className="px-3 py-2 text-right">Aderência %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 print:divide-neutral-200">
                    {relatorios.porPrioridade && relatorios.porPrioridade.length > 0 ? (
                      relatorios.porPrioridade.map((p) => {
                        const violados = Math.max(0, p.slaTotal - p.slaCumprido);
                        const pct = p.slaTotal > 0 ? Math.round((p.slaCumprido / p.slaTotal) * 100) : 100;
                        return (
                          <tr key={p.chave}>
                            <td className="px-3 py-2 font-medium text-foreground print:text-black">
                              {PRIORIDADE_LABEL[p.chave as PrioridadeChamado] || p.chave}
                            </td>
                            <td className="px-3 py-2 text-right">{p.slaTotal}</td>
                            <td className="px-3 py-2 text-right text-emerald-600 print:text-black">{p.slaCumprido}</td>
                            <td className="px-3 py-2 text-right text-rose-600 print:text-black">{violados}</td>
                            <td className="px-3 py-2 text-right font-semibold">{pct}%</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                          Sem dados de SLA no período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Tabela 3: Desempenho da Equipe Técnica */}
            {relatorios.tecnicos && relatorios.tecnicos.length > 0 && (
              <section className="page-break-inside-avoid space-y-2">
                <h2 className="border-b border-border/60 pb-1 text-xs font-bold tracking-wide text-foreground uppercase print:border-neutral-300 print:text-black">
                  4. Desempenho Individual da Equipe Técnica
                </h2>
                <div className="overflow-x-auto rounded border border-border/60 print:border-neutral-300">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 font-semibold text-muted-foreground print:bg-neutral-100 print:text-black">
                      <tr>
                        <th className="px-3 py-2">Técnico</th>
                        <th className="px-3 py-2 text-right">Atendidos</th>
                        <th className="px-3 py-2 text-right">Em Aberto</th>
                        <th className="px-3 py-2 text-right">Tempo Médio (h)</th>
                        <th className="px-3 py-2 text-right">SLA Cumprido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 print:divide-neutral-200">
                      {relatorios.tecnicos.map((t) => {
                        const pct = t.slaTotal > 0 ? Math.round((t.slaCumprido / t.slaTotal) * 100) : 100;
                        return (
                          <tr key={t.chave}>
                            <td className="px-3 py-2 font-medium text-foreground print:text-black">{t.chave}</td>
                            <td className="px-3 py-2 text-right font-semibold">{t.atendidos}</td>
                            <td className="px-3 py-2 text-right">{t.emAberto}</td>
                            <td className="px-3 py-2 text-right">{t.tempoMedioResolucaoHoras.toFixed(1)}h</td>
                            <td className="px-3 py-2 text-right font-semibold text-emerald-600 print:text-black">
                              {pct}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Rodapé Oficial de Emissão */}
            <footer className="page-break-inside-avoid border-t border-border/50 pt-4 text-center text-[10px] text-muted-foreground print:border-neutral-300 print:text-neutral-500">
              <p>
                ThicketHub Central de Chamados e Governança de TI · Documento oficial emitido em {agora}.
              </p>
              <p className="font-mono text-[9px] mt-0.5">
                Chave de integridade: TH-REL-{new Date().getTime().toString(36).toUpperCase()} · Válido para prestação
                de contas institucional
              </p>
            </footer>
          </article>
        </div>
      </DialogContent>
    </Dialog>
  );
}
