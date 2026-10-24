import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { obterUsuarioLogado } from "@/services/usuarios";
import {
  BookMarked,
  Building2,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  PlusCircle,
  Layers,
  BarChart3,
  ScrollText,
  Settings,
  Ticket,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { CompletarCadastroDialog } from "@/components/comum/CompletarCadastroDialog";
import { SinoNotificacoes } from "@/components/comum/SinoNotificacoes";
import { TermosDialog } from "@/components/comum/TermosDialog";
import { Button } from "@/components/ui/button";
import { PAPEL_LABEL } from "@/lib/dominio";
import { iniciais } from "@/lib/format";
import { cn } from "@/lib/utils";
import { podeCadastrarUsuarios, podeExecutar, useAuthStore } from "@/stores/auth";

const NAV = [
  { to: "/", label: "Painel", icone: LayoutDashboard, permissao: "chamados:ler" },
  { to: "/chamados", label: "Chamados", icone: Ticket, permissao: "chamados:ler" },
  { to: "/chamados", search: { fila: "todas" }, label: "Todos os Chamados", icone: Layers, permissao: "chamados:ler", somenteAdmin: true },
  { to: "/chamados/novo", label: "Abrir chamado", icone: PlusCircle, permissao: "chamados:criar" },
  { to: "/base-conhecimento", label: "Base de Conhecimento", icone: HelpCircle, permissao: "chamados:ler" },
  { to: "/catalogo", label: "Catálogo e SLA", icone: BookMarked, permissao: "catalogo:gerenciar" },
  { to: "/relatorios", label: "Relatórios", icone: BarChart3, permissao: "relatorios:ler" },
  { to: "/usuarios", label: "Usuários", icone: Users, permissao: "usuarios:gerenciar" },
  { to: "/configuracoes", label: "Integrações & LDAP", icone: Settings, permissao: "usuarios:gerenciar" },
  { to: "/auditoria", label: "Auditoria", icone: ScrollText, permissao: "auditoria:ler" },
  { to: "/perfil", label: "Meu perfil", icone: UserRound, permissao: "chamados:ler" },
] as const;

export function AppLayout({
  titulo,
  descricao,
  acoes,
  children,
}: {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const atualizarUsuario = useAuthStore((s) => s.atualizarUsuario);
  const sair = useAuthStore((s) => s.sair);
  const router = useRouter();
  const queryClient = useQueryClient();

  // Garante que a assinatura e preferências do perfil fiquem sempre atualizadas do banco de dados
  useQuery({
    queryKey: ["usuario-logado-atual", user?.id],
    queryFn: async () => {
      try {
        const u = await obterUsuarioLogado();
        if (u) {
          atualizarUsuario(u);
          return u;
        }
      } catch {
        // Silencioso em caso de token expirando
      }
      return null;
    },
    enabled: Boolean(token && user?.id),
    staleTime: 60_000,
  });

  const itens = NAV.filter((item) => {
    // A aba "Painel" não é exibida para o perfil usuário solicitante
    if (item.to === "/" && user?.papel === "usuario") {
      return false;
    }
    // "Todos os Chamados" é exibido como aba separada no menu lateral para admin e superusuário
    if ("somenteAdmin" in item && item.somenteAdmin) {
      if (user?.papel !== "admin" && user?.papel !== "superusuario") {
        return false;
      }
    }
    if (item.to === "/usuarios") {
      return podeExecutar(user?.papel, item.permissao) || podeCadastrarUsuarios(user);
    }
    return podeExecutar(user?.papel, item.permissao);
  });

  function handleSair() {
    queryClient.clear();
    sair();
    if (typeof window !== "undefined") {
      sessionStorage.clear();
    }
    void router.navigate({ to: "/login", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Ir para o conteúdo
      </a>

      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <MarcaInstitucional />
        <NavItens itens={itens} />
        <RodapeSidebar />
      </aside>

      {/* Sidebar mobile */}
      {menuAberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setMenuAberto(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-sidebar-border bg-sidebar shadow-soft">
            <div className="flex items-center justify-between pr-2">
              <MarcaInstitucional />
              <Button variant="ghost" size="icon" aria-label="Fechar menu" onClick={() => setMenuAberto(false)}>
                <X className="size-5" />
              </Button>
            </div>
            <NavItens itens={itens} onNavegar={() => setMenuAberto(false)} />
            <RodapeSidebar />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Abrir menu de navegação"
              onClick={() => setMenuAberto(true)}
            >
              <Menu className="size-5" />
            </Button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-semibold text-foreground sm:text-xl">{titulo}</h1>
              {descricao ? <p className="truncate text-sm text-muted-foreground">{descricao}</p> : null}
            </div>

            <div className="flex items-center gap-2">
              {acoes}
              <SinoNotificacoes />
              <div className="hidden items-center gap-2 border-l border-border pl-3 sm:flex">
                <div
                  className="grid size-9 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary"
                  aria-hidden
                >
                  {iniciais(user?.nome ?? "?")}
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-medium text-foreground">{user?.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {user ? PAPEL_LABEL[user.papel] : ""} · {user?.setor}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" aria-label="Sair do sistema" onClick={handleSair}>
                <LogOut className="size-5" />
              </Button>
            </div>
          </div>
        </header>

        <main id="conteudo" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>

      <TermosDialog />
      <CompletarCadastroDialog />
    </div>
  );
}

function MarcaInstitucional() {
  return (
    <div className="flex items-center gap-3 px-5 py-5">
      <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground" aria-hidden>
        <Building2 className="size-5" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold text-sidebar-foreground">Central de Chamados</p>
        <p className="text-xs text-muted-foreground">Serviço institucional</p>
      </div>
    </div>
  );
}

function NavItens({
  itens,
  onNavegar,
}: {
  itens: readonly any[];
  onNavegar?: () => void;
}) {
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const search = routerState.location.search as any;

  return (
    <nav aria-label="Navegação principal" className="flex-1 space-y-1 px-3 py-2">
      {itens.map((item) => {
        const ehTodos = item.search?.fila === "todas";
        const ativo = ehTodos
          ? pathname.startsWith("/chamados") && search?.fila === "todas"
          : item.to === "/chamados"
            ? pathname.startsWith("/chamados") && search?.fila !== "todas"
            : item.to === "/"
              ? pathname === "/"
              : pathname.startsWith(item.to);

        return (
          <Link
            key={item.label}
            to={item.to}
            search={item.search}
            preload="intent"
            onClick={onNavegar}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-soft",
              ativo
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icone aria-hidden className="size-4.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function RodapeSidebar() {
  return (
    <div className="border-t border-sidebar-border px-5 py-4">
      <p className="text-xs text-muted-foreground">
        Atendimento de segunda a sexta, das 8h às 18h. Em caso de urgência, procure a coordenação do setor.
      </p>
    </div>
  );
}
