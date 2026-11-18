/* Agenda Docente (celular) · prueba gratis y activación por celular.
   - Los primeros 30 días se usa gratis y completa. Después, sin activar, queda en SÓLO LECTURA (se ve todo y se pueden hacer copias,
     pero no se carga nada nuevo). Los datos nunca se borran.
   - Cada celular tiene su código (ej. 7F3A-91C2-04BD). Rodrigo genera la clave con generar_licencia_apps.py (opción Agenda Docente)
     y esa clave sirve SÓLO en ese celular, hasta la fecha que diga (normalmente un año).
   Clave: DCM-AAAAMMDD-firma(base32). Firma Ed25519 de "DCM|AGENDADOCENTE|AAAAMMDD|CODIGO". */
'use strict';
const DocLic = (() => {
  const PUBLICA = 'sHaxKKJiziuYbZxsQOkFnQA6U75PLAe6uNpgTsOl90E=';
  const PROG = 'DCM', NOMBRE = 'AGENDADOCENTE', DIAS_PRUEBA = 30, AVISO = 15;
  const K_EQ = 'rofac_docente_equipo', K_LIC = 'rofac_docente_lic', K_INI = 'rofac_docente_ini', K_ULT = 'rofac_docente_ult';
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  // ---------- código del celular (se crea una sola vez)
  function equipo() {
    let c = get(K_EQ);
    if (!/^[0-9A-F]{12}$/.test(c || '')) {
      const b = new Uint8Array(6); crypto.getRandomValues(b);
      c = Array.from(b, x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
      set(K_EQ, c);
    }
    return c;
  }
  const lindo = c => c.match(/.{4}/g).join('-');
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const hoy = () => iso(new Date());
  const entre = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);

  // ---------- Ed25519 (sólo verificar), igual que el de los programas
  const p = 2n ** 255n - 19n, L = 2n ** 252n + 27742317777372353535851937790883648493n;
  const md = a => { a %= p; return a < 0n ? a + p : a; };
  const pw = (b, e) => { let r = 1n; b = md(b); while (e > 0n) { if (e & 1n) r = r * b % p; b = b * b % p; e >>= 1n; } return r; };
  const d = md(-121665n * pw(121666n, p - 2n)), I2 = pw(2n, (p - 1n) / 4n);
  const leInt = b => { let n = 0n; for (let i = b.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(b[i]); return n; };
  function xrec(y, s) {
    const x2 = md((y * y - 1n) * pw(d * y * y + 1n, p - 2n));
    let x = pw(x2, (p + 3n) / 8n);
    if (md(x * x - x2)) x = x * I2 % p;
    if (md(x * x - x2)) throw new Error('punto');
    if ((x & 1n) !== s) x = p - x;
    return x;
  }
  const By = md(4n * pw(5n, p - 2n)), Bx = xrec(By, 0n), B = [Bx, By, 1n, Bx * By % p];
  function sum(P, Q) {
    const A = md((P[1] - P[0]) * (Q[1] - Q[0])), Bb = md((P[1] + P[0]) * (Q[1] + Q[0]));
    const C = md(2n * P[3] * Q[3] * d), D = md(2n * P[2] * Q[2]);
    const E = Bb - A, F = D - C, G = D + C, H = Bb + A;
    return [md(E * F), md(G * H), md(F * G), md(E * H)];
  }
  function mul(s, P) { let Q = [0n, 1n, 1n, 0n]; while (s > 0n) { if (s & 1n) Q = sum(Q, P); P = sum(P, P); s >>= 1n; } return Q; }
  const igual = (P, Q) => md(P[0] * Q[2] - Q[0] * P[2]) === 0n && md(P[1] * Q[2] - Q[1] * P[2]) === 0n;
  function dec(b) {
    if (b.length !== 32) throw new Error('largo');
    let y = leInt(b); const s = y >> 255n; y &= (1n << 255n) - 1n;
    if (y >= p) throw new Error('punto');
    const x = xrec(y, s); return [x, y, 1n, x * y % p];
  }
  async function verificar(pub, msg, firma) {
    try {
      if (firma.length !== 64) return false;
      const A = dec(pub), R = dec(firma.slice(0, 32)), s = leInt(firma.slice(32));
      if (s >= L) return false;
      const todo = new Uint8Array(64 + msg.length); todo.set(firma.slice(0, 32)); todo.set(pub, 32); todo.set(msg, 64);
      const k = leInt(new Uint8Array(await crypto.subtle.digest('SHA-512', todo))) % L;
      return igual(mul(s, B), sum(R, mul(k, A)));
    } catch (e) { return false; }
  }
  const b64 = t => Uint8Array.from(atob(t), c => c.charCodeAt(0));
  function b32(t) {
    const AB = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, val = 0; const out = [];
    for (const ch of t) { const i = AB.indexOf(ch); if (i < 0) return null; val = (val << 5) | i; bits += 5; if (bits >= 8) { bits -= 8; out.push((val >> bits) & 255); } }
    return new Uint8Array(out);
  }

  // ---------- revisar una clave: devuelve la fecha de vencimiento (AAAAMMDD) o null
  async function revisarClave(clave) {
    const t = String(clave || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const m = t.match(/^DCM-?(\d{8})-?([A-Z2-7]{100,})$/); if (!m) return null;
    const firma = b32(m[2]); if (!firma) return null;
    const msg = new TextEncoder().encode([PROG, NOMBRE, m[1], equipo()].join('|'));
    return (await verificar(b64(PUBLICA), msg, firma)) ? m[1] : null;
  }
  const fechaTxt = v => !v ? '' : v === '99991231' ? 'sin vencimiento' : v.slice(6) + '/' + v.slice(4, 6) + '/' + v.slice(0, 4);
  const aIso = v => v.slice(0, 4) + '-' + v.slice(4, 6) + '-' + v.slice(6);

  // ---------- estado: activada, prueba con días restantes, o sólo lectura
  let VENCE = null, INI = '', ULT = '', ATRASADO = false, CLAVE_MAL = '';
  async function revisar(cfg, guardar) {
    // la fecha de inicio de la prueba se guarda en el celular y en la base: así borrar una de las dos no la reinicia
    const h = hoy();
    INI = [get(K_INI), cfg.cel_prueba_inicio, h].filter(Boolean).sort()[0];
    ULT = [get(K_ULT), cfg.cel_prueba_ultima].filter(Boolean).sort().pop() || h;
    ATRASADO = h < ULT;
    ULT = ULT > h ? ULT : h;
    set(K_INI, INI); set(K_ULT, ULT);
    if (guardar && (cfg.cel_prueba_inicio !== INI || cfg.cel_prueba_ultima !== ULT)) { guardar('cel_prueba_inicio', INI); guardar('cel_prueba_ultima', ULT); }
    const clave = get(K_LIC) || cfg.cel_licencia || '';
    VENCE = await revisarClave(clave);
    CLAVE_MAL = clave && !VENCE ? 'La clave guardada no corresponde a este celular' : '';
    if (VENCE && !get(K_LIC)) set(K_LIC, clave);
  }
  function estado() {
    const h = hoy(), eq = lindo(equipo());
    if (VENCE && (VENCE === '99991231' || aIso(VENCE) >= h)) {
      const o = { activa: true, demo: false, bloqueado: false, equipo: eq, vence: VENCE === '99991231' ? '' : aIso(VENCE),
        mensaje: VENCE === '99991231' ? 'App activada sin vencimiento' : 'App activada hasta el ' + fechaTxt(VENCE) };
      if (o.vence) {
        const n = entre(h, o.vence);
        if (n <= AVISO) Object.assign(o, { por_vencer: true, dias_restantes: n,
          mensaje: `La activación vence ${n === 0 ? 'HOY' : n === 1 ? 'mañana' : 'en ' + n + ' días'} (${fechaTxt(VENCE)}). Pedí la clave nueva para no quedar en sólo lectura.` });
      }
      return o;
    }
    const usados = entre(INI || h, ULT || h), restan = DIAS_PRUEBA - usados;
    const o = { activa: false, demo: true, equipo: eq, dias_restantes: Math.max(restan, 0), inicio: INI };
    if (CLAVE_MAL) o.error_clave = CLAVE_MAL;
    if (VENCE) Object.assign(o, { bloqueado: true, vence: aIso(VENCE), mensaje: 'La activación venció el ' + fechaTxt(VENCE) + '. La app quedó en sólo lectura: tus datos siguen guardados.' });
    else if (ATRASADO) Object.assign(o, { bloqueado: true, mensaje: 'La fecha del celular está atrasada. Corregila para seguir usando la app.' });
    else if (restan <= 0) Object.assign(o, { bloqueado: true, mensaje: `Terminó la prueba gratis de ${DIAS_PRUEBA} días. La app quedó en sólo lectura: tus datos siguen guardados.` });
    else Object.assign(o, { bloqueado: false, mensaje: 'Prueba gratis: ' + (restan === 1 ? 'último día' : 'quedan ' + restan + ' días') });
    return o;
  }
  /* devuelve '' si quedó activada, o el texto del problema */
  async function activar(clave, guardar) {
    const v = await revisarClave(clave);
    if (!v) return 'Esa clave no es para este celular. Fijate que esté completa, o mandale de nuevo tu código a Rodrigo.';
    if (v !== '99991231' && aIso(v) < hoy()) return 'Esa clave ya está vencida (' + fechaTxt(v) + '). Pedile una nueva a Rodrigo.';
    const c = String(clave).trim().toUpperCase().replace(/\s+/g, '');
    set(K_LIC, c); VENCE = v; CLAVE_MAL = '';
    if (guardar) await guardar('cel_licencia', c);
    return '';
  }
  const textoWA = () => 'Hola, este es el código de mi celular para la Agenda Docente: ' + lindo(equipo());
  return { revisar, estado, activar, equipo: () => lindo(equipo()), textoWA, fechaTxt, vence: () => VENCE };
})();
