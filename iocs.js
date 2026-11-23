/* ThreatEye – Base de IoCs e Relatórios (Biblioteca). Lê tudo do TEStore. */
(function () {
    if (!window.TEStore || !document.getElementById("iocApp")) return;
    const $ = id => document.getElementById(id);
    const S = TEStore;
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const notify = m => (window.TEBib ? TEBib.notify(m) : null);
    const nivel = r => r === "Crítico" ? "crit" : r === "Alto" ? "alto" : r === "Médio" ? "med" : "ok";
    const ORD_RISCO = { "Crítico": 4, "Alto": 3, "Médio": 2, "Baixo": 1 };
    const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>';

    /* ============================================================ IoCs */
    const q = { busca: "", tipo: "todos", risco: "todos", origem: "todos", periodo: "todos", fav: false, ordem: "ts", dir: -1, pag: 1, tam: 10 };

    function filtrados() {
        const termo = q.busca.trim().toLowerCase(), corte = q.periodo === "todos" ? 0 : Date.now() - Number(q.periodo) * 864e5;
        const lista = S.iocs.all().filter(i =>
            (!termo || (i.valor + " " + (i.familia || "") + " " + i.origem + " " + (i.sub || "")).toLowerCase().includes(termo)) &&
            (q.tipo === "todos" || i.tipo === q.tipo) && (q.risco === "todos" || i.risco === q.risco) &&
            (q.origem === "todos" || i.origem === q.origem) && i.ts >= corte && (!q.fav || S.iocs.isFav(S.keyOf(i))));
        const k = q.ordem, d = q.dir;
        lista.sort((a, b) => {
            const x = k === "risco" ? ORD_RISCO[a.risco] : a[k], y = k === "risco" ? ORD_RISCO[b.risco] : b[k];
            return (typeof x === "string" ? x.localeCompare(y, "pt-BR") : x - y) * d || b.ts - a.ts;
        });
        return lista;
    }

    function desenharStats() {
        const st = S.stats(), todos = S.iocs.all();
        const carta = (rot, v, sub, cls) => `<article class="ioc-stat-card"><div class="ioc-stat-top"><span>${rot}</span></div><strong class="${cls || ""}">${v}</strong><small>${sub}</small></article>`;
        const hoje = todos.filter(i => i.ts > Date.now() - 864e5).length;
        $("iocStats").innerHTML =
            carta("Catalogados", st.iocs, `${hoje} nas últimas 24 h`) +
            carta("Risco crítico", st.criticos, `${Math.round(st.criticos / Math.max(st.iocs, 1) * 100)}% da base`, "danger-num") +
            carta("Favoritos", S.iocs.favCount(), "acompanhados por você") +
            carta("Adicionados por mim", st.meus, "extraídos na sandbox ou manuais");
    }

    function desenhar() {
        const lista = filtrados(), total = lista.length, paginas = Math.max(1, Math.ceil(total / q.tam));
        if (q.pag > paginas) q.pag = paginas;
        const ini = (q.pag - 1) * q.tam, fatia = lista.slice(ini, ini + q.tam);
        $("iocsTbody").innerHTML = fatia.length ? fatia.map(i => {
            const k = S.keyOf(i), fav = S.iocs.isFav(k);
            return `<tr>
                <td class="col-fav"><button type="button" class="star${fav ? " on" : ""}" data-fav="${esc(k)}" aria-pressed="${fav}" aria-label="${fav ? "Remover dos" : "Adicionar aos"} favoritos">${STAR}</button></td>
                <td class="ioc-val"><code title="${esc(i.valor)}">${esc(i.valor)}</code><small>${esc(i.familia || "")}</small></td>
                <td>${esc(i.tipo)}${i.sub ? ` <small class="sub">${esc(i.sub)}</small>` : ""}</td>
                <td><span class="sev ${nivel(i.risco)}">${esc(i.risco)}</span></td>
                <td>${esc(i.origem)}</td>
                <td>${esc(S.fmtData(i.ts))}</td>
                <td><button type="button" class="btn-table ioc-copy-btn" data-copiar="${esc(i.valor)}">Copiar</button></td></tr>`;
        }).join("") : `<tr><td colspan="7" class="tbl-vazio">${q.fav ? "Você ainda não marcou favoritos neste filtro." : "Nenhum indicador encontrado com esses filtros."}</td></tr>`;
        $("iocCount").textContent = total ? `${ini + 1}–${ini + fatia.length} de ${total}` : "0 resultados";
        $("iocPageInfo").textContent = `Página ${q.pag} de ${paginas}`;
        $("iocPrevPage").disabled = q.pag <= 1; $("iocNextPage").disabled = q.pag >= paginas;
        document.querySelectorAll(".th-sort").forEach(b => { const on = b.dataset.sort === q.ordem; b.classList.toggle("on", on); b.dataset.dir = on ? (q.dir > 0 ? "asc" : "desc") : ""; b.closest("th").setAttribute("aria-sort", on ? (q.dir > 0 ? "ascending" : "descending") : "none"); });
        $("iocSoFav").classList.toggle("on", q.fav); $("iocSoFav").setAttribute("aria-pressed", String(q.fav));
        desenharStats();
    }

    let tb;
    $("iocSearchInput").addEventListener("input", e => { clearTimeout(tb); tb = setTimeout(() => { q.busca = e.target.value; q.pag = 1; desenhar(); }, 120); });
    [["iocTypeFilter", "tipo"], ["iocSeverityFilter", "risco"], ["iocOriginFilter", "origem"], ["iocPeriodFilter", "periodo"]].forEach(([id, k]) => $(id).addEventListener("change", e => { q[k] = e.target.value; q.pag = 1; desenhar(); }));
    $("iocPageSize").addEventListener("change", e => { q.tam = Number(e.target.value); q.pag = 1; desenhar(); });
    $("iocSoFav").addEventListener("click", () => { q.fav = !q.fav; q.pag = 1; desenhar(); });
    $("iocPrevPage").addEventListener("click", () => { q.pag--; desenhar(); });
    $("iocNextPage").addEventListener("click", () => { q.pag++; desenhar(); });
    document.querySelectorAll(".th-sort").forEach(b => b.addEventListener("click", () => {
        if (q.ordem === b.dataset.sort) q.dir *= -1; else { q.ordem = b.dataset.sort; q.dir = b.dataset.sort === "ts" || b.dataset.sort === "risco" ? -1 : 1; }
        q.pag = 1; desenhar();
    }));
    $("iocsTbody").addEventListener("click", e => {
        const f = e.target.closest("[data-fav]");
        if (f) { const on = S.iocs.toggleFav(f.dataset.fav); notify(on ? "Adicionado aos favoritos." : "Removido dos favoritos."); desenhar(); return; }
        const c = e.target.closest("[data-copiar]");
        if (c) { navigator.clipboard && navigator.clipboard.writeText(c.dataset.copiar).catch(() => { }); notify("Copiado: " + c.dataset.copiar); }
    });
    $("iocExportar").addEventListener("click", () => {
        const l = filtrados(), cel = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
        const csv = "﻿" + ["valor,tipo,risco,origem,familia,ultima_ocorrencia"].concat(l.map(i => [i.valor, i.tipo, i.risco, i.origem, i.familia, new Date(i.ts).toISOString()].map(cel).join(","))).join("\n");
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = "iocs.csv"; a.click(); URL.revokeObjectURL(a.href);
        notify(`${l.length} indicadores exportados.`);
    });

    /* ============================================================ Relatórios */
    const r = { filtro: "todos", busca: "" };
    const grid = $("relatoriosGrid");

    function listaRel() {
        const t = r.busca.trim().toLowerCase();
        return S.reports.all().filter(x =>
            (r.filtro === "todos" || (r.filtro === "fav" && S.reports.isFav(x.id)) || (r.filtro === "sandbox" && x.origem === "sandbox")) &&
            (!t || (x.id + " " + x.titulo + " " + x.resumo + " " + (x.tags || []).join(" ")).toLowerCase().includes(t)));
    }
    function desenharRel() {
        const l = listaRel();
        grid.innerHTML = l.map(x => {
            const fav = S.reports.isFav(x.id);
            return `<article class="biblioteca-card rel-card" data-rel="${esc(x.id)}" tabindex="0" role="button" aria-label="Abrir ${esc(x.id)}">
                <div class="rel-top"><span class="rel-id">${esc(x.id)}</span>
                    <button type="button" class="star${fav ? " on" : ""}" data-relfav="${esc(x.id)}" aria-pressed="${fav}" aria-label="${fav ? "Remover dos" : "Adicionar aos"} favoritos">${STAR}</button></div>
                <h2>${esc(x.titulo)}</h2>
                <p>${esc(x.resumo)}</p>
                <dl class="rel-meta">
                    <div><dt>Classificação</dt><dd>${esc(x.tlp || "—")}</dd></div>
                    <div><dt>Confiança</dt><dd>${esc(x.confianca || "—")}</dd></div>
                    <div><dt>MITRE ATT&amp;CK</dt><dd>${esc(x.mitre || "—")}</dd></div>
                    <div><dt>Severidade</dt><dd><span class="sev ${nivel(x.severidade === "Crítica" ? "Crítico" : x.severidade === "Alta" ? "Alto" : x.severidade === "Média" ? "Médio" : "Baixo")}">${esc(x.severidade || "—")}</span></dd></div>
                </dl>
                <div class="card-footer"><span>${esc(x.autor || "Analista")} · ${x.nIocs || 0} IoCs · ${esc(S.fmtData(x.ts))}</span>${x.origem === "sandbox" ? '<span class="rel-tag">sandbox</span>' : ""}</div>
            </article>`;
        }).join("");
        $("relVazio").hidden = l.length > 0;
        $("relVazio").textContent = r.filtro === "fav" ? "Você ainda não marcou relatórios como favoritos." : "Nenhum relatório neste filtro.";
    }

    $("relFiltros").addEventListener("click", e => { const b = e.target.closest("[data-rel-filtro]"); if (!b) return; r.filtro = b.dataset.relFiltro; document.querySelectorAll("#relFiltros .tab").forEach(t => t.classList.toggle("active", t === b)); desenharRel(); });
    $("relBusca").addEventListener("input", e => { r.busca = e.target.value; desenharRel(); });

    function abrirRel(id) {
        const x = S.reports.get(id); if (!x) return;
        const inv = x.investigacao, res = inv && inv.resultado, dlg = $("dlgRel");
        const fav = S.reports.isFav(id);
        const iocs = res ? res.iocs : (x.iocs || []);
        dlg.innerHTML = `
            <div class="dlg-head"><div><span class="rel-id">${esc(x.id)}</span><h3>${esc(x.titulo)}</h3></div>
                <button type="button" class="star${fav ? " on" : ""}" id="dlgFav" aria-pressed="${fav}" aria-label="Favoritar">${STAR}</button></div>
            <p class="dlg-sub">${esc(x.resumo)}</p>
            <dl class="rel-meta rel-meta-lg">
                <div><dt>Classificação</dt><dd>${esc(x.tlp || "—")}</dd></div><div><dt>Confiança</dt><dd>${esc(x.confianca || "—")}</dd></div>
                <div><dt>MITRE ATT&amp;CK</dt><dd>${esc(x.mitre || "—")}</dd></div><div><dt>Situação</dt><dd>${esc(x.situacao || "—")}</dd></div>
                <div><dt>Autor</dt><dd>${esc(x.autor || "—")}</dd></div><div><dt>Criado</dt><dd>${esc(S.fmtData(x.ts))}</dd></div>
            </dl>
            ${res && res.comportamentos.length ? `<h4 class="dlg-h">Comportamentos</h4><ul class="dlg-list">${res.comportamentos.map(b => `<li><span class="sev ${b.severidade}">${esc(b.titulo)}</span><small>${esc(b.descricao)}</small></li>`).join("")}</ul>` : ""}
            ${iocs.length ? `<h4 class="dlg-h">Indicadores (${iocs.length})</h4><ul class="dlg-list dlg-iocs">${iocs.slice(0, 40).map(i => `<li><b>${esc(i.tipo)}</b><code>${esc(i.valor)}</code></li>`).join("")}</ul>` : ""}
            ${x.detalhes ? `<h4 class="dlg-h">Detalhes</h4><p class="dlg-sub">${esc(x.detalhes)}</p>` : ""}
            <div class="dlg-foot">
                ${x.fixo ? "" : '<button type="button" class="btn-ghost danger" id="dlgExcluir">Excluir</button>'}
                <span class="dlg-gap"></span>
                ${inv ? '<button type="button" class="btn-ghost" id="dlgAbrirSb">Abrir na sandbox</button>' : ""}
                <button type="button" class="btn-primary" id="dlgFechar">Fechar</button>
            </div>`;
        dlg.showModal();
        $("dlgFechar").addEventListener("click", () => dlg.close());
        $("dlgFav").addEventListener("click", () => { S.reports.toggleFav(id); desenharRel(); abrirRel(id); });
        if ($("dlgExcluir")) $("dlgExcluir").addEventListener("click", () => { if (confirm(`Excluir ${id}? Esta ação não pode ser desfeita.`)) { S.reports.remove(id); dlg.close(); desenharRel(); notify(id + " excluído."); } });
        if ($("dlgAbrirSb")) $("dlgAbrirSb").addEventListener("click", () => {
            S.sandbox.checkpoint();
            S.sandbox.set({ entrada: inv.entrada || "", exemploId: inv.exemploId || null, arquivo: inv.arquivo || null, resultado: inv.resultado || null });
            setTimeout(() => { location.href = "index.html"; }, 200);   // aguarda a gravação (150 ms)
        });
    }
    grid.addEventListener("click", e => {
        const f = e.target.closest("[data-relfav]");
        if (f) { e.stopPropagation(); const on = S.reports.toggleFav(f.dataset.relfav); notify(on ? "Relatório favoritado." : "Removido dos favoritos."); desenharRel(); return; }
        const c = e.target.closest("[data-rel]"); if (c) abrirRel(c.dataset.rel);
    });
    grid.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-rel]")) { e.preventDefault(); abrirRel(e.target.dataset.rel); } });
    $("dlgRel").addEventListener("click", e => { if (e.target === $("dlgRel")) $("dlgRel").close(); });

    S.on(w => { if (w === "iocs" || w === "favoritos" || w === "externo") desenhar(); if (w === "relatorios" || w === "favoritos" || w === "externo") desenharRel(); });
    document.addEventListener("te:view", e => { if (e.detail === "iocs") desenhar(); if (e.detail === "relatorios") desenharRel(); });
    desenhar(); desenharRel();
    window.__iocs = { q, filtrados };
})();
