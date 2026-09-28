// ============================================================
//  CATÁLOGO DE PRODUCTOS
//  Editá esta lista para cambiar productos, precios y fotos.
//  - id: identificador único (sin espacios)
//  - precio: en pesos, sin puntos ni signos
//  - imagen: opcional (ruta o URL). Si no hay, se muestra el emoji.
// ============================================================

const NEGOCIO = {
  nombre: "Congelados JEMY",
  // Número de WhatsApp donde llegan los pedidos (código de país + área + número, sin + ni espacios)
  whatsapp: "5491100000000",
  direccion: "Dirección del local",
  telefono: "11 0000-0000",
  cuit: "",
};

const PRODUCTOS = [
  { id: "emp-carne",   nombre: "Empanadas de carne x12",    categoria: "Empanadas",     precio: 9000,  emoji: "🥟" },
  { id: "emp-jyq",     nombre: "Empanadas jamón y queso x12", categoria: "Empanadas",   precio: 8500,  emoji: "🥟" },
  { id: "emp-pollo",   nombre: "Empanadas de pollo x12",    categoria: "Empanadas",     precio: 8800,  emoji: "🥟" },
  { id: "mila-carne",  nombre: "Milanesas de carne x1 kg",  categoria: "Milanesas",     precio: 12000, emoji: "🥩" },
  { id: "mila-pollo",  nombre: "Milanesas de pollo x1 kg",  categoria: "Milanesas",     precio: 10500, emoji: "🍗" },
  { id: "mila-soja",   nombre: "Milanesas de soja x6",      categoria: "Milanesas",     precio: 5500,  emoji: "🌱" },
  { id: "hamb",        nombre: "Hamburguesas caseras x4",   categoria: "Hamburguesas",  precio: 6000,  emoji: "🍔" },
  { id: "pizza-muzza", nombre: "Pizza muzzarella",          categoria: "Pizzas",        precio: 7000,  emoji: "🍕" },
  { id: "prepizza",    nombre: "Prepizzas x2",              categoria: "Pizzas",        precio: 3000,  emoji: "🍕" },
  { id: "papas",       nombre: "Papas fritas x2,5 kg",      categoria: "Vegetales",     precio: 7500,  emoji: "🍟" },
  { id: "verduras",    nombre: "Mix de verduras x1 kg",     categoria: "Vegetales",     precio: 4000,  emoji: "🥦" },
  { id: "nuggets",     nombre: "Nuggets de pollo x1 kg",    categoria: "Rebozados",     precio: 9500,  emoji: "🍗" },
];
