/* ThreatEye – Sandbox de desobfuscação (tela Início).
 * Liga o editor (Monaco), o motor de análise (deobf.js) e o estado global (store.js). */
document.addEventListener("DOMContentLoaded", async () => {
    const app = document.getElementById("sandboxApp");
    if (!app || !window.TEStore || !window.TEDeobf || !window.TEEditor) return;

    const $ = id => document.getElementById(id);
    const S = TEStore, D = TEDados;
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const bytes = n => n < 1024 ? n + " B" : (n / 1024).toFixed(1).replace(".", ",") + " KB";

    /* ---------- aviso rápido ---------- */
    const toast = document.querySelector(".toast") || (() => { const t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); return t; })();
    let tt;
    const notify = msg => { toast.textContent = msg; toast.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove("show"), 2600); };
    const status = (msg, tipo) => { const el = $("status"); el.textContent = msg; el.dataset.tipo = tipo || ""; };

    /* ---------- formatador (prettier) carregado em segundo plano ---------- */
    const loadScript = src => new Promise(res => { const s = document.createElement("script"); s.src = src; s.onload = () => res(true); s.onerror = () => res(false); document.head.appendChild(s); });
    const formatterReady = (async () => {
        await new Promise(r => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 1500 }) : setTimeout(r, 300)));
        const r = await Promise.all(["vendor/prettier-standalone.js", "vendor/prettier-babel.js", "vendor/prettier-estree.js"].map(loadScript));
        return r.every(Boolean);
    })();

    /* ---------- editores ---------- */
    status("Carregando o editor…");
    const [edIn, edOut] = await Promise.all([
        TEEditor.create($("edIn"), { value: S.sandbox.get().entrada, ariaLabel: "Código de entrada", onRun: () => rodar() }),
        TEEditor.create($("edOut"), { value: "", readOnly: true, ariaLabel: "Código limpo", onRun: () => rodar() })
    ]);
    const PLACEHOLDER = "// O código limpo aparece aqui depois de desobfuscar.";

    /* ---------- desenho da tela a partir do estado ---------- */
    let digitou = false;
    function render() {
        const sb = S.sandbox.get(), r = sb.resultado;
        if (edIn.getValue() !== sb.entrada) edIn.setValue(sb.entrada);
        const out = r && r.ok ? r.saida : PLACEHOLDER;
        if (edOut.getValue() !== out) edOut.setValue(out);
        $("infoIn").textContent = sb.entrada ? `${sb.entrada.split("\n").length} linhas · ${bytes(sb.entrada.length)}${sb.arquivo ? " · " + sb.arquivo : ""}` : "vazio";
        $("infoOut").textContent = r && r.ok ? `${r.saida.split("\n").length} linhas · ${bytes(r.saida.length)}` : "";
        $("btnCopiar").disabled = $("btnBaixar").disabled = !(r && r.ok);
        $("btnUndo").disabled = !S.sandbox.canUndo();
        $("btnRedo").disabled = !S.sandbox.canRedo();
        renderResultado(r);
    }

    function sev(nivel, texto) { return `<span class="sev ${nivel}">${esc(texto)}</span>`; }
    const nivelDoRisco = r => r === "Crítico" ? "crit" : r === "Alto" ? "alto" : r === "Médio" ? "med" : "ok";

    function renderResultado(r) {
        const box = $("res");
        if (!r || !r.ok) {
            box.hidden = true;
            if (r && !r.ok) status(r.erro, "erro");
            return;
        }
        box.hidden = false;
        status(`Concluído em ${r.ms} ms · ${r.camadas.length} ${r.camadas.length === 1 ? "camada" : "camadas"} · ${r.iocs.length} ${r.iocs.length === 1 ? "indicador" : "indicadores"}`, "ok");

        // veredito
        const v = r.veredito;
        $("verdict").innerHTML = `
            <div class="vd-main">${sev(v.nivel, v.rotulo)}<div class="vd-bar" aria-hidden="true"><i style="width:${v.score}%" class="vd-${v.nivel}"></i></div><small>${v.score}/100</small></div>
            ${r.avisos.length ? `<div class="vd-warn">${r.avisos.map(esc).join(" · ")}</div>` : ""}
            <button type="button" class="btn-primary btn-sm" id="btnSalvar">Salvar investigação</button>`;
        $("btnSalvar").addEventListener("click", abrirSalvar);

        // camadas em árvore (dados hierárquicos): entrada → camada → técnica → exemplos
        $("camInfo").textContent = `${r.camadas.length} ${r.camadas.length === 1 ? "nível" : "níveis"}`;
        $("tree").innerHTML = `<ul class="tr">${r.camadas.map((c, i) => `
            <li>
                <details ${i === r.camadas.length - 1 || i === 0 ? "open" : ""}>
                    <summary><b>Camada ${c.n}</b> <span>${esc(c.titulo)}</span><small>${bytes(c.bytes)}${c.tamanhoFinal != null && c.tamanhoFinal !== c.bytes ? " → " + bytes(c.tamanhoFinal) : ""}</small></summary>
                    ${c.passos.length ? `<ul class="tr">${c.passos.map(p => `
                        <li><details>
                            <summary>${esc(p.titulo)} <em>×${p.total}</em></summary>
                            <ul class="tr tr-ex">${p.exemplos.map(e => `<li><code>${esc(e.antes)}</code><i>→</i><code>${esc(e.depois)}</code></li>`).join("")}</ul>
                        </details></li>`).join("")}</ul>` : `<p class="tr-empty">${i === 0 ? "Nenhuma transformação necessária nesta camada." : "Código decodificado sem transformações adicionais."}</p>`}
                </details>
            </li>`).join("")}</ul>`;

        // indicadores
        const lista = r.iocs;
        $("btnAddIocs").disabled = !lista.length;
        $("iocList").innerHTML = lista.length ? `<table class="mini"><thead><tr><th></th><th>Tipo</th><th>Valor</th><th>Na base</th></tr></thead><tbody>${lista.map((i, k) => {
            const ex = S.iocs.find(i.valor);
            return `<tr><td><input type="checkbox" data-k="${k}" ${ex ? "disabled" : "checked"} aria-label="Selecionar ${esc(i.valor)}"></td><td>${esc(i.tipo)}${i.sub ? ` <small>${esc(i.sub)}</small>` : ""}</td><td class="mono-cell" title="${esc(i.valor)}">${esc(i.valor)}</td><td>${ex ? sev(nivelDoRisco(ex.risco), ex.risco) : '<span class="novo">novo</span>'}</td></tr>`;
        }).join("")}</tbody></table>` : `<p class="vazio">Nenhum indicador encontrado no código.</p>`;

        // comportamentos
        $("behList").innerHTML = r.comportamentos.length ? r.comportamentos.map(b => `
            <div class="beh">${sev(b.severidade, b.titulo)}<p>${esc(b.descricao)}</p><code>${esc(b.evidencia)}</code></div>`).join("") : `<p class="vazio">Nenhum comportamento suspeito conhecido.</p>`;
    }

    /* ---------- ações ---------- */
    function slim(r) { return { ok: r.ok, erro: r.erro, saida: r.saida, camadas: r.camadas, iocs: r.iocs, comportamentos: r.comportamentos, avisos: r.avisos, veredito: r.veredito, ms: r.ms }; }

    async function rodar() {
        if ($("btnRodar").disabled) return;   // já está analisando
        const code = edIn.getValue();
        if (!code.trim()) { status("Cole um código JavaScript no editor da esquerda.", "erro"); edIn.focus(); return; }
        const btn = $("btnRodar"); btn.disabled = true; btn.setAttribute("aria-busy", "true"); status("Analisando…");
        try {
            await Promise.race([formatterReady, new Promise(r => setTimeout(r, 2500))]);
            const r = await TEDeobf.analyze(code);
            S.sandbox.checkpoint(); digitou = false;
            S.sandbox.set({ entrada: code, resultado: slim(r) });
            S.contarAnalise();
            render();
        } catch (e) { console.error(e); status("Erro inesperado na análise: " + e.message, "erro"); }
        btn.disabled = false; btn.removeAttribute("aria-busy");
    }

    function carregar(texto, meta) {
        S.sandbox.checkpoint(); digitou = false;
        S.sandbox.set(Object.assign({ entrada: texto, resultado: null, exemploId: null, arquivo: null }, meta || {}));
        render();
    }

    // exemplos
    $("exemplos").innerHTML = D.exemplos.map(e => `<button type="button" class="ide-chip" data-ex="${e.id}" title="${esc(e.desc)}">${esc(e.nome)}</button>`).join("");
    $("exemplos").addEventListener("click", ev => {
        const b = ev.target.closest("[data-ex]"); if (!b) return;
        const ex = D.exemplos.find(x => x.id === b.dataset.ex);
        carregar(ex.codigo, { exemploId: ex.id });
        status(`Exemplo carregado: ${ex.nome}. Clique em Desobfuscar.`);
        edIn.focus();
    });

    $("btnRodar").addEventListener("click", rodar);
    document.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !$("dlgSalvar").open) { e.preventDefault(); rodar(); } });
    $("btnLimpar").addEventListener("click", () => { if (!S.sandbox.get().entrada && !S.sandbox.get().resultado) return; carregar(""); status("Editor limpo. Use Desfazer para recuperar."); });
    $("btnUndo").addEventListener("click", () => { if (S.sandbox.undo()) { digitou = false; render(); status("Ação desfeita."); } });
    $("btnRedo").addEventListener("click", () => { if (S.sandbox.redo()) { digitou = false; render(); status("Ação refeita."); } });

    // digitação no editor: guarda um ponto de desfazer por "rajada" de digitação
    let tdig;
    edIn.onChange(v => {
        if (!digitou) { S.sandbox.checkpoint(); digitou = true; }
        S.sandbox.set({ entrada: v, exemploId: null }, { silencioso: true });
        clearTimeout(tdig); tdig = setTimeout(() => { $("infoIn").textContent = v ? `${v.split("\n").length} linhas · ${bytes(v.length)}` : "vazio"; $("btnUndo").disabled = !S.sandbox.canUndo(); }, 200);
    });

    // arquivos: botão e arrastar/soltar
    const MAX = 2 * 1024 * 1024;
    function lerArquivo(f) {
        if (!f) return;
        if (f.size > MAX) { status(`Arquivo grande demais (${bytes(f.size)}). O limite é 2 MB.`, "erro"); return; }
        const fr = new FileReader();
        fr.onload = () => { carregar(String(fr.result), { arquivo: f.name }); status(`Arquivo carregado: ${f.name}. Clique em Desobfuscar.`); };
        fr.onerror = () => status("Não foi possível ler o arquivo.", "erro");
        fr.readAsText(f);
    }
    $("btnAbrir").addEventListener("click", () => $("fileInput").click());
    $("fileInput").addEventListener("change", e => { lerArquivo(e.target.files[0]); e.target.value = ""; });
    const pane = $("paneIn"), drop = $("drop");
    let dragN = 0;
    ["dragenter", "dragover"].forEach(t => pane.addEventListener(t, e => { e.preventDefault(); if (t === "dragenter") dragN++; drop.hidden = false; }));
    pane.addEventListener("dragleave", () => { if (--dragN <= 0) { dragN = 0; drop.hidden = true; } });
    pane.addEventListener("drop", e => { e.preventDefault(); dragN = 0; drop.hidden = true; lerArquivo(e.dataTransfer.files[0]); });

    // copiar / baixar
    $("btnCopiar").addEventListener("click", async () => {
        const r = S.sandbox.get().resultado; if (!r || !r.ok) return;
        try { await navigator.clipboard.writeText(r.saida); notify("Código limpo copiado."); } catch (e) { notify("Não foi possível copiar."); }
    });
    $("btnBaixar").addEventListener("click", () => {
        const r = S.sandbox.get().resultado; if (!r || !r.ok) return;
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([r.saida], { type: "text/javascript" })); a.download = "codigo-limpo.js"; a.click(); URL.revokeObjectURL(a.href);
    });

    // adicionar indicadores à base
    const riscoPara = (i, v) => i.tipo === "Hash" ? (v.nivel === "ok" ? "Baixo" : "Médio") : v.nivel === "crit" ? "Crítico" : v.nivel === "alto" ? "Alto" : v.nivel === "med" ? "Médio" : "Baixo";
    $("btnAddIocs").addEventListener("click", () => {
        const r = S.sandbox.get().resultado; if (!r) return;
        const marcados = [...document.querySelectorAll("#iocList input[type=checkbox]:checked")].map(c => r.iocs[Number(c.dataset.k)]);
        if (!marcados.length) return notify("Marque ao menos um indicador novo.");
        const n = S.iocs.addMine(marcados.map(i => Object.assign({}, i, { risco: riscoPara(i, r.veredito) })));
        notify(n ? `${n} ${n === 1 ? "indicador adicionado" : "indicadores adicionados"} à base de IoCs.` : "Esses indicadores já estão na base.");
        renderResultado(r);
    });

    /* ---------- salvar investigação ---------- */
    const dlg = $("dlgSalvar");
    const SEV = { crit: "Crítica", alto: "Alta", med: "Média", ok: "Baixa" };
    const TLP = { Crítica: "TLP:RED", Alta: "TLP:AMBER", Média: "TLP:GREEN", Baixa: "TLP:CLEAR" };
    function abrirSalvar() {
        const sb = S.sandbox.get(), r = sb.resultado; if (!r || !r.ok) return;
        const ex = D.exemplos.find(e => e.id === sb.exemploId);
        $("svTitulo").value = "Script ofuscado — " + (sb.arquivo || (ex ? ex.nome : new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })));
        $("svSev").value = SEV[r.veredito.nivel];
        const comp = r.comportamentos.filter(b => b.id !== "layers").slice(0, 3).map(b => b.titulo.toLowerCase()).join(", ");
        $("svResumo").value = `${r.camadas.length} ${r.camadas.length === 1 ? "camada" : "camadas"} de ofuscação decodificadas; ${r.iocs.length} indicadores extraídos${comp ? "; sinais: " + comp : ""}.`;
        dlg.showModal(); $("svTitulo").focus();
    }
    $("svCancelar").addEventListener("click", () => dlg.close());
    $("formSalvar").addEventListener("submit", e => {
        e.preventDefault();
        const sb = S.sandbox.get(), r = sb.resultado; if (!r) return dlg.close();
        const sevTxt = $("svSev").value;
        const rep = S.reports.add({
            titulo: $("svTitulo").value.trim(), resumo: $("svResumo").value.trim() || "Investigação salva da sandbox.", severidade: sevTxt, tlp: TLP[sevTxt],
            confianca: $("svConf").value, mitre: "T1059.007", autor: "Analista SOC L3", nIocs: r.iocs.length, origem: "sandbox",
            investigacao: { entrada: sb.entrada.slice(0, 200000), exemploId: sb.exemploId, arquivo: sb.arquivo, resultado: r }
        });
        if ($("svIocs").checked) S.iocs.addMine(r.iocs.map(i => Object.assign({}, i, { risco: riscoPara(i, r.veredito) })));
        if ($("svFav").checked && !S.reports.isFav(rep.id)) S.reports.toggleFav(rep.id);
        dlg.close();
        notify(`${rep.id} salvo em Biblioteca → Relatórios.`);
        status(`Investigação salva como ${rep.id}.`, "ok");
        renderResultado(r);
    });

    /* ---------- consulta de indicador na base ---------- */
    $("consultaForm").addEventListener("submit", e => {
        e.preventDefault();
        const box = $("consultaRes"), v = $("consultaInput").value.trim();
        if (!v) { box.hidden = true; return; }
        const c = TEDeobf.classify(v);
        box.hidden = false;
        if (!c) { box.innerHTML = `<span>Formato não reconhecido. Use um hash (MD5, SHA-1, SHA-256), IP, domínio, URL ou e-mail.</span>`; return; }
        let ioc = S.iocs.find(c.valor), via = "";
        if (!ioc && c.tipo === "URL") { try { const h = new URL(c.valor).hostname; ioc = S.iocs.find(h); if (ioc) via = ` (pelo domínio ${esc(h)})`; } catch (er) { /* ignora */ } }
        const tipoTxt = c.tipo === "Hash" ? `Hash ${c.sub}` : c.tipo;
        if (ioc) {
            box.innerHTML = `<span><b>${esc(tipoTxt)}</b> encontrado na base${via}: ${sev(nivelDoRisco(ioc.risco), ioc.risco)} · ${esc(ioc.familia || "sem família")} · visto ${esc(S.fmtData(ioc.ts).toLowerCase())}</span><a class="ide-link" href="biblioteca.html#iocs">Abrir na base</a>`;
        } else {
            box.innerHTML = `<span><b>${esc(tipoTxt)}</b> não consta na base.</span><button type="button" class="ide-link" id="addConsulta">Adicionar à base</button>`;
            $("addConsulta").addEventListener("click", () => { S.iocs.addMine([{ valor: c.valor, tipo: c.tipo, sub: c.sub, risco: "Médio", contexto: "Consulta manual" }]); notify("Indicador adicionado à base."); $("consultaForm").requestSubmit(); });
        }
    });

    // mudanças feitas em outra aba
    S.on(what => { if (what === "externo") render(); });

    render();
    if (!S.sandbox.get().resultado) status(S.sandbox.get().entrada ? "Pronto. Clique em Desobfuscar (Ctrl+Enter)." : "Escolha um exemplo, cole um código ou abra um arquivo.");
    window.__sandbox = { edIn, edOut, rodar, render };
});
