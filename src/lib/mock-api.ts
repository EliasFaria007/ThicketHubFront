/**
 * Adaptador de demonstração para o Axios.
 *
 * É usado APENAS quando VITE_API_BASE_URL não está configurada, para que a
 * interface possa ser executada e avaliada sem back-end. Ao apontar a variável
 * de ambiente para a API real, este arquivo deixa de ser utilizado.
 *
 * Aqui também vivem as regras de negócio simuladas: escopo por perfil, catálogo
 * de serviços, SLA com pausa, filas, encaminhamento e trilha de auditoria.
 */
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";

import { consumidoMs } from "./sla";
import type {
  Anexo,
  ApiResponse,
  ArtigoBaseConhecimento,
  Chamado,
  Comentario,
  ConfiguracaoEmail,
  ConfiguracaoLdap,
  HistoricoItem,
  Metricas,
  Notificacao,
  Relatorios,
  Paginacao,
  PrioridadeChamado,
  RegistroAuditoria,
  Servico,
  SlaConfig,
  StatusChamado,
  User,
} from "@/types";

const SETORES = ["TI", "Recursos Humanos", "Financeiro", "Infraestrutura", "Protocolo"];
const HORA_MS = 3_600_000;

function iso(diasAtras: number, horas = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + diasAtras);
  d.setHours(9 + horas, 15, 0, 0);
  return d.toISOString();
}

const codigosResetSms = new Map<string, { codigo: string; expiraEm: number }>();

let configDominios = {
  dominios: ["instituto.gov.br", "defensoria.mg.def.br"],
  padrao: "instituto.gov.br",
};

let configLdap: ConfiguracaoLdap = {
  ativo: true,
  servidor: "ldap://ad.instituto.gov.br",
  porta: 389,
  usarSsl: false,
  baseDn: "dc=instituto,dc=gov,dc=br",
  dominio: "INSTITUTO",
  usuarioBind: "cn=service_thickethub,ou=Services,dc=instituto,dc=gov,dc=br",
  filtroUsuario: "(&(objectClass=user)(sAMAccountName={0}))",
  grupoTecnico: "GG_TI_SUPORTE",
  grupoAdmin: "GG_TI_ADMINS",
  grupoSuper: "GG_TI_COORDENADORES",
  sincronizacaoAutomatica: true,
  intervaloMinutos: 60,
  ultimaSincronizacaoEm: iso(-1),
  totalUsuariosSincronizados: 142,
};

let configEmail: ConfiguracaoEmail = {
  ativo: true,
  servidorSmtp: "smtp.instituto.gov.br",
  portaSmtp: 587,
  usarTls: true,
  usuarioSmtp: "chamados@instituto.gov.br",
  remetenteNome: "Central de Chamados - TicketHub",
  remetenteEmail: "no-reply@instituto.gov.br",
  mailToTicketAtivo: true,
  servidorImap: "imap.instituto.gov.br",
  portaImap: 993,
  usuarioImap: "chamados@instituto.gov.br",
  setorPadrao: "TI",
};

let artigosBaseConhecimento: ArtigoBaseConhecimento[] = [
  {
    id: "art-1",
    titulo: "Como redefinir a senha do Windows e Rede",
    slug: "redefinir-senha-windows-rede",
    resumo: "Passo a passo rápido para desbloquear sua conta ou alterar sua senha do computador corporativo.",
    conteudo: `### Alterando a senha do Windows

1. No computador corporativo conectado à rede ou VPN, pressione **Ctrl + Alt + Del**.
2. Clique na opção **Alterar uma senha**.
3. Digite sua senha atual e, em seguida, a nova senha duas vezes para confirmação.
4. Pressione **Enter**.

> **Requisitos da senha institucional:**
> - Mínimo de 8 caracteres
> - Pelo menos uma letra maiúscula, uma minúscula e um número
> - Não utilize senhas já utilizadas anteriormente

Se a conta estiver bloqueada por tentativas incorretas, aguarde 15 minutos para desbloqueio automático ou abra um chamado para a TI com o protocolo do seu setor.`,
    setor: "TI",
    categoria: "Contas e Acessos",
    tags: ["senha", "windows", "login", "desbloqueio", "acesso"],
    utilSim: 48,
    utilNao: 2,
    autorNome: "Root Institucional",
    criadoEm: iso(-30),
    atualizadoEm: iso(-5),
  },
  {
    id: "art-2",
    titulo: "Configurar impressora de rede no computador",
    slug: "configurar-impressora-rede",
    resumo: "Instruções para localizar e adicionar as impressoras padrão do seu setor.",
    conteudo: `### Adicionando a impressora departamental

1. Abra o menu **Iniciar** e digite **Impressoras e Scanners**.
2. Clique em **Adicionar dispositivo**.
3. Aguarde a busca rápida. Caso sua impressora não apareça automaticamente:
   - Clique em *A impressora que eu desejo não está na lista*.
   - Selecione *Selecionar uma impressora compartilhada pelo nome*.
   - Digite o caminho do servidor de impressão: \`\\\\printserver\\IMPRESSORA-SETOR\`.
4. Clique em **Avançar** e conclua a instalação do driver.

Se o driver solicitar permissão de administrador, abra um chamado para o setor de TI informando o modelo e a etiqueta da impressora.`,
    setor: "TI",
    categoria: "Equipamentos",
    tags: ["impressora", "impressão", "driver", "rede", "papel"],
    utilSim: 35,
    utilNao: 1,
    autorNome: "Root Institucional",
    criadoEm: iso(-25),
    atualizadoEm: iso(-8),
  },
  {
    id: "art-3",
    titulo: "Acesso VPN institucional para trabalho remoto",
    slug: "acesso-vpn-trabalho-remoto",
    resumo: "Como conectar à VPN corporativa a partir de casa para acessar sistemas internos com segurança.",
    conteudo: `### Conexão VPN Segura

1. Abra o aplicativo **OpenVPN** ou cliente institucional instalado no notebook.
2. Selecione o perfil **VPN-Institucional**.
3. Insira suas credenciais de rede (mesmo usuário e senha do e-mail).
4. Confirme o código de verificação em duas etapas no celular se solicitado.
5. Quando o ícone ficar **Verde**, sua conexão estará estabelecida.

> **Importante:**
> Mantenha a VPN desconectada quando não estiver utilizando sistemas internos para economizar largura de banda do túnel institucional.`,
    setor: "TI",
    categoria: "Rede e Conectividade",
    tags: ["vpn", "remoto", "home office", "conexão", "segurança"],
    utilSim: 62,
    utilNao: 4,
    autorNome: "Root Institucional",
    criadoEm: iso(-45),
    atualizadoEm: iso(-12),
  },
  {
    id: "art-4",
    titulo: "Solicitação e substituição de toner de impressora",
    slug: "solicitacao-troca-toner",
    resumo: "Orientações sobre solicitação de suprimentos e descarte correto de toners vazios.",
    conteudo: `### Procedimento para troca de toner

1. Verifique a mensagem exibida no painel da impressora (ex: *Toner Preto Baixo* ou *Substituir Cartucho*).
2. O almoxarifado de cada prédio mantém 1 toner reserva de cada modelo ativo.
3. Abra a tampa frontal com cuidado e puxe a alavanca de trava do cartucho esgotado.
4. Retire o toner novo da embalagem, retire as fitas laranjas de proteção e agite suavemente na horizontal.
5. Encaixe o novo cartucho até ouvir o clique de trava e feche a tampa.

Coloque o cartucho usado dentro da caixa do novo para que a equipe de Infraestrutura recolha para reciclagem correta.`,
    setor: "Infraestrutura",
    categoria: "Suprimentos",
    tags: ["toner", "tinta", "impressora", "suprimentos", "infraestrutura"],
    utilSim: 29,
    utilNao: 0,
    autorNome: "Root Institucional",
    criadoEm: iso(-60),
    atualizadoEm: iso(-20),
  },
  {
    id: "art-5",
    titulo: "Erro de Certificado Digital nos navegadores",
    slug: "erro-certificado-digital-navegador",
    resumo: "Resolução para mensagens de certificado não reconhecido em portais do governo e PJe.",
    conteudo: `### Solução de problemas com Certificado (Token/Smartcard)

1. Verifique se a luz do leitor de cartão ou token USB está acesa.
2. Certifique-se de que o gerenciador criptográfico (SafeSign ou SafeNet) está aberto na barra de tarefas.
3. No navegador Google Chrome ou Edge:
   - Acesse **Configurações > Privacidade e Segurança > Segurança**.
   - Clique em **Gerenciar Certificados**.
   - Verifique se seu certificado pessoal está listado na aba **Pessoal**.
4. Se o certificado estiver expirado, contate a Autoridade Certificadora ou abra chamado para renovação.`,
    setor: "TI",
    categoria: "Certificados e Segurança",
    tags: ["certificado", "token", "token usb", "pje", "assinatura"],
    utilSim: 41,
    utilNao: 3,
    autorNome: "Root Institucional",
    criadoEm: iso(-40),
    atualizadoEm: iso(-10),
  },
];


