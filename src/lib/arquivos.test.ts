import { describe, it, expect } from "vitest";
import { FORMATOS_ACEITOS, eArquivoImagem, extrairArquivosClipboard } from "./arquivos";

describe("Tópico 1 - Gerenciador de Anexos, Drag&Drop e Clipboard", () => {
  it("deve conter formatos comuns de imagens e documentos em FORMATOS_ACEITOS", () => {
    expect(FORMATOS_ACEITOS).toContain("image/*");
    expect(FORMATOS_ACEITOS).toContain(".pdf");
    expect(FORMATOS_ACEITOS).toContain(".docx");
    expect(FORMATOS_ACEITOS).toContain(".zip");
  });

  it("deve identificar corretamente se um arquivo é imagem pela extensão ou URL", () => {
    expect(eArquivoImagem("print.png")).toBe(true);
    expect(eArquivoImagem("foto.jpeg")).toBe(true);
    expect(eArquivoImagem("grafico.webp")).toBe(true);
    expect(eArquivoImagem("data:image/png;base64,iVBORw0KGgo")).toBe(true);

    expect(eArquivoImagem("relatorio.pdf")).toBe(false);
    expect(eArquivoImagem("planilha.xlsx")).toBe(false);
    expect(eArquivoImagem("dados.csv")).toBe(false);
    expect(eArquivoImagem(undefined)).toBe(false);
  });

  it("deve extrair arquivos colados do clipboard corretamente", () => {
    const fakeFile = new File(["dummy content"], "screenshot.png", { type: "image/png" });
    const mockEvent = {
      clipboardData: {
        files: [fakeFile],
        items: [],
      },
    } as unknown as React.ClipboardEvent;

    const extraidos = extrairArquivosClipboard(mockEvent);
    expect(extraidos.length).toBe(1);
    expect(extraidos[0].name).toBe("screenshot.png");
  });
});
