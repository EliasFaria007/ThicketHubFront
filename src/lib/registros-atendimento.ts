export interface RegistroAtendimentoItem {
  id: string;
  data?: string;
  autor?: string;
  setor?: string;
  conteudo: string;
}

const ANEXOS_TAG_REGEX = /<!--\s*THICKET_ANEXOS:[\s\S]*?-->/g;

/**
 * Converte o campo oQueFoiFeito em uma lista estruturada de registros individuais,
 * garantindo separação visual clara e cronológica de cada atendimento.
 */
export function extrairRegistrosAtendimento(conteudo?: string | null): RegistroAtendimentoItem[] {
  if (!conteudo || !conteudo.trim()) return [];

  // Remove tag oculta de anexos antes de quebrar em registros
  const textoLimpo = conteudo.replace(ANEXOS_TAG_REGEX, "").trim();
  if (!textoLimpo) return [];

  // Divide pelo separador "---" ou delimitador de blocos
  const blocos = textoLimpo.split(/\n\s*---\s*\n/);
  const registros: RegistroAtendimentoItem[] = [];

  for (let i = 0; i < blocos.length; i++) {
    const bloco = blocos[i]?.trim();
    if (!bloco) continue;

    // Tenta casar cabeçalho: ### 📋 Registro de Atendimento — 25/10/2026, 16:30 · Nome (Setor)
    const matchCabecalho = bloco.match(
      /^###\s*📋\s*Registro de Atendimento\s*—\s*([^·\n]+)\s*·\s*([^\n]+)\n+([\s\S]*)$/i,
    );
    if (matchCabecalho) {
      const dataStr = (matchCabecalho[1] ?? "").trim();
      const autorSetor = (matchCabecalho[2] ?? "").trim();
      const corpo = (matchCabecalho[3] ?? "").trim();

      // Separa autor e setor (ex: "Administrador do Sistema (TI)")
      const matchSetor = autorSetor.match(/^(.*?)\s*\((.*?)\)$/);
      const autor = matchSetor ? (matchSetor[1] ?? autorSetor).trim() : autorSetor;
      const setor = matchSetor?.[2]?.trim();

      registros.push({
        id: `reg-${i}-${dataStr.replace(/\D/g, "")}`,
        data: dataStr,
        autor,
        ...(setor !== undefined ? { setor } : {}),
        conteudo: corpo,
      });
    } else {
      // Registro legado ou sem cabeçalho padrão
      registros.push({
        id: `reg-${i}`,
        conteudo: bloco,
      });
    }
  }

  return registros;
}
