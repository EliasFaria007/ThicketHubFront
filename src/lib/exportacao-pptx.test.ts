import { describe, expect, it, vi } from "vitest";
import { exportarRelatorioExecutivoPptx } from "./exportacao-pptx";
import type { FiltrosRelatorio, Relatorios } from "@/types";

// Mock de pptxgenjs para testar a chamada sem depender de DOM real
vi.mock("pptxgenjs", () => {
  return {
    default: class MockPptx {
      layout = "";
      author = "";
      company = "";
      title = "";
      ShapeType = { rect: "rect", roundRect: "roundRect" };
      slides: unknown[] = [];

      addSlide() {
        const slide = {
          background: {},
          addShape: vi.fn(),
          addText: vi.fn(),
          addTable: vi.fn(),
        };
        this.slides.push(slide);
        return slide;
      }

      writeFile = vi.fn().mockResolvedValue("done");
    },
  };
});

describe("exportacao-pptx", () => {
  const relatoriosMock: Relatorios = {
    totalChamados: 120,
    periodo: {
      abertos: 40,
      resolvidos: 96,
      cancelados: 4,
      reabertos: 2,
    },
    tempoMedioAtendimentoHoras: 0.5,
    tempoMedioResolucaoHoras: 3.2,
    satisfacao: {
      media: 4.8,
      totalAvaliacoes: 80,
      percentualSatisfeitos: 95,
      distribuicao: [],
    },
    porSetor: [
      { chave: "TI", total: 60, abertos: 10, resolvidos: 50, atrasados: 2 },
      { chave: "Financeiro", total: 40, abertos: 5, resolvidos: 35, atrasados: 1 },
    ],
    porPrioridade: [
      { chave: "ALTA", total: 20, slaCumprido: 18, slaTotal: 20 },
      { chave: "MEDIA", total: 60, slaCumprido: 56, slaTotal: 60 },
    ],
    tecnicos: [
      { chave: "Carlos Tech", atendidos: 45, emAberto: 3, tempoMedioResolucaoHoras: 2.5, slaCumprido: 43, slaTotal: 45 },
    ],
  };

  const filtrosMock: FiltrosRelatorio = {
    de: "2026-10-01",
    ate: "2026-10-25",
  };

  it("monta e exporta a apresentação executiva com os slides corretos", async () => {
    await expect(
      exportarRelatorioExecutivoPptx({
        relatorios: relatoriosMock,
        filtros: filtrosMock,
        usuarioLogado: { nome: "Super Administrador", papel: "SUPERUSUARIO" },
      }),
    ).resolves.not.toThrow();
  });
});
