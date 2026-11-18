/* ================================================================ GASTOS (sólo en la app del celular)
   Lo que gasta la docente, mes a mes: por categoría, por medio de pago y en el año. */
let GA_MES = '';
const mesMasJS = (m, n) => { const d = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1 + n, 1, 12); return isoLocal(d).slice(0, 7); };

P.gastos = async (main) => {
  GA_MES = GA_MES || hoy().slice(0, 7);
  const [d, cats] = await Promise.all([api('/api/gastos?mes=' + GA_MES), api('/api/gastos/categorias')]);
  const esteMes = GA_MES === hoy().slice(0, 7), maxCat = Math.max(1, ...d.por_categoria.map(c => c.total));
  const variacion = d.variacion === null ? (d.anterior ? '' : 'El mes anterior no anotaste gastos')
    : `${d.variacion > 0 ? '▲' : d.variacion < 0 ? '▼' : '='} ${num(Math.abs(d.variacion))}% que ${MESES[+mesMasJS(GA_MES, -1).slice(5, 7) - 1].toLowerCase()} (${money0(d.anterior)})`;
  // agrupados por día
  const dias = []; for (const g of d.gastos) { const u = dias[dias.length - 1]; if (u && u.f === g.fecha) u.l.push(g); else dias.push({ f: g.fecha, l: [g] }); }
  main.innerHTML = cabecera('peso', 'Gastos', 'Lo que gastás, mes a mes',
    `<button class="btn" id="gaCat">${ico('lista')} Categorías</button><button class="btn" id="gaXls">${ico('bajar')} Excel</button>`) + `
    <div class="ga-mes"><button class="btn" id="gaAnt" title="Mes anterior">${ico('izq')}</button><b>${nombreMes(GA_MES)}</b>
      <button class="btn" id="gaSig" title="Mes siguiente" ${esteMes ? 'disabled' : ''}>${ico('der')}</button></div>
    <button class="btn pri grande ga-nuevo" id="gaN">${ico('plus')} Anotar un gasto</button>
    <div class="kpis">
      <div class="kpi" style="--c:var(--rojo)"><small>Gastaste en ${MESES[+GA_MES.slice(5, 7) - 1].toLowerCase()}</small><b>${money(d.total)}</b>
        <div class="det ${d.variacion > 0 ? 'neg' : d.variacion < 0 ? 'pos' : ''}">${variacion}</div></div>
      <div class="kpi"><small>En ${GA_MES.slice(0, 4)}</small><b>${money(d.total_anio)}</b><div class="det">${d.gastos.length} gasto${d.gastos.length === 1 ? '' : 's'} este mes</div></div>
    </div>
    ${d.gastos.length ? `<div class="card"><h3>${ico('chart')} En qué gastaste</h3>
      ${d.por_categoria.map(c => `<div class="ga-cat"><span class="ga-emo">${esc(c.emoji || '•')}</span><div class="ga-cat-c"><div class="ga-cat-t"><b>${esc(c.nombre)}</b><span>${money(c.total)} <small class="muted">${num(c.pct)}%</small></span></div>
        <div class="barra-p"><i style="width:${c.total / maxCat * 100}%"></i></div></div></div>`).join('')}
      <div class="ga-medios">${d.por_medio.map(x => `<span class="pill">${esc(x.nombre)}: <b>${money0(x.total)}</b></span>`).join('')}</div></div>
    <div class="card"><h3>${ico('lista')} Gastos de ${MESES[+GA_MES.slice(5, 7) - 1].toLowerCase()}</h3>
      ${dias.map(x => `<div class="ga-dia">${x.f === hoy() ? 'Hoy' : x.f === sumarDias(hoy(), -1) ? 'Ayer' : DIAS[diaSemana(x.f)] + ' ' + +x.f.slice(8, 10)}
        <span>${money0(x.l.reduce((s, g) => s + g.monto, 0))}</span></div>
        ${x.l.map(g => `<div class="ga-fila" data-g="${g.id}"><span class="ga-emo">${esc(g.emoji || '•')}</span><div class="ga-txt"><b>${esc(g.detalle || g.categoria || 'Gasto')}</b>
          <small>${g.detalle ? esc(g.categoria || '') + ' · ' : ''}${esc(g.medio_txt)}</small></div><b class="ga-monto">${money(g.monto)}</b></div>`).join('')}`).join('')}</div>`
      : `<div class="card"><div class="vacio-g">${ico('peso')}<p>${esteMes ? 'Todavía no anotaste gastos este mes.' : 'No anotaste gastos en ' + nombreMes(GA_MES).toLowerCase() + '.'}</p>
        <p class="muted chico">Tocá "Anotar un gasto": fotocopias, materiales, el colectivo, un curso… También lo de la casa, si querés.</p></div></div>`}
    ${d.total_anio ? graficoMeses(d) : ''}`;
  $('#gaAnt').onclick = () => { GA_MES = mesMasJS(GA_MES, -1); ir('gastos'); };
  $('#gaSig').onclick = () => { if (!esteMes) { GA_MES = mesMasJS(GA_MES, 1); ir('gastos'); } };
  $('#gaN').onclick = () => editarGasto({ fecha: esteMes ? hoy() : GA_MES + '-01' }, cats, d.medios);
  $('#gaCat').onclick = () => verCategoriasGasto();
  $('#gaXls').onclick = () => {
    if (!d.gastos.length) return toast('No hay gastos en ' + nombreMes(GA_MES).toLowerCase(), 'err');
    bajarCSV('gastos_' + GA_MES, ['Fecha', 'Categoría', 'Detalle', 'Medio de pago', 'Importe'],
      d.gastos.slice().reverse().map(g => [dmy(g.fecha), g.categoria || '', g.detalle || '', g.medio_txt, String(g.monto).replace('.', ',')]));
  };
  main.onclick = e => {
    const b = e.target.closest('[data-gm]'); if (b) { GA_MES = b.dataset.gm; return ir('gastos'); }
    const f = e.target.closest('[data-g]'); if (f) editarGasto(d.gastos.find(g => g.id === +f.dataset.g), cats, d.medios); };
};

