begin;
alter table public.expenses drop constraint expenses_currency_check,add constraint expenses_currency_check check(currency in ('EUR','USD','GBP','CZK','ARS'));
alter table public.settlements drop constraint settlements_currency_check,add constraint settlements_currency_check check(currency in ('EUR','USD','GBP','CZK','ARS'));
alter table public.scenario_items drop constraint scenario_items_currency_check,add constraint scenario_items_currency_check check(currency in ('EUR','USD','GBP','CZK','ARS'));
alter table public.personal_expenses drop constraint personal_expenses_currency_check,add constraint personal_expenses_currency_check check(currency in ('EUR','USD','GBP','CZK','ARS'));
commit;
