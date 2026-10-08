import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  CheckCheck,
  CheckCircle2,
  CornerUpLeft,
  Download,
  Inbox,
  Layers,
  Pause,
  Play,
  PlusCircle,
  Search,
  Ticket,
  UserCheck,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { EmptyState } from "@/components/comum/EmptyState";
import { MensagemErro } from "@/components/comum/MensagemErro";
import { PaginacaoBarra } from "@/components/comum/Paginacao";
import { SkeletonTabela } from "@/components/comum/Skeletons";
import { AppLayout } from "@/components/layout/AppLayout";
import { RotaProtegida } from "@/components/layout/RotaProtegida";
import { PrioridadeBadge, SlaBadge, StatusBadge } from "@/components/chamados/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PRIORIDADE_LABEL, PRIORIDADE_OPCOES, SETORES, STATUS_LABEL, STATUS_OPCOES } from "@/lib/dominio";
import { dataHora, desdeAgora } from "@/lib/format";
import { textoSeguro } from "@/lib/sanitize";
import {
  assumirChamado,
  atualizarChamado,
  devolverChamado,
  listarChamados,
  type ChamadoResumo,
} from "@/services/chamados";
import { listarServicos } from "@/services/catalogo";
import { listarNotificacoes } from "@/services/notificacoes";
import { podeExecutar, setoresVisiveisPara, useAuthStore } from "@/stores/auth";
import type { PrioridadeChamado, StatusChamado } from "@/types";

const searchSchema = z.object({
  status: z
    .enum([
      "aberto",
      "em_atendimento",
      "em_andamento",
      "aguardando",
      "pausado",
      "resolvido",
      "concluido",
      "fechado",
      "cancelado",
    ])
    .optional(),
  prioridade: z.enum(["baixa", "media", "alta", "critica"]).optional(),
  setor: z.string().optional(),
  servicoId: z.string().optional(),
  fila: z.enum(["geral", "minha", "resolvidos"]).optional(),
  q: z.string().optional(),
  page: z.number().int().min(1).catch(1).default(1),
  // Java: Chamado.dataAbertura (não criadoEm) — o Spring Data usa o nome do campo Java para sort
  ordenarPor: z.enum(["dataAbertura", "atualizadoEm", "prioridade"]).catch("dataAbertura").default("dataAbertura"),
  ordem: z.enum(["asc", "desc"]).catch("desc").default("desc"),
});

const LIMITE = 10;

export const Route = createFileRoute("/chamados/")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Chamados — Central de Chamados" },
      {
        name: "description",
        content: "Busque, filtre e acompanhe todos os chamados registrados por status, prioridade, serviço e setor.",
      },
      { property: "og:title", content: "Chamados — Central de Chamados" },
      { property: "og:description", content: "Listagem completa de chamados com filtros, filas e SLA." },
    ],
  }),
  component: () => (
    <RotaProtegida permissao="chamados:ler">
      <ListaChamadosPage />
    </RotaProtegida>
  ),
});

