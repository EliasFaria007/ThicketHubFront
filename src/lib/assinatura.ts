/**
 * Utilitários para geração, verificação e injeção de assinatura de e-mail / atendimento.
 * Padrão inspirado no Microsoft Outlook e convenção RFC 3676 (--\n).
 */

export interface DadosUsuarioAssinatura {
  nome: string;
  setor?: string | null | undefined;
  email?: string | null | undefined;
  telefone?: string | null | undefined;
}

/**
 * Gera um modelo padrão institucional de assinatura com base nas informações do perfil.
 */
export function gerarAssinaturaPadrao(usuario: DadosUsuarioAssinatura): string {
  const linhas: string[] = ["Atenciosamente,"];
  linhas.push(usuario.nome.trim());

  if (usuario.setor?.trim()) {
    linhas.push(`${usuario.setor.trim()} — Central de Atendimento`);
  } else {
    linhas.push("Central de Atendimento");
  }

  const contato: string[] = [];
  if (usuario.email?.trim()) contato.push(usuario.email.trim());
  if (usuario.telefone?.trim()) contato.push(usuario.telefone.trim());

  if (contato.length > 0) {
    linhas.push(contato.join(" · "));
  }

  return linhas.join("\n");
}

/**
 * Normaliza quebras de linha para comparação consistente.
 */
function normalizarTexto(txt: string): string {
  return txt.replace(/\r\n/g, "\n").trim();
}

/**
 * Verifica se a assinatura já está presente no corpo da mensagem.
 */
export function temAssinaturaNoTexto(texto: string, assinatura?: string | null): boolean {
  if (!assinatura || !assinatura.trim()) return false;
  const textoNorm = normalizarTexto(texto);
  const assNorm = normalizarTexto(assinatura);
  return textoNorm.includes(assNorm);
}

/**
 * Aplica a assinatura ao corpo do texto, semelhante ao comportamento do Outlook.
 * Não duplica a assinatura se ela já tiver sido inserida.
 */
export function aplicarAssinatura(texto: string, assinatura?: string | null): string {
  if (!assinatura || !assinatura.trim()) return texto;
  const assLimpa = assinatura.trim();
  if (temAssinaturaNoTexto(texto, assLimpa)) {
    return texto;
  }

  const corpo = texto.trim();
  if (!corpo) {
    return assLimpa;
  }

  return `${corpo}\n\n--\n${assLimpa}`;
}

/**
 * Remove a assinatura e o delimitador correspondente do texto, se existirem.
 */
