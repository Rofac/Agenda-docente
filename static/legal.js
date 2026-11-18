/* Términos de uso y aviso de privacidad + "Borrar definitivamente" (igual en todos los programas RoFac).
   Legal.revisar()                         → al entrar: si el admin no aceptó, muestra el cartel (no se puede cerrar)
   Legal.ver()                             → muestra los términos para leer (Configuración > Acerca de)
   Legal.borrar({url, nombre, que, anonimo, conserva, listo}) → pide escribir BORRAR y llama a url (POST {confirmar:'BORRAR'})
   (conserva: texto que reemplaza al de "lo contable se conserva", para programas sin nada contable) */
(function () {
  const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  async function pedir(url, datos) {
    const r = await fetch(url, datos === undefined ? { credentials: 'same-origin' }
      : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || 'Error ' + r.status); e.datos = j; throw e; }
    return j;
  }
  const ESTILO = `<style id="rfLegalEst">
    .rfl-fondo{position:fixed;inset:0;background:rgba(10,20,35,.62);z-index:99990;display:flex;align-items:center;justify-content:center;padding:14px}
    .rfl-caja{background:#fff;color:#1f2933;border-radius:14px;max-width:720px;width:100%;max-height:calc(100vh - 28px);display:flex;flex-direction:column;
      box-shadow:0 20px 60px rgba(0,0,0,.35);font-family:inherit}
    .rfl-cab{padding:16px 20px 10px;border-bottom:1px solid #e3e7ee}.rfl-cab h2{margin:0;font-size:19px}.rfl-cab div{font-size:12.5px;color:#6b7785;margin-top:3px}
    .rfl-txt{padding:12px 20px;overflow:auto;flex:1;font-size:14px;line-height:1.55}.rfl-txt h3{font-size:15px;margin:18px 0 6px}
    .rfl-txt ol{padding-left:20px;margin:6px 0}.rfl-txt ul{padding-left:18px;margin:6px 0}.rfl-txt li{margin-bottom:7px}
    .rfl-pie{padding:12px 20px 16px;border-top:1px solid #e3e7ee;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}
    .rfl-pie label{display:flex;gap:8px;align-items:flex-start;font-size:14px;font-weight:600;cursor:pointer;flex:1 1 260px;line-height:1.35}
    .rfl-pie input[type=checkbox]{width:20px;height:20px;flex:0 0 auto;margin:0}
    .rfl-btn{border:0;border-radius:9px;padding:11px 18px;font-weight:700;font-size:14px;cursor:pointer;background:#e9edf3;color:#1f2933}
    .rfl-btn.pri{background:#2563eb;color:#fff}.rfl-btn.rojo{background:#d93636;color:#fff}.rfl-btn:disabled{opacity:.45;cursor:not-allowed}
    .rfl-caja label{text-transform:none;letter-spacing:normal;color:inherit}
    .rfl-msg{color:#c0392b;font-size:13px;width:100%}.rfl-in{width:100%;padding:10px 12px;font-size:16px;border:1px solid #c9d1dc;border-radius:8px;
      letter-spacing:2px;text-transform:uppercase;box-sizing:border-box;margin-top:8px}
    :root[data-theme="dark"] .rfl-caja,body.oscuro .rfl-caja,body.dark .rfl-caja{background:#1d2633;color:#e6ebf2}
    :root[data-theme="dark"] .rfl-cab,:root[data-theme="dark"] .rfl-pie,body.oscuro .rfl-cab,body.oscuro .rfl-pie,body.dark .rfl-cab,body.dark .rfl-pie{border-color:#334155}
    :root[data-theme="dark"] .rfl-btn:not(.pri):not(.rojo),body.oscuro .rfl-btn:not(.pri):not(.rojo),body.dark .rfl-btn:not(.pri):not(.rojo){background:#334155;color:#e6ebf2}
    :root[data-theme="dark"] .rfl-in,body.oscuro .rfl-in,body.dark .rfl-in{background:#0f1722;color:#e6ebf2;border-color:#475569}
    @media (max-width:600px){.rfl-fondo{padding:0}.rfl-caja{border-radius:0;max-height:100vh;height:100%}.rfl-pie .rfl-btn{flex:1 1 100%}}
  </style>`;
  const estilo = () => { if (!document.getElementById('rfLegalEst')) document.head.insertAdjacentHTML('beforeend', ESTILO); };
  const fecha = v => v ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : '';
  const cuerpo = t => `<p>${h(t.encabezado)}</p><h3>Términos de licencia y uso</h3><ol>${t.terminos.map(x => `<li><b>${h(x.titulo)}.</b> ${h(x.texto)}</li>`).join('')}</ol>
    <h3>Aviso de privacidad</h3><ul>${t.privacidad.map(x => `<li>${h(x)}</li>`).join('')}</ul>`;
  function caja(html) {
    estilo();
    const d = document.createElement('div');
    d.className = 'rfl-fondo';
    d.innerHTML = `<div class="rfl-caja" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(d);
    // en el celular, si la pantalla de atrás es más ancha que el teléfono, el cartel se acomoda a lo que se ve
    const v = window.visualViewport;
    if (v) {
      const ajustar = () => {
        if (!d.isConnected) { v.removeEventListener('resize', ajustar); v.removeEventListener('scroll', ajustar); return; }
        Object.assign(d.style, { left: v.offsetLeft + 'px', top: v.offsetTop + 'px', width: v.width + 'px', height: v.height + 'px', right: 'auto', bottom: 'auto' });
      };
      ajustar(); v.addEventListener('resize', ajustar); v.addEventListener('scroll', ajustar);
    }
    return d;
  }
  function salir() { /* en el celular no hay usuarios: el cartel queda hasta aceptar */ }

  async function revisar() {
    let L;
    try { L = await pedir('/api/legal'); } catch (e) { return true; }
    if (L.aceptado || document.querySelector('.rfl-fondo')) return L.aceptado;
    if (!L.admin) {
      const d = caja(`<div class="rfl-cab"><h2>Términos de uso</h2></div>
        <div class="rfl-txt"><p style="font-size:15px">El administrador tiene que aceptar los términos de uso antes de empezar.</p>
        <p>Pedile que entre con su usuario: al ingresar le aparece un cartel para leerlos y aceptarlos.</p></div>
        <div class="rfl-pie"><span></span><button class="rfl-btn pri" data-salir>Salir</button></div>`);
      d.querySelector('[data-salir]').onclick = salir;
      return false;
    }
    const v = L.version;
    const d = caja(`<div class="rfl-cab"><h2>Términos de uso y aviso de privacidad</h2><div>Versión ${fecha(v)} · Leelos antes de empezar a usar el programa</div></div>
      <div class="rfl-txt">${cuerpo(L.textos)}</div>
      <div class="rfl-pie"><label><input type="checkbox" data-ok> Leí y acepto los términos de uso y el aviso de privacidad</label>
        <button class="rfl-btn pri" data-acepto disabled>Aceptar y empezar</button><div class="rfl-msg"></div></div>`);
    const chk = d.querySelector('[data-ok]'), btn = d.querySelector('[data-acepto]');
    chk.onchange = () => { btn.disabled = !chk.checked; };
    btn.onclick = async () => {
      btn.disabled = true;
      try { await pedir('/api/legal/aceptar', { acepto: true }); d.remove(); location.reload(); }
      catch (e) { d.querySelector('.rfl-msg').textContent = e.message; btn.disabled = false; }
    };
    return false;
  }

  async function ver() {
    let L;
    try { L = await pedir('/api/legal'); } catch (e) { return; }
    const d = caja(`<div class="rfl-cab"><h2>Términos de uso y aviso de privacidad</h2>
        <div>Versión ${fecha(L.version)}${L.aceptado && L.fecha ? ` · Aceptados el ${fecha(L.fecha)}${L.usuario ? ' por ' + h(L.usuario) : ''}` : ''}</div></div>
      <div class="rfl-txt">${cuerpo(L.textos)}</div>
      <div class="rfl-pie"><button class="rfl-btn" data-imp>Imprimir</button><button class="rfl-btn pri" data-cerrar>Cerrar</button></div>`);
    d.querySelector('[data-cerrar]').onclick = () => d.remove();
    d.querySelector('[data-imp]').onclick = () => { d.remove(); imprimir('Términos y privacidad', `<h1>Términos de uso y aviso de privacidad</h1><div class="sub">Versión ${fecha(L.version)}</div>${cuerpo(L.textos)}`); };
    d.onclick = e => { if (e.target === d) d.remove(); };
  }

  function borrar(o) {
    const d = caja(`<div class="rfl-cab"><h2>Borrar definitivamente</h2><div>${h(o.nombre || '')}</div></div>
      <div class="rfl-txt"><p>Se borran para siempre la ficha y todos sus datos personales${o.que ? ' (' + h(o.que) + ')' : ''}. <b>No se puede deshacer.</b></p>
        <p>${o.conserva ? h(o.conserva) : `Lo contable (ventas, cobros, caja) se conserva, pero a nombre de "<b>${h(o.anonimo || 'Cliente borrado')}</b>", para que las cuentas y los informes sigan dando.`}</p>
        <p>Sirve para cumplir cuando una persona pide que se borren sus datos (Ley 25.326).</p>
        <label style="font-weight:600">Para confirmar, escribí <b>BORRAR</b>:<input class="rfl-in" data-conf autocomplete="off"></label></div>
      <div class="rfl-pie"><button class="rfl-btn" data-cerrar>Cancelar</button><button class="rfl-btn rojo" data-borrar disabled>Borrar definitivamente</button><div class="rfl-msg"></div></div>`);
    const inp = d.querySelector('[data-conf]'), btn = d.querySelector('[data-borrar]');
    inp.oninput = () => { btn.disabled = inp.value.trim().toUpperCase() !== 'BORRAR'; };
    setTimeout(() => inp.focus(), 50);
    d.querySelector('[data-cerrar]').onclick = () => d.remove();
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        const r = await pedir(o.url, { ...(o.cuerpo || {}), confirmar: inp.value.trim().toUpperCase() });
        d.remove();
        if (o.listo) o.listo(r);
      } catch (e) {
        const m = d.querySelector('.rfl-msg');
        m.textContent = e.message;
        if (e.datos && e.datos.dar_baja && o.darBaja) {
          m.insertAdjacentHTML('afterend', `<button class="rfl-btn pri" data-baja>Dar de baja (conserva la historia)</button>`);
          d.querySelector('[data-baja]').onclick = async () => { d.remove(); o.darBaja(); };
        } else btn.disabled = false;
      }
    };
  }

  window.Legal = { revisar, ver, borrar };
})();
