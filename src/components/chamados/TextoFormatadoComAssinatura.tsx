import { useState } from "react";
import { extrairTextoEImagemAssinatura } from "@/lib/assinatura";
import { textoSeguro } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface TextoFormatadoComAssinaturaProps {
  conteudo: string | null | undefined;
  className?: string;
  limite?: number;
  aoClicarImagem?: (imagem: string) => void;
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
  aoClicarImagem,
}: TextoFormatadoComAssinaturaProps) {
  const [modalAberta, setModalAberta] = useState(false);
  if (!conteudo) return null;

  const { texto, imagem } = extrairTextoEImagemAssinatura(conteudo);

  function handleImageClick() {
    if (aoClicarImagem && imagem) {
      aoClicarImagem(imagem);
    } else {
      setModalAberta(true);
    }
  }

  return (
    <>
      <div className={cn("space-y-2", className)}>
        {texto ? (
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
            {textoSeguro(texto, limite)}
          </p>
        ) : null}

        {imagem ? (
          <div className="pt-1.5 print:pt-1">
            <button
              type="button"
              onClick={handleImageClick}
              className="cursor-zoom-in rounded border border-border bg-white p-1 shadow-xs transition-opacity hover:opacity-90 dark:bg-card print:border-none print:shadow-none print:p-0"
              title="Clique para visualizar assinatura expandida"
            >
              <img
                src={imagem}
                alt="Assinatura gráfica"
                className="max-h-24 max-w-xs object-contain print:max-h-14"
              />
            </button>
          </div>
        ) : null}
      </div>

      {!aoClicarImagem && imagem && (
        <Dialog open={modalAberta} onOpenChange={setModalAberta}>
          <DialogContent className="max-w-xl p-4">
            <DialogHeader>
              <DialogTitle className="text-sm font-medium">Assinatura Gráfica Institucional</DialogTitle>
            </DialogHeader>
            <div className="grid place-items-center rounded-lg border border-border bg-white p-4 dark:bg-card">
              <img
                src={imagem}
                alt="Assinatura gráfica expandida"
                className="max-h-[60vh] w-auto max-w-full rounded object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
