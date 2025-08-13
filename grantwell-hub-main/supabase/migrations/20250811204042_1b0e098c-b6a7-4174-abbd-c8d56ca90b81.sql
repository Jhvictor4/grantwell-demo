-- Create file_mappings table for Bulk Upload Mapping
create table if not exists public.file_mappings (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references public.grants(id) on delete cascade,
  storage_path text not null,
  template_type text check (template_type in ('SF-425','Drawdown Log','Match Certification','Monitoring Checklist','Narrative Report','Other')) not null,
  period_start date,
  period_end date,
  created_at timestamptz default now()
);

alter table public.file_mappings enable row level security;

-- RLS: organization-based access aligned with existing patterns
create policy if not exists "org_crud_file_mappings"
on public.file_mappings for all
using (
  exists (
    select 1 from public.grants g
    where g.id = file_mappings.grant_id
      and (
        g.owner_id = auth.uid()
        or get_user_role(auth.uid()) in ('admin','manager')
        or g.organization_id in (
          select organization_members.organization_id
          from organization_members
          where organization_members.user_id = auth.uid()
        )
      )
  )
)
with check (
  exists (
    select 1 from public.grants g
    where g.id = file_mappings.grant_id
      and (
        g.owner_id = auth.uid()
        or get_user_role(auth.uid()) in ('admin','manager')
        or g.organization_id in (
          select organization_members.organization_id
          from organization_members
          where organization_members.user_id = auth.uid()
        )
      )
  )
);