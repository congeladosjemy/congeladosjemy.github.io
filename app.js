// ---------- Estado ----------
let carrito = cargar("carrito", {}); // { idProducto: cantidad }
let categoria = "Todas";
let pedidoActual = null;

function cargar(clave, porDefecto) {
  try { return JSON.parse(localStorage.getItem(clave)) ?? porDefecto; } catch { return porDefecto; }
}
function guardar(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch {}
}

const $ = (s) => document.querySelector(s);
const producto = (id) => PRODUCTOS.find((p) => p.id === id);

document.title = NEGOCIO.nombre + " · Hacé tu pedido";
$("#titulo").textContent = NEGOCIO.nombre;

// ---------- Catálogo ----------
function pintarCategorias() {
  const cats = ["Todas", ...new Set(PRODUCTOS.map((p) => p.categoria))];
  $("#categorias").innerHTML = cats
    .map((c) => `<button class="chip ${c === categoria ? "activa" : ""}" data-cat="${escapar(c)}">${escapar(c)}</button>`)
    .join("");
}

function pintarCatalogo() {
  const q = $("#buscar").value.trim().toLowerCase();
  const lista = PRODUCTOS.filter(
    (p) => (categoria === "Todas" || p.categoria === categoria) && p.nombre.toLowerCase().includes(q)
  );
  $("#catalogo").innerHTML = lista.length
    ? lista.map((p) => {
        const cant = carrito[p.id] || 0;
        return `<article class="tarjeta">
          <div class="foto">${p.imagen ? `<img src="${escapar(p.imagen)}" alt="">` : escapar(p.emoji || "❄️")}</div>
          <h3>${escapar(p.nombre)}</h3>
          <p class="precio">${pesos(p.precio)}</p>
          ${cant
            ? `<div class="cantidad"><button data-menos="${p.id}">−</button><span>${cant}</span><button data-mas="${p.id}">+</button></div>`
            : `<button class="btn primario" data-mas="${p.id}">Agregar</button>`}
        </article>`;
      }).join("")
    : `<p class="vacio">No encontramos productos.</p>`;
}

// ---------- Carrito ----------
function itemsCarrito() {
  return Object.entries(carrito)
    .filter(([id, c]) => c > 0 && producto(id))
    .map(([id, cantidad]) => ({ ...producto(id), cantidad }));
}

function pintarCarrito() {
  const items = itemsCarrito();
  const total = items.reduce((s, it) => s + it.precio * it.cantidad, 0);
  $("#contador").textContent = items.reduce((s, it) => s + it.cantidad, 0);
  $("#total-carrito").textContent = pesos(total);
  $("#btn-continuar").disabled = !items.length;
  $("#lista-carrito").innerHTML = items.length
    ? items.map((it) => `<div class="linea">
        <div><strong>${escapar(it.nombre)}</strong><br><small>${pesos(it.precio)} c/u</small></div>
        <div class="cantidad"><button data-menos="${it.id}">−</button><span>${it.cantidad}</span><button data-mas="${it.id}">+</button></div>
        <div class="subtotal">${pesos(it.precio * it.cantidad)}</div>
      </div>`).join("")
    : `<p class="vacio">Tu carrito está vacío.</p>`;
}

function cambiar(id, delta) {
  carrito[id] = Math.max(0, (carrito[id] || 0) + delta);
  if (!carrito[id]) delete carrito[id];
  guardar("carrito", carrito);
  pintarCatalogo();
  pintarCarrito();
}

function abrirCarrito(abrir) {
  $("#carrito").classList.toggle("abierto", abrir);
  $("#fondo").classList.toggle("visible", abrir);
  $("#carrito").setAttribute("aria-hidden", String(!abrir));
}

// ---------- Navegación ----------
function ir(vista) {
  ["catalogo", "datos", "remito"].forEach((v) => ($("#vista-" + v).hidden = v !== vista));
  $("#gracias").hidden = true;
  abrirCarrito(false);
  window.scrollTo(0, 0);
}

// ---------- Formulario ----------
const form = $("#form-datos");

