import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Building,
  CheckCircle2,
  Globe,
  KeyRound,
  Lock,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { MensagemErro } from "@/components/comum/MensagemErro";
import { AppLayout } from "@/components/layout/AppLayout";
import { RotaProtegida } from "@/components/layout/RotaProtegida";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PAPEL_LABEL } from "@/lib/dominio";
import { dataCurta, iniciais } from "@/lib/format";
import { textoSeguro } from "@/lib/sanitize";
import { alterarSenha, completarCadastro } from "@/services/auth";
import { obterConfigDominios, salvarConfigDominios, type ConfigDominios } from "@/services/configuracoes";
import { useAuthStore } from "@/stores/auth";

export const Route = createFileRoute("/perfil")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Meu perfil — Central de Chamados" },
      {
        name: "description",
        content: "Consulte e atualize seus dados de acesso, contato e segurança na Central de Chamados.",
      },
      { property: "og:title", content: "Meu perfil — Central de Chamados" },
    ],
  }),
  component: () => (
    <RotaProtegida permissao="chamados:ler">
      <PerfilPage />
    </RotaProtegida>
  ),
});

function PerfilPage() {
  const user = useAuthStore((s) => s.user);
  const atualizarUsuario = useAuthStore((s) => s.atualizarUsuario);
  const queryClient = useQueryClient();

  if (!user) return null;

  return (
    <AppLayout titulo="Meu perfil" descricao="Gerencie seus dados institucionais, contato e segurança">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Avatar + nome */}
        <div className="surface-card flex items-center gap-4 p-5">
          <span
            aria-hidden
            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xl font-bold text-primary"
          >
            {iniciais(user.nome)}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-foreground">{textoSeguro(user.nome, 80)}</h2>
            <p className="truncate text-sm text-muted-foreground">{textoSeguro(user.email, 100)}</p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">
              {PAPEL_LABEL[user.papel]}
            </span>
          </div>
        </div>

        <Tabs defaultValue="dados">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="dados" className="gap-1.5">
              <UserRound className="size-4" />
              Dados cadastrais
            </TabsTrigger>
            <TabsTrigger value="contato" className="gap-1.5">
              <Phone className="size-4" />
              Contato & Local
            </TabsTrigger>
            <TabsTrigger value="senha" className="gap-1.5">
              <KeyRound className="size-4" />
              Alterar senha
            </TabsTrigger>
            {user.papel === "superusuario" && (
              <TabsTrigger value="dominios" className="gap-1.5">
                <Globe className="size-4" />
                Domínios Institucionais
              </TabsTrigger>
            )}
          </TabsList>

          {/* Aba: dados cadastrais */}
          <TabsContent value="dados" className="mt-4">
            <section className="surface-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Informações institucionais</h3>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Item rotulo="Nome completo" valor={textoSeguro(user.nome, 80)} />
                <Item rotulo="E-mail institucional" valor={textoSeguro(user.email, 100)} />
                <Item rotulo="Perfil de acesso" valor={PAPEL_LABEL[user.papel]} />
                <Item rotulo="Setor" valor={textoSeguro(user.setor, 40)} />
                <Item rotulo="Situação da conta" valor={user.ativo ? "Ativa" : "Inativa"} />
                <Item rotulo="Cadastrado em" valor={dataCurta(user.criadoEm)} />
                {user.criadoPorNome && (
                  <Item rotulo="Cadastrado por" valor={textoSeguro(user.criadoPorNome, 80)} />
                )}
                {user.termosAceitosEm && (
                  <Item rotulo="Termos aceitos em" valor={dataCurta(user.termosAceitosEm)} />
                )}
              </dl>
            </section>
          </TabsContent>

          {/* Aba: contato e localidade */}
          <TabsContent value="contato" className="mt-4">
            <ContatoForm onAtualizado={atualizarUsuario} queryClient={queryClient} />
          </TabsContent>

          {/* Aba: alterar senha */}
          <TabsContent value="senha" className="mt-4">
            <AlterarSenhaForm />
          </TabsContent>

          {/* Aba: domínios institucionais (apenas superusuário) */}
          {user.papel === "superusuario" && (
            <TabsContent value="dominios" className="mt-4">
              <DominiosInstitucionaisTab />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}

function ContatoForm({
  onAtualizado,
}: {
  onAtualizado: (u: import("@/types").User) => void;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const userAuth = useAuthStore((s) => s.user)!;
  const [telefone, setTelefone] = useState(userAuth.telefone ?? "");
  const [localidade, setLocalidade] = useState(userAuth.localidade ?? "");
  const atualizarUsuario = useAuthStore((s) => s.atualizarUsuario);

  useEffect(() => {
    setTelefone(userAuth.telefone ?? "");
    setLocalidade(userAuth.localidade ?? "");
  }, [userAuth]);

  const salvar = useMutation({
    mutationFn: () => completarCadastro({ telefone: telefone.trim(), localidade: localidade.trim() }),
    onSuccess: (atualizado) => {
      const userCompleto: import("@/types").User = {
        ...userAuth,
        ...atualizado,
      };
      atualizarUsuario(userCompleto);
      onAtualizado(userCompleto);
      toast.success("Dados de contato atualizados com sucesso.");
    },
    onError: (erro: Error) => toast.error("Não foi possível salvar", { description: erro.message }),
  });

  const valido =
    telefone.replace(/\D/g, "").length >= 10 && localidade.trim().length >= 3;

  return (
    <section className="surface-card p-5">
      <h3 className="mb-1 text-sm font-semibold text-foreground">Telefone de contato e localidade</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        O telefone é utilizado para recuperação de senha via SMS. A localidade agiliza atendimentos presenciais.
      </p>

      {salvar.isError && <MensagemErro erro={salvar.error} />}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valido) salvar.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="perfil-telefone">Telefone celular com DDD</Label>
          <div className="relative">
            <Phone aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="perfil-telefone"
              placeholder="(31) 98765-4321"
              className="pl-9"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="perfil-localidade">Localidade / Lotação física</Label>
          <div className="relative">
            <MapPin aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="perfil-localidade"
              placeholder="Ex.: Sede Principal - 3º Andar - Sala 302"
              className="pl-9"
              value={localidade}
              onChange={(e) => setLocalidade(e.target.value)}
            />
          </div>
        </div>

        {userAuth.primeiroAcessoConcluido && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>Cadastro de contato já foi concluído anteriormente.</span>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={!valido || salvar.isPending}>
            {salvar.isPending ? "Salvando…" : "Atualizar contato"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function AlterarSenhaForm() {
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [mostrar, setMostrar] = useState(false);

  const salvar = useMutation({
    mutationFn: () => alterarSenha({ senhaAtual, novaSenha }),
    onSuccess: () => {
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmar("");
      toast.success("Senha alterada com sucesso!", {
        description: "Utilize a nova senha no próximo acesso.",
      });
    },
    onError: (erro: Error) => toast.error("Não foi possível alterar a senha", { description: erro.message }),
  });

  const senhasIguais = novaSenha === confirmar;
  const valido = senhaAtual.length >= 6 && novaSenha.length >= 6 && senhasIguais;

  return (
    <section className="surface-card p-5">
      <h3 className="mb-1 text-sm font-semibold text-foreground">Alterar senha de acesso</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Por segurança, informe a senha atual antes de definir uma nova.
      </p>

      {salvar.isError && <MensagemErro erro={salvar.error} />}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valido) salvar.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="senha-atual">Senha atual</Label>
          <div className="relative">
            <Lock aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="senha-atual"
              type={mostrar ? "text" : "password"}
              placeholder="Senha atual"
              className="pl-9"
              value={senhaAtual}
              autoComplete="current-password"
              onChange={(e) => setSenhaAtual(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="nova-senha">Nova senha</Label>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => setMostrar(!mostrar)}
            >
              {mostrar ? "Ocultar" : "Mostrar senhas"}
            </button>
          </div>
          <div className="relative">
            <Lock aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="nova-senha"
              type={mostrar ? "text" : "password"}
              placeholder="Mínimo 6 caracteres"
              className="pl-9"
              value={novaSenha}
              autoComplete="new-password"
              onChange={(e) => setNovaSenha(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmar-senha">Confirmar nova senha</Label>
          <div className="relative">
            <Lock aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="confirmar-senha"
              type={mostrar ? "text" : "password"}
              placeholder="Repita a nova senha"
              className="pl-9"
              value={confirmar}
              autoComplete="new-password"
              onChange={(e) => setConfirmar(e.target.value)}
            />
          </div>
          {confirmar && !senhasIguais && (
            <p className="text-sm text-destructive">As senhas não coincidem.</p>
          )}
        </div>

        {/* Barra de força da senha */}
        {novaSenha.length > 0 && (
          <div className="space-y-1">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    forca(novaSenha) >= n
                      ? n <= 1
                        ? "bg-destructive"
                        : n === 2
                          ? "bg-yellow-500"
                          : n === 3
                            ? "bg-blue-500"
                            : "bg-green-500"
                      : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{forcaLabel(novaSenha)}</p>
          </div>
        )}

        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground flex items-center gap-2">
          <ShieldCheck className="size-4 shrink-0 text-primary" />
          <span>
            Use letras maiúsculas, minúsculas, números e símbolos para uma senha mais segura.
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <Building className="size-4 shrink-0 text-muted-foreground/50" />
          <Button type="submit" className="ml-auto" disabled={!valido || salvar.isPending}>
            {salvar.isPending ? "Salvando…" : "Alterar senha"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function forca(senha: string): number {
  let f = 0;
  if (senha.length >= 6) f++;
  if (/[A-Z]/.test(senha)) f++;
  if (/[0-9]/.test(senha)) f++;
  if (/[^A-Za-z0-9]/.test(senha)) f++;
  return f;
}

function forcaLabel(senha: string): string {
  const f = forca(senha);
  if (f <= 1) return "Senha muito fraca";
  if (f === 2) return "Senha fraca";
  if (f === 3) return "Senha moderada";
  return "Senha forte";
}

function Item({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{valor}</dd>
    </div>
  );
}

function DominiosInstitucionaisTab() {
  const queryClient = useQueryClient();
  const [novoDominio, setNovoDominio] = useState("");

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["config-dominios"],
    queryFn: obterConfigDominios,
  });

  const [dominios, setDominios] = useState<string[]>([]);
  const [padrao, setPadrao] = useState<string>("");

  useEffect(() => {
    if (data) {
      setDominios(Array.isArray(data.dominios) ? data.dominios : []);
      setPadrao(data.padrao ?? "");
    }
  }, [data]);

  const salvar = useMutation({
    mutationFn: (payload: ConfigDominios) => salvarConfigDominios(payload),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["config-dominios"] });
      setDominios(Array.isArray(res.dominios) ? res.dominios : []);
      setPadrao(res.padrao ?? "");
      toast.success("Domínios institucionais salvos com sucesso.", {
        description: `Domínio padrão pré-selecionado: @${res.padrao}`,
      });
    },
    onError: (erro: Error) => toast.error("Não foi possível salvar", { description: erro.message }),
  });

  function handleAdicionar() {
    let limpo = novoDominio.trim().toLowerCase().replace(/^@/, "");
    if (!limpo || limpo.length < 3 || !limpo.includes(".")) {
      toast.error("Informe um domínio válido (ex.: orgao.gov.br ou defensoria.mg.def.br)");
      return;
    }
    if (dominios.includes(limpo)) {
      toast.error("Este domínio já está cadastrado.");
      return;
    }
    const novos = [...dominios, limpo];
    setDominios(novos);
    setNovoDominio("");
    if (!padrao) setPadrao(limpo);
  }

  function handleRemover(d: string) {
    if (dominios.length <= 1) {
      toast.error("Deve haver ao menos um domínio institucional cadastrado.");
      return;
    }
    const novos = dominios.filter((x) => x !== d);
    setDominios(novos);
    if (padrao === d) {
      setPadrao(novos[0] || "");
    }
  }

  function handleSalvar() {
    if (dominios.length === 0) {
      toast.error("Adicione ao menos um domínio.");
      return;
    }
    if (!padrao || !dominios.includes(padrao)) {
      toast.error("Selecione um domínio padrão válido.");
      return;
    }
    salvar.mutate({ dominios, padrao });
  }

  return (
    <section className="surface-card space-y-5 p-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Gerenciamento de Domínios Institucionais</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Cadastre os sufixos de e-mail autorizados para os servidores e defina qual será o domínio pré-selecionado por padrão na criação de contas.
        </p>
      </div>

      {isError && <MensagemErro erro={error} />}

      {isPending ? (
        <p className="text-sm text-muted-foreground">Carregando configurações…</p>
      ) : (
        <div className="space-y-4">
          {/* Adicionar novo domínio */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="novo-dominio">Novo domínio institucional</Label>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-muted-foreground">@</span>
                <Input
                  id="novo-dominio"
                  placeholder="ex.: instituto.gov.br"
                  value={novoDominio}
                  onChange={(e) => setNovoDominio(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAdicionar();
                    }
                  }}
                />
              </div>
            </div>
            <Button type="button" variant="outline" className="gap-1" onClick={handleAdicionar}>
              <Plus className="size-4" /> Adicionar
            </Button>
          </div>

          {/* Lista de domínios cadastrados */}
          <div className="space-y-2">
            <Label>Domínios autorizados e Domínio Padrão (Pré-selecionado)</Label>
            <div className="divide-y divide-border rounded-lg border border-border bg-card">
              {dominios.map((dom) => {
                const ehPadrao = padrao === dom;
                return (
                  <div key={dom} className="flex items-center justify-between p-3 text-sm">
                    <label className="flex cursor-pointer items-center gap-2.5">
                      <input
                        type="radio"
                        name="dominio-padrao"
                        checked={ehPadrao}
                        onChange={() => setPadrao(dom)}
                        className="size-4 accent-primary"
                      />
                      <span className="font-mono font-medium text-foreground">@{dom}</span>
                      {ehPadrao && (
                        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                          Padrão pré-selecionado
                        </span>
                      )}
                    </label>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      disabled={dominios.length <= 1}
                      title={dominios.length <= 1 ? "O sistema necessita de ao menos 1 domínio" : "Remover domínio"}
                      onClick={() => handleRemover(dom)}
                    >
                      <Trash2 className="size-4" />
                      <span className="sr-only">Remover @{dom}</span>
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSalvar} disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando configurações…" : "Salvar domínios"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

