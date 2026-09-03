/**
 * form.js — validación y envío del formulario de consulta.
 *
 * No hay backend: el formulario arma el mensaje y abre la reserva. Se valida en
 * el cliente con mensajes concretos, sin depender del texto del navegador.
 */

import { abrirReserva, reservaActiva } from './booking.js';

const REGLAS = {
  nombre: (v) => (v.trim().length >= 2 ? '' : 'Escribí tu nombre para saber cómo llamarte.'),
  telefono: (v) => {
    const d = v.replace(/\D/g, '');
    if (!d) return 'Necesitamos un WhatsApp para responderte.';
    if (d.length < 8) return 'Faltan números. Poné el código de área y el número, sin el 0 ni el 15.';
    if (d.length > 15) return 'Ese número tiene más dígitos de los esperados. Revisalo.';
    return '';
  },
};

export function iniciarForm() {
  const form = document.querySelector('[data-form]');
  if (!form) return;

  const estado = form.querySelector('[data-form-estado]');

  const campoDe = (input) => input.closest('[data-campo]');

  const validarUno = (input) => {
    const regla = REGLAS[input.name];
    if (!regla) return true;
    const msg = regla(input.value);
    const campo = campoDe(input);
    const error = campo.querySelector('[data-error]');
    campo.dataset.invalido = String(Boolean(msg));
    input.setAttribute('aria-invalid', String(Boolean(msg)));
    if (error) error.textContent = msg;
    return !msg;
  };

  // Se valida al salir del campo; una vez marcado en rojo, también al tipear,
  // para que el error desaparezca apenas se corrige.
  form.querySelectorAll('input, textarea').forEach((input) => {
    input.addEventListener('blur', () => validarUno(input));
    input.addEventListener('input', () => {
      if (campoDe(input)?.dataset.invalido === 'true') validarUno(input);
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    estado.textContent = '';
    estado.removeAttribute('data-tipo');

    const campos = [...form.querySelectorAll('input[required]')];
    const validos = campos.map(validarUno);

    if (validos.includes(false)) {
      const primero = campos.find((c) => campoDe(c).dataset.invalido === 'true');
      estado.dataset.tipo = 'error';
      estado.textContent = 'Revisá los campos marcados y volvé a intentar.';
      primero?.focus();
      return;
    }

    if (!reservaActiva()) {
      estado.dataset.tipo = 'error';
      estado.textContent = 'Las reservas todavía no están configuradas en este sitio. Escribinos por Instagram mientras tanto.';
      document.querySelector('[data-aviso-reserva]')?.showModal();
      return;
    }

    const datos = Object.fromEntries(new FormData(form));
    abrirReserva({ origen: 'formulario', servicio: datos.servicio || undefined, formulario: datos });

    estado.dataset.tipo = 'ok';
    estado.textContent = 'Listo: abrimos WhatsApp con tu consulta escrita. Revisala y mandala.';
    form.reset();
  });
}
