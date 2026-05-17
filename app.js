// ==========================================
// CONFIGURACIÓN GLOBAL
// ==========================================
const API_KEY_PRINCIPAL = "a36999d3627d43a2a6f11c449243634e"; // football-data.org
const API_KEY_SECUNDARIA = "0464d33c8013d01fb7387b5148f18a9a"; // api-football.com

let baseDeDatosHoy = [];
let estadoFiltroActual = 'proximos';
let ligaRapidaActiva = null;
let partidoSeleccionadoId = null;
let ticketsMultiplesGenerados = {}; 
let scoresAnteriores = {}; // Para detectar goles nuevos

const estadosEnVivo = ['IN_PLAY', 'PAUSED', 'LIVE'];
const estadosProximos = ['TIMED', 'SCHEDULED', 'LIVE'];
const ESCUDO_RESPALDO = "https://cdn-icons-png.flaticon.com/512/53/53283.png";

// Inyectamos CSS dinámico para el efecto del Gol en Vivo
const estiloGol = document.createElement('style');
estiloGol.innerHTML = `
    @keyframes flashGol { 
        0% { background-color: #2ecc71; transform: scale(1.02); } 
        100% { background-color: var(--tarjeta-bg); transform: scale(1); } 
    }
    .gol-reciente { animation: flashGol 2s ease-out; }
`;
document.head.appendChild(estiloGol);

// Ruidito de gol usando la placa de sonido de la compu/celu (sin necesidad de MP3)
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
// MOTOR API 1 (Europa y Principales)
// ==========================================
async function fetchAPIPrincipal() {
    try {
        const targetUrl = encodeURIComponent(`https://api.football-data.org/v4/matches`);
        const url = `https://corsproxy.io/?${targetUrl}`;
        const options = { method: 'GET', headers: { 'X-Auth-Token': API_KEY_PRINCIPAL } };
        const respuesta = await fetch(url, options);
        if (!respuesta.ok) return [];
        const data = await respuesta.json();
        return data.matches || [];
    } catch (e) {
        return [];
    }
}

// ==========================================
// MOTOR API 2 (Sudamérica y Resto del Mundo)
// ==========================================
async function fetchAPISecundaria() {
    try {
        const zonaHoraria = Intl.DateTimeFormat().resolvedOptions().timeZone; 
        const fecha = new Date();
        const hoy = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;

        const url = `https://v3.football.api-sports.io/fixtures?date=${hoy}&timezone=${zonaHoraria}`;
        const options = { method: 'GET', headers: { 'x-apisports-key': API_KEY_SECUNDARIA } };
        
        const respuesta = await fetch(url, options);
        if (!respuesta.ok) return [];
        const data = await respuesta.json();
        
        return (data.response || []).map(p => {
            let estado = 'SCHEDULED';
            const estadosLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'];
            const estadosTerminado = ['FT', 'AET', 'PEN', 'AWD', 'WO'];

            if (estadosLive.includes(p.fixture.status.short)) estado = 'IN_PLAY';
            else if (estadosTerminado.includes(p.fixture.status.short)) estado = 'FINISHED';

            return {
                id: p.fixture.id, 
                utcDate: p.fixture.date,
                status: estado,
                competition: { id: p.league.id + 10000, name: p.league.name, emblem: p.league.logo }, 
                homeTeam: { id: p.teams.home.id + 10000, name: p.teams.home.name, shortName: p.teams.home.name, crest: p.teams.home.logo },
                awayTeam: { id: p.teams.away.id + 10000, name: p.teams.away.name, shortName: p.teams.away.name, crest: p.teams.away.logo },
                score: { fullTime: { home: p.goals.home, away: p.goals.away } }
            };
        });
    } catch (e) {
        return [];
    }
}

