import pptxgen from "pptxgenjs";
import { PRIORIDADE_LABEL } from "./dominio";
import { calcularMetricasExecutivas } from "./exportacao-pdf";
import type { FiltrosRelatorio, PrioridadeChamado, Relatorios } from "@/types";

export interface OpcoesExportacaoPptx {
  relatorios: Relatorios;
  filtros: FiltrosRelatorio;
  usuarioLogado?: { nome?: string; papel?: string };
}

/**
 * Monta e faz o download de uma apresentação em PowerPoint (.pptx)
 * contendo o Relatório Gerencial Executivo e Indicadores do ThicketHub.
 */
export async function exportarRelatorioExecutivoPptx({
  relatorios,
  filtros,
  usuarioLogado,
}: OpcoesExportacaoPptx): Promise<void> {
  const pptx = new pptxgen();

  pptx.layout = "LAYOUT_16x9";
  pptx.author = usuarioLogado?.nome || "ThicketHub Central de Chamados";
  pptx.company = "ThicketHub";
  pptx.title = "Relatório Gerencial Executivo - Atendimento e SLA";

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

  const AZUL_PRIMARIO = "1E3A8A"; // #1e3a8a
  const AZUL_DESTAQUE = "3B82F6"; // #3b82f6
  const CINZA_FUNDO = "F8FAFC";   // #f8fafc
  const TEXTO_ESCURO = "0F172A";  // #0f172a
  const TEXTO_MUTED = "64748B";   // #64748b
  const VERDE = "16A34A";         // #16a34a
  const AMARELO = "D97706";       // #d97706

  // -------------------------------------------------------------
  // SLIDE 1: Capa Executiva
  // -------------------------------------------------------------
  const slide1 = pptx.addSlide();
  slide1.background = { color: "0F172A" }; // Fundo Dark Slate Corporativo

  // Faixa superior decorativa
  slide1.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: "100%",
    h: 0.25,
    fill: { color: AZUL_DESTAQUE },
    line: { color: AZUL_DESTAQUE },
  });

  // Badge TH
  slide1.addShape(pptx.ShapeType.roundRect, {
    x: 1.0,
    y: 1.8,
    w: 0.9,
    h: 0.9,
    rectRadius: 0.2,
    fill: { color: AZUL_DESTAQUE },
    line: { color: AZUL_DESTAQUE },
  });
  slide1.addText("TH", {
    x: 1.0,
    y: 1.8,
    w: 0.9,
    h: 0.9,
    align: "center",
    valign: "middle",
    color: "FFFFFF",
    fontSize: 24,
    bold: true,
  });

  slide1.addText("THICKETHUB · GOVERNANÇA DE TI & SLA", {
    x: 2.1,
    y: 2.0,
    w: 8.0,
    h: 0.5,
    fontSize: 14,
    color: "93C5FD",
    bold: true,
  });

  slide1.addText("Relatório Gerencial Executivo", {
    x: 1.0,
    y: 3.0,
    w: 11.0,
    h: 1.0,
    fontSize: 34,
    color: "FFFFFF",
    bold: true,
  });

  slide1.addText("Acompanhamento Operacional, Cumprimento de Metas e Indicadores de Qualidade", {
    x: 1.0,
    y: 4.1,
    w: 11.0,
    h: 0.6,
    fontSize: 15,
    color: "CBD5E1",
  });

  // Box inferior com metadados do período
  slide1.addShape(pptx.ShapeType.roundRect, {
    x: 1.0,
    y: 5.4,
    w: 11.3,
    h: 1.3,
    rectRadius: 0.1,
    fill: { color: "1E293B" },
    line: { color: "334155" },
  });

  slide1.addText(
    [
      { text: "Período Apurado: ", options: { bold: true, color: "94A3B8" } },
      { text: `${periodoTexto}\n`, options: { bold: true, color: "FFFFFF" } },
      { text: "Data de Emissão: ", options: { bold: true, color: "94A3B8" } },
      { text: `${agora}  |  `, options: { color: "E2E8F0" } },
      { text: "Emitido por: ", options: { bold: true, color: "94A3B8" } },
      { text: `${usuarioLogado?.nome || "Administrador do Sistema"}`, options: { color: "E2E8F0" } },
    ],
    {
      x: 1.3,
      y: 5.5,
      w: 10.7,
      h: 1.1,
      fontSize: 12,
      valign: "middle",
    },
  );

  // -------------------------------------------------------------
  // SLIDE 2: Painel de Indicadores (KPIs)
  // -------------------------------------------------------------
  const slide2 = pptx.addSlide();
  slide2.background = { color: "FFFFFF" };

  // Cabeçalho do Slide
  slide2.addText("1. Painel Geral de Indicadores de Desempenho", {
    x: 0.8,
    y: 0.5,
    w: 11.0,
    h: 0.6,
    fontSize: 20,
    bold: true,
    color: AZUL_PRIMARIO,
  });
  slide2.addText(`Visão executiva consolidada · ${periodoTexto}`, {
    x: 0.8,
    y: 1.1,
    w: 11.0,
    h: 0.4,
    fontSize: 11,
    color: TEXTO_MUTED,
  });

  // 6 Cards de KPIs organizados em grid (2 linhas de 3 cards)
  const cardsKpi = [
    {
      titulo: "TOTAL DE CHAMADOS",
      valor: String(metricas.totalChamados),
      sub: "Demandas apuradas",
      corValor: TEXTO_ESCURO,
    },
    {
      titulo: "CHAMADOS RESOLVIDOS",
      valor: String(metricas.totalResolvidos),
      sub: `${metricas.taxaResolucaoPercentual}% taxa de resolução`,
      corValor: VERDE,
    },
    {
      titulo: "ADERÊNCIA AO SLA",
      valor: `${metricas.cumprimentoSlaPercentual}%`,
      sub: "Dentro do prazo limite",
      corValor: metricas.cumprimentoSlaPercentual >= 90 ? VERDE : AMARELO,
    },
    {
      titulo: "TEMPO 1º ATENDIMENTO",
      valor: metricas.tempoMedioAtendimentoFormatado,
      sub: "Média de início da resposta",
      corValor: TEXTO_ESCURO,
    },
    {
      titulo: "TEMPO DE RESOLUÇÃO",
      valor: metricas.tempoMedioResolucaoFormatado,
      sub: "Média de fechamento",
      corValor: TEXTO_ESCURO,
    },
    {
      titulo: "SATISFAÇÃO (CSAT)",
      valor: `${metricas.satisfacaoMedia.toFixed(1)} ★`,
      sub: `${metricas.percentualSatisfeitos}% clientes satisfeitos`,
      corValor: AMARELO,
    },
  ];

  cardsKpi.forEach((kpi, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);

    const x = 0.8 + col * 3.9;
    const y = 1.8 + row * 2.3;
    const w = 3.6;
    const h = 2.0;

    // Card background
    slide2.addShape(pptx.ShapeType.roundRect, {
      x,
      y,
      w,
      h,
      rectRadius: 0.1,
      fill: { color: CINZA_FUNDO },
      line: { color: "E2E8F0", width: 1 },
    });

    // Título do KPI
    slide2.addText(kpi.titulo, {
      x: x + 0.2,
      y: y + 0.2,
      w: w - 0.4,
      h: 0.3,
      fontSize: 9,
      bold: true,
      color: TEXTO_MUTED,
    });

    // Valor principal
    slide2.addText(kpi.valor, {
      x: x + 0.2,
      y: y + 0.55,
      w: w - 0.4,
      h: 0.8,
      fontSize: 26,
      bold: true,
      color: kpi.corValor,
    });

    // Subtítulo
    slide2.addText(kpi.sub, {
      x: x + 0.2,
      y: y + 1.45,
      w: w - 0.4,
      h: 0.35,
      fontSize: 10,
      color: TEXTO_MUTED,
    });
  });

  // -------------------------------------------------------------
  // SLIDE 3: Atendimentos por Setor
  // -------------------------------------------------------------
  const slide3 = pptx.addSlide();
  slide3.background = { color: "FFFFFF" };

  slide3.addText("2. Distribuição e Resolução por Setor", {
    x: 0.8,
    y: 0.5,
    w: 11.0,
    h: 0.6,
    fontSize: 20,
    bold: true,
    color: AZUL_PRIMARIO,
  });
  slide3.addText("Volume de chamados abertos, taxa de conclusão e atrasos operacionais", {
    x: 0.8,
    y: 1.1,
    w: 11.0,
    h: 0.4,
    fontSize: 11,
    color: TEXTO_MUTED,
  });

  const cabecalhoSetor = [
    [
      { text: "Setor", options: { bold: true, fill: { color: "1E3A8A" }, color: "FFFFFF", align: "left" } },
      { text: "Chamados", options: { bold: true, fill: { color: "1E3A8A" }, color: "FFFFFF", align: "right" } },
      { text: "Resolvidos", options: { bold: true, fill: { color: "1E3A8A" }, color: "FFFFFF", align: "right" } },
      { text: "Atrasados", options: { bold: true, fill: { color: "1E3A8A" }, color: "FFFFFF", align: "right" } },
      { text: "% Resolução", options: { bold: true, fill: { color: "1E3A8A" }, color: "FFFFFF", align: "right" } },
    ],
  ];

  const linhasSetor = (relatorios.porSetor || []).map((s, idx) => {
    const pct = s.total > 0 ? Math.round((s.resolvidos / s.total) * 100) : 0;
    const fundoLinha = idx % 2 === 0 ? "F8FAFC" : "FFFFFF";
    return [
      { text: s.chave, options: { fill: { color: fundoLinha }, color: TEXTO_ESCURO, bold: true, align: "left" } },
      { text: String(s.total), options: { fill: { color: fundoLinha }, color: TEXTO_ESCURO, align: "right" } },
      { text: String(s.resolvidos), options: { fill: { color: fundoLinha }, color: VERDE, bold: true, align: "right" } },
      { text: String(s.atrasados), options: { fill: { color: fundoLinha }, color: s.atrasados > 0 ? "DC2626" : TEXTO_MUTED, align: "right" } },
      { text: `${pct}%`, options: { fill: { color: fundoLinha }, color: TEXTO_ESCURO, bold: true, align: "right" } },
    ];
  });

  const tabelaSetor = [
    ...cabecalhoSetor,
    ...(linhasSetor.length > 0
      ? linhasSetor
      : [[
          { text: "Nenhum chamado registrado para os setores no período.", options: { colspan: 5, align: "center", color: TEXTO_MUTED } },
          { text: "" },
          { text: "" },
          { text: "" },
          { text: "" },
        ]]),
  ];

  // @ts-expect-error PptxGenJS tipagem de tabela aceita linhas de formato de célula
  slide3.addTable(tabelaSetor, {
    x: 0.8,
    y: 1.8,
    w: 11.7,
    colW: [3.5, 2.0, 2.0, 2.0, 2.2],
    border: { pt: 1, color: "E2E8F0" },
    fontSize: 11,
    rowH: 0.45,
  });

  // -------------------------------------------------------------
  // SLIDE 4: SLA por Prioridade
  // -------------------------------------------------------------
  const slide4 = pptx.addSlide();
  slide4.background = { color: "FFFFFF" };

  slide4.addText("3. Níveis de Serviço (SLA) por Prioridade", {
    x: 0.8,
    y: 0.5,
    w: 11.0,
    h: 0.6,
    fontSize: 20,
    bold: true,
    color: AZUL_PRIMARIO,
  });
  slide4.addText("Aderência contratual aos prazos limites de atendimento e resolução", {
    x: 0.8,
    y: 1.1,
    w: 11.0,
    h: 0.4,
    fontSize: 11,
    color: TEXTO_MUTED,
  });

  const cabecalhoPrioridade = [
    [
      { text: "Prioridade", options: { bold: true, fill: { color: "1E3A8A" }, color: "FFFFFF", align: "left" } },
      { text: "Total Apurado", options: { bold: true, fill: { color: "1E3A8A" }, color: "FFFFFF", align: "right" } },
      { text: "SLA Cumprido", options: { bold: true, fill: { color: "1E3A8A" }, color: "FFFFFF", align: "right" } },
      { text: "SLA Violado", options: { bold: true, fill: { color: "1E3A8A" }, color: "FFFFFF", align: "right" } },
      { text: "Aderência %", options: { bold: true, fill: { color: "1E3A8A" }, color: "FFFFFF", align: "right" } },
    ],
  ];

  const linhasPrioridade = (relatorios.porPrioridade || []).map((p, idx) => {
    const violados = Math.max(0, p.slaTotal - p.slaCumprido);
    const pct = p.slaTotal > 0 ? Math.round((p.slaCumprido / p.slaTotal) * 100) : 100;
    const nome = PRIORIDADE_LABEL[p.chave as PrioridadeChamado] || p.chave;
    const fundoLinha = idx % 2 === 0 ? "F8FAFC" : "FFFFFF";

    return [
      { text: nome, options: { fill: { color: fundoLinha }, color: TEXTO_ESCURO, bold: true, align: "left" } },
      { text: String(p.slaTotal), options: { fill: { color: fundoLinha }, color: TEXTO_ESCURO, align: "right" } },
      { text: String(p.slaCumprido), options: { fill: { color: fundoLinha }, color: VERDE, bold: true, align: "right" } },
      { text: String(violados), options: { fill: { color: fundoLinha }, color: violados > 0 ? "DC2626" : TEXTO_MUTED, align: "right" } },
      { text: `${pct}%`, options: { fill: { color: fundoLinha }, color: pct >= 90 ? VERDE : AMARELO, bold: true, align: "right" } },
    ];
  });

  const tabelaPrioridade = [
    ...cabecalhoPrioridade,
    ...(linhasPrioridade.length > 0
      ? linhasPrioridade
      : [[
          { text: "Sem dados de SLA no período apurado.", options: { colspan: 5, align: "center", color: TEXTO_MUTED } },
          { text: "" },
          { text: "" },
          { text: "" },
          { text: "" },
        ]]),
  ];

  // @ts-expect-error PptxGenJS tipagem de tabela
  slide4.addTable(tabelaPrioridade, {
    x: 0.8,
    y: 1.8,
    w: 11.7,
    colW: [3.5, 2.0, 2.0, 2.0, 2.2],
    border: { pt: 1, color: "E2E8F0" },
    fontSize: 11,
    rowH: 0.45,
  });

  // -------------------------------------------------------------
  // SLIDE 5: Desempenho da Equipe Técnica (se houver dados)
  // -------------------------------------------------------------
  if (relatorios.tecnicos && relatorios.tecnicos.length > 0) {
    const slide5 = pptx.addSlide();
    slide5.background = { color: "FFFFFF" };

    slide5.addText("4. Desempenho Individual da Equipe Técnica", {
      x: 0.8,
      y: 0.5,
      w: 11.0,
      h: 0.6,
      fontSize: 20,
      bold: true,
      color: AZUL_PRIMARIO,
    });
    slide5.addText("Volume de atendimentos, chamados em aberto, tempo médio de resolução e SLA", {
      x: 0.8,
      y: 1.1,
      w: 11.0,
      h: 0.4,
      fontSize: 11,
      color: TEXTO_MUTED,
    });

    const cabecalhoTecnicos = [
      [
        { text: "Técnico", options: { bold: true, fill: { color: "1E3A8A" }, color: "FFFFFF", align: "left" } },
        { text: "Atendidos", options: { bold: true, fill: { color: "1E3A8A" }, color: "FFFFFF", align: "right" } },
        { text: "Em Aberto", options: { bold: true, fill: { color: "1E3A8A" }, color: "FFFFFF", align: "right" } },
        { text: "Tempo Médio (h)", options: { bold: true, fill: { color: "1E3A8A" }, color: "FFFFFF", align: "right" } },
        { text: "SLA Cumprido %", options: { bold: true, fill: { color: "1E3A8A" }, color: "FFFFFF", align: "right" } },
      ],
    ];

    const linhasTecnicos = relatorios.tecnicos.map((t, idx) => {
      const pct = t.slaTotal > 0 ? Math.round((t.slaCumprido / t.slaTotal) * 100) : 100;
      const fundoLinha = idx % 2 === 0 ? "F8FAFC" : "FFFFFF";
      return [
        { text: t.chave, options: { fill: { color: fundoLinha }, color: TEXTO_ESCURO, bold: true, align: "left" } },
        { text: String(t.atendidos), options: { fill: { color: fundoLinha }, color: TEXTO_ESCURO, bold: true, align: "right" } },
        { text: String(t.emAberto), options: { fill: { color: fundoLinha }, color: TEXTO_MUTED, align: "right" } },
        { text: `${t.tempoMedioResolucaoHoras.toFixed(1)}h`, options: { fill: { color: fundoLinha }, color: TEXTO_ESCURO, align: "right" } },
        { text: `${pct}%`, options: { fill: { color: fundoLinha }, color: pct >= 90 ? VERDE : AMARELO, bold: true, align: "right" } },
      ];
    });

    // @ts-expect-error PptxGenJS tipagem de tabela
    slide5.addTable([...cabecalhoTecnicos, ...linhasTecnicos], {
      x: 0.8,
      y: 1.8,
      w: 11.7,
      colW: [3.5, 2.0, 2.0, 2.0, 2.2],
      border: { pt: 1, color: "E2E8F0" },
      fontSize: 11,
      rowH: 0.45,
    });
  }

  // Nome do arquivo de saída
  const nomeArquivo = `Relatorio-Executivo-ThicketHub-${new Date().toISOString().slice(0, 10)}.pptx`;
  await pptx.writeFile({ fileName: nomeArquivo });
}
