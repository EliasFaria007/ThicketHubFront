import { toast } from "sonner";
import { getApiBaseUrl } from "./http";

export type StatusConexaoWs = "conectado" | "conectando" | "desconectado";

type MensagemWs = {
  tipo: "novo_chamado" | "atualizacao_chamado" | "atribuicao" | "resolucao" | "notificacao";
  titulo: string;
  descricao?: string;
  chamadoId?: string | number;
  timestamp: string;
};

type CallbackMensagem = (msg: MensagemWs) => void;
type CallbackStatus = (status: StatusConexaoWs) => void;

class RealtimeClient {
  private socket: WebSocket | null = null;
  private status: StatusConexaoWs = "desconectado";
  private ouvintesMensagem = new Set<CallbackMensagem>();
  private ouvintesStatus = new Set<CallbackStatus>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private tentativas = 0;
  private maxTentativas = 5;

  public getStatus(): StatusConexaoWs {
    return this.status;
  }

  private setStatus(novo: StatusConexaoWs) {
    if (this.status !== novo) {
      this.status = novo;
      this.ouvintesStatus.forEach((cb) => cb(novo));
    }
  }

  public onMensagem(callback: CallbackMensagem): () => void {
    this.ouvintesMensagem.add(callback);
    return () => {
      this.ouvintesMensagem.delete(callback);
    };
  }

  public onStatus(callback: CallbackStatus): () => void {
    this.ouvintesStatus.add(callback);
    callback(this.status);
    return () => {
      this.ouvintesStatus.delete(callback);
    };
  }

  public conectar(token?: string) {
    if (typeof window === "undefined") return;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus("conectando");

    try {
      const baseUrl = getApiBaseUrl();
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      let wsHost = window.location.host;

      try {
        const parsed = new URL(baseUrl);
        wsHost = parsed.host;
      } catch {
        // Usa host atual
      }

      const wsUrl = `${wsProtocol}//${wsHost}/api/ws/websocket${token ? `?token=${encodeURIComponent(token)}` : ""}`;
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        // Envia handshake STOMP para o Spring Boot MessageBroker
        const authHeader = token ? `\nAuthorization:Bearer ${token}\npasscode:${token}` : "";
        const connectFrame = `CONNECT\naccept-version:1.1,1.2\nheart-beat:10000,10000${authHeader}\n\n\0`;
        try {
          this.socket?.send(connectFrame);
        } catch {
          // Fallback para conexão genérica
        }
        this.setStatus("conectado");
        this.tentativas = 0;
      };

      this.socket.onmessage = (event) => {
        const raw = typeof event.data === "string" ? event.data : "";

        // Trata respostas do protocolo STOMP
        if (raw.startsWith("CONNECTED")) {
          // Após conexão aceita, inscreve-se na fila privada do usuário e no broadcast de chamados
          try {
            this.socket?.send("SUBSCRIBE\nid:sub-user\ndestination:/user/queue/notificacoes\n\n\0");
            this.socket?.send("SUBSCRIBE\nid:sub-topic\ndestination:/topic/chamados\n\n\0");
          } catch {
            // Silencioso
          }
          return;
        }

        if (raw.startsWith("MESSAGE")) {
          const bodyIndex = raw.indexOf("\n\n");
          if (bodyIndex !== -1) {
            let body = raw.substring(bodyIndex + 2);
            const nullIdx = body.indexOf("\0");
            if (nullIdx !== -1) {
              body = body.substring(0, nullIdx);
            }
            try {
              const json = JSON.parse(body);
              const msg: MensagemWs = {
                tipo: (json.tipo ? json.tipo.toLowerCase() : "notificacao") as MensagemWs["tipo"],
                titulo: json.titulo || json.mensagem || (json.protocolo ? `Atualização no chamado #${json.protocolo}` : "Atualização de chamado"),
                descricao: json.mensagem || json.descricao || (json.protocolo ? `Protocolo #${json.protocolo}` : undefined),
                chamadoId: json.chamadoId,
                timestamp: json.criadoEm || new Date().toISOString(),
              };
              this.notificar(msg);
            } catch {
              // Ignora payloads não JSON
            }
          }
          return;
        }

        // Fallback para mensagens puramente JSON (simuladores ou endpoints REST)
        try {
          const dados = JSON.parse(raw) as MensagemWs;
          this.notificar(dados);
        } catch {
          // Ignora mensagens de controle ou heartbeats
        }
      };

      this.socket.onerror = () => {
        this.setStatus("desconectado");
      };

      this.socket.onclose = () => {
        this.setStatus("desconectado");
        this.agendarReconexao(token);
      };
    } catch {
      this.setStatus("desconectado");
      this.agendarReconexao(token);
    }
  }

  private agendarReconexao(token?: string) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.tentativas >= this.maxTentativas) {
      // Para de tentar indefinidamente para não sobrecarregar
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.tentativas), 15000);
    this.tentativas++;
    this.reconnectTimer = setTimeout(() => {
      this.conectar(token);
    }, delay);
  }

  public desconectar() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.setStatus("desconectado");
  }

  /**
   * Emite uma notificação local e toca um som discreto via Web Audio API.
   */
  public emitirSimulado(msg: MensagemWs) {
    this.notificar(msg);
  }

  private notificar(msg: MensagemWs) {
    this.tocarAlertaSonoro();
    toast.info(`🔔 ${msg.titulo}`, {
      description: msg.descricao,
      action: msg.chamadoId
        ? {
            label: "Ver chamado",
            onClick: () => {
              window.location.href = `/chamados/${msg.chamadoId}`;
            },
          }
        : undefined,
      duration: 8000,
    });
    this.ouvintesMensagem.forEach((cb) => cb(msg));
  }

  /**
   * Toca um alerta sonoro sintetizado via Web Audio API (sem dependência de arquivos de áudio externos).
   */
  private tocarAlertaSonoro() {
    try {
      if (typeof window === "undefined") return;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.26);
    } catch {
      // Se áudio estiver desabilitado no navegador, falha silenciosamente
    }
  }
}

export const realtime = new RealtimeClient();
