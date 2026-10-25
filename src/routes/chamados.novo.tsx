import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, CheckCircle, Download, ExternalLink, FileText, ImagePlus, Lightbulb, Loader2, Paperclip, PenLine, PlusCircle, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { arquivoParaAnexo, eArquivoImagem, extrairArquivosClipboard, FORMATOS_ACEITOS } from "@/lib/arquivos";
import { formatarTamanho } from "@/lib/format";
import type { Anexo } from "@/types";
import { toast } from "sonner";
import { z } from "zod";

import { BotaoAssinaturasProntas } from "@/components/chamados/BotaoAssinaturasProntas";
import { PrioridadeBadge } from "@/components/chamados/StatusBadge";
import { MensagemErro } from "@/components/comum/MensagemErro";
import { AppLayout } from "@/components/layout/AppLayout";
import { RotaProtegida } from "@/components/layout/RotaProtegida";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { aplicarAssinatura, extrairTextoEImagemAssinatura } from "@/lib/assinatura";
import { horasLegivel } from "@/lib/sla";
import { criarChamado } from "@/services/chamados";
import { listarServicos } from "@/services/catalogo";
import { avaliarArtigo, listarArtigos } from "@/services/base-conhecimento";
import { useAuthStore } from "@/stores/auth";
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
  const user = useAuthStore((s) => s.user);
  const [valores, setValores] = useState({ titulo: "", servicoId: "", descricao: "" });
  const [erros, setErros] = useState<Record<string, string | undefined>>({});
  const [artigoVisualizando, setArtigoVisualizando] = useState<ArtigoBaseConhecimento | null>(null);
  const [imagens, setImagens] = useState<File[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const [imagemPreview, setImagemPreview] = useState<{ nome: string; url: string } | null>(null);
  const [processandoImagens, setProcessandoImagens] = useState(false);
  const imagensInputRef = useRef<HTMLInputElement>(null);

  // Pré-preenche apenas o TEXTO da assinatura no campo de descrição se configurado para incluir automaticamente
  // (a imagem gráfica, se houver, não é exibida no campo de texto)
  useEffect(() => {
    if (user?.assinatura && user?.incluirAssinaturaPadrao !== false) {
      const { texto } = extrairTextoEImagemAssinatura(user.assinatura);
      if (texto) {
        setValores((prev) => {
          if (!prev.descricao) {
            return { ...prev, descricao: aplicarAssinatura("", texto) };
          }
          return prev;
        });
      }
    }
  }, [user]);

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
    const dadosEnvio: { titulo: string; servicoId: string; descricao: string; anexos?: Anexo[] } = {
      ...resultado.data,
    };
    // Aplica apenas o texto da assinatura (sem códigos de imagem base64) na descrição
    if (user?.assinatura && user?.incluirAssinaturaPadrao !== false) {
      const { texto: textoAss } = extrairTextoEImagemAssinatura(user.assinatura);
      if (textoAss) {
        dadosEnvio.descricao = aplicarAssinatura(dadosEnvio.descricao, textoAss);
      }
    }

    if (imagens.length > 0) {
      setProcessandoImagens(true);
      Promise.all(imagens.map(arquivoParaAnexo))
        .then((anexos) => {
          dadosEnvio.anexos = anexos;
          mutation.mutate(dadosEnvio);
        })
        .catch((err) => {
          toast.error("Erro ao processar imagens", { description: err?.message });
        })
        .finally(() => setProcessandoImagens(false));
      return;
    }

    mutation.mutate(dadosEnvio);
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
          <div className="flex items-center justify-between">
            <Label htmlFor="descricao">Descrição detalhada</Label>
            <BotaoAssinaturasProntas
              usuario={user}
              label="Assinaturas prontas"
              onInserir={(texto) =>
                setValores((prev) => ({
                  ...prev,
                  descricao: aplicarAssinatura(prev.descricao, texto),
                }))
              }
            />
          </div>
          <Textarea
            id="descricao"
            rows={6}
            value={valores.descricao}
            aria-invalid={Boolean(erros["descricao"])}
            placeholder="Explique o que ocorreu, desde quando, e o impacto no atendimento. (Cole prints com Ctrl+V aqui)"
            onChange={(e) => setValores((prev) => ({ ...prev, descricao: e.target.value }))}
            onPaste={(e) => {
              const colados = extrairArquivosClipboard(e);
              if (colados.length > 0) {
                setImagens((prev) => [...prev, ...colados]);
                toast.success(`${colados.length} anexo(s) colado(s) da área de transferência!`);
              }
            }}
          />
          {erros["descricao"] && <p className="text-xs text-destructive">{erros["descricao"]}</p>}
          <p className="text-xs text-muted-foreground">
            O chamado nasce no status “Aguardando” e fica disponível na fila do setor responsável.
          </p>
        </div>

        {/* Adicionar imagens / evidências */}
        {/* Adicionar arquivos, imagens e prints */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Anexos e evidências do problema (opcional)</Label>
            {imagens.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {imagens.length} arquivo(s) selecionado(s)
              </span>
            )}
          </div>

          <input
            ref={imagensInputRef}
            type="file"
            accept={FORMATOS_ACEITOS}
            multiple
            className="sr-only"
            onChange={(e) => {
              const novas = Array.from(e.target.files ?? []);
              if (novas.length > 0) {
                setImagens((prev) => [...prev, ...novas]);
                toast.success(`${novas.length} arquivo(s) adicionado(s)!`);
              }
              if (imagensInputRef.current) imagensInputRef.current.value = "";
            }}
          />

          {/* Área de Dropzone e atalho Ctrl+V */}
          <div
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors cursor-pointer ${
              arrastando
                ? "border-primary bg-primary/10"
                : "border-border bg-muted/10 hover:border-primary/50 hover:bg-muted/20"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastando(false);
              const soltos = Array.from(e.dataTransfer.files ?? []);
              if (soltos.length > 0) {
                setImagens((prev) => [...prev, ...soltos]);
                toast.success(`${soltos.length} arquivo(s) anexado(s)!`);
              }
            }}
            onClick={() => imagensInputRef.current?.click()}
          >
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Upload className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">
                Clique para selecionar ou arraste arquivos aqui
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Suporta imagens, PDFs e documentos. Você também pode colar prints com <kbd className="rounded border border-border bg-card px-1 py-0.5 font-mono text-[10px] text-foreground">Ctrl + V</kbd> diretamente.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-1 gap-1.5 text-xs pointer-events-none"
            >
              <Paperclip className="size-3.5" />
              Selecionar arquivos do dispositivo
            </Button>
          </div>

          {imagens.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                Arquivos prontos para envio ({imagens.length}):
              </p>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                {imagens.map((file, idx) => {
                  const ehImagem = eArquivoImagem(file.name);
                  return (
                    <li
                      key={`${file.name}-${idx}`}
                      className="group relative flex items-center gap-2 overflow-hidden rounded-md border border-border bg-card p-2 text-xs shadow-xs"
                    >
                      {ehImagem ? (
                        <div
                          className="size-10 shrink-0 cursor-pointer overflow-hidden rounded bg-muted/40"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImagemPreview({ nome: file.name, url: URL.createObjectURL(file) });
                          }}
                          title="Clique para ampliar"
                        >
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="size-full object-cover transition-transform group-hover:scale-110"
                          />
                        </div>
                      ) : (
                        <div className="flex size-10 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                          <FileText className="size-5" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground" title={file.name}>
                          {file.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatarTamanho(file.size)}
                        </span>
                      </div>

                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
                        title="Remover arquivo"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImagens((prev) => prev.filter((_, i) => i !== idx));
                        }}
                      >
                        <Trash2 className="size-3.5" />
                        <span className="sr-only">Remover</span>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={mutation.isPending || processandoImagens}>
            {mutation.isPending || processandoImagens ? <Loader2 className="size-4 animate-spin" /> : <PlusCircle className="size-4" />}
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

            {/* Anexo em PDF se houver */}
            {artigoVisualizando.anexoPdfNome && artigoVisualizando.anexoPdfBase64 && (
              <div className="rounded-lg border border-border bg-card p-3 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="size-4 text-red-500 shrink-0" />
                  <span className="font-medium text-foreground truncate">{artigoVisualizando.anexoPdfNome}</span>
                </div>
                <a
                  href={artigoVisualizando.anexoPdfBase64}
                  download={artigoVisualizando.anexoPdfNome}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 shrink-0"
                >
                  <Download className="size-3.5" />
                  Baixar PDF
                </a>
              </div>
            )}

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
            {/* Modal de visualização de imagem anexada */}
        <Dialog open={Boolean(imagemPreview)} onOpenChange={(open) => !open && setImagemPreview(null)}>
          <DialogContent className="max-w-3xl overflow-hidden p-0">
            <DialogHeader className="p-4 pb-0">
              <DialogTitle className="truncate text-sm font-medium">{imagemPreview?.nome}</DialogTitle>
              <DialogDescription className="sr-only">Visualização do anexo</DialogDescription>
            </DialogHeader>
            <div className="flex max-h-[75vh] items-center justify-center overflow-auto p-4 bg-muted/20">
              {imagemPreview && (
                <img src={imagemPreview.url} alt={imagemPreview.nome} className="max-h-[70vh] max-w-full rounded object-contain" />
              )}
            </div>
          </DialogContent>
        </Dialog>
    </AppLayout>
  );
}
