import { useRouter } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { EmptyState } from "@/components/comum/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { podeExecutar, useAuthStore } from "@/stores/auth";
import "@/lib/auth-bridge";

export function RotaProtegida({ permissao, children }: { permissao?: string; children: ReactNode }) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const papel = useAuthStore((s) => s.user?.papel);
  const hidratado = useAuthStore((s) => s.hidratado);

  useEffect(() => {
    if (hidratado && !token) {
      void router.navigate({ to: "/login", replace: true });
    }
  }, [hidratado, token, router]);

  if (!hidratado) {
    return (
      <div className="min-h-screen space-y-4 p-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!token) return null;

  if (permissao && !podeExecutar(papel, permissao)) {
    return (
      <EmptyState
        icone={<ShieldAlert className="size-7" />}
        titulo="Acesso restrito"
        descricao="Seu perfil não possui permissão para acessar esta área. Fale com a administração do sistema."
      />
    );
  }

  return <>{children}</>;
}
