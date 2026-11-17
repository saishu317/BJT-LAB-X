/**
 * BJT LABX – Characteristics Graph
 * Interactive IC vs VCE graph with animated curves, dynamic load line,
 * Q-point operating trajectory, solid/dashed transition, and real-time simulation.
 */

(function () {
    'use strict';

    /* ==========================================================
       1.  CONSTANTS & CONFIG (PS-37 Doorbell Buzzer Specs)
       ========================================================== */
    const CFG = {
        // Graph value ranges
        VCE_MAX: 14,               // V  (x-axis)
        IC_MAX: 125,               // mA (y-axis, scaled for 100 mA rated buzzer load)
        VCE_KNEE: 0.25,            // V  (realistic 2N2222 saturation knee transition)
        VCE_SAT_BOUNDARY: 0.40,    // V  (clear physical boundary: Saturation <= 0.40V, Active > 0.40V)
        VCE_CUTOFF_BOUNDARY: 11.5, // V  (clear physical boundary: Cut-off >= 11.5V)

        // Padding (px) — scaled per-render by DPI
        PAD_LEFT: 76,
        PAD_RIGHT: 36,
        PAD_TOP: 42,
        PAD_BOTTOM: 58,

        // IB values for characteristic curves (A) — scaled for 3.3V/2mA sensor
        IB_CURVES: [0.0005, 0.0010, 0.00125, 0.0015, 0.0020],
        IB_LABELS: ['0.5 mA', '1.0 mA', '1.25 mA', '1.5 mA', '2.0 mA'],

        // Curve colours (cyan → blue gradient)
        CURVE_COLORS: [
            'rgba(0, 229, 255, 0.40)',
            'rgba(0, 200, 255, 0.48)',
            'rgba(0, 170, 255, 0.55)',
            'rgba(41, 121, 255, 0.62)',
            'rgba(80, 100, 255, 0.70)'
        ],
        HIGHLIGHT_WIDTH: 3,
        NORMAL_WIDTH: 1.5,

        // Region shading colours
        REGION_CUTOFF:      'rgba(255, 23, 68, 0.08)',
        REGION_ACTIVE:      'rgba(0, 230, 118, 0.06)',
        REGION_SATURATION:  'rgba(0, 212, 255, 0.08)',

        // Axis / grid colours
        AXIS_COLOR:  'rgba(228, 234, 246, 0.75)',
        GRID_COLOR:  'rgba(228, 234, 246, 0.06)',
        TICK_COLOR:  'rgba(138, 155, 189, 0.85)',

        // Q-point visual constants
        Q_RADIUS: 7,
        Q_GLOW_MAX: 18,
    };

    /* ==========================================================
       2.  DOM REFERENCES
       ========================================================== */
    const canvas     = document.getElementById('bjtCanvas');
    const ctx        = canvas.getContext('2d');
    const wrap       = document.getElementById('canvasWrap');
    const slider     = document.getElementById('rbSlider');
    const valDisp    = document.getElementById('rbValueDisplay');
    const graphNum   = document.getElementById('rbGraphNum');
    const popupEl    = document.getElementById('regionPopup');
    const popupTitle = document.getElementById('popupTitle');
    const popupMsg   = document.getElementById('popupMsg');

    // Telemetry items
    const teleIb     = document.getElementById('gIb');
    const teleIc     = document.getElementById('gIc');
    const teleVce    = document.getElementById('gVce');
    const teleRegion = document.getElementById('gRegion');
    const teleBuzzer = document.getElementById('gBuzzer');
    const presetBtns = document.querySelectorAll('.preset-btn');

    /* ==========================================================
       3.  SIMULATION STATE
       ========================================================== */
    let dpr = window.devicePixelRatio || 1;
    let W, H;                         // canvas CSS px
    let cW, cH;                       // canvas physical px
    let plotL, plotR, plotT, plotB;    // plot area edges in canvas px

    let currentRB        = BJT.RB_DEFAULT;
    const sensorActive   = true;       // Graph is always an active simulation
    let previousRegion   = null;       // for transition alerts
    let isIntroAnimating = true;
    let introStartTime   = null;
    const INTRO_DURATION = 800;        // ms

    // Smoothed Q-point state for buttery 60 FPS transitions
    let targetQ = { vce: 0.2, ic_mA: 245.83, region: 'saturation' };
    let currQ   = { vce: 0.2, ic_mA: 245.83, region: 'saturation' };
    let qPulsePhase = 0;
    let popupTimer  = null;
    let isDraggingCanvas = false;

    /* ==========================================================
       4.  CANVAS SETUP & DPI SCALING
       ========================================================== */
    function resizeCanvas() {
        dpr = window.devicePixelRatio || 1;
        W = wrap.clientWidth;
        H = wrap.clientHeight;
        cW = Math.round(W * dpr);
        cH = Math.round(H * dpr);
        canvas.width  = cW;
        canvas.height = cH;
        canvas.style.width  = W + 'px';
        canvas.style.height = H + 'px';

        // Scale paddings with DPI
        plotL = Math.round(CFG.PAD_LEFT * dpr);
        plotR = cW - Math.round(CFG.PAD_RIGHT * dpr);
        plotT = Math.round(CFG.PAD_TOP * dpr);
        plotB = cH - Math.round(CFG.PAD_BOTTOM * dpr);
    }

    /* ==========================================================
       5.  COORDINATE TRANSFORMS
       ========================================================== */
    function xPx(vce) {
        return plotL + (vce / CFG.VCE_MAX) * (plotR - plotL);
    }

    function yPx(ic_mA) {
        return plotB - (ic_mA / CFG.IC_MAX) * (plotB - plotT);
    }

    /* ==========================================================
       6.  DRAWING – AXES, GRID, LABELS
       ========================================================== */
    function drawGrid() {
        ctx.save();
        ctx.strokeStyle = CFG.GRID_COLOR;
        ctx.lineWidth = 1;

        // Vertical grid lines (VCE)
        for (let v = 0; v <= CFG.VCE_MAX; v += 2) {
            const x = Math.round(xPx(v)) + 0.5;
            ctx.beginPath();
            ctx.moveTo(x, plotT);
            ctx.lineTo(x, plotB);
            ctx.stroke();
        }

        // Horizontal grid lines (IC)
        for (let i = 0; i <= CFG.IC_MAX; i += 25) {
            const y = Math.round(yPx(i)) + 0.5;
            ctx.beginPath();
            ctx.moveTo(plotL, y);
            ctx.lineTo(plotR, y);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawAxes() {
        ctx.save();

        // Axis main lines
        ctx.strokeStyle = CFG.AXIS_COLOR;
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath();
        // Y axis
        ctx.moveTo(plotL, plotT);
        ctx.lineTo(plotL, plotB);
        // X axis
        ctx.lineTo(plotR, plotB);
        ctx.stroke();

        // Tick labels
        ctx.fillStyle = CFG.TICK_COLOR;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = Math.round(10 * dpr) + 'px "Share Tech Mono", monospace';

        // X ticks (VCE)
        for (let v = 0; v <= CFG.VCE_MAX; v += 2) {
            const x = xPx(v);
            ctx.beginPath();
            ctx.moveTo(x, plotB);
            ctx.lineTo(x, plotB + 5 * dpr);
            ctx.strokeStyle = CFG.TICK_COLOR;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillText(v.toString(), x, plotB + 8 * dpr);
        }

        // Y ticks (IC)
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let i = 0; i <= CFG.IC_MAX; i += 25) {
            const y = yPx(i);
            ctx.beginPath();
            ctx.moveTo(plotL, y);
            ctx.lineTo(plotL - 5 * dpr, y);
            ctx.strokeStyle = CFG.TICK_COLOR;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillText(i.toString(), plotL - 9 * dpr, y);
        }

        // Axis titles
        ctx.font = Math.round(11 * dpr) + 'px "Orbitron", monospace';
        ctx.fillStyle = 'rgba(228, 234, 246, 0.9)';

        // X-axis title
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('COLLECTOR-EMITTER VOLTAGE : VCE (V)', (plotL + plotR) / 2, plotB + 30 * dpr);

        // Y-axis title (rotated)
        ctx.save();
        ctx.translate(18 * dpr, (plotT + plotB) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('COLLECTOR CURRENT : IC (mA)', 0, 0);
        ctx.restore();

        ctx.restore();
    }

    /* ==========================================================
       7.  BJT CHARACTERISTIC CURVES (PHYSICS MODEL)
       ========================================================== */
    function icForCurve(ib, vce) {
        const ic_active = BJT.BETA * ib * 1000;               // mA
        const ic_sat    = (BJT.VCC - BJT.VCE_SAT) / BJT.RL * 1000; // mA
        const ic_flat   = Math.min(ic_active, ic_sat);

        // Smooth saturation knee: sharp saturation-to-active transition
        const knee = 0.5 * (1 + Math.tanh((vce - CFG.VCE_KNEE) / 0.12));

        // Early effect: ~1.5% slope across VCE
        const earlySlope = 1 + 0.015 * vce;

        return ic_flat * knee * earlySlope;
    }

    function generateCurvePoints(ib, steps) {
        steps = steps || 160;
        const pts = [];
        for (let i = 0; i <= steps; i++) {
            const vce = (i / steps) * CFG.VCE_MAX;
            pts.push({ vce, ic: icForCurve(ib, vce) });
        }
        return pts;
    }

    /* ==========================================================
       8.  DRAWING – CHARACTERISTIC CURVES
       ========================================================== */
    function drawCurves(progress) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(plotL, plotT, plotR - plotL, plotB - plotT);
        ctx.clip();

        // 1. Draw static reference curves for 1mA, 5mA, 10mA, 20mA, 30mA
        for (let ci = 0; ci < CFG.IB_CURVES.length; ci++) {
            const ib  = CFG.IB_CURVES[ci];
            const pts = generateCurvePoints(ib);
            const totalPts = pts.length;
            const drawPts  = Math.max(2, Math.floor(totalPts * progress));

            ctx.beginPath();
            ctx.strokeStyle = CFG.CURVE_COLORS[ci];
            ctx.lineWidth   = CFG.NORMAL_WIDTH * dpr;
            ctx.shadowBlur  = 0;

            for (let i = 0; i < drawPts; i++) {
                const px = xPx(pts[i].vce);
                const py = yPx(pts[i].ic);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();

            // Label at curve end
            if (progress >= 1) {
                const labelPt = pts[Math.floor(totalPts * 0.94)];
                const lx = xPx(labelPt.vce);
                let ly = yPx(labelPt.ic) - 8 * dpr;
                ly = Math.max(plotT + 12 * dpr, ly);

                ctx.font = Math.round(8.5 * dpr) + 'px "Share Tech Mono", monospace';
                ctx.fillStyle = CFG.CURVE_COLORS[ci].replace(/[\d.]+\)$/, '0.9)');
                ctx.textAlign = 'right';
                ctx.textBaseline = 'bottom';
                ctx.fillText('IB = ' + CFG.IB_LABELS[ci], lx, ly);
            }
        }

        // 2. Dynamic Operating Curve corresponding to current IB
        const currentIB = BJT.calcIB(currentRB);
        if (currentIB > 0.00005) {
            const activePts = generateCurvePoints(currentIB);
            const totalActive = activePts.length;
            const drawActive = Math.max(2, Math.floor(totalActive * progress));

            ctx.beginPath();
            // Region-colored dynamic curve
            let dynamicColor = '#00e5ff';
            if (currQ.region === 'active') dynamicColor = '#00e676';
            else if (currQ.region === 'cutoff') dynamicColor = '#ff1744';

            ctx.strokeStyle = dynamicColor;
            ctx.lineWidth = 2.2 * dpr;
            ctx.shadowColor = dynamicColor;
            ctx.shadowBlur = 8 * dpr;

            for (let i = 0; i < drawActive; i++) {
                const px = xPx(activePts[i].vce);
                const py = yPx(activePts[i].ic);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            if (progress >= 1) {
                const labelPt = activePts[Math.floor(totalActive * 0.88)];
                const lx = xPx(labelPt.vce);
                let ly = yPx(labelPt.ic) - 10 * dpr;
                ly = Math.max(plotT + 14 * dpr, ly);

                ctx.font = 'bold ' + Math.round(9 * dpr) + 'px "Share Tech Mono", monospace';
                ctx.fillStyle = dynamicColor;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'bottom';
                ctx.fillText('⚡ Active IB = ' + (currentIB * 1000).toFixed(2) + ' mA', lx, ly);
            }
        }

        ctx.restore();
    }

    /* ==========================================================
       9.  DRAWING – DC LOAD LINE (SOLID/DASHED TRAIL SIMULATION)
       ========================================================== */
    /**
     * User requirement:
     * "the q point moves along the dashed line right... i need the dashed line
     * to turn solid as it moves from left to right. i want the graph to be a
     * simulation and interactive one, how change in rb moves the q point along
     * the dashed line in graph"
     *
     * Load line: IC = (VCC - VCE) / RL
     * - Top-left intercept:  (VCE = 0, IC = VCC/RL = 250 mA)
     * - Bottom-right intercept: (VCE = VCC = 12 V, IC = 0 mA)
     * - Solid segment:  From (VCE=0, 250mA) to (Q.vce, Q.ic_mA)
     * - Dashed segment: From (Q.vce, Q.ic_mA) to (12V, 0mA)
     */
    function drawLoadLine(q, progress) {
        const ic0 = (BJT.VCC / BJT.RL) * 1000;  // 250 mA
        const x0 = xPx(0);
        const y0 = yPx(ic0);
        const x1 = xPx(BJT.VCC);
        const y1 = yPx(0);

        // Clamp Q coordinates along the load line
        const qVce = Math.max(0, Math.min(BJT.VCC, q.vce));
        const qx   = xPx(qVce);
        const qy   = yPx(q.ic_mA);

        ctx.save();
        ctx.beginPath();
        ctx.rect(plotL, plotT, plotR - plotL, plotB - plotT);
        ctx.clip();

        // 1. DASHED LINE (Remaining path from Q to Cut-off point at VCC=12V)
        if (qVce < BJT.VCC - 0.05) {
            ctx.setLineDash([8 * dpr, 6 * dpr]);
            ctx.strokeStyle = 'rgba(228, 234, 246, 0.40)';
            ctx.lineWidth   = 1.6 * dpr;
            ctx.shadowBlur  = 0;
            ctx.lineCap     = 'butt';

            ctx.beginPath();
            ctx.moveTo(qx, qy);
            ctx.lineTo(x1, y1);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // 2. SOLID LINE (Active traversed path from Top-Left up to current Q-point)
        // Turns solid from left to right as RB increases and Q travels along the line!
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(qx, qy);

        // Outer electric neon glow
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth   = 3.2 * dpr;
        ctx.shadowColor = 'rgba(0, 229, 255, 0.85)';
        ctx.shadowBlur  = 10 * dpr;
        ctx.lineCap     = 'round';
        ctx.stroke();

        // Inner bright core
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth   = 1.2 * dpr;
        ctx.shadowBlur  = 0;
        ctx.stroke();

        // 3. THRESHOLD MARKERS:
        // (A) Maximum-Drive Design Point (PS-37: target VCE = 0.20V, RB = 1.3 kΩ at 2 mA limit)
        const deepVce = BJT.VCE_SAT;
        const deepIc  = ((BJT.VCC - BJT.VCE_SAT) / BJT.RL) * 1000;
        const dx = xPx(deepVce);
        const dy = yPx(deepIc);

        ctx.save();
        // Golden diamond tick for Deep Saturation Target
        ctx.fillStyle   = '#ffd600';
        ctx.shadowColor = 'rgba(255, 214, 0, 0.9)';
        ctx.shadowBlur  = 7 * dpr;
        ctx.beginPath();
        const dSize = 4 * dpr;
        ctx.moveTo(dx, dy - dSize);
        ctx.lineTo(dx + dSize, dy);
        ctx.lineTo(dx, dy + dSize);
        ctx.lineTo(dx - dSize, dy);
        ctx.closePath();
        ctx.fill();

        // (B) Saturation / Active Boundary Marker (VCE = 0.40 V, RB ≈ 2.15 kΩ)
        const satBndVce = CFG.VCE_SAT_BOUNDARY;
        const satBndIc  = ((BJT.VCC - satBndVce) / BJT.RL) * 1000;
        const bx = xPx(satBndVce);
        const by = yPx(satBndIc);

        ctx.fillStyle   = '#00e5ff';
        ctx.shadowColor = 'rgba(0, 229, 255, 0.9)';
        ctx.shadowBlur  = 8 * dpr;
        ctx.beginPath();
        ctx.arc(bx, by, 3.8 * dpr, 0, Math.PI * 2);
        ctx.fill();

        // Threshold text indicator
        ctx.font = Math.round(8.5 * dpr) + 'px "Share Tech Mono", monospace';
        ctx.fillStyle = 'rgba(0, 229, 255, 0.95)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.shadowBlur = 0;
        ctx.fillText('⚡ BUZZER THRESHOLD (0.40V, ~2.1kΩ)', bx + 8 * dpr, by - 6 * dpr);
        ctx.restore();

        // 4. LOAD LINE LABELS & INTERCEPT MARKERS
        ctx.font = Math.round(9 * dpr) + 'px "Share Tech Mono", monospace';

        // Top-left saturation intercept
        ctx.fillStyle = 'rgba(0, 229, 255, 0.9)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('IC(max) = 100 mA (VCE=0)', x0 + 6 * dpr, y0 + 6 * dpr);

        // Bottom-right cutoff intercept
        ctx.fillStyle = 'rgba(255, 23, 68, 0.9)';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText('Cut-off (VCC = 12V)', x1 - 6 * dpr, y1 - 8 * dpr);

        // Midpoint label for the Load Line
        const mx = (x0 + x1) * 0.54;
        const my = (y0 + y1) * 0.54 - 12 * dpr;
        ctx.font = Math.round(10 * dpr) + 'px "Orbitron", monospace';
        ctx.fillStyle = 'rgba(228, 234, 246, 0.75)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('DC LOAD LINE (RL = 120 Ω)', mx, my);

        ctx.restore();
    }

    /* ==========================================================
       10. OPERATING POINT (Q-POINT) & AXIS PROJECTIONS
       ========================================================== */
    function drawQPoint(q, phase) {
        if (!q) return;

        const cx = xPx(q.vce);
        const cy = yPx(q.ic_mA);

        ctx.save();
        ctx.beginPath();
        ctx.rect(plotL, plotT, plotR - plotL, plotB - plotT);
        ctx.clip();

        // Region-dependent coloring
        let colorHex = '#00e676';
        let colorRgb = '0, 230, 118';
        let buzzerOn = false;

        if (q.region === 'saturation') {
            colorHex = '#00e5ff';
            colorRgb = '0, 229, 255';
            buzzerOn = true;
        } else if (q.region === 'cutoff') {
            colorHex = '#ff1744';
            colorRgb = '255, 23, 68';
            buzzerOn = false;
        }

        // 1. Crosshair projection lines to axes
        ctx.setLineDash([4 * dpr, 4 * dpr]);
        ctx.strokeStyle = `rgba(${colorRgb}, 0.55)`;
        ctx.lineWidth   = 1.2 * dpr;

        // Vertical drop line to X-axis
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, plotB);
        ctx.stroke();

        // Horizontal drop line to Y-axis
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(plotL, cy);
        ctx.stroke();
        ctx.setLineDash([]);

        // 2. Readout badges on axes
        // X-axis badge (VCE)
        const xText = `${q.vce.toFixed(2)} V`;
        ctx.font = Math.round(10 * dpr) + 'px "Share Tech Mono", monospace';
        const xMetrics = ctx.measureText(xText);
        const xPad = 5 * dpr;
        const xW = xMetrics.width + xPad * 2;
        const xH = 16 * dpr;

        ctx.fillStyle   = 'rgba(5, 9, 16, 0.92)';
        ctx.strokeStyle = colorHex;
        ctx.lineWidth   = 1 * dpr;
        ctx.fillRect(cx - xW / 2, plotB + 2 * dpr, xW, xH);
        ctx.strokeRect(cx - xW / 2, plotB + 2 * dpr, xW, xH);

        ctx.fillStyle    = colorHex;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(xText, cx, plotB + 2 * dpr + xH / 2);

        // Y-axis badge (IC)
        const yText = `${q.ic_mA.toFixed(1)} mA`;
        const yMetrics = ctx.measureText(yText);
        const yW = yMetrics.width + xPad * 2;
        const yH = 16 * dpr;

        ctx.fillStyle   = 'rgba(5, 9, 16, 0.92)';
        ctx.strokeStyle = colorHex;
        ctx.fillRect(plotL - yW - 3 * dpr, cy - yH / 2, yW, yH);
        ctx.strokeRect(plotL - yW - 3 * dpr, cy - yH / 2, yW, yH);

        ctx.fillStyle    = colorHex;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(yText, plotL - yW / 2 - 3 * dpr, cy);

        // 3. Concentric pulsing glow rings around Q
        const pulse = Math.sin(phase) * 0.5 + 0.5;
        const glowR = (CFG.Q_RADIUS + pulse * 14) * dpr;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
        gradient.addColorStop(0, `rgba(${colorRgb}, 0.75)`);
        gradient.addColorStop(0.4, `rgba(${colorRgb}, 0.25)`);
        gradient.addColorStop(1, `rgba(${colorRgb}, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
        ctx.fill();

        // Secondary ripple wave
        const rippleR = (CFG.Q_RADIUS + ((phase * 8) % 24)) * dpr;
        const rippleAlpha = Math.max(0, 1 - (rippleR / (28 * dpr)));
        ctx.strokeStyle = `rgba(${colorRgb}, ${rippleAlpha * 0.5})`;
        ctx.lineWidth = 1.4 * dpr;
        ctx.beginPath();
        ctx.arc(cx, cy, rippleR, 0, Math.PI * 2);
        ctx.stroke();

        // 4. Core bead with bright white center
        ctx.fillStyle   = colorHex;
        ctx.shadowColor = `rgba(${colorRgb}, 0.95)`;
        ctx.shadowBlur  = 12 * dpr;
        ctx.beginPath();
        ctx.arc(cx, cy, CFG.Q_RADIUS * dpr, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle  = '#ffffff';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(cx, cy, CFG.Q_RADIUS * 0.45 * dpr, 0, Math.PI * 2);
        ctx.fill();

        // 5. Floating HUD Badge next to Q-Point
        const line1 = `Q-POINT : ${q.region.toUpperCase()}`;
        const line2 = `VCE = ${q.vce.toFixed(2)} V | IC = ${q.ic_mA.toFixed(1)} mA`;
        const line3 = buzzerOn ? '⚡ BUZZER ON (SATURATED)' : '⭕ BUZZER OFF';

        ctx.font = Math.round(9.5 * dpr) + 'px "Share Tech Mono", monospace';
        const textW = Math.max(
            ctx.measureText(line1).width,
            ctx.measureText(line2).width,
            ctx.measureText(line3).width
        );
        const hudW = textW + 18 * dpr;
        const hudH = 50 * dpr;

        let hudX = cx + 16 * dpr;
        let hudY = cy - hudH - 8 * dpr;

        // Auto-flip if overflowing plot edges
        if (hudX + hudW > plotR - 8 * dpr) {
            hudX = cx - hudW - 16 * dpr;
        }
        if (hudY < plotT + 8 * dpr) {
            hudY = cy + 16 * dpr;
        }

        // Draw HUD background box
        ctx.fillStyle   = 'rgba(5, 9, 20, 0.94)';
        ctx.strokeStyle = `rgba(${colorRgb}, 0.75)`;
        ctx.lineWidth   = 1.2 * dpr;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur  = 10 * dpr;

        if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(hudX, hudY, hudW, hudH, 6 * dpr);
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.fillRect(hudX, hudY, hudW, hudH);
            ctx.strokeRect(hudX, hudY, hudW, hudH);
        }
        ctx.shadowBlur = 0;

        // HUD Text
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'top';

        ctx.font = Math.round(9 * dpr) + 'px "Orbitron", monospace';
        ctx.fillStyle = colorHex;
        ctx.fillText(line1, hudX + 9 * dpr, hudY + 7 * dpr);

        ctx.font = Math.round(9.5 * dpr) + 'px "Share Tech Mono", monospace';
        ctx.fillStyle = 'rgba(228, 234, 246, 0.95)';
        ctx.fillText(line2, hudX + 9 * dpr, hudY + 21 * dpr);

        ctx.fillStyle = buzzerOn ? '#00e676' : 'rgba(255, 23, 68, 0.9)';
        ctx.font = 'bold ' + Math.round(9 * dpr) + 'px "Rajdhani", sans-serif';
        ctx.fillText(line3, hudX + 9 * dpr, hudY + 35 * dpr);

        ctx.restore();
    }

    /* ==========================================================
       11. REGION SHADING & CLEAR BOUNDARIES
       ========================================================== */
    function drawRegionShading(opacity) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(plotL, plotT, plotR - plotL, plotB - plotT);
        ctx.clip();

        ctx.globalAlpha = opacity;

        // 1. Saturation region: 0 to 0.40 V (Cyan)
        const satX = xPx(CFG.VCE_SAT_BOUNDARY); // xPx(0.40)
        ctx.fillStyle = CFG.REGION_SATURATION;
        ctx.fillRect(plotL, plotT, satX - plotL, plotB - plotT);

        // 2. Cut-off region: VCE >= 11.5 V or IC <= 5 mA (Red)
        const cutX = xPx(CFG.VCE_CUTOFF_BOUNDARY); // xPx(11.5)
        const cutY = yPx(5);
        ctx.fillStyle = CFG.REGION_CUTOFF;
        ctx.fillRect(cutX, plotT, plotR - cutX, plotB - plotT);
        ctx.fillRect(satX, cutY, cutX - satX, plotB - cutY);

        // 3. Active region: between satX and cutX, above cutY (Green)
        ctx.fillStyle = CFG.REGION_ACTIVE;
        ctx.fillRect(satX, plotT, cutX - satX, cutY - plotT);

        // 4. Region Boundary Lines (explicit dividers)
        ctx.setLineDash([4 * dpr, 3 * dpr]);
        ctx.lineWidth = 1.2 * dpr;

        // Vertical boundary line for SATURATION / ACTIVE at VCE = 0.40 V
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.75)';
        ctx.beginPath();
        ctx.moveTo(satX, plotT);
        ctx.lineTo(satX, plotB);
        ctx.stroke();

        // Vertical boundary line for ACTIVE / CUT-OFF at VCE = 11.5 V
        ctx.strokeStyle = 'rgba(255, 23, 68, 0.65)';
        ctx.beginPath();
        ctx.moveTo(cutX, plotT);
        ctx.lineTo(cutX, plotB);
        ctx.stroke();
        ctx.setLineDash([]);

        // 5. Region Labels
        ctx.globalAlpha = opacity * 0.85;
        const labelFont = Math.round(9.5 * dpr) + 'px "Orbitron", monospace';
        ctx.font = labelFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Saturation vertical label inside [0, 0.40V]
        ctx.save();
        const satMidX = (plotL + satX) / 2;
        ctx.translate(satMidX, (plotT + plotB) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = 'rgba(0, 212, 255, 0.85)';
        ctx.fillText('SATURATION (VCE ≤ 0.40V)', 0, 0);
        ctx.restore();

        // Boundary indicator at top of satX
        ctx.font = Math.round(8 * dpr) + 'px "Share Tech Mono", monospace';
        ctx.fillStyle = 'rgba(0, 212, 255, 0.9)';
        ctx.textAlign = 'left';
        ctx.fillText('◀ SAT BOUNDARY (0.40V)', satX + 4 * dpr, plotT + 6 * dpr);

        // Active label
        ctx.font = labelFont;
        ctx.fillStyle = 'rgba(0, 230, 118, 0.65)';
        ctx.textAlign = 'center';
        ctx.fillText('ACTIVE REGION (0.40V < VCE < 11.5V)', (satX + cutX) / 2, plotT + 30 * dpr);

        // Cut-off label
        ctx.save();
        const cutMidX = (cutX + plotR) / 2;
        ctx.translate(cutMidX, (plotT + plotB) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = 'rgba(255, 23, 68, 0.7)';
        ctx.fillText('CUT-OFF (VCE ≥ 11.5V)', 0, 0);
        ctx.restore();

        ctx.globalAlpha = 1;
        ctx.restore();
    }

    /* ==========================================================
       12. TELEMETRY & UI UPDATES
       ========================================================== */
    function updateTelemetry(res) {
        if (!res) res = BJT.calculate(currentRB, true);

        if (teleIb) teleIb.textContent = res.ib_mA.toFixed(2) + ' mA';
        if (teleIc) teleIc.textContent = res.ic_mA.toFixed(2) + ' mA';
        if (teleVce) teleVce.textContent = res.vce.toFixed(2) + ' V';

        if (teleRegion) {
            teleRegion.textContent = res.region.toUpperCase().slice(0, 3);
            teleRegion.className = 'tele-val reg-tag ' + res.region;
        }

        if (teleBuzzer) {
            const isBuzzerOn = res.region === 'saturation';
            teleBuzzer.textContent = isBuzzerOn ? 'ACTIVE (ON)' : 'INACTIVE (OFF)';
            teleBuzzer.className = 'tele-val buzzer-tag ' + (isBuzzerOn ? 'on' : 'off');
        }

        // Highlight preset buttons if exact match
        presetBtns.forEach(btn => {
            const rbVal = parseInt(btn.dataset.rb, 10);
            btn.classList.toggle('active', Math.abs(rbVal - currentRB) < 30);
        });
    }

    /* ==========================================================
       13. FULL RENDER ENGINE
       ========================================================== */
    function render(progress, q) {
        // Clear frame
        ctx.clearRect(0, 0, cW, cH);

        // Dark background
        ctx.fillStyle = '#0a1020';
        ctx.fillRect(0, 0, cW, cH);

        // Grid & axes
        drawGrid();
        drawAxes();

        // Region shading
        const shadingOpacity = Math.max(0, (progress - 0.5) / 0.5);
        if (shadingOpacity > 0) {
            drawRegionShading(shadingOpacity);
        }

        // Characteristic curves (both reference and dynamic active curve)
        drawCurves(progress);

        // DC Load Line with dynamic Solid/Dashed trail
        if (progress > 0.15) {
            const lineAlpha = Math.min(1, (progress - 0.15) / 0.35);
            ctx.globalAlpha = lineAlpha;
            drawLoadLine(q, progress);
            ctx.globalAlpha = 1;
        }

        // Q-Point
        if (progress >= 0.95 && q) {
            qPulsePhase += 0.055;
            drawQPoint(q, qPulsePhase);
        }
    }

    /* ==========================================================
       14. ANIMATION & REAL-TIME SIMULATION LOOP
       ========================================================== */
    function mainLoop(now) {
        // Calculate progress for intro animation
        let progress = 1;
        if (isIntroAnimating) {
            if (!introStartTime) introStartTime = now;
            const elapsed = now - introStartTime;
            const t = Math.min(1, elapsed / INTRO_DURATION);
            // Cubic ease-out
            progress = 1 - Math.pow(1 - t, 3);
            if (t >= 1) isIntroAnimating = false;
        }

        // Smoothly interpolate Q-point coordinates for silky 60 FPS movement
        // Lerp factor 0.32 gives instantaneous response without snapping
        currQ.vce   += (targetQ.vce - currQ.vce) * 0.32;
        currQ.ic_mA += (targetQ.ic_mA - currQ.ic_mA) * 0.32;
        currQ.region = targetQ.region;

        // Render current frame
        render(progress, currQ);

        requestAnimationFrame(mainLoop);
    }

    /* ==========================================================
       15. REGION TRANSITION POPUPS & LEGEND
       ========================================================== */
    const REGION_MESSAGES = {
        active: {
            title: 'ACTIVE REGION REACHED (BUZZER OFF)',
            msg: 'The transistor has exited saturation into the active region. Base resistance RB > 2.1 kΩ reduces base drive, dropping collector current below the rated 100 mA buzzer operating threshold.'
        },
        saturation: {
            title: 'SATURATION REGION REACHED (BUZZER ON)!',
            msg: 'The transistor operates in saturation with V_CE ≤ 0.40 V (nominal target 0.2 V). Base drive (RB ≤ 2.1 kΩ, max-drive design 1.3 kΩ at 2 mA limit) supplies sufficient current to activate the buzzer, though V_CE(sat) ≤ 0.2 V requires datasheet confirmation or measurement.'
        },
        cutoff: {
            title: 'CUT-OFF REGION REACHED (BUZZER OFF)!',
            msg: 'The transistor is switched OFF. High base resistance (RB > 50 kΩ) severely starves base drive. Collector current drops to zero and the buzzer remains completely OFF.'
        }
    };

    function showRegionPopup(region) {
        if (popupTimer) clearTimeout(popupTimer);

        const info = REGION_MESSAGES[region];
        if (!info) return;

        popupTitle.textContent = info.title;
        popupMsg.textContent   = info.msg;
        popupEl.className      = 'region-popup visible ' + region;

        popupTimer = setTimeout(function () {
            popupEl.classList.remove('visible');
        }, 3200);
    }

    function checkRegionTransition(newRegion) {
        if (previousRegion !== null && newRegion !== previousRegion) {
            showRegionPopup(newRegion);
        }
        previousRegion = newRegion;
    }

    function updateLegend(region) {
        const cards = {
            cutoff:     document.getElementById('legendCutoff'),
            active:     document.getElementById('legendActive'),
            saturation: document.getElementById('legendSaturation')
        };
        Object.keys(cards).forEach(function (key) {
            if (cards[key]) {
                cards[key].classList.toggle('highlight', key === region);
            }
        });
    }

    /* ==========================================================
       16. PARAMETER UPDATE DISPATCHER
       ========================================================== */
    function updateRB(newVal, source) {
        currentRB = Math.max(0, Math.min(100000, newVal));

        // Sync slider
        if (source !== 'slider') {
            slider.value = currentRB;
        }

        // Sync number display if not currently being typed
        if (source !== 'typing' && graphNum && document.activeElement !== graphNum) {
            graphNum.textContent = currentRB;
        }

        // Compute new circuit state
        const res = BJT.calculate(currentRB, true);
        targetQ = {
            vce:    res.vce,
            ic_mA:  res.ic_mA,
            region: res.region
        };

        // Save state for persistence across pages
        BJTState.save({ rb: currentRB, sensorActive: true });

        // Update UI
        updateTelemetry(res);
        checkRegionTransition(res.region);
        updateLegend(res.region);
    }

    /* ==========================================================
       17. EVENT LISTENERS: SLIDER, TYPING, PRESETS, CANVAS DRAG
       ========================================================== */
    // 1. Slider Event
    slider.addEventListener('input', function () {
        updateRB(parseInt(slider.value, 10), 'slider');
    });

    // 2. Direct Typing in Number Display
    if (graphNum) {
        graphNum.addEventListener('input', function () {
            let text = graphNum.innerText.replace(/[^0-9]/g, '');
            let val = parseInt(text, 10);
            if (isNaN(val)) val = 0;
            updateRB(val, 'typing');
        });

        graphNum.addEventListener('blur', function () {
            let text = graphNum.innerText.replace(/[^0-9]/g, '');
            let val = parseInt(text, 10);
            if (isNaN(val) || val < 0) val = 0;
            val = Math.max(0, Math.min(100000, val));
            graphNum.textContent = val;
            updateRB(val, 'blur');
        });

        graphNum.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                graphNum.blur();
            }
        });
    }

    // 3. Preset Buttons
    presetBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const targetVal = parseInt(btn.dataset.rb, 10);
            updateRB(targetVal, 'preset');
        });
    });

    // 4. Direct Canvas Interaction: Click or Drag Q-Point along Load Line
    function handleCanvasPointer(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const px = (clientX - rect.left) * dpr;

        // Check if inside plot horizontal span
        if (px < plotL - 10 * dpr || px > plotR + 10 * dpr) return;

        // Map X position to VCE
        const vce = ((px - plotL) / (plotR - plotL)) * CFG.VCE_MAX;
        const clampedVce = Math.max(0.2, Math.min(12.0, vce));

        // Derive RB corresponding to this point on the DC load line
        let newRb;
        if (clampedVce <= CFG.VCE_SAT_BOUNDARY) {
            // Saturation: 0 to 2114 ohms (maps smoothly across VCE 0.20V to 0.40V)
            const frac = (clampedVce - 0.20) / (CFG.VCE_SAT_BOUNDARY - 0.20);
            newRb = Math.round(Math.max(0, frac) * BJT.RB_THRESHOLD);
            newRb = Math.max(0, Math.min(BJT.RB_THRESHOLD, newRb));
        } else {
            // Active region: IC = (12 - VCE) / 120
            // IC = Beta * (3.3 - 0.7) / RB => RB = 208 / IC = 208 * 120 / (12 - VCE) = 24960 / (12 - VCE)
            const ic = (12 - clampedVce) / BJT.RL;
            if (ic <= 0.002) {
                newRb = 100000;
            } else {
                newRb = Math.round(208 / ic);
                newRb = Math.max(BJT.RB_THRESHOLD, Math.min(100000, newRb));
            }
        }

        updateRB(newRb, 'canvas');
    }

    canvas.addEventListener('mousedown', function (e) {
        isDraggingCanvas = true;
        handleCanvasPointer(e);
    });

    window.addEventListener('mousemove', function (e) {
        if (isDraggingCanvas) handleCanvasPointer(e);
    });

    window.addEventListener('mouseup', function () {
        isDraggingCanvas = false;
    });

    // Touch support for mobile devices
    canvas.addEventListener('touchstart', function (e) {
        isDraggingCanvas = true;
        handleCanvasPointer(e);
    }, { passive: true });

    window.addEventListener('touchmove', function (e) {
        if (isDraggingCanvas) handleCanvasPointer(e);
    }, { passive: true });

    window.addEventListener('touchend', function () {
        isDraggingCanvas = false;
    });

    /* ==========================================================
       18. RESIZE HANDLER
       ========================================================== */
    let resizeTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            resizeCanvas();
        }, 120);
    });

    /* ==========================================================
       19. INITIALIZATION
       ========================================================== */
    function init() {
        // Load saved circuit state or use defaults
        const saved = BJTState.load();
        currentRB = saved.rb ?? BJT.RB_DEFAULT;

        // Apply to controls
        slider.value = currentRB;
        if (graphNum) graphNum.textContent = currentRB;

        // Initial target Q-point
        const res = BJT.calculate(currentRB, true);
        targetQ = {
            vce:    res.vce,
            ic_mA:  res.ic_mA,
            region: res.region
        };
        currQ = Object.assign({}, targetQ);
        previousRegion = res.region;

        // Size canvas
        resizeCanvas();

        // Update telemetry and legend
        updateTelemetry(res);
        updateLegend(res.region);

        // Start 60 FPS simulation loop
        introStartTime = performance.now();
        requestAnimationFrame(mainLoop);
    }

    init();

})();
