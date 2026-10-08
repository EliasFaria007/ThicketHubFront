import { beforeEach, describe, expect, it } from "vitest";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";

import { definirAtorDemo, mockAdapter } from "./mock-api";
import type { ApiResponse, Chamado, Paginacao, User } from "@/types";

const SUPER = { id: "u0", papel: "superusuario" } as User;
const ADMIN = { id: "u1", papel: "admin" } as User;
const TECNICO = { id: "u2", papel: "tecnico" } as User;
const USUARIO = { id: "u3", papel: "usuario" } as User;

async function chamar<T>(
  metodo: string,
  url: string,
  data?: unknown,
): Promise<{ status: number; corpo: ApiResponse<T> }> {
  const config = { method: metodo, url, data: data ? JSON.stringify(data) : undefined } as InternalAxiosRequestConfig;
  try {
    const res = await mockAdapter(config);
    return { status: res.status, corpo: res.data as ApiResponse<T> };
  } catch (e) {
    const err = e as AxiosError<ApiResponse<T>>;
    return { status: err.response?.status ?? 500, corpo: err.response?.data as ApiResponse<T> };
  }
}

async function listar(): Promise<Paginacao<Chamado>> {
  const { corpo } = await chamar<Paginacao<Chamado>>("GET", "/chamados?limit=100");
  return corpo.data;
}

describe("escopo de visibilidade por perfil", () => {
  it("usuário só vê os chamados criados por ele", async () => {
    definirAtorDemo(USUARIO);
    const lista = await listar();
    expect(lista.items.length).toBeGreaterThan(0);
    expect(lista.items.every((c) => c.solicitante.id === USUARIO.id)).toBe(true);
  });

  it("técnico só vê chamados dos setores liberados", async () => {
    definirAtorDemo(TECNICO);
    const lista = await listar();
    expect(lista.items.every((c) => ["TI", "Protocolo"].includes(c.setor))).toBe(true);
  });

  it("superusuário vê tudo", async () => {
    definirAtorDemo(TECNICO);
    const doTecnico = await listar();
    definirAtorDemo(SUPER);
    const doSuper = await listar();
    expect(doSuper.total).toBeGreaterThan(doTecnico.total);
  });
});

