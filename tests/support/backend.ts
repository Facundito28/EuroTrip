/** Isolated test adapter: real PostgreSQL migration + RLS, simulated email identity.
 * Never imported by the application or used against a user's Supabase project. */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth,storage to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to authenticated;`);
await db.exec(
  readFileSync("supabase/migrations/202610160001_travel_hq.sql", "utf8"),
);
const identities = new Map<string, { id: string; email: string }>();
const tables = new Set([
  "trips",
  "trip_members",
  "trip_invitations",
  "expenses",
  "expense_shares",
  "settlements",
  "itinerary_events",
  "scenarios",
  "scenario_items",
  "receipts",
]);
const functions = new Set([
  "create_trip",
  "invite_member",
  "accept_invitations",
  "save_expense",
  "mark_expense_paid",
  "delete_expense",
  "hq_snapshot",
]);
const identifier = (s: string) => {
  if (!/^[a-z_]+$/.test(s)) throw new Error("Invalid test identifier");
  return `"${s}"`;
};
function userObject(user: { id: string; email: string }) {
  return {
    ...user,
    aud: "authenticated",
    role: "authenticated",
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
}
function jwt(user: { id: string; email: string }) {
  const encode = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, email: user.email, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.test-signature`;
}
let queue: Promise<unknown> = Promise.resolve();
createServer((req, res) => {
  const run = async () => {
    const url = new URL(req.url!, "http://127.0.0.1:54329");
    let body: Record<string, unknown> = {};
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (chunks.length) body = JSON.parse(Buffer.concat(chunks).toString());
    const reply = (code: number, value: unknown) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(value));
    };
    try {
      if (url.pathname === "/health") return reply(200, { ready: true });
      if (url.pathname === "/reset") {
        await db.exec("reset role; truncate public.trips cascade");
        return reply(200, {});
      }
      if (url.pathname === "/auth/v1/otp") return reply(200, {});
      if (url.pathname === "/auth/v1/verify") {
        if (body.token !== "12345678")
          return reply(403, { message: "Invalid test OTP" });
        const email = String(body.email).toLowerCase();
        let user = identities.get(email);
        if (!user) {
          user = { id: crypto.randomUUID(), email };
          identities.set(email, user);
          await db.exec("reset role");
          await db.query("insert into auth.users values($1,$2,now())", [
            user.id,
            email,
          ]);
        }
        return reply(200, {
          access_token: jwt(user),
          refresh_token: "test-refresh",
          token_type: "bearer",
          expires_in: 3600,
          user: userObject(user),
        });
      }
      const token = req.headers.authorization?.replace("Bearer ", "");
      let user: { id: string; email: string } | undefined;
      if (token?.includes(".")) {
        try {
          const claims = JSON.parse(
            Buffer.from(token.split(".")[1], "base64url").toString(),
          );
          user = identities.get(claims.email);
        } catch {}
      }
      if (url.pathname === "/auth/v1/user")
        return user
          ? reply(200, userObject(user))
          : reply(401, { message: "No session" });
      if (url.pathname === "/auth/v1/logout") return reply(200, {});
      if (!user)
        return reply(401, { message: "Not authenticated", code: "42501" });
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        user.id,
      ]);
      await db.exec("set role authenticated");
      if (url.pathname.startsWith("/rest/v1/rpc/")) {
        const fn = url.pathname.split("/").at(-1)!;
        if (!functions.has(fn)) throw new Error("Unknown RPC");
        const names = Object.keys(body);
        const result = await db.query<{ value: unknown }>(
          `select public.${identifier(fn)}(${names.map((n, i) => `${identifier(n)} => $${i + 1}`).join(",")}) value`,
          Object.values(body),
        );
        return reply(200, result.rows[0]?.value ?? null);
      }
      const table = url.pathname.split("/").at(-1)!;
      if (!tables.has(table))
        return reply(404, { message: "Not implemented by test adapter" });
      const values: unknown[] = [];
      const filters: string[] = [];
      for (const [key, value] of url.searchParams)
        if (!["select", "order", "limit"].includes(key)) {
          if (!value.startsWith("eq."))
            throw new Error("Unsupported test filter");
          values.push(value.slice(3));
          filters.push(`${identifier(key)}=$${values.length}`);
        }
      const where = filters.length ? ` where ${filters.join(" and ")}` : "";
      let sql = "";
      if (req.method === "GET") {
        const select = url.searchParams.get("select") ?? "*";
        const columns =
          select === "*" ? "*" : select.split(",").map(identifier).join(",");
        sql = `select ${columns} from public.${identifier(table)}${where}`;
        const order = url.searchParams.get("order");
        if (order)
          sql += ` order by ${order
            .split(",")
            .map((o) => {
              const [key, dir] = o.split(".");
              return `${identifier(key)} ${dir === "desc" ? "desc" : "asc"}`;
            })
            .join(",")}`;
      } else if (req.method === "POST") {
        const fields = Object.keys(body);
        values.splice(0, values.length, ...Object.values(body));
        sql = `insert into public.${identifier(table)}(${fields.map(identifier).join(",")}) values(${values.map((_, i) => `$${i + 1}`).join(",")}) returning *`;
      } else if (req.method === "PATCH") {
        const set = Object.entries(body).map(([key, value]) => {
          values.push(value);
          return `${identifier(key)}=$${values.length}`;
        });
        sql = `update public.${identifier(table)} set ${set.join(",")}${where} returning *`;
      } else if (req.method === "DELETE")
        sql = `delete from public.${identifier(table)}${where} returning *`;
      else throw new Error("Unsupported test method");
      const result = await db.query(sql, values);
      const single = req.headers.accept?.includes("vnd.pgrst.object");
      return reply(200, single ? (result.rows[0] ?? null) : result.rows);
    } catch (error) {
      const e = error as { message: string; code?: string };
      reply(400, { message: e.message, code: e.code ?? "TEST_ERROR" });
    }
  };
  queue = queue.then(run, run);
}).listen(54329, "127.0.0.1", () =>
  console.log("Isolated PostgreSQL test adapter ready"),
);
