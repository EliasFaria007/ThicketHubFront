import { describe, it, expect } from "vitest";
import { extrairRegistrosAtendimento } from "./registros-atendimento";

describe("extrairRegistrosAtendimento", () => {
  it("deve retornar lista vazia se conteudo for nulo ou vazio", () => {
    expect(extrairRegistrosAtendimento(null)).toEqual([]);
    expect(extrairRegistrosAtendimento("")).toEqual([]);
    expect(extrairRegistrosAtendimento("   ")).toEqual([]);
  });

  it("deve tratar registros legados como um único registro sem cabeçalho", () => {
    const texto = "Procedimento padrão realizado no equipamento.";
    const registros = extrairRegistrosAtendimento(texto);
    expect(registros.length).toBe(1);
    expect(registros[0]!.conteudo).toBe(texto);
    expect(registros[0]!.autor).toBeUndefined();
  });

  it("deve separar claramente múltiplos registros estruturados", () => {
    const texto = `### 📋 Registro de Atendimento — 25/10/2026, 14:00 · Carlos Silva (Suporte N1)

Primeira análise realizada. Aguardando peça.

---\n
### 📋 Registro de Atendimento — 25/10/2026, 16:30 · Ana Pereira (Manutenção)

Peça substituída com sucesso. Sistema operando.
[ASSINATURA_IMAGEM:data:image/png;base64,abc]`;

    const registros = extrairRegistrosAtendimento(texto);
    expect(registros.length).toBe(2);

    expect(registros[0]!.data).toBe("25/10/2026, 14:00");
    expect(registros[0]!.autor).toBe("Carlos Silva");
    expect(registros[0]!.setor).toBe("Suporte N1");
    expect(registros[0]!.conteudo).toBe("Primeira análise realizada. Aguardando peça.");

    expect(registros[1]!.data).toBe("25/10/2026, 16:30");
    expect(registros[1]!.autor).toBe("Ana Pereira");
    expect(registros[1]!.setor).toBe("Manutenção");
    expect(registros[1]!.conteudo).toContain("Peça substituída com sucesso.");
    expect(registros[1]!.conteudo).toContain("[ASSINATURA_IMAGEM:data:image/png;base64,abc]");
  });

  it("deve ignorar tags THICKET_ANEXOS no corpo dos registros", () => {
    const texto = `### 📋 Registro de Atendimento — 25/10/2026, 10:00 · João Técnico (TI)

Atendimento com foto em anexo.

<!-- THICKET_ANEXOS:[{"id":"1","nome":"teste.png","tamanho":100,"url":"data:..."}] -->`;

    const registros = extrairRegistrosAtendimento(texto);
    expect(registros.length).toBe(1);
    expect(registros[0]!.conteudo).toBe("Atendimento com foto em anexo.");
  });
});