describe("regras de status e resolução", () => {
  let chamadoId = "";

  beforeEach(async () => {
    definirAtorDemo(SUPER);
    const lista = await listar();
    chamadoId = lista.items.find((c) => c.status === "em_andamento")?.id ?? lista.items[0]!.id;
  });

  it("usuário não altera status do próprio chamado", async () => {
    definirAtorDemo(USUARIO);
    const lista = await listar();
    const meu = lista.items.find((c) => c.status !== "resolvido")!;
    const { status } = await chamar("PUT", `/chamados/${meu.id}`, { status: "resolvido", versao: meu.versao });
    expect(status).toBe(403);
  });

  it("bloqueia resolução sem registro do atendimento", async () => {
    definirAtorDemo(TECNICO);
    const lista = await listar();
    const alvo = lista.items.find((c) => c.status !== "resolvido" && !c.oQueFoiFeito)!;
    const { status, corpo } = await chamar("PUT", `/chamados/${alvo.id}`, {
      status: "resolvido",
      versao: alvo.versao,
    });
    expect(status).toBe(422);
    expect(corpo.message).toBe("Registre a resposta do atendimento antes de resolver o chamado.");
  });

  it("resolve quando o técnico registra o que foi feito", async () => {
    definirAtorDemo(TECNICO);
    const lista = await listar();
    const alvo = lista.items.find((c) => c.status !== "resolvido")!;
    const { status, corpo } = await chamar<Chamado>("PUT", `/chamados/${alvo.id}`, {
      status: "resolvido",
      oQueFoiFeito: "Serviço normalizado após troca do cabo de rede.",
      versao: alvo.versao,
    });
    expect(status).toBe(200);
    expect(corpo.data.status).toBe("resolvido");
    expect(corpo.data.slaRodandoDesde).toBeNull();
  });

  it("detecta edição concorrente pela versão do registro", async () => {
    definirAtorDemo(TECNICO);
    const lista = await listar();
    const alvo = lista.items.find((c) => c.status !== "resolvido")!;
    const { status } = await chamar("PUT", `/chamados/${alvo.id}`, { status: "pausado", versao: 999 });
    expect(status).toBe(409);
  });

  it("técnico não acessa chamado de fila não liberada", async () => {
    definirAtorDemo(SUPER);
    const todos = await listar();
    const foraDaFila = todos.items.find((c) => !["TI", "Protocolo"].includes(c.setor))!;
    definirAtorDemo(TECNICO);
    const { status } = await chamar("GET", `/chamados/${foraDaFila.id}`);
    expect(status).toBe(403);
  });

  it("chamado assumido some da lista dos demais técnicos", async () => {
    definirAtorDemo(SUPER);
    const todos = await listar();
    const livre = todos.items.find(
      (c) => c.tecnico === null && ["TI", "Protocolo"].includes(c.setor) && c.status !== "resolvido",
    )!;
    definirAtorDemo(TECNICO);
    const { status } = await chamar("POST", `/chamados/${livre.id}/assumir`);
    expect(status).toBe(200);
    // Outro técnico (admin com filas liberadas) deixa de enxergar o chamado.
    definirAtorDemo(ADMIN);
    const doAdmin = await listar();
    expect(doAdmin.items.some((c) => c.id === livre.id)).toBe(false);
    // Continua visível para quem assumiu.
    definirAtorDemo(TECNICO);
    const doTecnico = await listar();
    expect(doTecnico.items.some((c) => c.id === livre.id)).toBe(true);
  });

  it("admin só enxerga chamados das filas liberadas para ele", async () => {
    definirAtorDemo(SUPER);
    await chamar("PUT", "/usuarios/u1", { setoresLiberados: ["TI"] });
    definirAtorDemo(ADMIN);
    const lista = await listar();
    expect(lista.items.every((c) => c.setor === "TI" || c.solicitante.id === ADMIN.id)).toBe(true);
    definirAtorDemo(SUPER);
    await chamar("PUT", "/usuarios/u1", {
      setoresLiberados: ["TI", "Recursos Humanos", "Financeiro", "Infraestrutura", "Protocolo"],
    });
  });

  it("admin não pode liberar filas para outro admin", async () => {
    definirAtorDemo(ADMIN);
    const { status } = await chamar("PUT", "/usuarios/u1", { setoresLiberados: ["TI"] });
    expect(status).toBe(403);
  });
});


describe("reabertura e catálogo", () => {
  it("somente admin/superusuário reabre chamado resolvido", async () => {
    definirAtorDemo(SUPER);
    const lista = await listar();
    const resolvido = lista.items.find((c) => c.status === "resolvido")!;
    definirAtorDemo(TECNICO);
    expect((await chamar("POST", `/chamados/${resolvido.id}/reabrir`, { motivo: "Voltou a falhar" })).status).toBe(403);
    definirAtorDemo(ADMIN);
    const { status, corpo } = await chamar<Chamado>("POST", `/chamados/${resolvido.id}/reabrir`, {
      motivo: "Voltou a falhar",
    });
    expect(status).toBe(200);
    expect(corpo.data.status).toBe("aguardando");
  });

  it("catálogo e SLA são exclusivos do superusuário", async () => {
    definirAtorDemo(ADMIN);
    expect((await chamar("POST", "/servicos", { nome: "Teste", setor: "TI" })).status).toBe(403);
    expect((await chamar("PUT", "/sla", { alta: { atendimentoHoras: 1, resolucaoHoras: 2 } })).status).toBe(403);
    definirAtorDemo(SUPER);
    expect((await chamar("POST", "/servicos", { nome: "Teste", setor: "TI" })).status).toBe(200);
  });
});

