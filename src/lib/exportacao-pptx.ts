import pptxgen from "pptxgenjs";
import { PRIORIDADE_LABEL } from "./dominio";
import { calcularMetricasExecutivas } from "./exportacao-pdf";
import type { FiltrosRelatorio, PrioridadeChamado, Relatorios } from "@/types";

export interface OpcoesExportacaoPptx {
  relatorios: Relatorios;
  filtros: FiltrosRelatorio;
  usuarioLogado?: { nome?: string; papel?: string };
}

// ─── Paleta de cores ThicketHub ───────────────────────────────────────────────
const COR = {
  AZUL_ESCURO: "1E3A8A",
  AZUL_MEDIO: "2563EB",
  AZUL_CLARO: "EFF6FF",
  AZUL_BORDA: "BFDBFE",
  VERDE: "16A34A",
  VERDE_CLARO: "F0FDF4",
  VERDE_BORDA: "BBF7D0",
  AMARELO: "D97706",
  AMARELO_CLARO: "FFFBEB",
  VERMELHO: "DC2626",
  VERMELHO_CLARO: "FEF2F2",
  CINZA_FUNDO: "F8FAFC",
  CINZA_BORDA: "E2E8F0",
  CINZA_LINHA: "F1F5F9",
  TEXTO_ESCURO: "0F172A",
  TEXTO_MUTED: "64748B",
  BRANCO: "FFFFFF",
  CAPA_FUNDO: "0F172A",
  CAPA_ACENTO: "1E293B",
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function adicionarRodape(slide: pptxgen.Slide, agora: string) {
  slide.addText(
    [
      { text: "ThicketHub · Relatório Gerencial Executivo", options: { bold: true } },
      { text: `  ·  Emitido em ${agora}`, options: { color: COR.TEXTO_MUTED } },
    ],
    {
      x: 0.4,
      y: 6.9,
      w: 12.5,
      h: 0.28,
      fontSize: 7.5,
      color: COR.TEXTO_MUTED,
      fontFace: "Calibri",
    },
  );
  // Linha divisória do rodapé
  slide.addShape("line" as pptxgen.ShapeType, {
    x: 0.4,
    y: 6.88,
    w: 12.5,
    h: 0,
    line: { color: COR.CINZA_BORDA, width: 0.5 },
  });
}

function adicionarCabecalhoSecao(
  slide: pptxgen.Slide,
  numero: string,
  titulo: string,
  subtitulo: string,
  agora: string,
) {
  // Faixa superior de cor sólida
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: "100%",
    h: 1.05,
    fill: { color: COR.AZUL_ESCURO },
    line: { color: COR.AZUL_ESCURO },
  });

  // Número da seção em destaque
  slide.addText(numero, {
    x: 0.4,
    y: 0.08,
    w: 0.55,
    h: 0.55,
    fontSize: 22,
    bold: true,
    color: COR.AZUL_MEDIO,
    align: "center",
    valign: "middle",
    fontFace: "Calibri",
  });

  // Linha separadora vertical
  slide.addShape("line" as pptxgen.ShapeType, {
    x: 1.05,
    y: 0.12,
    w: 0,
    h: 0.78,
    line: { color: COR.AZUL_MEDIO, width: 1 },
  });

  // Título e subtítulo
  slide.addText(titulo, {
    x: 1.2,
    y: 0.1,
    w: 11.0,
    h: 0.42,
    fontSize: 17,
    bold: true,
    color: COR.BRANCO,
    valign: "bottom",
    fontFace: "Calibri",
  });
  slide.addText(subtitulo, {
    x: 1.2,
    y: 0.52,
    w: 11.0,
    h: 0.38,
    fontSize: 10,
    color: "93C5FD",
    valign: "top",
    fontFace: "Calibri",
  });

  adicionarRodape(slide, agora);
}

// Instância global para uso nos helpers
let pptx: pptxgen;

/**
 * Gera e faz o download de uma apresentação PowerPoint profissional
 * com o Relatório Gerencial Executivo do ThicketHub.
 */
