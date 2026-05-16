// ==========================================
// 1. CONFIGURACIÓN FOOTBALL-DATA.ORG
// ==========================================
// Esta API es súper estable, no se cuelga y permite 10 peticiones POR MINUTO.
const API_KEY = "a36999d3627d43a2a6f11c449243634e"; 

let baseDeDatosHoy = [];
let estadoFiltroActual = 'proximos'; 
let ligaRapidaActiva = null; 

// Códigos de estado de Football-Data
const estadosEnVivo = ['IN_PLAY', 'PAUSED'];
const estadosProximos = ['TIMED', 'SCHEDULED'];

// Motor de peticiones principal (con proxy para evitar bloqueos de GitHub)
async function fetchFootballData(endpoint) {
    // Usamos corsproxy para asegurarnos de que el navegador no bloquee la conexión desde GitHub
    const targetUrl = encodeURIComponent(`https://api.football-data.org/v4${endpoint}`);
    const url = `https://corsproxy.io/?${targetUrl}`;
    
    const options = { 
        method: 'GET', 
        headers: { 
            'X-Auth-Token': API_KEY 
        } 
    };
    
    try {
        const respuesta = await fetch(url, options);
        if (!respuesta.ok) {
            throw new Error(`Error en la conexión. Código: ${respuesta.status}`);
        }
        const data = await respuesta.json();
        return data;
    } catch (e) {
        console.error("Error Fetch:", e);
        throw e;
    }
}

// ==========================================
// 2. INICIO Y BÚSQUEDA DE PARTIDOS
// ==========================================
async function iniciarApp() {
    try {
        document.getElementById('contenedor-partidos').innerHTML = `<p style="color: var(--celeste-1xbet);">⏳ Descargando partidos del día...</p>`;
        
        // Pide los partidos de hoy automáticamente
        const data = await fetchFootballData(`/matches`);
        
        if (data.matches && data.matches.length > 0) {
            baseDeDatosHoy = data.matches;
            cargarBuscadorLigas(baseDeDatosHoy);
            aplicarFiltrosMaster(); 
        } else {
            document.getElementById('contenedor-partidos').innerHTML = `<p style="margin-top:20px; color:var(--texto-gris)">Hoy no hay partidos programados en las ligas principales.</p>`;
        }

    } catch (error) {
        document.getElementById('contenedor-partidos').innerHTML = `
            <div style="background:var(--tarjeta-bg); padding:20px; border-radius:10px; border:1px solid var(--alerta);">
                <h3 style="color:var(--alerta); margin-top:0;">⚠️ Error de conexión</h3>
                <p style="color:var(--texto-gris); font-size:0.9rem;">${error.message}</p>
                <button onclick="iniciarApp()" style="margin-top:10px; background:var(--azul-1xbet); color:white; border:none; padding:10px 15px; border-radius:5px; cursor:pointer;">Reintentar</button>
            </div>
        `;
    }
}

// ==========================================
// 3. FILTROS
// ==========================================
function setFiltroEstado(estado) {
    estadoFiltroActual = estado;
    document.getElementById('btn-proximos').classList.toggle('activo', estado === 'proximos');
    document.getElementById('btn-envivo').classList.toggle('activo', estado === 'envivo');
    
    const btnRefresh = document.getElementById('btn-refresh');
    if(estado === 'envivo') {
        btnRefresh.classList.remove('oculto');
    } else {
        btnRefresh.classList.add('oculto');
    }

    aplicarFiltrosMaster();
}

function toggleLigaRapida(idLiga, botonElem) {
    // Acá actualicé los IDs de las ligas porque Football-Data usa otros números
    const idConvertido = adaptarIdLiga(idLiga);

    if (ligaRapidaActiva === idConvertido) {
        ligaRapidaActiva = null;
        botonElem.classList.remove('activo');
    } else {
        document.querySelectorAll('.btn-rapido').forEach(b => b.classList.remove('activo'));
        ligaRapidaActiva = idConvertido;
        botonElem.classList.add('activo');
        document.getElementById('filtro-ligas-input').value = '';
    }
    aplicarFiltrosMaster();
}

// Adapta los IDs que tenías en el HTML a los que usa Football-Data
function adaptarIdLiga(idViejo) {
    const mapa = { 39: 2021, 140: 2014, 135: 2019, 78: 2002, 2: 2001, 128: 2023 };
    return mapa[idViejo] || idViejo;
}