describe("fila do técnico e notificações", () => {
  it("assumir tira o chamado da fila geral e notifica", async () => {
    definirAtorDemo(SUPER);
    const lista = await listar();
    const naFila = lista.items.find((c) => !c.tecnico && ["TI", "Protocolo"].includes(c.setor))!;
    definirAtorDemo(TECNICO);
    const { status, corpo } = await chamar<Chamado>("POST", `/chamados/${naFila.id}/assumir`);
    expect(status).toBe(200);
    expect(corpo.data.tecnico?.id).toBe(TECNICO.id);
    expect(corpo.data.filaSetor).toBeNull();
    expect((await chamar("POST", `/chamados/${naFila.id}/assumir`)).status).toBe(409);

    definirAtorDemo(ADMIN);
    const caixa = await chamar<{ naoLidas: number }>("GET", "/notificacoes");
    expect(caixa.corpo.data.naoLidas).toBeGreaterThan(0);
  });

  it("usuário não encaminha chamados", async () => {
    definirAtorDemo(USUARIO);
    const lista = await listar();
    const meu = lista.items[0]!;
    const { status } = await chamar("POST", `/chamados/${meu.id}/encaminhar`, {
      filaSetor: "TI",
      motivo: "Preciso de ajuda",
    });
    expect(status).toBe(403);
  });
});

describe("relatórios e auditoria", () => {
  it("relatórios restritos à administração", async () => {
    definirAtorDemo(TECNICO);
    expect((await chamar("GET", "/relatorios")).status).toBe(403);
    definirAtorDemo(ADMIN);
    const { status, corpo } = await chamar<{ totalChamados: number }>("GET", "/relatorios");
    expect(status).toBe(200);
    expect(corpo.data.totalChamados).toBeGreaterThan(0);
  });

  it("auditoria restrita e não vazia", async () => {
    definirAtorDemo(USUARIO);
    expect((await chamar("GET", "/auditoria")).status).toBe(403);
    definirAtorDemo(SUPER);
    const { corpo } = await chamar<Paginacao<{ id: string }>>("GET", "/auditoria");
    expect(corpo.data.items.length).toBeGreaterThan(0);
  });
});

describe("proteção do perfil superusuário", () => {
  it("admin não edita o superusuário", async () => {
    definirAtorDemo(ADMIN);
    const { status } = await chamar("PUT", "/usuarios/u0", { nome: "Tentativa" });
    expect(status).toBe(403);
  });

  it("admin não desativa o superusuário", async () => {
    definirAtorDemo(ADMIN);
    const { status } = await chamar("PUT", "/usuarios/u0", { ativo: false });
    expect(status).toBe(403);
  });

  it("técnico com cadastro liberado não edita o superusuário", async () => {
    definirAtorDemo({ ...TECNICO, podeCadastrarUsuarios: true } as User);
    expect((await chamar("PUT", "/usuarios/u0", { nome: "Tentativa" })).status).toBe(403);
  });

  it("apenas o superusuário promove alguém a superusuário", async () => {
    definirAtorDemo(ADMIN);
    expect((await chamar("PUT", "/usuarios/u3", { papel: "superusuario" })).status).toBe(403);
    definirAtorDemo(SUPER);
    const { status, corpo } = await chamar<User>("PUT", "/usuarios/u0", { nome: "Root Institucional" });
    expect(status).toBe(200);
    expect(corpo.data.papel).toBe("superusuario");
  });
});

describe("fila autorizada do técnico", () => {
  it("técnico não abre chamado de setor fora da sua fila", async () => {
    definirAtorDemo(SUPER);
    const todos = await listar();
    const foraDaFila = todos.items.find(
      (c) => !["TI", "Protocolo"].includes(c.setor) && c.solicitante.id !== TECNICO.id,
    )!;
    definirAtorDemo(TECNICO);
    expect((await chamar("GET", `/chamados/${foraDaFila.id}`)).status).toBe(403);
    expect((await chamar("POST", `/chamados/${foraDaFila.id}/assumir`)).status).toBe(403);
  });

  it("painel do técnico só soma setores liberados", async () => {
    definirAtorDemo(TECNICO);
    const { corpo } = await chamar<{ porSetor: { setor: string; total: number }[] }>("GET", "/chamados/metricas");
    expect(corpo.data.porSetor.every((linha) => ["TI", "Protocolo"].includes(linha.setor))).toBe(true);
    expect(corpo.data.porSetor.every((linha) => linha.total > 0)).toBe(true);
  });
});

