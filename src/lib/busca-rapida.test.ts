import { describe, expect, it } from "vitest";
import {
  ehAtalhoBuscaRapida,
  filtrarItensNavegacao,
  formatarValorItemBusca,
  type ItemNavegacaoRapida,
} from "./busca-rapida";

describe("busca-rapida", () => {
  describe("ehAtalhoBuscaRapida", () => {
    it("deve detectar Ctrl+K no Windows/Linux", () => {
      expect(ehAtalhoBuscaRapida({ key: "k", ctrlKey: true })).toBe(true);
      expect(ehAtalhoBuscaRapida({ key: "K", ctrlKey: true })).toBe(true);
    });

    it("deve detectar Cmd+K no macOS", () => {
      expect(ehAtalhoBuscaRapida({ key: "k", metaKey: true })).toBe(true);
      expect(ehAtalhoBuscaRapida({ key: "K", metaKey: true })).toBe(true);
    });

    it("não deve ativar para outras teclas com Ctrl ou tecla K isolada", () => {
      expect(ehAtalhoBuscaRapida({ key: "k", ctrlKey: false, metaKey: false })).toBe(false);
      expect(ehAtalhoBuscaRapida({ key: "p", ctrlKey: true })).toBe(false);
      expect(ehAtalhoBuscaRapida({ key: "Escape" })).toBe(false);
    });
  });

  describe("formatarValorItemBusca", () => {
    it("deve concatenar e normalizar em minúsculas os dados do chamado", () => {
      const valor = formatarValorItemBusca("CH-2026-1025-8007", "Falha de Rede", "Maria Silva", "Financeiro");
      expect(valor).toBe("ch-2026-1025-8007 falha de rede maria silva financeiro");
    });
  });

  describe("filtrarItensNavegacao", () => {
    const itensMock: ItemNavegacaoRapida[] = [
      { id: "1", titulo: "Abrir Novo Chamado", caminho: "/chamados/novo", palavrasChave: ["criar", "demanda"] },
      { id: "2", titulo: "Relatórios Gerenciais", caminho: "/relatorios", palavrasChave: ["sla", "metricas"] },
      { id: "3", titulo: "Base de Conhecimento", caminho: "/base-conhecimento", palavrasChave: ["artigos", "ajuda"] },
    ];

    it("retorna todos os itens se o termo estiver vazio", () => {
      expect(filtrarItensNavegacao("", itensMock)).toHaveLength(3);
      expect(filtrarItensNavegacao("   ", itensMock)).toHaveLength(3);
    });

    it("filtra por palavras-chave com sucesso", () => {
      const resultado = filtrarItensNavegacao("sla", itensMock);
      expect(resultado).toHaveLength(1);
      expect(resultado[0]?.id).toBe("2");
    });

    it("filtra por título do item", () => {
      const resultado = filtrarItensNavegacao("novo", itensMock);
      expect(resultado).toHaveLength(1);
      expect(resultado[0]?.id).toBe("1");
    });
  });
});
