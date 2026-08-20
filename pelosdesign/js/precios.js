/* ══════════════════════════════════════════════════════════════════════════
   PRECIOS — todo lo que hace funcionar precios.html
   Los precios se cargan en js/datos.js, en el bloque "4) SERVICIOS Y PRECIOS".
   Acá no hace falta tocar nada.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";

  const LARGOS = [
    { clave:"corto",      nombre:"Corto",       nota:"Hasta la mandíbula"   },
    { clave:"mediano",    nombre:"Mediano",     nota:"Hasta los hombros"    },
    { clave:"largo",      nombre:"Largo",       nota:"Hasta el pecho"       },
    { clave:"extraLargo", nombre:"Extra largo", nota:"Más abajo del pecho"  }
  ];

  /* El largo elegido. Arranca en "mediano", que es el caso más común. */
  let indice = 1;

  const pesos = n => "$ " + n.toLocaleString("es-AR");

  function valorDe(item, i){
    if (Object.prototype.hasOwnProperty.call(item, "fijo")) return item.fijo;
    return item.precios ? item.precios[i] : null;
  }

  /* Cuenta los precios que faltan. Los servicios de precio único cuentan
     como uno solo, no como cuatro. */
  function contarPendientes(){
    let total = 0;
    SERVICIOS.forEach(g => g.items.forEach(it => {
      if (Object.prototype.hasOwnProperty.call(it, "fijo")){
        if (it.fijo === null) total++;
      } else {
        LARGOS.forEach((_, i) => { if (valorDe(it, i) === null) total++; });
      }
    }));
    return total;
  }

  function pintarSelector(){
    document.getElementById("largos").innerHTML = LARGOS.map((l, i) => `
      <button class="largo" type="button" data-i="${i}" aria-pressed="${i === indice}"
              style="--tono:${TONOS[i * 2 + 1]}">
        <span class="marca-largo" aria-hidden="true"></span>
        <b>${l.nombre}</b>
        <small>${l.nota}</small>
      </button>`).join("");
  }

  function pintarListado(){
    document.getElementById("listado").innerHTML = SERVICIOS.map(g => `
      <section class="grupo">
        <div class="grupo-tapa">
          <h2>${esc(g.grupo)}</h2>
          <span class="grupo-cuenta numero">${g.items.length} servicios</span>
        </div>
        ${g.items.map(it => {
          const v = valorDe(it, indice);
          const esFijo = Object.prototype.hasOwnProperty.call(it, "fijo");
          const detalle = [it.detalle, esFijo && v !== null ? "precio único" : ""]
            .filter(Boolean).join(" · ");
          return `<div class="fila">
            <div class="nombre">
              <b>${esc(it.nombre)}</b>
              ${detalle ? `<em>${esc(detalle)}</em>` : ""}
            </div>
            <div class="valor${v === null ? " pendiente" : ""}">${v === null ? "a consultar" : pesos(v)}</div>
          </div>`;
        }).join("")}
      </section>`).join("");
  }

  /* La tabla de cuatro columnas que sale impresa */
  function pintarMatriz(){
    document.getElementById("matriz").innerHTML = SERVICIOS.map(g => `
      <table>
        <caption>${esc(g.grupo)}</caption>
        <thead>
          <tr><th scope="col">Servicio</th>${LARGOS.map(l => `<th scope="col">${l.nombre}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${g.items.map(it => `<tr>
            <th scope="row" style="font-weight:400">${esc(it.nombre)}</th>
            ${LARGOS.map((_, i) => {
              const v = valorDe(it, i);
              return `<td>${v === null ? "a consultar" : pesos(v)}</td>`;
            }).join("")}
          </tr>`).join("")}
        </tbody>
      </table>`).join("");
  }

  function pintarFijos(){
    document.getElementById("notas").innerHTML = NOTAS.map(n => `<li>${esc(n)}</li>`).join("");

    const estado = estadoAhora();
    document.getElementById("estado").dataset.abierto = estado.abierto ? "1" : "0";
    document.getElementById("estadoTexto").textContent = estado.texto;

    const pendientes = contarPendientes();
    if (pendientes > 0){
      aviso("avisoPrecios",
        `<b>Faltan cargar ${pendientes} precios.</b> Abrí el archivo <code>js/datos.js</code> con cualquier
         editor de texto, buscá el bloque <b>4) SERVICIOS Y PRECIOS</b> y reemplazá cada <code>null</code>
         por el número, sin signo peso y sin puntos. Guardá y recargá esta página.
         Cuando estén todos, este cartel desaparece solo.`);
    }
  }

  document.getElementById("largos").addEventListener("click", e => {
    const boton = e.target.closest(".largo");
    if (!boton) return;
    indice = Number(boton.dataset.i);
    pintarSelector();
    pintarListado();
  });

  aplicarDatos();
  pintarFijos();
  pintarSelector();
  pintarListado();
  pintarMatriz();

  document.getElementById("imprimir").addEventListener("click", () => window.print());

  /* Recién ahora, con la lista ya armada, se muestra el cuerpo de la página.
     Ver el comentario en el <head> de precios.html: esto es lo que evita que
     la página dé un salto al cargar. */
  document.documentElement.classList.remove("armando");
})();
