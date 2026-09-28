// ---------- Estado ----------
let productos = [];
let carrito = cargar("carrito", {}); // { idProducto: cantidad }
let categoria = "Todas";
let pedidoConfirmado = null;

function cargar(clave, porDefecto) {
  try { return JSON.parse(localStorage.getItem(clave)) ?? porDefecto; } catch { return porDefecto; }
}
function guardar(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch {}
}

const producto = (id) => productos.find((p) => String(p.id) === String(id));

document.title = NEGOCIO.nombre + " · Hacé tu pedido";
$("#titulo").textContent = NEGOCIO.nombre;

// Alias para transferencias, abajo a la izquierda. Al tocarlo se copia.
const alias = $("#alias");
if (NEGOCIO.alias) {
  const mostrarAlias = () => (alias.innerHTML = `Alias: <strong>${escapar(NEGOCIO.alias)}</strong>`);
  mostrarAlias();
  alias.hidden = false;
  alias.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(NEGOCIO.alias); } catch { return; }
    alias.textContent = "¡Alias copiado!";
    setTimeout(mostrarAlias, 1500);
  });
}

// ---------- Catálogo ----------
async function cargarCatalogo() {
  try {
    productos = await api("catalogo");
  } catch (e) {
    $("#catalogo").innerHTML = `<p class="vacio">No se pudieron cargar los productos. Probá de nuevo en un rato.</p>`;
    return;
  }
  // Se ajusta el carrito guardado a lo que hay disponible hoy
  for (const id of Object.keys(carrito)) {
    const p = producto(id);
    if (!p) delete carrito[id];
    else carrito[id] = Math.min(carrito[id], p.stock);
    if (!carrito[id]) delete carrito[id];
  }
  guardar("carrito", carrito);
  pintarCategorias();
  pintarCatalogo();
  pintarCarrito();
}

function pintarCategorias() {
  const cats = ["Todas", ...new Set(productos.map((p) => p.categoria))];
  $("#categorias").innerHTML = cats
    .map((c) => `<button class="chip ${c === categoria ? "activa" : ""}" data-cat="${escapar(c)}">${escapar(c)}</button>`)
    .join("");
}

function controlCantidad(p) {
  const cant = carrito[p.id] || 0;
  if (p.stock <= 0) return `<button class="btn" disabled>Sin stock</button>`;
  if (!cant) return `<button class="btn primario" data-mas="${p.id}">Agregar</button>`;
  return `<div class="cantidad"><button data-menos="${p.id}">−</button><span>${cant}</span>
          <button data-mas="${p.id}" ${cant >= p.stock ? "disabled" : ""}>+</button></div>`;
}

function pintarCatalogo() {
  const q = $("#buscar").value.trim().toLowerCase();
  const lista = productos.filter(
    (p) => (categoria === "Todas" || p.categoria === categoria) && p.nombre.toLowerCase().includes(q)
  );
  $("#catalogo").innerHTML = lista.length
    ? lista.map((p) => `<article class="tarjeta ${p.stock <= 0 ? "agotado" : ""}">
          <div class="foto">${p.imagen ? `<img src="${escapar(p.imagen)}" alt="">` : escapar(p.emoji || "❄️")}</div>
          <h3>${escapar(p.nombre)}</h3>
          <p class="precio">${pesos(p.precio)}</p>
          ${p.stock > 0 && p.stock <= 5 ? `<p class="quedan">¡Quedan ${p.stock}!</p>` : ""}
          ${controlCantidad(p)}
        </article>`).join("")
    : `<p class="vacio">No encontramos productos.</p>`;
}

// ---------- Carrito ----------
function itemsCarrito() {
  return Object.entries(carrito)
    .filter(([id, c]) => c > 0 && producto(id))
    .map(([id, cantidad]) => ({ ...producto(id), cantidad }));
}

const totalCarrito = () => itemsCarrito().reduce((s, it) => s + it.precio * it.cantidad, 0);

function pintarCarrito() {
  const items = itemsCarrito();
  $("#contador").textContent = items.reduce((s, it) => s + it.cantidad, 0);
  $("#total-carrito").textContent = pesos(totalCarrito());
  $("#btn-continuar").disabled = !items.length;
  $("#lista-carrito").innerHTML = items.length
    ? items.map((it) => `<div class="linea">
        <div><strong>${escapar(it.nombre)}</strong><br><small>${pesos(it.precio)} c/u</small></div>
        ${controlCantidad(it)}
        <div class="subtotal">${pesos(it.precio * it.cantidad)}</div>
      </div>`).join("")
    : `<p class="vacio">Tu carrito está vacío.</p>`;
}

function cambiar(id, delta) {
  const p = producto(id);
  if (!p) return;
  carrito[id] = Math.min(p.stock, Math.max(0, (carrito[id] || 0) + delta));
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
  abrirCarrito(false);
  window.scrollTo(0, 0);
}

// ---------- Formulario ----------
const form = $("#form-datos");

function prepararDatos() {
  const d = cargar("cliente", {});
  for (const k of ["nombre", "direccion"]) if (d[k]) form[k].value = d[k];
  $("#resumen-items").innerHTML =
    itemsCarrito().map((it) => `<div class="fila-resumen"><span>${it.cantidad} × ${escapar(it.nombre)}</span><span>${pesos(it.precio * it.cantidad)}</span></div>`).join("") +
    `<div class="fila-resumen total"><span>Total</span><span>${pesos(totalCarrito())}</span></div>`;
  $("#error-pedido").hidden = true;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const cliente = { ...Object.fromEntries(new FormData(form)), entrega: "envio" };
  guardar("cliente", { nombre: cliente.nombre, direccion: cliente.direccion });

  const boton = $("#btn-confirmar");
  boton.disabled = true;
  boton.textContent = "Enviando…";
  $("#error-pedido").hidden = true;
  try {
    pedidoConfirmado = await api("crear_pedido", {
      p_cliente: cliente,
      p_items: itemsCarrito().map((it) => ({ producto_id: it.id, cantidad: it.cantidad })),
    });
    carrito = {};
    guardar("carrito", carrito);
    mostrarConfirmado();
    cargarCatalogo(); // refresca el stock
  } catch (err) {
    $("#error-pedido").textContent = "No se pudo enviar el pedido: " + err.message;
    $("#error-pedido").hidden = false;
    cargarCatalogo();
  } finally {
    boton.disabled = false;
    boton.textContent = "Confirmar pedido";
  }
});

function mostrarConfirmado() {
  const p = pedidoConfirmado;
  $("#num-confirmado").textContent = numeroPedido(p.id);
  $("#remito").innerHTML = htmlRemito(p);
  const wa = $("#btn-whatsapp");
  wa.hidden = !NEGOCIO.whatsapp;
  wa.href = `https://wa.me/${NEGOCIO.whatsapp}?text=` + encodeURIComponent(
    `Hola! Hice el pedido N° ${numeroPedido(p.id)} a nombre de ${p.nombre} por ${pesos(p.total)}.`
  );
  ir("remito");
}

$("#btn-imprimir").addEventListener("click", () => imprimirRemitos([pedidoConfirmado]));

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
$("#btn-continuar").addEventListener("click", () => { prepararDatos(); ir("datos"); });
$("#buscar").addEventListener("input", pintarCatalogo);
$("#nuevo-pedido").addEventListener("click", () => { pedidoConfirmado = null; ir("catalogo"); });

cargarCatalogo();
