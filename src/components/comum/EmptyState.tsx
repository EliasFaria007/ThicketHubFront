import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  titulo,
  descricao,
  acao,
  icone,
}: {
  titulo: string;
  descricao: string;
  acao?: ReactNode;
  icone?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="grid size-16 place-items-center rounded-2xl bg-primary-soft text-primary" aria-hidden>
        {icone ?? <Inbox className="size-7" />}
      </div>
      <h3 className="text-base font-semibold text-foreground">{titulo}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{descricao}</p>
      {acao ? <div className="mt-1">{acao}</div> : null}
    </div>
  );
}
