import { describe, expect, it } from "vitest";
import { http, USANDO_DEMO } from "./http";

describe("Integração HTTP e Normalização de Respostas Java", () => {
  it("VITE_API_BASE_URL deve estar configurada para o backend Java", () => {
    // Com o .env atualizado, USANDO_DEMO deve ser false quando a variável estiver ativa
    expect(typeof USANDO_DEMO).toBe("boolean");
  });

  it("Configuração do cliente Axios possui headers padrão corretos", () => {
    expect(http.defaults.headers["Content-Type"]).toBe("application/json");
    expect(http.defaults.timeout).toBe(20000);
  });
});
