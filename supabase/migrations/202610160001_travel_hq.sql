-- EuroTrip Travel HQ. Run with Supabase migrations or SQL editor as postgres.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.trips (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(name) between 1 and 100),
 owner_id uuid not null references auth.users(id),
 route_stops text[] not null default array['Madrid','Lisboa','Oporto','Londres','Róterdam','Ámsterdam','Bélgica','París','Madrid'] check(cardinality(route_stops) between 1 and 30),
 budget_minor bigint not null default 0 check (budget_minor between 0 and 1000000000000),
 starts_on date not null default '2027-04-22', ends_on date not null default '2027-05-19',
 created_at timestamptz not null default now(), check (ends_on >= starts_on)
);
create table public.trip_members (
 trip_id uuid not null references public.trips on delete cascade,
 user_id uuid not null references auth.users(id),
 display_name text not null check (length(display_name) between 1 and 80), email text not null,
 primary key (trip_id,user_id)
);
create table public.trip_invitations (
 id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips on delete cascade,
 email text not null check (email = lower(trim(email)) and length(email) <= 254 and email like '%@%'),
 created_at timestamptz not null default now(), unique(trip_id,email)
);

create function private.is_member(t uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.trip_members where trip_id=t and user_id=(select auth.uid()));
$$;
create function private.is_owner(t uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.trips where id=t and owner_id=(select auth.uid()));
$$;

create table public.expenses (
 id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips on delete cascade,
 request_id uuid not null default gen_random_uuid(),
 description text not null check (length(description) between 1 and 160),
 category text not null check(category in ('Alojamiento','Transporte','Comida','Actividades','Compras','Otros')),
 amount_minor bigint not null check(amount_minor between 1 and 1000000000000),
 currency text not null check(currency in ('EUR','USD','GBP','ARS')),
 rate_to_eur numeric(16,8) not null check(rate_to_eur>0), rate_date date not null,
 eur_minor bigint generated always as (round(amount_minor * rate_to_eur)::bigint) stored,
 occurred_on date not null, status text not null check(status in ('estimated','reserved','paid')),
 payer_id uuid not null, created_by uuid not null default auth.uid() references auth.users(id),
 notes text not null default '' check(length(notes)<=2000), created_at timestamptz not null default now(),
 foreign key(trip_id,payer_id) references public.trip_members(trip_id,user_id),
 unique(id,trip_id), unique(trip_id,request_id), check(eur_minor between 1 and 1000000000000), check(currency <> 'EUR' or rate_to_eur=1)
);
create table public.expense_shares (
 expense_id uuid not null, trip_id uuid not null, member_id uuid not null,
 amount_minor bigint not null check(amount_minor>=0), primary key(expense_id,member_id),
 foreign key(expense_id,trip_id) references public.expenses(id,trip_id) on delete cascade,
 foreign key(trip_id,member_id) references public.trip_members(trip_id,user_id)
);
create table public.settlements (
 id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips on delete cascade,
 request_id uuid not null default gen_random_uuid(), unique(trip_id,request_id),
 from_id uuid not null, to_id uuid not null, amount_minor bigint not null check(amount_minor between 1 and 1000000000000),
 currency text not null check(currency in ('EUR','USD','GBP','ARS')), rate_to_eur numeric(16,8) not null check(rate_to_eur>0),
 eur_minor bigint generated always as (round(amount_minor*rate_to_eur)::bigint) stored,
 occurred_on date not null, rate_date date not null, notes text not null default '' check(length(notes)<=2000),
 created_by uuid not null default auth.uid(),
 foreign key(trip_id,from_id) references public.trip_members(trip_id,user_id),
 foreign key(trip_id,to_id) references public.trip_members(trip_id,user_id),
 check(from_id<>to_id), check(eur_minor between 1 and 1000000000000), check(currency <> 'EUR' or rate_to_eur=1)
);
create table public.itinerary_events (
 id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips on delete cascade,
 title text not null check(length(title) between 1 and 160), city text not null check(length(city) between 1 and 100),
 starts_on date not null, ends_on date not null, kind text not null check(kind in ('stay','transport','activity')),
 notes text not null default '' check(length(notes)<=2000), expense_id uuid,
 check(ends_on>=starts_on), foreign key(expense_id,trip_id) references public.expenses(id,trip_id)
);
create table public.scenarios (
 id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips on delete cascade,
 name text not null check(length(name) between 1 and 100), notes text not null default '' check(length(notes)<=2000), unique(id,trip_id)
);
create table public.scenario_items (
 id uuid primary key default gen_random_uuid(), trip_id uuid not null, scenario_id uuid not null,
 description text not null check(length(description) between 1 and 160),
 amount_minor bigint not null check(amount_minor between 1 and 1000000000000), currency text not null check(currency in ('EUR','USD','GBP','ARS')),
 rate_to_eur numeric(16,8) not null check(rate_to_eur>0), rate_date date not null,
 eur_minor bigint generated always as (round(amount_minor*rate_to_eur)::bigint) stored,
 confidence text not null check(confidence in ('estimated','quoted','confirmed')), source text not null default '' check(length(source)<=1000),
 foreign key(scenario_id,trip_id) references public.scenarios(id,trip_id) on delete cascade,
 check(eur_minor between 1 and 1000000000000), check(currency <> 'EUR' or rate_to_eur=1),
 check(confidence='estimated' or length(trim(source))>0)
);
create table public.receipts (
 id uuid primary key default gen_random_uuid(), trip_id uuid not null, expense_id uuid not null,
 path text not null unique, filename text not null check(length(filename) between 1 and 200),
 created_by uuid not null default auth.uid(),
 foreign key(expense_id,trip_id) references public.expenses(id,trip_id) on delete cascade,
 check(split_part(path,'/',1)=trip_id::text)
);

