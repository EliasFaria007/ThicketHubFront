import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mdPath = path.join(__dirname, "PLANO_BACKEND_JAVA_REQUISITOS.md");
const htmlPath = path.join(__dirname, "PLANO_BACKEND_JAVA_REQUISITOS.html");
const pdfPath = path.join(__dirname, "PLANO_BACKEND_JAVA_REQUISITOS.pdf");

const mdContent = fs.readFileSync(mdPath, "utf-8");

function parseMarkdown(md) {
  const codeBlocks = [];
  
  // Extract and replace code blocks with placeholders
  let text = md.replace(/```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g, (match, lang, code) => {
    const id = `___CODE_BLOCK_${codeBlocks.length}___`;
    const safeCode = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const langLabel = lang ? lang.toUpperCase() : "CÓDIGO / CONFIGURAÇÃO";
    codeBlocks.push(`<div class="code-block"><div class="code-header">${langLabel}</div><pre><code>${safeCode}</code></pre></div>`);
    return id;
  });

  // Inline code
  text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Headings
  text = text.replace(/^# (.*$)/gim, '<h1 class="title-h1">$1</h1>');
  text = text.replace(/^## (.*$)/gim, '<h2 class="title-h2">$1</h2>');
  text = text.replace(/^### (.*$)/gim, '<h3 class="title-h3">$1</h3>');
  text = text.replace(/^#### (.*$)/gim, '<h4 class="title-h4">$1</h4>');

  // Blockquotes
  text = text.replace(/^\> (.*$)/gim, '<blockquote class="alert-box">$1</blockquote>');

  // Bold & Italic
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Tables
  text = text.replace(/((?:\|[^\n]+\|\r?\n)+)/g, (match) => {
    const rows = match.trim().split(/\r?\n/);
    if (rows.length < 2) return match;
    let tableHtml = '<div class="table-container"><table>';
    
    // Header
    const headers = rows[0].split('|').filter(c => c.trim() !== "");
    tableHtml += '<thead><tr>';
    for (const h of headers) {
      tableHtml += `<th>${h.trim()}</th>`;
    }
    tableHtml += '</tr></thead><tbody>';

    // Rows (skip separator at index 1)
    for (let i = 2; i < rows.length; i++) {
      const cells = rows[i].split('|').filter(c => c.trim() !== "");
      if (cells.length === 0) continue;
      tableHtml += '<tr>';
      for (const cell of cells) {
        tableHtml += `<td>${cell.trim()}</td>`;
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table></div>';
    return tableHtml;
  });

  // Split paragraphs and lists
  const sections = text.split(/\r?\n\r?\n+/);
  const processed = sections.map(sec => {
    const s = sec.trim();
    if (!s) return "";
    if (s.startsWith("___CODE_BLOCK_")) {
      return s;
    }
    if (s.startsWith("<h") || s.startsWith("<div") || s.startsWith("<table") || s.startsWith("<blockquote")) {
      return s;
    }
    if (s === "---") {
      return '<hr class="section-divider" />';
    }
    if (s.startsWith("- ") || s.startsWith("* ") || /^\d+\.\s/.test(s)) {
      const items = s.split(/\r?\n/);
      let list = '<ul>';
      for (const item of items) {
        const clean = item.replace(/^[-*]\s+|\d+\.\s+/, '').trim();
        if (clean) list += `<li>${clean}</li>`;
      }
      list += '</ul>';
      return list;
    }
    return `<p>${s.replace(/\r?\n/g, '<br/>')}</p>`;
  }).join("\n\n");

  // Restore code blocks
  let finalHtml = processed;
  for (let i = 0; i < codeBlocks.length; i++) {
    finalHtml = finalHtml.replace(`___CODE_BLOCK_${i}___`, codeBlocks[i]);
  }

  return finalHtml;
}

const bodyHtml = parseMarkdown(mdContent);

const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Plano de Implementação Back-End Java & Infraestrutura - Ticket Hub</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 14mm 18mm 14mm;
      @bottom-right {
        content: "Página " counter(page) " de " counter(pages);
        font-family: 'Segoe UI', Arial, sans-serif;
        font-size: 8.5pt;
        color: #64748b;
      }
      @bottom-left {
        content: "Ticket Hub — Central Institucional de Chamados";
        font-family: 'Segoe UI', Arial, sans-serif;
        font-size: 8.5pt;
        color: #64748b;
      }
    }

    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      font-size: 9.5pt;
      line-height: 1.55;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }

    .cover {
      page-break-after: always;
      text-align: center;
      padding-top: 80px;
      padding-bottom: 60px;
    }
    .cover-badge {
      display: inline-block;
      padding: 6px 18px;
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 9.5pt;
      margin-bottom: 28px;
      text-transform: uppercase;
      letter-spacing: 1.2px;
    }
    .cover-title {
      font-size: 25pt;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.25;
      margin-bottom: 18px;
    }
    .cover-subtitle {
      font-size: 13.5pt;
      color: #475569;
      margin-bottom: 40px;
      max-width: 620px;
      margin-left: auto;
      margin-right: auto;
      line-height: 1.4;
    }
    .cover-meta {
      margin-top: 70px;
      padding: 24px;
      background: #f8fafc;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      display: inline-block;
      text-align: left;
      font-size: 9.5pt;
      color: #334155;
      line-height: 1.7;
    }
    .cover-meta p {
      margin: 4px 0;
    }

    h1.title-h1 {
      font-size: 17pt;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 2.5px solid #2563eb;
      padding-bottom: 6px;
      margin-top: 32px;
      margin-bottom: 16px;
      page-break-after: avoid;
    }
    h2.title-h2 {
      font-size: 13pt;
      font-weight: 700;
      color: #1e3a8a;
      margin-top: 24px;
      margin-bottom: 10px;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
      page-break-after: avoid;
    }
    h3.title-h3 {
      font-size: 10.5pt;
      font-weight: 700;
      color: #0f172a;
      margin-top: 18px;
      margin-bottom: 8px;
      page-break-after: avoid;
    }
    h4.title-h4 {
      font-size: 9.5pt;
      font-weight: 600;
      color: #334155;
      margin-top: 14px;
      margin-bottom: 6px;
      page-break-after: avoid;
    }

    p {
      margin-top: 0;
      margin-bottom: 10px;
      text-align: justify;
    }

    ul, ol {
      margin-top: 0;
      margin-bottom: 12px;
      padding-left: 22px;
    }
    li {
      margin-bottom: 4px;
    }

    .table-container {
      margin: 16px 0;
      page-break-inside: avoid;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      background: #ffffff;
      border: 1px solid #cbd5e1;
    }
    th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      text-align: left;
      padding: 8px 10px;
      border: 1px solid #cbd5e1;
      text-transform: uppercase;
      font-size: 8pt;
      letter-spacing: 0.5px;
    }
    td {
      padding: 6px 10px;
      border: 1px solid #e2e8f0;
      color: #334155;
      vertical-align: top;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }

    .code-block {
      margin: 14px 0;
      background: #0f172a;
      border-radius: 6px;
      overflow: hidden;
      page-break-inside: avoid;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .code-header {
      background: #1e293b;
      color: #93c5fd;
      font-size: 7.5pt;
      font-weight: 700;
      padding: 4px 12px;
      letter-spacing: 1px;
      border-bottom: 1px solid #334155;
    }
    pre {
      margin: 0;
      padding: 12px;
      overflow-x: auto;
      background: #0f172a;
      color: #e2e8f0;
      font-family: 'Consolas', 'Fira Code', 'Courier New', monospace;
      font-size: 8pt;
      line-height: 1.42;
    }
    code.inline-code {
      font-family: 'Consolas', 'Fira Code', monospace;
      background: #f1f5f9;
      color: #0f172a;
      padding: 1px 5px;
      border-radius: 4px;
      font-size: 8.5pt;
      border: 1px solid #e2e8f0;
    }

    .alert-box {
      margin: 14px 0;
      padding: 12px 16px;
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      color: #1e3a8a;
      border-radius: 0 6px 6px 0;
      font-size: 9.5pt;
    }

    .section-divider {
      border: 0;
      height: 1px;
      background: #e2e8f0;
      margin: 24px 0;
    }
  </style>
</head>
<body>

  <!-- Capa do Documento -->
  <div class="cover">
    <div class="cover-badge">Documento de Engenharia de Software</div>
    <div class="cover-title">Plano de Implementação Back-End Java, Tecnologias & Infraestrutura</div>
    <div class="cover-subtitle">Central Institucional de Chamados — Sistema de Atendimento e Helpdesk (Ticket Hub)</div>
    
    <div class="cover-meta">
      <p><strong>Stack Tecnológica:</strong> Java 21 (LTS) · Spring Boot 3.3 · PostgreSQL 16 · Redis · Docker · Kubernetes</p>
      <p><strong>Configurações:</strong> Spring Security 6, JWT, HikariCP, Flyway, WebSocket STOMP & OpenAPI 3</p>
      <p><strong>Data de Emissão:</strong> 25 de Agosto de 2026</p>
      <p><strong>Versão do Documento:</strong> 2.0 (Completa com Configurações e Infraestrutura)</p>
      <p><strong>Status:</strong> Aprovado para Implementação</p>
    </div>
  </div>

  <!-- Conteúdo Principal -->
  <div class="content">
    ${bodyHtml}
  </div>

</body>
</html>`;

fs.writeFileSync(htmlPath, fullHtml, "utf-8");
console.log("HTML gerado com sucesso:", htmlPath);

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const command = `powershell -Command "Start-Process '${edgePath}' -ArgumentList '--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--print-to-pdf=${pdfPath}', 'file:///${htmlPath.replace(/\\\\/g, "/")}' -Wait"`;

try {
  execSync(command, { stdio: "inherit" });
  if (fs.existsSync(pdfPath)) {
    const stats = fs.statSync(pdfPath);
    console.log(`PDF gerado com sucesso: ${pdfPath} (${Math.round(stats.size / 1024)} KB)`);
  } else {
    console.error("Arquivo PDF não foi encontrado após a execução.");
  }
} catch (err) {
  console.error("Erro ao gerar PDF:", err);
}
