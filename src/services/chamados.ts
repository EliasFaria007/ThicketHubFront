import { obterAnexosLocalmente, salvarAnexosLocalmente } from "@/lib/arquivos";
import { apiGet, apiPost, apiPut } from "@/lib/http";
import { slaAtrasado } from "@/lib/sla";
import type {
  Anexo,
  Chamado,
  Comentario,
  FiltrosChamados,
  Metricas,
  Paginacao,
  PrioridadeChamado,
  StatusChamado,
} from "@/types";

export type ChamadoResumo = Omit<Chamado, "comentarios" | "historico">;

// ---------------------------------------------------------------------------
// Adapters para normalizar respostas do backend Java
// ---------------------------------------------------------------------------

function adaptarComentario(com: any): Comentario {
  if (!com) return com;
  return {
    id: String(com.id),
    chamadoId: String(com.chamadoId ?? ""),
    mensagem: com.mensagem ?? "",
    interno: Boolean(com.interno ?? com.flagInterno),
    criadoEm: com.criadoEm ?? com.dataCriacao ?? com.dataHora ?? new Date().toISOString(),
    autor: com.autor ?? {
      id: String(com.autorId ?? com.usuarioId ?? ""),
      nome: com.autorNome ?? com.usuarioNome ?? "Usuário",
      papel: com.autorPapel ?? com.usuarioPapel ?? "usuario",
    },
  };
}

const ANEXOS_TAG_REGEX = /<!-- THICKET_ANEXOS:(.*?) -->/s;

export function extrairAnexosEOQueFoiFeito(rawOQueFoiFeito?: string | null): {
  oQueFoiFeito: string | null;
  anexos: Anexo[];
} {
  if (!rawOQueFoiFeito) return { oQueFoiFeito: null, anexos: [] };
  const match = rawOQueFoiFeito.match(ANEXOS_TAG_REGEX);
  if (!match) return { oQueFoiFeito: rawOQueFoiFeito, anexos: [] };
  try {
    const anexos = JSON.parse(match[1]!) as Anexo[];
    const limpo = rawOQueFoiFeito.replace(ANEXOS_TAG_REGEX, "").trim();
    return { oQueFoiFeito: limpo || null, anexos: Array.isArray(anexos) ? anexos : [] };
  } catch {
    return { oQueFoiFeito: rawOQueFoiFeito, anexos: [] };
  }
}

export function empacotarOQueFoiFeitoComAnexos(texto: string, anexos?: Anexo[]): string {
  const limpo = (texto || "").replace(ANEXOS_TAG_REGEX, "").trim();
  if (!anexos || anexos.length === 0) return limpo;
  return `${limpo}\n\n<!-- THICKET_ANEXOS:${JSON.stringify(anexos)} -->`;
}

