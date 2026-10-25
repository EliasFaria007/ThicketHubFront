import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
  BookMarked,
  BarChart3,
  FileText,
  HelpCircle,
  History,
  LayoutDashboard,
  Loader2,
  PlusCircle,
  Search,
  Ticket,
  User,
  Users,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { StatusBadge } from "@/components/chamados/StatusBadge";
import { listarChamados } from "@/services/chamados";
import { podeExecutar, useAuthStore } from "@/stores/auth";
import type { StatusChamado } from "@/types";

interface BuscaRapidaModalProps {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
}

export function BuscaRapidaModal({ aberto, aoMudarAberto }: BuscaRapidaModalProps) {
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  // Debounce da busca textual para evitar requisições a cada tecla
  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscaDebounced(busca.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [busca]);

  // Limpa o termo quando fecha o modal
  useEffect(() => {
    if (!aberto) {
      setBusca("");
      setBuscaDebounced("");
    }
  }, [aberto]);

  // Consulta à API de chamados
  const { data, isLoading } = useQuery({
    queryKey: ["busca-rapida-chamados", buscaDebounced],
    queryFn: async () => {
      if (!buscaDebounced || buscaDebounced.length < 2) return [];
      const res = await listarChamados({
        q: buscaDebounced,
        limit: 8,
        page: 1,
      });
      return res.items || [];
    },
    enabled: aberto && buscaDebounced.length >= 2,
    staleTime: 10_000,
  });

  const chamados = data || [];

  function navegarPara(caminho: string, params?: Record<string, string>) {
    aoMudarAberto(false);
    if (params) {
      void router.navigate({ to: caminho as any, params: params as any });
    } else {
      void router.navigate({ to: caminho as any });
    }
  }

  return (
    <CommandDialog
      open={aberto}
      onOpenChange={aoMudarAberto}
    >
      <div className="flex items-center border-b border-border px-3 bg-card">
        <Search className="mr-2.5 size-4 shrink-0 text-muted-foreground" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar chamados por protocolo, título, solicitante... (Ctrl+K)"
          className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
        />
        {isLoading && <Loader2 className="size-4 animate-spin text-muted-foreground ml-2" />}
      </div>

      <CommandList className="max-h-[380px] p-2 bg-card">
        {buscaDebounced.length >= 2 && !isLoading && chamados.length === 0 && (
          <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
            Nenhum chamado encontrado para <strong className="text-foreground">"{buscaDebounced}"</strong>.
            <p className="mt-1 text-xs">Tente buscar por protocolo (ex: CH-2026), título ou solicitante.</p>
          </CommandEmpty>
        )}

        {/* Grupo de Resultados de Chamados */}
        {chamados.length > 0 && (
          <CommandGroup heading={`Chamados Encontrados (${chamados.length})`}>
            {chamados.map((c) => {
              const statusFormatado = String(c.status).toLowerCase() as StatusChamado;
              const solicitanteNome = c.solicitante?.nome || (c as any).solicitanteNome || "Solicitante";

              return (
                <CommandItem
                  key={c.id}
                  value={`${c.protocolo} ${c.titulo} ${solicitanteNome} ${c.id}`}
                  onSelect={() => navegarPara("/chamados/$id", { id: String(c.id) })}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-muted/70 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Ticket className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-primary">
                          #{c.protocolo}
                        </span>
                        <span className="truncate text-xs font-medium text-foreground">
                          {c.titulo}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span className="truncate">Solicitante: {solicitanteNome}</span>
                        {c.setor && <span>· {c.setor}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <StatusBadge status={statusFormatado} className="text-[10px] py-0 px-1.5" />
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {chamados.length > 0 && <CommandSeparator className="my-2" />}

        {/* Grupo de Ações Rápidas de Navegação */}
        <CommandGroup heading="Navegação Rápida">
          {podeExecutar(user?.papel, "chamados:criar") && (
            <CommandItem
              value="abrir novo chamado criar demanda solicitacao"
              onSelect={() => navegarPara("/chamados/novo")}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-muted/70"
            >
              <PlusCircle className="size-4 text-primary" />
              <span className="text-xs font-medium text-foreground">Abrir Novo Chamado</span>
            </CommandItem>
          )}

          <CommandItem
            value="painel dashboard inicio"
            onSelect={() => navegarPara("/")}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-muted/70"
          >
            <LayoutDashboard className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">Painel Geral</span>
          </CommandItem>

          <CommandItem
            value="todos chamados lista tickets"
            onSelect={() => navegarPara("/chamados")}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-muted/70"
          >
            <Ticket className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">Listagem de Chamados</span>
          </CommandItem>

          <CommandItem
            value="base conhecimento artigos tutorias ajuda faqs"
            onSelect={() => navegarPara("/base-conhecimento")}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-muted/70"
          >
            <HelpCircle className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">Base de Conhecimento</span>
          </CommandItem>

          {podeExecutar(user?.papel, "relatorios:ler") && (
            <CommandItem
              value="relatorios sla metricas indicadores executivo"
              onSelect={() => navegarPara("/relatorios")}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-muted/70"
            >
              <BarChart3 className="size-4 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">Relatórios Gerenciais e SLA</span>
            </CommandItem>
          )}

          {podeExecutar(user?.papel, "catalogo:gerenciar") && (
            <CommandItem
              value="catalogo servicos sla prioridades"
              onSelect={() => navegarPara("/catalogo")}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-muted/70"
            >
              <BookMarked className="size-4 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">Catálogo e Prazos de SLA</span>
            </CommandItem>
          )}

          {podeExecutar(user?.papel, "usuarios:gerenciar") && (
            <CommandItem
              value="usuarios equipe tecnicos contas cadastros"
              onSelect={() => navegarPara("/usuarios")}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-muted/70"
            >
              <Users className="size-4 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">Gestão de Usuários</span>
            </CommandItem>
          )}

          <CommandItem
            value="meu perfil conta assinatura senha dados"
            onSelect={() => navegarPara("/perfil")}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-muted/70"
          >
            <User className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">Meu Perfil e Assinatura</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>

      <div className="flex items-center justify-between border-t border-border bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
        <span>Use as setas ↑ ↓ para navegar · Enter para abrir</span>
        <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">ESC para fechar</kbd>
      </div>
    </CommandDialog>
  );
}
