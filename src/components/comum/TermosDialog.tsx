import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuthStore } from "@/stores/auth";
import { TERMOS_VERSAO } from "@/types";

/**
 * Aceite obrigatório dos termos de uso e privacidade (LGPD).
 *
 * O back-end Java não possui endpoint dedicado para registro de aceite de termos,
 * portanto o aceite é registrado localmente no store de autenticação com a data/hora atual.
 * O campo `termosVersao` e `termosAceitosEm` são mantidos apenas no estado do cliente.
 */
export function TermosDialog() {
  const user = useAuthStore((s) => s.user);
  const atualizarUsuario = useAuthStore((s) => s.atualizarUsuario);
  const [marcado, setMarcado] = useState(false);
  const [aceitando, setAceitando] = useState(false);

  const aberto = Boolean(user) && user?.termosVersao !== TERMOS_VERSAO;

  function aceitar() {
    if (!user || !marcado) return;
    setAceitando(true);
    // Registra o aceite localmente — o backend Java não expõe endpoint para isso
    atualizarUsuario({
      ...user,
      termosVersao: TERMOS_VERSAO,
      termosAceitosEm: new Date().toISOString(),
    });
    toast.success("Termos aceitos", { description: "Bom atendimento!" });
    setAceitando(false);
  }

  if (!aberto) return null;

  return (
    <Dialog open>
      <DialogContent className="max-w-lg [&>button]:hidden">
        <DialogHeader>
          <DialogTitle>Termos de uso e privacidade</DialogTitle>
          <DialogDescription>
            Versão {TERMOS_VERSAO} — leia e confirme para continuar utilizando a central de chamados.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <p>
            Os dados informados nos chamados são utilizados exclusivamente para atendimento interno e registro
            administrativo, conforme a Lei Geral de Proteção de Dados (LGPD).
          </p>
          <p>
            Todas as ações realizadas no sistema — abertura, atualização, encaminhamento e resolução de chamados — são
            registradas em trilha de auditoria, com identificação do responsável, data e hora.
          </p>
          <p>
            É vedado o compartilhamento de credenciais de acesso e a inclusão de dados pessoais sensíveis
            desnecessários à solução do chamado.
          </p>
          <p>
            O titular pode solicitar informações sobre o tratamento dos seus dados à administração do sistema pelos
            canais institucionais.
          </p>
        </div>

        <label className="flex items-start gap-3 text-sm text-foreground">
          <Checkbox
            checked={marcado}
            onCheckedChange={(v) => setMarcado(v === true)}
            aria-label="Confirmo a leitura dos termos"
          />
          <span>Declaro que li e concordo com os termos de uso e com a política de privacidade.</span>
        </label>

        <div className="flex justify-end">
          <Button disabled={!marcado || aceitando} onClick={aceitar}>
            {aceitando ? "Registrando..." : "Aceitar e continuar"}
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
