import { useEffect, useState } from "react";
import { Bell, Check, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  conviteFoiDispensado,
  dispensarConviteNotificacao,
  dispararNotificacaoNativa,
  obterStatusPermissao,
  solicitarPermissaoNotificacoes,
  suportaNotificacoesWeb,
} from "@/lib/web-push";

export function BannerSolicitacaoNotificacao() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (suportaNotificacoesWeb() && !conviteFoiDispensado()) {
      setVisivel(obterStatusPermissao() === "default");
    }
  }, []);

  if (!visivel) return null;

  async function handleAtivar() {
    const permissao = await solicitarPermissaoNotificacoes();
    setVisivel(false);
    if (permissao === "granted") {
      toast.success("Notificações no navegador ativadas com sucesso!");
      void dispararNotificacaoNativa("ThicketHub · Notificações Ativadas", {
        body: "Alertas na área de trabalho e no Windows estão prontos!",
        url: "/chamados",
      });
    } else if (permissao === "denied") {
      toast.info("Notificações desativadas. Você pode reativá-las nas configurações do navegador.");
    }
  }

  function handleDispensar() {
    dispensarConviteNotificacao();
    setVisivel(false);
  }

  return (
    <aside
      aria-label="Convite para ativar notificações no navegador"
      className="border-b border-primary/20 bg-primary/10 px-4 py-2.5 text-xs text-foreground animate-in fade-in slide-in-from-top-1 duration-200"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Bell className="size-3.5" />
          </div>
          <p className="truncate sm:overflow-visible">
            <strong className="font-semibold">Ativar notificações na área de trabalho?</strong>{" "}
            <span className="hidden md:inline text-muted-foreground">
              Receba alertas imediatos quando seus chamados forem respondidos ou atualizados, mesmo em segundo plano.
            </span>
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            onClick={handleAtivar}
            className="h-7 px-2.5 text-xs font-medium"
          >
            <Check className="mr-1 size-3" />
            Ativar Notificações
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDispensar}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Dispensar convite"
          >
            <X className="size-3.5" />
            <span className="hidden sm:inline ml-1">Agora não</span>
          </Button>
        </div>
      </div>
    </aside>
  );
}
