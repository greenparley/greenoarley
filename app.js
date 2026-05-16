// ==========================================
// 1. CONFIGURACIÓN API-SPORTS
// ==========================================
// Tu llave real de API-Sports ya integrada para reactivar el sistema
const API_KEY = "0464d33c8013d01fb7387b5148f18a9a"; 

let baseDeDatosHoy = [];

// Filtros globales
let estadoFiltroActual = 'proximos'; 
let ligaRapidaActiva = null; 

// Códigos de estado de API-Sports
const estadosEnVivo = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'];
const estadosProximos = ['NS', 'TBD'];

// Motor de peticiones principal
async function fetchApiSports(endpoint) {
    const url = `https://v3.football.api-sports.io${endpoint}`;
    const options = { 
        method: 'GET', 
        headers: { 
            'x-apisports-key': API_KEY 
        } 
    };
    
    try {
        const respuesta = await fetch(url, options);
        const data = await respuesta.json();
        
        if (data.errors && data.errors.requests) {
            throw new Error("Límite de peticiones diarias agotado (100/100).");
        }
        if (data.errors && data.errors.token) {
            throw new Error("API Key inválida. Revisá que esté bien escrita.");
        }
        
        return data.response;
    } catch (e) {
        console.error("Error:", e);
        throw e;
    }
}

// ==========================================
// 2. INICIO Y BÚSQUEDA DE PARTIDOS
// ==========================================
async function iniciarApp() {
    try {
        // Pedimos TODOS los partidos del día de hoy
        const hoy = new Date().toISOString().split('T')[0];
        document.getElementById('contenedor-partidos').innerHTML = `<p style="color: var(--celeste-1xbet);">⏳ Descargando todos los partidos de hoy...</p>`;
        
        const partidos = await fetchApiSports(`/fixtures?date=${hoy}`);
        
        if (partidos && partidos.length > 0) {
            baseDeDatosHoy = partidos;
            cargarBuscadorLigas(baseDeDatosHoy);
            aplicarFiltrosMaster(); 
        } else {
            document.getElementById('contenedor-partidos').innerHTML = `<p style="margin-top:20px; color:var(--texto-gris)">No hay partidos registrados para el día de hoy.</p>`;
        }

    } catch (error) {
        document.getElementById('contenedor-partidos').innerHTML = `
            <div style="background:var(--tarjeta-bg); padding:20px; border-radius:10px; border:1px solid var(--alerta);">
                <h3 style="color:var(--alerta); margin-top:0;">⚠️ Error</h3>
                <p style="color:var(--texto-gris); font-size:0.9rem;">${error.message}</p>
                <button onclick="iniciarApp()" style="margin-top:10px; background:var(--azul-1xbet); color:white; border:none; padding:10px 15px; border-radius:5px; cursor:pointer;">Reintentar</button>
            </div>
        `;
    }
}

// ==========================================
// 3. FILTROS Y ACTUALIZACIÓN MANUAL
// ==========================================
function setFiltroEstado(estado) {
    estadoFiltroActual = estado;
    document.getElementById('btn-proximos').classList.toggle('activo', estado === 'proximos');
    document.getElementById('btn-envivo').classList.toggle('activo', estado === 'envivo');
    
    // El botón de actualizar solo aparece en la pestaña En Vivo
    const btnRefresh = document.getElementById('btn-refresh');
    if(estado === 'envivo') {
        btnRefresh.classList.remove('oculto');
    } else {
        btnRefresh.classList.add('oculto');
    }

    aplicarFiltrosMaster();
}

function toggleLigaRapida(idLiga, botonElem) {
    if (ligaRapidaActiva === idLiga) {
        ligaRapidaActiva = null;
        botonElem.classList.remove('activo');
    } else {
        document.querySelectorAll('.btn-rapido').forEach(b => b.classList.remove('activo'));
        ligaRapidaActiva = idLiga;
        botonElem.classList.add('activo');
        document.getElementById('filtro-ligas-input').value = '';
    }
    aplicarFiltrosMaster();
}

