import { useRef, useState } from "react";
import { Check, Copy, FileText, Printer, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { TextoFormatadoComAssinatura } from "@/components/chamados/TextoFormatadoComAssinatura";
import { obterDadosOrdemServico } from "@/lib/exportacao-pdf";
import { eArquivoImagem, formatarTamanho } from "@/lib/arquivos";
import type { Chamado } from "@/types";

interface ModalOrdemServicoProps {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  chamado: Chamado;
  usuarioLogado?: { nome?: string; papel?: string };
}

export function ModalOrdemServico({
  aberto,
  aoMudarAberto,
  chamado,
  usuarioLogado,
}: ModalOrdemServicoProps) {
  const [copiado, setCopiado] = useState(false);
  const artigoRef = useRef<HTMLElement>(null);
  const os = obterDadosOrdemServico(chamado, usuarioLogado);

  function imprimir() {
    const el = artigoRef.current;
    if (!el) {
      toast.error("Não foi possível carregar o documento para impressão.");
      return;
    }

    // Converte URLs relativas de stylesheets para absolutas (necessário no contexto blob:)
    const estilosTags = Array.from(document.querySelectorAll("link[rel='stylesheet'], style"))
      .map((item) => {
        if (item.tagName === "LINK") {
          const link = item as HTMLLinkElement;
          const href = new URL(link.href, window.location.origin).href;
          return `<link rel="stylesheet" crossorigin="anonymous" href="${href}" />`;
        }
        return item.outerHTML;
      })
      .join("\n");

    // Extrai as variáveis CSS do :root para garantir que o tema claro seja aplicado
    const rootStyles = Array.from(document.styleSheets)
      .flatMap((sheet) => {
        try {
          return Array.from(sheet.cssRules || []);
        } catch {
          return [];
        }
      })
      .filter((r) => r instanceof CSSStyleRule && (r as CSSStyleRule).selectorText?.includes(":root"))
      .map((r) => (r as CSSStyleRule).cssText)
      .join("\n");

    const html = `<!DOCTYPE html>
<html lang="pt-BR" class="light">
<head>
  <meta charset="utf-8" />
  <title>OS-${os.protocolo}</title>
  ${estilosTags}
  <style>
    ${rootStyles}
    @page { size: A4; margin: 12mm 10mm; }
    html, body {
      background-color: #ffffff !important;
      color: #0f172a !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    article {
      max-width: 100% !important;
      border: none !important;
      box-shadow: none !important;
      padding: 0 !important;
      margin: 0 !important;
      background-color: #ffffff !important;
    }
    img {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      break-inside: avoid !important;
    }
    /* Oculta scrollbars e botões de ação na janela de impressão */
    [data-printable-document] > div:first-child { display: none !important; }
    .overflow-y-auto { overflow: visible !important; height: auto !important; }
  </style>
</head>
<body class="light bg-white p-0 m-0">
  <div style="max-width: 820px; margin: 0 auto; padding: 0;">
    ${el.outerHTML}
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html; charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank", "width=920,height=760,menubar=no,toolbar=no");
    if (!win) {
      toast.error("Permita pop-ups neste site para imprimir a Ordem de Serviço.");
      URL.revokeObjectURL(url);
      return;
    }
    win.addEventListener("load", () => {
      // Aguarda fontes e imagens carregarem antes de imprimir
      void win.document.fonts.ready.then(() => {
        setTimeout(() => {
          win.print();
          URL.revokeObjectURL(url);
        }, 300);
      });
    });
  }

  async function copiarTexto() {
    try {
      const texto = [
        `==================================================`,
        `ORDEM DE SERVIÇO Nº ${os.protocolo}`,
        `THICKETHUB - CENTRAL DE CHAMADOS`,
        `==================================================`,
        `Assunto: ${os.titulo}`,
        `Status: ${os.statusFormatado} | Prioridade: ${os.prioridadeFormatada}`,
        `SLA: ${os.slaStatus}`,
        `Solicitante: ${os.solicitanteNome} (${os.solicitanteEmail || "sem e-mail"})`,
        `Setor: ${os.setor}`,
        `Técnico Responsável: ${os.tecnicoNome}`,
        `Abertura: ${os.criadoEmFormatado}`,
        os.resolvidoEmFormatado ? `Resolução: ${os.resolvidoEmFormatado}` : "",
        `--------------------------------------------------`,
        `DESCRIÇÃO DA SOLICITAÇÃO:`,
        os.descricaoLimpa,
        `--------------------------------------------------`,
        `REGISTROS DE ATENDIMENTO:`,
        os.registrosAtendimento.length > 0
          ? os.registrosAtendimento
              .map(
                (r, idx) =>
                  `[Registro #${idx + 1}] ${r.data || ""} · ${r.autor || "Técnico"} (${r.setor || "TI"})\n${r.conteudo}`,
              )
              .join("\n\n")
          : "Nenhum registro de atendimento registrado.",
        `==================================================`,
        `Emitido em ${os.emitidoEmFormatado} por ${os.emitidoPor || "Sistema"}`,
      ]
        .filter(Boolean)
        .join("\n");

      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      toast.success("Dados da Ordem de Serviço copiados para a área de transferência.");
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o texto da Ordem de Serviço.");
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={aoMudarAberto}>
      <DialogContent
        data-printable-document="ordem-servico"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden p-0 sm:max-w-4xl"
      >
        {/* Barra superior de ações (oculta na impressão) */}
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Ordem de Serviço (O.S.) — Protocolo #{os.protocolo}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Documento técnico formatado para emissão, assinatura e arquivamento
              </DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copiarTexto} className="h-8 text-xs">
              {copiado ? <Check className="mr-1.5 size-3.5 text-emerald-600" /> : <Copy className="mr-1.5 size-3.5" />}
              {copiado ? "Copiado" : "Copiar"}
            </Button>
            <Button size="sm" onClick={imprimir} className="h-8 text-xs">
              <Printer className="mr-1.5 size-3.5" />
              Imprimir / Salvar PDF
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full"
              onClick={() => aoMudarAberto(false)}
              aria-label="Fechar modal"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Área do Documento A4 formatado */}
        <div className="flex-1 overflow-y-auto bg-card p-6 text-card-foreground print:overflow-visible print:bg-white print:p-0 print:text-black sm:p-8">
          <article
            ref={artigoRef}
            className="mx-auto max-w-3xl space-y-6 rounded-lg border border-border bg-background p-6 shadow-xs print:max-w-none print:border-none print:p-0 print:shadow-none"
          >
            {/* Cabeçalho Oficial do Documento */}
            <header className="border-b-2 border-primary/20 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-black text-sm">
                      TH
                    </span>
                    <span className="text-xs font-bold tracking-widest text-primary uppercase">
                      ThicketHub · Central de Atendimento
                    </span>
                  </div>
                  <h1 className="text-xl font-bold tracking-tight text-foreground print:text-black">
                    ORDEM DE SERVIÇO TÉCNICO
                  </h1>
                  <p className="text-xs text-muted-foreground print:text-neutral-600">
                    Registro formal de atendimento, execução e conformidade de SLA
                  </p>
                </div>

                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-right text-xs print:border-neutral-300 print:bg-neutral-50">
                  <span className="block font-semibold text-muted-foreground uppercase text-[10px]">Protocolo</span>
                  <span className="font-mono text-sm font-bold text-foreground print:text-black">#{os.protocolo}</span>
                  <span className="mt-1 block text-[10px] text-muted-foreground">Emissão: {os.emitidoEmFormatado}</span>
                </div>
              </div>
            </header>

            {/* Quadro de Informações Cadastrais */}
            <section className="page-break-inside-avoid grid grid-cols-2 gap-3 rounded-md border border-border/70 bg-muted/10 p-3 text-xs print:border-neutral-300 print:bg-neutral-50">
              <div className="space-y-1">
                <div>
                  <span className="font-semibold text-muted-foreground">Solicitante: </span>
                  <strong className="text-foreground print:text-black">{os.solicitanteNome}</strong>
                </div>
                {os.solicitanteEmail && (
                  <div>
                    <span className="font-semibold text-muted-foreground">E-mail: </span>
                    <span>{os.solicitanteEmail}</span>
                  </div>
                )}
                <div>
                  <span className="font-semibold text-muted-foreground">Setor de Origem: </span>
                  <span>{os.setor}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Data/Hora Abertura: </span>
                  <span>{os.criadoEmFormatado}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div>
                  <span className="font-semibold text-muted-foreground">Técnico Responsável: </span>
                  <strong className="text-foreground print:text-black">{os.tecnicoNome}</strong>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Serviço / Demanda: </span>
                  <span>{os.servicoNome}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Status / Prioridade: </span>
                  <span>
                    {os.statusFormatado} · {os.prioridadeFormatada}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Situação do SLA: </span>
                  <span className="font-semibold text-primary print:text-black">{os.slaStatus}</span>
                  {os.resolvidoEmFormatado && ` (em ${os.resolvidoEmFormatado})`}
                </div>
              </div>
            </section>

            {/* 1. Descrição Inicial da Solicitação */}
            <section className="page-break-inside-avoid space-y-2">
              <h2 className="border-b border-border/60 pb-1 text-xs font-bold tracking-wide text-foreground uppercase print:border-neutral-300 print:text-black">
                1. Descrição Inicial da Demanda
              </h2>
              <div className="rounded-md border border-border/50 bg-card p-3 text-xs leading-relaxed whitespace-pre-wrap text-foreground print:border-neutral-200 print:bg-white print:text-black">
                <p className="font-semibold text-foreground/90 mb-1">{os.titulo}</p>
                {os.descricaoLimpa}
              </div>
            </section>

            {/* 2. Anexos e Evidências (se houver) */}
            {os.anexos.length > 0 && (
              <section className="page-break-inside-avoid space-y-2">
                <h2 className="border-b border-border/60 pb-1 text-xs font-bold tracking-wide text-foreground uppercase print:border-neutral-300 print:text-black">
                  2. Anexos e Evidências Vinculadas ({os.anexos.length})
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {os.anexos.map((anexo, idx) => {
                    const isImg = eArquivoImagem(anexo.nome, anexo.url);
                    return (
                      <div
                        key={anexo.id || idx}
                        className="page-break-inside-avoid flex flex-col overflow-hidden rounded-md border border-border/70 bg-card text-xs shadow-2xs print:border-neutral-300 print:bg-white"
                      >
                        {isImg ? (
                          <div className="flex h-32 w-full items-center justify-center bg-muted/20 p-1.5 print:h-28 print:bg-neutral-50">
                            <img
                              src={anexo.url}
                              alt={anexo.nome}
                              className="max-h-full max-w-full rounded object-contain"
                            />
                          </div>
                        ) : (
                          <div className="flex h-20 w-full items-center justify-center bg-muted/30 p-2 print:bg-neutral-50">
                            <FileText className="size-8 text-primary/70" />
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-1 border-t border-border/50 bg-muted/10 p-2 text-[11px] print:border-neutral-200 print:bg-white">
                          <span className="truncate font-medium text-foreground print:text-black" title={anexo.nome}>
                            {anexo.nome}
                          </span>
                          {anexo.tamanho && (
                            <span className="shrink-0 text-muted-foreground print:text-neutral-600">
                              {formatarTamanho(anexo.tamanho)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 3. Registros de Atendimento e Procedimentos Técnicos */}
            <section className="space-y-2">
              <h2 className="border-b border-border/60 pb-1 text-xs font-bold tracking-wide text-foreground uppercase print:border-neutral-300 print:text-black">
                {os.anexos.length > 0 ? "3" : "2"}. Procedimentos e Histórico Técnico de Atendimento
              </h2>
              {os.registrosAtendimento.length > 0 ? (
                <div className="space-y-3">
                  {os.registrosAtendimento.map((reg, idx) => (
                    <div
                      key={reg.id || idx}
                      className="page-break-inside-avoid rounded-md border border-border/60 bg-card p-3 text-xs print:border-neutral-300 print:bg-white"
                    >
                      <div className="mb-2 flex items-center justify-between border-b border-border/40 pb-1 text-[11px] text-muted-foreground print:border-neutral-200">
                        <strong className="text-foreground print:text-black">
                          Registro #{idx + 1} — {reg.autor || "Técnico"} {reg.setor ? `(${reg.setor})` : ""}
                        </strong>
                        <span>{reg.data || "Data não especificada"}</span>
                      </div>
                      <TextoFormatadoComAssinatura
                        conteudo={reg.conteudo}
                        className="text-xs leading-relaxed text-foreground print:text-black"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded border border-dashed border-border/80 p-3 text-center text-xs text-muted-foreground">
                  Nenhum registro de atendimento detalhado foi gravado neste chamado.
                </p>
              )}
            </section>

            {/* 4. Bloco de Assinaturas e Termo de Conformidade */}
            <section className="page-break-inside-avoid space-y-4 pt-4 border-t border-border/80 print:border-neutral-400">
              <div className="rounded border border-border/60 bg-muted/20 p-2.5 text-[11px] text-muted-foreground print:border-neutral-300 print:bg-neutral-50 print:text-neutral-700">
                <p className="font-semibold text-foreground print:text-black mb-0.5">Termo de Encerramento e Aceite:</p>
                Declaro para os devidos fins que o atendimento técnico supra identificado foi executado em conformidade com as normas institucionais e que os serviços foram entregues de acordo com o escopo solicitado.
              </div>

              <div className="grid grid-cols-2 gap-8 pt-4">
                {/* Assinatura do Técnico */}
                <div className="flex flex-col items-center justify-end text-center">
                  {os.temAssinaturaDigital && os.assinaturaImagem ? (
                    <div className="mb-2 flex flex-col items-center">
                      <div className="flex h-16 w-52 items-center justify-center rounded border border-border/40 bg-white p-1 dark:bg-card print:border-neutral-200">
                        <img
                          src={os.assinaturaImagem}
                          alt="Assinatura do Técnico"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <span className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600 print:text-neutral-700">
                        <ShieldCheck className="size-3" /> Assinado Digitalmente
                      </span>
                    </div>
                  ) : (
                    <div className="mb-2 h-16 w-48 border-b border-dashed border-foreground/50 print:border-black" />
                  )}
                  <div className="border-t border-border pt-1.5 w-full print:border-neutral-400">
                    <p className="text-xs font-semibold text-foreground print:text-black">{os.tecnicoNome}</p>
                    <p className="text-[10px] text-muted-foreground print:text-neutral-600">
                      Técnico Responsável / Matrícula
                    </p>
                  </div>
                </div>

                {/* Assinatura do Solicitante / Usuário */}
                <div className="flex flex-col items-center justify-end text-center">
                  <div className="mb-2 h-14 w-48 border-b border-dashed border-foreground/50 print:border-black" />
                  <div className="border-t border-border pt-1.5 w-full print:border-neutral-400">
                    <p className="text-xs font-semibold text-foreground print:text-black">{os.solicitanteNome}</p>
                    <p className="text-[10px] text-muted-foreground print:text-neutral-600">
                      Solicitante / Responsável pelo Recebimento
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Rodapé Oficial de Autenticidade */}
            <footer className="page-break-inside-avoid border-t border-border/50 pt-3 text-center text-[10px] text-muted-foreground print:border-neutral-300 print:text-neutral-500">
              <p>
                Documento gerado eletronicamente pela Central ThicketHub em {os.emitidoEmFormatado}
                {os.emitidoPor ? ` por ${os.emitidoPor}` : ""}.
              </p>
              <p className="font-mono text-[9px] mt-0.5">
                Hash de Validação: {os.protocolo}-{chamado.id.toString().padStart(6, "0")} · Autenticidade verificável
                no sistema
              </p>
            </footer>
          </article>
        </div>
      </DialogContent>
    </Dialog>
  );
}
