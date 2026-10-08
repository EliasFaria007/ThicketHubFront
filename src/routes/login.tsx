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
import { login } from "@/services/auth";
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

  useEffect(() => {
    if (hidratado && token) void router.navigate({ to: "/", replace: true });
  }, [hidratado, token, router]);

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      entrar(data);
      void router.navigate({ to: "/", replace: true });
    },
  });

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
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
