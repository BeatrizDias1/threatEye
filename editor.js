/* ThreatEye – editor de código (Monaco, o mesmo editor do VS Code).
 * Carregado sob demanda pela CDN. Se a CDN não responder (rede bloqueada, sem internet),
 * cai num editor simples com a mesma interface, e a sandbox continua funcionando.
 */
(function (root) {
    "use strict";

    const VER = "0.52.0";
    const BASE = `https://cdn.jsdelivr.net/npm/monaco-editor@${VER}/min/vs`;
    let monacoPromise = null;

    function loadMonaco() {
        if (monacoPromise) return monacoPromise;
        monacoPromise = new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("tempo esgotado ao carregar o Monaco")), 9000);
            root.MonacoEnvironment = {
                getWorkerUrl() {
                    const src = `self.MonacoEnvironment={baseUrl:'${BASE}/../'};importScripts('${BASE}/base/worker/workerMain.js');`;
                    return "data:text/javascript;charset=utf-8," + encodeURIComponent(src);
                }
            };
            const s = document.createElement("script");
            s.src = BASE + "/loader.js";
            s.onerror = () => { clearTimeout(timer); reject(new Error("não foi possível baixar o Monaco")); };
            s.onload = () => {
                try {
                    root.require.config({ paths: { vs: BASE } });
                    root.require(["vs/editor/editor.main"], () => { clearTimeout(timer); defineThemes(root.monaco); resolve(root.monaco); }, err => { clearTimeout(timer); reject(err); });
                } catch (e) { clearTimeout(timer); reject(e); }
            };
            document.head.appendChild(s);
        });
        return monacoPromise;
    }

    const THEMES = {
        dark: { base: "vs-dark", colors: { "editor.background": "#150c24", "editor.foreground": "#e8e0f5", "editorLineNumber.foreground": "#6f5f8c", "editorLineNumber.activeForeground": "#b5a6cc", "editor.selectionBackground": "#7e22ce55", "editor.lineHighlightBackground": "#ffffff08", "editorCursor.foreground": "#c084fc", "editorIndentGuide.background1": "#ffffff10", "scrollbarSlider.background": "#ffffff18" } },
        light: { base: "vs", colors: { "editor.background": "#ffffff", "editor.foreground": "#1e162c", "editorLineNumber.foreground": "#a79bbd", "editorLineNumber.activeForeground": "#6b5f80", "editor.selectionBackground": "#7e22ce2a", "editor.lineHighlightBackground": "#7e22ce0a", "editorCursor.foreground": "#7e22ce", "editorIndentGuide.background1": "#00000010", "scrollbarSlider.background": "#00000014" } }
    };
    function defineThemes(m) {
        Object.entries(THEMES).forEach(([k, t]) => m.editor.defineTheme("te-" + k, { base: t.base, inherit: true, rules: [], colors: t.colors }));
    }
    const temaAtual = () => "te-" + (document.documentElement.dataset.theme === "light" ? "light" : "dark");

    /* editor simples (fallback) com a mesma interface */
    function createFallback(el, opts) {
        const wrap = document.createElement("div");
        wrap.className = "ed-fallback";
        const ta = document.createElement("textarea");
        ta.spellcheck = false; ta.value = opts.value || ""; ta.readOnly = !!opts.readOnly; ta.setAttribute("aria-label", opts.ariaLabel || "Código");
        ta.wrap = "off";
        ta.addEventListener("keydown", e => {
            if (e.key === "Tab" && !ta.readOnly) { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText("  ", s, ta.selectionEnd, "end"); ta.dispatchEvent(new Event("input")); }
        });
        wrap.appendChild(ta); el.appendChild(wrap);
        const subs = [];
        ta.addEventListener("input", () => subs.forEach(fn => fn(ta.value)));
        return {
            kind: "textarea",
            getValue: () => ta.value,
            setValue(v) { ta.value = v || ""; ta.scrollTop = 0; ta.scrollLeft = 0; },
            onChange: fn => subs.push(fn),
            focus: () => ta.focus(),
            layout() {},
            revealLine(n) { const lh = parseFloat(getComputedStyle(ta).lineHeight) || 18; ta.scrollTop = Math.max(0, (n - 3) * lh); },
            setReadOnly(v) { ta.readOnly = !!v; },
            dispose() { wrap.remove(); }
        };
    }

    /* cria um editor dentro de "el". Sempre resolve (Monaco ou fallback). */
    async function create(el, opts) {
        opts = opts || {};
        el.classList.add("ed-host");
        let m = null;
        try { m = await loadMonaco(); } catch (e) { console.warn("[ThreatEye] Monaco indisponível, usando editor simples:", e.message); }
        if (!m) { const api = createFallback(el, opts); api.motivo = "offline"; return api; }

        const ed = m.editor.create(el, {
            value: opts.value || "", language: opts.language || "javascript", theme: temaAtual(), readOnly: !!opts.readOnly,
            automaticLayout: true, minimap: { enabled: false }, fontFamily: '"JetBrains Mono", ui-monospace, Consolas, monospace', fontSize: 13, lineHeight: 21,
            scrollBeyondLastLine: false, wordWrap: "on", padding: { top: 14, bottom: 14 }, renderLineHighlight: opts.readOnly ? "none" : "line",
            overviewRulerLanes: 0, hideCursorInOverviewRuler: true, overviewRulerBorder: false, folding: true, glyphMargin: false, lineNumbersMinChars: 3,
            scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8, useShadows: false }, smoothScrolling: true, contextmenu: !opts.readOnly,
            domReadOnly: !!opts.readOnly, ariaLabel: opts.ariaLabel || "Código", quickSuggestions: false, suggestOnTriggerCharacters: false, occurrencesHighlight: "off", renderWhitespace: "none"
        });
        if (opts.onRun) ed.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.Enter, opts.onRun);   // Ctrl/Cmd+Enter (o Monaco usa esse atalho para inserir linha)
        const obs = new MutationObserver(() => m.editor.setTheme(temaAtual()));
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        let mudandoPorCodigo = false;
        const subs = [];
        ed.onDidChangeModelContent(() => { if (!mudandoPorCodigo) subs.forEach(fn => fn(ed.getValue())); });
        return {
            kind: "monaco", raw: ed,
            getValue: () => ed.getValue(),
            setValue(v) { mudandoPorCodigo = true; ed.setValue(v || ""); mudandoPorCodigo = false; },
            onChange: fn => subs.push(fn),
            focus: () => ed.focus(),
            layout: () => ed.layout(),
            revealLine(n) { ed.revealLineInCenter(n); ed.setPosition({ lineNumber: n, column: 1 }); },
            setReadOnly: v => ed.updateOptions({ readOnly: !!v }),
            dispose() { obs.disconnect(); ed.dispose(); }
        };
    }

    root.TEEditor = { create, loadMonaco };
})(window);
