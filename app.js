// ==========================================
// CONFIGURACIÓN GLOBAL Y ROTACIÓN DE KEYS
// ==========================================
const API_KEYS = [
    "0464d33c8013d01fb7387b5148f18a9a", 
    "31dc5f2762254847a825e1025257a759"
];

let baseDeDatosHoy = [];
let estadoFiltroActual = 'proximos';
let partidoSeleccionadoId = null;
let ticketsMultiplesGenerados = {}; 
let scoresAnteriores = {}; 

const estadosEnVivo = ['IN_PLAY', 'PAUSED', 'LIVE'];
const estadosProximos = ['TIMED', 'SCHEDULED', 'LIVE'];
const ESCUDO_RESPALDO = "https://cdn-icons-png.flaticon.com/512/53/53283.png";

// ==========================================
// FILTRO DE LIGAS (Solo Ligas Top, Arg y Bra)
// ==========================================
const LIGAS_TOP = [
    1, 2, 3, 4, 9, 13, 11, 12, 39, 140, 135, 78, 61, 128, 130, 129, 131, 71, 73
];

// ==========================================
// EFECTOS DE GOL
// ==========================================
const estiloGol = document.createElement('style');
estiloGol.innerHTML = `
    @keyframes flashGol { 0% { background-color: #2ecc71; transform: scale(1.02); } 100% { background-color: var(--tarjeta-bg); transform: scale(1); } }
    .gol-reciente { animation: flashGol 2s ease-out; }
`;
document.head.appendChild(estiloGol);

function reproducirBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    } catch (e) { console.log("Audio no soportado"); }
}

// ==========================================
// TRADUCTOR DE CONSEJOS (INGLÉS A ESPAÑOL)
// ==========================================
function traducirConsejo(texto) {
    if (!texto) return 'No disponible';
    let t = texto.toLowerCase();
    
    // Diccionario de palabras clave de la API
    const dicc = {
        "winner": "Ganador", "home": "Local", "away": "Visitante", "draw": "Empate",
        "combo": "Combinada", "double chance": "Doble Oportunidad", "and": "y", "or": "o",
        "over": "Más de", "under": "Menos de", "goals": "goles", "yes": "Sí", "no": "No",
        "to score": "anota", "both teams": "Ambos equipos"
    };

    // Reemplazamos cada palabra clave
    for (let eng in dicc) {
        let re = new RegExp("\\b" + eng + "\\b", "gi");
        t = t.replace(re, dicc[eng]);
    }
    
    // Capitalizamos la primera letra para que quede prolijo
    return t.charAt(0).toUpperCase() + t.slice(1);
}

// ==========================================
// MOTOR DE ROTACIÓN DE KEYS
// ==========================================
async function fetchConRotacion(url) {
    for (let i = 0; i < API_KEYS.length; i++) {
        try {
            const res = await fetch(url, { headers: { 'x-apisports-key': API_KEYS[i] } });
            const data = await res.json();
            
            if (!data.errors || data.errors.length === 0 || !data.errors.rateLimit) {
                return data;
            }
            console.warn(`Key ${i + 1} agotada. Saltando a la siguiente...`);
        } catch (e) {
            console.warn(`Error de red con Key ${i + 1}.`);
        }
    }
    return null; 
}