/* gráfico del año: el importe sólo arriba del mes elegido (con 12 barras en el celular no entran todos); tocando una barra se va a ese mes */
function graficoMeses(d) {
  const max = Math.max(1, ...d.por_mes.map(x => x.total)), hoyM = hoy().slice(0, 7);
  const conGasto = d.por_mes.filter(x => x.total > 0 && x.mes <= hoyM), alto = d.por_mes.reduce((a, x) => x.total > a.total ? x : a, d.por_mes[0]);
  return `<div class="card"><h3>${ico('chart')} Mes a mes en ${GA_MES.slice(0, 4)}</h3>
    <div class="barras ga-barras" style="height:140px">${d.por_mes.map(x => `<div data-gm="${x.mes}" class="${x.mes === GA_MES ? 'sel' : ''}" style="height:${x.total / max * 100}%;${x.mes > hoyM ? 'pointer-events:none' : ''}"
      title="${nombreMes(x.mes)}: ${money0(x.total)}"><span>${x.mes === GA_MES && x.total ? money0(x.total) : ''}</span></div>`).join('')}</div>
    <div class="barras-l">${d.por_mes.map(x => `<span>${MESES[+x.mes.slice(5, 7) - 1].slice(0, 3)}</span>`).join('')}</div>
    <div class="muted chico" style="margin-top:8px">Promedio por mes: <b>${money0(d.total_anio / Math.max(1, conGasto.length))}</b> · Mes más alto: <b>${MESES[+alto.mes.slice(5, 7) - 1].toLowerCase()} (${money0(alto.total)})</b>
      <br>Tocá una barra para ver ese mes.</div></div>`;
}

