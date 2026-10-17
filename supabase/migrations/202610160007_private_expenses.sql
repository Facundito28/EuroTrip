begin;
-- Personal purchases are separate from the shared ledger and its activity log.
create table public.personal_expenses(
 id uuid primary key default gen_random_uuid(),trip_id uuid not null,user_id uuid not null default auth.uid(),
 request_id uuid not null default gen_random_uuid(),unique(trip_id,user_id,request_id),
 description text not null check(length(trim(description)) between 1 and 160),
 category text not null check(category in ('Alojamiento','Transporte','Comida','Actividades','Compras','Otros')),
 amount_minor bigint not null check(amount_minor between 1 and 1000000000000),
 currency text not null check(currency in ('EUR','USD','GBP','ARS')),
 rate_to_eur numeric(16,8) not null check(rate_to_eur>0),rate_date date not null,
 eur_minor bigint generated always as(round(amount_minor*rate_to_eur)::bigint) stored check(eur_minor between 1 and 1000000000000),
 occurred_on date not null,status text not null check(status in ('paid','reserved','estimated')),
 notes text not null default '' check(length(notes)<=2000),created_at timestamptz not null default now(),
 foreign key(trip_id,user_id) references public.trip_members(trip_id,user_id) on delete cascade,
 check(currency<>'EUR' or rate_to_eur=1)
);
alter table public.personal_expenses enable row level security;
create policy personal_expenses_self on public.personal_expenses for all to authenticated
 using(user_id=auth.uid() and private.is_member(trip_id)) with check(user_id=auth.uid() and private.is_member(trip_id));
revoke all on public.personal_expenses from public,anon,authenticated;
grant select,delete on public.personal_expenses to authenticated;
grant insert(trip_id,user_id,request_id,description,category,amount_minor,currency,rate_to_eur,rate_date,occurred_on,status,notes) on public.personal_expenses to authenticated;
grant update(description,category,amount_minor,currency,rate_to_eur,rate_date,occurred_on,status,notes) on public.personal_expenses to authenticated;
create or replace function public.hq_snapshot(p_trip uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'personal_expenses',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('rate_to_eur',p.rate_to_eur::text) order by p.occurred_on desc,p.created_at desc) from public.personal_expenses p where p.trip_id=t.id and p.user_id=auth.uid()),'[]'::jsonb),
  'payments',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('rate_to_eur',p.rate_to_eur::text) order by p.occurred_on,p.created_at) from public.expense_payments p where p.trip_id=t.id),'[]'::jsonb),
  'activity',coalesce((select jsonb_agg(a order by a.created_at desc,a.id desc) from (select * from public.activity_log where trip_id=t.id order by created_at desc,id desc limit 100) a),'[]'::jsonb),
  'trip',to_jsonb(t)||jsonb_build_object('usd_per_eur',t.usd_per_eur::text),
  'personal_budget_minor',(select b.budget_minor from public.personal_budgets b where b.trip_id=t.id and b.user_id=auth.uid()),
  'members',coalesce((select jsonb_agg(m) from public.trip_members m where m.trip_id=t.id),'[]'::jsonb),
  'expenses',coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object('rate_to_eur',e.rate_to_eur::text,'paid_original_minor',coalesce((select sum(p.amount_minor) from public.expense_payments p where p.expense_id=e.id),0),'paid_eur_minor',coalesce((select sum(p.eur_minor) from public.expense_payments p where p.expense_id=e.id),0)) order by e.occurred_on desc,e.created_at desc) from public.expenses e where e.trip_id=t.id),'[]'::jsonb),
  'shares',coalesce((select jsonb_agg(s) from public.expense_shares s where s.trip_id=t.id),'[]'::jsonb),
  'settlements',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('rate_to_eur',s.rate_to_eur::text) order by s.occurred_on desc) from public.settlements s where s.trip_id=t.id),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(e order by e.starts_on) from public.itinerary_events e where e.trip_id=t.id),'[]'::jsonb),
  'scenarios',coalesce((select jsonb_agg(s) from public.scenarios s where s.trip_id=t.id),'[]'::jsonb),
  'items',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('rate_to_eur',i.rate_to_eur::text)) from public.scenario_items i where i.trip_id=t.id),'[]'::jsonb),
  'invitations',coalesce((select jsonb_agg(i) from public.trip_invitations i where i.trip_id=t.id),'[]'::jsonb),
  'receipts',coalesce((select jsonb_agg(r) from public.receipts r where r.trip_id=t.id),'[]'::jsonb)
 ) from public.trips t where t.id=p_trip;
$$;



commit;