// ==========================================
// CARGA INICIAL DE PARTIDOS (Ventana 24HS Reales)
// ==========================================
async function fetchPartidos() {
    const zona = Intl.DateTimeFormat().resolvedOptions().timeZone; 
    const ahora = new Date();
    const manana = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);

    const formatoDia = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    // Pedimos hoy y mañana para cubrir la noche/madrugada
    const dataHoy = await fetchConRotacion(`https://v3.football.api-sports.io/fixtures?date=${formatoDia(ahora)}&timezone=${zona}`);
    const dataManana = await fetchConRotacion(`https://v3.football.api-sports.io/fixtures?date=${formatoDia(manana)}&timezone=${zona}`);
    
    let todosLosEventos = [];
    if (dataHoy && dataHoy.response) todosLosEventos = todosLosEventos.concat(dataHoy.response);
    if (dataManana && dataManana.response) todosLosEventos = todosLosEventos.concat(dataManana.response);
    
    // Filtramos la ventana de 24hs (Mantenemos los que empezaron hace 4hs para no perder el vivo)
    const limiteInferior = ahora.getTime() - (4 * 60 * 60 * 1000);
    const limiteSuperior = ahora.getTime() + (24 * 60 * 60 * 1000);

    const eventos24h = todosLosEventos.filter(p => {
        const tiempoPartido = new Date(p.fixture.date).getTime();
        return tiempoPartido >= limiteInferior && tiempoPartido <= limiteSuperior;
    });

    return eventos24h.map(p => {
        let estado = 'SCHEDULED';
        const estadosLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'];
        const estadosTerm = ['FT', 'AET', 'PEN', 'AWD', 'WO'];

        if (estadosLive.includes(p.fixture.status.short)) estado = 'IN_PLAY';
        else if (estadosTerm.includes(p.fixture.status.short)) estado = 'FINISHED';

        return {
            id: p.fixture.id, utcDate: p.fixture.date, status: estado,
            competition: { id: p.league.id, name: p.league.name, emblem: p.league.logo }, 
            homeTeam: { id: p.teams.home.id, name: p.teams.home.name, shortName: p.teams.home.name, crest: p.teams.home.logo },
            awayTeam: { id: p.teams.away.id, name: p.teams.away.name, shortName: p.teams.away.name, crest: p.teams.away.logo },
            score: { fullTime: { home: p.goals.home, away: p.goals.away } }
        };
    });
}

async function iniciarApp() {
    const contenedor = document.getElementById('contenedor-partidos');
    contenedor.innerHTML = `<p style="color: var(--verde-principal); padding:20px;">⏳ Conectando servidores y procesando datos de las próximas 24hs...</p>`;
    
    const todosLosPartidos = await fetchPartidos();
    
    baseDeDatosHoy = todosLosPartidos.filter(p => LIGAS_TOP.includes(p.competition.id));

    baseDeDatosHoy.forEach(p => { scoresAnteriores[p.id] = { h: p.score?.fullTime?.home || 0, a: p.score?.fullTime?.away || 0 }; });

    if (baseDeDatosHoy.length > 0) {
        generarCombinadaDelDia(); 
        cargarBuscadorLigas(baseDeDatosHoy);
        aplicarFiltrosMaster();
    } else {
        contenedor.innerHTML = `<div style="padding:20px; border:1px solid var(--alerta); margin:20px;"><p style="color:var(--alerta)">⚠️ No hay partidos de Ligas Top en las próximas 24 horas.</p></div>`;
    }
}

// ==========================================
// CACHÉ INTELIGENTE Y TABLAS
// ==========================================
async function cargarTablaConCache(idPartido) {
    const p = baseDeDatosHoy.find(item => item.id === idPartido); if (!p) return;
    const cacheKey = `gp_tabla_cache_${p.competition.id}`;
    const dataCache = JSON.parse(localStorage.getItem(cacheKey));
    const ahora = Date.now();
    
    const cont = document.getElementById('contenido-lazy-tabla');
    cont.innerHTML = '<p style="color:var(--verde-principal)">⏳ Buscando posiciones...</p>';

    if (dataCache && (ahora - dataCache.timestamp < 86400000)) { renderizarTablaHTML(dataCache.datos); return; }

    try {
        let datosTabla = [];
        const data = await fetchConRotacion(`https://v3.football.api-sports.io/standings?league=${p.competition.id}&season=${new Date().getFullYear()}`);
        
        if (data && data.response && data.response.length > 0) {
            datosTabla = data.response[0].league.standings[0].map(t => ({ pos: t.rank, equipo: t.team.name, pts: t.points, pj: t.all.played }));
        }

        if (datosTabla.length > 0) {
            localStorage.setItem(cacheKey, JSON.stringify({ timestamp: ahora, datos: datosTabla }));
            renderizarTablaHTML(datosTabla);
        } else { cont.innerHTML = '<p style="color:var(--texto-gris)">Torneo sin tabla disponible en la API.</p>'; }
    } catch (e) { cont.innerHTML = '<p style="color:var(--alerta)">Error al cargar posiciones.</p>'; }
}

