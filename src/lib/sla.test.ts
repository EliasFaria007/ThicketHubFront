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
    expect(slaPausadoNoStatus("aberto")).toBe(false);
  });

  it("não consome tempo enquanto está pausado", () => {
    const agora = Date.parse("2026-03-10T12:00:00.000Z");
    expect(consumidoMs({ slaConsumidoMs: 3 * HORA, slaRodandoDesde: null, status: "pausado" }, agora)).toBe(3 * HORA);
  });

  it("retoma a contagem de onde parou, sem zerar o consumido", () => {
    const agora = Date.parse("2026-03-10T12:00:00.000Z");
    const consumido = consumidoMs(
      { slaConsumidoMs: 3 * HORA, slaRodandoDesde: new Date(agora - 2 * HORA).toISOString(), status: "em_andamento" },
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
    expect(r.atrasoHoras).toBe(2);
  });

  it("encerrado para chamados resolvidos ou cancelados", () => {
    expect(resumoSla({ ...base, slaConsumidoMs: 40 * HORA, status: "resolvido" }).situacao).toBe("encerrado");
    expect(resumoSla({ ...base, slaConsumidoMs: 40 * HORA, status: "cancelado" }).situacao).toBe("encerrado");
  });

  it("deduz o limite de resolução a partir do prazoLimite e data de abertura quando slaResolucaoHoras não está preenchido", () => {
    const abertura = "2026-10-26T10:00:00.000Z";
    const prazo = "2026-10-27T10:00:00.000Z"; // 24h depois
    const agora = Date.parse("2026-10-26T16:00:00.000Z"); // 6h decorridas

    const r = resumoSla({
      status: "aberto",
      criadoEm: abertura,
      prazoLimite: prazo,
      slaConsumidoMs: 0,
      slaRodandoDesde: abertura,
    }, agora);

    expect(r.limiteHoras).toBe(24);
    expect(r.situacao).toBe("ok");
    expect(Math.round(r.restanteHoras)).toBe(18);
  });
});

describe("formatação de prazos", () => {
  it("apresenta minutos, horas e dias", () => {
    expect(horasLegivel(0.5)).toBe("30 min");
    expect(horasLegivel(4)).toBe("4h");
    expect(horasLegivel(4.5)).toBe("4h 30min");
    expect(horasLegivel(72)).toBe("3 dias");
    expect(horasLegivel(26)).toBe("1d 2h");
  });
});
