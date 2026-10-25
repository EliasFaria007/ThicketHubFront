import { describe, expect, it } from "vitest";
import {
  calcularMetricasExecutivas,
  formatarHorasLegivel,
  obterDadosOrdemServico,
} from "./exportacao-pdf";
import type { Chamado, Relatorios } from "@/types";

describe("exportacao-pdf - Funções utilitárias de relatórios e O.S.", () => {
  it("formata horas decimais para formato legível", () => {
    expect(formatarHorasLegivel(0)).toBe("0min");
    expect(formatarHorasLegivel(0.5)).toBe("30min");
    expect(formatarHorasLegivel(1.5)).toBe("1h 30min");
    expect(formatarHorasLegivel(2)).toBe("2h 00min");
    expect(formatarHorasLegivel(3.25)).toBe("3h 15min");
  });

  it("calcula metricas executivas corretamente a partir de Relatorios", () => {
    const relatoriosMock: Relatorios = {
      totalChamados: 100,
      periodo: {
        resolvidos: 80,
        cancelados: 5,
        reabertos: 2,
      },
      porSetor: [
        { chave: "TI", total: 60, resolvidos: 50, atrasados: 2 },
        { chave: "RH", total: 40, resolvidos: 30, atrasados: 1 },
      ],
      porStatus: [
        { chave: "resolvido", total: 80 },
        { chave: "aberto", total: 15 },
        { chave: "cancelado", total: 5 },
      ],
      porPrioridade: [
        { chave: "alta", total: 30, slaCumprido: 27, slaTotal: 30 },
        { chave: "media", total: 70, slaCumprido: 63, slaTotal: 70 },
      ],
      porServico: [{ chave: "Suporte", total: 100 }],
      tecnicos: [
        {
          chave: "Técnico Silva",
          atendidos: 45,
          emAberto: 3,
          tempoMedioResolucaoHoras: 2.5,
          slaCumprido: 42,
          slaTotal: 45,
        },
      ],
      tempos: {
        medioAtendimentoHoras: 0.8,
        medioResolucaoHoras: 3.2,
      },
      usuarios: {
        cadastrados: 50,
        ativos: 48,
      },
      satisfacao: {
        media: 4.8,
        avaliacoes: 25,
        distribuicao: [
          { nota: 5, total: 20 },
          { nota: 4, total: 4 },
          { nota: 3, total: 1 },
          { nota: 2, total: 0 },
          { nota: 1, total: 0 },
        ],
      },
      encaminhamentos: [],
    };

    const metricas = calcularMetricasExecutivas(relatoriosMock);

    expect(metricas.totalChamados).toBe(100);
    expect(metricas.totalResolvidos).toBe(80);
    expect(metricas.taxaResolucaoPercentual).toBe(80);
    expect(metricas.cumprimentoSlaPercentual).toBe(90); // (27+63) / 100 = 90%
    expect(metricas.tempoMedioAtendimentoFormatado).toBe("48min");
    expect(metricas.tempoMedioResolucaoFormatado).toBe("3h 12min");
    expect(metricas.satisfacaoMedia).toBe(4.8);
    expect(metricas.percentualSatisfeitos).toBe(96); // (20+4)/25 = 96%
  });

  it("extrai dados completos da Ordem de Serviço de um chamado", () => {
    const chamadoMock: Chamado = {
      id: "chamado-1",
      protocolo: "20261025-0042",
      titulo: "Computador não liga na sala 12",
      descricao: "Equipamento parou de responder após queda de energia.\n<!-- THICKET_ANEXOS:[{\"id\":\"anx-1\",\"nome\":\"foto.png\",\"tamanho\":1234,\"tipo\":\"image/png\",\"dataUrl\":\"data:image/png;base64,123\"}] -->",
      status: "resolvido",
      prioridade: "alta",
      setor: "TI",
      servicoId: "srv-1",
      servicoNome: "Manutenção de Hardware",
      solicitanteId: "usr-1",
      solicitanteNome: "Maria Oliveira",
      solicitanteEmail: "maria@empresa.com",
      tecnicoId: "tec-1",
      tecnicoNome: "Carlos Souza",
      tecnicoEmail: "carlos@empresa.com",
      criadoEm: "2026-10-25T10:00:00Z",
      atualizadoEm: "2026-10-25T14:30:00Z",
      resolvidoEm: "2026-10-25T14:30:00Z",
      prazoSla: "2026-10-25T16:00:00Z",
      oQueFoiFeito: "### 📋 Registro de Atendimento — 25/10/2026, 11:30 · Carlos Souza (TI)\nSubstituída fonte queimada ATX 500W.\n[ASSINATURA_IMAGEM:data:image/png;base64,signature123]\n--- \n### 📋 Registro de Atendimento — 25/10/2026, 14:30 · Carlos Souza (TI)\nTestes de carga concluídos com sucesso.",
      slaViolado: false,
      tempoDecorridoSlaMinutos: 270,
      tempoRestanteSlaMinutos: 90,
      reaberto: false,
      reabertoEm: null,
      motivoReabertura: null,
      avaliacao: 5,
      relacionados: [],
      duplicadoDe: null,
    };

    const os = obterDadosOrdemServico(chamadoMock, {
      nome: "Carlos Souza",
      papel: "TECNICO",
    });

    expect(os.protocolo).toBe("20261025-0042");
    expect(os.titulo).toBe("Computador não liga na sala 12");
    expect(os.solicitanteNome).toBe("Maria Oliveira");
    expect(os.tecnicoNome).toBe("Carlos Souza");
    expect(os.statusFormatado).toBe("Resolvido");
    expect(os.prioridadeFormatada).toBe("Alta");
    expect(os.slaStatus).toBe("Cumprido no prazo");
    expect(os.anexos.length).toBe(1);
    expect(os.anexos[0].nome).toBe("foto.png");
    expect(os.registrosAtendimento.length).toBe(2);
    expect(os.registrosAtendimento[0].autor).toBe("Carlos Souza");
    expect(os.temAssinaturaDigital).toBe(true);
    expect(os.assinaturaImagem).toBe("data:image/png;base64,signature123");
  });
});
