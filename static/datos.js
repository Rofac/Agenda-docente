/* ================================================================ CONFIGURACIÓN */
P.config = async (main) => {
  const c = await api('/api/config');
  const L = c.licencia_estado;
  const inp = (k, t, tipo = 'text', ayuda = '', extra = '') => `<div><label>${t}</label><input name="${k}" type="${tipo}" value="${esc(c[k])}" ${extra}>${ayuda ? `<div class="ayuda">${ayuda}</div>` : ''}</div>`;
  const si = (k, t, ayuda = '') => `<div class="full"><label class="chk"><input type="checkbox" data-si="${k}" ${c[k] === '1' ? 'checked' : ''}> ${t}</label>${ayuda ? `<div class="ayuda">${ayuda}</div>` : ''}</div>`;
  const sel = (k, t, ops, ayuda = '') => `<div><label>${t}</label><select name="${k}">${ops.map(([v, x]) => `<option value="${v}" ${String(c[k]) === String(v) ? 'selected' : ''}>${x}</option>`).join('')}</select>${ayuda ? `<div class="ayuda">${ayuda}</div>` : ''}</div>`;
  main.innerHTML = cabecera('conf', 'Configuración', 'Tus datos y cómo funciona la agenda', `<button class="btn verde grande" id="cfOk">${ico('check')} Guardar cambios</button>`) + `<div id="cfForm">
    <div class="card"><h3>${ico('user')} Mis datos</h3><div class="g">${inp('nombre_consultorio', 'Nombre y apellido', 'text', 'Sale en las impresiones.')}
      ${inp('dni', 'DNI', 'text', '', 'inputmode="numeric"')}${inp('provincia', 'Provincia')}${inp('telefono', 'Teléfono')}</div></div>
    <div class="card"><h3>${ico('cal')} Ciclo lectivo ${anioActual()}</h3><div class="g">
      ${inp('ciclo_inicio', 'Inicio de clases', 'date')}${inp('ciclo_fin', 'Fin de clases', 'date')}
      ${sel('periodos', 'Se divide en', [['3', 'Trimestres'], ['2', 'Cuatrimestres']])}<div></div>
      ${inp('periodo1_fin', 'Termina el 1° período', 'date', 'Para que cada evaluación vaya sola a su trimestre')}${inp('periodo2_fin', 'Termina el 2° período', 'date', 'Sólo si son trimestres')}</div></div>
    <div class="card"><h3>${ico('asis')} Asistencia y notas</h3><div class="g">
      ${sel('valor_tarde', 'Una llegada tarde (o retiro antes) cuenta como', [['0', 'Nada'], ['0.25', '1/4 de inasistencia'], ['0.5', '1/2 inasistencia'], ['1', '1 inasistencia']], 'Según el reglamento de tu escuela')}
      ${inp('asistencia_minima', 'Asistencia mínima (%)', 'number', 'Avisa cuando un alumno se está acercando')}
      ${inp('nota_aprobacion', 'Nota para aprobar', 'text', '', 'inputmode="decimal"')}<div></div>
      ${si('cuenta_justificadas', 'Las inasistencias justificadas también cuentan como inasistencia')}</div></div>
    <div class="card"><h3>${ico('llave')} Activación de la app</h3><div id="cfLic"></div></div>
    <div class="card"><h3>${ico('db')} Copia de seguridad</h3><div id="cfCopia"></div></div>
    <div class="card"><h3>${ico('bajar')} Instalar en el celular</h3><div id="cfApp"></div></div>
    <div class="card"><h3>${ico('info')} Acerca de</h3><div class="acerca"><div class="acerca-logo">${esc(window.MARCA || 'RoFac')}</div>
      <div><b style="font-size:16px">Agenda Docente · ${esc(window.MARCA || 'RoFac')}</b><div class="muted">Versión ${esc(window.VERSION || '')} para celular</div>
        <button class="btn chico" type="button" style="margin-top:10px" onclick="Legal.ver()">Términos y privacidad</button></div></div></div></div>`;
  if (L.bloqueado || L.por_vencer) $('#cfForm').prepend($('#cfLic').closest('.card'));     // si hay que activar, va primero
  tarjetaActivacion($('#cfLic')); tarjetaCopia($('#cfCopia')); tarjetaApp($('#cfApp'));
  if (L.bloqueado) $$('#cfForm input, #cfForm select, #cfForm textarea').forEach(i => { if (i.name && i.name !== 'nombre_consultorio' && i.closest('#cfForm > .card:nth-child(-n+3)')) i.disabled = true; });
  $('#cfOk').onclick = async () => {
    const d = leer($('#cfForm'));
    $$('[data-si]', main).forEach(x => d[x.dataset.si] = x.checked ? '1' : '0');
    try { await api('/api/config', d); toast('Configuración guardada'); ME = await api('/api/me'); pintarMarca(); pintarBannerLic(); ir('config'); } catch (e) { fallo(e); }
  };
};
