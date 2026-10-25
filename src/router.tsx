import "@/lib/auth-bridge";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, // 30s de dados frescos para evitar refetch desnecessário entre navegações
        gcTime: 10 * 60 * 1000, // 10 minutos em cache de memória
        refetchOnWindowFocus: false, // Evita requisições repetidas ao alternar de janela
        refetchOnReconnect: "always",
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    defaultPreloadStaleTime: 60_000,
  });

  return router;
};
