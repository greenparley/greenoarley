function generarCombinadaDelDia() {
    const contenedor = document.getElementById('contenedor-combinadas');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    // Filtrar partidos del deporte activo que tengan cuotas válidas
    let partidosValidos = partidosDisponibles.filter(p => {
        if (deporteActivo === 'futbol' || deporteActivo === 'tenis') {
            return p.cuotasReales && p.cuotasReales.local && p.cuotasReales.visita;
        }
        return true; // Básquet usa simulación
    });

    if (partidosValidos.length < 3) {
        contenedor.innerHTML = `<div class="alerta-error">Se necesitan al menos 3 partidos de ${deporteActivo.toUpperCase()} para armar las combinadas.</div>`;
        return;
    }

    // Definir los 3 niveles de riesgo que vamos a mostrar
    const nivelesRiesgo = ['asegurada', 'moderada', 'arriesgada'];

    nivelesRiesgo.forEach((riesgo, index) => {
        // Mezclamos los partidos para que cada tarjeta tenga eventos distintos
        let partidosMezclados = [...partidosValidos].sort(() => 0.5 - Math.random());
        let seleccionados = partidosMezclados.slice(0, 3);

        let htmlTickets = '';
        let cuotaTotalCombinada = 1.00;
        let colorBorde = '';
        let badgeTexto = '';

        // Configuración estética según el riesgo
        if (riesgo === 'asegurada') {
            colorBorde = "var(--verde-principal)";
            badgeTexto = `🛡️ TRIPLE ASEGURADA (Opción ${index + 1})`;
        } else if (riesgo === 'moderada') {
            colorBorde = "var(--oro)";
            badgeTexto = `📊 TRIPLE MODERADA (Opción ${index + 1})`;
        } else {
            colorBorde = "var(--alerta)";
            badgeTexto = `🔥 TRIPLE VALUE / ARRIESGADA (Opción ${index + 1})`;
        }

        // Procesar cada uno de los 3 partidos del ticket
        seleccionados.forEach(p => {
            let nombreLocal = p.homeTeam?.name || p.local || "Local";
            let nombreVisita = p.awayTeam?.name || p.visita || "Visita";
            
            // Tomar cuotas de la API o simularlas si es básquet
            let cLocal = p.cuotasReales?.local ? parseFloat(p.cuotasReales.local) : 1.85;
            let cVisita = p.cuotasReales?.visita ? parseFloat(p.cuotasReales.visita) : 1.85;
            
            let probL = Math.round((1 / cLocal) * 100);
            let probV = Math.round((1 / cVisita) * 100);

            let pickMercado = '';
            let pickCuota = 1.50;

            // =================================================================
            // LÓGICA DE SELECCIÓN DE PICKS SEGÚN EL RIESGO
            // =================================================================
            
            if (riesgo === 'asegurada') {
                // Cuotas bajas y muy probables (1.20 a 1.45)
                if (deporteActivo === 'futbol') {
                    if (cLocal < cVisita) {
                        pickMercado = `Doble Oportunidad: Gana o Empata ${nombreLocal}`;
                        pickCuota = parseFloat((cLocal * 0.75).toFixed(2));
                    } else {
                        pickMercado = `Doble Oportunidad: Gana o Empata ${nombreVisita}`;
                        pickCuota = parseFloat((cVisita * 0.75).toFixed(2));
                    }
                    if (pickCuota < 1.20) pickCuota = 1.25;
                } else if (deporteActivo === 'tenis') {
                    // Ganador directo del ultra favorito
                    if (cLocal < cVisita) {
                        pickMercado = `Ganador: ${nombreLocal}`; pickCuota = cLocal;
                    } else {
                        pickMercado = `Ganador: ${nombreVisita}`; pickCuota = cVisita;
                    }
                } else {
                    pickMercado = `Total Puntos: Más de 205.5 Puntos`; pickCuota = 1.35;
                }
            } 
            
            else if (riesgo === 'moderada') {
                // Cuotas estándar/favoritos (1.45 a 1.75)
                if (deporteActivo === 'futbol') {
                    if (cLocal < cVisita && cLocal > 1.40) {
                        pickMercado = `Ganador Directo: Gana ${nombreLocal}`; pickCuota = cLocal;
                    } else if (cVisita < cLocal && cVisita > 1.40) {
                        pickMercado = `Ganador Directo: Gana ${nombreVisita}`; pickCuota = cVisita;
                    } else {
                        pickMercado = `Línea de Goles: Más de 1.5 Goles`; pickCuota = 1.45;
                    }
                } else if (deporteActivo === 'tenis') {
                    if (cLocal < cVisita) {
                        pickMercado = `Hándicap de Sets: ${nombreLocal} +1.5 Sets`; pickCuota = 1.40;
                    } else {
                        pickMercado = `Hándicap de Sets: ${nombreVisita} +1.5 Sets`; pickCuota = 1.40;
                    }
                } else {
                    pickMercado = `Total Puntos: Más de 214.5 Puntos`; pickCuota = 1.65;
                }
            } 
            
            else if (riesgo === 'arriesgada') {
                // CUOTAS VALUE CON RIESGO OPTIMIZADO (1.75 a 2.40)
                let decidirMercado = Math.random() > 0.5; // 50% Gana directo, 50% Especiales

                if (deporteActivo === 'futbol') {
                    // Opción A: Gana Directo en partido parejo
                    if (decidirMercado && cLocal >= 1.75 && cLocal <= 2.40) {
                        pickMercado = `Ganador Directo: Gana ${nombreLocal}`; pickCuota = cLocal;
                    } else if (decidirMercado && cVisita >= 1.75 && cVisita <= 2.40) {
                        pickMercado = `Ganador Directo: Gana ${nombreVisita}`; pickCuota = cVisita;
                    } else {
                        // Opción B: Ambos Anotan
                        let dif = Math.abs(probL - probV);
                        let probAmbos = Math.min(62, Math.max(46, Math.round(56 - (dif * 4))));
                        pickMercado = `Estrategia Goles: Ambos Equipos Anotan (SÍ)`;
                        pickCuota = parseFloat((100 / probAmbos).toFixed(2));
                    }
                } 
                else if (deporteActivo === 'tenis') {
                    // Opción A: Gana Directo en partido picante de tenis
                    if (decidirMercado && cLocal >= 1.75 && cLocal <= 2.35) {
                        pickMercado = `Ganador Directo: Gana ${nombreLocal}`; pickCuota = cLocal;
                    } else if (decidirMercado && cVisita >= 1.75 && cVisita <= 2.35) {
                        pickMercado = `Ganador Directo: Gana ${nombreVisita}`; pickCuota = cVisita;
                    } else {
                        // Opción B: Ambos ganan un set (Partido largo)
                        let difTenis = Math.abs(probL - probV);
                        let probSet = Math.max(28, Math.floor(52 - (difTenis * 6)));
                        pickMercado = `Rendimiento: Ambos jugadores ganan al menos 1 Set`;
                        pickCuota = parseFloat((100 / probSet).toFixed(2));
                    }
                } 
                else {
                    // Básquetbol
                    if (decidirMercado) {
                        pickMercado = `Ganador Partido: Gana ${nombreLocal} (H2H)`; pickCuota = 1.90;
                    } else {
                        pickMercado = `Puntos Totales: Más de 222.5 Puntos`; pickCuota = 1.95;
                    }
                }
            }

            cuotaTotalCombinada *= pickCuota;

            // Inyectar la estructura visual de cada evento individual dentro de la tarjeta
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

        // Crear la tarjeta contenedora del Ticket Triple completo
        const tarjetaTicket = document.createElement('div');
        tarjetaTicket.className = 'tarjeta-combinada-completa';
        tarjetaTicket.style.borderTop = `4px solid ${colorBorde}`;

        tarjetaTicket.innerHTML = `
            <div class="header-combinada">
                <span class="badge-riesgo" style="background: ${colorBorde}20; color: ${colorBorde}; border: 1px solid ${colorBorde}40;">${badgeTexto}</span>
                <div class="cuota-final-container">
                    <span style="font-size: 0.85rem; color: var(--texto-gris);">CUOTA TOTAL</span>
                    <span class="cuota-total-gigante" style="color: ${colorBorde}">x${cuotaTotalCombinada.toFixed(2)}</span>
                </div>
            </div>
            <div class="cuerpo-combinada">
                ${htmlTickets}
            </div>
            <button class="btn-copiar-ticket" onclick="copiarTicketAlPortapapeles('${badgeTexto}', ${cuotaTotalCombinada.toFixed(2)})">
                📋 Copiar Jugada Combinada
            </button>
        `;

        contenedor.appendChild(tarjetaTicket);
    });
}
