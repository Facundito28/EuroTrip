begin;
lock table public.expenses,public.expense_shares in share row exclusive mode;
create temporary table travel_hq_baseline on commit drop as select
 (select md5(coalesce(jsonb_agg(to_jsonb(e) order by e.id)::text,'[]')) from public.expenses e) as expense_hash,
 (select md5(coalesce(jsonb_agg(to_jsonb(s) order by s.expense_id,s.member_id)::text,'[]')) from public.expense_shares s) as shares_hash,
 (select count(*) from public.expenses where status='paid') as paid_count;
alter table public.expenses add column split_method text not null default 'equal' check(split_method in ('equal','amount','percent'));
alter table public.expense_shares add column weight bigint not null default 1 check(weight>=0);
create table public.expense_payments(
 id uuid primary key default gen_random_uuid(),trip_id uuid not null,expense_id uuid not null,
 request_id uuid not null default gen_random_uuid(),payer_id uuid not null,
 amount_minor bigint not null check(amount_minor between 1 and 1000000000000),
 rate_to_eur numeric(16,8) not null check(rate_to_eur>0),rate_date date not null,occurred_on date not null,
 eur_minor bigint generated always as (round(amount_minor*rate_to_eur)::bigint) stored check(eur_minor between 1 and 1000000000000),
 notes text not null default '' check(length(notes)<=2000),created_by uuid references auth.users,created_at timestamptz not null default now(),
 unique(trip_id,request_id),foreign key(expense_id,trip_id) references public.expenses(id,trip_id) on delete cascade,
 foreign key(trip_id,payer_id) references public.trip_members(trip_id,user_id)
);
-- Preserve all existing paid amounts and payers. Reservations remain unpaid.
insert into public.expense_payments(trip_id,expense_id,payer_id,amount_minor,rate_to_eur,rate_date,occurred_on,created_by)
 select trip_id,id,payer_id,amount_minor,rate_to_eur,rate_date,occurred_on,created_by from public.expenses where status='paid';
alter table public.expense_payments enable row level security;
create policy payments_read on public.expense_payments for select to authenticated using(private.is_member(trip_id));
revoke all on public.expense_payments from public,anon,authenticated;
grant select on public.expense_payments to authenticated;
create table public.activity_log(
 id uuid primary key default gen_random_uuid(),trip_id uuid not null references public.trips on delete cascade,
 actor_id uuid references auth.users on delete set null,entity text not null,action text not null,
 label text not null,before_data jsonb,after_data jsonb,created_at timestamptz not null default now()
);
create index activity_trip_time on public.activity_log(trip_id,created_at desc);
alter table public.activity_log enable row level security;
create policy activity_read on public.activity_log for select to authenticated using(private.is_member(trip_id));
revoke all on public.activity_log from public,anon,authenticated;
grant select on public.activity_log to authenticated;
create function private.capture_activity() returns trigger language plpgsql security definer set search_path='' as $$
declare oldrow jsonb; newrow jsonb; rowdata jsonb; target uuid;
begin
 if TG_OP<>'INSERT' then oldrow:=to_jsonb(old); end if;
 if TG_OP<>'DELETE' then newrow:=to_jsonb(new); end if;
 if oldrow is not distinct from newrow then return null; end if;
 rowdata:=coalesce(newrow,oldrow);target:=coalesce((rowdata->>'trip_id')::uuid,(rowdata->>'id')::uuid);
 if auth.uid() is not null and exists(select 1 from public.trips where id=target) then
 insert into public.activity_log(trip_id,actor_id,entity,action,label,before_data,after_data)
 values(target,auth.uid(),TG_TABLE_NAME,TG_OP,coalesce(rowdata->>'description',rowdata->>'title',rowdata->>'display_name',rowdata->>'name',case when TG_TABLE_NAME='expense_payments' then 'Pago de gasto' else 'Transferencia entre amigos' end),oldrow,newrow);
 end if;
 return null;