function renderizarTablaHTML(datos) {
    let html = `<table style="width:100%; text-align:left; border-collapse:collapse; font-size:0.85rem; background:rgba(0,0,0,0.2);"><tr style="border-bottom:1px solid rgba(255,255,255,0.1); color:var(--texto-gris)"><th style="padding:5px">#</th><th>Equipo</th><th>PJ</th><th>Pts</th></tr>`;
    datos.slice(0, 12).forEach(d => { html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.05)"><td style="padding:5px">${d.pos}</td><td>${d.equipo}</td><td>${d.pj}</td><td style="color:var(--verde-principal); font-weight:bold;">${d.pts}</td></tr>`; });
    document.getElementById('contenido-lazy-tabla').innerHTML = html + '</table>';
}

// ==========================================
// DATOS REALES: Predicciones H2H de API-Sports
// ==========================================
async function obtenerDatosReales(idFixture) {
    const cacheKey = `gp_prediccion_${idFixture}`;
    const cacheData = localStorage.getItem(cacheKey);
    
    if (cacheData) { return JSON.parse(cacheData); }

    const urlPredicciones = `https://v3.football.api-sports.io/predictions?fixture=${idFixture}`;
    const data = await fetchConRotacion(urlPredicciones);
        
    if (data && data.response && data.response.length > 0) {
        const analisis = data.response[0];
        
        const resultado = {
            exito: true,
            local: analisis.predictions.percent.home,
            empate: analisis.predictions.percent.draw,
            visita: analisis.predictions.percent.away,
            // Aplicamos el traductor de inglés a español al consejo de la API
            consejo: traducirConsejo(analisis.predictions.advice)
        };
        localStorage.setItem(cacheKey, JSON.stringify(resultado));
        return resultado;
    } else {
        return { exito: false };
    }
}

// ==========================================
// ESTIMACIÓN BASE (Para Fallback y Combinadas)
// ==========================================
function analizarMercadosPartido(p) {
    const loc = p.homeTeam.shortName || p.homeTeam.name;
    const vis = p.awayTeam.shortName || p.awayTeam.name;
    const idSum = p.homeTeam.id + p.awayTeam.id;
    let probGanaLocal = Math.min(Math.max(45 + (p.homeTeam.id % 15) - (p.awayTeam.id % 10), 12), 88);
    let probMas2_5 = Math.min(Math.max(40 + ((p.competition.id % 4) * 8) + ((p.score?.fullTime?.home || 0) * 10), 15), 92);
    let probCorners = 52 + (idSum % 22);
    
    let mercados = [
        { m: `🏆 Gana ${loc}`, pr: probGanaLocal },
        { m: "🔥 +2.5 Goles", pr: probMas2_5 },
        { m: "🚩 +8.5 Córners", pr: probCorners }
    ];

    return mercados.map(item => {
        let cuota = (100 / item.pr).toFixed(2);
        if (cuota < 1.05) cuota = "1.15";
        return { mercado: item.m, prob: Math.round(item.pr), cuota: cuota };
    });
}

// ==========================================
// RENDER Y FILTROS
// ==========================================
function setFiltroEstado(estado) {
    estadoFiltroActual = estado;
    document.querySelectorAll('.btn-filto-main').forEach(b => b.classList.remove('activo'));
    document.getElementById('btn-' + estado).classList.add('activo');
    document.getElementById('btn-refresh').classList.toggle('oculto', estado !== 'envivo');

    if (estado === 'combinada') {
        document.getElementById('herramientas-top').classList.add('oculto');
        document.getElementById('contenedor-partidos').classList.add('oculto');
        document.getElementById('seccion-combinada').classList.remove('oculto');
    } else {
        document.getElementById('herramientas-top').classList.remove('oculto');
        document.getElementById('contenedor-partidos').classList.remove('oculto');
        document.getElementById('seccion-combinada').classList.add('oculto');
        aplicarFiltrosMaster();
    }
}

function aplicarFiltrosMaster(idsGoles = []) {
    if (estadoFiltroActual === 'combinada') return; 
    let filtrados = baseDeDatosHoy;

    if (estadoFiltroActual === 'proximos') filtrados = filtrados.filter(p => estadosProximos.includes(p.status));
    else if (estadoFiltroActual === 'envivo') filtrados = filtrados.filter(p => estadosEnVivo.includes(p.status));

    const input = document.getElementById('filtro-ligas-input');
    if (input && input.value.trim() !== '') {
        const txt = input.value.toLowerCase().trim();
        filtrados = filtrados.filter(p => (p.competition.name && p.competition.name.toLowerCase().includes(txt)) || (p.homeTeam.name && p.homeTeam.name.toLowerCase().includes(txt)) || (p.awayTeam.name && p.awayTeam.name.toLowerCase().includes(txt)));
    }

    filtrados.sort((a, b) => {
        let tiempoA = new Date(a.utcDate).getTime();
        let tiempoB = new Date(b.utcDate).getTime();
        return (isNaN(tiempoA) ? 9999999999999 : tiempoA) - (isNaN(tiempoB) ? 9999999999999 : tiempoB);
    });

    renderizarPartidos(filtrados, idsGoles);
}

function renderizarPartidos(partidos, idsGoles = []) {
    const cont = document.getElementById('contenedor-partidos'); cont.innerHTML = '';
    if (partidos.length === 0) { cont.innerHTML = `<p style="padding:20px;">No hay eventos para mostrar.</p>`; return; }

    partidos.forEach(p => {
        const isLive = estadosEnVivo.includes(p.status);
        const esFechaValida = p.utcDate && !isNaN(new Date(p.utcDate).getTime());
        // Ajustamos la hora al huso horario local de forma limpia
        let hora = esFechaValida ? new Date(p.utcDate).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) : "TBA";
        
        const gL = p.score?.fullTime?.home ?? 0; 
        const gV = p.score?.fullTime?.away ?? 0;
        const marcador = isLive ? `<div class="live-badge">LIVE</div><span style="color:var(--alerta)">${gL} - ${gV}</span>` : `<span>${hora}</span>`;
        const claseGol = idsGoles.includes(p.id) ? 'gol-reciente' : '';

        cont.innerHTML += `
            <div class="tarjeta-partido ${claseGol}" onclick="abrirDetalle(${p.id})">
                <div class="encabezado-liga"><img src="${p.competition.emblem || ''}" onerror="this.style.display='none'"> ${p.competition.name}</div>
                <div class="cuerpo-partido">
                    <div class="equipos">
                        <div class="equipo-linea"><img src="${p.homeTeam.crest || ESCUDO_RESPALDO}" onerror="this.src='${ESCUDO_RESPALDO}'"> ${p.homeTeam.shortName || p.homeTeam.name}</div>
                        <div class="equipo-linea"><img src="${p.awayTeam.crest || ESCUDO_RESPALDO}" onerror="this.src='${ESCUDO_RESPALDO}'"> ${p.awayTeam.shortName || p.awayTeam.name}</div>
                    </div>
                    <div class="marcador-live">${marcador}</div>
                    
                    <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                        <span style="font-size:0.7rem; color:var(--texto-gris);">Tocar para analizar</span>
                        <div class="semaforo" style="cursor:pointer;">
                            <div class="luz luz-v" title="Ver Predicción Local">?</div>
                            <div class="luz luz-a" title="Ver Predicción Empate">?</div>
                            <div class="luz luz-r" title="Ver Predicción Visita">?</div>
                        </div>
                    </div>
                </div>
            </div>`;
    });
}