const usuarios: User[] = [
  {
    id: "u0",
    nome: "Root Institucional",
    email: "super@instituto.gov.br",
    telefone: "(31) 99999-0000",
    localidade: "Sede Principal - 4º Andar",
    papel: "superusuario",
    setor: "TI",
    setoresLiberados: SETORES,
    podeCadastrarUsuarios: true,
    ativo: true,
    criadoEm: iso(-400),
    termosAceitosEm: iso(-399),
    termosVersao: "1.0",
    primeiroAcessoConcluido: true,
  },
  {
    id: "u1",
    nome: "Ana Ribeiro",
    email: "admin@instituto.gov.br",
    telefone: "(31) 98888-1111",
    localidade: "Sede Principal - 3º Andar (Gabinete)",
    papel: "admin",
    setor: "TI",
    setoresLiberados: SETORES,
    podeCadastrarUsuarios: true,
    ativo: true,
    criadoEm: iso(-320),
    termosAceitosEm: iso(-319),
    termosVersao: "1.0",
    primeiroAcessoConcluido: true,
  },
  {
    id: "u2",
    nome: "Carlos Menezes",
    email: "tecnico@instituto.gov.br",
    telefone: "(31) 97777-2222",
    localidade: "Sede Principal - Térreo (Suporte TI)",
    papel: "tecnico",
    setor: "TI",
    setoresLiberados: ["TI", "Protocolo"],
    podeCadastrarUsuarios: false,
    ativo: true,
    criadoEm: iso(-280),
    termosAceitosEm: iso(-279),
    termosVersao: "1.0",
    primeiroAcessoConcluido: true,
  },
  {
    id: "u3",
    nome: "Beatriz Lima",
    email: "usuario@instituto.gov.br",
    telefone: "(31) 96666-3333",
    localidade: "Bloco Administrativo - 2º Andar",
    papel: "usuario",
    setor: "Recursos Humanos",
    setoresLiberados: [],
    podeCadastrarUsuarios: false,
    ativo: true,
    criadoEm: iso(-210),
    termosAceitosEm: null,
    termosVersao: null,
    primeiroAcessoConcluido: false,
  },
  {
    id: "u4",
    nome: "Diego Fontes",
    email: "diego.fontes@instituto.gov.br",
    telefone: "(31) 95555-4444",
    localidade: "Prédio Anexo - Sala 102",
    papel: "tecnico",
    setor: "Infraestrutura",
    setoresLiberados: ["Infraestrutura"],
    podeCadastrarUsuarios: true,
    ativo: true,
    criadoEm: iso(-190),
    termosAceitosEm: iso(-189),
    termosVersao: "1.0",
    primeiroAcessoConcluido: true,
  },
  {
    id: "u5",
    nome: "Helena Prado",
    email: "helena.prado@instituto.gov.br",
    telefone: "(31) 94444-5555",
    localidade: "Sede Principal - 1º Andar",
    papel: "usuario",
    setor: "Financeiro",
    setoresLiberados: [],
    podeCadastrarUsuarios: false,
    ativo: false,
    criadoEm: iso(-120),
    termosAceitosEm: null,
    termosVersao: null,
    primeiroAcessoConcluido: false,
  },
];

let slaConfig: SlaConfig = {
  critica: { atendimentoHoras: 1, resolucaoHoras: 8 },
  alta: { atendimentoHoras: 4, resolucaoHoras: 24 },
  media: { atendimentoHoras: 8, resolucaoHoras: 72 },
  baixa: { atendimentoHoras: 24, resolucaoHoras: 120 },
};

let servicos: Servico[] = [
  { id: "s1", nome: "Troca de senha", setor: "TI", prioridade: "baixa", slaAtendimentoHoras: 24, slaResolucaoHoras: 120, ativo: true },
  { id: "s2", nome: "Impressora não funciona", setor: "TI", prioridade: "media", slaAtendimentoHoras: 8, slaResolucaoHoras: 72, ativo: true },
  { id: "s3", nome: "Sem acesso à internet", setor: "Infraestrutura", prioridade: "alta", slaAtendimentoHoras: 4, slaResolucaoHoras: 24, ativo: true },
  { id: "s4", nome: "Sistema institucional indisponível", setor: "TI", prioridade: "critica", slaAtendimentoHoras: 1, slaResolucaoHoras: 8, ativo: true },
  { id: "s5", nome: "Erro no contracheque", setor: "Recursos Humanos", prioridade: "media", slaAtendimentoHoras: 8, slaResolucaoHoras: 72, ativo: true },
  { id: "s6", nome: "Reembolso de diária", setor: "Financeiro", prioridade: "baixa", slaAtendimentoHoras: 24, slaResolucaoHoras: 120, ativo: true },
  { id: "s7", nome: "Protocolo de documento físico", setor: "Protocolo", prioridade: "media", slaAtendimentoHoras: 8, slaResolucaoHoras: 72, ativo: true },
];

const TITULOS = [
  "Não consigo acessar o sistema de protocolo",
  "Impressora do 3º andar sem resposta",
  "Solicitação de novo ramal telefônico",
  "Wi-Fi instável na sala de reuniões",
  "Erro ao emitir contracheque",
  "Computador reiniciando sozinho",
  "Liberação de acesso à pasta compartilhada",
  "Instalação de certificado digital",
  "Monitor com falha de imagem",
  "Reembolso de diária não processado",
  "Cadastro de novo servidor no sistema",
  "Lentidão no sistema de almoxarifado",
];

const STATUSES: StatusChamado[] = ["aguardando", "em_andamento", "pausado", "resolvido", "cancelado"];

let sequenciaProtocolo = 120;

function protocolo(): string {
  sequenciaProtocolo += 1;
  return `CH-${new Date().getFullYear()}-${String(sequenciaProtocolo).padStart(6, "0")}`;
}

let chamados: Chamado[] = Array.from({ length: 26 }, (_, i) => {
  const status = STATUSES[i % 5]!;
  const servico = servicos[i % servicos.length]!;
  const solicitante = usuarios[i % 2 === 0 ? 3 : 5]!;
  const tecnico = i % 3 === 0 ? null : usuarios[i % 2 === 0 ? 2 : 4]!;
  const criadoEm = iso(-(i + 1), i % 6);
  const rodando = status === "em_andamento";
  const id = String(i + 1);
  return {
    id,
    protocolo: protocolo(),
    titulo: TITULOS[i % TITULOS.length]!,
    descricao:
      "Ao tentar realizar a operação, o sistema apresenta mensagem de falha e não conclui o processo. O problema ocorre desde o início do turno e afeta o atendimento ao público.",
    status,
    prioridade: servico.prioridade,
    setor: servico.setor,
    servicoId: servico.id,
    servicoNome: servico.nome,
    solicitante: { id: solicitante.id, nome: solicitante.nome, email: solicitante.email },
    tecnico: tecnico ? { id: tecnico.id, nome: tecnico.nome } : null,
    filaSetor: tecnico ? null : servico.setor,
    criadoEm,
    atualizadoEm: iso(-i, 2),
    versao: 1,
    slaAtendimentoHoras: servico.slaAtendimentoHoras,
    slaResolucaoHoras: servico.slaResolucaoHoras,
    slaConsumidoMs: (i % 9) * 3 * HORA_MS,
    slaRodandoDesde: rodando ? iso(-1, 1) : null,
    primeiraRespostaEm: tecnico ? iso(-(i + 1), 3) : null,
    oQueFoiFeito: status === "resolvido" ? "Atendimento realizado remotamente e serviço normalizado." : null,
    resolvidoEm: status === "resolvido" ? iso(-i, 3) : null,
    motivoReabertura: null,
    avaliacao: status === "resolvido" && i % 2 === 0 ? 4 : null,
    relacionados: [],
    duplicadoDe: null,
    comentarios: [
      {
        id: `${id}-cm1`,
        chamadoId: id,
        autor: { id: solicitante.id, nome: solicitante.nome, papel: solicitante.papel },
        mensagem: "Bom dia! Segue o detalhamento solicitado para análise da equipe.",
        criadoEm: iso(-(i + 1), 1),
        interno: false,
      },
    ],
    historico: [
      { id: `${id}-h1`, tipo: "criacao", descricao: "Chamado registrado", autorNome: solicitante.nome, criadoEm },
    ],
    anexos: i % 4 === 0 ? [{ id: `${i}-a1`, nome: "print-erro.png", tamanho: 184320, url: "#" }] : [],
  } satisfies Chamado;
});

let auditoria: RegistroAuditoria[] = chamados.slice(0, 8).map((c, i) => ({
  id: `a${i}`,
  acao: "chamado.criado",
  detalhe: `Chamado ${c.protocolo} registrado`,
  usuarioId: String(c.solicitante.id),
  usuarioNome: c.solicitante.nome,
  ip: "10.20.30.40",
  criadoEm: c.criadoEm,
}));

/** Usuário autenticado na demonstração (definido pelo store de auth). */
let ator: User | null = null;
export function definirAtorDemo(user: User | null) {
  ator = user ? (usuarios.find((u) => u.id === user.id) ?? user) : null;
}

function atorAtual(): User {
  return ator ?? usuarios[3]!;
}

function ehSuper(u: User) {
  return u.papel === "superusuario";
}

function registrarAuditoria(acao: string, detalhe: string, usuario = atorAtual()) {
  auditoria = [
    {
      id: `a${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      acao,
      detalhe,
      usuarioId: String(usuario.id),
      usuarioNome: usuario.nome,
      ip: "10.20.30.40",
      criadoEm: new Date().toISOString(),
    },
    ...auditoria,
  ];
}

let notificacoes: Notificacao[] = [];

/**
 * Gera notificações internas apenas para quem realmente enxerga o chamado
 * (solicitante, técnico responsável e perfis com a fila liberada). O autor da
 * ação não é notificado. Chamados fora das filas liberadas nunca geram
 * notificação para o perfil.
 */
function notificar(chamado: Chamado, evento: Notificacao["evento"], titulo: string) {
  const autorId = String(atorAtual().id);
  const destinatarios = new Set<string>([String(chamado.solicitante.id)]);
  if (chamado.tecnico) destinatarios.add(String(chamado.tecnico.id));
  for (const u of usuarios) {
    if (u.ativo && visivelPara(chamado, u)) destinatarios.add(String(u.id));
  }
  destinatarios.delete(autorId);

  const criadoEm = new Date().toISOString();
  const novas = [...destinatarios].map((usuarioId, i) => ({
    id: `n${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
    usuarioId,
    chamadoId: chamado.id,
    protocolo: chamado.protocolo,
    evento,
    titulo,
    lida: false,
    criadoEm,
  }));
  notificacoes = [...novas, ...notificacoes].slice(0, 400);
}

