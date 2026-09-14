-- plataforma-core/supabase-setup.sql — v0.1
-- Executar no SQL Editor do Supabase (projeto único, partilhado por todos os sites)

-- ============================================================
-- 1. DADOS GLOBAIS DA CONTA
-- ============================================================
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  nome text,
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "utilizador vê o próprio perfil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "utilizador atualiza o próprio perfil"
  on public.profiles for update
  using (auth.uid() = id);

-- Cria automaticamente uma linha em profiles quando um utilizador se regista
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, new.raw_user_meta_data->>'nome');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 2. CATÁLOGO DE SITES DA PLATAFORMA
-- ============================================================
create table if not exists public.sites (
  id text primary key,           -- ex: 'gestor3d', 'marketplace'
  nome text not null,
  dominio text,
  ativo boolean default true
);

alter table public.sites enable row level security;

create policy "catálogo de sites é público para leitura"
  on public.sites for select
  using (true);

insert into public.sites (id, nome, dominio) values
  ('gestor3d', 'Gestor de Impressão 3D', 'gestor3d.teudominio.pt')
on conflict (id) do nothing;

-- ============================================================
-- 3. DADOS ESPECÍFICOS DE SITE — tabela genérica chave/valor
-- Usar para configurações e progresso simples. Para dados com
-- estrutura própria (ex: trabalhos, encomendas), criar tabelas
-- dedicadas seguindo o mesmo padrão de RLS abaixo.
-- ============================================================
create table if not exists public.user_site_data (
  user_id uuid references auth.users(id) on delete cascade,
  site_id text references public.sites(id),
  chave text,
  valor jsonb,
  updated_at timestamptz default now(),
  primary key (user_id, site_id, chave)
);

alter table public.user_site_data enable row level security;

create policy "utilizador só acede aos seus dados por site"
  on public.user_site_data for all
  using (auth.uid() = user_id);
