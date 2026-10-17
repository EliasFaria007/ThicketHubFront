import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 20_000, // 20s de dados frescos para evitar refetch imediato entre telas
        gcTime: 10 * 60 * 1000, // 10 minutos em cache de memória
        refetchOnWindowFocus: false, // Evita requisições repetidas ao alternar de janela
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
