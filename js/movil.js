/* Lo propio del celular: el "servidor" adentro de la app, impresión, copias, activación e instalación. */
'use strict';

const LISTO = SRV.abrir().then(() => SRV.copiaDiaria()).catch(e => {
  const pintar = () => { document.body.innerHTML = `<div style="padding:30px;font:16px Arial;line-height:1.5"><b>No se pudo abrir la app.</b><br>${String(e && e.message || e)}<br><br>
    Probá cerrarla y abrirla de nuevo. Si sigue igual, mandale esta pantalla a RoFac.</div>`; };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pintar); else pintar();
  throw e;
});
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { /* que el celular no borre los datos solo */ }

/* ---------- todos los pedidos que en la PC iban al programa ahora los atiende la app */
const _fetch = window.fetch.bind(window);
window.fetch = async (url, opt = {}) => {
  const u = typeof url === 'string' ? url : url.url;
  if (!/(^|\/)api\//.test(new URL(u, location.href).pathname)) return _fetch(url, opt);
  await LISTO;
  try {
    const r = await SRV.atender((opt.method || 'GET').toUpperCase(), u, opt.body);
    return new Response(JSON.stringify(r ?? {}), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    if (!(e instanceof SRV.ErrorNegocio)) console.error(e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), { status: e.status || (e instanceof SRV.ErrorNegocio ? 400 : 500), headers: { 'Content-Type': 'application/json' } });
  }
};

/* ---------- guardar / compartir un archivo (WhatsApp, Drive, mail…) o bajarlo a Descargas */
async function descargarArchivo(blob, nombre, texto) {
  const f = new File([blob], nombre, { type: blob.type || 'application/octet-stream' });
  if (navigator.canShare && navigator.canShare({ files: [f] })) {
    try { await navigator.share({ files: [f], title: nombre, text: texto || '' }); return true; }
    catch (e) { if (e.name === 'AbortError') return false; }
  }
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000);
  toast('Se guardó en Descargas: ' + nombre);
  return true;
}

