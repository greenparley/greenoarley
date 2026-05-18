const API_KEYS = [
    "0464d33c8013d01fb7387b5148f18a9a", 
    "31dc5f2762254847a825e1025257a759"
];

let baseDeDatosHoy = [];
let estadoFiltroActual = 'proximos';
let deporteActivo = 'futbol'; 

const estadosEnVivoFutbol = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'];
const estadosEnVivoBasket = ['Q1', 'Q2', 'Q3', 'Q4', 'OT', 'BT', 'HT', 'LIVE', 'IN_PLAY'];
const ESCUDO_RESPALDO = "https://cdn-icons-png.flaticon.com/512/53/53283.png";

const LIGAS_TOP_FUTBOL = [1, 2, 3, 4, 9, 13, 11, 12, 39, 140, 135, 78, 61, 128, 130, 129, 131, 71, 73];
const LIGAS_TOP_BASKET = [12, 116, 117, 120, 134]; 

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

async function fetchConRotacion(url) {
    for (let i = 0; i < API_KEYS.length; i++) {
        try {
            const res = await fetch(url, { headers: { 'x-apisports-key': API_KEYS[i] } });
            const data = await res.json();
            if (!data.errors || data.errors.length === 0 || !data.errors.rateLimit) return data;
            console.warn(`Key ${i + 1} agotada.`);
        } catch (e) { console.warn(`Error de red con Key ${i + 1}.`); }
    }
    return null; 
}

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
    
    const limInf = ahora.getTime() - (4 * 60 * 60 * 1000);
    const limSup = ahora.getTime() + (24 * 60 * 60 * 1000);

    return todosLosEventos.filter(p => {
        const tiempo = new Date(p.fixture.date).getTime();
        return tiempo >= limInf && tiempo <= limSup;
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
    
    const limInf = ahora.getTime() - (4 * 60 * 60 * 1000);
    const limSup = ahora.getTime() + (24 * 60 * 60 * 1000);

    return todosLosEventos.filter(p => {
        const tiempo = new Date(p.date).getTime();
        return tiempo >= limInf && tiempo <= limSup;
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
    if(!contenedor) return;
    contenedor.innerHTML = `
        <div id="lobby-selector">
            <div class="tarjeta-deporte" onclick="irADeporte('futbol')">
                <img src="https://images.unsplash.com/photo-1579952363873-27f3bade9f55?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Fútbol">
                <h3>Fútbol</h3>
            </div>
            <div class="tarjeta-deporte" onclick="irADeporte('basquet')">
                <img src="image_6d04d2.png" onerror="this.src='https://images.unsplash.com/photo-1546519638-68e109498ffc?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'" alt="Básquet">
                <h3>Básquet</h3>
            </div>
        </div>
    `;
}

async function irADeporte(deporte) {
    deporteActivo = deporte;
    const contenedor = document.getElementById('contenedor-partidos');
    contenedor.innerHTML = `<p style="color: var(--verde-principal); padding:20px; text-align: center;">⏳ Cargando ${deporte.toUpperCase()}...</p>`;
    
    try {
        if (deporte === 'futbol') {
            const todos = await fetchPartidosFutbol();
            let filtrados = todos.filter(p => LIGAS_TOP_FUTBOL.includes(p.competition.id));
            baseDeDatosHoy = filtrados.length > 0 ? filtrados : todos.slice(0, 30); 
        } else if (deporte === 'basquet') {
            const todos = await fetchPartidosBasquet();
            let filtrados = todos.filter(p => LIGAS_TOP_BASKET.includes(p.competition.id));
            baseDeDatosHoy = filtrados.length > 0 ? filtrados : todos.slice(0, 30);
        }
        aplicarFiltrosMaster();
    } catch(e) {
        console.error(e);
        contenedor.innerHTML = `<p style="color:var(--alerta); text-align:center;">Error conectando a la API. Revisá la consola.</p>`;
    }
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
    
    let imagenDeporte = deporteActivo === 'futbol' ? 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' : 'https://images.unsplash.com/photo-1546519638-68e109498ffc?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
    
    cont.innerHTML += `
        <div class="tarjeta-partido" onclick="volverAlLobby()" style="cursor: pointer; text-align: center; background: none; border: none; box-shadow: none;">
            <img src="${imagenDeporte}" style="width: 100%; height:120px; object-fit:cover; border-radius: 8px; border: 2px solid var(--verde-principal);">
            <h3 style="margin-top: 10px; color: white;">← Volver al Menú de Deportes</h3>
        </div>
    `;

    if (partidos.length === 0) { 
        cont.innerHTML += `<p style="padding:20px; text-align:center;">No hay eventos disponibles.</p>`; 
        return; 
    }

    partidos.forEach(p => {
        const esLive = (deporteActivo === 'futbol' ? estadosEnVivoFutbol : estadosEnVivoBasket).includes(p.status);
        const marcador = esLive ? `<div class="live-badge">LIVE</div> <span style="color:var(--alerta)">${p.score?.fullTime?.home ?? 0} - ${p.score?.fullTime?.away ?? 0}</span>` : `<span>PREVIA</span>`;
        
        cont.innerHTML += `
            <div class="tarjeta-partido" onclick="alert('Detalle de ${p.homeTeam.name} vs ${p.awayTeam.name}')">
                <div class="encabezado-liga"><img src="${p.competition.emblem}" style="max-height:15px; margin-right:5px;" onerror="this.style.display='none'"> ${p.competition.name}</div>
                <div class="cuerpo-partido">
                    <div class="equipos">
                        <div class="equipo-linea"><img src="${p.homeTeam.crest || ESCUDO_RESPALDO}" style="max-height:20px; margin-right:8px;" onerror="this.src='${ESCUDO_RESPALDO}'"> ${p.homeTeam.name}</div>
                        <div class="equipo-linea"><img src="${p.awayTeam.crest || ESCUDO_RESPALDO}" style="max-height:20px; margin-right:8px;" onerror="this.src='${ESCUDO_RESPALDO}'"> ${p.awayTeam.name}</div>
                    </div>
                    <div class="marcador-live">${marcador}</div>
                </div>
            </div>`;
    });
}

function volverAlLobby() { 
    baseDeDatosHoy = []; 
    renderizarLobby(); 
}

window.onload = () => { 
    renderizarLobby(); 
};
