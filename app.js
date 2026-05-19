// =========================================================================
// 🛠️ DETECTORES UNIVERSALES (EN VIVO, FINALIZADOS Y TIEMPO)
// =========================================================================

// 1. Detector de En Vivo (Cubre casi cualquier estructura de API)
function verificarSiEsEnVivo(p) {
    // Si ya está marcado como finalizado, no puede estar en vivo
    if (verificarSiEstaFinalizado(p)) return false;
    
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

// 2. Detector de Partidos Finalizados
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

// 3. Validador de ventana de tiempo (Menos de 24 horas desde que terminó/empezó)
function pasoMenosDe24Horas(p) {
    let timestamp = p.timestamp || p.startTimestamp || p.fixture?.timestamp;
    if (timestamp) {
        if (timestamp < 10000000000) timestamp *= 1000; // Ajuste de segundos a milisegundos
        const diferenciaHoras = (Date.now() - timestamp) / (1000 * 60 * 60);
        return diferenciaHoras >= 0 && diferenciaHoras <= 24;
    }
    
    let fechaStr = p.date || p.fixture?.date || p.fecha;
    if (fechaStr) {
        const fechaPartido = new Date(fechaStr);
        const diferenciaHoras = (Date.now() - fechaPartido.getTime()) / (1000 * 60 * 60);
        return diferenciaHoras >= 0 && diferenciaHoras <= 24;
    }
    
    return true; // Si la API no da fecha, lo dejamos por seguridad
}


// =========================================================================
// 📊 1. COMBINADAS DEL DÍA (MÁXIMA PROBABILIDAD - SIN BATACAZOS)
// =========================================================================
function generarCombinadaDelDia() {
    const contenedor = document.getElementById('contenedor-combinadas');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    // Filtrar partidos activos (Excluye finalizados, incluye vivos o pre-match con cuotas)
    let partidosValidos = partidosDisponibles.filter(p => {
        if (verificarSiEstaFinalizado(p)) return false; // Los terminados NO entran a combinadas

        if (deporteActivo === 'futbol' || deporteActivo === 'tenis') {
            let esEnVivo = verificarSiEsEnVivo(p);
            if (esEnVivo) return true;
            return p.cuotasReales && p.cuotasReales.local && p.cuotasReales.visita;
        }
        return true; 
    });

    if (partidosValidos.length < 3) {
        contenedor.innerHTML = `<div class="alerta-error">Se necesitan al menos 3 partidos de ${deporteActivo.toUpperCase()} disponibles para armar las combinadas.</div>`;
        return;
    }

    const nivelesRiesgo = ['asegurada', 'moderada', 'premium'];

    nivelesRiesgo.forEach((riesgo, index) => {
        let partidosMezclados = [...partidosValidos].sort(() => 0.5 - Math.random());
        let seleccionados = partidosMezclados.slice(0, 3);

        let htmlTickets = '';
        let cuotaTotalCombinada = 1.00;
        let colorBorde = '';
        let badgeTexto = '';

        if (riesgo === 'asegurada') {
            colorBorde = "var(--verde-principal)";
            badgeTexto = `🛡️ TRIPLE ULTRA ASEGURADA (Opción ${index + 1})`;
        } else if (riesgo === 'moderada') {
            colorBorde = "var(--oro)";
            badgeTexto = `📊 TRIPLE ESTÁNDAR / PROBABLE (Opción ${index + 1})`;
        } else {
            colorBorde = "#00b4d8"; 
            badgeTexto = `💎 TRIPLE PREMIUM / VALOR LÓGICO (Opción ${index + 1})`;
        }

        seleccionados.forEach(p => {
            let nombreLocal = p.homeTeam?.name || p.local || "Local";
            let nombreVisita = p.awayTeam?.name || p.visita || "Visita";
            
            let cLocal = p.cuotasReales?.local ? parseFloat(p.cuotasReales.local) : 1.85;
            let cVisita = p.cuotasReales?.visita ? parseFloat(p.cuotasReales.visita) : 1.85;
            
            let esFavLocal = cLocal <= cVisita;
            let cuotaFav = esFavLocal ? cLocal : cVisita;
            let nameFav = esFavLocal ? nombreLocal : nombreVisita;

            let hayFavoritoClaro = cuotaFav <= 1.65; // REGLA ANTI-BATACAZOS

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
            } 
            
            else if (riesgo === 'moderada') {
                if (deporteActivo === 'futbol') {
                    if (hayFavoritoClaro) {
                        pickMercado = `Ganador Directo: Gana ${nameFav}`; pickCuota = cuotaFav;
                    } else {
                        pickMercado = `Total de Goles: Más de 1.5 Goles`; pickCuota = 1.35; 
                    }
                } else if (deporteActivo === 'tenis') {
                    if (hayFavoritoClaro) {
                        pickMercado = `Gana el Partido: ${nameFav}`; pickCuota = cuotaFav;
                    } else {
                        pickMercado = `Games Totales: Más de 19.5 Games`; pickCuota = 1.38;
                    }
                } else {
                    pickMercado = `Total Puntos: Más de 211.5 Puntos`; pickCuota = 1.45;
                }
            } 
            
            else if (riesgo === 'premium') {
                if (deporteActivo === 'futbol') {
                    if (hayFavoritoClaro) {
                        pickMercado = `Gana ${nameFav} y Más de 1.5 Goles`; 
                        pickCuota = parseFloat((cuotaFav * 1.25).toFixed(2)); 
                    } else {
                        pickMercado = `Doble Oportunidad: Gana/Empata ${nameFav} y Más de 1.5 Goles`;
                        pickCuota = 1.65;
                    }
                } else if (deporteActivo === 'tenis') {
                    if (hayFavoritoClaro) {
                        pickMercado = `Gana ${nameFav} y Menos de 24.5 Games`; 
                        pickCuota = parseFloat((cuotaFav * 1.20).toFixed(2));
                    } else {
                        pickMercado = `Games Totales: Más de 21.5 Games`; pickCuota = 1.70;
                    }
                } else {
                    pickMercado = `Total Puntos: Más de 217.5 Puntos`; pickCuota = 1.75;
                }
            }

            if (pickCuota > 1.85) pickCuota = 1.75; // Cap de seguridad
            cuotaTotalCombinada *= pickCuota;

            htmlTickets += `
                <div class="item-combinada">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span class="partido-nombres">${nombreLocal} vs ${nombreVisita}</span>
                    </div>
                    <div class="pick-seleccionado">
                        <span>📌 ${pickMercado}</span>
                        <span class="cuota-tag">x${pickCuota.toFixed(2)}</span>
                    </div>
                </div>
            `;
        });

        const tarjetaTicket = document.createElement('div');
        tarjetaTicket.className = 'tarjeta-combinada-completa';
        tarjetaTicket.style.borderTop = `4px solid ${colorBorde}`;

        tarjetaTicket.innerHTML = `
            <div class="header-combinada">
                <span class="badge-riesgo" style="background: ${colorBorde}15; color: ${colorBorde}; border: 1px solid ${colorBorde}35;">${badgeTexto}</span>
                <div class="cuota-final-container">
                    <span style="font-size: 0.85rem; color: var(--texto-gris);">CUOTA RECOMENDADA</span>
                    <span class="cuota-total-gigante" style="color: ${colorBorde}">x${cuotaTotalCombinada.toFixed(2)}</span>
                </div>
            </div>
            <div class="cuerpo-combinada">${htmlTickets}</div>
            <button class="btn-copiar-ticket" onclick="copiarTicketAlPortapapeles('${badgeTexto}', ${cuotaTotalCombinada.toFixed(2)})">
                📋 Copiar Jugada Combinada
            </button>
        `;
        contenedor.appendChild(tarjetaTicket);
    });
}

