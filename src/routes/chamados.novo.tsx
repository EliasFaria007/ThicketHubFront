import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, CheckCircle, ExternalLink, Lightbulb, Loader2, PlusCircle, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { PrioridadeBadge } from "@/components/chamados/StatusBadge";
import { MensagemErro } from "@/components/comum/MensagemErro";
import { AppLayout } from "@/components/layout/AppLayout";
import { RotaProtegida } from "@/components/layout/RotaProtegida";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { horasLegivel } from "@/lib/sla";
import { criarChamado } from "@/services/chamados";
import { listarServicos } from "@/services/catalogo";
import { avaliarArtigo, listarArtigos } from "@/services/base-conhecimento";
import type { ArtigoBaseConhecimento } from "@/types";

export const Route = createFileRoute("/chamados/novo")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Abrir chamado — Central de Chamados" },
      {
        name: "description",
        content:
          "Abra um chamado escolhendo o serviço no catálogo institucional; prioridade e SLA são herdados automaticamente.",
      },
      { property: "og:title", content: "Abrir chamado — Central de Chamados" },
      { property: "og:description", content: "Registro de solicitações com serviço do catálogo, prioridade e SLA." },
    ],
  }),
  component: () => (
    <RotaProtegida permissao="chamados:criar">
      <NovoChamadoPage />
    </RotaProtegida>
  ),
});

const schema = z.object({
  titulo: z.string().trim().min(1, "Informe o assunto do chamado").max(120, "Máximo de 120 caracteres"),
  servicoId: z.string().min(1, "Selecione o serviço no catálogo"),
  descricao: z.string().trim().min(1, "Descreva o que está acontecendo").max(2000, "Máximo de 2000 caracteres"),
});

function NovoChamadoPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [valores, setValores] = useState({ titulo: "", servicoId: "", descricao: "" });
  const [erros, setErros] = useState<Record<string, string | undefined>>({});
  const [artigoVisualizando, setArtigoVisualizando] = useState<ArtigoBaseConhecimento | null>(null);

  const servicos = useQuery({ queryKey: ["servicos"], queryFn: () => listarServicos(), staleTime: 300_000 });
  const servico = (servicos.data ?? []).find((s) => String(s.id) === String(valores.servicoId));

  const termoBusca = valores.titulo.trim();
  const sugestoes = useQuery({
    queryKey: ["base-conhecimento", "sugestoes", termoBusca],
    queryFn: () => listarArtigos({ busca: termoBusca }),
    enabled: termoBusca.length >= 3,
    staleTime: 60_000,
  });
  const artigosSugeridos = (sugestoes.data ?? []).slice(0, 3);

  const mutation = useMutation({
    mutationFn: criarChamado,
    onSuccess: (chamado) => {
      toast.success("Chamado aberto com sucesso", { description: `Protocolo ${chamado.protocolo}` });
      void queryClient.invalidateQueries({ queryKey: ["chamados"] });
      void queryClient.invalidateQueries({ queryKey: ["metricas"] });
      void queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
      void router.navigate({ to: "/chamados" });
    },
    onError: (erro: Error) => toast.error("Não foi possível abrir o chamado", { description: erro.message }),
  });

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const resultado = schema.safeParse(valores);
    if (!resultado.success) {
      const flat = resultado.error.flatten().fieldErrors;
      setErros({
        titulo: flat.titulo?.[0],
        servicoId: flat.servicoId?.[0],
        descricao: flat.descricao?.[0],
      });
      return;
    }
    setErros({});
    mutation.mutate(resultado.data);
  }

  return (
    <AppLayout
      titulo="Abrir chamado"
      descricao="Escolha o serviço no catálogo — prioridade e SLA são definidos pela instituição"
      acoes={
        <Button asChild variant="outline" size="sm">
          <Link to="/chamados">
            <ArrowLeft className="size-4" /> Voltar
          </Link>
        </Button>
      }
    >
      <form className="surface-card max-w-3xl space-y-5 p-5" onSubmit={onSubmit} noValidate>
        {mutation.isError && <MensagemErro erro={mutation.error} />}

        <div className="space-y-1.5">
          <Label htmlFor="servicoId">Serviço do catálogo</Label>
          <select
            id="servicoId"
            value={valores.servicoId}
            aria-invalid={Boolean(erros["servicoId"])}
            onChange={(e) => setValores((prev) => ({ ...prev, servicoId: e.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground transition-soft focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">
              {servicos.isPending ? "Carregando catálogo…" : "Selecione o serviço solicitado"}
            </option>
            {(servicos.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome} — {s.setor}
              </option>
            ))}
          </select>
          {erros["servicoId"] && <p className="text-xs text-destructive">{erros["servicoId"]}</p>}
        </div>

        {servico && (
          <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm">
            <p className="font-medium text-foreground">Parâmetros herdados do catálogo</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-muted-foreground">
              <PrioridadeBadge prioridade={servico.prioridade} />
              <span>Setor responsável: {servico.setor}</span>
              <span>Atendimento em até {horasLegivel(servico.slaAtendimentoHoras)}</span>
              <span>Resolução em até {horasLegivel(servico.slaResolucaoHoras)}</span>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="titulo">Assunto</Label>
          <Input
            id="titulo"
            value={valores.titulo}
            aria-invalid={Boolean(erros["titulo"])}
            placeholder="Resumo curto do que está acontecendo"
            onChange={(e) => setValores((prev) => ({ ...prev, titulo: e.target.value }))}
          />
          {erros["titulo"] && <p className="text-xs text-destructive">{erros["titulo"]}</p>}
        </div>

        {/* Sugestões automáticas da Base de Conhecimento */}
        {artigosSugeridos.length > 0 && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-primary font-medium text-sm">
              <Lightbulb className="size-4 shrink-0" />
              <span>Antes de abrir o chamado, algum destes tutoriais resolve seu problema?</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {artigosSugeridos.map((art) => (
                <button
                  key={art.id}
                  type="button"
                  onClick={() => setArtigoVisualizando(art)}
                  className="flex flex-col text-left p-3 rounded-md bg-card border border-border/80 hover:border-primary/50 hover:shadow-xs transition-soft group"
                >
                  <span className="text-xs font-semibold text-foreground group-hover:text-primary line-clamp-2">
                    {art.titulo}
                  </span>
                  <span className="mt-1 text-[11px] text-muted-foreground line-clamp-1">
                    {art.categoria} · {art.setor}
                  </span>
                  <span className="mt-2 text-[11px] font-medium text-primary flex items-center gap-1">
                    <BookOpen className="size-3" /> Ver tutorial
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="descricao">Descrição detalhada</Label>
          <Textarea
            id="descricao"
            rows={6}
            value={valores.descricao}
            aria-invalid={Boolean(erros["descricao"])}
            placeholder="Explique o que ocorreu, desde quando, e o impacto no atendimento."
            onChange={(e) => setValores((prev) => ({ ...prev, descricao: e.target.value }))}
          />
          {erros["descricao"] && <p className="text-xs text-destructive">{erros["descricao"]}</p>}
          <p className="text-xs text-muted-foreground">
            O chamado nasce no status “Aguardando” e fica disponível na fila do setor responsável.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <PlusCircle className="size-4" />}
            Abrir chamado
          </Button>
          <Button asChild type="button" variant="ghost">
            <Link to="/chamados">Cancelar</Link>
          </Button>
        </div>
      </form>

      {/* Modal de Leitura do Tutorial Sugerido */}
      {artigoVisualizando && (
        <Dialog open={Boolean(artigoVisualizando)} onOpenChange={(aberto) => !aberto && setArtigoVisualizando(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2 text-xs text-primary font-medium">
                <span>{artigoVisualizando.categoria}</span>
                <span>·</span>
                <span>{artigoVisualizando.setor}</span>
              </div>
              <DialogTitle className="text-lg">{artigoVisualizando.titulo}</DialogTitle>
              <DialogDescription>{artigoVisualizando.resumo}</DialogDescription>
            </DialogHeader>

            <div className="prose prose-sm dark:prose-invert max-w-none border-y border-border py-4 whitespace-pre-line text-sm text-foreground">
              {artigoVisualizando.conteudo}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  toast.success("Excelente! O autoatendimento evitou a abertura do chamado.");
                  setArtigoVisualizando(null);
                  void router.navigate({ to: "/chamados" });
                }}
              >
                <CheckCircle className="size-4" />
                Isso resolveu meu problema! (Não abrir chamado)
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setArtigoVisualizando(null)}
              >
                Continuar abrindo chamado
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AppLayout>
  );
}
