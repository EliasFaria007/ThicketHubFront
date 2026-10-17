import { apiGet, apiPatch, apiPost } from "@/lib/http";
import type { Notificacao, Paginacao } from "@/types";

export interface CaixaNotificacoes {
  items: Notificacao[];
  naoLidas: number;
}

interface JavaNotificacoesList {
  notificacoes: Array<{
    id: number | string;
    usuarioId: number | string;
    chamadoId: number | string;
    tipo: string;
    lida: boolean;
    mensagem: string;
    criadoEm: string;
    protocolo?: string;
  }>;
  totalNaoLidas: number;
}

export async function listarNotificacoes(): Promise<CaixaNotificacoes> {
  try {
    // Tenta primeiro o endpoint de não lidas do backend Java
    const res = await apiGet<JavaNotificacoesList | CaixaNotificacoes | Paginacao<Notificacao>>("/notificacoes/nao-lidas");
    
    if (res && "notificacoes" in res) {
      const items: Notificacao[] = res.notificacoes.map((n) => ({
        id: String(n.id),
        usuarioId: String(n.usuarioId),
        chamadoId: String(n.chamadoId),
        protocolo: n.protocolo ?? `CH-${n.chamadoId}`,
        evento: (n.tipo ? n.tipo.toLowerCase() : "status") as Notificacao["evento"],
        titulo: n.mensagem,
        lida: n.lida,
        criadoEm: n.criadoEm,
      }));
      return {
        items,
        naoLidas: Number(res.totalNaoLidas || 0),
      };
    }

    if (res && "items" in res) {
      return res as CaixaNotificacoes;
    }
  } catch {
    // Fallback para GET /notificacoes padrão
  }

  const fallback = await apiGet<CaixaNotificacoes | Paginacao<Notificacao>>("/notificacoes");
  if (fallback && "items" in fallback && "naoLidas" in fallback) {
    return fallback as CaixaNotificacoes;
  }
  if (fallback && "items" in fallback) {
    return {
      items: fallback.items,
      naoLidas: (fallback.items as Notificacao[]).filter((i) => !i.lida).length,
    };
  }

  return { items: [], naoLidas: 0 };
}

/** Marca uma notificação como lida ou todas se id não for informado */
export async function marcarNotificacaoLida(id: number | string) {
  return apiPatch<void>(`/notificacoes/${id}/lida`);
}

export async function marcarTodasNotificacoesLidas() {
  return apiPatch<void>("/notificacoes/marcar-todas-lidas");
}

/** Função de conveniência para manter compatibilidade */
export async function marcarNotificacoesLidas(chamadoId?: string) {
  try {
    if (chamadoId) {
      await apiPatch<void>(`/notificacoes/chamado/${chamadoId}/lidas`);
    } else {
      await marcarTodasNotificacoesLidas();
    }
    return true;
  } catch {
    return apiPost<boolean>("/notificacoes/ler", chamadoId ? { chamadoId } : {});
  }
}