function ajustarEntrega() {
  const retiro = form.entrega.value === "retiro";
  document.querySelectorAll(".dir").forEach((el) => (el.hidden = retiro));
  form.direccion.required = !retiro;
}

function precargarDatos() {
  const d = cargar("cliente", {});
  for (const [k, v] of Object.entries(d)) if (form[k] && k !== "fechaEntrega") form[k].value = v;
  const hoy = new Date();
  hoy.setMinutes(hoy.getMinutes() - hoy.getTimezoneOffset());
  form.fechaEntrega.min = hoy.toISOString().slice(0, 10);
  ajustarEntrega();
}

function generarNumero() {
  const d = new Date();
  const p2 = (n) => String(n).padStart(2, "0");
  return `${String(d.getFullYear()).slice(2)}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${Math.floor(Math.random() * 90 + 10)}`;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const cliente = Object.fromEntries(new FormData(form));
  if (cliente.entrega === "retiro") { cliente.direccion = "Retira en local"; cliente.localidad = ""; }
  guardar("cliente", cliente);
  pedidoActual = {
    numero: generarNumero(),
    fechaPedido: new Date().toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }),
    cliente,
    items: itemsCarrito().map(({ nombre, precio, cantidad }) => ({ nombre, precio, cantidad })),
  };
  $("#remito").innerHTML = htmlRemito(pedidoActual);
  ir("remito");
});

// ---------- Envío por WhatsApp ----------
function mensajeWhatsApp(p) {
  const total = p.items.reduce((s, it) => s + it.precio * it.cantidad, 0);
  const link = new URL("remito.html", location.href).href + "#" + codificarPedido(p);
  const c = p.cliente;
  return [
    `*NUEVO PEDIDO N° ${p.numero}*`,
    `Fecha: ${p.fechaPedido}`,
    ``,
    `*Cliente:* ${c.nombre}`,
    `*Teléfono:* ${c.telefono}`,
    `*Entrega:* ${c.entrega === "retiro" ? "Retira en local" : "Envío a " + c.direccion + (c.localidad ? ", " + c.localidad : "")}`,
    `*Fecha de entrega:* ${fechaLegible(c.fechaEntrega)} ${c.horario || ""}`.trim(),
    `*Pago:* ${c.pago}`,
    c.observaciones ? `*Obs.:* ${c.observaciones}` : null,
    ``,
    ...p.items.map((it) => `• ${it.cantidad} x ${it.nombre} — ${pesos(it.precio * it.cantidad)}`),
    ``,
    `*TOTAL: ${pesos(total)}*`,
    ``,
    `Remito para imprimir: ${link}`,
  ].filter((l) => l !== null).join("\n");
}

$("#btn-enviar").addEventListener("click", () => {
  if (!pedidoActual) return;
  window.open(`https://wa.me/${NEGOCIO.whatsapp}?text=${encodeURIComponent(mensajeWhatsApp(pedidoActual))}`, "_blank");
  carrito = {};
  guardar("carrito", carrito);
  pintarCatalogo();
  pintarCarrito();
  $("#gracias").hidden = false;
});

$("#btn-imprimir").addEventListener("click", () => window.print());

// ---------- Eventos generales ----------
document.addEventListener("click", (e) => {
  const t = e.target.closest("button");
  if (!t) return;
  if (t.dataset.mas) cambiar(t.dataset.mas, +1);
  if (t.dataset.menos) cambiar(t.dataset.menos, -1);
  if (t.dataset.cat) { categoria = t.dataset.cat; pintarCategorias(); pintarCatalogo(); }
  if (t.dataset.ir) ir(t.dataset.ir);
});
$("#btn-carrito").addEventListener("click", () => abrirCarrito(true));
$("#cerrar-carrito").addEventListener("click", () => abrirCarrito(false));
$("#fondo").addEventListener("click", () => abrirCarrito(false));
$("#btn-continuar").addEventListener("click", () => { precargarDatos(); ir("datos"); });
$("#buscar").addEventListener("input", pintarCatalogo);
form.entrega.addEventListener("change", ajustarEntrega);
$("#nuevo-pedido").addEventListener("click", () => { pedidoActual = null; ir("catalogo"); });

pintarCategorias();
pintarCatalogo();
pintarCarrito();
