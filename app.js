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

    // Definir los 3 niveles de riesgo reales y posibles
    const nivelesRiesgo = ['asegurada', 'moderada', 'arriesgada'];

    nivelesRiesgo.forEach((riesgo, index) => {
        // Mezclamos para que cada tarjeta tenga partidos diferentes
        let partidosMezclados = [...partidosValidos].sort(() => 0.5 - Math.random());
        let seleccionados = partidosMezclados.slice(0, 3);

        let htmlTickets = '';
        let cuotaTotalCombinada = 1.00;
        let colorBorde = '';
        let badgeTexto = '';

        // Estilos visuales premium según el riesgo
        if (riesgo === 'asegurada') {
            colorBorde = "var(--verde-principal)";
            badgeTexto = `🛡️ TRIPLE ASEGURADA (Opción ${index + 1})`;
        } else if (riesgo === 'moderada') {
            colorBorde = "var(--oro)";
            badgeTexto = `📊 TRIPLE MODERADA (Opción ${index + 1})`;
        } else {
            colorBorde = "var(--alerta)";
            badgeTexto = `🔥 TRIPLE VALUE / PROBABLE (Opción ${index + 1})`;
        }

        seleccionados.forEach(p => {
            let nombreLocal = p.homeTeam?.name || p.local || "Local";
            let nombreVisita = p.awayTeam?.name || p.visita || "Visita";
            
            let cLocal = p.cuotasReales?.local ? parseFloat(p.cuotasReales.local) : 1.85;
            let cVisita = p.cuotasReales?.visita ? parseFloat(p.cuotasReales.visita) : 1.85;
            
            let pickMercado = '';
            let pickCuota = 1.50;

            // =================================================================
            // FILTROS PASO A PASO: SOLO LOGICA ACCESIBLE (SIN BATACAZOS)
            // =================================================================
            
            if (riesgo === 'asegurada') {
                // Cuotas ultra-seguras (Rango: 1.22 a 1.40)
                if (deporteActivo === 'futbol') {
                    if (cLocal < cVisita) {
                        pickMercado = `Doble Oportunidad: Gana/Empata ${nombreLocal}`;
                        pickCuota = Math.max(1.22, parseFloat((cLocal * 0.78).toFixed(2)));
                    } else {
                        pickMercado = `Doble Oportunidad: Gana/Empata ${nombreVisita}`;
                        pickCuota = Math.max(1.22, parseFloat((cVisita * 0.78).toFixed(2)));
                    }
                } else if (deporteActivo === 'tenis') {
                    // Se la juega por el favorito indiscutido del partido
                    if (cLocal < cVisita) {
                        pickMercado = `Gana el Partido: ${nombreLocal}`; pickCuota = Math.max(1.20, cLocal);
                    } else {
                        pickMercado = `Gana el Partido: ${nombreVisita}`; pickCuota = Math.max(1.20, cVisita);
                    }
                } else {
                    pickMercado = `Total Puntos: Más de 206.5 Puntos`; pickCuota = 1.32;
                }
            } 
            
            else if (riesgo === 'moderada') {
                // Cuotas lógicas de favoritos estándar (Rango: 1.45 a 1.70)
                if (deporteActivo === 'futbol') {
                    if (cLocal < cVisita && cLocal >= 1.40) {
                        pickMercado = `Ganador Directo: Gana ${nombreLocal}`; pickCuota = cLocal;
                    } else if (cVisita < cLocal && cVisita >= 1.40) {
                        pickMercado = `Ganador Directo: Gana ${nombreVisita}`; pickCuota = cVisita;
                    } else {
                        pickMercado = `Total de Goles: Más de 1.5 Goles`; pickCuota = 1.42;
                    }
                } else if (deporteActivo === 'tenis') {
                    if (cLocal < cVisita) {
                        pickMercado = `Hándicap: ${nombreLocal} gana al menos 1 Set`; pickCuota = 1.38;
                    } else {
                        pickMercado = `Hándicap: ${nombreVisita} gana al menos 1 Set`; pickCuota = 1.38;
                    }
                } else {
                    pickMercado = `Total Puntos: Más de 213.5 Puntos`; pickCuota = 1.62;
                }
            } 
            
            else if (riesgo === 'arriesgada') {
                // EL CAMBIO CLAVE: CUOTAS LINDAS PERO TOTALMENTE POSIBLES (Rango: 1.70 a 2.15 MÁXIMO)
                let probabilidadCorta = Math.random() > 0.5;

                if (deporteActivo === 'futbol') {
                    // Opción A: Gana Directo SOLO si es un favorito factible (Cuotas entre 1.70 y 2.10)
                    if (probabilidadCorta && cLocal >= 1.70 && cLocal <= 2.10) {
                        pickMercado = `Ganador Directo: Gana ${nombreLocal}`; pickCuota = cLocal;
                    } else if (probabilidadCorta && cVisita >= 1.70 && cVisita <= 2.10) {
                        pickMercado = `Ganador Directo: Gana ${nombreVisita}`; pickCuota = cVisita;
                    } else {
                        // Opción B: Ambos Marcan (Súper común en cualquier partido de fútbol fluido)
                        pickMercado = `Goles: Ambos Equipos Anotan (SÍ)`; 
                        pickCuota = parseFloat((1.75 + Math.random() * 0.3).toFixed(2)); // Fuerza cuotas entre 1.75 y 2.05
                    }
                } 
                else if (deporteActivo === 'tenis') {
                    // Opción A: Ganador directo en partidos competitivos pero estables (1.70 a 2.10)
                    if (probabilidadCorta && cLocal >= 1.70 && cLocal <= 2.10) {
                        pickMercado = `Gana el Partido: ${nombreLocal}`; pickCuota = cLocal;
                    } else if (probabilidadCorta && cVisita >= 1.70 && cVisita <= 2.10) {
                        pickMercado = `Gana el Partido: ${nombreVisita}`; pickCuota = cVisita;
                    } else {
                        // Opción B: Más de 21.5 Games totales (Un partido clásico de 3 sets o dos sets largos)
                        pickMercado = `Games Totales: Más de 21.5 Games`; 
                        pickCuota = 1.82;
                    }
                } 
                else {
                    // Básquetbol clásico, sin inventar nada raro
                    if (probabilidadCorta) {
                        pickMercado = `Ganador Partido: Gana ${nombreLocal} (H2H)`; pickCuota = 1.85;
                    } else {
                        pickMercado = `Puntos Totales: Más de 220.5 Puntos`; pickCuota = 1.91;
                    }
                }
            }

            // Forzar un tope máximo por evento por seguridad total anti-batacazos
            if (pickCuota > 2.20) pickCuota = 1.95;

            cuotaTotalCombinada *= pickCuota;

            // Renderizar el ítem en HTML
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

        // Armar la estructura del ticket final
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
