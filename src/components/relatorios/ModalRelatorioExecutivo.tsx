import { useRef, useState } from "react";
import {
  BarChart3,
  Check,
  Copy,
  FileSpreadsheet,
  Loader2,
  Presentation,
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
import { exportarRelatorioExecutivoPptx } from "@/lib/exportacao-pptx";
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
  const [exportandoPptx, setExportandoPptx] = useState(false);
  const artigoRef = useRef<HTMLElement>(null);
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
    const el = artigoRef.current;
    if (!el) {
      toast.error("Não foi possível carregar o documento para impressão.");
      return;
    }

    // Converte URLs relativas de stylesheets para absolutas (necessário no contexto blob:)
    const estilosTags = Array.from(document.querySelectorAll("link[rel='stylesheet'], style"))
      .map((item) => {
        if (item.tagName === "LINK") {
          const link = item as HTMLLinkElement;
          const href = new URL(link.href, window.location.origin).href;
          return `<link rel="stylesheet" crossorigin="anonymous" href="${href}" />`;
        }
        return item.outerHTML;
      })
      .join("\n");

    // Extrai as variáveis CSS do :root para garantir que o tema claro seja aplicado
    const rootStyles = Array.from(document.styleSheets)
      .flatMap((sheet) => {
        try {
          return Array.from(sheet.cssRules || []);
        } catch {
          return [];
        }
      })
      .filter((r) => r instanceof CSSStyleRule && (r as CSSStyleRule).selectorText?.includes(":root"))
      .map((r) => (r as CSSStyleRule).cssText)
      .join("\n");

    const html = `<!DOCTYPE html>
<html lang="pt-BR" class="light">
<head>
  <meta charset="utf-8" />
  <title>Relatório Executivo — ThicketHub</title>
  ${estilosTags}
  <style>
    ${rootStyles}
    @page { size: A4; margin: 12mm 10mm; }
    html, body {
      background-color: #ffffff !important;
      color: #0f172a !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    article {
      max-width: 100% !important;
      border: none !important;
      box-shadow: none !important;
      padding: 0 !important;
      margin: 0 !important;
      background-color: #ffffff !important;
    }
    table { break-inside: avoid !important; }
    .overflow-y-auto { overflow: visible !important; height: auto !important; }
  </style>
</head>
<body class="light bg-white p-0 m-0">
  <div style="max-width: 900px; margin: 0 auto; padding: 0;">
    ${el.outerHTML}
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html; charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank", "width=920,height=760,menubar=no,toolbar=no");
    if (!win) {
      toast.error("Permita pop-ups neste site para imprimir o Relatório Executivo.");
      URL.revokeObjectURL(url);
      return;
    }
    win.addEventListener("load", () => {
      void win.document.fonts.ready.then(() => {
        setTimeout(() => {
          win.print();
          URL.revokeObjectURL(url);
        }, 300);
      });
    });
  }

  async function exportarPowerPoint() {
    try {
      setExportandoPptx(true);
      await exportarRelatorioExecutivoPptx({
        relatorios,
        filtros,
        usuarioLogado,
      });
      toast.success("Apresentação PowerPoint (.pptx) gerada com sucesso!");
    } catch (erro) {
      console.error(erro);
      toast.error("Não foi possível gerar a apresentação PowerPoint.");
    } finally {
      setExportandoPptx(false);
    }
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
            <Button
              variant="outline"
              size="sm"
              onClick={exportarPowerPoint}
              disabled={exportandoPptx}
              className="h-8 text-xs text-amber-700 hover:text-amber-800 dark:text-amber-400"
            >
              {exportandoPptx ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Presentation className="mr-1.5 size-3.5" />
              )}
              {exportandoPptx ? "Gerando..." : "PowerPoint (.pptx)"}
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
          <article
            ref={artigoRef}
            className="mx-auto max-w-4xl space-y-6 rounded-lg border border-border bg-background p-6 shadow-xs print:max-w-none print:border-none print:p-0 print:shadow-none"
          >
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
