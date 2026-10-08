import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Building2, CheckCircle2, Loader2, Lock, Mail, MessageSquare, Phone } from "lucide-react";
import { useState } from "react";

import { MensagemErro } from "@/components/comum/MensagemErro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmarResetSenhaSms, solicitarResetSenhaSms } from "@/services/auth";

export const Route = createFileRoute("/recuperar-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Recuperar senha — Central de Chamados" },
      { name: "description", content: "Redefina sua senha institucional com verificação via SMS." },
    ],
  }),
  component: RecuperarSenhaPage,
});

type Etapa = "email" | "codigo" | "sucesso";

function RecuperarSenhaPage() {
  const [etapa, setEtapa] = useState<Etapa>("email");
  const [email, setEmail] = useState("");
  const [telefoneMascarado, setTelefoneMascarado] = useState("");
  const [codigoDemo, setCodigoDemo] = useState<string | undefined>(undefined);
  const [codigo, setCodigo] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const solicitar = useMutation({
    mutationFn: () => solicitarResetSenhaSms({ email: email.trim() }),
    onSuccess: (data) => {
      setTelefoneMascarado(data.telefoneMascarado ?? "");
      setCodigoDemo(data.codigoDemo);
      setEtapa("codigo");
    },
  });

  const confirmar = useMutation({
    mutationFn: () =>
      confirmarResetSenhaSms({ email: email.trim(), codigo: codigo.trim(), novaSenha }),
    onSuccess: () => setEtapa("sucesso"),
  });

  const senhasIguais = novaSenha === confirmarSenha;
  const senhaValida = novaSenha.length >= 6;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo institucional */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg"
            aria-hidden
          >
            <Building2 className="size-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Recuperar senha</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Verificação de identidade via SMS institucional
            </p>
          </div>
        </div>

        <section className="surface-card space-y-6 p-6">
          {/* Etapa 1 — e-mail */}
          {etapa === "email" && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="size-4 shrink-0 text-primary" />
                <span>Informe seu e-mail institucional para enviarmos o código SMS ao telefone cadastrado.</span>
              </div>

              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  solicitar.mutate();
                }}
              >
                {solicitar.isError && <MensagemErro erro={solicitar.error} />}

                <div className="space-y-1.5">
                  <Label htmlFor="email-reset">E-mail institucional</Label>
                  <div className="relative">
                    <Mail aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email-reset"
                      type="email"
                      autoComplete="email"
                      placeholder="nome@instituto.gov.br"
                      className="pl-9"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={!email.includes("@") || solicitar.isPending}>
                  {solicitar.isPending && <Loader2 className="size-4 animate-spin" />}
                  {solicitar.isPending ? "Enviando SMS…" : "Enviar código SMS"}
                </Button>
              </form>
            </>
          )}

          {/* Etapa 2 — código SMS + nova senha */}
          {etapa === "codigo" && (
            <>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                <Phone className="size-4 shrink-0 text-primary" />
                <span>
                  Código enviado para <strong className="text-foreground">{telefoneMascarado}</strong>.
                  Expira em 10 minutos.
                </span>
              </div>

              {codigoDemo && (
                <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
                  <MessageSquare className="size-4 shrink-0" />
                  <span>
                    <strong>Demonstração —</strong> código SMS: <strong>{codigoDemo}</strong>
                  </span>
                </div>
              )}

              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (senhaValida && senhasIguais) confirmar.mutate();
                }}
              >
                {confirmar.isError && <MensagemErro erro={confirmar.error} />}

                <div className="space-y-1.5">
                  <Label htmlFor="codigo-sms">Código de verificação (6 dígitos)</Label>
                  <Input
                    id="codigo-sms"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    className="text-center tracking-widest text-lg font-semibold"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="nova-senha">Nova senha</Label>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => setMostrarSenha(!mostrarSenha)}
                    >
                      {mostrarSenha ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="nova-senha"
                      type={mostrarSenha ? "text" : "password"}
                      placeholder="Mínimo 6 caracteres"
                      className="pl-9"
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmar-senha">Confirmar nova senha</Label>
                  <div className="relative">
                    <Lock aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirmar-senha"
                      type={mostrarSenha ? "text" : "password"}
                      placeholder="Repita a nova senha"
                      className="pl-9"
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                    />
                  </div>
                  {confirmarSenha && !senhasIguais && (
                    <p className="text-sm text-destructive">As senhas não coincidem.</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    codigo.length !== 6 || !senhaValida || !senhasIguais || confirmar.isPending
                  }
                >
                  {confirmar.isPending && <Loader2 className="size-4 animate-spin" />}
                  {confirmar.isPending ? "Redefinindo…" : "Redefinir senha"}
                </Button>

                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => setEtapa("email")}
                >
                  <ArrowLeft className="size-3.5" />
                  Usar outro e-mail
                </button>
              </form>
            </>
          )}

          {/* Etapa 3 — sucesso */}
          {etapa === "sucesso" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle2 className="size-12 text-green-500" />
              <h2 className="text-lg font-semibold text-foreground">Senha redefinida com sucesso!</h2>
              <p className="text-sm text-muted-foreground">
                Sua senha institucional foi atualizada. Faça login com as novas credenciais.
              </p>
              <Link to="/login">
                <Button className="mt-2">Ir para o login</Button>
              </Link>
            </div>
          )}
        </section>

        {etapa !== "sucesso" && (
          <p className="text-center text-sm text-muted-foreground">
            <Link to="/login" className="text-primary hover:underline">
              ← Voltar para o login
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
