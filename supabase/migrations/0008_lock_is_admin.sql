-- A policy de UPDATE em profiles ("usuário edita o próprio profile") é por
-- linha, não por coluna — sem isso, qualquer usuário logado poderia se
-- auto-promover rodando supabase.from('profiles').update({ is_admin: true })
-- pelo próprio client. Trigger trava a coluna: só quem já é admin pode mudar
-- is_admin de alguém (inclusive de si mesmo).

create or replace function public.protect_is_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin and not public.is_admin(auth.uid()) then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

create trigger protect_is_admin_column
  before update on public.profiles
  for each row execute function public.protect_is_admin();
