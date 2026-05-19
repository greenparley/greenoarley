// =========================================================================
// ⚙️ 1. DETECTORES UNIVERSALES (EL MOTOR DEL SISTEMA)
// =========================================================================

// Detector Universal de En Vivo (Soporta múltiples estructuras de API)
function verificarSiEsEnVivo(p) {
    if (verificarSiEstaFinalizado(p)) return false; // Si ya terminó, no está en vivo
    if (p.live === true || p.isLive === true) return true;
    if (p.status) {
        let estadoTexto = JSON.stringify(p.status).toLowerCase();
        if (
            estadoTexto.includes('live') || 
            estadoTexto.includes('inprogress') || 
            estadoTexto.includes('in_progress') || 
            estadoTexto.includes('started') ||
            estadoTexto.includes('playing')
        ) {
            return true;
        }
    }
    return false;
}

// Detector Universal de Partidos Finalizados
function verificarSiEstaFinalizado(p) {
    if (p.finished === true || p.isFinished === true || p.status?.type === 'finished') return true;
    if (p.status) {
        let estadoTexto = JSON.stringify(p.status).toLowerCase();
        if (
            estadoTexto.includes('finished') || 
            estadoTexto.includes('ft') || 
            estadoTexto.includes('ended') ||
            estadoTexto.includes('finalizado') ||
            estadoTexto.includes('concluded')
        ) {
            return true;
        }
    }
    return false;
}

// Validador de ventana de tiempo (Filtra partidos de las últimas 24 horas)
function pasoMenosDe24Horas(p) {
    let timestamp = p.timestamp || p.startTimestamp || p.fixture?.timestamp;
    if (timestamp) {
        if (timestamp < 10000000000) timestamp *= 1000; // Segundos a milisegundos
        const diferenciaHoras = (Date.now() - timestamp) / (1000 * 60 * 60);
        return diferenciaHoras >= 0 && diferenciaHoras <= 24;
    }
    
    let fechaStr = p.date || p.fixture?.date || p.fecha;
    if (fechaStr) {
        const fechaPartido = new Date(fechaStr);
        const diferenciaHoras = (Date.now() - fechaPartido.getTime()) / (1000 * 60 * 60);
        return diferenciaHoras >= 0 && diferenciaHoras <= 24;
    }
    return true; 
}


// =========================================================================
// 📱 2. RENDERIZADOR DE LA LISTA PRINCIPAL (CORREGIDO PARA ADMITIR EN VIVO)
// =========================================================================
function renderizarListaPrincipal() {
    // REVISAR: Asegurate de tener este ID en tu HTML para la lista general de partidos
    const contenedorLista = document.getElementById('contenedor-partidos-lista'); 
    if (!contenedorLista) return;
    contenedorLista.innerHTML = '';

    // Filtrar partidos activos: Pasan los que NO están finalizados y son del deporte actual
    let partidosParaApostar = partidosDisponibles.filter(p => {
        if (verificarSiEstaFinalizado(p)) return false; // Los terminados van a su propia sección

        if (deporteActivo === 'futbol' || deporteActivo === 'tenis') {
            if (verificarSiEsEnVivo(p)) return true; // Si está en vivo, pasa directo sin exigir cuota pre-match
            return p.cuotasReales && p.cuotasReales.local && p.cuotasReales.visita;
        }
        return true; 
    });

    if (partidosParaApostar.length === 0) {
        contenedorLista.innerHTML = `<div style="color: var(--texto-gris); text-align: center; padding: 20px;">No hay partidos disponibles para apostar en este momento.</div>`;
        return;
    }

    partidosParaApostar.forEach(p => {
        let nombreLocal = p.homeTeam?.name || p.local || "Local";
        let nombreVisita = p.awayTeam?.name || p.visita || "Visita";
        let esLive = verificarSiEsEnVivo(p);

        let infoCuotasHTML = '';
        if (esLive) {
            infoCuotasHTML = `<span style="color: #ff4d4d; font-weight: bold; font-size: 0.85rem; background: rgba(255,77,77,0.1); padding: 3px 8px; border-radius: 4px;">⚡ EN VIVO</span>`;
        } else {
            let cLocal = p.cuotasReales?.local || "1.85";
            let cVisita = p.cuotasReales?.visita || "1.85";
            infoCuotasHTML = `<span style="color: var(--texto-gris); font-size: 0.85rem;">L: ${cLocal} | V: ${cVisita}</span>`;
        }

        contenedorLista.innerHTML += `
            <div class="tarjeta-partido" onclick="abrirDetalle('${p.id || p.id_partido}')" style="background: rgba(255,255,255,0.03); margin-bottom: 8px; padding: 12px; border-radius: 6px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.05);">
                <span style="color: #fff; font-weight: 500;">${nombreLocal} vs ${nombreVisita}</span>
                <div>${infoCuotasHTML}</div>
            </div>
        `;
    });
}


