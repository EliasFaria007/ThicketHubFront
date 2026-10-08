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

      const wsUrl = `${wsProtocol}//${wsHost}/api/ws${token ? `?token=${encodeURIComponent(token)}` : ""}`;
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.setStatus("conectado");
        this.tentativas = 0;
      };

      this.socket.onmessage = (event) => {
        try {
          const dados = JSON.parse(event.data) as MensagemWs;
          this.notificar(dados);
        } catch {
          // Ignora mensagens que não são JSON
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
    toast.info(msg.titulo, {
      description: msg.descricao,
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
