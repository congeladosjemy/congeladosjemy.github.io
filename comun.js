// Funciones compartidas entre la tienda (index.html) y el panel (admin.html)

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Llama a una función de la base y devuelve el resultado (o lanza un error legible)
async function api(nombre, args = {}) {
  const { data, error } = await sb.rpc(nombre, args);
  if (error) throw new Error(error.message || "Error de conexión");
  return data;
}

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const pesos = (n) => "$ " + Math.round(Number(n) || 0).toLocaleString("es-AR");

const escapar = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const numeroPedido = (id) => String(id).padStart(6, "0");

function fechaLegible(iso) {
  if (!iso) return "";
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

const fechaHora = (iso) =>
  new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });

// Fecha de hoy en formato AAAA-MM-DD (hora local)
function hoyISO(sumarDias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + sumarDias);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

const ESTADOS = {
  nuevo: "Nuevo",
  preparando: "Preparando",
  enviado: "En camino / listo",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

// Link de WhatsApp a un teléfono argentino escrito de cualquier forma
function linkWhatsApp(tel, texto = "") {
  let n = String(tel).replace(/\D/g, "").replace(/^0/, "");
  if (!n.startsWith("54")) n = "549" + n;
  return `https://wa.me/${n}${texto ? "?text=" + encodeURIComponent(texto) : ""}`;
}

// HTML del remito a partir de un pedido guardado
function htmlRemito(p) {
  const filas = p.items
    .map(
      (it) => `<tr>
        <td class="num">${it.cantidad}</td>
        <td>${escapar(it.nombre)}</td>
        <td class="num">${pesos(it.precio)}</td>
        <td class="num">${pesos(it.precio * it.cantidad)}</td>
      </tr>`
    )
    .join("");

  return `
  <div class="remito">
    <header class="remito-cab">
      <div>
        <h2>${escapar(NEGOCIO.nombre)}</h2>
        <p>${escapar(NEGOCIO.direccion)}<br>Tel: ${escapar(NEGOCIO.telefono)}${NEGOCIO.cuit ? "<br>CUIT: " + escapar(NEGOCIO.cuit) : ""}</p>
      </div>
      <div class="remito-x">X<small>Documento no válido como factura</small></div>
      <div class="remito-num">
        <h3>REMITO / PEDIDO</h3>
        <p>N° <strong>${numeroPedido(p.id)}</strong><br>Fecha: ${fechaHora(p.creado)}</p>
      </div>
    </header>

    <section class="remito-cliente">
      <div><span>Cliente:</span> ${escapar(p.nombre)}</div>
      <div><span>Teléfono:</span> ${escapar(p.telefono)}</div>
      ${p.entrega === "envio"
        ? `<div class="ancho"><span>Dirección:</span> ${escapar(p.direccion)}${p.localidad ? ", " + escapar(p.localidad) : ""}</div>`
        : ""}
      <div><span>Entrega:</span> ${p.entrega === "retiro" ? "Retira en local" : "Envío a domicilio"}</div>
      <div><span>Fecha entrega:</span> ${escapar(fechaLegible(p.fecha_entrega))} ${escapar(p.horario || "")}</div>
      <div><span>Forma de pago:</span> ${escapar(p.pago)}</div>
      ${p.observaciones ? `<div class="ancho"><span>Observaciones:</span> ${escapar(p.observaciones)}</div>` : ""}
    </section>

    <table class="remito-tabla">
      <thead><tr><th class="num">Cant.</th><th>Descripción</th><th class="num">P. unit.</th><th class="num">Subtotal</th></tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr><td colspan="3" class="num">TOTAL</td><td class="num">${pesos(p.total)}</td></tr></tfoot>
    </table>

    <footer class="remito-pie">
      <div class="firma">Firma y aclaración del cliente</div>
      <div class="firma">Recibí conforme</div>
    </footer>
  </div>`;
}

// Imprime uno o varios pedidos (cada uno en su hoja; opcionalmente con duplicado)
function imprimirRemitos(pedidos, copias = 1) {
  const zona = $("#zona-impresion");
  zona.innerHTML = pedidos
    .map((p) => `<div class="hoja">${Array.from({ length: copias }, () => htmlRemito(p)).join('<hr class="corte">')}</div>`)
    .join("");
  document.body.classList.add("imprimiendo");
  window.print();
}
window.addEventListener("afterprint", () => document.body.classList.remove("imprimiendo"));