// =========================================================================
// 📊 3. COMBINADAS DEL DÍA (MÁXIMA PROBABILIDAD - ANTI BATACAZOS)
// =========================================================================
function generarCombinadaDelDia() {
    const contenedor = document.getElementById('contenedor-combinadas');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    let partidosValidos = partidosDisponibles.filter(p => {
        if (verificarSiEstaFinalizado(p)) return false; 
        if (deporteActivo === 'futbol' || deporteActivo === 'tenis') {
            if (verificarSiEsEnVivo(p)) return true;
            return p.cuotasReales && p.cuotasReales.local && p.cuotasReales.visita;
        }
        return true; 
    });

    if (partidosValidos.length < 3) {
        contenedor.innerHTML = `<div class="alerta-error">Se necesitan al menos 3 partidos de ${deporteActivo.toUpperCase()} para armar las combinadas.</div>`;
        return;
    }

    const nivelesRiesgo = ['asegurada', 'moderada', 'premium'];

    nivelesRiesgo.forEach((riesgo, index) => {
        let partidosMezclados = [...partidosValidos].sort(() => 0.5 - Math.random());
        let seleccionados = partidosMezclados.slice(0, 3);

        let htmlTickets = '';
        let cuotaTotalCombinada = 1.00;
        let colorBorde = riesgo === 'asegurada' ? "var(--verde-principal)" : riesgo === 'moderada' ? "var(--oro)" : "#00b4d8";
        let badgeTexto = riesgo === 'asegurada' ? `🛡️ TRIPLE ULTRA ASEGURADA` : riesgo === 'moderada' ? `📊 TRIPLE ESTÁNDAR` : `💎 TRIPLE PREMIUM`;

        seleccionados.forEach(p => {
            let nombreLocal = p.homeTeam?.name || p.local || "Local";
            let nombreVisita = p.awayTeam?.name || p.visita || "Visita";
            
            let cLocal = p.cuotasReales?.local ? parseFloat(p.cuotasReales.local) : 1.85;
            let cVisita = p.cuotasReales?.visita ? parseFloat(p.cuotasReales.visita) : 1.85;
            
            let esFavLocal = cLocal <= cVisita;
            let cuotaFav = esFavLocal ? cLocal : cVisita;
            let nameFav = esFavLocal ? nombreLocal : nombreVisita;
            let hayFavoritoClaro = cuotaFav <= 1.65;

            let pickMercado = '';
            let pickCuota = 1.30;

            if (riesgo === 'asegurada') {
                if (deporteActivo === 'futbol') {
                    pickMercado = `Doble Oportunidad: Gana/Empata ${nameFav}`;
                    pickCuota = parseFloat(Math.max(1.15, Math.min(1.28, 1 + (cuotaFav - 1) * 0.35)).toFixed(2));
                } else if (deporteActivo === 'tenis') {
                    pickMercado = `Hándicap: ${nameFav} gana 1+ Set`; pickCuota = 1.18;
                } else {
                    pickMercado = `Total Puntos: Más de 204.5 Puntos`; pickCuota = 1.22;
                }
            } else if (riesgo === 'moderada') {
                if (deporteActivo === 'futbol') {
                    pickMercado = hayFavoritoClaro ? `Ganador Directo: Gana ${nameFav}` : `Total Goles: Más de 1.5`;
                    pickCuota = hayFavoritoClaro ? cuotaFav : 1.35;
                } else if (deporteActivo === 'tenis') {
                    pickMercado = hayFavoritoClaro ? `Gana el Partido: ${nameFav}` : `Games Totales: Más de 19.5`;
                    pickCuota = hayFavoritoClaro ? cuotaFav : 1.38;
                } else {
                    pickMercado = `Total Puntos: Más de 211.5`; pickCuota = 1.45;
                }
            } else {
                if (deporteActivo === 'futbol') {
                    pickMercado = hayFavoritoClaro ? `Gana ${nameFav} y Más de 1.5 Goles` : `Gana/Empata ${nameFav} y Más de 1.5`;
                    pickCuota = hayFavoritoClaro ? parseFloat((cuotaFav * 1.25).toFixed(2)) : 1.65;
                } else if (deporteActivo === 'tenis') {
                    pickMercado = hayFavoritoClaro ? `Gana ${nameFav} y Menos de 24.5 Games` : `Games Totales: Más de 21.5`;
                    pickCuota = hayFavoritoClaro ? parseFloat((cuotaFav * 1.20).toFixed(2)) : 1.70;
                } else {
                    pickMercado = `Total Puntos: Más de 217.5`; pickCuota = 1.75;
                }
            }

            if (pickCuota > 1.85) pickCuota = 1.75;
            cuotaTotalCombinada *= pickCuota;

            htmlTickets += `
                <div class="item-combinada" style="margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.03);">
                    <div style="font-size: 0.85rem; color: var(--texto-gris);">${nombreLocal} vs ${nombreVisita}</div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-top: 2px;">
                        <span style="color: #fff;">📌 ${pickMercado}</span>
                        <span style="color: var(--oro); font-weight: bold;">x${pickCuota.toFixed(2)}</span>
                    </div>
                </div>
            `;
        });

        const tarjetaTicket = document.createElement('div');
        tarjetaTicket.className = 'tarjeta-combinada-completa';
        tarjetaTicket.style.cssText = `background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-top: 4px solid ${colorBorde}; border-radius: 6px; padding: 15px; margin-bottom: 15px;`;

        tarjetaTicket.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="font-size: 0.75rem; font-weight: bold; color: ${colorBorde}; background: ${colorBorde}15; padding: 4px 8px; border-radius: 4px;">${badgeTexto}</span>
                <div style="text-align: right;">
                    <span style="font-size: 0.7rem; color: var(--texto-gris); display: block;">CUOTA TOTAL</span>
                    <span style="font-size: 1.3rem; font-weight: bold; color: ${colorBorde}">x${cuotaTotalCombinada.toFixed(2)}</span>
                </div>
            </div>
            <div>${htmlTickets}</div>
            <button style="width: 100%; margin-top: 10px; background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); padding: 8px; border-radius: 4px; cursor: pointer;" onclick="copiarTicketAlPortapapeles('${badgeTexto}', ${cuotaTotalCombinada.toFixed(2)})">
                📋 Copiar Jugada Combinada
            </button>
        `;
        contenedor.appendChild(tarjetaTicket);
    });
}


// =========================================================================
// 🔍 4. PANEL DE MERCADOS (ABRIR DETALLE CON EN VIVO INCORPORADO)
// =========================================================================
function abrirDetalle(partidoId) {
    let p = partidosDisponibles.find(item => (item.id == partidoId || item.id_partido == partidoId));
    if (!p) return;

    const contenedorMercados = document.getElementById('contenedor-mercados');
    if (!contenedorMercados) return;

    let htmlMercados = '';

    // LÓGICA FÚTBOL
    if (deporteActivo === 'futbol') {
        let nombreL = p.homeTeam?.name || p.local || "Local";
        let nombreV = p.awayTeam?.name || p.visita || "Visita";
        let cLocal = p.cuotasReales?.local ? parseFloat(p.cuotasReales.local) : 1.90;
        let cVisita = p.cuotasReales?.visita ? parseFloat(p.cuotasReales.visita) : 2.10;

        htmlMercados += `<div class="bloque-mercado"><h3>🎯 GANADOR DEL PARTIDO</h3>
            <div>Gana ${nombreL} (x${cLocal})</div><div>Gana ${nombreV} (x${cVisita})</div></div>`;
    } 
    // LÓGICA TENIS (LIVE CONTROLADO)
    else if (deporteActivo === 'tenis') {
        let esEnVivo = verificarSiEsEnVivo(p);
        let nombreL = p.homeTeam?.name || p.local || "Jugador 1";
        let nombreV = p.awayTeam?.name || p.visita || "Jugador 2";

        if (esEnVivo) {
            let marcadorL = p.homeScore?.current !== undefined ? p.homeScore.current : "-";
            let marcadorV = p.awayScore?.current !== undefined ? p.awayScore.current : "-";
            let puntosL = p.homeScore?.point !== undefined ? p.homeScore.point : "";
            let puntosV = p.awayScore?.point !== undefined ? p.awayScore.point : "";
            let sacaL = p.homeScore?.serving ? "🎾 " : "";
            let sacaV = p.awayScore?.serving ? "🎾 " : "";

            htmlMercados += `
                <div class="bloque-marcador-vivo" style="background: rgba(0,0,0,0.25); padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #00b4d8;">
                    <div style="font-size: 0.8rem; color: #00b4d8; font-weight: bold; margin-bottom: 8px; text-transform: uppercase;">⚡ Marcador En Vivo (Tenis)</div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color:#fff;">
                        <span>${sacaL}${nombreL}</span>
                        <span style="font-weight: bold; color: var(--oro);">${marcadorL} <small style="color:#aaa;">(${puntosL})</small></span>
                    </div>
                    <div style="display: flex; justify-content: space-between; color:#fff;">
                        <span>${sacaV}${nombreV}</span>
                        <span style="font-weight: bold; color: var(--oro);">${marcadorV} <small style="color:#aaa;">(${puntosV})</small></span>
                    </div>
                </div>
                <div class="bloque-mercado"><h3>🎯 MERCADO EN VIVO: GANADOR DEL SET</h3>
                    <div>${nombreL} gana el Set actual</div><div>${nombreV} gana el Set actual</div></div>
            `;
        } else {
            let cLocal = p.cuotasReales?.local ? parseFloat(p.cuotasReales.local) : 1.85;
            let cVisita = p.cuotasReales?.visita ? parseFloat(p.cuotasReales.visita) : 1.85;
            htmlMercados += `<div class="bloque-mercado"><h3>🎯 GANADOR DEL PARTIDO (H2H)</h3>
                <div>Gana ${nombreL} (x${cLocal})</div><div>Gana ${nombreV} (x${cVisita})</div></div>`;
        }
    } 
    // LÓGICA BÁSQUET
    else {
        let nombreL = p.local || "Equipo Local";
        let nombreV = p.visita || "Equipo Visitante";
        htmlMercados += `<div class="bloque-mercado"><h3>🎯 GANADOR DEL PARTIDO</h3>
            <div>Gana ${nombreL} (x1.85)</div><div>Gana ${nombreV} (x1.85)</div></div>`;
    }

    contenedorMercados.innerHTML = htmlMercados;
}


// =========================================================================
// 🏁 5. APARTADO DE HISTORIAL (PARTIDOS FINALIZADOS CONGELADOS POR 24HS)
// =========================================================================
function mostrarPartidosFinalizados() {
    // REVISAR: Recordá agregar un <div id="contenedor-finalizados"></div> en tu HTML
    const contenedor = document.getElementById('contenedor-finalizados');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    // Filtrar partidos del deporte seleccionado que terminaron hace menos de 24 horas
    let finalizados = partidosDisponibles.filter(p => {
        let esDeporteActivo = false;
        if (deporteActivo === 'futbol' && (p.golesLocal !== undefined || p.deporte === 'futbol' || p.league?.sport === 'football')) esDeporteActivo = true;
        if (deporteActivo === 'tenis' && (p.homeScore?.point !== undefined || p.deporte === 'tenis' || p.league?.sport === 'tennis')) esDeporteActivo = true;
        if (deporteActivo === 'basquet' && (p.puntosLocal !== undefined || p.deporte === 'basquet' || p.league?.sport === 'basketball')) esDeporteActivo = true;
        
        if (!p.deporte) esDeporteActivo = true; // Fallback integrador

        return esDeporteActivo && verificarSiEstaFinalizado(p) && pasoMenosDe24Horas(p);
    });

    if (finalizados.length === 0) {
        contenedor.innerHTML = `<div style="color: var(--texto-gris); text-align: center; padding: 20px; font-size: 0.85rem;">No hay resultados disponibles de ${deporteActivo.toUpperCase()} en las últimas 24 horas.</div>`;
        return;
    }

    finalizados.forEach(p => {
        let nombreLocal = p.homeTeam?.name || p.local || "Local";
        let nombreVisita = p.awayTeam?.name || p.visita || "Visita";
        let resultadoL = "-";
        let resultadoV = "-";

        if (p.homeScore?.display !== undefined) {
            resultadoL = p.homeScore.display;
            resultadoV = p.awayScore?.display;
        } else {
            resultadoL = p.golesLocal ?? p.puntosLocal ?? p.scoreLocal ?? "-";
            resultadoV = p.golesVisita ?? p.puntosVisita ?? p.scoreVisita ?? "-";
        }

        contenedor.innerHTML += `
            <div class="tarjeta-finalizado" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); padding: 12px; margin-bottom: 8px; border-radius: 6px; border-left: 4px solid #6c757d;">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; color: #e0e0e0; font-size: 0.9rem;">
                        <span>${nombreLocal}</span>
                        <span style="font-weight: bold; color: var(--oro);">${resultadoL}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; color: #e0e0e0; font-size: 0.9rem;">
                        <span>${nombreVisita}</span>
                        <span style="font-weight: bold; color: var(--oro);">${resultadoV}</span>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.03); padding-top: 4px; font-size: 0.7rem; color: var(--texto-gris);">
                    <span>🏁 PARTIDO CONCLUIDO</span>
                    <span>Historial 24hs</span>
                </div>
            </div>
        `;
    });
}


// =========================================================================
// 🔄 6. ORQUESTADOR CENTRAL DE ACTUALIZACIÓN
// =========================================================================
// Ejecutá esta función SIEMPRE que cargues datos nuevos de la API o cambies de pestaña de deporte
function actualizarTodaLaInterfaz() {
    renderizarListaPrincipal();    // Actualiza la grilla general para apostar
    generarCombinadaDelDia();     // Recalcula las tarjetas triples anti-batacazos
    mostrarPartidosFinalizados(); // Actualiza la pizarra de resultados históricos
}
