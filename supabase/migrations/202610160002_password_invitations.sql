-- Password sign-in without SMTP. Membership requires a separate secret invite;
-- an unverified email address alone MUST NEVER grant access to a trip.
begin;
alter table public.trip_invitations add column code_hash text check(code_hash is null or code_hash ~ '^[a-f0-9]{64}$');
alter table public.trip_invitations add column expires_at timestamptz not null default (now()+interval '7 days');
create unique index invitations_hash_idx on public.trip_invitations(code_hash) where code_hash is not null;

-- Disable the old email-only acceptance path before enabling automatic email
-- confirmation in Auth. Keep a harmless compatibility stub for old clients.
create or replace function public.accept_invitations() returns void language plpgsql security invoker set search_path='' as $$
begin return; end; $$;
revoke execute on function public.invite_member(uuid,text) from authenticated;

create function public.create_invitation(p_trip uuid,p_email text) returns text
language plpgsql security definer set search_path='' as $$
declare mail text:=lower(trim(p_email)); code text; slots int;
begin
 if not private.is_owner(p_trip) then raise exception 'Solo el organizador puede invitar.'; end if;
 perform 1 from public.trips where id=p_trip for update;
 if exists(select 1 from public.trip_members where trip_id=p_trip and email=mail) then raise exception 'Este correo ya integra el viaje.'; end if;
 if not exists(select 1 from public.trip_invitations where trip_id=p_trip and email=mail) then
  select (select count(*) from public.trip_members where trip_id=p_trip)+(select count(*) from public.trip_invitations where trip_id=p_trip) into slots;
  if slots>=4 then raise exception 'El grupo admite hasta cuatro personas, incluyendo invitaciones pendientes.'; end if;
 end if;
 code:=replace(gen_random_uuid()::text,'-','');
 insert into public.trip_invitations(trip_id,email,code_hash,expires_at)
 values(p_trip,mail,encode(sha256(convert_to(code,'UTF8')),'hex'),now()+interval '7 days')
 on conflict(trip_id,email) do update set code_hash=excluded.code_hash,expires_at=excluded.expires_at;
 return code;
end; $$;

create function public.accept_invitation(p_code text) returns uuid
language plpgsql security definer set search_path='' as $$
declare invitation public.trip_invitations; mail text; target uuid;
begin
 if auth.uid() is null or p_code is null or p_code !~ '^[a-f0-9]{32}$' then raise exception 'Invitación inválida o vencida.'; end if;
 select lower(email) into mail from auth.users where id=auth.uid();
 select trip_id into target from public.trip_invitations where code_hash=encode(sha256(convert_to(p_code,'UTF8')),'hex');
 if target is null then raise exception 'Invitación inválida o vencida.'; end if;
 -- Same lock order as creation: parent trip first, then invitation.
 perform 1 from public.trips where id=target for update;
 select * into invitation from public.trip_invitations where trip_id=target and code_hash=encode(sha256(convert_to(p_code,'UTF8')),'hex') for update;
 if not found or invitation.expires_at<=now() then raise exception 'Invitación inválida o vencida.'; end if;
 if invitation.email<>mail then raise exception 'Ingresá con el correo al que se emitió esta invitación.'; end if;
 if (select count(*) from public.trip_members where trip_id=target)>=4 then raise exception 'El grupo ya tiene cuatro integrantes.'; end if;
 insert into public.trip_members(trip_id,user_id,display_name,email) values(target,auth.uid(),split_part(mail,'@',1),mail);
 delete from public.trip_invitations where id=invitation.id;
 return target;
end; $$;
revoke execute on function public.create_invitation(uuid,text), public.accept_invitation(text) from public,anon;
grant execute on function public.create_invitation(uuid,text), public.accept_invitation(text) to authenticated;
commit;
