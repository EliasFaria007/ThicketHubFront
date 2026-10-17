import { format, formatDistanceToNow, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function dataHora(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = parseISO(iso);
    if (isNaN(d.getTime())) return "—";
    return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
}

export function dataCurta(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = parseISO(iso);
    if (isNaN(d.getTime())) return "—";
    return format(d, "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

export function desdeAgora(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = parseISO(iso);
    if (isNaN(d.getTime())) return "—";
    return formatDistanceToNow(d, { locale: ptBR, addSuffix: true });
  } catch {
    return "—";
  }
}

export function estaAtrasado(prazo?: string | null): boolean {
  if (!prazo) return false;
  try {
    const d = parseISO(prazo);
    if (isNaN(d.getTime())) return false;
    return isPast(d);
  } catch {
    return false;
  }
}

export function tamanhoArquivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function iniciais(nome?: string | null): string {
  if (!nome || typeof nome !== "string") return "?";
  const limpo = nome.trim();
  if (!limpo) return "?";
  return limpo
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}
