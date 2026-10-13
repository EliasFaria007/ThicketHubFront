import { ChevronDown, FileSignature, FileUp, Sparkles, UserCheck } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MODELOS_ASSINATURAS_PRONTAS,
  lerArquivoAssinaturaPronta,
  montarAssinaturaCompleta,
  type DadosUsuarioAssinatura,
} from "@/lib/assinatura";
import type { User } from "@/types";

interface BotaoAssinaturasProntasProps {
  onInserir: (textoAssinatura: string) => void;
  usuario?: User | null;
  label?: string;
  className?: string;
}

export function BotaoAssinaturasProntas({
  onInserir,
  usuario,
  label = "Assinaturas prontas",
  className,
}: BotaoAssinaturasProntasProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dadosUsuario: DadosUsuarioAssinatura = {
    nome: usuario?.nome ?? "Atendente Central de Serviços",
    setor: usuario?.setor ?? "Suporte TI",
    email: usuario?.email ?? "",
    telefone: usuario?.telefone ?? "",
  };

  async function handleArquivoSelecionado(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await lerArquivoAssinaturaPronta(file);
      if (res.tipo === "imagem") {
        onInserir(montarAssinaturaCompleta("", res.conteudo));
      } else {
        onInserir(res.conteudo);
      }
      toast.success(`Assinatura do arquivo "${res.nome}" anexada ao chamado!`);
    } catch (err: any) {
      toast.error("Erro ao ler arquivo da assinatura", { description: err?.message });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.html,.md,.png,.jpg,.jpeg,.webp,.pdf"
        className="sr-only"
        onChange={handleArquivoSelecionado}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`h-6 gap-1 px-1.5 text-xs text-primary hover:bg-primary-soft ${className ?? ""}`}
            title="Inserir ou anexar assinaturas prontas (estilo Outlook)"
          >
            <FileSignature className="size-3" />
            <span>{label}</span>
            <ChevronDown className="size-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          {usuario?.assinatura && (
            <>
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Meu perfil
                </DropdownMenuLabel>
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-xs"
                  onClick={() => {
                    onInserir(usuario.assinatura!);
                    toast.success("Sua assinatura padrão foi inserida no texto.");
                  }}
                >
                  <UserCheck className="size-3.5 text-primary" />
                  <span>Minha assinatura cadastrada</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="size-3 text-primary" />
              <span>Modelos institucionais prontos</span>
            </DropdownMenuLabel>
            {MODELOS_ASSINATURAS_PRONTAS.map((mod) => (
              <DropdownMenuItem
                key={mod.id}
                className="cursor-pointer flex flex-col items-start gap-0.5 text-xs py-1.5"
                onClick={() => {
                  const texto = mod.gerar(dadosUsuario);
                  onInserir(texto);
                  toast.success(`Modelo "${mod.titulo}" inserido no chamado.`);
                }}
              >
                <span className="font-medium text-foreground">{mod.titulo}</span>
                <span className="text-[10px] text-muted-foreground line-clamp-1">{mod.descricao}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="cursor-pointer gap-2 text-xs text-primary font-medium"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp className="size-3.5" />
            <span>Anexar arquivo de assinatura...</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