-- Expose tables only through explicit policies. Financial writes use atomic RPCs.
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_invitations enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;
alter table public.settlements enable row level security;
alter table public.itinerary_events enable row level security;
alter table public.scenarios enable row level security;
alter table public.scenario_items enable row level security;
alter table public.receipts enable row level security;

create policy trips_read on public.trips for select to authenticated using(private.is_member(id));
create policy trips_update on public.trips for update to authenticated using(private.is_owner(id)) with check(private.is_owner(id));
create policy members_read on public.trip_members for select to authenticated using(private.is_member(trip_id));
create policy invitations_read on public.trip_invitations for select to authenticated using(private.is_owner(trip_id));
create policy invitations_delete on public.trip_invitations for delete to authenticated using(private.is_owner(trip_id));
create policy expenses_read on public.expenses for select to authenticated using(private.is_member(trip_id));
create policy shares_read on public.expense_shares for select to authenticated using(private.is_member(trip_id));
create policy settlements_read on public.settlements for select to authenticated using(private.is_member(trip_id));
create policy settlements_insert on public.settlements for insert to authenticated with check(private.is_member(trip_id) and created_by=auth.uid());
create policy settlements_delete on public.settlements for delete to authenticated using(private.is_member(trip_id) and (created_by=auth.uid() or private.is_owner(trip_id)));
create policy events_all on public.itinerary_events for all to authenticated using(private.is_member(trip_id)) with check(private.is_member(trip_id));
create policy scenarios_all on public.scenarios for all to authenticated using(private.is_member(trip_id)) with check(private.is_member(trip_id));
create policy items_all on public.scenario_items for all to authenticated using(private.is_member(trip_id)) with check(private.is_member(trip_id));
create policy receipts_read on public.receipts for select to authenticated using(private.is_member(trip_id));
create policy receipts_insert on public.receipts for insert to authenticated with check(private.is_member(trip_id) and created_by=auth.uid());
create policy receipts_delete on public.receipts for delete to authenticated using(private.is_member(trip_id) and (created_by=auth.uid() or private.is_owner(trip_id)));