describe("abertura de chamado sem mínimo de caracteres", () => {
  it("aceita assunto e descrição curtos", async () => {
    definirAtorDemo(USUARIO);
    const { status, corpo } = await chamar<Chamado>("POST", "/chamados", {
      servicoId: "s5",
      titulo: "Ok",
      descricao: "Erro",
    });
    expect(status).toBe(200);
    expect(corpo.data.titulo).toBe("Ok");
    expect(corpo.data.status).toBe("aguardando");
  });
});

describe("edição de administradores e vínculos de chamados", () => {
  it("admin pode editar telefone e nome de outro admin sem alterar setores", async () => {
    definirAtorDemo(ADMIN);
    const { status, corpo } = await chamar<User>("PUT", "/usuarios/u1", {
      nome: "Ana Ribeiro",
      telefone: "(31) 98888-9999",
    });
    expect(status).toBe(200);
    expect(corpo.data.telefone).toBe("(31) 98888-9999");
  });

  it("permite vincular chamados como relacionados e duplicados", async () => {
    definirAtorDemo(SUPER);
    const lista = await listar();
    const c1 = lista.items[0]!;
    const c2 = lista.items[1]!;

    const { status: st1, corpo: cp1 } = await chamar<Chamado>("POST", `/chamados/${c1.id}/vinculos`, {
      protocolo: c2.protocolo,
      tipo: "relacionado",
    });
    expect(st1).toBe(200);
    expect(cp1.data.relacionados).toContain(c2.id);

    const { status: st2, corpo: cp2 } = await chamar<Chamado>("POST", `/chamados/${c1.id}/vinculos`, {
      protocolo: c2.protocolo,
      tipo: "duplicado",
    });
    expect(st2).toBe(200);
    expect(cp2.data.duplicadoDe).toBe(c2.id);
  });
});

describe("recuperação de senha via SMS, cadastro de localidade e reset manual", () => {
  it("solicita código SMS de reset para e-mail cadastrado", async () => {
    const { status, corpo } = await chamar<{ telefoneMascarado: string; codigoDemo?: string }>(
      "POST",
      "/auth/solicitar-reset-sms",
      { email: "tecnico@instituto.gov.br" },
    );
    expect(status).toBe(200);
    expect(corpo.data.telefoneMascarado).toBe("(31) 9****-2222");
    expect(corpo.data.codigoDemo).toBe("123456");
  });

  it("rejeita código de SMS inválido e confirma quando correto", async () => {
    await chamar("POST", "/auth/solicitar-reset-sms", { email: "tecnico@instituto.gov.br" });

    const { status: stInvalido } = await chamar("POST", "/auth/confirmar-reset-sms", {
      email: "tecnico@instituto.gov.br",
      codigo: "000000",
      novaSenha: "novaSenha123",
    });
    expect(stInvalido).toBe(400);

    const { status: stValido, corpo } = await chamar<{ mensagem: string }>("POST", "/auth/confirmar-reset-sms", {
      email: "tecnico@instituto.gov.br",
      codigo: "123456",
      novaSenha: "novaSenha123",
    });
    expect(stValido).toBe(200);
    expect(corpo.data.mensagem).toContain("sucesso");
  });

  it("completa cadastro no primeiro acesso com telefone e localidade", async () => {
    definirAtorDemo(USUARIO);
    const { status, corpo } = await chamar<User>("POST", "/auth/completar-cadastro", {
      telefone: "(31) 98765-4321",
      localidade: "Bloco A - Sala 101",
    });
    expect(status).toBe(200);
    expect(corpo.data.telefone).toBe("(31) 98765-4321");
    expect(corpo.data.localidade).toBe("Bloco A - Sala 101");
    expect(corpo.data.primeiroAcessoConcluido).toBe(true);
  });

  it("permite alterar senha pelo próprio usuário autenticado", async () => {
    definirAtorDemo(USUARIO);
    const { status, corpo } = await chamar<{ mensagem: string }>("POST", "/auth/alterar-senha", {
      senhaAtual: "senha123",
      novaSenha: "outraSenhaForte123",
    });
    expect(status).toBe(200);
    expect(corpo.data.mensagem).toContain("sucesso");
  });

  it("permite que super e admin resetem manualmente a senha de outro usuário", async () => {
    definirAtorDemo(SUPER);
    const { status, corpo } = await chamar<{ novaSenha: string }>("POST", "/usuarios/u3/resetar-senha");
    expect(status).toBe(200);
    expect(corpo.data.novaSenha).toBeDefined();
    expect(corpo.data.novaSenha.length).toBeGreaterThan(6);
  });

  it("impede que técnico resete senha de admin ou superusuário", async () => {
    definirAtorDemo(TECNICO);
    const { status } = await chamar("POST", "/usuarios/u0/resetar-senha");
    expect(status).toBe(403);
  });
});

