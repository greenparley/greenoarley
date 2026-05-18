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
let deporteActivo = 'futbol'; // NUEVO: Controla si estamos en fútbol o básquet

const estadosEnVivoFutbol = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'];
const estadosEnVivoBasket = ['Q1', 'Q2', 'Q3', 'Q4', 'OT', 'BT', 'HT', 'LIVE', 'IN_PLAY'];
const estadosProximos = ['TIMED', 'SCHEDULED', 'LIVE', 'IN_PLAY'];
const ESCUDO_RESPALDO = "https://cdn-icons-png.flaticon.com/512/53/53283.png";

// ==========================================
// FILTRO DE LIGAS
// ==========================================
const LIGAS_TOP_FUTBOL = [1, 2, 3, 4, 9, 13, 11, 12, 39, 140, 135, 78, 61, 128, 130, 129, 131, 71, 73];
const LIGAS_TOP_BASKET = [12, 116, 117, 120, 134]; // NBA, Euroliga, etc.

// ==========================================
// ESTILOS DINÁMICOS Y AUDIOS
// ==========================================
const estilosApp = document.createElement('style');
estilosApp.innerHTML = `
    @keyframes flashGol { 0% { background-color: #2ecc71; transform: scale(1.02); } 100% { background-color: var(--tarjeta-bg); transform: scale(1); } }
    .gol-reciente { animation: flashGol 2s ease-out; }
    
    .tab-detalle-btn { flex:1; padding:10px 5px; background:transparent; color:var(--texto-gris); border:none; border-bottom:2px solid transparent; cursor:pointer; font-size:0.85rem; font-weight:bold; transition:all 0.3s; }
    .tab-detalle-btn.activo { color:var(--verde-principal); border-bottom:2px solid var(--verde-principal); }
    .tab-detalle-content { display:none; padding-top:15px; }
    .tab-detalle-content.activo { display:block; animation: fadeIn 0.3s ease-in; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
`;
document.head.appendChild(estilosApp);

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

function traducirConsejo(texto) {
    if (!texto) return 'No disponible';
    let t = texto.toLowerCase();
    const dicc = { "winner": "Ganador", "home": "Local", "away": "Visitante", "draw": "Empate", "combo": "Combinada", "double chance": "Doble Oportunidad", "and": "y", "or": "o", "over": "Más de", "under": "Menos de", "goals": "goles", "points": "puntos", "yes": "Sí", "no": "No", "to score": "anota", "both teams": "Ambos equipos" };
    for (let eng in dicc) { let re = new RegExp("\\b" + eng + "\\b", "gi"); t = t.replace(re, dicc[eng]); }
    return t.charAt(0).toUpperCase() + t.slice(1);
}

async function fetchConRotacion(url) {
    for (let i = 0; i < API_KEYS.length; i++) {
        try {
            const res = await fetch(url, { headers: { 'x-apisports-key': API_KEYS[i] } });
            const data = await res.json();
            if (!data.errors || data.errors.length === 0 || !data.errors.rateLimit) return data;
            console.warn(`Key ${i + 1} agotada. Saltando...`);
        } catch (e) { console.warn(`Error de red con Key ${i + 1}.`); }
    }
    return null; 
}

