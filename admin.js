// ============================================================
//  Panel de administración
// ============================================================
let pedidos = [];        // pedidos listados con el filtro actual
let productosAdmin = [];
let clientes = [];
let pedidoAbierto = null;
let filtroTelefono = ""; // cuando se entra desde "Clientes"
let ultimosNuevos = null;

$("#titulo").textContent = NEGOCIO.nombre + " · Panel";

// ---------- Sesión ----------
async function iniciar() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return mostrarLogin();
  let ok = false;
  try { ok = await api("es_admin"); } catch {}
  if (!ok) {
    await sb.auth.signOut();
    return mostrarLogin("Este usuario no tiene permiso de administrador.");
  }
  $("#vista-login").hidden = true;
  $("#vista-panel").hidden = false;
  $("#f-desde").value = "";
  $("#f-hasta").value = "";
  abrirTab(location.hash.startsWith("#pedido=") ? "pedidos" : "resumen");
  const m = location.hash.match(/^#pedido=(\d+)/);
  if (m) abrirPedido(Number(m[1]));
  setInterval(revisarNuevos, 30000);
}

function mostrarLogin(msg) {
  $("#vista-panel").hidden = true;
  $("#vista-login").hidden = false;
  $("#error-login").hidden = !msg;
  $("#error-login").textContent = msg || "";
}

$("#form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
  if (error) return mostrarLogin("Email o contraseña incorrectos.");
  iniciar();
});

$("#btn-salir").addEventListener("click", async () => {
  await sb.auth.signOut();
  location.reload();
});

// ---------- Pestañas ----------
function abrirTab(tab) {
  $$(".pestanas button").forEach((b) => b.classList.toggle("activa", b.dataset.tab === tab));
  $$(".tab").forEach((t) => (t.hidden = t.id !== "tab-" + tab));
  ({ resumen: cargarResumen, pedidos: cargarPedidos, stock: cargarStock, clientes: cargarClientes })[tab]();
}
$$(".pestanas button").forEach((b) => b.addEventListener("click", () => {
  if (b.dataset.tab === "pedidos") limpiarFiltroCliente();
  abrirTab(b.dataset.tab);
}));

function mostrarError(el, err) {
  el.innerHTML = `<p class="error">⚠️ ${escapar(err.message)}</p>`;
}

// ---------- Resumen ----------
async function cargarResumen() {
  try {
    const r = await api("admin_resumen");
    actualizarBadge(r.nuevos);
    $("#tarjetas").innerHTML = [
      ["Pedidos de hoy", r.pedidos_hoy],
      ["Ventas de hoy", pesos(r.ventas_hoy)],
      ["Ventas del mes", pesos(r.ventas_mes)],
      ["Pedidos pendientes", r.pendientes, "pedidos"],
    ].map(([t, v, ir]) => `<div class="kpi ${ir ? "clic" : ""}" ${ir ? `data-ir-tab="${ir}"` : ""}><span>${t}</span><strong>${v}</strong></div>`).join("");
    $("#stock-bajo").innerHTML = r.stock_bajo.length
      ? `<ul class="lista">${r.stock_bajo.map((p) => `<li><span>${escapar(p.nombre)}</span><strong class="${p.stock <= 0 ? "rojo" : "naranja"}">${p.stock}</strong></li>`).join("")}</ul>`
      : `<p class="vacio">Todo en orden 👍</p>`;
    $("#mas-vendidos").innerHTML = r.mas_vendidos.length
      ? `<ul class="lista">${r.mas_vendidos.map((p) => `<li><span>${escapar(p.nombre)}</span><span>${p.cantidad} u. · ${pesos(p.importe)}</span></li>`).join("")}</ul>`
      : `<p class="vacio">Todavía no hay ventas.</p>`;
  } catch (err) { mostrarError($("#tarjetas"), err); }
}

document.addEventListener("click", (e) => {
  const k = e.target.closest("[data-ir-tab]");
  if (k) abrirTab(k.dataset.irTab);
});

