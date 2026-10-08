import { apiGet } from "@/lib/http";
import type { Paginacao, RegistroAuditoria } from "@/types";

export function listarAuditoria(params: {
  q?: string;
  usuarioId?: number | string;
  acao?: string;
  inicio?: string;
  fim?: string;
  page: number;
  limit: number;
}) {
  return apiGet<Paginacao<RegistroAuditoria>>("/auditoria", {
    acao: params.acao || params.q || undefined,
    usuarioId: params.usuarioId ? Number(params.usuarioId) : undefined,
    inicio: params.inicio || undefined,
    fim: params.fim || undefined,
    page: params.page > 0 ? params.page - 1 : 0,
    size: params.limit,
  });
}