// ==========================================
// VISTA DETALLE Y LOBBY
// ==========================================
function irADeporte(deporte) {
    if (deporte !== 'futbol') { alert("¡Integración en proceso!"); return; }
    document.getElementById('lobby-selector').classList.add('oculto');
    document.getElementById('app-content').classList.remove('oculto');
    iniciarApp();
}

function volverAlLobby() { document.getElementById('lobby-selector').classList.remove('oculto'); document.getElementById('app-content').classList.add('oculto'); baseDeDatosHoy = []; }

async function abrirDetalle(id) {
    const p = baseDeDatosHoy.find(item => item.id === id); if (!p) return;
    
    document.getElementById('vista-principal').classList.add('oculto'); 
    document.getElementById('vista-detalle').classList.remove('oculto');
    document.getElementById('btn-load-tabla').onclick = () => cargarTablaConCache(p.id);
    document.getElementById('contenido-lazy-tabla').innerHTML = '';
    
    const isLive = estadosEnVivo.includes(p.status);
    const gL = p.score?.fullTime?.home ?? 0; const gV = p.score?.fullTime?.away ?? 0;

    document.getElementById('detalle-status').innerHTML = isLive ? `<div class="live-badge">EN CURSO</div>` : `<span>Pre-Partido</span>`;
    document.getElementById('detalle-cabecera').innerHTML = `<div style="text-align:center; width:40%;"><img src="${p.homeTeam.crest || ESCUDO_RESPALDO}" style="max-height:40px;"><p>${p.homeTeam.name}</p></div><h2 style="width:20%; text-align:center; color:var(--verde-principal);">${isLive ? gL + ' - ' + gV : 'VS'}</h2><div style="text-align:center; width:40%;"><img src="${p.awayTeam.crest || ESCUDO_RESPALDO}" style="max-height:40px;"><p>${p.awayTeam.name}</p></div>`;

    document.getElementById('detalle-barras').innerHTML = "<p style='color: var(--verde-principal); text-align:center; margin-top:20px;'>⏳ Analizando bases de datos reales...</p>";

    const datosReales = await obtenerDatosReales(p.id);

    if (datosReales.exito) {
        document.getElementById('detalle-barras').innerHTML = `
            <div style="background: rgba(46, 204, 113, 0.1); padding: 15px; border-left: 4px solid var(--verde-principal); margin-bottom: 15px;">
                <strong>💡 Consejo Experto:</strong> ${datosReales.consejo || 'No disponible'}
            </div>
            <h4 style="margin-bottom: 10px;">Probabilidades Estadísticas (H2H)</h4>
            <div class="barra-container">
                <div style="display:flex; justify-content:space-between;"><span>Gana Local</span><span>${datosReales.local}</span></div>
                <div class="barra-fondo"><div class="barra-progreso" style="background:var(--verde-principal); width:${datosReales.local}"></div></div>
            </div>
            <div class="barra-container">
                <div style="display:flex; justify-content:space-between;"><span>Empate</span><span>${datosReales.empate}</span></div>
                <div class="barra-fondo"><div class="barra-progreso" style="background:var(--oro); width:${datosReales.empate}"></div></div>
            </div>
            <div class="barra-container">
                <div style="display:flex; justify-content:space-between;"><span>Gana Visita</span><span>${datosReales.visita}</span></div>
                <div class="barra-fondo"><div class="barra-progreso" style="background:var(--alerta); width:${datosReales.visita}"></div></div>
            </div>
            <button onclick="guardarUnicoPickLocal(${p.id}, 'Predicción: ${datosReales.consejo?.replace(/'/g,"\\'")}', 'N/A', 0, '${p.homeTeam.shortName}', '${p.awayTeam.shortName}')" style="margin-top:10px; width:100%; background:var(--tarjeta-borde); color:white; border:none; padding:10px; cursor:pointer; font-weight:bold;">Guardar Predicción en mis Picks</button>
        `;
    } else {
        let bHtml = "<p style='color: var(--oro); font-size: 0.85rem; text-align:center; margin-bottom:15px;'>⚠️ Predicción pro no disponible. Mostrando estimación algorítmica.</p>";
        analizarMercadosPartido(p).forEach((m, i) => {
            let col = i === 0 ? 'var(--verde-principal)' : (i === 1 ? 'var(--oro)' : 'var(--alerta)');
            bHtml += `<div class="barra-container" style="border-left-color:${col}"><div style="display:flex; justify-content:space-between;"><span>${m.mercado} <strong>(x${m.cuota})</strong></span><span style="color:${col}">${m.prob}%</span></div><div class="barra-fondo"><div class="barra-progreso" style="background:${col}" data-w="${m.prob}%"></div></div><button onclick="guardarUnicoPickLocal(${p.id}, '${m.mercado.replace(/'/g,"\\'")}', '${m.cuota}', ${m.prob}, '${p.homeTeam.shortName}', '${p.awayTeam.shortName}')" style="margin-top:5px; background:var(--tarjeta-borde); color:white; border:none; padding:5px; cursor:pointer;">Guardar en mis Picks</button></div>`;
        });
        document.getElementById('detalle-barras').innerHTML = bHtml;
        setTimeout(() => { document.querySelectorAll('.barra-progreso').forEach(b => b.style.width = b.getAttribute('data-w')); }, 80);
    }
}

