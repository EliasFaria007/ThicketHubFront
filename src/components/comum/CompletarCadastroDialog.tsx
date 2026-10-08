import { useMutation } from "@tanstack/react-query";
import { Building, Eye, EyeOff, KeyRound, Lock, MapPin, Phone, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completarCadastro } from "@/services/auth";
import { useAuthStore } from "@/stores/auth";
import { TERMOS_VERSAO } from "@/types";

export function CompletarCadastroDialog() {
  const user = useAuthStore((s) => s.user);
  const atualizarUsuario = useAuthStore((s) => s.atualizarUsuario);

  const [telefone, setTelefone] = useState(user?.telefone ?? "");
  const [localidade, setLocalidade] = useState(user?.localidade ?? "");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);

  // Abre SOMENTE se o back-end Java sinalizou que o primeiro acesso ainda não foi concluído.
  // Não usamos a ausência de telefone/localidade como critério pois esses campos
  // não são retornados pela resposta de login — sempre chegariam como undefined.
  const termosAceitos = user?.termosVersao === TERMOS_VERSAO;
  const cadastroPendente = user?.primeiroAcessoConcluido === false;
  const aberto = Boolean(user) && termosAceitos && cadastroPendente;

  const salvar = useMutation({
    mutationFn: () =>
      completarCadastro({
        novaSenha: novaSenha.trim(),
        telefone: telefone.trim(),
        localidade: localidade.trim(),
      }),
    onSuccess: (atualizado) => {
      if (user) {
        atualizarUsuario({
          ...user,
          ...atualizado,
          primeiroAcessoConcluido: true,
        });
      }
      toast.success("Cadastro institucional concluído com sucesso!", {
        description: "Nova senha, telefone e localidade registrados.",
      });
    },
    onError: (erro: Error) => toast.error("Não foi possível salvar", { description: erro.message }),
  });

  if (!aberto) return null;

  const telefoneValido = telefone.replace(/\D/g, "").length >= 10;
  const localidadeValida = localidade.trim().length >= 3;
  const senhaValida = novaSenha.trim().length >= 8;
  const senhasIguais = novaSenha === confirmarSenha;
  const valido = telefoneValido && localidadeValida && senhaValida && senhasIguais;

  return (
    <Dialog open>
      <DialogContent className="max-w-lg [&>button]:hidden">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="size-5" />
            <DialogTitle>Complete seu cadastro institucional</DialogTitle>
          </div>
          <DialogDescription>
            Este é seu primeiro acesso. Defina uma nova senha pessoal e informe seus dados de contato e
            localização física para garantir a segurança da conta.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (valido) salvar.mutate();
          }}
        >
          {/* Nova senha */}
          <div className="space-y-1.5">
            <Label htmlFor="onboarding-nova-senha">Nova senha</Label>
            <div className="relative">
              <Lock aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="onboarding-nova-senha"
                type={mostrarSenha ? "text" : "password"}
                placeholder="Mínimo 8 caracteres"
                className="pl-9 pr-10"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setMostrarSenha((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {novaSenha.length > 0 && !senhaValida && (
              <p className="text-xs text-destructive">A senha deve ter pelo menos 8 caracteres.</p>
            )}
          </div>

          {/* Confirmar senha */}
          <div className="space-y-1.5">
            <Label htmlFor="onboarding-confirmar-senha">Confirmar nova senha</Label>
            <div className="relative">
              <KeyRound aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="onboarding-confirmar-senha"
                type={mostrarConfirmar ? "text" : "password"}
                placeholder="Repita a nova senha"
                className="pl-9 pr-10"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                aria-label={mostrarConfirmar ? "Ocultar confirmação" : "Mostrar confirmação"}
                onClick={() => setMostrarConfirmar((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {mostrarConfirmar ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {confirmarSenha.length > 0 && !senhasIguais && (
              <p className="text-xs text-destructive">As senhas não coincidem.</p>
            )}
          </div>

          {/* Telefone */}
          <div className="space-y-1.5">
            <Label htmlFor="onboarding-telefone">Telefone celular com DDD</Label>
            <div className="relative">
              <Phone aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="onboarding-telefone"
                placeholder="(31) 98765-4321"
                className="pl-9"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Utilizado para envio de SMS de segurança e notificações urgentes.
            </p>
          </div>

          {/* Localidade */}
          <div className="space-y-1.5">
            <Label htmlFor="onboarding-localidade">Localidade / Lotação física</Label>
            <div className="relative">
              <MapPin aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="onboarding-localidade"
                placeholder="Ex.: Sede Principal - 3º Andar - Sala 302"
                className="pl-9"
                value={localidade}
                onChange={(e) => setLocalidade(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Ex.: Prédio, Bloco, Andar ou Sala onde você trabalha.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground flex items-center gap-2">
            <Building className="size-4 shrink-0 text-primary" />
            <span>Você poderá atualizar telefone e localidade a qualquer momento na aba Meu Perfil.</span>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={!valido || salvar.isPending}>
              {salvar.isPending ? "Salvando…" : "Confirmar e acessar o sistema"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
