begin;
-- Grant only the display column: never allow changes to identity, email or role.
grant update(display_name) on public.trip_members to authenticated;
create policy members_update_name on public.trip_members for update to authenticated
 using(private.is_member(trip_id) and (user_id=auth.uid() or private.is_owner(trip_id)))
 with check(private.is_member(trip_id) and (user_id=auth.uid() or private.is_owner(trip_id)));
commit;
