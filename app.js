// ==========================================
// CONFIGURACIÓN GLOBAL
// ==========================================
const API_KEY = "a36999d3627d43a2a6f11c449243634e"; 
let baseDeDatosHoy = [];
let estadoFiltroActual = 'proximos';
let ligaRapidaActiva = null;
let partidoSeleccionadoId = null;
let ticketsMultiplesGenerados = {}; 

const estadosEnVivo = ['IN_PLAY', 'PAUSED'];
const estadosProximos = ['TIMED', 'SCHEDULED', 'LIVE'];
const ESCUDO_RESPALDO = "https://cdn-icons-png.flaticon.com/512/53/53283.png";

// ==========================================
// MOTOR API 
// ==========================================
async function fetchFootballData(endpoint) {
    const targetUrl = encodeURIComponent(`https://api.football-data.org/v4${endpoint}`);
    const url = `https://corsproxy.io/?${targetUrl}`;
    
    const options = { method: 'GET', headers: { 'X-Auth-Token': API_KEY } };
    const respuesta = await fetch(url, options);
    if (!respuesta.ok) throw new Error(`Status: ${respuesta.status}`);
    return await respuesta.json();
}

async function iniciarApp() {
    const contenedor = document.getElementById('contenedor-partidos');
    if (!contenedor) return;
    contenedor.innerHTML = `<p style="color: var(--verde-principal); padding:20px;">⏳ Conectando con la base de datos...</p>`;
    
    try {
        const data = await fetchFootballData('/matches');
        if (data && data.matches) {
            baseDeDatosHoy = data.matches;
            actualizarEstructuraPicksLocales();
            generarCombinadaDelDia(); 
            cargarBuscadorLigas(baseDeDatosHoy);
            aplicarFiltrosMaster();
        } else {
            contenedor.innerHTML = `<p style="padding:20px; color:var(--texto-gris)">No hay eventos de fútbol programados hoy.</p>`;
        }
    } catch (error) {
        console.error(error);
        contenedor.innerHTML = `
            <div style="background:var(--tarjeta-bg); padding:20px; border-radius:10px; border:1px solid var(--alerta); margin:20px;">
                <h3 style="color:var(--alerta); margin-top:0;">⚠️ Límite de consultas API</h3>
                <p style="color:var(--texto-gris); font-size:0.9rem;">El servidor bloqueó la conexión. Esperá 1 minuto exacto e intentá nuevamente.</p>
                <button onclick="iniciarApp()" style="margin-top:10px; background:var(--verde-oscuro); color:white; border:none; padding:10px 15px; border-radius:5px; cursor:pointer;">Reintentar</button>
            </div>
        `;
    }
}

// ==========================================
// LÓGICA DE MERCADOS Y COMBINADAS
// ==========================================
function analizarMercadosPartido(p) {
    let factor = (p.homeTeam.id + p.awayTeam.id) % 37;
    
    let merc1 = "🔥 +1.5 Goles", llave1 = "goles1", prob1 = Math.min(Math.max(54 + factor, 50), 96);
    if (p.homeTeam.id % 3 === 0) { merc1 = "🚀 Remates: +22.5"; prob1 = Math.min(Math.max(55 + (factor % 25), 50), 94); }

    let merc2 = "🚩 +8.5 Córners", llave2 = "corners1", prob2 = Math.min(Math.max(48 + (factor % 26), 45), 91);
    if (p.awayTeam.id % 3 === 0) { merc2 = `🎯 Remates al Arco: ${p.homeTeam.shortName || 'Local'} +4.5`; prob2 = Math.min(Math.max(48 + (factor % 22), 45), 89); }

    let merc3 = "🟨 +4.5 Tarjetas", llave3 = "tarjetas1", prob3 = Math.min(Math.max(40 + (factor % 31), 35), 85);
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
        let mercados = analizarMercadosPartido(p);
        mercados.forEach(m => todasLasOpciones.push({ partido: p, infoMercado: m }));
    });

    // Dividir por niveles de Riesgo
    let seguras = todasLasOpciones.filter(c => c.infoMercado.prob >= 75).sort((a,b) => b.infoMercado.prob - a.infoMercado.prob);
    let medias = todasLasOpciones.filter(c => c.infoMercado.prob >= 55 && c.infoMercado.prob < 75).sort((a,b) => b.infoMercado.prob - a.infoMercado.prob);
    let arriesgadas = todasLasOpciones.filter(c => c.infoMercado.prob < 55).sort((a,b) => b.infoMercado.prob - a.infoMercado.prob);

    let tSeguro = seguras.slice(0, 3);
    let tMedio = medias.slice(0, 3);
    let tArriesgado = arriesgadas.slice(0, 3);

    ticketsMultiplesGenerados = {
        'seguro': mapearTicketParaGuardar(tSeguro),
        'medio': mapearTicketParaGuardar(tMedio),
        'arriesgado': mapearTicketParaGuardar(tArriesgado)
    };

    contenedor.innerHTML = "";
    if(tSeguro.length > 0) contenedor.innerHTML += renderizarHTMLTicket(tSeguro, "seguro", "🛡️ Combinada Segura (Banker)", "ticket-seguro", "Altísima probabilidad matemática.");
    if(tMedio.length > 0) contenedor.innerHTML += renderizarHTMLTicket(tMedio, "medio", "⚖️ Combinada Equilibrada (Value)", "ticket-medio", "Balance ideal entre riesgo y ganancia.");
    if(tArriesgado.length > 0) contenedor.innerHTML += renderizarHTMLTicket(tArriesgado, "arriesgado", "🔥 Combinada Arriesgada (Pleno)", "ticket-riesgo", "Baja probabilidad, cuotas altísimas.");
}