function aplicarFiltrosMaster() {
    let filtrados = baseDeDatosHoy;

    if (estadoFiltroActual === 'proximos') {
        filtrados = filtrados.filter(p => estadosProximos.includes(p.status));
    } else if (estadoFiltroActual === 'envivo') {
        filtrados = filtrados.filter(p => estadosEnVivo.includes(p.status));
    }

    const divAccesos = document.getElementById('contenedor-accesos-rapidos');
    if (estadoFiltroActual === 'proximos') {
        divAccesos.classList.remove('oculto');
    } else {
        divAccesos.classList.add('oculto');
        ligaRapidaActiva = null;
        document.querySelectorAll('.btn-rapido').forEach(b => b.classList.remove('activo'));
    }

    if (ligaRapidaActiva !== null) {
        filtrados = filtrados.filter(p => p.competition.id === ligaRapidaActiva);
    } else {
        const textoBuscado = document.getElementById('filtro-ligas-input').value.toLowerCase().trim();
        if (textoBuscado !== '') {
            filtrados = filtrados.filter(p => {
                const nomLiga = p.competition.name.toLowerCase();
                const equipoL = p.homeTeam.name.toLowerCase();
                const equipoV = p.awayTeam.name.toLowerCase();
                return nomLiga.includes(textoBuscado) || equipoL.includes(textoBuscado) || equipoV.includes(textoBuscado);
            });
        }
    }

    if (filtrados.length > 0) {
        renderizarPartidos(filtrados);
    } else {
        let msg = estadoFiltroActual === 'envivo' ? "No hay partidos jugándose en este momento." : "No se encontraron partidos bajo estos filtros.";
        document.getElementById('contenedor-partidos').innerHTML = `<p style="margin-top:20px; color:var(--texto-gris); padding:0 20px;">${msg}</p>`;
    }
}

function cargarBuscadorLigas(partidos) {
    const datalist = document.getElementById('lista-ligas');
    datalist.innerHTML = '';
    const ligasUnicas = [];
    partidos.forEach(p => {
        if(!ligasUnicas.find(l => l.id === p.competition.id)) {
            ligasUnicas.push({id: p.competition.id, name: p.competition.name});
        }
    });
    ligasUnicas.forEach(liga => {
        datalist.innerHTML += `<option value="${liga.name}">`;
    });
}

function simularSemaforo(id) {
    let p = (id % 40) + 50; 
    return { s: Math.min(p+15, 95), m: p, r: Math.max(p-25, 20) };
}

// ==========================================
// 4. RENDERIZADO
// ==========================================
function renderizarPartidos(partidos) {
    const contenedor = document.getElementById('contenedor-partidos');
    contenedor.innerHTML = '';

    partidos.forEach(p => {
        const isLive = estadosEnVivo.includes(p.status);
        
        const fechaObj = new Date(p.utcDate);
        const horaLocal = fechaObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
        
        // Goles (En Football-Data vienen en score.fullTime)
        const golesL = p.score.fullTime.home !== null ? p.score.fullTime.home : 0;
        const golesV = p.score.fullTime.away !== null ? p.score.fullTime.away : 0;

        const marcadorHTML = isLive 
            ? `<span style="font-size:0.7rem; color:var(--alerta);">⏱️</span>
               <span id="goles-${p.id}-l">${golesL}</span><span id="goles-${p.id}-v">${golesV}</span>` 
            : `<span style="font-size:0.8rem; color:var(--texto-gris);">${horaLocal}</span>`;

        const escudoL = p.homeTeam.crest || '';
        const escudoV = p.awayTeam.crest || '';
        const nomL = p.homeTeam.shortName || p.homeTeam.name;
        const nomV = p.awayTeam.shortName || p.awayTeam.name;

        const prob = simularSemaforo(p.homeTeam.id + p.awayTeam.id);

        const tarjeta = `
            <div class="tarjeta-partido" onclick="abrirDetalle(${p.id}, ${p.homeTeam.id}, ${p.awayTeam.id}, '${nomL.replace(/'/g, "")}', '${nomV.replace(/'/g, "")}', '${escudoL}', '${escudoV}', '${p.status}', '${horaLocal}')">
                ${isLive ? '<div class="live-badge">EN VIVO</div>' : ''}
                <div class="encabezado-liga">
                    <span><img src="${p.competition.emblem || ''}" onerror="this.style.display='none'"> ${p.competition.name}</span>
                </div>
                <div class="cuerpo-partido">
                    <div class="equipos">
                        <div class="equipo-linea"><img src="${escudoL}"> ${nomL}</div>
                        <div class="equipo-linea"><img src="${escudoV}"> ${nomV}</div>
                    </div>
                    <div class="marcador-live">
                        ${marcadorHTML}
                    </div>
                    <div class="semaforo">
                        <div class="luz luz-v">${prob.s}%</div>
                        <div class="luz luz-a">${prob.m}%</div>
                        <div class="luz luz-r">${prob.r}%</div>
                    </div>
                </div>
            </div>
        `;
        contenedor.innerHTML += tarjeta;
    });
}