function historico(chamado: Chamado, tipo: HistoricoItem["tipo"], descricao: string, autorNome = atorAtual().nome) {
  const item: HistoricoItem = {
    id: `${chamado.id}-h${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    tipo,
    descricao,
    autorNome,
    criadoEm: new Date().toISOString(),
  };
  chamado.historico = [...(chamado.historico ?? []), item];
}


/** Aplica a regra de pausa: cronômetro roda apenas em "em_andamento". */
function sincronizarSla(chamado: Chamado, novoStatus: StatusChamado = chamado.status) {
  const agora = Date.now();
  const deveRodar = novoStatus === "em_andamento";
  if (chamado.slaRodandoDesde && !deveRodar) {
    chamado.slaConsumidoMs = consumidoMs(chamado, agora);
    chamado.slaRodandoDesde = null;
  } else if (!chamado.slaRodandoDesde && deveRodar) {
    chamado.slaRodandoDesde = new Date(agora).toISOString();
  }
}

/** Retoma a contagem quando há nova interação em chamado pausado/aguardando. */
function registrarInteracao(chamado: Chamado) {
  chamado.atualizadoEm = new Date().toISOString();
  chamado.versao += 1;
}

/**
 * Visibilidade de chamados por perfil.
 * - usuario: apenas os chamados abertos por ele (não participa de filas).
 * - tecnico/admin: apenas chamados das filas liberadas; chamados já puxados por
 *   outro técnico saem da fila e ficam invisíveis para os demais.
 * - superusuario: acesso irrestrito.
 */
function visivelPara(chamado: Chamado, u: User): boolean {
  if (ehSuper(u)) return true;
  if (chamado.solicitante.id === u.id) return true;
  if (u.papel === "tecnico" || u.papel === "admin") {
    if (!u.setoresLiberados.includes(chamado.setor)) return false;
    // Chamado assumido pertence à fila do responsável.
    return chamado.tecnico === null || chamado.tecnico.id === u.id;
  }
  return false;
}

/** Setores (filas) que o perfil pode enxergar em painéis e filtros. */
function setoresDoAtor(u: User): string[] {
  if (ehSuper(u)) return SETORES;
  if (u.papel === "tecnico" || u.papel === "admin") {
    return SETORES.filter((s) => u.setoresLiberados.includes(s));
  }
  return [];
}


const TOKEN_DEMO = "demo-access-token";
const REFRESH_DEMO = "demo-refresh-token";

function ok<T>(data: T, message: string | null = null): ApiResponse<T> {
  return { success: true, data, message, errors: null };
}

function erro(status: number, message: string, errors: string[] = []) {
  return { status, body: { success: false, data: null, message, errors } };
}

function paginar<T>(items: T[], page: number, limit: number): Paginacao<T> {
  const total = items.length;
  const inicio = (page - 1) * limit;
  return {
    items: items.slice(inicio, inicio + limit),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

function metricas(): Metricas {
  const u = atorAtual();
  const escopo = chamados.filter((c) => visivelPara(c, u));
  const resolvidos = escopo.filter((c) => c.status === "resolvido").length;
  const fechados = escopo.filter((c) => c.status === "fechado" || c.status === "concluido").length;
  const cancelados = escopo.filter((c) => c.status === "cancelado").length;
  const pausados = escopo.filter((c) => c.status === "pausado").length;
  const abertos = escopo.filter((c) => c.status === "aberto" || c.status === "aguardando").length;
  const emAndamento = escopo.filter((c) => c.status === "em_atendimento" || c.status === "em_andamento").length;
  const total = escopo.length;
  const slaAtendidos = escopo.filter((c) => consumidoMs(c) <= c.slaAtendimentoHoras * HORA_MS).length;
  return {
    totalChamados: total,
    abertos,
    emAndamento,
    resolvidos,
    fechados,
    cancelados,
    pausados,
    totalUsuarios: usuarios.filter((u2) => u2.papel === "usuario" && u2.ativo).length,
    totalTecnicos: usuarios.filter((u2) => u2.papel === "tecnico" && u2.ativo).length,
    totalAdmins: usuarios.filter((u2) => (u2.papel === "admin" || u2.papel === "superusuario") && u2.ativo).length,
    percentualSlaAtendido: total > 0 ? Math.round((slaAtendidos / total) * 100) : 100,
    atrasados: escopo.filter(
      (c) =>
        c.status !== "resolvido" &&
        c.status !== "cancelado" &&
        c.status !== "fechado" &&
        consumidoMs(c) > c.slaResolucaoHoras * HORA_MS,
    ).length,
    porStatus: STATUSES.map((status) => ({ status, total: escopo.filter((c) => c.status === status).length })),
    porSetor: (() => {
      const base = setoresDoAtor(u);
      const setores = base.length > 0 ? base : [...new Set(escopo.map((c) => c.setor))];
      return setores
        .map((setor) => ({ setor, total: escopo.filter((c) => c.setor === setor).length }))
        .filter((linha) => linha.total > 0);
    })(),
    ultimos7Dias: Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dia = d.toISOString().slice(0, 10);
      return { dia, total: escopo.filter((c) => c.criadoEm.slice(0, 10) === dia).length };
    }),
  };
}

function horas(ms: number) {
  return Math.round((ms / HORA_MS) * 10) / 10;
}

/** Relatórios detalhados (admin/superusuário), com filtros por período e escopo. */
function relatorios(query: URLSearchParams): Relatorios {
  const de = query.get("de");
  const ate = query.get("ate");
  const setor = query.get("setor");
  const status = query.get("status");
  const prioridade = query.get("prioridade");
  const tecnicoId = query.get("tecnicoId");
  const servicoId = query.get("servicoId");

  const relator = atorAtual();
  const escopo = chamados.filter((c) => {
    // Relatórios respeitam a liberação de filas do perfil.
    if (!visivelPara(c, relator)) return false;
    const dia = c.criadoEm.slice(0, 10);
    if (de && dia < de) return false;

    if (ate && dia > ate) return false;
    if (setor && c.setor !== setor) return false;
    if (status && c.status !== status) return false;
    if (prioridade && c.prioridade !== prioridade) return false;
    if (tecnicoId && c.tecnico?.id !== tecnicoId) return false;
    if (servicoId && c.servicoId !== servicoId) return false;
    return true;
  });

  const atrasado = (c: Chamado) =>
    c.status !== "cancelado" && consumidoMs(c) > c.slaResolucaoHoras * HORA_MS;
  const cumpriuSla = (c: Chamado) => c.status === "resolvido" && !atrasado(c);

  const resolvidos = escopo.filter((c) => c.status === "resolvido");
  const temposResolucao = resolvidos
    .filter((c) => c.resolvidoEm)
    .map((c) => new Date(c.resolvidoEm!).getTime() - new Date(c.criadoEm).getTime());
  const temposAtendimento = escopo
    .filter((c) => c.primeiraRespostaEm)
    .map((c) => new Date(c.primeiraRespostaEm!).getTime() - new Date(c.criadoEm).getTime());
  const media = (lista: number[]) => (lista.length ? lista.reduce((a, b) => a + b, 0) / lista.length : 0);

  const avaliados = escopo.filter((c) => typeof c.avaliacao === "number");

  return {
    totalChamados: escopo.length,
    porSetor: SETORES.map((s) => {
      const lista = escopo.filter((c) => c.setor === s);
      return {
        chave: s,
        total: lista.length,
        resolvidos: lista.filter((c) => c.status === "resolvido").length,
        atrasados: lista.filter((c) => c.status !== "resolvido" && atrasado(c)).length,
      };
    }).filter((linha) => linha.total > 0),
    porStatus: STATUSES.map((s) => ({ chave: s, total: escopo.filter((c) => c.status === s).length })),
    porPrioridade: (["critica", "alta", "media", "baixa"] as PrioridadeChamado[]).map((p) => {
      const lista = escopo.filter((c) => c.prioridade === p);
      const fechados = lista.filter((c) => c.status === "resolvido");
      return {
        chave: p,
        total: lista.length,
        slaCumprido: fechados.filter(cumpriuSla).length,
        slaTotal: fechados.length,
      };
    }),
    porServico: servicos
      .map((s) => ({ chave: s.nome, total: escopo.filter((c) => c.servicoId === s.id).length }))
      .filter((linha) => linha.total > 0),
    tecnicos: usuarios
      .filter((t) => t.papel === "tecnico" || t.papel === "admin")
      .map((t) => {
        const lista = escopo.filter((c) => c.tecnico?.id === t.id);
        const fechados = lista.filter((c) => c.status === "resolvido" && c.resolvidoEm);
        return {
          chave: t.nome,
          atendidos: fechados.length,
          emAberto: lista.filter((c) => c.status !== "resolvido" && c.status !== "cancelado").length,
          tempoMedioResolucaoHoras: horas(
            media(fechados.map((c) => new Date(c.resolvidoEm!).getTime() - new Date(c.criadoEm).getTime())),
          ),
          slaCumprido: fechados.filter(cumpriuSla).length,
          slaTotal: fechados.length,
        };
      })
      .filter((linha) => linha.atendidos + linha.emAberto > 0),
    periodo: {
      resolvidos: resolvidos.length,
      cancelados: escopo.filter((c) => c.status === "cancelado").length,
      reabertos: escopo.filter((c) => Boolean(c.motivoReabertura)).length,
    },
    tempos: {
      medioAtendimentoHoras: horas(media(temposAtendimento)),
      medioResolucaoHoras: horas(media(temposResolucao)),
    },
    usuarios: { cadastrados: usuarios.length, ativos: usuarios.filter((u) => u.ativo).length },
    satisfacao: {
      media: avaliados.length
        ? Math.round((media(avaliados.map((c) => c.avaliacao ?? 0)) + Number.EPSILON) * 10) / 10
        : 0,
      avaliacoes: avaliados.length,
      distribuicao: [1, 2, 3, 4, 5].map((nota) => ({
        nota,
        total: avaliados.filter((c) => c.avaliacao === nota).length,
      })),
    },
    encaminhamentos: escopo.flatMap((c) =>
      (c.historico ?? [])
        .filter((h) => h.tipo === "encaminhamento")
        .map((h) => ({ protocolo: c.protocolo, descricao: h.descricao, autorNome: h.autorNome, criadoEm: h.criadoEm })),
    ),
  };
}

interface Rota {
  metodo: string;
  padrao: RegExp;
  responder: (ctx: {
    params: string[];
    body: Record<string, unknown>;
    query: URLSearchParams;
  }) => ApiResponse<unknown> | { status: number; body: ApiResponse<unknown> };
}

const rotas: Rota[] = [
  {
    metodo: "POST",
    padrao: /^\/auth\/login$/,
    responder: ({ body }) => {
      const email = String(body["email"] ?? "").toLowerCase();
      const senha = String(body["password"] ?? "");
      const user = usuarios.find((u) => u.email.toLowerCase() === email && u.ativo);
      if (!user || senha.length < 6) {
        return erro(401, "E-mail ou senha inválidos.", [
          "Confira suas credenciais institucionais e tente novamente.",
        ]);
      }
      registrarAuditoria("auth.login", `Login realizado por ${user.nome}`, user);
      return ok({ token: TOKEN_DEMO, refreshToken: REFRESH_DEMO, user });
    },
  },
  {
    metodo: "POST",
    padrao: /^\/auth\/refresh$/,
    responder: () => ok({ token: TOKEN_DEMO, refreshToken: REFRESH_DEMO }),
  },
  {
    metodo: "POST",
    padrao: /^\/auth\/termos$/,
    responder: ({ body }) => {
      const u = usuarios.find((x) => x.id === atorAtual().id);
      if (!u) return erro(404, "Usuário não encontrado.");
      u.termosAceitosEm = new Date().toISOString();
      u.termosVersao = String(body["versao"] ?? "1.0");
      registrarAuditoria("termos.aceite", `Aceite dos termos versão ${u.termosVersao}`, u);
      return ok(u, "Termos aceitos.");
    },
  },
  {
    metodo: "POST",
    padrao: /^\/auth\/solicitar-reset-sms$/,
    responder: ({ body }) => {
      const email = String(body["email"] ?? "").toLowerCase().trim();
      const user = usuarios.find((u) => u.email.toLowerCase() === email && u.ativo);
      if (!user) {
        return erro(404, "Usuário não localizado com o e-mail institucional informado.", [
          "Verifique se o e-mail foi digitado corretamente ou contate o administrador.",
        ]);
      }
      const tel = user.telefone || "(31) 98888-0000";
      const digitos = tel.replace(/\D/g, "");
      const ddd = digitos.slice(0, 2) || "31";
      const final = digitos.slice(-4) || "0000";
      const mascarado = `(${ddd}) 9****-${final}`;

      const codigoSms = "123456";
      codigosResetSms.set(email, { codigo: codigoSms, expiraEm: Date.now() + 10 * 60 * 1000 });

      registrarAuditoria("auth.solicitar_reset_sms", `SMS de recuperação solicitado para ${user.email}`, user);
      return ok(
        {
          telefoneMascarado: mascarado,
          codigoDemo: codigoSms,
        },
        "Código SMS de verificação enviado com sucesso.",
      );
    },
  },
  {
    metodo: "POST",
    padrao: /^\/auth\/confirmar-reset-sms$/,
    responder: ({ body }) => {
      const email = String(body["email"] ?? "").toLowerCase().trim();
      const codigo = String(body["codigo"] ?? "").trim();
      const novaSenha = String(body["novaSenha"] ?? "");

      const user = usuarios.find((u) => u.email.toLowerCase() === email && u.ativo);
      if (!user) return erro(404, "Usuário não encontrado.");

      const registro = codigosResetSms.get(email);
      if (!registro || registro.codigo !== codigo) {
        return erro(400, "Código de verificação SMS inválido ou expirado.");
      }
      if (novaSenha.length < 6) {
        return erro(422, "A nova senha deve ter no mínimo 6 caracteres.");
      }

      codigosResetSms.delete(email);
      registrarAuditoria("auth.senha_resetada_sms", `Senha redefinida com sucesso via SMS para ${user.nome}`, user);
      return ok({ mensagem: "Senha redefinida com sucesso!" }, "Senha redefinida com sucesso.");
    },
  },
  {
    metodo: "POST",
    padrao: /^\/auth\/completar-cadastro$/,
    responder: ({ body }) => {
      const u = usuarios.find((x) => x.id === atorAtual().id);
      if (!u) return erro(404, "Usuário não encontrado.");

      const telefone = String(body["telefone"] ?? "").trim();
      const localidade = String(body["localidade"] ?? "").trim();

      if (!telefone || telefone.length < 10) {
        return erro(422, "Informe um telefone celular válido com DDD.");
      }
      if (!localidade || localidade.length < 3) {
        return erro(422, "Informe sua localidade ou lotação física de trabalho.");
      }

      u.telefone = telefone;
      u.localidade = localidade;
      u.primeiroAcessoConcluido = true;

      if (ator?.id === u.id) ator = u;

      registrarAuditoria(
        "auth.cadastro_completado",
        `Cadastro completado: tel ${u.telefone}, local ${u.localidade}`,
        u,
      );
      return ok(u, "Cadastro institucional atualizado com sucesso.");
    },
  },
  {
    metodo: "POST",
    padrao: /^\/auth\/alterar-senha$/,
    responder: ({ body }) => {
      const u = usuarios.find((x) => x.id === atorAtual().id);
      if (!u) return erro(404, "Usuário não encontrado.");
      const senhaAtual = String(body["senhaAtual"] ?? "");
      const novaSenha = String(body["novaSenha"] ?? "");
      if (senhaAtual.length < 6) return erro(400, "Senha atual incorreta.");
      if (novaSenha.length < 6) return erro(422, "A nova senha deve ter no mínimo 6 caracteres.");

      registrarAuditoria("auth.senha_alterada", `Senha alterada pelo próprio usuário ${u.nome}`, u);
      return ok({ mensagem: "Senha alterada com sucesso." }, "Senha alterada com sucesso.");
    },
  },

  // Catálogo de serviços
  {
    metodo: "GET",
    padrao: /^\/servicos$/,
    responder: ({ query }) => {
      const incluirInativos = query.get("incluirInativos") === "true" && ehSuper(atorAtual());
      return ok(servicos.filter((s) => incluirInativos || s.ativo));
    },
  },
  {
    metodo: "POST",
    padrao: /^\/servicos$/,
    responder: ({ body }) => {
      if (!ehSuper(atorAtual())) return erro(403, "Apenas o superusuário gerencia o catálogo de serviços.");
      const prioridade = (body["prioridade"] as PrioridadeChamado) ?? "media";
      const novo: Servico = {
        id: `s${Date.now()}`,
        nome: String(body["nome"] ?? ""),
        setor: String(body["setor"] ?? SETORES[0]),
        prioridade,
        slaAtendimentoHoras: Number(body["slaAtendimentoHoras"] ?? slaConfig[prioridade].atendimentoHoras),
        slaResolucaoHoras: Number(body["slaResolucaoHoras"] ?? slaConfig[prioridade].resolucaoHoras),
        ativo: true,
      };
      servicos = [...servicos, novo];
      registrarAuditoria("catalogo.criado", `Serviço "${novo.nome}" criado`);
      return ok(novo, "Serviço adicionado ao catálogo.");
    },
  },
  {
    metodo: "PUT",
    padrao: /^\/servicos\/([\w-]+)$/,
    responder: ({ params, body }) => {
      if (!ehSuper(atorAtual())) return erro(403, "Apenas o superusuário gerencia o catálogo de serviços.");
      const servico = servicos.find((s) => s.id === params[0]);
      if (!servico) return erro(404, "Serviço não encontrado.");
      if (typeof body["nome"] === "string") servico.nome = body["nome"];
      if (typeof body["setor"] === "string") servico.setor = body["setor"];
      if (typeof body["prioridade"] === "string") servico.prioridade = body["prioridade"] as PrioridadeChamado;
      if (body["slaAtendimentoHoras"] !== undefined) servico.slaAtendimentoHoras = Number(body["slaAtendimentoHoras"]);
      if (body["slaResolucaoHoras"] !== undefined) servico.slaResolucaoHoras = Number(body["slaResolucaoHoras"]);
      if (typeof body["ativo"] === "boolean") servico.ativo = body["ativo"];
      registrarAuditoria("catalogo.editado", `Serviço "${servico.nome}" atualizado`);
      return ok(servico, "Serviço atualizado.");
    },
  },

  // SLA por prioridade
  { metodo: "GET", padrao: /^\/sla$/, responder: () => ok(slaConfig) },
  {
    metodo: "PUT",
    padrao: /^\/sla$/,
    responder: ({ body }) => {
      if (!ehSuper(atorAtual())) return erro(403, "A configuração de SLA é exclusiva do superusuário.");
      slaConfig = { ...slaConfig, ...(body as Partial<SlaConfig>) } as SlaConfig;
      registrarAuditoria("sla.configurado", "Parâmetros de SLA por prioridade atualizados");
      return ok(slaConfig, "SLA atualizado.");
    },
  },

  // Auditoria
  {
    metodo: "GET",
    padrao: /^\/auditoria$/,
    responder: ({ query }) => {
      const u = atorAtual();
      if (u.papel !== "admin" && !ehSuper(u) && u.papel !== "tecnico") {
        return erro(403, "Acesso restrito à equipe técnica e administração.");
      }
      const q = (query.get("q") ?? "").toLowerCase();
      let lista = auditoria.filter((r) => `${r.acao} ${r.detalhe} ${r.usuarioNome}`.toLowerCase().includes(q));
      if (u.papel === "tecnico") {
        lista = lista.filter((r) => r.usuarioId === u.id);
      }
      const page = Number(query.get("page") ?? 1) || 1;
      return ok(paginar(lista, page, Number(query.get("limit") ?? 15) || 15));
    },
  },

  { metodo: "GET", padrao: /^\/chamados\/metricas$/, responder: () => ok(metricas()) },
  {
    metodo: "GET",
    padrao: /^\/chamados$/,
    responder: ({ query }) => {
      const u = atorAtual();
      const status = query.get("status");
      const prioridade = query.get("prioridade");
      const setor = query.get("setor");
      const servicoId = query.get("servicoId");
      const fila = query.get("fila");
      const q = (query.get("q") ?? "").toLowerCase().trim();
      const ordenarPor = query.get("ordenarPor") ?? "criadoEm";
      const ordem = query.get("ordem") ?? "desc";

      let lista = chamados.filter((c) => {
        if (!visivelPara(c, u)) return false;
        if (fila === "geral" && (c.tecnico !== null || ["resolvido", "fechado", "concluido", "cancelado"].includes(c.status))) return false;
        if (fila === "minha" && (c.tecnico?.id !== u.id || ["resolvido", "fechado", "concluido", "cancelado"].includes(c.status))) return false;
        // Chamados resolvidos/fechados que o técnico atendeu
        if (fila === "resolvidos") {
          if (c.tecnico?.id !== u.id) return false;
          if (!["resolvido", "fechado", "concluido"].includes(c.status)) return false;
        }
        if (status && c.status !== status) return false;
        if (prioridade && c.prioridade !== prioridade) return false;
        if (setor && c.setor !== setor) return false;
        if (servicoId && c.servicoId !== servicoId) return false;
        if (q && !`${c.titulo} ${c.protocolo} ${c.servicoNome} ${c.solicitante.nome}`.toLowerCase().includes(q))
          return false;
        return true;
      });

      const pesoPrioridade: Record<PrioridadeChamado, number> = { baixa: 0, media: 1, alta: 2, critica: 3 };
      lista = [...lista].sort((a, b) => {
        const cmp =
          ordenarPor === "prioridade"
            ? pesoPrioridade[a.prioridade] - pesoPrioridade[b.prioridade]
            : new Date(a[ordenarPor === "atualizadoEm" ? "atualizadoEm" : "criadoEm"]).getTime() -
              new Date(b[ordenarPor === "atualizadoEm" ? "atualizadoEm" : "criadoEm"]).getTime();
        return ordem === "asc" ? cmp : -cmp;
      });

      const page = Number(query.get("page") ?? 1) || 1;
      const limit = Number(query.get("limit") ?? 10) || 10;
      return ok(
        paginar(
          lista.map(({ comentarios: _c, historico: _h, ...resto }) => resto),
          page,
          limit,
        ),
      );
    },
  },
  {
    metodo: "GET",
    padrao: /^\/chamados\/([\w-]+)$/,
    responder: ({ params }) => {
      const chamado = chamados.find((c) => c.id === params[0]);
      if (!chamado) return erro(404, "Chamado não encontrado.");
      if (!visivelPara(chamado, atorAtual())) return erro(403, "Você não tem acesso a este chamado.");
      return ok(chamado);
    },
  },
  {
    metodo: "POST",
    padrao: /^\/chamados$/,
    responder: ({ body }) => {
      const servico = servicos.find((s) => s.id === body["servicoId"] && s.ativo);
      if (!servico) return erro(400, "Selecione um serviço válido do catálogo.");
      const solicitante = atorAtual();
      const id = String(Date.now());
      const agora = new Date().toISOString();
      const novo: Chamado = {
        id,
        protocolo: protocolo(),
        titulo: String(body["titulo"] ?? ""),
        descricao: String(body["descricao"] ?? ""),
        status: "aguardando",
        prioridade: servico.prioridade,
        setor: servico.setor,
        servicoId: servico.id,
        servicoNome: servico.nome,
        solicitante: { id: solicitante.id, nome: solicitante.nome, email: solicitante.email },
        tecnico: null,
        filaSetor: servico.setor,
        criadoEm: agora,
        atualizadoEm: agora,
        versao: 1,
        slaAtendimentoHoras: servico.slaAtendimentoHoras,
        slaResolucaoHoras: servico.slaResolucaoHoras,
        slaConsumidoMs: 0,
        slaRodandoDesde: null,
        primeiraRespostaEm: null,
        oQueFoiFeito: null,
        resolvidoEm: null,
        motivoReabertura: null,
        avaliacao: null,
        relacionados: [],
        duplicadoDe: null,
        comentarios: [],
        historico: [
          { id: `${id}-h1`, tipo: "criacao", descricao: "Chamado registrado", autorNome: solicitante.nome, criadoEm: agora },
        ],
        anexos: [],
      };
      chamados = [novo, ...chamados];
      registrarAuditoria("chamado.criado", `Chamado ${novo.protocolo} registrado`);
      notificar(novo, "criacao", `Novo chamado ${novo.protocolo}: ${novo.titulo}`);
      return ok(novo, "Chamado aberto com sucesso.");
    },
  },
  {
    metodo: "PUT",
    padrao: /^\/chamados\/([\w-]+)$/,
    responder: ({ params, body }) => {
      const chamado = chamados.find((c) => c.id === params[0]);
      if (!chamado) return erro(404, "Chamado não encontrado.");
      const u = atorAtual();
      if (!visivelPara(chamado, u)) return erro(403, "Você não tem acesso a este chamado.");
      if (u.papel === "usuario") return erro(403, "O usuário não pode alterar o andamento do chamado.");

      if (body["versao"] !== undefined && Number(body["versao"]) !== chamado.versao) {
        return erro(409, "Este chamado foi alterado por outra pessoa. Recarregue antes de salvar.");
      }

      const novoStatus = body["status"] as StatusChamado | undefined;
      const oQueFoiFeito = typeof body["oQueFoiFeito"] === "string" ? body["oQueFoiFeito"].trim() : "";

      if (chamado.status === "resolvido" && novoStatus && novoStatus !== "resolvido") {
        return erro(403, "Chamado resolvido. Somente o administrador pode autorizar a reabertura.");
      }

      if (novoStatus === "resolvido") {
        const respostaTecnica =
          (chamado.comentarios ?? []).some((c) => c.autor.papel !== "usuario") || Boolean(chamado.oQueFoiFeito);
        if (!oQueFoiFeito && !chamado.oQueFoiFeito) {
          return erro(422, "Registre a resposta do atendimento antes de resolver o chamado.");
        }
        if (!respostaTecnica && !oQueFoiFeito) {
          return erro(422, "Registre a resposta do atendimento antes de resolver o chamado.");
        }
      }

      if (oQueFoiFeito) {
        chamado.oQueFoiFeito = oQueFoiFeito;
        chamado.primeiraRespostaEm = chamado.primeiraRespostaEm ?? new Date().toISOString();
        historico(chamado, "atendimento", `Registro do atendimento: ${oQueFoiFeito}`);
      }

      if (novoStatus && novoStatus !== chamado.status) {
        sincronizarSla(chamado, novoStatus);
        chamado.status = novoStatus;
        if (novoStatus === "resolvido") chamado.resolvidoEm = new Date().toISOString();
        historico(chamado, "status", `Status alterado para ${novoStatus.replace("_", " ")}`);
        registrarAuditoria("chamado.status", `Chamado ${chamado.protocolo} → ${novoStatus}`);
        notificar(
          chamado,
          novoStatus === "resolvido" ? "resolucao" : novoStatus === "pausado" ? "pausa" : "status",
          `Chamado ${chamado.protocolo} agora está ${novoStatus.replace("_", " ")}`,
        );
      }

      if (body["prioridade"] && body["prioridade"] !== chamado.prioridade) {
        chamado.prioridade = body["prioridade"] as PrioridadeChamado;
        historico(chamado, "prioridade", `Prioridade alterada para ${chamado.prioridade}`);
      }

      if (Array.isArray(body["anexos"])) {
        chamado.anexos = body["anexos"] as Anexo[];
      }

      registrarInteracao(chamado);
      return ok(chamado, "Chamado atualizado.");
    },
  },
  {
    metodo: "POST",
    padrao: /^\/chamados\/([\w-]+)\/assumir$/,
    responder: ({ params }) => {
      const chamado = chamados.find((c) => c.id === params[0]);
      if (!chamado) return erro(404, "Chamado não encontrado.");
      const u = atorAtual();
      if (u.papel === "usuario") return erro(403, "Ação restrita à equipe técnica.");
      if (!visivelPara(chamado, u)) return erro(403, "Chamado fora dos seus setores liberados.");
      if (chamado.tecnico) return erro(409, "Este chamado já foi assumido por outro técnico.");
      chamado.tecnico = { id: u.id, nome: u.nome };
      chamado.filaSetor = null;
      historico(chamado, "assuncao", `${u.nome} assumiu o chamado`);
      registrarAuditoria("chamado.assumido", `Chamado ${chamado.protocolo} assumido por ${u.nome}`);
      notificar(chamado, "assuncao", `${u.nome} assumiu o chamado ${chamado.protocolo}`);
      registrarInteracao(chamado);
      return ok(chamado, "Chamado adicionado à sua fila.");
    },
  },
  {
    metodo: "POST",
    padrao: /^\/chamados\/([\w-]+)\/devolver$/,
    responder: ({ params, body }) => {
      const chamado = chamados.find((c) => c.id === params[0]);
      if (!chamado) return erro(404, "Chamado não encontrado.");
      const ap = atorAtual();
      if (ap.papel === "usuario") return erro(403, "Ação restrita à equipe técnica.");
      if (!visivelPara(chamado, ap)) return erro(403, "Chamado fora das suas filas liberadas.");
      const motivo = String(body["motivo"] ?? "").trim();
      if (!motivo) return erro(422, "Informe a justificativa da devolução.");
      if (chamado.status === "resolvido") return erro(403, "Chamado resolvido não pode ser devolvido à fila.");

      chamado.tecnico = null;
      chamado.filaSetor = chamado.setor;
      sincronizarSla(chamado, chamado.status);
      historico(chamado, "devolucao", `Devolvido à fila geral. Motivo: ${motivo}`);
      registrarAuditoria("chamado.devolvido", `Chamado ${chamado.protocolo} devolvido à fila`);
      notificar(chamado, "devolucao", `Chamado ${chamado.protocolo} devolvido à fila geral`);
      registrarInteracao(chamado);
      return ok(chamado, "Chamado devolvido à fila geral.");
    },
  },
  {
    metodo: "POST",
    padrao: /^\/chamados\/([\w-]+)\/encaminhar$/,
    responder: ({ params, body }) => {
      const chamado = chamados.find((c) => c.id === params[0]);
      if (!chamado) return erro(404, "Chamado não encontrado.");
      const u = atorAtual();
      if (u.papel === "usuario") return erro(403, "O usuário não pode encaminhar chamados.");
      const motivo = String(body["motivo"] ?? "").trim();
      if (!motivo) return erro(422, "Informe o motivo do encaminhamento.");

      const tecnicoId = body["tecnicoId"] ? String(body["tecnicoId"]) : "";
      const filaSetor = body["filaSetor"] ? String(body["filaSetor"]) : "";

      if (tecnicoId) {
        const destino = usuarios.find((x) => x.id === tecnicoId && (x.papel === "tecnico" || x.papel === "admin"));
        if (!destino) return erro(404, "Técnico de destino não encontrado.");
        if (u.papel === "tecnico" && !u.setoresLiberados.includes(destino.setor)) {
          return erro(403, "Você só pode encaminhar dentro dos setores liberados.");
        }
        chamado.tecnico = { id: destino.id, nome: destino.nome };
        chamado.filaSetor = null;
        historico(chamado, "encaminhamento", `Encaminhado para ${destino.nome}. Motivo: ${motivo}`);
        registrarAuditoria("chamado.encaminhado", `Chamado ${chamado.protocolo} → ${destino.nome}`);
      } else if (filaSetor) {
        if (u.papel === "tecnico" && !u.setoresLiberados.includes(filaSetor)) {
          return erro(403, "Você só pode encaminhar para filas dos setores liberados.");
        }
        chamado.tecnico = null;
        chamado.filaSetor = filaSetor;
        chamado.setor = filaSetor;
        historico(chamado, "encaminhamento", `Encaminhado para a fila de ${filaSetor}. Motivo: ${motivo}`);
        registrarAuditoria("chamado.encaminhado", `Chamado ${chamado.protocolo} → fila ${filaSetor}`);
      } else {
        return erro(422, "Escolha um técnico ou uma fila de destino.");
      }

      notificar(chamado, "encaminhamento", `Chamado ${chamado.protocolo} encaminhado`);
      registrarInteracao(chamado);
      return ok(chamado, "Chamado encaminhado.");
    },
  },
  {
    metodo: "POST",
    padrao: /^\/chamados\/([\w-]+)\/reabrir$/,
    responder: ({ params, body }) => {
      const chamado = chamados.find((c) => c.id === params[0]);
      if (!chamado) return erro(404, "Chamado não encontrado.");
      const u = atorAtual();
      if (u.papel !== "admin" && !ehSuper(u)) return erro(403, "Somente o administrador autoriza a reabertura.");
      if (chamado.status !== "resolvido" && chamado.status !== "concluido" && chamado.status !== "fechado") {
        return erro(422, "Somente chamados resolvidos ou fechados podem ser reabertos.");
      }
      const motivo = String(body["justificativa"] ?? body["motivo"] ?? "").trim() || "Reabertura autorizada pelo administrador";
      chamado.status = "aguardando";
      chamado.resolvidoEm = null;
      chamado.motivoReabertura = motivo;
      sincronizarSla(chamado, "aguardando");
      historico(chamado, "reabertura", `Chamado reaberto. Motivo: ${motivo}`);
      registrarAuditoria("chamado.reaberto", `Chamado ${chamado.protocolo} reaberto`);
      notificar(chamado, "reabertura", `Chamado ${chamado.protocolo} foi reaberto`);
      registrarInteracao(chamado);
      return ok(chamado, "Chamado reaberto.");
    },
  },
  {
    metodo: "POST",
    padrao: /^\/chamados\/([\w-]+)\/avaliacao$/,
    responder: ({ params, body }) => {
      const chamado = chamados.find((c) => c.id === params[0]);
      if (!chamado) return erro(404, "Chamado não encontrado.");
      const u = atorAtual();
      if (chamado.solicitante.id !== u.id) return erro(403, "Apenas o solicitante avalia o atendimento.");
      if (chamado.status !== "resolvido") return erro(422, "A avaliação fica disponível após a resolução.");
      const nota = Number(body["nota"] ?? 0);
      if (nota < 1 || nota > 5) return erro(422, "Escolha uma nota de 1 a 5.");
      chamado.avaliacao = nota;
      historico(chamado, "avaliacao", `Atendimento avaliado com nota ${nota}`);
      registrarAuditoria("chamado.avaliado", `Chamado ${chamado.protocolo} avaliado (${nota}/5)`);
      notificar(chamado, "avaliacao", `Chamado ${chamado.protocolo} avaliado com nota ${nota}`);
      return ok(chamado, "Obrigado pela avaliação!");
    },
  },
  {
    metodo: "POST",
    padrao: /^\/chamados\/([\w-]+)\/comentarios$/,
    responder: ({ params, body }) => {
      const chamado = chamados.find((c) => c.id === params[0]);
      if (!chamado) return erro(404, "Chamado não encontrado.");
      const autor = atorAtual();
      if (!visivelPara(chamado, autor)) return erro(403, "Você não tem acesso a este chamado.");
      if (chamado.status === "resolvido") return erro(403, "Chamado resolvido está bloqueado para novas alterações.");
      const comentario: Comentario = {
        id: `${chamado.id}-cm${Date.now()}`,
        chamadoId: chamado.id,
        autor: { id: autor.id, nome: autor.nome, papel: autor.papel },
        mensagem: String(body["mensagem"] ?? ""),
        criadoEm: new Date().toISOString(),
        interno: Boolean(body["interno"]) && autor.papel !== "usuario",
      };
      chamado.comentarios = [...(chamado.comentarios ?? []), comentario];
      if (autor.papel !== "usuario") {
        chamado.primeiraRespostaEm = chamado.primeiraRespostaEm ?? comentario.criadoEm;
      }
      historico(chamado, "comentario", `Novo comentário de ${autor.nome}`, autor.nome);
      registrarAuditoria("chamado.comentario", `Comentário no chamado ${chamado.protocolo}`);
      notificar(chamado, "comentario", `Novo comentário em ${chamado.protocolo}`);
      registrarInteracao(chamado);
      return ok(comentario, "Comentário publicado.");
    },
  },

  // Usuários
  {
    metodo: "GET",
    padrao: /^\/usuarios$/,
    responder: ({ query }) => {
      const q = (query.get("q") ?? "").toLowerCase();
      const papel = query.get("papel");
      const lista = usuarios.filter(
        (u) => `${u.nome} ${u.email} ${u.setor}`.toLowerCase().includes(q) && (!papel || u.papel === papel),
      );
      const page = Number(query.get("page") ?? 1) || 1;
      const limit = Number(query.get("limit") ?? 10) || 10;
      return ok(paginar(lista, page, limit));
    },
  },
  {
    metodo: "POST",
    padrao: /^\/usuarios$/,
    responder: ({ body }) => {
      const u = atorAtual();
      const autorizado = ehSuper(u) || u.papel === "admin" || (u.papel === "tecnico" && u.podeCadastrarUsuarios);
      if (!autorizado) return erro(403, "Cadastro de usuários não liberado para o seu perfil.");
      const email = String(body["email"] ?? "").toLowerCase();
      const dominio = email.split("@")[1] ?? "";
      if (!configDominios.dominios.includes(dominio)) {
        return erro(422, `Use um e-mail institucional autorizado (${configDominios.dominios.join(", ")}).`);
      }
      const papel = (body["papel"] as User["papel"]) ?? "usuario";
      if (papel === "superusuario" && !ehSuper(u)) return erro(403, "Apenas o superusuário cria superusuários.");
      // Usuário não participa de filas; admin só recebe filas do superusuário.
      const filasPedidas = ((body["setoresLiberados"] as string[]) ?? []).filter((s) => SETORES.includes(s));
      const filas =
        papel === "usuario" || papel === "superusuario"
          ? papel === "superusuario"
            ? SETORES
            : []
          : papel === "admin" && !ehSuper(u)
            ? []
            : filasPedidas;
      const novo: User = {
        id: `u${Date.now()}`,
        nome: String(body["nome"] ?? ""),
        email,
        telefone: (body["telefone"] as string) ?? null,
        localidade: (body["localidade"] as string) ?? "Sede Principal",
        papel,
        setor: String(body["setor"] ?? "TI"),
        setoresLiberados: filas,
        podeCadastrarUsuarios: Boolean(body["podeCadastrarUsuarios"]),
        ativo: true,
        criadoEm: new Date().toISOString(),
        criadoPorNome: u.nome,
        termosAceitosEm: null,
        termosVersao: null,
        primeiroAcessoConcluido: true,
      };
      usuarios.push(novo);
      registrarAuditoria("usuario.criado", `${u.nome} cadastrou ${novo.nome} (${novo.papel})`);
      if (filas.length > 0 && (papel === "tecnico" || papel === "admin")) {
        registrarAuditoria("filas.liberadas", `${novo.nome}: filas liberadas — ${filas.join(", ")}`);
      }

      return ok(novo, "Usuário cadastrado.");
    },
  },
  {
    metodo: "POST",
    padrao: /^\/usuarios\/lote$/,
    responder: ({ body }) => {
      const u = atorAtual();
      const autorizado = ehSuper(u) || u.papel === "admin" || (u.papel === "tecnico" && u.podeCadastrarUsuarios);
      if (!autorizado) return erro(403, "Importação de usuários em lista não liberada para o seu perfil.");

      const lista = Array.isArray(body["usuarios"]) ? (body["usuarios"] as Record<string, unknown>[]) : [];
      if (lista.length === 0) return erro(422, "Nenhum usuário informado para importação.");

      const criados: User[] = [];
      const erros: { linha: number; email: string; motivo: string }[] = [];
      const emailsLote = new Set<string>();

      lista.forEach((item, index) => {
        const linhaNum = index + 1;
        const nome = String(item["nome"] ?? "").trim();
        const email = String(item["email"] ?? "").trim().toLowerCase();
        const setor = String(item["setor"] ?? "TI").trim();
        const papelRaw = String(item["papel"] ?? "usuario").toLowerCase();
        const telefone = item["telefone"] ? String(item["telefone"]).trim() : null;
        const localidade = item["localidade"] ? String(item["localidade"]).trim() : "Sede Principal";

        if (!nome || nome.length < 3) {
          erros.push({ linha: linhaNum, email, motivo: "Nome incompleto ou com menos de 3 caracteres." });
          return;
        }
        if (!email || !email.includes("@")) {
          erros.push({ linha: linhaNum, email, motivo: "Endereço de e-mail inválido." });
          return;
        }
        const dom = email.split("@")[1] ?? "";
        if (!configDominios.dominios.includes(dom)) {
          erros.push({
            linha: linhaNum,
            email,
            motivo: `Domínio @${dom} não está na lista de domínios institucionais autorizados (${configDominios.dominios.join(", ")}).`,
          });
          return;
        }
        if (emailsLote.has(email) || usuarios.some((ex) => ex.email.toLowerCase() === email)) {
          erros.push({ linha: linhaNum, email, motivo: "E-mail já cadastrado no sistema ou duplicado no arquivo." });
          return;
        }

        let papel: User["papel"] = "usuario";
        if (papelRaw === "superusuario" || papelRaw === "super") {
          if (!ehSuper(u)) {
            erros.push({ linha: linhaNum, email, motivo: "Apenas superusuário pode importar contas de superusuário." });
            return;
          }
          papel = "superusuario";
        } else if (papelRaw === "admin" || papelRaw === "administrador") {
          if (!ehSuper(u) && u.papel !== "admin") {
            erros.push({ linha: linhaNum, email, motivo: "Perfil sem permissão para cadastrar administradores." });
            return;
          }
          papel = "admin";
        } else if (papelRaw === "tecnico" || papelRaw === "técnico") {
          papel = "tecnico";
        }

        emailsLote.add(email);
        const novo: User = {
          id: `u${Date.now()}_${index}`,
          nome,
          email,
          telefone,
          localidade,
          papel,
          setor: SETORES.includes(setor) ? setor : SETORES[0]!,
          setoresLiberados: papel === "superusuario" ? SETORES : [],
          podeCadastrarUsuarios: false,
          ativo: true,
          criadoEm: new Date().toISOString(),
          criadoPorNome: u.nome,
          termosAceitosEm: null,
          termosVersao: null,
          primeiroAcessoConcluido: true,
        };
        usuarios.push(novo);
        criados.push(novo);
      });

      if (criados.length > 0) {
        registrarAuditoria("usuario.lote_importado", `${u.nome} importou ${criados.length} usuário(s) em lote.`);
      }

      return ok(
        {
          criados,
          erros,
          totalProcessados: lista.length,
          totalCriados: criados.length,
        },
        `${criados.length} usuário(s) importado(s) com sucesso. ${erros.length > 0 ? `${erros.length} rejeitado(s).` : ""}`,
      );
    },
  },
  {
    metodo: "PUT",
    padrao: /^\/usuarios\/([\w-]+)$/,
    responder: ({ params, body }) => {
      const ap = atorAtual();
      if (ap.papel !== "admin" && !ehSuper(ap)) return erro(403, "Edição de usuários restrita à administração.");
      const user = usuarios.find((u) => u.id === params[0]);
      if (!user) return erro(404, "Usuário não encontrado.");
      if (user.papel === "superusuario" && !ehSuper(ap)) {
        return erro(403, "O perfil superusuário só pode ser editado pelo próprio superusuário.");
      }
      if (typeof body["nome"] === "string") user.nome = body["nome"];
      if (typeof body["email"] === "string") user.email = body["email"];
      if (typeof body["telefone"] === "string") user.telefone = body["telefone"];
      if (typeof body["localidade"] === "string") user.localidade = body["localidade"];
      if (typeof body["setor"] === "string") user.setor = body["setor"];
      if (typeof body["papel"] === "string") {
        if (body["papel"] === "superusuario" && !ehSuper(ap)) return erro(403, "Ação exclusiva do superusuário.");
        user.papel = body["papel"] as User["papel"];
      }
      if (Array.isArray(body["setoresLiberados"])) {
        const novos = (body["setoresLiberados"] as string[]).filter((s) => SETORES.includes(s));
        // Superusuário libera filas para admin e técnico; admin libera apenas para técnicos.
        if (!ehSuper(ap) && user.papel !== "tecnico") {
          return erro(403, "Somente o superusuário libera filas para o perfil administrador.");
        }
        const antes = user.setoresLiberados;
        const liberadas = novos.filter((s) => !antes.includes(s));
        const revogadas = antes.filter((s) => !novos.includes(s));
        user.setoresLiberados = novos;
        if (liberadas.length > 0) {
          registrarAuditoria("filas.liberadas", `${user.nome}: filas liberadas — ${liberadas.join(", ")}`);
        }
        if (revogadas.length > 0) {
          registrarAuditoria("filas.revogadas", `${user.nome}: filas revogadas — ${revogadas.join(", ")}`);
        }
      }
      if (typeof body["podeCadastrarUsuarios"] === "boolean") user.podeCadastrarUsuarios = body["podeCadastrarUsuarios"];
      if (typeof body["ativo"] === "boolean") user.ativo = body["ativo"];
      registrarAuditoria("usuario.editado", `Cadastro de ${user.nome} atualizado`);

      if (ator?.id === user.id) ator = user;
      return ok(user, "Usuário atualizado.");
    },
  },
  {
    metodo: "POST",
    padrao: /^\/usuarios\/([\w-]+)\/resetar-senha$/,
    responder: ({ params, body }) => {
      const ap = atorAtual();
      const targetUser = usuarios.find((u) => u.id === params[0]);
      if (!targetUser) return erro(404, "Usuário não encontrado.");

      const podeResetar =
        ehSuper(ap) ||
        (ap.papel === "admin" && targetUser.papel !== "superusuario") ||
        (ap.papel === "tecnico" && targetUser.papel === "usuario");

      if (!podeResetar) {
        return erro(403, "Você não possui autorização para resetar a senha deste usuário.");
      }

      const custom = String(body["novaSenha"] ?? "").trim();
      const novaSenha = custom.length >= 6 ? custom : `Gov#${Math.floor(1000 + Math.random() * 9000)}!`;

      registrarAuditoria(
        "usuario.senha_resetada_manual",
        `${ap.nome} resetou manualmente a senha de ${targetUser.nome} (${targetUser.papel})`,
        ap,
      );

      return ok(
        {
          novaSenha,
          mensagem: `Senha de ${targetUser.nome} redefinida com sucesso.`,
        },
        "Senha redefinida com sucesso.",
      );
    },
  },

  // Notificações internas
  {
    metodo: "GET",
    padrao: /^\/notificacoes$/,
    responder: () => {
      const u = atorAtual();
      const minhas = notificacoes.filter((n) => n.usuarioId === u.id);
      return ok({ items: minhas.slice(0, 50), naoLidas: minhas.filter((n) => !n.lida).length });
    },
  },
  {
    metodo: "POST",
    padrao: /^\/notificacoes\/ler$/,
    responder: ({ body }) => {
      const u = atorAtual();
      const chamadoId = body["chamadoId"] ? String(body["chamadoId"]) : "";
      notificacoes = notificacoes.map((n) =>
        n.usuarioId === u.id && (!chamadoId || n.chamadoId === chamadoId) ? { ...n, lida: true } : n,
      );
      return ok(true, "Notificações marcadas como lidas.");
    },
  },

  // Vínculo entre chamados (relacionado / duplicado)
  {
    metodo: "POST",
    padrao: /^\/chamados\/([\w-]+)\/vinculos$/,
    responder: ({ params, body }) => {
      const chamado = chamados.find((c) => c.id === params[0]);
      if (!chamado) return erro(404, "Chamado não encontrado.");
      const u = atorAtual();
      if (u.papel === "usuario") return erro(403, "Vínculo restrito à equipe técnica.");
      if (!visivelPara(chamado, u)) return erro(403, "Você não tem acesso a este chamado.");
      const protocoloAlvo = String(body["protocolo"] ?? "").trim().toUpperCase();
      const tipo = body["tipo"] === "duplicado" ? "duplicado" : "relacionado";
      const alvo = chamados.find((c) => c.protocolo.toUpperCase() === protocoloAlvo);
      if (!alvo) return erro(404, "Protocolo informado não encontrado.");
      if (alvo.id === chamado.id) return erro(422, "Não é possível vincular o chamado a ele mesmo.");
      if (tipo === "duplicado") {
        chamado.duplicadoDe = alvo.id;
        historico(chamado, "status", `Marcado como duplicado de ${alvo.protocolo}`);
      } else if (!chamado.relacionados.includes(alvo.id)) {
        chamado.relacionados = [...chamado.relacionados, alvo.id];
        if (!alvo.relacionados.includes(chamado.id)) alvo.relacionados = [...alvo.relacionados, chamado.id];
        historico(chamado, "status", `Vinculado ao chamado ${alvo.protocolo}`);
      }
      registrarAuditoria("chamado.vinculo", `Chamado ${chamado.protocolo} ${tipo} de ${alvo.protocolo}`);
      registrarInteracao(chamado);
      return ok(chamado, "Vínculo registrado.");
    },
  },
  {
    metodo: "GET",
    padrao: /^\/relatorios$/,
    responder: ({ query }) => {
      const u = atorAtual();
      if (u.papel !== "admin" && !ehSuper(u)) return erro(403, "Relatórios restritos à administração.");
      return ok(relatorios(query));
    },
  },
  {
    metodo: "GET",
    padrao: /^\/configuracoes\/dominios$/,
    responder: () => ok(configDominios),
  },
  {
    metodo: "POST",
    padrao: /^\/configuracoes\/dominios$/,
    responder: ({ body }) => {
      const u = atorAtual();
      if (!ehSuper(u)) return erro(403, "Apenas o superusuário pode gerenciar os domínios institucionais.");
      const dominios = Array.isArray(body["dominios"])
        ? (body["dominios"] as string[]).map((d) => String(d).trim().toLowerCase()).filter(Boolean)
        : [];
      const padrao = String(body["padrao"] ?? "").trim().toLowerCase();

      if (dominios.length === 0) return erro(422, "Pelo menos um domínio institucional deve ser configurado.");
      if (!dominios.includes(padrao)) {
        return erro(422, "O domínio pré-selecionado padrão deve estar contido na lista de domínios cadastrados.");
      }

      configDominios = { dominios, padrao };
      registrarAuditoria(
        "config.dominios",
        `Domínios atualizados por ${u.nome}: ${dominios.join(", ")} (padrão: @${padrao})`,
        u,
      );
      return ok(configDominios, "Configuração de domínios institucionais salva com sucesso.");
    },
  },
  {
    metodo: "PUT",
    padrao: /^\/configuracoes\/dominios$/,
    responder: ({ body }) => {
      const u = atorAtual();
      if (!ehSuper(u)) return erro(403, "Apenas o superusuário pode gerenciar os domínios institucionais.");
      const dominios = Array.isArray(body["dominios"])
        ? (body["dominios"] as string[]).map((d) => String(d).trim().toLowerCase()).filter(Boolean)
        : [];
      const padrao = String(body["padrao"] ?? "").trim().toLowerCase();

      if (dominios.length === 0) return erro(422, "Pelo menos um domínio institucional deve ser configurado.");
      if (!dominios.includes(padrao)) {
        return erro(422, "O domínio pré-selecionado padrão deve estar contido na lista de domínios cadastrados.");
      }

      configDominios = { dominios, padrao };
      registrarAuditoria(
        "config.dominios",
        `Domínios atualizados por ${u.nome}: ${dominios.join(", ")} (padrão: @${padrao})`,
        u,
      );
      return ok(configDominios, "Configuração de domínios institucionais salva com sucesso.");
    },
  },
  // -------------------------------------------------------------------------
  // Base de Conhecimento
  // -------------------------------------------------------------------------
  {
    metodo: "GET",
    padrao: /^\/base-conhecimento$/,
    responder: ({ query }) => {
      const busca = query.get("busca")?.toLowerCase().trim();
      const setor = query.get("setor");
      const categoria = query.get("categoria");

      let resultado = [...artigosBaseConhecimento];
      if (setor) {
        resultado = resultado.filter((a) => a.setor.toLowerCase() === setor.toLowerCase());
      }
      if (categoria) {
        resultado = resultado.filter((a) => a.categoria.toLowerCase() === categoria.toLowerCase());
      }
      if (busca) {
        resultado = resultado.filter(
          (a) =>
            a.titulo.toLowerCase().includes(busca) ||
            a.resumo.toLowerCase().includes(busca) ||
            a.conteudo.toLowerCase().includes(busca) ||
            a.tags.some((t) => t.toLowerCase().includes(busca)),
        );
      }
      return ok(resultado);
    },
  },
  {
    metodo: "GET",
    padrao: /^\/base-conhecimento\/([\w-]+)$/,
    responder: ({ params }) => {
      const idOuSlug = params[0];
      const artigo = artigosBaseConhecimento.find((a) => a.id === idOuSlug || a.slug === idOuSlug);
      if (!artigo) return erro(404, "Artigo não encontrado.");
      return ok(artigo);
    },
  },
  {
    metodo: "POST",
    padrao: /^\/base-conhecimento$/,
    responder: ({ body }) => {
      const u = atorAtual();
      if (u.papel === "usuario") return erro(403, "Apenas técnicos e administradores podem cadastrar artigos.");
      const titulo = String(body["titulo"] ?? "").trim();
      const resumo = String(body["resumo"] ?? "").trim();
      const conteudo = String(body["conteudo"] ?? "").trim();
      const setor = String(body["setor"] ?? "").trim();
      const categoria = String(body["categoria"] ?? "Geral").trim();
      const tags = Array.isArray(body["tags"]) ? (body["tags"] as string[]) : [];

      if (!titulo || !conteudo || !setor) {
        return erro(422, "Título, setor e conteúdo são obrigatórios.");
      }

      const id = `art-${Date.now()}`;
      const slug = titulo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
      const agora = new Date().toISOString();

      const anexoPdfNome = body["anexoPdfNome"] ? String(body["anexoPdfNome"]) : undefined;
      const anexoPdfTamanho = typeof body["anexoPdfTamanho"] === "number" ? (body["anexoPdfTamanho"] as number) : undefined;
      const anexoPdfBase64 = body["anexoPdfBase64"] ? String(body["anexoPdfBase64"]) : undefined;

      const novo: ArtigoBaseConhecimento = {
        id,
        titulo,
        slug,
        resumo: resumo || titulo,
        conteudo,
        setor,
        categoria,
        tags,
        utilSim: 0,
        utilNao: 0,
        autorNome: u.nome,
        anexoPdfNome,
        anexoPdfTamanho,
        anexoPdfBase64,
        criadoEm: agora,
        atualizadoEm: agora,
      };

      artigosBaseConhecimento = [novo, ...artigosBaseConhecimento];
      registrarAuditoria("base_conhecimento.criar", `Artigo criado: ${titulo}`, u);
      return ok(novo, "Artigo cadastrado na base de conhecimento.");
    },
  },
  {
    metodo: "PUT",
    padrao: /^\/base-conhecimento\/([\w-]+)$/,
    responder: ({ params, body }) => {
      const u = atorAtual();
      if (u.papel === "usuario") return erro(403, "Apenas técnicos e administradores podem editar artigos.");
      const artigo = artigosBaseConhecimento.find((a) => a.id === params[0]);
      if (!artigo) return erro(404, "Artigo não encontrado.");

      if (body["titulo"]) artigo.titulo = String(body["titulo"]).trim();
      if (body["resumo"]) artigo.resumo = String(body["resumo"]).trim();
      if (body["conteudo"]) artigo.conteudo = String(body["conteudo"]).trim();
      if (body["setor"]) artigo.setor = String(body["setor"]).trim();
      if (body["categoria"]) artigo.categoria = String(body["categoria"]).trim();
      if (Array.isArray(body["tags"])) artigo.tags = body["tags"] as string[];
      if ("anexoPdfNome" in body) artigo.anexoPdfNome = body["anexoPdfNome"] ? String(body["anexoPdfNome"]) : undefined;
      if ("anexoPdfTamanho" in body) artigo.anexoPdfTamanho = typeof body["anexoPdfTamanho"] === "number" ? (body["anexoPdfTamanho"] as number) : undefined;
      if ("anexoPdfBase64" in body) artigo.anexoPdfBase64 = body["anexoPdfBase64"] ? String(body["anexoPdfBase64"]) : undefined;
      artigo.atualizadoEm = new Date().toISOString();

      registrarAuditoria("base_conhecimento.editar", `Artigo atualizado: ${artigo.titulo}`, u);
      return ok(artigo, "Artigo atualizado com sucesso.");
    },
  },
  {
    metodo: "DELETE",
    padrao: /^\/base-conhecimento\/([\w-]+)$/,
    responder: ({ params }) => {
      const u = atorAtual();
      if (u.papel !== "admin" && !ehSuper(u)) return erro(403, "Apenas administradores podem excluir artigos.");
      const idx = artigosBaseConhecimento.findIndex((a) => a.id === params[0]);
      if (idx === -1) return erro(404, "Artigo não encontrado.");
      const removido = artigosBaseConhecimento[idx]!;
      artigosBaseConhecimento = artigosBaseConhecimento.filter((_, i) => i !== idx);
      registrarAuditoria("base_conhecimento.excluir", `Artigo excluído: ${removido.titulo}`, u);
      return ok({ id: removido.id }, "Artigo excluído com sucesso.");
    },
  },
  {
    metodo: "POST",
    padrao: /^\/base-conhecimento\/([\w-]+)\/avaliar$/,
    responder: ({ params, body }) => {
      const artigo = artigosBaseConhecimento.find((a) => a.id === params[0]);
      if (!artigo) return erro(404, "Artigo não encontrado.");
      const util = Boolean(body["util"]);
      if (util) {
        artigo.utilSim++;
      } else {
        artigo.utilNao++;
      }
      return ok({ utilSim: artigo.utilSim, utilNao: artigo.utilNao }, "Avaliação registrada. Obrigado pelo feedback!");
    },
  },
  // -------------------------------------------------------------------------
  // LDAP / Active Directory
  // -------------------------------------------------------------------------
  {
    metodo: "GET",
    padrao: /^\/configuracoes\/ldap$/,
    responder: () => {
      const u = atorAtual();
      if (u.papel !== "admin" && !ehSuper(u)) return erro(403, "Acesso restrito à administração.");
      return ok(configLdap);
    },
  },
  {
    metodo: "PUT",
    padrao: /^\/configuracoes\/ldap$/,
    responder: ({ body }) => {
      const u = atorAtual();
      if (!ehSuper(u) && u.papel !== "admin") return erro(403, "Acesso restrito à administração.");
      configLdap = { ...configLdap, ...body };
      registrarAuditoria("config.ldap", `Configurações LDAP/AD atualizadas por ${u.nome}`, u);
      return ok(configLdap, "Configurações do diretório LDAP salvas com sucesso.");
    },
  },
  {
    metodo: "POST",
    padrao: /^\/configuracoes\/ldap\/testar$/,
    responder: () => {
      const u = atorAtual();
      if (u.papel !== "admin" && !ehSuper(u)) return erro(403, "Acesso restrito à administração.");
      return ok({
        sucesso: true,
        mensagem: "Conexão LDAP estabelecida com sucesso! Servidor acessível e bind autenticado.",
        tempoRespostaMs: 42,
        detalhes: {
          servidorAcessivel: true,
          bindAutenticado: true,
          usuariosEncontrados: 142,
        },
      });
    },
  },
  {
    metodo: "POST",
    padrao: /^\/configuracoes\/ldap\/sincronizar$/,
    responder: () => {
      const u = atorAtual();
      if (!ehSuper(u) && u.papel !== "admin") return erro(403, "Acesso restrito à administração.");
      configLdap.ultimaSincronizacaoEm = new Date().toISOString();
      configLdap.totalUsuariosSincronizados = 142;
      registrarAuditoria("config.ldap_sincronizacao", `Sincronização LDAP manual disparada por ${u.nome}`, u);
      return ok({ totalSincronizados: 142, mensagem: "142 contas de usuário sincronizadas com o Active Directory com sucesso." });
    },
  },
  // -------------------------------------------------------------------------
  // E-mail (SMTP & Mail-to-Ticket)
  // -------------------------------------------------------------------------
  {
    metodo: "GET",
    padrao: /^\/configuracoes\/email$/,
    responder: () => {
      const u = atorAtual();
      if (u.papel !== "admin" && !ehSuper(u)) return erro(403, "Acesso restrito à administração.");
      return ok(configEmail);
    },
  },
  {
    metodo: "PUT",
    padrao: /^\/configuracoes\/email$/,
    responder: ({ body }) => {
      const u = atorAtual();
      if (!ehSuper(u) && u.papel !== "admin") return erro(403, "Acesso restrito à administração.");
      configEmail = { ...configEmail, ...body };
      registrarAuditoria("config.email", `Configurações de E-mail atualizadas por ${u.nome}`, u);
      return ok(configEmail, "Configurações de e-mail e notificações salvas com sucesso.");
    },
  },
  {
    metodo: "POST",
    padrao: /^\/configuracoes\/email\/testar$/,
    responder: ({ body }) => {
      const u = atorAtual();
      if (u.papel !== "admin" && !ehSuper(u)) return erro(403, "Acesso restrito à administração.");
      const dest = String(body["destinatario"] ?? u.email);
      return ok({
        sucesso: true,
        mensagem: `E-mail de teste disparado com sucesso para ${dest}. Verifique a caixa de entrada.`,
      });
    },
  },
];


