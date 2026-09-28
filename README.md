# Congelados JEMY — Tienda de pedidos online

Sitio web simple (sin servidor ni base de datos) donde los clientes:

1. **Eligen productos** y los suman al carrito.
2. **Completan sus datos**: nombre, teléfono, dirección, fecha de entrega, horario, forma de pago y observaciones.
3. **Ven el remito** con número de pedido, fecha, detalle y total.
4. **Envían el pedido por WhatsApp** al negocio (o lo imprimen / guardan en PDF).

El mensaje de WhatsApp que llega al negocio incluye todo el pedido **y un link al remito**.
Al abrir ese link se ve el remito listo para **imprimir** (botón 🖨️), con opción de
imprimir original y duplicado en la misma hoja.

## Cómo configurarlo

Todo se edita en **`productos.js`**:

- `NEGOCIO.whatsapp`: número donde llegan los pedidos, formato internacional sin `+`
  (ej.: `5491123456789` para 11 2345-6789).
- `NEGOCIO.direccion`, `telefono`, `cuit`: aparecen en el encabezado del remito.
- `PRODUCTOS`: lista de productos y precios. Para usar fotos, subí la imagen a una
  carpeta `img/` y agregá `imagen: "img/empanadas.jpg"` al producto.

> ⚠️ Los productos y precios cargados son **de ejemplo**: reemplazalos por los reales.

## Cómo publicarlo (gratis) con GitHub Pages

1. En GitHub: **Settings → Pages**.
2. En *Source* elegí **Deploy from a branch**, rama `main` y carpeta `/ (root)`.
3. En un minuto queda publicado en `https://<usuario>.github.io/<repositorio>/`.
   Ese es el link para compartir con los clientes.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Tienda: catálogo, carrito, datos del cliente y remito |
| `remito.html` | Remito imprimible que abre el negocio desde el link de WhatsApp |
| `productos.js` | **Datos del negocio y catálogo (lo que hay que editar)** |
| `comun.js` | Funciones compartidas (formato de precios, armado del remito) |
| `app.js` | Lógica de la tienda |
| `estilos.css` | Diseño y formato de impresión |

## Nota

El remito es un comprobante interno ("Documento no válido como factura").
