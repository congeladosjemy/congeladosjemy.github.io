-- Congelados JEMY: agrega el botón "Eliminar pedido" del panel.
-- Pegá TODO este texto en Supabase → SQL Editor y apretá Run (una sola vez).

-- Elimina un pedido para siempre (por ej. uno de prueba). Si no estaba cancelado,
-- devuelve los productos al stock. Si no queda ningún pedido, la numeración vuelve a 000001.
create or replace function admin_eliminar_pedido(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_estado text;
  v_item   record;
begin
  perform exigir_admin();
  select estado into v_estado from pedidos where id = p_id for update;
  if v_estado is null then raise exception 'Pedido inexistente'; end if;

  if v_estado <> 'cancelado' then
    for v_item in select producto_id, sum(cantidad)::int as cantidad from pedido_items
                  where pedido_id = p_id and producto_id is not null group by 1 order by 1 loop
      update productos set stock = stock + v_item.cantidad where id = v_item.producto_id;
    end loop;
  end if;

  delete from movimientos_stock where pedido_id = p_id;
  delete from pedidos where id = p_id;

  if not exists (select 1 from pedidos) then
    perform setval(pg_get_serial_sequence('pedidos', 'id'), 1, false);
  end if;
end $$;
