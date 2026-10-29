import type { Anexo } from "@/types";
import { uploadArquivo } from "@/services/arquivos";

/**
 * Extensões e formatos aceitos para anexos.
 */
export const FORMATOS_ACEITOS = "image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx,.csv,.zip,.rar";

/**
 * Verifica se o arquivo ou URL é imagem (para preview e thumbnail).
 * Suporta data:image, blob:, SVG, e URLs com parâmetros de busca.
 */
export function eArquivoImagem(nomeOuUrl?: string, urlFallback?: string): boolean {
  const alvos = [nomeOuUrl, urlFallback].filter(Boolean) as string[];
  for (const alvo of alvos) {
    if (alvo.startsWith("data:image/")) return true;
    if (alvo.startsWith("blob:")) return true;
    if (/\.(png|jpe?g|webp|gif|svg|bmp|ico|avif)($|[?#])/i.test(alvo)) return true;
    if (/image\/(png|jpe?g|webp|gif|svg\+xml|bmp|avif)/i.test(alvo)) return true;
  }
  return false;
}

/**
 * Extrai arquivos da área de transferência (por exemplo, prints com Ctrl+V).
 */
export function extrairArquivosClipboard(e: React.ClipboardEvent | ClipboardEvent): File[] {
  const clipboardData = e.clipboardData;
  if (!clipboardData) return [];
  const files: File[] = [];
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  if (clipboardData.items && clipboardData.items.length > 0) {
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.kind === "file") {
        const file = typeof item.getAsFile === "function" ? item.getAsFile() : null;
        if (file) {
          if (file.name === "image.png" || !file.name || file.name === "blob") {
            const ext = file.type.split("/")[1] || "png";
            const novoFile = new File([file], `print-${timestamp}.${ext}`, { type: file.type });
            files.push(novoFile);
          } else {
            files.push(file);
          }
        }
      }
    }
  }

  // Fallback se items não gerou arquivos, mas há arquivos em clipboardData.files
  if (files.length === 0 && clipboardData.files && clipboardData.files.length > 0) {
    for (let i = 0; i < clipboardData.files.length; i++) {
      const file = clipboardData.files[i];
      if (file.name === "image.png" || !file.name || file.name === "blob") {
        const ext = file.type.split("/")[1] || "png";
        const novoFile = new File([file], `print-${timestamp}.${ext}`, { type: file.type });
        files.push(novoFile);
      } else {
        files.push(file);
      }
    }
  }

  return files;
}

/**
 * Converte um arquivo em um objeto Anexo com DataURL otimizada.
 * Redimensiona imagens muito grandes (máx 1600px) para otimizar armazenamento e tráfego.
 */
export async function arquivoParaAnexo(file: File): Promise<Anexo> {
  const id = `anx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  try {
    const up = await uploadArquivo(file, "anexos");
    return {
      id,
      nome: file.name,
      tamanho: file.size,
      url: up.url,
    };
  } catch (err) {
    console.warn("Upload para Cloudflare R2 falhou, utilizando fallback local:", err);
    const dataUrl = await lerEOtimizarImagem(file);
    return {
      id,
      nome: file.name,
      tamanho: file.size,
      url: dataUrl,
    };
  }
}

/**
 * Lê uma imagem e redimensiona caso exceda 1600px em alguma dimensão.
 */
function lerEOtimizarImagem(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // Se não for imagem comum, lê como DataURL direto (ex: PDF, SVG, documentos)
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const MAX_DIM = 1600;
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        // Fallback: lê direto sem redimensionar
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      // Salva em WEBP com qualidade 0.85 para compressão máxima com ótima qualidade visual
      const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
      resolve(canvas.toDataURL(mime, 0.85));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // Se der erro ao decodificar imagem, lê direto como base64
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Baixa um anexo pelo navegador.
 */
export function baixarAnexo(anexo: Pick<Anexo, "nome" | "url">) {
  const link = document.createElement("a");
  link.href = anexo.url;
  link.download = anexo.nome;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Formata tamanho em bytes para leitura humana (ex: 2.4 MB).
 */
export function formatarTamanho(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Salva a lista de anexos no localStorage por chamadoId (cache e fallback).
 */
export function salvarAnexosLocalmente(chamadoId: string | number, anexos: Anexo[]): void {
  try {
    if (typeof window === "undefined" || !chamadoId) return;
    const chave = `thicket_anexos_${chamadoId}`;
    if (!anexos || anexos.length === 0) {
      localStorage.removeItem(chave);
      return;
    }
    localStorage.setItem(chave, JSON.stringify(anexos));
  } catch {
    // quota exceeded ou armazenamento desabilitado - ignora silenciosamente
  }
}

/**
 * Recupera os anexos salvos no localStorage para o chamado especificado.
 */
export function obterAnexosLocalmente(chamadoId: string | number): Anexo[] {
  try {
    if (typeof window === "undefined" || !chamadoId) return [];
    const chave = `thicket_anexos_${chamadoId}`;
    const bruto = localStorage.getItem(chave);
    if (!bruto) return [];
    const parsed = JSON.parse(bruto);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