export async function exportarRelatorioExecutivoPptx({
  relatorios,
  filtros,
  usuarioLogado,
}: OpcoesExportacaoPptx): Promise<void> {
  pptx = new pptxgen();

  pptx.layout = "LAYOUT_16x9";
  pptx.author = usuarioLogado?.nome || "ThicketHub";
  pptx.company = "ThicketHub · Central de Chamados e Governança de TI";
  pptx.title = "Relatório Gerencial Executivo — ThicketHub";

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
      ? `${filtros.de.split("-").reverse().join("/")} – ${filtros.ate.split("-").reverse().join("/")}`
      : filtros.de
        ? `A partir de ${filtros.de.split("-").reverse().join("/")}`
        : filtros.ate
          ? `Até ${filtros.ate.split("-").reverse().join("/")}`
          : "Todo o histórico apurado";

  // ─── SLIDE 1: Capa ─────────────────────────────────────────────────────────
  {
    const slide = pptx.addSlide();
    slide.background = { color: COR.CAPA_FUNDO };

    // Faixa lateral esquerda de destaque
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 0.22, h: "100%",
      fill: { color: COR.AZUL_MEDIO },
      line: { color: COR.AZUL_MEDIO },
    });

    // Linha horizontal superior decorativa
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.22, y: 0.65, w: 12.55, h: 0.04,
      fill: { color: COR.AZUL_MEDIO },
      line: { color: COR.AZUL_MEDIO },
    });

    // Badge TH
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.65, y: 1.0, w: 1.1, h: 1.1,
      rectRadius: 0.12,
      fill: { color: COR.AZUL_MEDIO },
      line: { color: COR.AZUL_MEDIO },
    });
    slide.addText("TH", {
      x: 0.65, y: 1.0, w: 1.1, h: 1.1,
      align: "center", valign: "middle",
      fontSize: 30, bold: true, color: COR.BRANCO, fontFace: "Calibri",
    });

    // Nome da empresa
    slide.addText("THICKETHUB", {
      x: 1.9, y: 1.02, w: 10.5, h: 0.45,
      fontSize: 13, bold: true, color: "93C5FD", fontFace: "Calibri",
      charSpacing: 4,
    });
    slide.addText("Central de Chamados e Governança de TI", {
      x: 1.9, y: 1.46, w: 10.5, h: 0.38,
      fontSize: 10, color: "64748B", fontFace: "Calibri",
    });

    // Título principal
    slide.addText("Relatório Gerencial", {
      x: 0.65, y: 2.15, w: 11.5, h: 0.75,
      fontSize: 38, bold: true, color: COR.BRANCO, fontFace: "Calibri",
    });
    slide.addText("Executivo", {
      x: 0.65, y: 2.88, w: 11.5, h: 0.75,
      fontSize: 38, bold: true, color: COR.AZUL_MEDIO, fontFace: "Calibri",
    });
    slide.addText("Acompanhamento Operacional, Cumprimento de Metas e Indicadores de Qualidade", {
      x: 0.65, y: 3.68, w: 11.5, h: 0.45,
      fontSize: 12, color: "94A3B8", fontFace: "Calibri",
    });

    // Linha divisória antes dos metadados
    slide.addShape("line" as pptxgen.ShapeType, {
      x: 0.65, y: 4.35, w: 11.5, h: 0,
      line: { color: "334155", width: 1 },
    });

    // Box de metadados
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.65, y: 4.55, w: 11.5, h: 1.5,
      rectRadius: 0.08,
      fill: { color: COR.CAPA_ACENTO },
      line: { color: "334155", width: 0.75 },
    });

    // Grid de 3 colunas de metadados
    const metaItens = [
      { rotulo: "PERÍODO APURADO", valor: periodoTexto },
      { rotulo: "DATA DE EMISSÃO", valor: agora },
      { rotulo: "EMITIDO POR", valor: usuarioLogado?.nome || "Administrador do Sistema" },
    ];
    metaItens.forEach((meta, i) => {
      const x = 0.85 + i * 3.85;
      slide.addText(meta.rotulo, {
        x, y: 4.65, w: 3.6, h: 0.28,
        fontSize: 7.5, bold: true, color: "64748B", fontFace: "Calibri", charSpacing: 1.5,
      });
      slide.addText(meta.valor, {
        x, y: 4.93, w: 3.6, h: 0.85,
        fontSize: 11, bold: true, color: "E2E8F0", fontFace: "Calibri",
        wrap: true,
      });
    });

    // Separadores verticais entre colunas
    [4.7, 8.55].forEach((xSep) => {
      slide.addShape("line" as pptxgen.ShapeType, {
        x: xSep, y: 4.7, w: 0, h: 1.2,
        line: { color: "334155", width: 0.75 },
      });
    });
  }

  // ─── SLIDE 2: Painel de KPIs ───────────────────────────────────────────────
  {
    const slide = pptx.addSlide();
    slide.background = { color: COR.BRANCO };
    adicionarCabecalhoSecao(slide, "01", "Painel de Indicadores de Desempenho", "Visão executiva consolidada dos principais KPIs operacionais e de qualidade", agora);

    const kpis = [
      {
        valor: String(metricas.totalChamados),
        rotulo: "Total de Chamados",
        sub: "Demandas apuradas no período",
        cor: COR.AZUL_MEDIO,
        bg: COR.AZUL_CLARO,
        borda: COR.AZUL_BORDA,
      },
      {
        valor: String(metricas.totalResolvidos),
        rotulo: "Resolvidos",
        sub: `${metricas.taxaResolucaoPercentual}% taxa de conclusão`,
        cor: COR.VERDE,
        bg: COR.VERDE_CLARO,
        borda: COR.VERDE_BORDA,
      },
      {
        valor: `${metricas.cumprimentoSlaPercentual}%`,
        rotulo: "Aderência ao SLA",
        sub: "Chamados dentro do prazo",
        cor: metricas.cumprimentoSlaPercentual >= 90 ? COR.VERDE : COR.AMARELO,
        bg: metricas.cumprimentoSlaPercentual >= 90 ? COR.VERDE_CLARO : COR.AMARELO_CLARO,
        borda: metricas.cumprimentoSlaPercentual >= 90 ? COR.VERDE_BORDA : "FDE68A",
      },
      {
        valor: metricas.tempoMedioAtendimentoFormatado,
        rotulo: "Tempo 1º Atendimento",
        sub: "Média de início de resposta",
        cor: COR.AZUL_ESCURO,
        bg: COR.CINZA_FUNDO,
        borda: COR.CINZA_BORDA,
      },
      {
        valor: metricas.tempoMedioResolucaoFormatado,
        rotulo: "Tempo de Resolução",
        sub: "Média até encerramento",
        cor: COR.AZUL_ESCURO,
        bg: COR.CINZA_FUNDO,
        borda: COR.CINZA_BORDA,
      },
      {
        valor: `${metricas.satisfacaoMedia.toFixed(1)} ★`,
        rotulo: "Satisfação (CSAT)",
        sub: `${metricas.percentualSatisfeitos}% de clientes satisfeitos`,
        cor: COR.AMARELO,
        bg: COR.AMARELO_CLARO,
        borda: "FDE68A",
      },
    ];

    // 2 linhas × 3 colunas
    kpis.forEach((kpi, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const x = 0.4 + col * 4.27;
      const y = 1.25 + row * 2.65;
      const w = 4.0;
      const h = 2.35;

      // Fundo e borda do card
      slide.addShape(pptx.ShapeType.roundRect, {
        x, y, w, h,
        rectRadius: 0.1,
        fill: { color: kpi.bg },
        line: { color: kpi.borda, width: 1 },
      });

      // Barra de cor superior do card
      slide.addShape(pptx.ShapeType.roundRect, {
        x, y, w, h: 0.22,
        rectRadius: 0.1,
        fill: { color: kpi.cor },
        line: { color: kpi.cor },
      });

      // Rótulo
      slide.addText(kpi.rotulo.toUpperCase(), {
        x: x + 0.18, y: y + 0.32, w: w - 0.36, h: 0.3,
        fontSize: 8, bold: true, color: COR.TEXTO_MUTED, fontFace: "Calibri",
        charSpacing: 0.8,
      });

      // Valor em destaque
      const valorFontSize = kpi.valor.length > 6 ? 26 : 34;
      slide.addText(kpi.valor, {
        x: x + 0.18, y: y + 0.6, w: w - 0.36, h: 0.98,
        fontSize: valorFontSize, bold: true, color: kpi.cor, fontFace: "Calibri",
        valign: "middle",
      });

      // Divisória inferior
      slide.addShape("line" as pptxgen.ShapeType, {
        x: x + 0.18, y: y + 1.65, w: w - 0.36, h: 0,
        line: { color: kpi.borda, width: 0.5 },
      });

      // Subtítulo
      slide.addText(kpi.sub, {
        x: x + 0.18, y: y + 1.72, w: w - 0.36, h: 0.5,
        fontSize: 9.5, color: COR.TEXTO_MUTED, fontFace: "Calibri", wrap: true,
      });
    });
  }

  // ─── SLIDE 3: Atendimentos por Setor ──────────────────────────────────────
  {
    const slide = pptx.addSlide();
    slide.background = { color: COR.BRANCO };
    adicionarCabecalhoSecao(slide, "02", "Distribuição e Resolução por Setor", "Volume de demandas abertas, taxa de resolução e atrasos operacionais por departamento", agora);

    const linhas: pptxgen.TableRow[] = [
      // Cabeçalho
      [
        { text: "Setor / Departamento", options: { bold: true, color: COR.BRANCO, fill: { color: COR.AZUL_ESCURO }, align: "left" } },
        { text: "Chamados", options: { bold: true, color: COR.BRANCO, fill: { color: COR.AZUL_ESCURO }, align: "center" } },
        { text: "Resolvidos", options: { bold: true, color: COR.BRANCO, fill: { color: COR.AZUL_ESCURO }, align: "center" } },
        { text: "Atrasados", options: { bold: true, color: COR.BRANCO, fill: { color: COR.AZUL_ESCURO }, align: "center" } },
        { text: "% Resolução", options: { bold: true, color: COR.BRANCO, fill: { color: COR.AZUL_ESCURO }, align: "center" } },
        { text: "Status", options: { bold: true, color: COR.BRANCO, fill: { color: COR.AZUL_ESCURO }, align: "center" } },
      ],
    ];

    if (relatorios.porSetor && relatorios.porSetor.length > 0) {
      relatorios.porSetor.forEach((s, idx) => {
        const pct = s.total > 0 ? Math.round((s.resolvidos / s.total) * 100) : 0;
        const bgLinha = idx % 2 === 0 ? COR.CINZA_FUNDO : COR.BRANCO;
        const statusTexto = pct >= 80 ? "✓ Bom" : pct >= 50 ? "⚠ Regular" : "✗ Crítico";
        const statusCor = pct >= 80 ? COR.VERDE : pct >= 50 ? COR.AMARELO : COR.VERMELHO;
        linhas.push([
          { text: s.chave, options: { bold: true, color: COR.TEXTO_ESCURO, fill: { color: bgLinha }, align: "left" } },
          { text: String(s.total), options: { color: COR.TEXTO_ESCURO, fill: { color: bgLinha }, align: "center" } },
          { text: String(s.resolvidos), options: { bold: true, color: COR.VERDE, fill: { color: bgLinha }, align: "center" } },
          { text: String(s.atrasados), options: { bold: s.atrasados > 0, color: s.atrasados > 0 ? COR.VERMELHO : COR.TEXTO_MUTED, fill: { color: bgLinha }, align: "center" } },
          { text: `${pct}%`, options: { bold: true, color: COR.TEXTO_ESCURO, fill: { color: bgLinha }, align: "center" } },
          { text: statusTexto, options: { bold: true, color: statusCor, fill: { color: bgLinha }, align: "center" } },
        ]);
      });
    } else {
      linhas.push([
        { text: "Nenhum dado de setor disponível no período selecionado.", options: { color: COR.TEXTO_MUTED, align: "left", colspan: 6 } },
        { text: "" }, { text: "" }, { text: "" }, { text: "" }, { text: "" },
      ]);
    }

    slide.addTable(linhas as pptxgen.TableRow[], {
      x: 0.4, y: 1.25, w: 12.5,
      colW: [3.2, 1.6, 1.6, 1.6, 1.6, 2.9],
      border: { pt: 0.5, color: COR.CINZA_BORDA },
      fontSize: 11,
      fontFace: "Calibri",
      rowH: 0.48,
      margin: [0, 10, 0, 10],
    });
  }

  // ─── SLIDE 4: SLA por Prioridade ──────────────────────────────────────────
  {
    const slide = pptx.addSlide();
    slide.background = { color: COR.BRANCO };
    adicionarCabecalhoSecao(slide, "03", "Níveis de Serviço (SLA) por Prioridade", "Aderência contratual aos prazos limites de atendimento e resolução por criticidade", agora);

    const linhasSla: pptxgen.TableRow[] = [
      [
        { text: "Prioridade", options: { bold: true, color: COR.BRANCO, fill: { color: COR.AZUL_ESCURO }, align: "left" } },
        { text: "Total Apurado", options: { bold: true, color: COR.BRANCO, fill: { color: COR.AZUL_ESCURO }, align: "center" } },
        { text: "SLA Cumprido", options: { bold: true, color: COR.BRANCO, fill: { color: COR.AZUL_ESCURO }, align: "center" } },
        { text: "SLA Violado", options: { bold: true, color: COR.BRANCO, fill: { color: COR.AZUL_ESCURO }, align: "center" } },
        { text: "Aderência %", options: { bold: true, color: COR.BRANCO, fill: { color: COR.AZUL_ESCURO }, align: "center" } },
        { text: "Conformidade", options: { bold: true, color: COR.BRANCO, fill: { color: COR.AZUL_ESCURO }, align: "center" } },
      ],
    ];

    if (relatorios.porPrioridade && relatorios.porPrioridade.length > 0) {
      relatorios.porPrioridade.forEach((p, idx) => {
        const violados = Math.max(0, p.slaTotal - p.slaCumprido);
        const pct = p.slaTotal > 0 ? Math.round((p.slaCumprido / p.slaTotal) * 100) : 100;
        const bgLinha = idx % 2 === 0 ? COR.CINZA_FUNDO : COR.BRANCO;
        const nome = PRIORIDADE_LABEL[p.chave as PrioridadeChamado] || p.chave;
        const confTexto = pct >= 90 ? "✓ Dentro do alvo" : pct >= 70 ? "⚠ Atenção" : "✗ Crítico";
        const confCor = pct >= 90 ? COR.VERDE : pct >= 70 ? COR.AMARELO : COR.VERMELHO;
        linhasSla.push([
          { text: nome, options: { bold: true, color: COR.TEXTO_ESCURO, fill: { color: bgLinha }, align: "left" } },
          { text: String(p.slaTotal), options: { color: COR.TEXTO_ESCURO, fill: { color: bgLinha }, align: "center" } },
          { text: String(p.slaCumprido), options: { bold: true, color: COR.VERDE, fill: { color: bgLinha }, align: "center" } },
          { text: String(violados), options: { bold: violados > 0, color: violados > 0 ? COR.VERMELHO : COR.TEXTO_MUTED, fill: { color: bgLinha }, align: "center" } },
          { text: `${pct}%`, options: { bold: true, color: pct >= 90 ? COR.VERDE : COR.AMARELO, fill: { color: bgLinha }, align: "center" } },
          { text: confTexto, options: { bold: true, color: confCor, fill: { color: bgLinha }, align: "center" } },
        ]);
      });
    } else {
      linhasSla.push([
        { text: "Nenhum dado de SLA disponível no período selecionado.", options: { color: COR.TEXTO_MUTED, align: "left", colspan: 6 } },
        { text: "" }, { text: "" }, { text: "" }, { text: "" }, { text: "" },
      ]);
    }

    slide.addTable(linhasSla as pptxgen.TableRow[], {
      x: 0.4, y: 1.25, w: 12.5,
      colW: [3.2, 1.8, 1.8, 1.8, 1.8, 2.1],
      border: { pt: 0.5, color: COR.CINZA_BORDA },
      fontSize: 11,
      fontFace: "Calibri",
      rowH: 0.48,
      margin: [0, 10, 0, 10],
    });
  }

  // ─── SLIDE 5: Equipe Técnica (condicional) ────────────────────────────────
  if (relatorios.tecnicos && relatorios.tecnicos.length > 0) {
    const slide = pptx.addSlide();
    slide.background = { color: COR.BRANCO };
    adicionarCabecalhoSecao(slide, "04", "Desempenho da Equipe Técnica", "Ranking individual de produtividade, chamados atendidos e conformidade com o SLA", agora);

    const linhasTec: pptxgen.TableRow[] = [
      [
        { text: "Técnico", options: { bold: true, color: COR.BRANCO, fill: { color: COR.AZUL_ESCURO }, align: "left" } },
        { text: "Atendidos", options: { bold: true, color: COR.BRANCO, fill: { color: COR.AZUL_ESCURO }, align: "center" } },
        { text: "Em Aberto", options: { bold: true, color: COR.BRANCO, fill: { color: COR.AZUL_ESCURO }, align: "center" } },
        { text: "Tempo Médio", options: { bold: true, color: COR.BRANCO, fill: { color: COR.AZUL_ESCURO }, align: "center" } },
        { text: "SLA Cumprido", options: { bold: true, color: COR.BRANCO, fill: { color: COR.AZUL_ESCURO }, align: "center" } },
        { text: "Aderência %", options: { bold: true, color: COR.BRANCO, fill: { color: COR.AZUL_ESCURO }, align: "center" } },
      ],
    ];

    relatorios.tecnicos
      .sort((a, b) => b.atendidos - a.atendidos)
      .forEach((t, idx) => {
        const pct = t.slaTotal > 0 ? Math.round((t.slaCumprido / t.slaTotal) * 100) : 100;
        const bgLinha = idx % 2 === 0 ? COR.CINZA_FUNDO : COR.BRANCO;
        linhasTec.push([
          { text: t.chave, options: { bold: true, color: COR.TEXTO_ESCURO, fill: { color: bgLinha }, align: "left" } },
          { text: String(t.atendidos), options: { bold: true, color: COR.AZUL_MEDIO, fill: { color: bgLinha }, align: "center" } },
          { text: String(t.emAberto), options: { color: t.emAberto > 0 ? COR.AMARELO : COR.TEXTO_MUTED, fill: { color: bgLinha }, align: "center" } },
          { text: `${t.tempoMedioResolucaoHoras.toFixed(1)}h`, options: { color: COR.TEXTO_ESCURO, fill: { color: bgLinha }, align: "center" } },
          { text: String(t.slaCumprido), options: { bold: true, color: COR.VERDE, fill: { color: bgLinha }, align: "center" } },
          { text: `${pct}%`, options: { bold: true, color: pct >= 90 ? COR.VERDE : COR.AMARELO, fill: { color: bgLinha }, align: "center" } },
        ]);
      });

    slide.addTable(linhasTec as pptxgen.TableRow[], {
      x: 0.4, y: 1.25, w: 12.5,
      colW: [3.5, 1.6, 1.6, 1.6, 1.9, 2.3],
      border: { pt: 0.5, color: COR.CINZA_BORDA },
      fontSize: 11,
      fontFace: "Calibri",
      rowH: 0.48,
      margin: [0, 10, 0, 10],
    });
  }

  // ─── SLIDE FINAL: Encerramento ────────────────────────────────────────────
  {
    const slide = pptx.addSlide();
    slide.background = { color: COR.CAPA_FUNDO };

    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 0.22, h: "100%",
      fill: { color: COR.AZUL_MEDIO },
      line: { color: COR.AZUL_MEDIO },
    });

    slide.addText("Documento gerado automaticamente pelo sistema", {
      x: 0.65, y: 2.5, w: 12.0, h: 0.45,
      fontSize: 18, bold: true, color: "94A3B8", fontFace: "Calibri",
    });
    slide.addText("ThicketHub · Central de Chamados e Governança de TI", {
      x: 0.65, y: 3.1, w: 12.0, h: 0.55,
      fontSize: 24, bold: true, color: COR.BRANCO, fontFace: "Calibri",
    });
    slide.addShape("line" as pptxgen.ShapeType, {
      x: 0.65, y: 3.8, w: 5.0, h: 0,
      line: { color: COR.AZUL_MEDIO, width: 2 },
    });
    slide.addText(
      [
        { text: "Período: ", options: { bold: true, color: "64748B" } },
        { text: `${periodoTexto}\n`, options: { color: "E2E8F0" } },
        { text: "Emissão: ", options: { bold: true, color: "64748B" } },
        { text: agora, options: { color: "E2E8F0" } },
      ],
      { x: 0.65, y: 4.05, w: 12.0, h: 0.8, fontSize: 11, fontFace: "Calibri" },
    );
  }

  const nomeArquivo = `ThicketHub-Relatorio-Executivo-${new Date().toISOString().slice(0, 10)}.pptx`;
  await pptx.writeFile({ fileName: nomeArquivo });
}