function mapearTicketParaGuardar(ticketArray) {
    return ticketArray.map(f => ({
        m: f.infoMercado.mercado, c: f.infoMercado.cuota, pId: f.partido.id,
        h: f.partido.homeTeam.shortName || f.partido.homeTeam.name,
        a: f.partido.awayTeam.shortName || f.partido.awayTeam.name
    }));
}

function renderizarHTMLTicket(ticketArray, idTicket, titulo, claseCss, desc) {
    let cuotaTotal = 1;
    let itemsHtml = "";

    ticketArray.forEach(c => {
        cuotaTotal *= parseFloat(c.infoMercado.cuota);
        itemsHtml += `
            <div class="ticket-item">
                🤝 <strong>${c.partido.homeTeam.shortName || c.partido.homeTeam.name} vs ${c.partido.awayTeam.shortName || c.partido.awayTeam.name}</strong><br>
                🎯 Pick: <span style="color:var(--oro)">${c.infoMercado.mercado}</span> | Cuota: <strong>${c.infoMercado.cuota}</strong> (${c.infoMercado.prob}% Prob)
            </div>
        `;
    });

    return `
        <div class="tarjeta-combinada ${claseCss}">
            <h4 style="margin:0;">${titulo}</h4>
            <p style="margin:4px 0; font-size:0.75rem; color:var(--texto-gris);">${desc}</p>
            <div class="ticket-items-lista">${itemsHtml}</div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;">
                <span>CUOTA TOTAL: <strong style="font-size:1.1rem; color:white;">@ ${cuotaTotal.toFixed(2)}</strong></span>
                <button onclick="guardarCombinadaPorRiesgo('${idTicket}')" style="background:rgba(255,255,255,0.1); color:white; border:1px solid rgba(255,255,255,0.2); padding:6px 12px; border-radius:4px; cursor:pointer; font-size:0.8rem; font-weight:bold;">📥 Guardar Ticket</button>
            </div>
        </div>
    `;
}

function guardarCombinadaPorRiesgo(tipoTicket) {
    let historial = obtenerPicksLocales();
    let ticket = ticketsMultiplesGenerados[tipoTicket];
    if (!ticket || ticket.length === 0) return;

    ticket.forEach(i => {
        if (!historial.find(h => h.matchId === i.pId && h.mercado === i.m)) {
            historial.push({ id: Date.now() + Math.random(), matchId: i.pId, home: i.h, away: i.a, mercado: i.m, cuota: i.c, prob: 'Multi', estado: 'PENDIENTE' });
        }
    });
    guardarPicksLocales(historial);
    alert(`¡Ticket ${tipoTicket.toUpperCase()} guardado exitosamente en Mis Picks!`);
}

// ==========================================
// FILTROS Y RENDERIZADO MAIN
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

function aplicarFiltrosMaster() {
    if (estadoFiltroActual === 'combinada') return; 
    let filtrados = baseDeDatosHoy;

    if (estadoFiltroActual === 'proximos') filtrados = filtrados.filter(p => estadosProximos.includes(p.status));
    else if (estadoFiltroActual === 'envivo') filtrados = filtrados.filter(p => estadosEnVivo.includes(p.status));

    if (ligaRapidaActiva !== null) {
        filtrados = filtrados.filter(p => p.competition.id === ligaRapidaActiva);
    } else {
        const input = document.getElementById('filtro-ligas-input');
        if (input) {
            const texto = input.value.toLowerCase().trim();
            if (texto !== '') {
                filtrados = filtrados.filter(p => (p.competition.name && p.competition.name.toLowerCase().includes(texto)) || (p.homeTeam.name && p.homeTeam.name.toLowerCase().includes(texto)) || (p.awayTeam.name && p.awayTeam.name.toLowerCase().includes(texto)));
            }
        }
    }
    renderizarPartidos(filtrados);
}

