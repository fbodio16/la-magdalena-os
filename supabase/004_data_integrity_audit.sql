-- LA MAGDALENA OS 7.0.0
-- Auditoría y protección básica de datos.
-- Ejecutar una sola vez desde Supabase SQL Editor después de realizar un respaldo.

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  table_name text not null,
  record_id text,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

drop policy if exists "company members read audit logs" on public.audit_logs;
create policy "company members read audit logs" on public.audit_logs
for select using (
  exists (
    select 1 from public.company_members cm
    where cm.company_id = audit_logs.company_id and cm.user_id = auth.uid()
  )
);

create or replace function public.lmos_audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  payload jsonb;
  cid uuid;
begin
  payload := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  cid := nullif(payload->>'company_id','')::uuid;
  insert into public.audit_logs(company_id,table_name,record_id,operation,old_data,new_data,changed_by)
  values(cid,tg_table_name,coalesce(payload->>'id',''),tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
    auth.uid());
  return case when tg_op='DELETE' then old else new end;
end $$;

do $$
declare t text;
begin
  foreach t in array array['lots','lot_geometries','precision_analyses','precision_orders','clients','irrigation_events','alfalfa_cuts','transport_trips','financial_movements'] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop trigger if exists lmos_audit_%I on public.%I',t,t);
      execute format('create trigger lmos_audit_%I after insert or update or delete on public.%I for each row execute function public.lmos_audit_row()',t,t);
    end if;
  end loop;
end $$;

create index if not exists audit_logs_company_changed_idx on public.audit_logs(company_id,changed_at desc);
