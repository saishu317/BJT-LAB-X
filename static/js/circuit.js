/**
 * BJT LABX – Circuit Diagram Page
 * Interactive SVG circuit, current flow animation, buzzer audio, 3D view
 * 
 * Sections:
 *  1. DOM References
 *  2. SVG Circuit Drawing
 *  3. Current Flow Animation System
 *  4. Buzzer Audio System (Web Audio API)
 *  5. 3D Scene Setup (Three.js)
 *  6. Popup Management
 *  7. Slider / Sensor Event Handlers
 *  8. Update / Render Loop
 *  9. Initialization
 */

(function () {
    'use strict';

    /* =======================================================
       1. DOM REFERENCES
       ======================================================= */
    const svgEl          = document.getElementById('circuit-svg');
    const svgContainer   = document.getElementById('circuit-svg-container');
    const container3D    = document.getElementById('circuit-3d-container');
    const btn2D          = document.getElementById('btn-2d');
    const btn3D          = document.getElementById('btn-3d');
    const btnSensorOn    = document.getElementById('btn-sensor-on');
    const btnSensorOff   = document.getElementById('btn-sensor-off');
    const sensorStatusEl = document.getElementById('sensor-status');
    const buzzerStatusEl = document.getElementById('buzzer-status');
    const btnMute        = document.getElementById('btn-mute');
    const muteIcon       = document.getElementById('mute-icon');
    const muteLabel      = document.getElementById('mute-label');
    const rbSlider       = document.getElementById('rb-slider');
    const rbNum          = document.getElementById('rb-num');
    const rbValueBox     = document.getElementById('rb-value-box');
    const rbDisplay      = document.getElementById('rb-display');
    const ibDisplay      = document.getElementById('ib-display');
    const icDisplay      = document.getElementById('ic-display');
    const pdDisplay      = document.getElementById('pd-display');
    const pdStatusEl     = document.getElementById('pd-status');

    /* State */
    let currentView  = '2d';      // '2d' or '3d'
    let isMuted      = false;
    let scene3D      = null;      // Three.js scene reference
    let renderer3D   = null;
    let animFrameId  = null;
    let particleAnimId = null;

    /* =======================================================
       2. SVG CIRCUIT DRAWING
       ======================================================= */

    /** SVG namespace */
    const NS = 'http://www.w3.org/2000/svg';

    /** Helper: create SVG element with attributes */
    function svgCreate(tag, attrs) {
        const el = document.createElementNS(NS, tag);
        for (const [k, v] of Object.entries(attrs || {})) {
            el.setAttribute(k, v);
        }
        return el;
    }

    /** Helper: create SVG text */
    function svgText(x, y, text, cls, extra) {
        const el = svgCreate('text', {
            x, y, class: cls || 'circuit-label',
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            ...(extra || {})
        });
        el.textContent = text;
        return el;
    }

    /* ---- Key coordinate constants ---- */
    const CX = {
        // Horizontal zones
        SENSOR_X: 100,
        RB_START: 200,
        RB_END:   340,
        BJT_X:    440,
        BUZZER_X: 440,
        VCC_X:    440,
        // Vertical zones
        VCC_Y:    50,
        BUZZER_Y: 140,
        BJT_BASE_Y: 310,
        BJT_COLL_Y: 260,
        BJT_EMIT_Y: 360,
        GND_Y:    460,
        SENSOR_Y: 310,
    };

    /** References to dynamic SVG elements for later updates */
    const svgRefs = {};

    /** Draw the complete circuit schematic */
    function drawCircuit() {
        // Clear existing content
        while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

        // Definitions (for arrowheads, gradients, clip paths)
        const defs = svgCreate('defs');

        // Arrowhead marker for diode
        const marker = svgCreate('marker', {
            id: 'arrowhead', markerWidth: '8', markerHeight: '6',
            refX: '4', refY: '3', orient: 'auto', fill: '#4a5a7c'
        });
        marker.appendChild(svgCreate('polygon', { points: '0 0, 8 3, 0 6' }));
        defs.appendChild(marker);
        svgEl.appendChild(defs);

        // ---- Background grid (subtle) ----
        for (let gx = 0; gx <= 820; gx += 40) {
            svgEl.appendChild(svgCreate('line', {
                x1: gx, y1: 0, x2: gx, y2: 520,
                stroke: 'rgba(0,212,255,0.03)', 'stroke-width': '0.5'
            }));
        }
        for (let gy = 0; gy <= 520; gy += 40) {
            svgEl.appendChild(svgCreate('line', {
                x1: 0, y1: gy, x2: 820, y2: gy,
                stroke: 'rgba(0,212,255,0.03)', 'stroke-width': '0.5'
            }));
        }

        /* ==========================================
           WIRES — drawn as paths, grouped for coloring
           ========================================== */

        // --- Collector current path wires ---
        // Wire: VCC down to buzzer top
        svgRefs.wireVccBuzzer = drawWire(`M ${CX.VCC_X} ${CX.VCC_Y + 30} V ${CX.BUZZER_Y - 25}`, 'wire-collector');

        // Wire: buzzer bottom to collector
        svgRefs.wireBuzzerColl = drawWire(`M ${CX.BJT_X} ${CX.BUZZER_Y + 25} V ${CX.BJT_COLL_Y - 10}`, 'wire-collector');

        // Wire: emitter to ground
        svgRefs.wireEmitGnd = drawWire(`M ${CX.BJT_X} ${CX.BJT_EMIT_Y + 10} V ${CX.GND_Y - 15}`, 'wire-common');

        // --- Base current path wires ---
        // Wire: sensor output right to RB start
        svgRefs.wireSensorRb = drawWire(`M ${CX.SENSOR_X + 55} ${CX.SENSOR_Y} H ${CX.RB_START}`, 'wire-base');

        // Wire: RB end to BJT base
        svgRefs.wireRbBase = drawWire(`M ${CX.RB_END} ${CX.BJT_BASE_Y} H ${CX.BJT_X - 30}`, 'wire-base');

        // --- Sensor ground wire ---
        svgRefs.wireSensorGnd = drawWire(
            `M ${CX.SENSOR_X} ${CX.SENSOR_Y + 35} V ${CX.GND_Y - 15}`,
            'wire-common'
        );

        // --- Common ground bus wire ---
        svgRefs.wireGndBus = drawWire(
            `M ${CX.SENSOR_X} ${CX.GND_Y - 15} H ${CX.BJT_X}`,
            'wire-common'
        );

        /* ==========================================
           COMPONENTS
           ========================================== */

        // ---- 12V Power Supply (Battery) ----
        drawBattery(CX.VCC_X, CX.VCC_Y);

        // ---- Buzzer ----
        drawBuzzer(CX.BUZZER_X, CX.BUZZER_Y);

        // ---- Flyback Diode ----
        drawFlybackDiode(CX.BUZZER_X + 60, CX.BUZZER_Y);

        // ---- NPN BJT Transistor ----
        drawBJT(CX.BJT_X, CX.BJT_BASE_Y);

        // ---- Base Resistor RB ----
        drawResistor(CX.RB_START, CX.BJT_BASE_Y, CX.RB_END - CX.RB_START);

        // ---- Sensor ----
        drawSensor(CX.SENSOR_X, CX.SENSOR_Y);

        // ---- Ground Symbols ----
        drawGround(CX.SENSOR_X, CX.GND_Y);
        drawGround(CX.BJT_X, CX.GND_Y);

        // ---- Current Flow Particles ----
        createParticles();
    }

    /** Draw a wire path */
    function drawWire(d, group) {
        const wire = svgCreate('path', {
            d: d,
            class: 'circuit-wire',
            'data-group': group,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round'
        });
        svgEl.appendChild(wire);
        return wire;
    }

    /** Draw battery symbol at (cx, cy) */
    function drawBattery(cx, cy) {
        const g = svgCreate('g', { class: 'component-battery' });

        // Long plate (positive)
        g.appendChild(svgCreate('line', {
            x1: cx - 15, y1: cy, x2: cx + 15, y2: cy,
            class: 'circuit-component', 'stroke-width': '3'
        }));
        // Short plate (negative)
        g.appendChild(svgCreate('line', {
            x1: cx - 8, y1: cy + 10, x2: cx + 8, y2: cy + 10,
            class: 'circuit-component', 'stroke-width': '3'
        }));
        // Second long plate
        g.appendChild(svgCreate('line', {
            x1: cx - 15, y1: cy + 20, x2: cx + 15, y2: cy + 20,
            class: 'circuit-component', 'stroke-width': '3'
        }));
        // Second short plate
        g.appendChild(svgCreate('line', {
            x1: cx - 8, y1: cy + 30, x2: cx + 8, y2: cy + 30,
            class: 'circuit-component', 'stroke-width': '3'
        }));

        // + label
        g.appendChild(svgText(cx - 28, cy + 5, '+', 'circuit-label bright', { 'font-size': '14' }));
        // - label
        g.appendChild(svgText(cx + 24, cy + 25, '−', 'circuit-label bright', { 'font-size': '14' }));
        // Voltage label
        g.appendChild(svgText(cx, cy - 14, '12V DC', 'circuit-label-value', { 'font-size': '12' }));

        // Top terminal wire (to VCC bus)
        g.appendChild(svgCreate('line', {
            x1: cx, y1: cy - 5, x2: cx, y2: cy,
            class: 'circuit-component', 'stroke-width': '2'
        }));

        svgEl.appendChild(g);
        svgRefs.battery = g;
    }

    /** Draw buzzer at (cx, cy) — circle with ~ */
    function drawBuzzer(cx, cy) {
        const g = svgCreate('g', { class: 'component-buzzer' });

        // Buzzer body (circle)
        const circle = svgCreate('circle', {
            cx: cx, cy: cy, r: '22',
            class: 'circuit-component', 'stroke-width': '2.5',
            fill: 'rgba(0,212,255,0.04)'
        });
        g.appendChild(circle);

        // Tilde symbol
        g.appendChild(svgText(cx, cy, '~', 'circuit-label bright', { 'font-size': '20' }));

        // + and - terminals
        g.appendChild(svgText(cx, cy - 32, '+', 'circuit-label bright', { 'font-size': '11' }));
        g.appendChild(svgText(cx, cy + 34, '−', 'circuit-label bright', { 'font-size': '11' }));

        // Label
        g.appendChild(svgText(cx - 50, cy - 6, 'DOORBELL', 'circuit-label', { 'font-size': '10', 'text-anchor': 'end' }));
        g.appendChild(svgText(cx - 50, cy + 8, 'BUZZER', 'circuit-label', { 'font-size': '10', 'text-anchor': 'end' }));
        g.appendChild(svgText(cx - 50, cy + 22, '120Ω (100mA)', 'circuit-label', { 'font-size': '9', 'text-anchor': 'end' }));

        // Sound wave circles (hidden initially)
        for (let i = 0; i < 3; i++) {
            const wave = svgCreate('circle', {
                cx: cx, cy: cy, r: '22',
                class: `sound-wave ${i === 1 ? 'delay-1' : i === 2 ? 'delay-2' : ''}`,
                'data-wave': i
            });
            g.appendChild(wave);
            if (!svgRefs.soundWaves) svgRefs.soundWaves = [];
            svgRefs.soundWaves.push(wave);
        }

        svgEl.appendChild(g);
        svgRefs.buzzerGroup = g;
        svgRefs.buzzerCircle = circle;
    }

    /** Draw flyback diode across buzzer */
    function drawFlybackDiode(cx, cy) {
        const g = svgCreate('g', { class: 'component-diode' });

        // Vertical wire from top of buzzer to diode top
        g.appendChild(svgCreate('line', {
            x1: cx, y1: cy - 25, x2: cx, y2: cy - 10,
            class: 'circuit-component'
        }));

        // Horizontal wire from buzzer top to diode top
        g.appendChild(svgCreate('line', {
            x1: CX.BUZZER_X, y1: cy - 25, x2: cx, y2: cy - 25,
            class: 'circuit-component'
        }));

        // Diode triangle (pointing up = cathode at top)
        g.appendChild(svgCreate('polygon', {
            points: `${cx - 8},${cy - 10} ${cx + 8},${cy - 10} ${cx},${cy + 6}`,
            class: 'circuit-component-fill',
            stroke: '#4a5a7c', 'stroke-width': '1.5'
        }));

        // Cathode bar
        g.appendChild(svgCreate('line', {
            x1: cx - 8, y1: cy - 10, x2: cx + 8, y2: cy - 10,
            stroke: '#4a5a7c', 'stroke-width': '2.5'
        }));

        // Vertical wire from diode bottom to buzzer bottom
        g.appendChild(svgCreate('line', {
            x1: cx, y1: cy + 6, x2: cx, y2: cy + 25,
            class: 'circuit-component'
        }));

        // Horizontal wire from buzzer bottom to diode bottom
        g.appendChild(svgCreate('line', {
            x1: CX.BUZZER_X, y1: cy + 25, x2: cx, y2: cy + 25,
            class: 'circuit-component'
        }));

        // Label
        g.appendChild(svgText(cx + 20, cy - 4, 'D₁ (1N4001)', 'circuit-label', { 'font-size': '9' }));
        g.appendChild(svgText(cx + 20, cy + 8, 'Flyback Diode', 'circuit-label', { 'font-size': '8', fill: 'var(--yellow)' }));

        svgEl.appendChild(g);
        svgRefs.diode = g;
    }

    /** Draw NPN BJT transistor at base position (bx, by) */
    function drawBJT(bx, by) {
        const g = svgCreate('g', { class: 'component-bjt' });

        // Vertical body line
        const bodyX = bx - 15;
        g.appendChild(svgCreate('line', {
            x1: bodyX, y1: by - 30, x2: bodyX, y2: by + 30,
            class: 'circuit-component', 'stroke-width': '3'
        }));

        // Base terminal line (horizontal into body)
        g.appendChild(svgCreate('line', {
            x1: bx - 30, y1: by, x2: bodyX, y2: by,
            class: 'circuit-component', 'stroke-width': '2'
        }));

        // Collector line (from body going up-right to collector point)
        const collY = by - 50;
        g.appendChild(svgCreate('line', {
            x1: bodyX, y1: by - 18, x2: bx, y2: collY,
            class: 'circuit-component', 'stroke-width': '2'
        }));
        // Collector vertical wire up
        g.appendChild(svgCreate('line', {
            x1: bx, y1: collY, x2: bx, y2: CX.BJT_COLL_Y - 10,
            class: 'circuit-component', 'stroke-width': '2'
        }));

        // Emitter line (from body going down-right to emitter point)
        const emitY = by + 50;
        g.appendChild(svgCreate('line', {
            x1: bodyX, y1: by + 18, x2: bx, y2: emitY,
            class: 'circuit-component', 'stroke-width': '2'
        }));
        // Emitter vertical wire down
        g.appendChild(svgCreate('line', {
            x1: bx, y1: emitY, x2: bx, y2: CX.BJT_EMIT_Y + 10,
            class: 'circuit-component', 'stroke-width': '2'
        }));

        // Emitter arrow (pointing away from body → NPN)
        const arrowTip = { x: bx, y: emitY };
        const arrowBase = { x: bodyX, y: by + 18 };
        // Calculate arrow direction for arrowhead
        const dx = arrowTip.x - arrowBase.x;
        const dy = arrowTip.y - arrowBase.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const ux = dx / len, uy = dy / len;
        const px = -uy, py = ux;
        const aSize = 6;
        const aBack = 10;
        const ax1 = arrowTip.x - ux * aBack + px * aSize;
        const ay1 = arrowTip.y - uy * aBack + py * aSize;
        const ax2 = arrowTip.x - ux * aBack - px * aSize;
        const ay2 = arrowTip.y - uy * aBack - py * aSize;

        g.appendChild(svgCreate('polygon', {
            points: `${arrowTip.x},${arrowTip.y} ${ax1},${ay1} ${ax2},${ay2}`,
            class: 'circuit-component-fill'
        }));

        // Terminal labels
        g.appendChild(svgText(bx - 46, by, 'B', 'circuit-label bright', { 'font-size': '12' }));
        g.appendChild(svgText(bx + 16, CX.BJT_COLL_Y - 5, 'C', 'circuit-label bright', { 'font-size': '12' }));
        g.appendChild(svgText(bx + 16, CX.BJT_EMIT_Y + 10, 'E', 'circuit-label bright', { 'font-size': '12' }));

        // Component label
        g.appendChild(svgText(bx + 30, by - 10, 'Q₁', 'circuit-label', { 'font-size': '11' }));
        g.appendChild(svgText(bx + 30, by + 4, '2N2222', 'circuit-label', { 'font-size': '9' }));
        g.appendChild(svgText(bx + 30, by + 16, 'NPN (β=80)', 'circuit-label', { 'font-size': '8.5' }));

        // Circle outline (TO-92 package representation)
        g.appendChild(svgCreate('circle', {
            cx: bx - 8, cy: by, r: '42',
            fill: 'none', stroke: 'rgba(0,212,255,0.08)', 'stroke-width': '1',
            'stroke-dasharray': '4 4'
        }));

        svgEl.appendChild(g);
        svgRefs.bjt = g;
    }

    /** Draw zigzag resistor from (x, y) with given width */
    function drawResistor(x, y, width) {
        const g = svgCreate('g', { class: 'component-resistor' });

        // Lead-in wire
        const leadIn = 20;
        const leadOut = 20;
        const zigWidth = width - leadIn - leadOut;
        const zigCount = 6;
        const zigStep = zigWidth / zigCount;
        const zigHeight = 10;

        // Build zigzag path
        let d = `M ${x} ${y} H ${x + leadIn}`;
        for (let i = 0; i < zigCount; i++) {
            const sx = x + leadIn + i * zigStep;
            if (i % 2 === 0) {
                d += ` L ${sx + zigStep / 2} ${y - zigHeight} L ${sx + zigStep} ${y}`;
            } else {
                d += ` L ${sx + zigStep / 2} ${y + zigHeight} L ${sx + zigStep} ${y}`;
            }
        }
        d += ` H ${x + width}`;

        const path = svgCreate('path', {
            d: d,
            class: 'circuit-component',
            'stroke-width': '2',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round'
        });
        g.appendChild(path);

        // RB value label (updates dynamically)
        const rbLabel = svgText(
            x + width / 2, y - 24,
            formatResistance(BJT.currentRB),
            'circuit-label-value', { 'font-size': '13' }
        );
        g.appendChild(rbLabel);
        svgRefs.rbSvgLabel = rbLabel;

        // Component label
        g.appendChild(svgText(x + width / 2, y + 24, 'RB', 'circuit-label', { 'font-size': '11' }));

        svgEl.appendChild(g);
        svgRefs.resistor = g;
        svgRefs.resistorPath = path;
    }

    /** Draw sensor input block */
    function drawSensor(cx, cy) {
        const g = svgCreate('g', { class: 'component-sensor' });
        const w = 80, h = 60;
        const rx = cx - w / 2 + 15;
        const ry = cy - h / 2;

        // Rectangle body
        const rect = svgCreate('rect', {
            x: rx, y: ry, width: w, height: h,
            rx: '6', ry: '6',
            class: 'circuit-component',
            fill: 'rgba(0,212,255,0.04)',
            'stroke-width': '2'
        });
        g.appendChild(rect);

        // Label
        g.appendChild(svgText(rx + w / 2, cy - 10, 'SENSOR', 'circuit-label bright', { 'font-size': '11' }));
        g.appendChild(svgText(rx + w / 2, cy + 5, '3.3V OUT (2mA)', 'circuit-label', { 'font-size': '8' }));

        // Status indicator dot
        const statusDot = svgCreate('circle', {
            cx: rx + w / 2, cy: cy + 20,
            r: '4', fill: '#ff1744'
        });
        g.appendChild(statusDot);
        svgRefs.sensorDot = statusDot;

        // Output terminal (right side)
        g.appendChild(svgCreate('line', {
            x1: rx + w, y1: cy, x2: rx + w + 10, y2: cy,
            class: 'circuit-component', 'stroke-width': '2'
        }));

        // Ground terminal (bottom)
        g.appendChild(svgCreate('line', {
            x1: rx + w / 2, y1: ry + h, x2: rx + w / 2, y2: ry + h + 5,
            class: 'circuit-component', 'stroke-width': '2'
        }));

        // GND label
        g.appendChild(svgText(rx + w / 2 - 20, cy + 40, 'GND', 'circuit-label', { 'font-size': '9' }));

        svgEl.appendChild(g);
        svgRefs.sensor = g;
        svgRefs.sensorRect = rect;
    }

    /** Draw ground symbol at (cx, cy) */
    function drawGround(cx, cy) {
        const g = svgCreate('g', { class: 'component-ground' });
        const lineWidths = [20, 14, 8];
        for (let i = 0; i < 3; i++) {
            const lw = lineWidths[i];
            g.appendChild(svgCreate('line', {
                x1: cx - lw / 2, y1: cy + i * 6,
                x2: cx + lw / 2, y2: cy + i * 6,
                class: 'circuit-component', 'stroke-width': '2'
            }));
        }
        svgEl.appendChild(g);
    }

    /* =======================================================
       3. CURRENT FLOW ANIMATION SYSTEM
       ======================================================= */

    /** Particle data store */
    const particles = {
        base: [],      // Cyan particles for base current path
        collector: []  // Yellow particles for collector current path
    };

    /** Define paths for particles to follow */
    const particlePaths = {
        // Base current: Sensor → RB → Base → (through BJT body) → Emitter → Ground
        base: [
            // Sensor output to RB start
            { x1: CX.SENSOR_X + 55, y1: CX.SENSOR_Y, x2: CX.RB_START, y2: CX.SENSOR_Y },
            // Through RB
            { x1: CX.RB_START, y1: CX.BJT_BASE_Y, x2: CX.RB_END, y2: CX.BJT_BASE_Y },
            // RB end to BJT Base
            { x1: CX.RB_END, y1: CX.BJT_BASE_Y, x2: CX.BJT_X - 30, y2: CX.BJT_BASE_Y },
            // Base down through transistor to emitter
            { x1: CX.BJT_X, y1: CX.BJT_BASE_Y, x2: CX.BJT_X, y2: CX.BJT_EMIT_Y + 10 },
            // Emitter to ground
            { x1: CX.BJT_X, y1: CX.BJT_EMIT_Y + 10, x2: CX.BJT_X, y2: CX.GND_Y - 15 }
        ],
        // Collector current: VCC → Buzzer → Collector → (through BJT) → Emitter → Ground
        collector: [
            // VCC down to buzzer top
            { x1: CX.VCC_X, y1: CX.VCC_Y + 30, x2: CX.VCC_X, y2: CX.BUZZER_Y - 25 },
            // Buzzer bottom to collector
            { x1: CX.BJT_X, y1: CX.BUZZER_Y + 25, x2: CX.BJT_X, y2: CX.BJT_COLL_Y - 10 },
            // Through BJT (collector to emitter)
            { x1: CX.BJT_X, y1: CX.BJT_COLL_Y - 10, x2: CX.BJT_X, y2: CX.BJT_EMIT_Y + 10 },
            // Emitter to ground
            { x1: CX.BJT_X, y1: CX.BJT_EMIT_Y + 10, x2: CX.BJT_X, y2: CX.GND_Y - 15 }
        ]
    };

    /** Create particle SVG circles */
    function createParticles() {
        const PARTICLE_COUNT = 8;

        // Base current particles (cyan)
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const p = svgCreate('circle', {
                r: '3',
                fill: '#00e5ff',
                class: 'current-particle',
                filter: 'url(#noFilter)'
            });
            svgEl.appendChild(p);
            particles.base.push({
                el: p,
                progress: i / PARTICLE_COUNT,
                speed: 0.004
            });
        }

        // Collector current particles (yellow)
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const p = svgCreate('circle', {
                r: '3.5',
                fill: '#ffd600',
                class: 'current-particle',
                filter: 'url(#noFilter)'
            });
            svgEl.appendChild(p);
            particles.collector.push({
                el: p,
                progress: i / PARTICLE_COUNT,
                speed: 0.006
            });
        }

        // Add glow filters
        const glowDefs = svgEl.querySelector('defs') || svgCreate('defs');

        // Cyan glow
        const cyanGlow = svgCreate('filter', { id: 'glowCyan', x: '-50%', y: '-50%', width: '200%', height: '200%' });
        const cgBlur = svgCreate('feGaussianBlur', { stdDeviation: '3', result: 'blur' });
        const cgMerge = svgCreate('feMerge');
        cgMerge.appendChild(svgCreate('feMergeNode', { in: 'blur' }));
        cgMerge.appendChild(svgCreate('feMergeNode', { in: 'SourceGraphic' }));
        cyanGlow.appendChild(cgBlur);
        cyanGlow.appendChild(cgMerge);
        glowDefs.appendChild(cyanGlow);

        // Yellow glow
        const yellowGlow = svgCreate('filter', { id: 'glowYellow', x: '-50%', y: '-50%', width: '200%', height: '200%' });
        const ygBlur = svgCreate('feGaussianBlur', { stdDeviation: '3', result: 'blur' });
        const ygMerge = svgCreate('feMerge');
        ygMerge.appendChild(svgCreate('feMergeNode', { in: 'blur' }));
        ygMerge.appendChild(svgCreate('feMergeNode', { in: 'SourceGraphic' }));
        yellowGlow.appendChild(ygBlur);
        yellowGlow.appendChild(ygMerge);
        glowDefs.appendChild(yellowGlow);

        if (!svgEl.querySelector('defs')) svgEl.prepend(glowDefs);

        // Apply glow filters
        particles.base.forEach(p => p.el.setAttribute('filter', 'url(#glowCyan)'));
        particles.collector.forEach(p => p.el.setAttribute('filter', 'url(#glowYellow)'));
    }

    /** Get position along a set of line segments at progress [0,1] */
    function getPositionOnPath(segments, progress) {
        // Calculate total length
        let totalLen = 0;
        const segLens = segments.map(s => {
            const dx = s.x2 - s.x1;
            const dy = s.y2 - s.y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            totalLen += len;
            return len;
        });

        let targetDist = progress * totalLen;
        for (let i = 0; i < segments.length; i++) {
            if (targetDist <= segLens[i]) {
                const t = segLens[i] > 0 ? targetDist / segLens[i] : 0;
                return {
                    x: segments[i].x1 + (segments[i].x2 - segments[i].x1) * t,
                    y: segments[i].y1 + (segments[i].y2 - segments[i].y1) * t
                };
            }
            targetDist -= segLens[i];
        }
        // End of path
        const last = segments[segments.length - 1];
        return { x: last.x2, y: last.y2 };
    }

    /** Animate current flow particles */
    let lastParticleTime = 0;
    function animateParticles(timestamp) {
        if (!lastParticleTime) lastParticleTime = timestamp;
        const dt = timestamp - lastParticleTime;
        lastParticleTime = timestamp;

        const result = BJT.calculate(BJT.currentRB, BJT.sensorActive);
        const isActive = result.sensorActive && result.region !== 'cutoff';

        // Speed proportional to current magnitude (smooth visual flow)
        const baseSpeed = isActive ? Math.min(0.015, 0.002 + (result.ib_mA * 0.0003)) : 0;
        const collSpeed = isActive ? Math.min(0.015, 0.002 + (result.ic_mA * 0.00004)) : 0;

        // Animate base particles
        particles.base.forEach(p => {
            if (isActive) {
                p.el.classList.add('visible');
                p.progress += baseSpeed * (dt / 16);
                if (p.progress > 1) p.progress -= 1;
                const pos = getPositionOnPath(particlePaths.base, p.progress);
                p.el.setAttribute('cx', pos.x);
                p.el.setAttribute('cy', pos.y);
            } else {
                p.el.classList.remove('visible');
            }
        });

        // Animate collector particles
        particles.collector.forEach(p => {
            if (isActive) {
                p.el.classList.add('visible');
                p.progress += collSpeed * (dt / 16);
                if (p.progress > 1) p.progress -= 1;
                const pos = getPositionOnPath(particlePaths.collector, p.progress);
                p.el.setAttribute('cx', pos.x);
                p.el.setAttribute('cy', pos.y);
            } else {
                p.el.classList.remove('visible');
            }
        });

        particleAnimId = requestAnimationFrame(animateParticles);
    }

    /* =======================================================
       4. BUZZER AUDIO SYSTEM (Web Audio API)
       ======================================================= */

    let audioCtx = null;
    let oscillator = null;
    let gainNode = null;
    let audioStarted = false;
    let buzzerPlaying = false;

    /** Initialize Web Audio API (must be called from user gesture) */
    function initAudio() {
        if (audioCtx) return;
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            gainNode = audioCtx.createGain();
            gainNode.gain.value = 0;
            gainNode.connect(audioCtx.destination);

            oscillator = audioCtx.createOscillator();
            oscillator.type = 'square';
            oscillator.frequency.value = 800;
            oscillator.connect(gainNode);
            oscillator.start();
            audioStarted = true;
        } catch (e) {
            console.warn('Web Audio API not available:', e);
        }
    }

    /** Start or stop buzzer tone */
    function setBuzzerSound(on) {
        if (!audioCtx || !gainNode) return;
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        if (on && !isMuted) {
            gainNode.gain.setTargetAtTime(0.08, audioCtx.currentTime, 0.02);
            buzzerPlaying = true;
        } else {
            gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.02);
            buzzerPlaying = false;
        }
    }

    /* =======================================================
       5. THREE.JS 3D SCENE
       ======================================================= */

    let camera3D, controls3D;
    let threejsInitialized = false;
    let rbSprite = null; // Floating RB text sprite

    /** Create 3D PCB board scene */
    function init3DScene() {
        if (threejsInitialized) return;
        if (typeof THREE === 'undefined') {
            console.warn('Three.js not loaded');
            return;
        }
        threejsInitialized = true;

        // Scene
        scene3D = new THREE.Scene();
        scene3D.background = new THREE.Color(0x050910);
        scene3D.fog = new THREE.FogExp2(0x050910, 0.03);

        // Camera
        camera3D = new THREE.PerspectiveCamera(50, container3D.clientWidth / container3D.clientHeight, 0.1, 100);
        camera3D.position.set(6, 8, 10);
        camera3D.lookAt(0, 0, 0);

        // Renderer
        renderer3D = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer3D.setSize(container3D.clientWidth, container3D.clientHeight);
        renderer3D.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer3D.shadowMap.enabled = true;
        container3D.appendChild(renderer3D.domElement);

        // Controls
        controls3D = new THREE.OrbitControls(camera3D, renderer3D.domElement);
        controls3D.enableDamping = true;
        controls3D.dampingFactor = 0.08;
        controls3D.minDistance = 5;
        controls3D.maxDistance = 25;

        // Lighting
        const ambient = new THREE.AmbientLight(0x334466, 0.5);
        scene3D.add(ambient);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 10, 7);
        dirLight.castShadow = true;
        scene3D.add(dirLight);

        const pointLight = new THREE.PointLight(0x00d4ff, 0.6, 20);
        pointLight.position.set(0, 4, 0);
        scene3D.add(pointLight);

        // === PCB Board ===
        const pcbGeom = new THREE.BoxGeometry(12, 0.3, 8);
        const pcbMat = new THREE.MeshPhongMaterial({
            color: 0x0a6e3a,
            specular: 0x114422,
            shininess: 30
        });
        const pcb = new THREE.Mesh(pcbGeom, pcbMat);
        pcb.position.set(0, 0, 0);
        pcb.receiveShadow = true;
        scene3D.add(pcb);

        // PCB edge highlight
        const edgeGeom = new THREE.EdgesGeometry(pcbGeom);
        const edgeMat = new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.3 });
        const edges = new THREE.LineSegments(edgeGeom, edgeMat);
        pcb.add(edges);

        // PCB copper traces (decorative lines on top)
        const traceMat = new THREE.MeshBasicMaterial({ color: 0xb87333 });
        function addTrace(x1, z1, x2, z2) {
            const dx = x2 - x1, dz = z2 - z1;
            const len = Math.sqrt(dx * dx + dz * dz);
            const traceGeom = new THREE.BoxGeometry(len, 0.02, 0.12);
            const trace = new THREE.Mesh(traceGeom, traceMat);
            trace.position.set((x1 + x2) / 2, 0.16, (z1 + z2) / 2);
            trace.rotation.y = Math.atan2(dz, dx);
            scene3D.add(trace);
        }
        // Traces connecting components
        addTrace(-4, 0, -1.5, 0);    // Sensor to resistor
        addTrace(-1.5, 0, 0, 0);     // Resistor to BJT base
        addTrace(0, -2, 0, 2);       // BJT vertical
        addTrace(0, -2, 3, -2);      // Collector trace up
        addTrace(3, -2, 3, 2);       // Buzzer vertical trace
        addTrace(0, 2, 2, 2);        // Emitter to ground

        // === Resistor (3D cylinder with color bands) ===
        const resBody = new THREE.CylinderGeometry(0.25, 0.25, 1.8, 16);
        const resMat = new THREE.MeshPhongMaterial({ color: 0xd4a76a });
        const resistor = new THREE.Mesh(resBody, resMat);
        resistor.rotation.z = Math.PI / 2;
        resistor.position.set(-2.5, 0.5, 0);
        resistor.castShadow = true;
        scene3D.add(resistor);

        // Color bands on resistor
        const bandColors = [0xff6600, 0xff6600, 0x964B00, 0xffd700]; // Decorative
        bandColors.forEach((color, i) => {
            const bandGeom = new THREE.CylinderGeometry(0.27, 0.27, 0.12, 16);
            const bandMat = new THREE.MeshPhongMaterial({ color });
            const band = new THREE.Mesh(bandGeom, bandMat);
            band.rotation.z = Math.PI / 2;
            band.position.set(-2.5 + (i - 1.5) * 0.35, 0.5, 0);
            scene3D.add(band);
        });

        // Resistor lead wires
        const leadMat = new THREE.MeshBasicMaterial({ color: 0x888888 });
        [-1, 1].forEach(side => {
            const leadGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8);
            const lead = new THREE.Mesh(leadGeom, leadMat);
            lead.rotation.z = Math.PI / 2;
            lead.position.set(-2.5 + side * 1.2, 0.5, 0);
            scene3D.add(lead);
        });

        // === BJT Transistor (TO-92 package) ===
        // Semi-cylindrical body
        const bjtGeom = new THREE.CylinderGeometry(0.45, 0.45, 0.9, 16, 1, false, 0, Math.PI);
        const bjtMat = new THREE.MeshPhongMaterial({
            color: 0x1a1a1a,
            specular: 0x333333,
            shininess: 60
        });
        const bjtBody = new THREE.Mesh(bjtGeom, bjtMat);
        bjtBody.rotation.y = Math.PI / 2;
        bjtBody.position.set(0, 0.7, 0);
        bjtBody.castShadow = true;
        scene3D.add(bjtBody);

        // Flat face
        const flatGeom = new THREE.PlaneGeometry(0.9, 0.9);
        const flatMat = new THREE.MeshPhongMaterial({ color: 0x222222, side: THREE.DoubleSide });
        const flatFace = new THREE.Mesh(flatGeom, flatMat);
        flatFace.rotation.y = Math.PI / 2;
        flatFace.position.set(0, 0.7, 0);
        scene3D.add(flatFace);

        // BJT Pins
        const pinMat = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
        [-0.25, 0, 0.25].forEach((offset, i) => {
            const pinGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8);
            const pin = new THREE.Mesh(pinGeom, pinMat);
            pin.position.set(offset, 0.1, 0);
            scene3D.add(pin);
        });

        // BJT label (small text)
        const bjtLabel = makeTextSprite('2N2222', { fontSize: 32, color: '#00d4ff' });
        bjtLabel.position.set(0, 1.6, 0);
        bjtLabel.scale.set(1.5, 0.5, 1);
        scene3D.add(bjtLabel);

        // === Buzzer (cylinder) ===
        const buzzGeom = new THREE.CylinderGeometry(0.7, 0.7, 0.5, 24);
        const buzzMat = new THREE.MeshPhongMaterial({
            color: 0x111111,
            specular: 0x444444,
            shininess: 80
        });
        const buzzer3D = new THREE.Mesh(buzzGeom, buzzMat);
        buzzer3D.position.set(3, 0.5, -2);
        buzzer3D.castShadow = true;
        scene3D.add(buzzer3D);

        // Buzzer top ring
        const ringGeom = new THREE.TorusGeometry(0.6, 0.05, 8, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.5 });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(3, 0.76, -2);
        scene3D.add(ring);

        // Buzzer label
        const buzzLabel = makeTextSprite('BUZZER', { fontSize: 28, color: '#00e5ff' });
        buzzLabel.position.set(3, 1.5, -2);
        buzzLabel.scale.set(1.5, 0.5, 1);
        scene3D.add(buzzLabel);

        // Buzzer pins
        [-0.2, 0.2].forEach(offset => {
            const pinGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8);
            const pin = new THREE.Mesh(pinGeom, pinMat);
            pin.position.set(3 + offset, 0.1, -2);
            scene3D.add(pin);
        });

        // === Sensor block ===
        const sensorGeom = new THREE.BoxGeometry(1.2, 0.5, 0.8);
        const sensorMat = new THREE.MeshPhongMaterial({
            color: 0x1a2a4a,
            specular: 0x224488,
            shininess: 40
        });
        const sensor3D = new THREE.Mesh(sensorGeom, sensorMat);
        sensor3D.position.set(-4.5, 0.4, 0);
        sensor3D.castShadow = true;
        scene3D.add(sensor3D);

        const sensorLabel = makeTextSprite('SENSOR', { fontSize: 28, color: '#00d4ff' });
        sensorLabel.position.set(-4.5, 1.2, 0);
        sensorLabel.scale.set(1.5, 0.5, 1);
        scene3D.add(sensorLabel);

        // === 3D Wires connecting components ===
        const wireMat3D = new THREE.MeshBasicMaterial({ color: 0x00aacc, transparent: true, opacity: 0.7 });
        function addWire3D(from, to) {
            const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
            const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const wireGeom = new THREE.CylinderGeometry(0.04, 0.04, len, 8);
            const wire = new THREE.Mesh(wireGeom, wireMat3D);
            wire.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
            wire.lookAt(to.x, to.y, to.z);
            wire.rotateX(Math.PI / 2);
            scene3D.add(wire);
        }
        // Sensor to resistor
        addWire3D({ x: -3.9, y: 0.5, z: 0 }, { x: -3.4, y: 0.5, z: 0 });
        // Resistor to BJT
        addWire3D({ x: -1.6, y: 0.5, z: 0 }, { x: -0.3, y: 0.5, z: 0 });
        // BJT to ground
        addWire3D({ x: 0, y: 0.15, z: 0 }, { x: 0, y: 0.15, z: 2 });
        // BJT collector up
        addWire3D({ x: 0, y: 0.5, z: -0.3 }, { x: 0, y: 0.5, z: -2 });
        // To buzzer
        addWire3D({ x: 0, y: 0.5, z: -2 }, { x: 2.3, y: 0.5, z: -2 });
        // VCC wire
        addWire3D({ x: 3.7, y: 0.5, z: -2 }, { x: 5, y: 0.5, z: -2 });

        // === RB value floating sprite ===
        rbSprite = makeTextSprite(formatResistance(BJT.currentRB), { fontSize: 36, color: '#00d4ff', background: 'rgba(5,9,16,0.85)' });
        rbSprite.position.set(-2.5, 1.6, 0);
        rbSprite.scale.set(2, 0.7, 1);
        scene3D.add(rbSprite);

        // Handle resize
        window.addEventListener('resize', on3DResize);
    }

    /** Make a text sprite for 3D labels */
    function makeTextSprite(text, opts) {
        opts = opts || {};
        const fontSize = opts.fontSize || 48;
        const color = opts.color || '#ffffff';
        const bg = opts.background || 'transparent';

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 128;

        if (bg !== 'transparent') {
            ctx.fillStyle = bg;
            ctx.roundRect(0, 0, 256, 128, 12);
            ctx.fill();
        }

        ctx.font = `bold ${fontSize}px 'Share Tech Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.fillText(text, 128, 64);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        return sprite;
    }

    /** Update RB text in 3D sprite */
    function update3DRBLabel(rbValue) {
        if (!rbSprite || !scene3D) return;
        scene3D.remove(rbSprite);
        rbSprite = makeTextSprite(formatResistance(rbValue), { fontSize: 36, color: '#00d4ff', background: 'rgba(5,9,16,0.85)' });
        rbSprite.position.set(-2.5, 1.6, 0);
        rbSprite.scale.set(2, 0.7, 1);
        scene3D.add(rbSprite);
    }

    /** Handle 3D container resize */
    function on3DResize() {
        if (!camera3D || !renderer3D) return;
        const w = container3D.clientWidth;
        const h = container3D.clientHeight;
        camera3D.aspect = w / h;
        camera3D.updateProjectionMatrix();
        renderer3D.setSize(w, h);
    }

    /** 3D render loop */
    function animate3D() {
        if (currentView !== '3d') return;
        animFrameId = requestAnimationFrame(animate3D);
        if (controls3D) controls3D.update();
        if (renderer3D && scene3D && camera3D) {
            renderer3D.render(scene3D, camera3D);
        }
    }

    /* =======================================================
       6. POPUP MANAGEMENT
       ======================================================= */

    /** Setup hover popups on measurement elements */
    function initPopups() {
        const popupConfigs = [
            { trigger: 'rb-value-box', popup: 'popup-rb' },
            { trigger: 'card-ib',      popup: 'popup-ib' },
            { trigger: 'card-ic',      popup: 'popup-ic' },
            { trigger: 'panel-pd',     popup: 'popup-pd' }
        ];

        popupConfigs.forEach(cfg => {
            const triggerEl = document.getElementById(cfg.trigger);
            const popupEl  = document.getElementById(cfg.popup);
            if (!triggerEl || !popupEl) return;

            let hoverTimeout = null;
            let isTouch = false;

            // Mouse events
            triggerEl.addEventListener('mouseenter', () => {
                if (isTouch) return;
                clearTimeout(hoverTimeout);
                showPopup(popupEl);
            });

            triggerEl.addEventListener('mouseleave', () => {
                if (isTouch) return;
                hoverTimeout = setTimeout(() => hidePopup(popupEl), 200);
            });

            // Keep popup visible when hovering over it
            popupEl.addEventListener('mouseenter', () => {
                clearTimeout(hoverTimeout);
            });
            popupEl.addEventListener('mouseleave', () => {
                hoverTimeout = setTimeout(() => hidePopup(popupEl), 200);
            });

            // Touch support (tap to toggle)
            triggerEl.addEventListener('touchstart', (e) => {
                isTouch = true;
                e.preventDefault();
                if (popupEl.classList.contains('visible')) {
                    hidePopup(popupEl);
                } else {
                    // Hide all other popups first
                    document.querySelectorAll('.hover-popup.visible').forEach(p => hidePopup(p));
                    showPopup(popupEl);
                }
            }, { passive: false });
        });

        // Dismiss popups on outside tap (mobile)
        document.addEventListener('touchstart', (e) => {
            if (!e.target.closest('.popup-anchor')) {
                document.querySelectorAll('.hover-popup.visible').forEach(p => hidePopup(p));
            }
        });
    }

    function showPopup(el) {
        // Dismiss any other open popups first
        document.querySelectorAll('.hover-popup.visible').forEach(p => {
            if (p !== el) hidePopup(p);
        });

        el.classList.add('visible');

        // Elevate parent stacking contexts to guarantee popup is above all other boxes
        const anchor = el.closest('.popup-anchor');
        if (anchor) {
            anchor.classList.add('active-popup');
            anchor.style.zIndex = '1000';
        }
        const cardsRow = el.closest('.cards-row');
        if (cardsRow) {
            cardsRow.classList.add('active-popup');
            cardsRow.style.zIndex = '1000';
        }

        // Re-render KaTeX inside popup if available
        if (typeof renderMathInElement === 'function') {
            renderMathInElement(el, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '\\(', right: '\\)', display: false }
                ],
                throwOnError: false
            });
        }
    }

    function hidePopup(el) {
        el.classList.remove('visible');

        const anchor = el.closest('.popup-anchor');
        if (anchor) {
            anchor.classList.remove('active-popup');
            anchor.style.zIndex = '';
        }
        const cardsRow = el.closest('.cards-row');
        if (cardsRow) {
            cardsRow.classList.remove('active-popup');
            cardsRow.style.zIndex = '';
        }
    }

    /* =======================================================
       7. SLIDER / SENSOR EVENT HANDLERS
       ======================================================= */

    /** Handle RB slider input (slider updates the output box) */
    function onSliderInput() {
        const rb = parseInt(rbSlider.value, 10);
        if (rbNum && document.activeElement !== rbNum) {
            rbNum.textContent = rb;
        }
        updateAll(rb, BJT.sensorActive);
        BJTState.save({ rb: rb, sensorActive: BJT.sensorActive });
    }

    /** Handle direct typing into the RB display box */
    function onRbNumInput() {
        let text = rbNum.innerText.replace(/[^0-9]/g, '');
        let val = parseInt(text, 10);
        if (isNaN(val)) val = 0;
        val = Math.max(0, Math.min(100000, val));
        if (rbSlider && document.activeElement !== rbSlider) {
            rbSlider.value = val;
        }
        updateAll(val, BJT.sensorActive);
        BJTState.save({ rb: val, sensorActive: BJT.sensorActive });
    }

    function onRbNumBlur() {
        let text = rbNum.innerText.replace(/[^0-9]/g, '');
        let val = parseInt(text, 10);
        if (isNaN(val) || val < 0) val = 0;
        val = Math.max(0, Math.min(100000, val));
        rbNum.textContent = val;
        if (rbSlider) {
            rbSlider.value = val;
        }
        updateAll(val, BJT.sensorActive);
        BJTState.save({ rb: val, sensorActive: BJT.sensorActive });
    }

    /** Handle sensor ON button */
    function onSensorOn() {
        initAudio(); // Ensure audio context exists (user gesture)
        updateAll(BJT.currentRB, true);
    }

    /** Handle sensor OFF button */
    function onSensorOff() {
        updateAll(BJT.currentRB, false);
    }

    /** Handle mute toggle */
    function onMuteToggle() {
        initAudio();
        isMuted = !isMuted;

        if (isMuted) {
            muteIcon.className = 'fas fa-volume-xmark';
            muteLabel.textContent = 'MUTED';
            btnMute.classList.add('muted');
            setBuzzerSound(false);
        } else {
            muteIcon.className = 'fas fa-volume-up';
            muteLabel.textContent = 'UNMUTED';
            btnMute.classList.remove('muted');
            // Re-enable sound if buzzer should be playing (in saturation)
            const result = BJT.calculate(BJT.currentRB, BJT.sensorActive);
            if (result.region === 'saturation') {
                setBuzzerSound(true);
            }
        }
    }

    /** Handle 2D/3D view toggle */
    function onViewToggle(view) {
        if (view === currentView) return;
        currentView = view;

        if (view === '2d') {
            btn2D.classList.add('active');
            btn3D.classList.remove('active');
            svgContainer.style.display = 'flex';
            container3D.style.display = 'none';
            if (animFrameId) cancelAnimationFrame(animFrameId);
        } else {
            btn2D.classList.remove('active');
            btn3D.classList.add('active');
            svgContainer.style.display = 'none';
            container3D.style.display = 'block';
            init3DScene();
            on3DResize();
            animate3D();
        }
    }

    // Bind events
    rbSlider.addEventListener('input', onSliderInput);
    if (rbNum) {
        rbNum.addEventListener('input', onRbNumInput);
        rbNum.addEventListener('blur', onRbNumBlur);
        rbNum.addEventListener('focus', () => {
            const popup = document.getElementById('popup-rb');
            if (popup) hidePopup(popup);
        });
        rbNum.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                rbNum.blur();
            }
        });
    }
    if (rbValueBox && rbNum) {
        rbValueBox.addEventListener('click', (e) => {
            if (document.activeElement !== rbNum) {
                rbNum.focus();
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(rbNum);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        });
    }
    btnSensorOn.addEventListener('click', onSensorOn);
    btnSensorOff.addEventListener('click', onSensorOff);
    btnMute.addEventListener('click', onMuteToggle);
    btn2D.addEventListener('click', () => onViewToggle('2d'));
    btn3D.addEventListener('click', () => onViewToggle('3d'));

    /* =======================================================
       8. UPDATE / RENDER LOOP
       ======================================================= */

    /** Master update: recalculate everything and refresh all displays */
    function updateAll(rb, sensorActive) {
        // 1. Run calculation engine
        const result = BJT.calculate(rb, sensorActive);

        // 2. Update slider position
        if (rbSlider && document.activeElement !== rbSlider) {
            rbSlider.value = rb;
        }

        // 3. Update the output box number (acting as slider output)
        if (rbNum && document.activeElement !== rbNum) {
            rbNum.textContent = rb;
        }

        // 4. Update RB display in SVG
        if (svgRefs.rbSvgLabel) {
            svgRefs.rbSvgLabel.textContent = formatResistance(rb);
        }

        // 5. Update IB card
        ibDisplay.innerHTML = formatValue(result.ib_mA, 2) + '<span class="mc-unit">mA</span>';

        // 6. Update IC card
        icDisplay.innerHTML = formatValue(result.ic_mA, 2) + '<span class="mc-unit">mA</span>';

        // 7. Update PD panel
        pdDisplay.textContent = formatPower(result.pd);
        if (result.pd > BJT.MAX_PD) {
            pdDisplay.className = 'panel-value danger';
            pdStatusEl.className = 'pd-status danger';
            pdStatusEl.innerHTML = '<i class="fas fa-triangle-exclamation"></i> EXCEEDING POWER RATING';
        } else {
            pdDisplay.className = 'panel-value safe';
            pdStatusEl.className = 'pd-status safe';
            pdStatusEl.innerHTML = '<i class="fas fa-shield-halved"></i> WITHIN SAFE LIMITS';
        }

        // 8. Update sensor toggle buttons
        if (sensorActive) {
            btnSensorOn.className = 'toggle-btn active-on';
            btnSensorOff.className = 'toggle-btn';
            btnSensorOff.style = '';
            sensorStatusEl.className = 'status-badge active';
            sensorStatusEl.innerHTML = '<span class="status-dot on"></span> SENSOR ACTIVE';
        } else {
            btnSensorOn.className = 'toggle-btn';
            btnSensorOff.className = 'toggle-btn active-off';
            btnSensorOff.style = 'border-color:var(--red);color:var(--red);background:rgba(255,23,68,.1);';
            sensorStatusEl.className = 'status-badge inactive';
            sensorStatusEl.innerHTML = '<span class="status-dot off"></span> SENSOR INACTIVE';
        }

        // 9. Update SVG wire glow states
        updateWireStates(result);

        // 10. Update buzzer animation
        updateBuzzerAnimation(result);

        // 11. Update buzzer sound & status badge
        // Buzzer turns ON when transistor reaches SATURATION with sufficient base drive
        const shouldBuzz = sensorActive && (result.region === 'saturation');
        setBuzzerSound(shouldBuzz);

        if (buzzerStatusEl) {
            if (shouldBuzz) {
                buzzerStatusEl.className = 'status-badge active';
                buzzerStatusEl.innerHTML = '<span class="status-dot on"></span> BUZZER ACTIVE (ON)';
            } else {
                buzzerStatusEl.className = 'status-badge inactive';
                buzzerStatusEl.innerHTML = '<span class="status-dot off"></span> BUZZER INACTIVE (OFF)';
            }
        }

        // 12. Update sensor dot
        if (svgRefs.sensorDot) {
            svgRefs.sensorDot.setAttribute('fill', sensorActive ? '#00e676' : '#ff1744');
        }

        // 13. Update 3D RB label
        update3DRBLabel(rb);

        // 14. Save state
        BJTState.save({ rb, sensorActive });
    }

    /** Update wire visual states based on calculation result */
    function updateWireStates(result) {
        const isActive = result.sensorActive && result.region !== 'cutoff';

        // Base path wires
        const baseWires = [svgRefs.wireSensorRb, svgRefs.wireRbBase];
        baseWires.forEach(w => {
            if (!w) return;
            if (isActive) {
                w.classList.add('active-base');
                w.classList.remove('active-collector');
            } else {
                w.classList.remove('active-base');
            }
        });

        // Collector path wires
        const collWires = [svgRefs.wireVccBuzzer, svgRefs.wireBuzzerColl];
        collWires.forEach(w => {
            if (!w) return;
            if (isActive) {
                w.classList.add('active-collector');
            } else {
                w.classList.remove('active-collector');
            }
        });

        // Common wires (emitter to ground)
        const commonWires = [svgRefs.wireEmitGnd, svgRefs.wireGndBus, svgRefs.wireSensorGnd];
        commonWires.forEach(w => {
            if (!w) return;
            if (isActive) {
                w.classList.add('active-base');
            } else {
                w.classList.remove('active-base');
            }
        });

        // Component glow
        const allComponents = svgEl.querySelectorAll('.circuit-component');
        allComponents.forEach(c => {
            if (isActive) {
                c.classList.add('active');
            } else {
                c.classList.remove('active');
            }
        });

        const allFills = svgEl.querySelectorAll('.circuit-component-fill');
        allFills.forEach(c => {
            if (isActive) {
                c.classList.add('active');
            } else {
                c.classList.remove('active');
            }
        });
    }

    /** Update buzzer vibration and sound wave animation */
    function updateBuzzerAnimation(result) {
        const shouldAnimate = result.sensorActive && (result.region === 'saturation');

        // Buzzer vibration & glow
        if (svgRefs.buzzerGroup) {
            if (shouldAnimate) {
                svgRefs.buzzerGroup.classList.add('buzzer-active');
            } else {
                svgRefs.buzzerGroup.classList.remove('buzzer-active');
            }
        }
        if (svgRefs.buzzerCircle) {
            if (shouldAnimate) {
                svgRefs.buzzerCircle.setAttribute('fill', 'rgba(0, 230, 118, 0.25)');
                svgRefs.buzzerCircle.setAttribute('stroke', '#00e676');
            } else {
                svgRefs.buzzerCircle.setAttribute('fill', 'rgba(0, 212, 255, 0.04)');
                svgRefs.buzzerCircle.setAttribute('stroke', '');
            }
        }

        // Sound waves
        if (svgRefs.soundWaves) {
            svgRefs.soundWaves.forEach(w => {
                if (shouldAnimate) {
                    w.classList.add('active');
                } else {
                    w.classList.remove('active');
                }
            });
        }
    }

    /* =======================================================
       9. INITIALIZATION
       ======================================================= */

    function init() {
        // Load saved state
        const saved = BJTState.load();

        // Draw SVG circuit
        drawCircuit();

        // Start particle animation
        particleAnimId = requestAnimationFrame(animateParticles);

        // Initialize popups
        initPopups();

        // Apply saved state
        updateAll(saved.rb, saved.sensorActive);

        // Re-render KaTeX for popup formulas after a short delay (wait for KaTeX to load)
        setTimeout(() => {
            if (typeof renderMathInElement === 'function') {
                document.querySelectorAll('.hover-popup').forEach(el => {
                    renderMathInElement(el, {
                        delimiters: [
                            { left: '$$', right: '$$', display: true },
                            { left: '\\(', right: '\\)', display: false }
                        ],
                        throwOnError: false
                    });
                });
            }
        }, 500);
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
