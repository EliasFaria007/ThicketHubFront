import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Laptop, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { desdeAgora } from "@/lib/format";
import {
  dispararNotificacaoNativa,
  obterStatusPermissao,
  solicitarPermissaoNotificacoes,
  suportaNotificacoesWeb,
  type StatusPermissaoWeb,
} from "@/lib/web-push";
import { realtime, type StatusConexaoWs } from "@/lib/websocket";
import { listarNotificacoes, marcarNotificacoesLidas } from "@/services/notificacoes";
import { useAuthStore } from "@/stores/auth";

export function SinoNotificacoes() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const [statusWs, setStatusWs] = useState<StatusConexaoWs>("desconectado");
  const [permissaoWeb, setPermissaoWeb] = useState<StatusPermissaoWeb>("unsupported");
  const ultimosIdsVistos = useRef<Set<string>>(new Set());
  const isPrimeiraCarga = useRef(true);

  useEffect(() => {
    setPermissaoWeb(obterStatusPermissao());
  }, []);

  useEffect(() => {
    if (token) {
      realtime.conectar(token);
    }

    const unsubStatus = realtime.onStatus((status) => {
      setStatusWs(status);
    });

    const unsubMsg = realtime.onMensagem((msg: any) => {
      void queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
      void queryClient.invalidateQueries({ queryKey: ["chamados"] });
      void queryClient.invalidateQueries({ queryKey: ["metricas"] });

      // Dispara notificação nativa no Windows se a permissão foi concedida
      if (suportaNotificacoesWeb() && obterStatusPermissao() === "granted") {
        const titulo = msg?.titulo || msg?.mensagem || "Atualização em Chamado";
        const corpo = msg?.protocolo ? `Protocolo #${msg.protocolo}` : (msg?.descricao || "Há uma nova atualização para você.");
        void dispararNotificacaoNativa(`ThicketHub · ${titulo}`, {
          body: corpo,
          url: msg?.chamadoId ? `/chamados/${msg.chamadoId}` : "/chamados",
        });
      }
    });

    return () => {
      unsubStatus();
      unsubMsg();
    };
  }, [token, queryClient]);

  const { data } = useQuery({
    queryKey: ["notificacoes"],
    queryFn: listarNotificacoes,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  });

  // Emite notificação no navegador (popup) e no Windows (nativo) para novos itens recebidos via polling
  useEffect(() => {
    if (!data?.items) return;

    if (isPrimeiraCarga.current) {
      data.items.forEach((n) => ultimosIdsVistos.current.add(n.id));
      isPrimeiraCarga.current = false;
      return;
    }

    const novosNaoLidos = data.items.filter(
      (n) => !n.lida && !ultimosIdsVistos.current.has(n.id),
    );

    if (novosNaoLidos.length > 0) {
      novosNaoLidos.forEach((item) => {
        // 1. Popup no Navegador (Sonner Toast interativo)
        toast.info(`🔔 ${item.titulo}`, {
          description: `${item.protocolo} · ${desdeAgora(item.criadoEm)}`,
          action: {
            label: "Ver chamado",
            onClick: () => {
              window.location.href = `/chamados/${item.chamadoId}`;
            },
          },
          duration: 8000,
        });

        // 2. Alerta nativo no Windows / Sistema Operacional
        if (suportaNotificacoesWeb() && obterStatusPermissao() === "granted") {
          void dispararNotificacaoNativa(`ThicketHub · ${item.titulo}`, {
            body: `${item.protocolo} · ${desdeAgora(item.criadoEm)}`,
            url: `/chamados/${item.chamadoId}`,
          });
        }
      });
    }

    // Atualiza o conjunto de ids conhecidos
    data.items.forEach((n) => ultimosIdsVistos.current.add(n.id));
  }, [data?.items]);

  const marcarTodas = useMutation({
    mutationFn: () => marcarNotificacoesLidas(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notificacoes"] }),
  });

  async function handleSolicitarPermissao() {
    const res = await solicitarPermissaoNotificacoes();
    setPermissaoWeb(res);
    if (res === "granted") {
      toast.success("Notificações no navegador ativadas com sucesso!");
    } else if (res === "denied") {
      toast.info("Notificações desativadas nas configurações do navegador.");
    }
  }

  async function handleTestarNotificacao() {
    // 1. Dispara popup imediato no navegador
    toast.info("🔔 ThicketHub · Teste de Notificação", {
      description: "Notificação interna no navegador funcionando perfeitamente!",
      action: {
        label: "Ver chamados",
        onClick: () => {
          window.location.href = "/chamados";
        },
      },
      duration: 6000,
    });

    // 2. Se a permissão no Windows ainda for default, solicita ao usuário
    let perm = obterStatusPermissao();
    if (perm === "default") {
      perm = await solicitarPermissaoNotificacoes();
      setPermissaoWeb(perm);
    }

    // 3. Dispara alerta na área de trabalho / Windows
    if (perm === "granted") {
      const ok = await dispararNotificacaoNativa("ThicketHub · Notificação Windows", {
        body: "Alerta na área de trabalho e no Windows funcionando com sucesso!",
        url: "/chamados",
      });
      if (ok) {
        toast.success("Notificação enviada para a área de trabalho do Windows!");
      } else {
        toast.error("Não foi possível exibir no Windows. Verifique se as notificações do sistema estão liberadas.");
      }
    } else {
      toast.warning("Para ver o alerta no Windows, permita notificações no navegador.");
    }
  }

  const naoLidas = data?.naoLidas ?? 0;
  const itens = data?.items ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            naoLidas > 0 ? `Notificações: ${naoLidas} não lidas` : "Notificações: nenhuma pendência"
          }
        >
          <Bell className="size-5" />
          {naoLidas > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4.5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4.5 text-destructive-foreground">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-88 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Notificações</p>
            {statusWs === "conectado" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Ao vivo
              </span>
            )}
          </div>
          {naoLidas > 0 ? (
            <button
              type="button"
              onClick={() => marcarTodas.mutate()}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <CheckCheck className="size-3.5" /> Marcar como lidas
            </button>
          ) : null}
        </div>

        {/* Faixa de controle explícito de Notificações do Navegador */}
        {suportaNotificacoesWeb() && (
          <div className="border-b border-border bg-muted/30 px-3 py-2 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
              <Laptop className="size-3.5 shrink-0" />
              {permissaoWeb === "granted" ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium truncate">
                  Alertas de Desktop Ativos
                </span>
              ) : permissaoWeb === "denied" ? (
                <span className="text-muted-foreground truncate">Bloqueado no navegador</span>
              ) : (
                <span className="truncate">Alertas de Desktop Desativados</span>
              )}
            </div>

            {permissaoWeb === "default" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSolicitarPermissao}
                className="h-6 text-[11px] px-2 font-medium"
              >
                Ativar
              </Button>
            )}

            {permissaoWeb === "granted" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleTestarNotificacao}
                className="h-6 text-[11px] px-2 text-primary hover:text-primary"
                title="Disparar notificação de teste"
              >
                <Send className="mr-1 size-3" />
                Testar
              </Button>
            )}
          </div>
        )}

        <div className="max-h-80 overflow-y-auto">
          {itens.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nenhuma novidade nos seus chamados.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {itens.map((n) => (
                <li key={n.id} className={n.lida ? "opacity-60" : ""}>
                  <Link
                    to="/chamados/$id"
                    params={{ id: n.chamadoId }}
                    className="block px-3 py-2.5 transition-soft hover:bg-muted"
                  >
                    <div className="flex items-start gap-2">
                      {!n.lida ? (
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                      ) : (
                        <span className="mt-1.5 size-2 shrink-0" aria-hidden />
                      )}
                      <div className="min-w-0">
                        <p className={`truncate text-sm ${n.lida ? "text-muted-foreground" : "font-semibold text-foreground"}`}>
                          {n.titulo}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {n.protocolo} · {desdeAgora(n.criadoEm)}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
