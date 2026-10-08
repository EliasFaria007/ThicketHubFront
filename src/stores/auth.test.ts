import { describe, expect, it } from "vitest";

import { podeCadastrarUsuarios, podeExecutar, podeVerSetor } from "./auth";
import type { User } from "@/types";

function usuario(parcial: Partial<User>): User {
  return {
    id: "u",
    nome: "Teste",
    email: "teste@instituto.gov.br",
    papel: "usuario",
    setor: "TI",
    setoresLiberados: [],
    podeCadastrarUsuarios: false,
    ativo: true,
    criadoEm: new Date().toISOString(),
    ...parcial,
  };
}

describe("permissões por perfil", () => {
  it("superusuário não tem restrição", () => {
    for (const permissao of ["catalogo:gerenciar", "sla:configurar", "relatorios:ler", "qualquer:coisa"]) {
      expect(podeExecutar("superusuario", permissao)).toBe(true);
    }
  });

  it("admin gerencia usuários e reabre chamados, mas não gerencia catálogo nem SLA", () => {
    expect(podeExecutar("admin", "usuarios:gerenciar")).toBe(true);
    expect(podeExecutar("admin", "chamados:reabrir")).toBe(true);
    expect(podeExecutar("admin", "relatorios:ler")).toBe(true);
    expect(podeExecutar("admin", "catalogo:gerenciar")).toBe(false);
    expect(podeExecutar("admin", "sla:configurar")).toBe(false);
  });

  it("técnico atende e encaminha, mas não reabre nem gerencia catálogo", () => {
    expect(podeExecutar("tecnico", "chamados:atualizar")).toBe(true);
    expect(podeExecutar("tecnico", "chamados:encaminhar")).toBe(true);
    expect(podeExecutar("tecnico", "chamados:assumir")).toBe(true);
    expect(podeExecutar("tecnico", "chamados:reabrir")).toBe(false);
    expect(podeExecutar("tecnico", "catalogo:gerenciar")).toBe(false);
  });

  it("usuário só abre, comenta e avalia os próprios chamados", () => {
    expect(podeExecutar("usuario", "chamados:criar")).toBe(true);
    expect(podeExecutar("usuario", "chamados:comentar")).toBe(true);
    expect(podeExecutar("usuario", "chamados:avaliar")).toBe(true);
    expect(podeExecutar("usuario", "chamados:atualizar")).toBe(false);
    expect(podeExecutar("usuario", "chamados:encaminhar")).toBe(false);
  });
});

describe("cadastro de usuários liberado pelo admin", () => {
  it("técnico só cadastra quando autorizado", () => {
    expect(podeCadastrarUsuarios(usuario({ papel: "tecnico" }))).toBe(false);
    expect(podeCadastrarUsuarios(usuario({ papel: "tecnico", podeCadastrarUsuarios: true }))).toBe(true);
  });

  it("admin e superusuário sempre podem", () => {
    expect(podeCadastrarUsuarios(usuario({ papel: "admin" }))).toBe(true);
    expect(podeCadastrarUsuarios(usuario({ papel: "superusuario" }))).toBe(true);
  });

  it("usuário comum nunca cadastra", () => {
    expect(podeCadastrarUsuarios(usuario({ papel: "usuario", podeCadastrarUsuarios: true }))).toBe(false);
  });
});

describe("restrição do técnico por setor", () => {
  const tecnico = usuario({ papel: "tecnico", setoresLiberados: ["TI", "Protocolo"] });

  it("enxerga apenas os setores liberados", () => {
    expect(podeVerSetor(tecnico, "TI")).toBe(true);
    expect(podeVerSetor(tecnico, "Protocolo")).toBe(true);
    expect(podeVerSetor(tecnico, "Financeiro")).toBe(false);
  });

  it("admin também depende das filas liberadas; superusuário vê tudo", () => {
    expect(podeVerSetor(usuario({ papel: "admin", setoresLiberados: ["TI"] }), "Financeiro")).toBe(false);
    expect(podeVerSetor(usuario({ papel: "admin", setoresLiberados: ["Financeiro"] }), "Financeiro")).toBe(true);
    expect(podeVerSetor(usuario({ papel: "superusuario" }), "Financeiro")).toBe(true);
  });

});
