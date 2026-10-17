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
  expect((await request.get("/itinerary.ics")).status()).toBe(401);
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
  const budgetPanel = page.locator(".personal-budget");
  await budgetPanel
    .getByRole("button", { name: "Definir mi presupuesto", exact: true })
    .click();
  await page.getByLabel("Mi presupuesto personal · EUR").fill("1000");
  await page
    .getByRole("button", { name: "Guardar mi presupuesto", exact: true })
    .click();
  await expect(
    budgetPanel.getByRole("button", {
      name: "Editar mi presupuesto",
      exact: true,
    }),
  ).toBeVisible();
  await budgetPanel
    .getByText("Configurar cotización USD/EUR", { exact: true })
    .click();
  await page.getByLabel("Dólares por 1 euro").fill("1.10");
  await page
    .getByRole("button", { name: "Guardar cotización", exact: true })
    .click();
  await expect(
    page.getByText(
      "Cotización de consulta guardada. Los gastos originales no cambiaron.",
    ),
  ).toBeVisible();
  await page.getByLabel("Moneda de los totales").selectOption("USD");
  await expect(budgetPanel.locator(".personal-totals").first()).toContainText(
    "1.100,00",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Moneda de los totales").selectOption("EUR");
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
  await navigate(friendPage, "Equipo");
  await friendPage
    .getByRole("button", { name: "Editar mi nombre", exact: true })
    .click();
  await friendPage.getByLabel("Mi nombre", { exact: true }).fill("Joaquín");
  await friendPage
    .getByRole("button", { name: "Guardar nombre", exact: true })
    .click();
  await expect(
    friendPage.locator(".team-list strong").filter({ hasText: "Joaquín" }),
  ).toBeVisible();
  await expect(
    friendPage.getByRole("button", { name: "Editar nombre", exact: true }),
  ).toHaveCount(0);
  expect(
    await friendPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await friend.close();
  await page.getByRole("button", { name: "Actualizar datos" }).click();
  await expect(page.getByText("2 de 4 lugares ocupados")).toBeVisible();
  await page
    .getByRole("button", { name: "Editar nombre", exact: true })
    .click();
  await page
    .getByLabel("Nombre del integrante", { exact: true })
    .fill("Joaquín Gaffet");
  await page
    .getByRole("button", { name: "Guardar nombre", exact: true })
    .click();
  await expect(
    page.locator(".team-list strong").filter({ hasText: "Joaquín Gaffet" }),
  ).toBeVisible();
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
    .selectOption({ label: "Joaquín Gaffet" });
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
  await event
    .getByLabel("Lugar o dirección", { exact: true })
    .fill("Museo del Prado");
  await event.getByLabel("Hora de inicio").fill("10:00");
  await event.getByLabel("Hora de fin").fill("12:00");
  await event.getByLabel("Vincular gasto / reserva").selectOption({ index: 1 });
  await event.getByRole("button", { name: "Guardar en itinerario" }).click();
  await expect(event).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Alojamiento de prueba" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "22 de abril de 2027, 1 eventos" }),
  ).toBeVisible();
  const agendaLink = page.getByRole("link", {
    name: "Descargar agenda (.ics)",
  });
  const agenda = await page.request.get(
    (await agendaLink.getAttribute("href"))!,
  );
  expect(agenda.status()).toBe(200);
  expect(await agenda.text()).toContain("DTSTART:20270422T080000Z");
  expect(
    await page
      .getByRole("link", { name: "Agregar a Google Calendar" })
      .getAttribute("href"),
  ).toContain("calendar.google.com");
  // Avoid external provider requests in local functional tests.
  await page.route("https://maps.google.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<p>map provider test</p>",
    }),
  );
  await page.getByText("Ver lugar en el mapa", { exact: true }).click();
  const eventMap = page.locator(".event-map");
  await eventMap.getByRole("button", { name: "Buscar en el mapa" }).click();
  await expect(eventMap.locator("iframe")).toHaveAttribute("src", /Museo/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
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
test("advanced expenses: quick entry, unequal shares, installments, repeat and activity", async ({
  page,
  browser,
}, info) => {
  const email = `advanced-${info.project.name}@example.test`;
  await signIn(page, email);
  await page
    .getByText("Soy el organizador: crear un viaje", { exact: true })
    .click();
  await page
    .getByLabel("Tu nombre", { exact: true })
    .fill("Organizador cuotas");
  await page.getByRole("button", { name: "Crear mi viaje" }).click();
  await expect(
    page.getByRole("heading", { name: "Tu viaje, bajo control." }),
  ).toBeVisible();
  await navigate(page, "Equipo");
  const friendEmail = `quota-${info.project.name}@example.test`;
  await page.getByLabel("Correo del integrante").fill(friendEmail);
  await page
    .getByRole("button", { name: "Generar invitación", exact: true })
    .click();
  const code = await page
    .getByLabel("Código privado de invitación")
    .inputValue();
  const context = await browser.newContext();
  const fp = await context.newPage();
  await signIn(fp, friendEmail);
  await fp.getByLabel("Código de invitación", { exact: true }).fill(code);
  await fp
    .getByRole("button", { name: "Unirme al viaje", exact: true })
    .click();
  await expect(
    fp.getByRole("heading", { name: "Tu viaje, bajo control." }),
  ).toBeVisible();
  await context.close();
  await page.getByRole("button", { name: "Actualizar datos" }).click();
  await navigate(page, "Resumen");
  await page
    .locator(".quick-expenses")
    .getByRole("button", { name: "Alojamiento", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("combobox", { name: "Categoría", exact: true }),
  ).toHaveValue("Alojamiento");
  await dialog.getByLabel("Descripción", { exact: true }).fill("Airbnb cuotas");
  await dialog.getByLabel("Importe original").fill("800");
  await dialog
    .getByRole("combobox", { name: "Estado", exact: true })
    .selectOption("reserved");
  await dialog.getByLabel("Cómo dividir").selectOption("percent");
  await dialog.getByLabel("Organizador cuotas · %", { exact: true }).fill("60");
  await dialog
    .getByLabel(`quota-${info.project.name} · %`, { exact: true })
    .fill("40");
  await dialog
    .getByRole("button", { name: "Guardar gasto", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await navigate(page, "Gastos");
  const row = page.locator(".expense-row").filter({
    has: page.getByRole("heading", { name: "Airbnb cuotas", exact: true }),
  });
  await row.locator(":scope > details > summary").click();
  await row.getByText("Registrar anticipo o cuota", { exact: true }).click();
  await row.getByLabel("Importe del pago · EUR", { exact: true }).fill("200");
  await row
    .getByLabel("Quién pagó esta cuota")
    .selectOption({ label: `quota-${info.project.name}` });
  await row
    .getByRole("button", { name: "Registrar pago", exact: true })
    .click();
  await expect(row.locator(".expense-payments > p")).toContainText("200,00");
  await expect(row.locator(".expense-payments > p")).toContainText("600,00");
  await row.getByLabel("Importe del pago · EUR", { exact: true }).fill("600");
  await row
    .getByLabel("Quién pagó esta cuota")
    .selectOption({ label: "Organizador cuotas" });
  await row
    .getByRole("button", { name: "Registrar pago", exact: true })
    .click();
  await expect(row.locator(".badge").first()).toHaveText("Pagado");
  await expect(row.locator(".payment-row")).toHaveCount(2);
  await row.getByRole("button", { name: "Repetir gasto", exact: true }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Importe original")).toHaveValue("800.00");
  await dialog.getByLabel("Descripción", { exact: true }).fill("Otra estadía");
  await dialog.getByLabel("Importe original").fill("10");
  await dialog
    .getByRole("button", { name: "Guardar gasto", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const copy = page.locator(".expense-row").filter({
    has: page.getByRole("heading", { name: "Otra estadía", exact: true }),
  });
  await copy.locator(":scope > details > summary").click();
  await expect(copy.locator(".payment-row")).toHaveCount(1);
  await navigate(page, "Actividad");
  await expect(
    page.getByRole("heading", { name: "Actividad reciente", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".activity-list")).toContainText("Airbnb cuotas");
  await expect(page.locator(".activity-list")).toContainText("pago");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("private spending, visible budget editing and mobile form containment", async ({
  page,
  browser,
}, info) => {
  await signIn(page, `privacy-owner-${info.project.name}@example.test`);
  await page
    .getByText("Soy el organizador: crear un viaje", { exact: true })
    .click();
  await page
    .getByLabel("Tu nombre", { exact: true })
    .fill("Organizador privado");
  await page.getByRole("button", { name: "Crear mi viaje" }).click();
  const panel = page.locator(".personal-budget");
  await panel
    .getByRole("button", { name: "Definir mi presupuesto", exact: true })
    .click();
  await page.getByLabel("Mi presupuesto personal · EUR").fill("500");
  await page
    .getByRole("button", { name: "Guardar mi presupuesto", exact: true })
    .click();
  await expect(
    panel.getByRole("button", { name: "Editar mi presupuesto", exact: true }),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: "Agregar gasto personal", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Descripción", { exact: true })
    .fill("Hamburguesa privada");
  await dialog.getByLabel("Importe original", { exact: true }).fill("12.50");
  const contained = await dialog.evaluate((el) => {
    const bounds = el.getBoundingClientRect();
    return Array.from(
      el.querySelectorAll("input:not([type=hidden]),select,textarea"),
    ).every((input) => {
      const r = input.getBoundingClientRect();
      return r.left >= bounds.left && r.right <= bounds.right;
    });
  });
  expect(contained).toBe(true);
  await page.screenshot({
    path: `test-results/private-form-${info.project.name}.png`,
  });
  await dialog
    .getByRole("button", { name: "Guardar solo para mí", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(panel.locator(".personal-totals").first()).toContainText(
    "12,50",
  );
  await panel
    .getByRole("button", { name: "Ver mis gastos privados", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hamburguesa privada", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Editar gasto personal", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Importe original").fill("15");
  await dialog
    .getByRole("button", { name: "Guardar gasto personal", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await navigate(page, "Gastos");
  await expect(
    page.getByRole("heading", { name: "Hamburguesa privada", exact: true }),
  ).toHaveCount(0);
  await navigate(page, "Actividad");
  await expect(
    page.getByRole("heading", { name: "Actividad reciente", exact: true }),
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText("Hamburguesa privada");
  await navigate(page, "Equipo");
  await page
    .getByLabel("Correo del integrante")
    .fill(`privacy-friend-${info.project.name}@example.test`);
  await page
    .getByRole("button", { name: "Generar invitación", exact: true })
    .click();
  const code = await page
    .getByLabel("Código privado de invitación")
    .inputValue();
  const friend = await browser.newContext();
  const fp = await friend.newPage();
  await signIn(fp, `privacy-friend-${info.project.name}@example.test`);
  await fp.getByLabel("Código de invitación", { exact: true }).fill(code);
  await fp
    .getByRole("button", { name: "Unirme al viaje", exact: true })
    .click();
  await expect(
    fp.getByRole("heading", { name: "Tu viaje, bajo control." }),
  ).toBeVisible();
  await navigate(fp, "Mis gastos");
  await expect(
    fp.getByRole("heading", { name: "Hamburguesa privada", exact: true }),
  ).toHaveCount(0);
  await friend.close();
  await navigate(page, "Resumen");
  await panel
    .getByRole("button", { name: "Editar mi presupuesto", exact: true })
    .click();
  await page.getByLabel("Mi presupuesto personal · EUR").fill("600");
  await page
    .getByRole("button", { name: "Guardar mi presupuesto", exact: true })
    .click();
  await expect(panel.locator(".personal-totals").first()).toContainText(
    "585,00",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/private-dashboard-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Cargar gasto", exact: true }).click();
  dialog = page.getByRole("dialog");
  expect(
    await dialog.evaluate((el) => {
      const b = el.getBoundingClientRect();
      return [
        ...el.querySelectorAll("input:not([type=hidden]),select,textarea"),
      ].every((i) => {
        const r = i.getBoundingClientRect();
        return r.left >= b.left && r.right <= b.right;
      });
    }),
  ).toBe(true);
  await dialog
    .getByRole("combobox", { name: "Moneda", exact: true })
    .selectOption("USD");
  await dialog
    .getByLabel("Fecha de la cotización", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `test-results/shared-form-${info.project.name}.png`,
  });
  await dialog
    .getByLabel("¿Para quién es este gasto?")
    .selectOption("personal");
  await expect(
    dialog.getByRole("button", { name: "Guardar solo para mí", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cerrar ventana", exact: true })
    .click();
});
test("named travel currencies, online quote confirmation and swipe navigation", async ({
  page,
}, info) => {
  await signIn(page, `fx-${info.project.name}@example.test`);
  await page
    .getByText("Soy el organizador: crear un viaje", { exact: true })
    .click();
  await page.getByLabel("Tu nombre", { exact: true }).fill("Viajero monedas");
  await page.getByRole("button", { name: "Crear mi viaje" }).click();
  await expect(
    page.getByRole("heading", { name: "Tu viaje, bajo control." }),
  ).toBeVisible();
  if (info.project.name === "mobile") {
    const shell = page.locator(".app-shell");
    await shell.dispatchEvent("pointerdown", {
      pointerType: "touch",
      isPrimary: true,
      pointerId: 1,
      clientX: 25,
      clientY: 120,
    });
    await shell.dispatchEvent("pointerup", {
      pointerType: "touch",
      isPrimary: true,
      pointerId: 1,
      clientX: 28,
      clientY: 240,
    });
    await expect(
      page.getByRole("button", { name: "Cerrar menú", exact: true }),
    ).toHaveCount(0);
    await shell.dispatchEvent("pointerdown", {
      pointerType: "touch",
      isPrimary: true,
      pointerId: 2,
      clientX: 25,
      clientY: 120,
    });
    await shell.dispatchEvent("pointerup", {
      pointerType: "touch",
      isPrimary: true,
      pointerId: 2,
      clientX: 160,
      clientY: 125,
    });
    await expect(
      page.getByRole("button", { name: "Cerrar menú", exact: true }),
    ).toBeVisible();
    await shell.dispatchEvent("pointerdown", {
      pointerType: "touch",
      isPrimary: true,
      pointerId: 3,
      clientX: 190,
      clientY: 120,
    });
    await shell.dispatchEvent("pointerup", {
      pointerType: "touch",
      isPrimary: true,
      pointerId: 3,
      clientX: 30,
      clientY: 125,
    });
    await expect(
      page.getByRole("button", { name: "Cerrar menú", exact: true }),
    ).toHaveCount(0);
    const cdp = await page.context().newCDPSession(page);
    async function nativeSwipe(from: number, to: number) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: from, y: 220, id: 1 }],
      });
      for (const t of [0.3, 0.6, 1])
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: from + (to - from) * t, y: 220, id: 1 }],
        });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    }
    await expect
      .poll(() =>
        page
          .locator("aside.sidebar")
          .evaluate((el) => el.getBoundingClientRect().right),
      )
      .toBeLessThanOrEqual(0);
    await nativeSwipe(8, 160);
    await expect(
      page.getByRole("button", { name: "Cerrar menú", exact: true }),
    ).toBeVisible();
    await expect(page.locator("aside.sidebar")).toHaveCSS(
      "transform",
      "matrix(1, 0, 0, 1, 0, 0)",
    );
    await nativeSwipe(180, 30);
    await expect(
      page.getByRole("button", { name: "Cerrar menú", exact: true }),
    ).toHaveCount(0);
    await cdp.detach();
    // Suppression ends on the next real gesture, tested here by a new pointer sequence.
    await shell.dispatchEvent("pointerdown", {
      pointerType: "touch",
      isPrimary: true,
      pointerId: 4,
      clientX: 200,
      clientY: 300,
    });
  }
  await page.getByRole("button", { name: "Cargar gasto", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Descripción", { exact: true })
    .fill("Metro en Praga");
  await dialog.getByLabel("Importe original").fill("100");
  const select = dialog.getByRole("combobox", { name: "Moneda", exact: true });
  await expect(
    select.getByRole("option", { name: /Libra esterlina/ }),
  ).toHaveCount(1);
  await expect(
    select.getByRole("option", { name: /Corona checa/ }),
  ).toHaveCount(1);
  await select.selectOption("CZK");
  await page.route("**/api/rates", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        date: "2026-10-16",
        source: "Referencia de prueba",
        perEur: { EUR: "1", USD: "1.1", GBP: "0.85", CZK: "25" },
        toEur: { EUR: "1", USD: "0.90909091", GBP: "1.17647059", CZK: "0.04" },
        peso: null,
      }),
    }),
  );
  await dialog
    .getByRole("button", { name: "Consultar cotización online", exact: true })
    .click();
  await expect(dialog.getByText(/Referencia de prueba/)).toBeVisible();
  await expect(dialog.getByLabel("EUR por 1 CZK", { exact: true })).toHaveValue(
    "",
  );
  await dialog
    .getByRole("button", { name: "Usar esta referencia", exact: true })
    .click();
  await expect(dialog.getByLabel("EUR por 1 CZK", { exact: true })).toHaveValue(
    "0.04",
  );
  await dialog
    .getByRole("button", { name: "Guardar gasto", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await navigate(page, "Gastos");
  await expect(
    page.getByRole("heading", { name: "Metro en Praga", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("deadlines, duplicate confirmation, recoverable trash and one-use password recovery", async ({
  page,
  request,
}, info) => {
  const email = `quality-${info.project.name}@example.test`;
  await signIn(page, email);
  await page
    .getByText("Soy el organizador: crear un viaje", { exact: true })
    .click();
  await page.getByLabel("Tu nombre", { exact: true }).fill("Viajero calidad");
  await page
    .getByRole("button", { name: "Crear mi viaje", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tu día, de un vistazo" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Transporte", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Descripción", { exact: true })
    .fill("Reserva para Londres");
  await dialog.getByLabel("Importe original", { exact: true }).fill("123.45");
  await dialog
    .getByRole("combobox", { name: "Estado", exact: true })
    .selectOption("reserved");
  await dialog
    .getByText("Más detalles · vencimiento y notas", { exact: true })
    .click();
  await dialog
    .getByLabel("Fecha límite de pago (opcional)", { exact: true })
    .fill("2027-04-25");
  await dialog
    .getByRole("button", { name: "Guardar gasto", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".due-panel")).toContainText(
    "Reserva para Londres",
  );
  await navigate(page, "Gastos");
  let row = page
    .locator(".expense-row")
    .filter({ hasText: "Reserva para Londres" });
  await row
    .getByText("Detalles, acciones y comprobantes", { exact: true })
    .click();
  await row.getByRole("button", { name: "Repetir gasto", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Guardar gasto", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("Ya hay un gasto");
  await dialog
    .getByLabel("Es otra compra, quiero guardarla igualmente.", { exact: true })
    .check();
  await dialog
    .getByRole("button", { name: "Guardar gasto", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".expense-row")).toHaveCount(2);
  row = page
    .locator(".expense-row")
    .filter({ hasText: "Reserva para Londres" })
    .first();
  if (
    !(await row
      .getByRole("button", { name: "Eliminar", exact: true })
      .isVisible())
  )
    await row
      .getByText("Detalles, acciones y comprobantes", { exact: true })
      .click();
  page.once("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(page.locator(".expense-row")).toHaveCount(1);
  await page.locator(".trash-panel summary").click();
  await page
    .locator(".trash-panel")
    .getByRole("button", { name: "Restaurar", exact: true })
    .click();
  await expect(page.locator(".expense-row")).toHaveCount(2);
  await navigate(page, "Configuración");
  await page
    .getByText("Generar códigos de recuperación", { exact: true })
    .click();
  const recovery = page.locator("section.panel").filter({
    has: page.getByRole("heading", {
      name: "Recuperar tu cuenta",
      exact: true,
    }),
  });
  await recovery
    .getByLabel("Confirmá tu contraseña para generar códigos", { exact: true })
    .fill(TEST_PASSWORD);
  await recovery
    .getByRole("button", { name: "Generar mis códigos", exact: true })
    .click();
  const code = (await recovery.locator("pre").innerText()).split("\n")[0];
  expect(code).toMatch(/^[a-f0-9]{32}$/);
  await page.screenshot({
    path: `test-results/quality-settings-${info.project.name}.png`,
  });
  await page.goto("/recuperar");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(email);
  await page.getByLabel("Código de recuperación", { exact: true }).fill(code);
  const nextPassword = "Mi-nueva-clave-segura-2027";
  await page
    .getByLabel("Elegí una contraseña", { exact: true })
    .fill(nextPassword);
  await page
    .getByLabel("Repetí la contraseña", { exact: true })
    .fill(nextPassword);
  await page
    .getByRole("button", { name: "Restablecer contraseña", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Contraseña actualizada",
  );
  const reused = await request.post("/api/recovery", {
    data: { email, code, password: TEST_PASSWORD },
  });
  expect(reused.status()).toBe(400);
});