// Aviso de pedidos nuevos (cada 30 segundos)
async function revisarNuevos() {
  try {
    const r = await api("admin_resumen");
    if (ultimosNuevos !== null && r.nuevos > ultimosNuevos) {
      sonar();
      if (!$("#tab-pedidos").hidden && !$("#dlg-pedido").open) cargarPedidos();
      if (!$("#tab-resumen").hidden) cargarResumen();
    }
    actualizarBadge(r.nuevos);
  } catch {}
}

function actualizarBadge(n) {
  ultimosNuevos = n;
  $("#badge-nuevos").hidden = !n;
  $("#badge-nuevos").textContent = n;
  document.title = (n ? `(${n}) ` : "") + NEGOCIO.nombre + " · Panel";
}

function sonar() {
  try {
    const ctx = new AudioContext();
    [0, 0.25].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.2, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
  } catch {}
}

// ---------- Pedidos ----------
async function cargarPedidos() {
  const cont = $("#lista-pedidos");
  try {
    pedidos = await api("admin_pedidos", {
      p_estado: filtroTelefono ? "" : $("#f-estado").value,
      p_desde: $("#f-desde").value || null,
      p_hasta: $("#f-hasta").value || null,
      p_buscar: $("#f-buscar").value.trim() || null,
      p_telefono: filtroTelefono || null,
    });
  } catch (err) { return mostrarError(cont, err); }

  if (!pedidos.length) { cont.innerHTML = `<p class="vacio">No hay pedidos con este filtro.</p>`; return; }
  const total = pedidos.filter((p) => p.estado !== "cancelado").reduce((s, p) => s + Number(p.total), 0);
  cont.innerHTML = `
    <p class="subtotal-lista">${pedidos.length} pedido(s) · ${pesos(total)} (sin cancelados)</p>
    <div class="tabla-scroll"><table class="tabla">
      <thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Entrega</th><th class="num">Total</th><th>Estado</th></tr></thead>
      <tbody>${pedidos.map((p) => `
        <tr class="clic" data-pedido="${p.id}">
          <td><strong>${numeroPedido(p.id)}</strong></td>
          <td>${fechaHora(p.creado)}</td>
          <td>${escapar(p.nombre)}<br><small>${escapar(p.telefono)}</small></td>
          <td>${p.entrega === "retiro" ? "Retira" : escapar(p.direccion || "")}<br><small>${escapar(fechaLegible(p.fecha_entrega))} ${escapar(p.horario || "")}</small></td>
          <td class="num">${pesos(p.total)}</td>
          <td><span class="estado estado-${p.estado}">${ESTADOS[p.estado]}</span></td>
        </tr>`).join("")}
      </tbody></table></div>`;
}

["#f-estado", "#f-desde", "#f-hasta"].forEach((s) => $(s).addEventListener("change", cargarPedidos));
let esperaBusqueda;
$("#f-buscar").addEventListener("input", () => { clearTimeout(esperaBusqueda); esperaBusqueda = setTimeout(cargarPedidos, 350); });
$("#lista-pedidos").addEventListener("click", (e) => {
  const fila = e.target.closest("[data-pedido]");
  if (fila) abrirPedido(Number(fila.dataset.pedido));
});
$("#btn-imprimir-lista").addEventListener("click", () => {
  const lista = pedidos.filter((p) => p.estado !== "cancelado");
  if (!lista.length) return alert("No hay pedidos para imprimir.");
  if (confirm(`¿Imprimir ${lista.length} remito(s)? (uno por hoja)`)) imprimirRemitos(lista);
});

function limpiarFiltroCliente() {
  filtroTelefono = "";
  $("#filtro-cliente").hidden = true;
  $("#f-estado").disabled = false;
}

// Detalle de un pedido
async function abrirPedido(id) {
  try { pedidoAbierto = await api("admin_pedido", { p_id: id }); }
  catch (err) { return alert(err.message); }
  if (!pedidoAbierto) return alert("No se encontró el pedido.");
  pintarPedidoAbierto();
  $("#dlg-pedido").showModal();
}