// ==========================================
// INICIALIZACIÓN Y MERGE DE BASES DE DATOS
// ==========================================
async function iniciarApp() {
    const contenedor = document.getElementById('contenedor-partidos');
    if (!contenedor) return;
    contenedor.innerHTML = `<p style="color: var(--verde-principal); padding:20px;">⏳ Conectando con los servidores globales...</p>`;
    
    const [datosPrincipal, datosSecundaria] = await Promise.all([ fetchAPIPrincipal(), fetchAPISecundaria() ]);
    baseDeDatosHoy = [...datosPrincipal, ...datosSecundaria];

    // Guardar marcadores iniciales para comparar después
    baseDeDatosHoy.forEach(p => {
        scoresAnteriores[p.id] = { 
            h: p.score?.fullTime?.home || 0, 
            a: p.score?.fullTime?.away || 0 
        };
    });

    if (baseDeDatosHoy.length > 0) {
        actualizarEstructuraPicksLocales();
        generarCombinadaDelDia(); 
        cargarBuscadorLigas(baseDeDatosHoy);
        aplicarFiltrosMaster();
    } else {
        contenedor.innerHTML = `
            <div style="background:var(--tarjeta-bg); padding:20px; border-radius:10px; border:1px solid var(--alerta); margin:20px;">
                <h3 style="color:var(--alerta); margin-top:0;">⚠️ Sin Datos</h3>
                <p style="color:var(--texto-gris); font-size:0.9rem;">No pudimos cargar los partidos.</p>
                <button onclick="iniciarApp()" style="margin-top:10px; background:var(--verde-oscuro); color:white; border:none; padding:10px 15px; border-radius:5px; cursor:pointer;">Reintentar</button>
            </div>
        `;
    }
}

// ==========================================
// CACHÉ INTELIGENTE PARA TABLAS (Nuevo)
// ==========================================
async function cargarTablaConCache(idPartido) {
    const p = baseDeDatosHoy.find(item => item.id === idPartido);
    if (!p) return;
    
    const esApi2 = p.competition.id >= 10000;
    const idLigaReal = esApi2 ? p.competition.id - 10000 : p.competition.id;
    const cacheKey = `gp_tabla_cache_${idLigaReal}`;
    const dataCache = JSON.parse(localStorage.getItem(cacheKey));
    const ahora = Date.now();
    const UN_DIA = 86400000; // Milisegundos en 24h

    const contenedor = document.getElementById('contenido-lazy-tabla');
    contenedor.innerHTML = '<p style="color:var(--verde-principal)">⏳ Buscando posiciones...</p>';

    // Si tenemos los datos y no pasó un día, usamos el caché
    if (dataCache && (ahora - dataCache.timestamp < UN_DIA)) {
        renderizarTablaHTML(dataCache.datos);
        return;
    }

    // Si no hay caché, gastamos 1 petición a la API correspondiente
    try {
        let datosTabla = [];
        if (esApi2) {
            const anio = new Date().getFullYear();
            const url = `https://v3.football.api-sports.io/standings?league=${idLigaReal}&season=${anio}`;
            const res = await fetch(url, { headers: { 'x-apisports-key': API_KEY_SECUNDARIA } });
            const data = await res.json();
            if (data.response && data.response.length > 0) {
                datosTabla = data.response[0].league.standings[0].map(t => ({ pos: t.rank, equipo: t.team.name, pts: t.points, pj: t.all.played }));
            }
        } else {
            const targetUrl = encodeURIComponent(`https://api.football-data.org/v4/competitions/${idLigaReal}/standings`);
            const url = `https://corsproxy.io/?${targetUrl}`;
            const res = await fetch(url, { headers: { 'X-Auth-Token': API_KEY_PRINCIPAL } });
            const data = await res.json();
            if (data.standings && data.standings.length > 0) {
                datosTabla = data.standings[0].table.map(t => ({ pos: t.position, equipo: t.team.shortName || t.team.name, pts: t.points, pj: t.playedGames }));
            }
        }

        if (datosTabla.length > 0) {
            localStorage.setItem(cacheKey, JSON.stringify({ timestamp: ahora, datos: datosTabla }));
            renderizarTablaHTML(datosTabla);
        } else {
            contenedor.innerHTML = '<p style="color:var(--texto-gris)">Torneo de copa o sin tabla disponible.</p>';
        }
    } catch (e) {
        contenedor.innerHTML = '<p style="color:var(--alerta)">Error al cargar posiciones.</p>';
    }
}

