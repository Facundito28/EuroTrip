begin;
alter table public.itinerary_events drop constraint itinerary_events_time_zone_check;
alter table public.itinerary_events add constraint itinerary_events_time_zone_check check(time_zone in ('Europe/Madrid','Europe/Lisbon','Europe/London','Europe/Amsterdam','Europe/Brussels','Europe/Paris','Europe/Prague'));
create table public.trip_tasks(
 id uuid primary key default gen_random_uuid(),trip_id uuid not null references public.trips(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 160),category text not null check(category in ('Documentación','Equipaje','Reservas','Otros')),
 assignee_id uuid,due_on date,done boolean not null default false,notes text not null default '' check(length(notes)<=2000),created_at timestamptz not null default now(),
 foreign key(trip_id,assignee_id) references public.trip_members(trip_id,user_id)
);
create table public.trip_bookings(
 id uuid primary key default gen_random_uuid(),trip_id uuid not null references public.trips(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 160),kind text not null check(kind in ('stay','transport','activity')),
 city text not null default '' check(length(city)<=100),starts_on date not null,ends_on date not null,location text not null default '' check(length(location)<=300),
 reference text not null default '' check(length(reference)<=160),url text not null default '' check(length(url)<=2000 and (url='' or url ~ '^https://')),
 notes text not null default '' check(length(notes)<=2000),expense_id uuid,created_at timestamptz not null default now(),
 check(ends_on>=starts_on),foreign key(expense_id,trip_id) references public.expenses(id,trip_id)
);
alter table public.trip_tasks enable row level security;
alter table public.trip_bookings enable row level security;
create policy tasks_members on public.trip_tasks for all to authenticated using(private.is_member(trip_id)) with check(private.is_member(trip_id));
create policy bookings_members on public.trip_bookings for all to authenticated using(private.is_member(trip_id)) with check(private.is_member(trip_id));
revoke all on public.trip_tasks,public.trip_bookings from public,anon,authenticated;
grant select,insert,update,delete on public.trip_tasks,public.trip_bookings to authenticated;
create index tasks_trip_idx on public.trip_tasks(trip_id,done,due_on);
create index bookings_trip_idx on public.trip_bookings(trip_id,starts_on);
alter function public.hq_snapshot(uuid) rename to hq_snapshot_finance;
create function public.hq_snapshot(p_trip uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select public.hq_snapshot_finance(p_trip)||jsonb_build_object('companion_ready',true,
 'tasks',coalesce((select jsonb_agg(t order by t.done,t.due_on nulls last,t.created_at) from public.trip_tasks t where t.trip_id=p_trip),'[]'::jsonb),
 'bookings',coalesce((select jsonb_agg(b order by b.starts_on,b.created_at) from public.trip_bookings b where b.trip_id=p_trip),'[]'::jsonb)
 );
$$;
revoke all on function public.hq_snapshot(uuid) from public,anon;
grant execute on function public.hq_snapshot(uuid) to authenticated;
commit;
