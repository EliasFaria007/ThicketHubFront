/**
 * Normaliza texto vindo da API antes de renderizar.
 * O React já escapa conteúdo por padrão; aqui removemos marcações/protocolos
 * perigosos para o caso de o texto ser usado em atributos ou links.
 */
export function textoSeguro(valor: unknown, limite = 5000): string {
  if (typeof valor !== "string") return "";
  return valor
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .slice(0, limite);
}

export function urlSegura(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^(https?:|mailto:|\/|#)/i.test(url)) return url;
  return undefined;
}
