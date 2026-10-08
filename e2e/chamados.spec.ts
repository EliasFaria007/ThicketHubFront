import { expect, test, type Page } from "@playwright/test";

const SENHA = "demo123456";

async function aceitarTermos(page: Page) {
  const dialogo = page.getByRole("dialog");
  const visivel = await dialogo
    .waitFor({ state: "visible", timeout: 8_000 })
    .then(() => true)
    .catch(() => false);
  if (!visivel) return;
  await dialogo.getByRole("checkbox").click();
  await dialogo.getByRole("button", { name: "Aceitar e continuar" }).click();
  await expect(dialogo).toBeHidden({ timeout: 15_000 });
}


async function irPara(page: Page, url: string) {
  await page.goto(url);
  await aceitarTermos(page);
}

async function entrar(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail institucional").fill(email);
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);

  await aceitarTermos(page);
}

test.describe("acesso e permissões", () => {
  test("rota protegida redireciona visitante para o login", async ({ page }) => {
    await irPara(page, "/chamados");
    await expect(page).toHaveURL(/\/login/);
  });

  test("usuário comum não vê catálogo, relatórios nem auditoria", async ({ page }) => {
    await entrar(page, "usuario@instituto.gov.br");
    const nav = page.getByRole("navigation").first();
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await expect(nav.getByRole("link", { name: /Chamados/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Catálogo/ })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: /Relatórios/ })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: /Auditoria/ })).toHaveCount(0);
  });

  test("admin acessa relatórios e auditoria, mas não gerencia catálogo", async ({ page }) => {
    await entrar(page, "admin@instituto.gov.br");
    const nav = page.getByRole("navigation").first();
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await expect(nav.getByRole("link", { name: /Relatórios/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Auditoria/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Catálogo/ })).toHaveCount(0);
  });

  test("superusuário gerencia o catálogo e o SLA", async ({ page }) => {
    await entrar(page, "super@instituto.gov.br");
    await irPara(page, "/catalogo");
    await expect(page.getByRole("heading", { name: /Catálogo de serviços/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Adicionar serviço/ })).toBeVisible();
  });
});

test.describe("fluxo de chamados", () => {
  test("usuário abre chamado pelo catálogo e recebe protocolo", async ({ page }) => {
    await entrar(page, "usuario@instituto.gov.br");
    await irPara(page, "/chamados");
    await irPara(page, "/chamados/novo");

    await page.getByLabel("Assunto").fill("Impressora do atendimento sem resposta");
    await page.getByLabel(/Descrição/).fill(
      "A impressora do balcão de atendimento não imprime desde o início da manhã e já foi reiniciada.",
    );
    await page.getByLabel(/Serviço do catálogo/).selectOption({ index: 1 });
    await page.getByRole("button", { name: /Abrir chamado/ }).click();

    await expect(page.getByText(/CH-\d{4}-\d{6}/).first()).toBeVisible({ timeout: 15_000 });
  });

  test("usuário não vê ações de atendimento no próprio chamado", async ({ page }) => {
    await entrar(page, "usuario@instituto.gov.br");
    await irPara(page, "/chamados");
    await page.locator("tbody a").first().click();
    await expect(page.getByRole("button", { name: /Assumir/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Encaminhar/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Salvar atendimento/ })).toHaveCount(0);
  });

  test("técnico não enxerga chamados de setor não liberado", async ({ page }) => {
    await entrar(page, "tecnico@instituto.gov.br");
    await irPara(page, "/chamados");
    await expect(page.getByText(/CH-\d{4}-\d{6}/).first()).toBeVisible({ timeout: 15_000 });
    await irPara(page, "/chamados?setor=Financeiro");
    await expect(page.getByText(/CH-\d{4}-\d{6}/)).toHaveCount(0);
  });
});
