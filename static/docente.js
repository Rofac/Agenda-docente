/* ================================================================ AGENDA DOCENTE: hoy, horario, agenda, escuelas, feriados y licencias */
const TIPOS_EV = { REUNION: 'Reunión', ACTO: 'Acto', ENTREGA: 'Entrega / plazo', EXAMEN: 'Evaluación / mesa', CAPACITACION: 'Capacitación', PERSONAL: 'Personal', OTRO: 'Otro' };
const SITUACION = { TITULAR: 'Titular', INTERINO: 'Interino', SUPLENTE: 'Suplente', '': '' };
const EST_LIC = { SOLICITADA: ['Solicitada', 'PENDIENTE'], OTORGADA: ['Otorgada', 'ATENDIDO'], RECHAZADA: ['Rechazada', 'rojo'] };
const TIPO_DIA = { FERIADO: 'Feriado', NO_LABORABLE: 'Día no laborable', PUENTE: 'Día no laborable (turístico)', SIN_CLASES: 'Sin clases' };
const COLORES = ['#3b82f6', '#16a34a', '#e11d48', '#f59e0b', '#8b5cf6', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#475569'];
let ESC = [];              // escuelas con cargos y cursos (se recargan al entrar a cada pantalla)
async function cargarEscuelas() { ESC = await api('/api/escuelas'); return ESC; }
const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const aMin = s => { const [h, m] = (s || '0:0').split(':').map(Number); return h * 60 + m; };
const anioActual = () => +hoy().slice(0, 4);
const primerNombre = () => { const n = (CFG().nombre_consultorio || ME.nombre || '').trim().split(/\s+/); const x = n.length > 1 && n[0] === n[0].toUpperCase() && n[0].length > 2 ? n[1] : n[0];
  return x ? x.charAt(0).toUpperCase() + x.slice(1).toLowerCase() : ''; };
const nomCurso = c => { const t = `${c.anio || ''} ${c.division || ''}`.trim(); return (t + (t && c.materia ? ' · ' : '') + (c.materia || '')) || 'Curso'; };
const puntoColor = c => `<span class="pto" style="background:${esc(c || '#888')}"></span>`;
const opcEscuelas = (sel, vacio) => (vacio !== undefined ? `<option value="">${esc(vacio)}</option>` : '') +
  ESC.map(e => `<option value="${e.id}" ${String(e.id) === String(sel) ? 'selected' : ''}>${esc(e.nombre)}${e.numero ? ' N° ' + esc(e.numero) : ''}</option>`).join('');
const opcCursos = (escuelaId, sel, vacio = 'Sin curso (otra tarea)') => `<option value="">${esc(vacio)}</option>` +
  ESC.filter(e => !escuelaId || String(e.id) === String(escuelaId)).flatMap(e => e.cursos.filter(c => c.activo).map(c =>
    `<option value="${c.id}" ${String(c.id) === String(sel) ? 'selected' : ''}>${esc(nomCurso(c))}${escuelaId ? '' : ' (' + esc(e.nombre) + ')'}</option>`)).join('');
const opcCargos = (escuelaId, sel, vacio = 'Todos / no importa') => `<option value="">${esc(vacio)}</option>` +
  ESC.filter(e => String(e.id) === String(escuelaId)).flatMap(e => e.cargos.filter(c => c.activo).map(c =>
    `<option value="${c.id}" ${String(c.id) === String(sel) ? 'selected' : ''}>${esc(c.descripcion)}</option>`)).join('');
const opcAnios = sel => { const a = anioActual(); return [a - 2, a - 1, a, a + 1].map(x => `<option ${x === +sel ? 'selected' : ''}>${x}</option>`).join(''); };

/* imprimir(): en el celular la vista de impresión está en js/movil.js (se muestra adentro de la app) */

/* ================================================================ HOY */
async function tomarAsistenciaAhora() {
  const d = await api('/api/dia?fecha=' + hoy());
  const ahoraM = new Date().getHours() * 60 + new Date().getMinutes();
  const cl = d.clases.filter(c => c.curso_id && !c.sin_clases && !c.licencia);
  if (!cl.length) { toast('Hoy no tenés clases con curso en el horario. Elegí el curso.'); return ir('cursos'); }
  const actual = cl.find(c => aMin(c.desde) - 20 <= ahoraM && ahoraM <= aMin(c.hasta)) || cl.find(c => aMin(c.desde) > ahoraM) || cl[cl.length - 1];
  if (cl.length === 1 || actual) { CURSO_TAB = 'asistencia'; CURSO_FECHA = hoy(); return ir('curso', actual.curso_id); }
}

function filaClase(h, conBoton = true) {
  const estado = h.sin_clases ? `<span class="pill gris">${esc(h.sin_clases)}</span>` : h.licencia ? `<span class="pill naranja">De licencia</span>` : '';
  return `<div class="hc ${h.sin_clases || h.licencia ? 'off' : ''}" style="--cc:${esc(h.color)}">
    <div class="hc-h">${esc(h.desde)}<small>${esc(h.hasta)}</small></div>
    <div class="hc-d"><b>${esc(h.curso || h.detalle || h.cargo || 'Clase')}</b><div class="muted chico">${esc(h.escuela)}${h.aula ? ' · ' + esc(h.aula) : ''}${h.curso && h.detalle ? ' · ' + esc(h.detalle) : ''}</div></div>
    <div class="hc-b">${estado}${conBoton && h.curso_id && !h.sin_clases && !h.licencia ? `<button class="btn chico ${h.clase_id ? '' : 'verde'}" data-asis="${h.curso_id}" data-f="">${ico(h.clase_id ? 'check' : 'asis')} ${h.clase_id ? 'Asistencia tomada' : 'Tomar asistencia'}</button>` : ''}</div></div>`;
}
const filaEvento = (e, conFecha = false) => `<div class="ev ${e.hecho ? 'hecho' : ''}" data-ev="${e.id}"><span class="pto" style="background:${esc(e.color || 'var(--pri)')}"></span>
  <div style="flex:1"><b>${conFecha ? `${DIAS_C[diaSemana(e.fecha)]} ${dm(e.fecha)} · ` : ''}${e.hora ? esc(e.hora) + ' · ' : ''}${esc(e.titulo)}</b>
  <div class="muted chico">${TIPOS_EV[e.tipo] || ''}${e.escuela ? ' · ' + esc(e.escuela) : ''}${e.notas ? ' · ' + esc(e.notas) : ''}</div></div></div>`;

P.principal = async (main) => {
  const [d] = await Promise.all([api('/api/inicio'), cargarEscuelas()]);
  const hora = new Date().getHours();
  const saludo = hora < 13 ? 'Buen día' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';
  const n = primerNombre();
  const bloqueDia = (x, titulo) => {
    const esp = x.especiales.filter(e => e.tipo !== 'SIN_CLASES');
    return `<div class="card"><h3>${ico('hoy')} ${titulo} <span class="muted" style="font-weight:400">· ${fechaLarga(x.fecha)}</span></h3>
      ${esp.map(e => `<div class="aviso-dia">${ico('bandera')} <b>${esc(e.nombre)}</b> <span class="muted">(${TIPO_DIA[e.tipo]})</span></div>`).join('')}
      ${x.licencias.map(l => `<div class="aviso-dia nar">${ico('maletin')} De licencia: <b>${esc((l.codigo ? l.codigo + ' ' : '') + (l.articulo || ''))}</b>${l.escuela ? ' en ' + esc(l.escuela) : ''}</div>`).join('')}
      ${x.clases.length ? x.clases.map(h => filaClase(h, titulo === 'Hoy')).join('') : `<div class="muted" style="padding:8px 0">No tenés clases en el horario.</div>`}
      ${x.eventos.length ? `<div class="sep-t">Agenda</div>${x.eventos.map(e => filaEvento(e)).join('')}` : ''}</div>`;
  };
  main.innerHTML = cabecera('home', `${saludo}${n ? ', ' + n : ''}`, fechaLarga(hoy()) + ' de ' + hoy().slice(0, 4),
    `<button class="btn pri" id="hEv">${ico('plus')} Anotar en la agenda</button>`) +
    (!d.tiene_escuelas || !d.tiene_horario ? `<div class="card bienvenida"><h3>${ico('birrete')} Para empezar (5 minutos)</h3><ol>
      <li class="${CFG().nombre_consultorio ? 'ok' : ''}"><a data-ir="config">Configuración</a>: tu nombre y apellido y las fechas del ciclo lectivo.</li>
      <li class="${d.tiene_escuelas ? 'ok' : ''}"><a data-ir="escuelas">Escuelas y cargos</a>: cada escuela donde trabajás, con tus cargos u horas.</li>
      <li><a data-ir="cursos">Cursos</a>: cada curso y división, y pegás la lista de alumnos.</li>
      <li class="${d.tiene_horario ? 'ok' : ''}"><a data-ir="semana">Mi horario</a>: qué día y a qué hora estás en cada escuela.</li></ol></div>` : '') +
    `<div class="cols2"><div>${bloqueDia(d.hoy, 'Hoy')}${bloqueDia(d.manana, 'Mañana')}</div><div>
      ${d.proximo_feriado ? `<div class="card fer-prox">${ico('bandera')} <div><small>Próximo feriado${d.proximo_feriado.dias === 1 ? ': mañana' : ` en ${d.proximo_feriado.dias} días`}</small>
        <b>${fechaLarga(d.proximo_feriado.fecha)}</b><div class="muted chico">${esc(d.proximo_feriado.nombre)}</div></div></div>` : ''}
      <div class="card"><h3>${ico('cal')} Próximas tres semanas</h3>${d.proximos.length ? d.proximos.map(e => filaEvento(e, true)).join('') : '<div class="muted">Nada anotado.</div>'}</div>
      ${d.riesgo.length ? `<div class="card"><h3>${ico('alerta')} Alumnos con muchas inasistencias</h3><table class="t comp"><tbody>${d.riesgo.map(r => `<tr data-curso="${r.curso_id}" style="cursor:pointer">
        <td><b>${esc(r.alumno)}</b><div class="muted chico">${esc(r.curso)} · ${esc(r.escuela)}</div></td><td class="r"><span class="pill ${r.libre ? 'rojo' : 'naranja'}">${num(r.porcentaje)}%</span>
        <div class="muted chico">${num(r.inasistencias)} faltas</div></td></tr>`).join('')}</tbody></table></div>` : ''}
      ${d.sin_certificado.length ? `<div class="card"><h3>${ico('file')} Licencias sin presentar el certificado</h3>${d.sin_certificado.map(l => `<div class="ev" data-ir="licencias">
        <span class="pto" style="background:var(--naranja)"></span><div><b>${esc(l.codigo || '')} ${esc(l.descripcion)}</b><div class="muted chico">${dmy(l.desde)}${l.hasta !== l.desde ? ' al ' + dmy(l.hasta) : ''}</div></div></div>`).join('')}</div>` : ''}
    </div></div>`;
  $('#hEv').onclick = () => editarEvento({ fecha: hoy() }, () => ir('principal'));
  main.onclick = e => {
    const a = e.target.closest('[data-asis]'); if (a) { CURSO_TAB = 'asistencia'; CURSO_FECHA = hoy(); return ir('curso', a.dataset.asis); }
    const k = e.target.closest('[data-ir]'); if (k) return ir(k.dataset.ir);
    const c = e.target.closest('[data-curso]'); if (c) { CURSO_TAB = 'alumnos'; return ir('curso', c.dataset.curso); }
    const v = e.target.closest('[data-ev]'); if (v) verEvento(+v.dataset.ev, () => ir('principal'));
  };
};

/* ================================================================ MI HORARIO */
P.semana = async (main) => {
  await cargarEscuelas();
  const hs = await api('/api/horarios');
  const dias = hs.some(h => h.dia === 6) ? 7 : hs.some(h => h.dia === 5) ? 6 : 5;
  const ini = hs.length ? Math.floor(Math.min(...hs.map(h => aMin(h.desde))) / 60) * 60 : 7 * 60;
  const fin = hs.length ? Math.ceil(Math.max(...hs.map(h => aMin(h.hasta))) / 60) * 60 : 13 * 60;
  const K = 1.15;    // px por minuto
  const horas = []; for (let m = ini; m <= fin; m += 60) horas.push(m);
  const totalHoras = hs.reduce((a, h) => a + (aMin(h.hasta) - aMin(h.desde)), 0) / 60;
  main.innerHTML = cabecera('semana', 'Mi horario', hs.length ? `${num(totalHoras)} horas reloj por semana` : 'Cargá tus horarios de cada escuela',
    `<button class="btn" id="smImp">${ico('print')} Imprimir</button><button class="btn pri" id="smN">${ico('plus')} Agregar horario</button>`) +
    (!ESC.length ? `<div class="aviso">${ico('info')} Primero cargá tus escuelas en <a data-ir="escuelas">Escuelas y cargos</a>.</div>` : '') +
    `<div class="card semana-card"><div class="sem" style="--dias:${dias}">
      <div class="sem-h"></div>${DIAS.slice(0, dias).map((d, i) => `<div class="sem-h ${i === diaSemana(hoy()) ? 'hoy' : ''}">${d}</div>`).join('')}
      <div class="sem-horas" style="height:${(fin - ini) * K}px">${horas.map(m => `<span style="top:${(m - ini) * K}px">${hhmm(m)}</span>`).join('')}</div>
      ${DIAS.slice(0, dias).map((_, i) => `<div class="sem-col" style="height:${(fin - ini) * K}px">${horas.map(m => `<i style="top:${(m - ini) * K}px"></i>`).join('')}
        ${hs.filter(h => h.dia === i).map(h => `<div class="sem-b" data-h="${h.id}" style="top:${(aMin(h.desde) - ini) * K}px;height:${Math.max(24, (aMin(h.hasta) - aMin(h.desde)) * K - 2)}px;--cc:${esc(h.color)}">
          <b>${esc(h.curso || h.detalle || h.cargo || h.escuela)}</b><small>${esc(h.desde)} a ${esc(h.hasta)} · ${esc(h.escuela)}${h.aula ? ' · ' + esc(h.aula) : ''}</small></div>`).join('')}</div>`).join('')}
    </div></div>
    <div class="sem-lista">${DIAS.slice(0, dias).map((d, i) => `<div class="card"><h3>${d}</h3>${hs.filter(h => h.dia === i).map(h => `<div class="hc" data-h="${h.id}" style="--cc:${esc(h.color)}">
      <div class="hc-h">${esc(h.desde)}<small>${esc(h.hasta)}</small></div><div class="hc-d"><b>${esc(h.curso || h.detalle || h.cargo || 'Clase')}</b><div class="muted chico">${esc(h.escuela)}${h.aula ? ' · ' + esc(h.aula) : ''}</div></div></div>`).join('') || '<div class="muted">Libre</div>'}</div>`).join('')}</div>
    <div class="leyenda">${ESC.map(e => `<span>${puntoColor(e.color)} ${esc(e.nombre)}</span>`).join('')}</div>`;
  $('#smN').onclick = () => editarHorario({});
  main.onclick = e => {
    const b = e.target.closest('[data-h]'); if (b) editarHorario(hs.find(h => h.id === +b.dataset.h));
    const k = e.target.closest('[data-ir]'); if (k) ir(k.dataset.ir);
  };
  $('#smImp').onclick = () => {
    const filas = [...new Set(hs.map(h => h.desde + '-' + h.hasta))].sort();
    imprimir('Horario', `<h1>Mi horario</h1><div class="sub">${esc(CFG().nombre_consultorio || '')} · ${num(totalHoras)} horas reloj por semana</div>
      <table><tr><th style="width:90px">Hora</th>${DIAS.slice(0, dias).map(d => `<th>${d}</th>`).join('')}</tr>
      ${filas.map(f => `<tr><td><b>${f.replace('-', ' a ')}</b></td>${DIAS.slice(0, dias).map((_, i) => `<td>${hs.filter(h => h.dia === i && h.desde + '-' + h.hasta === f).map(h =>
        `<b>${esc(h.curso || h.detalle || h.cargo || '')}</b><div class="chico">${esc(h.escuela)}${h.aula ? ' · ' + esc(h.aula) : ''}</div>`).join('')}</td>`).join('')}</tr>`).join('')}</table>`, true);
  };
};

function editarHorario(h) {
  if (!ESC.length) { toast('Primero cargá una escuela'); return ir('escuelas'); }
  const nuevo = !h.id;
  const m = modal(nuevo ? 'Agregar horario' : 'Modificar horario', `<div class="g">
    <div><label>Escuela</label><select name="escuela_id" id="hoE">${opcEscuelas(h.escuela_id || (ESC.length === 1 ? ESC[0].id : ''), ESC.length > 1 ? 'Elegí la escuela' : undefined)}</select></div>
    <div><label>Curso (para tomar asistencia)</label><select name="curso_id" id="hoC"></select></div>
    <div class="full"><label>${nuevo ? 'Días (podés marcar varios)' : 'Día'}</label><div class="dias-chk">${DIAS.slice(0, 6).map((d, i) => `<label class="chk"><input type="${nuevo ? 'checkbox' : 'radio'}" name="dsel" value="${i}" ${h.dia === i ? 'checked' : ''}> ${d}</label>`).join('')}</div></div>
    <div><label>Entrada</label><input name="desde" type="time" value="${esc(h.desde || '')}"></div><div><label>Salida</label><input name="hasta" type="time" value="${esc(h.hasta || '')}"></div>
    <div><label>Detalle (opcional)</label><input name="detalle" value="${esc(h.detalle || '')}" placeholder="Ej. Hora institucional, Taller"></div>
    <div><label>Aula (opcional)</label><input name="aula" value="${esc(h.aula || '')}"></div></div>`,
    `${nuevo ? '' : `<button class="btn rojo" id="hoB" style="margin-right:auto">${ico('trash')} Borrar</button>`}<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="hoOk">Guardar</button>`, '', 'semana');
  const pintarCursos = () => $('#hoC', m).innerHTML = opcCursos($('#hoE', m).value, h.curso_id);
  $('#hoE', m).onchange = pintarCursos; pintarCursos();
  $('#hoOk', m).onclick = async () => {
    const d = leer($('.mb', m)); d.id = h.id; d.dias = $$('[name=dsel]:checked', m).map(x => +x.value);
    try { const r = await api('/api/horarios', d); m.cerrar(); (r.avisos || []).forEach(a => toast(a, 'err')); toast('Horario guardado'); recargar(); } catch (e) { fallo(e); }
  };
  if (!nuevo) $('#hoB', m).onclick = async () => { if (!await confirmar('¿Borrar este horario?', 'Borrar')) return; await api('/api/horarios/' + h.id, undefined, 'DELETE'); m.cerrar(); recargar(); };
}

/* ================================================================ AGENDA */
let AG_MES = '';
P.agenda = async (main) => {
  await cargarEscuelas();
  AG_MES = AG_MES || hoy().slice(0, 7);
  const [cal, prox] = await Promise.all([api('/api/calendario?mes=' + AG_MES), api('/api/eventos?desde=' + hoy())]);
  const primero = AG_MES + '-01', blancos = diaSemana(primero);
  const dias = Object.keys(cal.dias);
  const mover = n => { const d = new Date(primero + 'T12:00:00'); d.setMonth(d.getMonth() + n); AG_MES = isoLocal(d).slice(0, 7); ir('agenda'); };
  main.innerHTML = cabecera('cal', 'Agenda', 'Feriados, reuniones, actos, entregas y tus licencias', `<button class="btn pri" id="agN">${ico('plus')} Anotar</button>`) +
    `<div class="card"><div class="cal-nav"><button class="ab" id="agA">${ico('izq')}</button><h2>${nombreMes(AG_MES)}</h2><button class="ab" id="agS">${ico('der')}</button>
      <button class="btn chico" id="agH">Hoy</button></div>
      <div class="cal">${DIAS_C.map(d => `<div class="cal-h">${d}</div>`).join('')}${'<div class="cal-d vacio"></div>'.repeat(blancos)}
      ${dias.map(f => { const x = cal.dias[f], fer = x.especiales.find(e => e.tipo !== 'SIN_CLASES'), sc = diaSemana(f) < 5 && x.especiales.find(e => e.tipo === 'SIN_CLASES');
        return `<div class="cal-d ${f === hoy() ? 'hoy' : ''} ${fer ? 'fer' : ''} ${diaSemana(f) > 4 ? 'finde' : ''}" data-f="${f}"><span class="n">${+f.slice(8)}</span>
        ${fer ? `<div class="cal-fer">${esc(fer.nombre)}</div>` : ''}${sc ? `<div class="cal-sc">${esc(sc.nombre)}</div>` : ''}
        ${x.licencias.map(l => `<div class="cal-lic">${esc(l.texto)}</div>`).join('')}
        ${x.eventos.slice(0, 3).map(e => `<div class="cal-ev ${e.hecho ? 'hecho' : ''}" style="--cc:${esc(e.color || 'var(--pri)')}">${e.hora ? esc(e.hora) + ' ' : ''}${esc(e.titulo)}</div>`).join('')}
        ${x.eventos.length > 3 ? `<div class="muted chico">+${x.eventos.length - 3} más</div>` : ''}</div>`; }).join('')}</div></div>
    <div class="card"><h3>${ico('lista')} Lo que viene</h3>${prox.length ? prox.map(e => filaEvento(e, true)).join('') : '<div class="muted">No hay nada anotado.</div>'}</div>`;
  $('#agA').onclick = () => mover(-1); $('#agS').onclick = () => mover(1); $('#agH').onclick = () => { AG_MES = hoy().slice(0, 7); ir('agenda'); };
  $('#agN').onclick = () => editarEvento({ fecha: hoy() }, () => ir('agenda'));
  main.onclick = e => {
    const v = e.target.closest('[data-ev]'); if (v) return verEvento(+v.dataset.ev, () => ir('agenda'));
    const d = e.target.closest('[data-f]'); if (d && d.dataset.f) verDia(d.dataset.f);
  };
};

async function verDia(fecha) {
  const d = await api('/api/dia?fecha=' + fecha);
  const m = modal(fechaLarga(fecha) + ' de ' + fecha.slice(0, 4), `
    ${d.especiales.map(e => `<div class="aviso-dia">${ico('bandera')} <b>${esc(e.nombre)}</b> <span class="muted">(${TIPO_DIA[e.tipo]})</span></div>`).join('')}
    ${d.licencias.map(l => `<div class="aviso-dia nar">${ico('maletin')} Licencia: <b>${esc((l.codigo ? l.codigo + ' ' : '') + (l.articulo || ''))}</b></div>`).join('')}
    ${d.clases.length ? `<div class="sep-t">Clases según el horario</div>${d.clases.map(h => filaClase(h, true)).join('')}` : ''}
    <div class="sep-t">Agenda</div>${d.eventos.map(e => filaEvento(e)).join('') || '<div class="muted">Nada anotado.</div>'}`,
    `<button class="btn" data-cerrar>Cerrar</button><button class="btn pri" id="vdN">${ico('plus')} Anotar este día</button>`, 'ancho', 'cal');
  $('#vdN', m).onclick = () => { m.cerrar(); editarEvento({ fecha }, () => ir(actual)); };
  m.onclick = e => {
    const v = e.target.closest('[data-ev]'); if (v) { m.cerrar(); return verEvento(+v.dataset.ev, () => ir(actual)); }
    const a = e.target.closest('[data-asis]'); if (a) { m.cerrar(); CURSO_TAB = 'asistencia'; CURSO_FECHA = fecha; ir('curso', a.dataset.asis); }
  };
}

async function verEvento(id, luego) {
  const l = await api('/api/eventos?desde=2000-01-01&hasta=2100-12-31');
  const e = l.find(x => x.id === id); if (!e) return;
  editarEvento(e, luego);
}

function editarEvento(e, luego) {
  const nuevo = !e.id;
  const m = modal(nuevo ? 'Anotar en la agenda' : 'Agenda', `<div class="g">
    <div class="full"><label>Qué es</label><input name="titulo" value="${esc(e.titulo || '')}" placeholder="Ej. Reunión de padres, Entrega de planificación, Acto 9 de julio"></div>
    <div><label>Fecha</label><input type="date" name="fecha" value="${esc(e.fecha || hoy())}"></div>
    <div><label>Tipo</label><select name="tipo">${Object.entries(TIPOS_EV).map(([k, v]) => `<option value="${k}" ${k === (e.tipo || 'OTRO') ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div><label>Hora (opcional)</label><input type="time" name="hora" value="${esc(e.hora || '')}"></div><div><label>Hasta (opcional)</label><input type="time" name="hora_fin" value="${esc(e.hora_fin || '')}"></div>
    <div><label>Escuela</label><select name="escuela_id" id="evE">${opcEscuelas(e.escuela_id, 'Ninguna / personal')}</select></div>
    <div><label>Curso</label><select name="curso_id" id="evC"></select></div>
    <div class="full"><label>Notas</label><textarea name="notas">${esc(e.notas || '')}</textarea></div>
    ${nuevo ? '' : `<div class="full"><label class="chk"><input type="checkbox" id="evH" ${e.hecho ? 'checked' : ''}> Ya está hecho</label></div>`}</div>`,
    `${nuevo ? '' : `<button class="btn rojo" id="evB" style="margin-right:auto">${ico('trash')} Borrar</button>`}<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="evOk">Guardar</button>`, '', 'cal');
  const pc = () => $('#evC', m).innerHTML = opcCursos($('#evE', m).value, e.curso_id, 'Ninguno');
  $('#evE', m).onchange = pc; pc();
  $('#evOk', m).onclick = async () => {
    const d = leer($('.mb', m)); d.id = e.id; if (!nuevo) d.hecho = $('#evH', m).checked;
    try { await api('/api/eventos', d); m.cerrar(); toast('Guardado en la agenda'); if (luego) luego(); } catch (x) { fallo(x); }
  };
  if (!nuevo) $('#evB', m).onclick = async () => { if (!await confirmar('¿Borrar de la agenda?', 'Borrar')) return; await api('/api/eventos/' + e.id, undefined, 'DELETE'); m.cerrar(); if (luego) luego(); };
  setTimeout(() => $('[name=titulo]', m).focus(), 50);
}

/* ================================================================ ESCUELAS Y CARGOS */
P.escuelas = async (main) => {
  const l = await api('/api/escuelas?todas=1'); ESC = l.filter(e => e.activo);
  main.innerHTML = cabecera('edificio', 'Escuelas y cargos', 'Dónde trabajás y con qué cargos u horas', `<button class="btn pri" id="esN">${ico('plus')} Nueva escuela</button>`) +
    (l.length ? `<div class="esc-grid">${l.map(e => `<div class="card esc ${e.activo ? '' : 'inact'}" style="--cc:${esc(e.color)}">
      <div class="inl" style="justify-content:space-between"><h3 style="margin:0">${esc(e.nombre)}${e.numero ? ` <span class="muted">N° ${esc(e.numero)}</span>` : ''}</h3>
        <button class="btn chico" data-ed="${e.id}">${ico('lapiz')} Modificar</button></div>
      <div class="muted chico">${[e.nivel, e.localidad, e.direccion, e.telefono && 'Tel. ' + e.telefono, e.directivo && 'Directivo: ' + e.directivo].filter(Boolean).map(esc).join(' · ')}</div>
      ${e.activo ? '' : '<span class="pill gris">Ya no trabajo ahí</span>'}
      <div class="sep-t">Cargos / horas</div>
      ${e.cargos.map(c => `<div class="cargo ${c.activo ? '' : 'inact'}" data-cg="${c.id}" data-e="${e.id}"><b>${esc(c.descripcion)}</b>
        <span class="muted chico">${c.tipo === 'HORAS' && c.horas ? num(c.horas) + ' hs cátedra · ' : ''}${esc(SITUACION[c.situacion] || c.situacion || '')}${c.desde ? ' · desde ' + dmy(c.desde) : ''}${c.hasta ? ' hasta ' + dmy(c.hasta) : ''}</span></div>`).join('') || '<div class="muted chico">Sin cargos cargados</div>'}
      <button class="btn link chico" data-ncg="${e.id}">${ico('plus')} Agregar cargo u horas</button>
      <div class="sep-t">Cursos ${anioActual()}</div><div class="chips">${e.cursos.map(c => `<span class="ccur" data-cu="${c.id}">${esc(nomCurso(c))} <small>${c.alumnos}</small></span>`).join('') || '<span class="muted chico">Sin cursos</span>'}</div>
    </div>`).join('')}</div>` : `<div class="card vacio-g">${ico('edificio')}<p>Cargá cada escuela donde trabajás. Después le agregás tus cargos u horas, los cursos y el horario.</p></div>`);
  $('#esN').onclick = () => editarEscuela({});
  main.onclick = e => {
    const a = e.target.closest('[data-ed]'); if (a) return editarEscuela(l.find(x => x.id === +a.dataset.ed));
    const b = e.target.closest('[data-ncg]'); if (b) return editarCargo({ escuela_id: +b.dataset.ncg });
    const c = e.target.closest('[data-cg]'); if (c) return editarCargo(l.find(x => x.id === +c.dataset.e).cargos.find(x => x.id === +c.dataset.cg));
    const k = e.target.closest('[data-cu]'); if (k) { CURSO_TAB = 'asistencia'; ir('curso', k.dataset.cu); }
  };
};

function editarEscuela(e) {
  const nuevo = !e.id;
  const color = e.color || COLORES[ESC.length % COLORES.length];
  const m = modal(nuevo ? 'Nueva escuela' : 'Modificar escuela', `<div class="g">
    <div><label>Nombre</label><input name="nombre" value="${esc(e.nombre || '')}" placeholder="Ej. Escuela de Educación Secundaria"></div>
    <div><label>Número</label><input name="numero" value="${esc(e.numero || '')}" placeholder="Ej. 45"></div>
    <div><label>Nivel</label><input name="nivel" value="${esc(e.nivel || '')}" list="niveles" placeholder="Primaria, Secundaria…"><datalist id="niveles"><option>Inicial</option><option>Primaria</option><option>Secundaria</option><option>Superior / Terciario</option><option>Adultos</option><option>Especial</option></datalist></div>
    <div><label>Localidad</label><input name="localidad" value="${esc(e.localidad || '')}"></div>
    <div><label>Dirección</label><input name="direccion" value="${esc(e.direccion || '')}"></div><div><label>Teléfono</label><input name="telefono" value="${esc(e.telefono || '')}"></div>
    <div><label>Directivo</label><input name="directivo" value="${esc(e.directivo || '')}"></div>
    <div><label>Color (para el horario y la agenda)</label><div class="colores">${COLORES.map(c => `<button type="button" data-c="${c}" style="background:${c}" class="${c === color ? 'act' : ''}"></button>`).join('')}</div></div>
    <div class="full"><label>Notas</label><textarea name="notas">${esc(e.notas || '')}</textarea></div>
    ${nuevo ? '' : `<div class="full"><label class="chk"><input type="checkbox" id="esIn" ${e.activo ? '' : 'checked'}> Ya no trabajo en esta escuela (se oculta, pero se conserva todo)</label></div>`}</div>`,
    `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="esOk">Guardar</button>`, '', 'edificio');
  let col = color;
  $$('[data-c]', m).forEach(b => b.onclick = () => { col = b.dataset.c; $$('[data-c]', m).forEach(x => x.classList.toggle('act', x === b)); });
  $('#esOk', m).onclick = async () => {
    const d = leer($('.mb', m)); d.id = e.id; d.color = col; d.activo = nuevo ? 1 : !$('#esIn', m).checked;
    try { const r = await api('/api/escuelas', d); m.cerrar(); toast('Escuela guardada'); if (nuevo) { await cargarEscuelas(); editarCargo({ escuela_id: r.id }); } recargar(); } catch (x) { fallo(x); }
  };
  setTimeout(() => $('[name=nombre]', m).focus(), 50);
}

function editarCargo(c) {
  const nuevo = !c.id;
  const m = modal(nuevo ? 'Agregar cargo u horas' : 'Modificar cargo', `<div class="g">
    <div class="full"><label>Cargo o materia</label><input name="descripcion" value="${esc(c.descripcion || '')}" placeholder="Ej. Matemática 6 hs · Maestra de grado · Preceptor"></div>
    <div><label>Tipo</label><select name="tipo"><option value="HORAS" ${c.tipo !== 'CARGO' ? 'selected' : ''}>Horas cátedra</option><option value="CARGO" ${c.tipo === 'CARGO' ? 'selected' : ''}>Cargo</option></select></div>
    <div><label>Horas cátedra</label><input name="horas" inputmode="decimal" value="${esc(fmtIn(c.horas || ''))}"></div>
    <div><label>Situación de revista</label><select name="situacion">${Object.entries(SITUACION).filter(([k]) => k).map(([k, v]) => `<option value="${k}" ${k === c.situacion ? 'selected' : ''}>${v}</option>`).join('')}<option value="" ${!c.situacion ? 'selected' : ''}>—</option></select></div>
    <div><label>Desde</label><input type="date" name="desde" value="${esc(c.desde || '')}"></div><div><label>Hasta (si es suplencia)</label><input type="date" name="hasta" value="${esc(c.hasta || '')}"></div>
    <div class="full"><label>Notas</label><input name="notas" value="${esc(c.notas || '')}"></div>
    ${nuevo ? '' : `<div class="full"><label class="chk"><input type="checkbox" id="cgIn" ${c.activo ? '' : 'checked'}> Ya no tengo este cargo</label></div>`}</div>`,
    `<button class="btn" data-cerrar>${nuevo ? 'Después' : 'Cancelar'}</button><button class="btn pri" id="cgOk">Guardar</button>`, '', 'maletin');
  $('#cgOk', m).onclick = async () => {
    const d = leer($('.mb', m)); d.id = c.id; d.escuela_id = c.escuela_id; d.activo = nuevo ? 1 : !$('#cgIn', m).checked;
    try { await api('/api/cargos', d); m.cerrar(); toast('Cargo guardado'); recargar(); } catch (x) { fallo(x); }
  };
}

/* ================================================================ FERIADOS */
let FER_ANIO = 0;
P.feriados = async (main) => {
  await cargarEscuelas();
  FER_ANIO = FER_ANIO || anioActual();
  const d = await api('/api/feriados?anio=' + FER_ANIO);
  main.innerHTML = cabecera('bandera', 'Feriados y días sin clases', 'Los feriados nacionales se calculan solos todos los años',
    `<select id="frA" style="width:auto">${opcAnios(FER_ANIO)}</select><button class="btn pri" id="frN">${ico('plus')} Agregar día sin clases o feriado</button>`) +
    (!d.puentes_cargados ? `<div class="aviso">${ico('info')} Los <b>días no laborables con fines turísticos</b> de ${FER_ANIO} los decide el gobierno cada año. Cuando salgan,
      agregalos con el botón de arriba (tipo "Día no laborable") o actualizá el programa.</div>` : '') +
    `<div class="cols2"><div class="card"><h3>${ico('bandera')} Feriados nacionales ${FER_ANIO}</h3><table class="t comp"><tbody>
      ${d.automaticos.map(f => `<tr class="${f.quitado_id ? 'anulado' : ''}"><td style="white-space:nowrap"><b>${DIAS_C[diaSemana(f.fecha)]} ${dm(f.fecha)}</b></td>
        <td>${esc(f.nombre)}${f.original ? `<div class="muted chico">Trasladado del ${dm(f.original)}</div>` : ''}${f.tipo !== 'FERIADO' ? `<div class="muted chico">${TIPO_DIA[f.tipo]}</div>` : ''}</td>
        <td class="r">${f.quitado_id ? `<button class="btn chico" data-res="${f.quitado_id}">Volver a poner</button>` : `<button class="btn chico link" data-qui="${f.fecha}" title="Si el gobierno lo cambió de fecha">Quitar</button>`}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="card"><h3>${ico('cal')} Los que agregaste</h3>${d.manuales.length ? `<table class="t comp"><tbody>${d.manuales.map(x => `<tr><td style="white-space:nowrap"><b>${dm(x.fecha)}${x.hasta ? ' al ' + dm(x.hasta) : ''}</b></td>
      <td>${esc(x.nombre)}<div class="muted chico">${TIPO_DIA[x.tipo] || x.tipo}${x.escuela ? ' · sólo ' + esc(x.escuela) : ''}</div></td>
      <td class="r"><button class="ab" data-bor="${x.id}" style="color:var(--rojo)">${ico('trash')}</button></td></tr>`).join('')}</tbody></table>`
      : '<div class="muted">Acá van los feriados provinciales o locales, el receso de invierno, jornadas institucionales o paros: los días que no hay clases.</div>'}</div></div>`;
  $('#frA').onchange = e => { FER_ANIO = +e.target.value; ir('feriados'); };
  $('#frN').onclick = () => {
    const m = modal('Agregar día sin clases o feriado', `<div class="g">
      <div><label>Tipo</label><select name="tipo"><option value="SIN_CLASES">Sin clases (receso, jornada, paro…)</option><option value="FERIADO">Feriado provincial o local</option><option value="NO_LABORABLE">Día no laborable</option></select></div>
      <div><label>Escuela</label><select name="escuela_id">${opcEscuelas('', 'Todas')}</select></div>
      <div><label>Desde</label><input type="date" name="fecha" value="${hoy()}"></div><div><label>Hasta (si son varios días)</label><input type="date" name="hasta"></div>
      <div class="full"><label>Motivo</label><input name="nombre" placeholder="Ej. Receso invernal · Feriado provincial · Jornada institucional"></div></div>`,
      `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="frOk">Guardar</button>`, '', 'bandera');
    $('#frOk', m).onclick = async () => { try { await api('/api/dias-especiales', leer($('.mb', m))); m.cerrar(); toast('Guardado'); ir('feriados'); } catch (x) { fallo(x); } };
  };
  main.onclick = async e => {
    const q = e.target.closest('[data-qui]');
    if (q && await confirmar('¿Quitar este feriado? Hacelo sólo si el gobierno lo cambió de fecha (después agregá el día nuevo).', 'Quitar')) { await api('/api/dias-especiales', { tipo: 'QUITAR', fecha: q.dataset.qui }); ir('feriados'); }
    const r = e.target.closest('[data-res]') || e.target.closest('[data-bor]');
    if (r) { await api('/api/dias-especiales/' + (r.dataset.res || r.dataset.bor), undefined, 'DELETE'); ir('feriados'); }
  };
};

/* ================================================================ LICENCIAS */
let LIC_ANIO = 0;
const codTxt = c => c.codigo ? `cód. ${esc(c.codigo)}${c.articulo ? ' · Art. ' + esc(c.articulo) : ''}` : '';
const escCorta = c => esc(c.escuela_numero ? 'N° ' + c.escuela_numero : (c.escuela || 'Todas'));
P.licencias = async (main) => {
  await cargarEscuelas();
  LIC_ANIO = LIC_ANIO || anioActual();
  const [d, motivos] = await Promise.all([api('/api/licencias?anio=' + LIC_ANIO), api('/api/motivos')]);
  const usados = d.contador;
  main.innerHTML = cabecera('maletin', 'Licencias', `${num(d.total_dias)} días con licencia en ${LIC_ANIO}`,
    `<select id="lcA" style="width:auto">${opcAnios(LIC_ANIO)}</select><button class="btn" id="lcArt">${ico('lista')} Nomenclador</button>
     <button class="btn" id="lcImp">${ico('print')} Imprimir</button><button class="btn pri" id="lcN">${ico('plus')} Nueva licencia</button>`) +
    (ESC.some(e => e.cargos.some(c => c.activo && !c.situacion)) ? `<div class="aviso">${ico('alerta')} Hay cargos sin la <b>situación de revista</b> (titular, interino o suplente): cargala en
      <a data-ir="escuelas">Escuelas y cargos</a>, porque el código de cada licencia depende de eso.</div>` : '') +
    (usados.length ? `<div class="cont-grid">${usados.map(c => `<div class="cont ${c.excedido ? 'exc' : ''}"><small>cód. ${esc(c.codigo || '—')}${c.articulo ? ' · Art. ' + esc(c.articulo) : ''}${c.situacion ? ' · ' + SITUACION[c.situacion] : ''}</small><b>${esc(c.descripcion)}</b>
      <div class="cont-n"><span>${num(c.usados)}</span>${c.tope ? ` de ${num(c.tope)} días en el año` : ' días'}</div>
      ${c.tope ? `<div class="barra-p"><i style="width:${Math.min(100, c.usados / c.tope * 100)}%"></i></div><div class="chico ${c.excedido ? 'neg' : 'muted'}">${c.excedido ? 'Pasaste el tope' : `Te quedan ${num(c.quedan)}`}</div>`
        : `<div class="muted chico">${c.veces} vez${c.veces === 1 ? '' : 'es'}${c.tope_texto ? ' · ' + esc(c.tope_texto) : ''}</div>`}</div>`).join('')}</div>` : '') +
    `<div class="card"><h3>${ico('lista')} Licencias ${LIC_ANIO}</h3>${d.licencias.length ? `<div class="tabla-x"><table class="t"><thead><tr><th>Fecha</th><th class="r">Días</th><th>Motivo</th><th>Escuela · código</th>
      <th>Estado</th><th>Certificado</th></tr></thead><tbody>${d.licencias.map(l => `<tr data-l="${l.id}" style="cursor:pointer">
      <td style="white-space:nowrap"><b>${DIAS_C[diaSemana(l.desde)]} ${dm(l.desde)}</b>${l.hasta !== l.desde ? ' al ' + dm(l.hasta) : ''}</td><td class="r"><b>${num(l.dias)}</b></td>
      <td><b>${esc(l.motivo || '')}</b>${l.razon ? `<div class="muted chico">${esc(l.razon)}</div>` : ''}${l.expediente ? `<div class="muted chico">Exp. ${esc(l.expediente)}</div>` : ''}</td>
      <td>${l.cargos.map(c => `<div class="chico"><b>${escCorta(c)}</b>${c.cargo ? ' ' + esc(c.cargo) : ''} <span class="muted">${codTxt(c)}${c.situacion ? ' (' + SITUACION[c.situacion].toLowerCase() + ')' : ''}</span></div>`).join('')}</td>
      <td><span class="pill ${EST_LIC[l.estado][1]}">${EST_LIC[l.estado][0]}</span></td>
      <td>${l.pide_certificado ? (l.certificado ? `<span class="pill ATENDIDO">Presentado</span>` : `<span class="pill naranja">Falta</span>`) : '<span class="muted chico">No pide</span>'}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="vacio-g">${ico('maletin')}<p>No cargaste licencias en ${LIC_ANIO}.</p></div>`}</div>`;
  $('#lcA').onchange = e => { LIC_ANIO = +e.target.value; ir('licencias'); };
  $('#lcN').onclick = () => editarLicencia({}, motivos);
  $('#lcArt').onclick = () => verArticulos();
  main.onclick = e => { const k = e.target.closest('[data-ir]'); if (k) return ir(k.dataset.ir); const r = e.target.closest('[data-l]'); if (r) editarLicencia(d.licencias.find(x => x.id === +r.dataset.l), motivos); };
  $('#lcImp').onclick = () => imprimir('Licencias ' + LIC_ANIO, `<h1>Licencias ${LIC_ANIO}</h1><div class="sub">${esc(CFG().nombre_consultorio || '')}${CFG().dni ? ' · DNI ' + esc(CFG().dni) : ''}</div>
    <table><tr><th>Código</th><th>Artículo</th><th>Motivo</th><th class="r">Días usados</th><th class="r">Tope anual</th><th class="r">Quedan</th></tr>${usados.map(c => `<tr><td><b>${esc(c.codigo)}</b></td><td>${esc(c.articulo)}</td>
      <td>${esc(c.descripcion)}${c.situacion ? ' (' + SITUACION[c.situacion].toLowerCase() + ')' : ''}</td><td class="r">${num(c.usados)}</td><td class="r">${c.tope ? num(c.tope) : esc(c.tope_texto || '—')}</td>
      <td class="r ${c.excedido ? 'mal' : ''}">${c.tope ? num(c.quedan) : '—'}</td></tr>`).join('')}</table><br>
    <table><tr><th>Fecha</th><th class="r">Días</th><th>Motivo</th><th>Escuela</th><th>Código</th><th>Artículo</th><th>Estado</th><th>Certificado</th></tr>
    ${d.licencias.slice().reverse().flatMap(l => l.cargos.map((c, i) => `<tr><td>${i ? '' : dmy(l.desde) + (l.hasta !== l.desde ? ' al ' + dmy(l.hasta) : '')}</td><td class="r">${i ? '' : num(l.dias)}</td>
      <td>${i ? '' : esc(l.motivo) + (l.razon ? ' · ' + esc(l.razon) : '')}</td><td>${escCorta(c)}${c.cargo ? ' · ' + esc(c.cargo) : ''}</td><td><b>${esc(c.codigo || '')}</b></td><td>${esc(c.articulo || '')}</td>
      <td>${i ? '' : EST_LIC[l.estado][0]}</td><td>${i ? '' : l.pide_certificado ? (l.certificado ? 'Presentado' : 'FALTA') : ''}</td></tr>`)).join('')}</table>`, true);
};

function editarLicencia(l, motivos) {
  const nuevo = !l.id;
  const cargos = ESC.flatMap(e => e.cargos.filter(c => c.activo || (l.cargos || []).some(x => x.cargo_id === c.id)).map(c => ({ ...c, escuela: e.nombre, numero: e.numero, color: e.color })));
  const sel = new Set((l.cargos || []).map(c => c.cargo_id).filter(Boolean));
  const m = modal(nuevo ? 'Nueva licencia' : 'Licencia', `<div class="g">
    <div class="full"><label>Motivo</label><select id="liMo"><option value="">Elegí el motivo…</option>${motivos.map(x => `<option ${x.motivo === l.motivo ? 'selected' : ''}>${esc(x.motivo)}</option>`).join('')}</select></div>
    <div><label>Desde</label><input type="date" id="liD" value="${esc(l.desde || hoy())}"></div><div><label>Hasta</label><input type="date" id="liH" value="${esc(l.hasta || l.desde || hoy())}"></div>
    <div class="full"><div class="dias-lic" id="liN"></div></div>
    <div class="full"><label>¿En qué cargos faltás?</label>${cargos.length ? `<div class="lic-cargos" id="liCg">${cargos.map(c => `<label class="lic-cg" style="--cc:${esc(c.color)}">
        <input type="checkbox" value="${c.id}" ${sel.has(c.id) || (nuevo && cargos.length === 1) ? 'checked' : ''}>
        <span><b>${esc(c.escuela)}${c.numero ? ' N° ' + esc(c.numero) : ''}</b> · ${esc(c.descripcion)}<small>${c.situacion ? SITUACION[c.situacion] : '<span class="neg">sin situación de revista</span>'}</small></span>
        <em class="lic-cod" data-cod="${c.id}"></em></label>`).join('')}</div>
        <div class="inl" style="margin-top:4px"><button type="button" class="btn link chico" id="liTodos">Marcar todos</button></div>`
      : `<div class="aviso">${ico('info')} Cargá tus escuelas y cargos (con la situación de revista) para que la licencia tenga el código de cada uno.</div>`}</div>
    <div><label>Estado</label><select id="liEs">${Object.entries(EST_LIC).map(([k, v]) => `<option value="${k}" ${k === (l.estado || 'OTORGADA') ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></div>
    <div><label>N° de expediente / constancia</label><input id="liEx" value="${esc(l.expediente || '')}"></div>
    <div class="full" id="liCertW"><label class="chk"><input type="checkbox" id="liCe" ${l.certificado ? 'checked' : ''}> Ya presenté el certificado</label></div>
    <div class="full"><label>Detalle (opcional)</label><input id="liRa" value="${esc(l.razon || '')}" placeholder="Ej. gripe · operación de mi mamá · final de Didáctica"></div>
    <div class="full"><label>Notas</label><textarea id="liNo">${esc(l.notas || '')}</textarea></div></div>`,
    `${nuevo ? '' : `<button class="btn rojo" id="liB" style="margin-right:auto">${ico('trash')} Borrar</button>`}<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="liOk">Guardar</button>`, 'ancho', 'maletin');
  const motivo = () => motivos.find(x => x.motivo === $('#liMo', m).value);
  const pintarCodigos = () => {
    const mo = motivo();
    $('#liCertW', m).style.display = mo && mo.certificado ? '' : 'none';
    cargos.forEach(c => { const el = $(`[data-cod="${c.id}"]`, m); if (!el) return;
      if (!mo) { el.textContent = ''; return; }
      const a = mo.articulos.find(x => x.situacion === c.situacion) || mo.articulos.find(x => !x.situacion);
      el.innerHTML = a ? (a.codigo ? `cód. <b>${esc(a.codigo)}</b>${a.articulo ? ' · Art. ' + esc(a.articulo) : ''}` : '') : `<span class="neg">${c.situacion ? 'sin artículo para ' + SITUACION[c.situacion].toLowerCase() : 'falta la situación'}</span>`; });
  };
  const calc = async () => {
    pintarCodigos();
    const mo = motivo();
    if (!mo) { $('#liN', m).innerHTML = 'Elegí el motivo'; return; }
    try { const r = await api(`/api/licencias/dias?motivo=${encodeURIComponent(mo.motivo)}&desde=${$('#liD', m).value}&hasta=${$('#liH', m).value}`);
      const a = mo.articulos[0];
      $('#liN', m).innerHTML = `<b>${r.dias}</b> día${r.dias === 1 ? '' : 's'} ${mo.computo === 'HABILES' ? 'hábiles (sin fines de semana ni feriados)' : 'corridos'}` +
        (a.tope_tipo === 'ANIO' && a.dias_anio ? ` · tope: ${mo.articulos.map(x => `${num(x.dias_anio)} por año${x.situacion ? ' (' + SITUACION[x.situacion].toLowerCase() + ')' : ''}`).join(', ')}` :
         a.tope_tipo === 'LICENCIA' && a.dias_anio ? ` · hasta ${num(a.dias_anio)} días por vez` : a.tope_texto ? ' · ' + esc(a.tope_texto) : '');
    } catch (e) { $('#liN', m).innerHTML = `<span class="neg">${esc(e.message)}</span>`; }
  };
  $('#liD', m).onchange = () => { if ($('#liH', m).value < $('#liD', m).value) $('#liH', m).value = $('#liD', m).value; calc(); };
  $('#liH', m).onchange = calc; $('#liMo', m).onchange = calc; calc();
  if ($('#liTodos', m)) $('#liTodos', m).onclick = () => $$('#liCg input', m).forEach(x => x.checked = true);
  const guardar = async (forzar) => {
    const d = { id: l.id, grupo: l.grupo, motivo: $('#liMo', m).value, desde: $('#liD', m).value, hasta: $('#liH', m).value, cargos: $$('#liCg input:checked', m).map(x => +x.value),
      estado: $('#liEs', m).value, expediente: $('#liEx', m).value, certificado: $('#liCe', m).checked, razon: $('#liRa', m).value, notas: $('#liNo', m).value, forzar };
    if (!d.motivo) return toast('Elegí el motivo', 'err');
    if (cargos.length && !d.cargos.length) return toast('Marcá en qué cargos faltás', 'err');
    try { const r = await api('/api/licencias', d); m.cerrar(); toast(`Licencia guardada: ${r.dias} días`); if (r.aviso) toast(r.aviso, 'err'); recargar(); }
    catch (x) { if (/superpone/.test(x.message) && await confirmar(esc(x.message) + '.<br>¿Guardarla igual?', 'Guardar igual', false)) return guardar(true); fallo(x); }
  };
  $('#liOk', m).onclick = () => guardar(false);
  if (!nuevo) $('#liB', m).onclick = async () => { if (!await confirmar('¿Borrar esta licencia?', 'Borrar')) return; await api('/api/licencias/' + l.id, undefined, 'DELETE'); m.cerrar(); recargar(); };
}

async function verArticulos() {
  const arts = await api('/api/articulos?todos=1');
  const TT = { ANIO: 'por año', LICENCIA: 'por vez', '': '' };
  const m = modal('Nomenclador de licencias', `<div class="aviso" style="margin-top:0">${ico('info')} Cada motivo tiene un código y un artículo distinto según seas <b>titular, interino o suplente</b>.
      Si cambia algo, modificalo acá. También podés <b>pegar</b> renglones nuevos.</div>
    <input id="arQ" placeholder="Buscar código, artículo o motivo" style="margin-bottom:8px">
    <div class="tabla-x" style="max-height:58vh;overflow:auto"><table class="t comp"><thead><tr><th>Código</th><th>Artículo</th><th>Motivo</th><th>Situación</th><th class="r">Días</th><th>Cuenta</th><th>Certif.</th><th></th></tr></thead><tbody>
    ${arts.map(a => `<tr data-txt="${esc((a.codigo + ' ' + a.articulo + ' ' + a.descripcion).toLowerCase())}" style="${a.activo ? '' : 'opacity:.5'}"><td><b>${esc(a.codigo || '—')}</b></td><td>${esc(a.articulo)}</td><td>${esc(a.descripcion)}</td>
      <td>${SITUACION[a.situacion] || 'Todas'}</td><td class="r">${a.dias_anio ? num(a.dias_anio) + ' ' + TT[a.tope_tipo] : esc(a.tope_texto || '—')}</td>
      <td>${a.computo === 'HABILES' ? 'Hábiles' : 'Corridos'}</td><td>${a.certificado ? 'Sí' : ''}</td><td><button class="ab" data-a="${a.id}">${ico('lapiz')}</button></td></tr>`).join('')}</tbody></table></div>`,
    `<button class="btn" id="arP" style="margin-right:auto">${ico('copiar')} Pegar</button><button class="btn" data-cerrar>Cerrar</button><button class="btn pri" id="arN">${ico('plus')} Nuevo</button>`, 'xl', 'lista');
  $('#arQ', m).oninput = e => { const q = e.target.value.toLowerCase(); $$('[data-txt]', m).forEach(r => r.style.display = r.dataset.txt.includes(q) ? '' : 'none'); };
  const editar = a => {
    const e = modal(a.id ? 'Modificar artículo' : 'Nuevo artículo', `<div class="g">
      <div class="full"><label>Motivo</label><input name="descripcion" value="${esc(a.descripcion || '')}" list="arMot"><datalist id="arMot">${[...new Set(arts.map(x => x.descripcion))].map(x => `<option value="${esc(x)}">`).join('')}</datalist>
        <div class="ayuda">Los artículos con el mismo motivo se eligen juntos: el sistema usa el que corresponde a cada cargo.</div></div>
      <div><label>Código</label><input name="codigo" value="${esc(a.codigo || '')}"></div><div><label>Artículo</label><input name="articulo" value="${esc(a.articulo || '')}" placeholder="Ej. 331 A"></div>
      <div><label>Situación de revista</label><select name="situacion"><option value="">Todas</option>${['TITULAR', 'INTERINO', 'SUPLENTE'].map(s => `<option value="${s}" ${a.situacion === s ? 'selected' : ''}>${SITUACION[s]}</option>`).join('')}</select></div>
      <div><label>Días</label><input name="dias_anio" inputmode="decimal" value="${esc(fmtIn(a.dias_anio || 0))}"></div>
      <div><label>El tope es</label><select name="tope_tipo"><option value="ANIO" ${a.tope_tipo === 'ANIO' ? 'selected' : ''}>Por año</option><option value="LICENCIA" ${a.tope_tipo === 'LICENCIA' ? 'selected' : ''}>Por vez</option>
        <option value="" ${!a.tope_tipo ? 'selected' : ''}>Sin tope en días</option></select></div>
      <div><label>Texto del tope (si no es un número)</label><input name="tope_texto" value="${esc(a.tope_texto || '')}" placeholder="Ej. Según prescripción médica"></div>
      <div><label>Los días se cuentan</label><select name="computo"><option value="CORRIDOS">Corridos</option><option value="HABILES" ${a.computo === 'HABILES' ? 'selected' : ''}>Hábiles</option></select></div>
      <div><label class="chk" style="margin-top:26px"><input type="checkbox" name="certificado" ${a.certificado ? 'checked' : ''}> Pide certificado / constancia</label></div>
      <div class="full"><label>Notas</label><input name="notas" value="${esc(a.notas || '')}"></div>
      ${a.id ? `<div class="full"><label class="chk"><input type="checkbox" id="arIn" ${a.activo ? '' : 'checked'}> No lo uso (ocultarlo)</label></div>` : ''}</div>`,
      `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="arOk">Guardar</button>`);
    $('#arOk', e).onclick = async () => { const d = leer($('.mb', e)); d.id = a.id; d.certificado = $('[name=certificado]', e).checked; d.activo = a.id ? !$('#arIn', e).checked : 1;
      try { await api('/api/articulos', d); e.cerrar(); m.cerrar(); verArticulos(); if (actual === 'licencias') recargar(); } catch (x) { fallo(x); } };
  };
  $('#arN', m).onclick = () => editar({ tope_tipo: 'ANIO' });
  m.onclick = ev => { const b = ev.target.closest('[data-a]'); if (b) editar(arts.find(x => x.id === +b.dataset.a)); };
  $('#arP', m).onclick = () => {
    const e = modal('Pegar artículos', `<p class="muted">Un artículo por renglón, separado por punto y coma: <b>motivo ; código ; artículo ; situación ; días</b>. Ejemplo:<br>
      <code>Enfermedad o lesión común ; 113 ; 331 A ; Interino ; 30</code><br>También se puede copiar de una planilla de Excel (las columnas en ese orden).</p><textarea id="apT" style="min-height:220px"></textarea>`,
      `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="apOk">Agregar</button>`, 'ancho');
    $('#apOk', e).onclick = async () => { try { const r = await api('/api/articulos/pegar', { texto: $('#apT', e).value }); toast(`${r.agregados} artículos agregados`); e.cerrar(); m.cerrar(); verArticulos(); } catch (x) { fallo(x); } };
  };
}
