begin;
alter table public.expenses add column due_on date;
alter table public.expenses add column deleted_at timestamptz;
alter table public.expenses add column deleted_by uuid references auth.users;
alter table public.personal_expenses add column due_on date;
alter table public.personal_expenses add column deleted_at timestamptz;
grant insert(due_on),update(due_on) on public.personal_expenses to authenticated;
revoke delete on public.personal_expenses from authenticated;
create or replace function public.delete_expense(p_id uuid,p_trip uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_member(p_trip) then raise exception 'Acceso denegado.';end if;
 update public.expenses set deleted_at=now(),deleted_by=auth.uid() where id=p_id and trip_id=p_trip and deleted_at is null;
 if not found then raise exception 'Gasto inexistente o ya eliminado.';end if;
end; $$;
create function public.restore_expense(p_id uuid,p_trip uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_member(p_trip) then raise exception 'Acceso denegado.';end if;
 update public.expenses set deleted_at=null,deleted_by=null where id=p_id and trip_id=p_trip and deleted_at is not null;
 if not found then raise exception 'Gasto no encontrado en la papelera.';end if;
end; $$;
create function public.trash_personal_expense(p_id uuid,p_trip uuid,p_restore boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.personal_expenses set deleted_at=case when p_restore then null else now() end
 where id=p_id and trip_id=p_trip and user_id=auth.uid() and private.is_member(p_trip) and ((p_restore and deleted_at is not null) or (not p_restore and deleted_at is null));
 if not found then raise exception 'Gasto personal no encontrado.';end if;
end; $$;
create function private.guard_trash() returns trigger language plpgsql set search_path='' as $$
begin
 if old.deleted_at is not null and new.deleted_at is not null then raise exception 'Restaurá el gasto antes de editarlo.';end if;return new;
end; $$;
create trigger expenses_guard_trash before update on public.expenses for each row execute function private.guard_trash();
create trigger personal_guard_trash before update on public.personal_expenses for each row execute function private.guard_trash();
create function private.guard_payment_trash() returns trigger language plpgsql set search_path='' as $$
declare eid uuid;
begin
 eid:=case when TG_OP='DELETE' then old.expense_id else new.expense_id end;
 if exists(select 1 from public.expenses where id=eid and deleted_at is not null) then raise exception 'Restaurá el gasto antes de modificar sus pagos.';end if; if TG_OP='DELETE' then return old;end if;return new;
end; $$;
create trigger payments_guard_trash before insert or delete on public.expense_payments for each row execute function private.guard_payment_trash();
create function public.save_expense_v4(p_id uuid,p_trip uuid,p_description text,p_category text,p_amount bigint,p_currency text,p_rate numeric,p_rate_date date,p_date date,p_status text,p_payer uuid,p_members uuid[],p_notes text,p_request uuid,p_method text default 'equal',p_weights bigint[] default null,p_due date default null) returns uuid language plpgsql security definer set search_path='' as $$
declare eid uuid;
begin
 eid:=public.save_expense_v2(p_id,p_trip,p_description,p_category,p_amount,p_currency,p_rate,p_rate_date,p_date,p_status,p_payer,p_members,p_notes,p_request,p_method,p_weights);
 update public.expenses set due_on=p_due where id=eid and due_on is distinct from p_due;
 return eid;
end; $$;
create function public.possible_duplicate(p_trip uuid,p_description text,p_amount bigint,p_currency text,p_date date,p_id uuid default null,p_request uuid default null,p_private boolean default false) returns boolean language plpgsql stable security invoker set search_path='' as $$
begin
 if p_private then return exists(select 1 from public.personal_expenses e where e.trip_id=p_trip and e.user_id=auth.uid() and e.deleted_at is null and (p_id is null or e.id<>p_id) and (p_request is null or e.request_id<>p_request) and e.amount_minor=p_amount and e.currency=p_currency and e.occurred_on=p_date and lower(regexp_replace(trim(e.description),'\s+',' ','g'))=lower(regexp_replace(trim(p_description),'\s+',' ','g')));
 else return exists(select 1 from public.expenses e where e.trip_id=p_trip and e.deleted_at is null and (p_id is null or e.id<>p_id) and (p_request is null or e.request_id<>p_request) and e.amount_minor=p_amount and e.currency=p_currency and e.occurred_on=p_date and lower(regexp_replace(trim(e.description),'\s+',' ','g'))=lower(regexp_replace(trim(p_description),'\s+',' ','g')));end if;
end; $$;
revoke all on function public.restore_expense(uuid,uuid),public.trash_personal_expense(uuid,uuid,boolean),public.possible_duplicate(uuid,text,bigint,text,date,uuid,uuid,boolean),public.save_expense_v4(uuid,uuid,text,text,bigint,text,numeric,date,date,text,uuid,uuid[],text,uuid,text,bigint[],date) from public,anon;
grant execute on function public.restore_expense(uuid,uuid),public.trash_personal_expense(uuid,uuid,boolean),public.possible_duplicate(uuid,text,bigint,text,date,uuid,uuid,boolean),public.save_expense_v4(uuid,uuid,text,text,bigint,text,numeric,date,date,text,uuid,uuid[],text,uuid,text,bigint[],date) to authenticated;
create or replace function public.hq_snapshot(p_trip uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'trash',coalesce((select jsonb_agg(e order by e.deleted_at desc) from public.expenses e where e.trip_id=t.id and e.deleted_at is not null),'[]'::jsonb),
  'personal_trash',coalesce((select jsonb_agg(e order by e.deleted_at desc) from public.personal_expenses e where e.trip_id=t.id and e.user_id=auth.uid() and e.deleted_at is not null),'[]'::jsonb),
  'personal_expenses',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('rate_to_eur',p.rate_to_eur::text) order by p.occurred_on desc,p.created_at desc) from public.personal_expenses p where p.trip_id=t.id and p.user_id=auth.uid() and p.deleted_at is null),'[]'::jsonb),
  'payments',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('rate_to_eur',p.rate_to_eur::text) order by p.occurred_on,p.created_at) from public.expense_payments p where p.trip_id=t.id and exists(select 1 from public.expenses e where e.id=p.expense_id and e.deleted_at is null)),'[]'::jsonb),
  'activity',coalesce((select jsonb_agg(a order by a.created_at desc,a.id desc) from (select * from public.activity_log where trip_id=t.id order by created_at desc,id desc limit 100) a),'[]'::jsonb),
  'trip',to_jsonb(t)||jsonb_build_object('usd_per_eur',t.usd_per_eur::text),
  'personal_budget_minor',(select b.budget_minor from public.personal_budgets b where b.trip_id=t.id and b.user_id=auth.uid()),
  'members',coalesce((select jsonb_agg(m) from public.trip_members m where m.trip_id=t.id),'[]'::jsonb),
  'expenses',coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object('rate_to_eur',e.rate_to_eur::text,'paid_original_minor',coalesce((select sum(p.amount_minor) from public.expense_payments p where p.expense_id=e.id),0),'paid_eur_minor',coalesce((select sum(p.eur_minor) from public.expense_payments p where p.expense_id=e.id),0)) order by e.occurred_on desc,e.created_at desc) from public.expenses e where e.trip_id=t.id and e.deleted_at is null),'[]'::jsonb),
  'shares',coalesce((select jsonb_agg(s) from public.expense_shares s where s.trip_id=t.id and exists(select 1 from public.expenses e where e.id=s.expense_id and e.deleted_at is null)),'[]'::jsonb),
  'settlements',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('rate_to_eur',s.rate_to_eur::text) order by s.occurred_on desc) from public.settlements s where s.trip_id=t.id),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(e order by e.starts_on) from public.itinerary_events e where e.trip_id=t.id),'[]'::jsonb),
  'scenarios',coalesce((select jsonb_agg(s) from public.scenarios s where s.trip_id=t.id),'[]'::jsonb),
  'items',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('rate_to_eur',i.rate_to_eur::text)) from public.scenario_items i where i.trip_id=t.id),'[]'::jsonb),
  'invitations',coalesce((select jsonb_agg(i) from public.trip_invitations i where i.trip_id=t.id),'[]'::jsonb),
  'receipts',coalesce((select jsonb_agg(r) from public.receipts r where r.trip_id=t.id),'[]'::jsonb)
 ) from public.trips t where t.id=p_trip;
$$;




commit;
