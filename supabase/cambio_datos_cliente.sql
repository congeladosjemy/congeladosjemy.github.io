-- Congelados JEMY: la tienda ya no pide teléfono, fecha de entrega ni forma de pago.
-- Pegá TODO este texto en Supabase → SQL Editor y apretá Run. Se puede ejecutar más de una vez sin problema.

alter table pedidos alter column telefono set default '';

-- Identifica a un cliente: por teléfono si lo tiene, si no por nombre
create or replace function clave_cliente(p_telefono text, p_nombre text) returns text
language sql immutable set search_path = public as $$
  select coalesce(nullif(trim(p_telefono), ''), 'nombre:' || lower(trim(p_nombre)));
$$;

-- p_cliente: {nombre, telefono, entrega, direccion, localidad, fecha_entrega, horario, pago, observaciones}
-- p_items:   [{producto_id, cantidad}, ...]
create or replace function crear_pedido(p_cliente jsonb, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id    bigint;
  v_total numeric(12,2) := 0;
  v_item  record;
  v_prod  productos%rowtype;
  v_faltan text[] := '{}';
begin
  if coalesce(trim(p_cliente ->> 'nombre'), '') = '' or coalesce(trim(p_cliente ->> 'direccion'), '') = '' then
    raise exception 'Faltan nombre o dirección';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido está vacío';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'Demasiados productos en un pedido';
  end if;

  -- 1) Se verifica el stock antes de crear el pedido (así no se "gastan" números de pedido).
  --    Los productos se bloquean en orden para que dos clientes no compren el mismo stock a la vez.
  for v_item in
    select (e ->> 'producto_id')::bigint as producto_id, sum((e ->> 'cantidad')::int)::int as cantidad
    from jsonb_array_elements(p_items) e
    group by 1 order by 1
  loop
    if v_item.cantidad is null or v_item.cantidad <= 0 or v_item.cantidad > 1000 then
      raise exception 'Cantidad inválida';
    end if;
    select * into v_prod from productos where id = v_item.producto_id and activo for update;
    if not found then
      raise exception 'Hay un producto que ya no está disponible. Actualizá la página.';
    end if;
    if v_prod.stock < v_item.cantidad then
      v_faltan := v_faltan || format('%s (quedan %s)', v_prod.nombre, greatest(v_prod.stock, 0));
    end if;
  end loop;

  if array_length(v_faltan, 1) > 0 then
    raise exception 'Sin stock suficiente: %', array_to_string(v_faltan, ', ');
  end if;

  -- 2) Se crea el pedido y se descuenta el stock (con los precios de la base, no los del navegador)
  insert into pedidos (nombre, telefono, entrega, direccion, localidad, fecha_entrega, horario, pago, observaciones)
  values (
    left(trim(p_cliente ->> 'nombre'), 120),
    coalesce(left(trim(p_cliente ->> 'telefono'), 40), ''),
    case when p_cliente ->> 'entrega' = 'retiro' then 'retiro' else 'envio' end,
    left(p_cliente ->> 'direccion', 200),
    left(p_cliente ->> 'localidad', 100),
    nullif(p_cliente ->> 'fecha_entrega', '')::date,
    left(p_cliente ->> 'horario', 60),
    left(p_cliente ->> 'pago', 60),
    left(p_cliente ->> 'observaciones', 500)
  ) returning id into v_id;

  for v_item in
    select (e ->> 'producto_id')::bigint as producto_id, sum((e ->> 'cantidad')::int)::int as cantidad
    from jsonb_array_elements(p_items) e
    group by 1 order by 1
  loop
    select * into v_prod from productos where id = v_item.producto_id;
    insert into pedido_items (pedido_id, producto_id, nombre, precio, cantidad)
    values (v_id, v_prod.id, v_prod.nombre, v_prod.precio, v_item.cantidad);
    perform mover_stock(v_prod.id, -v_item.cantidad, 'venta', v_id);
    v_total := v_total + v_prod.precio * v_item.cantidad;
  end loop;

  update pedidos set total = v_total where id = v_id;
  return pedido_json(v_id);
end $$;

create or replace function admin_pedidos(
  p_desde date default null, p_hasta date default null,
  p_estado text default null, p_buscar text default null, p_telefono text default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform exigir_admin();
  return coalesce((
    select jsonb_agg(pedido_json(p.id) order by p.creado desc)
    from pedidos p
    where (p_desde is null or (p.creado at time zone 'America/Argentina/Buenos_Aires')::date >= p_desde)
      and (p_hasta is null or (p.creado at time zone 'America/Argentina/Buenos_Aires')::date <= p_hasta)
      and (coalesce(p_estado, '') = '' or p.estado = p_estado
           or (p_estado = 'pendientes' and p.estado in ('nuevo','preparando','enviado')))
      and (coalesce(p_telefono, '') = '' or clave_cliente(p.telefono, p.nombre) = p_telefono)
      and (coalesce(p_buscar, '') = ''
           or p.nombre ilike '%' || p_buscar || '%'
           or p.telefono ilike '%' || p_buscar || '%'
           or p.direccion ilike '%' || p_buscar || '%'
           or p.id::text = ltrim(p_buscar, '#0'))
    limit 500), '[]'::jsonb);
end $$;

-- Clientes: se agrupan por teléfono (o por nombre, si el pedido no tiene teléfono)
create or replace function admin_clientes(p_buscar text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform exigir_admin();
  return coalesce((
    select jsonb_agg(c order by c.ultimo desc) from (
      select clave_cliente(telefono, nombre) as clave,
             max(telefono) as telefono,
             (array_agg(nombre order by creado desc))[1]    as nombre,
             (array_agg(direccion order by creado desc) filter (where entrega = 'envio'))[1] as direccion,
             (array_agg(localidad order by creado desc) filter (where entrega = 'envio'))[1] as localidad,
             count(*) filter (where estado <> 'cancelado') as pedidos,
             coalesce(sum(total) filter (where estado <> 'cancelado'), 0) as gastado,
             max(creado) as ultimo
      from pedidos
      group by 1
      having coalesce(p_buscar, '') = ''
          or bool_or(nombre ilike '%' || p_buscar || '%')
          or bool_or(telefono ilike '%' || p_buscar || '%')
    ) c), '[]'::jsonb);
end $$;
