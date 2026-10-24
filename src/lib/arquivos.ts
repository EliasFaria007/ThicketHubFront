import type { Anexo } from "@/types";

/**
 * Converte um arquivo de imagem em um objeto Anexo com DataURL otimizada.
 * Redimensiona imagens muito grandes (máx 1600px) para otimizar armazenamento e tráfego.
 */
export async function arquivoParaAnexo(file: File): Promise<Anexo> {
  const id = `anx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const dataUrl = await lerEOtimizarImagem(file);
  return {
    id,
    nome: file.name,
    tamanho: file.size,
    url: dataUrl,
  };
}

/**
 * Lê uma imagem e redimensiona caso exceda 1600px em alguma dimensão.
 */
function lerEOtimizarImagem(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // Se não for imagem comum, lê como DataURL direto (ex: SVG, documentos)
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(reader.result as string); // fallback
      img.onload = () => {
        const MAX_DIM = 1600;
        let { width, height } = img;

        // Se já for pequena (< 200KB) e com dimensões contidas, mantém original
        if (width <= MAX_DIM && height <= MAX_DIM && file.size < 200 * 1024) {
          resolve(reader.result as string);
          return;
        }

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
          resolve(reader.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Detecta suporte a webp com fallback para jpeg
        let formato = "image/webp";
        try {
          const test = document.createElement("canvas");
          test.width = 1;
          test.height = 1;
          if (test.toDataURL("image/webp").indexOf("data:image/webp") !== 0) {
            formato = "image/jpeg";
          }
        } catch {
          formato = "image/jpeg";
        }

        // Comprime para 80% de qualidade gerando arquivos levíssimos
        const resizedDataUrl = canvas.toDataURL(formato, 0.8);
        resolve(resizedDataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Dispara o download de um anexo no navegador.
 */
export function baixarAnexo(anexo: Pick<Anexo, "nome" | "url">) {
  const link = document.createElement("a");
  link.href = anexo.url;
  link.download = anexo.nome;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Formata tamanho em bytes para exibição humana (KB, MB).
 */
export function formatarTamanho(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Salva a lista de anexos no localStorage como backup persistente local.
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
  } catch (err) {
    console.warn("Não foi possível salvar anexos no localStorage:", err);
  }
}

/**
 * Recupera os anexos salvos localmente para o chamado.
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

