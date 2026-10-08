import { beforeEach, describe, expect, it } from "vitest";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";

import { definirAtorDemo, mockAdapter } from "@/lib/mock-api";
import { realtime } from "@/lib/websocket";
import type {
  ApiResponse,
  ArtigoBaseConhecimento,
  ConfiguracaoEmail,
  ConfiguracaoLdap,
  ResultadoTesteEmail,
  ResultadoTesteLdap,
  User,
} from "@/types";

const SUPER = { id: "u0", papel: "superusuario", nome: "Super Administrador" } as User;
const TECNICO = { id: "u2", papel: "tecnico", nome: "Técnico Suporte" } as User;
const USUARIO = { id: "u3", papel: "usuario", nome: "Maria Solicitante" } as User;

async function chamar<T>(
  metodo: string,
  url: string,
  data?: unknown,
): Promise<{ status: number; corpo: ApiResponse<T> }> {
  const config = {
    method: metodo,
    url,
    data: data ? JSON.stringify(data) : undefined,
  } as InternalAxiosRequestConfig;
  try {
    const res = await mockAdapter(config);
    return { status: res.status, corpo: res.data as ApiResponse<T> };
  } catch (e) {
    const err = e as AxiosError<ApiResponse<T>>;
    return { status: err.response?.status ?? 500, corpo: err.response?.data as ApiResponse<T> };
  }
}

describe("Base de Conhecimento / FAQ (Autoatendimento)", () => {
  beforeEach(() => {
    definirAtorDemo(USUARIO);
  });

  it("permite listar artigos cadastrados com suporte a busca textual", async () => {
    const { status, corpo } = await chamar<ArtigoBaseConhecimento[]>("GET", "/base-conhecimento");
    expect(status).toBe(200);
    expect(corpo.success).toBe(true);
    expect(corpo.data.length).toBeGreaterThan(0);

    // Busca específica
    const buscaRes = await chamar<ArtigoBaseConhecimento[]>(
      "GET",
      "/base-conhecimento?busca=impressora",
    );
    expect(buscaRes.status).toBe(200);
    expect(buscaRes.corpo.data.some((a) => a.titulo.toLowerCase().includes("impressora"))).toBe(true);
  });

  it("permite visualizar um artigo específico", async () => {
    const lista = await chamar<ArtigoBaseConhecimento[]>("GET", "/base-conhecimento");
    const primeiro = lista.corpo.data[0];
    expect(primeiro).toBeDefined();
    if (!primeiro) return;

    const detalhe = await chamar<ArtigoBaseConhecimento>("GET", `/base-conhecimento/${primeiro.id}`);
    expect(detalhe.status).toBe(200);
    expect(detalhe.corpo.data.id).toBe(primeiro.id);
    expect(detalhe.corpo.data.titulo).toBe(primeiro.titulo);
  });

  it("permite ao usuário avaliar se o artigo foi útil ou não (feedback)", async () => {
    const lista = await chamar<ArtigoBaseConhecimento[]>("GET", "/base-conhecimento");
    const artigo = lista.corpo.data[0];
    expect(artigo).toBeDefined();
    if (!artigo) return;

    const uteisAntes = artigo.utilSim;

    const voto = await chamar<ArtigoBaseConhecimento>(
      "POST",
      `/base-conhecimento/${artigo.id}/avaliar`,
      { util: true },
    );
    expect(voto.status).toBe(200);
    expect(voto.corpo.data.utilSim).toBe(uteisAntes + 1);
  });

  it("permite a um técnico criar um novo artigo com instruções passo a passo", async () => {
    definirAtorDemo(TECNICO);
    const novo = {
      titulo: "Como solicitar acesso à pasta de rede compartilhada",
      resumo: "Instruções para requisição e mapeamento de volumes compartilhados.",
      conteudo: "1. Acesse o painel. 2. Informe o caminho. 3. Aguarde aprovação da gerência.",
      setor: "TI",
      categoria: "Acessos",
      tags: ["rede", "compartilhamento", "smb"],
    };

    const criacao = await chamar<ArtigoBaseConhecimento>("POST", "/base-conhecimento", novo);
    expect([200, 201]).toContain(criacao.status);
    expect(criacao.corpo.data.titulo).toBe(novo.titulo);
    expect(criacao.corpo.data.id).toBeDefined();

    // Verificação na listagem
    const lista = await chamar<ArtigoBaseConhecimento[]>("GET", "/base-conhecimento?busca=compartilhada");
    expect(lista.corpo.data.some((a) => a.id === criacao.corpo.data.id)).toBe(true);
  });

  it("impede que usuário comum crie ou remova artigos da base de conhecimento", async () => {
    definirAtorDemo(USUARIO);
    const criacao = await chamar<ArtigoBaseConhecimento>("POST", "/base-conhecimento", {
      titulo: "Tentativa não autorizada",
      conteudo: "conteudo",
    });
    expect(criacao.status).toBe(403);
  });
});

