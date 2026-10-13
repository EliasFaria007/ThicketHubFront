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

  it("permite a um técnico criar e atualizar artigo com anexo em PDF", async () => {
    definirAtorDemo(TECNICO);
    const pdfNome = "manual_configuracao_vpn.pdf";
    const pdfBase64 = "data:application/pdf;base64,JVBERi0xLjQKJ...";
    const pdfTamanho = 102400; // 100 KB

    const novo = {
      titulo: "Manual Completo de Conexão à VPN Institucional",
      resumo: "Passo a passo com PDF anexo para instalação do cliente VPN corporativo.",
      conteudo: "Baixe o PDF anexo com as instruções de parametrização e autenticação multifator.",
      setor: "TI",
      categoria: "Rede",
      tags: ["vpn", "acesso remoto", "manual"],
      anexoPdfNome: pdfNome,
      anexoPdfTamanho: pdfTamanho,
      anexoPdfBase64: pdfBase64,
    };

    const criacao = await chamar<ArtigoBaseConhecimento>("POST", "/base-conhecimento", novo);
    expect([200, 201]).toContain(criacao.status);
    expect(criacao.corpo.data.anexoPdfNome).toBe(pdfNome);
    expect(criacao.corpo.data.anexoPdfTamanho).toBe(pdfTamanho);
    expect(criacao.corpo.data.anexoPdfBase64).toBe(pdfBase64);

    // Atualização do anexo
    const atualizacao = await chamar<ArtigoBaseConhecimento>(
      "PUT",
      `/base-conhecimento/${criacao.corpo.data.id}`,
      {
        anexoPdfNome: "manual_vpn_v2.pdf",
        anexoPdfTamanho: 150000,
      },
    );
    expect(atualizacao.status).toBe(200);
    expect(atualizacao.corpo.data.anexoPdfNome).toBe("manual_vpn_v2.pdf");
    expect(atualizacao.corpo.data.anexoPdfTamanho).toBe(150000);
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

describe("Domínios Institucionais e Domínio Padrão", () => {
  it("salva novos domínios e mantém o domínio padrão selecionado corretamente mesmo com @", async () => {
    definirAtorDemo(SUPER);

    const payload = {
      dominios: ["@instituto.gov.br", "@defensoria.mg.def.br", "@novo-orgao.gov.br"],
      padrao: "@novo-orgao.gov.br",
    };

    const resposta = await chamar<{ dominios: string[]; padrao: string }>(
      "PUT",
      "/configuracoes/dominios",
      payload,
    );

    expect(resposta.status).toBe(200);
    expect(resposta.corpo.data.dominios).toContain("novo-orgao.gov.br");
    expect(resposta.corpo.data.padrao).toBe("novo-orgao.gov.br");

    // Consulta subsequente (GET)
    const consulta = await chamar<{ dominios: string[]; padrao: string }>(
      "GET",
      "/configuracoes/dominios",
    );
    expect(consulta.status).toBe(200);
    expect(consulta.corpo.data.padrao).toBe("novo-orgao.gov.br");
    expect(consulta.corpo.data.dominios).toContain("novo-orgao.gov.br");
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

describe("Assinatura Institucional (Estilo Outlook)", () => {
  it("gera modelo institucional padronizado e aplica ao texto sem duplicação", async () => {
    const { gerarAssinaturaPadrao, aplicarAssinatura, temAssinaturaNoTexto, removerAssinatura } = await import("@/lib/assinatura");

    const modelo = gerarAssinaturaPadrao({
      nome: "Carlos Menezes",
      setor: "TI",
      email: "carlos@instituto.gov.br",
      telefone: "(31) 98765-4321",
    });

    expect(modelo).toContain("Atenciosamente,");
    expect(modelo).toContain("Carlos Menezes");
    expect(modelo).toContain("TI — Central de Atendimento");
    expect(modelo).toContain("carlos@instituto.gov.br · (31) 98765-4321");

    const textoOriginal = "Verifiquei o cabo de rede e reestabeleci o sinal.";
    const comAssinatura = aplicarAssinatura(textoOriginal, modelo);

    expect(comAssinatura).toContain(textoOriginal);
    expect(comAssinatura).toContain("--\n" + modelo);
    expect(temAssinaturaNoTexto(comAssinatura, modelo)).toBe(true);

    // Teste de idempotência (não duplica se já tiver)
    const idempotente = aplicarAssinatura(comAssinatura, modelo);
    expect(idempotente).toBe(comAssinatura);

    // Remoção da assinatura
    const removido = removerAssinatura(comAssinatura, modelo);
    expect(removido).toBe(textoOriginal);
  });

  it("permite ao usuário configurar sua assinatura e preferência no perfil", async () => {
    definirAtorDemo(TECNICO);

    const assinaturaNova = "Atenciosamente,\nTécnico Especialista\nSuporte N2";
    const res = await chamar<User>("PUT", `/usuarios/${TECNICO.id}`, {
      nome: TECNICO.nome,
      assinatura: assinaturaNova,
      incluirAssinaturaPadrao: true,
    });

    expect(res.status).toBe(200);
    expect(res.corpo.success).toBe(true);
    expect(res.corpo.data.assinatura).toBe(assinaturaNova);
    expect(res.corpo.data.incluirAssinaturaPadrao).toBe(true);
  });

  it("disponibiliza catálogo de assinaturas prontas e leitor de arquivos anexados", async () => {
    const { MODELOS_ASSINATURAS_PRONTAS, lerArquivoAssinaturaPronta } = await import("@/lib/assinatura");

    expect(MODELOS_ASSINATURAS_PRONTAS.length).toBeGreaterThanOrEqual(4);

    const dados = {
      nome: "Renata Souza",
      setor: "Protocolo",
      email: "renata@instituto.gov.br",
      telefone: "(31) 3333-4444",
    };

    // Gera cada um dos modelos prontos
    for (const mod of MODELOS_ASSINATURAS_PRONTAS) {
      const resultado = mod.gerar(dados);
      expect(resultado).toContain("Renata Souza");
      expect(resultado.length).toBeGreaterThan(20);
    }

    // Leitor de arquivo de assinatura de texto (.txt)
    const blobTxt = new Blob(["Atenciosamente,\nAssinatura do Arquivo de Texto"], { type: "text/plain" });
    const fileTxt = new File([blobTxt], "assinatura.txt", { type: "text/plain" });
    const resTxt = await lerArquivoAssinaturaPronta(fileTxt);
    expect(resTxt.tipo).toBe("texto");
    expect(resTxt.nome).toBe("assinatura.txt");
    expect(resTxt.conteudo).toContain("Assinatura do Arquivo de Texto");

    // Leitor de arquivo HTML (.html)
    const blobHtml = new Blob(["<p>Atenciosamente,<br/><strong>Assinatura em HTML</strong></p>"], { type: "text/html" });
    const fileHtml = new File([blobHtml], "assinatura.html", { type: "text/html" });
    const resHtml = await lerArquivoAssinaturaPronta(fileHtml);
    expect(resHtml.tipo).toBe("texto");
    expect(resHtml.conteudo).toContain("Assinatura em HTML");
    expect(resHtml.conteudo).not.toContain("<p>");

    // Leitor de arquivo de imagem gráfica (.png)
    const blobPng = new Blob(["fake-image-bytes"], { type: "image/png" });
    const filePng = new File([blobPng], "assinatura-grafica.png", { type: "image/png" });
    const resPng = await lerArquivoAssinaturaPronta(filePng);
    expect(resPng.tipo).toBe("imagem");
    expect(resPng.nome).toBe("assinatura-grafica.png");
    expect(resPng.conteudo.startsWith("data:")).toBe(true);

    // Persistência combinada e extração limpa de imagem de assinatura
    const { extrairTextoEImagemAssinatura, montarAssinaturaCompleta } = await import("@/lib/assinatura");
    const combinada = montarAssinaturaCompleta("Atenciosamente,\nRenata", resPng.conteudo);
    expect(combinada).toContain("Atenciosamente,\nRenata");
    expect(combinada).toContain("[ASSINATURA_IMAGEM:data:");

    const extraida = extrairTextoEImagemAssinatura(combinada);
    expect(extraida.texto).toBe("Atenciosamente,\nRenata");
    expect(extraida.imagem).toBe(resPng.conteudo);
  });
});
