import { http, ApiError, USANDO_DEMO } from "@/lib/http";
import type { ApiResponse } from "@/types";

export interface UploadArquivoResponse {
  url: string;
}

/**
 * Faz upload de um arquivo para o Cloudflare R2 através do backend Spring Boot.
 *
 * @param arquivo Arquivo File ou Blob
 * @param pasta Pasta destino no bucket (ex: "assinaturas", "anexos")
 * @param nomeArquivo Nome opcional caso o arquivo seja um Blob genérico
 * @returns Objeto com a URL pública do arquivo
 */
export async function uploadArquivo(
  arquivo: File | Blob,
  pasta: string = "anexos",
  nomeArquivo?: string
): Promise<UploadArquivoResponse> {
  if (USANDO_DEMO) {
    if (arquivo instanceof File) {
      return { url: URL.createObjectURL(arquivo) };
    }
    return { url: "https://pub-93c86b28bf944ce1a4813316cada32ba.r2.dev/demo/" + (nomeArquivo || "arquivo.png") };
  }

  const formData = new FormData();
  if (nomeArquivo && arquivo instanceof Blob && !(arquivo instanceof File)) {
    formData.append("arquivo", arquivo, nomeArquivo);
  } else {
    formData.append("arquivo", arquivo);
  }

  const { data } = await http.post<ApiResponse<UploadArquivoResponse>>(
    `/arquivos/upload?pasta=${encodeURIComponent(pasta)}`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  if (!data.success) {
    throw new ApiError(data.message ?? "Falha no upload do arquivo", data.errors ?? []);
  }

  return data.data;
}
