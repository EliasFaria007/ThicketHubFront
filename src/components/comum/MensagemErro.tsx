import { AlertCircle } from "lucide-react";

import { ApiError } from "@/lib/http";
import { textoSeguro } from "@/lib/sanitize";

export function MensagemErro({ erro }: { erro: unknown }) {
  const mensagem =
    erro instanceof ApiError
      ? erro.message
      : erro instanceof Error
        ? erro.message
        : "Não foi possível carregar as informações.";
  const detalhes = erro instanceof ApiError ? erro.errors : [];

  return (
    <div
      role="alert"
      className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive-soft p-4 text-sm text-destructive"
    >
      <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div>
        <p className="font-semibold">{textoSeguro(mensagem)}</p>
        {detalhes.length > 0 && (
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {detalhes.map((d, i) => (
              <li key={i}>{textoSeguro(d)}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
