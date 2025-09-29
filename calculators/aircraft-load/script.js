document.addEventListener('DOMContentLoaded', function() {
    const ro = 1.225;
    const g = 9.81;
    let myChart = null;

    const PARAMS_CONFIG = [
        { id: 'cl', label: 'Współczynnik nośności (Cl)', val: 1.4, min: 1.2, max: 1.8 },
        { id: 'cd', label: 'Współczynnik oporu (Cd)', val: 0.03, min: 0.02, max: 0.05 },
        { id: 'fn', label: 'Ciąg nominalny (Fn)', val: 52.86, min: 45, max: 65 },
        { id: 'wiatr', label: 'Prędkość wiatru (m/s)', val: 0, min: -5, max: 10 },
        { id: 'wsp_masy', label: 'Masa skrzydła (kg/m²)', val: 1.4, min: 1.0, max: 2.0 },
        { id: 'dod_masa', label: 'Masa stała (kg)', val: 2, min: 1.5, max: 3.0 },
        { id: 'dystans', label: 'Max. dystans startowy (m)', val: 30, min: 20, max: 50 },
        { id: 'max_masa_startowa', label: 'Max. masa startowa (kg)', val: 24, min: 18, max: 30 }
    ];
    const ALL_PARAMS = PARAMS_CONFIG.map(p => p.id);

    function buildParamsUI() {
        const container = document.getElementById('param-list');
        PARAMS_CONFIG.forEach(p => {
            const row = document.createElement('div');
            row.className = 'param-row';
            row.innerHTML = `
                <div class="param-control">
                    <input type="radio" id="${p.id}_radio" name="param3d" value="${p.id}">
                    <label for="${p.id}_radio">${p.label}:</label>
                </div>
                <div class="param-inputs">
                    <span id="${p.id}_single"><input type="number" id="${p.id}_val" value="${p.val}"></span>
                    <span id="${p.id}_range" class="range-inputs">
                        <label>Min:</label><input type="number" id="${p.id}_min" value="${p.min}">
                        <label>Max:</label><input type="number" id="${p.id}_max" value="${p.max}">
                    </span>
                </div>
            `;
            container.appendChild(row);
            document.getElementById(`${p.id}_radio`).addEventListener('change', updateInputState);
        });
        document.getElementById('none_radio').addEventListener('change', updateInputState);
    }

    function updateInputState() {
        const selectedParam = document.querySelector('input[name="param3d"]:checked').value;
        ALL_PARAMS.forEach(param => {
            const isSelected = (param === selectedParam);
            document.getElementById(`${param}_single`).style.display = isSelected ? 'none' : 'block';
            document.getElementById(`${param}_range`).style.display = isSelected ? 'flex' : 'none';
        });
    }

    function getTakeoffDistance(p, Area, V_start, aktualna_masa) {
        const dt = 0.01; let v = 0, x = 0, steps = 0;
        while (v < V_start) {
            let v_air = v + p.wiatr; // Prędkość względem powietrza
            let F = -0.0691 * v_air * v_air - 0.7383 * v_air + p.fn;
            let D = (p.cd * ro * Area * v_air * v_air) / 2;
            let F_wyp = F - D;
            if (F_wyp <= 0) return Infinity;
            let a = F_wyp / aktualna_masa;
            x = x + v * dt + (a * dt * dt) / 2;
            v = v + a * dt;
            if (++steps > 100000) return Infinity;
        }
        return x;
    }

    function findMaxPossibleMass(p, testArea) {
        let masa_wlasna = (testArea * p.wsp_masy) + p.dod_masa;
        if (masa_wlasna > p.max_masa_startowa) return 0;
        let min_mass = masa_wlasna;
        let max_mass = Math.min(masa_wlasna + 200, p.max_masa_startowa);
        let max_possible_mass = 0;
        for (let k = 0; k < 50; k++) {
            let testMass = (min_mass + max_mass) / 2;
            if (testMass <= masa_wlasna || (max_mass - min_mass < 0.01)) break;
            const V_start_air = Math.sqrt((2 * testMass * g) / (p.cl * ro * testArea));
            const V_start_ground = V_start_air - p.wiatr;
            if (V_start_ground <= 0) { // Już ma siłę nośną stojąc w miejscu
                max_possible_mass = testMass;
                min_mass = testMass;
                continue;
            }
            const distance = getTakeoffDistance(p, testArea, V_start_ground, testMass);
            if (distance <= p.dystans) { max_possible_mass = testMass; min_mass = testMass; }
            else { max_mass = testMass; }
        }
        return max_possible_mass;
    }

    function getInputs() {
        let inputs = {};
        const selectedParam = document.querySelector('input[name="param3d"]:checked').value;
        ALL_PARAMS.forEach(p => {
            inputs[p] = (p === selectedParam && selectedParam !== 'none')
                ? [parseFloat(document.getElementById(`${p}_min`).value), parseFloat(document.getElementById(`${p}_max`).value)]
                : parseFloat(document.getElementById(`${p}_val`).value);
        });
        inputs.max_area = parseFloat(document.getElementById('max_area').value);
        return inputs;
    }

    function run2DAnalysis() {
        const resultElement = document.getElementById('result');
        resultElement.innerHTML = "Obliczam optymalny ładunek...";
        const p = getInputs();
        const AREA_STEPS = 100;
        let bestPayload = -1, bestResult = null;
        let chartLabels = [], chartData = [];

        for (let i = 0; i <= AREA_STEPS; i++) {
            let testArea = 0.1 + (i / AREA_STEPS) * (p.max_area - 0.1);
            let masa_wlasna = (testArea * p.wsp_masy) + p.dod_masa;
            let max_possible_mass = findMaxPossibleMass(p, testArea);
            let currentPayload = (max_possible_mass > 0) ? max_possible_mass - masa_wlasna : 0;

            if (currentPayload > bestPayload) {
                bestPayload = currentPayload;
                const V_start_air = Math.sqrt((2 * max_possible_mass * g) / (p.cl * ro * testArea));
                const V_start_ground = V_start_air - p.wiatr;
                const dist_final = getTakeoffDistance(p, testArea, V_start_ground, max_possible_mass);
                bestResult = { area: testArea, totalMass: max_possible_mass, payload: currentPayload, distance: dist_final };
            }
            chartLabels.push(testArea.toFixed(2));
            chartData.push(currentPayload.toFixed(2));
        }

        if (bestResult) {
            resultElement.innerHTML = `<h4>Optymalna Konfiguracja 2D</h4>
                <strong>Maksymalny Ładunek: ${bestResult.payload.toFixed(2)} kg</strong><br>
                Powierzchnia skrzydła: <strong>${bestResult.area.toFixed(3)} m²</strong><br>
                Masa startowa: <strong>${bestResult.totalMass.toFixed(2)} kg</strong> (Limit: ${p.max_masa_startowa} kg)<br>
                Dystans startu: <strong>${bestResult.distance.toFixed(2)} m</strong> (Limit: ${p.dystans} m)`;
            draw2DPlot(chartLabels, chartData);
        } else {
            resultElement.innerText = "Nie znaleziono żadnej konfiguracji pozwalającej na start w zadanym dystansie i limicie masy.";
        }
    }

    function run3DAnalysis(param) {
        const resultElement = document.getElementById('result');
        resultElement.innerHTML = `Obliczam... Analiza 3D może potrwać kilkanaście sekund.`;
        const p_base = getInputs();
        const AREA_STEPS = 25, PARAM_STEPS = 25;
        let z_data = [];
        const param_min = p_base[param][0], param_max = p_base[param][1];

        for (let j = 0; j <= PARAM_STEPS; j++) {
            let current_param_val = param_min + (j / PARAM_STEPS) * (param_max - param_min);
            let z_row = [];
            for (let i = 0; i <= AREA_STEPS; i++) {
                let testArea = 0.1 + (i / AREA_STEPS) * (p_base.max_area - 0.1);
                let p = { ...p_base, [param]: current_param_val };
                let max_possible_mass = findMaxPossibleMass(p, testArea);
                let masa_wlasna = (testArea * p.wsp_masy) + p.dod_masa;
                z_row.push((max_possible_mass > 0) ? max_possible_mass - masa_wlasna : 0);
            }
            z_data.push(z_row);
        }

        const x_axis_data = Array.from({length: AREA_STEPS + 1}, (_, i) => 0.1 + (i / AREA_STEPS) * (p_base.max_area - 0.1));
        const y_axis_data = Array.from({length: PARAM_STEPS + 1}, (_, j) => param_min + (j / PARAM_STEPS) * (param_max - param_min));
        draw3DPlot(x_axis_data, y_axis_data, z_data, param);
        resultElement.innerHTML = "Analiza 3D zakończona. Wyniki na wykresie poniżej.";
    }

    function draw2DPlot(labels, data) {
        const chartContainer = document.getElementById('chartContainer');
        chartContainer.style.display = 'block';
        if (myChart) myChart.destroy();
        const ctx = document.getElementById('payloadChart').getContext('2d');
        myChart = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [{
            label: 'Maksymalny Ładunek (kg)', data: data, borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)', fill: true, tension: 0.1 }]
        }, options: { responsive: true, maintainAspectRatio: false, scales: {
            x: { title: { display: true, text: 'Powierzchnia Skrzydła (m²)' }},
            y: { title: { display: true, text: 'Maksymalny Ładunek (kg)' }, beginAtZero: true }},
            plugins: { title: { display: true, text: 'Zależność Ładunku od Powierzchni Skrzydła', font: { size: 16 } } }
        }});
    }

    function draw3DPlot(x, y, z, paramName) {
        const plotContainer = document.getElementById('plotContainer');
        plotContainer.style.display = 'block';
        const paramLabels = {};
        PARAMS_CONFIG.forEach(p => paramLabels[p.id] = p.label);
        const data = [{ x: x, y: y, z: z, type: 'surface', colorscale: 'Viridis' }];
        const layout = {
            title: `Maksymalny Ładunek w zależności od Powierzchni i "${paramLabels[paramName]}"`,
            scene: {
                xaxis: { title: 'Powierzchnia skrzydła (m²)' },
                yaxis: { title: paramLabels[paramName] },
                zaxis: { title: 'Maksymalny Ładunek (kg)' }
            },
            autosize: true, margin: { l: 65, r: 50, b: 65, t: 90 }
        };
        Plotly.newPlot('plotContainer', data, layout);
    }

    function runAnalysis() {
        const resultElement = document.getElementById('result');
        document.getElementById('plotContainer').style.display = 'none';
        document.getElementById('chartContainer').style.display = 'none';
        resultElement.innerHTML = "Przygotowuję analizę...";
        const selectedParam = document.querySelector('input[name="param3d"]:checked').value;
        setTimeout(() => (selectedParam === 'none' ? run2DAnalysis() : run3DAnalysis(selectedParam)), 50);
    }

    buildParamsUI();
    updateInputState();
    document.getElementById('run-analysis-btn').addEventListener('click', runAnalysis);
});
