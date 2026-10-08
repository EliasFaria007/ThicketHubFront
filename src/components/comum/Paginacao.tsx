import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PaginacaoBarra({
  page,
  totalPages,
  total,
  limit,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}) {
  const inicio = total === 0 ? 0 : (page - 1) * limit + 1;
  const fim = Math.min(page * limit, total);

  return (
    <nav
      aria-label="Paginação de chamados"
      className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Exibindo <strong className="text-foreground">{inicio}</strong>–
        <strong className="text-foreground">{fim}</strong> de{" "}
        <strong className="text-foreground">{total}</strong> registros
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" /> Anterior
        </Button>
        <span className="px-1 text-sm font-medium">
          {page} de {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Próxima página"
        >
          Próxima <ChevronRight className="size-4" />
        </Button>
      </div>
    </nav>
  );
}
