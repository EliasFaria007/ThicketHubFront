import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  Check,
  Download,
  FileText,
  Filter,
  HelpCircle,
  Loader2,
  Paperclip,
  PlusCircle,
  Search,
  Tag,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { RotaProtegida } from "@/components/layout/RotaProtegida";
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
import { Textarea } from "@/components/ui/textarea";
import { SETORES } from "@/lib/dominio";
import { dataHora } from "@/lib/format";
import { textoSeguro } from "@/lib/sanitize";
import {
  atualizarArtigo,
  avaliarArtigo,
  criarArtigo,
  listarArtigos,
  removerArtigo,
} from "@/services/base-conhecimento";
import { uploadArquivo } from "@/services/arquivos";
import { useAuthStore } from "@/stores/auth";
import type { ArtigoBaseConhecimento } from "@/types";

export const Route = createFileRoute("/base-conhecimento")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Base de Conhecimento — Central de Chamados" },
      { name: "description", content: "Artigos, tutoriais e procedimentos para autoatendimento e resolução rápida." },
    ],
  }),
  component: () => (
    <RotaProtegida permissao="chamados:ler">
      <BaseConhecimentoPage />
    </RotaProtegida>
  ),
});

function BaseConhecimentoPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const podeGerenciar = user?.papel === "admin" || user?.papel === "superusuario" || user?.papel === "tecnico";
  const podeExcluir = user?.papel === "admin" || user?.papel === "superusuario";

  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [setorFiltro, setSetorFiltro] = useState<string>("");
  const [artigoSelecionado, setArtigoSelecionado] = useState<ArtigoBaseConhecimento | null>(null);
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [artigoEditando, setArtigoEditando] = useState<ArtigoBaseConhecimento | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscaDebounced(busca.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [busca]);

  // Formulário de criação/edição
  const [formTitulo, setFormTitulo] = useState("");
  const [formResumo, setFormResumo] = useState("");
  const [formConteudo, setFormConteudo] = useState("");
  const [formSetor, setFormSetor] = useState("TI");
  const [formCategoria, setFormCategoria] = useState("Geral");
  const [formTags, setFormTags] = useState("");
  const [formAnexoPdfNome, setFormAnexoPdfNome] = useState("");
  const [formAnexoPdfTamanho, setFormAnexoPdfTamanho] = useState<number | undefined>(undefined);
  const [formAnexoPdfBase64, setFormAnexoPdfBase64] = useState("");

  function formatarBytes(bytes?: number): string {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Apenas arquivos no formato PDF são permitidos.");
      return;
    }

    const LIMITE_BYTES = 10 * 1024 * 1024;
    if (file.size > LIMITE_BYTES) {
      toast.error("O arquivo PDF deve ter no máximo 10 MB.");
      return;
    }

    try {
      toast.info("Enviando documento PDF para a nuvem...");
      const up = await uploadArquivo(file, "documentos");
      setFormAnexoPdfNome(file.name);
      setFormAnexoPdfTamanho(file.size);
      setFormAnexoPdfBase64(up.url);
      toast.success(`PDF enviado com sucesso para a nuvem: ${file.name}`);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setFormAnexoPdfNome(file.name);
        setFormAnexoPdfTamanho(file.size);
        setFormAnexoPdfBase64(result);
        toast.success(`PDF anexado localmente: ${file.name}`);
      };
      reader.onerror = () => {
        toast.error("Erro ao ler o arquivo PDF.");
      };
      reader.readAsDataURL(file);
    }
  }

  function removerAnexoPdf() {
    setFormAnexoPdfNome("");
    setFormAnexoPdfTamanho(undefined);
    setFormAnexoPdfBase64("");
  }

  const { data: artigos = [], isPending } = useQuery({
    queryKey: ["base-conhecimento", buscaDebounced, setorFiltro],
    queryFn: () => listarArtigos(setorFiltro ? { busca: buscaDebounced, setor: setorFiltro } : { busca: buscaDebounced }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const salvarMutation = useMutation({
    mutationFn: async () => {
      const tagsArray = formTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      if (artigoEditando) {
        return atualizarArtigo(artigoEditando.id, {
          titulo: formTitulo,
          resumo: formResumo,
          conteudo: formConteudo,
          setor: formSetor,
          categoria: formCategoria,
          tags: tagsArray,
          anexoPdfNome: formAnexoPdfNome || null,
          anexoPdfTamanho: formAnexoPdfTamanho || null,
          anexoPdfBase64: formAnexoPdfBase64 || null,
        });
      } else {
        return criarArtigo({
          titulo: formTitulo,
          resumo: formResumo,
          conteudo: formConteudo,
          setor: formSetor,
          categoria: formCategoria,
          tags: tagsArray,
          anexoPdfNome: formAnexoPdfNome || undefined,
          anexoPdfTamanho: formAnexoPdfTamanho,
          anexoPdfBase64: formAnexoPdfBase64 || undefined,
        });
      }
    },
    onSuccess: (artigoSalvo) => {
      void queryClient.invalidateQueries({ queryKey: ["base-conhecimento"] });
      setModalEdicaoAberto(false);
      setArtigoEditando(null);
      if (artigoSelecionado?.id === artigoSalvo.id) {
        setArtigoSelecionado(artigoSalvo);
      }
      toast.success(artigoEditando ? "Artigo atualizado com sucesso!" : "Novo artigo cadastrado na Base de Conhecimento!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao salvar artigo", { description: err.message });
    },
  });

  const excluirMutation = useMutation({
    mutationFn: (id: string) => removerArtigo(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["base-conhecimento"] });
      setArtigoSelecionado(null);
      toast.success("Artigo removido da base de conhecimento.");
    },
    onError: (err: Error) => {
      toast.error("Erro ao remover artigo", { description: err.message });
    },
  });

  const avaliarMutation = useMutation({
    mutationFn: ({ id, util }: { id: string; util: boolean }) => avaliarArtigo(id, util),
    onSuccess: (res, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["base-conhecimento"] });
      if (artigoSelecionado && artigoSelecionado.id === vars.id) {
        setArtigoSelecionado({
          ...artigoSelecionado,
          utilSim: res.utilSim,
          utilNao: res.utilNao,
        });
      }
      toast.success(vars.util ? "Obrigado! Feedback positivo registrado." : "Feedback registrado. Trabalharemos para melhorar este artigo.");
    },
  });

  function abrirModalCriar() {
    setArtigoEditando(null);
    setFormTitulo("");
    setFormResumo("");
    setFormConteudo("");
    setFormSetor(user?.setor || "TI");
    setFormCategoria("Geral");
    setFormTags("");
    setFormAnexoPdfNome("");
    setFormAnexoPdfTamanho(undefined);
    setFormAnexoPdfBase64("");
    setModalEdicaoAberto(true);
  }

  function abrirModalEditar(art: ArtigoBaseConhecimento) {
    setArtigoEditando(art);
    setFormTitulo(art.titulo);
    setFormResumo(art.resumo);
    setFormConteudo(art.conteudo);
    setFormSetor(art.setor);
    setFormCategoria(art.categoria);
    setFormTags(art.tags.join(", "));
    setFormAnexoPdfNome(art.anexoPdfNome || "");
    setFormAnexoPdfTamanho(art.anexoPdfTamanho);
    setFormAnexoPdfBase64(art.anexoPdfBase64 || "");
    setModalEdicaoAberto(true);
  }

  return (
    <AppLayout
      titulo="Base de Conhecimento"
      descricao="Autoatendimento, procedimentos e respostas rápidas para dúvidas recorrentes."
      acoes={
        podeGerenciar && (
          <Button size="sm" onClick={abrirModalCriar}>
            <PlusCircle className="size-4" /> Novo Artigo
          </Button>
        )
      }
    >
      <div className="space-y-6">
        {/* Barra de Busca e Filtros Rápidos */}
        <div className="surface-card p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por assunto, dúvida, erro ou palavra-chave (ex: senha, vpn, impressora)..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-muted-foreground shrink-0" />
              <select
                value={setorFiltro}
                onChange={(e) => setSetorFiltro(e.target.value)}
                className="h-9 rounded-md border border-input bg-card px-3 text-sm"
              >
                <option value="">Todos os setores</option>
                {SETORES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Listagem de Artigos */}
        {isPending ? (
          <div className="flex justify-center p-12">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : artigos.length === 0 ? (
          <div className="surface-card p-12 text-center space-y-3">
            <HelpCircle className="mx-auto size-10 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Nenhum artigo encontrado</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Não encontramos nenhum procedimento para o termo pesquisado. Tente outras palavras ou abra um chamado para nossa equipe.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {artigos.map((art) => {
              const totalAvaliacoes = art.utilSim + art.utilNao;
              const taxaUtil = totalAvaliacoes > 0 ? Math.round((art.utilSim / totalAvaliacoes) * 100) : null;

              return (
                <div
                  key={art.id}
                  className="surface-card flex flex-col justify-between p-5 transition-shadow hover:shadow-md cursor-pointer group"
                  onClick={() => setArtigoSelecionado(art)}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="rounded bg-primary-soft px-2 py-0.5 font-medium text-primary">
                        {art.setor}
                      </span>
                      <div className="flex items-center gap-2">
                        {art.anexoPdfNome && (
                          <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                            <FileText className="size-3" /> PDF
                          </span>
                        )}
                        <span>{art.categoria}</span>
                      </div>
                    </div>

                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                      {textoSeguro(art.titulo, 100)}
                    </h3>

                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                      {textoSeguro(art.resumo, 200)}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Tag className="size-3" />
                      <span>{art.tags.slice(0, 2).join(", ")}</span>
                    </div>
                    {taxaUtil !== null ? (
                      <span className="text-success font-medium">
                        {taxaUtil}% acharam útil
                      </span>
                    ) : (
                      <span>Novo artigo</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Leitor de Artigo */}
      <Dialog open={Boolean(artigoSelecionado)} onOpenChange={(aberto) => !aberto && setArtigoSelecionado(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-6">
          {artigoSelecionado && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <span className="rounded bg-primary-soft px-2 py-0.5 font-medium text-primary">
                    {artigoSelecionado.setor}
                  </span>
                  <span>·</span>
                  <span>{artigoSelecionado.categoria}</span>
                  <span>·</span>
                  <span>Atualizado em {dataHora(artigoSelecionado.atualizadoEm)}</span>
                </div>
                <DialogTitle className="text-xl font-bold text-foreground">
                  {artigoSelecionado.titulo}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground pt-1">
                  {artigoSelecionado.resumo}
                </DialogDescription>
              </DialogHeader>

              <div className="prose prose-sm dark:prose-invert max-w-none border-y border-border py-4 whitespace-pre-line text-sm leading-relaxed text-foreground">
                {artigoSelecionado.conteudo}
              </div>

              {/* Anexo em PDF (se existir) */}
              {artigoSelecionado.anexoPdfNome && (
                <div className="rounded-lg border border-border bg-card p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
                      <FileText className="size-5" />
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-foreground truncate">
                          {artigoSelecionado.anexoPdfNome}
                        </h4>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
                          PDF
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Documento anexo complementar {artigoSelecionado.anexoPdfTamanho ? `· ${formatarBytes(artigoSelecionado.anexoPdfTamanho)}` : ""}
                      </p>
                    </div>
                  </div>
                  {artigoSelecionado.anexoPdfBase64 ? (
                    <a
                      href={artigoSelecionado.anexoPdfBase64}
                      download={artigoSelecionado.anexoPdfNome}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
                    >
                      <Download className="size-3.5" />
                      Baixar Anexo PDF
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground italic shrink-0">Anexo indisponível</span>
                  )}
                </div>
              )}

              {/* Tags */}
              {artigoSelecionado.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {artigoSelecionado.tags.map((t) => (
                    <span key={t} className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              {/* Feedback de Utilidade */}
              <div className="rounded-lg border border-border bg-muted/40 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">Este artigo foi útil para você?</p>
                  <p>
                    {artigoSelecionado.utilSim} pessoas acharam útil · {artigoSelecionado.utilNao} não resolveram
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1 hover:text-success"
                    disabled={avaliarMutation.isPending}
                    onClick={() => avaliarMutation.mutate({ id: artigoSelecionado.id, util: true })}
                  >
                    <ThumbsUp className="size-3.5" /> Sim, resolveu
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1 hover:text-destructive"
                    disabled={avaliarMutation.isPending}
                    onClick={() => avaliarMutation.mutate({ id: artigoSelecionado.id, util: false })}
                  >
                    <ThumbsDown className="size-3.5" /> Não ajudou
                  </Button>
                </div>
              </div>

              {/* Ações de Gestão (Técnico / Admin) */}
              {podeGerenciar && (
                <div className="flex justify-between items-center pt-2">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => abrirModalEditar(artigoSelecionado)}>
                      Editar artigo
                    </Button>
                    {podeExcluir && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        disabled={excluirMutation.isPending}
                        onClick={() => {
                          if (confirm("Deseja realmente remover este artigo da base de conhecimento?")) {
                            excluirMutation.mutate(artigoSelecionado.id);
                          }
                        }}
                      >
                        <Trash2 className="size-4" /> Excluir
                      </Button>
                    )}
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => setArtigoSelecionado(null)}>
                    Fechar
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Formulário Criar/Editar */}
      <Dialog open={modalEdicaoAberto} onOpenChange={setModalEdicaoAberto}>
        <DialogContent className="max-w-xl p-6">
          <DialogHeader>
            <DialogTitle>{artigoEditando ? "Editar Artigo" : "Novo Artigo de Autoatendimento"}</DialogTitle>
            <DialogDescription>
              Escreva instruções claras e diretas para que o usuário possa resolver problemas comuns sozinho.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!formTitulo.trim() || !formConteudo.trim()) {
                toast.error("Preencha o título e o conteúdo do artigo.");
                return;
              }
              salvarMutation.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="art-titulo">Título do artigo *</Label>
              <Input
                id="art-titulo"
                placeholder="Ex: Como redefinir a senha do computador"
                value={formTitulo}
                onChange={(e) => setFormTitulo(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="art-setor">Setor responsável *</Label>
                <select
                  id="art-setor"
                  value={formSetor}
                  onChange={(e) => setFormSetor(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                >
                  {SETORES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="art-categoria">Categoria</Label>
                <Input
                  id="art-categoria"
                  placeholder="Ex: Contas, Rede, Equipamentos"
                  value={formCategoria}
                  onChange={(e) => setFormCategoria(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="art-resumo">Resumo explicativo</Label>
              <Input
                id="art-resumo"
                placeholder="Uma linha descrevendo quando o usuário deve ler este artigo"
                value={formResumo}
                onChange={(e) => setFormResumo(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="art-conteudo">Conteúdo / Passo a passo *</Label>
              <Textarea
                id="art-conteudo"
                rows={7}
                placeholder="Descreva o passo a passo com clareza..."
                value={formConteudo}
                onChange={(e) => setFormConteudo(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="art-tags">Palavras-chave (separadas por vírgula)</Label>
              <Input
                id="art-tags"
                placeholder="senha, windows, login, rede"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
              />
            </div>

            {/* Upload de Anexo em PDF */}
            <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
              <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Paperclip className="size-3.5 text-primary" />
                Anexo em PDF (Opcional - Manual, Tutorial ou Resolução)
              </Label>
              {formAnexoPdfNome ? (
                <div className="flex items-center justify-between rounded-md border border-border bg-card p-2 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="size-4 text-red-500 shrink-0" />
                    <span className="font-medium truncate text-foreground">{formAnexoPdfNome}</span>
                    {formAnexoPdfTamanho && (
                      <span className="text-muted-foreground shrink-0">({formatarBytes(formAnexoPdfTamanho)})</span>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-destructive hover:bg-destructive/10 text-xs px-2"
                    onClick={removerAnexoPdf}
                  >
                    <Trash2 className="size-3.5 mr-1" /> Remover
                  </Button>
                </div>
              ) : (
                <div>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-md p-4 cursor-pointer hover:border-primary/60 transition-colors bg-card/50">
                    <Paperclip className="size-5 text-muted-foreground mb-1" />
                    <span className="text-xs font-medium text-foreground">Clique para selecionar um arquivo PDF</span>
                    <span className="text-[11px] text-muted-foreground">Documento PDF de até 10 MB</span>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={handlePdfChange}
                    />
                  </label>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalEdicaoAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvarMutation.isPending}>
                {salvarMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {artigoEditando ? "Salvar alterações" : "Publicar artigo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
