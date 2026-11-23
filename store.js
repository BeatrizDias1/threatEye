/* ThreatEye – estado global da investigação.
 *
 * Uma única fonte de verdade, compartilhada entre as telas (Início, Biblioteca, Dashboard):
 *  - sandbox: o que está no editor e o resultado da última análise
 *  - meusIocs: indicadores extraídos e adicionados à base pelo analista
 *  - relatorios: investigações salvas (além dos relatórios de exemplo)
 *  - favoritos: IoCs e relatórios marcados com estrela
 *  - histórico de desfazer/refazer do fluxo da sandbox
 * Persistência em localStorage; mudanças em outra aba chegam pelo evento "storage".
 */
(function (root) {
    "use strict";

    const KEY = "te-state-v1";
    const D = root.TEDados || { iocsSeed: [], relatoriosSeed: [] };
    const MAX_HIST = 40;

    const vazio = () => ({ v: 1, sandbox: { entrada: "", exemploId: null, resultado: null, arquivo: null }, meusIocs: [], relatorios: [], favIocs: [], favRel: [], analises: 0, forense: { incidente: "INC-2026-104", textos: {}, host: "todos", sel: null, fechadas: [] } });
    let S = vazio();
    const subs = new Set();
    let undo = [], redo = [];
    let timer = null;

    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (raw) { const p = JSON.parse(raw); if (p && p.v === 1) S = Object.assign(vazio(), p); }
        } catch (e) { S = vazio(); }
    }
    function persist() {
        clearTimeout(timer);
        timer = setTimeout(() => {
            try {
                let txt = JSON.stringify(S);
                if (txt.length > 1.6e6) { const c = JSON.parse(txt); if (c.sandbox.resultado) c.sandbox.resultado.saida = ""; c.sandbox.entrada = c.sandbox.entrada.slice(0, 200000); txt = JSON.stringify(c); }
                localStorage.setItem(KEY, txt);
            } catch (e) { /* armazenamento cheio ou bloqueado: segue só em memória */ }
        }, 150);
    }
    const emit = (what) => { subs.forEach(fn => { try { fn(what, S); } catch (e) { console.error(e); } }); };
    const mudou = (what) => { persist(); emit(what); };

    load();
    root.addEventListener && root.addEventListener("storage", e => { if (e.key === KEY) { load(); emit("externo"); } });

    /* ---------- datas ---------- */
    const p2 = n => String(n).padStart(2, "0");
    function fmtData(ts) {
        const d = new Date(ts), hoje = new Date(), ontem = new Date(Date.now() - 864e5);
        const hm = `${p2(d.getHours())}:${p2(d.getMinutes())}`;
        if (d.toDateString() === hoje.toDateString()) return "Hoje, " + hm;
        if (d.toDateString() === ontem.toDateString()) return "Ontem, " + hm;
        return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}`;
    }

    /* ---------- IoCs ---------- */
    const keyOf = i => i.tipo + "|" + String(i.valor).toLowerCase();
    const now = Date.now();
    const seedIocs = D.iocsSeed.map(s => Object.assign({}, s, { ts: now - s.minAtras * 60000, fixo: true }));

    const iocs = {
        key: keyOf,
        seed: () => seedIocs,
        mine: () => S.meusIocs,
        all() {
            const seen = new Set(), out = [];
            S.meusIocs.concat(seedIocs).forEach(i => { const k = keyOf(i); if (!seen.has(k)) { seen.add(k); out.push(i); } });
            return out;
        },
        find(valor) { const v = String(valor).toLowerCase(); return iocs.all().find(i => String(i.valor).toLowerCase() === v) || null; },
        addMine(lista, extra) {
            let n = 0;
            const have = new Set(iocs.all().map(keyOf));
            lista.forEach(i => {
                const reg = { id: "m" + Date.now().toString(36) + n, valor: i.valor, tipo: i.tipo, sub: i.sub || null, risco: i.risco || "Médio", origem: "Sandbox", ts: Date.now(), familia: i.familia || "Extraído na sandbox", nota: i.contexto || "" };
                if (have.has(keyOf(reg))) return;
                have.add(keyOf(reg)); S.meusIocs.unshift(reg); n++;
            });
            if (n) mudou("iocs");
            return n;
        },
        isFav: k => S.favIocs.includes(k),
        toggleFav(k) { const i = S.favIocs.indexOf(k); if (i >= 0) S.favIocs.splice(i, 1); else S.favIocs.push(k); mudou("favoritos"); return i < 0; },
        favCount: () => S.favIocs.length
    };

    /* ---------- relatórios ---------- */
    const seedRel = D.relatoriosSeed.map(r => Object.assign({}, r, { ts: now - r.minAtras * 60000, fixo: true }));
    const reports = {
        all() { return S.relatorios.concat(seedRel).sort((a, b) => b.ts - a.ts); },
        get: id => reports.all().find(r => r.id === id) || null,
        nextId() { const n = reports.all().map(r => Number((r.id.match(/-(\d+)$/) || [])[1]) || 0); return "REL-2026-" + p2(Math.max(88, ...n) + 1).padStart(3, "0"); },
        add(r) { const reg = Object.assign({ ts: Date.now(), situacao: "Publicado", origem: "manual" }, r); reg.id = reg.id || reports.nextId(); S.relatorios.unshift(reg); mudou("relatorios"); return reg; },
        remove(id) { S.relatorios = S.relatorios.filter(r => r.id !== id); S.favRel = S.favRel.filter(x => x !== id); mudou("relatorios"); },
        isFav: id => S.favRel.includes(id),
        toggleFav(id) { const i = S.favRel.indexOf(id); if (i >= 0) S.favRel.splice(i, 1); else S.favRel.push(id); mudou("favoritos"); return i < 0; },
        favCount: () => S.favRel.length
    };

    /* ---------- sandbox + histórico (desfazer / refazer) ---------- */
    const snap = () => JSON.parse(JSON.stringify({ entrada: S.sandbox.entrada, exemploId: S.sandbox.exemploId, resultado: S.sandbox.resultado, arquivo: S.sandbox.arquivo }));
    const sandbox = {
        get: () => S.sandbox,
        /* registra o estado ANTES de uma ação, para poder desfazer */
        checkpoint() { undo.push(snap()); if (undo.length > MAX_HIST) undo.shift(); redo = []; },
        set(patch, opts) { Object.assign(S.sandbox, patch); if (!(opts && opts.silencioso)) mudou("sandbox"); else persist(); },
        canUndo: () => undo.length > 0,
        canRedo: () => redo.length > 0,
        undo() { if (!undo.length) return false; redo.push(snap()); Object.assign(S.sandbox, undo.pop()); mudou("sandbox"); return true; },
        redo() { if (!redo.length) return false; undo.push(snap()); Object.assign(S.sandbox, redo.pop()); mudou("sandbox"); return true; },
        limparHistorico() { undo = []; redo = []; }
    };

    /* ---------- investigação forense (linha do tempo) ---------- */
    const forense = {
        get: () => S.forense,
        set(patch, opts) { Object.assign(S.forense, patch); if (!(opts && opts.silencioso)) mudou("forense"); else persist(); },
        setTexto(inc, txt) { S.forense.textos[inc] = txt; mudou("forense"); },
        restaurar(inc) { delete S.forense.textos[inc]; mudou("forense"); }
    };

    const stats = () => ({ iocs: iocs.all().length, criticos: iocs.all().filter(i => i.risco === "Crítico").length, favoritos: S.favIocs.length + S.favRel.length, meus: S.meusIocs.length, relatorios: reports.all().length, analises: S.analises });
    const contarAnalise = () => { S.analises++; mudou("analises"); };

    root.TEStore = { state: () => S, on: fn => { subs.add(fn); return () => subs.delete(fn); }, iocs, reports, sandbox, forense, stats, contarAnalise, fmtData, keyOf };
})(typeof window !== "undefined" ? window : globalThis);
