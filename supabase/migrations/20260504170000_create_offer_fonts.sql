create table if not exists public.offer_fonts (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    url text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS
alter table public.offer_fonts enable row level security;

-- Políticas
create policy "Qualquer um pode ler fontes" on public.offer_fonts
    for select using (true);

create policy "Usuários autenticados podem inserir fontes" on public.offer_fonts
    for insert with check (auth.role() = 'authenticated');

create policy "Usuários autenticados podem deletar fontes" on public.offer_fonts
    for delete using (auth.role() = 'authenticated');
