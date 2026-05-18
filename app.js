const API_KEYS = [
    "0464d33c8013d01fb7387b5148f18a9a", 
    "31dc5f2762254847a825e1025257a759"
];

let baseDeDatosHoy = [];
let estadoFiltroActual = 'proximos';
let partidoSeleccionadoId = null;
let ticketsMultiplesGenerados = {}; 
let scoresAnteriores = {}; 
let deporteActivo = 'futbol'; // Controla qué deporte se está visualizando

const estadosEnVivoFutbol = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'];
const estadosEnVivoBasket = ['Q1', 'Q2', 'Q3', 'Q4', 'OT', 'BT', 'HT', 'LIVE', 'IN_PLAY'];
const ESCUDO_RESPALDO = "https://cdn-icons-png.flaticon.com/512/53/53283.png";

// Ligas Top
const LIGAS_TOP_FUTBOL = [1, 2, 3, 4, 9, 13, 11, 12, 39, 140, 135, 78, 61, 128, 130, 129, 131, 71, 73];
const LIGAS_TOP_BASKET = [12, 116, 117, 120, 134]; // NBA, Euroliga, etc.

const estilosApp = document.createElement('style');
estilosApp.innerHTML = `
    @keyframes flashGol { 0% { background-color: #2ecc71; transform: scale(1.02); } 100% { background-color: var(--tarjeta-bg); transform: scale(1); } }
    .gol-reciente { animation: flashGol 2s ease-out; }
    
    .tab-detalle-btn { flex:1; padding:10px 5px; background:transparent; color:var(--texto-gris); border:none; border-bottom:2px solid transparent; cursor:pointer; font-size:0.85rem; font-weight:bold; transition:all 0.3s; }
    .tab-detalle-btn.activo { color:var(--verde-principal); border-bottom:2px solid var(--verde-principal); }
    .tab-detalle-content { display:none; padding-top:15px; }
    .tab-detalle-content.activo { display:block; animation: fadeIn 0.3s ease-in; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    #lobby-selector { display: flex; flex-wrap: wrap; justify-content: center; gap: 20px; padding: 20px; }
    .tarjeta-deporte { background: var(--tarjeta-bg); border: 2px solid transparent; border-radius: 12px; padding: 15px; text-align: center; cursor: pointer; transition: transform 0.3s, border-color 0.3s, box-shadow 0.3s; width: 150px; }
    .tarjeta-deporte:hover { transform: translateY(-5px); border-color: var(--verde-principal); box-shadow: 0 8px 16px rgba(0,0,0,0.4); }
    .tarjeta-deporte img { width: 100%; height: 120px; object-fit: cover; border-radius: 8px; margin-bottom: 10px; }
    .tarjeta-deporte h3 { margin: 0; color: white; font-size: 1.1rem; }
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
    const dicc = { "winner": "Ganador", "home": "Local", "away": "Visitante", "draw": "Empate", "combo": "Combinada", "double chance": "Doble Oportunidad", "and": "y", "or": "o", "over": "Más de", "under": "Menos de", "goals": "goles", "points": "puntos", "yes": "Sí", "no": "No", "to score": "anota", "both teams": "Ambos equipos", "spread": "hándicap", "total": "total" };
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

// FETCH FÚTBOL
async function fetchPartidosFutbol() {
    const zona = Intl.DateTimeFormat().resolvedOptions().timeZone; 
    const ahora = new Date();
    const manana = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
    const formatoDia = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    const dataHoy = await fetchConRotacion(`https://v3.football.api-sports.io/fixtures?date=${formatoDia(ahora)}&timezone=${zona}`);
    const dataManana = await fetchConRotacion(`https://v3.football.api-sports.io/fixtures?date=${formatoDia(manana)}&timezone=${zona}`);
    
    let todosLosEventos = [];
    if (dataHoy && dataHoy.response) todosLosEventos = todosLosEventos.concat(dataHoy.response);
    if (dataManana && dataManana.response) todosLosEventos = todosLosEventos.concat(dataManana.response);
    
    const limiteInferior = ahora.getTime() - (4 * 60 * 60 * 1000);
    const limiteSuperior = ahora.getTime() + (24 * 60 * 60 * 1000);

    return todosLosEventos.filter(p => {
        const tiempoPartido = new Date(p.fixture.date).getTime();
        return tiempoPartido >= limiteInferior && tiempoPartido <= limiteSuperior;
    }).map(p => {
        let estado = 'SCHEDULED';
        if (estadosEnVivoFutbol.includes(p.fixture.status.short)) estado = 'IN_PLAY';
        else if (['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(p.fixture.status.short)) estado = 'FINISHED';

        return {
            id: p.fixture.id, utcDate: p.fixture.date, status: estado,
            competition: { id: p.league.id, name: p.league.name, emblem: p.league.logo }, 
            homeTeam: { id: p.teams.home.id, name: p.teams.home.name, shortName: p.teams.home.name, crest: p.teams.home.logo },
            awayTeam: { id: p.teams.away.id, name: p.teams.away.name, shortName: p.teams.away.name, crest: p.teams.away.logo },
            score: { fullTime: { home: p.goals.home, away: p.goals.away } }
        };
    });
}

// FETCH BÁSQUET
async function fetchPartidosBasquet() {
    const zona = Intl.DateTimeFormat().resolvedOptions().timeZone; 
    const ahora = new Date();
    const manana = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
    const formatoDia = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    const dataHoy = await fetchConRotacion(`https://v1.basketball.api-sports.io/games?date=${formatoDia(ahora)}&timezone=${zona}`);
    const dataManana = await fetchConRotacion(`https://v1.basketball.api-sports.io/games?date=${formatoDia(manana)}&timezone=${zona}`);
    
    let todosLosEventos = [];
    if (dataHoy && dataHoy.response) todosLosEventos = todosLosEventos.concat(dataHoy.response);
    if (dataManana && dataManana.response) todosLosEventos = todosLosEventos.concat(dataManana.response);
    
    const limiteInferior = ahora.getTime() - (4 * 60 * 60 * 1000);
    const limiteSuperior = ahora.getTime() + (24 * 60 * 60 * 1000);

    return todosLosEventos.filter(p => {
        const tiempoPartido = new Date(p.date).getTime();
        return tiempoPartido >= limiteInferior && tiempoPartido <= limiteSuperior;
    }).map(p => {
        let estado = 'SCHEDULED';
        if (estadosEnVivoBasket.includes(p.status.short)) estado = 'IN_PLAY';
        else if (['FT', 'AOT'].includes(p.status.short)) estado = 'FINISHED';

        return {
            id: p.id, utcDate: p.date, status: estado,
            competition: { id: p.league.id, name: p.league.name, emblem: p.league.logo }, 
            homeTeam: { id: p.teams.home.id, name: p.teams.home.name, shortName: p.teams.home.name, crest: p.teams.home.logo },
            awayTeam: { id: p.teams.away.id, name: p.teams.away.name, shortName: p.teams.away.name, crest: p.teams.away.logo },
            score: { fullTime: { home: p.scores.home.total, away: p.scores.away.total } }
        };
    });
}

function renderizarLobby() {
    const contenedor = document.getElementById('contenedor-partidos'); 
    contenedor.innerHTML = `
        <div id="lobby-selector">
            <div class="tarjeta-deporte" onclick="irADeporte('futbol')">
                <img src="https://images.unsplash.com/photo-1579952363873-27f3bade9f55?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Fútbol">
                <h3>Fútbol</h3>
            </div>
            <div class="tarjeta-deporte" onclick="irADeporte('basquet')">
                <img src="image_6d04d2.png" alt="Básquet">
                <h3>Básquet</h3>
            </div>
            <div class="tarjeta-deporte" onclick="irADeporte('tenis')">
                <img src="https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Tenis">
                <h3>Tenis</h3>
            </div>
            <div class="tarjeta-deporte" onclick="irADeporte('beisbol')">
                <img src="https://images.unsplash.com/photo-1508344928928-7165b67de128?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Béisbol">
                <h3>Béisbol</h3>
            </div>
        </div>
    `;
}

async function iniciarApp() {
    renderizarLobby(); 
}

async function obtenerDatosReales(idFixture, deporte) {
    const cacheKey = `gp_prediccion_${deporte}_v4_${idFixture}`; 
    const cacheData = localStorage.getItem(cacheKey);
    if (cacheData) { return JSON.parse(cacheData); }

    const url = deporte === 'futbol' 
        ? `https://v3.football.api-sports.io/predictions?fixture=${idFixture}`
        : `https://v1.basketball.api-sports.io/predictions?game=${idFixture}`;

    const data = await fetchConRotacion(url);
        
    if (data && data.response && data.response.length > 0) {
        const analisis = data.response[0];
        const resultado = {
            exito: true,
            local: analisis.predictions.percent.home,
            visita: analisis.predictions.percent.away,
            empate: deporte === 'futbol' ? analisis.predictions.percent.draw : "0%",
            consejo: traducirConsejo(analisis.predictions.advice),
            formaLocal: analisis.teams?.home?.league?.form || analisis.teams?.home?.last_5?.form || "?????",
            formaVisita: analisis.teams?.away?.league?.form || analisis.teams?.away?.last_5?.form || "?????",
        };
        localStorage.setItem(cacheKey, JSON.stringify(resultado));
        return resultado;
    }
    return { exito: false };
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

function predecirSecundarios(deporte, dLocal, dVisita, dEmpate) {
    if (deporte === 'futbol') {
        let l = parseInt(dLocal) || 33; let e = parseInt(dEmpate) || 33; let v = parseInt(dVisita) || 33;
        if (l >= v && l >= e) return [{m:"1-0", p:l*0.4}, {m:"2-0", p:l*0.3}, {m:"2-1", p:l*0.2}];
        else if (v >= l && v >= e) return [{m:"0-1", p:v*0.4}, {m:"0-2", p:v*0.3}, {m:"1-2", p:v*0.2}];
        else return [{m:"1-1", p:e*0.5}, {m:"0-0", p:e*0.3}, {m:"2-2", p:e*0.15}];
    } else {
        let l = parseInt(dLocal) || 50; let v = parseInt(dVisita) || 50;
        let overProb = 45 + (l > v ? (l - 50) / 2 : (v - 50) / 2);
        return [{m: "Más de 218.5 Pts", p: overProb}, {m: "Menos de 218.5 Pts", p: 100 - overProb}];
    }
}

async function abrirDetalle(id) {
    const p = baseDeDatosHoy.find(item => item.id === id); if (!p) return;
    
    document.getElementById('vista-principal').classList.add('oculto'); 
    document.getElementById('vista-detalle').classList.remove('oculto');
    
    const estadosEV = deporteActivo === 'futbol' ? estadosEnVivoFutbol : estadosEnVivoBasket;
    const isLive = estadosEV.includes(p.status);
    const gL = p.score?.fullTime?.home ?? 0; const gV = p.score?.fullTime?.away ?? 0;

    document.getElementById('detalle-status').innerHTML = isLive ? `<div class="live-badge">EN CURSO</div>` : `<span>Pre-Partido</span>`;
    document.getElementById('detalle-cabecera').innerHTML = `<div style="text-align:center; width:40%;"><img src="${p.homeTeam.crest || ESCUDO_RESPALDO}" style="max-height:40px;"><p>${p.homeTeam.name}</p></div><h2 style="width:20%; text-align:center; color:var(--verde-principal);">${isLive ? gL + ' - ' + gV : 'VS'}</h2><div style="text-align:center; width:40%;"><img src="${p.awayTeam.crest || ESCUDO_RESPALDO}" style="max-height:40px;"><p>${p.awayTeam.name}</p></div>`;

    document.getElementById('detalle-barras').innerHTML = `<p style='color: var(--verde-principal); text-align:center; margin-top:20px;'>⏳ Analizando algoritmos (${deporteActivo.toUpperCase()})...</p>`;

    const d = await obtenerDatosReales(p.id, deporteActivo);

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
            <div style="display:flex; justify-content:space-around; align-items:center; background:rgba(0,0,0,0.2); padding:12px; border-radius:8px; margin-bottom:20px;">
                <div style="text-align:center; width:45%;">${p.homeTeam.shortName}<br>${renderFormaHTML(d.formaLocal)}</div>
                <div style="text-align:center; width:45%;">${p.awayTeam.shortName}<br>${renderFormaHTML(d.formaVisita)}</div>
            </div>
            <h4 style="margin-bottom: 10px;">Probabilidades H2H</h4>
            <div class="barra-container"><div style="display:flex; justify-content:space-between;"><span>Gana Local</span><span>${d.local}</span></div><div class="barra-fondo"><div class="barra-progreso" style="background:var(--verde-principal); width:${d.local}"></div></div></div>`;
        if(deporteActivo === 'futbol') {
            htmlTabs += `<div class="barra-container"><div style="display:flex; justify-content:space-between;"><span>Empate</span><span>${d.empate}</span></div><div class="barra-fondo"><div class="barra-progreso" style="background:var(--oro); width:${d.empate}"></div></div></div>`;
        }
        htmlTabs += `<div class="barra-container"><div style="display:flex; justify-content:space-between;"><span>Gana Visita</span><span>${d.visita}</span></div><div class="barra-fondo"><div class="barra-progreso" style="background:var(--alerta); width:${d.visita}"></div></div></div>
            <button onclick="guardarUnicoPickLocal(${p.id}, 'Predicción: ${d.consejo?.replace(/'/g,"\\'")}', 'N/A', 0, '${p.homeTeam.shortName}', '${p.awayTeam.shortName}')" style="margin-top:10px; width:100%; background:var(--tarjeta-borde); color:white; border:none; padding:10px; cursor:pointer; font-weight:bold;">Guardar Predicción</button>
        </div>`;
        
        let secundarios = predecirSecundarios(deporteActivo, d.local, d.visita, d.empate);
        htmlTabs += `<div id="tab-scores" class="tab-detalle-content"><div style="display:flex; gap:10px; justify-content:center;">`;
        secundarios.forEach((sc, idx) => {
            htmlTabs += `<div style="flex:1; text-align:center; background:rgba(0,0,0,0.2); padding:15px 5px; border-radius:8px; border-top: 3px solid var(--verde-principal);">
                <strong style="font-size:1.2rem; display:block; color:white;">${sc.m}</strong>
                <span style="font-size:0.75rem; color:var(--texto-gris);">Prob: ${Math.round(sc.p)}%</span>
            </div>`;
        });
        htmlTabs += `</div></div>`;
    } else {
        htmlTabs += "<p style='color: var(--oro); text-align:center;'>⚠️ Datos de simulación analítica basica.</p>";
        let mercados = deporteActivo === 'futbol' ? analizarMercadosPartidoFutbol(p) : analizarMercadosPartidoBasquet(p);
        mercados.forEach((m, i) => {
            htmlTabs += `<div class="barra-container"><div><span>${m.mercado} <strong>(x${m.cuota})</strong></span></div><button onclick="guardarUnicoPickLocal(${p.id}, '${m.mercado}', '${m.cuota}', ${m.prob}, '${p.homeTeam.shortName}', '${p.awayTeam.shortName}')">Guardar</button></div>`;
        });
        htmlTabs += "</div><div id='tab-scores' class='tab-detalle-content'><p style='text-align:center; color:var(--texto-gris);'>Sin datos adicionales.</p></div>";
    }
    document.getElementById('detalle-barras').innerHTML = htmlTabs;
}

function cambiarTabDetalle(idTab, btn) {
    document.querySelectorAll('.tab-detalle-content').forEach(el => el.classList.remove('activo'));
    document.querySelectorAll('.tab-detalle-btn').forEach(el => el.classList.remove('activo'));
    document.getElementById(idTab).classList.add('activo');
    btn.classList.add('activo');
}

function cerrarDetalle() { document.getElementById('vista-detalle').classList.add('oculto'); document.getElementById('vista-principal').classList.remove('oculto'); }

function setFiltroEstado(estado) {
    estadoFiltroActual = estado;
    document.querySelectorAll('.btn-filto-main').forEach(b => b.classList.remove('activo'));
    if(document.getElementById('btn-' + estado)) document.getElementById('btn-' + estado).classList.add('activo');
    aplicarFiltrosMaster();
}

function aplicarFiltrosMaster(idsGoles = []) {
    let filtrados = baseDeDatosHoy;
    const estadosEV = deporteActivo === 'futbol' ? estadosEnVivoFutbol : estadosEnVivoBasket;
    
    if (estadoFiltroActual === 'envivo') {
        filtrados = filtrados.filter(p => estadosEV.includes(p.status) || p.status === 'IN_PLAY');
    }

    renderizarPartidos(filtrados, idsGoles);
}

function renderizarPartidos(partidos, idsGoles = []) {
    const cont = document.getElementById('contenedor-partidos'); cont.innerHTML = '';
    
    let imagenDeporte = deporteActivo === 'futbol' ? 'image_0.png' : 'image_6d04d2.png';
    cont.innerHTML += `
        <div class="tarjeta-partido" onclick="volverAlLobby()" style="cursor: pointer; text-align: center; background: none; border: none; box-shadow: none;">
            <img src="${imagenDeporte}" style="width: 100%; max-height:160px; object-fit:cover; border-radius: 8px; border: 2px solid var(--verde-principal);">
            <h3 style="margin-top: 10px; color: white;">← Volver al Menú de Deportes</h3>
        </div>
    `;

    if (partidos.length === 0) { cont.innerHTML += `<p style="padding:20px; text-align:center;">No hay eventos top disponibles en este momento.</p>`; return; }

    partidos.forEach(p => {
        const marcador = `<span>${p.score?.fullTime?.home ?? 0} - ${p.score?.fullTime?.away ?? 0}</span>`;
        cont.innerHTML += `
            <div class="tarjeta-partido" onclick="abrirDetalle(${p.id})">
                <div class="encabezado-liga">${p.competition.name}</div>
                <div class="cuerpo-partido">
                    <div class="equipos">
                        <div class="equipo-linea">${p.homeTeam.name}</div>
                        <div class="equipo-linea">${p.awayTeam.name}</div>
                    </div>
                    <div class="marcador-live">${marcador}</div>
                </div>
            </div>`;
    });
}

function analizarMercadosPartidoFutbol(p) {
    return [
        { mercado: `🏆 Gana ${p.homeTeam.shortName}`, prob: 50, cuota: "1.95" },
        { mercado: "🔥 +2.5 Goles", prob: 62, cuota: "1.65" },
        { mercado: "🚩 +8.5 Córners", prob: 55, cuota: "1.80" }
    ];
}

function analizarMercadosPartidoBasquet(p) {
    return [
        { mercado: `🏆 Gana ${p.homeTeam.shortName}`, prob: 55, cuota: "1.85" },
        { mercado: "🔥 Más de 216.5 Puntos", prob: 51, cuota: "1.90" },
        { mercado: `🏀 Hándicap ${p.homeTeam.shortName} -4.5`, prob: 50, cuota: "1.85" }
    ];
}

function generarCombinadaDelDia() {
    // Modular dinámicamente según necesidades de interfaz
}

function guardarUnicoPickLocal(mId, merc, cuota, prob, home, away) {
    let h = JSON.parse(localStorage.getItem('gp_picks')) || [];
    h.push({ id: Date.now(), matchId: mId, home: home, away: away, mercado: merc, cuota: cuota, prob: prob, estado: 'PENDIENTE' });
    localStorage.setItem('gp_picks', JSON.stringify(h));
    actualizarEstructuraPicksLocales();
}

function actualizarEstructuraPicksLocales() {
    let hist = JSON.parse(localStorage.getItem('gp_picks')) || [];
    if(document.getElementById('contador-picks-badge')) {
        document.getElementById('contador-picks-badge').innerText = hist.filter(h => h.estado === 'PENDIENTE').length;
    }
}

async function irADeporte(deporte) {
    deporteActivo = deporte;
    const contenedor = document.getElementById('contenedor-partidos');
    contenedor.innerHTML = `<p style="color: var(--verde-principal); padding:20px; text-align: center;">⏳ Conectando servidores de ${deporte.toUpperCase()}...</p>`;
    
    try {
        if (deporte === 'futbol') {
            const todos = await fetchPartidosFutbol();
            baseDeDatosHoy = todos.filter(p => LIGAS_TOP_FUTBOL.includes(p.competition.id));
        } else if (deporte === 'basquet') {
            const todos = await fetchPartidosBasquet();
            baseDeDatosHoy = todos.filter(p => LIGAS_TOP_BASKET.includes(p.competition.id));
        } else {
            alert("¡Próximamente disponible!");
            renderizarLobby();
            return;
        }
        aplicarFiltrosMaster();
    } catch(e) {
        contenedor.innerHTML = `<p style="color:var(--alerta); text-align:center;">Error de conexión.</p>`;
    }
}

function volverAlLobby() { 
    baseDeDatosHoy = []; 
    renderizarLobby(); 
}

async function forzarActualizacionLive() {
    if(deporteActivo === 'futbol') await irADeporte('futbol');
    else await irADeporte('basquet');
}

window.onload = () => { 
    actualizarEstructuraPicksLocales(); 
    iniciarApp(); 
};