/* ---------- imprimir / guardar en PDF: en el celular se muestra adentro de la app (no abre otra ventana) */
function imprimir(titulo, cuerpo, apaisado = false) {
  const viejo = document.getElementById('impCapa'); if (viejo) viejo.remove();
  const d = document.createElement('div');
  d.id = 'impCapa';
  d.innerHTML = `<style id="impEst">
    @page { size: A4 ${apaisado ? 'landscape' : 'portrait'}; margin: 10mm; }
    #impCapa { position: fixed; inset: 0; z-index: 9999; background: #fff; color: #222; overflow: auto; -webkit-overflow-scrolling: touch; }
    #impCapa .imp-barra { position: sticky; top: 0; display: flex; gap: 8px; align-items: center; padding: 10px 12px; background: var(--pri, #0e7c66); color: #fff; z-index: 2; }
    #impCapa .imp-barra b { flex: 1; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #impCapa .imp-barra button { padding: 9px 14px; border: 0; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer; background: #fff; color: var(--pri, #0e7c66); }
    #impCapa .imp-barra button.sec { background: rgba(255,255,255,.18); color: #fff; }
    #impCapa .imp-ayuda { font-size: 12.5px; color: #555; padding: 8px 14px; background: #f3f7f6; border-bottom: 1px solid #dde7e4; }
    #impCapa .imp-hoja { font-family: Arial, sans-serif; color: #222; font-size: 12px; padding: 14px; overflow-x: auto; }
    #impCapa h1 { font-size: 18px; margin: 0 0 2px; color: #222; } #impCapa .sub { color: #555; margin-bottom: 10px; }
    #impCapa table { width: 100%; border-collapse: collapse; margin-top: 6px; background: #fff; }
    #impCapa td, #impCapa th { border: 1px solid #999; padding: 3px 5px; text-align: left; vertical-align: top; color: #222; background: #fff; }
    #impCapa th { background: #eef2f6; font-size: 11px; } #impCapa .c { text-align: center; } #impCapa .r { text-align: right; } #impCapa .chico { font-size: 10px; }
    #impCapa .A, #impCapa .J { color: #b4202f; font-weight: bold; } #impCapa .T, #impCapa .R { color: #a35f00; font-weight: bold; } #impCapa .mal { color: #b4202f; font-weight: bold; }
    #impCapa .bloque { break-inside: avoid; margin-bottom: 14px; }
    @media print {
      body > *:not(#impCapa) { display: none !important; }
      html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
      #impCapa { position: static; overflow: visible; }
      #impCapa .imp-barra, #impCapa .imp-ayuda { display: none !important; }
      #impCapa .imp-hoja { padding: 0; overflow: visible; }
    }</style>
    <div class="imp-barra"><button class="sec" data-cerrar-imp>✕ Cerrar</button><b>${esc(titulo)}</b><button data-imp>Imprimir / PDF</button></div>
    <div class="imp-ayuda">Para guardarlo en PDF: tocá <b>Imprimir / PDF</b> y en "Impresora" elegí <b>Guardar como PDF</b>. Después lo podés mandar por WhatsApp.</div>
    <div class="imp-hoja">${cuerpo}<div style="text-align:center;font-size:9px;color:#999;margin-top:16px">${esc(CFG().nombre_consultorio || '')} · Agenda docente ${esc(marcaTexto())}</div></div>`;
  document.body.appendChild(d);
  const tituloViejo = document.title;
  const cerrar = () => { d.remove(); document.title = tituloViejo; };
  d.querySelector('[data-cerrar-imp]').onclick = () => { if (history.state && history.state.imp) history.back(); else cerrar(); };
  d.querySelector('[data-imp]').onclick = () => { document.title = titulo; window.print(); setTimeout(() => { document.title = tituloViejo; }, 1500); };
  /* el botón "atrás" del celular cierra la vista de impresión en vez de salir */
  history.pushState({ imp: 1 }, '', location.hash);
  const atras = e => { window.removeEventListener('popstate', atras, true); if (d.isConnected) { e.stopImmediatePropagation(); cerrar(); } };
  window.addEventListener('popstate', atras, true);
}

