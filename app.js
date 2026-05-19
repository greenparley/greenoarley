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

    // Los 3 niveles de la app: Todos basados en lógica viable y realista
    const nivelesRiesgo = ['asegurada', 'moderada', 'arriesgada'];

    nivelesRiesgo.forEach((riesgo, index) => {
        let partidosMezclados = [...partidosValidos].sort(() => 0.5 - Math.random());
        let seleccionados = partidosMezclados.slice(0, 3);

        let htmlTickets = '';
        let cuotaTotalCombinada = 1.00;
        let colorBorde = '';
        let badgeTexto = '';

        // Configuración visual de las tarjetas
        if (riesgo === 'asegurada') {
            colorBorde = "var(--verde-principal)";
            badgeTexto = `🛡️ TRIPLE ULTRA ASEGURADA (Opción ${index + 1})`;
        } else if (riesgo === 'moderada') {
            colorBorde = "var(--oro)";
            badgeTexto = `📊 TRIPLE ESTÁNDAR / PROBABLE (Opción ${index + 1})`;
        } else {
            colorBorde = "#00b4d8"; // Azul premium para despegarlo de la palabra "peligro"
            badgeTexto = `💎 TRIPLE PREMIUM / ALTO RENDIMIENTO (Opción ${index + 1})`;
        }

        seleccionados.forEach(p => {
            let nombreLocal = p.homeTeam?.name || p.local || "Local";
            let nombreVisita = p.awayTeam?.name || p.visita || "Visita";
            
            let cLocal = p.cuotasReales?.local ? parseFloat(p.cuotasReales.local) : 1.85;
            let cVisita = p.cuotasReales?.visita ? parseFloat(p.cuotasReales.visita) : 1.85;
            
            // IDENTIFICACIÓN ESTRICTA DEL FAVORITO REAL
            let esFavLocal = cLocal <= cVisita;
            let cuotaFav = esFavLocal ? cLocal : cVisita;
            let nameFav = esFavLocal ? nombreLocal : nombreVisita;

            let pickMercado = '';
            let pickCuota = 1.30;

            // =================================================================
            // ALGORITMO ANTI-BATACAZOS: FILTRADO POR CLASIFICACIÓN DE RIESGO
            // =================================================================
            
            if (riesgo === 'asegurada') {
                // Nivel 1: Opciones lógicas de piso (Cuotas objetivo: 1.18 a 1.32)
                if (deporteActivo === 'futbol') {
                    // Doble oportunidad matemática adaptada al favorito real
                    pickMercado = `Doble Oportunidad: Gana o Empata ${nameFav}`;
                    let calculoDO = 1 + (cuotaFav - 1) * 0.35;
                    pickCuota = parseFloat(Math.max(1.18, Math.min(1.32, calculoDO)).toFixed(2));
                } else if (deporteActivo === 'tenis') {
                    // En tenis, el favorito lógicamente ganará al menos un set de tres
                    pickMercado = `Hándicap: ${nameFav} gana 1+ Set en el partido`;
                    let calculoSet = 1 + (cuotaFav - 1) * 0.20;
                    pickCuota = parseFloat(Math.max(1.15, Math.min(1.28, calculoSet)).toFixed(2));
                } else {
                    pickMercado = `Total Puntos: Más de 204.5 Puntos Totales`; 
                    pickCuota = 1.26;
                }
            } 
            
            else if (riesgo === 'moderada') {
                // Nivel 2: Favoritos estables o mercados consolidados (Cuotas objetivo: 1.35 a 1.65)
                if (deporteActivo === 'futbol') {
                    // Solo arriesga ganador directo si el favorito es sumamente claro en los papeles
                    if (cuotaFav <= 1.70) {
                        pickMercado = `Ganador Directo: Gana ${nameFav}`; 
                        pickCuota = cuotaFav;
                    } else {
                        // Si el partido tiende a la paridad, se refugia en una línea de goles muy factible
                        pickMercado = `Total de Goles: Más de 1.5 Goles en el Partido`; 
                        pickCuota = 1.36;
                    }
                } else if (deporteActivo === 'tenis') {
                    if (cuotaFav <= 1.60) {
                        pickMercado = `Ganador del Partido: Gana ${nameFav}`; 
                        pickCuota = cuotaFav;
                    } else {
                        pickMercado = `Hándicap de Sets: ${nameFav} +1.5 Sets`; 
                        pickCuota = 1.42;
                    }
                } else {
                    pickMercado = `Total Puntos: Más de 211.5 Puntos Totales`; 
                    pickCuota = 1.52;
                }
            } 
            
            else if (riesgo === 'arriesgada') {
                // Nivel 3: Valor Premium Inteligente (Cuotas objetivo: 1.50 a 1.95 MÁXIMO por selección)
                if (deporteActivo === 'futbol') {
                    if (cuotaFav <= 1.95) {
                        // Sigue siendo una cuota que favorece al candidato lógico
                        pickMercado = `Ganador Directo: Gana ${nameFav}`; 
                        pickCuota = cuotaFav;
                    } else {
                        // Mismatch absoluto o empate técnico: Se protege con una Doble Oportunidad bien paga del leve favorito
                        pickMercado = `Doble Oportunidad: Gana o Empata ${nameFav}`;
                        let calculoDOPremium = 1 + (cuotaFav - 1) * 0.45;
                        pickCuota = parseFloat(Math.max(1.42, Math.min(1.65, calculoDOPremium)).toFixed(2));
                    }
                } 
                else if (deporteActivo === 'tenis') {
                    if (cuotaFav <= 1.85) {
                        pickMercado = `Ganador del Partido: Gana ${nameFav}`; 
                        pickCuota = cuotaFav;
                    } else {
                        // Si el partido de tenis es extremadamente parejo, garantizan un desarrollo largo de puntos
                        pickMercado = `Games Totales: Más de 20.5 Games Totales`; 
                        pickCuota = 1.68;
                    }
                } 
                else {
                    pickMercado = `Total Puntos: Más de 217.5 Puntos Totales`; 
                    pickCuota = 1.78;
                }
            }

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

        // Crear y montar el componente visual del ticket
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