async function forzarActualizacionLive() {
    const btn = document.getElementById('btn-refresh');
    btn.innerText = "⏳ Actualizando..."; 
    btn.disabled = true;
    
    try {
        const data = await fetchFootballData(`/matches`);
        if(data && data.matches) {
            baseDeDatosHoy = data.matches;
            aplicarFiltrosMaster(); 
        }
    } catch (e) {
        alert("Hubo un problema al actualizar.");
    }
    
    btn.innerText = "🔄 Actualizar";
    btn.disabled = false;
}

// ==========================================
// 5. VISTA DETALLE
// ==========================================
function abrirDetalle(fixId, idLocal, idVisita, nomLocal, nomVisita, logoLocal, logoVisita, statusShort, hora) {
    document.getElementById('vista-principal').classList.add('oculto');
    document.getElementById('vista-detalle').classList.remove('oculto');
    
    const isLive = estadosEnVivo.includes(statusShort);

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('activo'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('activo'));
    document.querySelectorAll('.tab-btn')[0].classList.add('activo');
    document.getElementById('tab-stats').classList.add('activo');

    const statusHtml = isLive ? '<span class="live-badge" style="position:relative; top:0;">EN JUEGO</span>' : `<span style="color:var(--texto-gris)">${hora}</span>`;
    document.getElementById('detalle-status').innerHTML = statusHtml;
    document.getElementById('detalle-cabecera').innerHTML = `
        <div style="text-align:center"><img src="${logoLocal}"><p style="margin:5px 0 0; font-size:0.8rem; font-weight:bold;">${nomLocal}</p></div>
        <h2>VS</h2>
        <div style="text-align:center"><img src="${logoVisita}"><p style="margin:5px 0 0; font-size:0.8rem; font-weight:bold;">${nomVisita}</p></div>
    `;

    const prob = simularSemaforo(idLocal + idVisita);
    document.getElementById('detalle-barras').innerHTML = `
        <div class="barra-container">
            <div class="barra-header"><span>🔥 +1.5 Goles</span><span>${prob.s}%</span></div>
            <div class="barra-fondo"><div class="barra-progreso" style="width: 0%;" data-w="${prob.s}%"></div></div>
        </div>
        <div class="barra-container">
            <div class="barra-header"><span>🚩 +8.5 Córners</span><span>${prob.m}%</span></div>
            <div class="barra-fondo"><div class="barra-progreso" style="width: 0%; background:var(--oro);" data-w="${prob.m}%"></div></div>
        </div>
        <div class="barra-container">
            <div class="barra-header"><span>🟨 +4.5 Tarjetas</span><span>${prob.r}%</span></div>
            <div class="barra-fondo"><div class="barra-progreso" style="width: 0%; background:var(--alerta);" data-w="${prob.r}%"></div></div>
        </div>
    `;
    setTimeout(() => { document.querySelectorAll('.barra-progreso').forEach(b => b.style.width = b.getAttribute('data-w')); }, 100);
}

function cerrarDetalle() {
    document.getElementById('vista-detalle').classList.add('oculto');
    document.getElementById('vista-principal').classList.remove('oculto');
}

function abrirTab(evt, nombreTab) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('activo'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('activo'));
    document.getElementById(nombreTab).classList.add('activo');
    evt.currentTarget.classList.add('activo');
}

iniciarApp();