function exportarCsv(itens: ChamadoResumo[]) {
  const cabecalho = ["Protocolo", "Titulo", "Servico", "Status", "Prioridade", "Setor", "Tecnico", "Criado em"];
  const linhas = itens.map((c) =>
    [
      c.protocolo,
      c.titulo,
      c.servicoNome,
      STATUS_LABEL[c.status],
      PRIORIDADE_LABEL[c.prioridade],
      c.setor,
      c.tecnico?.nome ?? "Fila geral",
      dataHora(c.criadoEm),
    ]
      .map((valor) => `"${String(valor).replace(/"/g, '""')}"`)
      .join(";"),
  );
  const blob = new Blob([`\uFEFF${[cabecalho.join(";"), ...linhas].join("\n")}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `chamados-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function ListaChamadosPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [busca, setBusca] = useState(search.q ?? "");
  const user = useAuthStore((s) => s.user);
  const podeVerFilas = podeExecutar(user?.papel, "chamados:fila");
  const podeAssumir = podeExecutar(user?.papel, "chamados:assumir");
  // Aba "Todos os Chamados" visível apenas para admin e superusuário
  const podeVerTodos = user?.papel === "admin" || user?.papel === "superusuario";
  const queryClient = useQueryClient();

  const setoresVisiveis: string[] = user?.papel === "usuario" ? SETORES : setoresVisiveisPara(user, SETORES);

  function aplicar(patch: Record<string, unknown>) {
    void navigate({ to: ".", search: (prev) => ({ ...prev, page: 1, ...patch }) });
  }

  const notificacoes = useQuery({ queryKey: ["notificacoes"], queryFn: listarNotificacoes });
  const chamadosComNovidade = useMemo(
    () => new Set((notificacoes.data?.items ?? []).filter((n) => !n.lida).map((n) => n.chamadoId)),
    [notificacoes.data],
  );

  const contagemMinha = useQuery({
    queryKey: ["chamados", "contagem-minha", user?.id],
    queryFn: () => listarChamados({ fila: "minha", limit: 1, page: 1 }),
    enabled: podeVerFilas,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
  const totalAssumidos = contagemMinha.data?.total ?? 0;

  const contagemGeral = useQuery({
    queryKey: ["chamados", "contagem-geral"],
    queryFn: () => listarChamados({ fila: "geral", limit: 1, page: 1 }),
    enabled: podeVerFilas,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
  const totalFilaGeral = contagemGeral.data?.total ?? 0;

  const contagemResolvidos = useQuery({
    queryKey: ["chamados", "contagem-resolvidos", user?.id],
    queryFn: () => listarChamados({ fila: "resolvidos", limit: 1, page: 1 }),
    enabled: podeVerFilas,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
  const totalResolvidos = contagemResolvidos.data?.total ?? 0;

  const [assumindoId, setAssumindoId] = useState<string | null>(null);
  const [devolvendoChamado, setDevolvendoChamado] = useState<ChamadoResumo | null>(null);
  const [resolvendoChamado, setResolvendoChamado] = useState<ChamadoResumo | null>(null);

  const assumir = useMutation({
    mutationFn: (id: string) => assumirChamado(id),
    onMutate: (id: string) => setAssumindoId(id),
    onSettled: () => setAssumindoId(null),
    onSuccess: () => {
      toast.success("Chamado assumido com sucesso.");
      void queryClient.invalidateQueries({ queryKey: ["chamados"] });
      void queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
    },
    onError: (erro: Error) => toast.error("Não foi possível assumir", { description: erro.message }),
  });

  const pausarRetomar = useMutation({
    mutationFn: ({ id, status, versao }: { id: string; status: StatusChamado; versao?: number }) =>
      atualizarChamado(id, { status, ...(versao !== undefined ? { versao } : {}) }),
    onSuccess: (_, vars) => {
      toast.success(vars.status === "pausado" ? "Atendimento pausado." : "Atendimento retomado.");
      void queryClient.invalidateQueries({ queryKey: ["chamados"] });
    },
    onError: (erro: Error) => toast.error("Não foi possível alterar status", { description: erro.message }),
  });

  const servicos = useQuery({ queryKey: ["servicos"], queryFn: () => listarServicos(), staleTime: 300_000 });

  const { data, isPending, isError, error, isFetching } = useQuery({
    queryKey: ["chamados", search],
    queryFn: () =>
      listarChamados({
        status: search.status ?? "",
        prioridade: search.prioridade ?? "",
        setor: search.setor ?? "",
        servicoId: search.servicoId ?? "",
        fila: search.fila ?? "",
        q: search.q ?? "",
        page: search.page,
        limit: LIMITE,
        ordenarPor: search.ordenarPor,
        ordem: search.ordem,
      }),
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });

  const chips = useMemo(() => {
    const lista: { rotulo: string; limpar: () => void }[] = [];
    if (search.status)
      lista.push({ rotulo: `Status: ${STATUS_LABEL[search.status]}`, limpar: () => aplicar({ status: undefined }) });
    if (search.prioridade)
      lista.push({
        rotulo: `Prioridade: ${PRIORIDADE_LABEL[search.prioridade]}`,
        limpar: () => aplicar({ prioridade: undefined }),
      });
    if (search.setor) lista.push({ rotulo: `Setor: ${search.setor}`, limpar: () => aplicar({ setor: undefined }) });
    if (search.servicoId)
      lista.push({
        rotulo: `Serviço: ${servicos.data?.find((s) => s.id === search.servicoId)?.nome ?? "—"}`,
        limpar: () => aplicar({ servicoId: undefined }),
      });
    if (search.fila)
      lista.push({
        rotulo:
          search.fila === "geral"
            ? "Fila geral"
            : search.fila === "resolvidos"
              ? "Chamados resolvidos"
              : "Minha fila (assumidos)",
        limpar: () => aplicar({ fila: undefined }),
      });
    if (search.q)
      lista.push({
        rotulo: `Busca: "${search.q}"`,
        limpar: () => {
          setBusca("");
          aplicar({ q: undefined });
        },
      });
    return lista;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, servicos.data]);

  return (
    <AppLayout
      titulo="Chamados"
      descricao="Busque, filtre e acompanhe as solicitações registradas"
      acoes={
        <>
          <Button
            variant="outline"
            size="sm"
            disabled={!data || data.items.length === 0}
            onClick={() => data && exportarCsv(data.items)}
          >
            <Download className="size-4" /> CSV
          </Button>
          <Button asChild size="sm">
            <Link to="/chamados/novo">
              <PlusCircle className="size-4" /> Abrir chamado
            </Link>
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Abas de Filas para perfis técnicos e administrativos */}
        {podeVerFilas && (
          <Tabs
            value={search.fila ?? (podeVerTodos ? "todas" : "minha")}
            onValueChange={(val) => {
              aplicar({
                fila:
                  val === "todas"
                    ? undefined
                    : (val as "geral" | "minha" | "resolvidos"),
              });
            }}
            className="w-full"
          >
            <TabsList className={`grid w-full max-w-3xl ${podeVerTodos ? "grid-cols-4" : "grid-cols-3"}`}>
              <TabsTrigger value="minha" className="gap-2 text-xs sm:text-sm">
                <UserCheck className="size-4 text-primary" />
                <span>Meus Atendimentos</span>
                {totalAssumidos > 0 && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                    {totalAssumidos}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="resolvidos" className="gap-2 text-xs sm:text-sm">
                <CheckCheck className="size-4 text-green-600" />
                <span>Resolvidos</span>
                {totalResolvidos > 0 && (
                  <span className="rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                    {totalResolvidos}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="geral" className="gap-2 text-xs sm:text-sm">
                <Inbox className="size-4" />
                <span>Fila Geral</span>
                {totalFilaGeral > 0 && (
                  <span className="rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                    {totalFilaGeral}
                  </span>
                )}
              </TabsTrigger>
              {podeVerTodos && (
                <TabsTrigger value="todas" className="gap-2 text-xs sm:text-sm">
                  <Layers className="size-4" />
                  <span>Todos os Chamados</span>
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        )}

        {/* Banner informativo quando na aba Meus Atendimentos */}
        {search.fila === "minha" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary-soft/40 p-3 text-xs text-foreground">
            <div className="flex items-center gap-2">
              <UserCheck className="size-4 text-primary" />
              <span>
                Visualizando chamados <strong>assumidos por você</strong> para atendimento.
              </span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span>
                Em andamento:{" "}
                <strong className="text-foreground">
                  {data?.items.filter((c) => c.status === "em_andamento").length ?? 0}
                </strong>
              </span>
              <span>
                Pausados:{" "}
                <strong className="text-foreground">
                  {data?.items.filter((c) => c.status === "pausado").length ?? 0}
                </strong>
              </span>
            </div>
          </div>
        )}

        {/* Banner informativo quando na aba Chamados Resolvidos */}
        {search.fila === "resolvidos" && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-foreground dark:border-green-900 dark:bg-green-950/30">
            <div className="flex items-center gap-2">
              <CheckCheck className="size-4 text-green-600" />
              <span>
                Chamados <strong>resolvidos e fechados</strong> que foram atendidos por você.
              </span>
            </div>
          </div>
        )}

        <section className="surface-card p-4" aria-label="Filtros de chamados">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-1.5 xl:col-span-2">
              <Label htmlFor="busca">Buscar</Label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  aplicar({ q: busca.trim() || undefined });
                }}
                className="relative"
              >
                <Search aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="busca"
                  className="pl-9"
                  placeholder="Protocolo, título, serviço ou solicitante"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </form>
            </div>

            <Seletor
              id="filtro-status"
              label="Status"
              valor={search.status ?? ""}
              opcoes={STATUS_OPCOES}
              onChange={(v) => aplicar({ status: (v as StatusChamado) || undefined })}
            />
            <Seletor
              id="filtro-prioridade"
              label="Prioridade"
              valor={search.prioridade ?? ""}
              opcoes={PRIORIDADE_OPCOES}
              onChange={(v) => aplicar({ prioridade: (v as PrioridadeChamado) || undefined })}
            />
            <Seletor
              id="filtro-setor"
              label="Setor"
              valor={search.setor ?? ""}
              opcoes={setoresVisiveis.map((s) => ({ value: s, label: s }))}
              onChange={(v) => aplicar({ setor: v || undefined })}
            />
            <Seletor
              id="filtro-servico"
              label="Serviço do catálogo"
              valor={search.servicoId ?? ""}
              opcoes={(servicos.data ?? []).map((s) => ({ value: s.id, label: s.nome }))}
              onChange={(v) => aplicar({ servicoId: v || undefined })}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Seletor
              id="ordenacao"
              label="Ordenar por"
              className="w-full sm:w-56"
              valor={`${search.ordenarPor}:${search.ordem}`}
              placeholder={null}
              opcoes={[
                { value: "criadoEm:desc", label: "Mais recentes" },
                { value: "criadoEm:asc", label: "Mais antigos" },
                { value: "prioridade:desc", label: "Prioridade (maior)" },
                { value: "atualizadoEm:desc", label: "Última atualização" },
              ]}
              onChange={(v) => {
                const [ordenarPor, ordem] = v.split(":");
                aplicar({ ordenarPor, ordem });
              }}
            />
          </div>

          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              {chips.map((chip) => (
                <button
                  key={chip.rotulo}
                  type="button"
                  onClick={chip.limpar}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground transition-soft hover:bg-primary-soft hover:text-primary"
                >
                  {chip.rotulo}
                  <X aria-hidden className="size-3.5" />
                  <span className="sr-only">Remover filtro</span>
                </button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setBusca("");
                  void navigate({
                    to: ".",
                    search: () => ({ page: 1, ordenarPor: "criadoEm" as const, ordem: "desc" as const }),
                  });
                }}
              >
                Limpar tudo
              </Button>
            </div>
          )}
        </section>

        <section className="surface-card overflow-hidden" aria-busy={isFetching}>
          {isError ? (
            <div className="p-4">
              <MensagemErro erro={error} />
            </div>
          ) : isPending ? (
            <SkeletonTabela />
          ) : data.items.length === 0 ? (
            <EmptyState
              icone={<Ticket className="size-7" />}
              titulo="Nenhum chamado encontrado"
              descricao="Não há chamados que correspondam aos filtros selecionados. Ajuste a busca ou abra um novo chamado."
              acao={
                <Button asChild>
                  <Link to="/chamados/novo">Abrir chamado</Link>
                </Button>
              }
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Lista de chamados registrados</caption>
                  <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">Protocolo</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Chamado</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Serviço</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Prioridade</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Responsável</th>
                      <th scope="col" className="px-4 py-3 font-semibold">SLA</th>
                      {podeAssumir ? (
                        <th scope="col" className="px-4 py-3 font-semibold text-right">Ações de Atendimento</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.items.map((chamado) => {
                      const ehResponsavel = chamado.tecnico && String(chamado.tecnico.id) === String(user?.id);
                      const encerrado =
                        chamado.status === "resolvido" ||
                        chamado.status === "concluido" ||
                        chamado.status === "fechado" ||
                        chamado.status === "cancelado";

                      return (
                        <tr key={chamado.id} className="transition-soft hover:bg-muted/50">
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              {chamadosComNovidade.has(String(chamado.id)) ? (
                                <span
                                  className="size-2 rounded-full bg-primary"
                                  title="Atualização não visualizada"
                                  aria-label="Atualização não visualizada"
                                />
                              ) : null}
                              {chamado.protocolo}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              to="/chamados/$id"
                              params={{ id: String(chamado.id) }}
                              className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                            >
                              {textoSeguro(chamado.titulo, 120)}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {textoSeguro(chamado.solicitante.nome, 60)} · {desdeAgora(chamado.criadoEm)}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{textoSeguro(chamado.servicoNome, 60)}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={chamado.status} />
                          </td>
                          <td className="px-4 py-3">
                            <PrioridadeBadge prioridade={chamado.prioridade} />
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {chamado.tecnico ? (
                              <span className={ehResponsavel ? "font-semibold text-primary" : ""}>
                                {textoSeguro(chamado.tecnico.nome, 60)} {ehResponsavel ? "(Você)" : ""}
                              </span>
                            ) : (
                              <span className="text-xs text-amber-700 dark:text-amber-400">
                                Fila {textoSeguro(chamado.filaSetor ?? chamado.setor, 40)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <SlaBadge chamado={chamado} />
                          </td>
                          {podeAssumir ? (
                            <td className="px-4 py-3 text-right">
                              {chamado.tecnico === null && !encerrado ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={assumir.isPending && assumindoId === chamado.id}
                                  onClick={() => assumir.mutate(chamado.id)}
                                >
                                  <UserCheck className="size-4" />
                                  {assumir.isPending && assumindoId === chamado.id ? "Assumindo..." : "Assumir"}
                                </Button>
                              ) : ehResponsavel && !encerrado ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  {chamado.status === "em_andamento" ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      title="Pausar atendimento"
                                      onClick={() =>
                                        pausarRetomar.mutate({
                                          id: chamado.id,
                                          status: "pausado",
                                          versao: chamado.versao,
                                        })
                                      }
                                    >
                                      <Pause className="size-3.5" />
                                      <span className="sr-only">Pausar</span>
                                    </Button>
                                  ) : chamado.status === "pausado" ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      title="Retomar atendimento"
                                      onClick={() =>
                                        pausarRetomar.mutate({
                                          id: chamado.id,
                                          status: "em_andamento",
                                          versao: chamado.versao,
                                        })
                                      }
                                    >
                                      <Play className="size-3.5" />
                                      <span className="sr-only">Retomar</span>
                                    </Button>
                                  ) : null}

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950"
                                    onClick={() => setResolvendoChamado(chamado)}
                                  >
                                    <CheckCircle2 className="size-3.5" /> Resolver
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    title="Devolver para a fila geral"
                                    onClick={() => setDevolvendoChamado(chamado)}
                                  >
                                    <CornerUpLeft className="size-3.5" />
                                    <span className="sr-only">Devolver à fila</span>
                                  </Button>
                                </div>
                              ) : encerrado ? (
                                <span className="text-xs text-muted-foreground">Concluído</span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Visualização Mobile */}
              <ul className="divide-y divide-border md:hidden">
                {data.items.map((chamado) => {
                  const ehResponsavel = chamado.tecnico && String(chamado.tecnico.id) === String(user?.id);
                  const encerrado =
                    chamado.status === "resolvido" ||
                    chamado.status === "concluido" ||
                    chamado.status === "fechado" ||
                    chamado.status === "cancelado";

                  return (
                    <li key={chamado.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {chamadosComNovidade.has(String(chamado.id)) ? (
                            <span
                              className="mr-1.5 inline-block size-2 rounded-full bg-primary align-middle"
                              aria-label="Atualização não visualizada"
                            />
                          ) : null}
                          {chamado.protocolo}
                        </span>
                        <StatusBadge status={chamado.status} />
                      </div>
                      <Link
                        to="/chamados/$id"
                        params={{ id: String(chamado.id) }}
                        className="block font-medium text-foreground hover:text-primary"
                      >
                        {textoSeguro(chamado.titulo, 120)}
                      </Link>
                      <p className="text-xs text-muted-foreground">{textoSeguro(chamado.servicoNome, 60)}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <PrioridadeBadge prioridade={chamado.prioridade} />
                        <SlaBadge chamado={chamado} />
                        <span>· {desdeAgora(chamado.criadoEm)}</span>
                      </div>

                      {podeAssumir && chamado.tecnico === null && !encerrado ? (
                        <Button
                          className="mt-2 w-full"
                          size="sm"
                          variant="outline"
                          disabled={assumir.isPending && String(assumindoId) === String(chamado.id)}
                          onClick={() => assumir.mutate(chamado.id)}
                        >
                          <UserCheck className="size-4" />
                          {assumir.isPending && String(assumindoId) === String(chamado.id) ? "Assumindo..." : "Assumir atendimento"}
                        </Button>
                      ) : ehResponsavel && !encerrado ? (
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            className="flex-1 text-green-700 dark:text-green-400"
                            variant="outline"
                            onClick={() => setResolvendoChamado(chamado)}
                          >
                            <CheckCircle2 className="size-3.5" /> Resolver
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDevolvendoChamado(chamado)}
                          >
                            <CornerUpLeft className="size-3.5" /> Devolver
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>

              <PaginacaoBarra
                page={data.page}
                totalPages={data.totalPages}
                total={data.total}
                limit={data.limit}
                onChange={(page) => void navigate({ to: ".", search: (prev) => ({ ...prev, page }) })}
              />
            </>
          )}
        </section>
      </div>

      {/* Diálogos rápidos de atendimento */}
      {devolvendoChamado && (
        <DialogDevolverChamado
          chamado={devolvendoChamado}
          onFechar={() => setDevolvendoChamado(null)}
        />
      )}

      {resolvendoChamado && (
        <DialogResolverRapido
          chamado={resolvendoChamado}
          onFechar={() => setResolvendoChamado(null)}
        />
      )}
    </AppLayout>
  );
}

function DialogDevolverChamado({
  chamado,
  onFechar,
}: {
  chamado: ChamadoResumo;
  onFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState("");

  const devolver = useMutation({
    mutationFn: () => devolverChamado(chamado.id, motivo.trim()),
    onSuccess: () => {
      toast.success("Chamado devolvido à fila geral.");
      void queryClient.invalidateQueries({ queryKey: ["chamados"] });
      onFechar();
    },
    onError: (erro: Error) => toast.error("Não foi possível devolver", { description: erro.message }),
  });

  return (
    <Dialog open onOpenChange={() => onFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CornerUpLeft className="size-5 text-primary" />
            Devolver Chamado à Fila Geral
          </DialogTitle>
          <DialogDescription>
            O chamado <strong>{chamado.protocolo}</strong> voltará a ficar disponível para outros técnicos do setor {chamado.setor}.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (motivo.trim().length >= 3) devolver.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="motivo-devolucao">Motivo da devolução</Label>
            <Input
              id="motivo-devolucao"
              placeholder="Ex.: Necessita atendimento presencial / Direcionado para outro setor"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={motivo.trim().length < 3 || devolver.isPending}>
              {devolver.isPending ? "Devolvendo..." : "Confirmar devolução"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogResolverRapido({
  chamado,
  onFechar,
}: {
  chamado: ChamadoResumo;
  onFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const [oQueFoiFeito, setOQueFoiFeito] = useState("");

  const resolver = useMutation({
    mutationFn: () =>
      atualizarChamado(chamado.id, {
        status: "resolvido",
        oQueFoiFeito: oQueFoiFeito.trim(),
        versao: chamado.versao,
      }),
    onSuccess: () => {
      toast.success("Chamado marcado como resolvido.");
      void queryClient.invalidateQueries({ queryKey: ["chamados"] });
      onFechar();
    },
    onError: (erro: Error) => toast.error("Não foi possível resolver", { description: erro.message }),
  });

  return (
    <Dialog open onOpenChange={() => onFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-green-600 dark:text-green-400" />
            Concluir Atendimento
          </DialogTitle>
          <DialogDescription>
            Registre a solução técnica aplicada ao chamado <strong>{chamado.protocolo}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (oQueFoiFeito.trim().length >= 3) resolver.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="o-que-foi-feito">O que foi feito / Solução aplicada</Label>
            <textarea
              id="o-que-foi-feito"
              rows={3}
              placeholder="Descreva as ações realizadas para solucionar a solicitação do usuário..."
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              value={oQueFoiFeito}
              onChange={(e) => setOQueFoiFeito(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={oQueFoiFeito.trim().length < 3 || resolver.isPending}>
              {resolver.isPending ? "Concluindo..." : "Resolver chamado"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Seletor({
  id,
  label,
  valor,
  opcoes,
  onChange,
  placeholder = "Todos",
  className,
}: {
  id: string;
  label: string;
  valor: string;
  opcoes: { value: string; label: string }[];
  onChange: (valor: string) => void;
  placeholder?: string | null;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground transition-soft focus-visible:ring-2 focus-visible:ring-ring"
      >
        {placeholder !== null && <option value="">{placeholder}</option>}
        {opcoes.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>
    </div>
  );
}
