// Micro Class Flight Scoring Calculator

class MicroClassCalculator {
    constructor() {
        this.initializeEventListeners();
        this.updateCurrentResult();
    }

    initializeEventListeners() {
        // Variable selection checkboxes
        const variableCheckboxes = document.querySelectorAll('input[name="variable-parameter"]');
        variableCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.handleVariableSelection(e));
        });

        // Input changes
        const inputs = document.querySelectorAll('input[type="number"]');
        inputs.forEach(input => {
            input.addEventListener('input', () => this.updateCurrentResult());
        });

        // Button clicks
        document.getElementById('calculate-btn').addEventListener('click', () => this.calculateAndPlot());
        document.getElementById('find-optimal-btn').addEventListener('click', () => this.findOptimal());

        // Initial state
        document.getElementById('w-payload-variable').checked = true;
        this.handleVariableSelection({ target: document.getElementById('w-payload-variable') });
    }

    handleVariableSelection(event) {
        const variableCheckboxes = document.querySelectorAll('input[name="variable-parameter"]');
        const selectedVariable = event.target.value;

        // Uncheck all others and update UI
        variableCheckboxes.forEach(checkbox => {
            const isSelected = checkbox === event.target && checkbox.checked;
            checkbox.checked = isSelected;

            const section = checkbox.closest('.parameter-section');
            const constantInput = section.querySelector('input[type="number"]:not([placeholder])');
            const rangeControls = section.querySelector('.range-controls');

            if (isSelected) {
                section.classList.add('variable-selected');
                constantInput.style.display = 'none';
                rangeControls.style.display = 'flex';
            } else {
                section.classList.remove('variable-selected');
                constantInput.style.display = 'block';
                rangeControls.style.display = 'none';
            }
        });

        // If no variable is selected, select the first one
        if (!document.querySelector('input[name="variable-parameter"]:checked')) {
            document.getElementById('w-payload-variable').checked = true;
            this.handleVariableSelection({ target: document.getElementById('w-payload-variable') });
        }

        this.updateCurrentResult();
    }

    // B_takeoff calculation based on takeoff distance ranges
    getBTakeoff(takeoffDistance) {
        if (takeoffDistance >= 0 && takeoffDistance <= 10) return 20;
        if (takeoffDistance > 10 && takeoffDistance <= 25) return 15;
        if (takeoffDistance > 25 && takeoffDistance <= 50) return 9;
        if (takeoffDistance > 50 && takeoffDistance <= 100) return 0;
        return 0; // fallback
    }

    // Calculate M factor
    calculateM(wEmpty) {
        return 11 / (Math.pow(wEmpty - 1, 4) + 8.9);
    }

    // Calculate Z factor
    calculateZ(bTakeoff, wingspan) {
        return bTakeoff - Math.pow(wingspan, 1.5);
    }    // Calculate Flight Score
    calculateFlightScore(wPayload, wEmpty, wingspan, takeoffDistance = null, bTakeoffOverride = null) {
        const bTakeoff = bTakeoffOverride !== null ? bTakeoffOverride : 
                        (takeoffDistance !== null ? this.getBTakeoff(takeoffDistance) : 15); // default fallback
        const M = this.calculateM(wEmpty);
        const Z = this.calculateZ(bTakeoff, wingspan);
        const FS = 3 * wPayload * M + Z;
        
        return { FS, M, Z, bTakeoff };
    }    getCurrentParameters() {
        const selectedVariable = document.querySelector('input[name="variable-parameter"]:checked');
        const variableName = selectedVariable ? selectedVariable.value : null;

        const params = {
            wPayload: parseFloat(document.getElementById('w-payload-constant').value) || 0,
            wEmpty: parseFloat(document.getElementById('w-empty-constant').value) || 0,
            wingspan: parseFloat(document.getElementById('wingspan-constant').value) || 0,
            takeoffDistance: parseFloat(document.getElementById('takeoff-distance-constant').value) || 0,
            variable: variableName
        };

        if (variableName) {
            const minId = variableName + '-min';
            const maxId = variableName + '-max';
            const pointsId = variableName + '-points';
            
            params.range = {
                min: parseFloat(document.getElementById(minId).value) || 0,
                max: parseFloat(document.getElementById(maxId).value) || 1,
                points: parseInt(document.getElementById(pointsId).value) || 50
            };
        }

        return params;
    }    updateCurrentResult() {
        const params = this.getCurrentParameters();
        const result = this.calculateFlightScore(params.wPayload, params.wEmpty, params.wingspan, params.takeoffDistance);

        document.getElementById('current-fs').textContent = `FS = ${result.FS.toFixed(2)}`;
        document.getElementById('current-m').textContent = result.M.toFixed(4);
        document.getElementById('current-z').textContent = result.Z.toFixed(2);
    }

    generateVariableData(params) {
        const { variable, range } = params;
        const step = (range.max - range.min) / (range.points - 1);
        const data = [];

        for (let i = 0; i < range.points; i++) {
            const value = range.min + i * step;
            let wPayload = params.wPayload;
            let wEmpty = params.wEmpty;
            let wingspan = params.wingspan;
            let takeoffDistance = params.takeoffDistance;

            switch (variable) {
                case 'w-payload':
                    wPayload = value;
                    break;
                case 'w-empty':
                    wEmpty = value;
                    break;
                case 'wingspan':
                    wingspan = value;
                    break;
                case 'takeoff-distance':
                    takeoffDistance = value;
                    break;
            }

            const result = this.calculateFlightScore(wPayload, wEmpty, wingspan, takeoffDistance);

            data.push({
                x: value,
                y: result.FS,
                wPayload,
                wEmpty,
                wingspan,
                takeoffDistance,
                bTakeoff: result.bTakeoff,
                M: result.M,
                Z: result.Z
            });
        }

        return data;
    }

    generate3DData(params) {
        const { variable, range } = params;        // For 3D visualization, we'll vary the selected parameter and one other
        const fixedParams = ['w-payload', 'w-empty', 'wingspan', 'takeoff-distance'];
        const otherParams = fixedParams.filter(p => p !== variable);
        
        // Choose the second variable (we'll use the first available one that makes sense)
        let secondVariable = otherParams[0];
        
        // Define reasonable ranges for the second variable
        const secondRanges = {
            'w-payload': { min: 5, max: 20, points: 30 },
            'w-empty': { min: 10, max: 25, points: 30 },
            'wingspan': { min: 5, max: 15, points: 30 },
            'takeoff-distance': { min: 0, max: 50, points: 30 }
        };

        const secondRange = secondRanges[secondVariable];
        const xData = [];
        const yData = [];
        const zData = [];

        const xStep = (range.max - range.min) / (range.points - 1);
        const yStep = (secondRange.max - secondRange.min) / (secondRange.points - 1);

        for (let i = 0; i < range.points; i++) {
            const xVal = range.min + i * xStep;
            const xRow = [];
            const yRow = [];
            const zRow = [];

            for (let j = 0; j < secondRange.points; j++) {
                const yVal = secondRange.min + j * yStep;

                let wPayload = params.wPayload;
                let wEmpty = params.wEmpty;
                let wingspan = params.wingspan;
                let takeoffDistance = params.takeoffDistance;

                // Set the primary variable
                switch (variable) {
                    case 'w-payload':
                        wPayload = xVal;
                        break;
                    case 'w-empty':
                        wEmpty = xVal;
                        break;
                    case 'wingspan':
                        wingspan = xVal;
                        break;
                    case 'takeoff-distance':
                        takeoffDistance = xVal;
                        break;
                }

                // Set the second variable
                switch (secondVariable) {
                    case 'w-payload':
                        wPayload = yVal;
                        break;
                    case 'w-empty':
                        wEmpty = yVal;
                        break;
                    case 'wingspan':
                        wingspan = yVal;
                        break;
                    case 'takeoff-distance':
                        takeoffDistance = yVal;
                        break;
                }

                const result = this.calculateFlightScore(wPayload, wEmpty, wingspan, takeoffDistance);

                xRow.push(xVal);
                yRow.push(yVal);
                zRow.push(result.FS);
            }

            xData.push(xRow);
            yData.push(yRow);
            zData.push(zRow);
        }

        return {
            x: xData,
            y: yData,
            z: zData,
            primaryVariable: variable,
            secondVariable: secondVariable,
            primaryRange: range,
            secondRange: secondRange
        };
    }

    calculateAndPlot() {
        const params = this.getCurrentParameters();

        if (!params.variable) {
            alert('Proszę wybrać zmienną do analizy.');
            return;
        }

        const container = document.getElementById('flight-score-chart');
        container.innerHTML = '';

        // Generate 3D surface data
        const data3D = this.generate3DData(params);

        const trace = {
            x: data3D.x,
            y: data3D.y,
            z: data3D.z,
            type: 'surface',
            colorscale: [
                [0, '#3498db'],
                [0.5, '#f39c12'],
                [1, '#e74c3c']
            ],
            showscale: true,
            colorbar: {
                title: 'Flight Score (FS)',
                titleside: 'right'
            }
        };

        const layout = {
            title: {
                text: `Optymalizacja Flight Score - ${this.getVariableLabel(params.variable)} vs ${this.getVariableLabel(data3D.secondVariable)}`,
                font: { size: 16 }
            },
            scene: {
                xaxis: {
                    title: this.getVariableLabel(params.variable),
                    titlefont: { size: 12 }
                },
                yaxis: {
                    title: this.getVariableLabel(data3D.secondVariable),
                    titlefont: { size: 12 }
                },
                zaxis: {
                    title: 'Flight Score (FS)',
                    titlefont: { size: 12 }
                },
                camera: {
                    eye: {
                        x: 1.2,
                        y: 1.2,
                        z: 1.2
                    }
                }
            },
            margin: { l: 0, r: 0, t: 40, b: 0 },
            autosize: true
        };

        const config = {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToAdd: [{
                name: 'Reset View',
                icon: Plotly.Icons.home,
                click: function(gd) {
                    Plotly.relayout(gd, {
                        'scene.camera': {
                            eye: { x: 1.2, y: 1.2, z: 1.2 }
                        }
                    });
                }
            }]
        };

        Plotly.newPlot(container, [trace], layout, config);

        // Add click event to show point information
        container.on('plotly_click', (data) => {
            if (data.points && data.points.length > 0) {
                const point = data.points[0];
                const x = point.x.toFixed(2);
                const y = point.y.toFixed(2);
                const z = point.z.toFixed(2);

                alert(`Punkt na wykresie:\n${this.getVariableLabel(params.variable)}: ${x}\n${this.getVariableLabel(data3D.secondVariable)}: ${y}\nFlight Score: ${z}`);
            }
        });
    }

    getVariableLabel(variable) {
        const labels = {
            'w-payload': 'W_Payload (lbs)',
            'w-empty': 'W_Empty (lbs)',
            'wingspan': 'Wingspan (ft)',
            'takeoff-distance': 'Takeoff Distance (ft)'
        };
        return labels[variable] || variable;
    }

    findOptimal() {
        const params = this.getCurrentParameters();

        if (!params.variable) {
            alert('Proszę wybrać zmienną do optymalizacji.');
            return;
        }

        const data = this.generateVariableData(params);

        // Find maximum FS
        let maxFS = -Infinity;
        let optimalPoint = null;

        data.forEach(point => {
            if (point.y > maxFS) {
                maxFS = point.y;
                optimalPoint = point;
            }
        });

        if (optimalPoint) {
            // Display results
            document.getElementById('optimal-fs').textContent = `Max FS = ${maxFS.toFixed(2)}`;

            const optimalParams = document.getElementById('optimal-params');
            optimalParams.innerHTML = `
                <div><strong>Optymalne parametry:</strong></div>
                <div>${this.getVariableLabel(params.variable)}: ${optimalPoint.x.toFixed(2)}</div>
                <div>W<sub>Payload</sub>: ${optimalPoint.wPayload.toFixed(2)} lbs</div>
                <div>W<sub>Empty</sub>: ${optimalPoint.wEmpty.toFixed(2)} lbs</div>
                <div>Wingspan: ${optimalPoint.wingspan.toFixed(2)} ft</div>
                <div>Takeoff Distance: ${optimalPoint.takeoffDistance.toFixed(2)} ft</div>
                <div>B<sub>Takeoff</sub>: ${optimalPoint.bTakeoff}</div>
                <div>M: ${optimalPoint.M.toFixed(4)}</div>
                <div>Z: ${optimalPoint.Z.toFixed(2)}</div>
            `;

            document.getElementById('optimal-result').style.display = 'block';

            // Also plot the 1D optimization curve
            this.plot1DOptimization(data, params.variable, optimalPoint);
        }
    }

    plot1DOptimization(data, variableName, optimalPoint) {
        const container = document.getElementById('flight-score-chart');

        const trace1 = {
            x: data.map(d => d.x),
            y: data.map(d => d.y),
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Flight Score',
            line: { color: '#007bff', width: 3 },
            marker: { size: 6, color: '#007bff' }
        };

        const trace2 = {
            x: [optimalPoint.x],
            y: [optimalPoint.y],
            type: 'scatter',
            mode: 'markers',
            name: 'Optimum',
            marker: {
                size: 15,
                color: '#e74c3c',
                symbol: 'star'
            }
        };

        const layout = {
            title: {
                text: `Optymalizacja Flight Score względem ${this.getVariableLabel(variableName)}`,
                font: { size: 16 }
            },
            xaxis: {
                title: this.getVariableLabel(variableName),
                showgrid: true,
                zeroline: false
            },
            yaxis: {
                title: 'Flight Score (FS)',
                showgrid: true,
                zeroline: false
            },
            showlegend: true,
            margin: { l: 60, r: 20, t: 60, b: 60 },
            hovermode: 'closest'
        };

        const config = {
            responsive: true,
            displayModeBar: true
        };

        Plotly.newPlot(container, [trace1, trace2], layout, config);
    }
}

// Initialize calculator when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MicroClassCalculator();
});
