import { format, formatDistanceToNow, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function dataHora(iso: string): string {
  return format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function dataCurta(iso: string): string {
  return format(parseISO(iso), "dd/MM/yyyy", { locale: ptBR });
}

export function desdeAgora(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { locale: ptBR, addSuffix: true });
}

export function estaAtrasado(prazo: string | null): boolean {
  if (!prazo) return false;
  return isPast(parseISO(prazo));
}

export function tamanhoArquivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function iniciais(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}
