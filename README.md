# Congelados JEMY — Tienda online + sistema de pedidos y stock

## Qué incluye

**Tienda para clientes** (`index.html`, el link que se comparte)
- Catálogo con búsqueda y categorías. Muestra "Sin stock" y "¡Quedan X!".
- Carrito, formulario de datos (nombre, teléfono, dirección, fecha y horario de entrega, pago, observaciones).
- Al confirmar, el pedido **queda guardado en el sistema**, se **descuenta el stock** y el cliente ve su remito con número de pedido (puede imprimirlo o avisar por WhatsApp).

**Panel de administración** (`admin.html`, con usuario y contraseña)
- **Resumen:** pedidos y ventas de hoy, ventas del mes, pendientes, productos con stock bajo, más vendidos.
- **Pedidos:** lista con filtros (estado, fechas, búsqueda). Cada pedido se abre, se le cambia el estado
  (Nuevo → Preparando → En camino → Entregado, o Cancelado), se le agrega una nota interna,
  se **imprime el remito** (con duplicado opcional) o se escribe al cliente por WhatsApp.
  Botón **"Imprimir todos"** para imprimir todos los remitos del filtro (uno por hoja).
  Avisa con un sonido cuando entra un pedido nuevo (revisa cada 30 segundos).
- **Stock:** productos, precios y stock. Ingreso de mercadería, mermas y ajustes por conteo.
  Alta y edición de productos, ocultarlos de la tienda. **Historial de cada movimiento** (quién, cuándo y por qué).
- **Clientes:** todos los clientes (agrupados por teléfono), cantidad de pedidos, total comprado
  y **todos los pedidos de cada uno**.

Reglas automáticas:
- Si un cliente pide más de lo que hay, el pedido no se acepta y se le avisa cuánto queda.
- Si se **cancela** un pedido, la mercadería **vuelve al stock**.
- Los precios se toman siempre del sistema (un cliente no puede cambiarlos).

---

## Puesta en marcha (una sola vez, ~15 minutos)

El sistema guarda los datos en **Supabase** (gratis para este uso).

### 1. Crear la base de datos
1. Entrá a <https://supabase.com>, creá una cuenta y tocá **New project**.
   Elegí un nombre, una contraseña de base de datos (guardala) y la región **São Paulo**.
2. Cuando termine de crearse, andá a **SQL Editor → New query**, pegá **todo** el contenido
   de [`supabase/schema.sql`](supabase/schema.sql) y tocá **Run**.
   Esto crea las tablas y carga los productos de ejemplo.

### 2. Crear tu usuario de administrador
1. Andá a **Authentication → Users → Add user → Create new user**.
   Poné tu email y una contraseña, y marcá **Auto Confirm User**.
2. Volvé a **SQL Editor** y ejecutá (con tu email):
   ```sql
   insert into admins (email) values ('tu-email@ejemplo.com');
   ```
   Podés repetirlo para darle acceso a otra persona (primero creale el usuario).
3. Recomendado: en **Authentication → Sign In / Providers**, desactivá **Allow new users to sign up**.

### 3. Conectar el sitio
En Supabase andá a **Project Settings → API** (o **Connect**) y copiá:
- **Project URL**
- **anon public key** (o *publishable key*)

Pegalos en [`config.js`](config.js), junto con los datos del negocio (nombre, dirección, teléfono, WhatsApp).

### 4. Publicarlo con GitHub Pages
1. En GitHub: **Settings → Pages → Deploy from a branch**, elegí la rama y la carpeta `/ (root)`.
2. En un minuto queda publicado:
   - Tienda para clientes: `https://<usuario>.github.io/<repositorio>/`
   - Panel: `https://<usuario>.github.io/<repositorio>/admin.html`

### 5. Cargar tus productos
Entrá al panel → **Stock**. Editá o borrá (ocultá) los productos de ejemplo y cargá los tuyos
con su precio y stock inicial.

---

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html`, `app.js` | Tienda para clientes |
| `admin.html`, `admin.js` | Panel de administración |
| `config.js` | **Configuración (Supabase y datos del negocio)** |
| `comun.js` | Funciones compartidas (remito, formatos) |
| `estilos.css` | Diseño y formato de impresión |
| `supabase/schema.sql` | Base de datos: tablas, reglas de stock y permisos |

## Notas
- El remito es un comprobante interno ("Documento no válido como factura").
- En el plan gratis, Supabase pausa el proyecto si pasa **una semana sin uso**; se reactiva desde su página.
- La *anon key* es pública a propósito: la base sólo permite ver el catálogo y crear pedidos.
  Pedidos, clientes y stock sólo se ven con un usuario de la tabla `admins`.
