begin;
alter table public.itinerary_events add column location text not null default '' check(length(location)<=300);
alter table public.itinerary_events add column start_time time;
alter table public.itinerary_events add column end_time time;
alter table public.itinerary_events add column time_zone text not null default 'Europe/Madrid' check(time_zone in ('Europe/Madrid','Europe/Lisbon','Europe/London','Europe/Amsterdam','Europe/Brussels','Europe/Paris'));
alter table public.itinerary_events add constraint event_time_pair check ((start_time is null)=(end_time is null));
alter table public.itinerary_events add constraint event_time_order check(start_time is null or (starts_on+start_time)<(ends_on+end_time));
commit;
