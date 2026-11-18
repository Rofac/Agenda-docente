/* Agenda Docente en el celular: el mismo "servidor" del programa de la PC (app.py), pero corriendo adentro del navegador.
   La base es SQLite con las mismas tablas que en la PC (así una copia se puede pasar de una a otra) y se guarda en el celular (IndexedDB).
   No hay usuarios ni contraseñas: el celular es personal. */
'use strict';

const SRV = (() => {
  const MARCA = 'RoFac', VERSION = '1.0';

  /* ------------------------------------------------ base (igual que db.py) */
  const SCHEMA = `
CREATE TABLE IF NOT EXISTS config (clave TEXT PRIMARY KEY, valor TEXT);
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT, usuario TEXT UNIQUE NOT NULL, nombre TEXT DEFAULT '', clave TEXT NOT NULL,
    rol TEXT DEFAULT 'USUARIO', permisos TEXT DEFAULT '', activo INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS actividad (id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT NOT NULL, usuario TEXT NOT NULL, accion TEXT NOT NULL, detalle TEXT DEFAULT '');
CREATE INDEX IF NOT EXISTS idx_act ON actividad(usuario, fecha);
CREATE TABLE IF NOT EXISTS escuelas (
    id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, numero TEXT DEFAULT '', nivel TEXT DEFAULT '',
    localidad TEXT DEFAULT '', direccion TEXT DEFAULT '', telefono TEXT DEFAULT '', directivo TEXT DEFAULT '',
    color TEXT DEFAULT '#3b82f6', notas TEXT DEFAULT '', activo INTEGER DEFAULT 1, orden INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS cargos (
    id INTEGER PRIMARY KEY AUTOINCREMENT, escuela_id INTEGER NOT NULL REFERENCES escuelas(id),
    descripcion TEXT NOT NULL, tipo TEXT DEFAULT 'HORAS', horas REAL DEFAULT 0, situacion TEXT DEFAULT '',
    desde TEXT DEFAULT '', hasta TEXT DEFAULT '', notas TEXT DEFAULT '', activo INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS cursos (
    id INTEGER PRIMARY KEY AUTOINCREMENT, escuela_id INTEGER NOT NULL REFERENCES escuelas(id), cargo_id INTEGER,
    ciclo INTEGER NOT NULL, anio TEXT DEFAULT '', division TEXT DEFAULT '', materia TEXT DEFAULT '', turno TEXT DEFAULT '',
    notas TEXT DEFAULT '', activo INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS horarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT, escuela_id INTEGER NOT NULL REFERENCES escuelas(id), curso_id INTEGER, cargo_id INTEGER,
    dia INTEGER NOT NULL, desde TEXT NOT NULL, hasta TEXT NOT NULL, detalle TEXT DEFAULT '', aula TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT NOT NULL, hora TEXT DEFAULT '', hora_fin TEXT DEFAULT '',
    titulo TEXT NOT NULL, tipo TEXT DEFAULT 'OTRO', escuela_id INTEGER, curso_id INTEGER, notas TEXT DEFAULT '',
    hecho INTEGER DEFAULT 0, creado TEXT);
CREATE INDEX IF NOT EXISTS idx_ev ON eventos(fecha);
CREATE TABLE IF NOT EXISTS dias_especiales (
    id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT NOT NULL, hasta TEXT DEFAULT '', nombre TEXT NOT NULL,
    tipo TEXT DEFAULT 'FERIADO', escuela_id INTEGER);
CREATE TABLE IF NOT EXISTS articulos (
    id INTEGER PRIMARY KEY AUTOINCREMENT, codigo TEXT DEFAULT '', descripcion TEXT NOT NULL,
    dias_anio REAL DEFAULT 0, computo TEXT DEFAULT 'CORRIDOS',
    certificado INTEGER DEFAULT 0, notas TEXT DEFAULT '', activo INTEGER DEFAULT 1, orden INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS licencias (
    id INTEGER PRIMARY KEY AUTOINCREMENT, articulo_id INTEGER REFERENCES articulos(id), escuela_id INTEGER, cargo_id INTEGER,
    desde TEXT NOT NULL, hasta TEXT NOT NULL, dias REAL DEFAULT 0, motivo TEXT DEFAULT '',
    estado TEXT DEFAULT 'OTORGADA', certificado INTEGER DEFAULT 0, expediente TEXT DEFAULT '', notas TEXT DEFAULT '', creado TEXT);
CREATE INDEX IF NOT EXISTS idx_lic ON licencias(desde);
CREATE TABLE IF NOT EXISTS alumnos (
    id INTEGER PRIMARY KEY AUTOINCREMENT, curso_id INTEGER NOT NULL REFERENCES cursos(id),
    apellido TEXT NOT NULL, nombre TEXT DEFAULT '', dni TEXT DEFAULT '', tutor TEXT DEFAULT '', telefono TEXT DEFAULT '',
    notas TEXT DEFAULT '', activo INTEGER DEFAULT 1, baja TEXT DEFAULT '', alta TEXT DEFAULT '');
CREATE INDEX IF NOT EXISTS idx_alu ON alumnos(curso_id);
CREATE TABLE IF NOT EXISTS clases (
    id INTEGER PRIMARY KEY AUTOINCREMENT, curso_id INTEGER NOT NULL REFERENCES cursos(id), fecha TEXT NOT NULL,
    hubo INTEGER DEFAULT 1, motivo TEXT DEFAULT '', tema TEXT DEFAULT '', actividades TEXT DEFAULT '', tarea TEXT DEFAULT '',
    UNIQUE(curso_id, fecha));
CREATE TABLE IF NOT EXISTS asistencia (
    clase_id INTEGER NOT NULL REFERENCES clases(id) ON DELETE CASCADE, alumno_id INTEGER NOT NULL REFERENCES alumnos(id),
    estado TEXT NOT NULL DEFAULT 'P', PRIMARY KEY (clase_id, alumno_id));
CREATE TABLE IF NOT EXISTS evaluaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT, curso_id INTEGER NOT NULL REFERENCES cursos(id), fecha TEXT DEFAULT '',
    titulo TEXT NOT NULL, tipo TEXT DEFAULT 'Prueba', periodo INTEGER DEFAULT 1, peso REAL DEFAULT 1, notas TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS notas (
    evaluacion_id INTEGER NOT NULL REFERENCES evaluaciones(id) ON DELETE CASCADE, alumno_id INTEGER NOT NULL REFERENCES alumnos(id),
    valor TEXT DEFAULT '', PRIMARY KEY (evaluacion_id, alumno_id));
CREATE TABLE IF NOT EXISTS cierres (
    curso_id INTEGER NOT NULL, alumno_id INTEGER NOT NULL, periodo INTEGER NOT NULL,
    nota TEXT DEFAULT '', PRIMARY KEY (curso_id, alumno_id, periodo));
CREATE TABLE IF NOT EXISTS observaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT, alumno_id INTEGER NOT NULL REFERENCES alumnos(id), fecha TEXT NOT NULL,
    tipo TEXT DEFAULT 'OTRA', texto TEXT NOT NULL, padres INTEGER DEFAULT 0, hablado TEXT DEFAULT '', hablado_nota TEXT DEFAULT '', acta_id INTEGER, creado TEXT);
CREATE INDEX IF NOT EXISTS idx_obs ON observaciones(alumno_id);
CREATE TABLE IF NOT EXISTS actas (
    id INTEGER PRIMARY KEY AUTOINCREMENT, curso_id INTEGER NOT NULL REFERENCES cursos(id), fecha TEXT NOT NULL, hora TEXT DEFAULT '',
    encabezado TEXT DEFAULT '', espacio TEXT DEFAULT '', curso_txt TEXT DEFAULT '', profesor TEXT DEFAULT '', situacion TEXT NOT NULL,
    cierre TEXT DEFAULT '', creado TEXT);
CREATE TABLE IF NOT EXISTS acta_alumnos (acta_id INTEGER NOT NULL REFERENCES actas(id) ON DELETE CASCADE, alumno_id INTEGER NOT NULL REFERENCES alumnos(id),
    PRIMARY KEY (acta_id, alumno_id));
CREATE TABLE IF NOT EXISTS gasto_cats (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, emoji TEXT DEFAULT '', orden INTEGER DEFAULT 0, activo INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS gastos (
    id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT NOT NULL, monto REAL NOT NULL, categoria_id INTEGER REFERENCES gasto_cats(id),
    medio TEXT DEFAULT '', detalle TEXT DEFAULT '', creado TEXT);
CREATE INDEX IF NOT EXISTS idx_gastos ON gastos(fecha);`;
  /* gastos (sólo en el celular): categorías con las que arranca; después cada una agrega o borra las suyas */
  const CATS_GASTO = [['📄', 'Fotocopias e impresiones'], ['✏️', 'Materiales'], ['🚌', 'Transporte / viajes'], ['🎓', 'Cursos y capacitaciones'],
    ['📚', 'Libros'], ['📱', 'Celular / internet'], ['📦', 'Otros']];
  const MEDIOS = { EFECTIVO: 'Efectivo', DEBITO: 'Débito', CREDITO: 'Crédito', TRANSFERENCIA: 'Transferencia', MERCADOPAGO: 'Mercado Pago', OTRO: 'Otro' };
  const MIGRACIONES = {
    articulos: [['articulo', "TEXT DEFAULT ''"], ['situacion', "TEXT DEFAULT ''"], ['tope_tipo', "TEXT DEFAULT ''"], ['tope_texto', "TEXT DEFAULT ''"]],
    licencias: [['grupo', "TEXT DEFAULT ''"]],
  };
  const DEFAULT_CONFIG = {
    nombre_consultorio: '', dni: '', provincia: 'Chaco', telefono: '', ciclo_inicio: '', ciclo_fin: '', periodos: '3', periodo1_fin: '', periodo2_fin: '',
    valor_tarde: '0.5', cuenta_justificadas: '1', asistencia_minima: '75', nota_aprobacion: '6', pedir_clave: '1', licencia: '', minutos_inactividad: '0',
  };
  /* Nomenclador de licencias: motivo, código, artículo, situación, días, tipo de tope, texto del tope, certificado */
  const NOMENCLADOR = [
    ['Enfermedad o lesión común', '111', '309 B1', 'TITULAR', 45, 'ANIO', '', 1],
    ['Enfermedad o lesión común', '113', '331 A', 'INTERINO', 30, 'ANIO', '', 1],
    ['Enfermedad o lesión común', '114', '340 A', 'SUPLENTE', 15, 'ANIO', '', 1],
    ['Enfermedad de largo tratamiento (con goce)', '121', '309 B2', 'TITULAR', 0, '', '2 años', 1],
    ['Enfermedad de largo tratamiento (50%)', '122', '309 B2', 'TITULAR', 0, '', '1 año', 1],
    ['Enfermedad de largo tratamiento (con goce)', '125', '331 D', 'INTERINO', 0, '', '2 años', 1],
    ['Enfermedad de largo tratamiento (50%)', '126', '331 D', 'INTERINO', 0, '', '1 año', 1],
    ['Enfermedad de largo tratamiento (con goce)', '127', '340 B', 'SUPLENTE', 0, '', '2 años', 1],
    ['Enfermedad de largo tratamiento (50%)', '128', '340 B', 'SUPLENTE', 0, '', '1 año', 1],
    ['Gravidez y maternidad', '141', '309 C', 'TITULAR', 180, 'LICENCIA', '', 1],
    ['Gravidez y maternidad', '145', '331 C', 'INTERINO', 180, 'LICENCIA', '', 1],
    ['Gravidez y maternidad', '147', '340 C', 'SUPLENTE', 180, 'LICENCIA', '', 1],
    ['Enfermedad de un miembro del grupo familiar', '151', '309 D', 'TITULAR', 28, 'ANIO', '', 1],
    ['Enfermedad de un miembro del grupo familiar', '155', '331 E', 'INTERINO', 10, 'ANIO', '', 1],
    ['Enfermedad de un miembro del grupo familiar', '156', '340 E', 'SUPLENTE', 5, 'ANIO', '', 1],
    ['Natalicio', '3111', '320 H', 'TITULAR', 1, 'ANIO', '', 0],
    ['Natalicio', '3112', '334 I', 'INTERINO', 1, 'ANIO', '', 0],
    ['Natalicio', '3113', '343 H', 'SUPLENTE', 1, 'ANIO', '', 0],
    ['Examen', '291', '318 H', 'TITULAR', 30, 'ANIO', '', 1],
    ['Examen', '292', '333 D', 'INTERINO', 16, 'ANIO', '', 1],
    ['Duelo', '341', '320 F', 'TITULAR', 0, '', 'Según parentesco (revisar)', 1],
    ['Duelo', '344', '334 E', 'INTERINO', 0, '', 'Según parentesco (revisar)', 1],
    ['Duelo', '347', '343 E', 'SUPLENTE', 0, '', 'Según parentesco (revisar)', 1],
    ['Inasistencias justificadas', '2131', '323', 'TITULAR', 10, 'ANIO', '', 0],
    ['Inasistencias justificadas', '2133', '336', 'INTERINO', 5, 'ANIO', '', 0],
    ['Inasistencias justificadas', '2134', '345', 'SUPLENTE', 3, 'ANIO', '', 0],
    ['Ascenso de jerarquía', '2111', '319', 'TITULAR', 0, '', 'Según designación', 0],
    ['Ascenso de jerarquía', '2112', '333 E', 'INTERINO', 0, '', 'Según designación', 0],
    ['Ascenso de jerarquía', '2113', '342 E', 'SUPLENTE', 0, '', 'Según designación', 0],
    ['Extraordinaria (Papanicolau, colposcopía, mamografía)', '2161', '318 G', 'TITULAR', 1, 'LICENCIA', '', 1],
    ['Extraordinaria (Papanicolau, colposcopía, mamografía)', '2162', '333 C', 'INTERINO', 1, 'LICENCIA', '', 1],
    ['Extraordinaria (Papanicolau, colposcopía, mamografía)', '2163', '342 C', 'SUPLENTE', 1, 'LICENCIA', '', 1],
    ['Prórroga de licencia por razones de salud', '161', '347', 'TITULAR', 0, '', 'Según prescripción médica', 1],
    ['Prórroga de licencia por razones de salud', '165', '347', 'INTERINO', 0, '', 'Según prescripción médica', 1],
    ['Prórroga de licencia por razones de salud', '169', '347', 'SUPLENTE', 0, '', 'Según prescripción médica', 1],
    ['Nacimiento de un hijo', '311', '320 A', 'TITULAR', 15, 'LICENCIA', '', 1],
    ['Nacimiento de un hijo', '313', '334 A', 'INTERINO', 15, 'LICENCIA', '', 1],
    ['Nacimiento de un hijo', '314', '343 A', 'SUPLENTE', 15, 'LICENCIA', '', 1],
    ['Candidato', '351', '321', 'TITULAR', 0, '', 'Desde 24 hs de oficializadas las listas', 0],
    ['Candidato', '352', '334 F', 'INTERINO', 0, '', 'Desde 24 hs de oficializadas las listas', 0],
    ['Candidato', '353', '343 I', 'SUPLENTE', 0, '', 'Desde 24 hs de oficializadas las listas', 0],
    ['Donación de sangre', '381', '320 C', 'TITULAR', 1, 'LICENCIA', '', 1],
    ['Donación de sangre', '382', '334 B', 'INTERINO', 1, 'LICENCIA', '', 1],
    ['Donación de sangre', '383', '343 B', 'SUPLENTE', 1, 'LICENCIA', '', 1],
    ['Licencia anual', '211', '309 A', 'TITULAR', 60, 'ANIO', '', 0],
    ['Licencia anual', '213', '330', 'INTERINO', 60, 'ANIO', '', 0],
    ['Licencia anual', '214', '339', 'SUPLENTE', 60, 'ANIO', '', 0],
    ['Paro / medida de fuerza', '', '', '', 0, '', 'No es licencia: queda anotado', 0],
  ];

  class ErrorNegocio extends Error {}
  const E = m => { throw new ErrorNegocio(m); };

  /* ------------------------------------------------ guardado en el celular (IndexedDB) */
  let IDB = null, SQL = null, DB = null;
  const idbAbrir = () => new Promise((ok, mal) => {
    const r = indexedDB.open('rofac_docente', 1);
    r.onupgradeneeded = () => { const d = r.result; for (const t of ['base', 'copias']) if (!d.objectStoreNames.contains(t)) d.createObjectStore(t); };
    r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error);
  });
  const idb = (store, modo, f) => new Promise((ok, mal) => {
    const tx = IDB.transaction(store, modo), s = tx.objectStore(store); let res;
    const q = f(s); if (q) q.onsuccess = () => { res = q.result; };
    tx.oncomplete = () => ok(res); tx.onerror = () => mal(tx.error); tx.onabort = () => mal(tx.error || new Error('No se pudo guardar en el celular'));
  });
  const idbGet = (st, k) => idb(st, 'readonly', s => s.get(k));
  const idbPut = (st, k, v) => idb(st, 'readwrite', s => s.put(v, k));
  const idbDel = (st, k) => idb(st, 'readwrite', s => s.delete(k));
  const idbKeys = st => idb(st, 'readonly', s => s.getAllKeys());

  let guardando = Promise.resolve();
  function guardarBase() {   // en orden, una escritura después de la otra
    const datos = DB.export();
    guardando = guardando.then(() => idbPut('base', 'docente.db', datos)).catch(e => { console.error(e); alert('No se pudo guardar en el celular: ' + e.message); });
    return guardando;
  }

  /* ------------------------------------------------ SQL */
  const lim = v => v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v;
  function q(sql, par = []) {
    const st = DB.prepare(sql); st.bind(par.map(lim)); const out = [];
    while (st.step()) out.push(st.getAsObject());
    st.free(); return out;
  }
  const q1 = (sql, par) => q(sql, par)[0] || null;
  const val = (sql, par) => { const r = q1(sql, par); return r ? Object.values(r)[0] : null; };
  function run(sql, par = []) { DB.run(sql, par.map(lim)); return val('SELECT last_insert_rowid()'); }

  /* ------------------------------------------------ utilidades (iguales a las de app.py) */
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const hoy = () => iso(new Date());
  const ahora = () => { const d = new Date(); return iso(d) + ' ' + d.toTimeString().slice(0, 8); };
  const masDias = (f, n) => { const d = new Date(f.slice(0, 10) + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
  const entreDias = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
  const wd = f => (new Date(f + 'T12:00:00').getDay() + 6) % 7;          // 0 = lunes (como weekday() de Python)
  const anioHoy = () => +hoy().slice(0, 4);
  const finDeMes = f => { const d = new Date(+f.slice(0, 4), +f.slice(5, 7), 0, 12); return iso(d); };
  const r2 = x => Math.round((Number(x || 0) + 0.0000001) * 100) / 100;
  const fg = x => String(+Number(x).toPrecision(6));                       // "%g" de Python
  const sum = (l, f) => l.reduce((s, x) => s + (f ? f(x) : x), 0);
  const ent = v => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; };   // int(x or 0)
  const idOrNull = v => ent(v) || null;
  function num(v) {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'number') return v;
    let s = String(v).trim().replace(/[$\s ]/g, '');
    if (!s) return 0;
    const neg = s.startsWith('-'); s = s.replace(/^[+-]+/, '');
    if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (s.includes(',')) s = (s.match(/,/g).length === 1) ? s.replace(',', '.') : s.replace(/,/g, '');
    else if (s.includes('.') && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    else if (s.includes('.') && !/^\d+\.\d{1,2}$/.test(s)) s = s.replace(/\./g, '');
    if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') E('Importe inválido: ' + v);
    const x = parseFloat(s);
    if (!isFinite(x)) E('Importe inválido: ' + v);
    return neg ? -x : x;
  }
  function entero(v, campo = 'El número', defecto = 0) {
    if (v === null || v === undefined || v === '') return defecto;
    const s = String(v).trim();
    if (!/^[+-]?\d+$/.test(s)) E(`${campo} tiene que ser un número (escribiste "${v}")`);
    return parseInt(s, 10);
  }
  const fechaOk = (v, campo = 'fecha') => { const s = String(v || '').slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(new Date(s + 'T12:00:00')) || iso(new Date(s + 'T12:00:00')) !== s) E('Falta o es inválida la ' + campo); return s; };
  const txt = (v, largo = 200) => String(v || '').split(/\s+/).filter(Boolean).join(' ').slice(0, largo);
  const strip = v => String(v || '').trim();
  function hora(v, campo = 'hora') {
    v = strip(v); if (!v) return '';
    const m = v.match(/^(\d{1,2})[:.](\d{2})$/);
    if (!m || +m[1] > 23 || +m[2] > 59) E(`La ${campo} tiene que ser como 07:30`);
    return String(+m[1]).padStart(2, '0') + ':' + m[2];
  }
  function* rango(desde, hasta) { let d = desde; while (d <= hasta) { yield d; d = masDias(d, 1); } }
  const cfgFloat = (cfg, k, def) => { const x = parseFloat(String(cfg[k] || def).replace(',', '.')); return isNaN(x) ? def : x; };
  const getConfig = () => Object.fromEntries(q('SELECT clave, valor FROM config').map(r => [r.clave, r.valor]));
  const setCfg = (k, v) => run('INSERT OR REPLACE INTO config(clave, valor) VALUES (?, ?)', [k, String(v)]);
  const uuid12 = () => { const b = new Uint8Array(6); crypto.getRandomValues(b); return Array.from(b, x => x.toString(16).padStart(2, '0')).join(''); };

  /* ------------------------------------------------ feriados nacionales (feriados.py) */
  const INAMOVIBLES = [[[1, 1], 'Año Nuevo'], [[3, 24], 'Día Nacional de la Memoria por la Verdad y la Justicia'],
    [[4, 2], 'Día del Veterano y de los Caídos en la Guerra de Malvinas'], [[5, 1], 'Día del Trabajador'], [[5, 25], 'Día de la Revolución de Mayo'],
    [[6, 20], 'Paso a la Inmortalidad del Gral. Manuel Belgrano'], [[7, 9], 'Día de la Independencia'], [[12, 8], 'Inmaculada Concepción de María'], [[12, 25], 'Navidad']];
  const TRASLADABLES = [[[6, 17], 'Paso a la Inmortalidad del Gral. Martín Miguel de Güemes'], [[8, 17], 'Paso a la Inmortalidad del Gral. José de San Martín'],
    [[10, 12], 'Día del Respeto a la Diversidad Cultural'], [[11, 20], 'Día de la Soberanía Nacional']];
  const PUENTES = { 2025: ['2025-05-02', '2025-08-15', '2025-11-21'], 2026: ['2026-03-23', '2026-07-10', '2026-12-07'] };
  const fd = (a, m, d) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  function pascua(anio) {
    const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    return fd(anio, Math.floor((h + l - 7 * m + 114) / 31), (h + l - 7 * m + 114) % 31 + 1);
  }
  const trasladar = f => { const w = wd(f); if (w === 1 || w === 2) return masDias(f, -w); if (w === 3 || w === 4) return masDias(f, 7 - w); return f; };
  function delAnio(anio) {
    const out = INAMOVIBLES.map(([[m, d], n]) => ({ fecha: fd(anio, m, d), nombre: n, tipo: 'FERIADO', original: '' }));
    const p = pascua(anio);
    out.push({ fecha: masDias(p, -48), nombre: 'Carnaval', tipo: 'FERIADO', original: '' }, { fecha: masDias(p, -47), nombre: 'Carnaval', tipo: 'FERIADO', original: '' },
      { fecha: masDias(p, -3), nombre: 'Jueves Santo', tipo: 'NO_LABORABLE', original: '' }, { fecha: masDias(p, -2), nombre: 'Viernes Santo', tipo: 'FERIADO', original: '' });
    for (const [[m, d], n] of TRASLADABLES) { const o = fd(anio, m, d), nv = trasladar(o); out.push({ fecha: nv, nombre: n, tipo: 'FERIADO', original: nv !== o ? o : '' }); }
    for (const f of PUENTES[anio] || []) out.push({ fecha: f, nombre: 'Día no laborable con fines turísticos', tipo: 'PUENTE', original: '' });
    return out.sort((a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0);
  }

  /* ------------------------------------------------ abrir / crear la base (init_db) */
  function initDb() {
    DB.exec('PRAGMA foreign_keys = ON;');
    DB.exec(SCHEMA);
    for (const [t, cols] of Object.entries(MIGRACIONES)) {
      const ex = q(`PRAGMA table_info(${t})`).map(c => c.name);
      for (const [c, tipo] of cols) if (!ex.includes(c)) DB.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${tipo}`);
    }
    for (const [k, v] of Object.entries(DEFAULT_CONFIG)) run('INSERT OR IGNORE INTO config(clave, valor) VALUES (?, ?)', [k, v]);
    if (!q1("SELECT 1 FROM config WHERE clave = 'nomenclador_cargado'")) {
      const usados = new Set(q('SELECT DISTINCT articulo_id AS a FROM licencias').map(r => r.a));
      for (const r of q("SELECT id FROM articulos WHERE codigo = ''")) {
        if (usados.has(r.id)) run('UPDATE articulos SET activo = 0 WHERE id = ?', [r.id]); else run('DELETE FROM articulos WHERE id = ?', [r.id]);
      }
      const ya = new Set(q("SELECT codigo FROM articulos WHERE codigo != ''").map(r => r.codigo));
      let orden = val('SELECT COALESCE(MAX(orden), 0) FROM articulos');
      for (const [mot, cod, art, sit, dias, tt, tx, cert] of NOMENCLADOR) {
        if (cod && ya.has(cod)) continue;
        orden += 1;
        run('INSERT INTO articulos(descripcion, codigo, articulo, situacion, dias_anio, tope_tipo, tope_texto, computo, certificado, orden) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [mot, cod, art, sit, dias, tt, tx, 'CORRIDOS', cert, orden]);
      }
      setCfg('nomenclador_cargado', '1');
    }
    if (!q1("SELECT 1 FROM config WHERE clave = 'gastos_cats_cargadas'")) {
      if (!q1('SELECT 1 FROM gasto_cats')) CATS_GASTO.forEach(([e, n], i) => run('INSERT INTO gasto_cats(nombre, emoji, orden) VALUES (?,?,?)', [n, e, i + 1]));
      setCfg('gastos_cats_cargadas', '1');
    }
  }
  async function abrir() {
    IDB = await idbAbrir();
    SQL = SQL || await initSqlJs({ locateFile: f => 'lib/' + f });
    const datos = await idbGet('base', 'docente.db');
    DB = datos ? new SQL.Database(datos) : new SQL.Database();
    initDb();
    await guardarBase();
    await DocLic.revisar(getConfig(), (k, v) => setCfg(k, v));
  }
  /* una base nueva (la que vino de la PC o de una copia): se revisa antes de reemplazar */
  function probarBase(bytes) {
    let d;
    try { d = new SQL.Database(bytes); d.exec('SELECT COUNT(*) FROM escuelas; SELECT COUNT(*) FROM alumnos; SELECT COUNT(*) FROM horarios;'); }
    catch (e) { try { d && d.close(); } catch (x) { /* */ } E('Ese archivo no es una base de la Agenda Docente'); }
    const n = d.exec('SELECT (SELECT COUNT(*) FROM escuelas), (SELECT COUNT(*) FROM cursos), (SELECT COUNT(*) FROM alumnos)')[0].values[0];
    d.close();
    return { escuelas: n[0], cursos: n[1], alumnos: n[2] };
  }
  async function reemplazarBase(bytes) {
    const n = probarBase(bytes);
    await copiaDiaria(true);
    DB.close();
    DB = new SQL.Database(bytes);
    initDb();
    await guardarBase();
    await DocLic.revisar(getConfig(), (k, v) => setCfg(k, v));
    return n;
  }

  /* ------------------------------------------------ lógica del docente (igual que app.py) */
  const TIPOS_EVENTO = ['REUNION', 'ACTO', 'ENTREGA', 'EXAMEN', 'CAPACITACION', 'PERSONAL', 'OTRO'];
  const ESTADOS_ASIS = ['P', 'A', 'T', 'J', 'R'];
  const ESTADOS_LIC = ['SOLICITADA', 'OTORGADA', 'RECHAZADA'];
  const SITUACIONES = ['TITULAR', 'INTERINO', 'SUPLENTE'];
  const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const NO_LAB = ['FERIADO', 'NO_LABORABLE', 'PUENTE'];

  function diasEspeciales(desde, hasta) {
    const out = {}, add = (f, x) => { (out[f] = out[f] || []).push(x); };
    const manual = q("SELECT * FROM dias_especiales WHERE fecha <= ? AND (CASE WHEN hasta != '' THEN hasta ELSE fecha END) >= ?", [hasta, desde]);
    const quitar = new Set(manual.filter(m => m.tipo === 'QUITAR').map(m => m.fecha));
    for (let a = +desde.slice(0, 4); a <= +hasta.slice(0, 4); a++)
      for (const f of delAnio(a)) if (desde <= f.fecha && f.fecha <= hasta && !quitar.has(f.fecha)) add(f.fecha, { nombre: f.nombre, tipo: f.tipo, auto: true, original: f.original });
    for (const m of manual) {
      if (m.tipo === 'QUITAR') continue;
      for (const f of rango(m.fecha, m.hasta || m.fecha)) if (desde <= f && f <= hasta) add(f, { nombre: m.nombre, tipo: m.tipo, auto: false, id: m.id, escuela_id: m.escuela_id });
    }
    return out;
  }
  const noLaborable = (esp, f) => (esp[f] || []).some(x => NO_LAB.includes(x.tipo));
  function sinClases(esp, f, escuelaId = null) {
    for (const x of esp[f] || []) {
      if (NO_LAB.includes(x.tipo)) return x.nombre;
      if (x.tipo === 'SIN_CLASES' && (!x.escuela_id || x.escuela_id === escuelaId)) return x.nombre;
    }
    return '';
  }
  function contarDias(desde, hasta, computo) {
    if (hasta < desde) E('La fecha de fin es anterior a la de inicio');
    if (computo !== 'HABILES') return entreDias(desde, hasta) + 1;
    const esp = diasEspeciales(desde, hasta); let n = 0;
    for (const f of rango(desde, hasta)) if (wd(f) < 5 && !noLaborable(esp, f)) n++;
    return n;
  }
  const licenciasEn = f => q("SELECT l.*, a.codigo, a.descripcion AS articulo, e.nombre AS escuela FROM licencias l LEFT JOIN articulos a ON a.id = l.articulo_id " +
    "LEFT JOIN escuelas e ON e.id = l.escuela_id WHERE l.estado != 'RECHAZADA' AND l.desde <= ? AND l.hasta >= ?", [f, f]);
  const deLicencia = (lics, escuelaId, cargoId = null) => lics.find(l => (!l.escuela_id || l.escuela_id === escuelaId) && (!l.cargo_id || !cargoId || l.cargo_id === cargoId)) || null;
  const nombreCurso = c => { const t = `${c.anio || ''} ${c.division || ''}`.trim(); return (t + (t && c.materia ? ' · ' : '') + (c.materia || '')) || 'Curso'; };
  function curso(cid) {
    const c = q1('SELECT c.*, e.nombre AS escuela, e.color FROM cursos c JOIN escuelas e ON e.id = c.escuela_id WHERE c.id = ?', [cid]);
    if (!c) E('El curso no existe');
    c.titulo = nombreCurso(c); return c;
  }
  function periodoDe(cfg, fecha) {
    const n = cfg.periodos === '2' ? 2 : 3;
    for (let i = 1; i < n; i++) {
      const fin = cfg['periodo' + i + '_fin'] || '';
      if (fin && fecha <= fin) return i;
      if (!fin) { const mes = +fecha.slice(5, 7); return n === 3 ? (mes <= 5 ? 1 : mes <= 8 ? 2 : 3) : (mes <= 7 ? 1 : 2); }
    }
    return n;
  }
  function asistenciaAlumnos(cfg, cid, desde, hasta) {
    const tarde = cfgFloat(cfg, 'valor_tarde', 0.5), just = (cfg.cuenta_justificadas ?? '1') === '1', minimo = cfgFloat(cfg, 'asistencia_minima', 75);
    let sql = 'SELECT a.alumno_id, a.estado, COUNT(*) AS n FROM asistencia a JOIN clases k ON k.id = a.clase_id WHERE k.curso_id = ? AND k.hubo = 1'; const par = [cid];
    if (desde) { sql += ' AND k.fecha >= ?'; par.push(desde); }
    if (hasta) { sql += ' AND k.fecha <= ?'; par.push(hasta); }
    const out = {};
    for (const r of q(sql + ' GROUP BY a.alumno_id, a.estado', par)) {
      const x = out[r.alumno_id] = out[r.alumno_id] || { clases: 0, P: 0, A: 0, T: 0, J: 0, R: 0 };
      x[r.estado] = r.n; x.clases += r.n;
    }
    for (const x of Object.values(out)) {
      x.inasistencias = r2(x.A + (just ? x.J : 0) + tarde * (x.T + x.R));
      x.porcentaje = x.clases ? r2(100 * (x.clases - x.inasistencias) / x.clases) : 100;
      x.riesgo = x.clases >= 5 && x.porcentaje < minimo + 5;
      x.libre = x.clases >= 5 && x.porcentaje < minimo;
    }
    return out;
  }
  const alumnosDe = (cid, todos = false) => q('SELECT * FROM alumnos WHERE curso_id = ? ' + (todos ? '' : 'AND activo = 1 ') + 'ORDER BY activo DESC, apellido COLLATE NOCASE, nombre COLLATE NOCASE', [cid]);
  function dia(fecha) {
    const dsem = wd(fecha), esp = diasEspeciales(fecha, fecha), lics = licenciasEn(fecha);
    const clases = q('SELECT h.*, e.nombre AS escuela, e.color, c.anio, c.division, c.materia, c.ciclo, g.descripcion AS cargo, ' +
      '(SELECT k.id FROM clases k WHERE k.curso_id = h.curso_id AND k.fecha = ?) AS clase_id FROM horarios h ' +
      'JOIN escuelas e ON e.id = h.escuela_id LEFT JOIN cursos c ON c.id = h.curso_id LEFT JOIN cargos g ON g.id = h.cargo_id ' +
      'WHERE h.dia = ? AND e.activo = 1 AND (c.id IS NULL OR c.activo = 1) ORDER BY h.desde', [fecha, dsem]);
    for (const h of clases) {
      h.curso = h.curso_id ? nombreCurso(h) : '';
      h.sin_clases = sinClases(esp, fecha, h.escuela_id);
      const l = deLicencia(lics, h.escuela_id, h.cargo_id);
      h.licencia = l ? `${l.codigo || ''} ${l.articulo || 'Licencia'}`.trim() : '';
    }
    const eventos = q("SELECT v.*, e.nombre AS escuela, e.color FROM eventos v LEFT JOIN escuelas e ON e.id = v.escuela_id WHERE v.fecha = ? ORDER BY v.hora = '', v.hora", [fecha]);
    return { fecha, clases, eventos, especiales: esp[fecha] || [], licencias: lics };
  }
  function articuloPara(motivo, cargo) {
    const sit = cargo ? String(cargo.situacion || '').toUpperCase() : '';
    const arts = q('SELECT * FROM articulos WHERE descripcion = ? AND activo = 1 ORDER BY orden, id', [motivo]);
    if (!arts.length) E('El motivo no existe');
    if (arts.length === 1 && !arts[0].situacion) return arts[0];
    if (!sit) E(`Al cargo "${cargo ? cargo.descripcion : '?'}" le falta la situación de revista (titular, interino o suplente): cargala en Escuelas y cargos`);
    return arts.find(a => a.situacion === sit) || arts.find(a => !a.situacion) || E(`"${motivo}" no tiene artículo para ${sit.toLowerCase()}`);
  }
  function contador(anio) {
    const ini = anio + '-01-01', fin = anio + '-12-31';
    const arts = q('SELECT * FROM articulos ORDER BY orden, id');
    const lics = q("SELECT * FROM licencias WHERE estado != 'RECHAZADA' AND desde <= ? AND hasta >= ?", [fin, ini]);
    const out = [];
    for (const a of arts) {
      const mias = lics.filter(l => l.articulo_id === a.id); if (!mias.length) continue;
      let fechas = new Set();
      for (const l of mias) for (const f of rango(l.desde > ini ? l.desde : ini, l.hasta < fin ? l.hasta : fin)) fechas.add(f);
      if (a.computo === 'HABILES' && fechas.size) {
        const s = [...fechas].sort(), esp = diasEspeciales(s[0], s[s.length - 1]);
        fechas = new Set(s.filter(f => wd(f) < 5 && !noLaborable(esp, f)));
      }
      const usados = fechas.size, anual = a.tope_tipo === 'ANIO' && a.dias_anio;
      out.push({ articulo_id: a.id, codigo: a.codigo, articulo: a.articulo, descripcion: a.descripcion, situacion: a.situacion, tope: anual ? a.dias_anio : 0,
        tope_tipo: a.tope_tipo, tope_texto: a.tope_texto, computo: a.computo, usados, veces: new Set(mias.map(l => l.grupo || l.id)).size,
        quedan: anual ? r2(a.dias_anio - usados) : null, excedido: !!(anual && usados > a.dias_anio) });
    }
    return out;
  }
  function separarNombre(linea) {
    let dni = '';
    const m = linea.match(/\b(\d{1,2}\.?\d{3}\.?\d{3})\b/);
    if (m) { dni = m[1].replace(/\./g, ''); linea = (linea.slice(0, m.index) + linea.slice(m.index + m[0].length)).trim().replace(/^[ \-,;]+|[ \-,;]+$/g, ''); }
    linea = linea.replace(/^\d{1,3}[).\-]?\s+/, '');
    let ap, no;
    if (linea.includes(',')) { const i = linea.indexOf(','); ap = linea.slice(0, i); no = linea.slice(i + 1); }
    else { const p = linea.split(/\s+/).filter(Boolean); ap = p[0] || ''; no = p.slice(1).join(' '); }
    const cap = w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    return [ap.split(/\s+/).filter(Boolean).join(' ').toUpperCase(), no.split(/\s+/).filter(Boolean).map(cap).join(' '), dni];
  }
  function notaNum(v) {
    const s = String(v ?? '').trim().replace(',', '.');
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return null;
    const x = parseFloat(s); return isNaN(x) ? null : x;
  }
  function validarNota(v) {
    const s = String(v ?? '').split(/\s+/).filter(Boolean).join(' ').slice(0, 8);
    if (!s) return '';
    const x = notaNum(s);
    if (x !== null) { if (!(x >= 0 && x <= 10)) E(`La nota ${s} está fuera de la escala (de 1 a 10)`); return fg(Math.round(x * 100) / 100).replace('.', ','); }
    const u = s.toUpperCase();
    if (!/^[A-ZÁÉÍÓÚÑ+\-/ ]{1,8}$/.test(u)) E(`Nota inválida: ${v} (usá un número, A = ausente, o un concepto como MB, B, R)`);
    return u;
  }

  /* ------------------------------------------------ rutas */
  const R = {};
  const ruta = (metodo, patron, f) => { (R[metodo] = R[metodo] || []).push([new RegExp('^' + patron.replace(/<int>/g, '(\\d+)') + '$'), f]); };

  const CFG_PUBLICA = ['nombre_consultorio', 'dni', 'provincia', 'periodos', 'periodo1_fin', 'periodo2_fin', 'ciclo_inicio', 'ciclo_fin',
    'valor_tarde', 'cuenta_justificadas', 'asistencia_minima', 'nota_aprobacion', 'pedir_clave'];
  ruta('GET', '/api/me', () => {
    const cfg = getConfig();
    return { usuario: 'docente', nombre: cfg.nombre_consultorio || 'Docente', rol: 'ADMIN', permisos: [], minutos_inactividad: 0,
      cfg: Object.fromEntries(CFG_PUBLICA.map(k => [k, cfg[k] ?? ''])), marca: MARCA, version: VERSION, licencia: DocLic.estado(), clave_default: false, celular: true };
  });

  /* escuelas, cargos, cursos y horario */
  ruta('GET', '/api/escuelas', (d, a) => {
    const todas = a.get('todas') === '1';
    const out = q('SELECT * FROM escuelas ' + (todas ? '' : 'WHERE activo = 1 ') + 'ORDER BY activo DESC, orden, nombre COLLATE NOCASE');
    const ciclo = entero(a.get('ciclo'), 'El año', anioHoy());
    for (const e of out) {
      e.cargos = q('SELECT * FROM cargos WHERE escuela_id = ? ORDER BY activo DESC, descripcion', [e.id]);
      e.cursos = q('SELECT c.*, (SELECT COUNT(*) FROM alumnos a WHERE a.curso_id = c.id AND a.activo = 1) AS alumnos FROM cursos c ' +
        'WHERE c.escuela_id = ? AND c.ciclo = ? ORDER BY c.activo DESC, c.anio, c.division, c.materia', [e.id, ciclo]);
      for (const c of e.cursos) c.titulo = nombreCurso(c);
    }
    return out;
  });
  ruta('POST', '/api/escuelas', d => {
    const nombre = txt(d.nombre, 120); if (!nombre) E('Escribí el nombre de la escuela');
    const par = [nombre, txt(d.numero, 20), txt(d.nivel, 40), txt(d.localidad, 80), txt(d.direccion, 120), txt(d.telefono, 40), txt(d.directivo, 80),
      String(d.color || '#3b82f6').slice(0, 9), strip(d.notas), (d.activo ?? 1) ? 1 : 0];
    let eid;
    if (d.id) { run('UPDATE escuelas SET nombre=?, numero=?, nivel=?, localidad=?, direccion=?, telefono=?, directivo=?, color=?, notas=?, activo=? WHERE id=?', [...par, ent(d.id)]); eid = ent(d.id); }
    else eid = run('INSERT INTO escuelas(nombre, numero, nivel, localidad, direccion, telefono, directivo, color, notas, activo, orden) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [...par, (val('SELECT MAX(orden) FROM escuelas') || 0) + 1]);
    return { ok: true, id: eid };
  });
  ruta('POST', '/api/cargos', d => {
    const desc = txt(d.descripcion, 120); if (!desc) E('Escribí el cargo o las horas (ej. 6 hs Matemática)');
    const par = [ent(d.escuela_id), desc, d.tipo === 'CARGO' ? 'CARGO' : 'HORAS', r2(num(d.horas)), txt(d.situacion, 20).toUpperCase(),
      d.desde ? fechaOk(d.desde) : '', d.hasta ? fechaOk(d.hasta) : '', strip(d.notas), (d.activo ?? 1) ? 1 : 0];
    if (!q1('SELECT 1 FROM escuelas WHERE id = ?', [par[0]])) E('Elegí la escuela');
    let cid;
    if (d.id) { run('UPDATE cargos SET escuela_id=?, descripcion=?, tipo=?, horas=?, situacion=?, desde=?, hasta=?, notas=?, activo=? WHERE id=?', [...par, ent(d.id)]); cid = ent(d.id); }
    else cid = run('INSERT INTO cargos(escuela_id, descripcion, tipo, horas, situacion, desde, hasta, notas, activo) VALUES (?,?,?,?,?,?,?,?,?)', par);
    return { ok: true, id: cid };
  });
  ruta('GET', '/api/cursos', (d, a) => {
    const ciclo = entero(a.get('ciclo'), 'El año', anioHoy()), cfg = getConfig();
    const out = q('SELECT c.*, e.nombre AS escuela, e.color, (SELECT COUNT(*) FROM alumnos a WHERE a.curso_id = c.id AND a.activo = 1) AS alumnos, ' +
      '(SELECT COUNT(*) FROM clases k WHERE k.curso_id = c.id AND k.hubo = 1) AS clases FROM cursos c JOIN escuelas e ON e.id = c.escuela_id ' +
      'WHERE c.ciclo = ? ' + (a.get('todos') === '1' ? '' : 'AND c.activo = 1 ') + 'ORDER BY e.orden, e.nombre, c.anio, c.division, c.materia', [ciclo]);
    for (const c of out) {
      c.titulo = nombreCurso(c);
      const x = Object.values(asistenciaAlumnos(cfg, c.id)), con = x.filter(y => y.clases);
      c.en_riesgo = x.filter(y => y.riesgo).length;
      c.asistencia = x.length ? r2(sum(con, y => y.porcentaje) / Math.max(1, con.length)) : null;
    }
    return out;
  });
  ruta('POST', '/api/cursos', d => {
    if (!(txt(d.anio) || txt(d.materia))) E('Escribí el año / grado o la materia');
    const par = [ent(d.escuela_id), idOrNull(d.cargo_id), entero(d.ciclo, 'El ciclo lectivo (año)', anioHoy()), txt(d.anio, 20), txt(d.division, 20), txt(d.materia, 80),
      txt(d.turno, 20), strip(d.notas), (d.activo ?? 1) ? 1 : 0];
    if (!q1('SELECT 1 FROM escuelas WHERE id = ?', [par[0]])) E('Elegí la escuela');
    let cid;
    if (d.id) { run('UPDATE cursos SET escuela_id=?, cargo_id=?, ciclo=?, anio=?, division=?, materia=?, turno=?, notas=?, activo=? WHERE id=?', [...par, ent(d.id)]); cid = ent(d.id); }
    else {
      cid = run('INSERT INTO cursos(escuela_id, cargo_id, ciclo, anio, division, materia, turno, notas, activo) VALUES (?,?,?,?,?,?,?,?,?)', par);
      if (d.copiar_alumnos_de) for (const x of q('SELECT * FROM alumnos WHERE curso_id = ? AND activo = 1', [ent(d.copiar_alumnos_de)]))
        run('INSERT INTO alumnos(curso_id, apellido, nombre, dni, tutor, telefono, alta) VALUES (?,?,?,?,?,?,?)', [cid, x.apellido, x.nombre, x.dni, x.tutor, x.telefono, hoy()]);
    }
    return { ok: true, id: cid };
  });
  ruta('GET', '/api/horarios', () => {
    const out = q('SELECT h.*, e.nombre AS escuela, e.color, c.anio, c.division, c.materia, g.descripcion AS cargo FROM horarios h ' +
      'JOIN escuelas e ON e.id = h.escuela_id LEFT JOIN cursos c ON c.id = h.curso_id LEFT JOIN cargos g ON g.id = h.cargo_id WHERE e.activo = 1 ORDER BY h.dia, h.desde');
    for (const h of out) h.curso = h.curso_id ? nombreCurso(h) : '';
    return out;
  });
  ruta('POST', '/api/horarios', d => {
    const desde = hora(d.desde, 'hora de entrada'), hasta = hora(d.hasta, 'hora de salida');
    if (!desde || !hasta) E('Indicá la hora de entrada y de salida');
    if (hasta <= desde) E('La hora de salida tiene que ser después de la de entrada');
    const lista = Array.isArray(d.dias) ? d.dias : [d.dia];
    const dias = [...new Set(lista.filter(x => String(x ?? '').trim() !== '').map(x => entero(x, 'El día')).filter(x => x >= 0 && x <= 6))].sort((a, b) => a - b);
    if (!dias.length) E('Elegí el día (o los días)');
    let eid = ent(d.escuela_id); const cur = idOrNull(d.curso_id);
    if (cur) { const c = q1('SELECT escuela_id FROM cursos WHERE id = ?', [cur]); if (!c) E('El curso no existe'); eid = c.escuela_id; }
    if (!q1('SELECT 1 FROM escuelas WHERE id = ?', [eid])) E('Elegí la escuela');
    const par = [eid, cur, idOrNull(d.cargo_id), desde, hasta, txt(d.detalle, 120), txt(d.aula, 40)];
    const avisos = [];
    for (const dd of dias) {
      const ch = q1('SELECT h.desde, h.hasta, e.nombre FROM horarios h JOIN escuelas e ON e.id = h.escuela_id WHERE h.dia = ? AND h.desde < ? AND h.hasta > ? AND h.id != ?', [dd, hasta, desde, ent(d.id)]);
      if (ch) avisos.push(`El ${DIAS[dd]} se superpone con ${ch.nombre} (${ch.desde} a ${ch.hasta})`);
    }
    if (d.id) run('UPDATE horarios SET escuela_id=?, curso_id=?, cargo_id=?, desde=?, hasta=?, detalle=?, aula=?, dia=? WHERE id=?', [...par, dias[0], ent(d.id)]);
    else for (const dd of dias) run('INSERT INTO horarios(escuela_id, curso_id, cargo_id, desde, hasta, detalle, aula, dia) VALUES (?,?,?,?,?,?,?,?)', [...par, dd]);
    return { ok: true, avisos };
  });
  ruta('DELETE', '/api/horarios/<int>', (d, hid) => { run('DELETE FROM horarios WHERE id = ?', [+hid]); return { ok: true }; });
  ruta('GET', '/api/dia', (d, a) => dia(fechaOk(a.get('fecha') || hoy())));

  /* agenda */
  ruta('GET', '/api/eventos', (d, a) => {
    const desde = fechaOk(a.get('desde') || hoy()), hasta = fechaOk(a.get('hasta') || masDias(hoy(), 60));
    return q("SELECT v.*, e.nombre AS escuela, e.color FROM eventos v LEFT JOIN escuelas e ON e.id = v.escuela_id WHERE v.fecha BETWEEN ? AND ? ORDER BY v.fecha, v.hora = '', v.hora", [desde, hasta]);
  });
  ruta('POST', '/api/eventos', d => {
    const titulo = txt(d.titulo, 160); if (!titulo) E('Escribí qué es (ej. Reunión de padres)');
    const tipo = String(d.tipo || 'OTRO').toUpperCase();
    const par = [fechaOk(d.fecha), hora(d.hora), hora(d.hora_fin, 'hora de fin'), titulo, TIPOS_EVENTO.includes(tipo) ? tipo : 'OTRO', idOrNull(d.escuela_id), idOrNull(d.curso_id),
      strip(d.notas), d.hecho ? 1 : 0];
    let vid;
    if (d.id) { run('UPDATE eventos SET fecha=?, hora=?, hora_fin=?, titulo=?, tipo=?, escuela_id=?, curso_id=?, notas=?, hecho=? WHERE id=?', [...par, ent(d.id)]); vid = ent(d.id); }
    else vid = run('INSERT INTO eventos(fecha, hora, hora_fin, titulo, tipo, escuela_id, curso_id, notas, hecho, creado) VALUES (?,?,?,?,?,?,?,?,?,?)', [...par, ahora()]);
    return { ok: true, id: vid };
  });
  ruta('POST', '/api/eventos/<int>/hecho', (d, vid) => { run('UPDATE eventos SET hecho = 1 - hecho WHERE id = ?', [+vid]); return { ok: true }; });
  ruta('DELETE', '/api/eventos/<int>', (d, vid) => { run('DELETE FROM eventos WHERE id = ?', [+vid]); return { ok: true }; });
  ruta('GET', '/api/calendario', (d, a) => {
    const mes = (a.get('mes') || hoy().slice(0, 7)).slice(0, 7), desde = fechaOk(mes + '-01'), hasta = finDeMes(desde);
    const esp = diasEspeciales(desde, hasta);
    const ev = q("SELECT v.*, e.color FROM eventos v LEFT JOIN escuelas e ON e.id = v.escuela_id WHERE v.fecha BETWEEN ? AND ? ORDER BY v.hora = '', v.hora", [desde, hasta]);
    const lic = q("SELECT l.*, a.codigo, a.descripcion AS articulo FROM licencias l LEFT JOIN articulos a ON a.id = l.articulo_id WHERE l.estado != 'RECHAZADA' AND l.desde <= ? AND l.hasta >= ?", [hasta, desde]);
    const dias = {};
    for (const f of rango(desde, hasta)) dias[f] = { especiales: esp[f] || [], eventos: ev.filter(e => e.fecha === f),
      licencias: lic.filter(l => l.desde <= f && f <= l.hasta).map(l => ({ id: l.id, texto: `${l.codigo || ''} ${l.articulo || 'Licencia'}`.trim(), estado: l.estado })) };
    return { mes, desde, hasta, dias };
  });

  /* feriados y días sin clases */
  ruta('GET', '/api/feriados', (d, a) => {
    const anio = entero(a.get('anio'), 'El año', anioHoy());
    const manual = q('SELECT d.*, e.nombre AS escuela FROM dias_especiales d LEFT JOIN escuelas e ON e.id = d.escuela_id WHERE substr(d.fecha,1,4) = ? OR substr(d.hasta,1,4) = ? ORDER BY d.fecha', [String(anio), String(anio)]);
    const quitados = {}; for (const m of manual) if (m.tipo === 'QUITAR') quitados[m.fecha] = m.id;
    const auto = delAnio(anio); for (const f of auto) f.quitado_id = quitados[f.fecha] ?? null;
    return { anio, automaticos: auto, manuales: manual.filter(m => m.tipo !== 'QUITAR'), puentes_cargados: anio in PUENTES };
  });
  ruta('POST', '/api/dias-especiales', d => {
    const tipo = String(d.tipo || 'FERIADO').toUpperCase();
    if (!['FERIADO', 'NO_LABORABLE', 'SIN_CLASES', 'QUITAR'].includes(tipo)) E('Tipo inválido');
    const fecha = fechaOk(d.fecha), hasta = d.hasta && d.hasta !== d.fecha ? fechaOk(d.hasta) : '';
    if (hasta && hasta < fecha) E('La fecha de fin es anterior a la de inicio');
    const nombre = txt(d.nombre, 120) || (tipo === 'QUITAR' ? 'Quitado' : '');
    if (!nombre) E('Escribí el motivo (ej. Receso invernal, Feriado provincial)');
    if (d.id) run('UPDATE dias_especiales SET fecha=?, hasta=?, nombre=?, tipo=?, escuela_id=? WHERE id=?', [fecha, hasta, nombre, tipo, idOrNull(d.escuela_id), ent(d.id)]);
    else run('INSERT INTO dias_especiales(fecha, hasta, nombre, tipo, escuela_id) VALUES (?,?,?,?,?)', [fecha, hasta, nombre, tipo, idOrNull(d.escuela_id)]);
    return { ok: true };
  });
  ruta('DELETE', '/api/dias-especiales/<int>', (d, id) => { run('DELETE FROM dias_especiales WHERE id = ?', [+id]); return { ok: true }; });

  /* licencias */
  ruta('GET', '/api/articulos', (d, a) => q('SELECT * FROM articulos ' + (a.get('todos') === '1' ? '' : 'WHERE activo = 1 ') + 'ORDER BY activo DESC, orden, id'));
  ruta('GET', '/api/motivos', () => {
    const mot = new Map();
    for (const a of q('SELECT * FROM articulos WHERE activo = 1 ORDER BY orden, id')) {
      if (!mot.has(a.descripcion)) mot.set(a.descripcion, { motivo: a.descripcion, articulos: [], computo: a.computo, certificado: a.certificado });
      mot.get(a.descripcion).articulos.push(a);
    }
    return [...mot.values()];
  });
  ruta('POST', '/api/articulos', d => {
    const desc = txt(d.descripcion, 160); if (!desc) E('Escribí el motivo (ej. Enfermedad o lesión común)');
    const sit = String(d.situacion || '').toUpperCase(); if (sit && !SITUACIONES.includes(sit)) E('Situación de revista inválida');
    const tt = String(d.tope_tipo || '').toUpperCase();
    const par = [txt(d.codigo, 30), desc, txt(d.articulo, 30), sit, r2(num(d.dias_anio)), ['ANIO', 'LICENCIA'].includes(tt) ? tt : '', txt(d.tope_texto, 80),
      d.computo === 'HABILES' ? 'HABILES' : 'CORRIDOS', d.certificado ? 1 : 0, strip(d.notas), (d.activo ?? 1) ? 1 : 0];
    let aid;
    if (d.id) { run('UPDATE articulos SET codigo=?, descripcion=?, articulo=?, situacion=?, dias_anio=?, tope_tipo=?, tope_texto=?, computo=?, certificado=?, notas=?, activo=? WHERE id=?', [...par, ent(d.id)]); aid = ent(d.id); }
    else aid = run('INSERT INTO articulos(codigo, descripcion, articulo, situacion, dias_anio, tope_tipo, tope_texto, computo, certificado, notas, activo, orden) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [...par, (val('SELECT MAX(orden) FROM articulos') || 0) + 1]);
    return { ok: true, id: aid };
  });
  ruta('POST', '/api/articulos/pegar', d => {
    let n = 0, orden = val('SELECT MAX(orden) FROM articulos') || 0;
    for (let linea of String(d.texto || '').split(/\r?\n/)) {
      linea = linea.replace(/\t/g, ' ; ').split(/\s+/).filter(Boolean).join(' ').replace(/^[ \-•*·]+|[ \-•*·]+$/g, '');
      if (!linea) continue;
      let motivo, cod, art, sit, dias;
      if (linea.includes(';')) {
        const p = [...linea.split(';').map(x => x.trim()), '', '', '', '', ''];
        [motivo, cod, art, sit, dias] = p;
        sit = sit ? sit.toUpperCase().split(/\s+/)[0] : ''; sit = SITUACIONES.includes(sit) ? sit : '';
      } else {
        const partes = linea.split(/\s[-–|]\s/).map(x => x.trim()).filter(Boolean);
        dias = partes.length > 1 && /^\d+/.test(partes[partes.length - 1]) ? partes.pop() : '';
        [art, motivo] = partes.length > 1 ? [partes[0], partes.slice(1).join(' - ')] : ['', partes[0]];
        cod = ''; sit = '';
      }
      if (!motivo) continue;
      const m = String(dias || '').match(/^(\d+(?:[.,]\d+)?)/), dl = String(dias || '').toLowerCase();
      orden += 1;
      run('INSERT INTO articulos(descripcion, codigo, articulo, situacion, dias_anio, tope_tipo, tope_texto, computo, orden) VALUES (?,?,?,?,?,?,?,?,?)',
        [motivo.slice(0, 160), cod.slice(0, 30), art.slice(0, 30), sit, m ? num(m[1]) : 0, m ? 'ANIO' : '', m ? '' : String(dias || '').slice(0, 80),
          dl.includes('hábil') || dl.includes('habil') ? 'HABILES' : 'CORRIDOS', orden]);
      n++;
    }
    if (!n) E('Pegá al menos un artículo');
    return { ok: true, agregados: n };
  });
  ruta('GET', '/api/licencias/dias', (d, a) => {
    let x = null;
    if (a.get('articulo_id')) x = q1('SELECT computo FROM articulos WHERE id = ?', [ent(a.get('articulo_id'))]);
    else if (a.get('motivo')) x = q1('SELECT computo FROM articulos WHERE descripcion = ? AND activo = 1 LIMIT 1', [a.get('motivo')]);
    return { dias: contarDias(fechaOk(a.get('desde'), 'fecha de inicio'), fechaOk(a.get('hasta'), 'fecha de fin'), x ? x.computo : 'CORRIDOS') };
  });
  ruta('GET', '/api/licencias', (d, a) => {
    const anio = entero(a.get('anio'), 'El año', anioHoy()), ini = anio + '-01-01', fin = anio + '-12-31';
    const filas = q('SELECT l.id, l.grupo, l.desde, l.hasta, l.dias, l.estado, l.certificado, l.expediente, l.notas, l.motivo AS razon, l.escuela_id, l.cargo_id, ' +
      'l.articulo_id, a.codigo, a.articulo AS art, a.descripcion AS motivo, a.situacion, a.certificado AS pide_certificado, a.computo, ' +
      'e.nombre AS escuela, e.numero AS escuela_numero, g.descripcion AS cargo FROM licencias l LEFT JOIN articulos a ON a.id = l.articulo_id ' +
      'LEFT JOIN escuelas e ON e.id = l.escuela_id LEFT JOIN cargos g ON g.id = l.cargo_id WHERE l.desde <= ? AND l.hasta >= ? ORDER BY l.desde DESC, l.id', [fin, ini]);
    const grupos = new Map();
    for (const f of filas) {
      const k = f.grupo || 'id' + f.id;
      if (!grupos.has(k)) { const g = {}; for (const x of ['id', 'grupo', 'desde', 'hasta', 'dias', 'motivo', 'razon', 'estado', 'certificado', 'expediente', 'notas', 'pide_certificado', 'computo']) g[x] = f[x]; g.cargos = []; grupos.set(k, g); }
      grupos.get(k).cargos.push({ licencia_id: f.id, escuela_id: f.escuela_id, escuela: f.escuela, escuela_numero: f.escuela_numero, cargo_id: f.cargo_id, cargo: f.cargo,
        codigo: f.codigo, articulo: f.art, situacion: f.situacion, articulo_id: f.articulo_id });
    }
    const lista = [...grupos.values()].sort((x, y) => x.desde < y.desde ? 1 : x.desde > y.desde ? -1 : 0);
    const todas = new Set();
    for (const g of lista) if (g.estado !== 'RECHAZADA' && g.cargos.some(c => c.codigo)) for (const f of rango(g.desde > ini ? g.desde : ini, g.hasta < fin ? g.hasta : fin)) todas.add(f);
    return { anio, licencias: lista, contador: contador(anio), total_dias: todas.size };
  });
  ruta('POST', '/api/licencias', d => {
    const desde = fechaOk(d.desde, 'fecha de inicio'), hasta = fechaOk(d.hasta || d.desde, 'fecha de fin');
    const estado = String(d.estado || 'OTORGADA').toUpperCase(); if (!ESTADOS_LIC.includes(estado)) E('Estado inválido');
    let motivo = txt(d.motivo, 160);
    if (!motivo && d.articulo_id) { const a0 = q1('SELECT * FROM articulos WHERE id = ?', [ent(d.articulo_id)]); motivo = a0 ? a0.descripcion : ''; }
    if (!motivo) E('Elegí el motivo de la licencia');
    const cargosIds = (d.cargos || []).filter(x => /^\d+$/.test(String(x).trim())).map(x => +x);
    const renglones = [];
    if (cargosIds.length) for (const cid of cargosIds) {
      const c = q1('SELECT * FROM cargos WHERE id = ?', [cid]); if (!c) E('Cargo inválido');
      renglones.push([articuloPara(motivo, c), c.escuela_id, c.id]);
    } else {
      const arts = q('SELECT * FROM articulos WHERE descripcion = ? AND activo = 1 ORDER BY orden, id', [motivo]);
      if (!arts.length) E('El motivo no existe');
      const a = arts.find(x => !x.situacion) || (arts.length === 1 ? arts[0] : null);
      if (!a) E('Elegí en qué cargos faltás: el código depende de si sos titular, interino o suplente');
      renglones.push([a, idOrNull(d.escuela_id), null]);
    }
    const dias = contarDias(desde, hasta, renglones[0][0].computo);
    let grupo = d.grupo || '', viejos = [];
    if (grupo) viejos = q('SELECT id FROM licencias WHERE grupo = ?', [grupo]).map(r => r.id);
    else if (d.id) viejos = [ent(d.id)];
    const excl = viejos.join(',') || '0';
    for (const [, eid, gid] of renglones) {
      const choca = q1(`SELECT desde, hasta FROM licencias WHERE estado != 'RECHAZADA' AND desde <= ? AND hasta >= ? AND id NOT IN (${excl}) ` +
        'AND (cargo_id IS NULL OR ? IS NULL OR cargo_id = ?) AND (escuela_id IS NULL OR ? IS NULL OR escuela_id = ?)', [hasta, desde, gid, gid, eid, eid]);
      if (choca && !d.forzar) E(`Ya tenés una licencia cargada del ${choca.desde.slice(8, 10)}/${choca.desde.slice(5, 7)} al ${choca.hasta.slice(8, 10)}/${choca.hasta.slice(5, 7)} que se superpone`);
    }
    if (viejos.length) run(`DELETE FROM licencias WHERE id IN (${excl})`);
    grupo = grupo || uuid12();
    const ids = renglones.map(([a, eid, gid]) => run('INSERT INTO licencias(articulo_id, escuela_id, cargo_id, desde, hasta, dias, motivo, estado, certificado, expediente, notas, grupo, creado) ' +
      'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [a.id, eid, gid, desde, hasta, dias, strip(d.razon || d.detalle).slice(0, 300), estado, d.certificado ? 1 : 0, txt(d.expediente, 60), strip(d.notas), grupo, ahora()]));
    const avisos = [], idsArt = new Set(renglones.map(r => r[0].id));
    for (const c of contador(+desde.slice(0, 4))) if (idsArt.has(c.articulo_id) && c.excedido) avisos.push(`Ojo: de ${c.descripcion} (cód. ${c.codigo}) llevás ${fg(c.usados)} días y el tope es ${fg(c.tope)} por año`);
    for (const [a] of renglones) if (a.tope_tipo === 'LICENCIA' && a.dias_anio && dias > a.dias_anio) avisos.push(`Ojo: ${a.descripcion} (cód. ${a.codigo}) es de hasta ${fg(a.dias_anio)} días por vez`);
    return { ok: true, id: ids[0], ids, grupo, dias, aviso: [...new Set(avisos)].join(' · ') };
  });
  ruta('DELETE', '/api/licencias/<int>', (d, lid) => {
    const g = q1('SELECT grupo FROM licencias WHERE id = ?', [+lid]);
    if (g && g.grupo) run('DELETE FROM licencias WHERE grupo = ?', [g.grupo]); else run('DELETE FROM licencias WHERE id = ?', [+lid]);
    return { ok: true };
  });

  /* alumnos */
  ruta('POST', '/api/cursos/<int>/alumnos/pegar', (d, cid) => {
    cid = +cid; curso(cid);
    let n = 0, rep = 0;
    for (let linea of String(d.texto || '').split(/\r?\n/)) {
      linea = linea.replace(/\t/g, ' ').split(/\s+/).filter(Boolean).join(' ').replace(/^[ \-•*·;]+|[ \-•*·;]+$/g, '');
      if (!linea || /^(apellido|alumno)/i.test(linea)) continue;
      const [ap, no, dni] = separarNombre(linea);
      if (!ap) continue;
      if (q1("SELECT 1 FROM alumnos WHERE curso_id = ? AND activo = 1 AND ((dni != '' AND dni = ?) OR (apellido = ? AND nombre = ?))", [cid, dni, ap, no])) { rep++; continue; }
      run('INSERT INTO alumnos(curso_id, apellido, nombre, dni, alta) VALUES (?,?,?,?,?)', [cid, ap.slice(0, 80), no.slice(0, 80), dni, hoy()]);
      n++;
    }
    if (!n && !rep) E('Pegá la lista: un alumno por renglón (Apellido, Nombre)');
    return { ok: true, agregados: n, repetidos: rep };
  });
  ruta('POST', '/api/alumnos', d => {
    const ap = txt(d.apellido, 80).toUpperCase(); if (!ap) E('Escribí el apellido');
    const par = [ap, txt(d.nombre, 80), txt(d.dni, 12).replace(/\./g, ''), txt(d.tutor, 80), txt(d.telefono, 40), strip(d.notas)];
    let aid;
    if (d.id) { run('UPDATE alumnos SET apellido=?, nombre=?, dni=?, tutor=?, telefono=?, notas=? WHERE id=?', [...par, ent(d.id)]); aid = ent(d.id); }
    else { curso(ent(d.curso_id)); aid = run('INSERT INTO alumnos(apellido, nombre, dni, tutor, telefono, notas, curso_id, alta) VALUES (?,?,?,?,?,?,?,?)', [...par, ent(d.curso_id), hoy()]); }
    return { ok: true, id: aid };
  });
  ruta('POST', '/api/alumnos/<int>/baja', (d, aid) => {
    if (d.reactivar) run("UPDATE alumnos SET activo = 1, baja = '' WHERE id = ?", [+aid]);
    else run("UPDATE alumnos SET activo = 0, baja = ?, notas = TRIM(notas || ' ' || ?) WHERE id = ?", [fechaOk(d.fecha || hoy()), d.motivo ? 'Baja: ' + txt(d.motivo, 120) : '', +aid]);
    return { ok: true };
  });
  ruta('DELETE', '/api/alumnos/<int>', (d, aid) => {
    aid = +aid;
    if (q1("SELECT 1 FROM asistencia WHERE alumno_id = ? UNION SELECT 1 FROM notas WHERE alumno_id = ? AND valor != '' UNION SELECT 1 FROM observaciones WHERE alumno_id = ?", [aid, aid, aid]))
      E('Ya tiene asistencia, notas u observaciones cargadas: no se borra, se le da de baja');
    run('DELETE FROM cierres WHERE alumno_id = ?', [aid]); run('DELETE FROM alumnos WHERE id = ?', [aid]);
    return { ok: true };
  });
  ruta('POST', '/api/alumnos/<int>/borrar-definitivo', (d, aid) => {
    aid = +aid;
    if (strip(d.confirmar).toUpperCase() !== 'BORRAR') E('Para confirmar escribí BORRAR');
    const a = q1('SELECT * FROM alumnos WHERE id = ?', [aid]); if (!a) throw Object.assign(new ErrorNegocio('No existe ese alumno'), { status: 404 });
    for (const t of ['asistencia', 'notas', 'cierres', 'observaciones', 'acta_alumnos']) run(`DELETE FROM ${t} WHERE alumno_id = ?`, [aid]);
    run('DELETE FROM actas WHERE id NOT IN (SELECT acta_id FROM acta_alumnos)');     // un acta que era sólo de este alumno
    run('DELETE FROM alumnos WHERE id = ?', [aid]);
    // también se saca su nombre del registro de actividad (si la base vino de la PC)
    const textos = [...new Set([`${a.apellido} ${a.nombre || ''}`.trim(), a.apellido, a.dni, a.tutor, a.telefono].map(x => strip(x)).filter(x => x.length >= 3))].sort((x, y) => y.length - x.length);
    for (const t of textos) {
      const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      for (const r of q('SELECT id, detalle FROM actividad WHERE detalle LIKE ?', ['%' + t + '%'])) run('UPDATE actividad SET detalle = ? WHERE id = ?', [r.detalle.replace(re, 'Alumno borrado'), r.id]);
    }
    return { ok: true };
  });

  /* observaciones de cada alumno */
  const TIPOS_OBS = ['CONDUCTA', 'BUENA', 'TAREA', 'OTRA'];
  const obsCuenta = cid => Object.fromEntries(q("SELECT o.alumno_id, COUNT(*) AS n, SUM(CASE WHEN o.padres = 1 AND o.hablado = '' THEN 1 ELSE 0 END) AS pend FROM observaciones o " +
    'JOIN alumnos a ON a.id = o.alumno_id WHERE a.curso_id = ? GROUP BY o.alumno_id', [cid]).map(r => [r.alumno_id, { n: r.n, pend: r.pend }]));
  const padresPendientes = () => q('SELECT o.id, o.fecha, o.tipo, o.texto, o.alumno_id, a.apellido, a.nombre, a.tutor, a.telefono, a.curso_id, c.anio, c.division, c.materia, ' +
    "e.nombre AS escuela FROM observaciones o JOIN alumnos a ON a.id = o.alumno_id JOIN cursos c ON c.id = a.curso_id JOIN escuelas e ON e.id = c.escuela_id " +
    "WHERE o.padres = 1 AND o.hablado = '' AND a.activo = 1 ORDER BY o.fecha, o.id");
  ruta('GET', '/api/alumnos/<int>/observaciones', (d, aid) => {
    const a = q1('SELECT * FROM alumnos WHERE id = ?', [+aid]); if (!a) E('El alumno no existe');
    return { alumno: a, curso: curso(a.curso_id), observaciones: q('SELECT * FROM observaciones WHERE alumno_id = ? ORDER BY fecha DESC, id DESC', [+aid]),
      actas: q('SELECT t.id, t.fecha, t.hora, t.situacion, (SELECT COUNT(*) FROM acta_alumnos y WHERE y.acta_id = t.id) AS n_alumnos ' +
        'FROM actas t JOIN acta_alumnos x ON x.acta_id = t.id WHERE x.alumno_id = ? ORDER BY t.fecha DESC, t.id DESC', [+aid]) };
  });
  ruta('POST', '/api/observaciones', d => {
    const texto = strip(d.texto).slice(0, 1000); if (!texto) E('Escribí la observación (ej. Se portó mal en clase)');
    const fecha = fechaOk(d.fecha || hoy()); if (fecha > hoy()) E('La fecha no puede ser de un día que todavía no llegó');
    const tipo = String(d.tipo || 'OTRA').toUpperCase(); if (!TIPOS_OBS.includes(tipo)) E('Tipo de observación inválido');
    const padres = [1, true, '1'].includes(d.padres) ? 1 : 0;
    if (d.id) {
      const o = q1('SELECT * FROM observaciones WHERE id = ?', [ent(d.id)]); if (!o) E('Esa observación ya no existe');
      run('UPDATE observaciones SET fecha=?, tipo=?, texto=?, padres=?, hablado=?, hablado_nota=? WHERE id=?', [fecha, tipo, texto, padres, padres ? o.hablado : '', padres ? o.hablado_nota : '', o.id]);
      return { ok: true, id: o.id };
    }
    if (!q1('SELECT 1 FROM alumnos WHERE id = ?', [ent(d.alumno_id)])) E('El alumno no existe');
    return { ok: true, id: run('INSERT INTO observaciones(alumno_id, fecha, tipo, texto, padres, creado) VALUES (?,?,?,?,?,?)', [ent(d.alumno_id), fecha, tipo, texto, padres, ahora()]) };
  });
  ruta('POST', '/api/observaciones/<int>/hablado', (d, oid) => {
    if (!q1('SELECT 1 FROM observaciones WHERE id = ? AND padres = 1', [+oid])) E('Esa observación no tiene "hablar con los padres"');
    if (d.deshacer) run("UPDATE observaciones SET hablado = '', hablado_nota = '' WHERE id = ?", [+oid]);
    else {
      const f = fechaOk(d.fecha || hoy()); if (f > hoy()) E('La fecha no puede ser de un día que todavía no llegó');
      run('UPDATE observaciones SET hablado = ?, hablado_nota = ? WHERE id = ?', [f, strip(d.nota).slice(0, 500), +oid]);
    }
    return { ok: true };
  });
  /* actas de conducta (modelo de la escuela, para imprimir y firmar) */
  function actaEncabezado(cfg, e) {
    const guardado = cfg['acta_enc_' + e.id] || ''; if (guardado) return guardado;
    let prov = cfg.provincia || 'Chaco'; prov = prov.toLowerCase() === 'chaco' ? 'del Chaco' : 'de ' + prov;
    const nom = escuelaCompleta(e);
    return `En ${e.localidad || '...........................'}, de la Provincia ${prov}, en el Establecimiento ${nom}${e.direccion ? ', ubicado en ' + e.direccion : ''}.`;
  }
  const escuelaCompleta = e => e.nombre + (e.numero && !e.nombre.includes(e.numero) ? ' N° ' + e.numero : '');   // "EGB" + "352" -> "EGB N° 352"
  const actaCierre = ciclo => `Se presenta a Dirección del Establecimiento, con el fin que se proceda de acuerdo a las Normas de Convivencia Institucional en vigencia ciclo lectivo ${ciclo}.`;
  ruta('GET', '/api/actas/nueva', (d, a) => {
    const cfg = getConfig(); let o = null;
    if (a.get('observacion_id')) { o = q1('SELECT * FROM observaciones WHERE id = ?', [ent(a.get('observacion_id'))]); if (!o) E('Esa observación ya no existe'); }
    const aid = o ? o.alumno_id : ent(a.get('alumno_id')), al = q1('SELECT * FROM alumnos WHERE id = ?', [aid]); if (!al) E('El alumno no existe');
    const c = curso(al.curso_id), e = q1('SELECT * FROM escuelas WHERE id = ?', [c.escuela_id]), fecha = o ? o.fecha : hoy();
    return { curso_id: c.id, fecha, hora: fecha === hoy() ? new Date().toTimeString().slice(0, 5) : '', encabezado: actaEncabezado(cfg, e), espacio: c.materia || '',
      curso_txt: `${c.anio || ''} ${c.division || ''}`.trim(), profesor: cfg.nombre_consultorio || '', situacion: o ? o.texto : '', cierre: actaCierre(c.ciclo),
      alumnos: [aid], observacion_id: o ? o.id : null, escuela: escuelaCompleta(e), lista: alumnosDe(c.id) };
  });
  function acta(acid) {
    const t = q1('SELECT * FROM actas WHERE id = ?', [acid]); if (!t) E('Esa acta ya no existe');
    t.alumnos_det = q('SELECT a.id, a.apellido, a.nombre, a.tutor FROM acta_alumnos x JOIN alumnos a ON a.id = x.alumno_id WHERE x.acta_id = ? ORDER BY a.apellido, a.nombre', [acid]);
    t.alumnos = t.alumnos_det.map(x => x.id);
    const c = curso(t.curso_id); t.escuela = escuelaCompleta(q1('SELECT * FROM escuelas WHERE id = ?', [c.escuela_id])); t.lista = alumnosDe(c.id, true);
    return t;
  }
  ruta('GET', '/api/actas/<int>', (d, acid) => acta(+acid));
  ruta('POST', '/api/actas', d => {
    const situacion = strip(d.situacion).slice(0, 4000); if (!situacion) E('Escribí qué pasó (la situación)');
    const fecha = fechaOk(d.fecha || hoy()); if (fecha > hoy()) E('La fecha no puede ser de un día que todavía no llegó');
    const hr = hora(d.hora), c = curso(ent(d.curso_id)), validos = new Set(alumnosDe(c.id, true).map(x => x.id)), ids = [];
    for (const x of d.alumnos || []) if (/^\d+$/.test(String(x).trim()) && validos.has(+x) && !ids.includes(+x)) ids.push(+x);
    if (!ids.length) E('Marcá al menos un alumno involucrado');
    const par = [fecha, hr, strip(d.encabezado).slice(0, 800), txt(d.espacio, 120), txt(d.curso_txt, 60), txt(d.profesor, 120), situacion, strip(d.cierre).slice(0, 800)];
    let acid;
    if (d.id) { acid = ent(d.id); acta(acid); run('UPDATE actas SET fecha=?, hora=?, encabezado=?, espacio=?, curso_txt=?, profesor=?, situacion=?, cierre=? WHERE id=?', [...par, acid]); run('DELETE FROM acta_alumnos WHERE acta_id = ?', [acid]); }
    else acid = run('INSERT INTO actas(fecha, hora, encabezado, espacio, curso_txt, profesor, situacion, cierre, curso_id, creado) VALUES (?,?,?,?,?,?,?,?,?,?)', [...par, c.id, ahora()]);
    for (const aid of ids) run('INSERT INTO acta_alumnos(acta_id, alumno_id) VALUES (?,?)', [acid, aid]);
    run(`UPDATE observaciones SET acta_id = NULL WHERE acta_id = ? AND alumno_id NOT IN (${ids.join(',')})`, [acid]);
    const oid = ent(d.observacion_id);
    if (oid) run('UPDATE observaciones SET acta_id = ? WHERE id = ? AND acta_id IS NULL', [acid, oid]);
    for (const aid of ids) if (!q1('SELECT 1 FROM observaciones WHERE alumno_id = ? AND acta_id = ?', [aid, acid]))
      run('INSERT INTO observaciones(alumno_id, fecha, tipo, texto, acta_id, creado) VALUES (?,?,?,?,?,?)', [aid, fecha, 'CONDUCTA', 'Acta de conducta: ' + situacion.slice(0, 900), acid, ahora()]);
    if (par[2]) setCfg('acta_enc_' + c.escuela_id, par[2]);
    return { ok: true, id: acid };
  });
  ruta('DELETE', '/api/actas/<int>', (d, acid) => {
    run('UPDATE observaciones SET acta_id = NULL WHERE acta_id = ?', [+acid]); run('DELETE FROM acta_alumnos WHERE acta_id = ?', [+acid]); run('DELETE FROM actas WHERE id = ?', [+acid]);
    return { ok: true };
  });
  ruta('DELETE', '/api/observaciones/<int>', (d, oid) => { run('DELETE FROM observaciones WHERE id = ?', [+oid]); return { ok: true }; });

  /* asistencia y libro de temas */
  ruta('GET', '/api/cursos/<int>', (d, cid) => {
    cid = +cid; const cfg = getConfig(), c = curso(cid);
    c.alumnos = alumnosDe(cid, true);
    const asis = asistenciaAlumnos(cfg, cid), obs = obsCuenta(cid);
    for (const a of c.alumnos) { a.asis = asis[a.id] || null; a.obs = obs[a.id] || { n: 0, pend: 0 }; }
    c.clases_dictadas = val('SELECT COUNT(*) FROM clases WHERE curso_id = ? AND hubo = 1', [cid]);
    c.ultima_clase = val('SELECT MAX(fecha) FROM clases WHERE curso_id = ?', [cid]) || '';
    c.horarios = q('SELECT * FROM horarios WHERE curso_id = ? ORDER BY dia, desde', [cid]);
    return c;
  });
  ruta('GET', '/api/cursos/<int>/clase', (d, cid, a) => {
    cid = +cid; const fecha = fechaOk(a.get('fecha') || hoy()), c = curso(cid);
    const k = q1('SELECT * FROM clases WHERE curso_id = ? AND fecha = ?', [cid, fecha]);
    const est = {}; for (const r of q('SELECT * FROM asistencia WHERE clase_id = ?', [k ? k.id : 0])) est[r.alumno_id] = r.estado;
    const alumnos = alumnosDe(cid, true).filter(x => x.activo || x.id in est);
    const obs = obsCuenta(cid);
    for (const x of alumnos) { x.estado = est[x.id] || ''; x.obs = obs[x.id] || { n: 0, pend: 0 }; }
    const esp = diasEspeciales(fecha, fecha);
    const anterior = q1('SELECT fecha, tema FROM clases WHERE curso_id = ? AND fecha < ? AND hubo = 1 ORDER BY fecha DESC LIMIT 1', [cid, fecha]);
    return { curso: c, fecha, clase: k, alumnos, aviso: sinClases(esp, fecha, c.escuela_id), anterior };
  });
  ruta('POST', '/api/cursos/<int>/clase', (d, cid) => {
    cid = +cid;
    const fecha = fechaOk(d.fecha);
    if (fecha > masDias(hoy(), 1)) E('No se puede tomar asistencia de un día que todavía no llegó');
    const hubo = [0, false, '0'].includes(d.hubo) ? 0 : 1, motivo = txt(d.motivo, 160);
    if (!hubo && !motivo) E('Escribí por qué no hubo clase (ej. paro, acto, lluvia)');
    const asis = d.asistencia || {};
    curso(cid);
    const par = [hubo, motivo, strip(d.tema).slice(0, 2000), strip(d.actividades).slice(0, 2000), strip(d.tarea).slice(0, 1000)];
    const k = q1('SELECT id FROM clases WHERE curso_id = ? AND fecha = ?', [cid, fecha]);
    let kid;
    if (k) { kid = k.id; run('UPDATE clases SET hubo=?, motivo=?, tema=?, actividades=?, tarea=? WHERE id=?', [...par, kid]); }
    else kid = run('INSERT INTO clases(hubo, motivo, tema, actividades, tarea, curso_id, fecha) VALUES (?,?,?,?,?,?,?)', [...par, cid, fecha]);
    run('DELETE FROM asistencia WHERE clase_id = ?', [kid]);
    if (hubo) {
      const validos = new Set(alumnosDe(cid, true).map(x => x.id)), ids = new Set(alumnosDe(cid).map(x => x.id));
      for (const x of Object.keys(asis)) if (validos.has(ent(x))) ids.add(ent(x));
      for (const aid of ids) {
        const e = String(asis[String(aid)] || 'P').toUpperCase();
        if (!ESTADOS_ASIS.includes(e)) E('Estado de asistencia inválido: ' + e);
        run('INSERT INTO asistencia(clase_id, alumno_id, estado) VALUES (?,?,?)', [kid, aid, e]);
      }
    }
    return { ok: true, id: kid, ausentes: val("SELECT COUNT(*) FROM asistencia WHERE clase_id = ? AND estado IN ('A','J')", [kid]) };
  });
  ruta('DELETE', '/api/clases/<int>', (d, kid) => { run('DELETE FROM asistencia WHERE clase_id = ?', [+kid]); run('DELETE FROM clases WHERE id = ?', [+kid]); return { ok: true }; });
  ruta('GET', '/api/cursos/<int>/planilla', (d, cid, a) => {
    cid = +cid; const cfg = getConfig(), c = curso(cid), mes = a.get('mes');
    let desde, hasta;
    if (mes) { desde = fechaOk(mes.slice(0, 7) + '-01'); hasta = finDeMes(desde); }
    else { desde = fechaOk(a.get('desde') || c.ciclo + '-01-01'); hasta = fechaOk(a.get('hasta') || c.ciclo + '-12-31'); }
    const clases = q('SELECT id, fecha, hubo, motivo, tema FROM clases WHERE curso_id = ? AND fecha BETWEEN ? AND ? ORDER BY fecha', [cid, desde, hasta]);
    const marcas = {};
    for (const r of q('SELECT a.* FROM asistencia a JOIN clases k ON k.id = a.clase_id WHERE k.curso_id = ? AND k.fecha BETWEEN ? AND ?', [cid, desde, hasta])) (marcas[r.alumno_id] = marcas[r.alumno_id] || {})[r.clase_id] = r.estado;
    const per = asistenciaAlumnos(cfg, cid, desde, hasta), anio = asistenciaAlumnos(cfg, cid);
    const alumnos = alumnosDe(cid, true).filter(x => x.activo || x.id in marcas);
    for (const x of alumnos) { x.marcas = marcas[x.id] || {}; x.periodo = per[x.id] || null; x.anio = anio[x.id] || null; }
    return { curso: c, desde, hasta, clases, alumnos, valor_tarde: cfgFloat(cfg, 'valor_tarde', 0.5), minimo: cfgFloat(cfg, 'asistencia_minima', 75) };
  });
  ruta('GET', '/api/cursos/<int>/temas', (d, cid) => {
    cid = +cid; const c = curso(cid);
    return { curso: c, clases: q("SELECT k.*, (SELECT COUNT(*) FROM asistencia a WHERE a.clase_id = k.id AND a.estado IN ('A','J')) AS ausentes, " +
      '(SELECT COUNT(*) FROM asistencia a WHERE a.clase_id = k.id) AS total FROM clases k WHERE k.curso_id = ? ORDER BY k.fecha', [cid]) };
  });

  /* evaluaciones y notas */
  ruta('GET', '/api/cursos/<int>/notas', (d, cid) => {
    cid = +cid; const cfg = getConfig(), c = curso(cid), nPer = cfg.periodos === '2' ? 2 : 3;
    const evs = q("SELECT * FROM evaluaciones WHERE curso_id = ? ORDER BY periodo, fecha = '', fecha, id", [cid]);
    const notas = {}, cierres = {};
    for (const r of q('SELECT n.* FROM notas n JOIN evaluaciones e ON e.id = n.evaluacion_id WHERE e.curso_id = ?', [cid])) (notas[r.alumno_id] = notas[r.alumno_id] || {})[r.evaluacion_id] = r.valor;
    for (const r of q('SELECT * FROM cierres WHERE curso_id = ?', [cid])) (cierres[r.alumno_id] = cierres[r.alumno_id] || {})[r.periodo] = r.nota;
    const aprob = cfgFloat(cfg, 'nota_aprobacion', 6);
    const alumnos = alumnosDe(cid, true).filter(x => x.activo || x.id in notas);
    for (const x of alumnos) {
      const mis = notas[x.id] || {};
      x.notas = mis; x.cierres = cierres[x.id] || {}; x.promedios = {};
      const finales = [];
      for (let p = 1; p <= nPer; p++) {
        const vals = evs.filter(e => e.periodo === p).map(e => [notaNum(mis[e.id]), e.peso || 1]).filter(([v]) => v !== null);
        const prom = vals.length ? r2(sum(vals, ([v, w]) => v * w) / sum(vals, ([, w]) => w)) : null;
        x.promedios[p] = prom;
        const cierre = notaNum(x.cierres[p]);
        if (cierre !== null || prom !== null) finales.push(cierre !== null ? cierre : prom);
      }
      x.promedio_anual = finales.length ? r2(sum(finales) / finales.length) : null;
      const fin = notaNum(x.cierres[9]);
      x.final = fin !== null ? fin : x.promedio_anual;
      x.aprobado = x.final === null ? null : x.final >= aprob;
    }
    return { curso: c, periodos: nPer, evaluaciones: evs, alumnos, aprobacion: aprob };
  });
  ruta('POST', '/api/evaluaciones', d => {
    const titulo = txt(d.titulo, 80); if (!titulo) E('Escribí el nombre de la evaluación (ej. Prueba 1, TP Fracciones)');
    const cfg = getConfig(), c = curso(ent(d.curso_id));
    const fecha = d.fecha ? fechaOk(d.fecha) : '';
    const periodo = entero(d.periodo, 'El período') || (fecha ? periodoDe(cfg, fecha) : 1), nPer = cfg.periodos === '2' ? 2 : 3;
    if (!(periodo >= 1 && periodo <= nPer)) E('Período inválido');
    const peso = num(d.peso || 1); if (peso <= 0) E('El peso tiene que ser mayor que 0');
    const par = [fecha, titulo, txt(d.tipo, 30) || 'Prueba', periodo, peso, strip(d.notas)];
    let eid;
    if (d.id) { run('UPDATE evaluaciones SET fecha=?, titulo=?, tipo=?, periodo=?, peso=?, notas=? WHERE id=? AND curso_id=?', [...par, ent(d.id), c.id]); eid = ent(d.id); }
    else {
      eid = run('INSERT INTO evaluaciones(fecha, titulo, tipo, periodo, peso, notas, curso_id) VALUES (?,?,?,?,?,?,?)', [...par, c.id]);
      if (fecha && d.agendar) run('INSERT INTO eventos(fecha, titulo, tipo, escuela_id, curso_id, creado) VALUES (?,?,?,?,?,?)', [fecha, `${titulo} · ${c.titulo}`, 'EXAMEN', c.escuela_id, c.id, ahora()]);
    }
    return { ok: true, id: eid };
  });
  ruta('DELETE', '/api/evaluaciones/<int>', (d, eid) => { run('DELETE FROM notas WHERE evaluacion_id = ?', [+eid]); run('DELETE FROM evaluaciones WHERE id = ?', [+eid]); return { ok: true }; });
  ruta('POST', '/api/notas', d => {
    for (const it of d.items || [d]) {
      const ev = q1('SELECT curso_id FROM evaluaciones WHERE id = ?', [ent(it.evaluacion_id)]), al = q1('SELECT curso_id FROM alumnos WHERE id = ?', [ent(it.alumno_id)]);
      if (!ev || !al || ev.curso_id !== al.curso_id) E('Evaluación o alumno inválido');
      run('INSERT OR REPLACE INTO notas(evaluacion_id, alumno_id, valor) VALUES (?,?,?)', [ent(it.evaluacion_id), ent(it.alumno_id), validarNota(it.valor)]);
    }
    return { ok: true };
  });
  ruta('POST', '/api/cierres', d => {
    const al = q1('SELECT curso_id FROM alumnos WHERE id = ?', [ent(d.alumno_id)]); if (!al) E('Alumno inválido');
    const p = entero(d.periodo, 'El período'); if (![1, 2, 3, 9].includes(p)) E('Período inválido');
    const v = validarNota(d.nota);
    if (v) run('INSERT OR REPLACE INTO cierres(curso_id, alumno_id, periodo, nota) VALUES (?,?,?,?)', [al.curso_id, ent(d.alumno_id), p, v]);
    else run('DELETE FROM cierres WHERE alumno_id = ? AND periodo = ?', [ent(d.alumno_id), p]);
    return { ok: true };
  });

  /* gastos */
  const mesOk = v => { const m = String(v || hoy().slice(0, 7)).slice(0, 7); fechaOk(m + '-01', 'mes'); return m; };
  const mesMas = (m, n) => { const d = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1 + n, 1, 12); return iso(d).slice(0, 7); };
  ruta('GET', '/api/gastos/categorias', () => q('SELECT c.*, (SELECT COUNT(*) FROM gastos g WHERE g.categoria_id = c.id) AS usos FROM gasto_cats c WHERE c.activo = 1 ORDER BY c.orden, c.id'));
  ruta('POST', '/api/gastos/categorias', d => {
    const nombre = txt(d.nombre, 40); if (!nombre) E('Escribí el nombre de la categoría (ej. Supermercado)');
    const emoji = String(d.emoji || '').trim().slice(0, 8);
    const otra = q1('SELECT id FROM gasto_cats WHERE activo = 1 AND lower(nombre) = lower(?) AND id != ?', [nombre, ent(d.id)]);
    if (otra) E('Ya tenés una categoría con ese nombre');
    if (d.id) { run('UPDATE gasto_cats SET nombre = ?, emoji = ? WHERE id = ?', [nombre, emoji, ent(d.id)]); return { ok: true, id: ent(d.id) }; }
    return { ok: true, id: run('INSERT INTO gasto_cats(nombre, emoji, orden) VALUES (?,?,?)', [nombre, emoji, (val('SELECT MAX(orden) FROM gasto_cats') || 0) + 1]) };
  });
  ruta('DELETE', '/api/gastos/categorias/<int>', (d, id) => {
    id = +id;
    if (q1('SELECT 1 FROM gastos WHERE categoria_id = ?', [id])) run('UPDATE gasto_cats SET activo = 0 WHERE id = ?', [id]);   // los gastos viejos la siguen mostrando
    else run('DELETE FROM gasto_cats WHERE id = ?', [id]);
    return { ok: true };
  });
  ruta('GET', '/api/gastos', (d, a) => {
    const mes = mesOk(a.get('mes')), ant = mesMas(mes, -1), anio = mes.slice(0, 4);
    const lista = q("SELECT g.*, c.nombre AS categoria, c.emoji FROM gastos g LEFT JOIN gasto_cats c ON c.id = g.categoria_id WHERE substr(g.fecha, 1, 7) = ? ORDER BY g.fecha DESC, g.id DESC", [mes]);
    for (const g of lista) g.medio_txt = MEDIOS[g.medio] || g.medio || '';
    const total = r2(sum(lista, g => g.monto)), anterior = r2(val("SELECT COALESCE(SUM(monto), 0) FROM gastos WHERE substr(fecha, 1, 7) = ?", [ant]));
    const porCat = q("SELECT c.id, COALESCE(c.nombre, 'Sin categoría') AS nombre, COALESCE(c.emoji, '') AS emoji, SUM(g.monto) AS total, COUNT(*) AS n FROM gastos g " +
      "LEFT JOIN gasto_cats c ON c.id = g.categoria_id WHERE substr(g.fecha, 1, 7) = ? GROUP BY g.categoria_id ORDER BY total DESC", [mes]);
    for (const c of porCat) { c.total = r2(c.total); c.pct = total ? r2(100 * c.total / total) : 0; }
    const porMedio = q("SELECT medio, SUM(monto) AS total, COUNT(*) AS n FROM gastos WHERE substr(fecha, 1, 7) = ? GROUP BY medio ORDER BY total DESC", [mes])
      .map(x => ({ medio: x.medio, nombre: MEDIOS[x.medio] || x.medio || 'Sin indicar', total: r2(x.total), n: x.n }));
    const meses = {}; for (const r of q("SELECT substr(fecha, 1, 7) AS m, SUM(monto) AS t FROM gastos WHERE substr(fecha, 1, 4) = ? GROUP BY m", [anio])) meses[r.m] = r2(r.t);
    const porMes = Array.from({ length: 12 }, (_, i) => { const m = `${anio}-${String(i + 1).padStart(2, '0')}`; return { mes: m, total: meses[m] || 0 }; });
    return { mes, gastos: lista, total, anterior, variacion: anterior ? r2(100 * (total - anterior) / anterior) : null, por_categoria: porCat, por_medio: porMedio,
      por_mes: porMes, total_anio: r2(sum(porMes, x => x.total)), medios: MEDIOS };
  });
  ruta('POST', '/api/gastos', d => {
    const monto = r2(num(d.monto)); if (!(monto > 0)) E('Escribí cuánto gastaste');
    if (monto > 1e10) E('El importe es demasiado grande: revisalo');
    const fecha = fechaOk(d.fecha || hoy()); if (fecha > hoy()) E('La fecha no puede ser de un día que todavía no llegó');
    const cat = ent(d.categoria_id); if (!q1('SELECT 1 FROM gasto_cats WHERE id = ?', [cat])) E('Elegí la categoría');
    const medio = String(d.medio || 'EFECTIVO').toUpperCase(); if (!(medio in MEDIOS)) E('Medio de pago inválido');
    const par = [fecha, monto, cat, medio, txt(d.detalle, 120)];
    if (d.id) { if (!q1('SELECT 1 FROM gastos WHERE id = ?', [ent(d.id)])) E('Ese gasto ya no existe'); run('UPDATE gastos SET fecha=?, monto=?, categoria_id=?, medio=?, detalle=? WHERE id=?', [...par, ent(d.id)]); return { ok: true, id: ent(d.id) }; }
    return { ok: true, id: run('INSERT INTO gastos(fecha, monto, categoria_id, medio, detalle, creado) VALUES (?,?,?,?,?,?)', [...par, ahora()]) };
  });
  ruta('DELETE', '/api/gastos/<int>', (d, id) => { run('DELETE FROM gastos WHERE id = ?', [+id]); return { ok: true }; });

  /* inicio y avisos */
  ruta('GET', '/api/inicio', () => {
    const cfg = getConfig(), h = hoy(), anio = +h.slice(0, 4);
    const out = { hoy: dia(h), manana: dia(masDias(h, 1)) };
    out.proximos = q('SELECT v.*, e.nombre AS escuela, e.color FROM eventos v LEFT JOIN escuelas e ON e.id = v.escuela_id WHERE v.fecha > ? AND v.fecha <= ? AND v.hecho = 0 ORDER BY v.fecha, v.hora',
      [masDias(h, 1), masDias(h, 21)]);
    const esp = diasEspeciales(h, masDias(h, 120));
    const prox = Object.keys(esp).filter(f => f > h && esp[f].some(x => NO_LAB.includes(x.tipo))).sort();
    out.proximo_feriado = prox.length ? { fecha: prox[0], nombre: esp[prox[0]][0].nombre, dias: entreDias(h, prox[0]) } : null;
    out.licencia_activa = licenciasEn(h);
    out.sin_certificado = q('SELECT MIN(l.id) AS id, l.desde, l.hasta, GROUP_CONCAT(DISTINCT a.codigo) AS codigo, a.descripcion FROM licencias l JOIN articulos a ON a.id = l.articulo_id ' +
      "WHERE a.certificado = 1 AND l.certificado = 0 AND l.estado != 'RECHAZADA' AND l.desde >= ? GROUP BY COALESCE(l.grupo, l.id) ORDER BY l.desde", [anio + '-01-01']);
    const riesgo = [];
    for (const c of q('SELECT c.*, e.nombre AS escuela FROM cursos c JOIN escuelas e ON e.id = c.escuela_id WHERE c.activo = 1 AND c.ciclo = ?', [anio])) {
      const asis = asistenciaAlumnos(cfg, c.id);
      for (const a of q('SELECT * FROM alumnos WHERE curso_id = ? AND activo = 1', [c.id])) {
        const x = asis[a.id];
        if (x && x.riesgo) riesgo.push({ curso_id: c.id, curso: nombreCurso(c), escuela: c.escuela, alumno: `${a.apellido} ${a.nombre}`, porcentaje: x.porcentaje, libre: x.libre, inasistencias: x.inasistencias });
      }
    }
    out.riesgo = riesgo.sort((a, b) => a.porcentaje - b.porcentaje).slice(0, 30);
    out.padres = padresPendientes(); for (const p of out.padres) p.curso = nombreCurso(p);
    out.tiene_escuelas = !!q1('SELECT 1 FROM escuelas WHERE activo = 1');
    out.tiene_horario = !!q1('SELECT 1 FROM horarios');
    return out;
  });
  ruta('GET', '/api/notificaciones', () => {
    const out = [], h = hoy(), anio = +h.slice(0, 4);
    const ev = val('SELECT COUNT(*) FROM eventos WHERE fecha BETWEEN ? AND ? AND hecho = 0', [h, masDias(h, 1)]);
    if (ev) out.push({ ico: 'cal', texto: `${ev} cosa${ev === 1 ? '' : 's'} en la agenda para hoy y mañana`, ir: 'agenda' });
    const sc = val("SELECT COUNT(DISTINCT COALESCE(l.grupo, l.id)) FROM licencias l JOIN articulos a ON a.id = l.articulo_id WHERE a.certificado = 1 AND l.certificado = 0 AND l.estado != 'RECHAZADA' AND l.desde >= ?", [anio + '-01-01']);
    if (sc) out.push({ ico: 'alerta', texto: `${sc} licencia${sc === 1 ? '' : 's'} sin presentar el certificado`, ir: 'licencias' });
    for (const c of contador(anio)) if (c.excedido) out.push({ ico: 'alerta', texto: 'Pasaste el tope de días de ' + (c.codigo || c.descripcion), ir: 'licencias' });
    const pp = new Set(padresPendientes().map(p => p.alumno_id)).size;
    if (pp) out.push({ ico: 'users', texto: `Hablar con los padres de ${pp} alumno${pp === 1 ? '' : 's'}`, ir: 'principal' });
    return out;
  });

  /* configuración */
  ruta('GET', '/api/config', () => Object.assign(getConfig(), { licencia_estado: DocLic.estado() }));
  ruta('POST', '/api/config', d => {
    const bloq = DocLic.estado().bloqueado;
    for (const [k, v] of Object.entries(d)) if (k in DEFAULT_CONFIG && k !== 'licencia' && (k === 'nombre_consultorio' || !bloq)) setCfg(k, v);
    return { ok: true };
  });

  /* términos de uso y aviso de privacidad (legal.py) */
  ruta('GET', '/api/legal', () => {
    const cfg = getConfig();
    return { version: LEGAL.version, aceptado: cfg.legal_version === LEGAL.version, fecha: cfg.legal_fecha || '', usuario: cfg.legal_usuario || '', admin: true, textos: LEGAL };
  });
  ruta('POST', '/api/legal/aceptar', d => {
    if (!d.acepto) E('Tildá la casilla "Leí y acepto" para seguir');
    const f = ahora();
    setCfg('legal_version', LEGAL.version); setCfg('legal_fecha', f); setCfg('legal_usuario', 'celular');
    return { ok: true, version: LEGAL.version, fecha: f };
  });

  /* ------------------------------------------------ el "servidor": atiende los pedidos que en la PC iban a app.py */
  const LIBRES = ['/api/config', '/api/legal/aceptar'];
  async function atender(metodo, url, cuerpo) {
    const u = new URL(url, location.href), path = u.pathname.replace(/^.*?(\/api\/)/, '/api/');
    for (const [re, f] of R[metodo] || []) {
      const m = path.match(re); if (!m) continue;
      let datos = {};
      if (cuerpo && typeof cuerpo === 'string') { try { datos = JSON.parse(cuerpo) || {}; } catch (e) { datos = {}; } }
      if (metodo !== 'GET' && !LIBRES.includes(path)) {
        const cfg = getConfig();
        if (cfg.legal_version !== LEGAL.version) throw Object.assign(new ErrorNegocio('Antes de empezar tenés que aceptar los términos de uso (se muestran al abrir la app).'), { status: 403 });
        const lic = DocLic.estado();
        if (lic.bloqueado) throw Object.assign(new ErrorNegocio(lic.mensaje + ' Para seguir usándola activala en Configuración.'), { status: 403 });
      }
      if (metodo === 'GET') return f(datos, ...m.slice(1).map(decodeURIComponent), u.searchParams);
      DB.exec('SAVEPOINT pedido');          // si algo falla a mitad de camino, no queda nada a medias (como en la PC)
      let r;
      try { r = await f(datos, ...m.slice(1).map(decodeURIComponent), u.searchParams); }
      catch (e) { DB.exec('ROLLBACK TO pedido; RELEASE pedido'); throw e; }
      DB.exec('RELEASE pedido');
      await guardarBase();
      return r;
    }
    throw Object.assign(new Error('No existe: ' + path), { status: 404 });
  }

  /* ------------------------------------------------ copias: el mismo .zip que "Descargar copia completa" de la PC (datos/docente.db) */
  const copiaZip = () => ZIP.crear([{ nombre: 'datos/docente.db', datos: DB.export() }]);
  const copiaDb = () => new Blob([DB.export()], { type: 'application/octet-stream' });
  async function restaurar(file) {
    const cab = new Uint8Array(await file.slice(0, 16).arrayBuffer()), t = String.fromCharCode(...cab);
    if (t.startsWith('SQLite format 3')) return reemplazarBase(new Uint8Array(await file.arrayBuffer()));
    if (cab[0] !== 0x50 || cab[1] !== 0x4b) E('Elegí la copia: el .zip de la copia completa (de la PC o del celular) o el archivo docente.db');
    const ents = await ZIP.leer(file);
    const db = ents.find(e => /(^|\/)docente(_[\d-]+)?\.db$/i.test(e.nombre));
    if (!db) E('Ese .zip no tiene la base de la Agenda Docente (docente.db)');
    return reemplazarBase(await db.datos());
  }
  /* una copia por día adentro del celular (las últimas 7) */
  async function copiaDiaria(forzar) {
    try {
      const k = forzar ? 'antes-' + ahora().replace(/[: ]/g, '-') : 'dia-' + hoy();
      if (!forzar && await idbGet('copias', k)) return;
      await idbPut('copias', k, DB.export());
      const todas = (await idbKeys('copias')).sort((a, b) => a.slice(-19).localeCompare(b.slice(-19)));
      const dias = todas.filter(x => x.startsWith('dia-')), antes = todas.filter(x => x.startsWith('antes-'));
      for (const x of [...dias.slice(0, Math.max(0, dias.length - 7)), ...antes.slice(0, Math.max(0, antes.length - 3))]) await idbDel('copias', x);
    } catch (e) { console.warn('copia diaria', e); }
  }
  async function copiasInternas() {
    const l = [];
    for (const k of await idbKeys('copias')) l.push({ k, fecha: k.startsWith('dia-') ? k.slice(4) : k.slice(6) });
    return l.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }
  async function volverACopia(k) { const b = await idbGet('copias', k); if (!b) E('No se encontró esa copia'); return reemplazarBase(b); }

  return { abrir, atender, copiaZip, copiaDb, restaurar, copiaDiaria, copiasInternas, volverACopia, ErrorNegocio, cfg: getConfig,
    setCfg: async (k, v) => { setCfg(k, v); await guardarBase(); },
    ultimaCopia: () => val("SELECT valor FROM config WHERE clave = '_ultima_copia'") || '',
    marcarCopia: async () => { setCfg('_ultima_copia', ahora()); await guardarBase(); },
    resumen: () => ({ escuelas: val('SELECT COUNT(*) FROM escuelas'), cursos: val('SELECT COUNT(*) FROM cursos'), alumnos: val('SELECT COUNT(*) FROM alumnos'), clases: val('SELECT COUNT(*) FROM clases') }),
    _q: q, _delAnio: delAnio };
})();
