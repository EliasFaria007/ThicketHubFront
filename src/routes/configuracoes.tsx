import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  Database,
  Globe,
  Inbox,
  KeyRound,
  Loader2,
  Mail,
  Network,
  RefreshCw,
  Send,
  Server,
  ShieldAlert,
  TestTube2,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { MensagemErro } from "@/components/comum/MensagemErro";
import { AppLayout } from "@/components/layout/AppLayout";
import { RotaProtegida } from "@/components/layout/RotaProtegida";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SETORES } from "@/lib/dominio";
import {
  obterConfiguracaoEmail,
  obterConfiguracaoLdap,
  obterDominiosInstitucionais,
  salvarConfiguracaoEmail,
  salvarConfiguracaoLdap,
  salvarDominiosInstitucionais,
  sincronizarLdap,
  testarConexaoLdap,
  testarEnvioEmail,
} from "@/services/configuracoes";
import type {
  ConfiguracaoEmail,
  ConfiguracaoLdap,
  ResultadoTesteEmail,
  ResultadoTesteLdap,
} from "@/types";

export const Route = createFileRoute("/configuracoes")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Configurações Corporativas — Central de Chamados" },
      {
        name: "description",
        content:
          "Gerenciamento de integrações corporativas LDAP / Active Directory, envio de e-mails SMTP, Mail-to-Ticket e domínios.",
      },
    ],
  }),
  component: () => (
    <RotaProtegida permissao="usuarios:gerenciar">
      <ConfiguracoesPage />
    </RotaProtegida>
  ),
});

type AbaConfig = "ldap" | "email" | "dominios";

function ConfiguracoesPage() {
  const [abaAtiva, setAbaAtiva] = useState<AbaConfig>("ldap");

  return (
    <AppLayout
      titulo="Integrações & Configurações"
      descricao="Integração com Active Directory / LDAP corporativo, mensageria de e-mails e domínios"
    >
      <div className="space-y-6">
        {/* Abas de navegação */}
        <div className="flex flex-wrap gap-2 border-b border-border pb-3">
          <Button
            variant={abaAtiva === "ldap" ? "default" : "outline"}
            size="sm"
            onClick={() => setAbaAtiva("ldap")}
            className="gap-2"
          >
            <Network className="size-4" />
            LDAP / Active Directory
          </Button>
          <Button
            variant={abaAtiva === "email" ? "default" : "outline"}
            size="sm"
            onClick={() => setAbaAtiva("email")}
            className="gap-2"
          >
            <Mail className="size-4" />
            E-mail & Mail-to-Ticket
          </Button>
          <Button
            variant={abaAtiva === "dominios" ? "default" : "outline"}
            size="sm"
            onClick={() => setAbaAtiva("dominios")}
            className="gap-2"
          >
            <Globe className="size-4" />
            Domínios Institucionais
          </Button>
        </div>

        {/* Conteúdo da aba */}
        {abaAtiva === "ldap" && <PainelLdap />}
        {abaAtiva === "email" && <PainelEmail />}
        {abaAtiva === "dominios" && <PainelDominios />}
      </div>
    </AppLayout>
  );
}

// ---------------------------------------------------------------------------
// ABA 1: LDAP / Active Directory
// ---------------------------------------------------------------------------