describe("Integração Corporativa LDAP / Active Directory", () => {
  it("permite ao superadministrador consultar configurações LDAP", async () => {
    definirAtorDemo(SUPER);
    const { status, corpo } = await chamar<ConfiguracaoLdap>("GET", "/configuracoes/ldap");
    expect(status).toBe(200);
    expect(corpo.success).toBe(true);
    expect(corpo.data.servidor).toBeDefined();
    expect(corpo.data.porta).toBeGreaterThan(0);
  });

  it("permite testar a conexão LDAP com métricas de latência e usuários", async () => {
    definirAtorDemo(SUPER);
    const { status, corpo } = await chamar<ResultadoTesteLdap>("POST", "/configuracoes/ldap/testar", {
      servidor: "dc1.empresa.local",
      porta: 389,
      usarSsl: false,
      baseDn: "dc=empresa,dc=local",
    });

    expect(status).toBe(200);
    expect(corpo.data.sucesso).toBe(true);
    expect(corpo.data.tempoRespostaMs).toBeGreaterThan(0);
    expect(corpo.data.detalhes?.servidorAcessivel).toBe(true);
    expect(corpo.data.detalhes?.usuariosEncontrados).toBeGreaterThan(0);
  });

  it("permite salvar as configurações e sincronizar usuários do diretório", async () => {
    definirAtorDemo(SUPER);
    const salvamento = await chamar<ConfiguracaoLdap>("PUT", "/configuracoes/ldap", {
      ativo: true,
      servidor: "ad.corporativo.gov.br",
      porta: 636,
      usarSsl: true,
      baseDn: "dc=corporativo,dc=gov,dc=br",
      dominio: "CORP",
    });
    expect(salvamento.status).toBe(200);
    expect(salvamento.corpo.data.servidor).toBe("ad.corporativo.gov.br");
    expect(salvamento.corpo.data.usarSsl).toBe(true);

    const sincronizacao = await chamar<{ totalSincronizados: number; mensagem: string }>(
      "POST",
      "/configuracoes/ldap/sincronizar",
    );
    expect(sincronizacao.status).toBe(200);
    expect(sincronizacao.corpo.data.totalSincronizados).toBeGreaterThan(0);
  });

  it("impede que usuários sem permissão gerenciem LDAP", async () => {
    definirAtorDemo(USUARIO);
    const consulta = await chamar("GET", "/configuracoes/ldap");
    expect(consulta.status).toBe(403);
  });
});

describe("Integração de E-mail (SMTP & Mail-to-Ticket)", () => {
  it("permite consultar e salvar parâmetros do servidor SMTP e Mail-to-Ticket", async () => {
    definirAtorDemo(SUPER);
    const consulta = await chamar<ConfiguracaoEmail>("GET", "/configuracoes/email");
    expect(consulta.status).toBe(200);
    expect(consulta.corpo.data.servidorSmtp).toBeDefined();

    const alteracao = await chamar<ConfiguracaoEmail>("PUT", "/configuracoes/email", {
      ativo: true,
      servidorSmtp: "smtp.office365.com",
      portaSmtp: 587,
      usarTls: true,
      remetenteNome: "Central de Serviços Corporativos",
      remetenteEmail: "servicos@empresa.com.br",
      mailToTicketAtivo: true,
    });
    expect(alteracao.status).toBe(200);
    expect(alteracao.corpo.data.remetenteNome).toBe("Central de Serviços Corporativos");
    expect(alteracao.corpo.data.mailToTicketAtivo).toBe(true);
  });

  it("permite testar o envio de e-mail institucional", async () => {
    definirAtorDemo(SUPER);
    const teste = await chamar<ResultadoTesteEmail>("POST", "/configuracoes/email/testar", {
      destinatario: "teste@empresa.com.br",
    });
    expect(teste.status).toBe(200);
    expect(teste.corpo.data.sucesso).toBe(true);
  });
});

describe("Cliente Realtime WebSocket", () => {
  it("gerencia ouvintes de mensagens e status corretamente", () => {
    let statusRecebido = "";
    const unsub = realtime.onStatus((status) => {
      statusRecebido = status;
    });

    expect(["desconectado", "conectando", "conectado"]).toContain(statusRecebido);
    unsub();

    let msgRecebida: unknown = null;
    const unsubMsg = realtime.onMensagem((m) => {
      msgRecebida = m;
    });

    realtime.emitirSimulado({
      tipo: "novo_chamado",
      titulo: "Chamado urgente atribuído",
      descricao: "Protocolo 2026-0001",
      timestamp: new Date().toISOString(),
    });

    expect(msgRecebida).not.toBeNull();
    unsubMsg();
  });
});
