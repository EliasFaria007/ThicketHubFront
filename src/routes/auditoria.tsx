import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ScrollText, Search } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/comum/EmptyState";
import { MensagemErro } from "@/components/comum/MensagemErro";
import { PaginacaoBarra } from "@/components/comum/Paginacao";
import { SkeletonTabela } from "@/components/comum/Skeletons";
import { AppLayout } from "@/components/layout/AppLayout";
import { RotaProtegida } from "@/components/layout/RotaProtegida";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dataHora } from "@/lib/format";
import { textoSeguro } from "@/lib/sanitize";
import { listarAuditoria } from "@/services/auditoria";
import { useAuthStore } from "@/stores/auth";

export const Route = createFileRoute("/auditoria")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Trilha de auditoria — Central de Chamados" },
      {
        name: "description",
        content: "Consulte o registro completo de ações realizadas na central de chamados, com autor, data e hora.",
      },
      { property: "og:title", content: "Trilha de auditoria — Central de Chamados" },
      { property: "og:description", content: "Rastreabilidade das ações administrativas e de atendimento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RotaProtegida permissao="auditoria:ler">
      <AuditoriaPage />
    </RotaProtegida>
  ),
});

function AuditoriaPage() {
  const user = useAuthStore((s) => s.user);
  const [termo, setTermo] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const { data, isPending, isError, error, isFetching } = useQuery({
    queryKey: ["auditoria", q, page, user?.id],
    queryFn: () => listarAuditoria({ q, page, limit: 15 }),
    placeholderData: keepPreviousData,
  });

  const ehTecnico = user?.papel === "tecnico";

  return (
    <AppLayout
      titulo={ehTecnico ? "Minha trilha de auditoria" : "Trilha de auditoria"}
      descricao={
        ehTecnico
          ? "Histórico das ações técnicas e atendimentos realizados pela sua conta"
          : "Histórico completo de ações e operações registradas no sistema"
      }
    >
      <div className="space-y-4">
        {ehTecnico && (
          <div className="rounded-lg border border-primary/20 bg-primary-soft/50 p-3 text-xs text-foreground">
            <strong>Perfil Técnico:</strong> Exibindo apenas os registros de auditoria de eventos e chamados executados por você.
          </div>
        )}
        <form
          className="surface-card flex flex-wrap items-end gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQ(termo.trim());
          }}
        >
          <div className="min-w-56 flex-1 space-y-1.5">
            <Label htmlFor="busca-auditoria">Buscar registro</Label>
            <div className="relative">
              <Search aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="busca-auditoria"
                className="pl-9"
                placeholder="Ação, responsável ou detalhe"
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit">Buscar</Button>
        </form>

        <section className="surface-card overflow-hidden" aria-busy={isFetching}>
          {isError ? (
            <div className="p-4">
              <MensagemErro erro={error} />
            </div>
          ) : isPending ? (
            <SkeletonTabela />
          ) : data.items.length === 0 ? (
            <EmptyState
              icone={<ScrollText className="size-7" />}
              titulo="Nenhum registro encontrado"
              descricao="Ajuste a busca para localizar ações registradas na trilha de auditoria."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Registros de auditoria</caption>
                  <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">Data e hora</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Ação</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Detalhe</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Responsável</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Origem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.items.map((registro) => (
                      <tr key={registro.id} className="transition-soft hover:bg-muted/50">
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {dataHora(registro.criadoEm)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-secondary/12 px-2.5 py-1 text-xs font-medium text-secondary">
                            {textoSeguro(registro.acao, 40)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-foreground">{textoSeguro(registro.detalhe, 160)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{textoSeguro(registro.usuarioNome, 60)}</td>
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">{registro.ip}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginacaoBarra
                page={data.page}
                totalPages={data.totalPages}
                total={data.total}
                limit={data.limit}
                onChange={setPage}
              />
            </>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
