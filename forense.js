/* ThreatEye – Linha do tempo forense (Biblioteca → Linha do tempo).
 * Lê logs brutos (texto, chave=valor e JSON), reconstrói a cadeia do ataque por tática/técnica MITRE
 * e desenha um Gantt interativo em SVG + uma árvore hierárquica. Tudo roda no navegador. */
(function () {
    const root = document.getElementById("fxApp");
    if (!root || !window.TEStore || !window.TEDados) return;

    const $ = id => document.getElementById(id);
    const S = TEStore, D = TEDados;
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const NS = "http://www.w3.org/2000/svg";
    const p2 = n => String(n).padStart(2, "0");
    const hms = ms => { const d = new Date(ms); return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`; };
    const hm = ms => hms(ms).slice(0, 5);
    const dataBr = ms => { const d = new Date(ms); return `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`; };
    function dur(ms) {
        const m = Math.round(ms / 60000);
        if (m < 1) return Math.round(ms / 1000) + " s";
        if (m < 60) return m + " min";
        return Math.floor(m / 60) + " h " + p2(m % 60) + " min";
    }

    /* ---------------------------------------------------------------- parser */
    const KV = /([\w.-]+)=("([^"]*)"|\S+)/g;
    function kv(str) {
        const o = {}; let m; KV.lastIndex = 0;
        while ((m = KV.exec(str))) o[m[1]] = m[3] !== undefined ? m[3] : m[2];
        return o;
    }
    const toMs = t => { const s = String(t).trim().replace(" ", "T"); const ms = Date.parse(/Z$|[+-]\d\d:?\d\d$/.test(s) ? s : s + "Z"); return isNaN(ms) ? null : ms; };

    /* Aceita: JSON por linha; "DATA HORA host FONTE evento k=v ..."; e "DATA HORA host TIPO k=v" (alertas/ações). */
    function parseLinha(txt, n) {
        const raw = txt.trim();
        if (!raw) return null;
        if (raw[0] === "{") {
            try {
                let j; try { j = JSON.parse(raw); } catch (e0) { j = JSON.parse(raw.replace(/\\(?!["\\/bfnrtu])/g, "\\\\")); }   // tolera "C:\\Windows" sem escape duplo
                const ts = toMs(j.ts || j.time || j.timestamp || j["@timestamp"]);
                if (ts == null) return { erro: n };
                const { ts: _a, time: _b, timestamp: _c, host, src, event, ...resto } = j;
                return { ts, host: host || j.hostname || "—", src: src || "LOG", ev: String(event || j.type || "evento"), campos: resto, raw, linha: n };
            } catch (e) { return { erro: n }; }
        }
        const m = raw.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d\d:?\d\d)?)\s+(\S+)\s+(\S+)\s*(.*)$/);
        if (!m) return { erro: n };
        const ts = toMs(m[1]); if (ts == null) return { erro: n };
        const host = m[2], tok3 = m[3];
        let src, ev, resto = m[4];
        if (/=/.test(tok3)) { src = "LOG"; ev = "evento"; resto = tok3 + " " + resto; }
        else if (/^(ALERT|ACTION)$/.test(tok3)) {      // "host ALERT rule=…" / "host ACTION isolate host=…"
            src = host; ev = tok3.toLowerCase();
            const m3 = resto.match(/^([^\s=]+)\s+(.*)$/);
            if (m3) { resto = m3[2]; const campos = kv(resto); campos.acao = m3[1]; return { ts, host, src, ev, campos, raw, linha: n }; }
        } else {
            const m2 = resto.match(/^(\S+)\s*(.*)$/);
            if (m2 && !/=/.test(m2[1])) { src = tok3; ev = m2[1]; resto = m2[2]; }
            else { src = host; ev = tok3.toLowerCase(); }   // "host ALERT rule=…" → fonte = host, evento = alert
        }
        return { ts, host, src, ev, campos: kv(resto), raw, linha: n };
    }

    /* ----------------------------------------------- classificação MITRE ATT&CK */
    const TATICAS = [
        { id: "acesso", nome: "Acesso inicial", cod: "TA0001" },
        { id: "exec", nome: "Execução", cod: "TA0002" },
        { id: "persist", nome: "Persistência", cod: "TA0003" },
        { id: "cred", nome: "Acesso a credenciais", cod: "TA0006" },
        { id: "desc", nome: "Descoberta", cod: "TA0007" },
        { id: "lateral", nome: "Movimento lateral", cod: "TA0008" },
        { id: "coleta", nome: "Coleta", cod: "TA0009" },
        { id: "c2", nome: "Comando e controle", cod: "TA0011" },
        { id: "exfil", nome: "Exfiltração", cod: "TA0010" },
        { id: "resp", nome: "Detecção e resposta", cod: "—" }
    ];
    const T = id => TATICAS.find(t => t.id === id);
    const tamMB = b => { const m = String(b || "").match(/([\d.,]+)\s*(KB|MB|GB)/i); if (!m) return 0; const v = parseFloat(m[1].replace(",", ".")); return m[2].toUpperCase() === "GB" ? v * 1024 : m[2].toUpperCase() === "MB" ? v : v / 1024; };

    function classificar(e) {
        const c = e.campos, ev = e.ev.toLowerCase(), cmd = String(c.cmd || c.child || "").toLowerCase();
        const R = (tat, tec, nome, sev, titulo) => Object.assign(e, { tat, tec, tecNome: nome, sev: sev || "med", titulo });
        switch (ev) {
            case "delivered": return R("acesso", "T1566.001", "Phishing com anexo", "alto", `E-mail com anexo entregue a ${c.to || "usuário"}`);
            case "file_open": return R("exec", "T1204.002", "Arquivo aberto pelo usuário", "med", `${c.user || "Usuário"} abriu ${c.file || "um arquivo"}`);
            case "http_get": return R("acesso", "T1566.002", "Phishing com link", "alto", "Acesso a página de login falsa");
            case "file_write": return R("exec", "T1204.002", "Arquivo malicioso gravado", "alto", `Gravação de ${String(c.path || "").split("\\").pop() || "arquivo"}`);
            case "process_create":
                if (/whoami|net user|ipconfig|systeminfo/.test(cmd)) return R("desc", "T1033", "Descoberta de conta/sistema", "med", `Execução de ${c.child}`);
                if (/powershell/.test(cmd)) return R("exec", "T1059.001", "PowerShell", "alto", "PowerShell oculto com comando codificado");
                if (/wscript|cscript|\.js/.test(cmd)) return R("exec", "T1059.007", "JavaScript (Windows Script Host)", "alto", `${c.parent || "processo"} executou ${c.child}`);
                return R("exec", "T1059", "Interpretador de comandos", "med", `${c.child || "processo"} criado`);
            case "reg_set": return R("persist", "T1547.001", "Chave Run do registro", "alto", "Chave de inicialização criada");
            case "schtask_create": return R("persist", "T1053.005", "Tarefa agendada", "alto", `Tarefa agendada “${c.name || ""}”`);
            case "service_create": return R("persist", "T1543.003", "Serviço do Windows", "alto", `Serviço “${c.name || ""}” criado`);
            case "lsass_access": return R("cred", "T1003.001", "Memória do LSASS", "crit", "Leitura da memória do LSASS");
            case "logon_failed": return R("cred", "T1110", "Força bruta", "alto", `Falhas de login (${c.user || "?"}${c.count ? ", " + c.count : ""})`);
            case "logon_success":
                if (c.dst) return R("lateral", "T1021.002", "SMB / compartilhamentos admin", "alto", `Logon de rede em ${c.dst}`);
                return R("acesso", "T1078", "Contas válidas", "alto", `Login válido de ${c.user || "?"}`);
            case "session_start": return R("acesso", "T1078", "Contas válidas", "alto", "Sessão de VPN aberta");
            case "smb_connect":
                if (/ADMIN\$|C\$/i.test(c.share || "")) return R("lateral", "T1021.002", "SMB / compartilhamentos admin", "alto", `Acesso a ${c.share}`);
                return R("desc", "T1135", "Descoberta de compartilhamentos", "med", `Listagem de ${c.share || "compartilhamento"}`);
            case "archive_create": return R("coleta", "T1560.001", "Dados compactados", "alto", `Arquivo compactado (${c.size || "?"})`);
            case "dns_query": return R("c2", "T1071.004", "DNS", "med", `Consulta a ${c.query || "domínio"}`);
            case "conn_out":
                if (tamMB(c.bytes) >= 50 || /upload|envio/i.test(c.note || "")) return R("exfil", "T1041", "Exfiltração pelo canal C2", "crit", `Envio de ${c.bytes || "dados"} para ${c.dst}`);
                return R("c2", "T1071.001", "Protocolos web", "alto", `Conexão com ${c.dst}:${c.port || ""}`);
            case "alert": return R("resp", "ALERTA", "Alerta do SIEM", "alto", `Alerta: ${c.rule || "regra"}`);
            case "action": return R("resp", "AÇÃO", "Resposta", "ok", `Ação: ${c.acao || "resposta"}${c.host || c.user ? " · " + (c.host || c.user) : ""}`);
        }
        return R("exec", "—", "Evento não classificado", "med", e.ev);
    }

    function reconstruir(texto) {
        const eventos = [], ignoradas = [];
        texto.split(/\r?\n/).forEach((l, i) => {
            const e = parseLinha(l, i + 1);
            if (!e) return;
            if (e.erro) { ignoradas.push(e.erro); return; }
            eventos.push(classificar(e));
        });
        eventos.sort((a, b) => a.ts - b.ts || a.linha - b.linha);
        eventos.forEach((e, i) => { e.id = i; });
        return { eventos, ignoradas };
    }

    /* ---------------------------------------------------------------- estado local */
    let eventos = [], ignoradas = [], selId = null, zoom = 1, fechadas = new Set(), ed = null, painelAberto = false;
    const fx = () => S.forense.get();
    const incAtual = () => fx().incidente;
    const textoAtual = () => { const t = fx().textos[incAtual()]; return t != null ? t : (D.logs[incAtual()] || { texto: "" }).texto; };
    const visiveis = () => { const h = fx().host; return h === "todos" ? eventos : eventos.filter(e => e.host === h); };
    const COR = { crit: "var(--sev-crit,#e11d48)", alto: "var(--sev-alto,#f97316)", med: "var(--sev-med,#eab308)", ok: "var(--sev-ok,#10b981)" };

    /* ---------------------------------------------------------------- Gantt */
    const L = { rot: 320, topo: 34, linha: 30, sub: 26, margem: 28 };
    function el(tag, attrs, parent) { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }

    function agrupar(evs) {
        const g = [];
        TATICAS.forEach(t => {
            const es = evs.filter(e => e.tat === t.id); if (!es.length) return;
            const tec = {};
            es.forEach(e => { (tec[e.tec] = tec[e.tec] || { cod: e.tec, nome: e.tecNome, evs: [] }).evs.push(e); });
            g.push({ t, evs: es, tecs: Object.values(tec) });
        });
        return g;
    }

    function desenhar() {
        const evs = visiveis(), box = $("fxGantt");
        box.innerHTML = "";
        if (!evs.length) { box.innerHTML = '<p class="fx-vazio">Nenhum evento para exibir. Verifique os logs ou o filtro de host.</p>'; return; }
        const t0 = evs[0].ts, t1 = evs[evs.length - 1].ts, span = Math.max(t1 - t0, 60000);
        const pad = span * 0.03, ini = t0 - pad, fim = t1 + pad;
        const largura = Math.max(box.clientWidth, 720);
        const W = Math.round((largura - L.rot - L.margem) * zoom);
        const x = ts => L.rot + ((ts - ini) / (fim - ini)) * W;
        const grupos = agrupar(evs);

        // linhas visíveis
        const linhas = []; let y = L.topo;
        grupos.forEach(gr => {
            linhas.push({ tipo: "tat", gr, y, h: L.linha }); y += L.linha;
            if (!fechadas.has(gr.t.id)) gr.tecs.forEach(tc => { linhas.push({ tipo: "tec", gr, tc, y, h: L.sub }); y += L.sub; });
        });
        const H = y + 12, Wt = L.rot + W + L.margem;
        const svg = el("svg", { width: Wt, height: H, viewBox: `0 0 ${Wt} ${H}`, role: "img", "aria-label": "Gráfico de Gantt da linha do tempo do incidente" });

        // grade temporal
        const alvos = [60e3, 120e3, 300e3, 600e3, 900e3, 1800e3, 3600e3, 7200e3];
        const passo = alvos.find(p => (fim - ini) / p <= (W / 90)) || alvos[alvos.length - 1];
        for (let t = Math.ceil(ini / passo) * passo; t <= fim; t += passo) {
            el("line", { x1: x(t), x2: x(t), y1: L.topo - 6, y2: H - 8, class: "fx-grade" }, svg);
            const tx = el("text", { x: x(t), y: L.topo - 12, class: "fx-eixo", "text-anchor": "middle" }, svg); tx.textContent = hm(t);
        }
        // faixas e rótulos
        linhas.forEach((l, i) => {
            if (l.tipo === "tat") {
                el("rect", { x: 0, y: l.y, width: Wt, height: l.h, class: "fx-faixa" }, svg);
                const g = el("g", { class: "fx-rot-tat", tabindex: 0, role: "button", "aria-expanded": String(!fechadas.has(l.gr.t.id)), "data-tat": l.gr.t.id }, svg);
                el("rect", { x: 0, y: l.y, width: L.rot, height: l.h, class: "fx-area" }, g);   // linha inteira é alvo de toque
                el("path", { d: fechadas.has(l.gr.t.id) ? "M12 " + (l.y + 10) + " l5 5 l-5 5" : "M10 " + (l.y + 12) + " l5 5 l5 -5", class: "fx-seta" }, g);
                const a = el("text", { x: 28, y: l.y + 19, class: "fx-tat" }, g); a.textContent = l.gr.t.nome;
                const c = el("text", { x: L.rot - 12, y: l.y + 19, class: "fx-cont", "text-anchor": "end" }, g); c.textContent = l.gr.evs.length;
                // resumo da tática (intervalo)
                const a0 = l.gr.evs[0].ts, a1 = l.gr.evs[l.gr.evs.length - 1].ts;
                el("rect", { x: x(a0), y: l.y + 9, width: Math.max(x(a1) - x(a0), 3), height: 12, rx: 3, class: "fx-resumo" }, svg);
            } else {
                const a = el("text", { x: 44, y: l.y + 17, class: "fx-tec" }, svg);
                const rot = (l.tc.cod.length > 9 ? "" : l.tc.cod + "  ") + l.tc.nome;
                a.textContent = rot.length > 36 ? rot.slice(0, 35) + "…" : rot;
                if (rot.length > 36) { const tt = el("title", {}, a); tt.textContent = rot; }
                const t0e = l.tc.evs[0].ts, t1e = l.tc.evs[l.tc.evs.length - 1].ts;
                if (l.tc.evs.length > 1) el("rect", { x: x(t0e), y: l.y + 10, width: Math.max(x(t1e) - x(t0e), 3), height: 6, rx: 3, class: "fx-barra" }, svg);
                const toque = matchMedia("(pointer:coarse)").matches;
                if (toque) l.tc.evs.forEach(e => {   // 1ª passada: alvos invisíveis de 28 px, abaixo dos pontos
                    const h = el("circle", { cx: x(e.ts), cy: l.y + 13, r: 14, class: "fx-hit", "data-id": e.id, "aria-hidden": "true" }, svg);
                    h.addEventListener("mouseenter", ev => dica(e, ev)); h.addEventListener("mouseleave", () => $("fxDica").hidden = true);
                });
                l.tc.evs.forEach(e => {
                    const p = el("circle", { cx: x(e.ts), cy: l.y + 13, r: e.id === selId ? 7 : 5, class: "fx-ev" + (e.id === selId ? " sel" : ""), fill: COR[e.sev], tabindex: 0, role: "button", "data-id": e.id, "aria-label": `${hms(e.ts)} ${e.titulo}, severidade ${({crit:"crítica",alto:"alta",med:"média",ok:"baixa"})[e.sev]||e.sev}` }, svg);
                    p.addEventListener("mouseenter", ev => dica(e, ev)); p.addEventListener("mousemove", ev => dica(e, ev)); p.addEventListener("mouseleave", () => $("fxDica").hidden = true);
                    p.addEventListener("focus", () => { const r = p.getBoundingClientRect(); dica(e, { clientX: r.left, clientY: r.top }); });   // por teclado também
                    p.addEventListener("blur", () => $("fxDica").hidden = true);
                });
            }
        });
        // linha da primeira detecção
        const det = evs.find(e => e.tat === "resp");
        if (det) { el("line", { x1: x(det.ts), x2: x(det.ts), y1: L.topo - 6, y2: H - 8, class: "fx-det" }, svg); const tx = el("text", { x: x(det.ts) + 5, y: H - 14, class: "fx-det-t" }, svg); tx.textContent = "detecção"; }
        box.appendChild(svg);
    }

    function dica(e, ev) {
        const d = $("fxDica"), wrap = $("fxGanttWrap").getBoundingClientRect();
        const SEV = { crit: "Crítica", alto: "Alta", med: "Média", ok: "Baixa" };
        d.innerHTML = `<b>${hms(e.ts)}</b> · ${esc(e.host)}<br>${esc(e.titulo)}<br><small>${esc(e.tec)} · ${esc(e.tecNome)} · Severidade ${SEV[e.sev] || esc(e.sev)}</small>`;
        d.hidden = false;
        d.style.left = Math.min(ev.clientX - wrap.left + 14, wrap.width - 260) + "px";
        d.style.top = (ev.clientY - wrap.top + 16) + "px";
    }

    /* ---------------------------------------------------------------- árvore */
    function desenharArvore() {
        const evs = visiveis();
        const hosts = {}; evs.forEach(e => { (hosts[e.host] = hosts[e.host] || []).push(e); });
        const nomes = Object.keys(hosts).sort((a, b) => hosts[a][0].ts - hosts[b][0].ts);
        $("fxArvore").innerHTML = `<ul class="tr">${nomes.map(h => `
            <li><details open><summary><b>${esc(h)}</b> <em>${hosts[h].length} ${hosts[h].length === 1 ? "evento" : "eventos"}</em></summary>
                <ul class="tr">${agrupar(hosts[h]).map(g => `
                    <li><details ${g.evs.some(e => e.id === selId) ? "open" : ""}><summary>${esc(g.t.nome)} <em>${g.evs.length}</em></summary>
                        <ul class="tr">${g.tecs.map(tc => `
                            <li><details ${tc.evs.some(e => e.id === selId) ? "open" : ""}><summary><code>${esc(tc.cod)}</code> ${esc(tc.nome)} <em>${tc.evs.length}</em></summary>
                                <ul class="tr tr-ev">${tc.evs.map(e => `<li><button type="button" class="fx-no${e.id === selId ? " on" : ""}" data-id="${e.id}"><i class="fx-pt" style="background:${COR[e.sev]}"></i><time>${hms(e.ts)}</time>${esc(e.titulo)}</button></li>`).join("")}</ul>
                            </details></li>`).join("")}</ul>
                    </details></li>`).join("")}</ul>
            </details></li>`).join("")}</ul>`;
    }

    /* ---------------------------------------------------------------- detalhe */
    const ROT = { user: "Usuário", cmd: "Comando", path: "Caminho", dst: "Destino", port: "Porta", bytes: "Volume", note: "Observação", url: "URL", file: "Arquivo", query: "Consulta DNS", answer: "Resposta", key: "Chave", value: "Valor", name: "Nome", image: "Imagem", proc: "Processo", parent: "Processo pai", child: "Processo filho", share: "Compartilhamento", src: "Origem", rule: "Regra", severity: "Gravidade", size: "Tamanho", from: "De", to: "Para", subject: "Assunto", attach: "Anexo", sha256: "SHA-256", type: "Tipo", access: "Acesso", count: "Tentativas", ip: "IP", geo: "Local", verdict: "Veredito", by: "Por", acao: "Ação" };
    function desenharDetalhe() {
        const e = eventos.find(x => x.id === selId), box = $("fxDetalhe");
        if (!e) { box.innerHTML = '<p class="vazio">Clique em um evento no gráfico ou na árvore para ver os detalhes e a linha original do log.</p>'; return; }
        const t = T(e.tat), i = eventos.indexOf(e);
        const ant = eventos[i - 1], dep = eventos[i + 1];
        box.innerHTML = `
            <div class="fx-det-top"><span class="sev ${e.sev}">${esc(t.nome)}</span><code>${esc(e.tec)}</code></div>
            <h4>${esc(e.titulo)}</h4>
            <dl class="fx-dl">
                <dt>Horário</dt><dd>${dataBr(e.ts)} ${hms(e.ts)} UTC</dd>
                <dt>Host</dt><dd>${esc(e.host)}</dd>
                <dt>Fonte / evento</dt><dd>${esc(e.src)} · ${esc(e.ev)}</dd>
                ${Object.entries(e.campos).map(([k, v]) => `<dt>${esc(ROT[k] || k)}</dt><dd class="mono">${esc(typeof v === "object" ? JSON.stringify(v) : v)}</dd>`).join("")}
            </dl>
            <div class="fx-raw-h"><span>Linha ${e.linha} do log</span><button type="button" class="ide-link" id="fxCopiarLinha">Copiar</button></div>
            <pre class="fx-raw">${esc(e.raw)}</pre>
            <div class="fx-nav">
                <button type="button" class="btn-ghost btn-sm" data-id="${ant ? ant.id : ""}" ${ant ? "" : "disabled"}>← Anterior</button>
                <button type="button" class="btn-ghost btn-sm" data-id="${dep ? dep.id : ""}" ${dep ? "" : "disabled"}>Próximo →</button>
            </div>`;
        $("fxCopiarLinha").addEventListener("click", () => { navigator.clipboard && navigator.clipboard.writeText(e.raw); aviso("Linha copiada."); });
    }

    function aviso(m) { const t = document.querySelector(".toast"); if (!t) return; t.textContent = m; t.classList.add("show"); clearTimeout(aviso.t); aviso.t = setTimeout(() => t.classList.remove("show"), 2200); }

    /* ---------------------------------------------------------------- resumo */
    function desenharResumo() {
        const evs = visiveis();
        if (!evs.length) { $("fxResumo").innerHTML = ""; return; }
        const hosts = new Set(evs.map(e => e.host).filter(h => !/^SOC-/.test(h)));
        const tats = new Set(evs.filter(e => e.tat !== "resp").map(e => e.tat));
        const det = evs.find(e => e.tat === "resp"), ini = evs[0].ts;
        const tecs = new Set(evs.filter(e => e.tat !== "resp").map(e => e.tec));
        const item = (v, r, s) => `<div><strong>${v}</strong><span>${r}</span>${s ? `<small>${s}</small>` : ""}</div>`;
        $("fxResumo").innerHTML =
            item(dur(evs[evs.length - 1].ts - ini), "Duração do incidente", `${hm(ini)} → ${hm(evs[evs.length - 1].ts)} UTC`) +
            item(det ? dur(det.ts - ini) : "—", "Até a detecção", det ? "primeiro alerta às " + hm(det.ts) : "sem alerta") +
            item(evs.length, "Eventos", ignoradas.length ? `${ignoradas.length} linha(s) ignorada(s)` : "todas as linhas lidas") +
            item(hosts.size, hosts.size === 1 ? "Host afetado" : "Hosts afetados", [...hosts].join(", ")) +
            item(tats.size + " / " + tecs.size, "Táticas / técnicas", "MITRE ATT&CK");
    }

    /* ---------------------------------------------------------------- tudo */
    function atualizarHosts() {
        const hosts = [...new Set(eventos.map(e => e.host))].sort();
        const sel = $("fxHost"), atual = fx().host;
        sel.innerHTML = `<option value="todos">Todos os hosts</option>` + hosts.map(h => `<option ${h === atual ? "selected" : ""}>${esc(h)}</option>`).join("");
        if (atual !== "todos" && !hosts.includes(atual)) S.forense.set({ host: "todos" }, { silencioso: true });
    }
    function render(refazer) {
        if (refazer) { const r = reconstruir(textoAtual()); eventos = r.eventos; ignoradas = r.ignoradas; if (!eventos.find(e => e.id === selId)) selId = null; atualizarHosts(); }
        $("fxTitulo").textContent = (D.logs[incAtual()] || {}).resumo || "Incidente personalizado.";
        $("fxEditado").hidden = fx().textos[incAtual()] == null;
        desenharResumo(); desenhar(); desenharArvore(); desenharDetalhe();
        $("fxZoomInfo").textContent = Math.round(zoom * 100) + "%";
        $("fxIgn").hidden = !ignoradas.length;
        if (ignoradas.length) $("fxIgn").textContent = `${ignoradas.length} linha(s) não reconhecida(s): ${ignoradas.slice(0, 6).join(", ")}${ignoradas.length > 6 ? "…" : ""}`;
    }
    function selecionar(id, rolar) {
        selId = id === "" || id == null ? null : Number(id);
        S.forense.set({ sel: selId }, { silencioso: true });
        desenhar(); desenharArvore(); desenharDetalhe();
        if (rolar && selId != null) { const c = $("fxGantt").querySelector(`circle[data-id="${selId}"]`); if (c) { const w = $("fxGanttWrap"); w.scrollLeft = Math.max(0, c.getAttribute("cx") - w.clientWidth / 2); } }
    }

    /* ---------------------------------------------------------------- eventos de UI */
    $("fxIncidente").innerHTML = Object.keys(D.logs).map(k => `<option value="${k}">${k} — ${esc(D.logs[k].titulo)}</option>`).join("");
    $("fxIncidente").value = incAtual();
    $("fxIncidente").addEventListener("change", e => { S.forense.set({ incidente: e.target.value, host: "todos", sel: null }); selId = null; zoom = 1; fechadas.clear(); sincronizarEditor(); render(true); });
    $("fxHost").addEventListener("change", e => { S.forense.set({ host: e.target.value }); render(false); });

    $("fxGantt").addEventListener("click", e => {
        const c = e.target.closest("circle[data-id]"); if (c) return selecionar(c.dataset.id);
        const g = e.target.closest("[data-tat]"); if (g) { const id = g.dataset.tat; fechadas.has(id) ? fechadas.delete(id) : fechadas.add(id); S.forense.set({ fechadas: [...fechadas] }, { silencioso: true }); desenhar(); }
    });
    $("fxGantt").addEventListener("keydown", e => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const c = e.target.closest("circle[data-id]"), g = e.target.closest("[data-tat]");
        if (c) { e.preventDefault(); selecionar(c.dataset.id); } else if (g) { e.preventDefault(); g.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
    });
    $("fxArvore").addEventListener("click", e => { const b = e.target.closest("button[data-id]"); if (b) selecionar(b.dataset.id, true); });
    $("fxDetalhe").addEventListener("click", e => { const b = e.target.closest("button[data-id]"); if (b && b.dataset.id !== "") selecionar(b.dataset.id, true); });
    document.addEventListener("keydown", e => {
        if (!$("view-timeline") || $("view-timeline").hidden || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) || document.activeElement.closest && document.activeElement.closest(".ed-host")) return;
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const vis = visiveis(); if (!vis.length) return;
        const i = vis.findIndex(x => x.id === selId), n = e.key === "ArrowRight" ? Math.min(vis.length - 1, i + 1) : Math.max(0, i < 0 ? 0 : i - 1);
        selecionar(vis[n].id, true);
    });

    const setZoom = z => { zoom = Math.min(8, Math.max(1, z)); render(false); };
    $("fxZoomMais").addEventListener("click", () => setZoom(zoom * 1.5));
    $("fxZoomMenos").addEventListener("click", () => setZoom(zoom / 1.5));
    $("fxZoomAjustar").addEventListener("click", () => { setZoom(1); $("fxGanttWrap").scrollLeft = 0; });
    $("fxGanttWrap").addEventListener("wheel", e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); setZoom(e.deltaY < 0 ? zoom * 1.25 : zoom / 1.25); }, { passive: false });
    $("fxTodasFechar").addEventListener("click", () => { const todas = agrupar(visiveis()).map(g => g.t.id); if (fechadas.size) fechadas.clear(); else todas.forEach(t => fechadas.add(t)); desenhar(); $("fxTodasFechar").textContent = fechadas.size ? "Expandir tudo" : "Recolher tudo"; });
    let rz; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => $("view-timeline") && !$("view-timeline").hidden && desenhar(), 150); });
    document.addEventListener("te:view", e => { if (e.detail === "timeline") { desenhar(); if (ed) ed.layout(); } });

    /* ---- painel de logs brutos (editor) ---- */
    async function abrirPainel() {
        painelAberto = !painelAberto;
        $("fxLogs").hidden = !painelAberto;
        $("fxBtnLogs").setAttribute("aria-expanded", String(painelAberto));
        $("fxBtnLogs").textContent = painelAberto ? "Ocultar logs" : "Editar logs";
        if (painelAberto && !ed) { ed = await TEEditor.create($("fxEd"), { value: textoAtual(), ariaLabel: "Logs brutos do incidente", language: "plaintext" }); ed.onChange(() => { $("fxStatusLogs").textContent = "Alterado — clique em Reconstruir."; }); }
        if (painelAberto && ed) { ed.layout(); }
    }
    function sincronizarEditor() { if (ed) { ed.setValue(textoAtual()); $("fxStatusLogs").textContent = ""; } }
    $("fxBtnLogs").addEventListener("click", abrirPainel);
    $("fxReconstruir").addEventListener("click", () => {
        if (!ed) return;
        S.forense.setTexto(incAtual(), ed.getValue());
        render(true);
        $("fxStatusLogs").textContent = `Reconstruído: ${eventos.length} eventos${ignoradas.length ? ", " + ignoradas.length + " linha(s) ignorada(s)" : ""}.`;
    });
    $("fxRestaurar").addEventListener("click", () => { S.forense.restaurar(incAtual()); sincronizarEditor(); render(true); aviso("Logs originais restaurados."); });
    $("fxAbrirLog").addEventListener("click", () => $("fxArquivo").click());
    $("fxArquivo").addEventListener("change", e => {
        const f = e.target.files[0]; e.target.value = ""; if (!f) return;
        if (f.size > 2 * 1024 * 1024) return aviso("Arquivo maior que 2 MB.");
        const fr = new FileReader();
        fr.onload = async () => { S.forense.setTexto(incAtual(), String(fr.result)); if (!painelAberto) await abrirPainel(); sincronizarEditor(); render(true); aviso(`${f.name} carregado.`); };
        fr.readAsText(f);
    });
    $("fxExportar").addEventListener("click", () => {
        const dados = { incidente: incAtual(), titulo: (D.logs[incAtual()] || {}).titulo, eventos: eventos.map(e => ({ horario: new Date(e.ts).toISOString(), host: e.host, fonte: e.src, evento: e.ev, tatica: T(e.tat).nome, tecnica: e.tec, titulo: e.titulo, campos: e.campos })) };
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" })); a.download = incAtual() + "-linha-do-tempo.json"; a.click(); URL.revokeObjectURL(a.href);
    });

    S.on(w => { if (w === "externo") { render(true); sincronizarEditor(); } });

    // estado persistido
    fechadas = new Set(fx().fechadas || []);
    selId = fx().sel == null ? null : fx().sel;
    render(true);
    window.__forense = { reconstruir, parseLinha, get eventos() { return eventos; }, selecionar };
})();
