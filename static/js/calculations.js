/**
 * BJT LABX – Calculations Page JavaScript
 * Handles dynamic calculation updates, state loading from BJTState,
 * section reveal animations, hash-based auto-scroll, and section highlighting.
 */

(function () {
    'use strict';

    /* ==========================================================
       1. DOM REFERENCES
       ========================================================== */
    const rbDisplayEl     = document.getElementById('rb-value-display');
    const rbValElements   = document.querySelectorAll('.rb-val');
    const rbIbPreviewEl   = document.getElementById('rb-ib-preview');

    const ibAmpsEl        = document.getElementById('ib-amps');
    const ibMilliampsEl   = document.getElementById('ib-milliamps');
    const ibFinalEl       = document.getElementById('ib-final');

    const icIbValEl       = document.getElementById('ic-ib-val');
    const icTheoryAEl     = document.getElementById('ic-theory-a');
    const icTheoryMaEl    = document.getElementById('ic-theory-ma');
    const icCompareTextEl = document.getElementById('ic-compare-text');
    const icActualValEl   = document.getElementById('ic-actual-val');
    const icFinalEl       = document.getElementById('ic-final');

    const pdRegionBadgeEl = document.getElementById('pd-region-badge');
    const pdVceTextEl     = document.getElementById('pd-vce-text');
    const pdVceValEl      = document.getElementById('pd-vce-val');
    const pdIcValEl       = document.getElementById('pd-ic-val');
    const pdWattsEl       = document.getElementById('pd-watts');
    const pdMilliwattsEl  = document.getElementById('pd-milliwatts');
    const pdBarValEl      = document.getElementById('pd-bar-value');
    const pdBarFillEl     = document.getElementById('pd-bar-fill');
    const pdStatusEl      = document.getElementById('pd-status');
    const pdStatusTextEl  = document.getElementById('pd-status-text');
    const pdFinalEl       = document.getElementById('pd-final');

    const calcSections    = document.querySelectorAll('.calc-section');

    /* ==========================================================
       2. REVEAL ANIMATIONS (IntersectionObserver)
       ========================================================== */
    function setupRevealAnimations() {
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                    }
                });
            }, {
                root: null,
                threshold: 0.1,
                rootMargin: '0px 0px -40px 0px'
            });

            calcSections.forEach(function (sec) {
                observer.observe(sec);
            });
        } else {
            calcSections.forEach(function (sec) {
                sec.classList.add('visible');
            });
        }
    }

    /* ==========================================================
       3. CALCULATION ENGINE & DOM POPULATION
       ========================================================== */
    function updateCalculations(rb) {
        if (rb === undefined || rb === null) rb = BJT.RB_DEFAULT;
        rb = Math.max(0, parseInt(rb, 10));

        // Force sensorActive = true for theoretical circuit calculation walkthrough
        const sim = BJT.calculate(rb, true);

        // 1. Base Resistance Section
        if (rbDisplayEl) rbDisplayEl.textContent = formatResistance(rb);
        rbValElements.forEach(el => el.textContent = formatResistance(rb));
        if (rbIbPreviewEl) rbIbPreviewEl.textContent = formatValue(sim.ib_mA, 2);

        // 2. Base Current Section
        if (ibAmpsEl) ibAmpsEl.textContent = sim.ib.toFixed(5);
        if (ibMilliampsEl) ibMilliampsEl.textContent = formatValue(sim.ib_mA, 2);
        if (ibFinalEl) ibFinalEl.textContent = formatValue(sim.ib_mA, 2);

        // 3. Collector Current Section
        const ic_theory = BJT.BETA * sim.ib;
        const ic_theory_mA = ic_theory * 1000;
        const ic_sat_mA = ((BJT.VCC - BJT.VCE_SAT) / BJT.RL) * 1000;

        if (icIbValEl) icIbValEl.textContent = sim.ib.toFixed(5);
        if (icTheoryAEl) icTheoryAEl.textContent = ic_theory.toFixed(3);
        if (icTheoryMaEl) icTheoryMaEl.textContent = formatValue(ic_theory_mA, 2);

        const isSaturation = sim.region === 'saturation';
        const isCutoff = sim.region === 'cutoff';

        if (icCompareTextEl) {
            if (isSaturation) {
                icCompareTextEl.innerHTML = `Since I<sub>C(theoretical)</sub> (${formatValue(ic_theory_mA, 2)} mA) &gt; I<sub>C(sat)</sub> (${formatValue(ic_sat_mA, 2)} mA), the transistor operates in <span class="region-badge saturation">SATURATION (BUZZER ON)</span>`;
            } else if (isCutoff) {
                icCompareTextEl.innerHTML = `Since R<sub>B</sub> is very high (${formatResistance(rb)}), base current is starved (&lt; 0.1 mA), driving the transistor into <span class="region-badge" style="background:rgba(255,23,68,.1);border:1px solid rgba(255,23,68,.3);color:var(--red);">CUT-OFF (BUZZER OFF)</span>`;
            } else {
                icCompareTextEl.innerHTML = `Since I<sub>C(theoretical)</sub> (${formatValue(ic_theory_mA, 2)} mA) &lt; I<sub>C(sat)</sub> (${formatValue(ic_sat_mA, 2)} mA), the transistor operates in <span class="region-badge active-region">ACTIVE REGION (BUZZER OFF)</span>`;
            }
        }

        if (icActualValEl) icActualValEl.textContent = formatValue(sim.ic_mA, 2);
        if (icFinalEl) icFinalEl.textContent = formatValue(sim.ic_mA, 2);

        // 4. Power Dissipation Section
        if (pdRegionBadgeEl) {
            if (isSaturation) {
                pdRegionBadgeEl.className = 'region-badge saturation';
                pdRegionBadgeEl.textContent = 'SATURATION (BUZZER ON)';
            } else if (isCutoff) {
                pdRegionBadgeEl.className = 'region-badge';
                pdRegionBadgeEl.style = 'background:rgba(255,23,68,.1);border:1px solid rgba(255,23,68,.3);color:var(--red);';
                pdRegionBadgeEl.textContent = 'CUT-OFF (BUZZER OFF)';
            } else {
                pdRegionBadgeEl.className = 'region-badge active-region';
                pdRegionBadgeEl.style = '';
                pdRegionBadgeEl.textContent = 'ACTIVE REGION (BUZZER OFF)';
            }
        }

        if (pdVceTextEl) {
            if (isSaturation) {
                pdVceTextEl.innerHTML = `V<sub>CE</sub> = V<sub>CE(sat)</sub> = ${formatVoltage(BJT.VCE_SAT)}`;
            } else if (isCutoff) {
                pdVceTextEl.innerHTML = `V<sub>CE</sub> ≈ V<sub>CC</sub> = 12.00 V (Open Switch)`;
            } else {
                pdVceTextEl.innerHTML = `V<sub>CE</sub> = V<sub>CC</sub> − I<sub>C</sub> × R<sub>L</sub> = 12 − (${(sim.ic).toFixed(4)} × ${BJT.RL}) = ${formatVoltage(sim.vce)}`;
            }
        }

        if (pdVceValEl) pdVceValEl.textContent = formatValue(sim.vce, 2);
        if (pdIcValEl) pdIcValEl.textContent = sim.ic.toFixed(4);
        if (pdWattsEl) pdWattsEl.textContent = sim.pd.toFixed(4);
        if (pdMilliwattsEl) pdMilliwattsEl.textContent = formatValue(sim.pd_mW, 2);
        if (pdFinalEl) pdFinalEl.textContent = formatValue(sim.pd_mW, 2);

        // Power bar and status
        const pd_mW = sim.pd_mW;
        const max_mW = BJT.MAX_PD * 1000;
        const fillPercent = Math.min(100, Math.max(1, (pd_mW / max_mW) * 100));

        if (pdBarValEl) pdBarValEl.textContent = formatValue(pd_mW, 2);

        if (pdBarFillEl) {
            pdBarFillEl.style.width = fillPercent.toFixed(1) + '%';
            if (pd_mW > max_mW) {
                pdBarFillEl.className = 'power-bar-fill danger';
            } else {
                pdBarFillEl.className = 'power-bar-fill safe';
            }
        }

        if (pdStatusEl && pdStatusTextEl) {
            if (pd_mW > max_mW) {
                pdStatusEl.className = 'calc-result warning mt-2';
                pdStatusTextEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> EXCEEDING RATING ✗';
            } else {
                pdStatusEl.className = 'calc-result mt-2';
                pdStatusTextEl.innerHTML = '<i class="fas fa-check-circle"></i> WITHIN SAFE LIMITS ✓';
            }
        }
    }

    /* ==========================================================
       4. HASH-BASED NAVIGATION & HIGHLIGHTING
       ========================================================== */
    function handleHashTarget() {
        const hash = window.location.hash;
        if (!hash) return;

        const target = document.querySelector(hash);
        if (target && target.classList.contains('calc-section')) {
            // Ensure section is visible immediately
            target.classList.add('visible');

            // Smooth scroll with offset for fixed header
            setTimeout(function () {
                const rect = target.getBoundingClientRect();
                const offset = window.pageYOffset + rect.top - 90;
                window.scrollTo({
                    top: offset,
                    behavior: 'smooth'
                });

                // Apply highlight effect
                target.classList.add('highlight');
                setTimeout(function () {
                    target.classList.remove('highlight');
                }, 3500);
            }, 200);
        }
    }

    /* ==========================================================
       4.5. FLYBACK DIODE SUB-MENUS
       ========================================================== */
    function setupDiodeSubmenus() {
        const subBtns = document.querySelectorAll('.diode-sub-btn');
        const subPanels = document.querySelectorAll('.diode-sub-panel');
        if (!subBtns.length) return;

        subBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                const targetId = this.getAttribute('data-target');
                if (!targetId) return;

                // Toggle active state on buttons
                subBtns.forEach(function (b) {
                    b.classList.remove('active');
                    b.setAttribute('aria-selected', 'false');
                });
                this.classList.add('active');
                this.setAttribute('aria-selected', 'true');

                // Toggle active state on panels
                subPanels.forEach(function (panel) {
                    panel.classList.remove('active');
                });
                const targetPanel = document.getElementById(targetId);
                if (targetPanel) {
                    targetPanel.classList.add('active');
                }
            });
        });
    }

    /* ==========================================================
       5. INITIALIZATION & CROSS-TAB SYNC
       ========================================================== */
    function init() {
        // Setup intersection observer
        setupRevealAnimations();

        // Setup Flyback Diode interactive sub-menus
        setupDiodeSubmenus();

        // Load saved state
        const saved = BJTState.load();
        const rb = saved.rb || BJT.RB_DEFAULT;

        // Perform calculation and update DOM
        updateCalculations(rb);

        // Handle URL hash if coming from "KNOW MORE" buttons
        handleHashTarget();

        // Listen for hash changes
        window.addEventListener('hashchange', handleHashTarget);

        // Cross-tab synchronization via storage events
        window.addEventListener('storage', function (e) {
            if (e.key === BJTState.KEY && e.newValue) {
                try {
                    const data = JSON.parse(e.newValue);
                    if (data.rb) {
                        updateCalculations(data.rb);
                    }
                } catch (err) {
                    console.error('Error parsing updated BJT state:', err);
                }
            }
        });
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