// =========================================================================
// 🔍 2. PANEL DE DETALLE Y MERCADOS (CON VIVO TOTALMENTE SEGURO)
// =========================================================================
function abrirDetalle(partidoId) {
    let p = partidosDisponibles.find(item => (item.id == partidoId || item.id_partido == partidoId));
    if (!p) return;

    const contenedorMercados = document.getElementById('contenedor-mercados');
    if (!contenedorMercados) return;

    let htmlMercados = '';

    // ---------------- FÚTBOL ----------------
    if (deporteActivo === 'futbol') {
        let nombreL = p.homeTeam?.name || p.local || "Local";
        let nombreV = p.awayTeam?.name || p.visita || "Visita";
        let cLocal = p.cuotasReales?.local ? parseFloat(p.cuotasReales.local) : 1.90;
        let cVisita = p.cuotasReales?.visita ? parseFloat(p.cuotasReales.visita) : 2.10;

        htmlMercados += `<div class="bloque-mercado"><div class="titulo-mercado">🎯 GANADOR DEL PARTIDO (1X2)</div>
            <div class="barra-container"><span>Gana ${nombreL} (x${cLocal})</span></div>
            <div class="barra-container"><span>Gana ${nombreV} (x${cVisita})</span></div></div>`;
    } 
    
    // ---------------- TENIS ----------------
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
                    <div style="font-size: 0.8rem; color: #00b4d8; font-weight: bold; margin-bottom: 8px; text-transform: uppercase;">⚡ Marcador En Vivo en Directo</div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="font-weight: 500;">${sacaL}${nombreL}</span>
                        <span style="font-weight: bold; color: var(--oro);">${marcadorL} <small style="color:#fff; margin-left:4px;">(${puntosL})</small></span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 500;">${sacaV}${nombreV}</span>
                        <span style="font-weight: bold; color: var(--oro);">${marcadorV} <small style="color:#fff; margin-left:4px;">(${puntosV})</small></span>
                    </div>
                </div>
            `;

            htmlMercados += `
                <div class="bloque-mercado"><div class="titulo-mercado">🎯 GANADOR DEL SET EN JUEGO</div>
                    <div class="barra-container"><div><span>${nombreL} gana el Set</span></div></div>
                    <div class="barra-container"><div><span>${nombreV} gana el Set</span></div></div>
                </div>
            `;
        } else {
            let cLocal = p.cuotasReales?.local ? parseFloat(p.cuotasReales.local) : 1.85;
            let cVisita = p.cuotasReales?.visita ? parseFloat(p.cuotasReales.visita) : 1.85;
            htmlMercados += `<div class="bloque-mercado"><div class="titulo-mercado">🎯 GANADOR DEL PARTIDO (H2H)</div>
                <div class="barra-container"><span>Gana ${nombreL} (x${cLocal})</span></div>
                <div class="barra-container"><span>Gana ${nombreV} (x${cVisita})</span></div></div>`;
        }
    } 
    
    // ---------------- BÁSQUET ----------------
    else {
        let nombreL = p.local || "Equipo Local";
        let nombreV = p.visita || "Equipo Visitante";
        htmlMercados += `<div class="bloque-mercado"><div class="titulo-mercado">🎯 GANADOR DEL PARTIDO (H2H)</div>
            <div class="barra-container"><span>Gana ${nombreL} (x1.85)</span></div>
            <div class="barra-container"><span>Gana ${nombreV} (x1.85)</span></div></div>`;
    }

    contenedorMercados.innerHTML = htmlMercados;
}

// =========================================================================
// 🏁 3. SECCIÓN HISTORIAL DE PARTIDOS FINALIZADOS (CONGELADOS POR 24HS)
// =========================================================================
function mostrarPartidosFinalizados() {
    const contenedor = document.getElementById('contenedor-finalizados');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    // Filtrar los que pertenecen al deporte activo, están cerrados y llevan menos de 24 horas
    let finalizados = partidosDisponibles.filter(p => {
        let esDeporteActivo = false;
        if (deporteActivo === 'futbol' && (p.golesLocal !== undefined || p.deporte === 'futbol' || p.league?.sport === 'football')) esDeporteActivo = true;
        if (deporteActivo === 'tenis' && (p.homeScore?.point !== undefined || p.deporte === 'tenis' || p.league?.sport === 'tennis')) esDeporteActivo = true;
        if (deporteActivo === 'basquet' && (p.puntosLocal !== undefined || p.deporte === 'basquet' || p.league?.sport === 'basketball')) esDeporteActivo = true;
        
        if (!p.deporte) esDeporteActivo = true; // Fallback por si no viene tipado

        return esDeporteActivo && verificarSiEstaFinalizado(p) && pasoMenosDe24Horas(p);
    });

    if (finalizados.length === 0) {
        contenedor.innerHTML = `<div style="color: var(--texto-gris); text-align: center; padding: 25px; font-size: 0.85rem;">No hay resultados recientes de ${deporteActivo.toUpperCase()} en las últimas 24 horas.</div>`;
        return;
    }

    finalizados.forEach(p => {
        let nombreLocal = p.homeTeam?.name || p.local || "Local";
        let nombreVisita = p.awayTeam?.name || p.visita || "Visita";
        
        let resultadoL = "-";
        let resultadoV = "-";

        // Extraer score definitivo según la API
        if (p.homeScore?.display !== undefined) {
            resultadoL = p.homeScore.display;
            resultadoV = p.awayScore?.display;
        } else {
            resultadoL = p.golesLocal ?? p.puntosLocal ?? p.scoreLocal ?? "-";
            resultadoV = p.golesVisita ?? p.puntosVisita ?? p.scoreVisita ?? "-";
        }

        contenedor.innerHTML += `
            <div class="tarjeta-finalizado" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); padding: 12px; margin-bottom: 8px; border-radius: 8px; border-left: 4px solid #6c757d;">
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #e0e0e0; font-size: 0.9rem;">${nombreLocal}</span>
                        <span style="font-weight: 700; color: var(--oro); font-size: 1rem;">${resultadoL}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #e0e0e0; font-size: 0.9rem;">${nombreVisita}</span>
                        <span style="font-weight: 700; color: var(--oro); font-size: 1rem;">${resultadoV}</span>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 5px; font-size: 0.7rem; color: var(--texto-gris);">
                    <span>🏁 FINALIZADO</span>
                    <span>Historial (24hs)</span>
                </div>
            </div>
        `;
    });
}
