import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Building2, Loader2, Lock, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";

import { MensagemErro } from "@/components/comum/MensagemErro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import "@/lib/auth-bridge";
import { USANDO_DEMO } from "@/lib/http";
import { login, loginMicrosoft } from "@/services/auth";
import { useAuthStore } from "@/stores/auth";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — Central de Chamados" },
      {
        name: "description",
        content: "Acesse a Central de Chamados institucional com seu e-mail funcional para abrir e acompanhar chamados.",
      },
      { property: "og:title", content: "Entrar — Central de Chamados" },
      {
        property: "og:description",
        content: "Acesso restrito a servidores da instituição. Abra e acompanhe seus chamados de suporte.",
      },
    ],
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z
    .string()
    .min(1, "Informe seu e-mail institucional")
    .email("Digite um e-mail válido, por exemplo nome@instituto.gov.br"),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
});

function LoginPage() {
  const router = useRouter();
  const entrar = useAuthStore((s) => s.entrar);
  const token = useAuthStore((s) => s.token);
  const hidratado = useAuthStore((s) => s.hidratado);
  const [valores, setValores] = useState({ email: "", password: "" });
  const [erros, setErros] = useState<{ email?: string | undefined; password?: string | undefined }>({});
  const [erroMicrosoft, setErroMicrosoft] = useState<string | null>(null);
  const [tentandoSsoSilencioso, setTentandoSsoSilencioso] = useState(false);

  useEffect(() => {
    if (hidratado && token) void router.navigate({ to: "/", replace: true });
  }, [hidratado, token, router]);

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      if (typeof window !== "undefined") window.sessionStorage.removeItem("logout_manual");
      entrar(data);
      void router.navigate({ to: "/", replace: true });
    },
  });

  const mutationMicrosoft = useMutation({
    mutationFn: loginMicrosoft,
    onSuccess: (data) => {
      if (typeof window !== "undefined") window.sessionStorage.removeItem("logout_manual");
      entrar(data);
      void router.navigate({ to: "/", replace: true });
    },
    onError: (err: any) => {
      setTentandoSsoSilencioso(false);
      const msg = err?.response?.data?.message || err?.message || "Não foi possível autenticar com a conta Microsoft.";
      setErroMicrosoft(msg);
    },
  });

  // Se esta janela for o próprio popup de retorno do OAuth2 da Microsoft
  useEffect(() => {
    if (typeof window !== "undefined" && window.opener && window.name === "MicrosoftLoginPopup") {
      const hash = window.location.hash || window.location.search;
      if (hash) {
        window.opener.postMessage({ type: "MS_AUTH_CALLBACK", hash }, window.location.origin);
        window.close();
      }
    }
  }, []);

  // Ouvinte na janela principal para mensagens do popup ou do iframe silencioso
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "MS_AUTH_CALLBACK" || event.data?.type === "MS_SILENT_AUTH_CALLBACK") {
        const hash = event.data.hash as string;
        const params = new URLSearchParams(hash.replace(/^[#?]/, ""));
        const idToken = params.get("id_token") || params.get("access_token");
        const code = params.get("code");
        const error = params.get("error_description") || params.get("error");

        if (error) {
          // Se for SSO silencioso e falhou (requer interação do usuário), apenas para sem poluir a tela
          if (event.data?.type === "MS_SILENT_AUTH_CALLBACK") {
            setTentandoSsoSilencioso(false);
            return;
          }
          setErroMicrosoft(decodeURIComponent(error));
          return;
        }

        const emailHint = valores.email.trim();
        if (idToken || code) {
          mutationMicrosoft.mutate({
            idToken: idToken || code || "",
            ...(emailHint ? { email: emailHint } : {}),
          });
        } else {
          setTentandoSsoSilencioso(false);
        }
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [valores.email, mutationMicrosoft]);

  // Se esta janela estiver dentro do iframe invisível de login silencioso
  useEffect(() => {
    if (typeof window !== "undefined" && window.parent && window.parent !== window && window.name === "ms_silent_auth_frame") {
      const hash = window.location.hash || window.location.search;
      if (hash) {
        window.parent.postMessage({ type: "MS_SILENT_AUTH_CALLBACK", hash }, window.location.origin);
      }
    }
  }, []);

  // Tentativa de SSO silencioso automático ao carregar a página (Opção A)
  useEffect(() => {
    if (typeof window === "undefined" || !hidratado || token) return;

    // Se o usuário clicou em 'Sair' voluntariamente, respeita e não força login automático imediato
    if (window.sessionStorage.getItem("logout_manual") === "true") {
      return;
    }

    const clientId = (import.meta as any).env.VITE_AZURE_CLIENT_ID;
    const tenantId = (import.meta as any).env.VITE_AZURE_TENANT_ID || "common";

    if (!clientId) return;

    // Dispara login silencioso via iframe oculto com prompt=none
    setTentandoSsoSilencioso(true);

    const redirectUri = window.location.origin + "/login";
    const silentAuthUrl =
      `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/authorize?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&response_type=id_token` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent("openid profile email")}` +
      `&response_mode=fragment` +
      `&prompt=none` +
      `&nonce=${Date.now()}`;

    // Cria ou reutiliza iframe oculto
    let iframe = document.getElementById("ms_silent_auth_frame") as HTMLIFrameElement | null;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "ms_silent_auth_frame";
      iframe.name = "ms_silent_auth_frame";
      iframe.style.display = "none";
      iframe.style.position = "absolute";
      iframe.style.width = "0px";
      iframe.style.height = "0px";
      iframe.style.border = "none";
      document.body.appendChild(iframe);
    }
    iframe.src = silentAuthUrl;

    // Timeout de segurança para caso o iframe demore ou não responda
    const timer = setTimeout(() => {
      setTentandoSsoSilencioso(false);
    }, 4000);

    return () => clearTimeout(timer);
  }, [hidratado, token]);

  function handleLoginMicrosoft() {
    setErroMicrosoft(null);
    const emailHint = valores.email.trim();

    // Configurações do popup OAuth2 / Entra ID da Microsoft
    const clientId = (import.meta as any).env.VITE_AZURE_CLIENT_ID;
    const tenantId = (import.meta as any).env.VITE_AZURE_TENANT_ID || "common";

    if (!clientId) {
      setErroMicrosoft(
        "Para conectar com o Azure Entra ID / Microsoft real, configure a variável VITE_AZURE_CLIENT_ID no arquivo .env do front-end com o ID do aplicativo cadastrado no portal do Azure."
      );
      return;
    }

    const redirectUri = window.location.origin + "/login";
    const width = 500;
    const height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    // URL de autorização da Microsoft (OAuth 2.0 / OpenID Connect)
    const authUrl =
      `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/authorize?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&response_type=id_token` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent("openid profile email")}` +
      `&response_mode=fragment` +
      `&prompt=select_account` +
      `&nonce=${Date.now()}` +
      (emailHint ? `&login_hint=${encodeURIComponent(emailHint)}` : "");

    const popup = window.open(
      authUrl,
      "MicrosoftLoginPopup",
      `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no,location=yes,resizable=yes`
    );

    if (!popup || popup.closed || typeof popup.closed === "undefined") {
      setErroMicrosoft("O navegador bloqueou a janela pop-up. Por favor, habilite pop-ups para este site.");
      return;
    }

    // Monitora a janela pop-up para o caso de o usuário fechá-la ou fallback
    const timer = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(timer);
          return;
        }

        // Tenta ler o hash da URL se o popup redirecionou de volta para a mesma origem
        if (popup.location.href.includes(window.location.origin)) {
          const hash = popup.location.hash || popup.location.search;
          const params = new URLSearchParams(hash.replace(/^[#?]/, ""));
          const idToken = params.get("id_token") || params.get("access_token");
          const error = params.get("error_description") || params.get("error");

          popup.close();
          clearInterval(timer);

          if (error) {
            setErroMicrosoft(decodeURIComponent(error));
            return;
          }

          if (idToken) {
            mutationMicrosoft.mutate({
              idToken,
              ...(emailHint ? { email: emailHint } : {}),
            });
          }
        }
      } catch {
        // Cross-origin inicial enquanto o usuário navega na página de login da Microsoft (esperado)
      }
    }, 500);

    // Timeout de segurança: se após 5 minutos ainda estiver aberto, limpa o timer
    setTimeout(() => clearInterval(timer), 300000);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErroMicrosoft(null);
    const resultado = schema.safeParse(valores);
    if (!resultado.success) {
      const flat = resultado.error.flatten().fieldErrors;
      setErros({ email: flat.email?.[0], password: flat.password?.[0] });
      return;
    }
    setErros({});
    mutation.mutate(resultado.data);
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-lg bg-primary-foreground/15" aria-hidden>
            <Building2 className="size-6" />
          </div>
          <p className="text-lg font-semibold">Central de Chamados</p>
        </div>
        <div className="max-w-md space-y-4">
          <h2 className="text-3xl font-semibold leading-tight">
            Atendimento organizado para quem serve à população.
          </h2>
          <p className="text-primary-foreground/85">
            Registre solicitações, acompanhe o andamento em tempo real e mantenha o histórico completo de cada
            atendimento em um só lugar.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/70">
          Suporte institucional · segunda a sexta, 8h às 18h
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="grid size-11 place-items-center rounded-lg bg-primary text-primary-foreground" aria-hidden>
              <Building2 className="size-6" />
            </div>
          </div>

          <h1 className="text-2xl font-semibold text-foreground">Acesse sua conta</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use seu e-mail institucional e a senha cadastrada no diretório da instituição.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
            {mutation.isError && <MensagemErro erro={mutation.error} />}

            <div className="space-y-2">
              <Label htmlFor="email">E-mail institucional</Label>
              <div className="relative">
                <Mail aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nome@instituto.gov.br"
                  className="pl-9"
                  value={valores.email}
                  aria-invalid={Boolean(erros.email)}
                  aria-describedby={erros.email ? "erro-email" : undefined}
                  onChange={(e) => setValores((v) => ({ ...v, email: e.target.value }))}
                />
              </div>
              {erros.email && (
                <p id="erro-email" role="alert" className="text-sm font-medium text-destructive">
                  {erros.email}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <a
                  href="/recuperar-senha"
                  className="text-xs text-primary hover:underline"
                  onClick={(e) => {
                    e.preventDefault();
                    void router.navigate({ to: "/recuperar-senha" });
                  }}
                >
                  Esqueceu a senha?
                </a>
              </div>
              <div className="relative">
                <Lock aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pl-9"
                  value={valores.password}
                  aria-invalid={Boolean(erros.password)}
                  aria-describedby={erros.password ? "erro-senha" : undefined}
                  onChange={(e) => setValores((v) => ({ ...v, password: e.target.value }))}
                />
              </div>
              {erros.password && (
                <p id="erro-senha" role="alert" className="text-sm font-medium text-destructive">
                  {erros.password}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {mutation.isPending ? "Entrando…" : "Entrar"}
            </Button>
          </form>

          {/* Separador */}
          <div className="relative mt-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou continue com</span>
            </div>
          </div>

          {/* Botão Microsoft */}
          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full gap-3"
            disabled={mutationMicrosoft.isPending || tentandoSsoSilencioso}
            onClick={handleLoginMicrosoft}
          >
            {mutationMicrosoft.isPending || tentandoSsoSilencioso ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 23 23" aria-hidden>
                <path fill="#f35325" d="M1 1h10v10H1z" />
                <path fill="#81bc06" d="M12 1h10v10H12z" />
                <path fill="#05a6f0" d="M1 12h10v10H1z" />
                <path fill="#ffba08" d="M12 12h10v10H12z" />
              </svg>
            )}
            {tentandoSsoSilencioso
              ? "Identificando conta institucional corporativa…"
              : mutationMicrosoft.isPending
                ? "Autenticando…"
                : "Conta institucional Microsoft"}
          </Button>

          {erroMicrosoft && (
            <p role="alert" className="mt-2 text-sm font-medium text-destructive">
              {erroMicrosoft}
            </p>
          )}
          {USANDO_DEMO && (
            <div className="mt-8 rounded-lg border border-border bg-card p-4 text-sm">
              <p className="font-semibold text-foreground">Ambiente de demonstração</p>
              <p className="mt-1 text-muted-foreground">
                A API real não está configurada (<code>VITE_API_BASE_URL</code>). Use qualquer senha com 6+ caracteres
                e um dos e-mails:
              </p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>super@instituto.gov.br — superusuário</li>
                <li>admin@instituto.gov.br — administrador</li>
                <li>tecnico@instituto.gov.br — técnico</li>
                <li>usuario@instituto.gov.br — usuário</li>
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
