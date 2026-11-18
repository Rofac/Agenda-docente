/* ================================================================ CURSOS: alumnos, asistencia, libro de temas y notas */
const ASIS = { P: ['Presente', 'P'], A: ['Ausente', 'A'], T: ['Llegó tarde', 'T'], J: ['Ausente justificado', 'J'], R: ['Se retiró antes', 'R'] };
let CURSO_TAB = 'asistencia', CURSO_FECHA = '', CURSOS_ANIO = 0, PLAN_MES = '';

P.cursos = async (main) => {
  CURSOS_ANIO = CURSOS_ANIO || anioActual();
  const [l] = await Promise.all([api('/api/cursos?todos=1&ciclo=' + CURSOS_ANIO), cargarEscuelas()]);
  const porEsc = {};
  l.forEach(c => (porEsc[c.escuela_id] = porEsc[c.escuela_id] || { nombre: c.escuela, color: c.color, cursos: [] }).cursos.push(c));
  main.innerHTML = cabecera('birrete', 'Cursos', `Ciclo lectivo ${CURSOS_ANIO} · asistencia, libro de temas y notas`,
    `<select id="cuA" style="width:auto">${opcAnios(CURSOS_ANIO)}</select><button class="btn pri" id="cuN">${ico('plus')} Nuevo curso</button>`) +
    (!ESC.length ? `<div class="aviso">${ico('info')} Primero cargá tus escuelas en <a data-ir="escuelas">Escuelas y cargos</a>.</div>` : '') +
    (l.length ? Object.values(porEsc).map(e => `<div class="sep-t" style="margin-top:14px">${puntoColor(e.color)} ${esc(e.nombre)}</div>
      <div class="cursos-grid">${e.cursos.map(c => `<div class="card curso-c ${c.activo ? '' : 'inact'}" data-c="${c.id}" style="--cc:${esc(c.color)}">
        <b>${esc(nomCurso(c))}</b><div class="muted chico">${esc(c.turno || '')}${c.activo ? '' : ' · terminado'}</div>
        <div class="cc-n"><span>${ico('users')} ${c.alumnos}</span><span>${ico('asis')} ${c.clases} clases</span>
          ${c.asistencia !== null ? `<span title="Asistencia promedio">${num(c.asistencia)}%</span>` : ''}</div>
        ${c.en_riesgo ? `<span class="pill naranja">${c.en_riesgo} con muchas faltas</span>` : ''}</div>`).join('')}</div>`).join('')
      : `<div class="card vacio-g">${ico('birrete')}<p>Creá cada curso donde das clases (ej. 3° B · Matemática) y pegá la lista de alumnos.</p></div>`);
  $('#cuA').onchange = e => { CURSOS_ANIO = +e.target.value; ir('cursos'); };
  $('#cuN').onclick = () => editarCurso({ ciclo: CURSOS_ANIO });
  main.onclick = e => { const c = e.target.closest('[data-c]'); if (c) ir('curso', c.dataset.c); const k = e.target.closest('[data-ir]'); if (k) ir(k.dataset.ir); };
};