function cerrarDetalle() { document.getElementById('vista-detalle').classList.add('oculto'); document.getElementById('vista-principal').classList.remove('oculto'); }
function abrirTab(evt, nom) { document.querySelectorAll('.tab-content, .tab-btn').forEach(el => el.classList.remove('activo')); document.getElementById(nom).classList.add('activo'); evt.currentTarget.classList.add('activo'); }

// ==========================================
// COMBINADAS Y PICKS
// ==========================================
function generarCombinadaDelDia() {
    let t = []; baseDeDatosHoy.forEach(p => { analizarMercadosPartido(p).forEach(m => t.push({ p: p, m: m })); });
    
    let s = t.filter(c => c.m.prob >= 70).sort((a,b) => b.m.prob - a.m.prob).slice(0, 3);
    let md = t.filter(c => c.m.prob >= 53 && c.m.prob < 70).sort((a,b) => b.m.prob - a.m.prob).slice(0, 3);
    let arrg = t.filter(c => c.m.prob >= 30 && c.m.prob < 53).sort((a,b) => a.m.prob - b.m.prob).slice(0, 3);

    ticketsMultiplesGenerados = { 
        'seguro': s.map(x=>({m:x.m.mercado, c:x.m.cuota, pId:x.p.id, h:x.p.homeTeam.shortName, a:x.p.awayTeam.shortName})), 
        'medio': md.map(x=>({m:x.m.mercado, c:x.m.cuota, pId:x.p.id, h:x.p.homeTeam.shortName, a:x.p.awayTeam.shortName})),
        'arriesgado': arrg.map(x=>({m:x.m.mercado, c:x.m.cuota, pId:x.p.id, h:x.p.homeTeam.shortName, a:x.p.awayTeam.shortName}))
    };
    
    document.getElementById('seccion-combinada').innerHTML = 
        (s.length ? renderHTMLTick(s, "seguro", "🛡️ Segura") : "") + 
        (md.length ? renderHTMLTick(md, "medio", "⚖️ Equilibrada") : "") +
        (arrg.length ? renderHTMLTick(arrg, "arriesgado", "🔥 Arriesgada") : "");
}

