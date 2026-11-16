/**
 * BJT LABX - Shared Simulation Engine & State Management
 * PS-37: BJT Current Amplifier Switch for High-Decibel Doorbell Buzzers
 * Specifications:
 *  - Input Sensor Signal: 2 mA at 3.3 V
 *  - Load: Doorbell buzzer drawing 100 mA at 12 V (RL = 12 V / 0.1 A = 120 Ω)
 *  - Transistor: NPN BJT (2N2222), Minimum gain β = 80
 *  - Deep saturation guarantee: V_CE(sat) ≤ 0.2 V
 *  - Flyback Diode: 1N4001 clamping inductive back-EMF spike
 */

/* ========== Circuit Parameters ========== */
const BJT = {
    VCC: 12,              // Supply voltage (V)
    BETA: 80,             // Minimum DC current gain (hFE) per PS-37 spec
    VBE: 0.7,             // Base-emitter drop (V)
    VSENSOR: 3.3,         // Sensor output voltage (V) per PS-37 spec
    ISENSOR_MAX: 0.002,   // Sensor maximum current capability (2 mA)
    VCE_SAT: 0.2,             // PS-37 deep saturation target (V)
    VCE_SAT_BOUNDARY: 0.40,   // Physical saturation knee boundary (V)
    VCE_CUTOFF_BOUNDARY: 11.5,// Cut-off threshold voltage (V)
    IC_BUZZER_THRESH: 0.096,  // 96 mA threshold (96% rated load) where buzzer activates
    RL: 120,              // Buzzer equivalent resistance (12V / 100mA = 120 Ω)
    BUZZER_RATED_MA: 100, // Rated buzzer current (mA)
    MAX_PD: 0.625,        // Maximum power dissipation (W) for TO-92 2N2222
    DIODE_MODEL: '1N4001', // Flyback clamp diode

    // Slider bounds
    RB_MIN: 0,
    RB_MAX: 100000,
    RB_DEFAULT: 1300,     // 1.3 kΩ (optimal deep saturation design for 2 mA sensor drive)
    RB_THRESHOLD: 2114,   // ~2.1 kΩ (boundary where buzzer switches ON/OFF)

    // Runtime state
    sensorActive: false,
    currentRB: 1300,

    /**
     * Calculate base current (A).
     * IB = (VSENSOR - VBE) / RB
     * When RB is 0, base current is clamped by sensor/junction impedance (~20 Ω).
     */
    calcIB(rb) {
        if (!this.sensorActive) return 0;
        if (rb <= 0) {
            return (this.VSENSOR - this.VBE) / 20;
        }
        return (this.VSENSOR - this.VBE) / rb;
    },

    /**
     * Calculate collector current (A).
     * In saturation: IC_sat = (VCC - VCE_sat) / RL = (12 - 0.2) / 120 = 98.33 mA (~100 mA)
     * In active: IC = β × IB (β = 80)
     */
    calcIC(ib) {
        if (!this.sensorActive || ib <= 0) return 0;
        const ic_beta = this.BETA * ib;
        const ic_sat  = (this.VCC - this.VCE_SAT) / this.RL;
        return Math.min(ic_beta, ic_sat);
    },

    /**
     * Calculate collector-emitter voltage (V).
     * Active: VCE = VCC - IC × RL
     * Saturation: VCE = VCE_sat (0.2 V)
     */
    calcVCE(ic) {
        if (!this.sensorActive || ic === 0) return this.VCC;
        const vce = this.VCC - ic * this.RL;
        return Math.max(vce, this.VCE_SAT);
    },

    /**
     * Calculate transistor power dissipation (W).
     * PD = VCE × IC
     */
    calcPD(vce, ic) {
        return vce * ic;
    },

    /**
     * Determine operating region with clear physical boundaries:
     * - Saturation: VCE <= 0.40 V (RB <= ~2.15 kΩ, IC >= 96 mA). Buzzer is fully ON.
     * - Active: 0.40 V < VCE < 11.5 V (2.15 kΩ < RB < 50 kΩ). Linear amplification. Buzzer is OFF.
     * - Cut-off: VCE >= 11.5 V (RB >= 50 kΩ or sensor inactive, IC < 5 mA). Transistor is OFF.
     */
    getRegion(ib, ic, vce) {
        if (!this.sensorActive || ib <= 0) return 'cutoff';
        if (vce === undefined) vce = this.calcVCE(ic);
        if (vce <= this.VCE_SAT_BOUNDARY || ic >= this.IC_BUZZER_THRESH) {
            return 'saturation';
        }
        if (vce >= this.VCE_CUTOFF_BOUNDARY || ib < 0.00008 || ic < 0.005) {
            return 'cutoff';
        }
        return 'active';
    },

    /**
     * Run full circuit analysis for a given RB.
     */
    calculate(rb, sensorActive) {
        this.currentRB = rb;
        if (sensorActive !== undefined) this.sensorActive = sensorActive;

        const ib  = this.calcIB(rb);
        const ic  = this.calcIC(ib);
        const vce = this.calcVCE(ic);
        const pd  = this.calcPD(vce, ic);
        const region = this.getRegion(ib, ic, vce);

        const ic_sat = (this.VCC - this.VCE_SAT) / this.RL;
        const ib_sat = ic_sat / this.BETA; // ~1.229 mA
        const overdriveFactor = ib > 0 ? (ib / ib_sat) : 0;
        const sensorWithinLimit = ib <= (this.ISENSOR_MAX + 0.00005);

        return {
            rb,
            ib,
            ib_mA:  ib * 1000,
            ic,
            ic_mA:  ic * 1000,
            vce,
            pd,
            pd_mW:  pd * 1000,
            region,
            sensorActive: this.sensorActive,
            overdriveFactor,
            sensorWithinLimit,
            buzzerOn: region === 'saturation'
        };
    }
};

/* ========== Cross-Page State (localStorage) ========== */
const BJTState = {
    KEY: 'bjt_labx_state_ps37',

    save(data) {
        try {
            localStorage.setItem(this.KEY, JSON.stringify({
                rb: data.rb ?? BJT.RB_DEFAULT,
                sensorActive: data.sensorActive ?? false
            }));
        } catch (e) { /* storage unavailable */ }
    },

    load() {
        try {
            const raw = localStorage.getItem(this.KEY);
            if (raw) {
                const d = JSON.parse(raw);
                BJT.currentRB     = d.rb ?? BJT.RB_DEFAULT;
                BJT.sensorActive  = d.sensorActive ?? false;
                return d;
            }
        } catch (e) { /* ignore */ }
        return { rb: BJT.RB_DEFAULT, sensorActive: false };
    }
};

/* ========== Display Helpers ========== */
function formatValue(val, decimals) {
    decimals = decimals ?? 2;
    if (Math.abs(val) < 0.0001) return '0.00';
    return val.toFixed(decimals);
}

function formatResistance(ohms) {
    if (ohms >= 1000) return (ohms / 1000).toFixed(ohms % 1000 === 0 ? 0 : 2) + ' kΩ';
    return ohms + ' Ω';
}

function formatCurrent_mA(amps) {
    return (amps * 1000).toFixed(2) + ' mA';
}

function formatVoltage(v) {
    return v.toFixed(2) + ' V';
}

function formatPower(w) {
    if (w < 0.001) return '0 mW';
    if (w < 1) return (w * 1000).toFixed(2) + ' mW';
    return w.toFixed(4) + ' W';
}
