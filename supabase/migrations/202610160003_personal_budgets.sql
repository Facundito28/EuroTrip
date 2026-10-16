-- Personal limits are private; the organizer manages the shared display rate.
begin;
alter table public.trips add column usd_per_eur numeric(16,8) check (usd_per_eur > 0 and usd_per_eur < 100000000);
alter table public.trips add column display_rate_date date;
alter table public.trips add constraint display_rate_pair check ((usd_per_eur is null) = (display_rate_date is null));
grant update(usd_per_eur,display_rate_date) on public.trips to authenticated;
create table public.personal_budgets (
 trip_id uuid not null,
 user_id uuid not null,
 budget_minor bigint not null check (budget_minor between 0 and 1000000000000),
 primary key(trip_id,user_id),
 foreign key(trip_id,user_id) references public.trip_members(trip_id,user_id) on delete cascade
);
alter table public.personal_budgets enable row level security;
create policy personal_budget_self on public.personal_budgets for all to authenticated
 using(user_id=auth.uid() and private.is_member(trip_id))
 with check(user_id=auth.uid() and private.is_member(trip_id));
grant select,insert,update on public.personal_budgets to authenticated;
create function public.save_personal_budget(p_trip uuid,p_budget bigint) returns void
language sql security invoker set search_path='' as $$
 insert into public.personal_budgets(trip_id,user_id,budget_minor) values(p_trip,auth.uid(),p_budget)
 on conflict(trip_id,user_id) do update set budget_minor=excluded.budget_minor;
$$;
revoke execute on function public.save_personal_budget(uuid,bigint) from public,anon;
grant execute on function public.save_personal_budget(uuid,bigint) to authenticated;
create or replace function public.hq_snapshot(p_trip uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'trip',to_jsonb(t)||jsonb_build_object('usd_per_eur',t.usd_per_eur::text),
  'personal_budget_minor',(select b.budget_minor from public.personal_budgets b where b.trip_id=t.id and b.user_id=auth.uid()),
  'members',coalesce((select jsonb_agg(m) from public.trip_members m where m.trip_id=t.id),'[]'::jsonb),
  'expenses',coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object('rate_to_eur',e.rate_to_eur::text) order by e.occurred_on desc,e.created_at desc) from public.expenses e where e.trip_id=t.id),'[]'::jsonb),
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
