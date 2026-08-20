/* ══════════════════════════════════════════════════════════════════════════
   SITIO — todo lo que hace funcionar index.html
   Los datos que se cambian están en js/datos.js. Acá no hace falta tocar nada.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";

  /* Las ocho secciones del sitio, cada una con su nivel en la escala de tonos */
  const SECCIONES = [
    { id:"top",       nombre:"Inicio"    },
    { id:"servicios", nombre:"Servicios" },
    { id:"resenas",   nombre:"Reseñas"   },
    { id:"precios",   nombre:"Precios"   },
    { id:"trabajos",  nombre:"Trabajos"  },
    { id:"equipo",    nombre:"Equipo"    },
    { id:"llegar",    nombre:"Cómo llegar" },
    { id:"preguntas", nombre:"Preguntas" }
  ];

  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));


  /* ═══ El elemento firma: la escala de tonos ═══ */

  function pintarEscala(){
    $("#escala").innerHTML = SECCIONES.map((s, i) => `
      <a class="escala-item" href="#${s.id}" data-seccion="${s.id}" style="--tono:${TONOS[i]}">
        <span class="escala-nivel numero">0${i + 1}</span>
        <span class="escala-muestra" aria-hidden="true"></span>
        <span class="escala-nombre">${esc(s.nombre)}</span>
      </a>`).join("");

    $("#escalaMobile").innerHTML = SECCIONES
      .map((s, i) => `<span style="--tono:${TONOS[i]}" data-seccion="${s.id}"></span>`).join("");

    $("#panelLista").innerHTML = SECCIONES.slice(1).map((s, i) => `
      <li><a href="#${s.id}">
        <span class="m" style="--tono:${TONOS[i + 1]}" aria-hidden="true"></span>
        <span class="n numero">0${i + 2}</span>
        <span class="t">${esc(s.nombre)}</span>
      </a></li>`).join("")
      + `<li><a href="precios.html">
          <span class="m" style="--tono:var(--violeta)" aria-hidden="true"></span>
          <span class="n numero">→</span>
          <span class="t">Lista de precios</span>
        </a></li>`;

    $("#pieEscala").innerHTML = TONOS.map(t => `<span style="--tono:${t}"></span>`).join("");
  }

  /* Marca en qué sección estamos y adapta el color del rail al fondo */
  function seguirScroll(){
    const secciones = SECCIONES.map(s => document.getElementById(s.id)).filter(Boolean);
    const rail = $("#escala");
    const claras = new Set(["servicios", "precios", "llegar", "preguntas"]);

    const observador = new IntersectionObserver(entradas => {
      entradas.forEach(e => {
        if (!e.isIntersecting) return;
        const id = e.target.id;

        $$(".escala-item").forEach(a =>
          a.setAttribute("aria-current", String(a.dataset.seccion === id)));

        $$("#escalaMobile span").forEach(sp => {
          if (sp.dataset.seccion === id) sp.dataset.visto = "1";
        });

        rail.dataset.fondo = claras.has(id) ? "claro" : "oscuro";
      });
    }, { rootMargin: "-45% 0px -45% 0px" });

    secciones.forEach(s => observador.observe(s));
  }


  /* ═══ Barra superior, menú y CTA sticky ═══ */

  function barraYMenu(){
    const barra  = $("#barra");
    const panel  = $("#panel");
    const abrir  = $("#abrirMenu");
    const cerrar = $("#cerrarMenu");
    const sticky = $("#sticky");
    const pie    = document.querySelector(".pie");

    const alScrollear = () => {
      barra.dataset.fijo = window.scrollY > 40 ? "1" : "0";
    };
    alScrollear();
    window.addEventListener("scroll", alScrollear, { passive: true });

    const alternar = estado => {
      panel.dataset.abierto = estado ? "1" : "0";
      abrir.setAttribute("aria-expanded", String(estado));
      document.body.style.overflow = estado ? "hidden" : "";
      if (estado) cerrar.focus(); else abrir.focus();
    };

    abrir.addEventListener("click", () => alternar(panel.dataset.abierto !== "1"));
    cerrar.addEventListener("click", () => alternar(false));
    panel.addEventListener("click", e => { if (e.target.closest("a")) alternar(false); });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && panel.dataset.abierto === "1") alternar(false);
    });

    /* El botón de WhatsApp aparece después del hero y se esconde sobre el pie,
       para no tapar los datos de contacto. */
    document.body.dataset.sticky = "1";
    let pasoElHero = false, enElPie = false;

    const refrescar = () => {
      sticky.dataset.visible = (pasoElHero && !enElPie) ? "1" : "0";
    };

    new IntersectionObserver(([e]) => {
      pasoElHero = !e.isIntersecting;
      refrescar();
    }, { rootMargin: "-70% 0px 0px 0px" }).observe($("#top"));

    new IntersectionObserver(([e]) => {
      enElPie = e.isIntersecting;
      refrescar();
    }).observe(pie);
  }


  /* ═══ Reseñas de Google ═══
     Solo se muestran las que están cargadas de verdad en js/datos.js.
     Las que faltan quedan como un recuadro punteado con la instrucción. */

  /* Si la reseña se recortó, cerramos con puntos suspensivos sin duplicar
     el punto final que ya traía el texto. */
  function recorte(r){
    if (!r.recortada) return r.texto;
    return r.texto.replace(/[\s.]+$/, "") + "…";
  }

  function pintarResenas(){
    const cargadas = RESEÑAS.filter(r => r.texto && r.autor);
    const faltan   = RESEÑAS.length - cargadas.length;

    /* Solo se muestran las reseñas realmente cargadas. Si no hay ninguna,
       en vez de recuadros vacíos va un panel que manda a la ficha de Google:
       el sitio nunca se ve a medio hacer para quien lo visita. */
    if (!cargadas.length){
      $("#muroResenas").innerHTML = `
        <div class="sin-datos">
          <p class="condensada">Las reseñas están en Google</p>
          <p>Todavía no elegimos cuáles mostrar acá. Mientras tanto podés leer las
             ${NEGOCIO.cantidadReseñas} completas, con nombre y fecha, en la ficha del salón.</p>
          <a class="boton boton-2" data-ficha href="#" rel="noopener">Leer las reseñas en Google</a>
        </div>`;
    } else {
      $("#muroResenas").innerHTML = cargadas.map(r => `
        <article class="resena">
          <div class="resena-tapa">
            <span class="estrellas" aria-label="${r.estrellas} de 5 estrellas">${estrellasSVG(r.estrellas)}</span>
            ${r.tema ? `<span class="resena-tema">${esc(r.tema)}</span>` : ""}
          </div>
          <blockquote>${esc(recorte(r))}</blockquote>
          <p class="resena-autor">
            <b>${esc(r.autor)}</b>
            <span>${r.recortada ? "Reseña recortada · " : ""}en Google</span>
          </p>
        </article>`).join("");
    }

    aplicarDatos();

    if (faltan > 0){
      aviso("avisoResenas",
        `<b>Faltan ${faltan} de ${RESEÑAS.length} reseñas.</b> Este cartel amarillo lo ves solo vos:
         quien visita el sitio no ve recuadros vacíos. Abrí <code>js/datos.js</code>, buscá el bloque
         <b>3) RESEÑAS DE GOOGLE</b> y pegá ahí el texto y el nombre tal cual figuran en la ficha.
         No las escribas de memoria: tienen que coincidir con lo publicado en Google.
         Cuando estén las ${RESEÑAS.length}, este cartel desaparece solo.`);
    }
  }


  /* ═══ Galería de trabajos ═══ */

  function pintarGaleria(){
    const cargadas = GALERIA.filter(g => g.archivo);
    const faltan   = GALERIA.length - cargadas.length;

    if (!cargadas.length){
      $("#galeria").innerHTML = `
        <div class="sin-datos">
          <p class="condensada">Los trabajos están en Instagram</p>
          <p>Todavía no subimos fotos a esta galería. En la cuenta del salón hay
             material nuevo casi todas las semanas.</p>
          <a class="boton boton-2" data-ig href="#" rel="noopener">Ver los trabajos en Instagram</a>
        </div>`;
    } else {
      $("#galeria").innerHTML = cargadas.map(g => `
        <figure class="trabajo">
          <img src="img/${esc(g.archivo)}" alt="${esc(g.alt || "")}"
               width="800" height="1000" loading="lazy" decoding="async">
          ${g.etiqueta ? `<figcaption class="trabajo-etiqueta">${esc(g.etiqueta)}</figcaption>` : ""}
        </figure>`).join("");
    }

    aplicarDatos();

    if (faltan > 0){
      aviso("avisoGaleria",
        `<b>Faltan ${faltan} fotos de trabajos.</b> Este cartel lo ves solo vos. Guardá las fotos en la
         carpeta <code>img/</code> y anotá el nombre de cada una en <code>js/datos.js</code>, en el
         bloque <b>6) GALERÍA</b>. Que sean trabajos hechos en el salón, con permiso de la persona.`);
    }
  }


  /* ═══ Horarios ═══ */

  function pintarHorarios(){
    const { dia } = ahoraEnBuenosAires();
    const estado = estadoAhora();

    $("#estado").dataset.abierto = estado.abierto ? "1" : "0";
    $("#estadoTexto").textContent = estado.texto;

    /* Empieza el lunes, que es como lo lee la gente */
    const orden = [1, 2, 3, 4, 5, 6, 0];
    $("#tablaHorarios").innerHTML = orden.map(i => {
      const d = HORARIOS[i];
      const abierto = Boolean(d.abre);
      return `<tr${i === dia ? ' data-hoy="1"' : ""}>
        <td>${esc(d.dia)}${i === dia ? " · hoy" : ""}</td>
        <td class="${abierto ? "" : "cerrado"}">${abierto ? hora(d.abre) + " a " + hora(d.cierra) : "Cerrado"}</td>
      </tr>`;
    }).join("");
  }


  /* ═══ Preguntas frecuentes ═══
     Las que todavía no tienen respuesta no se muestran. */

  function pintarFaq(){
    const listas = FAQ.filter(f => f.respuesta);

    $("#faq").innerHTML = listas.map((f, i) => `
      <details${i === 0 ? " open" : ""}>
        <summary>${esc(f.pregunta)}</summary>
        <p>${esc(f.respuesta)}</p>
      </details>`).join("");

    if (listas.length){
      $("#ld-faq").textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: listas.map(f => ({
          "@type": "Question",
          name: f.pregunta,
          acceptedAnswer: { "@type": "Answer", text: f.respuesta }
        }))
      });
    }
  }


  /* ═══ Mapa: no se carga hasta que lo piden ═══ */

  function prepararMapa(){
    $("#verMapa").addEventListener("click", () => {
      const consulta = encodeURIComponent(NEGOCIO.nombre + ", " + NEGOCIO.direccionLarga);
      $("#mapa").innerHTML =
        `<iframe title="Mapa de ${esc(NEGOCIO.nombre)} en ${esc(NEGOCIO.direccionCorta)}"
                 src="https://maps.google.com/maps?q=${consulta}&z=16&output=embed"
                 loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
    });
  }


  /* ═══ Datos estructurados para Google ═══ */

  function datosEstructurados(){
    const negocio = {
      "@context": "https://schema.org",
      "@type": "HairSalon",
      "@id": NEGOCIO.sitio + "/#salon",
      name: NEGOCIO.nombre,
      description: "Peluquería de diseño en Caballito. Corte, color, balayage y tratamientos, con turno previo.",
      url: NEGOCIO.sitio,
      image: NEGOCIO.sitio + "/img/og.png",
      telephone: "+" + NEGOCIO.whatsapp,
      address: {
        "@type": "PostalAddress",
        streetAddress: NEGOCIO.calle,
        addressLocality: NEGOCIO.ciudad,
        postalCode: NEGOCIO.codigoPostal,
        addressRegion: "CABA",
        addressCountry: "AR"
      },
      geo: { "@type": "GeoCoordinates", latitude: NEGOCIO.lat, longitude: NEGOCIO.lng },
      openingHoursSpecification: bloquesDeHorario().map(b => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: b.dias.map(i => DIAS_EN[i]),
        opens: b.abre,
        closes: b.cierra
      })),
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: NEGOCIO.puntaje.replace(",", "."),
        reviewCount: NEGOCIO.cantidadReseñas,
        bestRating: 5,
        worstRating: 1
      },
      sameAs: [NEGOCIO.fichaGoogle, urlInstagram()],
      areaServed: ["Caballito", "Flores", "Almagro", "Boedo", "Parque Chacabuco", "Villa Crespo"]
        .map(n => ({ "@type": "Place", name: n })),
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Servicios",
        itemListElement: SERVICIOS.flatMap(g => g.items.map(it => ({
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: it.nombre }
        })))
      }
    };
    $("#ld-negocio").textContent = JSON.stringify(negocio);
  }


  /* ═══ Arranque ═══ */

  aplicarDatos();
  pintarEscala();
  seguirScroll();
  barraYMenu();
  pintarResenas();
  pintarGaleria();
  pintarHorarios();
  pintarFaq();
  prepararMapa();
  datosEstructurados();

  document.getElementById("estrellasHero").innerHTML  = estrellasSVG(5);
  document.getElementById("estrellasBadge").innerHTML = estrellasSVG(5);
})();