end; $$;
create trigger audit_expenses after insert or update or delete on public.expenses for each row execute function private.capture_activity();
create trigger audit_payments after insert or delete on public.expense_payments for each row execute function private.capture_activity();
create trigger audit_settlements after insert or delete on public.settlements for each row execute function private.capture_activity();
create trigger audit_events after insert or update or delete on public.itinerary_events for each row execute function private.capture_activity();
create trigger audit_members after update on public.trip_members for each row execute function private.capture_activity();
create trigger audit_trips after update on public.trips for each row execute function private.capture_activity();

create function public.add_expense_payment(p_trip uuid,p_expense uuid,p_request uuid,p_payer uuid,p_amount bigint,p_rate numeric,p_rate_date date,p_date date,p_notes text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.expenses; paid bigint; pid uuid;
begin
 if not private.is_member(p_trip) then raise exception 'Acceso denegado.'; end if;
 select * into e from public.expenses where id=p_expense and trip_id=p_trip for update;
 if not found then raise exception 'Gasto inexistente.'; end if;
 select id into pid from public.expense_payments where trip_id=p_trip and request_id=p_request;
 if pid is not null then
  if not exists(select 1 from public.expense_payments where id=pid and expense_id=p_expense) then raise exception 'Solicitud ya utilizada.'; end if;
  return pid;
 end if;
 select coalesce(sum(amount_minor),0) into paid from public.expense_payments where expense_id=e.id;
 if e.status='estimated' then raise exception 'Confirmá la reserva antes de registrar un pago.'; end if;
 if p_amount is null or p_amount<=0 or paid+p_amount>e.amount_minor then raise exception 'El pago supera el saldo pendiente o es inválido.'; end if;
 if (select coalesce(sum(eur_minor),0) from public.expense_payments where expense_id=e.id)+round(p_amount*p_rate)>1000000000000 then raise exception 'El total de pagos EUR supera el límite permitido.'; end if;
 if e.currency='EUR' and p_rate<>1 then raise exception 'La cotización EUR debe ser 1.'; end if;
 insert into public.expense_payments(trip_id,expense_id,request_id,payer_id,amount_minor,rate_to_eur,rate_date,occurred_on,notes,created_by)
 values(p_trip,e.id,p_request,p_payer,p_amount,p_rate,p_rate_date,p_date,p_notes,auth.uid()) returning id into pid;
 update public.expenses set status=case when paid+p_amount=amount_minor then 'paid' else 'reserved' end where id=e.id and status is distinct from case when paid+p_amount=amount_minor then 'paid' else 'reserved' end;
 return pid;
end; $$;
create function public.delete_expense_payment(p_trip uuid,p_payment uuid) returns void language plpgsql security definer set search_path='' as $$
declare eid uuid; e public.expenses;
begin
 if not private.is_member(p_trip) then raise exception 'Acceso denegado.'; end if;
 select expense_id into eid from public.expense_payments where id=p_payment and trip_id=p_trip;
 select * into e from public.expenses where id=eid and trip_id=p_trip for update;
 if not found then raise exception 'Pago inexistente.'; end if;
 if not exists(select 1 from public.expense_payments where id=p_payment and (created_by=auth.uid() or private.is_owner(p_trip))) then raise exception 'Solo quien registró el pago o el organizador puede anularlo.'; end if;
 delete from public.expense_payments where id=p_payment;
 update public.expenses set status='reserved' where id=eid;
end; $$;

alter function public.save_expense(uuid,uuid,text,text,bigint,text,numeric,date,date,text,uuid,uuid[],text,uuid) rename to save_expense_base;
revoke all on function public.save_expense_base(uuid,uuid,text,text,bigint,text,numeric,date,date,text,uuid,uuid[],text,uuid) from public,anon,authenticated;
create or replace function public.save_expense_base(p_id uuid,p_trip uuid,p_description text,p_category text,p_amount bigint,p_currency text,p_rate numeric,p_rate_date date,p_date date,p_status text,p_payer uuid,p_members uuid[],p_notes text,p_request uuid default null) returns uuid
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
  insert into public.expense_shares(expense_id,trip_id,member_id,amount_minor) values(eid,p_trip,current_member,(converted/n)+(case when idx<(converted%n) then 1 else 0 end));
  idx:=idx+1;
 end loop;
 return eid;
end; $$;

create function public.save_expense_v2(p_id uuid,p_trip uuid,p_description text,p_category text,p_amount bigint,p_currency text,p_rate numeric,p_rate_date date,p_date date,p_status text,p_payer uuid,p_members uuid[],p_notes text,p_request uuid,p_method text default 'equal',p_weights bigint[] default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare eid uuid; e public.expenses; converted bigint; paid bigint; n int; total_weight numeric; assigned bigint; idx int; w bigint[]; allocations bigint[]; remainder bigint; old_splits jsonb; new_splits jsonb;
begin
 if not private.is_member(p_trip) then raise exception 'Acceso denegado.'; end if;
 if p_id is null then
  if p_request is null then raise exception 'Falta identificador de solicitud.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
  select id into eid from public.expenses where trip_id=p_trip and request_id=p_request;
  if eid is not null then return eid; end if;
 else
  select * into e from public.expenses where id=p_id and trip_id=p_trip for update;
  if not found then raise exception 'Gasto inexistente.'; end if;
  select jsonb_agg(jsonb_build_object('member_id',member_id,'weight',weight) order by member_id) into old_splits from public.expense_shares where expense_id=e.id;
  select coalesce(sum(amount_minor),0) into paid from public.expense_payments where expense_id=e.id;
  if paid>0 and (p_currency<>e.currency or p_rate<>e.rate_to_eur or p_rate_date<>e.rate_date or p_payer<>e.payer_id) then raise exception 'Con pagos registrados no se puede cambiar moneda, cotización base ni pagador original. Anulá los pagos incorrectos primero.'; end if;
  if paid>p_amount or (paid>0 and p_status='estimated') then raise exception 'El total no puede ser menor a lo pagado ni convertirse en estimación.'; end if;
 end if;
 if p_status not in ('paid','reserved','estimated') or p_method not in ('equal','amount','percent') then raise exception 'Estado o reparto inválido.'; end if;
 n:=cardinality(p_members);
 if p_method='equal' then w:=array_fill(1::bigint,array[n]);else w:=p_weights;end if;
 if n is null or n<1 or n>4 or cardinality(w) is distinct from n or exists(select 1 from unnest(w) x where x is null or x<0) then raise exception 'Reparto inválido.'; end if;
 select sum(x) into total_weight from unnest(w) x;
 if total_weight<=0 or (p_method='amount' and total_weight<>p_amount) or (p_method='percent' and total_weight<>10000) then raise exception 'Los importes deben sumar el total y los porcentajes 100%%.'; end if;
 eid:=public.save_expense_base(p_id,p_trip,p_description,p_category,p_amount,p_currency,p_rate,p_rate_date,p_date,case when p_status='estimated' then 'estimated' else 'reserved' end,p_payer,p_members,p_notes,p_request);
 select eur_minor into converted from public.expenses where id=eid;
 allocations:=array_fill(0::bigint,array[n]);assigned:=0;
 for idx in 1..n loop allocations[idx]:=floor(converted::numeric*w[idx]/total_weight);assigned:=assigned+allocations[idx];end loop;
 remainder:=converted-assigned;
 -- Largest remainder; ties by member UUID, identical to browser money calculations.
 for idx in select i from generate_series(1,n) i order by mod(converted::numeric*w[i],total_weight) desc,p_members[i] loop
  exit when remainder=0;allocations[idx]:=allocations[idx]+1;remainder:=remainder-1;
 end loop;
 for idx in 1..n loop update public.expense_shares set amount_minor=allocations[idx],weight=w[idx] where expense_id=eid and member_id=p_members[idx];end loop;
 update public.expenses set split_method=p_method where id=eid and split_method<>p_method;
 select coalesce(sum(amount_minor),0) into paid from public.expense_payments where expense_id=eid;
 if p_status='paid' and paid<p_amount then perform public.add_expense_payment(p_trip,eid,gen_random_uuid(),p_payer,p_amount-paid,p_rate,p_rate_date,p_date,'Pago al guardar el gasto');
 elsif paid=p_amount then update public.expenses set status='paid' where id=eid and status<>'paid';end if;
 select jsonb_agg(jsonb_build_object('member_id',member_id,'weight',weight) order by member_id) into new_splits from public.expense_shares where expense_id=eid;
 if old_splits is distinct from new_splits then insert into public.activity_log(trip_id,actor_id,entity,action,label,before_data,after_data) values(p_trip,auth.uid(),'expense_shares',case when old_splits is null then 'INSERT' else 'UPDATE' end,p_description,jsonb_build_object('reparto',old_splits,'metodo',e.split_method,'moneda',p_currency),jsonb_build_object('reparto',new_splits,'metodo',p_method,'moneda',p_currency));end if;
 return eid;
end; $$;
create function public.save_expense(p_id uuid,p_trip uuid,p_description text,p_category text,p_amount bigint,p_currency text,p_rate numeric,p_rate_date date,p_date date,p_status text,p_payer uuid,p_members uuid[],p_notes text,p_request uuid default null) returns uuid
language sql security invoker set search_path='' as $$ select public.save_expense_v2(p_id,p_trip,p_description,p_category,p_amount,p_currency,p_rate,p_rate_date,p_date,p_status,p_payer,p_members,p_notes,coalesce(p_request,gen_random_uuid()),'equal',null); $$;
create or replace function public.mark_expense_paid(p_id uuid,p_trip uuid) returns void language plpgsql security definer set search_path='' as $$
declare e public.expenses; paid bigint;
begin
 if not private.is_member(p_trip) then raise exception 'Acceso denegado.'; end if;
 select * into e from public.expenses where id=p_id and trip_id=p_trip for update;
 if not found then raise exception 'Gasto inexistente.';end if;
 select coalesce(sum(amount_minor),0) into paid from public.expense_payments where expense_id=e.id;
 if paid<e.amount_minor then
 update public.expenses set status='reserved' where id=e.id and status='estimated';
 perform public.add_expense_payment(p_trip,e.id,gen_random_uuid(),e.payer_id,e.amount_minor-paid,e.rate_to_eur,e.rate_date,current_date,'Saldo final');end if;
end; $$;
revoke all on function public.save_expense(uuid,uuid,text,text,bigint,text,numeric,date,date,text,uuid,uuid[],text,uuid),public.save_expense_v2(uuid,uuid,text,text,bigint,text,numeric,date,date,text,uuid,uuid[],text,uuid,text,bigint[]),public.add_expense_payment(uuid,uuid,uuid,uuid,bigint,numeric,date,date,text),public.delete_expense_payment(uuid,uuid) from public,anon;
grant execute on function public.save_expense(uuid,uuid,text,text,bigint,text,numeric,date,date,text,uuid,uuid[],text,uuid),public.save_expense_v2(uuid,uuid,text,text,bigint,text,numeric,date,date,text,uuid,uuid[],text,uuid,text,bigint[]),public.add_expense_payment(uuid,uuid,uuid,uuid,bigint,numeric,date,date,text),public.delete_expense_payment(uuid,uuid) to authenticated;
create or replace function public.hq_snapshot(p_trip uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
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


do $$
begin
 if (select expense_hash from pg_temp.travel_hq_baseline) is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(e)-'split_method' order by e.id)::text,'[]')) from public.expenses e)
 or (select shares_hash from pg_temp.travel_hq_baseline) is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(s)-'weight' order by s.expense_id,s.member_id)::text,'[]')) from public.expense_shares s)
 or (select paid_count from pg_temp.travel_hq_baseline)<>(select count(*) from public.expense_payments)
 or exists(select 1 from public.expenses e join public.expense_payments p on p.expense_id=e.id where e.amount_minor<>p.amount_minor or e.eur_minor<>p.eur_minor or e.payer_id<>p.payer_id)
 then raise exception 'La migración no conserva los movimientos anteriores. Se revierte completa.';end if;
end; $$;
commit;
