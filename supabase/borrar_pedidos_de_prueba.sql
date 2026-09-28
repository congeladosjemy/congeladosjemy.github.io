-- Congelados JEMY: BORRA TODOS LOS PEDIDOS (usar sólo para limpiar pedidos de prueba).
-- Devuelve al stock lo que esos pedidos habían descontado y reinicia la numeración en 000001.
-- Los productos, precios y fotos no se tocan.
begin;

-- 1) Devolver el stock de los pedidos que no estaban cancelados
update productos p set stock = p.stock + v.cantidad
from (
  select i.producto_id, sum(i.cantidad) as cantidad
  from pedido_items i join pedidos pe on pe.id = i.pedido_id
  where pe.estado <> 'cancelado' and i.producto_id is not null
  group by i.producto_id
) v
where p.id = v.producto_id;

-- 2) Borrar los movimientos de stock de esos pedidos, y los pedidos
delete from movimientos_stock where pedido_id is not null;
delete from pedidos;

-- 3) Que el próximo pedido sea el N° 000001
alter table pedidos alter column id restart with 1;

commit;

select count(*) as pedidos_que_quedan from pedidos;