function editarGasto(g, cats, medios) {
  const nuevo = !g.id;
  let cat = g.categoria_id || (cats[0] && cats[0].id);
  // si la categoría del gasto se borró, igual se muestra para no perderla
  const lista = cats.some(c => c.id === g.categoria_id) || !g.categoria_id ? cats : [...cats, { id: g.categoria_id, nombre: g.categoria, emoji: g.emoji }];
  const m = modal(nuevo ? 'Anotar un gasto' : 'Gasto', `<div class="g">
    <div class="full"><label>¿Cuánto?</label>${campoMonto('id="gmM" style="font-size:22px;font-weight:800"', g.monto || '')}</div>
    <div class="full"><label>¿En qué?</label><div class="ga-chips" id="gmC">${lista.map(c => `<button type="button" class="ga-chip ${c.id === cat ? 'act' : ''}" data-c="${c.id}">
      <span>${esc(c.emoji || '•')}</span>${esc(c.nombre)}</button>`).join('')}
      <button type="button" class="ga-chip nueva" data-nueva>${ico('plus')} Otra</button></div></div>
    <div class="full"><label>Detalle (opcional)</label><input id="gmD" value="${esc(g.detalle || '')}" maxlength="120" placeholder="Ej. fotocopias de la prueba de 3° B"></div>
    <div><label>Fecha</label><input type="date" id="gmF" value="${esc(g.fecha || hoy())}" max="${hoy()}"></div>
    <div><label>¿Cómo pagaste?</label><select id="gmP">${Object.entries(medios).map(([k, v]) => `<option value="${k}" ${k === (g.medio || 'EFECTIVO') ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
    </div>`, `${nuevo ? '' : `<button class="btn rojo" id="gmB" style="margin-right:auto">${ico('trash')} Borrar</button>`}<button class="btn" data-cerrar>Cancelar</button>
    <button class="btn pri" id="gmOk">${ico('check')} Guardar</button>`, '', 'peso');
  setTimeout(() => $('#gmM', m).focus(), 60);
  $('#gmC', m).onclick = async e => {
    if (e.target.closest('[data-nueva]')) {
      const c = await nuevaCategoriaGasto(); if (!c) return;
      cats.push(c); $('[data-nueva]', m).insertAdjacentHTML('beforebegin', `<button type="button" class="ga-chip" data-c="${c.id}"><span>${esc(c.emoji || '•')}</span>${esc(c.nombre)}</button>`);
      cat = c.id;
    } else { const b = e.target.closest('[data-c]'); if (!b) return; cat = +b.dataset.c; }
    $$('#gmC [data-c]', m).forEach(b => b.classList.toggle('act', +b.dataset.c === cat));
  };
  $('#gmOk', m).onclick = async () => {
    const monto = aNum($('#gmM', m).value);
    if (isNaN(monto) || !(monto > 0)) { toast('Escribí cuánto gastaste', 'err'); return $('#gmM', m).focus(); }
    try {
      await api('/api/gastos', { id: g.id, monto, categoria_id: cat, detalle: $('#gmD', m).value, fecha: $('#gmF', m).value, medio: $('#gmP', m).value });
      m.cerrar(); toast(nuevo ? 'Gasto anotado' : 'Gasto guardado');
      const f = $('#gmF', m).value; if (f) GA_MES = f.slice(0, 7);
      ir('gastos');
    } catch (e) { fallo(e); }
  };
  if (!nuevo) $('#gmB', m).onclick = async () => {
    if (!await confirmar(`¿Borrar el gasto de <b>${money(g.monto)}</b>${g.detalle ? ' (' + esc(g.detalle) + ')' : ''}?`, 'Borrar')) return;
    try { await api('/api/gastos/' + g.id, null, 'DELETE'); m.cerrar(); toast('Gasto borrado'); ir('gastos'); } catch (e) { fallo(e); }
  };
}

const EMOJIS_GASTO = ['🛒', '🏠', '💡', '💧', '🔥', '🚗', '⛽', '🚌', '💊', '👕', '🍔', '☕', '🎁', '🐶', '👶', '💇', '🎉', '📄', '✏️', '📚', '🎓', '📱', '💻', '🏥', '💳', '📦'];
function nuevaCategoriaGasto(c = {}) {
  return new Promise(res => {
    let emo = c.emoji || '🛒';
    const m = modal(c.id ? 'Cambiar categoría' : 'Categoría nueva', `<label>Nombre</label><input id="gcN" value="${esc(c.nombre || '')}" maxlength="40" placeholder="Ej. Supermercado, Servicios, Salud">
      <label style="margin-top:12px">Dibujito</label><div class="ga-emojis" id="gcE">${EMOJIS_GASTO.map(e => `<button type="button" data-e="${e}" class="${e === emo ? 'act' : ''}">${e}</button>`).join('')}</div>`,
      `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="gcOk">${ico('check')} Guardar</button>`);
    m.alCerrar = () => res(null);
    $('#gcE', m).onclick = e => { const b = e.target.closest('[data-e]'); if (!b) return; emo = b.dataset.e; $$('#gcE button', m).forEach(x => x.classList.toggle('act', x === b)); };
    setTimeout(() => $('#gcN', m).focus(), 60);
    $('#gcOk', m).onclick = async () => {
      try {
        const r = await api('/api/gastos/categorias', { id: c.id, nombre: $('#gcN', m).value, emoji: emo });
        m.alCerrar = null; m.cerrar(); res({ id: r.id, nombre: $('#gcN', m).value.trim(), emoji: emo });
      } catch (e) { fallo(e); }
    };
  });
}

async function verCategoriasGasto() {
  const cats = await api('/api/gastos/categorias');
  const m = modal('Categorías de gastos', `<p class="muted" style="margin-top:0">Agregá las tuyas (súper, servicios, salud…) o borrá las que no uses.</p>
    <div id="gcL">${cats.map(c => `<div class="ga-fila"><span class="ga-emo">${esc(c.emoji || '•')}</span><div class="ga-txt"><b>${esc(c.nombre)}</b><small>${c.usos ? c.usos + ' gasto' + (c.usos === 1 ? '' : 's') : 'Sin usar'}</small></div>
      <button class="btn chico" data-ed="${c.id}">${ico('lapiz')}</button><button class="btn chico" data-bo="${c.id}">${ico('trash')}</button></div>`).join('')}</div>`,
    `<button class="btn" data-cerrar>Cerrar</button><button class="btn pri" id="gcNueva">${ico('plus')} Categoría nueva</button>`, '', 'lista');
  const volver = () => { m.cerrar(); verCategoriasGasto(); if (location.hash.startsWith('#gastos')) ir('gastos'); };
  $('#gcNueva', m).onclick = async () => { if (await nuevaCategoriaGasto()) volver(); };
  $('#gcL', m).onclick = async e => {
    const ed = e.target.closest('[data-ed]'), bo = e.target.closest('[data-bo]');
    if (ed) { if (await nuevaCategoriaGasto(cats.find(c => c.id === +ed.dataset.ed))) volver(); }
    if (bo) {
      const c = cats.find(x => x.id === +bo.dataset.bo);
      if (!await confirmar(`¿Borrar la categoría <b>${esc(c.nombre)}</b>?${c.usos ? `<br><br>Los ${c.usos} gasto${c.usos === 1 ? '' : 's'} que ya tiene no se borran: siguen apareciendo con esa categoría.` : ''}`, 'Borrar')) return;
      try { await api('/api/gastos/categorias/' + c.id, null, 'DELETE'); toast('Categoría borrada'); volver(); } catch (x) { fallo(x); }
    }
  };
}