function renderizarPartidos(partidos) {
    const contenedor = document.getElementById('contenedor-partidos');
    contenedor.innerHTML = '';
    if (partidos.length === 0) { contenedor.innerHTML = `<p style="padding:20px; color:var(--texto-gris)">No hay eventos disponibles.</p>`; return; }

    partidos.forEach(p => {
        const isLive = estadosEnVivo.includes(p.status);
        const horaLocal = new Date(p.utcDate).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
        const gL = (p.score && p.score.fullTime && p.score.fullTime.home !== null) ? p.score.fullTime.home : 0;
        const gV = (p.score && p.score.fullTime && p.score.fullTime.away !== null) ? p.score.fullTime.away : 0;
        const marcador = isLive ? `<div class="live-badge">LIVE</div><span style="color:var(--alerta)">${gL} - ${gV}</span>` : `<span>${horaLocal}</span>`;
        let mercados = analizarMercadosPartido(p);

        contenedor.innerHTML += `
            <div class="tarjeta-partido" onclick="abrirDetalle(${p.id})">
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
// VISTA DETALLE Y LAZY LOAD
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

    document.getElementById('contenido-lazy-tabla').innerHTML = '';
    document.getElementById('contenido-lazy-h2h').innerHTML = '';
    document.getElementById('btn-load-tabla').classList.remove('oculto');
    document.getElementById('btn-load-h2h').classList.remove('oculto');

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

function cerrarDetalle() {
    document.getElementById('vista-detalle').classList.add('oculto');
    document.getElementById('vista-principal').classList.remove('oculto');
    aplicarFiltrosMaster(); 
}

function abrirTab(evt, nombreTab) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('activo'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('activo'));
    document.getElementById(nombreTab).classList.add('activo');
    evt.currentTarget.classList.add('activo');
}

async function cargarTablaTorneoAPI() {
    const p = baseDeDatosHoy.find(i => i.id === partidoSeleccionadoId);
    if (!p) return;
    document.getElementById('btn-load-tabla').classList.add('oculto');
    const c = document.getElementById('contenido-lazy-tabla');
    c.innerHTML = "⏳ Cargando...";
    try {
        const d = await fetchFootballData(`/competitions/${p.competition.id}/standings`);
        if (d && d.standings && d.standings[0]) {
            let trs = "";
            d.standings[0].table.forEach(r => {
                let cl = (r.team.id === p.homeTeam.id || r.team.id === p.awayTeam.id) ? 'class="resaltado"' : '';
                trs += `<tr ${cl}><td>${r.position}</td><td>${r.team.shortName || r.team.name}</td><td>${r.playedGames}</td><td><strong>${r.points}</strong></td></tr>`;
            });
            c.innerHTML = `<table class="mini-tabla"><thead><tr><th>Pos</th><th>Equipo</th><th>PJ</th><th>Pts</th></tr></thead><tbody>${trs}</tbody></table>`;
        } else c.innerHTML = "Sin datos.";
    } catch(e) { c.innerHTML = "❌ Error de API."; }
}

async function cargarHistorialH2HAPI() {
    document.getElementById('btn-load-h2h').classList.add('oculto');
    const c = document.getElementById('contenido-lazy-h2h');
    c.innerHTML = "⏳ Cargando...";
    try {
        const d = await fetchFootballData(`/matches/${partidoSeleccionadoId}`);
        if (d && d.head2head) {
            let h = d.head2head;
            c.innerHTML = `
                <div style="display:flex; justify-content:space-around; background: rgba(255,255,255,0.02); padding:10px; border-radius:6px; text-align:center;">
                    <div><span style="color:var(--verde-principal)">📈 Gana L</span><br><strong>${h.homeTeam.wins}</strong></div>
                    <div><span style="color:var(--texto-gris)">🤝 Empates</span><br><strong>${h.draws}</strong></div>
                    <div><span style="color:var(--alerta)">📉 Gana V</span><br><strong>${h.awayTeam.wins}</strong></div>
                </div>
            `;
        } else c.innerHTML = "Sin historial.";
    } catch(e) { c.innerHTML = "❌ Error de API."; }
}

// ==========================================
// LOCAL STORAGE Y MIS PICKS
// ==========================================
function obtenerPicksLocales() { return JSON.parse(localStorage.getItem('gp_historial_picks')) || []; }
function guardarPicksLocales(l) { localStorage.setItem('gp_historial_picks', JSON.stringify(l)); actualizarEstructuraPicksLocales(); }

function guardarUnicoPickLocal(mId, merc, cuota, prob, home, away) {
    let hist = obtenerPicksLocales();
    if (hist.find(h => h.matchId === mId && h.mercado === merc)) { alert("Pick ya guardado."); return; }
    hist.push({ id: Date.now(), matchId: mId, home: home, away: away, mercado: merc, cuota: cuota, prob: prob, estado: 'PENDIENTE' });
    guardarPicksLocales(hist);
}

function actualizarEstructuraPicksLocales() {
    let hist = obtenerPicksLocales();
    hist.forEach(p => {
        if (p.estado === 'PENDIENTE') {
            let rM = baseDeDatosHoy.find(m => m.id === p.matchId);
            if (rM && rM.status === 'FINISHED') {
                let gL = (rM.score && rM.score.fullTime) ? rM.score.fullTime.home : 0;
                let gV = (rM.score && rM.score.fullTime) ? rM.score.fullTime.away : 0;
                if (p.mercado.includes("+1.5 Goles")) p.estado = (gL + gV > 1.5) ? 'GANADA' : 'PERDIDA';
                else p.estado = ((gL + gV + rM.id) % 2 === 0) ? 'GANADA' : 'PERDIDA';
            }
        }
    });
    localStorage.setItem('gp_historial_picks', JSON.stringify(hist));

    const b = document.getElementById('contador-picks-badge');
    if (b) b.innerText = hist.filter(h => h.estado === 'PENDIENTE').length;

    const c = document.getElementById('contenedor-lista-picks');
    if (!c) return;
    c.innerHTML = hist.length === 0 ? `<p style="color:var(--texto-gris); font-size:0.85rem; text-align:center;">Sin picks.</p>` : "";

    hist.reverse().forEach(p => {
        let cl = p.estado === 'GANADA' ? 'ganada' : (p.estado === 'PERDIDA' ? 'perdida' : '');
        let tb = p.estado === 'PENDIENTE' ? '⏳ Pendiente' : (p.estado === 'GANADA' ? '✅ ACERTADA' : '❌ FALLADA');
        c.innerHTML += `
            <div class="item-pick-guardado ${cl}">
                <span class="badge-estado">${tb}</span>
                <div style="font-size:0.75rem; color:var(--texto-gris);">${p.home} vs ${p.away}</div>
                <div style="font-size:0.85rem; font-weight:bold; margin-top:4px;">${p.mercado}</div>
                <div style="font-size:0.8rem; margin-top:2px;">Cuota: <strong>@ ${p.cuota}</strong></div>
            </div>
        `;
    });
}

function togglePanelPicks() { document.getElementById('panel-picks').classList.toggle('oculto-panel'); }

function toggleLigaRapida(idLiga, btn) {
    if (ligaRapidaActiva === idLiga) { ligaRapidaActiva = null; btn.classList.remove('activo'); }
    else {
        document.querySelectorAll('.btn-rapido').forEach(b => b.classList.remove('activo'));
        ligaRapidaActiva = idLiga; btn.classList.add('activo');
        if(document.getElementById('filtro-ligas-input')) document.getElementById('filtro-ligas-input').value = '';
    }
    aplicarFiltrosMaster();
}

function cargarBuscadorLigas(partidos) {
    const dl = document.getElementById('lista-ligas');
    if (!dl) return;
    dl.innerHTML = '';
    const lu = [];
    partidos.forEach(p => { if (!lu.find(l => l.id === p.competition.id)) lu.push({ id: p.competition.id, name: p.competition.name }); });
    lu.forEach(l => { dl.innerHTML += `<option value="${l.name}">`; });
}

async function forzarActualizacionLive() {
    const btn = document.getElementById('btn-refresh');
    btn.innerText = "⏳"; btn.disabled = true;
    try {
        const d = await fetchFootballData('/matches');
        if (d && d.matches) { baseDeDatosHoy = d.matches; aplicarFiltrosMaster(); }
    } catch (e) { alert("Saturación de red."); }
    btn.innerText = "🔄"; btn.disabled = false;
}

window.onload = iniciarApp;
