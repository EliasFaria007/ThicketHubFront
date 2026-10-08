import { apiGet } from "@/lib/http";
import type { Paginacao, RegistroAuditoria } from "@/types";

export async function listarAuditoria(params: {
  q?: string;
  usuarioId?: number | string;
  acao?: string;
  inicio?: string;
  fim?: string;
  page: number;
  limit: number;
}): Promise<Paginacao<RegistroAuditoria>> {
  const res = await apiGet<Paginacao<RegistroAuditoria & { ipOrigem?: string }>>("/auditoria", {
    acao: params.acao || params.q || undefined,
    usuarioId: params.usuarioId ? Number(params.usuarioId) : undefined,
    inicio: params.inicio || undefined,
    fim: params.fim || undefined,
    page: params.page > 0 ? params.page - 1 : 0,
    size: params.limit,
  });

  if (res && Array.isArray(res.items)) {
    res.items = res.items.map((item) => {
      let ipFinal = item.ip || item.ipOrigem || "127.0.0.1";
      if (ipFinal === "0:0:0:0:0:0:0:1" || ipFinal === "::1" || ipFinal === "0.0.0.0") {
        ipFinal = "127.0.0.1";
      }
      return {
        ...item,
        ip: ipFinal,
      };
    });
  }

  return res;
}