async function editarCurso(c) {
  if (!ESC.length) { toast('Primero cargá una escuela'); return ir('escuelas'); }
  const nuevo = !c.id;
  const anteriores = nuevo ? await api('/api/cursos?todos=1&ciclo=' + ((c.ciclo || anioActual()) - 1)) : [];
  const m = modal(nuevo ? 'Nuevo curso' : 'Modificar curso', `<div class="g">
    <div><label>Escuela</label><select name="escuela_id" id="ceE">${opcEscuelas(c.escuela_id || (ESC.length === 1 ? ESC[0].id : ''), ESC.length > 1 ? 'Elegí la escuela' : undefined)}</select></div>
    <div><label>Ciclo lectivo</label><select name="ciclo">${opcAnios(c.ciclo || anioActual())}</select></div>
    <div><label>Año / grado</label><input name="anio" value="${esc(c.anio || '')}" placeholder="Ej. 3°, 1er año, Sala de 5"></div>
    <div><label>División</label><input name="division" value="${esc(c.division || '')}" placeholder="Ej. B, 2da"></div>
    <div><label>Materia / espacio</label><input name="materia" value="${esc(c.materia || '')}" placeholder="Ej. Matemática (vacío si sos maestra de grado)"></div>
    <div><label>Turno</label><select name="turno">${['', 'Mañana', 'Tarde', 'Vespertino', 'Noche'].map(t => `<option ${t === (c.turno || '') ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div><label>Cargo (opcional)</label><select name="cargo_id" id="ceG"></select></div>
    ${nuevo && anteriores.length ? `<div><label>Copiar los alumnos de (opcional)</label><select name="copiar_alumnos_de"><option value="">No</option>${anteriores.map(x => `<option value="${x.id}">${esc(nomCurso(x))} ${c.ciclo - 1} · ${esc(x.escuela)}</option>`).join('')}</select></div>` : ''}
    <div class="full"><label>Notas</label><input name="notas" value="${esc(c.notas || '')}"></div>
    ${nuevo ? '' : `<div class="full"><label class="chk"><input type="checkbox" id="ceIn" ${c.activo ? '' : 'checked'}> Curso terminado (no aparece en Hoy ni en el horario)</label></div>`}</div>`,
    `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="ceOk">Guardar</button>`, '', 'birrete');
  const pg = () => $('#ceG', m).innerHTML = opcCargos($('#ceE', m).value, c.cargo_id, '—');
  $('#ceE', m).onchange = pg; pg();
  $('#ceOk', m).onclick = async () => {
    const d = leer($('.mb', m)); d.id = c.id; d.activo = nuevo ? 1 : !$('#ceIn', m).checked;
    try { const r = await api('/api/cursos', d); m.cerrar(); toast('Curso guardado'); if (nuevo) { CURSO_TAB = 'alumnos'; ir('curso', r.id); } else recargar(); } catch (x) { fallo(x); }
  };
}

/* ---------------------------------------------------------------- un curso */
P.curso = async (main, id) => {
  await cargarEscuelas();
  const c = await api('/api/cursos/' + id);
  const tabs = { asistencia: ['asis', 'Asistencia'], alumnos: ['users', 'Alumnos'], notas: ['notas', 'Notas'], temas: ['libro', 'Libro de temas'], planilla: ['hoja', 'Planilla'] };
  main.innerHTML = cabecera('birrete', nomCurso(c), `${c.escuela} · ${c.ciclo}${c.turno ? ' · ' + c.turno : ''} · ${c.alumnos.filter(a => a.activo).length} alumnos · ${c.clases_dictadas} clases`,
    `<button class="btn" id="cvEd">${ico('lapiz')} Modificar curso</button>`) +
    `<div class="tabs" id="cvT">${Object.entries(tabs).map(([k, [i, t]]) => `<button data-t="${k}" class="${k === CURSO_TAB ? 'act' : ''}">${ico(i)} <span>${t}</span></button>`).join('')}</div><div id="cvB"></div>`;
  $('#cvEd').onclick = () => editarCurso(c);
  const abrir = t => { CURSO_TAB = t; $$('#cvT button').forEach(b => b.classList.toggle('act', b.dataset.t === t)); ({ asistencia: tabAsistencia, alumnos: tabAlumnos, notas: tabNotas, temas: tabTemas, planilla: tabPlanilla })[t]($('#cvB'), c); };
  $('#cvT').onclick = e => { const b = e.target.closest('[data-t]'); if (b) abrir(b.dataset.t); };
  if (!c.alumnos.length && CURSO_TAB === 'asistencia') CURSO_TAB = 'alumnos';
  abrir(CURSO_TAB);
};

/* ---------------------------------------------------------------- ASISTENCIA del día + tema */
async function tabAsistencia(el, c) {
  const fecha = CURSO_FECHA || hoy();
  const d = await api(`/api/cursos/${c.id}/clase?fecha=${fecha}`);
  const k = d.clase;
  const est = {}; d.alumnos.forEach(a => est[a.id] = a.estado || 'P');
  let hubo = k ? !!k.hubo : !d.aviso;
  const mover = n => { CURSO_FECHA = sumarDias(fecha, n); tabAsistencia(el, c); };
  el.innerHTML = `<div class="card"><div class="asis-cab">
      <button class="ab" id="asA">${ico('izq')}</button><input type="date" id="asF" value="${fecha}" max="${sumarDias(hoy(), 1)}" style="width:auto"><button class="ab" id="asS">${ico('der')}</button>
      <b class="asis-dia">${fechaLarga(fecha)}</b>${k ? `<span class="pill ATENDIDO">Guardada</span>` : '<span class="pill gris">Sin guardar</span>'}</div>
    ${d.aviso ? `<div class="aviso-dia">${ico('bandera')} ${esc(d.aviso)}: ese día no hay clases.</div>` : ''}
    <div class="seg" id="asH" style="margin:8px 0"><button data-h="1" class="${hubo ? 'act' : ''}">Hubo clase</button><button data-h="0" class="${hubo ? '' : 'act'}">No hubo clase</button></div>
    <div id="asNo" style="${hubo ? 'display:none' : ''}"><label>¿Por qué no hubo clase?</label><input id="asM" value="${esc(k ? k.motivo : d.aviso || '')}" placeholder="Ej. Paro, acto, jornada, lluvia"></div>
    <div id="asSi" style="${hubo ? '' : 'display:none'}">
      ${d.alumnos.length ? `<div class="asis-res" id="asR"></div><div class="inl" style="margin:6px 0 4px"><span class="muted chico">Todos empiezan presentes: tocá a los que faltaron.</span>
        <button class="btn chico link" id="asTodos" style="margin-left:auto">Todos presentes</button></div>
      <div class="asis-lista">${d.alumnos.map((a, i) => `<div class="asis-f ${a.activo ? '' : 'inact'}" data-a="${a.id}"><span class="n">${i + 1}</span><span class="nom"><b>${esc(a.apellido)}</b> ${esc(a.nombre)}</span>
        <button type="button" class="obs-b ${a.obs && a.obs.pend ? 'pend' : ''}" data-obs="${a.id}" title="Anotar una observación">${ico('lapiz')}${a.obs && a.obs.n ? `<i>${a.obs.n}</i>` : ''}</button>
        <span class="asis-b">${Object.keys(ASIS).map(x => `<button type="button" data-e="${x}" class="e${x} ${est[a.id] === x ? 'act' : ''}" title="${ASIS[x][0]}">${x}</button>`).join('')}</span></div>`).join('')}</div>`
      : `<div class="aviso">${ico('info')} El curso no tiene alumnos. Cargalos en la pestaña <b>Alumnos</b>.</div>`}
    </div></div>
    <div class="card"><h3>${ico('libro')} Libro de temas</h3>${d.anterior ? `<div class="muted chico" style="margin-bottom:6px">Clase anterior (${dmy(d.anterior.fecha)}): ${esc(d.anterior.tema || 'sin tema anotado')}</div>` : ''}
      <label>Tema / contenido</label><textarea id="asT" placeholder="Ej. Fracciones equivalentes">${esc(k ? k.tema : '')}</textarea>
      <div class="g2" style="margin-top:8px"><div><label>Actividades</label><textarea id="asAc">${esc(k ? k.actividades : '')}</textarea></div><div><label>Tarea</label><textarea id="asTa">${esc(k ? k.tarea : '')}</textarea></div></div></div>
    <div class="barra-guardar">${k ? `<button class="btn rojo" id="asB">${ico('trash')} Borrar esta clase</button>` : ''}<button class="btn verde grande" id="asOk">${ico('check')} Guardar</button></div>`;
  const resumen = () => {
    const r = $('#asR', el); if (!r) return;
    const n = x => Object.values(est).filter(v => v === x).length;
    r.innerHTML = `<span class="eP">${n('P')} presentes</span><span class="eA">${n('A') + n('J')} ausentes</span>${n('T') ? `<span class="eT">${n('T')} tarde</span>` : ''}${n('R') ? `<span class="eR">${n('R')} se retiraron</span>` : ''}`;
  };
  resumen();
  const cambiado = () => { SIN_GUARDAR = 'Hay cambios en la asistencia sin guardar.'; };
  el.onclick = e => {
    const ob = e.target.closest('[data-obs]');
    if (ob) { const a = d.alumnos.find(x => x.id === +ob.dataset.obs); return nuevaObservacion(a, () => { a.obs = a.obs || { n: 0, pend: 0 }; a.obs.n++; pintarObsBoton(ob, a); }, { fecha: fecha > hoy() ? hoy() : fecha }); }
    const b = e.target.closest('[data-e]'); if (!b) return;
    const f = b.closest('[data-a]'); est[f.dataset.a] = b.dataset.e;
    $$('[data-e]', f).forEach(x => x.classList.toggle('act', x === b)); resumen(); cambiado();
  };
  /* tocar el nombre alterna presente / ausente (lo más rápido en el celular) */
  $$('.asis-f .nom', el).forEach(n => n.onclick = () => { const f = n.closest('[data-a]'), id = f.dataset.a; est[id] = est[id] === 'P' ? 'A' : 'P';
    $$('[data-e]', f).forEach(x => x.classList.toggle('act', x.dataset.e === est[id])); resumen(); cambiado(); });
  if ($('#asTodos', el)) $('#asTodos', el).onclick = () => { Object.keys(est).forEach(k => est[k] = 'P'); $$('[data-e]', el).forEach(x => x.classList.toggle('act', x.dataset.e === 'P')); resumen(); cambiado(); };
  $('#asH', el).onclick = e => { const b = e.target.closest('[data-h]'); if (!b) return; hubo = b.dataset.h === '1';
    $$('#asH button', el).forEach(x => x.classList.toggle('act', x === b)); $('#asSi', el).style.display = hubo ? '' : 'none'; $('#asNo', el).style.display = hubo ? 'none' : ''; cambiado(); };
  ['#asT', '#asAc', '#asTa', '#asM'].forEach(s => $(s, el).oninput = cambiado);
  const irFecha = async f => { if (SIN_GUARDAR && !await confirmar('Hay cambios sin guardar. ¿Cambiar de día igual?', 'Cambiar')) return; SIN_GUARDAR = ''; CURSO_FECHA = f; tabAsistencia(el, c); };
  $('#asA', el).onclick = () => irFecha(sumarDias(fecha, -1)); $('#asS', el).onclick = () => irFecha(sumarDias(fecha, 1));
  $('#asF', el).onchange = e => e.target.value && irFecha(e.target.value);
  $('#asOk', el).onclick = async () => {
    try {
      const r = await api(`/api/cursos/${c.id}/clase`, { fecha, hubo: hubo ? 1 : 0, motivo: $('#asM', el).value, tema: $('#asT', el).value, actividades: $('#asAc', el).value,
        tarea: $('#asTa', el).value, asistencia: est });
      SIN_GUARDAR = ''; toast(hubo ? `Asistencia guardada · ${r.ausentes} ausente${r.ausentes === 1 ? '' : 's'}` : 'Guardado: no hubo clase'); tabAsistencia(el, c);
    } catch (x) { fallo(x); }
  };
  if (k) $('#asB', el).onclick = async () => { if (!await confirmar('¿Borrar la clase de este día y su asistencia?', 'Borrar')) return; await api('/api/clases/' + k.id, undefined, 'DELETE'); SIN_GUARDAR = ''; tabAsistencia(el, c); };
}

/* ---------------------------------------------------------------- ALUMNOS */
async function tabAlumnos(el, c) {
  const d = await api('/api/cursos/' + c.id);
  const al = d.alumnos;
  const sub = $('.ph .sub'); if (sub) sub.textContent = `${d.escuela} · ${d.ciclo}${d.turno ? ' · ' + d.turno : ''} · ${al.filter(a => a.activo).length} alumnos · ${d.clases_dictadas} clases`;
  el.innerHTML = `<div class="card"><div class="inl" style="justify-content:space-between;margin-bottom:8px"><h3 style="margin:0">${ico('users')} ${al.filter(a => a.activo).length} alumnos</h3>
    <div class="inl"><button class="btn" id="alImp">${ico('print')} Imprimir lista</button><button class="btn" id="alP">${ico('copiar')} Pegar lista</button><button class="btn pri" id="alN">${ico('plus')} Agregar</button></div></div>
    ${al.length ? `<div class="tabla-x"><table class="t"><thead><tr><th>#</th><th>Alumno</th><th class="ocultar-movil">DNI</th><th class="r">Asistencia</th><th class="r">Inasist.</th><th></th></tr></thead><tbody>
    ${al.map((a, i) => { const x = a.asis; return `<tr class="${a.activo ? '' : 'anulado'}" data-a="${a.id}" style="cursor:pointer"><td class="muted">${a.activo ? i + 1 : ''}</td>
      <td><b>${esc(a.apellido)}</b> ${esc(a.nombre)}${a.activo ? '' : ` <span class="pill gris">Baja ${dmy(a.baja)}</span>`}${obsPill(a)}${a.telefono ? `<div class="muted chico">${esc(a.tutor || 'Tutor')}: ${esc(a.telefono)}</div>` : ''}</td>
      <td class="ocultar-movil">${esc(a.dni)}</td>
      <td class="r">${x ? `<span class="pill ${x.libre ? 'rojo' : x.riesgo ? 'naranja' : 'ATENDIDO'}">${num(x.porcentaje)}%</span>` : '<span class="muted">—</span>'}</td>
      <td class="r">${x ? num(x.inasistencias) : ''}${x && (x.T || x.J) ? `<div class="muted chico">${x.A}A ${x.J}J ${x.T}T</div>` : ''}</td>
      <td class="r" style="white-space:nowrap"><button type="button" class="btn chico" data-obs="${a.id}" title="Observaciones">${ico('lapiz')}<span class="ocultar-movil"> Observ.</span></button></td></tr>`; }).join('')}</tbody></table></div>`
    : `<div class="vacio-g">${ico('users')}<p>Pegá la lista del curso (la podés copiar de un Excel, un Word o del grupo de WhatsApp): un alumno por renglón.</p></div>`}</div>`;
  $('#alN', el).onclick = () => editarAlumno({ curso_id: c.id }, () => tabAlumnos(el, c));
  $('#alP', el).onclick = () => {
    const m = modal('Pegar lista de alumnos', `<p class="muted">Un alumno por renglón: <b>Apellido, Nombre</b> (o Apellido Nombre). Si está el DNI, se toma solo.</p>
      <textarea id="plT" style="min-height:260px" placeholder="PÉREZ, Juan Carlos\nGÓMEZ María 45123456\n..."></textarea>`,
      `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="plOk">Agregar</button>`, 'ancho', 'users');
    $('#plOk', m).onclick = async () => { try { const r = await api(`/api/cursos/${c.id}/alumnos/pegar`, { texto: $('#plT', m).value }); m.cerrar();
      toast(`${r.agregados} alumnos agregados${r.repetidos ? ` (${r.repetidos} ya estaban)` : ''}`); tabAlumnos(el, c); } catch (x) { fallo(x); } };
  };
  el.onclick = e => {
    const ob = e.target.closest('[data-obs]'); if (ob) return verObservaciones(+ob.dataset.obs, () => tabAlumnos(el, c));
    const r = e.target.closest('[data-a]'); if (r) editarAlumno(al.find(a => a.id === +r.dataset.a), () => tabAlumnos(el, c));
  };
  $('#alImp', el).onclick = () => imprimir('Lista ' + nomCurso(c), `<h1>${esc(nomCurso(c))}</h1><div class="sub">${esc(c.escuela)} · ${c.ciclo}${c.turno ? ' · ' + esc(c.turno) : ''}</div>
    <table><tr><th>#</th><th>Apellido y nombre</th><th>DNI</th>${Array(10).fill('<th style="width:34px"></th>').join('')}</tr>
    ${al.filter(a => a.activo).map((a, i) => `<tr><td>${i + 1}</td><td><b>${esc(a.apellido)}</b> ${esc(a.nombre)}</td><td>${esc(a.dni)}</td>${Array(10).fill('<td></td>').join('')}</tr>`).join('')}</table>`);
}

function editarAlumno(a, luego) {
  const nuevo = !a.id, x = a.asis;
  const m = modal(nuevo ? 'Agregar alumno' : `${a.apellido} ${a.nombre}`, `
    ${x ? `<div class="kpis" style="margin-top:0"><div class="kpi" style="--c:var(--verde)"><small>Asistencia</small><b>${num(x.porcentaje)}%</b></div>
      <div class="kpi" style="--c:var(--rojo)"><small>Inasistencias</small><b>${num(x.inasistencias)}</b><div class="det">${x.A} aus. · ${x.J} just. · ${x.T} tarde · ${x.R} retiros · ${x.clases} clases</div></div></div>` : ''}
    ${nuevo ? '' : `<div class="obs-ficha"><div>${ico('lapiz')} <b>Observaciones</b> <span class="muted">${a.obs && a.obs.n ? `${a.obs.n} anotada${a.obs.n === 1 ? '' : 's'}` : 'ninguna todavía'}</span>
      ${a.obs && a.obs.pend ? `<span class="pill naranja">Hablar con los padres</span>` : ''}</div><div class="inl"><button type="button" class="btn chico" id="aeActa">${ico('file')} Acta de conducta</button>
      <button type="button" class="btn chico" id="aeObs">Ver / anotar</button></div></div>`}
    <div class="g"><div><label>Apellido</label><input name="apellido" value="${esc(a.apellido || '')}"></div><div><label>Nombre</label><input name="nombre" value="${esc(a.nombre || '')}"></div>
    <div><label>DNI</label><input name="dni" inputmode="numeric" value="${esc(a.dni || '')}"></div><div><label>Madre / padre / tutor</label><input name="tutor" value="${esc(a.tutor || '')}"></div>
    <div><label>Teléfono</label><input name="telefono" inputmode="tel" value="${esc(a.telefono || '')}"></div>
    <div class="full"><label>Notas (salud, adecuaciones, etc.)</label><textarea name="notas">${esc(a.notas || '')}</textarea></div></div>
    ${!nuevo && esAdmin() ? `<div style="text-align:right;margin-top:8px"><button class="btn link" type="button" id="aeBorrarDef" style="color:var(--rojo)" title="Cuando el alumno, su madre, padre o tutor pide que se borren sus datos">Borrar definitivamente</button></div>` : ''}`,
    `${nuevo ? '' : (a.activo ? `<button class="btn" id="aeBaja" style="margin-right:auto">Dar de baja (pase / abandono)</button>` : `<button class="btn" id="aeAlta" style="margin-right:auto">Volver a activar</button>`) +
      `<button class="btn rojo" id="aeB">${ico('trash')}</button>`}
     ${a.telefono ? `<button class="btn" id="aeWa">${ico('wa')} WhatsApp</button>` : ''}<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="aeOk">Guardar</button>`, '', 'user');
  if ($('#aeObs', m)) $('#aeObs', m).onclick = () => { m.cerrar(); verObservaciones(a.id, luego); };
  if ($('#aeActa', m)) $('#aeActa', m).onclick = () => { m.cerrar(); abrirActa({ alumno_id: a.id }, luego); };
  $('#aeOk', m).onclick = async () => { const d = leer($('.mb', m)); d.id = a.id; d.curso_id = a.curso_id; try { await api('/api/alumnos', d); m.cerrar(); toast('Guardado'); luego(); } catch (x) { fallo(x); } };
  if ($('#aeWa', m)) $('#aeWa', m).onclick = () => { let t = a.telefono.replace(/\D/g, ''); if (!t.startsWith('54')) t = '549' + t.replace(/^0/, ''); abrirWA('https://wa.me/' + t); };
  if ($('#aeBaja', m)) $('#aeBaja', m).onclick = () => {
    const b = modal('Dar de baja', `<p class="muted">Deja de aparecer en la asistencia y en las notas. Todo lo anterior se conserva.</p><label>Motivo</label>
      <select id="abM"><option>Pase a otra escuela</option><option>Cambio de curso / división</option><option>Abandono</option><option>Otro</option></select>`,
      `<button class="btn" data-cerrar>Cancelar</button><button class="btn rojo" id="abOk">Dar de baja</button>`);
    $('#abOk', b).onclick = async () => { await api(`/api/alumnos/${a.id}/baja`, { motivo: $('#abM', b).value }); b.cerrar(); m.cerrar(); toast('Dado de baja: ya no aparece en la asistencia'); luego(); };
  };
  if ($('#aeBorrarDef', m)) $('#aeBorrarDef', m).onclick = () => Legal.borrar({ url: '/api/alumnos/' + a.id + '/borrar-definitivo',
    nombre: `${a.apellido} ${a.nombre || ''}`, que: 'nombre, DNI, madre/padre o tutor, teléfono, notas, asistencia, calificaciones, observaciones y actas',
    conserva: 'Se borra también su asistencia, sus calificaciones y sus observaciones. Los porcentajes y promedios de los demás alumnos no cambian.', listo: () => { m.cerrar(); toast('Datos borrados definitivamente'); luego(); } });
  if ($('#aeAlta', m)) $('#aeAlta', m).onclick = async () => { await api(`/api/alumnos/${a.id}/baja`, { reactivar: 1 }); m.cerrar(); luego(); };
  if ($('#aeB', m)) $('#aeB', m).onclick = async () => { if (!await confirmar('¿Borrar este alumno? (sólo si lo cargaste por error)', 'Borrar')) return;
    try { await api('/api/alumnos/' + a.id, undefined, 'DELETE'); m.cerrar(); luego(); } catch (x) { fallo(x); } };
}

/* ---------------------------------------------------------------- OBSERVACIONES de cada alumno (conducta, algo bueno, tarea…) */
const TIPOS_OBS = { CONDUCTA: ['⚠️', 'Conducta'], BUENA: ['👍', 'Algo bueno'], TAREA: ['📚', 'Tarea / estudio'], OTRA: ['📝', 'Otra'] };
const obsPill = a => a.obs && a.obs.n ? ` <span class="pill ${a.obs.pend ? 'naranja' : 'gris'}" title="Observaciones">${a.obs.n} obs.${a.obs.pend ? ' · hablar con los padres' : ''}</span>` : '';
const pintarObsBoton = (b, a) => { b.innerHTML = ico('lapiz') + (a.obs && a.obs.n ? `<i>${a.obs.n}</i>` : ''); b.classList.toggle('pend', !!(a.obs && a.obs.pend)); };

function nuevaObservacion(a, luego, o = {}) {
  const nuevo = !o.id;
  let tipo = o.tipo || 'CONDUCTA';
  const m = modal(nuevo ? 'Observación' : 'Cambiar observación', `<div class="muted" style="margin:-4px 0 10px"><b>${esc(a.apellido)}</b> ${esc(a.nombre || '')}</div>
    <div class="obs-tipos" id="obT">${Object.entries(TIPOS_OBS).map(([k, [e, t]]) => `<button type="button" data-t="${k}" class="${k === tipo ? 'act' : ''}"><span>${e}</span>${t}</button>`).join('')}</div>
    <label>¿Qué pasó?</label><textarea id="obX" maxlength="1000" style="min-height:90px" placeholder="Ej. Se portó mal en clase, no trajo la tarea, participó muy bien…">${esc(o.texto || '')}</textarea>
    <div class="g" style="margin-top:8px"><div><label>Fecha</label><input type="date" id="obF" value="${esc(o.fecha || hoy())}" max="${hoy()}"></div>
      <div style="display:flex;align-items:flex-end"><label class="chk obs-padres"><input type="checkbox" id="obP" ${o.padres ? 'checked' : ''}> Hablar con los padres</label></div></div>
    <div class="muted chico" style="margin-top:6px">Si marcás "Hablar con los padres", te queda como pendiente en la pantalla <b>Hoy</b> hasta que toques "Ya hablé".</div>`,
    `${nuevo ? '' : `<button class="btn rojo" id="obB" style="margin-right:auto">${ico('trash')} Borrar</button>`}<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="obOk">${ico('check')} Guardar</button>`, '', 'lapiz');
  setTimeout(() => $('#obX', m).focus(), 60);
  $('#obT', m).onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; tipo = b.dataset.t; $$('#obT button', m).forEach(x => x.classList.toggle('act', x === b)); };
  $('#obOk', m).onclick = async () => {
    try {
      await api('/api/observaciones', { id: o.id, alumno_id: a.id, tipo, texto: $('#obX', m).value, fecha: $('#obF', m).value, padres: $('#obP', m).checked ? 1 : 0 });
      m.cerrar(); toast(nuevo ? 'Observación anotada' + ($('#obP', m).checked ? ': te queda pendiente hablar con los padres' : '') : 'Observación guardada'); luego && luego();
    } catch (x) { fallo(x); }
  };
  if (!nuevo) $('#obB', m).onclick = async () => {
    if (!await confirmar('¿Borrar esta observación?', 'Borrar')) return;
    try { await api('/api/observaciones/' + o.id, undefined, 'DELETE'); m.cerrar(); toast('Observación borrada'); luego && luego(); } catch (x) { fallo(x); }
  };
}

/* "Ya hablé con los padres": con la fecha y, si quiere, qué se habló */
function marcarHablado(o, luego) {
  const m = modal('Ya hablé con los padres', `<div class="muted" style="margin:-4px 0 10px">${esc(o.texto)}</div>
    <div class="g"><div><label>¿Cuándo?</label><input type="date" id="haF" value="${hoy()}" max="${hoy()}"></div></div>
    <label style="margin-top:8px">¿Qué hablaron? (opcional)</label><textarea id="haN" maxlength="500" placeholder="Ej. Habló la mamá, se comprometió a revisar el cuaderno"></textarea>`,
    `<button class="btn" data-cerrar>Cancelar</button><button class="btn verde" id="haOk">${ico('check')} Listo</button>`, '', 'users');
  $('#haOk', m).onclick = async () => {
    try { await api(`/api/observaciones/${o.id}/hablado`, { fecha: $('#haF', m).value, nota: $('#haN', m).value }); m.cerrar(); toast('Anotado: ya hablaste con los padres'); luego && luego(); }
    catch (x) { fallo(x); }
  };
}

async function verObservaciones(aid, luego) {
  const d = await api(`/api/alumnos/${aid}/observaciones`), a = d.alumno, c = d.curso, L = d.observaciones;
  const fila = o => `<div class="obs-item ${o.padres && !o.hablado ? 'pend' : ''}" data-o="${o.id}">
      <div class="obs-cab"><span class="obs-emo">${TIPOS_OBS[o.tipo] ? TIPOS_OBS[o.tipo][0] : '📝'}</span><b>${DIAS_C[diaSemana(o.fecha)]} ${dmy(o.fecha)}</b>
        <span class="muted chico">${TIPOS_OBS[o.tipo] ? TIPOS_OBS[o.tipo][1] : ''}</span>
        ${o.acta_id ? `<button type="button" class="btn chico" data-veracta="${o.acta_id}" style="margin-left:auto">${ico('file')} Ver acta</button>`
          : o.tipo === 'CONDUCTA' ? `<button type="button" class="btn chico" data-acta="${o.id}" style="margin-left:auto">${ico('file')} Hacer acta</button>` : ''}
        <button type="button" class="btn chico" data-ed="${o.id}" ${o.acta_id || o.tipo === 'CONDUCTA' ? '' : 'style="margin-left:auto"'}>${ico('lapiz')}</button></div>
      <div class="obs-txt">${esc(o.texto).replace(/\n/g, '<br>')}</div>
      ${o.padres ? (o.hablado ? `<div class="obs-hab">${ico('check')} Habló con los padres el ${dmy(o.hablado)}${o.hablado_nota ? ': ' + esc(o.hablado_nota) : ''}
          <button type="button" class="btn link chico" data-des="${o.id}">deshacer</button></div>`
        : `<div class="obs-pend">${ico('users')} <b>Hablar con los padres</b><button type="button" class="btn chico verde" data-hab="${o.id}">${ico('check')} Ya hablé</button></div>`) : ''}</div>`;
  const pend = L.filter(o => o.padres && !o.hablado).length;
  const m = modal(`${esc(a.apellido)} ${esc(a.nombre || '')}`, `<div class="muted" style="margin:-4px 0 10px">${esc(nomCurso(c))} · ${esc(c.escuela)}${a.tutor || a.telefono ? ` · ${esc(a.tutor || 'Tutor')}${a.telefono ? ': ' + esc(a.telefono) : ''}` : ''}</div>
    ${d.actas.length ? `<div class="obs-actas"><b>${ico('file')} Actas de conducta</b>${d.actas.map(t => `<div class="obs-acta" data-veracta="${t.id}"><span>${dmy(t.fecha)}${t.hora ? ' ' + esc(t.hora) : ''}</span>
      <span class="muted">${esc(t.situacion.length > 70 ? t.situacion.slice(0, 70) + '…' : t.situacion)}${t.n_alumnos > 1 ? ` · ${t.n_alumnos} alumnos` : ''}</span>${ico('print')}</div>`).join('')}</div>` : ''}
    ${L.length ? `<div class="obs-res">${L.length} observaci${L.length === 1 ? 'ón' : 'ones'}${pend ? ` · <b class="neg">${pend} para hablar con los padres</b>` : ''}</div>${L.map(fila).join('')}`
      : `<div class="vacio-g">${ico('lapiz')}<p>Todavía no anotaste observaciones de este alumno.</p></div>`}`,
    `${L.length ? `<button class="btn" id="voImp" style="margin-right:auto">${ico('print')} Imprimir</button>` : ''}<button class="btn" id="voActa">${ico('file')} Acta de conducta</button>${a.telefono ? `<button class="btn" id="voWa">${ico('wa')} WhatsApp</button>` : ''}
     <button class="btn" data-cerrar>Cerrar</button><button class="btn pri" id="voN">${ico('plus')} Nueva observación</button>`, 'ancho', 'lapiz');
  const otra = () => { m.cerrar(); verObservaciones(aid, luego); };
  m.alCerrar = () => luego && luego();
  $('#voN', m).onclick = () => nuevaObservacion(a, otra);
  $('#voActa', m).onclick = () => abrirActa({ alumno_id: a.id }, otra);
  if ($('#voWa', m)) $('#voWa', m).onclick = () => { let t = a.telefono.replace(/\D/g, ''); if (!t.startsWith('54')) t = '549' + t.replace(/^0/, ''); abrirWA('https://wa.me/' + t); };
  if ($('#voImp', m)) $('#voImp', m).onclick = () => imprimir('Observaciones ' + a.apellido, `<h1>Observaciones · ${esc(a.apellido)} ${esc(a.nombre || '')}</h1>
    <div class="sub">${esc(nomCurso(c))} · ${esc(c.escuela)} · ${c.ciclo}${a.dni ? ' · DNI ' + esc(a.dni) : ''}${a.tutor ? ' · Tutor: ' + esc(a.tutor) : ''}${a.telefono ? ' · Tel. ' + esc(a.telefono) : ''}</div>
    <table><tr><th style="width:80px">Fecha</th><th style="width:110px">Tipo</th><th>Observación</th><th style="width:170px">Padres</th></tr>
    ${L.slice().reverse().map(o => `<tr><td>${dmy(o.fecha)}</td><td>${TIPOS_OBS[o.tipo] ? TIPOS_OBS[o.tipo][1] : ''}</td><td>${esc(o.texto).replace(/\n/g, '<br>')}</td>
      <td>${o.padres ? (o.hablado ? 'Se habló el ' + dmy(o.hablado) + (o.hablado_nota ? ': ' + esc(o.hablado_nota) : '') : '<b>Pendiente</b>') : ''}</td></tr>`).join('')}</table>
    <div style="margin-top:40px;display:flex;justify-content:space-around"><div style="border-top:1px solid #555;padding-top:4px;width:200px;text-align:center">Firma docente</div>
      <div style="border-top:1px solid #555;padding-top:4px;width:200px;text-align:center">Firma madre / padre / tutor</div></div>`);
  $('.mb', m).onclick = e => {
    const x = id => L.find(o => o.id === +id);
    const ed = e.target.closest('[data-ed]'); if (ed) return nuevaObservacion(a, otra, x(ed.dataset.ed));
    const ac = e.target.closest('[data-acta]'); if (ac) return abrirActa({ observacion_id: +ac.dataset.acta }, otra);
    const va = e.target.closest('[data-veracta]'); if (va) return abrirActa({ id: +va.dataset.veracta }, otra);
    const ha = e.target.closest('[data-hab]'); if (ha) return marcarHablado(x(ha.dataset.hab), otra);
    const de = e.target.closest('[data-des]'); if (de) return api(`/api/observaciones/${de.dataset.des}/hablado`, { deshacer: 1 }).then(otra).catch(fallo);
  };
}

/* ---------------------------------------------------------------- ACTA DE CONDUCTA (el modelo de la escuela, completo para imprimir y firmar)
   desde: { alumno_id } · { observacion_id } · { id } (un acta ya guardada) */
async function abrirActa(desde, luego) {
  let t;
  try { t = desde.id ? await api('/api/actas/' + desde.id) : await api('/api/actas/nueva?' + new URLSearchParams(desde)); } catch (x) { return fallo(x); }
  const nueva = !t.id, sel = new Set(t.alumnos);
  const m = modal(nueva ? 'Acta de conducta' : 'Acta de conducta del ' + dmy(t.fecha), `<div class="muted" style="margin:-4px 0 10px">${esc(t.escuela)}</div>
    <label>Encabezado (queda guardado para esta escuela)</label><textarea id="acE" style="min-height:70px">${esc(t.encabezado)}</textarea>
    <div class="g" style="margin-top:8px"><div><label>En el día</label><input type="date" id="acF" value="${esc(t.fecha)}" max="${hoy()}"></div><div><label>Hora</label><input type="time" id="acH" value="${esc(t.hora || '')}"></div>
      <div><label>Espacio curricular</label><input id="acEs" value="${esc(t.espacio)}"></div><div><label>Curso</label><input id="acC" value="${esc(t.curso_txt)}"></div>
      <div class="full"><label>Profesor/a</label><input id="acP" value="${esc(t.profesor)}" placeholder="Tu nombre y apellido"></div></div>
    <label style="margin-top:8px">Alumnos involucrados</label><div class="acta-al" id="acA">${t.lista.filter(x => x.activo || sel.has(x.id)).map(x => `<label class="chk"><input type="checkbox" value="${x.id}" ${sel.has(x.id) ? 'checked' : ''}>
      ${esc(x.apellido)} ${esc(x.nombre || '')}</label>`).join('')}</div>
    <label style="margin-top:8px">Informo por este medio la siguiente situación que ocurrió durante el desarrollo de clases o recreo:</label>
    <textarea id="acS" style="min-height:130px" placeholder="Contá qué pasó">${esc(t.situacion)}</textarea>
    <label style="margin-top:8px">Cierre</label><textarea id="acCi" style="min-height:60px">${esc(t.cierre)}</textarea>`,
    `${nueva ? '' : `<button class="btn rojo" id="acB" style="margin-right:auto">${ico('trash')}</button>`}<button class="btn" data-cerrar>Cancelar</button>
     <button class="btn" id="acOk">${ico('check')} Guardar</button><button class="btn pri" id="acImp">${ico('print')} Guardar e imprimir</button>`, 'ancho', 'file');
  if (!t.profesor) setTimeout(() => $('#acP', m).focus(), 60);
  const datos = () => ({ id: t.id, curso_id: t.curso_id, observacion_id: t.observacion_id, fecha: $('#acF', m).value, hora: $('#acH', m).value, encabezado: $('#acE', m).value,
    espacio: $('#acEs', m).value, curso_txt: $('#acC', m).value, profesor: $('#acP', m).value, situacion: $('#acS', m).value, cierre: $('#acCi', m).value,
    alumnos: $$('#acA input:checked', m).map(i => +i.value) });
  const guardar = async imp => {
    const d = datos();
    try {
      const r = await api('/api/actas', d); t.id = r.id;
      m.cerrar(); toast(nueva ? 'Acta guardada: queda en la ficha de cada alumno' : 'Acta guardada');
      if (imp) imprimirActa(await api('/api/actas/' + r.id));
      luego && luego();
    } catch (x) { fallo(x); }
  };
  $('#acOk', m).onclick = () => guardar(false);
  $('#acImp', m).onclick = () => guardar(true);
  if (!nueva) $('#acB', m).onclick = async () => {
    if (!await confirmar('¿Borrar esta acta? Las observaciones de los alumnos quedan.', 'Borrar')) return;
    try { await api('/api/actas/' + t.id, undefined, 'DELETE'); m.cerrar(); toast('Acta borrada'); luego && luego(); } catch (x) { fallo(x); }
  };
}

function imprimirActa(t) {
  const punt = n => Array(n).fill('<div class="acta-l"></div>').join('');
  const lineas = esc(t.situacion).split(/\n/).map(x => `<div class="acta-l">${x || '&nbsp;'}</div>`).join('');
  const firmas = (titulo) => `<div class="acta-not"><b>${titulo}</b>${t.alumnos_det.map(a => `<div class="acta-f"><span>${esc(a.apellido)} ${esc(a.nombre || '')}${titulo.includes('tutores') && a.tutor ? ' · ' + esc(a.tutor) : ''}</span>
    <span class="acta-fl">Firma</span></div>`).join('')}</div>`;
  imprimir('Acta de conducta ' + dmy(t.fecha), `<style>
    .acta { font-family: Arial, Helvetica, sans-serif; font-size: 13.5px; line-height: 1.9; color: #111; max-width: 680px; margin: 0 auto; }
    .acta h1 { text-align: center; font-size: 17px; margin: 0 0 2px; } .acta .esc { text-align: center; font-size: 12px; color: #555; margin-bottom: 16px; }
    .acta p { text-align: justify; text-indent: 40px; margin: 0 0 10px; } .acta .dato { margin: 2px 0; } .acta .dato b { font-weight: normal; }
    .acta .dato span { border-bottom: 1px dotted #444; padding: 0 6px; min-width: 200px; display: inline-block; font-weight: bold; }
    .acta-l { border-bottom: 1px dotted #444; min-height: 25px; line-height: 25px; padding-left: 4px; }
    .acta-not { margin-top: 22px; } .acta-not b { display: block; margin-bottom: 6px; }
    .acta-f { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; margin: 22px 0 0; } .acta-f span:first-child { flex: 1; }
    .acta-fl { width: 220px; border-top: 1px solid #333; text-align: center; font-size: 11px; padding-top: 2px; }
    .acta-prof { margin: 38px 0 0 auto; width: 260px; border-top: 1px solid #333; text-align: center; font-size: 11px; padding-top: 2px; }
  </style><div class="acta"><h1>ACTA DE CONDUCTA</h1><div class="esc">${esc(t.escuela)}</div>
    <p>${esc(t.encabezado)}</p>
    <div class="dato"><b>En el día</b> <span>${dmy(t.fecha)}</span> <b>hora</b> <span style="min-width:90px">${esc(t.hora || '')}</span></div>
    <div class="dato"><b>Espacio Curricular:</b> <span>${esc(t.espacio)}</span></div>
    <div class="dato"><b>Curso:</b> <span>${esc(t.curso_txt)}</span></div>
    <div class="dato"><b>Profesor/a:</b> <span>${esc(t.profesor)}</span></div>
    <p style="margin-top:14px">Informo por este medio la siguiente situación que ocurrió durante el desarrollo de clases o recreo:</p>
    ${lineas}${punt(Math.max(1, 6 - t.situacion.split(/\n/).length))}
    <p style="margin-top:14px">${esc(t.cierre)}</p>
    ${firmas('Notificación de alumnos involucrados:')}${firmas('Notificación de tutores:')}
    <div class="acta-prof">Firma y aclaración del profesor/a<br>${esc(t.profesor)}</div></div>`);
}

/* ---------------------------------------------------------------- NOTAS */
const notaNum = v => { const x = parseFloat(String(v || '').replace(',', '.')); return isNaN(x) ? null : x; };
const fmtNota = v => v === null || v === undefined ? '' : (Math.round(v * 100) / 100).toLocaleString('es-AR');
async function tabNotas(el, c) {
  const d = await api(`/api/cursos/${c.id}/notas`);
  const NP = d.periodos, nomP = NP === 2 ? 'Cuatrimestre' : 'Trimestre', ap = d.aprobacion;
  const evs = p => d.evaluaciones.filter(e => e.periodo === p);
  const clsN = v => { const x = notaNum(v); return x === null ? '' : x < ap ? 'mal' : 'bien'; };
  const calcular = a => {   // misma cuenta que el servidor, para ver el promedio al instante
    const fin = [];
    for (let p = 1; p <= NP; p++) {
      const vals = evs(p).map(e => [notaNum(a.notas[e.id]), e.peso || 1]).filter(([v]) => v !== null);
      a.promedios[p] = vals.length ? Math.round(vals.reduce((s, [v, w]) => s + v * w, 0) / vals.reduce((s, [, w]) => s + w, 0) * 100) / 100 : null;
      const ci = notaNum(a.cierres[p]);
      if (ci !== null || a.promedios[p] !== null) fin.push(ci !== null ? ci : a.promedios[p]);
    }
    a.promedio_anual = fin.length ? Math.round(fin.reduce((s, x) => s + x, 0) / fin.length * 100) / 100 : null;
    const f = notaNum(a.cierres[9]); a.final = f !== null ? f : a.promedio_anual;
  };
  const pintar = () => {
    el.innerHTML = `<div class="card"><div class="inl" style="justify-content:space-between;margin-bottom:8px"><h3 style="margin:0">${ico('notas')} Notas</h3>
      <div class="inl"><button class="btn" id="noCsv">${ico('bajar')} Excel</button><button class="btn" id="noImp">${ico('print')} Imprimir</button><button class="btn pri" id="noN">${ico('plus')} Nueva evaluación</button></div></div>
      ${d.evaluaciones.length || d.alumnos.length ? `<div class="tabla-x notas-w"><table class="t notas-t"><thead>
        <tr><th rowspan="2" class="fija">Alumno</th>${[...Array(NP)].map((_, i) => `<th colspan="${evs(i + 1).length + 2}" class="per">${i + 1}° ${nomP}</th>`).join('')}<th colspan="2" class="per">Año</th></tr>
        <tr>${[...Array(NP)].map((_, i) => evs(i + 1).map(e => `<th class="ev-h" data-ev="${e.id}" title="${esc(e.tipo)}${e.fecha ? ' · ' + dmy(e.fecha) : ''}${e.peso !== 1 ? ' · peso ' + num(e.peso) : ''}">${esc(e.titulo)}${e.fecha ? `<small>${dm(e.fecha)}</small>` : ''}</th>`).join('') +
          `<th class="prom">Prom.</th><th class="prom">Nota</th>`).join('')}<th class="prom">Prom.</th><th class="prom">Final</th></tr></thead><tbody>
        ${d.alumnos.map(a => `<tr data-a="${a.id}" class="${a.activo ? '' : 'anulado'}"><td class="fija"><b>${esc(a.apellido)}</b> ${esc(a.nombre)}</td>
          ${[...Array(NP)].map((_, i) => { const p = i + 1; return evs(p).map(e => `<td class="nc"><input class="ni ${clsN(a.notas[e.id])}" data-e="${e.id}" value="${esc(a.notas[e.id] || '')}" inputmode="decimal"></td>`).join('') +
            `<td class="r prom ${clsN(a.promedios[p])}" data-pp="${p}">${fmtNota(a.promedios[p])}</td><td class="nc"><input class="ni cierre ${clsN(a.cierres[p])}" data-c="${p}" value="${esc(a.cierres[p] || '')}" placeholder="${fmtNota(a.promedios[p])}"></td>`; }).join('')}
          <td class="r prom" data-pa="1">${fmtNota(a.promedio_anual)}</td><td class="nc"><input class="ni cierre ${clsN(a.final)}" data-c="9" value="${esc(a.cierres[9] || '')}" placeholder="${fmtNota(a.promedio_anual)}"></td></tr>`).join('')}
      </tbody></table></div>
      <div class="muted chico" style="margin-top:8px">Escribí la nota y pasá a la siguiente (Enter o Tab): se guarda sola. <b>A</b> = ausente (no cuenta en el promedio). También podés poner conceptos (MB, B, R).
        La columna <b>Nota</b> es la definitiva del ${nomP.toLowerCase()} si no es el promedio exacto; si la dejás vacía, vale el promedio. Aprobación: ${num(ap)}. Tocá el nombre de una evaluación para modificarla.</div>`
      : `<div class="vacio-g">${ico('notas')}<p>Creá la primera evaluación (prueba, trabajo práctico, oral…).</p></div>`}</div>`;
    $('#noN', el).onclick = () => editarEvaluacion({ curso_id: c.id }, NP, () => tabNotas(el, c));
    $$('.ev-h', el).forEach(h => h.onclick = () => editarEvaluacion(d.evaluaciones.find(e => e.id === +h.dataset.ev), NP, () => tabNotas(el, c)));
    $$('.ni', el).forEach(inp => {
      inp.onchange = async () => {
        const tr = inp.closest('[data-a]'), a = d.alumnos.find(x => x.id === +tr.dataset.a);
        try {
          if (inp.dataset.e) { await api('/api/notas', { evaluacion_id: +inp.dataset.e, alumno_id: a.id, valor: inp.value }); a.notas[inp.dataset.e] = inp.value.trim().toUpperCase(); }
          else { await api('/api/cierres', { alumno_id: a.id, periodo: +inp.dataset.c, nota: inp.value }); a.cierres[inp.dataset.c] = inp.value.trim(); }
          inp.classList.remove('mal', 'bien', 'err'); const k = clsN(inp.value); if (k) inp.classList.add(k);
          calcular(a);
          for (let p = 1; p <= NP; p++) { const td = $(`[data-pp="${p}"]`, tr); td.textContent = fmtNota(a.promedios[p]); td.className = 'r prom ' + clsN(a.promedios[p]); $(`[data-c="${p}"]`, tr).placeholder = fmtNota(a.promedios[p]); }
          $('[data-pa]', tr).textContent = fmtNota(a.promedio_anual); $('[data-c="9"]', tr).placeholder = fmtNota(a.promedio_anual);
        } catch (x) { inp.classList.add('err'); fallo(x); }
      };
      inp.onkeydown = e => { if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault();   // baja (o sube) al siguiente alumno, misma columna
        const tr = inp.closest('tr'), col = [...tr.querySelectorAll('.ni')].indexOf(inp), sig = e.key === 'ArrowUp' ? tr.previousElementSibling : tr.nextElementSibling;
        if (sig) { const x = sig.querySelectorAll('.ni')[col]; if (x) { x.focus(); x.select(); } } } };
      inp.onfocus = () => inp.select();
    });
    const filasExport = () => d.alumnos.filter(a => a.activo).map(a => [`${a.apellido} ${a.nombre}`, ...[...Array(NP)].flatMap((_, i) => [...evs(i + 1).map(e => a.notas[e.id] || ''),
      fmtNota(a.promedios[i + 1]), a.cierres[i + 1] || '']), fmtNota(a.promedio_anual), a.cierres[9] || fmtNota(a.final)]);
    const titulos = ['Alumno', ...[...Array(NP)].flatMap((_, i) => [...evs(i + 1).map(e => e.titulo), `Promedio ${i + 1}°`, `Nota ${i + 1}°`]), 'Promedio anual', 'Final'];
    $('#noCsv', el).onclick = () => bajarCSV('notas_' + nomCurso(c).replace(/\W+/g, '_'), titulos, filasExport());
    $('#noImp', el).onclick = () => imprimir('Notas ' + nomCurso(c), `<h1>Notas · ${esc(nomCurso(c))}</h1><div class="sub">${esc(c.escuela)} · ${c.ciclo} · ${esc(CFG().nombre_consultorio || '')}</div>
      <table><tr>${titulos.map(t => `<th class="c">${esc(t)}</th>`).join('')}</tr>${filasExport().map(f => `<tr>${f.map((v, i) => `<td class="${i ? 'c' : ''} ${i && notaNum(v) !== null && notaNum(v) < ap ? 'mal' : ''}">${esc(v)}</td>`).join('')}</tr>`).join('')}</table>`, true);
  };
  pintar();
}

function editarEvaluacion(e, NP, luego) {
  const nuevo = !e.id;
  const m = modal(nuevo ? 'Nueva evaluación' : 'Evaluación', `<div class="g">
    <div class="full"><label>Nombre</label><input name="titulo" value="${esc(e.titulo || '')}" placeholder="Ej. Prueba 1 · TP Fracciones · Oral"></div>
    <div><label>Tipo</label><select name="tipo">${['Prueba', 'Trabajo práctico', 'Oral', 'Concepto', 'Carpeta', 'Recuperatorio', 'Otro'].map(t => `<option ${t === (e.tipo || 'Prueba') ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div><label>Fecha</label><input type="date" name="fecha" value="${esc(e.fecha || '')}"></div>
    <div><label>${NP === 2 ? 'Cuatrimestre' : 'Trimestre'}</label><select name="periodo"><option value="">Según la fecha</option>${[...Array(NP)].map((_, i) => `<option value="${i + 1}" ${e.periodo === i + 1 ? 'selected' : ''}>${i + 1}°</option>`).join('')}</select></div>
    <div><label>Peso en el promedio</label><input name="peso" inputmode="decimal" value="${esc(fmtIn(e.peso || 1))}"><div class="ayuda">1 = normal · 2 = vale el doble</div></div>
    ${nuevo ? `<div class="full"><label class="chk"><input type="checkbox" name="agendar" checked> Anotarla en la agenda</label></div>` : ''}</div>`,
    `${nuevo ? '' : `<button class="btn rojo" id="evB" style="margin-right:auto">${ico('trash')} Borrar</button>`}<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="evOk">Guardar</button>`, '', 'notas');
  $('#evOk', m).onclick = async () => { const d = leer($('.mb', m)); d.id = e.id; d.curso_id = e.curso_id; try { await api('/api/evaluaciones', d); m.cerrar(); luego(); } catch (x) { fallo(x); } };
  if (!nuevo) $('#evB', m).onclick = async () => { if (!await confirmar('¿Borrar esta evaluación y todas sus notas?', 'Borrar')) return; await api('/api/evaluaciones/' + e.id, undefined, 'DELETE'); m.cerrar(); luego(); };
}

/* ---------------------------------------------------------------- LIBRO DE TEMAS */
async function tabTemas(el, c) {
  const d = await api(`/api/cursos/${c.id}/temas`);
  el.innerHTML = `<div class="card"><div class="inl" style="justify-content:space-between;margin-bottom:8px"><h3 style="margin:0">${ico('libro')} Libro de temas · ${d.clases.filter(k => k.hubo).length} clases</h3>
    <button class="btn" id="ltImp">${ico('print')} Imprimir</button></div>
    ${d.clases.length ? `<div class="tabla-x"><table class="t"><thead><tr><th>Fecha</th><th>Tema</th><th class="ocultar-movil">Actividades</th><th class="ocultar-movil">Tarea</th><th class="r">Ausentes</th></tr></thead><tbody>
    ${d.clases.slice().reverse().map(k => `<tr data-f="${k.fecha}" style="cursor:pointer"><td style="white-space:nowrap"><b>${DIAS_C[diaSemana(k.fecha)]} ${dmy(k.fecha)}</b></td>
      <td>${k.hubo ? esc(k.tema) || '<span class="muted">—</span>' : `<span class="pill gris">No hubo clase</span> ${esc(k.motivo)}`}</td>
      <td class="ocultar-movil">${esc(k.actividades)}</td><td class="ocultar-movil">${esc(k.tarea)}</td><td class="r">${k.hubo ? `${k.ausentes} / ${k.total}` : ''}</td></tr>`).join('')}</tbody></table></div>`
    : `<div class="vacio-g">${ico('libro')}<p>Cuando tomás asistencia, anotás el tema de la clase y aparece acá.</p></div>`}</div>`;
  el.onclick = e => { const r = e.target.closest('[data-f]'); if (r) { CURSO_FECHA = r.dataset.f; CURSO_TAB = 'asistencia'; $('#cvT [data-t=asistencia]').click(); } };
  $('#ltImp', el).onclick = () => imprimir('Libro de temas ' + nomCurso(c), `<h1>Libro de temas · ${esc(nomCurso(c))}</h1><div class="sub">${esc(c.escuela)} · ${c.ciclo} · ${esc(CFG().nombre_consultorio || '')}</div>
    <table><tr><th style="width:80px">Fecha</th><th>Tema / contenido</th><th>Actividades</th><th>Tarea</th><th class="c" style="width:60px">Ausentes</th></tr>
    ${d.clases.map(k => `<tr><td>${dmy(k.fecha)}</td><td>${k.hubo ? esc(k.tema) : 'No hubo clase: ' + esc(k.motivo)}</td><td>${esc(k.actividades)}</td><td>${esc(k.tarea)}</td><td class="c">${k.hubo ? k.ausentes : ''}</td></tr>`).join('')}</table>`);
}

/* ---------------------------------------------------------------- PLANILLA mensual de asistencia */
async function tabPlanilla(el, c) {
  PLAN_MES = PLAN_MES || hoy().slice(0, 7);
  const d = await api(`/api/cursos/${c.id}/planilla?mes=${PLAN_MES}`);
  const dict = d.clases.filter(k => k.hubo);
  const mover = n => { const x = new Date(PLAN_MES + '-01T12:00:00'); x.setMonth(x.getMonth() + n); PLAN_MES = isoLocal(x).slice(0, 7); tabPlanilla(el, c); };
  const fila = (a, i, html) => `<tr class="${a.activo ? '' : 'anulado'}"><td class="${html ? 'fija' : ''}">${i + 1}</td><td class="${html ? 'fija2' : ''}"><b>${esc(a.apellido)}</b> ${esc(a.nombre)}</td>
    ${dict.map(k => { const e = a.marcas[k.id] || ''; return `<td class="c ${e !== 'P' ? e : ''}">${e === 'P' ? (html ? '<span class="pto-p">·</span>' : 'P') : e}</td>`; }).join('')}
    <td class="r">${a.periodo ? num(a.periodo.inasistencias) : ''}</td><td class="r">${a.anio ? num(a.anio.inasistencias) : ''}</td>
    <td class="r ${a.anio && a.anio.libre ? 'mal neg' : ''}">${a.anio ? num(a.anio.porcentaje) + '%' : ''}</td></tr>`;
  const tabla = html => `<table class="${html ? 't plan-t' : ''}"><thead><tr><th>#</th><th>Alumno</th>${dict.map(k => `<th class="c">${+k.fecha.slice(8)}<small>${DIAS_C[diaSemana(k.fecha)][0]}</small></th>`).join('')}
    <th class="r">Inas. mes</th><th class="r">Inas. año</th><th class="r">% año</th></tr></thead><tbody>${d.alumnos.map((a, i) => fila(a, i, html)).join('')}</tbody></table>`;
  el.innerHTML = `<div class="card"><div class="cal-nav"><button class="ab" id="plA">${ico('izq')}</button><h2>${nombreMes(PLAN_MES)}</h2><button class="ab" id="plS">${ico('der')}</button>
    <span class="sp"></span><button class="btn" id="plCsv">${ico('bajar')} Excel</button><button class="btn" id="plImp">${ico('print')} Imprimir</button></div>
    ${dict.length ? `<div class="tabla-x">${tabla(true)}</div>` : `<div class="muted" style="padding:14px">No hay clases con asistencia en ${nombreMes(PLAN_MES).toLowerCase()}.</div>`}
    ${d.clases.filter(k => !k.hubo).length ? `<div class="muted chico" style="margin-top:6px">Sin clase: ${d.clases.filter(k => !k.hubo).map(k => `${dm(k.fecha)} (${esc(k.motivo)})`).join(' · ')}</div>` : ''}
    <div class="muted chico" style="margin-top:6px">A ausente · J justificado · T tarde · R se retiró · Una tarde o un retiro valen ${num(d.valor_tarde)} inasistencia (se cambia en Configuración). Mínimo de asistencia: ${num(d.minimo)}%.</div></div>`;
  $('#plA', el).onclick = () => mover(-1); $('#plS', el).onclick = () => mover(1);
  $('#plImp', el).onclick = () => imprimir('Asistencia ' + nomCurso(c), `<h1>Asistencia · ${esc(nomCurso(c))} · ${nombreMes(PLAN_MES)}</h1>
    <div class="sub">${esc(c.escuela)} · ${c.ciclo} · ${esc(CFG().nombre_consultorio || '')}</div>${tabla(false)}`, true);
  $('#plCsv', el).onclick = () => bajarCSV('asistencia_' + PLAN_MES + '_' + nomCurso(c).replace(/\W+/g, '_'), ['Alumno', ...dict.map(k => dmy(k.fecha)), 'Inasistencias mes', 'Inasistencias año', '% asistencia año'],
    d.alumnos.map(a => [`${a.apellido} ${a.nombre}`, ...dict.map(k => a.marcas[k.id] || ''), a.periodo ? a.periodo.inasistencias : '', a.anio ? a.anio.inasistencias : '', a.anio ? a.anio.porcentaje : '']));
}
