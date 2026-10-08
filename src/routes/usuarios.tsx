import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, FileSpreadsheet, KeyRound, ListPlus, Search, ShieldAlert, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/comum/EmptyState";
import { MensagemErro } from "@/components/comum/MensagemErro";
import { PaginacaoBarra } from "@/components/comum/Paginacao";
import { SkeletonTabela } from "@/components/comum/Skeletons";
import { AppLayout } from "@/components/layout/AppLayout";
import { RotaProtegida } from "@/components/layout/RotaProtegida";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOMINIOS_PERMITIDOS, PAPEL_LABEL, PAPEL_OPCOES, SETORES, emailInstitucionalValido } from "@/lib/dominio";
import { dataCurta } from "@/lib/format";
import { textoSeguro } from "@/lib/sanitize";
import { obterConfigDominios } from "@/services/configuracoes";
import {
  atualizarUsuario,
  criarUsuario,
  criarUsuariosEmLote,
  listarUsuarios,
  resetarSenhaUsuario,
  type UsuarioLoteItem,
  type UsuarioPayload,
} from "@/services/usuarios";
import { podeCadastrarUsuarios, podeExecutar, useAuthStore } from "@/stores/auth";
import type { Papel, User } from "@/types";

export const Route = createFileRoute("/usuarios")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Usuários — Central de Chamados" },
      { name: "description", content: "Gestão de servidores, técnicos e administradores com acesso à central." },
      { property: "og:title", content: "Usuários — Central de Chamados" },
      { property: "og:description", content: "Área administrativa para gerenciar contas, setores e permissões." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RotaProtegida>
      <UsuariosPage />
    </RotaProtegida>
  ),
});

function UsuariosPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [termo, setTermo] = useState("");
  const [q, setQ] = useState("");
  const [papelFiltro, setPapelFiltro] = useState<Papel | "">("");
  const [page, setPage] = useState(1);
  const [editando, setEditando] = useState<User | null>(null);

  const podeGerenciar = podeExecutar(user?.papel, "usuarios:gerenciar");
  const podeCadastrar = podeCadastrarUsuarios(user);

  const { data, isPending, isError, error, isFetching } = useQuery({
    queryKey: ["usuarios", q, papelFiltro, page],
    queryFn: () => listarUsuarios({ q, papel: papelFiltro, page, limit: 10 }),
    placeholderData: keepPreviousData,
    enabled: podeGerenciar || podeCadastrar,
  });

  const alternar = useMutation({
    mutationFn: (payload: { id: string | number; ativo: boolean }) =>
      atualizarUsuario(payload.id, { ativo: payload.ativo }),
    onSuccess: (atualizado) => {
      void queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      toast.success(atualizado.ativo ? "Usuário ativado" : "Usuário desativado");
    },
    onError: (erro: Error) => toast.error("Não foi possível atualizar", { description: erro.message }),
  });

  const [senhaResetada, setSenhaResetada] = useState<{ nome: string; senha: string } | null>(null);

  const resetarSenha = useMutation({
    mutationFn: (id: string | number) => resetarSenhaUsuario(id),
    onSuccess: (res, id) => {
      const u = data?.items.find((x) => x.id === id);
      setSenhaResetada({ nome: u?.nome ?? "Usuário", senha: res.novaSenha });
    },
    onError: (erro: Error) => toast.error("Não foi possível resetar a senha", { description: erro.message }),
  });

  if (!podeGerenciar && !podeCadastrar) {
    return (
      <AppLayout titulo="Usuários">
        <EmptyState
          icone={<ShieldAlert className="size-7" />}
          titulo="Acesso restrito"
          descricao="Seu perfil não possui permissão para gerenciar usuários. Fale com a administração do sistema."
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      titulo="Usuários"
      descricao="Gerencie acesso, setores liberados e permissões dos servidores"
      acoes={
        podeCadastrar ? (
          <div className="flex flex-wrap items-center gap-2">
            {(user?.papel === "admin" || user?.papel === "superusuario") && (
              <DialogImportarUsuariosEmLista />
            )}
            <DialogUsuario modo="criar" />
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <form
          className="surface-card flex flex-wrap items-end gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQ(termo.trim());
          }}
        >
          <div className="min-w-56 flex-1 space-y-1.5">
            <Label htmlFor="busca-usuarios">Buscar usuário</Label>
            <div className="relative">
              <Search aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="busca-usuarios"
                className="pl-9"
                placeholder="Nome, e-mail ou setor"
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
              />
            </div>
          </div>

          <div className="w-48 space-y-1.5">
            <Label htmlFor="filtro-papel">Perfil</Label>
            <Select
              value={papelFiltro || "todos"}
              onValueChange={(v) => {
                setPage(1);
                setPapelFiltro(v === "todos" ? "" : (v as Papel));
              }}
            >
              <SelectTrigger id="filtro-papel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os perfis</SelectItem>
                {PAPEL_OPCOES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit">Buscar</Button>
        </form>

        <section className="surface-card overflow-hidden" aria-busy={isFetching}>
          {isError ? (
            <div className="p-4">
              <MensagemErro erro={error} />
            </div>
          ) : isPending || !data ? (
            <SkeletonTabela />
          ) : data.items.length === 0 ? (
            <EmptyState
              icone={<Users className="size-7" />}
              titulo="Nenhum usuário encontrado"
              descricao="Ajuste a busca para localizar servidores cadastrados na central."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Usuários cadastrados</caption>
                  <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">Nome</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Perfil</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Setor</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Setores liberados</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Cadastro</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Situação</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.items.map((item) => (
                      <tr key={item.id} className="transition-soft hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{textoSeguro(item.nome, 80)}</p>
                          <p className="text-xs text-muted-foreground">{textoSeguro(item.email, 100)}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{PAPEL_LABEL[item.papel]}</td>
                        <td className="px-4 py-3 text-muted-foreground">{textoSeguro(item.setor, 40)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {item.papel === "superusuario"
                            ? "Todas as filas"
                            : item.papel === "tecnico" || item.papel === "admin"
                              ? item.setoresLiberados.length > 0
                                ? item.setoresLiberados.join(", ")
                                : "Nenhuma fila liberada"
                              : "—"}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{dataCurta(item.criadoEm)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              item.ativo ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {item.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            {item.papel === "superusuario" && user?.papel !== "superusuario" ? (
                              <span className="text-xs text-muted-foreground">Perfil protegido</span>
                            ) : podeGerenciar ? (
                              <>
                                <Button size="sm" variant="outline" onClick={() => setEditando(item)}>
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  title="Resetar senha do usuário"
                                  disabled={resetarSenha.isPending}
                                  onClick={() => resetarSenha.mutate(item.id)}
                                >
                                  <KeyRound className="size-3.5" />
                                  <span className="sr-only">Resetar senha</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={alternar.isPending || item.id === user?.id}
                                  title={item.id === user?.id ? "Você não pode desativar sua própria conta" : undefined}
                                  onClick={() => alternar.mutate({ id: item.id, ativo: !item.ativo })}
                                >
                                  {item.ativo ? "Desativar" : "Ativar"}
                                </Button>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">Somente leitura</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginacaoBarra
                page={data.page}
                totalPages={data.totalPages}
                total={data.total}
                limit={data.limit}
                onChange={setPage}
              />
            </>
          )}
        </section>
      </div>

      {editando ? (
        <DialogUsuario modo="editar" usuario={editando} onFechar={() => setEditando(null)} />
      ) : null}

      {senhaResetada && (
        <Dialog open onOpenChange={() => setSenhaResetada(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="size-5 text-primary" />
                Senha redefinida
              </DialogTitle>
              <DialogDescription>
                A senha de <strong>{senhaResetada.nome}</strong> foi gerada automaticamente. Copie e repasse ao usuário
                por canal seguro. Ela só aparece uma vez.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted p-3">
              <code className="flex-1 select-all font-mono text-lg tracking-widest text-foreground">
                {senhaResetada.senha}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(senhaResetada.senha);
                  toast.success("Senha copiada para a área de transferência.");
                }}
              >
                Copiar
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => setSenhaResetada(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AppLayout>
  );
}

function DialogUsuario({
  modo,
  usuario,
  onFechar,
}: {
  modo: "criar" | "editar";
  usuario?: User;
  onFechar?: () => void;
}) {
  const queryClient = useQueryClient();
  const ator = useAuthStore((s) => s.user);

  const { data: configDom } = useQuery({
    queryKey: ["config-dominios"],
    queryFn: obterConfigDominios,
  });

  const dominiosDisponiveis = useMemo(() => {
    return configDom?.dominios?.length ? configDom.dominios : DOMINIOS_PERMITIDOS;
  }, [configDom]);

  const [aberto, setAberto] = useState(modo === "editar");
  const [nome, setNome] = useState(usuario?.nome ?? "");
  const [emailPrefixo, setEmailPrefixo] = useState(() => {
    if (usuario?.email) {
      return usuario.email.split("@")[0] ?? "";
    }
    return "";
  });
  const [emailDominio, setEmailDominio] = useState(() => {
    if (usuario?.email) {
      const dom = usuario.email.split("@")[1];
      if (dom) return dom;
    }
    return configDom?.padrao || DOMINIOS_PERMITIDOS[0]!;
  });
  const [telefone, setTelefone] = useState(usuario?.telefone ?? "");
  const [localidade, setLocalidade] = useState(usuario?.localidade ?? "");
  const [papel, setPapel] = useState<Papel>(usuario?.papel ?? "usuario");
  const [setor, setSetor] = useState(usuario?.setor ?? SETORES[0]!);
  const [setoresLiberados, setSetoresLiberados] = useState<string[]>(usuario?.setoresLiberados ?? []);
  const [cadastra, setCadastra] = useState(usuario?.podeCadastrarUsuarios ?? false);

  useEffect(() => {
    setNome(usuario?.nome ?? "");
    if (usuario?.email) {
      const [pref, dom] = usuario.email.split("@");
      setEmailPrefixo(pref ?? "");
      if (dom) setEmailDominio(dom);
    } else {
      setEmailPrefixo("");
      setEmailDominio(configDom?.padrao || dominiosDisponiveis[0] || "instituto.gov.br");
    }
    setTelefone(usuario?.telefone ?? "");
    setLocalidade(usuario?.localidade ?? "");
    setPapel(usuario?.papel ?? "usuario");
    setSetor(usuario?.setor ?? SETORES[0]!);
    setSetoresLiberados(usuario?.setoresLiberados ?? []);
    setCadastra(usuario?.podeCadastrarUsuarios ?? false);
  }, [usuario, aberto, configDom, dominiosDisponiveis]);

  const papeisDisponiveis = PAPEL_OPCOES.filter(
    (p) => p.value !== "superusuario" || ator?.papel === "superusuario",
  );

  function fechar(valor: boolean) {
    setAberto(valor);
    if (!valor) {
      onFechar?.();
    }
  }

  const emailCompleto = emailPrefixo.trim() ? `${emailPrefixo.trim()}@${emailDominio}` : "";

  const salvar = useMutation({
    mutationFn: () => {
      const deveEnviarSetores =
        papel === "tecnico"
          ? true
          : papel === "admin"
            ? ator?.papel === "superusuario"
            : false;

      const payload: UsuarioPayload = {
        nome: nome.trim(),
        email: emailCompleto.toLowerCase(),
        papel,
        setor,
        podeCadastrarUsuarios: papel === "tecnico" ? cadastra : false,
        ...(telefone.trim() ? { telefone: telefone.trim() } : {}),
        ...(localidade.trim() ? { localidade: localidade.trim() } : {}),
        ...(deveEnviarSetores ? { setoresLiberados } : {}),
      };
      return modo === "criar" ? criarUsuario(payload) : atualizarUsuario(usuario!.id, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      toast.success(modo === "criar" ? "Usuário cadastrado" : "Cadastro atualizado");
      fechar(false);
    },
    onError: (erro: Error) => toast.error("Não foi possível salvar", { description: erro.message }),
  });

  const emailValido = emailInstitucionalValido(emailCompleto, dominiosDisponiveis);
  const invalido = nome.trim().length < 3 || !emailValido;

  function handlePrefixoChange(valor: string) {
    if (valor.includes("@")) {
      const [p, d] = valor.split("@");
      setEmailPrefixo((p ?? "").replace(/[^a-z0-9._-]/gi, "").toLowerCase());
      if (d && dominiosDisponiveis.includes(d.toLowerCase())) {
        setEmailDominio(d.toLowerCase());
      }
    } else {
      setEmailPrefixo(valor.replace(/[^a-z0-9._-]/gi, "").toLowerCase());
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={fechar}>
      {modo === "criar" ? (
        <DialogTrigger asChild>
          <Button size="sm">
            <UserPlus className="size-4" /> Novo usuário
          </Button>
        </DialogTrigger>
      ) : null}

      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{modo === "criar" ? "Cadastrar usuário" : "Editar cadastro"}</DialogTitle>
          <DialogDescription>
            O e-mail institucional utiliza o domínio pré-configurado da instituição ({dominiosDisponiveis.map((d) => `@${d}`).join(" ou ")}).
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!invalido) salvar.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="usuario-nome">Nome completo</Label>
              <Input id="usuario-nome" value={nome} maxLength={90} onChange={(e) => setNome(e.target.value)} />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="usuario-email-prefixo">E-mail institucional pré-configurado</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    id="usuario-email-prefixo"
                    placeholder="usuario ou nome.sobrenome"
                    value={emailPrefixo}
                    className="font-mono text-sm"
                    onChange={(e) => handlePrefixoChange(e.target.value)}
                  />
                </div>
                <span className="text-muted-foreground font-semibold">@</span>
                <Select value={emailDominio} onValueChange={setEmailDominio}>
                  <SelectTrigger id="usuario-dominio" className="w-[180px] font-mono text-xs sm:w-[220px] sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dominiosDisponiveis.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d} {d === configDom?.padrao ? "★ (padrão)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {emailCompleto ? (
                <p className="text-xs text-muted-foreground">
                  Endereço institucional que será registrado: <strong className="font-mono text-foreground">{emailCompleto}</strong>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Informe o prefixo do e-mail do servidor. O domínio institucional é selecionado automaticamente.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="usuario-telefone">Telefone (opcional)</Label>
              <Input id="usuario-telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="usuario-localidade">Localidade / Sala (opcional)</Label>
              <Input
                id="usuario-localidade"
                placeholder="Ex.: Sede - Sala 302"
                value={localidade}
                onChange={(e) => setLocalidade(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="usuario-setor">Setor de origem</Label>
              <Select value={setor} onValueChange={setSetor}>
                <SelectTrigger id="usuario-setor">
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
              <Label htmlFor="usuario-papel">Perfil de acesso</Label>
              <Select value={papel} onValueChange={(v) => setPapel(v as Papel)}>
                <SelectTrigger id="usuario-papel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {papeisDisponiveis.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {papel === "tecnico" || papel === "admin" ? (
            <fieldset className="space-y-3 rounded-lg border border-border p-4">
              <legend className="px-1 text-sm font-semibold text-foreground">
                Liberação de filas {papel === "admin" ? "do administrador" : "do técnico"}
              </legend>
              <p className="text-xs text-muted-foreground">
                {papel === "admin"
                  ? "O administrador visualiza somente os chamados das filas liberadas pelo superusuário."
                  : "O técnico visualiza e atende apenas os chamados das filas liberadas abaixo."}
              </p>
              {papel === "admin" && ator?.papel !== "superusuario" ? (
                <p className="text-xs text-destructive">
                  Somente o superusuário libera ou revoga filas para o perfil administrador.
                </p>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2">
                {SETORES.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox
                      checked={setoresLiberados.includes(s)}
                      disabled={papel === "admin" && ator?.papel !== "superusuario"}
                      onCheckedChange={(v) =>
                        setSetoresLiberados((atual) =>
                          v === true ? [...atual, s] : atual.filter((item) => item !== s),
                        )
                      }
                      aria-label={`Liberar fila ${s}`}
                    />
                    {s}
                  </label>
                ))}
              </div>
              {papel === "tecnico" ? (
                <label className="flex items-start gap-2 border-t border-border pt-3 text-sm text-foreground">
                  <Checkbox
                    checked={cadastra}
                    onCheckedChange={(v) => setCadastra(v === true)}
                    aria-label="Permitir cadastro de usuários"
                  />
                  <span>Permitir que este técnico cadastre novos usuários</span>
                </label>
              ) : null}

            </fieldset>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => fechar(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={invalido || salvar.isPending}>
              {salvar.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogImportarUsuariosEmLista() {
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");

  const { data: configDom } = useQuery({
    queryKey: ["config-dominios"],
    queryFn: obterConfigDominios,
  });

  const dominiosValidos = useMemo(() => {
    return configDom?.dominios?.length ? configDom.dominios : DOMINIOS_PERMITIDOS;
  }, [configDom]);

  const { itens, validos, invalidos } = useMemo(() => {
    const linhas = texto
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const resultado: (UsuarioLoteItem & { valido: boolean; motivo?: string })[] = [];
    const emailsSet = new Set<string>();

    for (let idx = 0; idx < linhas.length; idx++) {
      const linha = linhas[idx]!;
      // Ignorar linha de cabeçalho
      if (idx === 0 && (linha.toLowerCase().includes("nome") && linha.toLowerCase().includes("email"))) {
        continue;
      }

      let partes: string[] = [];
      if (linha.includes(";")) partes = linha.split(";");
      else if (linha.includes("\t")) partes = linha.split("\t");
      else if (linha.includes("|")) partes = linha.split("|");
      else if (linha.includes(",")) partes = linha.split(",");
      else partes = [linha];

      partes = partes.map((p) => p.trim());
      const nome = partes[0] ?? "";
      const email = (partes[1] ?? "").toLowerCase();
      const setor = partes[2] || SETORES[0]!;
      const papelRaw = (partes[3] || "usuario").toLowerCase();
      const telefone = partes[4] || "";
      const localidade = partes[5] || "Sede Principal";

      let papel: Papel = "usuario";
      if (papelRaw === "tecnico" || papelRaw === "técnico") papel = "tecnico";
      else if (papelRaw === "admin" || papelRaw === "administrador") papel = "admin";

      let motivo = "";
      if (!nome || nome.length < 3) {
        motivo = "Nome deve ter ao menos 3 caracteres";
      } else if (!email || !email.includes("@")) {
        motivo = "E-mail com formato inválido";
      } else if (!emailInstitucionalValido(email, dominiosValidos)) {
        motivo = `Domínio não autorizado (${dominiosValidos.map((d) => `@${d}`).join(", ")})`;
      } else if (emailsSet.has(email)) {
        motivo = "E-mail duplicado no arquivo";
      }

      if (!motivo) {
        emailsSet.add(email);
        resultado.push({
          nome,
          email,
          setor: SETORES.includes(setor) ? setor : SETORES[0]!,
          papel,
          valido: true,
          ...(telefone ? { telefone } : {}),
          ...(localidade ? { localidade } : {}),
        });
      } else {
        resultado.push({
          nome: nome || "Sem nome",
          email: email || "Sem e-mail",
          valido: false,
          motivo,
          ...(setor ? { setor } : {}),
          ...(papel ? { papel } : {}),
        });
      }
    }

    const v = resultado.filter((r) => r.valido);
    const inv = resultado.filter((r) => !r.valido);
    return { itens: resultado, validos: v, invalidos: inv };
  }, [texto, dominiosValidos]);

  const importar = useMutation({
    mutationFn: () => {
      const payloadUsuarios: UsuarioLoteItem[] = validos.map((u) => ({
        nome: u.nome,
        email: u.email,
        ...(u.setor ? { setor: u.setor } : {}),
        ...(u.papel ? { papel: u.papel } : {}),
        ...(u.telefone ? { telefone: u.telefone } : {}),
        ...(u.localidade ? { localidade: u.localidade } : {}),
      }));
      return criarUsuariosEmLote({ usuarios: payloadUsuarios });
    },
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      toast.success(`${res.totalCriados} usuários importados com sucesso!`, {
        description: res.erros.length > 0 ? `${res.erros.length} registros rejeitados.` : undefined,
      });
      setTexto("");
      setAberto(false);
    },
    onError: (erro: Error) => toast.error("Falha na importação", { description: erro.message }),
  });

  function carregarExemplo() {
    const padrao = configDom?.padrao || dominiosValidos[0] || "instituto.gov.br";
    setTexto(
      `Nome; E-mail; Setor; Perfil; Telefone; Localidade\n` +
      `Mariana Silva; mariana.silva@${padrao}; Recursos Humanos; usuario; (31) 98765-1100; Sede - 2º Andar\n` +
      `Rodrigo Barbosa; rodrigo.barbosa@${padrao}; TI; tecnico; (31) 98765-2200; Suporte Técnico\n` +
      `Fernanda Castro; fernanda.castro@${padrao}; Financeiro; usuario; (31) 98765-3300; Bloco B - Sala 104\n` +
      `Lucas Ferreira; lucas.ferreira@${padrao}; Protocolo; usuario; (31) 98765-4400; Recepção Central`
    );
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <ListPlus className="size-4" /> Importar lista / CSV
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" />
            Criação de Usuários em Lista / Lote
          </DialogTitle>
          <DialogDescription>
            Importe servidores de sistemas legados ou planilhas que já possuam e-mail institucional cadastrado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="lista-usuarios-textarea">
              Cole a lista de servidores (formato: Nome; E-mail; Setor; Perfil; Telefone; Localidade)
            </Label>
            <Button type="button" variant="ghost" size="sm" onClick={carregarExemplo}>
              Carregar exemplo
            </Button>
          </div>

          <textarea
            id="lista-usuarios-textarea"
            rows={6}
            placeholder={`Mariana Silva; mariana.silva@${configDom?.padrao || "instituto.gov.br"}; Recursos Humanos; usuario\nRodrigo Barbosa; rodrigo.barbosa@${configDom?.padrao || "instituto.gov.br"}; TI; tecnico`}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />

          {itens.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">
                  Pré-visualização: {itens.length} linha(s) identificada(s)
                </span>
                <span className="text-muted-foreground">
                  <strong className="text-green-600 dark:text-green-400">{validos.length} válidos</strong>
                  {invalidos.length > 0 && (
                    <>, <strong className="text-destructive">{invalidos.length} com erro</strong></>
                  )}
                </span>
              </div>

              <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 border-b border-border bg-muted">
                    <tr>
                      <th className="p-2 font-semibold">Status</th>
                      <th className="p-2 font-semibold">Nome</th>
                      <th className="p-2 font-semibold">E-mail</th>
                      <th className="p-2 font-semibold">Setor</th>
                      <th className="p-2 font-semibold">Perfil</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {itens.map((it, idx) => (
                      <tr key={idx} className={it.valido ? "hover:bg-muted/40" : "bg-destructive/10"}>
                        <td className="p-2 whitespace-nowrap">
                          {it.valido ? (
                            <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                              <CheckCircle2 className="size-3.5" /> Válido
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-destructive font-medium" title={it.motivo}>
                              <AlertCircle className="size-3.5" /> {it.motivo}
                            </span>
                          )}
                        </td>
                        <td className="p-2 font-medium text-foreground">{it.nome}</td>
                        <td className="p-2 font-mono text-muted-foreground">{it.email}</td>
                        <td className="p-2 text-muted-foreground">{it.setor}</td>
                        <td className="p-2 text-muted-foreground">{PAPEL_LABEL[it.papel || "usuario"]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={validos.length === 0 || importar.isPending}
            onClick={() => importar.mutate()}
          >
            {importar.isPending
              ? "Importando..."
              : `Importar ${validos.length} usuário${validos.length !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

