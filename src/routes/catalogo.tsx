import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BookMarked, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/comum/EmptyState";
import { MensagemErro } from "@/components/comum/MensagemErro";
import { SkeletonTabela } from "@/components/comum/Skeletons";
import { AppLayout } from "@/components/layout/AppLayout";
import { RotaProtegida } from "@/components/layout/RotaProtegida";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORIDADE_LABEL, PRIORIDADE_OPCOES, SETORES } from "@/lib/dominio";
import { textoSeguro } from "@/lib/sanitize";
import { atualizarServico, criarServico, listarServicos, obterSla, salvarSla } from "@/services/catalogo";
import type { PrioridadeChamado, SlaConfig } from "@/types";

export const Route = createFileRoute("/catalogo")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Catálogo de serviços — Central de Chamados" },
      {
        name: "description",
        content: "Cadastre serviços, setores responsáveis, prioridades e prazos de SLA da central de chamados.",
      },
      { property: "og:title", content: "Catálogo de serviços — Central de Chamados" },
      { property: "og:description", content: "Gestão do catálogo institucional de serviços e parâmetros de SLA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RotaProtegida permissao="catalogo:gerenciar">
      <CatalogoPage />
    </RotaProtegida>
  ),
});

function CatalogoPage() {
  return (
    <AppLayout
      titulo="Catálogo de serviços"
      descricao="Serviços disponíveis para abertura de chamados e parâmetros de SLA"
    >
      <div className="space-y-6">
        <FormularioServico />
        <TabelaServicos />
        <ConfiguracaoSla />
      </div>
    </AppLayout>
  );
}

