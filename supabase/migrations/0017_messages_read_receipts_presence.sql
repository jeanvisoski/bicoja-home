-- Presença simples: a aplicação atualiza este campo enquanto a conta está ativa.
alter table public.profiles add column if not exists last_seen_at timestamptz;

create index if not exists messages_conversation_read_idx
  on public.messages (conversation_id, read_at, sender_id);

-- O destinatário pode registrar que leu uma mensagem da conversa da qual participa.
create policy "participantes marcam mensagens como lidas"
  on public.messages for update
  using (
    exists (
      select 1
      from public.conversations c
      join public.orders o on o.id = c.order_id
      where c.id = conversation_id
        and (o.client_id = auth.uid() or o.provider_id = auth.uid())
    )nas 
  )
  with check (
    exists (
      select 1
      from public.conversations c
      join public.orders o on o.id = c.order_id
      where c.id = conversation_id
        and (o.client_id = auth.uid() or o.provider_id = auth.uid())
    )
  );