describe("gerenciamento de domínios institucionais e importação em lista", () => {
  it("superusuário consulta e atualiza domínios institucionais e domínio padrão", async () => {
    definirAtorDemo(SUPER);
    const { status: stGet, corpo: cpGet } = await chamar<{ dominios: string[]; padrao: string }>(
      "GET",
      "/configuracoes/dominios",
    );
    expect(stGet).toBe(200);
    expect(cpGet.data.dominios).toContain("instituto.gov.br");

    const { status: stPost, corpo: cpPost } = await chamar<{ dominios: string[]; padrao: string }>(
      "POST",
      "/configuracoes/dominios",
      {
        dominios: ["instituto.gov.br", "defensoria.mg.def.br", "orgao.gov.br"],
        padrao: "orgao.gov.br",
      },
    );
    expect(stPost).toBe(200);
    expect(cpPost.data.padrao).toBe("orgao.gov.br");
    expect(cpPost.data.dominios).toContain("orgao.gov.br");
  });

  it("usuário e técnico não alteram configurações de domínios", async () => {
    definirAtorDemo(TECNICO);
    const { status } = await chamar("POST", "/configuracoes/dominios", {
      dominios: ["teste.gov.br"],
      padrao: "teste.gov.br",
    });
    expect(status).toBe(403);
  });

  it("administrador e super criam usuários em lista/lote com validação de domínios", async () => {
    definirAtorDemo(ADMIN);
    const { status, corpo } = await chamar<{
      criados: User[];
      erros: { linha: number; email: string; motivo: string }[];
      totalCriados: number;
    }>("POST", "/usuarios/lote", {
      usuarios: [
        {
          nome: "Servidor Valido Um",
          email: "servidor.valido1@instituto.gov.br",
          setor: "Recursos Humanos",
          papel: "usuario",
        },
        {
          nome: "Servidor Valido Dois",
          email: "servidor.valido2@instituto.gov.br",
          setor: "TI",
          papel: "tecnico",
        },
        {
          nome: "Servidor Invalido Dominio",
          email: "invalido@gmail.com",
          setor: "TI",
        },
      ],
    });

    expect(status).toBe(200);
    expect(corpo.data.totalCriados).toBe(2);
    expect(corpo.data.erros.length).toBe(1);
    expect(corpo.data.erros[0]!.email).toBe("invalido@gmail.com");
  });

  it("técnico visualiza somente seus próprios registros de auditoria", async () => {
    definirAtorDemo(TECNICO);
    const { status, corpo } = await chamar<{ items: { usuarioId?: string }[] }>("GET", "/auditoria");
    expect(status).toBe(200);
    expect(corpo.data.items.every((item) => item.usuarioId === TECNICO.id)).toBe(true);
  });

  it("usuário comum não tem permissão para visualizar auditoria", async () => {
    definirAtorDemo(USUARIO);
    const { status } = await chamar("GET", "/auditoria");
    expect(status).toBe(403);
  });

  it("filtra chamados assumidos na fila minha e disponíveis na fila geral", async () => {
    definirAtorDemo(TECNICO);
    const { status: stMinha, corpo: cpMinha } = await chamar<{ items: { tecnico?: { id: string } | null }[] }>(
      "GET",
      "/chamados?fila=minha",
    );
    expect(stMinha).toBe(200);
    expect(cpMinha.data.items.every((c) => c.tecnico?.id === TECNICO.id)).toBe(true);

    const { status: stGeral, corpo: cpGeral } = await chamar<{ items: { tecnico?: { id: string } | null }[] }>(
      "GET",
      "/chamados?fila=geral",
    );
    expect(stGeral).toBe(200);
    expect(cpGeral.data.items.every((c) => c.tecnico === null)).toBe(true);
  });
});