/* ---------- copias de seguridad */
const fechaHora = s => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)} ${s.slice(11, 16)}` : '';
const diasDesde = s => s ? Math.round((new Date(hoy() + 'T12:00:00') - new Date(s.slice(0, 10) + 'T12:00:00')) / 864e5) : null;
async function hacerCopia() {
  try {
    const z = await SRV.copiaZip(), nom = `docente_respaldo_${hoy()}.zip`;
    if (await descargarArchivo(z, nom, 'Copia de la Agenda Docente')) { await SRV.marcarCopia(); toast('Copia lista. Guardala en tu Google Drive o mandátela por WhatsApp.'); }
    if ($('#cfCopia')) tarjetaCopia($('#cfCopia'));
  } catch (e) { fallo(e); }
}
async function tarjetaCopia(el) {
  const ult = SRV.ultimaCopia(), n = SRV.resumen(), copias = await SRV.copiasInternas(), dias = diasDesde(ult);
  el.innerHTML = `<p style="margin-top:0;line-height:1.5">Todo queda guardado <b>en este celular</b> (${n.escuelas} escuelas, ${n.cursos} cursos, ${n.alumnos} alumnos, ${n.clases} clases).
      Si se rompe, se pierde o borrás los datos de Chrome sin copia, <b>se pierde todo</b>. Hacé una copia una vez por semana y guardala en tu <b>Google Drive</b> (o mandátela por WhatsApp).</p>
    <div class="${dias === null || dias > 7 ? 'neg' : 'pos'}" style="font-weight:700;margin-bottom:10px">${ult ? `Última copia: ${fechaHora(ult)} (hace ${dias} día${dias === 1 ? '' : 's'})` : 'Todavía no hiciste ninguna copia'}</div>
    <div class="inl"><button class="btn verde" id="cpHacer">${ico('bajar')} Hacer copia ahora</button>
      <label class="btn" style="margin:0">${ico('db')} Traer datos de la PC / restaurar una copia<input type="file" id="cpRest" accept=".zip,.db,application/zip,application/octet-stream" hidden></label></div>
    <div class="ayuda" style="margin-top:10px;line-height:1.5"><b>Si ya usás la Agenda Docente en la compu:</b> en el programa de la PC, Configuración > Respaldo > <b>"Descargar copia completa"</b> (.zip).
      Mandate ese archivo por WhatsApp o subilo a Drive, y acá tocá <b>"Traer datos de la PC"</b> y elegilo. Pasan las escuelas, cursos, alumnos, asistencia, notas, licencias y agenda.
      La copia del celular también se puede abrir en la PC (Configuración > restaurar copia).</div>
    ${copias.length ? `<details style="margin-top:10px"><summary class="muted">Copias automáticas adentro del celular (${copias.length})</summary>
      ${copias.map(c => `<div class="inl" style="margin:6px 0"><span class="sp">${c.k.startsWith('dia-') ? 'Del día ' + dmy(c.fecha) : 'Antes de restaurar · ' + c.fecha.slice(0, 10).split('-').reverse().join('/') + ' ' + c.fecha.slice(11, 16).replace('-', ':')}</span>
        <button class="btn chico" data-vc="${esc(c.k)}">Volver a esta</button></div>`).join('')}<div class="muted chico">Sirven si borraste algo sin querer.</div></details>` : ''}`;
  $('#cpHacer', el).onclick = hacerCopia;
  $('#cpRest', el).onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (!await confirmar(`Se van a <b>reemplazar todos los datos de este celular</b> por los de <b>${esc(f.name)}</b>.<br><br>Antes se guarda una copia automática de lo que hay ahora, por si acaso.`, 'Sí, reemplazar', true)) return;
    try { toast('Leyendo la copia…'); const r = await SRV.restaurar(f); ME = await api('/api/me'); pintarMarca(); pintarBannerLic();
      toast(`Listo: ${r.escuelas} escuelas, ${r.cursos} cursos, ${r.alumnos} alumnos`); ir('principal'); } catch (x) { fallo(x); }
  };
  el.onclick = async e => {
    const b = e.target.closest('[data-vc]'); if (!b) return;
    if (!await confirmar('¿Volver a como estaba en esa copia? Lo que cargaste después se pierde (antes se guarda una copia de lo de ahora).', 'Volver a esa copia', true)) return;
    try { await SRV.volverACopia(b.dataset.vc); ME = await api('/api/me'); pintarMarca(); pintarBannerLic(); toast('Listo'); ir('principal'); } catch (x) { fallo(x); }
  };
}
/* aviso arriba de "Hoy" si hace más de una semana que no se hace una copia */
window.RespaldoUI = { enganchar(main, id) {
  if (id !== 'principal') return;
  const n = SRV.resumen(); if (!n.alumnos && !n.clases) return;
  const dias = diasDesde(SRV.ultimaCopia());
  if (dias !== null && dias <= 7) return;
  const d = document.createElement('div'); d.className = 'card'; d.style.cssText = 'background:#fff4e0;border:1px solid #f2c27a;color:#7a4a00;display:flex;flex-wrap:wrap;gap:10px;align-items:center';
  d.innerHTML = `<b style="flex:1 1 220px">${dias === null ? 'Todavía no hiciste ninguna copia de seguridad.' : `Hace ${dias} días que no hacés una copia.`} Si el celular se rompe o se pierde, sin copia se pierde todo.</b>
    <button class="btn verde">${ico('bajar')} Hacer copia</button>`;
  d.querySelector('button').onclick = hacerCopia;
  main.prepend(d);
} };

/* ---------- activación */
function tarjetaActivacion(el) {
  const L = DocLic.estado(), ok = L.activa && !L.por_vencer;
  el.innerHTML = `<div class="inl" style="margin-bottom:12px">${ico(ok ? 'okc' : L.bloqueado ? 'lock' : 'alerta', `style="color:${ok ? 'var(--verde)' : L.bloqueado ? 'var(--rojo)' : 'var(--naranja)'}"`)} <b>${esc(L.mensaje)}</b></div>
    ${L.error_clave ? `<div class="aviso">${ico('alerta')} ${esc(L.error_clave)}</div>` : ''}
    ${L.activa ? '' : `<p style="margin-top:0;line-height:1.5">${L.bloqueado ? 'Para volver a cargar cosas, activá la app.' : 'Podés usarla completa durante la prueba. Para seguir usándola después, activala.'}
      Mandale a Rodrigo el código de este celular y él te pasa la clave.</p>`}
    <label>Código de este celular</label>
    <div class="inl"><input id="acCod" value="${esc(L.equipo)}" readonly style="font-family:monospace;font-size:18px;font-weight:700;max-width:230px">
      <button class="btn chico" type="button" id="acCopiar">${ico('copiar')} Copiar</button>
      <a class="btn chico verde" href="https://wa.me/?text=${encodeURIComponent(DocLic.textoWA())}" target="_blank" rel="noopener">${ico('wa')} Mandar por WhatsApp</a></div>
    <label style="margin-top:12px">${L.activa ? 'Clave nueva (cuando renueves)' : 'Clave que te pasó Rodrigo'}</label>
    <textarea id="acClave" rows="3" placeholder="DCM-2027…" autocomplete="off" autocapitalize="characters" spellcheck="false" style="font-family:monospace;font-size:12px;word-break:break-all"></textarea>
    <div class="neg" id="acErr" style="margin:6px 0;font-weight:700"></div>
    <button class="btn pri" id="acOk">${ico('llave')} Activar</button>`;
  $('#acCopiar', el).onclick = async () => { try { await navigator.clipboard.writeText(L.equipo); toast('Código copiado'); } catch (e) { $('#acCod', el).select(); document.execCommand('copy'); toast('Código copiado'); } };
  $('#acOk', el).onclick = async () => {
    const b = $('#acOk', el); b.disabled = true;
    const err = await DocLic.activar($('#acClave', el).value, SRV.setCfg);
    b.disabled = false;
    if (err) { $('#acErr', el).textContent = err; return; }
    ME = await api('/api/me'); pintarBannerLic();
    toast(DocLic.estado().mensaje); ir('config');
  };
}

/* ---------- apariencia: color, tipo de letra y tamaño (queda guardada en este celular) */
const Apariencia = (() => {
  const K = 'rofac_docente_apariencia';
  const COLORES = [['verde', 'Verde agua', '#0e7c66', '#06302a'], ['lila', 'Lila', '#8a5cc2', '#3b2457'], ['azul', 'Azul', '#2f6fb5', '#0f2a4a'],
    ['rosa', 'Rosa', '#d0568a', '#5a1f3d'], ['coral', 'Coral', '#e07048', '#5c2416'], ['grafito', 'Grafito', '#4b5563', '#1e2329']];
  const LETRAS = [['clasica', 'Clásica', 'system-ui, sans-serif'], ['redondeada', 'Redondeada', 'Poppins, sans-serif'], ['elegante', 'Elegante', 'Lora, Georgia, serif']];
  const TAMS = [['normal', 'Normal', 15], ['grande', 'Grande', 17], ['muy', 'Muy grande', 19]];
  const leer = () => { try { return Object.assign({ pal: 'verde', letra: 'clasica', tam: 'normal' }, JSON.parse(localStorage.getItem(K) || '{}')); } catch (e) { return { pal: 'verde', letra: 'clasica', tam: 'normal' }; } };
  function aplicar(a = leer()) {
    const h = document.documentElement;
    if (a.pal === 'verde') delete h.dataset.pal; else h.dataset.pal = a.pal;
    if (a.letra === 'clasica') delete h.dataset.letra; else h.dataset.letra = a.letra;
    if (a.tam === 'normal') delete h.dataset.tam; else h.dataset.tam = a.tam;
    const c = COLORES.find(x => x[0] === a.pal) || COLORES[0], m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = a.pal === 'verde' ? '#0e5c50' : c[3];     // color de la barra del celular
  }
  function guardar(k, v) { const a = leer(); a[k] = v; try { localStorage.setItem(K, JSON.stringify(a)); } catch (e) { /* */ } aplicar(a); }
  function tarjeta(el) {
    const a = leer();
    el.innerHTML = `<p style="margin-top:0" class="muted">Elegí cómo querés ver la app. Se cambia al instante y queda guardado en este celular.</p>
      <label>Color</label><div class="ap-fila">${COLORES.map(([k, n, c1, c2]) => `<button type="button" class="ap-color ${a.pal === k ? 'act' : ''}" data-ap="pal" data-v="${k}">
        <i style="background:linear-gradient(135deg, ${c2}, ${c1})"></i>${n}</button>`).join('')}</div>
      <label>Tipo de letra</label><div class="ap-fila">${LETRAS.map(([k, n, f]) => `<button type="button" class="ap-op ${a.letra === k ? 'act' : ''}" data-ap="letra" data-v="${k}">
        <b style="font-family:${f}">${n}</b><small style="font-family:${f}">Lunes 7:30 · 1° A</small></button>`).join('')}</div>
      <label>Tamaño de letra</label><div class="ap-fila">${TAMS.map(([k, n, px]) => `<button type="button" class="ap-op ${a.tam === k ? 'act' : ''}" data-ap="tam" data-v="${k}">
        <b style="font-size:${px}px">Aa</b><small>${n}</small></button>`).join('')}</div>
      <button type="button" class="btn chico" data-ap-reset>Volver a como venía</button>`;
    el.onclick = e => {
      const b = e.target.closest('[data-ap]');
      if (b) { guardar(b.dataset.ap, b.dataset.v); tarjeta(el); return; }
      if (e.target.closest('[data-ap-reset]')) { try { localStorage.removeItem(K); } catch (x) { /* */ } aplicar(); tarjeta(el); toast('Listo: volvió a como venía'); }
    };
  }
  aplicar();
  return { aplicar, tarjeta, leer };
})();

/* ---------- instalar la app */
let PEDIDO_INSTALAR = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); PEDIDO_INSTALAR = e; if ($('#cfApp')) tarjetaApp($('#cfApp')); });
window.addEventListener('appinstalled', () => { PEDIDO_INSTALAR = null; toast('¡Listo! Ya tenés la Agenda Docente en la pantalla del celular'); });
const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
async function tarjetaApp(el) {
  let espacio = '';
  try { const e = await navigator.storage.estimate(); espacio = `Ocupa ${(e.usage / 1048576).toFixed(1).replace('.', ',')} MB en el celular.`; } catch (e) { /* */ }
  let persiste = false; try { persiste = await navigator.storage.persisted(); } catch (e) { /* */ }
  el.innerHTML = instalada() ? `<p style="margin-top:0">✅ Instalada. Se abre desde el ícono, <b>sin internet</b>.</p>`
    : PEDIDO_INSTALAR ? `<p style="margin-top:0">Instalala para tenerla con su ícono en la pantalla y usarla sin internet.</p><button class="btn verde" id="apInst">${ico('bajar')} Instalar la app</button>`
    : `<p style="margin-top:0;line-height:1.5">Para instalarla: en Chrome tocá el menú <b>⋮</b> y elegí <b>"Instalar app"</b> o <b>"Agregar a la pantalla principal"</b>.
       En iPhone: Safari > <b>Compartir</b> > "Agregar a pantalla de inicio".</p>`;
  el.insertAdjacentHTML('beforeend', `<div class="muted chico">${espacio} ${persiste ? 'El celular no la borra solo.' : ''} · Agenda Docente ${esc(marcaTexto())}</div>`);
  if ($('#apInst', el)) $('#apInst', el).onclick = async () => { PEDIDO_INSTALAR.prompt(); await PEDIDO_INSTALAR.userChoice; PEDIDO_INSTALAR = null; tarjetaApp(el); };
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw', e));
