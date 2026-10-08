import type { Papel, PrioridadeChamado, StatusChamado } from "@/types";

export const STATUS_LABEL: Record<StatusChamado, string> = {
  aberto: "Aberto",
  em_atendimento: "Em atendimento",
  em_andamento: "Em andamento",
  aguardando: "Aguardando",
  pausado: "Pausado",
  resolvido: "Resolvido",
  concluido: "Concluído",
  fechado: "Fechado",
  cancelado: "Cancelado",
};

export const PRIORIDADE_LABEL: Record<PrioridadeChamado, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export const STATUS_OPCOES = Object.entries(STATUS_LABEL).map(([value, label]) => ({
  value: value as StatusChamado,
  label,
}));

export const PRIORIDADE_OPCOES = Object.entries(PRIORIDADE_LABEL).map(([value, label]) => ({
  value: value as PrioridadeChamado,
  label,
}));

export const SETORES = ["TI", "Recursos Humanos", "Financeiro", "Infraestrutura", "Protocolo"];

export const PAPEL_LABEL: Record<Papel, string> = {
  usuario: "Usuário",
  tecnico: "Técnico",
  admin: "Administrador",
  superusuario: "Superusuário",
  super: "Superusuário",
};

export const PAPEL_OPCOES = (Object.keys(PAPEL_LABEL) as Papel[]).map((value) => ({
  value,
  label: PAPEL_LABEL[value],
}));

/** Domínios de e-mail institucional autorizados a criar contas. */
export const DOMINIOS_PERMITIDOS = ["defensoria.mg.def.br", "instituto.gov.br"];

export function emailInstitucionalValido(email: string, dominiosValidos: string[] = DOMINIOS_PERMITIDOS): boolean {
  const partes = email.trim().toLowerCase().split("@");
  if (partes.length !== 2 || !partes[0]) return false;
  const dominio = partes[1] ?? "";
  return dominiosValidos.includes(dominio);
}