function renderHTMLTick(arr, id, tit) {
    let html = `<div class="tarjeta-combinada ticket-${id}"><h4>${tit}</h4>`;
    arr.forEach(c => { html += `<div class="ticket-item">🤝 ${c.p.homeTeam.shortName} vs ${c.p.awayTeam.shortName} <br>🎯 ${c.m.mercado} <strong style="color:var(--verde-principal); float:right;">x${c.m.cuota}</strong></div>`; });
    html += `<button onclick="guardarCombinada('${id}')" style="margin-top:10px; width:100%; padding:5px;">Guardar Ticket</button></div>`; return html;
}

function obtenerPicksLocales() { return JSON.parse(localStorage.getItem('gp_picks')) || []; }
function guardarPicksLocales(l) { localStorage.setItem('gp_picks', JSON.stringify(l)); actualizarEstructuraPicksLocales(); }

function guardarUnicoPickLocal(mId, merc, cuota, prob, home, away) {
    let h = obtenerPicksLocales(); if (h.find(x => x.matchId === mId && x.mercado === merc)) return;
    h.push({ id: Date.now(), matchId: mId, home: home, away: away, mercado: merc, cuota: cuota, prob: prob, estado: 'PENDIENTE' }); guardarPicksLocales(h);
}

function guardarCombinada(idT) {
    let h = obtenerPicksLocales(); let tk = ticketsMultiplesGenerados[idT];
    if (!tk) return; tk.forEach(i => { if (!h.find(x => x.matchId === i.pId && x.mercado === i.m)) h.push({ id: Date.now()+Math.random(), matchId: i.pId, home: i.h, away: i.a, mercado: i.m, cuota: i.c, prob: 'Multi', estado: 'PENDIENTE' }); });
    guardarPicksLocales(h); alert("Ticket guardado con éxito.");
}