function PainelLdap() {
  const queryClient = useQueryClient();
  const qLdap = useQuery({
    queryKey: ["configuracoes", "ldap"],
    queryFn: obterConfiguracaoLdap,
  });

  const [form, setForm] = useState<ConfiguracaoLdap>({
    ativo: false,
    servidor: "",
    porta: 389,
    usarSsl: false,
    baseDn: "",
    dominio: "",
    usuarioBind: "",
    senhaBind: "",
    filtroUsuario: "(&(objectClass=user)(sAMAccountName={0}))",
    grupoTecnico: "",
    grupoAdmin: "",
    grupoSuper: "",
    sincronizacaoAutomatica: false,
    intervaloMinutos: 60,
  });

  const [resultadoTeste, setResultadoTeste] = useState<ResultadoTesteLdap | null>(null);

  useEffect(() => {
    if (qLdap.data) {
      setForm((prev) => ({ ...prev, ...qLdap.data }));
    }
  }, [qLdap.data]);

  const mSalvar = useMutation({
    mutationFn: salvarConfiguracaoLdap,
    onSuccess: (dados) => {
      toast.success("Configuração LDAP salva com sucesso");
      setForm((prev) => ({ ...prev, ...dados }));
      void queryClient.invalidateQueries({ queryKey: ["configuracoes", "ldap"] });
    },
    onError: (err: Error) => toast.error("Falha ao salvar LDAP", { description: err.message }),
  });

  const mTestar = useMutation({
    mutationFn: testarConexaoLdap,
    onSuccess: (res) => {
      setResultadoTeste(res);
      if (res.sucesso) {
        toast.success("Conexão LDAP bem-sucedida!", {
          description: `Latência: ${res.tempoRespostaMs}ms · Usuários encontrados: ${res.detalhes?.usuariosEncontrados ?? 0}`,
        });
      } else {
        toast.error("Falha ao conectar no LDAP", { description: res.mensagem });
      }
    },
    onError: (err: Error) => toast.error("Erro no teste de conexão", { description: err.message }),
  });

  const mSincronizar = useMutation({
    mutationFn: sincronizarLdap,
    onSuccess: (res) => {
      toast.success("Sincronização concluída", {
        description: `${res.totalSincronizados} usuários sincronizados do diretório`,
      });
      void queryClient.invalidateQueries({ queryKey: ["configuracoes", "ldap"] });
      void queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
    onError: (err: Error) => toast.error("Falha na sincronização", { description: err.message }),
  });

  if (qLdap.isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="surface-card p-6">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Server className="size-5 text-primary" />
              Autenticação e Diretório Corporativo
            </h2>
            <p className="text-sm text-muted-foreground">
              Permite aos usuários acessarem a plataforma com suas credenciais de rede (Active Directory ou OpenLDAP).
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer font-medium text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border-input text-primary focus:ring-primary"
              checked={form.ativo}
              onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
            />
            Habilitar Autenticação LDAP
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="servidor">Servidor / Host do Controlador de Domínio</Label>
            <Input
              id="servidor"
              placeholder="ex: dc1.empresa.local ou 10.26.1.10"
              value={form.servidor}
              onChange={(e) => setForm((f) => ({ ...f, servidor: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="porta">Porta</Label>
              <Input
                id="porta"
                type="number"
                value={form.porta}
                onChange={(e) => setForm((f) => ({ ...f, porta: Number(e.target.value) || 389 }))}
              />
            </div>
            <div className="space-y-1.5 flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer text-sm pb-2">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input text-primary focus:ring-primary"
                  checked={form.usarSsl}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      usarSsl: e.target.checked,
                      porta: e.target.checked && f.porta === 389 ? 636 : f.porta,
                    }))
                  }
                />
                Usar LDAPS (SSL/TLS)
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="baseDn">Base DN (Search Base)</Label>
            <Input
              id="baseDn"
              placeholder="ex: dc=empresa,dc=local"
              value={form.baseDn}
              onChange={(e) => setForm((f) => ({ ...f, baseDn: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dominio">Domínio NetBIOS / UPN</Label>
            <Input
              id="dominio"
              placeholder="ex: EMPRESA ou @empresa.local"
              value={form.dominio}
              onChange={(e) => setForm((f) => ({ ...f, dominio: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="usuarioBind">Usuário de Serviço (Bind DN ou UPN)</Label>
            <Input
              id="usuarioBind"
              placeholder="ex: svc_helpdesk@empresa.local"
              value={form.usuarioBind}
              onChange={(e) => setForm((f) => ({ ...f, usuarioBind: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="senhaBind">Senha do Usuário de Serviço</Label>
            <Input
              id="senhaBind"
              type="password"
              placeholder="••••••••••••"
              value={form.senhaBind ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, senhaBind: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="filtroUsuario">Filtro de Busca de Usuário</Label>
            <Input
              id="filtroUsuario"
              value={form.filtroUsuario}
              onChange={(e) => setForm((f) => ({ ...f, filtroUsuario: e.target.value }))}
            />
          </div>
        </div>

        {/* Mapeamento de Grupos para Perfis */}
        <div className="mt-6 border-t border-border pt-6">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <KeyRound className="size-4 text-primary" />
            Mapeamento Automático de Perfis via Grupos do AD
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Grupo de Técnicos</Label>
              <Input
                className="text-xs"
                placeholder="CN=Helpdesk_Techs..."
                value={form.grupoTecnico}
                onChange={(e) => setForm((f) => ({ ...f, grupoTecnico: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Grupo de Administradores</Label>
              <Input
                className="text-xs"
                placeholder="CN=IT_Admins..."
                value={form.grupoAdmin}
                onChange={(e) => setForm((f) => ({ ...f, grupoAdmin: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Grupo de Superadmins</Label>
              <Input
                className="text-xs"
                placeholder="CN=Domain_Admins..."
                value={form.grupoSuper}
                onChange={(e) => setForm((f) => ({ ...f, grupoSuper: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Painel de status do teste */}
        {resultadoTeste && (
          <div
            className={`mt-6 rounded-lg border p-4 text-sm ${
              resultadoTeste.sucesso
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-300"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              {resultadoTeste.sucesso ? (
                <CheckCircle2 className="size-4 text-emerald-600" />
              ) : (
                <ShieldAlert className="size-4 text-destructive" />
              )}
              {resultadoTeste.mensagem}
            </div>
            {resultadoTeste.detalhes && (
              <div className="mt-2 text-xs flex flex-wrap gap-4 opacity-90">
                <span>Servidor acessível: {resultadoTeste.detalhes.servidorAcessivel ? "Sim" : "Não"}</span>
                <span>Bind autenticado: {resultadoTeste.detalhes.bindAutenticado ? "Sim" : "Não"}</span>
                <span>Usuários encontrados: {resultadoTeste.detalhes.usuariosEncontrados}</span>
                <span>Latência: {resultadoTeste.tempoRespostaMs}ms</span>
              </div>
            )}
          </div>
        )}

        {/* Botões de Ação */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={mTestar.isPending}
              onClick={() => mTestar.mutate(form)}
              className="gap-1.5"
            >
              {mTestar.isPending ? <Loader2 className="size-4 animate-spin" /> : <TestTube2 className="size-4" />}
              Testar Conexão
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={mSincronizar.isPending || !form.ativo}
              onClick={() => mSincronizar.mutate()}
              className="gap-1.5"
            >
              {mSincronizar.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Sincronizar Usuários Agora
            </Button>
          </div>

          <Button
            type="button"
            disabled={mSalvar.isPending}
            onClick={() => mSalvar.mutate(form)}
            className="gap-1.5"
          >
            {mSalvar.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Salvar Configurações
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ABA 2: E-mail (SMTP & Mail-to-Ticket)
// ---------------------------------------------------------------------------

function PainelEmail() {
  const queryClient = useQueryClient();
  const qEmail = useQuery({
    queryKey: ["configuracoes", "email"],
    queryFn: obterConfiguracaoEmail,
  });

  const [form, setForm] = useState<ConfiguracaoEmail>({
    ativo: false,
    servidorSmtp: "",
    portaSmtp: 587,
    usarTls: true,
    usuarioSmtp: "",
    senhaSmtp: "",
    remetenteNome: "Central de Atendimento",
    remetenteEmail: "suporte@empresa.com.br",
    mailToTicketAtivo: false,
    servidorImap: "",
    portaImap: 993,
    usuarioImap: "",
    senhaImap: "",
    setorPadrao: "TI - Suporte Técnico",
  });

  const [emailTeste, setEmailTeste] = useState("");
  const [resultadoTeste, setResultadoTeste] = useState<ResultadoTesteEmail | null>(null);

  useEffect(() => {
    if (qEmail.data) {
      setForm((prev) => ({ ...prev, ...qEmail.data }));
    }
  }, [qEmail.data]);

  const mSalvar = useMutation({
    mutationFn: salvarConfiguracaoEmail,
    onSuccess: (dados) => {
      toast.success("Configuração de e-mail salva com sucesso");
      setForm((prev) => ({ ...prev, ...dados }));
      void queryClient.invalidateQueries({ queryKey: ["configuracoes", "email"] });
    },
    onError: (err: Error) => toast.error("Falha ao salvar e-mail", { description: err.message }),
  });

  const mTestar = useMutation({
    mutationFn: () => testarEnvioEmail(emailTeste, form),
    onSuccess: (res) => {
      setResultadoTeste(res);
      if (res.sucesso) {
        toast.success("E-mail de teste enviado com sucesso!", { description: res.mensagem });
      } else {
        toast.error("Falha ao enviar e-mail de teste", { description: res.mensagem });
      }
    },
    onError: (err: Error) => toast.error("Erro no teste de e-mail", { description: err.message }),
  });

  if (qEmail.isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Barra de Ações Rápidas do Topo */}
      <div className="surface-card flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Mail className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Mensageria Institucional</h3>
            <p className="text-xs text-muted-foreground">
              SMTP: {form.ativo ? <span className="text-emerald-600 font-medium">Habilitado</span> : <span className="text-muted-foreground">Desabilitado</span>} · Mail-to-Ticket: {form.mailToTicketAtivo ? <span className="text-emerald-600 font-medium">Habilitado</span> : <span className="text-muted-foreground">Desabilitado</span>}
            </p>
          </div>
        </div>
        <Button
          type="button"
          disabled={mSalvar.isPending}
          onClick={() => mSalvar.mutate(form)}
          className="gap-1.5"
        >
          {mSalvar.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Salvar Configurações de E-mail
        </Button>
      </div>

      {/* Servidor SMTP de Saída */}
      <div className="surface-card p-6">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Mail className="size-5 text-primary" />
              Servidor SMTP (Envio de Notificações)
            </h2>
            <p className="text-sm text-muted-foreground">
              Envio de e-mails para solicitantes e técnicos sobre abertura, atualizações e encerramento de chamados.
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer font-medium text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border-input text-primary focus:ring-primary"
              checked={form.ativo}
              onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
            />
            Habilitar Envio de E-mails
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="servidorSmtp">Servidor SMTP</Label>
            <Input
              id="servidorSmtp"
              placeholder="ex: smtp.office365.com ou smtp.gmail.com"
              value={form.servidorSmtp}
              onChange={(e) => setForm((f) => ({ ...f, servidorSmtp: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="portaSmtp">Porta</Label>
              <Input
                id="portaSmtp"
                type="number"
                value={form.portaSmtp}
                onChange={(e) => setForm((f) => ({ ...f, portaSmtp: Number(e.target.value) || 587 }))}
              />
            </div>
            <div className="space-y-1.5 flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer text-sm pb-2">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input text-primary focus:ring-primary"
                  checked={form.usarTls}
                  onChange={(e) => setForm((f) => ({ ...f, usarTls: e.target.checked }))}
                />
                Usar TLS / STARTTLS
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="usuarioSmtp">Usuário SMTP</Label>
            <Input
              id="usuarioSmtp"
              placeholder="ex: noreply@empresa.com.br"
              value={form.usuarioSmtp}
              onChange={(e) => setForm((f) => ({ ...f, usuarioSmtp: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="senhaSmtp">Senha SMTP / Senha de Aplicativo</Label>
            <Input
              id="senhaSmtp"
              type="password"
              placeholder="••••••••••••"
              value={form.senhaSmtp ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, senhaSmtp: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="remetenteNome">Nome de Exibição do Remetente</Label>
            <Input
              id="remetenteNome"
              value={form.remetenteNome}
              onChange={(e) => setForm((f) => ({ ...f, remetenteNome: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="remetenteEmail">E-mail de Envio (From:)</Label>
            <Input
              id="remetenteEmail"
              type="email"
              value={form.remetenteEmail}
              onChange={(e) => setForm((f) => ({ ...f, remetenteEmail: e.target.value }))}
            />
          </div>
        </div>

        {/* Teste de Envio */}
        <div className="mt-6 border-t border-border pt-4">
          <Label className="text-xs font-semibold mb-2 block">Enviar E-mail de Teste</Label>
          <div className="flex gap-2 max-w-md">
            <Input
              type="email"
              placeholder="Seu e-mail para receber o teste..."
              value={emailTeste}
              onChange={(e) => setEmailTeste(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={mTestar.isPending || !emailTeste.trim()}
              onClick={() => mTestar.mutate()}
              className="gap-1.5 shrink-0"
            >
              {mTestar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Enviar Teste
            </Button>
          </div>
          {resultadoTeste && (
            <p className={`mt-2 text-xs ${resultadoTeste.sucesso ? "text-emerald-600 font-medium" : "text-destructive font-medium"}`}>
              {resultadoTeste.mensagem}
            </p>
          )}
        </div>
      </div>

      {/* Seção Mail-to-Ticket */}
      <div className="surface-card p-6">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Inbox className="size-5 text-primary" />
              Mail-to-Ticket (Criação de Chamados por E-mail)
            </h2>
            <p className="text-sm text-muted-foreground">
              Monitora uma caixa postal via IMAP e converte automaticamente mensagens recebidas em chamados de suporte.
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer font-medium text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border-input text-primary focus:ring-primary"
              checked={form.mailToTicketAtivo}
              onChange={(e) => setForm((f) => ({ ...f, mailToTicketAtivo: e.target.checked }))}
            />
            Habilitar Mail-to-Ticket
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="servidorImap">Servidor IMAP</Label>
            <Input
              id="servidorImap"
              placeholder="ex: outlook.office365.com ou imap.gmail.com"
              value={form.servidorImap ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, servidorImap: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="portaImap">Porta IMAP</Label>
            <Input
              id="portaImap"
              type="number"
              value={form.portaImap ?? 993}
              onChange={(e) => setForm((f) => ({ ...f, portaImap: Number(e.target.value) || 993 }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="usuarioImap">Usuário IMAP / Conta da Caixa Postal</Label>
            <Input
              id="usuarioImap"
              placeholder="ex: suporte@empresa.com.br"
              value={form.usuarioImap ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, usuarioImap: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="senhaImap">Senha IMAP</Label>
            <Input
              id="senhaImap"
              type="password"
              placeholder="••••••••••••"
              value={form.senhaImap ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, senhaImap: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="setorPadrao">Setor Destino Padrão para Chamados Recebidos</Label>
            <select
              id="setorPadrao"
              value={form.setorPadrao || "TI"}
              onChange={(e) => setForm((f) => ({ ...f, setorPadrao: e.target.value }))}
              className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground"
            >
              {SETORES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end border-t border-border pt-4">
          <Button
            type="button"
            disabled={mSalvar.isPending}
            onClick={() => mSalvar.mutate(form)}
            className="gap-1.5"
          >
            {mSalvar.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Salvar Configurações de E-mail
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ABA 3: Domínios Institucionais
// ---------------------------------------------------------------------------

function PainelDominios() {
  const queryClient = useQueryClient();
  const qDom = useQuery({
    queryKey: ["configuracoes", "dominios"],
    queryFn: obterDominiosInstitucionais,
  });

  const [dominios, setDominios] = useState<string[]>([]);
  const [padrao, setPadrao] = useState("");
  const [novoDominio, setNovoDominio] = useState("");

  useEffect(() => {
    if (qDom.data) {
      setDominios(Array.isArray(qDom.data.dominios) ? qDom.data.dominios : []);
      setPadrao(qDom.data.padrao ?? "");
    }
  }, [qDom.data]);

  const mSalvar = useMutation({
    mutationFn: salvarDominiosInstitucionais,
    onSuccess: (res) => {
      toast.success("Domínios institucionais atualizados");
      setDominios(Array.isArray(res.dominios) ? res.dominios : []);
      setPadrao(res.padrao ?? "");
      void queryClient.invalidateQueries({ queryKey: ["configuracoes", "dominios"] });
    },
    onError: (err: Error) => toast.error("Falha ao salvar domínios", { description: err.message }),
  });

  function adicionarDominio() {
    // Armazenar SEMPRE sem @; o @ é exibido apenas na UI
    let limpo = novoDominio.trim().toLowerCase().replace(/^@+/, "");
    if (!limpo || !limpo.includes(".")) {
      toast.error("Informe um domínio válido (ex.: empresa.com.br)");
      return;
    }
    if (dominios.includes(limpo)) {
      toast.info("Este domínio já está na lista");
      return;
    }
    const novos = [...dominios, limpo];
    setDominios(novos);
    if (!padrao) setPadrao(limpo);
    setNovoDominio("");
  }

  function removerDominio(dom: string) {
    if (dominios.length <= 1) {
      toast.error("É necessário manter pelo menos um domínio corporativo cadastrado");
      return;
    }
    const atualizados = dominios.filter((d) => d !== dom);
    setDominios(atualizados);
    if (padrao === dom) {
      setPadrao(atualizados[0] ?? "");
    }
  }

  if (qDom.isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="surface-card p-6 max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Globe className="size-5 text-primary" />
          Domínios de E-mail Corporativo
        </h2>
        <p className="text-sm text-muted-foreground">
          Domínios aceitos para cadastro institucional e envio de links de primeiro acesso.
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="ex: @empresa.com.br"
          value={novoDominio}
          onChange={(e) => setNovoDominio(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionarDominio();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={adicionarDominio}>
          Adicionar
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Domínios cadastrados (marque o padrão institucional):</Label>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {dominios.map((dom) => (
            <li key={dom} className="flex items-center justify-between p-3 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="dominioPadrao"
                  checked={padrao === dom}
                  onChange={() => setPadrao(dom)}
                  className="size-4 text-primary"
                />
                <span className="font-medium">@{dom}</span>
                {padrao === dom && (
                  <span className="text-[11px] rounded bg-primary/10 px-1.5 py-0.5 text-primary font-semibold">
                    Padrão
                  </span>
                )}
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => removerDominio(dom)}
              >
                Remover
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          type="button"
          disabled={mSalvar.isPending}
          onClick={() => mSalvar.mutate({ dominios, padrao })}
          className="gap-1.5"
        >
          {mSalvar.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Salvar Domínios
        </Button>
      </div>
    </div>
  );
}