export function removerAssinatura(texto: string, assinatura?: string | null): string {
  if (!assinatura || !assinatura.trim()) return texto;
  const assLimpa = assinatura.trim();
  let resultado = texto.replace(new RegExp(`\\n*--\\n*${escapeRegExp(assLimpa)}`, "g"), "");
  resultado = resultado.replace(new RegExp(escapeRegExp(assLimpa), "g"), "");
  return resultado.trimEnd();
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extrai o texto limpo e a imagem de uma assinatura (caso contenha imagem embutida).
 */
export function extrairTextoEImagemAssinatura(assinatura?: string | null): {
  texto: string;
  imagem: string | null;
} {
  if (!assinatura) return { texto: "", imagem: null };
  const str = String(assinatura).trim();

  // 1. Tag estruturada [ASSINATURA_IMAGEM: ...]
  const matchTag = str.match(/\[ASSINATURA_IMAGEM:\s*([\s\S]*?)\s*\]/i);
  if (matchTag && matchTag[1]) {
    const raw = matchTag[1].trim();
    const imagem = raw.startsWith("data:") ? raw.replace(/[\r\n\s]+/g, "") : raw;
    const texto = str.replace(/\[ASSINATURA_IMAGEM:\s*[\s\S]*?\s*\]/gi, "").trim();
    return { texto, imagem };
  }

  // 2. Tag de assinatura cortada/truncada (ex: [ASSINATURA_IMAGEM:data:image/...) sem fechamento ']'
  const matchIncompleto = str.match(/\[ASSINATURA_IMAGEM:\s*(data:image\/[a-zA-Z0-9+.\/]+;base64,[a-zA-Z0-9+\/=\s]*)/i);
  if (matchIncompleto && matchIncompleto[1]) {
    const imagem = matchIncompleto[1].replace(/[\r\n\s]+/g, "");
    const texto = str.replace(/\[ASSINATURA_IMAGEM:[\s\S]*$/i, "").trim();
    return { texto, imagem };
  }

  // 3. Formato Markdown ![...](...)
  const matchMd = str.match(/!\[[^\]]*\]\(\s*([\s\S]*?)\s*\)/i);
  if (matchMd && matchMd[1] && matchMd[1].trim().startsWith("data:image/")) {
    const raw = matchMd[1].trim();
    const imagem = raw.replace(/[\r\n\s]+/g, "");
    const texto = str.replace(/!\[[^\]]*\]\(\s*[\s\S]*?\s*\)/gi, "").trim();
    return { texto, imagem };
  }

  // 4. Imagem direta DataURL
  if (str.startsWith("data:image/")) {
    return { texto: "", imagem: str.replace(/[\r\n\s]+/g, "") };
  }

  // 5. DataURL contida no texto sem tag
  const matchDataUrl = str.match(/(data:image\/[a-zA-Z0-9+.\/]+;base64,[a-zA-Z0-9+\/=\s]+)/i);
  if (matchDataUrl && matchDataUrl[1]) {
    const imagem = matchDataUrl[1].replace(/[\r\n\s]+/g, "");
    const texto = str.replace(matchDataUrl[1], "").trim();
    return { texto, imagem };
  }

  return { texto: str, imagem: null };
}

/**
 * Combina texto e imagem (DataURL) em uma string única para persistência segura no banco.
 */
export function montarAssinaturaCompleta(texto: string, imagemDataUrl?: string | null): string {
  const t = texto.trim();
  const img = imagemDataUrl?.trim();
  if (t && img) return `${t}\n\n[ASSINATURA_IMAGEM:${img}]`;
  if (img) return `[ASSINATURA_IMAGEM:${img}]`;
  return t;
}

/**
 * Modelo de assinatura pronta com título, descrição e gerador dinâmico.
 */
export interface ModeloAssinaturaPronta {
  id: string;
  titulo: string;
  descricao: string;
  gerar: (usuario: DadosUsuarioAssinatura) => string;
}

/**
 * Catálogo de assinaturas institucionais prontas inspiradas no Microsoft Outlook.
 */
export const MODELOS_ASSINATURAS_PRONTAS: ModeloAssinaturaPronta[] = [
  {
    id: "suporte-tecnico",
    titulo: "Suporte Técnico N1 / N2",
    descricao: "Modelo operacional com setor, horário de suporte e contatos da central.",
    gerar: (u) => {
      const linhas = [
        "Atenciosamente,",
        u.nome.trim(),
        `Equipe de Atendimento Técnico · Setor: ${u.setor?.trim() || "TI"}`,
        "Horário de Suporte: Segunda a Sexta, das 08h às 18h",
      ];
      const contato = [u.email?.trim(), u.telefone?.trim()].filter(Boolean);
      if (contato.length > 0) linhas.push(`Canais de Contato: ${contato.join(" · ")}`);
      linhas.push("Central de Chamados Institucional");
      return linhas.join("\n");
    },
  },
  {
    id: "institucional-formal",
    titulo: "Institucional Formal / Gabinete",
    descricao: "Padrão oficial solene para comunicações administrativas e despachos.",
    gerar: (u) => {
      const linhas = [
        "Respeitosamente,",
        u.nome.trim(),
        `${u.setor?.trim() || "Administração"} — Órgão Institucional`,
      ];
      const contato = [u.email?.trim(), u.telefone?.trim()].filter(Boolean);
      if (contato.length > 0) linhas.push(contato.join(" | "));
      linhas.push("");
      linhas.push("Aviso: Esta mensagem pode conter informações restritas institucionais de uso exclusivo do solicitante.");
      return linhas.join("\n");
    },
  },
  {
    id: "resumido-agil",
    titulo: "Resumida / Ágil",
    descricao: "Formato direto e sucinto para interações e respostas rápidas.",
    gerar: (u) => {
      const linhas = [
        "Att,",
        u.nome.trim(),
        u.setor?.trim() || "Central de Atendimento",
      ];
      if (u.telefone?.trim()) linhas.push(`Ramal / Celular: ${u.telefone.trim()}`);
      return linhas.join("\n");
    },
  },
  {
    id: "encerramento-satisfacao",
    titulo: "Conclusão & Pesquisa de Satisfação",
    descricao: "Ideal para pareceres de resolução de atendimento convidando à avaliação.",
    gerar: (u) => {
      const linhas = [
        "Atenciosamente,",
        `${u.nome.trim()} — ${u.setor?.trim() || "Central de Atendimento"}`,
        "Procedimento finalizado. Permanecemos à disposição caso precise de novas orientações.",
        "Sua opinião é fundamental: avalie nosso atendimento ao encerrar este chamado!",
      ];
      return linhas.join("\n");
    },
  },
];

export interface ResultadoLeituraArquivoAssinatura {
  nome: string;
  tamanho: number;
  tipo: "texto" | "imagem";
  conteudo: string; // texto bruto ou DataURL em base64
  resumoTexto?: string;
}

/**
 * Lê um arquivo anexado contendo uma assinatura pronta (.txt, .html, .png, .jpg, etc).
 */
export async function lerArquivoAssinaturaPronta(file: File): Promise<ResultadoLeituraArquivoAssinatura> {
  const nome = file.name;
  const tamanho = file.size;
  const ehImagem = file.type.startsWith("image/");
  const ehTexto = file.type.startsWith("text/") || nome.endsWith(".txt") || nome.endsWith(".html") || nome.endsWith(".md");

  if (ehImagem) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // Converte para base64 em blocos para evitar stack overflow em arquivos grandes
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64 = `data:${file.type};base64,${btoa(binary)}`;
    return {
      nome,
      tamanho,
      tipo: "imagem",
      conteudo: base64,
      resumoTexto: `[Assinatura Gráfica Anexada: ${nome}]`,
    };
  }

  if (ehTexto) {
    let texto = (await file.text()).trim();
    // Se for HTML, remove tags básicas preservando quebras de linha
    if (nome.endsWith(".html") || file.type.includes("html")) {
      texto = texto
        .replace(/<br\s*[\/]?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .trim();
    }
    return {
      nome,
      tamanho,
      tipo: "texto",
      conteudo: texto,
      resumoTexto: texto,
    };
  }

  // Outros formatos (ex.: documento ou arquivo binário genérico)
  return {
    nome,
    tamanho,
    tipo: "texto",
    conteudo: `[Assinatura anexada do documento: ${nome}]`,
    resumoTexto: `[Assinatura Anexada: ${nome}]`,
  };
}

