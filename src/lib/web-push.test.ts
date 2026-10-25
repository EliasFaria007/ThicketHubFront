import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  conviteFoiDispensado,
  dispensarConviteNotificacao,
  dispararNotificacaoNativa,
  obterPreferenciaNotificacao,
  salvarPreferenciaNotificacao,
  solicitarPermissaoNotificacoes,
  suportaNotificacoesWeb,
} from "./web-push";

describe("web-push", () => {
  const store: Record<string, string> = {};

  const mockLocalStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k in store) delete store[k];
    },
  };

  beforeEach(() => {
    mockLocalStorage.clear();
    // @ts-expect-error mock window e localStorage
    globalThis.window = {
      location: { href: "" },
      focus: vi.fn(),
    };
    // @ts-expect-error mock localStorage
    globalThis.localStorage = mockLocalStorage;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-expect-error limpeza de mocks
    delete (globalThis.window as any)?.Notification;
    // @ts-expect-error limpeza de mocks
    delete globalThis.Notification;
  });

  it("identifica corretamente se o navegador suporta notificações", () => {
    const mockNotif = vi.fn();
    (globalThis.window as any).Notification = mockNotif;
    globalThis.Notification = mockNotif as any;

    expect(suportaNotificacoesWeb()).toBe(true);
  });

  it("salva e recupera a preferência do usuário no localStorage", () => {
    expect(obterPreferenciaNotificacao()).toBe(false);
    salvarPreferenciaNotificacao(true);
    expect(obterPreferenciaNotificacao()).toBe(true);
    salvarPreferenciaNotificacao(false);
    expect(obterPreferenciaNotificacao()).toBe(false);
  });

  it("controla a dispensa do convite de ativação", () => {
    expect(conviteFoiDispensado()).toBe(false);
    dispensarConviteNotificacao();
    expect(conviteFoiDispensado()).toBe(true);
  });

  it("solicita permissão explicitamente via Notification.requestPermission()", async () => {
    const mockRequestPermission = vi.fn().mockResolvedValue("granted");
    const mockNotif = {
      permission: "granted",
      requestPermission: mockRequestPermission,
    };
    (globalThis.window as any).Notification = mockNotif;
    globalThis.Notification = mockNotif as any;

    const status = await solicitarPermissaoNotificacoes();
    expect(status).toBe("granted");
    expect(mockRequestPermission).toHaveBeenCalledOnce();
    expect(obterPreferenciaNotificacao()).toBe(true);
  });

  it("dispara notificação nativa quando a permissão for concedida", async () => {
    class MockNotification {
      static permission = "granted";
      static chamadas: any[] = [];
      title: string;
      options: any;
      onclick: (() => void) | null = null;
      close = vi.fn();

      constructor(title: string, options: any) {
        this.title = title;
        this.options = options;
        MockNotification.chamadas.push({ title, options });
      }
    }

    (globalThis.window as any).Notification = MockNotification;
    globalThis.Notification = MockNotification as any;

    const sucesso = await dispararNotificacaoNativa("Chamado Atualizado", {
      body: "O técnico respondeu ao chamado #CH-2026",
      url: "/chamados/10",
    });

    expect(sucesso).toBe(true);
    expect(MockNotification.chamadas).toHaveLength(1);
    expect(MockNotification.chamadas[0]?.title).toBe("Chamado Atualizado");
    expect(MockNotification.chamadas[0]?.options.body).toBe("O técnico respondeu ao chamado #CH-2026");
  });

  it("não dispara notificação se a permissão não foi concedida", async () => {
    class MockNotification {
      static permission = "denied";
      static chamadas: any[] = [];
      constructor(title: string, options: any) {
        MockNotification.chamadas.push({ title, options });
      }
    }

    (globalThis.window as any).Notification = MockNotification;
    globalThis.Notification = MockNotification as any;

    const sucesso = await dispararNotificacaoNativa("Teste");
    expect(sucesso).toBe(false);
    expect(MockNotification.chamadas).toHaveLength(0);
  });
});