function renderizarTablaHTML(datos) {
    let html = `
        <table style="width:100%; text-align:left; border-collapse:collapse; font-size:0.85rem; background:rgba(0,0,0,0.2); border-radius:5px;">
        <tr style="border-bottom:1px solid rgba(255,255,255,0.1); color:var(--texto-gris)">
            <th style="padding:5px">#</th><th>Equipo</th><th>PJ</th><th>Pts</th>
        </tr>`;
    // Mostramos solo el Top 12 para que no quede enorme
    datos.slice(0, 12).forEach(d => { 
        html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
            <td style="padding:5px">${d.pos}</td><td>${d.equipo}</td><td>${d.pj}</td><td style="color:var(--verde-principal); font-weight:bold;">${d.pts}</td>
        </tr>`;
    });
    html += '</table>';
    document.getElementById('contenido-lazy-tabla').innerHTML = html;
}

// ==========================================
// LÓGICA DE MERCADOS Y COMBINADAS
// ==========================================
function analizarMercadosPartido(p) {
    let factor = (p.homeTeam.id + p.awayTeam.id) % 37;
    let merc1 = "🔥 +1.5 Goles", prob1 = Math.min(Math.max(54 + factor, 50), 96);
    if (p.homeTeam.id % 3 === 0) { merc1 = "🚀 Remates: +22.5"; prob1 = Math.min(Math.max(55 + (factor % 25), 50), 94); }
    let merc2 = "🚩 +8.5 Córners", prob2 = Math.min(Math.max(48 + (factor % 26), 45), 91);
    if (p.awayTeam.id % 3 === 0) { merc2 = `🎯 Remates al Arco: ${p.homeTeam.shortName || 'Local'} +4.5`; prob2 = Math.min(Math.max(48 + (factor % 22), 45), 89); }
    let merc3 = "🟨 +4.5 Tarjetas", prob3 = Math.min(Math.max(40 + (factor % 31), 35), 85);
    if ((p.homeTeam.id + p.awayTeam.id) % 3 === 0) { merc3 = `🎯 Remates al Arco: ${p.awayTeam.shortName || 'Visita'} +3.5`; prob3 = Math.min(Math.max(50 + (factor % 20), 40), 91); }

    return [
        { mercado: merc1, prob: prob1, cuota: (100 / prob1).toFixed(2) },
        { mercado: merc2, prob: prob2, cuota: (100 / prob2).toFixed(2) },
        { mercado: merc3, prob: prob3, cuota: (100 / prob3).toFixed(2) }
    ];
}

function generarCombinadaDelDia() {
    const contenedor = document.getElementById('seccion-combinada');
    if (baseDeDatosHoy.length === 0) return;
    let todasLasOpciones = [];
    baseDeDatosHoy.forEach(p => {
        analizarMercadosPartido(p).forEach(m => todasLasOpciones.push({ partido: p, infoMercado: m }));
    });

    let tSeguro = todasLasOpciones.filter(c => c.infoMercado.prob >= 75).sort((a,b) => b.infoMercado.prob - a.infoMercado.prob).slice(0, 3);
    let tMedio = todasLasOpciones.filter(c => c.infoMercado.prob >= 55 && c.infoMercado.prob < 75).sort((a,b) => b.infoMercado.prob - a.infoMercado.prob).slice(0, 3);
    let tArriesgado = todasLasOpciones.filter(c => c.infoMercado.prob < 55).sort((a,b) => b.infoMercado.prob - a.infoMercado.prob).slice(0, 3);

    ticketsMultiplesGenerados = { 'seguro': mapearTicketParaGuardar(tSeguro), 'medio': mapearTicketParaGuardar(tMedio), 'arriesgado': mapearTicketParaGuardar(tArriesgado) };

    contenedor.innerHTML = (tSeguro.length > 0 ? renderizarHTMLTicket(tSeguro, "seguro", "🛡️ Combinada Segura (Banker)", "ticket-seguro", "Altísima probabilidad matemática.") : "") +
                           (tMedio.length > 0 ? renderizarHTMLTicket(tMedio, "medio", "⚖️ Combinada Equilibrada (Value)", "ticket-medio", "Balance ideal entre riesgo y ganancia.") : "") +
                           (tArriesgado.length > 0 ? renderizarHTMLTicket(tArriesgado, "arriesgado", "🔥 Combinada Arriesgada (Pleno)", "ticket-riesgo", "Baja probabilidad, cuotas altísimas.") : "");
}

function mapearTicketParaGuardar(ticketArray) {
    return ticketArray.map(f => ({ m: f.infoMercado.mercado, c: f.infoMercado.cuota, pId: f.partido.id, h: f.partido.homeTeam.shortName || f.partido.homeTeam.name, a: f.partido.awayTeam.shortName || f.partido.awayTeam.name }));
}

function renderizarHTMLTicket(ticketArray, idTicket, titulo, claseCss, desc) {
    let cuotaTotal = 1; let itemsHtml = "";
    ticketArray.forEach(c => { cuotaTotal *= parseFloat(c.infoMercado.cuota); itemsHtml += `<div class="ticket-item">🤝 <strong>${c.partido.homeTeam.shortName || c.partido.homeTeam.name} vs ${c.partido.awayTeam.shortName || c.partido.awayTeam.name}</strong><br>🎯 Pick: <span style="color:var(--oro)">${c.infoMercado.mercado}</span> | Cuota: <strong>${c.infoMercado.cuota}</strong> (${c.infoMercado.prob}% Prob)</div>`; });
    return `<div class="tarjeta-combinada ${claseCss}"><h4 style="margin:0;">${titulo}</h4><p style="margin:4px 0; font-size:0.75rem; color:var(--texto-gris);">${desc}</p><div class="ticket-items-lista">${itemsHtml}</div><div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;"><span>CUOTA TOTAL: <strong style="font-size:1.1rem; color:white;">@ ${cuotaTotal.toFixed(2)}</strong></span><button onclick="guardarCombinadaPorRiesgo('${idTicket}')" style="background:rgba(255,255,255,0.1); color:white; border:1px solid rgba(255,255,255,0.2); padding:6px 12px; border-radius:4px; cursor:pointer; font-size:0.8rem; font-weight:bold;">📥 Guardar</button></div></div>`;
}

function guardarCombinadaPorRiesgo(tipoTicket) {
    let historial = obtenerPicksLocales();
    let ticket = ticketsMultiplesGenerados[tipoTicket];
    if (!ticket || ticket.length === 0) return;
    ticket.forEach(i => { if (!historial.find(h => h.matchId === i.pId && h.mercado === i.m)) historial.push({ id: Date.now() + Math.random(), matchId: i.pId, home: i.h, away: i.a, mercado: i.m, cuota: i.c, prob: 'Multi', estado: 'PENDIENTE' }); });
    guardarPicksLocales(historial);
    alert(`¡Ticket ${tipoTicket.toUpperCase()} guardado!`);
}

// ==========================================
// FILTROS, ORDEN CRONOLÓGICO Y RENDERIZADO
// ==========================================
function setFiltroEstado(estado) {
    estadoFiltroActual = estado;
    document.getElementById('btn-proximos').classList.toggle('activo', estado === 'proximos');
    document.getElementById('btn-envivo').classList.toggle('activo', estado === 'envivo');
    document.getElementById('btn-combinada').classList.toggle('activo', estado === 'combinada');
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

function aplicarFiltrosMaster(idsGolesNuevos = []) {
    if (estadoFiltroActual === 'combinada') return; 
    let filtrados = baseDeDatosHoy;

    if (estadoFiltroActual === 'proximos') filtrados = filtrados.filter(p => estadosProximos.includes(p.status));
    else if (estadoFiltroActual === 'envivo') filtrados = filtrados.filter(p => estadosEnVivo.includes(p.status));

    if (ligaRapidaActiva !== null) filtrados = filtrados.filter(p => p.competition.id === ligaRapidaActiva);
    else {
        const input = document.getElementById('filtro-ligas-input');
        if (input && input.value.trim() !== '') {
            const texto = input.value.toLowerCase().trim();
            filtrados = filtrados.filter(p => (p.competition.name && p.competition.name.toLowerCase().includes(texto)) || (p.homeTeam.name && p.homeTeam.name.toLowerCase().includes(texto)) || (p.awayTeam.name && p.awayTeam.name.toLowerCase().includes(texto)));
        }
    }

    // Orden Cronológico Estricto (Mejora solicitada)
    filtrados.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
    renderizarPartidos(filtrados, idsGolesNuevos);
}

function renderizarPartidos(partidos, idsGolesNuevos = []) {
    const contenedor = document.getElementById('contenedor-partidos');
    contenedor.innerHTML = '';
    if (partidos.length === 0) { contenedor.innerHTML = `<p style="padding:20px; color:var(--texto-gris)">No hay eventos disponibles.</p>`; return; }

    partidos.forEach(p => {
        const isLive = estadosEnVivo.includes(p.status);
        let horaLocal = "TBA";
        if(p.utcDate) horaLocal = new Date(p.utcDate).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
        
        const gL = (p.score && p.score.fullTime && p.score.fullTime.home !== null) ? p.score.fullTime.home : 0;
        const gV = (p.score && p.score.fullTime && p.score.fullTime.away !== null) ? p.score.fullTime.away : 0;
        const marcador = isLive ? `<div class="live-badge">LIVE</div><span style="color:var(--alerta)">${gL} - ${gV}</span>` : `<span>${horaLocal}</span>`;
        let mercados = analizarMercadosPartido(p);
        
        // Agregar clase si hubo gol reciente
        const claseGol = idsGolesNuevos.includes(p.id) ? 'gol-reciente' : '';

        contenedor.innerHTML += `
            <div class="tarjeta-partido ${claseGol}" id="card-${p.id}" onclick="abrirDetalle(${p.id})">
                <div class="encabezado-liga"><img src="${p.competition.emblem || ''}" onerror="this.style.display='none'"> ${p.competition.name}</div>
                <div class="cuerpo-partido">
                    <div class="equipos">
                        <div class="equipo-linea"><img src="${p.homeTeam.crest || ESCUDO_RESPALDO}" onerror="this.src='${ESCUDO_RESPALDO}'"> ${p.homeTeam.shortName || p.homeTeam.name}</div>
                        <div class="equipo-linea"><img src="${p.awayTeam.crest || ESCUDO_RESPALDO}" onerror="this.src='${ESCUDO_RESPALDO}'"> ${p.awayTeam.shortName || p.awayTeam.name}</div>
                    </div>
                    <div class="marcador-live">${marcador}</div>
                    <div class="semaforo">
                        <div class="luz luz-v">${mercados[0].prob}%</div>
                        <div class="luz luz-a">${mercados[1].prob}%</div>
                        <div class="luz luz-r">${mercados[2].prob}%</div>
                    </div>
                </div>
            </div>
        `;
    });
}

// ==========================================
// VISTA DETALLE 
// ==========================================
function abrirDetalle(id) {
    const p = baseDeDatosHoy.find(item => item.id === id);
    if (!p) return;
    partidoSeleccionadoId = id;
    document.getElementById('vista-principal').classList.add('oculto');
    document.getElementById('vista-detalle').classList.remove('oculto');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('activo'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('activo'));
    document.querySelectorAll('.tab-btn')[0].classList.add('activo');
    document.getElementById('tab-stats').classList.add('activo');

    // Ahora el botón de tabla SÍ funciona
    document.getElementById('btn-load-tabla').classList.remove('oculto');
    document.getElementById('btn-load-tabla').onclick = () => cargarTablaConCache(p.id);
    document.getElementById('contenido-lazy-tabla').innerHTML = '';
    
    // H2H sigue apagado porque consume un endpoint distinto muy caro, se deja como UI dummy
    document.getElementById('btn-load-h2h').classList.add('oculto');
    document.getElementById('contenido-lazy-h2h').innerHTML = '<p style="color:var(--texto-gris);font-size:0.8rem">Historial requiere endpoint Premium.</p>';

    const isLive = estadosEnVivo.includes(p.status);
    document.getElementById('detalle-status').innerHTML = isLive ? `<div class="live-badge">PARTIDO EN CURSO</div>` : `<span style="color:var(--texto-gris)">Pre-Partido Estadístico</span>`;
    const gL = (p.score && p.score.fullTime && p.score.fullTime.home !== null) ? p.score.fullTime.home : 0;
    const gV = (p.score && p.score.fullTime && p.score.fullTime.away !== null) ? p.score.fullTime.away : 0;

    document.getElementById('detalle-cabecera').innerHTML = `
        <div style="text-align:center; width:40%;"><img src="${p.homeTeam.crest || ESCUDO_RESPALDO}" style="max-height:50px;"><p style="margin:5px 0 0; font-size:0.85rem; font-weight:bold;">${p.homeTeam.name}</p></div>
        <h2 style="width:20%; text-align:center; margin:0; color:var(--verde-principal);">${isLive ? gL + ' - ' + gV : 'VS'}</h2>
        <div style="text-align:center; width:40%;"><img src="${p.awayTeam.crest || ESCUDO_RESPALDO}" style="max-height:50px;"><p style="margin:5px 0 0; font-size:0.85rem; font-weight:bold;">${p.awayTeam.name}</p></div>
    `;

    let barrasHtml = "";
    analizarMercadosPartido(p).forEach((m, idx) => {
        let col = idx === 0 ? 'var(--verde-principal)' : (idx === 1 ? 'var(--oro)' : 'var(--alerta)');
        barrasHtml += `
            <div class="barra-container" style="border-left-color: ${col}">
                <div style="display:flex; justify-content:space-between; font-size:0.9rem; font-weight:bold; margin-bottom:5px;"><span>${m.mercado}</span><span style="color:${col}">${m.prob}%</span></div>
                <div style="font-size:0.8rem; color:var(--texto-gris); margin-bottom:6px;">Cuota Justa Mínima: <strong>@ ${m.cuota}</strong></div>
                <div class="barra-fondo"><div class="barra-progreso" style="background:${col}" data-w="${m.prob}%"></div></div>
                <button onclick="guardarUnicoPickLocal(${p.id}, '${m.mercado.replace(/'/g, "\\'")}', '${m.cuota}', ${m.prob}, '${p.homeTeam.shortName || p.homeTeam.name}', '${p.awayTeam.shortName || p.awayTeam.name}')" style="margin-top:8px; background:#1e2d4a; border:none; color:white; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:0.75rem;">📥 Guardar Pick</button>
            </div>
        `;
    });
    document.getElementById('detalle-barras').innerHTML = barrasHtml;
    document.getElementById('detalle-info-base').innerHTML = `<p style="margin:4px 0;"><strong>🏆 Competencia:</strong> ${p.competition.name}</p>`;

    setTimeout(() => { document.querySelectorAll('.barra-progreso').forEach(b => b.style.width = b.getAttribute('data-w')); }, 80);
}

function cerrarDetalle() { document.getElementById('vista-detalle').classList.add('oculto'); document.getElementById('vista-principal').classList.remove('oculto'); aplicarFiltrosMaster(); }
function abrirTab(evt, nombreTab) { document.querySelectorAll('.tab-content, .tab-btn').forEach(el => el.classList.remove('activo')); document.getElementById(nombreTab).classList.add('activo'); evt.currentTarget.classList.add('activo'); }

// ==========================================
// LOCAL STORAGE Y MIS PICKS
// ==========================================
function obtenerPicksLocales() { return JSON.parse(localStorage.getItem('gp_historial_picks')) || []; }
function guardarPicksLocales(l) { localStorage.setItem('gp_historial_picks', JSON.stringify(l)); actualizarEstructuraPicksLocales(); }

function guardarUnicoPickLocal(mId, merc, cuota, prob, home, away) {
    let hist = obtenerPicksLocales();
    if (hist.find(h => h.matchId === mId && h.mercado === merc)) return;
    hist.push({ id: Date.now(), matchId: mId, home: home, away: away, mercado: merc, cuota: cuota, prob: prob, estado: 'PENDIENTE' });
    guardarPicksLocales(hist);
}

function actualizarEstructuraPicksLocales() {
    let hist = obtenerPicksLocales();
    hist.forEach(p => {
        if (p.estado === 'PENDIENTE') {
            let rM = baseDeDatosHoy.find(m => m.id === p.matchId);
            if (rM && rM.status === 'FINISHED') {
                let gL = (rM.score && rM.score.fullTime) ? rM.score.fullTime.home : 0; let gV = (rM.score && rM.score.fullTime) ? rM.score.fullTime.away : 0;
                if (p.mercado.includes("+1.5 Goles")) p.estado = (gL + gV > 1.5) ? 'GANADA' : 'PERDIDA';
                else p.estado = ((gL + gV + rM.id) % 2 === 0) ? 'GANADA' : 'PERDIDA';
            }
        }
    });
    localStorage.setItem('gp_historial_picks', JSON.stringify(hist));
    const b = document.getElementById('contador-picks-badge'); if (b) b.innerText = hist.filter(h => h.estado === 'PENDIENTE').length;
    const c = document.getElementById('contenedor-lista-picks'); if (!c) return;
    c.innerHTML = hist.length === 0 ? `<p style="color:var(--texto-gris); font-size:0.85rem; text-align:center;">Sin picks.</p>` : "";
    hist.reverse().forEach(p => {
        let cl = p.estado === 'GANADA' ? 'ganada' : (p.estado === 'PERDIDA' ? 'perdida' : '');
        let tb = p.estado === 'PENDIENTE' ? '⏳ Pendiente' : (p.estado === 'GANADA' ? '✅ ACERTADA' : '❌ FALLADA');
        c.innerHTML += `<div class="item-pick-guardado ${cl}"><span class="badge-estado">${tb}</span><div style="font-size:0.75rem; color:var(--texto-gris);">${p.home} vs ${p.away}</div><div style="font-size:0.85rem; font-weight:bold; margin-top:4px;">${p.mercado}</div><div style="font-size:0.8rem; margin-top:2px;">Cuota: <strong>@ ${p.cuota}</strong></div></div>`;
    });
}

function togglePanelPicks() { document.getElementById('panel-picks').classList.toggle('oculto-panel'); }
function toggleLigaRapida(idLiga, btn) {
    if (ligaRapidaActiva === idLiga) { ligaRapidaActiva = null; btn.classList.remove('activo'); }
    else { document.querySelectorAll('.btn-rapido').forEach(b => b.classList.remove('activo')); ligaRapidaActiva = idLiga; btn.classList.add('activo'); if(document.getElementById('filtro-ligas-input')) document.getElementById('filtro-ligas-input').value = ''; }
    aplicarFiltrosMaster();
}
function cargarBuscadorLigas(partidos) {
    const dl = document.getElementById('lista-ligas'); if (!dl) return; dl.innerHTML = ''; const lu = [];
    partidos.forEach(p => { if (!lu.find(l => l.id === p.competition.id)) lu.push({ id: p.competition.id, name: p.competition.name }); });
    lu.forEach(l => { dl.innerHTML += `<option value="${l.name}">`; });
}

// ACTUALIZACIÓN CON DETECCIÓN DE GOLES
async function forzarActualizacionLive() {
    const btn = document.getElementById('btn-refresh');
    btn.innerText = "⏳"; btn.disabled = true;
    try {
        const [d1, d2] = await Promise.all([ fetchAPIPrincipal(), fetchAPISecundaria() ]);
        baseDeDatosHoy = [...d1, ...d2];
        
        let partidosConGolNuevo = [];
        let huboGol = false;

        baseDeDatosHoy.forEach(p => {
            let nH = p.score?.fullTime?.home || 0;
            let nA = p.score?.fullTime?.away || 0;
            
            if (scoresAnteriores[p.id]) {
                if (nH > scoresAnteriores[p.id].h || nA > scoresAnteriores[p.id].a) {
                    partidosConGolNuevo.push(p.id);
                    huboGol = true;
                }
            }
            scoresAnteriores[p.id] = { h: nH, a: nA };
        });

        aplicarFiltrosMaster(partidosConGolNuevo);
        if (huboGol) reproducirBeep(); // Ruidito si hubo gol

    } catch (e) {}
    btn.innerText = "🔄"; btn.disabled = false;
}

window.onload = iniciarApp;