export const mockAdapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  await new Promise((r) => setTimeout(r, 260));

  const metodo = (config.method ?? "get").toUpperCase();
  const raw = config.url ?? "";
  const [caminho, queryString = ""] = raw.split("?");
  const query = new URLSearchParams(queryString);
  for (const [chave, valor] of Object.entries((config.params ?? {}) as Record<string, unknown>)) {
    if (valor !== undefined && valor !== null && valor !== "") query.set(chave, String(valor));
  }

  let body: Record<string, unknown> = {};
  if (typeof config.data === "string") {
    try {
      body = JSON.parse(config.data) as Record<string, unknown>;
    } catch {
      body = {};
    }
  } else if (config.data && typeof config.data === "object") {
    body = config.data as Record<string, unknown>;
  }

  const rota = rotas.find((r) => r.metodo === metodo && r.padrao.test(caminho ?? ""));
  const resultado = rota?.responder({
    params: (rota.padrao.exec(caminho ?? "") ?? []).slice(1),
    body,
    query,
  });

  const status = resultado && "status" in resultado ? resultado.status : 200;
  const data =
    resultado && "status" in resultado
      ? resultado.body
      : (resultado ?? { success: false, data: null, message: "Rota não encontrada.", errors: null });

  const response: AxiosResponse = {
    data,
    status: rota ? status : 404,
    statusText: rota ? "OK" : "Not Found",
    headers: {},
    config,
  };

  if (response.status >= 400) {
    const err = Object.assign(new Error(String((data as ApiResponse<unknown>).message ?? "Erro")), {
      isAxiosError: true,
      config,
      response,
      toJSON: () => ({}),
    });
    throw err;
  }

  return response;
};
