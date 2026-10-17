begin;
-- Hashes are private. Plain recovery codes are returned only when generated.
create table private.recovery_codes(user_id uuid not null references auth.users(id) on delete cascade, code_hash text primary key, created_at timestamptz not null default now());
create table private.recovery_limits(bucket text primary key, started_at timestamptz not null, attempts integer not null);
revoke all on private.recovery_codes,private.recovery_limits from public,anon,authenticated;
create function public.generate_recovery_codes() returns text[] language plpgsql security definer set search_path='' as $$
declare codes text[]='{}'; code text; i integer;
begin
 if auth.uid() is null then raise exception 'Ingresá a tu cuenta.';end if;
 delete from private.recovery_codes where user_id=auth.uid();
 for i in 1..8 loop
  code:=replace(gen_random_uuid()::text,'-','');
  insert into private.recovery_codes(user_id,code_hash) values(auth.uid(),encode(sha256(convert_to(code,'UTF8')),'hex'));
  codes:=array_append(codes,code);
 end loop;
 return codes;
end; $$;
-- Only the server's project service role may check a code and obtain an account ID.
create function public.consume_recovery_code(p_email text,p_code text,p_client text) returns uuid language plpgsql security definer set search_path='' as $$
declare bucket_key text; count_attempts integer; target uuid;
begin
 if length(p_email)>320 or p_code !~ '^[a-f0-9]{32}$' or p_client !~ '^[a-f0-9]{64}$' then return null;end if;
 delete from private.recovery_limits where bucket in(select bucket from private.recovery_limits where started_at<now()-interval '7 days' limit 1000);
 foreach bucket_key in array array['client:'||p_client,'email:'||encode(sha256(convert_to(lower(trim(p_email)),'UTF8')),'hex')] loop
  insert into private.recovery_limits(bucket,started_at,attempts) values(bucket_key,now(),1)
  on conflict(bucket) do update set attempts=case when private.recovery_limits.started_at<now()-interval '15 minutes' then 1 else private.recovery_limits.attempts+1 end,started_at=case when private.recovery_limits.started_at<now()-interval '15 minutes' then now() else private.recovery_limits.started_at end returning attempts into count_attempts;
  if count_attempts>(case when bucket_key like 'email:%' then 5 else 20 end) then return null;end if;
 end loop;
 delete from private.recovery_codes c using auth.users u where c.user_id=u.id and lower(u.email)=lower(trim(p_email)) and c.code_hash=encode(sha256(convert_to(p_code,'UTF8')),'hex') returning c.user_id into target;
 return target;
end; $$;
revoke all on function public.generate_recovery_codes(),public.consume_recovery_code(text,text,text) from public,anon,authenticated;
grant execute on function public.generate_recovery_codes() to authenticated;
grant execute on function public.consume_recovery_code(text,text,text) to service_role;
commit;