function pintarPedidoAbierto() {
  const p = pedidoAbierto;
  $("#dlg-pedido-titulo").textContent = `Pedido N° ${numeroPedido(p.id)}`;
  $("#dlg-estado").innerHTML = Object.entries(ESTADOS)
    .map(([k, v]) => `<option value="${k}" ${k === p.estado ? "selected" : ""}>${v}</option>`).join("");
  $("#dlg-nota").value = p.nota_interna || "";
  $("#dlg-whatsapp").hidden = !p.telefono;
  $("#dlg-whatsapp").href = linkWhatsApp(p.telefono, `Hola ${p.nombre}! Te escribimos de ${NEGOCIO.nombre} por tu pedido N° ${numeroPedido(p.id)}.`);
  $("#dlg-error").hidden = true;
  $("#dlg-remito").innerHTML = htmlRemito(p);
}

$("#dlg-estado").addEventListener("change", async (e) => {
  const nuevo = e.target.value;
  if (nuevo === "cancelado" && !confirm("¿Cancelar el pedido? Los productos vuelven al stock.")) {
    e.target.value = pedidoAbierto.estado;
    return;
  }
  await guardarPedido(nuevo, null);
});

$("#dlg-nota").addEventListener("change", (e) => guardarPedido(pedidoAbierto.estado, e.target.value));

async function guardarPedido(estado, nota) {
  try {
    pedidoAbierto = await api("admin_cambiar_estado", { p_id: pedidoAbierto.id, p_estado: estado, p_nota: nota });
    pintarPedidoAbierto();
    cargarPedidos();
  } catch (err) {
    $("#dlg-error").textContent = err.message;
    $("#dlg-error").hidden = false;
    $("#dlg-estado").value = pedidoAbierto.estado;
  }
}

$("#dlg-eliminar").addEventListener("click", async () => {
  const p = pedidoAbierto;
  if (!confirm(`¿Eliminar para siempre el pedido N° ${numeroPedido(p.id)} de ${p.nombre}?\n\n` +
               "Desaparece de la lista y del balance, y los productos vuelven al stock. No se puede deshacer.")) return;
  try {
    await api("admin_eliminar_pedido", { p_id: p.id });
    $("#dlg-pedido").close();
    cargarPedidos();
    cargarResumen();
  } catch (err) {
    $("#dlg-error").textContent = err.message;
    $("#dlg-error").hidden = false;
  }
});

$("#dlg-imprimir").addEventListener("click", () =>
  imprimirRemitos([pedidoAbierto], $("#dlg-duplicado").checked ? 2 : 1));

$("#dlg-pedido").addEventListener("close", () => {
  if (location.hash) history.replaceState(null, "", location.pathname);
});

// ---------- Stock ----------
async function cargarStock() {
  try { productosAdmin = await api("admin_productos"); }
  catch (err) { return mostrarError($("#tabla-stock"), err); }
  $("#lista-categorias").innerHTML = [...new Set(productosAdmin.map((p) => p.categoria))]
    .map((c) => `<option value="${escapar(c)}">`).join("");
  pintarStock();
}

function pintarStock() {
  const q = $("#s-buscar").value.trim().toLowerCase();
  const soloBajo = $("#s-bajo").checked;
  const lista = productosAdmin.filter((p) =>
    p.nombre.toLowerCase().includes(q) && (!soloBajo || p.stock <= p.stock_minimo));
  const valor = productosAdmin.filter((p) => p.activo).reduce((s, p) => s + Math.max(p.stock, 0) * p.precio, 0);
  $("#tabla-stock").innerHTML = `
    <caption>${productosAdmin.length} productos · Valor del stock (a precio de venta): <strong>${pesos(valor)}</strong></caption>
    <thead><tr><th>Producto</th><th>Categoría</th><th class="num">Precio</th><th class="num">Stock</th><th></th></tr></thead>
    <tbody>${lista.map((p) => `
      <tr class="${p.activo ? "" : "inactivo"}">
        <td>${escapar(p.emoji || "")} ${escapar(p.nombre)} ${p.activo ? "" : "<small>(oculto)</small>"}</td>
        <td>${escapar(p.categoria)}</td>
        <td class="num">${pesos(p.precio)}</td>
        <td class="num"><strong class="${p.stock <= 0 ? "rojo" : p.stock <= p.stock_minimo ? "naranja" : ""}">${p.stock}</strong></td>
        <td class="botones">
          <button class="btn chico primario" data-mover="${p.id}">± Stock</button>
          <button class="btn chico" data-editar="${p.id}">Editar</button>
          <button class="btn chico" data-historial="${p.id}">Historial</button>
        </td>
      </tr>`).join("") || `<tr><td colspan="5" class="vacio">Sin resultados</td></tr>`}
    </tbody>`;
}