-- Narrow grants: authenticated users cannot rewrite owner, identities or ledger shares.
revoke all on public.trips, public.trip_members, public.trip_invitations, public.expenses, public.expense_shares, public.settlements, public.itinerary_events, public.scenarios, public.scenario_items, public.receipts from anon, authenticated;
grant select on public.trips, public.trip_members, public.trip_invitations, public.expenses, public.expense_shares, public.settlements, public.itinerary_events, public.scenarios, public.scenario_items, public.receipts to authenticated;
grant update(name,budget_minor,starts_on,ends_on,route_stops) on public.trips to authenticated;
grant delete on public.trip_invitations to authenticated;
grant insert,delete on public.settlements to authenticated;
grant insert,update,delete on public.itinerary_events, public.scenarios, public.scenario_items to authenticated;
grant insert,delete on public.receipts to authenticated;

create function public.create_trip(p_name text, p_display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare t uuid; mail text;
begin
 select lower(email) into mail from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if mail is null then raise exception 'Se requiere un correo confirmado.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if exists(select 1 from public.trip_members where user_id=auth.uid()) then raise exception 'Ya pertenecés a un viaje.'; end if;
 insert into public.trips(name,owner_id) values(p_name,auth.uid()) returning id into t;
 insert into public.trip_members values(t,auth.uid(),p_display_name,mail);
 return t;
end; $$;

create function public.invite_member(p_trip uuid, p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare mail text := lower(trim(p_email)); slots int;
begin
 if not private.is_owner(p_trip) then raise exception 'Solo el organizador puede invitar.'; end if;
 perform 1 from public.trips where id=p_trip for update;
 if exists(select 1 from public.trip_members where trip_id=p_trip and email=mail) then raise exception 'Este correo ya integra el viaje.'; end if;
 if exists(select 1 from public.trip_invitations where trip_id=p_trip and email=mail) then return; end if;
 select (select count(*) from public.trip_members where trip_id=p_trip)+(select count(*) from public.trip_invitations where trip_id=p_trip) into slots;
 if slots>=4 then raise exception 'El grupo admite hasta cuatro personas, incluyendo invitaciones pendientes.'; end if;
 insert into public.trip_invitations(trip_id,email) values(p_trip,mail);
end; $$;

-- Knowing the URL or a trip UUID never grants access; email must be confirmed.
create function public.accept_invitations() returns void
language plpgsql security definer set search_path = '' as $$
declare mail text; invitation record;
begin
 select lower(email) into mail from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if mail is null then return; end if;
 for invitation in select * from public.trip_invitations where email=mail order by created_at loop
  perform 1 from public.trips where id=invitation.trip_id for update;
  if not exists(select 1 from public.trip_invitations where id=invitation.id) then continue; end if;
  if (select count(*) from public.trip_members where trip_id=invitation.trip_id)<4 then
   insert into public.trip_members(trip_id,user_id,display_name,email) values(invitation.trip_id,auth.uid(),split_part(mail,'@',1),mail) on conflict do nothing;
   delete from public.trip_invitations where id=invitation.id;
  end if;
 end loop;
end; $$;

create function public.save_expense(p_id uuid,p_trip uuid,p_description text,p_category text,p_amount bigint,p_currency text,p_rate numeric,p_rate_date date,p_date date,p_status text,p_payer uuid,p_members uuid[],p_notes text,p_request uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare eid uuid; converted bigint; n int; current_member uuid; idx int := 0;
begin
 if not private.is_member(p_trip) then raise exception 'Acceso denegado.'; end if;
 n := cardinality(p_members);
 if n is null or n<1 or n>4 or (select count(distinct x) from unnest(p_members) x)<>n or exists(select 1 from unnest(p_members) x where x is null or not exists(select 1 from public.trip_members where trip_id=p_trip and user_id=x)) then raise exception 'Participantes inválidos.'; end if;
 if p_id is null then
  if p_request is not null then
   perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
   select id into eid from public.expenses where trip_id=p_trip and request_id=p_request;
   if eid is not null then return eid; end if;
  end if;
  insert into public.expenses(request_id,trip_id,description,category,amount_minor,currency,rate_to_eur,rate_date,occurred_on,status,payer_id,created_by,notes)
  values(coalesce(p_request,gen_random_uuid()),p_trip,p_description,p_category,p_amount,p_currency,p_rate,p_rate_date,p_date,p_status,p_payer,auth.uid(),p_notes) returning id,eur_minor into eid,converted;
 else
  -- Serializes concurrent edits; shares and amount are committed together.
  update public.expenses set description=p_description,category=p_category,amount_minor=p_amount,currency=p_currency,rate_to_eur=p_rate,rate_date=p_rate_date,occurred_on=p_date,status=p_status,payer_id=p_payer,notes=p_notes
  where id=p_id and trip_id=p_trip returning id,eur_minor into eid,converted;
  if eid is null then raise exception 'Gasto inexistente.'; end if;
  delete from public.expense_shares where expense_id=eid;
 end if;
 for current_member in select unnest(p_members) order by 1 loop
  insert into public.expense_shares values(eid,p_trip,current_member,(converted/n)+(case when idx<(converted%n) then 1 else 0 end));
  idx:=idx+1;
 end loop;
 return eid;
end; $$;
create function public.mark_expense_paid(p_id uuid,p_trip uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_member(p_trip) then raise exception 'Acceso denegado.'; end if;
 update public.expenses set status='paid' where id=p_id and trip_id=p_trip;
 if not found then raise exception 'Gasto inexistente.'; end if;
end; $$;
create function public.delete_expense(p_id uuid,p_trip uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_member(p_trip) then raise exception 'Acceso denegado.'; end if;
 update public.itinerary_events set expense_id=null where expense_id=p_id and trip_id=p_trip;
 delete from public.expenses where id=p_id and trip_id=p_trip;
 if not found then raise exception 'Gasto inexistente.'; end if;
end; $$;

-- Private storage: receipts never have public URLs. Files are limited to 5 MiB.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('receipts','receipts',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf']);
create function private.storage_trip(path text) returns uuid language plpgsql immutable set search_path='' as $$
begin return split_part(path,'/',1)::uuid; exception when invalid_text_representation then return null; end; $$;
create policy receipts_storage_read on storage.objects for select to authenticated using(bucket_id='receipts' and private.is_member(private.storage_trip(name)));
create policy receipts_storage_insert on storage.objects for insert to authenticated with check(bucket_id='receipts' and private.is_member(private.storage_trip(name)));
create policy receipts_storage_delete on storage.objects for delete to authenticated using(bucket_id='receipts' and private.is_member(private.storage_trip(name)));

-- Supabase may grant function execution to PUBLIC by default. Explicitly revoke it.
revoke execute on all functions in schema private from public,anon;
grant execute on all functions in schema private to authenticated;
revoke execute on function public.create_trip(text,text), public.invite_member(uuid,text), public.accept_invitations(), public.save_expense(uuid,uuid,text,text,bigint,text,numeric,date,date,text,uuid,uuid[],text,uuid), public.mark_expense_paid(uuid,uuid), public.delete_expense(uuid,uuid) from public,anon;
grant execute on function public.create_trip(text,text), public.invite_member(uuid,text), public.accept_invitations(), public.save_expense(uuid,uuid,text,text,bigint,text,numeric,date,date,text,uuid,uuid[],text,uuid), public.mark_expense_paid(uuid,uuid), public.delete_expense(uuid,uuid) to authenticated;
create index members_user_idx on public.trip_members(user_id);
create index invitations_email_idx on public.trip_invitations(email);
create index expenses_trip_idx on public.expenses(trip_id,occurred_on desc);
create index shares_trip_idx on public.expense_shares(trip_id);
create index settlements_trip_idx on public.settlements(trip_id);
create index events_trip_idx on public.itinerary_events(trip_id,starts_on);
create index scenarios_trip_idx on public.scenarios(trip_id);
create index items_trip_idx on public.scenario_items(trip_id);
create index receipts_trip_idx on public.receipts(trip_id);
-- One SQL statement sees a consistent snapshot of expenses and their shares.
create function public.hq_snapshot(p_trip uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'trip',to_jsonb(t),
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
revoke execute on function public.hq_snapshot(uuid) from public,anon;
grant execute on function public.hq_snapshot(uuid) to authenticated;
commit;
