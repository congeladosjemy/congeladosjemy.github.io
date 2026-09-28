// Funciones compartidas entre la tienda (index.html) y el remito (remito.html)

const pesos = (n) =>
  "$ " + Math.round(n).toLocaleString("es-AR");

const escapar = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Codifica el pedido para poder mandarlo dentro de un link (UTF-8 seguro)
function codificarPedido(pedido) {
  const bytes = new TextEncoder().encode(JSON.stringify(pedido));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodificarPedido(texto) {
  const b64 = texto.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function fechaLegible(iso) {
  if (!iso) return "";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

// Devuelve el HTML del remito a partir de un pedido
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
  const total = p.items.reduce((s, it) => s + it.precio * it.cantidad, 0);

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
        <p>N° <strong>${escapar(p.numero)}</strong><br>Fecha: ${escapar(p.fechaPedido)}</p>
      </div>
    </header>

    <section class="remito-cliente">
      <div><span>Cliente:</span> ${escapar(p.cliente.nombre)}</div>
      <div><span>Teléfono:</span> ${escapar(p.cliente.telefono)}</div>
      <div class="ancho"><span>Dirección:</span> ${escapar(p.cliente.direccion)}${p.cliente.localidad ? ", " + escapar(p.cliente.localidad) : ""}</div>
      <div><span>Entrega:</span> ${escapar(p.cliente.entrega === "retiro" ? "Retira en local" : "Envío a domicilio")}</div>
      <div><span>Fecha entrega:</span> ${escapar(fechaLegible(p.cliente.fechaEntrega))} ${escapar(p.cliente.horario || "")}</div>
      <div><span>Forma de pago:</span> ${escapar(p.cliente.pago)}</div>
      ${p.cliente.observaciones ? `<div class="ancho"><span>Observaciones:</span> ${escapar(p.cliente.observaciones)}</div>` : ""}
    </section>

    <table class="remito-tabla">
      <thead><tr><th class="num">Cant.</th><th>Descripción</th><th class="num">P. unit.</th><th class="num">Subtotal</th></tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr><td colspan="3" class="num">TOTAL</td><td class="num">${pesos(total)}</td></tr></tfoot>
    </table>

    <footer class="remito-pie">
      <div class="firma">Firma y aclaración del cliente</div>
      <div class="firma">Recibí conforme</div>
    </footer>
  </div>`;
}
