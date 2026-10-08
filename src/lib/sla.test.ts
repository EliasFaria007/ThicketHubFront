import { describe, expect, it } from "vitest";

import { consumidoMs, horasLegivel, resumoSla, slaPausadoNoStatus } from "./sla";

const HORA = 3_600_000;

describe("regra de pausa do SLA", () => {
  it("mantém o cronômetro pausado em aguardando, pausado, resolvido e cancelado", () => {
    expect(slaPausadoNoStatus("aguardando")).toBe(true);
    expect(slaPausadoNoStatus("pausado")).toBe(true);
    expect(slaPausadoNoStatus("resolvido")).toBe(true);
    expect(slaPausadoNoStatus("cancelado")).toBe(true);
    expect(slaPausadoNoStatus("em_andamento")).toBe(false);
  });

  it("não consome tempo enquanto está pausado", () => {
    const agora = Date.parse("2026-03-10T12:00:00.000Z");
    expect(consumidoMs({ slaConsumidoMs: 3 * HORA, slaRodandoDesde: null }, agora)).toBe(3 * HORA);
  });

  it("retoma a contagem de onde parou, sem zerar o consumido", () => {
    const agora = Date.parse("2026-03-10T12:00:00.000Z");
    const consumido = consumidoMs(
      { slaConsumidoMs: 3 * HORA, slaRodandoDesde: new Date(agora - 2 * HORA).toISOString() },
      agora,
    );
    expect(consumido).toBe(5 * HORA);
  });
});

describe("situação do SLA", () => {
  const base = { slaResolucaoHoras: 10, slaRodandoDesde: null } as const;

  it("dentro do prazo", () => {
    expect(resumoSla({ ...base, slaConsumidoMs: 2 * HORA, status: "em_andamento" }).situacao).toBe("ok");
  });

  it("próximo do vencimento a partir de 80%", () => {
    expect(resumoSla({ ...base, slaConsumidoMs: 8 * HORA, status: "em_andamento" }).situacao).toBe("atencao");
  });

  it("atrasado quando ultrapassa o prazo", () => {
    const r = resumoSla({ ...base, slaConsumidoMs: 12 * HORA, status: "em_andamento" });
    expect(r.situacao).toBe("atrasado");
    expect(r.restanteHoras).toBe(0);
  });

  it("encerrado para chamados resolvidos ou cancelados", () => {
    expect(resumoSla({ ...base, slaConsumidoMs: 40 * HORA, status: "resolvido" }).situacao).toBe("encerrado");
    expect(resumoSla({ ...base, slaConsumidoMs: 40 * HORA, status: "cancelado" }).situacao).toBe("encerrado");
  });
});

describe("formatação de prazos", () => {
  it("apresenta minutos, horas e dias", () => {
    expect(horasLegivel(0.5)).toBe("30 min");
    expect(horasLegivel(4)).toBe("4h");
    expect(horasLegivel(72)).toBe("3 dias");
  });
});