// ==========================================
// CARGA INICIAL (AHORA SOPORTA AMBOS DEPORTES)
// ==========================================
async function fetchPartidos() {
    const zona = Intl.DateTimeFormat().resolvedOptions().timeZone; 
    const ahora = new Date();
    const manana = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
    const formatoDia = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    let urlHoy, urlManana;
    if (deporteActivo === 'futbol') {
        urlHoy = `https://v3.football.api-sports.io/fixtures?date=${formatoDia(ahora)}&timezone=${zona}`;
        urlManana = `https://v3.football.api-sports.io/fixtures?date=${formatoDia(manana)}&timezone=${zona}`;
    } else {
        urlHoy = `https://v1.basketball.api-sports.io/games?date=${formatoDia(ahora)}&timezone=${zona}`;
        urlManana = `https://v1.basketball.api-sports.io/games?date=${formatoDia(manana)}&timezone=${zona}`;
    }

    const dataHoy = await fetchConRotacion(urlHoy);
    const dataManana = await fetchConRotacion(urlManana);
    
    let todosLosEventos = [];
    if (dataHoy && dataHoy.response) todosLosEventos = todosLosEventos.concat(dataHoy.response);
    if (dataManana && dataManana.response) todosLosEventos = todosLosEventos.concat(dataManana.response);
    
    const limiteInferior = ahora.getTime() - (4 * 60 * 60 * 1000);
    const limiteSuperior = ahora.getTime() + (24 * 60 * 60 * 1000);

    return todosLosEventos.filter(p => {
        const tiempoPartido = new Date(deporteActivo === 'futbol' ? p.fixture.date : p.date).getTime();
        return tiempoPartido >= limiteInferior && tiempoPartido <= limiteSuperior;
    }).map(p => {
        let estado = 'SCHEDULED';
        
        if (deporteActivo === 'futbol') {
            if (estadosEnVivoFutbol.includes(p.fixture.status.short)) estado = 'IN_PLAY';
            else if (['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(p.fixture.status.short)) estado = 'FINISHED';
            
            return {
                id: p.fixture.id, utcDate: p.fixture.date, status: estado,
                competition: { id: p.league.id, name: p.league.name, emblem: p.league.logo, season: p.league.season }, 
                homeTeam: { id: p.teams.home.id, name: p.teams.home.name, shortName: p.teams.home.name, crest: p.teams.home.logo },
                awayTeam: { id: p.teams.away.id, name: p.teams.away.name, shortName: p.teams.away.name, crest: p.teams.away.logo },
                score: { fullTime: { home: p.goals.home, away: p.goals.away } }
            };
        } else {
            if (estadosEnVivoBasket.includes(p.status.short)) estado = 'IN_PLAY';
            else if (['FT', 'AOT'].includes(p.status.short)) estado = 'FINISHED';
            
            return {
                id: p.id, utcDate: p.date, status: estado,
                competition: { id: p.league.id, name: p.league.name, emblem: p.league.logo, season: p.league.season }, 
                homeTeam: { id: p.teams.home.id, name: p.teams.home.name, shortName: p.teams.home.name, crest: p.teams.home.logo },
                awayTeam: { id: p.teams.away.id, name: p.teams.away.name, shortName: p.teams.away.name, crest: p.teams.away.logo },
                score: { fullTime: { home: p.scores.home.total, away: p.scores.away.total } }
            };
        }
    });
}

async function iniciarApp() {
    const contenedor = document.getElementById('contenedor-partidos');
    contenedor.innerHTML = `<p style="color: var(--verde-principal); padding:20px;">⏳ Conectando servidores de ${deporteActivo.toUpperCase()} y procesando datos...</p>`;
    
    const todosLosPartidos = await fetchPartidos();
    const ligasTop = deporteActivo === 'futbol' ? LIGAS_TOP_FUTBOL : LIGAS_TOP_BASKET;
    
    baseDeDatosHoy = todosLosPartidos.filter(p => ligasTop.includes(p.competition.id));
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
// PREVISIÓN Y ALGORITMOS DE APUESTAS
// ==========================================
async function obtenerDatosReales(idFixture) {
    const cacheKey = `gp_prediccion_${deporteActivo}_v4_${idFixture}`; 
    const cacheData = localStorage.getItem(cacheKey);
    if (cacheData) { return JSON.parse(cacheData); }

    const urlPredicciones = deporteActivo === 'futbol' 
        ? `https://v3.football.api-sports.io/predictions?fixture=${idFixture}`
        : `https://v1.basketball.api-sports.io/predictions?game=${idFixture}`;

    const data = await fetchConRotacion(urlPredicciones);
        
    if (data && data.response && data.response.length > 0) {
        const analisis = data.response[0];
        const resultado = {
            exito: true,
            local: analisis.predictions.percent.home,
            empate: deporteActivo === 'futbol' ? analisis.predictions.percent.draw : "0%",
            visita: analisis.predictions.percent.away,
            consejo: traducirConsejo(analisis.predictions.advice),
            formaLocal: analisis.teams?.home?.league?.form || analisis.teams?.home?.last_5?.form || "?????",
            formaVisita: analisis.teams?.away?.league?.form || analisis.teams?.away?.last_5?.form || "?????"
        };
        localStorage.setItem(cacheKey, JSON.stringify(resultado));
        return resultado;
    } else {
        return { exito: false };
    }
}

function renderFormaHTML(formaStr) {
    if (!formaStr || formaStr === "?????") return "<span style='color:var(--texto-gris); font-size:0.8rem;'>Sin datos</span>";
    let ultimos5 = formaStr.slice(-5).toUpperCase();
    let html = '<div style="display:flex; gap:3px; justify-content:center;">';
    for (let char of ultimos5) {
        let color = "var(--texto-gris)"; let letra = "-";
        if (char === 'W') { color = "var(--verde-principal)"; letra = "G"; } 
        else if (char === 'D') { color = "var(--oro)"; letra = "E"; }        
        else if (char === 'L') { color = "var(--alerta)"; letra = "P"; }     
        if (letra !== "-") html += `<div style="background:${color}; color:#111; width:22px; height:22px; display:flex; align-items:center; justify-content:center; border-radius:4px; font-size:0.75rem; font-weight:bold;">${letra}</div>`;
    }
    return html + '</div>';
}

function predecirMarcadoresExactos(pL, pE, pV) {
    if (deporteActivo === 'futbol') {
        let l = parseInt(pL) || 33; let e = parseInt(pE) || 33; let v = parseInt(pV) || 33;
        if (l >= v && l >= e) return [{m:"1-0", p:l*0.4}, {m:"2-0", p:l*0.3}, {m:"2-1", p:l*0.2}];
        else if (v >= l && v >= e) return [{m:"0-1", p:v*0.4}, {m:"0-2", p:v*0.3}, {m:"1-2", p:v*0.2}];
        else return [{m:"1-1", p:e*0.5}, {m:"0-0", p:e*0.3}, {m:"2-2", p:e*0.15}];
    } else {
        let l = parseInt(pL) || 50; let v = parseInt(pV) || 50;
        let overProb = 45 + (l > v ? (l - 50) / 2 : (v - 50) / 2);
        return [{m: "Más de 218.5 Pts", p: overProb}, {m: "Menos de 218.5 Pts", p: 100 - overProb}];
    }
}

// ==========================================
// VISTA DETALLE CON NUEVAS HERRAMIENTAS
// ==========================================
function cambiarTabDetalle(idTab, btn) {
    document.querySelectorAll('.tab-detalle-content').forEach(el => el.classList.remove('activo'));
    document.querySelectorAll('.tab-detalle-btn').forEach(el => el.classList.remove('activo'));
    document.getElementById(idTab).classList.add('activo');
    btn.classList.add('activo');
}

async function abrirDetalle(id) {
    const p = baseDeDatosHoy.find(item => item.id === id); if (!p) return;
    
    document.getElementById('vista-principal').classList.add('oculto'); 
    document.getElementById('vista-detalle').classList.remove('oculto');
    
    const estadosEV = deporteActivo === 'futbol' ? estadosEnVivoFutbol : estadosEnVivoBasket;
    const isLive = estadosEV.includes(p.status) || p.status === 'IN_PLAY';
    const gL = p.score?.fullTime?.home ?? 0; const gV = p.score?.fullTime?.away ?? 0;

    document.getElementById('detalle-status').innerHTML = isLive ? `<div class="live-badge">EN CURSO</div>` : `<span>Pre-Partido</span>`;
    document.getElementById('detalle-cabecera').innerHTML = `<div style="text-align:center; width:40%;"><img src="${p.homeTeam.crest || ESCUDO_RESPALDO}" style="max-height:40px;"><p>${p.homeTeam.name}</p></div><h2 style="width:20%; text-align:center; color:var(--verde-principal);">${isLive ? gL + ' - ' + gV : 'VS'}</h2><div style="text-align:center; width:40%;"><img src="${p.awayTeam.crest || ESCUDO_RESPALDO}" style="max-height:40px;"><p>${p.awayTeam.name}</p></div>`;

    document.getElementById('detalle-barras').innerHTML = `<p style='color: var(--verde-principal); text-align:center; margin-top:20px;'>⏳ Analizando algoritmos de apuestas (${deporteActivo.toUpperCase()})...</p>`;

    const d = await obtenerDatosReales(p.id);

    let htmlTabs = `
        <div style="display:flex; border-bottom:1px solid rgba(255,255,255,0.1); margin-top:15px; margin-bottom:15px;">
            <button class="tab-detalle-btn activo" onclick="cambiarTabDetalle('tab-pred', this)">🔮 Predicción</button>
            <button class="tab-detalle-btn" onclick="cambiarTabDetalle('tab-scores', this)">🎯 ${deporteActivo === 'futbol' ? 'Marcadores' : 'Totales'}</button>
        </div>
        
        <div id="tab-pred" class="tab-detalle-content activo">`;

    if (d.exito) {
        htmlTabs += `
            <div style="background: rgba(46, 204, 113, 0.1); padding: 15px; border-left: 4px solid var(--verde-principal); margin-bottom: 15px;">
                <strong>💡 Consejo Experto:</strong> ${d.consejo || 'No disponible'}
            </div>
            
            <h4 style="margin-bottom: 10px; text-align:center; font-size: 0.9rem; color: var(--texto-gris);">Forma (Últimos 5)</h4>
            <div style="display:flex; justify-content:space-around; align-items:center; background:rgba(0,0,0,0.2); padding:12px; border-radius:8px; margin-bottom:20px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="text-align:center; width:45%;">
                    <span style="font-size:0.75rem; color:var(--texto-gris); display:block; margin-bottom:5px;">${p.homeTeam.shortName || p.homeTeam.name}</span>
                    ${renderFormaHTML(d.formaLocal)}
                </div>
                <span style="color:var(--texto-gris); font-size:0.8rem; width:10%; text-align:center;">vs</span>
                <div style="text-align:center; width:45%;">
                    <span style="font-size:0.75rem; color:var(--texto-gris); display:block; margin-bottom:5px;">${p.awayTeam.shortName || p.awayTeam.name}</span>
                    ${renderFormaHTML(d.formaVisita)}
                </div>
            </div>

            <h4 style="margin-bottom: 10px;">Probabilidades (H2H)</h4>
            <div class="barra-container"><div style="display:flex; justify-content:space-between;"><span>Gana Local</span><span>${d.local}</span></div><div class="barra-fondo"><div class="barra-progreso" style="background:var(--verde-principal); width:${d.local}"></div></div></div>`;
            
        if(deporteActivo === 'futbol') {
            htmlTabs += `<div class="barra-container"><div style="display:flex; justify-content:space-between;"><span>Empate</span><span>${d.empate}</span></div><div class="barra-fondo"><div class="barra-progreso" style="background:var(--oro); width:${d.empate}"></div></div></div>`;
        }

        htmlTabs += `<div class="barra-container"><div style="display:flex; justify-content:space-between;"><span>Gana Visita</span><span>${d.visita}</span></div><div class="barra-fondo"><div class="barra-progreso" style="background:var(--alerta); width:${d.visita}"></div></div></div>
            <button onclick="guardarUnicoPickLocal(${p.id}, 'Predicción: ${d.consejo?.replace(/'/g,"\\'")}', 'N/A', 0, '${p.homeTeam.shortName || p.homeTeam.name}', '${p.awayTeam.shortName || p.awayTeam.name}')" style="margin-top:10px; width:100%; background:var(--tarjeta-borde); color:white; border:none; padding:10px; cursor:pointer; font-weight:bold;">Guardar Predicción</button>
        </div>`;
        
        let scores = predecirMarcadoresExactos(d.local, d.empate, d.visita);
        htmlTabs += `<div id="tab-scores" class="tab-detalle-content">
            <p style="font-size:0.8rem; color:var(--texto-gris); margin-bottom:15px; text-align:center;">Simulación basada en algoritmos de probabilidad pura.</p>
            <div style="display:flex; gap:10px; justify-content:center;">`;
        scores.forEach((sc, idx) => {
            let color = idx === 0 ? "var(--verde-principal)" : (idx === 1 ? "var(--oro)" : "var(--texto-gris)");
            htmlTabs += `<div style="flex:1; text-align:center; background:rgba(0,0,0,0.2); padding:15px 5px; border-radius:8px; border-top: 3px solid ${color};">
                <strong style="font-size:1.5rem; display:block; color:white;">${sc.m}</strong>
                <span style="font-size:0.75rem; color:var(--texto-gris);">Probabilidad: ${Math.round(sc.p)}%</span>
            </div>`;
        });
        htmlTabs += `</div></div>`;

    } else {
        htmlTabs += "<p style='color: var(--oro); font-size: 0.85rem; text-align:center; margin-bottom:15px;'>⚠️ API limitada. Mostrando estimación base.</p>";
        analizarMercadosPartido(p).forEach((m, i) => {
            let col = i === 0 ? 'var(--verde-principal)' : (i === 1 ? 'var(--oro)' : 'var(--alerta)');
            htmlTabs += `<div class="barra-container" style="border-left-color:${col}"><div style="display:flex; justify-content:space-between;"><span>${m.mercado} <strong>(x${m.cuota})</strong></span><span style="color:${col}">${m.prob}%</span></div><div class="barra-fondo"><div class="barra-progreso" style="background:${col}" data-w="${m.prob}%"></div></div><button onclick="guardarUnicoPickLocal(${p.id}, '${m.mercado.replace(/'/g,"\\'")}', '${m.cuota}', ${m.prob}, '${p.homeTeam.shortName || p.homeTeam.name}', '${p.awayTeam.shortName || p.awayTeam.name}')" style="margin-top:5px; background:var(--tarjeta-borde); color:white; border:none; padding:5px; cursor:pointer;">Guardar en mis Picks</button></div>`;
        });
        htmlTabs += "</div><div id='tab-scores' class='tab-detalle-content'><p style='text-align:center; color:var(--texto-gris);'>Sin datos suficientes.</p></div>";
        setTimeout(() => { document.querySelectorAll('.barra-progreso').forEach(b => b.style.width = b.getAttribute('data-w')); }, 80);
    }

    document.getElementById('detalle-barras').innerHTML = htmlTabs;
}

function cerrarDetalle() { document.getElementById('vista-detalle').classList.add('oculto'); document.getElementById('vista-principal').classList.remove('oculto'); }

// ==========================================
// RENDER Y FILTROS DEL MENÚ PRINCIPAL
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
    const estadosEV = deporteActivo === 'futbol' ? estadosEnVivoFutbol : estadosEnVivoBasket;

    if (estadoFiltroActual === 'proximos') filtrados = filtrados.filter(p => estadosProximos.includes(p.status) || estadosEV.includes(p.status));
    else if (estadoFiltroActual === 'envivo') filtrados = filtrados.filter(p => estadosEV.includes(p.status) || p.status === 'IN_PLAY');

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
        const estadosEV = deporteActivo === 'futbol' ? estadosEnVivoFutbol : estadosEnVivoBasket;
        const isLive = estadosEV.includes(p.status) || p.status === 'IN_PLAY';
        const esFechaValida = p.utcDate && !isNaN(new Date(p.utcDate).getTime());
        let hora = esFechaValida ? new Date(p.utcDate).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) : "TBA";
        
        const gL = p.score?.fullTime?.home ?? 0; const gV = p.score?.fullTime?.away ?? 0;
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
                </div>
            </div>`;
    });
}

// ==========================================
// COMBINADAS (Fallback Algorítmico)
// ==========================================
function analizarMercadosPartido(p) {
    const loc = p.homeTeam.shortName || p.homeTeam.name;
    let probGanaLocal = Math.min(Math.max(45 + (p.homeTeam.id % 15) - (p.awayTeam.id % 10), 12), 88);
    
    let probMas2_5 = deporteActivo === 'futbol' 
        ? Math.min(Math.max(40 + ((p.competition.id % 4) * 8) + ((p.score?.fullTime?.home || 0) * 10), 15), 92)
        : 50 + (p.homeTeam.id % 10);

    let probCorners = 52 + ((p.homeTeam.id + p.awayTeam.id) % 22);
    
    let mercados = deporteActivo === 'futbol' ? [
        { m: `🏆 Gana ${loc}`, pr: probGanaLocal },
        { m: "🔥 +2.5 Goles", pr: probMas2_5 },
        { m: "🚩 +8.5 Córners", pr: probCorners }
    ] : [
        { m: `🏆 Gana ${loc}`, pr: probGanaLocal },
        { m: "🔥 +215.5 Puntos", pr: probMas2_5 },
        { m: `🏀 Hándicap ${loc} -4.5`, pr: probCorners }
    ];

    return mercados.map(item => {
        let cuota = (100 / item.pr).toFixed(2);
        if (cuota < 1.05) cuota = "1.15";
        return { mercado: item.m, prob: Math.round(item.pr), cuota: cuota };
    });
}

function generarCombinadaDelDia() {
    let t = []; baseDeDatosHoy.forEach(p => { analizarMercadosPartido(p).forEach(m => t.push({ p: p, m: m })); });
    
    let s = t.filter(c => c.m.prob >= 70).sort((a,b) => b.m.prob - a.m.prob).slice(0, 3);
    let md = t.filter(c => c.m.prob >= 53 && c.m.prob < 70).sort((a,b) => b.m.prob - a.m.prob).slice(0, 3);
    let arrg = t.filter(c => c.m.prob >= 30 && c.m.prob < 53).sort((a,b) => a.m.prob - b.m.prob).slice(0, 3);

    ticketsMultiplesGenerados = { 
        'seguro': s.map(x=>({m:x.m.mercado, c:x.m.cuota, pId:x.p.id, h:x.p.homeTeam.shortName || x.p.homeTeam.name, a:x.p.awayTeam.shortName || x.p.awayTeam.name})), 
        'medio': md.map(x=>({m:x.m.mercado, c:x.m.cuota, pId:x.p.id, h:x.p.homeTeam.shortName || x.p.homeTeam.name, a:x.p.awayTeam.shortName || x.p.awayTeam.name})),
        'arriesgado': arrg.map(x=>({m:x.m.mercado, c:x.m.cuota, pId:x.p.id, h:x.p.homeTeam.shortName || x.p.homeTeam.name, a:x.p.awayTeam.shortName || x.p.awayTeam.name}))
    };
    
    document.getElementById('seccion-combinada').innerHTML = 
        (s.length ? renderHTMLTick(s, "seguro", "🛡️ Segura") : "") + 
        (md.length ? renderHTMLTick(md, "medio", "⚖️ Equilibrada") : "") +
        (arrg.length ? renderHTMLTick(arrg, "arriesgado", "🔥 Arriesgada") : "");
}

function renderHTMLTick(arr, id, tit) {
    let html = `<div class="tarjeta-combinada ticket-${id}"><h4>${tit}</h4>`;
    arr.forEach(c => { html += `<div class="ticket-item">🤝 ${c.p.homeTeam.shortName || c.p.homeTeam.name} vs ${c.p.awayTeam.shortName || c.p.awayTeam.name} <br>🎯 ${c.m.mercado} <strong style="color:var(--verde-principal); float:right;">x${c.m.cuota}</strong></div>`; });
    html += `<button onclick="guardarCombinada('${id}')" style="margin-top:10px; width:100%; padding:5px;">Guardar Ticket</button></div>`; return html;
}

// ==========================================
// LOBBY Y PICKS
// ==========================================
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

function irADeporte(deporte) {
    // LA SOLUCIÓN ESTÁ ACÁ: Respetamos tu HTML. Oculta el lobby y muestra la app.
    if (deporte !== 'futbol' && deporte !== 'basquet') { alert("¡Integración en proceso!"); return; }
    deporteActivo = deporte;
    document.getElementById('lobby-selector').classList.add('oculto');
    document.getElementById('app-content').classList.remove('oculto');
    iniciarApp();
}

function volverAlLobby() { 
    document.getElementById('lobby-selector').classList.remove('oculto'); 
    document.getElementById('app-content').classList.add('oculto'); 
    baseDeDatosHoy = []; 
}

async function forzarActualizacionLive() {
    const btn = document.getElementById('btn-refresh'); btn.innerText = "⏳"; btn.disabled = true;
    try {
        const actualizados = await fetchPartidos(); 
        const ligasTop = deporteActivo === 'futbol' ? LIGAS_TOP_FUTBOL : LIGAS_TOP_BASKET;
        baseDeDatosHoy = actualizados.filter(p => ligasTop.includes(p.competition.id));
        
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