$("#s-buscar").addEventListener("input", pintarStock);
$("#s-bajo").addEventListener("change", pintarStock);

$("#tabla-stock").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const p = productosAdmin.find((x) => String(x.id) === (b.dataset.mover || b.dataset.editar || b.dataset.historial));
  if (b.dataset.mover) abrirMover(p);
  if (b.dataset.editar) abrirProducto(p);
  if (b.dataset.historial) abrirMovimientos(p);
});

// Alta / edición de producto
const formProd = $("#form-producto");
function abrirProducto(p) {
  formProd.reset();
  $(".error", formProd).hidden = true;
  $("#dlg-producto-titulo").textContent = p ? "Editar producto" : "Nuevo producto";
  $("#campo-stock-inicial").hidden = !!p; // el stock de un producto existente se mueve con "± Stock"
  if (p) for (const k of ["id", "nombre", "categoria", "precio", "stock_minimo", "emoji", "imagen"]) formProd[k].value = p[k] ?? "";
  else formProd.id.value = "";
  formProd.activo.checked = p ? p.activo : true;
  $("#dlg-producto").showModal();
}
$("#btn-nuevo-producto").addEventListener("click", () => abrirProducto(null));

formProd.addEventListener("submit", async (e) => {
  e.preventDefault();
  const datos = Object.fromEntries(new FormData(formProd));
  datos.activo = formProd.activo.checked;
  try {
    await api("admin_guardar_producto", { p: datos });
    $("#dlg-producto").close();
    cargarStock();
  } catch (err) {
    $(".error", formProd).textContent = err.message;
    $(".error", formProd).hidden = false;
  }
});

// Movimientos de stock
const formMover = $("#form-mover");
let productoMover = null;
function abrirMover(p) {
  productoMover = p;
  formMover.reset();
  $(".error", formMover).hidden = true;
  formMover.id.value = p.id;
  $("#mover-producto").innerHTML = `<strong>${escapar(p.nombre)}</strong> — stock actual: <strong>${p.stock}</strong>`;
  ajustarEtiquetaMover();
  $("#dlg-mover").showModal();
}
function ajustarEtiquetaMover() {
  $("#mover-etiqueta").textContent = {
    ingreso: "Cantidad que entra", merma: "Cantidad que sale", ajuste: "Stock real contado",
  }[formMover.tipo.value];
}
formMover.tipo.addEventListener("change", ajustarEtiquetaMover);

formMover.addEventListener("submit", async (e) => {
  e.preventDefault();
  const n = parseInt(formMover.cantidad.value, 10);
  const tipo = formMover.tipo.value;
  const delta = tipo === "ingreso" ? n : tipo === "merma" ? -n : n - productoMover.stock;
  const motivo = { ingreso: "ingreso", merma: "merma", ajuste: "ajuste por conteo" }[tipo] +
    (formMover.detalle.value.trim() ? " — " + formMover.detalle.value.trim() : "");
  if (!delta) { $("#dlg-mover").close(); return; }
  try {
    await api("admin_mover_stock", { p_producto: productoMover.id, p_cantidad: delta, p_motivo: motivo });
    $("#dlg-mover").close();
    cargarStock();
  } catch (err) {
    $(".error", formMover).textContent = err.message;
    $(".error", formMover).hidden = false;
  }
});

