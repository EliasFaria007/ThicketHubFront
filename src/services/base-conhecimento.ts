import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/http";
import type { ArtigoBaseConhecimento, FiltrosBaseConhecimento } from "@/types";

export interface NovoArtigoPayload {
  titulo: string;
  resumo: string;
  conteudo: string;
  setor: string;
  categoria?: string;
  tags?: string[];
  anexoPdfNome?: string;
  anexoPdfTamanho?: number;
  anexoPdfBase64?: string;
}

export interface AtualizarArtigoPayload {
  titulo?: string;
  resumo?: string;
  conteudo?: string;
  setor?: string;
  categoria?: string;
  tags?: string[];
  anexoPdfNome?: string | null;
  anexoPdfTamanho?: number | null;
  anexoPdfBase64?: string | null;
}

const ARTIGOS_PADRAO: ArtigoBaseConhecimento[] = [
  {
    id: "art-1",
    titulo: "Como redefinir sua senha de rede e e-mail institucional",
    slug: "como-redefinir-senha-de-rede",
    resumo: "Passo a passo rápido para alteração e recuperação de senha expirada no Active Directory.",
    conteudo: "1. Na tela de bloqueio do Windows (Ctrl+Alt+Del), selecione 'Alterar uma senha'.\n2. Digite sua senha antiga e defina a nova com pelo menos 8 caracteres.\n3. Se a senha já expirou, solicite o link de auto-recuperação por SMS.",
    setor: "TI",
    categoria: "Acessos e Contas",
    tags: ["senha", "active directory", "login", "bloqueio"],
    utilSim: 54,
    utilNao: 2,
    autorNome: "Administrador do Sistema",
    criadoEm: new Date(Date.now() - 30 * 86400000).toISOString(),
    atualizadoEm: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: "art-2",
    titulo: "Como mapear impressoras do setor no Windows 11",
    slug: "como-mapear-impressoras-windows-11",
    resumo: "Instruções para localizar e adicionar impressoras de rede departamentais.",
    conteudo: "1. Pressione Windows + R e digite '\\\\printserver\\'.\n2. Localize a impressora com a etiqueta do seu setor (ex: IMP-TI-01).\n3. Clique com o botão direito e selecione 'Conectar'.",
    setor: "TI",
    categoria: "Equipamentos e Impressão",
    tags: ["impressora", "rede", "windows 11", "impressao"],
    utilSim: 38,
    utilNao: 4,
    autorNome: "Administrador do Sistema",
    criadoEm: new Date(Date.now() - 20 * 86400000).toISOString(),
    atualizadoEm: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "art-3",
    titulo: "Configuração da VPN institucional para teletrabalho",
    slug: "configuracao-vpn-institucional",
    resumo: "Guia de instalação do cliente FortiClient/OpenVPN para acesso seguro aos sistemas.",
    conteudo: "1. Baixe o cliente VPN oficial no portal institucional.\n2. No campo 'Gateway Remoto', insira 'vpn.defensoria.mg.gov.br'.\n3. Conecte com suas credenciais de rede.",
    setor: "TI",
    categoria: "Redes e Infraestrutura",
    tags: ["vpn", "teletrabalho", "acesso remoto", "seguranca"],
    utilSim: 82,
    utilNao: 5,
    autorNome: "Administrador do Sistema",
    criadoEm: new Date(Date.now() - 45 * 86400000).toISOString(),
    atualizadoEm: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
];

export async function listarArtigos(filtros?: FiltrosBaseConhecimento): Promise<ArtigoBaseConhecimento[]> {
  try {
    const params: Record<string, string | undefined> = {};
    if (filtros?.busca) params["busca"] = filtros.busca;
    if (filtros?.setor) params["setor"] = filtros.setor;
    if (filtros?.categoria) params["categoria"] = filtros.categoria;

    const data = await apiGet<ArtigoBaseConhecimento[]>("/base-conhecimento", params);
    if (Array.isArray(data)) return data;
  } catch (err) {
    console.warn("[BASE CONHECIMENTO] Falha ao consultar back-end, usando dados locais:", err);
  }

  let lista = [...ARTIGOS_PADRAO];
  if (filtros?.setor) {
    lista = lista.filter((a) => a.setor.toLowerCase() === filtros.setor?.toLowerCase());
  }
  if (filtros?.categoria) {
    lista = lista.filter((a) => a.categoria.toLowerCase() === filtros.categoria?.toLowerCase());
  }
  if (filtros?.busca) {
    const b = filtros.busca.toLowerCase().trim();
    lista = lista.filter(
      (a) =>
        a.titulo.toLowerCase().includes(b) ||
        a.resumo.toLowerCase().includes(b) ||
        a.conteudo.toLowerCase().includes(b) ||
        a.tags.some((t) => t.toLowerCase().includes(b)),
    );
  }
  return lista;
}

export async function obterArtigo(id: string): Promise<ArtigoBaseConhecimento> {
  try {
    return await apiGet<ArtigoBaseConhecimento>(`/base-conhecimento/${id}`);
  } catch {
    const encontrado = ARTIGOS_PADRAO.find((a) => a.id === id || a.slug === id);
    if (encontrado) return encontrado;
    throw new Error("Artigo não encontrado");
  }
}

export async function criarArtigo(payload: NovoArtigoPayload): Promise<ArtigoBaseConhecimento> {
  try {
    return await apiPost<ArtigoBaseConhecimento>("/base-conhecimento", payload);
  } catch (err) {
    console.warn("[BASE CONHECIMENTO] Falha ao criar no back-end, criando localmente:", err);
    const novo: ArtigoBaseConhecimento = {
      id: `art-${Date.now()}`,
      titulo: payload.titulo,
      slug: payload.titulo.toLowerCase().replace(/\s+/g, "-"),
      resumo: payload.resumo,
      conteudo: payload.conteudo,
      setor: payload.setor,
      categoria: payload.categoria ?? "Geral",
      tags: payload.tags ?? [],
      utilSim: 0,
      utilNao: 0,
      autorNome: "Técnico Suporte",
      anexoPdfNome: payload.anexoPdfNome,
      anexoPdfTamanho: payload.anexoPdfTamanho,
      anexoPdfBase64: payload.anexoPdfBase64,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };
    ARTIGOS_PADRAO.unshift(novo);
    return novo;
  }
}

export async function atualizarArtigo(id: string, payload: AtualizarArtigoPayload): Promise<ArtigoBaseConhecimento> {
  try {
    return await apiPut<ArtigoBaseConhecimento>(`/base-conhecimento/${id}`, payload);
  } catch {
    const idx = ARTIGOS_PADRAO.findIndex((a) => a.id === id);
    const antigo = idx >= 0 ? ARTIGOS_PADRAO[idx] : undefined;
    if (antigo && idx >= 0) {
      const atualizado: ArtigoBaseConhecimento = {
        id: antigo.id,
        titulo: payload.titulo ?? antigo.titulo,
        slug: antigo.slug,
        resumo: payload.resumo ?? antigo.resumo,
        conteudo: payload.conteudo ?? antigo.conteudo,
        setor: payload.setor ?? antigo.setor,
        categoria: payload.categoria ?? antigo.categoria,
        tags: payload.tags ?? antigo.tags,
        utilSim: antigo.utilSim,
        utilNao: antigo.utilNao,
        autorNome: antigo.autorNome,
        anexoPdfNome: payload.anexoPdfNome !== undefined ? (payload.anexoPdfNome ?? undefined) : antigo.anexoPdfNome,
        anexoPdfTamanho: payload.anexoPdfTamanho !== undefined ? (payload.anexoPdfTamanho ?? undefined) : antigo.anexoPdfTamanho,
        anexoPdfBase64: payload.anexoPdfBase64 !== undefined ? (payload.anexoPdfBase64 ?? undefined) : antigo.anexoPdfBase64,
        criadoEm: antigo.criadoEm,
        atualizadoEm: new Date().toISOString(),
      };
      ARTIGOS_PADRAO[idx] = atualizado;
      return atualizado;
    }
    throw new Error("Artigo não encontrado para atualização");
  }
}

export async function removerArtigo(id: string): Promise<void> {
  try {
    await apiDelete(`/base-conhecimento/${id}`);
  } catch {
    const idx = ARTIGOS_PADRAO.findIndex((a) => a.id === id);
    if (idx >= 0) {
      ARTIGOS_PADRAO.splice(idx, 1);
    }
  }
}

export async function avaliarArtigo(id: string, util: boolean): Promise<{ utilSim: number; utilNao: number }> {
  try {
    return await apiPost<{ utilSim: number; utilNao: number }>(`/base-conhecimento/${id}/avaliar`, { util });
  } catch {
    const art = ARTIGOS_PADRAO.find((a) => a.id === id);
    if (art) {
      if (util) art.utilSim++;
      else art.utilNao++;
      return { utilSim: art.utilSim, utilNao: art.utilNao };
    }
    return { utilSim: 1, utilNao: 0 };
  }
}