function actualizarEstructuraPicksLocales() {
    let hist = obtenerPicksLocales();
    document.getElementById('contador-picks-badge').innerText = hist.filter(h => h.estado === 'PENDIENTE').length;
    let c = document.getElementById('contenedor-lista-picks'); c.innerHTML = "";
    hist.reverse().forEach(p => { c.innerHTML += `<div class="item-pick-guardado ${p.estado.toLowerCase()}"><span class="badge-estado">${p.estado}</span><div>${p.home} vs ${p.away}</div><strong>${p.mercado} ${p.cuota !== 'N/A' ? '(x'+p.cuota+')' : ''}</strong></div>`; });
}

function togglePanelPicks() { document.getElementById('panel-picks').classList.toggle('oculto-panel'); }
function cargarBuscadorLigas(pts) { let dl = document.getElementById('lista-ligas'); dl.innerHTML = ''; let lu = []; pts.forEach(p => { if (!lu.find(l => l.id === p.competition.id)) lu.push({ id: p.competition.id, name: p.competition.name }); }); lu.forEach(l => { dl.innerHTML += `<option value="${l.name}">`; }); }

async function forzarActualizacionLive() {
    const btn = document.getElementById('btn-refresh'); btn.innerText = "⏳"; btn.disabled = true;
    try {
        const actualizados = await fetchPartidos(); 
        baseDeDatosHoy = actualizados.filter(p => LIGAS_TOP.includes(p.competition.id));
        
        let goles = []; let hubo = false;
        baseDeDatosHoy.forEach(p => {
            let nH = p.score?.fullTime?.home || 0; let nA = p.score?.fullTime?.away || 0;
            if (scoresAnteriores[p.id] && (nH > scoresAnteriores[p.id].h || nA > scoresAnteriores[p.id].a)) { goles.push(p.id); hubo = true; }
            scoresAnteriores[p.id] = { h: nH, a: nA };
        });
        aplicarFiltrosMaster(goles); if (hubo) reproducirBeep();
    } catch (e) {}
    btn.innerText = "🔄"; btn.disabled = false;
}

window.onload = () => { actualizarEstructuraPicksLocales(); };
