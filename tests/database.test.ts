import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, expect, it } from "vitest";
import { readFileSync } from "node:fs";
let db: PGlite;
const users = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
];
let trip: string, expense: string;
const codes: Record<number, string> = {};
async function as(index: number) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    users[index],
  ]);
  await db.exec("set role authenticated");
}
async function fails(sql: string, params: unknown[] = []) {
  await expect(db.query(sql, params)).rejects.toThrow();
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role service_role; create role anon; create role authenticated; create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,storage to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security; grant select,insert,delete on storage.objects to authenticated;`);
  for (let i = 0; i < users.length; i++)
    await db.query("insert into auth.users values($1,$2,now())", [
      users[i],
      `u${i}@test.com`,
    ]);
  await db.exec(
    readFileSync("supabase/migrations/202610160001_travel_hq.sql", "utf8"),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202610160002_password_invitations.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202610160003_personal_budgets.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202610160004_event_places_times.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync("supabase/migrations/202610160005_member_names.sql", "utf8"),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202610160006_advanced_expenses.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202610160007_private_expenses.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync("supabase/migrations/202610170001_czech_currency.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/202610170002_quality.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/202610170003_recovery_codes.sql", "utf8"),
  );
  await as(0);
  trip = (
    await db.query<{ id: string }>(
      "select public.create_trip('EuroTrip 2027','Uno') as id",
    )
  ).rows[0].id;
});
afterAll(async () => {
  await db?.close();
});
it("creates only the owner and never creates fictional expenses or prices", async () => {
  const r = await db.query<{ n: number }>(
    "select count(*)::int n from public.trip_members",
  );
  expect(r.rows[0].n).toBe(1);
  expect((await db.query("select * from public.expenses")).rows).toHaveLength(
    0,
  );
});
it("invites up to four people including pending invitations", async () => {
  for (let i = 1; i < 4; i++)
    codes[i] = (
      await db.query<{ code: string }>(
        "select public.create_invitation($1,$2) code",
        [trip, `u${i}@test.com`],
      )
    ).rows[0].code;
  await fails("select public.create_invitation($1,$2)", [trip, "u4@test.com"]);
});
it("denies outsiders and does not accept invitations by email alone", async () => {
  await as(4);
  expect((await db.query("select * from public.trips")).rows).toHaveLength(0);
  await fails("select public.create_invitation($1,$2)", [trip, "x@test.com"]);
  expect(
    (await db.query<{ v: null }>("select public.hq_snapshot($1) v", [trip]))
      .rows[0].v,
  ).toBeNull();
  await as(1);
  await db.query("select public.accept_invitations()");
  expect((await db.query("select * from public.trips")).rows).toHaveLength(0);
  await fails("select public.accept_invitation($1)", ["a".repeat(32)]);
  await as(4);
  await fails("select public.accept_invitation($1)", [codes[1]]);
});
it("rotates invitation secrets and rejects expired codes", async () => {
  await as(0);
  const old = codes[1];
  codes[1] = (
    await db.query<{ code: string }>(
      "select public.create_invitation($1,$2) code",
      [trip, "u1@test.com"],
    )
  ).rows[0].code;
  expect(codes[1]).not.toBe(old);
  await as(1);
  await fails("select public.accept_invitation($1)", [old]);
  await db.exec("reset role");
  await db.query(
    "update public.trip_invitations set expires_at=now()-interval '1 day' where email='u1@test.com'",
  );
  await as(1);
  await fails("select public.accept_invitation($1)", [codes[1]]);
  await as(0);
  codes[1] = (
    await db.query<{ code: string }>(
      "select public.create_invitation($1,$2) code",
      [trip, "u1@test.com"],
    )
  ).rows[0].code;
});
it("stores hashes only and consumes each valid invitation once", async () => {
  await as(0);
  const rows = (
    await db.query<{ code_hash: string }>(
      "select code_hash from public.trip_invitations",
    )
  ).rows;
  expect(
    rows.every(
      (r) =>
        r.code_hash.length === 64 &&
        !Object.values(codes).includes(r.code_hash),
    ),
  ).toBe(true);
  for (let i = 1; i < 4; i++) {
    await as(i);
    await db.query("select public.accept_invitation($1)", [codes[i]]);
    await fails("select public.accept_invitation($1)", [codes[i]]);
  }
  await as(0);
  expect(
    (await db.query("select * from public.trip_members")).rows,
  ).toHaveLength(4);
  expect(
    (await db.query("select * from public.trip_invitations")).rows,
  ).toHaveLength(0);
  await fails("select public.invite_member($1,$2)", [trip, "old@test.com"]);
});
const saveSql =
  "select public.save_expense($1,$2,'Cena','Comida',$3,'USD',$4,'2027-04-22','2027-04-22',$5,$6,$7,'') id";
// Explicit valid participant set (the fifth user must never get a share).
it("rejects outsider participants without leaving half an expense", async () => {
  await as(0);
  await fails(saveSql, [
    null,
    trip,
    1001,
    "0.92345678",
    "reserved",
    users[0],
    users,
  ]);
  expect((await db.query("select * from public.expenses")).rows).toHaveLength(
    0,
  );
});
it("converts once, distributes every cent and updates reservations in place", async () => {
  const r = await db.query<{ id: string }>(saveSql, [
    null,
    trip,
    1001,
    "0.92345678",
    "reserved",
    users[0],
    users.slice(0, 4),
  ]);
  expense = r.rows[0].id;
  const shares = (
    await db.query<{ amount_minor: number }>(
      "select amount_minor::int from public.expense_shares order by member_id",
    )
  ).rows;
  expect(shares.map((x) => x.amount_minor)).toEqual([231, 231, 231, 231]);
  expect(
    (
      await db.query<{ amount: number }>(
        "select eur_minor::int amount from public.expenses",
      )
    ).rows[0].amount,
  ).toBe(924);
  await db.query("select public.mark_expense_paid($1,$2)", [expense, trip]);
  expect((await db.query("select * from public.expenses")).rows).toHaveLength(
    1,
  );
});
it("prevents direct ledger and ownership tampering even through the REST API role", async () => {
  await fails("update public.expenses set eur_minor=1 where id=$1", [expense]);
  await fails("update public.expense_shares set amount_minor=0");
  await fails("update public.trips set owner_id=$1", [users[1]]);
  await fails("insert into public.trip_members values($1,$2,$3,$4)", [
    trip,
    users[4],
    "Outside",
    "u4@test.com",
  ]);
});
it("rolls back invalid edits and retains the previous amount and shares", async () => {
  await fails(saveSql, [
    expense,
    trip,
    1001,
    "0",
    "paid",
    users[0],
    users.slice(0, 4),
  ]);
  expect(
    (
      await db.query<{ amount: number }>(
        "select eur_minor::int amount from public.expenses where id=$1",
        [expense],
      )
    ).rows[0].amount,
  ).toBe(924);
  expect(
    (await db.query("select * from public.expense_shares")).rows,
  ).toHaveLength(4);
});
it("supports partial groups and deterministic remainder distribution", async () => {
  const created = await db.query<{ id: string }>(saveSql, [
    null,
    trip,
    1001,
    "1",
    "paid",
    users[0],
    users.slice(1, 4),
  ]);
  const shares = await db.query<{ amount: number }>(
    "select amount_minor::int amount from public.expense_shares where expense_id=$1 order by member_id",
    [created.rows[0].id],
  );
  expect(shares.rows.map((x) => x.amount)).toEqual([334, 334, 333]);
});
it("rejects duplicate participants and EUR rates different from 1", async () => {
  await fails(saveSql, [
    null,
    trip,
    1001,
    "1",
    "paid",
    users[0],
    [users[0], users[0]],
  ]);
  await fails(
    "insert into public.settlements(trip_id,from_id,to_id,amount_minor,currency,rate_to_eur,occurred_on,rate_date) values($1,$2,$3,100,'EUR',2,'2027-04-22','2027-04-22')",
    [trip, users[0], users[1]],
  );
});
it("only members can store and read receipt objects", async () => {
  await as(0);
  await db.query(
    "insert into storage.objects(bucket_id,name) values('receipts',$1)",
    [`${trip}/${expense}/proof.pdf`],
  );
  await as(4);
  expect((await db.query("select * from storage.objects")).rows).toHaveLength(
    0,
  );
  await fails(
    "insert into storage.objects(bucket_id,name) values('receipts',$1)",
    [`${trip}/malicious.pdf`],
  );
  await as(1);
  expect((await db.query("select * from storage.objects")).rows).toHaveLength(
    1,
  );
});
it("requires a source for quoted or confirmed scenario prices", async () => {
  await as(0);
  const s = (
    await db.query<{ id: string }>(
      "insert into public.scenarios(trip_id,name) values($1,'Tren') returning id",
      [trip],
    )
  ).rows[0].id;
  await fails(
    "insert into public.scenario_items(trip_id,scenario_id,description,amount_minor,currency,rate_to_eur,rate_date,confidence) values($1,$2,'Trayecto',100,'EUR',1,'2027-04-22','quoted')",
    [trip, s],
  );
});
it("anonymous roles cannot read trips or invoke privileged RPCs", async () => {
  await db.exec("reset role; set role anon");
  await fails("select * from public.trips");
  await fails("select public.create_trip('Fake','Fake')");
  await fails("select public.accept_invitations()");
});
it("deduplicates a retried expense creation request", async () => {
  await as(0);
  const request = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const args = [
    null,
    trip,
    9900,
    "1",
    "paid",
    users[0],
    users.slice(0, 4),
    request,
  ];
  const sql =
    "select public.save_expense($1,$2,'Retry','Comida',$3,'EUR',$4,'2027-04-22','2027-04-22',$5,$6,$7,'',$8) id";
  const first = (await db.query<{ id: string }>(sql, args)).rows[0].id;
  const second = (await db.query<{ id: string }>(sql, args)).rows[0].id;
  expect(second).toBe(first);
  expect(
    (
      await db.query("select * from public.expenses where request_id=$1", [
        request,
      ])
    ).rows,
  ).toHaveLength(1);
});
it("deduplicates transfer requests at the database boundary", async () => {
  await as(0);
  const request = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const sql =
    "insert into public.settlements(trip_id,request_id,from_id,to_id,amount_minor,currency,rate_to_eur,occurred_on,rate_date) values($1,$2,$3,$4,100,'EUR',1,'2027-04-22','2027-04-22')";
  const params = [trip, request, users[1], users[0]];
  await db.query(sql, params);
  await fails(sql, params);
  expect(
    (
      await db.query("select * from public.settlements where request_id=$1", [
        request,
      ])
    ).rows,
  ).toHaveLength(1);
});
it("returns exchange rates as exact strings in consistent snapshots", async () => {
  await as(0);
  const result = await db.query<{ v: { expenses: { rate_to_eur: string }[] } }>(
    "select public.hq_snapshot($1) v",
    [trip],
  );
  expect(typeof result.rows[0].v.expenses[0].rate_to_eur).toBe("string");
});

it("keeps personal limits private, even from the organizer; rejects outsiders", async () => {
  await as(1);
  await db.query("select public.save_personal_budget($1,12345)", [trip]);
  const r = await db.query<{ v: { personal_budget_minor: number } }>(
    "select public.hq_snapshot($1) v",
    [trip],
  );
  expect(r.rows[0].v.personal_budget_minor).toBe(12345);
  await as(0);
  expect(
    (await db.query("select * from public.personal_budgets")).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query(
        "update public.personal_budgets set budget_minor=999 returning user_id",
      )
    ).rows,
  ).toHaveLength(0);
  await as(4);
  await fails("select public.save_personal_budget($1,500)", [trip]);
  await as(1);
  await fails("select public.save_personal_budget($1,-1)", [trip]);
});
it("only organizer can set display FX; historical flight prices stay unchanged", async () => {
  await as(1);
  expect(
    (
      await db.query(
        "update public.trips set usd_per_eur=1.1,display_rate_date='2026-10-16' where id=$1 returning id",
        [trip],
      )
    ).rows,
  ).toHaveLength(0);
  await as(0);
  const before = (
    await db.query(
      "select amount_minor,rate_to_eur,eur_minor from public.expenses",
    )
  ).rows;
  await db.query(
    "update public.trips set usd_per_eur=1.12345678,display_rate_date='2026-10-16' where id=$1",
    [trip],
  );
  expect(
    (
      await db.query(
        "select amount_minor,rate_to_eur,eur_minor from public.expenses",
      )
    ).rows,
  ).toEqual(before);
  const r = await db.query<{ v: { trip: { usd_per_eur: string } } }>(
    "select public.hq_snapshot($1) v",
    [trip],
  );
  expect(r.rows[0].v.trip.usd_per_eur).toBe("1.12345678");
  await fails("update public.trips set usd_per_eur=0 where id=$1", [trip]);
});
it("validates paired itinerary times and preserves destination details", async () => {
  await as(0);
  const sql =
    "insert into public.itinerary_events(trip_id,title,city,starts_on,ends_on,kind,start_time,end_time,time_zone,location) values($1,'Visita','Madrid','2027-04-22','2027-04-22','activity',$2,$3,'Europe/Madrid','Prado') returning id";
  await fails(sql, [trip, "10:00", null]);
  await fails(sql, [trip, "12:00", "10:00"]);
  const r = await db.query(sql, [trip, "10:00", "12:00"]);
  expect(r.rows).toHaveLength(1);
  await as(4);
  expect(
    (await db.query("select * from public.itinerary_events")).rows,
  ).toHaveLength(0);
});
it("allows self and organizer name edits while protecting identities and other members", async () => {
  await as(1);
  expect(
    (
      await db.query(
        "update public.trip_members set display_name='Joaquín' where trip_id=$1 and user_id=$2 returning display_name",
        [trip, users[1]],
      )
    ).rows,
  ).toHaveLength(1);
  expect(
    (
      await db.query(
        "update public.trip_members set display_name='Forbidden' where trip_id=$1 and user_id=$2 returning user_id",
        [trip, users[2]],
      )
    ).rows,
  ).toHaveLength(0);
  await fails(
    "update public.trip_members set email='changed@example.com' where user_id=$1",
    [users[1]],
  );
  await fails("update public.trip_members set user_id=$1 where user_id=$2", [
    users[4],
    users[1],
  ]);
  await fails(
    "update public.trip_members set display_name='' where user_id=$1",
    [users[1]],
  );
  await as(0);
  expect(
    (
      await db.query(
        "update public.trip_members set display_name='Joaquín Gaffet' where trip_id=$1 and user_id=$2 returning display_name",
        [trip, users[1]],
      )
    ).rows,
  ).toHaveLength(1);
  await as(4);
  expect(
    (
      await db.query(
        "update public.trip_members set display_name='Outsider' returning user_id",
      )
    ).rows,
  ).toHaveLength(0);
});
it("supports partial payments, separate payers/rates, idempotence and reversals", async () => {
  await as(0);
  const e = (
    await db.query<{ id: string }>(
      "select public.save_expense_v2(null,$1,'Airbnb','Alojamiento',80000,'USD',0.9,'2027-04-22','2027-04-22','reserved',$2,$3,'',$4,'percent',$5) id",
      [
        trip,
        users[0],
        users.slice(0, 2),
        "66666666-6666-4666-8666-666666666666",
        [6000, 4000],
      ],
    )
  ).rows[0].id;
  const sql =
    "select public.add_expense_payment($1,$2,$3,$4,$5,$6,'2027-04-23','2027-04-23','Cuota') id";
  const args = [
    trip,
    e,
    "77777777-7777-4777-8777-777777777777",
    users[1],
    20000,
    "0.95",
  ];
  const pid = (await db.query<{ id: string }>(sql, args)).rows[0].id;
  expect((await db.query<{ id: string }>(sql, args)).rows[0].id).toBe(pid);
  let snap = (
    await db.query<{ v: import("../src/lib/types").HQData }>(
      "select public.hq_snapshot($1) v",
      [trip],
    )
  ).rows[0].v;
  expect(snap.expenses.find((x) => x.id === e)?.paid_eur_minor).toBe(19000);
  expect(snap.expenses.find((x) => x.id === e)?.status).toBe("reserved");
  expect(
    snap.shares
      .filter((x) => x.expense_id === e)
      .map((x) => x.amount_minor)
      .sort((a, b) => b - a),
  ).toEqual([43200, 28800]);
  await fails(sql, [
    trip,
    e,
    "88888888-8888-4888-8888-888888888888",
    users[0],
    60001,
    "1",
  ]);
  await db.query(sql, [
    trip,
    e,
    "99999999-9999-4999-8999-999999999999",
    users[0],
    60000,
    "1",
  ]);
  snap = (
    await db.query<{ v: import("../src/lib/types").HQData }>(
      "select public.hq_snapshot($1) v",
      [trip],
    )
  ).rows[0].v;
  expect(snap.expenses.find((x) => x.id === e)?.paid_eur_minor).toBe(79000);
  expect(snap.expenses.find((x) => x.id === e)?.status).toBe("paid");
  await as(2);
  await fails("select public.delete_expense_payment($1,$2)", [trip, pid]);
  await as(4);
  expect(
    (await db.query("select * from public.expense_payments")).rows,
  ).toHaveLength(0);
  expect(
    (await db.query("select * from public.activity_log")).rows,
  ).toHaveLength(0);
  await as(0);
  await db.query("select public.delete_expense_payment($1,$2)", [trip, pid]);
  snap = (
    await db.query<{ v: import("../src/lib/types").HQData }>(
      "select public.hq_snapshot($1) v",
      [trip],
    )
  ).rows[0].v;
  expect(snap.expenses.find((x) => x.id === e)?.status).toBe("reserved");
  expect(
    snap.activity?.some(
      (a) => a.entity === "expense_payments" && a.action === "DELETE",
    ),
  ).toBe(true);
  await fails("delete from public.activity_log");
  await fails("update public.expense_payments set amount_minor=1");
  await fails(
    "select public.save_expense_base(null,$1,'Tamper','Comida',1,'EUR',1,'2027-04-22','2027-04-22','paid',$2,$3,'',null)",
    [trip, users[0], [users[0]]],
  );
});
it("rejects unequal shares that do not conserve total and records share edits", async () => {
  await as(0);
  const sql =
    "select public.save_expense_v2($1,$2,'Reparto','Comida',10001,'EUR',1,'2027-04-22','2027-04-22','reserved',$3,$4,'',$5,$6,$7) id";
  const request = "aaaaaaaa-1111-4111-8111-111111111111";
  await fails(sql, [
    null,
    trip,
    users[0],
    users.slice(0, 2),
    request,
    "amount",
    [5000, 5000],
  ]);
  await fails(sql, [
    null,
    trip,
    users[0],
    users.slice(0, 2),
    request,
    "percent",
    [5000, 4000],
  ]);
  const eid = (
    await db.query<{ id: string }>(sql, [
      null,
      trip,
      users[0],
      users.slice(0, 2),
      request,
      "amount",
      [6000, 4001],
    ])
  ).rows[0].id;
  await db.query(sql, [
    eid,
    trip,
    users[0],
    users.slice(0, 2),
    request,
    "amount",
    [4001, 6000],
  ]);
  expect(
    (
      await db.query(
        "select * from public.activity_log where entity='expense_shares' and action='UPDATE'",
      )
    ).rows.length,
  ).toBeGreaterThan(0);
});
it("private purchases remain invisible to fellow travelers and the organizer", async () => {
  await as(1);
  const inserted = await db.query<{ id: string }>(
    "insert into public.personal_expenses(trip_id,description,category,amount_minor,currency,rate_to_eur,rate_date,occurred_on,status) values($1,'Mi hamburguesa','Comida',1250,'EUR',1,'2027-04-22','2027-04-22','paid') returning id",
    [trip],
  );
  const id = inserted.rows[0].id;
  const own = await db.query<{ v: import("../src/lib/types").HQData }>(
    "select public.hq_snapshot($1) v",
    [trip],
  );
  expect(own.rows[0].v.personal_expenses?.some((e) => e.id === id)).toBe(true);
  expect(own.rows[0].v.expenses.some((e) => e.id === id)).toBe(false);
  expect(
    own.rows[0].v.activity?.some((a) => a.label === "Mi hamburguesa"),
  ).toBe(false);
  await as(0);
  expect(
    (await db.query("select * from public.personal_expenses")).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query<{ v: import("../src/lib/types").HQData }>(
        "select public.hq_snapshot($1) v",
        [trip],
      )
    ).rows[0].v.personal_expenses,
  ).toEqual([]);
  expect(
    (
      await db.query(
        "update public.personal_expenses set description='Espiar' where id=$1 returning id",
        [id],
      )
    ).rows,
  ).toHaveLength(0);
  await fails("select public.trash_personal_expense($1,$2)", [id, trip]);
  await fails(
    "insert into public.personal_expenses(trip_id,user_id,description,category,amount_minor,currency,rate_to_eur,rate_date,occurred_on,status) values($1,$2,'Fake','Comida',1,'EUR',1,'2027-04-22','2027-04-22','paid')",
    [trip, users[1]],
  );
  await as(1);
  await fails("update public.personal_expenses set user_id=$1 where id=$2", [
    users[0],
    id,
  ]);
  await db.query("select public.trash_personal_expense($1,$2)", [id, trip]);
});
it("accepts Czech koruna in shared expenses, private purchases, scenarios and settlements", async () => {
  await as(0);
  const eid = (
    await db.query<{ id: string }>(
      "select public.save_expense(null,$1,'Metro Praga','Transporte',10000,'CZK',0.04,'2027-04-22','2027-04-22','paid',$2,$3,'',$4) id",
      [
        trip,
        users[0],
        users.slice(0, 2),
        "cccccccc-1111-4111-8111-111111111111",
      ],
    )
  ).rows[0].id;
  expect(
    (
      await db.query<{ eur: number }>(
        "select eur_minor::int eur from public.expenses where id=$1",
        [eid],
      )
    ).rows[0].eur,
  ).toBe(400);
  await db.query(
    "insert into public.personal_expenses(trip_id,description,category,amount_minor,currency,rate_to_eur,rate_date,occurred_on,status) values($1,'Mi café en Praga','Comida',10000,'CZK',0.04,'2027-04-22','2027-04-22','paid')",
    [trip],
  );
  await db.query(
    "insert into public.settlements(trip_id,from_id,to_id,amount_minor,currency,rate_to_eur,rate_date,occurred_on) values($1,$2,$3,10000,'CZK',0.04,'2027-04-22','2027-04-22')",
    [trip, users[0], users[1]],
  );
  const scenario = (
    await db.query<{ id: string }>(
      "insert into public.scenarios(trip_id,name) values($1,'Praga') returning id",
      [trip],
    )
  ).rows[0].id;
  await db.query(
    "insert into public.scenario_items(trip_id,scenario_id,description,amount_minor,currency,rate_to_eur,rate_date,confidence) values($1,$2,'Tranvía',10000,'CZK',0.04,'2027-04-22','estimated')",
    [trip, scenario],
  );
});
it("archives and restores shared spending without losing payments or allocation, and isolates private trash", async () => {
  await as(0);
  const id = (
    await db.query<{ id: string }>(
      "select public.save_expense_v4(null,$1,'Reserva con vencimiento','Transporte',10001,'EUR',1,'2027-04-22','2027-04-22','paid',$2,$3,'',$4,'equal',null,'2027-04-24') id",
      [trip, users[0], users.slice(0, 2), crypto.randomUUID()],
    )
  ).rows[0].id;
  await db.query("select public.delete_expense($1,$2)", [id, trip]);
  let snapshot = (
    await db.query<{ v: import("../src/lib/types").HQData }>(
      "select public.hq_snapshot($1) v",
      [trip],
    )
  ).rows[0].v;
  expect(snapshot.expenses.some((e) => e.id === id)).toBe(false);
  expect(snapshot.payments!.some((p) => p.expense_id === id)).toBe(false);
  expect(snapshot.shares.some((p) => p.expense_id === id)).toBe(false);
  expect(snapshot.trash!.find((e) => e.id === id)?.due_on).toBe("2027-04-24");
  await fails(
    "select public.add_expense_payment($1,$2,$3,$4,1,1,'2027-04-22','2027-04-22','')",
    [trip, id, crypto.randomUUID(), users[0]],
  );
  await as(4);
  await fails("select public.restore_expense($1,$2)", [id, trip]);
  await as(1);
  await db.query("select public.restore_expense($1,$2)", [id, trip]);
  snapshot = (
    await db.query<{ v: import("../src/lib/types").HQData }>(
      "select public.hq_snapshot($1) v",
      [trip],
    )
  ).rows[0].v;
  expect(
    Number(snapshot.expenses.find((e) => e.id === id)?.paid_eur_minor),
  ).toBe(10001);
  expect(snapshot.payments!.filter((p) => p.expense_id === id)).toHaveLength(1);
  expect(snapshot.shares.filter((s) => s.expense_id === id)).toHaveLength(2);
  const pid = (
    await db.query<{ id: string }>(
      "insert into public.personal_expenses(trip_id,description,category,amount_minor,currency,rate_to_eur,rate_date,occurred_on,status) values($1,'Privado archivado','Comida',100,'EUR',1,'2027-04-22','2027-04-22','paid') returning id",
      [trip],
    )
  ).rows[0].id;
  await db.query("select public.trash_personal_expense($1,$2)", [pid, trip]);
  await fails(
    "update public.personal_expenses set description='No editar archivado' where id=$1",
    [pid],
  );
  await as(0);
  expect(
    (
      await db.query<{ v: import("../src/lib/types").HQData }>(
        "select public.hq_snapshot($1) v",
        [trip],
      )
    ).rows[0].v.personal_trash,
  ).toEqual([]);
  await fails("select public.trash_personal_expense($1,$2,true)", [pid, trip]);
  await as(1);
  await db.query("select public.trash_personal_expense($1,$2,true)", [
    pid,
    trip,
  ]);
});
it("flags same-date same-currency normalized duplicates without exposing another user's private spending", async () => {
  await as(0);
  const args = [trip, "  METRO   PRAGA ", 10000, "CZK", "2027-04-22"];
  const check = async (values: unknown[]) =>
    (
      await db.query<{ v: boolean }>(
        "select public.possible_duplicate($1,$2,$3,$4,$5) v",
        values,
      )
    ).rows[0].v;
  expect(await check(args)).toBe(true);
  expect(await check([trip, "Metro Praga", 10001, "CZK", "2027-04-22"])).toBe(
    false,
  );
  expect(await check([trip, "Metro Praga", 10000, "CZK", "2027-04-23"])).toBe(
    false,
  );
  await as(1);
  expect(
    (
      await db.query<{ v: boolean }>(
        "select public.possible_duplicate($1,'Mi café en Praga',10000,'CZK','2027-04-22',null,null,true) v",
        [trip],
      )
    ).rows[0].v,
  ).toBe(false);
});
it("keeps recovery hashes private, codes single-use and admin-only consumption rate limited", async () => {
  await as(0);
  const codes = (
    await db.query<{ v: string[] }>("select public.generate_recovery_codes() v")
  ).rows[0].v;
  expect(codes).toHaveLength(8);
  expect(new Set(codes).size).toBe(8);
  await fails("select * from private.recovery_codes");
  await fails("select public.consume_recovery_code('u0@test.com',$1,$2)", [
    codes[0],
    "a".repeat(64),
  ]);
  await db.exec("reset role; set role service_role");
  const consume = async (code: string, email = "u0@test.com") =>
    (
      await db.query<{ v: string | null }>(
        "select public.consume_recovery_code($1,$2,$3) v",
        [email, code, "a".repeat(64)],
      )
    ).rows[0].v;
  expect(await consume(codes[0])).toBe(users[0]);
  expect(await consume(codes[0])).toBeNull();
  for (let i = 0; i < 4; i++) expect(await consume("0".repeat(32))).toBeNull();
  expect(await consume(codes[1])).toBeNull();
  await as(1);
  const other = (
    await db.query<{ v: string[] }>("select public.generate_recovery_codes() v")
  ).rows[0].v;
  await db.exec("reset role; set role service_role");
  expect(await consume(other[0], "u1@test.com")).toBe(users[1]);
  await as(0);
  const rotated = (
    await db.query<{ v: string[] }>("select public.generate_recovery_codes() v")
  ).rows[0].v;
  expect(rotated).not.toContain(codes[1]);
});
