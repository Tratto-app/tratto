import { manejarTienda } from './_nucleo.js';

export const config = { runtime: 'edge' };

export default async function manejar(request) {
  return (await manejarTienda(request, { env: process.env, salir: (url, opciones) => fetch(url, opciones) })) || new Response('No existe', { status: 404 });
}
