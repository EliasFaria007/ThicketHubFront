import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Building,
  CheckCircle2,
  ChevronDown,
  FileSignature,
  FileUp,
  Globe,
  ImageIcon,
  KeyRound,
  Lock,
  MapPin,
  PenLine,
  Phone,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { MensagemErro } from "@/components/comum/MensagemErro";
import { AppLayout } from "@/components/layout/AppLayout";
import { RotaProtegida } from "@/components/layout/RotaProtegida";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  MODELOS_ASSINATURAS_PRONTAS,
  extrairTextoEImagemAssinatura,
  gerarAssinaturaPadrao,
  lerArquivoAssinaturaPronta,
  montarAssinaturaCompleta,
} from "@/lib/assinatura";
import { PAPEL_LABEL } from "@/lib/dominio";
import { dataCurta, iniciais } from "@/lib/format";
import { textoSeguro } from "@/lib/sanitize";
import { alterarSenha, completarCadastro } from "@/services/auth";
import { obterConfigDominios, salvarConfigDominios, type ConfigDominios } from "@/services/configuracoes";
import { obterUsuarioLogado, salvarAssinaturaUsuario } from "@/services/usuarios";
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

  useQuery({
    queryKey: ["usuario-perfil-atual", user?.id],
    queryFn: async () => {
      try {
        const u = await obterUsuarioLogado();
        if (u) {
          atualizarUsuario(u);
          return u;
        }
      } catch {
        // fallback
      }
      return null;
    },
    enabled: Boolean(user?.id),
    staleTime: 5_000,
  });

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
            <TabsTrigger value="assinatura" className="gap-1.5">
              <PenLine className="size-4" />
              Assinatura
            </TabsTrigger>
            {user.papel === "superusuario" && (
              <TabsTrigger value="dominios" className="gap-1.5">
                <Globe className="size-4" />
                Domínios
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

          {/* Aba: assinatura (estilo Outlook) */}
          <TabsContent value="assinatura" className="mt-4">
            <AssinaturaForm onAtualizado={atualizarUsuario} />
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

function AssinaturaForm({
  onAtualizado,
}: {
  onAtualizado: (u: import("@/types").User) => void;
}) {
  const user = useAuthStore((s) => s.user)!;
  const queryClient = useQueryClient();
  const infoInicial = extrairTextoEImagemAssinatura(user.assinatura);
  const [assinatura, setAssinatura] = useState(infoInicial.texto);
  const [anexoImagem, setAnexoImagem] = useState<string | null>(infoInicial.imagem);
  const [incluirPadrao, setIncluirPadrao] = useState(user.incluirAssinaturaPadrao ?? true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const info = extrairTextoEImagemAssinatura(user.assinatura);
    setAssinatura(info.texto);
    setAnexoImagem(info.imagem);
    setIncluirPadrao(user.incluirAssinaturaPadrao ?? true);
  }, [user]);

  const salvar = useMutation({
    mutationFn: () => {
      const assinaturaFinal = montarAssinaturaCompleta(assinatura, anexoImagem);
      return salvarAssinaturaUsuario(user.id, {
        assinatura: assinaturaFinal || null,
        incluirAssinaturaPadrao: incluirPadrao,
        nome: user.nome,
        email: user.email,
      });
    },
    onSuccess: (atualizado) => {
      const assinaturaFinal = montarAssinaturaCompleta(assinatura, anexoImagem);
      const userCompleto: import("@/types").User = {
        ...user,
        ...atualizado,
        assinatura: assinaturaFinal || null,
        incluirAssinaturaPadrao: incluirPadrao,
      };
      onAtualizado(userCompleto);
      void queryClient.invalidateQueries({ queryKey: ["usuario-perfil-atual"] });
      void queryClient.invalidateQueries({ queryKey: ["usuario-logado-atual"] });
      toast.success("Assinatura salva com sucesso!", {
        description: incluirPadrao
          ? "Sua assinatura será inserida automaticamente nas respostas e atendimentos aos solicitantes."
          : "Inclusão automática desativada. Você ainda pode inseri-la manualmente via botão nos chamados.",
      });
    },
    onError: (erro: Error) => toast.error("Não foi possível salvar a assinatura", { description: erro.message }),
  });

  function gerarModelo() {
    const modelo = gerarAssinaturaPadrao({
      nome: user.nome,
      setor: user.setor,
      email: user.email,
      telefone: user.telefone,
    });
    setAssinatura(modelo);
    toast.info("Modelo de assinatura institucional gerado. Personalize se desejar e clique em salvar.");
  }

  function aplicarModeloPronto(mod: (typeof MODELOS_ASSINATURAS_PRONTAS)[number]) {
    const texto = mod.gerar({
      nome: user.nome,
      setor: user.setor,
      email: user.email,
      telefone: user.telefone,
    });
    setAssinatura(texto);
    toast.success(`Modelo pronto "${mod.titulo}" aplicado com sucesso!`);
  }

  async function handleAnexoArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await lerArquivoAssinaturaPronta(file);
      if (res.tipo === "texto") {
        setAssinatura(res.conteudo);
        toast.success(`Assinatura importada do arquivo "${res.nome}" com sucesso!`);
      } else {
        setAnexoImagem(res.conteudo);
        if (!assinatura.trim()) {
          setAssinatura(`Atenciosamente,\n${user.nome}\n${user.setor ? `${user.setor} — ` : ""}Central de Atendimento`);
        }
        toast.success(`Imagem de assinatura "${res.nome}" anexada com sucesso!`);
      }
    } catch (err: any) {
      toast.error("Erro ao ler arquivo da assinatura", { description: err?.message });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function limpar() {
    setAssinatura("");
    setAnexoImagem(null);
  }

  return (
    <section className="surface-card space-y-5 p-5">
      <div>
        <div className="flex items-center gap-2">
          <PenLine className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Configurar Assinatura (Estilo Outlook)</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Configure sua assinatura institucional ou anexe assinaturas já prontas para serem inseridas no corpo das respostas e pareceres enviados ao solicitante.
        </p>
      </div>

      {salvar.isError && <MensagemErro erro={salvar.error} />}

      {/* Input oculto para carregar arquivo de assinatura pronta */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.html,.md,.png,.jpg,.jpeg,.webp,.pdf"
        className="sr-only"
        onChange={handleAnexoArquivo}
      />

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          salvar.mutate();
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="assinatura-texto">Texto da assinatura</Label>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Botão para anexar arquivo de assinatura pronta */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs font-medium"
              onClick={() => fileInputRef.current?.click()}
              title="Carregar arquivo .txt, .html ou imagem de assinatura já pronta"
            >
              <FileUp className="size-3.5 text-primary" />
              <span>Anexar assinatura pronta</span>
            </Button>

            {/* Menu de modelos de assinaturas prontas */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-xs font-medium"
                  title="Escolher entre modelos de assinaturas institucionais prontas"
                >
                  <Sparkles className="size-3.5 text-primary" />
                  <span>Modelos prontos</span>
                  <ChevronDown className="size-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Modelos pré-configurados
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    className="cursor-pointer gap-2 text-xs"
                    onClick={gerarModelo}
                  >
                    <FileSignature className="size-3.5 text-primary" />
                    <span>Padrão Institucional</span>
                  </DropdownMenuItem>
                  {MODELOS_ASSINATURAS_PRONTAS.map((mod) => (
                    <DropdownMenuItem
                      key={mod.id}
                      className="cursor-pointer flex flex-col items-start gap-0.5 text-xs py-1.5"
                      onClick={() => aplicarModeloPronto(mod)}
                    >
                      <span className="font-medium text-foreground">{mod.titulo}</span>
                      <span className="text-[10px] text-muted-foreground line-clamp-1">{mod.descricao}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {assinatura && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-xs text-muted-foreground hover:text-destructive"
                onClick={limpar}
              >
                <RotateCcw className="size-3" />
                Limpar
              </Button>
            )}
          </div>
        </div>

        <Textarea
          id="assinatura-texto"
          rows={5}
          value={assinatura}
          onChange={(e) => setAssinatura(e.target.value)}
          placeholder={`Ex.:\nAtenciosamente,\n${user.nome}\n${user.setor} — Central de Atendimento\n${user.email}`}
          className="font-mono text-xs sm:text-sm"
        />

        {/* Card de imagem gráfica de assinatura se tiver sido carregada */}
        {anexoImagem && (
          <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
            <div className="flex items-center gap-3">
              <img
                src={anexoImagem}
                alt="Assinatura gráfica"
                className="h-12 w-28 rounded border border-border object-contain bg-white dark:bg-card p-0.5"
              />
              <div>
                <span className="font-semibold text-foreground">Imagem de assinatura pronta</span>
                <p className="text-[11px] text-muted-foreground">
                  Esta imagem será exibida visualmente junto ao corpo da sua assinatura.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:bg-destructive/10"
              onClick={() => setAnexoImagem(null)}
            >
              Remover imagem
            </Button>
          </div>
        )}

        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={incluirPadrao}
              onChange={(e) => setIncluirPadrao(e.target.checked)}
              className="mt-0.5 size-4 accent-primary"
            />
            <div className="text-xs">
              <span className="font-medium text-foreground">
                Inserir assinatura automaticamente no corpo do texto enviado ao solicitante
              </span>
              <p className="mt-0.5 text-muted-foreground">
                Ao responder chamados ou registrar o atendimento, sua assinatura será incluída no final do texto (com separador &quot;--&quot;), exatamente como no Microsoft Outlook.
              </p>
            </div>
          </label>
        </div>

        {/* Pré-visualização ao vivo */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Pré-visualização (como o solicitante visualizará o chamado):
          </Label>
          <div className="rounded-lg border border-border bg-card p-4 text-sm shadow-sm">
            <div className="text-muted-foreground italic mb-3">
              [Mensagem de atualização ou parecer do atendimento registrado pelo atendente...]
            </div>
            <div className="border-t border-border pt-3">
              <div className="text-xs text-muted-foreground mb-1">--</div>
              {assinatura.trim() || anexoImagem ? (
                <div className="space-y-2">
                  {assinatura.trim() && (
                    <div className="whitespace-pre-line text-xs sm:text-sm text-foreground font-medium">
                      {assinatura.trim()}
                    </div>
                  )}
                  {anexoImagem && (
                    <div className="pt-1">
                      <img
                        src={anexoImagem}
                        alt="Assinatura gráfica"
                        className="max-h-20 max-w-xs rounded border border-border object-contain bg-white dark:bg-card p-1 shadow-xs"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs italic text-muted-foreground">
                  (Nenhuma assinatura configurada ainda)
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={salvar.isPending} className="gap-2">
            <PenLine className="size-4" />
            {salvar.isPending ? "Salvando…" : "Salvar assinatura"}
          </Button>
        </div>
      </form>
    </section>
  );
}