async function abrirMovimientos(p) {
  $("#mov-titulo").textContent = p ? "Historial: " + p.nombre : "Últimos movimientos de stock";
  $("#tabla-movimientos").innerHTML = `<tr><td class="vacio">Cargando…</td></tr>`;
  $("#dlg-movimientos").showModal();
  try {
    const movs = await api("admin_movimientos", { p_producto: p ? p.id : null });
    $("#tabla-movimientos").innerHTML = `
      <thead><tr><th>Fecha</th>${p ? "" : "<th>Producto</th>"}<th>Motivo</th><th class="num">Cant.</th><th class="num">Queda</th><th>Usuario</th></tr></thead>
      <tbody>${movs.map((m) => `<tr>
        <td>${fechaHora(m.fecha)}</td>
        ${p ? "" : `<td>${escapar(m.producto)}</td>`}
        <td>${escapar(m.motivo)}${m.pedido_id ? ` <a href="#" data-ver-pedido="${m.pedido_id}">N° ${numeroPedido(m.pedido_id)}</a>` : ""}</td>
        <td class="num ${m.cantidad < 0 ? "rojo" : "verde"}">${m.cantidad > 0 ? "+" : ""}${m.cantidad}</td>
        <td class="num">${m.stock_final}</td>
        <td><small>${escapar(m.usuario || "tienda")}</small></td>
      </tr>`).join("") || `<tr><td colspan="6" class="vacio">Sin movimientos</td></tr>`}</tbody>`;
  } catch (err) { mostrarError($("#tabla-movimientos"), err); }
}
$("#btn-movimientos").addEventListener("click", () => abrirMovimientos(null));
$("#tabla-movimientos").addEventListener("click", (e) => {
  const a = e.target.closest("[data-ver-pedido]");
  if (!a) return;
  e.preventDefault();
  $("#dlg-movimientos").close();
  abrirPedido(Number(a.dataset.verPedido));
});

// ---------- Clientes ----------
async function cargarClientes() {
  try { clientes = await api("admin_clientes", { p_buscar: $("#c-buscar").value.trim() || null }); }
  catch (err) { return mostrarError($("#tabla-clientes"), err); }
  $("#tabla-clientes").innerHTML = `
    <caption>${clientes.length} cliente(s)</caption>
    <thead><tr><th>Cliente</th><th>Dirección</th><th class="num">Pedidos</th><th class="num">Total comprado</th><th>Último pedido</th><th></th></tr></thead>
    <tbody>${clientes.map((c, i) => `
      <tr>
        <td><strong>${escapar(c.nombre)}</strong><br><small>${escapar(c.telefono)}</small></td>
        <td>${escapar(c.direccion || "—")}${c.localidad ? ", " + escapar(c.localidad) : ""}</td>
        <td class="num">${c.pedidos}</td>
        <td class="num">${pesos(c.gastado)}</td>
        <td>${fechaHora(c.ultimo)}</td>
        <td class="botones">
          <button class="btn chico primario" data-cliente="${i}">Ver pedidos</button>
          ${c.telefono ? `<a class="btn chico" target="_blank" rel="noopener" href="${linkWhatsApp(c.telefono)}">WhatsApp</a>` : ""}
        </td>
      </tr>`).join("") || `<tr><td colspan="6" class="vacio">Sin clientes todavía</td></tr>`}
    </tbody>`;
}
let esperaClientes;
$("#c-buscar").addEventListener("input", () => { clearTimeout(esperaClientes); esperaClientes = setTimeout(cargarClientes, 350); });
$("#tabla-clientes").addEventListener("click", (e) => {
  const b = e.target.closest("[data-cliente]");
  if (!b) return;
  const c = clientes[b.dataset.cliente];
  filtroTelefono = c.clave;
  $("#f-buscar").value = "";
  $("#f-desde").value = "";
  $("#f-hasta").value = "";
  $("#f-estado").disabled = true;
  $("#filtro-cliente").innerHTML = `Mostrando todos los pedidos de <strong>${escapar(c.nombre)}</strong>${c.telefono ? ` (${escapar(c.telefono)})` : ""} <button class="btn chico" id="quitar-filtro">Quitar filtro</button>`;
  $("#filtro-cliente").hidden = false;
  abrirTab("pedidos");
});
$("#filtro-cliente").addEventListener("click", (e) => {
  if (e.target.id === "quitar-filtro") { limpiarFiltroCliente(); cargarPedidos(); }
});

// ---------- Diálogos ----------
document.addEventListener("click", (e) => {
  const x = e.target.closest("[data-cerrar]");
  if (x) x.closest("dialog").close();
});

iniciar();
