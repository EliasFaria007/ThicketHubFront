import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Radio } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { desdeAgora } from "@/lib/format";
import { realtime, type StatusConexaoWs } from "@/lib/websocket";
import { listarNotificacoes, marcarNotificacoesLidas } from "@/services/notificacoes";
import { useAuthStore } from "@/stores/auth";

export function SinoNotificacoes() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const [statusWs, setStatusWs] = useState<StatusConexaoWs>("desconectado");

  useEffect(() => {
    if (token) {
      realtime.conectar(token);
    }

    const unsubStatus = realtime.onStatus((status) => {
      setStatusWs(status);
    });

    const unsubMsg = realtime.onMensagem(() => {
      void queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
      void queryClient.invalidateQueries({ queryKey: ["chamados"] });
      void queryClient.invalidateQueries({ queryKey: ["metricas"] });
    });

    return () => {
      unsubStatus();
      unsubMsg();
    };
  }, [token, queryClient]);

  const { data } = useQuery({
    queryKey: ["notificacoes"],
    queryFn: listarNotificacoes,
    refetchInterval: 30_000,
  });

  const marcarTodas = useMutation({
    mutationFn: () => marcarNotificacoesLidas(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notificacoes"] }),
  });

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
      <DropdownMenuContent align="end" className="w-80 p-0">
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
        <div className="max-h-80 overflow-y-auto">
          {itens.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nenhuma novidade nos seus chamados.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {itens.map((n) => (
                <li key={n.id}>
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
                        <p className="truncate text-sm text-foreground">{n.titulo}</p>
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
