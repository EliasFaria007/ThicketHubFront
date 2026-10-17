import { describe, expect, it } from "vitest";
import { dataCurta, dataHora, desdeAgora, estaAtrasado, iniciais } from "./format";

describe("format helpers", () => {
  describe("dataCurta", () => {
    it("formata data ISO válida", () => {
      expect(dataCurta("2026-10-16T15:30:00Z")).toBe("16/10/2026");
    });

    it("retorna traço seguro para null ou undefined", () => {
      expect(dataCurta(null)).toBe("—");
      expect(dataCurta(undefined)).toBe("—");
      expect(dataCurta("")).toBe("—");
    });

    it("retorna traço seguro para string inválida", () => {
      expect(dataCurta("data-invalida")).toBe("—");
    });
  });

  describe("dataHora", () => {
    it("formata data e hora ISO válida", () => {
      const res = dataHora("2026-10-16T15:30:00");
      expect(res).toContain("16/10/2026");
    });

    it("retorna traço seguro para null ou undefined", () => {
      expect(dataHora(null)).toBe("—");
      expect(dataHora(undefined)).toBe("—");
      expect(dataHora("")).toBe("—");
    });
  });

  describe("desdeAgora", () => {
    it("retorna texto de distância para data válida", () => {
      const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      expect(desdeAgora(ontem)).toBeTruthy();
    });

    it("retorna traço para null ou undefined", () => {
      expect(desdeAgora(null)).toBe("—");
      expect(desdeAgora(undefined)).toBe("—");
    });
  });

  describe("estaAtrasado", () => {
    it("retorna false para null ou undefined", () => {
      expect(estaAtrasado(null)).toBe(false);
      expect(estaAtrasado(undefined)).toBe(false);
      expect(estaAtrasado("")).toBe(false);
    });

    it("detecta data no passado", () => {
      expect(estaAtrasado("2020-01-01T00:00:00Z")).toBe(true);
    });
  });

  describe("iniciais", () => {
    it("extrai iniciais de nome", () => {
      expect(iniciais("Elias das Neves")).toBe("ED");
      expect(iniciais("Administrador")).toBe("A");
    });

    it("retorna interrogação para null ou string vazia", () => {
      expect(iniciais(null)).toBe("?");
      expect(iniciais(undefined)).toBe("?");
      expect(iniciais("")).toBe("?");
      expect(iniciais("   ")).toBe("?");
    });
  });
});
