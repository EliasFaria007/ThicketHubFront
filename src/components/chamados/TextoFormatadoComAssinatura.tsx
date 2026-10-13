import { extrairTextoEImagemAssinatura } from "@/lib/assinatura";
import { textoSeguro } from "@/lib/sanitize";
import { cn } from "@/lib/utils";

interface TextoFormatadoComAssinaturaProps {
  conteudo: string | null | undefined;
  className?: string;
  limite?: number;
}

/**
 * Renderiza o corpo do texto de comentários, pareceres ou descrições
 * exibindo assinaturas com imagem como elementos gráficos reais <img>
 * ao invés de códigos brutos e símbolos de base64.
 */
export function TextoFormatadoComAssinatura({
  conteudo,
  className,
  limite = 5000,
}: TextoFormatadoComAssinaturaProps) {
  if (!conteudo) return null;

  const { texto, imagem } = extrairTextoEImagemAssinatura(conteudo);

  return (
    <div className={cn("space-y-2", className)}>
      {texto ? (
        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
          {textoSeguro(texto, limite)}
        </p>
      ) : null}

      {imagem ? (
        <div className="pt-1.5">
          <img
            src={imagem}
            alt="Assinatura gráfica"
            className="max-h-24 max-w-xs rounded border border-border bg-white p-1 object-contain shadow-xs dark:bg-card"
          />
        </div>
      ) : null}
    </div>
  );
}
