import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/http";
import type { PrioridadeChamado, Servico, SlaConfig } from "@/types";

// ---------------------------------------------------------------------------
// Catálogo de serviços
// ---------------------------------------------------------------------------

/**
 * Lista serviços do catálogo.
 * Endpoint: GET /catalogo/servicos?apenasAtivos=true|false
 */
export function listarServicos(params?: { incluirInativos?: boolean }) {
  const apenasAtivos = params?.incluirInativos ? "false" : "true";
  return apiGet<Servico[]>("/catalogo/servicos", { apenasAtivos });
}

export function listarServicosPorSetor(setor: string) {
  return apiGet<Servico[]>(`/catalogo/servicos/setor/${encodeURIComponent(setor)}`);
}

export function obterServico(id: string | number) {
  return apiGet<Servico>(`/catalogo/servicos/${id}`);
}

export interface ServicoPayload {
  nome: string;
  setor: string;
  prioridade: PrioridadeChamado;
  slaAtendimentoHoras: number;
  slaResolucaoHoras: number;
  ativo?: boolean;
}

/** Cria um novo serviço no catálogo (exclusivo superusuário). */
export function criarServico(payload: ServicoPayload) {
  return apiPost<Servico>("/catalogo/servicos", payload);
}

/** Desativa um serviço (exclusivo superusuário). */
export function desativarServico(id: string | number) {
  return apiDelete<void>(`/catalogo/servicos/${id}`);
}

/** Reativa um serviço desativado (exclusivo superusuário). */
export function ativarServico(id: string | number) {
  return apiPatch<void>(`/catalogo/servicos/${id}/ativar`);
}

/**
 * Atualiza um serviço existente.
 * Se apenas a propriedade `ativo` for enviada, delega para o endpoint correto de ativação/desativação do Spring Boot.
 */
export async function atualizarServico(id: string | number, payload: Partial<ServicoPayload>) {
  if (Object.keys(payload).length === 1 && typeof payload.ativo === "boolean") {
    if (payload.ativo) {
      await ativarServico(id);
    } else {
      await desativarServico(id);
    }
    return { id: String(id), ativo: payload.ativo } as unknown as Servico;
  }
  return apiPut<Servico>(`/catalogo/servicos/${id}`, payload);
}

// ---------------------------------------------------------------------------
// Configuração de SLA
// ---------------------------------------------------------------------------

export interface SlaConfigItem {
  id?: number;
  prioridade: PrioridadeChamado;
  slaAtendimentoHoras: number;
  slaResolucaoHoras: number;
}

const SLA_PADRAO: SlaConfig = {
  baixa: { atendimentoHoras: 48, resolucaoHoras: 120 },
  media: { atendimentoHoras: 24, resolucaoHoras: 72 },
  alta: { atendimentoHoras: 8, resolucaoHoras: 24 },
  critica: { atendimentoHoras: 2, resolucaoHoras: 8 },
};

/**
 * Obtém os parâmetros de SLA.
 * O back-end Java retorna uma lista `List<SlaConfigResponse>`.
 * Adaptamos para o formato `Record<PrioridadeChamado, SlaPrioridade>` esperado pelo formulário.
 */
export async function obterSla(): Promise<SlaConfig> {
  try {
    const raw = await apiGet<SlaConfigItem[] | SlaConfig>("/sla");
    if (!raw) return SLA_PADRAO;
    if (!Array.isArray(raw)) {
      return { ...SLA_PADRAO, ...raw };
    }
    const resultado: SlaConfig = { ...SLA_PADRAO };
    for (const item of raw) {
      if (item && item.prioridade) {
        const p = String(item.prioridade).toLowerCase() as PrioridadeChamado;
        if (resultado[p] !== undefined) {
          resultado[p] = {
            atendimentoHoras: item.slaAtendimentoHoras ?? resultado[p].atendimentoHoras,
            resolucaoHoras: item.slaResolucaoHoras ?? resultado[p].resolucaoHoras,
          };
        }
      }
    }
    return resultado;
  } catch {
    return SLA_PADRAO;
  }
}

/** Lista todas as configurações de SLA no formato plano de array do back-end. */
export function listarSlaConfigs() {
  return apiGet<SlaConfigItem[]>("/sla");
}

/** Obtém a configuração de SLA para uma prioridade específica. */
export function obterSlaPorPrioridade(prioridade: PrioridadeChamado) {
  return apiGet<SlaConfigItem>(`/sla/${prioridade.toUpperCase()}`);
}

/** Cria ou atualiza uma configuração de SLA no backend. */
export function salvarSlaConfig(payload: { prioridade: PrioridadeChamado; slaAtendimentoHoras: number; slaResolucaoHoras: number }) {
  return apiPut<SlaConfigItem>("/sla", {
    prioridade: payload.prioridade.toUpperCase(),
    slaAtendimentoHoras: payload.slaAtendimentoHoras,
    slaResolucaoHoras: payload.slaResolucaoHoras,
  });
}

/**
 * Salva a configuração de SLA aceitando o formato `SlaConfig` (objeto) ou array.
 */
export async function salvarSla(payload: SlaConfig | SlaConfigItem[]) {
  if (Array.isArray(payload)) {
    for (const item of payload) {
      await salvarSlaConfig(item);
    }
    return payload;
  }
  for (const [prioridade, config] of Object.entries(payload)) {
    if (config && typeof config === "object") {
      await salvarSlaConfig({
        prioridade: prioridade as PrioridadeChamado,
        slaAtendimentoHoras: config.atendimentoHoras,
        slaResolucaoHoras: config.resolucaoHoras,
      });
    }
  }
  return payload;
}
