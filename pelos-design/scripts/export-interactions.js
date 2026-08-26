/* ============================================================
   Interacciones del sitio, reescritas sin framework.
   El HTML de esta copia se generó ya renderizado, así que sólo
   hace falta volver a atar lo que en el sitio real maneja React.
   ============================================================ */
(function () {
  'use strict';

  /* --- Apariciones al scrollear ------------------------------ */
  var reveals = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.dataset.visible = 'true'; });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.dataset.visible = 'true'; io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* --- Cabecera: fondo al bajar ------------------------------ */
  var header = document.querySelector('header');
  if (header) {
    var onScroll = function () {
      header.dataset.scrolled = window.scrollY > 24 ? 'true' : 'false';
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* --- Menú móvil -------------------------------------------- */
  var toggle = document.querySelector('button[aria-controls="menu-movil"]');
  var panel = document.getElementById('menu-movil');
  if (toggle && panel) {
    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
      if (header) header.dataset.open = String(open);
      document.body.style.overflow = open ? 'hidden' : '';
      var label = toggle.querySelector('.sr-only');
      if (label) label.textContent = open ? 'Cerrar menú' : 'Abrir menú';
      var bars = toggle.querySelectorAll('span[aria-hidden] > span');
      if (bars.length === 2) {
        bars[0].style.cssText = open ? 'top:5px;transform:rotate(45deg)' : 'top:0;transform:none';
        bars[1].style.cssText = open ? 'top:5px;transform:rotate(-45deg)' : 'top:10px;transform:none';
      }
    };
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false); toggle.focus();
      }
    });
    panel.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });
  }

  /* --- Barra fija en celular y botón flotante ---------------- */
  var bar = document.querySelector('div.fixed.inset-x-0.bottom-0');
  var floatBtn = document.querySelector('a.fixed[href*="wa.me"], a.fixed[href*="instagram.com"]');
  var onFloat = function () {
    if (bar) {
      var show = window.scrollY > window.innerHeight * 0.75 &&
        window.innerHeight + window.scrollY < document.body.offsetHeight - 320;
      bar.style.transform = show ? 'translateY(0)' : 'translateY(100%)';
      bar.setAttribute('aria-hidden', String(!show));
      if (show) bar.removeAttribute('inert'); else bar.setAttribute('inert', '');
    }
    if (floatBtn) {
      var v = window.scrollY > window.innerHeight * 0.7;
      floatBtn.style.opacity = v ? '1' : '0';
      floatBtn.style.transform = v ? 'translateY(0)' : 'translateY(0.75rem)';
      floatBtn.style.pointerEvents = v ? 'auto' : 'none';
      floatBtn.setAttribute('aria-hidden', String(!v));
      floatBtn.tabIndex = v ? 0 : -1;
    }
  };
  onFloat();
  window.addEventListener('scroll', onFloat, { passive: true });
  window.addEventListener('resize', onFloat, { passive: true });

  /* --- Comparador antes / después ----------------------------- */
  var slider = document.querySelector('input[type="range"][aria-valuetext]');
  if (slider) {
    var box = slider.closest('div');
    var clip = box ? box.querySelector('div[style*="clip-path"]') : null;
    var handle = box ? box.querySelector('div[aria-hidden="true"][style*="left"]') : null;
    var apply = function (v) {
      if (clip) clip.style.clipPath = 'inset(0 ' + (100 - v) + '% 0 0)';
      if (handle) handle.style.left = v + '%';
      slider.setAttribute('aria-valuetext', Math.round(v) + '% del antes visible');
    };
    slider.addEventListener('input', function () { apply(Number(slider.value)); });
    if (box) {
      var drag = function (e) {
        var r = box.getBoundingClientRect();
        if (!r.width) return;
        var v = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
        slider.value = String(Math.round(v)); apply(v);
      };
      box.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        box.setPointerCapture(e.pointerId); drag(e);
      });
      box.addEventListener('pointermove', function (e) {
        if (box.hasPointerCapture && box.hasPointerCapture(e.pointerId)) drag(e);
      });
    }
  }

  /* --- Selector de largo en la lista de precios --------------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  if (tabs.length) {
    var panels = tabs.map(function (t) {
      return document.getElementById(t.getAttribute('aria-controls'));
    });
    var select = function (i, focus) {
      tabs.forEach(function (t, j) {
        var on = i === j;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        t.className = t.className
          .replace(/bg-surface-deep|text-text-inverse|text-text-secondary|hover:bg-surface|hover:text-text-primary/g, '')
          .trim() + (on
            ? ' bg-surface-deep text-text-inverse'
            : ' text-text-secondary hover:bg-surface hover:text-text-primary');
        if (panels[j]) panels[j].hidden = !on;
      });
      if (focus) tabs[i].focus();
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i); });
      t.addEventListener('keydown', function (e) {
        var n = tabs.length;
        if (e.key === 'ArrowRight') { e.preventDefault(); select((i + 1) % n, true); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); select((i - 1 + n) % n, true); }
        else if (e.key === 'Home') { e.preventDefault(); select(0, true); }
        else if (e.key === 'End') { e.preventDefault(); select(n - 1, true); }
      });
    });
  }

  /* --- Visor de la galería ------------------------------------ */
  var plates = Array.prototype.slice.call(document.querySelectorAll('#trabajos button.group'));
  if (plates.length) {
    var items = plates.map(function (b) {
      var img = b.querySelector('img');
      var cap = b.querySelector('span.uppercase');
      return { src: img ? img.src : '', alt: img ? img.alt : '', caption: cap ? cap.textContent.trim() : '' };
    });
    var idx = 0, opener = null, dialog = null;

    var close = function () {
      if (!dialog) return;
      dialog.remove(); dialog = null;
      document.body.style.overflow = '';
      if (opener) opener.focus();
    };
    var render = function () {
      var it = items[idx];
      dialog.setAttribute('aria-label', it.caption + '. Imagen ' + (idx + 1) + ' de ' + items.length + '.');
      dialog.querySelector('[data-count]').textContent = (idx + 1) + ' / ' + items.length;
      var im = dialog.querySelector('img');
      im.src = it.src; im.alt = it.alt;
      dialog.querySelector('[data-cap]').textContent = it.caption;
    };
    var step = function (d) { idx = (idx + d + items.length) % items.length; render(); };

    var open = function (i, btn) {
      idx = i; opener = btn;
      dialog = document.createElement('div');
      dialog.className = 'on-dark fixed inset-0 z-[90] flex flex-col bg-surface-deep/97 backdrop-blur-sm';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.innerHTML =
        '<div class="flex items-center justify-between gap-4 px-4 py-4 sm:px-8">' +
        '<p class="text-[0.8125rem] text-text-inverse-muted" data-count></p>' +
        '<button type="button" data-close class="flex h-11 items-center px-3 text-[0.9375rem] text-text-inverse">Cerrar <span aria-hidden="true" class="ml-2 text-[1.2rem] leading-none">&times;</span></button>' +
        '</div>' +
        '<div class="flex min-h-0 flex-1 items-center justify-center px-4 pb-2 sm:px-8">' +
        '<img class="max-h-full w-auto max-w-full object-contain" alt="">' +
        '</div>' +
        '<div class="flex items-center justify-between gap-4 px-4 py-5 sm:px-8">' +
        '<button type="button" data-prev class="flex h-11 items-center px-3 text-[0.9375rem] text-text-inverse"><span aria-hidden="true" class="mr-2">&larr;</span>Anterior</button>' +
        '<p class="hidden text-center text-[0.875rem] text-text-inverse-muted sm:block" data-cap></p>' +
        '<button type="button" data-next class="flex h-11 items-center px-3 text-[0.9375rem] text-text-inverse">Siguiente<span aria-hidden="true" class="ml-2">&rarr;</span></button>' +
        '</div>';
      document.body.appendChild(dialog);
      document.body.style.overflow = 'hidden';
      render();
      dialog.querySelector('[data-close]').addEventListener('click', close);
      dialog.querySelector('[data-prev]').addEventListener('click', function () { step(-1); });
      dialog.querySelector('[data-next]').addEventListener('click', function () { step(1); });
      dialog.querySelector('[data-close]').focus();
    };

    plates.forEach(function (b, i) {
      b.addEventListener('click', function () { open(i, b); });
    });
    document.addEventListener('keydown', function (e) {
      if (!dialog) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (e.key === 'Tab') {
        var f = dialog.querySelectorAll('button');
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* --- "Abierto ahora", en hora de Buenos Aires --------------- */
  var status = document.querySelector('[data-open-now]');
  if (status) {
    var WEEK = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    var LABEL = { Monday:'lunes', Tuesday:'martes', Wednesday:'miércoles', Thursday:'jueves',
                  Friday:'viernes', Saturday:'sábado', Sunday:'domingo' };
    var HOURS = JSON.parse(status.getAttribute('data-open-now'));
    var slotFor = function (day) {
      for (var i = 0; i < HOURS.length; i++) if (HOURS[i].days.indexOf(day) >= 0) return HOURS[i];
      return null;
    };
    var mins = function (t) { var p = t.split(':'); return +p[0] * 60 + +p[1]; };
    var paint = function () {
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(new Date());
      var get = function (t) { for (var i=0;i<parts.length;i++) if (parts[i].type===t) return parts[i].value; };
      var day = get('weekday'), now = (+get('hour') % 24) * 60 + +get('minute');
      var slot = slotFor(day), dot = status.querySelector('span[aria-hidden]'), txt = status.querySelector('[data-text]');
      if (slot && now >= mins(slot.opens) && now < mins(slot.closes)) {
        dot.className = 'inline-block h-1.5 w-1.5 rounded-full bg-success';
        txt.innerHTML = '<span class="font-medium text-success">Abierto ahora</span><span class="text-text-secondary"> · cierra a las ' + slot.closes + '</span>';
        return;
      }
      var next = null;
      if (slot && now < mins(slot.opens)) next = { label: 'hoy', opens: slot.opens };
      else {
        var start = WEEK.indexOf(day);
        for (var s = 1; s <= 7 && !next; s++) {
          var d = WEEK[(start + s) % 7], sl = slotFor(d);
          if (sl) next = { label: s === 1 ? 'mañana' : LABEL[d], opens: sl.opens };
        }
      }
      dot.className = 'inline-block h-1.5 w-1.5 rounded-full bg-border-strong';
      txt.innerHTML = '<span class="text-text-secondary"><span class="font-medium text-text-primary">Cerrado</span>' +
        (next ? ' · abre ' + next.label + ' a las ' + next.opens : '') + '</span>';
    };
    paint();
    setInterval(paint, 60000);
  }
})();
