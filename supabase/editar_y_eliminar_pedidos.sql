-- Congelados JEMY: agrega los botones "Editar pedido" y "Eliminar pedido" del panel.
-- Pegá TODO este texto en Supabase → SQL Editor y apretá Run (una sola vez).
-- Se puede ejecutar más de una vez sin problema.

create or replace function pedido_json(p_id bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(p) || jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id, 'producto_id', i.producto_id, 'nombre', i.nombre,
               'precio', i.precio, 'cantidad', i.cantidad) order by i.id)
      from pedido_items i where i.pedido_id = p.id), '[]'::jsonb))
  from pedidos p where p.id = p_id;
$$;

-- Edita un pedido desde el panel: datos del cliente y productos.
-- p_cliente: {nombre, entrega, direccion, observaciones}
-- p_items:   [{producto_id, cantidad, precio}, ...]  (o {item_id, cantidad, precio} para renglones de productos ya borrados)
-- "precio" es opcional: sirve para hacerle un precio especial a un cliente. Si no viene, los productos
-- que ya estaban conservan el precio del pedido y los nuevos toman el precio actual.
-- Si el pedido no está cancelado, el stock se ajusta por la diferencia.
create or replace function admin_editar_pedido(p_id bigint, p_cliente jsonb, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_estado text;
  v_item   record;
  v_prod   productos%rowtype;
  v_viejo  pedido_items%rowtype;
  v_filas  jsonb := '[]';
  v_faltan text[] := '{}';
begin
  perform exigir_admin();
  select estado into v_estado from pedidos where id = p_id for update;
  if v_estado is null then raise exception 'Pedido inexistente'; end if;

  if coalesce(trim(p_cliente ->> 'nombre'), '') = '' then
    raise exception 'Falta el nombre';
  end if;
  if coalesce(p_cliente ->> 'entrega', '') <> 'retiro' and coalesce(trim(p_cliente ->> 'direccion'), '') = '' then
    raise exception 'Falta la dirección de entrega';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido tiene que tener al menos un producto. Si ya no va, cancelalo o eliminalo.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) e
             where coalesce((e ->> 'cantidad')::int, 0) not between 1 and 1000) then
    raise exception 'Cantidad inválida';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) e
             where e ->> 'precio' is not null and (e ->> 'precio')::numeric not between 0 and 100000000) then
    raise exception 'Precio inválido';
  end if;

  -- 1) Ajustar el stock por la diferencia (sólo si el pedido no está cancelado)
  if v_estado <> 'cancelado' then
    for v_item in
      with nuevo as (
        select (e ->> 'producto_id')::bigint as pid, sum((e ->> 'cantidad')::int) as c
        from jsonb_array_elements(p_items) e where e ->> 'producto_id' is not null group by 1),
      viejo as (
        select producto_id as pid, sum(cantidad) as c
        from pedido_items where pedido_id = p_id and producto_id is not null group by 1)
      select coalesce(n.pid, v.pid) as pid, (coalesce(n.c, 0) - coalesce(v.c, 0))::int as diff
      from nuevo n full join viejo v on n.pid = v.pid
      order by 1
    loop
      continue when v_item.diff = 0;
      select * into v_prod from productos where id = v_item.pid for update;
      if not found then raise exception 'Hay un producto que ya no existe. Actualizá la página.'; end if;
      if v_item.diff > 0 and v_prod.stock < v_item.diff then
        v_faltan := v_faltan || format('%s (quedan %s)', v_prod.nombre, greatest(v_prod.stock, 0));
      end if;
      perform mover_stock(v_item.pid, -v_item.diff, 'edición de pedido', p_id);
    end loop;
    if array_length(v_faltan, 1) > 0 then
      raise exception 'Sin stock suficiente: %', array_to_string(v_faltan, ', ');
    end if;
  end if;

  -- 2) Armar los renglones nuevos
  for v_item in
    select (e ->> 'producto_id')::bigint as pid, sum((e ->> 'cantidad')::int)::int as c,
           max((e ->> 'precio')::numeric) as precio
    from jsonb_array_elements(p_items) e where e ->> 'producto_id' is not null group by 1 order by 1
  loop
    select * into v_viejo from pedido_items where pedido_id = p_id and producto_id = v_item.pid order by id limit 1;
    if found then
      v_filas := v_filas || jsonb_build_object('pid', v_item.pid, 'nombre', v_viejo.nombre,
                                               'precio', coalesce(v_item.precio, v_viejo.precio), 'c', v_item.c);
    else
      select * into v_prod from productos where id = v_item.pid;
      if not found then raise exception 'Hay un producto que ya no existe. Actualizá la página.'; end if;
      v_filas := v_filas || jsonb_build_object('pid', v_item.pid, 'nombre', v_prod.nombre,
                                               'precio', coalesce(v_item.precio, v_prod.precio), 'c', v_item.c);
    end if;
  end loop;
  for v_item in
    select (e ->> 'item_id')::bigint as iid, (e ->> 'cantidad')::int as c, (e ->> 'precio')::numeric as precio
    from jsonb_array_elements(p_items) e where e ->> 'producto_id' is null and e ->> 'item_id' is not null
  loop
    select * into v_viejo from pedido_items where pedido_id = p_id and id = v_item.iid;
    if found then
      v_filas := v_filas || jsonb_build_object('pid', null, 'nombre', v_viejo.nombre,
                                               'precio', coalesce(v_item.precio, v_viejo.precio), 'c', v_item.c);
    end if;
  end loop;

  delete from pedido_items where pedido_id = p_id;
  insert into pedido_items (pedido_id, producto_id, nombre, precio, cantidad)
  select p_id, (f ->> 'pid')::bigint, f ->> 'nombre', (f ->> 'precio')::numeric, (f ->> 'c')::int
  from jsonb_array_elements(v_filas) f;

  -- 3) Datos del cliente y total
  update pedidos set
    nombre        = left(trim(p_cliente ->> 'nombre'), 120),
    entrega       = case when p_cliente ->> 'entrega' = 'retiro' then 'retiro' else 'envio' end,
    direccion     = case when p_cliente ->> 'entrega' = 'retiro' then null else left(trim(p_cliente ->> 'direccion'), 200) end,
    observaciones = nullif(left(trim(coalesce(p_cliente ->> 'observaciones', '')), 500), ''),
    total         = (select coalesce(sum(precio * cantidad), 0) from pedido_items where pedido_id = p_id)
  where id = p_id;

  return pedido_json(p_id);
end $$;

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
