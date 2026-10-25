import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Calendar, ClipboardCheck, Download, FileText, Hand, ImageIcon, ImagePlus, Link2, Loader2, Paperclip, PenLine, Printer, RotateCcw, Save, Send, Share2, Star, Trash2, Undo2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { BotaoAssinaturasProntas } from "@/components/chamados/BotaoAssinaturasProntas";
import { ModalOrdemServico } from "@/components/chamados/ModalOrdemServico";
import { PrioridadeBadge, SlaBadge, StatusBadge } from "@/components/chamados/StatusBadge";
import { TextoFormatadoComAssinatura } from "@/components/chamados/TextoFormatadoComAssinatura";
import { MensagemErro } from "@/components/comum/MensagemErro";
import { SkeletonDetalhe } from "@/components/comum/Skeletons";
import { AppLayout } from "@/components/layout/AppLayout";
import { RotaProtegida } from "@/components/layout/RotaProtegida";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { aplicarAssinatura, extrairTextoEImagemAssinatura, montarAssinaturaCompleta, temAssinaturaNoTexto } from "@/lib/assinatura";
import { arquivoParaAnexo, baixarAnexo, formatarTamanho, eArquivoImagem, extrairArquivosClipboard, FORMATOS_ACEITOS, salvarAnexosLocalmente } from "@/lib/arquivos";
import { extrairRegistrosAtendimento } from "@/lib/registros-atendimento";
import { PAPEL_LABEL, SETORES, STATUS_LABEL, STATUS_OPCOES } from "@/lib/dominio";
import { dataHora, desdeAgora, iniciais } from "@/lib/format";
import { textoSeguro } from "@/lib/sanitize";
import { horasLegivel, resumoSla } from "@/lib/sla";
import {
  assumirChamado,
  atualizarChamado,
  avaliarChamado,
  comentarChamado,
  devolverChamado,
  encaminharChamado,
  extrairAnexosEOQueFoiFeito,
  empacotarOQueFoiFeitoComAnexos,
  obterChamado,
  pausarChamado,
  reabrirChamado,
  retomarChamado,
  vincularChamado,
  type AtualizarChamadoPayload,
} from "@/services/chamados";
import { marcarNotificacoesLidas } from "@/services/notificacoes";
import { listarUsuarios } from "@/services/usuarios";
import { podeExecutar, useAuthStore } from "@/stores/auth";
import type { Anexo, Papel, PrioridadeChamado, StatusChamado } from "@/types";

export const Route = createFileRoute("/chamados/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Detalhes do chamado — Central de Chamados" },
      {
        name: "description",
        content: "Acompanhe a linha do tempo, o SLA, o atendimento registrado e os encaminhamentos do chamado.",
      },
      { property: "og:title", content: "Detalhes do chamado — Central de Chamados" },
      { property: "og:description", content: "Histórico, comentários, SLA e situação atual do chamado." },
    ],
  }),
  component: () => (
    <RotaProtegida permissao="chamados:ler">
      <DetalheChamadoPage />
    </RotaProtegida>
  ),
});

function DetalheChamadoPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const podeAtualizar = podeExecutar(user?.papel, "chamados:atualizar");
  const podeComentar = podeExecutar(user?.papel, "chamados:comentar");
  const podeEncaminhar = podeExecutar(user?.papel, "chamados:encaminhar");
  const podeReabrir = podeExecutar(user?.papel, "chamados:reabrir");

  const [mensagem, setMensagem] = useState("");
  const [interno, setInterno] = useState(false);
  const [oQueFoiFeito, setOQueFoiFeito] = useState("");
  const [motivo, setMotivo] = useState("");
  const [destino, setDestino] = useState("");
  const [protocoloVinculo, setProtocoloVinculo] = useState("");
  const [tipoVinculo, setTipoVinculo] = useState<"relacionado" | "duplicado">("relacionado");
  // novoStatus guarda a seleção local — só é salvo ao clicar em "Salvar"
  const [novoStatus, setNovoStatus] = useState<StatusChamado | "">("");
  const [notaAvaliacao, setNotaAvaliacao] = useState<number | null>(null);
  const [comentarioAvaliacao, setComentarioAvaliacao] = useState("");
  // Imagens do atendimento: múltiplas, sem limite
  const [imagensAtendimento, setImagensAtendimento] = useState<File[]>([]);
  const [salvandoImagens, setSalvandoImagens] = useState(false);
  const [imagemEmVisualizacao, setImagemEmVisualizacao] = useState<Anexo | null>(null);
  const imagensInputRef = useRef<HTMLInputElement>(null);
  const [imagensComentario, setImagensComentario] = useState<File[]>([]);
  const [arrastandoComentario, setArrastandoComentario] = useState(false);
  const [arrastandoAtendimento, setArrastandoAtendimento] = useState(false);
  const imagensComentarioRef = useRef<HTMLInputElement>(null);

  const [imagemAssinaturaEmVisualizacao, setImagemAssinaturaEmVisualizacao] = useState<string | null>(null);
  const [modalOsAberta, setModalOsAberta] = useState(false);

  const [assinaturaGraficaAtendimento, setAssinaturaGraficaAtendimento] = useState<string | null>(() => {
    // Só carrega automaticamente se o usuário ativou "incluir assinatura automaticamente"
    if (user?.assinatura && user?.incluirAssinaturaPadrao !== false) {
      return extrairTextoEImagemAssinatura(user.assinatura).imagem;
    }
    return null;
  });

  // Sincroniza a assinatura gráfica quando o perfil do usuário muda
  useEffect(() => {
    if (user?.assinatura && user?.incluirAssinaturaPadrao !== false) {
      const { imagem } = extrairTextoEImagemAssinatura(user.assinatura);
      if (imagem) {
        setAssinaturaGraficaAtendimento((prev) => prev ?? imagem);
      }
    }
    // Se o toggle foi desmarcado, limpa a assinatura automática
    if (user?.incluirAssinaturaPadrao === false) {
      setAssinaturaGraficaAtendimento(null);
    }
  }, [user]);

  const { data: chamado, isPending, isError, error } = useQuery({
    queryKey: ["chamado", id],
    queryFn: () => obterChamado(id),
    refetchInterval: 5_000, // atualiza comentários e status a cada 5s
  });

  const registrosAtendimento = useMemo(
    () => extrairRegistrosAtendimento(chamado?.oQueFoiFeito),
    [chamado?.oQueFoiFeito],
  );

  // Ao visualizar o chamado, as notificações dele deixam de estar pendentes.
  useEffect(() => {
    void marcarNotificacoesLidas(id)
      .then(() => queryClient.invalidateQueries({ queryKey: ["notificacoes"] }))
      .catch(() => {});
  }, [id, queryClient]);

  const tecnicos = useQuery({
    queryKey: ["usuarios", "tecnicos"],
    queryFn: () => listarUsuarios({ papel: "tecnico", page: 1, limit: 50 }),
    enabled: podeEncaminhar,
    staleTime: 300_000,
  });

  function invalidar() {
    void queryClient.invalidateQueries({ queryKey: ["chamado", id] });
    void queryClient.invalidateQueries({ queryKey: ["chamados"] });
    void queryClient.invalidateQueries({ queryKey: ["metricas"] });
  }

  function sucesso(msg: string) {
    invalidar();
    toast.success(msg);
  }

  function falha(erro: Error) {
    toast.error("Não foi possível concluir", { description: erro.message });
  }

  const atualizacao = useMutation({
    mutationFn: (payload: AtualizarChamadoPayload) =>
      atualizarChamado(id, { ...payload, versao: chamado?.versao ?? 1 }),
    onSuccess: (_, vars) => {
      setOQueFoiFeito("");
      setNovoStatus("");
      setImagensAtendimento([]);
      // Ao resolver ou cancelar, o chamado sai da fila ativa do técnico
      if (vars.status === "resolvido" || vars.status === "cancelado") {
        void queryClient.invalidateQueries({ queryKey: ["chamados", "contagem-minha"] });
        void queryClient.invalidateQueries({ queryKey: ["chamados", "contagem-resolvidos"] });
      }
      sucesso("Chamado atualizado com sucesso");
    },
    onError: falha,
  });

  async function salvarAtendimentoCompleto() {
    const statusFinal = (novoStatus || chamado?.status) as StatusChamado;
    if (statusFinal === "resolvido" && !oQueFoiFeito.trim() && !chamado?.oQueFoiFeito) {
      toast.error("Registre a resposta do atendimento antes de resolver o chamado.");
      return;
    }

    setSalvandoImagens(true);
    try {
      const novosAnexos: Anexo[] = [];
      for (const file of imagensAtendimento) {
        const anx = await arquivoParaAnexo(file);
        novosAnexos.push(anx);
      }

      const anexosAtuais = chamado?.anexos ?? [];
      const todosAnexos = [...anexosAtuais, ...novosAnexos];

      // Assinatura: respeita o toggle. A variável assinaturaGraficaAtendimento só é não-nula
      // quando o técnico a adicionou manualmente (via BotaoAssinaturas) ou quando o toggle
      // "incluir assinatura automaticamente" estava ATIVADO no momento da carga da página.
      // Se desmarcado, o useEffect já limpa assinaturaGraficaAtendimento para null.

      let novoTextoRegistro = oQueFoiFeito.trim();

      // Aplica assinatura ao texto do novo registro — SOMENTE se o toggle "incluir automaticamente" estiver ativado
      if (novoTextoRegistro && user?.incluirAssinaturaPadrao !== false) {
        if (user?.assinatura) {
          const { texto: textoAss } = extrairTextoEImagemAssinatura(user.assinatura);
          if (textoAss && !temAssinaturaNoTexto(novoTextoRegistro, textoAss)) {
            novoTextoRegistro = aplicarAssinatura(novoTextoRegistro, textoAss);
          }
        }
        if (assinaturaGraficaAtendimento && !novoTextoRegistro.includes("[ASSINATURA_IMAGEM:")) {
          novoTextoRegistro = montarAssinaturaCompleta(novoTextoRegistro, assinaturaGraficaAtendimento);
        }
      }

      // Constrói o histórico de "O que foi feito", separando claramente cada novo registro
      let oQueFoiFeitoFinal = chamado?.oQueFoiFeito ?? "";
      if (novoTextoRegistro) {
        const agora = new Date().toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        const autorNome = user?.nome ?? "Técnico";
        const setorNome = user?.setor ? ` (${user.setor})` : "";
        const blocoNovo = `### 📋 Registro de Atendimento — ${agora} · ${autorNome}${setorNome}\n\n${novoTextoRegistro}`;

        oQueFoiFeitoFinal = oQueFoiFeitoFinal.trim()
          ? `${oQueFoiFeitoFinal.trim()}\n\n---\n\n${blocoNovo}`
          : blocoNovo;
      }

      const payload: AtualizarChamadoPayload = {};
      if (novoStatus && novoStatus !== chamado?.status) payload.status = statusFinal;
      if (oQueFoiFeitoFinal) payload.oQueFoiFeito = oQueFoiFeitoFinal;
      payload.anexos = todosAnexos;

      if (!payload.status && !novoTextoRegistro && novosAnexos.length === 0) {
        toast.info("Nenhuma alteração para salvar.");
        return;
      }

      atualizacao.mutate(payload);
    } catch (err: any) {
      toast.error("Erro ao processar atendimento", { description: err?.message });
    } finally {
      setSalvandoImagens(false);
    }
  }

  function removerAnexoSalvo(anexoId: string) {
    if (!chamado) return;
    const anexosRestantes = (chamado.anexos ?? []).filter((a) => a.id !== anexoId);

    // 1. Atualiza imediatamente o cache local para a exclusão ser instantânea
    salvarAnexosLocalmente(id, anexosRestantes);

    // 2. Remove anexo da descrição (caso tenha sido enviado na abertura)
    const { oQueFoiFeito: descLimpa, anexos: anxDesc } = extrairAnexosEOQueFoiFeito(chamado.descricao);
    const anxDescRestantes = anxDesc.filter((a) => a.id !== anexoId);
    const novaDescricao = empacotarOQueFoiFeitoComAnexos(descLimpa ?? "", anxDescRestantes);

    // 3. Remove anexo de oQueFoiFeito (caso tenha sido enviado no atendimento)
    const { oQueFoiFeito: feitoLimpo, anexos: anxFeito } = extrairAnexosEOQueFoiFeito(chamado.oQueFoiFeito);
    const anxFeitoRestantes = anxFeito.filter((a) => a.id !== anexoId);
    const novoOQueFoiFeito = empacotarOQueFoiFeitoComAnexos(feitoLimpo ?? "", anxFeitoRestantes);

    // 4. Envia payload sincronizado para o backend persistir a exclusão em ambos os campos
    atualizacao.mutate({
      anexos: anexosRestantes,
      descricao: novaDescricao,
      oQueFoiFeito: novoOQueFoiFeito,
    });
    toast.success("Anexo excluído com sucesso.");
  }

  const comentario = useMutation({
    mutationFn: async () => {
      let textoComentario = mensagem.trim();
      // Assinatura em comentários: respeita o toggle "incluir automaticamente"
      if (!interno && user?.assinatura && user?.incluirAssinaturaPadrao !== false) {
        const { texto: textoAss, imagem: imagemAss } = extrairTextoEImagemAssinatura(user.assinatura);
        if (textoAss && !temAssinaturaNoTexto(textoComentario, textoAss)) {
          textoComentario = aplicarAssinatura(textoComentario, textoAss);
        }
        if (imagemAss && !textoComentario.includes("[ASSINATURA_IMAGEM:")) {
          textoComentario = montarAssinaturaCompleta(textoComentario, imagemAss);
        }
      }
      let anexosEnvio: Anexo[] | undefined;
      if (imagensComentario.length > 0) {
        anexosEnvio = await Promise.all(imagensComentario.map(arquivoParaAnexo));
      }
      return comentarChamado(id, { mensagem: textoComentario, interno, anexos: anexosEnvio });
    },
    onSuccess: () => {
      setMensagem("");
      setInterno(false);
      setImagensComentario([]);
      void queryClient.invalidateQueries({ queryKey: ["chamado", id] });
      sucesso("Comentário registrado");
    },
    onError: falha,
  });

  const assumir = useMutation({
    mutationFn: () => assumirChamado(id),
    onSuccess: () => sucesso("Chamado na sua fila"),
    onError: (erro: Error) => {
      toast.error(erro.message || "Não foi possível assumir o chamado.");
      void queryClient.invalidateQueries({ queryKey: ["chamados"] });
      void queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
    },
  });

  const pausar = useMutation({
    mutationFn: () => pausarChamado(id),
    onSuccess: () => sucesso("Chamado pausado (SLA congelado)"),
    onError: falha,
  });

  const retomar = useMutation({
    mutationFn: () => retomarChamado(id),
    onSuccess: () => sucesso("Chamado retomado (SLA reativado)"),
    onError: falha,
  });

  const devolver = useMutation({
    mutationFn: () => devolverChamado(id, motivo.trim()),
    onSuccess: () => {
      setMotivo("");
      sucesso("Chamado devolvido à fila geral");
    },
    onError: falha,
  });

  const encaminhar = useMutation({
    mutationFn: () =>
      encaminharChamado(id, {
        motivo: motivo.trim(),
        ...(destino.startsWith("fila:") ? { filaSetor: destino.slice(5) } : { tecnicoId: destino }),
      }),
    onSuccess: () => {
      setMotivo("");
      setDestino("");
      sucesso("Chamado encaminhado");
    },
    onError: falha,
  });

  const reabrir = useMutation({
    mutationFn: () => reabrirChamado(id, motivo.trim()),
    onSuccess: () => {
      setMotivo("");
      sucesso("Chamado reaberto");
    },
    onError: falha,
  });

  const vincular = useMutation({
    mutationFn: () => vincularChamado(id, { protocolo: protocoloVinculo.trim(), tipo: tipoVinculo }),
    onSuccess: () => {
      setProtocoloVinculo("");
      sucesso("Vínculo registrado");
    },
    onError: falha,
  });

  const avaliar = useMutation({
    mutationFn: ({ nota, comentario }: { nota: number; comentario?: string | undefined }) =>
      avaliarChamado(id, nota, comentario),
    onSuccess: () => {
      sucesso("Avaliação registrada com sucesso!");
      void queryClient.invalidateQueries({ queryKey: ["chamado", id] });
    },
    onError: falha,
  });

  if (isError) {
    return (
      <AppLayout titulo="Chamado">
        <MensagemErro erro={error} />
      </AppLayout>
    );
  }

  if (isPending) {
    return (
      <AppLayout titulo="Chamado" descricao="Carregando informações…">
        <SkeletonDetalhe />
      </AppLayout>
    );
  }

  const sla = resumoSla(chamado);
  const resolvido = chamado.status === "resolvido" || chamado.status === "concluido" || chamado.status === "fechado";
  const cancelado = chamado.status === "cancelado";
  const encerrado = resolvido || cancelado;
  const souSolicitante = String(chamado.solicitante?.id ?? "") === String(user?.id);
  const comentariosVisiveis = (chamado.comentarios ?? []).filter((c) => !c.interno || podeAtualizar);
  const linhaDoTempo = [...(chamado.historico ?? [])].sort(
    (a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime(),
  );

  const setoresDestino = user?.papel === "tecnico" ? user.setoresLiberados : SETORES;
  const tecnicosDestino = (tecnicos.data?.items ?? []).filter((t) =>
    user?.papel === "tecnico" ? user.setoresLiberados.includes(t.setor) : true,
  );

  return (
    <AppLayout
      titulo={textoSeguro(chamado.titulo, 120)}
      descricao={`Protocolo ${chamado.protocolo} · aberto ${desdeAgora(chamado.criadoEm)}`}
      acoes={
        <>
          <Button variant="outline" size="sm" onClick={() => setModalOsAberta(true)}>
            <FileText className="mr-1.5 size-4" /> Ordem de Serviço (PDF)
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" /> Imprimir
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/chamados">
              <ArrowLeft className="size-4" /> Voltar
            </Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="surface-card p-5" aria-label="Descrição do chamado">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={chamado.status} />
              <PrioridadeBadge prioridade={chamado.prioridade} />
              <SlaBadge chamado={chamado} />
              <span className="text-xs text-muted-foreground">{textoSeguro(chamado.servicoNome, 60)}</span>
            </div>
            <TextoFormatadoComAssinatura
              conteudo={chamado.descricao}
              className="mt-4 text-sm leading-relaxed text-foreground"
            />
            {chamado.oQueFoiFeito && registrosAtendimento.length > 0 && (
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="size-4 text-primary" />
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Registros do Atendimento ({registrosAtendimento.length})
                    </h3>
                  </div>
                  <span className="text-xs text-muted-foreground">Histórico cronológico de procedimentos</span>
                </div>
                <div className="space-y-3">
                  {registrosAtendimento.map((reg, idx) => (
                    <div
                      key={reg.id || idx}
                      className="rounded-lg border border-border bg-card p-4 shadow-xs transition-shadow hover:shadow-sm"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-semibold text-foreground">
                            {reg.autor || "Registro de Atendimento"}
                          </span>
                          {reg.setor && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {reg.setor}
                            </span>
                          )}
                        </div>
                        {reg.data && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="size-3 text-muted-foreground/80" />
                            <span>{reg.data}</span>
                          </div>
                        )}
                      </div>
                      <TextoFormatadoComAssinatura
                        conteudo={reg.conteudo}
                        className="text-sm leading-relaxed text-foreground"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Imagens e Anexos salvos no chamado */}
            {chamado.anexos && chamado.anexos.length > 0 && (
              <div className="mt-4 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Paperclip className="size-4 text-primary" />
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Anexos e Evidências do Chamado ({chamado.anexos.length})
                    </h3>
                  </div>
                  <span className="text-xs text-muted-foreground">Clique para visualizar ou baixar</span>
                </div>
                <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {chamado.anexos.map((anexo) => {
                    const isImg = eArquivoImagem(anexo.nome || anexo.url);
                    return (
                      <li
                        key={anexo.id}
                        className="group relative overflow-hidden rounded-lg border border-border bg-muted/30 shadow-xs transition-shadow hover:shadow-md"
                      >
                        {isImg ? (
                          <button
                            type="button"
                            className="w-full cursor-pointer overflow-hidden text-left"
                            onClick={() => setImagemEmVisualizacao(anexo)}
                            title="Clique para visualizar em tamanho expandido"
                          >
                            <img
                              src={anexo.url}
                              alt={anexo.nome}
                              className="h-28 w-full object-cover transition-transform duration-200 group-hover:scale-105"
                            />
                          </button>
                        ) : (
                          <div
                            className="flex h-28 w-full cursor-pointer flex-col items-center justify-center bg-muted/50 p-2 text-center"
                            onClick={() => baixarAnexo(anexo)}
                            title="Clique para baixar o arquivo"
                          >
                            <FileText className="mb-1 size-8 text-primary" />
                            <span className="line-clamp-2 text-xs font-medium text-foreground">{anexo.nome}</span>
                            <span className="text-[10px] text-muted-foreground">{formatarTamanho(anexo.tamanho)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-1 border-t border-border bg-card p-2 text-xs">
                          <span className="truncate font-medium text-foreground" title={anexo.nome}>
                            {anexo.nome}
                          </span>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-6 text-muted-foreground hover:text-foreground"
                              title="Baixar anexo"
                              onClick={() => baixarAnexo(anexo)}
                            >
                              <Download className="size-3.5" />
                              <span className="sr-only">Baixar</span>
                            </Button>
                            {podeAtualizar && !encerrado && (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-6 text-muted-foreground hover:text-destructive"
                                title="Excluir anexo deste chamado"
                                onClick={() => removerAnexoSalvo(anexo.id)}
                              >
                                <Trash2 className="size-3.5" />
                                <span className="sr-only">Remover</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          {podeAtualizar && !encerrado && (
            <section className="surface-card space-y-4 p-5" aria-label="Atendimento">
              <h2 className="text-sm font-semibold text-foreground">Registrar atendimento</h2>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="oQueFoiFeito">Novo registro de atendimento</Label>
                  <BotaoAssinaturasProntas
                    usuario={user}
                    label="Assinaturas prontas"
                    onInserir={(texto, imagem) => {
                      setOQueFoiFeito((prev) => aplicarAssinatura(prev, texto));
                      if (imagem) {
                        setAssinaturaGraficaAtendimento(imagem);
                      }
                    }}
                  />
                </div>
                <Textarea
                  id="oQueFoiFeito"
                  rows={8}
                  className="min-h-[180px]"
                  value={oQueFoiFeito}
                  placeholder="Descreva o procedimento realizado nesta etapa... Cada registro é adicionado com data, hora e autor. (Você também pode colar prints ou arquivos com Ctrl+V aqui)"
                  onChange={(e) => setOQueFoiFeito(e.target.value)}
                  onPaste={(e) => {
                    const colados = extrairArquivosClipboard(e);
                    if (colados.length > 0) {
                      setImagensAtendimento((prev) => [...prev, ...colados]);
                      toast.success(`${colados.length} anexo(s) colado(s) da área de transferência!`);
                    }
                  }}
                />

                {/* Preview da assinatura gráfica institucional */}
                {assinaturaGraficaAtendimento && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Assinatura gráfica vinculada — será incluída neste registro:
                    </p>
                    <div className="group relative max-w-xs overflow-hidden rounded-lg border border-primary/30 bg-muted">
                      <button
                        type="button"
                        className="block w-full"
                        title="Clique para expandir a assinatura"
                        onClick={() => setImagemAssinaturaEmVisualizacao(assinaturaGraficaAtendimento)}
                      >
                        <img
                          src={assinaturaGraficaAtendimento}
                          alt="Assinatura gráfica"
                          className="h-16 w-full object-contain bg-white dark:bg-card p-1.5 transition-opacity group-hover:opacity-80"
                        />
                      </button>
                      <div className="absolute inset-x-0 bottom-0 hidden group-hover:flex items-center justify-between bg-black/60 px-2 py-1">
                        <span className="text-[10px] text-white/80">Clique para expandir</span>
                        <button
                          type="button"
                          className="grid size-5 place-items-center rounded bg-red-500/80 text-white hover:bg-red-600"
                          title="Remover assinatura gráfica deste registro"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAssinaturaGraficaAtendimento(null);
                          }}
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Status — selecionado localmente, salvo só ao clicar em Salvar */}
              <div className="space-y-1.5">
                <Label htmlFor="novo-status">Status</Label>
                <select
                  id="novo-status"
                  value={novoStatus || chamado.status}
                  onChange={(e) => {
                    setNovoStatus(e.target.value as StatusChamado);
                  }}
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                >
                  {/* Se o status atual não está na lista editável, exibe como opção desabilitada */}
                  {!["em_atendimento", "aguardando", "pausado", "resolvido", "cancelado"].includes(chamado.status) && (
                    <option value={chamado.status} disabled>
                      {STATUS_LABEL[chamado.status]} (somente leitura)
                    </option>
                  )}
                  {STATUS_OPCOES.filter((op) =>
                    ["em_atendimento", "aguardando", "pausado", "resolvido", "cancelado"].includes(op.value),
                  ).map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
                {!["em_atendimento", "aguardando", "pausado", "resolvido", "cancelado"].includes(chamado.status) && (
                  <p className="text-xs text-muted-foreground">
                    O status <strong>{STATUS_LABEL[chamado.status]}</strong> é atribuído automaticamente pelo sistema.
                  </p>
                )}
              </div>

              {/* Prioridade — somente leitura */}
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <div className="flex items-center">
                  <PrioridadeBadge prioridade={chamado.prioridade} />
                  <span className="ml-2 text-xs text-muted-foreground">(definida pelo catálogo de serviços)</span>
                </div>
              </div>

              {/* Anexos e evidências do atendimento */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Anexos e evidências do atendimento</Label>
                  {(chamado.anexos?.length ?? 0) > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {chamado.anexos?.length} anexo(s) já salvo(s) no chamado
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
                      setImagensAtendimento((prev) => [...prev, ...novas]);
                    }
                    if (imagensInputRef.current) imagensInputRef.current.value = "";
                  }}
                />

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setArrastandoAtendimento(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setArrastandoAtendimento(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setArrastandoAtendimento(false);
                    const arquivos = Array.from(e.dataTransfer.files ?? []);
                    if (arquivos.length > 0) {
                      setImagensAtendimento((prev) => [...prev, ...arquivos]);
                      toast.success(`${arquivos.length} anexo(s) adicionado(s)!`);
                    }
                  }}
                  onClick={() => imagensInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                    arrastandoAtendimento
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-muted/30"
                  }`}
                >
                  <Upload className="mb-2 size-6 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">
                    Clique para anexar ou arraste arquivos aqui
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Imagens, PDFs, documentos. Dica: você também pode colar prints diretamente com <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">Ctrl+V</kbd>
                  </p>
                </div>

                {/* Lista de anexos já salvos no chamado (visíveis dentro do atendimento) */}
                {(chamado.anexos?.length ?? 0) > 0 && (
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">
                      Anexos já salvos neste chamado ({chamado.anexos?.length}):
                    </p>
                    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {chamado.anexos?.map((anexo) => {
                        const isImg = eArquivoImagem(anexo.nome || anexo.url);
                        return (
                          <li key={anexo.id} className="group relative overflow-hidden rounded-md border border-border bg-card">
                            {isImg ? (
                              <button
                                type="button"
                                className="w-full text-left"
                                onClick={() => setImagemEmVisualizacao(anexo)}
                                title="Visualizar em tamanho expandido"
                              >
                                <img src={anexo.url} alt={anexo.nome} className="h-20 w-full object-cover" />
                              </button>
                            ) : (
                              <div
                                className="flex h-20 w-full cursor-pointer flex-col items-center justify-center bg-muted/40 p-1.5 text-center"
                                onClick={() => baixarAnexo(anexo)}
                                title="Baixar anexo"
                              >
                                <FileText className="mb-1 size-6 text-primary" />
                                <span className="line-clamp-1 text-[11px] font-medium">{anexo.nome}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between border-t border-border bg-card px-2 py-1 text-[11px]">
                              <span className="max-w-[70%] truncate" title={anexo.nome}>
                                {anexo.nome}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  className="text-muted-foreground hover:text-foreground"
                                  onClick={() => baixarAnexo(anexo)}
                                  title="Baixar anexo"
                                >
                                  <Download className="size-3" />
                                </button>
                                <button
                                  type="button"
                                  className="text-muted-foreground hover:text-destructive"
                                  onClick={() => removerAnexoSalvo(anexo.id)}
                                  title="Excluir anexo do chamado"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Anexos novos aguardando salvar */}
                {imagensAtendimento.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-xs font-medium text-warning">
                      {imagensAtendimento.length} novo(s) anexo(s) selecionado(s) — clique em &quot;Salvar registro&quot; para gravar:
                    </p>
                    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {imagensAtendimento.map((img, idx) => {
                        const isImg = eArquivoImagem(img.name);
                        const url = URL.createObjectURL(img);
                        return (
                          <li key={idx} className="group relative overflow-hidden rounded-lg border border-warning/40 bg-muted">
                            {isImg ? (
                              <img
                                src={url}
                                alt={img.name}
                                className="h-28 w-full object-cover"
                                onLoad={() => URL.revokeObjectURL(url)}
                              />
                            ) : (
                              <div className="flex h-28 w-full flex-col items-center justify-center p-2 text-center">
                                <FileText className="mb-1 size-8 text-primary" />
                                <span className="line-clamp-2 text-xs font-medium">{img.name}</span>
                                <span className="text-[10px] text-muted-foreground">{formatarTamanho(img.size)}</span>
                              </div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/75 px-2 py-1 text-white">
                              <span className="max-w-[70%] truncate text-[10px]">{img.name}</span>
                              <div className="flex gap-1">
                                <a
                                  href={url}
                                  download={img.name}
                                  className="grid size-6 place-items-center rounded bg-white/20 text-white hover:bg-white/40"
                                  title="Baixar anexo"
                                >
                                  <Download className="size-3" />
                                </a>
                                <button
                                  type="button"
                                  className="grid size-6 place-items-center rounded bg-white/20 text-white hover:bg-red-500/80"
                                  title="Remover anexo da lista"
                                  onClick={() =>
                                    setImagensAtendimento((prev) => prev.filter((_, i) => i !== idx))
                                  }
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>

              {/* Botão de salvar o registro do atendimento */}
              <Button
                size="sm"
                disabled={
                  atualizacao.isPending ||
                  salvandoImagens ||
                  (!oQueFoiFeito.trim() && !novoStatus && imagensAtendimento.length === 0)
                }
                onClick={salvarAtendimentoCompleto}
              >
                {atualizacao.isPending || salvandoImagens ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Salvar registro do atendimento
              </Button>
            </section>
          )}

          <section className="surface-card p-5" aria-label="Comentários">
            <h2 className="text-sm font-semibold text-foreground">Conversas</h2>
            <ul className="mt-4 space-y-4">
              {comentariosVisiveis.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                    {iniciais(c.autor?.nome ?? "U")}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {textoSeguro(c.autor?.nome ?? "Usuário", 60)}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        {PAPEL_LABEL[c.autor?.papel as Papel] ?? "Usuário"} · {dataHora(c.criadoEm)}
                      </span>
                      {c.interno && (
                        <span className="ml-2 rounded bg-warning-soft px-1.5 py-0.5 text-xs text-warning">interno</span>
                      )}
                    </p>
                    <TextoFormatadoComAssinatura
                      conteudo={c.mensagem}
                      className="mt-1 text-sm text-muted-foreground"
                    />
                    {c.anexos && c.anexos.length > 0 && (
                      <div className="mt-2.5">
                        <ul className="flex flex-wrap gap-2">
                          {c.anexos.map((anx) => {
                            const isImg = eArquivoImagem(anx.nome || anx.url);
                            return (
                              <li key={anx.id} className="group relative overflow-hidden rounded-md border border-border bg-card">
                                {isImg ? (
                                  <button
                                    type="button"
                                    className="cursor-pointer overflow-hidden text-left"
                                    onClick={() => setImagemEmVisualizacao(anx)}
                                    title="Visualizar anexo"
                                  >
                                    <img src={anx.url} alt={anx.nome} className="h-20 w-24 object-cover transition-transform group-hover:scale-105" />
                                  </button>
                                ) : (
                                  <div
                                    className="flex h-20 w-24 cursor-pointer flex-col items-center justify-center bg-muted/40 p-1.5 text-center"
                                    onClick={() => baixarAnexo(anx)}
                                    title="Baixar anexo"
                                  >
                                    <FileText className="mb-1 size-6 text-primary" />
                                    <span className="line-clamp-1 text-[10px] font-medium text-foreground">{anx.nome}</span>
                                    <span className="text-[9px] text-muted-foreground">{formatarTamanho(anx.tamanho)}</span>
                                  </div>
                                )}
                                <div className="flex items-center justify-between gap-1 border-t border-border bg-card/90 px-1.5 py-0.5 text-[10px]">
                                  <span className="max-w-[70px] truncate font-medium" title={anx.nome}>
                                    {anx.nome}
                                  </span>
                                  <button
                                    type="button"
                                    className="text-muted-foreground hover:text-foreground"
                                    onClick={() => baixarAnexo(anx)}
                                    title="Baixar anexo"
                                  >
                                    <Download className="size-3" />
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                </li>
              ))}
              {comentariosVisiveis.length === 0 && (
                <li className="text-sm text-muted-foreground">Nenhum comentário registrado ainda.</li>
              )}
            </ul>

            {podeComentar && !encerrado && (
              <form
                className="mt-4 space-y-2 border-t border-border pt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!mensagem.trim() && imagensComentario.length === 0) {
                    toast.error("Digite uma mensagem ou adicione um anexo.");
                    return;
                  }
                  if (mensagem.trim() && mensagem.trim().length < 3 && imagensComentario.length === 0) {
                    toast.error("O comentário deve ter no mínimo 3 caracteres.");
                    return;
                  }
                  comentario.mutate();
                }}
              >
                <div className="flex items-center justify-between">
                  <Label htmlFor="mensagem">Novo comentário</Label>
                  <div className="flex items-center gap-2">
                    <input
                      ref={imagensComentarioRef}
                      type="file"
                      accept={FORMATOS_ACEITOS}
                      multiple
                      className="sr-only"
                      onChange={(e) => {
                        const novas = Array.from(e.target.files ?? []);
                        if (novas.length > 0) {
                          setImagensComentario((prev) => [...prev, ...novas]);
                        }
                        if (imagensComentarioRef.current) imagensComentarioRef.current.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => imagensComentarioRef.current?.click()}
                    >
                      <Paperclip className="size-3.5" />
                      Anexar arquivos
                    </Button>
                    {!interno && (
                      <BotaoAssinaturasProntas
                        usuario={user}
                        label="Assinaturas prontas"
                        onInserir={(texto) => setMensagem((prev) => aplicarAssinatura(prev, texto))}
                      />
                    )}
                  </div>
                </div>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setArrastandoComentario(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setArrastandoComentario(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setArrastandoComentario(false);
                    const arquivos = Array.from(e.dataTransfer.files ?? []);
                    if (arquivos.length > 0) {
                      setImagensComentario((prev) => [...prev, ...arquivos]);
                      toast.success(`${arquivos.length} arquivo(s) adicionado(s) ao comentário!`);
                    }
                  }}
                  className={`relative rounded-md transition-all ${
                    arrastandoComentario ? "ring-2 ring-primary ring-offset-2" : ""
                  }`}
                >
                  <Textarea
                    id="mensagem"
                    rows={3}
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    placeholder="Escreva uma mensagem... (Você também pode colar prints ou arquivos com Ctrl+V ou arrastar aqui)"
                    onPaste={(e) => {
                      const colados = extrairArquivosClipboard(e);
                      if (colados.length > 0) {
                        setImagensComentario((prev) => [...prev, ...colados]);
                        toast.success(`${colados.length} anexo(s) colado(s) no comentário!`);
                      }
                    }}
                  />
                  {arrastandoComentario && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-md bg-primary/10 backdrop-blur-[1px]">
                      <p className="text-xs font-semibold text-primary">Solte os arquivos para anexar ao comentário</p>
                    </div>
                  )}
                </div>

                {/* Prévia de anexos vinculados ao comentário */}
                {imagensComentario.length > 0 && (
                  <div className="rounded-md border border-border bg-muted/20 p-2.5">
                    <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
                      Anexos selecionados para este comentário ({imagensComentario.length}):
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {imagensComentario.map((file, idx) => {
                        const isImg = eArquivoImagem(file.name);
                        return (
                          <li
                            key={`${file.name}-${idx}`}
                            className="flex items-center gap-1.5 rounded border border-border bg-card px-2 py-1 text-xs"
                          >
                            {isImg ? (
                              <Paperclip className="size-3 text-primary shrink-0" />
                            ) : (
                              <FileText className="size-3 text-primary shrink-0" />
                            )}
                            <span className="max-w-[140px] truncate font-medium text-foreground" title={file.name}>
                              {file.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground">({formatarTamanho(file.size)})</span>
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => setImagensComentario((prev) => prev.filter((_, i) => i !== idx))}
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  {podeAtualizar ? (
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input type="checkbox" checked={interno} onChange={(e) => setInterno(e.target.checked)} />
                      Comentário interno (não visível ao solicitante)
                    </label>
                  ) : (
                    <span />
                  )}
                  <Button type="submit" size="sm" disabled={comentario.isPending}>
                    {comentario.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    Enviar
                  </Button>
                </div>
              </form>
            )}
          </section>

          <section className="surface-card p-5" aria-label="Linha do tempo">
            <h2 className="text-sm font-semibold text-foreground">Linha do tempo</h2>
            <ol className="mt-4 space-y-4 border-l border-border pl-4">
              {linhaDoTempo.map((item) => (
                <li key={item.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-primary" aria-hidden />
                  <p className="text-sm text-foreground">{textoSeguro(item.descricao, 300)}</p>
                  <p className="text-xs text-muted-foreground">
                    {textoSeguro(item.autorNome, 60)} · {dataHora(item.criadoEm)}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="surface-card space-y-3 p-5" aria-label="Informações">
            <Info rotulo="Solicitante" valor={textoSeguro(chamado.solicitante?.nome ?? "Solicitante", 60)} />
            <Info rotulo="Setor" valor={textoSeguro(chamado.setor, 40)} />
            <Info
              rotulo="Responsável"
              valor={chamado.tecnico ? textoSeguro(chamado.tecnico.nome, 60) : `Fila ${chamado.filaSetor ?? chamado.setor}`}
            />
            <Info rotulo="Atendimento (SLA)" valor={horasLegivel(chamado.slaAtendimentoHoras)} />
            <Info
              rotulo="Resolução (SLA)"
              valor={`${horasLegivel(chamado.slaResolucaoHoras)} · consumido ${sla.percentual}%${sla.pausado ? " (pausado)" : ""}`}
            />
            {chamado.motivoReabertura && <Info rotulo="Reabertura" valor={textoSeguro(chamado.motivoReabertura, 200)} />}
            {chamado.avaliacao && <Info rotulo="Avaliação" valor={`${chamado.avaliacao}/5`} />}
          </section>

          {(podeEncaminhar || podeReabrir) && (
            <section className="surface-card space-y-3 p-5" aria-label="Ações do chamado">
              <h2 className="text-sm font-semibold text-foreground">Ações</h2>

              {podeEncaminhar && !chamado.tecnico && !encerrado && (
                <Button size="sm" className="w-full" disabled={assumir.isPending} onClick={() => assumir.mutate()}>
                  <Hand className="size-4" /> Assumir chamado
                </Button>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="motivo">Motivo / justificativa</Label>
                <Input
                  id="motivo"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Justificativa da ação (opcional na reabertura)"
                />
              </div>

              {podeEncaminhar && !encerrado && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="destino">Encaminhar para</Label>
                    <select
                      id="destino"
                      value={destino}
                      onChange={(e) => setDestino(e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                    >
                      <option value="">Selecione o destino</option>
                      {tecnicosDestino.map((t) => (
                        <option key={t.id} value={t.id}>
                          Técnico: {t.nome} ({t.setor})
                        </option>
                      ))}
                      {setoresDestino.map((s) => (
                        <option key={s} value={`fila:${s}`}>
                          Fila: {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={!destino || !motivo.trim() || encaminhar.isPending}
                    onClick={() => encaminhar.mutate()}
                  >
                    <Share2 className="size-4" /> Encaminhar
                  </Button>
                  {chamado.tecnico && String(chamado.tecnico.id) === String(user?.id) && (
                    <>
                      {chamado.status === "pausado" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-warning border-warning/30 hover:bg-warning/10"
                          disabled={retomar.isPending}
                          onClick={() => retomar.mutate()}
                        >
                          Retomar atendimento (reativar SLA)
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-muted-foreground"
                          disabled={pausar.isPending}
                          onClick={() => pausar.mutate()}
                        >
                          Pausar atendimento (congelar SLA)
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={!motivo.trim() || devolver.isPending}
                        onClick={() => devolver.mutate()}
                      >
                        <Undo2 className="size-4" /> Devolver à fila geral
                      </Button>
                    </>
                  )}
                </>
              )}

              {podeReabrir && resolvido && (
                <Button
                  size="sm"
                  className="w-full"
                  disabled={reabrir.isPending}
                  onClick={() => reabrir.mutate()}
                >
                  <RotateCcw className="size-4" /> Autorizar reabertura
                </Button>
              )}
            </section>
          )}

          {podeAtualizar && (
            <section className="surface-card space-y-3 p-5 print:hidden" aria-label="Vínculo entre chamados">
              <h2 className="text-sm font-semibold text-foreground">Vincular chamado</h2>
              <p className="text-xs text-muted-foreground">
                Marque chamados relacionados ou duplicados para identificar problemas recorrentes.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="protocolo-vinculo">Protocolo</Label>
                <Input
                  id="protocolo-vinculo"
                  value={protocoloVinculo}
                  onChange={(e) => setProtocoloVinculo(e.target.value)}
                  placeholder="CH-2026-000123"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tipo-vinculo">Tipo de vínculo</Label>
                <select
                  id="tipo-vinculo"
                  value={tipoVinculo}
                  onChange={(e) => setTipoVinculo(e.target.value as "relacionado" | "duplicado")}
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                >
                  <option value="relacionado">Relacionado</option>
                  <option value="duplicado">Duplicado de</option>
                </select>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={!protocoloVinculo.trim() || vincular.isPending}
                onClick={() => vincular.mutate()}
              >
                <Link2 className="size-4" /> Registrar vínculo
              </Button>
              {(chamado.relacionados?.length ?? 0) > 0 || chamado.duplicadoDe ? (
                <div className="space-y-2 border-t border-border pt-2 text-xs text-muted-foreground">
                  {chamado.duplicadoDe ? (
                    <p>
                      Marcado como duplicado do chamado{" "}
                      <Link
                        to="/chamados/$id"
                        params={{ id: String(chamado.duplicadoDe) }}
                        className="font-medium text-primary hover:underline"
                      >
                        #{chamado.duplicadoDe}
                      </Link>
                    </p>
                  ) : null}
                  {(chamado.relacionados?.length ?? 0) > 0 ? (
                    <div>
                      <p className="font-medium text-foreground">Chamados relacionados ({chamado.relacionados?.length ?? 0}):</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {(chamado.relacionados ?? []).map((relId) => (
                          <Link
                            key={relId}
                            to="/chamados/$id"
                            params={{ id: String(relId) }}
                            className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs text-foreground transition-soft hover:bg-primary-soft hover:text-primary"
                          >
                            <Link2 className="size-3" /> #{relId}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          )}

          {resolvido && souSolicitante && !chamado.avaliacao && (
            <section className="surface-card space-y-3 p-5" aria-label="Pesquisa de satisfação">
              <div className="flex items-center gap-2">
                <Star className="size-4 text-warning fill-warning" />
                <h2 className="text-sm font-semibold text-foreground">Avalie o atendimento</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Sua avaliação nos ajuda a mensurar a qualidade institucional e o nível de serviço prestado.
              </p>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((nota) => (
                  <Button
                    key={nota}
                    size="sm"
                    type="button"
                    variant={notaAvaliacao === nota ? "default" : "outline"}
                    className={
                      notaAvaliacao === nota
                        ? "bg-warning text-warning-foreground hover:bg-warning/90 font-bold"
                        : "hover:border-warning/50"
                    }
                    aria-label={`Nota ${nota}`}
                    disabled={avaliar.isPending}
                    onClick={() => setNotaAvaliacao(nota)}
                  >
                    <Star
                      className={`size-4 ${notaAvaliacao && notaAvaliacao >= nota ? "fill-current text-current" : ""}`}
                    />
                    {nota}
                  </Button>
                ))}
              </div>

              {notaAvaliacao !== null && (
                <div className="space-y-3 pt-2">
                  {notaAvaliacao <= 2 ? (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                      <p className="font-semibold">Justificativa obrigatória (nota {notaAvaliacao}/5):</p>
                      <p className="mt-0.5 text-muted-foreground">
                        Identificamos que seu atendimento foi avaliado com nota baixa. Por favor, descreva o motivo para que a gestão/ouvidoria possa auditar e tomar providências corretivas.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Deixe um comentário opcional sobre o atendimento recebido (elogio ou sugestão):
                    </p>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="comentario-avaliacao" className="text-xs">
                      {notaAvaliacao <= 2 ? "Motivo detalhado *" : "Comentário (opcional)"}
                    </Label>
                    <textarea
                      id="comentario-avaliacao"
                      rows={3}
                      className="w-full rounded-md border border-input bg-background p-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={
                        notaAvaliacao <= 2
                          ? "Descreva detalhadamente o motivo da insatisfação..."
                          : "Deixe aqui seu elogio, sugestão ou observação..."
                      }
                      value={comentarioAvaliacao}
                      onChange={(e) => setComentarioAvaliacao(e.target.value)}
                    />
                  </div>

                  <Button
                    size="sm"
                    type="button"
                    className="w-full"
                    disabled={
                      avaliar.isPending ||
                      (notaAvaliacao <= 2 && comentarioAvaliacao.trim().length < 5)
                    }
                    onClick={() =>
                      avaliar.mutate({
                        nota: notaAvaliacao,
                        comentario: comentarioAvaliacao.trim() || undefined,
                      })
                    }
                  >
                    {avaliar.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Star className="size-4" />
                    )}
                    Confirmar e enviar avaliação
                  </Button>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>

      {/* Modal para visualizar imagem em tamanho expandido (anexos) */}
      <Dialog open={Boolean(imagemEmVisualizacao)} onOpenChange={(aberto) => !aberto && setImagemEmVisualizacao(null)}>
        <DialogContent className="max-w-3xl p-4">
          {imagemEmVisualizacao && (
            <div className="space-y-3">
              <DialogHeader className="flex flex-row items-center justify-between pr-6">
                <DialogTitle className="truncate text-sm font-medium">
                  {imagemEmVisualizacao.nome} {imagemEmVisualizacao.tamanho ? `(${formatarTamanho(imagemEmVisualizacao.tamanho)})` : ""}
                </DialogTitle>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => baixarAnexo(imagemEmVisualizacao)}
                >
                  <Download className="size-4" />
                  Baixar imagem
                </Button>
              </DialogHeader>
              <div className="grid max-h-[75vh] place-items-center overflow-auto rounded-lg bg-black/90 p-2">
                <img
                  src={imagemEmVisualizacao.url}
                  alt={imagemEmVisualizacao.nome}
                  className="max-h-[70vh] w-auto max-w-full rounded object-contain"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal para visualizar assinatura gráfica em tamanho expandido */}
      <Dialog open={Boolean(imagemAssinaturaEmVisualizacao)} onOpenChange={(aberto) => !aberto && setImagemAssinaturaEmVisualizacao(null)}>
        <DialogContent className="max-w-xl p-4">
          {imagemAssinaturaEmVisualizacao && (
            <div className="space-y-3">
              <DialogHeader>
                <DialogTitle className="text-sm font-medium">Assinatura Gráfica Institucional</DialogTitle>
              </DialogHeader>
              <div className="grid place-items-center rounded-lg bg-white dark:bg-card p-4 border border-border">
                <img
                  src={imagemAssinaturaEmVisualizacao}
                  alt="Assinatura gráfica expandida"
                  className="max-h-[50vh] w-auto max-w-full rounded object-contain"
                />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Esta assinatura é vinculada automaticamente ao salvar o atendimento quando o toggle "incluir assinatura" está ativado no perfil.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de visualização e emissão da Ordem de Serviço (PDF) */}
      <ModalOrdemServico
        aberto={modalOsAberta}
        aoMudarAberto={setModalOsAberta}
        chamado={chamado}
        usuarioLogado={user ?? undefined}
      />
    </AppLayout>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="text-sm font-medium text-foreground">{valor}</p>
    </div>
  );
}
