/* ============================================================
   Lo único que este archivo necesita de JavaScript.

   Todas las interacciones del sitio —menú, selector de largo,
   visor de fotos, antes/después— se rehicieron con CSS, porque
   muchos visores de adjuntos del celular muestran el HTML pero
   no ejecutan scripts. Acá queda sólo el cartel de horarios,
   que sin script muestra igual los días y las horas reales.
   ============================================================ */
(function () {
  'use strict';

  var status = document.querySelector('[data-open-now]');
  if (!status) return;

  var WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var LABEL = {
    Monday: 'lunes', Tuesday: 'martes', Wednesday: 'miércoles', Thursday: 'jueves',
    Friday: 'viernes', Saturday: 'sábado', Sunday: 'domingo',
  };
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
    var get = function (t) {
      for (var i = 0; i < parts.length; i++) if (parts[i].type === t) return parts[i].value;
    };

    var day = get('weekday');
    var now = (+get('hour') % 24) * 60 + +get('minute');
    var slot = slotFor(day);
    var dot = status.querySelector('span[aria-hidden]');
    var txt = status.querySelector('[data-text]');

    if (slot && now >= mins(slot.opens) && now < mins(slot.closes)) {
      dot.className = 'inline-block h-1.5 w-1.5 rounded-full bg-success';
      txt.innerHTML = '<span class="font-medium text-success">Abierto ahora</span>' +
        '<span class="text-text-secondary"> · cierra a las ' + slot.closes + '</span>';
      return;
    }

    var next = null;
    if (slot && now < mins(slot.opens)) {
      next = { label: 'hoy', opens: slot.opens };
    } else {
      var start = WEEK.indexOf(day);
      for (var s = 1; s <= 7 && !next; s++) {
        var d = WEEK[(start + s) % 7];
        var sl = slotFor(d);
        if (sl) next = { label: s === 1 ? 'mañana' : LABEL[d], opens: sl.opens };
      }
    }

    dot.className = 'inline-block h-1.5 w-1.5 rounded-full bg-border-strong';
    txt.innerHTML = '<span class="text-text-secondary">' +
      '<span class="font-medium text-text-primary">Cerrado</span>' +
      (next ? ' · abre ' + next.label + ' a las ' + next.opens : '') + '</span>';
  };

  paint();
  setInterval(paint, 60000);
})();