function FormularioServico() {
  const queryClient = useQueryClient();
  const { data: slaConfig } = useQuery({ queryKey: ["sla"], queryFn: obterSla });
  const [nome, setNome] = useState("");
  const [setor, setSetor] = useState(SETORES[0]!);
  const [prioridade, setPrioridade] = useState<PrioridadeChamado>("media");
  const [atendimento, setAtendimento] = useState("8");
  const [resolucao, setResolucao] = useState("72");

  function onPrioridadeChange(p: PrioridadeChamado) {
    setPrioridade(p);
    if (slaConfig?.[p]) {
      setAtendimento(String(slaConfig[p].atendimentoHoras));
      setResolucao(String(slaConfig[p].resolucaoHoras));
    }
  }

  const criar = useMutation({
    mutationFn: () =>
      criarServico({
        nome: nome.trim(),
        setor,
        prioridade,
        slaAtendimentoHoras: Number(atendimento),
        slaResolucaoHoras: Number(resolucao),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["servicos"] });
      setNome("");
      toast.success("Serviço adicionado ao catálogo");
    },
    onError: (erro: Error) => toast.error("Não foi possível salvar", { description: erro.message }),
  });

  const invalido = nome.trim().length < 3 || Number(atendimento) <= 0 || Number(resolucao) <= 0;

  return (
    <form
      className="surface-card space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!invalido) criar.mutate();
      }}
    >
      <div>
        <h2 className="text-base font-semibold text-foreground">Novo serviço</h2>
        <p className="text-sm text-muted-foreground">
          O serviço define o setor responsável, a prioridade padrão e os prazos aplicados ao chamado.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="space-y-1.5 xl:col-span-2">
          <Label htmlFor="servico-nome">Nome do serviço</Label>
          <Input
            id="servico-nome"
            value={nome}
            maxLength={90}
            placeholder="Ex.: Instalação de impressora"
            onChange={(e) => setNome(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="servico-setor">Setor responsável</Label>
          <Select value={setor} onValueChange={setSetor}>
            <SelectTrigger id="servico-setor">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SETORES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="servico-prioridade">Prioridade</Label>
          <Select value={prioridade} onValueChange={(v) => onPrioridadeChange(v as PrioridadeChamado)}>
            <SelectTrigger id="servico-prioridade">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORIDADE_OPCOES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="servico-sla-at">1ª resposta (h)</Label>
            <Input
              id="servico-sla-at"
              type="number"
              min={1}
              value={atendimento}
              onChange={(e) => setAtendimento(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="servico-sla-res">Resolução (h)</Label>
            <Input
              id="servico-sla-res"
              type="number"
              min={1}
              value={resolucao}
              onChange={(e) => setResolucao(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={invalido || criar.isPending}>
        <Plus className="size-4" /> {criar.isPending ? "Salvando..." : "Adicionar serviço"}
      </Button>
    </form>
  );
}

function TabelaServicos() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["servicos", "todos"],
    queryFn: () => listarServicos({ incluirInativos: true }),
  });

  const alternar = useMutation({
    mutationFn: (payload: { id: string; ativo: boolean }) => atualizarServico(payload.id, { ativo: payload.ativo }),
    onSuccess: (servico) => {
      void queryClient.invalidateQueries({ queryKey: ["servicos"] });
      toast.success(servico.ativo ? "Serviço reativado" : "Serviço desativado");
    },
    onError: (erro: Error) => toast.error("Não foi possível atualizar", { description: erro.message }),
  });

  if (isError) {
    return (
      <div className="surface-card p-4">
        <MensagemErro erro={error} />
      </div>
    );
  }
  if (isPending) {
    return (
      <div className="surface-card overflow-hidden">
        <SkeletonTabela />
      </div>
    );
  }
  if (data.length === 0) {
    return (
      <div className="surface-card">
        <EmptyState
          icone={<BookMarked className="size-7" />}
          titulo="Catálogo vazio"
          descricao="Cadastre o primeiro serviço para que os servidores possam abrir chamados."
        />
      </div>
    );
  }

  return (
    <section className="surface-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Serviços do catálogo</caption>
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Serviço</th>
              <th scope="col" className="px-4 py-3 font-semibold">Setor</th>
              <th scope="col" className="px-4 py-3 font-semibold">Prioridade</th>
              <th scope="col" className="px-4 py-3 font-semibold">SLA (resposta / resolução)</th>
              <th scope="col" className="px-4 py-3 font-semibold">Situação</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((servico) => (
              <tr key={servico.id} className="transition-soft hover:bg-muted/50">
                <td className="px-4 py-3 font-medium text-foreground">{textoSeguro(servico.nome, 90)}</td>
                <td className="px-4 py-3 text-muted-foreground">{servico.setor}</td>
                <td className="px-4 py-3 text-muted-foreground">{PRIORIDADE_LABEL[servico.prioridade]}</td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {servico.slaAtendimentoHoras}h / {servico.slaResolucaoHoras}h
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      servico.ativo ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {servico.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={alternar.isPending}
                    onClick={() => alternar.mutate({ id: servico.id, ativo: !servico.ativo })}
                  >
                    {servico.ativo ? "Desativar" : "Reativar"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ConfiguracaoSla() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, error } = useQuery({ queryKey: ["sla"], queryFn: obterSla });
  const [form, setForm] = useState<SlaConfig | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const salvar = useMutation({
    mutationFn: (payload: SlaConfig) => salvarSla(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sla"] });
      toast.success("Parâmetros de SLA atualizados");
    },
    onError: (erro: Error) => toast.error("Não foi possível salvar o SLA", { description: erro.message }),
  });

  if (isError) {
    return (
      <div className="surface-card p-4">
        <MensagemErro erro={error} />
      </div>
    );
  }
  if (isPending || !form) {
    return (
      <div className="surface-card overflow-hidden">
        <SkeletonTabela />
      </div>
    );
  }

  const invalido =
    !form ||
    PRIORIDADE_OPCOES.some((p) => {
      const config = form[p.value];
      return (
        !config ||
        config.atendimentoHoras <= 0 ||
        config.resolucaoHoras <= 0 ||
        isNaN(config.atendimentoHoras) ||
        isNaN(config.resolucaoHoras)
      );
    });

  return (
    <form
      className="surface-card space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!invalido) salvar.mutate(form);
      }}
    >
      <div>
        <h2 className="text-base font-semibold text-foreground">Parâmetros de SLA por prioridade</h2>
        <p className="text-sm text-muted-foreground">
          Valores padrão sugeridos ao cadastrar serviços. O cronômetro fica pausado enquanto o chamado aguarda.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PRIORIDADE_OPCOES.map((p) => (
          <fieldset key={p.value} className="space-y-3 rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-semibold text-foreground">{p.label}</legend>
            <div className="space-y-1.5">
              <Label htmlFor={`sla-at-${p.value}`}>1ª resposta (h)</Label>
              <Input
                id={`sla-at-${p.value}`}
                type="number"
                min={1}
                value={form[p.value].atendimentoHoras}
                onChange={(e) =>
                  setForm({
                    ...form,
                    [p.value]: { ...form[p.value], atendimentoHoras: Number(e.target.value) },
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`sla-res-${p.value}`}>Resolução (h)</Label>
              <Input
                id={`sla-res-${p.value}`}
                type="number"
                min={1}
                value={form[p.value].resolucaoHoras}
                onChange={(e) =>
                  setForm({
                    ...form,
                    [p.value]: { ...form[p.value], resolucaoHoras: Number(e.target.value) },
                  })
                }
              />
            </div>
          </fieldset>
        ))}
      </div>

      <Button type="submit" disabled={invalido || salvar.isPending}>
        {salvar.isPending ? "Salvando..." : "Salvar SLA"}
      </Button>
    </form>
  );
}
