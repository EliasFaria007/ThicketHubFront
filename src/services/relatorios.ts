import { apiGet, USANDO_DEMO } from "@/lib/http";
import type { FiltrosRelatorio, Metricas, Relatorios } from "@/types";

export interface MetricasGerais {
  totalChamados: number;
  chamadosAbertos: number;
  chamadosEmAndamento: number;
  chamadosResolvidos: number;
  chamadosFechados: number;
  chamadosCancelados: number;
  chamadosPausados: number;
  totalUsuarios: number;
  totalTecnicos: number;
  totalAdmins: number;
  percentualSlaAtendido: number;
}

export function obterRelatorioGeral() {
  return apiGet<MetricasGerais>("/relatorios/geral");
}

export async function obterRelatorios(filtros: FiltrosRelatorio): Promise<Relatorios> {
  // No modo demo, o mock responde diretamente em /relatorios com a estrutura completa
  if (USANDO_DEMO) {
    return apiGet<Relatorios>("/relatorios", {
      de: filtros.de || undefined,
      ate: filtros.ate || undefined,
      setor: filtros.setor || undefined,
      status: filtros.status || undefined,
      prioridade: filtros.prioridade || undefined,
      tecnicoId: filtros.tecnicoId || undefined,
      servicoId: filtros.servicoId || undefined,
    });
  }

  // No backend Java real, o endpoint disponível é /relatorios/geral
  const m = await apiGet<MetricasGerais | Metricas>("/relatorios/geral");
  const total =
    "totalChamados" in m
      ? m.totalChamados
      : ((m as Metricas).abertos ?? 0) + ((m as Metricas).emAndamento ?? 0) + ((m as Metricas).resolvidos ?? 0);
  const resolvidos = "chamadosResolvidos" in m ? m.chamadosResolvidos : ((m as Metricas).resolvidos ?? 0);
  const abertos = "chamadosAbertos" in m ? m.chamadosAbertos : ((m as Metricas).abertos ?? 0);
  const emAndamento = "chamadosEmAndamento" in m ? m.chamadosEmAndamento : ((m as Metricas).emAndamento ?? 0);
  const cancelados = "chamadosCancelados" in m ? m.chamadosCancelados : 0;
  const fechados = "chamadosFechados" in m ? m.chamadosFechados : 0;
  const pausados = "chamadosPausados" in m ? m.chamadosPausados : 0;
  const totalUsuarios = "totalUsuarios" in m ? m.totalUsuarios : ((m as Metricas).totalUsuarios ?? 0);

  return {
    totalChamados: total,
    porSetor: (m as Metricas).porSetor
      ? (m as Metricas).porSetor!.map((s) => ({ chave: s.setor, total: s.total, resolvidos: 0, atrasados: 0 }))
      : [],
    porStatus: [
      { chave: "aberto", total: abertos },
      { chave: "em_andamento", total: emAndamento },
      { chave: "pausado", total: pausados },
      { chave: "resolvido", total: resolvidos },
      { chave: "fechado", total: fechados },
      { chave: "cancelado", total: cancelados },
    ],
    porPrioridade: [],
    porServico: [],
    tecnicos: [],
    periodo: { resolvidos, cancelados, reabertos: 0 },
    tempos: { medioAtendimentoHoras: 0, medioResolucaoHoras: 0 },
    usuarios: {
      cadastrados: totalUsuarios,
      ativos: totalUsuarios,
    },
    satisfacao: { media: 5, avaliacoes: 0, distribuicao: [] },
    encaminhamentos: [],
  };
}
