/* ThreatEye – tema global (claro/escuro/sistema + cor de destaque) */
(function () {
    const get = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
    const toRgb = h => { h = h.replace("#", ""); if (h.length === 3) h = h.replace(/./g, "$&$&"); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
    const mix = (c, t, p) => c.map((v, i) => Math.round(v + (t[i] - v) * p));
    const hex = c => "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
    const mq = window.matchMedia("(prefers-color-scheme: light)");

    function apply() {
        const pref = get("te-theme", "dark");
        const theme = pref === "system" ? (mq.matches ? "light" : "dark") : pref;
        const accent = get("te-accent", "#7e22ce");
        const rgb = toRgb(accent);
        const r = document.documentElement;
        r.dataset.theme = theme;
        r.dataset.soft = get("te-soft", "0");
        r.dataset.density = get("te-density", "confortavel");
        r.dataset.glass = get("te-glass", "1");
        r.style.setProperty("--accent-purple", accent);
        r.style.setProperty("--accent-rgb", rgb.join(","));
        r.style.setProperty("--accent-hover", hex(mix(rgb, [0, 0, 0], 0.2)));
        r.style.setProperty("--accent-light", theme === "dark" ? hex(mix(rgb, [255, 255, 255], 0.4)) : hex(mix(rgb, [0, 0, 0], 0.1)));
    }
    window.TE = { apply, get, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} apply(); } };
    mq.addEventListener && mq.addEventListener("change", apply);
    apply();
})();
