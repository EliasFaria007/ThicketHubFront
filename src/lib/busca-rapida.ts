export interface ItemNavegacaoRapida {
  id: string;
  titulo: string;
  caminho: string;
  palavrasChave: string[];
  permissao?: string;
}

/**
 * Detecta se o evento de teclado corresponde ao atalho global de busca (Ctrl+K ou Cmd+K).
 */
export function ehAtalhoBuscaRapida(e: { key: string; ctrlKey?: boolean; metaKey?: boolean }): boolean {
  return Boolean((e.ctrlKey || e.metaKey) && e.key && e.key.toLowerCase() === "k");
}

/**
 * Monta o valor indexável para o componente cmdk contendo termos semânticos e identificadores.
 */
export function formatarValorItemBusca(
  protocolo: string,
  titulo: string,
  solicitante?: string,
  setor?: string,
): string {
  const termos = [protocolo, titulo, solicitante, setor].filter(Boolean).join(" ");
  return termos.toLowerCase();
}

/**
 * Filtra itens estáticos de navegação com base no termo digitado.
 */
export function filtrarItensNavegacao(
  termo: string,
  itens: ItemNavegacaoRapida[],
): ItemNavegacaoRapida[] {
  if (!termo || !termo.trim()) return itens;
  const termoLimpo = termo.trim().toLowerCase();

  return itens.filter((item) => {
    if (item.titulo.toLowerCase().includes(termoLimpo)) return true;
    if (item.caminho.toLowerCase().includes(termoLimpo)) return true;
    return item.palavrasChave.some((p) => p.toLowerCase().includes(termoLimpo));
  });
}
