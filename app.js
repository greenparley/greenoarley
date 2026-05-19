function generarCombinadaDelDia() {
    const contenedor = document.getElementById('contenedor-combinadas');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    // Filtrar partidos del deporte activo con cuotas válidas
    let partidosValidos = partidosDisponibles.filter(p => {
        if (deporteActivo === 'futbol' || deporteActivo === 'tenis') {
            return p.cuotasReales && p.cuotasReales.local && p.cuotasReales.visita;
        }
        return true; 
    });

    if (partidosValidos.length < 3) {
        contenedor.innerHTML = `<div class="alerta-error">Se necesitan al menos 3 partidos para armar las combinadas.</div>`;
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
            
            // IDENTIFICACIÓN DEL FAVORITO REAL
            let esFavLocal = cLocal <= cVisita;
            let cuotaFav = esFavLocal ? cLocal : cVisita;
            let nameFav = esFavLocal ? nombreLocal : nombreVisita;

            // REGLA DE ORO: Si paga más de 1.65, NO es un favorito seguro, es un partido parejo.
            let hayFavoritoClaro = cuotaFav <= 1.65;

            let pickMercado = '';
            let pickCuota = 1.30;

            // =================================================================
            // ALGORITMO 100% ANTI-BATACAZOS
            // =================================================================
            
            if (riesgo === 'asegurada') {
                if (deporteActivo === 'futbol') {
                    pickMercado = `Doble Oportunidad: Gana/Empata ${nameFav}`;
                    pickCuota = parseFloat(Math.max(1.15, Math.min(1.28, 1 + (cuotaFav - 1) * 0.35)).toFixed(2));
                } else if (deporteActivo === 'tenis') {
                    pickMercado = `Hándicap: ${nameFav} gana 1+ Set`;
                    pickCuota = 1.18;
                } else {
                    pickMercado = `Total Puntos: Más de 204.5 Puntos`; pickCuota = 1.22;
                }
            } 
            
            else if (riesgo === 'moderada') {
                if (deporteActivo === 'futbol') {
                    if (hayFavoritoClaro) {
                        pickMercado = `Ganador Directo: Gana ${nameFav}`; 
                        pickCuota = cuotaFav;
                    } else {
                        pickMercado = `Total de Goles: Más de 1.5 Goles`; 
                        pickCuota = 1.35; // Mercado ultra probable
                    }
                } else if (deporteActivo === 'tenis') {
                    if (hayFavoritoClaro) {
                        pickMercado = `Gana el Partido: ${nameFav}`; 
                        pickCuota = cuotaFav;
                    } else {
                        pickMercado = `Games Totales: Más de 19.5 Games`; 
                        pickCuota = 1.38;
                    }
                } else {
                    pickMercado = `Total Puntos: Más de 211.5 Puntos`; pickCuota = 1.45;
                }
            } 
            
            else if (riesgo === 'premium') {
                // Acá levantamos la cuota combinando mercados lógicos, NUNCA eligiendo ganadores inciertos.
                if (deporteActivo === 'futbol') {
                    if (hayFavoritoClaro) {
                        // El equipo es muy bueno, le sumamos la condición de que haya al menos 2 goles en el partido
                        pickMercado = `Gana ${nameFav} y Más de 1.5 Goles en el partido`; 
                        pickCuota = parseFloat((cuotaFav * 1.25).toFixed(2)); 
                    } else {
                        // Partido parejo. Huimos del ganador y vamos a una Doble Oportunidad sólida con goles.
                        pickMercado = `Doble Oportunidad: Gana/Empata ${nameFav} y Más de 1.5 Goles`;
                        pickCuota = 1.65;
                    }
                } 
                else if (deporteActivo === 'tenis') {
                    if (hayFavoritoClaro) {
                        pickMercado = `Gana ${nameFav} y Menos de 24.5 Games Totales`; 
                        pickCuota = parseFloat((cuotaFav * 1.20).toFixed(2));
                    } else {
                        // Partido peleado: Vamos a que hay un desarrollo estándar
                        pickMercado = `Games Totales: Más de 21.5 Games Totales`; 
                        pickCuota = 1.70;
                    }
                } 
                else {
                    pickMercado = `Total Puntos: Más de 217.5 Puntos Totales`; 
                    pickCuota = 1.75;
                }
            }

            // Tope de seguridad: Ninguna selección individual superará jamás cuota 1.85
            if (pickCuota > 1.85) pickCuota = 1.75;

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
