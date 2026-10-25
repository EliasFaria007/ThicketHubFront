import { useState } from "react";
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
  const os = obterDadosOrdemServico(chamado, usuarioLogado);

  const PRINT_CSS = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4; margin: 15mm 12mm; }
    body { font-family: system-ui, -apple-system, sans-serif; font-size: 11pt; color: #111; background: #fff; }
    h1 { font-size: 18pt; font-weight: 700; margin-bottom: 4px; }
    h2 { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 8px; }
    p, span, div { line-height: 1.5; }
    section { margin-bottom: 18px; break-inside: avoid; page-break-inside: avoid; }
    header { border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
    footer { border-top: 1px solid #ccc; padding-top: 10px; text-align: center; font-size: 8pt; color: #666; margin-top: 20px; }
    .brand { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .brand-badge { display: inline-flex; width: 26px; height: 26px; align-items: center; justify-content: center; background: #6366f1; color: #fff; font-weight: 900; font-size: 11pt; border-radius: 6px; }
    .brand-name { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: #6366f1; }
    .proto-box { border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 6px; padding: 8px 12px; text-align: right; font-size: 8pt; min-width: 160px; }
    .proto-box .label { font-weight: 600; text-transform: uppercase; font-size: 7pt; color: #64748b; display: block; }
    .proto-box .value { font-family: monospace; font-size: 12pt; font-weight: 700; display: block; }
    .proto-box .sub { font-size: 7pt; color: #64748b; margin-top: 2px; display: block; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; font-size: 9pt; }
    .info-item { margin-bottom: 4px; }
    .info-label { font-weight: 600; color: #64748b; }
    .desc-box { border: 1px solid #e8e8e8; border-radius: 6px; padding: 10px; font-size: 9pt; white-space: pre-wrap; line-height: 1.6; background: #fff; }
    .desc-title { font-weight: 600; margin-bottom: 6px; font-size: 10pt; }
    .attachments-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .attachment-card { border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; font-size: 8pt; break-inside: avoid; }
    .attachment-img-box { height: 90px; display: flex; align-items: center; justify-content: center; background: #f1f5f9; padding: 6px; }
    .attachment-img-box img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .attachment-icon-box { height: 64px; display: flex; align-items: center; justify-content: center; background: #f1f5f9; }
    .attachment-info { display: flex; justify-content: space-between; padding: 4px 8px; border-top: 1px solid #e2e8f0; background: #fff; }
    .attachment-name { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 80%; }
    .attachment-size { color: #64748b; flex-shrink: 0; }
    .record-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-bottom: 10px; font-size: 9pt; break-inside: avoid; background: #fff; }
    .record-header { display: flex; justify-content: space-between; border-bottom: 1px solid #e8e8e8; padding-bottom: 6px; margin-bottom: 8px; font-size: 8pt; color: #64748b; }
    .record-header strong { color: #111; }
    .record-content { white-space: pre-wrap; line-height: 1.6; }
    .record-content img { max-width: 100%; max-height: 200px; object-fit: contain; border-radius: 4px; margin: 6px 0; display: block; break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sign-term { border: 1px solid #e2e8f0; border-radius: 6px; background: #f8fafc; padding: 10px; font-size: 8pt; color: #475569; margin-bottom: 16px; }
    .sign-term strong { color: #111; display: block; margin-bottom: 4px; font-size: 9pt; }
    .sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
    .sign-box { display: flex; flex-direction: column; align-items: center; text-align: center; }
    .sign-image-wrap { width: 200px; height: 64px; display: flex; align-items: center; justify-content: center; border: 1px solid #e2e8f0; border-radius: 4px; background: #fff; padding: 4px; margin-bottom: 6px; }
    .sign-image-wrap img { max-width: 100%; max-height: 100%; object-fit: contain; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sign-dashed { width: 200px; height: 56px; border-bottom: 1.5px dashed #555; margin-bottom: 6px; }
    .sign-line { width: 100%; border-top: 1px solid #bbb; padding-top: 6px; font-size: 9pt; font-weight: 600; }
    .sign-role { font-size: 7.5pt; color: #64748b; margin-top: 2px; }
    .no-records { border: 1.5px dashed #e2e8f0; border-radius: 6px; padding: 12px; text-align: center; font-size: 9pt; color: #64748b; }
    img { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  `;

  function imprimir() {
    const isImg = (nome?: string, url?: string) =>
      /\.(png|jpe?g|gif|webp|svg|avif|bmp)(\?|$)/i.test(nome || url || "");

    const escHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const registrosHtml = os.registrosAtendimento
      .map(
        (reg, idx) => `
        <div class="record-card">
          <div class="record-header">
            <strong>Registro #${idx + 1} — ${escHtml(reg.autor || "Técnico")} ${reg.setor ? `(${escHtml(reg.setor)})` : ""}</strong>
            <span>${escHtml(reg.data || "Data não especificada")}</span>
          </div>
          <div class="record-content">${escHtml(reg.conteudo)}</div>
        </div>`,
      )
      .join("");

    const anexosHtml =
      os.anexos.length > 0
        ? `<section>
          <h2>${os.anexos.length > 0 && os.registrosAtendimento.length >= 0 ? "2" : "2"}. Anexos e Evidências Vinculadas (${os.anexos.length})</h2>
          <div class="attachments-grid">
            ${os.anexos
              .map((anexo) => {
                const img = isImg(anexo.nome, anexo.url);
                return `<div class="attachment-card">
                  ${img ? `<div class="attachment-img-box"><img src="${escHtml(anexo.url)}" alt="${escHtml(anexo.nome)}" /></div>` : `<div class="attachment-icon-box"><span style="font-size:24pt;color:#94a3b8">📎</span></div>`}
                  <div class="attachment-info">
                    <span class="attachment-name" title="${escHtml(anexo.nome)}">${escHtml(anexo.nome)}</span>
                    ${anexo.tamanho ? `<span class="attachment-size">${escHtml(formatarTamanho(anexo.tamanho))}</span>` : ""}
                  </div>
                </div>`;
              })
              .join("")}
          </div>
        </section>`
        : "";

    const assinaturaHtml = os.temAssinaturaDigital && os.assinaturaImagem
      ? `<div class="sign-image-wrap"><img src="${escHtml(os.assinaturaImagem)}" alt="Assinatura do Técnico" /></div>
         <span style="font-size:7.5pt;color:#16a34a;margin-bottom:6px">✔ Assinado Digitalmente</span>`
      : `<div class="sign-dashed"></div>`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>OS-${escHtml(os.protocolo)}</title>
<style>${PRINT_CSS}</style>
</head>
<body>
<div class="brand">
  <span class="brand-badge">TH</span>
  <span class="brand-name">ThicketHub · Central de Atendimento</span>
</div>
<header>
  <div>
    <h1>ORDEM DE SERVIÇO TÉCNICO</h1>
    <p style="font-size:9pt;color:#64748b">Registro formal de atendimento, execução e conformidade de SLA</p>
  </div>
  <div class="proto-box">
    <span class="label">Protocolo</span>
    <span class="value">#${escHtml(os.protocolo)}</span>
    <span class="sub">Emissão: ${escHtml(os.emitidoEmFormatado)}</span>
  </div>
</header>

<div class="info-grid" style="margin-bottom:18px">
  <div>
    <div class="info-item"><span class="info-label">Solicitante: </span><strong>${escHtml(os.solicitanteNome)}</strong></div>
    ${os.solicitanteEmail ? `<div class="info-item"><span class="info-label">E-mail: </span>${escHtml(os.solicitanteEmail)}</div>` : ""}
    <div class="info-item"><span class="info-label">Setor de Origem: </span>${escHtml(os.setor)}</div>
    <div class="info-item"><span class="info-label">Data/Hora Abertura: </span>${escHtml(os.criadoEmFormatado)}</div>
  </div>
  <div>
    <div class="info-item"><span class="info-label">Técnico Responsável: </span><strong>${escHtml(os.tecnicoNome)}</strong></div>
    <div class="info-item"><span class="info-label">Serviço / Demanda: </span>${escHtml(os.servicoNome)}</div>
    <div class="info-item"><span class="info-label">Status / Prioridade: </span>${escHtml(os.statusFormatado)} · ${escHtml(os.prioridadeFormatada)}</div>
    <div class="info-item"><span class="info-label">Situação do SLA: </span><strong>${escHtml(os.slaStatus)}</strong>${os.resolvidoEmFormatado ? ` (em ${escHtml(os.resolvidoEmFormatado)})` : ""}</div>
  </div>
</div>

<section>
  <h2>1. Descrição Inicial da Demanda</h2>
  <div class="desc-box">
    <p class="desc-title">${escHtml(os.titulo)}</p>
    ${escHtml(os.descricaoLimpa)}
  </div>
</section>

${anexosHtml}

<section>
  <h2>${os.anexos.length > 0 ? "3" : "2"}. Procedimentos e Histórico Técnico de Atendimento</h2>
  ${registrosHtml || `<div class="no-records">Nenhum registro de atendimento detalhado foi gravado neste chamado.</div>`}
</section>

<section style="border-top:1px solid #ccc;padding-top:16px">
  <div class="sign-term">
    <strong>Termo de Encerramento e Aceite:</strong>
    Declaro para os devidos fins que o atendimento técnico supra identificado foi executado em conformidade com as normas institucionais e que os serviços foram entregues de acordo com o escopo solicitado.
  </div>
  <div class="sign-grid">
    <div class="sign-box">
      ${assinaturaHtml}
      <div class="sign-line">${escHtml(os.tecnicoNome)}</div>
      <div class="sign-role">Técnico Responsável / Matrícula</div>
    </div>
    <div class="sign-box">
      <div class="sign-dashed"></div>
      <div class="sign-line">${escHtml(os.solicitanteNome)}</div>
      <div class="sign-role">Solicitante / Responsável pelo Recebimento</div>
    </div>
  </div>
</section>

<footer>
  <p>Documento gerado eletronicamente pela Central ThicketHub em ${escHtml(os.emitidoEmFormatado)}${os.emitidoPor ? ` por ${escHtml(os.emitidoPor)}` : ""}.</p>
  <p style="font-family:monospace;font-size:7.5pt;margin-top:2px">Hash de Validação: ${escHtml(os.protocolo)}-${chamado.id.toString().padStart(6, "0")} · Autenticidade verificável no sistema</p>
</footer>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html; charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank", "width=920,height=740,menubar=no,toolbar=no");
    if (!win) {
      toast.error("Permita pop-ups neste site para imprimir a Ordem de Serviço.");
      URL.revokeObjectURL(url);
      return;
    }
    win.addEventListener("load", () => {
      setTimeout(() => {
        win.print();
        URL.revokeObjectURL(url);
      }, 400);
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
          <article className="mx-auto max-w-3xl space-y-6 rounded-lg border border-border bg-background p-6 shadow-xs print:max-w-none print:border-none print:p-0 print:shadow-none">
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
