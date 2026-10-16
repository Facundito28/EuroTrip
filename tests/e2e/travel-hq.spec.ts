import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
const TEST_PASSWORD = "Una-clave-larga-de-prueba-2027";
async function signIn(
  page: Page,
  email: string,
  create = true,
  password = TEST_PASSWORD,
) {
  await page.goto("/");
  if (create)
    await page
      .getByRole("button", { name: "Crear cuenta", exact: true })
      .click();
  await page.getByLabel("Correo electrónico").fill(email);
  await page
    .getByLabel(create ? "Elegí una contraseña" : "Contraseña", { exact: true })
    .fill(password);
  if (create) await page.getByLabel("Repetí la contraseña").fill(password);
  await page
    .getByRole("button", {
      name: create ? "Crear mi cuenta" : "Entrar a Travel HQ",
      exact: true,
    })
    .click();
}
async function navigate(page: Page, name: string) {
  const menu = page.getByRole("button", { name: "Abrir menú" });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("button", { name, exact: true })
    .click();
}
test.beforeEach(async ({ request }) => {
  await request.get("http://127.0.0.1:54329/reset");
});
test("private endpoints reject anonymous requests; login fits the viewport", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Bienvenido al viaje" }),
  ).toBeVisible();
  expect((await request.get("/export")).status()).toBe(401);
  expect(
    (
      await request.get("/receipts/11111111-1111-4111-8111-111111111111")
    ).status(),
  ).toBe(401);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  expect((await manifest.json()).display).toBe("standalone");
});
test("real SQL workflow: create trip, budget, expenses, transfers, itinerary, scenarios, CSV", async ({
  page,
  browser,
}, info) => {
  const email = `owner-${info.project.name}@example.test`;
  await signIn(page, email);
  await page
    .getByText("Soy el organizador: crear un viaje", { exact: true })
    .click();
  await page.getByLabel("Tu nombre", { exact: true }).fill("Viajero de prueba");
  await page.getByRole("button", { name: "Crear mi viaje" }).click();
  await expect(
    page.getByRole("heading", { name: "Tu viaje, bajo control." }),
  ).toBeVisible();
  const sessionCookies = (await page.context().cookies()).filter(
    (c) => c.name.startsWith("sb-") && c.name.includes("auth-token"),
  );
  expect(sessionCookies.length).toBeGreaterThan(0);
  expect(sessionCookies.every((c) => c.httpOnly && c.sameSite === "Lax")).toBe(
    true,
  );
  await navigate(page, "Configuración");
  await page.getByLabel("Presupuesto total del grupo").fill("4000");
  await page.getByRole("button", { name: "Guardar configuración" }).click();
  await expect(page.getByText("Configuración guardada.")).toBeVisible();
  await navigate(page, "Equipo");
  await page
    .getByLabel("Correo del integrante")
    .fill(`friend-${info.project.name}@example.test`);
  await page
    .getByRole("button", { name: "Generar invitación", exact: true })
    .click();
  const code = await page
    .getByLabel("Código privado de invitación")
    .inputValue();
  expect(code).toMatch(/^[a-f0-9]{32}$/);
  const friend = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const friendPage = await friend.newPage();
  await signIn(friendPage, `friend-${info.project.name}@example.test`);
  await expect(
    friendPage.getByRole("heading", { name: "El viaje empieza acá" }),
  ).toBeVisible();
  await friendPage
    .getByLabel("Código de invitación", { exact: true })
    .fill(code);
  await friendPage
    .getByRole("button", { name: "Unirme al viaje", exact: true })
    .click();
  await expect(
    friendPage.getByRole("heading", { name: "Tu viaje, bajo control." }),
  ).toBeVisible();
  await friend.close();
  await page.getByRole("button", { name: "Actualizar datos" }).click();
  await expect(page.getByText("2 de 4 lugares ocupados")).toBeVisible();
  await navigate(page, "Gastos");
  await page
    .getByRole("button", { name: "Cargar gasto", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Descripción", { exact: true })
    .fill("Cena compartida de prueba");
  await dialog.getByLabel("Importe original").fill("100,01");
  await dialog
    .getByRole("button", { name: "Guardar gasto", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Cena compartida de prueba" }),
  ).toBeVisible();
  // A 5 MiB receipt must bypass the Next.js action body and go directly to Storage.
  await page
    .getByText("Detalles, acciones y comprobantes", { exact: false })
    .click();
  await page.getByRole("button", { name: "Comprobante", exact: true }).click();
  const receipt = page.getByRole("dialog");
  const png = readFileSync("public/icon-192.png");
  const receiptBytes = Buffer.concat([
    png,
    Buffer.alloc(5 * 1024 * 1024 - png.length),
  ]);
  let biggestServerPost = 0;
  const inspectPost = (request: import("@playwright/test").Request) => {
    if (
      request.method() === "POST" &&
      request.url().startsWith("http://127.0.0.1:3100/")
    )
      biggestServerPost = Math.max(
        biggestServerPost,
        request.postDataBuffer()?.length ?? 0,
      );
  };
  page.on("request", inspectPost);
  await receipt
    .getByLabel("Comprobante de Cena compartida de prueba")
    .setInputFiles({
      name: "comprobante-5mb.png",
      mimeType: "image/png",
      buffer: receiptBytes,
    });
  await receipt
    .getByRole("button", { name: "Subir comprobante", exact: true })
    .click();
  await expect(receipt).not.toBeVisible();
  page.off("request", inspectPost);
  expect(biggestServerPost).toBeLessThan(128 * 1024);
  await expect(
    page.getByRole("link", { name: "comprobante-5mb.png" }),
  ).toBeVisible();
  await navigate(page, "Saldos");
  await expect(page.locator(".transfer").first()).toBeVisible();
  const suggested = await page.locator(".transfer strong").first().innerText();
  await page
    .getByRole("button", { name: "Transferencia", exact: true })
    .click();
  const transfer = page.getByRole("dialog");
  await transfer
    .getByLabel("Quién envió")
    .selectOption({ label: `friend-${info.project.name}` });
  await transfer
    .getByLabel("Quién recibió")
    .selectOption({ label: "Viajero de prueba" });
  await transfer
    .getByLabel("Importe original")
    .fill(suggested.replace(/[^0-9,]/g, ""));
  await transfer
    .getByRole("button", { name: "Registrar transferencia", exact: true })
    .click();
  await expect(transfer).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Todo en equilibrio" }),
  ).toBeVisible();
  await navigate(page, "Itinerario");
  await page.getByRole("button", { name: "Agregar evento" }).click();
  const event = page.getByRole("dialog");
  await event
    .getByLabel("Título", { exact: true })
    .fill("Alojamiento de prueba");
  await event.getByLabel("Ciudad / destino").fill("Madrid");
  await event.getByLabel("Vincular gasto / reserva").selectOption({ index: 1 });
  await event.getByRole("button", { name: "Guardar en itinerario" }).click();
  await expect(event).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Alojamiento de prueba" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "22 de abril de 2027, 1 eventos" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mes siguiente" }).click();
  await expect(
    page.getByText("mayo de 2027", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mes anterior" }).click();

  await navigate(page, "Escenarios");
  await page.getByRole("button", { name: "Nuevo escenario" }).click();
  const scenario = page.getByRole("dialog");
  await scenario
    .getByLabel("Nombre de la alternativa")
    .fill("Alternativa de prueba");
  await scenario.getByRole("button", { name: "Crear escenario" }).click();
  await expect(scenario).not.toBeVisible();
  await page.getByRole("button", { name: "Agregar precio" }).click();
  const price = page.getByRole("dialog");
  await price
    .getByLabel("Concepto", { exact: true })
    .fill("Cotización registrada");
  await price.getByLabel("Importe original").fill("50");
  await price.getByLabel("Calidad del precio").selectOption("quoted");
  await price
    .getByLabel("Fuente / referencia")
    .fill("Proveedor de prueba, solo para test");
  await price
    .getByRole("button", { name: "Agregar precio", exact: true })
    .click();
  await expect(price).not.toBeVisible();
  await expect(
    page.getByText("Cotización registrada", { exact: true }),
  ).toBeVisible();
  await navigate(page, "Resumen");
  await expect(
    page.locator(".stat-card").filter({ hasText: "Gastos reales" }),
  ).toContainText("100,01");
  await expect(
    page.getByRole("heading", { name: "Una mirada al presupuesto" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/dashboard-${info.project.name}.png`,
    fullPage: true,
  });
  const csv = await page.request.get("/export");
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain("Cena compartida de prueba");
  expect(await csv.text()).not.toContain("Cotización registrada");
  await navigate(page, "Configuración");
  await page
    .getByLabel("Contraseña actual", { exact: true })
    .fill(TEST_PASSWORD);
  await page
    .getByLabel("Elegí una contraseña", { exact: true })
    .fill("Mi-nueva-clave-segura-2027");
  await page
    .getByLabel("Repetí la contraseña", { exact: true })
    .fill("Mi-nueva-clave-segura-2027");
  await page
    .getByRole("button", { name: "Cambiar contraseña", exact: true })
    .click();
  await expect(
    page.getByText("Contraseña actualizada.", { exact: false }),
  ).toBeVisible();
  const mobileMenu = page.getByRole("button", { name: "Abrir menú" });
  if (await mobileMenu.isVisible()) await mobileMenu.click();
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bienvenido al viaje" }),
  ).toBeVisible();
  await signIn(page, email, false, "Mi-nueva-clave-segura-2027");
  await expect(
    page.getByRole("heading", { name: "Tu viaje, bajo control." }),
  ).toBeVisible();
  await expect(
    page.locator(".stat-card").filter({ hasText: "Gastos reales" }),
  ).toContainText("100,01");
});

test("PWA shows offline fallback and never caches private pages", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const urls = [];
    for (const key of keys) {
      const cache = await caches.open(key);
      urls.push(...(await cache.keys()).map((r) => new URL(r.url).pathname));
    }
    return urls;
  });
  expect(cached).toContain("/offline.html");
  expect(cached).not.toContain("/");
  expect(cached).not.toContain("/export");
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Una pausa en el camino." }),
  ).toBeVisible();
});