function aplicarFiltrosMaster() {
    let filtrados = baseDeDatosHoy;

    // 1. Filtrar por Estado (Proximos o En Vivo)
    if (estadoFiltroActual === 'proximos') {
        filtrados = filtrados.filter(p => estadosProximos.includes(p.fixture.status.short));
    } else if (estadoFiltroActual === 'envivo') {
        filtrados = filtrados.filter(p => estadosEnVivo.includes(p.fixture.status.short));
    }

    const divAccesos = document.getElementById('contenedor-accesos-rapidos');
    if (estadoFiltroActual === 'proximos') {
        divAccesos.classList.remove('oculto');
    } else {
        divAccesos.classList.add('oculto');
        ligaRapidaActiva = null;
        document.querySelectorAll('.btn-rapido').forEach(b => b.classList.remove('activo'));
    }

    // 2. Filtrar por texto o botón rápido
    if (ligaRapidaActiva !== null) {
        filtrados = filtrados.filter(p => p.league.id === ligaRapidaActiva);
    } else {
        const textoBuscado = document.getElementById('filtro-ligas-input').value.toLowerCase().trim();
        if (textoBuscado !== '') {
            filtrados = filtrados.filter(p => {
                const nomLiga = p.league.name.toLowerCase();
                const equipoL = p.teams.home.name.toLowerCase();
                const equipoV = p.teams.away.name.toLowerCase();
                return nomLiga.includes(textoBuscado) || equipoL.includes(textoBuscado) || equipoV.includes(textoBuscado);
            });
        }
    }

    if (filtrados.length > 0) {
        renderizarPartidos(filtrados);
    } else {
        let msg = estadoFiltroActual === 'envivo' ? "No hay partidos jugándose en este momento." : "No se encontraron partidos próximos bajo estos filtros.";
        document.getElementById('contenedor-partidos').innerHTML = `<p style="margin-top:20px; color:var(--texto-gris); padding:0 20px;">${msg}</p>`;
    }
}

function cargarBuscadorLigas(partidos) {
    const datalist = document.getElementById('lista-ligas');
    datalist.innerHTML = '';
    const ligasUnicas = [];
    partidos.forEach(p => {
        if(!ligasUnicas.find(l => l.id === p.league.id)) {
            ligasUnicas.push({id: p.league.id, name: p.league.name});
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
// 4. RENDERIZADO Y ACTUALIZACIÓN EN VIVO (MANUAL)
// ==========================================
function renderizarPartidos(partidos) {
    const contenedor = document.getElementById('contenedor-partidos');
    contenedor.innerHTML = '';

    partidos.forEach(p => {
        const isLive = estadosEnVivo.includes(p.fixture.status.short);
        
        // Formatear hora
        const fechaObj = new Date(p.fixture.date);
        const horaLocal = fechaObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
        
        // Goles
        const golesL = p.goals.home !== null ? p.goals.home : 0;
        const golesV = p.goals.away !== null ? p.goals.away : 0;

        const marcadorHTML = isLive 
            ? `<span style="font-size:0.7rem; color:var(--alerta);">${p.fixture.status.elapsed}'</span>
               <span id="goles-${p.fixture.id}-l">${golesL}</span><span id="goles-${p.fixture.id}-v">${golesV}</span>` 
            : `<span style="font-size:0.8rem; color:var(--texto-gris);">${horaLocal}</span>`;

        const escudoL = p.teams.home.logo;
        const escudoV = p.teams.away.logo;
        const nomL = p.teams.home.name;
        const nomV = p.teams.away.name;

        const prob = simularSemaforo(p.teams.home.id + p.teams.away.id);

        const tarjeta = `
            <div class="tarjeta-partido" onclick="abrirDetalle(${p.fixture.id}, ${p.teams.home.id}, ${p.teams.away.id}, '${nomL}', '${nomV}', '${escudoL}', '${escudoV}', '${p.fixture.status.short}', '${horaLocal}')">
                ${isLive ? '<div class="live-badge">EN VIVO</div>' : ''}
                <div class="encabezado-liga">
                    <span><img src="${p.league.flag || p.league.logo}" onerror="this.style.display='none'"> ${p.league.name}</span>
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

// ¡Función manual para no gastar créditos solos!
async function forzarActualizacionLive() {
    const btn = document.getElementById('btn-refresh');
    btn.innerText = "⏳ Actualizando..."; 
    btn.disabled = true;
    
    try {
        const hoy = new Date().toISOString().split('T')[0];
        const partidosRefresh = await fetchApiSports(`/fixtures?date=${hoy}`);
        
        if(partidosRefresh && partidosRefresh.length > 0) {
            baseDeDatosHoy = partidosRefresh;
            aplicarFiltrosMaster(); 
        }
    } catch (e) {
        alert("Hubo un problema al actualizar los datos.");
    }
    
    btn.innerText = "🔄 Actualizar (1 Crédito)";
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