function adaptarChamado(c: any): Chamado {
  if (!c) return c;
  const idStr = String(c.id);
  const { oQueFoiFeito, anexos: anexosExtraidos } = extrairAnexosEOQueFoiFeito(c.oQueFoiFeito);
  const anexosApi = Array.isArray(c.anexos) ? c.anexos : [];
  const anexosLocais = obterAnexosLocalmente(idStr);
  const anexosCombinados = [...anexosApi, ...anexosExtraidos, ...anexosLocais];
  const anexos = Array.from(new Map(anexosCombinados.map((a: Anexo) => [a.id || a.nome, a])).values());

  if (anexos.length > 0) {
    salvarAnexosLocalmente(idStr, anexos);
  }

  return {
    ...c,
    id: idStr,
    oQueFoiFeito: oQueFoiFeito ?? (c.oQueFoiFeito ? String(c.oQueFoiFeito) : null),
    anexos,
    criadoEm: c.criadoEm ?? c.dataAbertura ?? new Date().toISOString(),
    servicoId: String(c.servicoId ?? ""),
    solicitante: c.solicitante ?? {
      id: String(c.solicitanteId ?? ""),
      nome: c.solicitanteNome ?? "Solicitante",
      email: c.solicitanteEmail ?? "",
      setor: c.setor ?? "",
    },
    tecnico: c.tecnico ?? (c.tecnicoId ? {
      id: String(c.tecnicoId),
      nome: c.tecnicoNome ?? "Técnico",
      setor: c.filaSetor ?? c.setor ?? "",
    } : null),
    comentarios: (c.comentarios ?? []).map(adaptarComentario),
    historico: (c.historico ?? []).map((h: any) => ({
      ...h,
      id: String(h.id),
      criadoEm: h.criadoEm ?? h.dataEvento ?? h.dataHora ?? new Date().toISOString(),
      autorNome: h.autorNome ?? (h.autor ? h.autor.nome : "Sistema"),
    })),
    relacionados: Array.isArray(c.relacionados) ? c.relacionados.map(String) : [],
    duplicadoDe: c.duplicadoDe ? String(c.duplicadoDe) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Listagem e busca
// ---------------------------------------------------------------------------

export async function listarChamados(filtros: FiltrosChamados): Promise<Paginacao<ChamadoResumo>> {
  const data = await apiGet<Paginacao<any>>("/chamados", {
    status: filtros.status || undefined,
    prioridade: filtros.prioridade || undefined,
    setor: filtros.setor || undefined,
    servicoId: filtros.servicoId || undefined,
    fila: filtros.fila || undefined,
    busca: filtros.q || undefined,     // backend usa "busca" como nome do parâmetro
    page: filtros.page > 0 ? filtros.page - 1 : 0, // backend é 0-indexed (Spring Pageable)
    size: filtros.limit,                             // backend usa "size", não "limit"
    sort: filtros.ordenarPor ? `${filtros.ordenarPor},${filtros.ordem ?? "desc"}` : undefined,
  });

  const items = (data.items ?? []).map((item: any) => ({
    ...item,
    id: String(item.id),
    criadoEm: item.criadoEm ?? item.dataAbertura ?? new Date().toISOString(),
    solicitante: item.solicitante ?? {
      id: String(item.solicitanteId ?? ""),
      nome: item.solicitanteNome ?? "Solicitante",
      email: item.solicitanteEmail ?? "",
      setor: item.setor ?? "",
    },
    tecnico: item.tecnico ?? (item.tecnicoNome ? {
      id: String(item.tecnicoId ?? ""),
      nome: item.tecnicoNome,
      setor: item.filaSetor ?? item.setor ?? "",
    } : null),
  }));

  return {
    ...data,
    items,
  };
}

export async function obterChamado(id: string | number): Promise<Chamado> {
  const data = await apiGet<any>(`/chamados/${id}`);
  return adaptarChamado(data);
}

export async function obterChamadoPorProtocolo(protocolo: string): Promise<Chamado> {
  const data = await apiGet<any>(`/chamados/protocolo/${protocolo}`);
  return adaptarChamado(data);
}

export async function obterMetricas(): Promise<Metricas> {
  const raw = await apiGet<any>("/chamados/metricas");

  const abertos = Number(raw.abertos ?? raw.chamadosAbertos ?? 0);
  const emAndamento = Number(raw.emAndamento ?? raw.chamadosEmAndamento ?? 0);
  const resolvidos = Number(raw.resolvidos ?? raw.chamadosResolvidos ?? 0);
  const fechados = Number(raw.fechados ?? raw.chamadosFechados ?? 0);
  const cancelados = Number(raw.cancelados ?? raw.chamadosCancelados ?? 0);
  const pausados = Number(raw.pausados ?? raw.chamadosPausados ?? 0);
  const totalChamados = Number(raw.totalChamados ?? (abertos + emAndamento + resolvidos + fechados + cancelados + pausados));

  let porSetor = raw.porSetor ?? [];
  let atrasados = Number(raw.atrasados ?? 0);

  // Se o back-end Java não retornar porSetor ou atrasados, agregamos através da listagem de chamados
  if (!porSetor || porSetor.length === 0) {
    try {
      const chamadosResp = await listarChamados({ page: 1, limit: 100 });
      const contagemSetor: Record<string, number> = {};
      let totalAtrasados = 0;

      for (const c of chamadosResp.items) {
        if (c.setor) {
          contagemSetor[c.setor] = (contagemSetor[c.setor] ?? 0) + 1;
        }
        if (slaAtrasado(c)) {
          totalAtrasados++;
        }
      }

      porSetor = Object.entries(contagemSetor).map(([setor, total]) => ({ setor, total }));
      if (atrasados === 0) {
        atrasados = totalAtrasados;
      }
    } catch {
      // Caso a listagem falhe, mantém padrão
    }
  }

  const porStatus = raw.porStatus ?? [
    { status: "aberto" as const,         total: abertos },
    { status: "em_atendimento" as const, total: emAndamento },
    { status: "pausado" as const,        total: pausados },
    { status: "resolvido" as const,      total: resolvidos },
    { status: "fechado" as const,        total: fechados },
    { status: "cancelado" as const,      total: cancelados },
  ].filter((s) => s.total > 0);

  return {
    ...raw,
    totalChamados,
    abertos,
    emAndamento,
    resolvidos,
    fechados,
    cancelados,
    pausados,
    atrasados,
    porStatus,
    porSetor,
    ultimos7Dias: raw.ultimos7Dias ?? [],
  };
}

// ---------------------------------------------------------------------------
// Criação
// ---------------------------------------------------------------------------

export interface NovoChamadoPayload {
  titulo: string;
  descricao: string;
  servicoId: number | string;
}

export async function criarChamado(payload: NovoChamadoPayload): Promise<Chamado> {
  const data = await apiPost<any>("/chamados", {
    ...payload,
    servicoId: Number(payload.servicoId),
  });
  return adaptarChamado(data);
}

// ---------------------------------------------------------------------------
// Atualização genérica (prioridade, campo oQueFoiFeito)
// ---------------------------------------------------------------------------

export interface AtualizarChamadoPayload {
  status?: StatusChamado;
  prioridade?: PrioridadeChamado;
  oQueFoiFeito?: string;
  versao?: number;
  anexos?: Anexo[];
}

export async function atualizarChamado(id: string | number, payload: AtualizarChamadoPayload): Promise<Chamado> {
  const { anexos, ...resto } = payload;
  let oQueFoiFeitoEnviado = resto.oQueFoiFeito;

  const anexosFinais = anexos !== undefined ? anexos : obterAnexosLocalmente(id);

  if (anexosFinais.length > 0 || anexos !== undefined) {
    oQueFoiFeitoEnviado = empacotarOQueFoiFeitoComAnexos(oQueFoiFeitoEnviado ?? "", anexosFinais);
  }

  if (anexosFinais.length > 0) {
    salvarAnexosLocalmente(id, anexosFinais);
  }

  const data = await apiPut<any>(`/chamados/${id}`, {
    ...resto,
    ...(oQueFoiFeitoEnviado !== undefined ? { oQueFoiFeito: oQueFoiFeitoEnviado } : {}),
    ...(anexosFinais.length > 0 ? { anexos: anexosFinais } : {}),
  });
  return adaptarChamado(data);
}

// ---------------------------------------------------------------------------
// Ações de fluxo (endpoints dedicados no ChamadoController)
// ---------------------------------------------------------------------------

/** Técnico assume o chamado da fila. */
export async function assumirChamado(id: string | number): Promise<Chamado> {
  const data = await apiPost<any>(`/chamados/${id}/assumir`);
  return adaptarChamado(data);
}

/** Técnico pausa o atendimento. */
export async function pausarChamado(id: string | number): Promise<Chamado> {
  const data = await apiPost<any>(`/chamados/${id}/pausar`);
  return adaptarChamado(data);
}

/** Técnico retoma um chamado pausado. */
export async function retomarChamado(id: string | number): Promise<Chamado> {
  const data = await apiPost<any>(`/chamados/${id}/retomar`);
  return adaptarChamado(data);
}

/**
 * Técnico registra o que foi feito e resolve o chamado.
 * Endpoint: POST /chamados/{id}/resolver
 * Requer o campo `oQueFoiFeito` (mínimo 10 caracteres).
 */
export async function resolverChamado(id: string | number, oQueFoiFeito: string): Promise<Chamado> {
  const data = await apiPost<any>(`/chamados/${id}/resolver`, { oQueFoiFeito });
  return adaptarChamado(data);
}

/**
 * Técnico devolve o chamado para a fila geral.
 * Endpoint: POST /chamados/{id}/devolver
 */
export async function devolverChamado(id: string | number, motivo: string): Promise<Chamado> {
  const data = await apiPost<any>(`/chamados/${id}/devolver`, { motivo });
  return adaptarChamado(data);
}

/**
 * Encaminha o chamado para outro técnico ou fila.
 * Endpoint: POST /chamados/{id}/encaminhar
 * `filaSetor` deve corresponder ao nome da fila de destino.
 */
export async function encaminharChamado(
  id: string | number,
  payload: { tecnicoId?: number | string; filaSetor?: string; motivo: string },
): Promise<Chamado> {
  const data = await apiPost<any>(`/chamados/${id}/encaminhar`, {
    tecnicoId: payload.tecnicoId ? Number(payload.tecnicoId) : undefined,
    filaSetor: payload.filaSetor,
    motivo: payload.motivo,
  });
  return adaptarChamado(data);
}

/**
 * Reabre um chamado resolvido (exclusivo admin/superusuário).
 * Endpoint: POST /chamados/{id}/reabrir
 */
export async function reabrirChamado(id: string | number, justificativa?: string): Promise<Chamado> {
  const texto = justificativa?.trim() || "Reabertura autorizada pelo administrador";
  const data = await apiPost<any>(`/chamados/${id}/reabrir`, {
    justificativa: texto,
    motivo: texto,
  });
  return adaptarChamado(data);
}

/**
 * Solicitante avalia o atendimento após resolução.
 * Endpoint: POST /chamados/{id}/avaliar
 * `nota` deve ser de 1 a 5.
 */
export async function avaliarChamado(id: string | number, nota: number, comentario?: string): Promise<Chamado> {
  const data = await apiPost<any>(`/chamados/${id}/avaliar`, { nota, comentario });
  return adaptarChamado(data);
}

// ---------------------------------------------------------------------------
// Comentários
// ---------------------------------------------------------------------------

export async function comentarChamado(id: string | number, payload: { mensagem: string; interno?: boolean }): Promise<Comentario> {
  const data = await apiPost<any>(`/chamados/${id}/comentarios`, {
    mensagem: payload.mensagem,
    flagInterno: payload.interno ?? false,
  });
  return adaptarComentario(data);
}

export async function listarComentarios(id: string | number): Promise<Comentario[]> {
  const data = await apiGet<any[]>(`/chamados/${id}/comentarios`);
  return (data ?? []).map(adaptarComentario);
}

// ---------------------------------------------------------------------------
// Vínculo entre chamados
// ---------------------------------------------------------------------------

/**
 * Vincula dois chamados como relacionados ou duplicados.
 * Endpoint: POST /chamados/{id}/vincular
 */
export async function vincularChamado(
  id: string | number,
  payload: {
    protocolo?: string;
    chamadoDestinoId?: number | string;
    tipo: "relacionado" | "duplicado" | "RELACIONADO" | "DUPLICADO" | "FILHO" | "PAI";
  },
) {
  let destinoId = payload.chamadoDestinoId;
  if (!destinoId && payload.protocolo) {
    try {
      const chamadoDestino = await obterChamadoPorProtocolo(payload.protocolo.trim());
      destinoId = chamadoDestino.id;
    } catch {
      // Em modo demo ou fallback
    }
  }

  return apiPost<void>(`/chamados/${id}/vincular`, {
    chamadoDestinoId: destinoId ? Number(destinoId) : undefined,
    protocolo: payload.protocolo,
    tipo: (payload.tipo || "RELACIONADO").toUpperCase(),
  });
}
