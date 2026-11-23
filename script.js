document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // 0. FEEDBACK DE FORMULÁRIO (aria-invalid, foco no 1º erro, limpar ao digitar)
    // ==========================================
    const sincronizarErros = form => {
        let primeiro = null;
        form.querySelectorAll(".input-group").forEach(g => {
            const erro = g.querySelector(".error-message"), campo = g.querySelector("input");
            if (!erro || !campo) return;
            const msg = erro.textContent.trim();
            if (msg) { campo.setAttribute("aria-invalid", "true"); if (!primeiro) primeiro = campo; }
            else campo.removeAttribute("aria-invalid");
        });
        if (primeiro) primeiro.focus();
    };
    ["cadastroForm", "loginForm"].forEach(id => {
        const form = document.getElementById(id);
        if (!form) return;
        form.addEventListener("submit", () => setTimeout(() => sincronizarErros(form), 0));   // depois da validação abaixo
        form.addEventListener("input", e => {
            const g = e.target.closest(".input-group"); if (!g) return;
            const erro = g.querySelector(".error-message"); if (erro) erro.textContent = "";
            e.target.removeAttribute("aria-invalid");
        });
    });
    const esqueci = document.getElementById("esqueciSenha"), info = document.getElementById("loginInfo");
    if (esqueci && info) esqueci.addEventListener("click", ev => {
        ev.preventDefault();
        info.textContent = "A recuperação de senha não está disponível nesta versão. Cadastre uma nova conta com outro e-mail.";
        info.hidden = false;
    });

    // ==========================================
    // 1. LÓGICA DE CADASTRO (cadastro.html)
    // ==========================================
    const cadastroForm = document.getElementById("cadastroForm");

    if (cadastroForm) {
        const nome = document.getElementById("nome");
        const email = document.getElementById("email");
        const password = document.getElementById("password");
        const confirmPassword = document.getElementById("confirmPassword");

        const nomeError = document.getElementById("nomeError");
        const emailError = document.getElementById("emailError");
        const passwordError = document.getElementById("passwordError");
        const confirmPasswordError = document.getElementById("confirmPasswordError");

        cadastroForm.addEventListener("submit", function(event) {
            event.preventDefault();

            nomeError.textContent = "";
            emailError.textContent = "";
            passwordError.textContent = "";
            confirmPasswordError.textContent = "";

            const nomeValue = nome.value.trim();
            const emailValue = email.value.trim().toLowerCase();
            const passwordValue = password.value;
            const confirmPasswordValue = confirmPassword.value;

            let isValid = true;

            if (nomeValue === "") {
                nomeError.textContent = "Informe seu nome.";
                isValid = false;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (emailValue === "") {
                emailError.textContent = "Informe seu e-mail.";
                isValid = false;
            } else if (!emailRegex.test(emailValue)) {
                emailError.textContent = "Digite um e-mail válido.";
                isValid = false;
            }

            if (passwordValue.length < 8) {
                passwordError.textContent = "A senha deve ter pelo menos 8 caracteres.";
                isValid = false;
            }

            if (confirmPasswordValue === "") {
                confirmPasswordError.textContent = "Confirme sua senha.";
                isValid = false;
            } else if (passwordValue !== confirmPasswordValue) {
                confirmPasswordError.textContent = "As senhas não são iguais.";
                isValid = false;
            }

            if (!isValid) {
                return;
            }

            const usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];

            const usuarioExiste = usuarios.some(function(usuario) {
                return usuario.email === emailValue;
            });

            if (usuarioExiste) {
                emailError.textContent = "Este e-mail já está cadastrado.";
                return;
            }

            const novoUsuario = {
                nome: nomeValue,
                email: emailValue,
                senha: passwordValue
            };

            usuarios.push(novoUsuario);
            localStorage.setItem("usuarios", JSON.stringify(usuarios));

            const ok = document.getElementById("cadastroOk");
            if (ok) ok.hidden = false;
            cadastroForm.querySelector(".btn-submit").disabled = true;
            setTimeout(() => { window.location.href = "login.html"; }, ok ? 1200 : 0);
        });
    }


    // ==========================================
    // 2. LÓGICA DE LOGIN (login.html)
    // ==========================================
    const loginForm = document.getElementById("loginForm");

    if (loginForm) {
        const password = document.getElementById("password");
        const togglePassword = document.getElementById("togglePassword");
        const email = document.getElementById("email");

        const emailError = document.getElementById("emailError");
        const passwordError = document.getElementById("passwordError");

        if (togglePassword) {
            togglePassword.addEventListener("click", function() {
                const mostrar = password.type === "password";
                togglePassword.setAttribute("aria-label", mostrar ? "Ocultar senha" : "Mostrar senha");
                togglePassword.setAttribute("aria-pressed", String(mostrar));
                password.type = mostrar ? "text" : "password";   // olho aberto = senha visível; fechado = escondida
            });
        }

        loginForm.addEventListener("submit", function(event) {
            event.preventDefault();

            emailError.textContent = "";
            passwordError.textContent = "";

            const emailValue = email.value.trim().toLowerCase();
            const passwordValue = password.value;

            let isValid = true;

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (emailValue === "") {
                emailError.textContent = "Informe seu e-mail.";
                isValid = false;
            } else if (!emailRegex.test(emailValue)) {
                emailError.textContent = "Digite um e-mail válido.";
                isValid = false;
            }

            if (passwordValue.trim() === "") {
                passwordError.textContent = "Informe sua senha.";
                isValid = false;
            }

            if (!isValid) {
                return;
            }

            const usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];

            const usuarioEncontrado = usuarios.find(function(usuario) {
                return usuario.email === emailValue &&
                       usuario.senha === passwordValue;
            });

            if (!usuarioEncontrado) {
                passwordError.textContent = "E-mail ou senha incorretos.";
                return;
            }

            const sessao = {
                nome: usuarioEncontrado.nome,
                email: usuarioEncontrado.email
            };

            sessionStorage.setItem("usuarioLogado", JSON.stringify(sessao));

            window.location.href = "index.html";
        });
    }


    // ==========================================
    // 3. LÓGICA DO DASHBOARD (index.html)
    // ==========================================
    const toggleBtn = document.getElementById("toggleSidebar");
    const sidebar = document.getElementById("sidebar");
    const mainContent = document.querySelector(".main-content");
    const navItems = document.querySelectorAll(".sidebar__item");
    const uploadBox = document.getElementById("area_upload");
    const fileInput = document.getElementById("fileInput");

    if (toggleBtn && sidebar && mainContent) {
        // fundo escuro atrás do menu no celular: clique fora fecha
        const scrim = document.createElement("div");
        scrim.className = "nav-scrim"; scrim.hidden = true;
        document.body.appendChild(scrim);
        const mobile = () => window.innerWidth <= 768;
        const sync = () => {
            const aberto = mobile() ? sidebar.classList.contains("open") : !sidebar.classList.contains("closed");
            toggleBtn.setAttribute("aria-expanded", String(aberto));
            scrim.hidden = !(mobile() && sidebar.classList.contains("open"));
        };
        const fechaMobile = (devolveFoco) => {
            if (!sidebar.classList.contains("open")) return;
            sidebar.classList.remove("open"); sync();
            if (devolveFoco) toggleBtn.focus();
        };
        toggleBtn.addEventListener("click", () => {
            if (mobile()) {
                sidebar.classList.toggle("open");
                if (sidebar.classList.contains("open")) { const p = sidebar.querySelector(".sidebar__item"); if (p) p.focus({ preventScroll: true }); }
            } else {
                sidebar.classList.toggle("closed");
                mainContent.classList.toggle("expanded");
            }
            sync();
        });
        scrim.addEventListener("click", () => fechaMobile(true));
        document.addEventListener("keydown", e => { if (e.key === "Escape") fechaMobile(true); });
        window.addEventListener("resize", () => { if (!mobile()) sidebar.classList.remove("open"); sync(); });
        sync();
    }

    if (navItems.length > 0 && sidebar) {
        navItems.forEach(item => {
            item.addEventListener("click", function () {
                navItems.forEach(nav => nav.classList.remove("active"));
                this.classList.add("active");

                if (window.innerWidth <= 768) {
                    sidebar.classList.remove("open");
                }
            });
        });
    }

    if (uploadBox && fileInput) {
        uploadBox.addEventListener("click", () => fileInput.click());
    }
});

// ==========================================
// 4. LÓGICA DO DASHBOARD DE MÉTRICAS (dashboard.html)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const statsEl = document.getElementById("stats");
    if (!statsEl) return;

    // Usuário logado (se houver sessão)
    const sessao = JSON.parse(sessionStorage.getItem("usuarioLogado") || "null");
    if (sessao) {
        const first = sessao.nome.split(" ")[0];
        document.getElementById("userName").textContent = first;
        const info = document.querySelectorAll(".user-info strong, .user-info span");
        if (info.length === 2) { info[0].textContent = sessao.nome; info[1].textContent = sessao.email; }
    }

    const ST = window.TEStore ? TEStore.stats() : null;
    const stats = [
        { v: 24 + (ST ? ST.analises : 0), s: "artefatos checados hoje" },
        { v: ST ? ST.iocs : 137, s: "IoCs catalogados" },
        { v: ST ? ST.criticos : 8, s: "indicadores de risco crítico", red: true },
        { v: window.TEDados ? Object.keys(TEDados.logs).length : 3, s: "incidentes na linha do tempo forense" }
    ];
    const week = [
        { d: "Seg", n: "Segunda", v: 62 }, { d: "Ter", n: "Terça", v: 84 }, { d: "Qua", n: "Quarta", v: 70 },
        { d: "Qui", n: "Quinta", v: 108 }, { d: "Sex", n: "Sexta", v: 92 }, { d: "Sáb", n: "Sábado", v: 142 }, { d: "Dom", n: "Domingo", v: 118 }
    ];
    const nivelSev = { "Crítica": ["Crítico", "crit"], "Alta": ["Alto", "alto"], "Média": ["Médio", "med"], "Baixa": ["Baixo", "ok"] };
    const salvos = window.TEStore ? TEStore.reports.all().filter(r => r.origem === "sandbox").slice(0, 4).map(r => {
        const n = nivelSev[r.severidade] || ["Médio", "med"];
        return { a: r.titulo.length > 28 ? r.titulo.slice(0, 27) + "…" : r.titulo, t: "Sandbox · " + r.id, r: n[0], rc: n[1], d: TEStore.fmtData(r.ts), s: "Salvo", sc: "s-inv" };
    }) : [];
    const rows = salvos.concat([
        { a: "8f14e45f...c21e", t: "SHA-256", r: "Crítico", rc: "crit", d: "10:42", s: "Investigando", sc: "s-inv" },
        { a: "login-secure.update.net", t: "URL / Phishing", r: "Alto", rc: "alto", d: "19:07", s: "Concluído", sc: "s-ok" },
        { a: "cdn-telemetry.io", t: "Domínio", r: "Médio", rc: "med", d: "00:37", s: "Concluído", sc: "s-ok" },
        { a: "185.220.101.42", t: "IP (Tor Exit)", r: "Alto", rc: "alto", d: "Ontem", s: "Em Quarentena", sc: "s-q" }
    ]).slice(0, 6);
    const $ = id => document.getElementById(id);

    statsEl.innerHTML = stats.map(s => `
        <article class="card stat">
            <strong class="${s.red ? "red" : ""}" data-n="${s.v}">0</strong>
            <small>${s.s}</small>
        </article>`).join("");

    const semMovimento = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelectorAll("[data-n]").forEach(el => {
        const end = +el.dataset.n, t0 = performance.now();
        if (semMovimento) { el.textContent = end; return; }
        const tick = now => {
            const p = Math.min((now - t0) / 500, 1);
            el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
            if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });

    const max = Math.max(...week.map(w => w.v));
    const peak = week.reduce((a, b) => (b.v > a.v ? b : a));
    const nf = n => n.toLocaleString("pt-BR");
    const totalSemana = week.reduce((t, w) => t + w.v, 0);
    $("chart").setAttribute("role", "group");
    $("chart").setAttribute("aria-label", `Detecções por dia nos últimos 7 dias. Pico: ${peak.n}, ${nf(peak.v)}. Total da semana: ${nf(totalSemana)}.`);
    $("chart").innerHTML = week.map(w => `
        <div class="bar ${w === peak ? "peak" : ""}" data-h="${Math.round(w.v / max * 100)}" tabindex="0" role="img" aria-label="${w.n}: ${nf(w.v)} detecções">
            <em>${w.n}: ${nf(w.v)} detecções</em><b class="bv">${nf(w.v)}</b><div class="fill"></div><span>${w.d}</span>
        </div>`).join("");
    document.querySelectorAll(".bar").forEach(b => b.querySelector(".fill").style.height = b.dataset.h + "%");
    requestAnimationFrame(() => requestAnimationFrame(() => document.querySelectorAll(".bar").forEach(b => b.classList.add("on"))));

    $("tbody").innerHTML = rows.map(r => `
        <tr>
            <td class="mono">${r.a}</td><td>${r.t}</td>
            <td><span class="sev ${r.rc}">${r.r}</span></td>
            <td>${r.d}</td><td class="r ${r.sc}">${r.s}</td>
        </tr>`).join("");

    const toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
    let timer;
    const notify = msg => {
        toast.textContent = msg;
        toast.classList.add("show");
        clearTimeout(timer);
        timer = setTimeout(() => toast.classList.remove("show"), 2200);
    };

    $("csv").addEventListener("click", e => {
        e.preventDefault();
        const csv = ["Artefato,Tipo,Risco,Data,Status", ...rows.map(r => [r.a, r.t, r.r, r.d, r.s].join(","))].join("\n");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        a.download = "investigacoes.csv";
        a.click();
        notify("CSV exportado");
    });
    $("recoBtn").addEventListener("click", () => notify("Sona: priorize o artefato 8f14e45f...c21e"));
});


// ==========================================
// 5. LÓGICA DE CONFIGURAÇÕES (configuracoes.html)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const grid = document.getElementById("setGrid");
    if (!grid) return;
    const $ = id => document.getElementById(id);
    const get = (k, d) => TE.get(k, d);
    const set = (k, v) => TE.set(k, v);

    const toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
    let timer;
    const notify = msg => {
        toast.textContent = msg;
        toast.classList.add("show");
        clearTimeout(timer);
        timer = setTimeout(() => toast.classList.remove("show"), 2200);
    };


    // Tema claro / escuro / sistema
    const themeBtns = document.querySelectorAll("[data-theme-opt]");
    const markTheme = () => themeBtns.forEach(b => b.classList.toggle("sel", b.dataset.themeOpt === get("te-theme", "dark")));
    themeBtns.forEach(b => b.addEventListener("click", () => { set("te-theme", b.dataset.themeOpt); markTheme(); }));
    markTheme();

    // Cor de destaque
    const dots = document.querySelectorAll(".cdot");
    const picker = $("accentPicker");
    const markAccent = () => {
        const cur = get("te-accent", "#7e22ce").toLowerCase();
        dots.forEach(d => d.classList.toggle("sel", d.dataset.c === cur));
        picker.value = cur;
    };
    dots.forEach(d => d.addEventListener("click", () => { set("te-accent", d.dataset.c); markAccent(); }));
    picker.addEventListener("input", () => { set("te-accent", picker.value); markAccent(); });
    markAccent();

    // Interruptores (data-pref), selects (data-sel) e densidade
    document.querySelectorAll("[data-pref]").forEach(i => {
        i.checked = get("te-" + i.dataset.pref, i.checked ? "1" : "0") === "1";
        i.addEventListener("change", () => set("te-" + i.dataset.pref, i.checked ? "1" : "0"));
    });
    document.querySelectorAll("[data-sel]").forEach(s => {
        s.value = get("te-" + s.dataset.sel, s.value);
        s.addEventListener("change", () => set("te-" + s.dataset.sel, s.value));
    });
    const dens = document.querySelectorAll("#density button");
    const markDens = () => dens.forEach(b => b.classList.toggle("on", b.dataset.d === get("te-density", "confortavel")));
    dens.forEach(b => b.addEventListener("click", () => { set("te-density", b.dataset.d); markDens(); }));
    markDens();

    // Perfil
    const sessao = JSON.parse(sessionStorage.getItem("usuarioLogado") || "null");
    const perfil = JSON.parse(get("te-profile", "null")) || {
        nome: (sessao && sessao.nome) || "Analista ThreatEye",
        email: (sessao && sessao.email) || "analista@threateye.sec",
        cargo: "SOC Lead Tier 3"
    };
    const renderPerfil = () => {
        $("pfNome").value = perfil.nome; $("pfEmail").value = perfil.email; $("pfCargo").value = perfil.cargo;
        $("pfTitle").textContent = perfil.nome;
        $("pfAv").textContent = perfil.nome.split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase();
    };
    renderPerfil();
    $("saveProfile").addEventListener("click", () => {
        const nome = $("pfNome").value.trim(), email = $("pfEmail").value.trim().toLowerCase(), cargo = $("pfCargo").value.trim();
        if (!nome || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return notify("Informe um nome e um e-mail válido.");
        Object.assign(perfil, { nome, email, cargo: cargo || perfil.cargo });
        set("te-profile", JSON.stringify(perfil));
        if (sessao) sessionStorage.setItem("usuarioLogado", JSON.stringify({ nome, email }));
        renderPerfil();
        notify("Alterações salvas");
    });

    // Chaves de API
    document.querySelectorAll("[data-key]").forEach(i => i.value = get("te-key-" + i.dataset.key, ""));
    $("saveKeys").addEventListener("click", () => {
        document.querySelectorAll("[data-key]").forEach(i => set("te-key-" + i.dataset.key, i.value.trim()));
        notify("Chaves salvas neste navegador");
    });

    // Exportar auditoria e encerrar sessões
    $("exportBtn").addEventListener("click", () => {
        const prefs = {};
        ["theme", "accent", "soft", "density", "sound", "sync", "retencao", "sev"].forEach(k => prefs[k] = get("te-" + k, null));
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([JSON.stringify({ exportadoEm: new Date().toISOString(), perfil, preferencias: prefs }, null, 2)], { type: "application/json" }));
        a.download = "auditoria-threateye.json";
        a.click();
        notify("Dados de auditoria exportados");
    });
    $("logoutAll").addEventListener("click", () => {
        sessionStorage.clear();
        window.location.href = "login.html";
    });
});

// ==========================================
// 6. LÓGICA DA BIBLIOTECA (biblioteca.html)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const bibSection = document.querySelector(".atividades-container");
    const tbody = document.getElementById("bibliotecaTbody");
    if (!bibSection || !tbody) return;

    const sessao = JSON.parse(sessionStorage.getItem("usuarioLogado") || "null");
    if (sessao) {
        const info = document.querySelectorAll(".user-info strong, .user-info span");
        if (info.length === 2) {
            info[0].textContent = sessao.nome;
            info[1].textContent = sessao.email;
        }
    }

    const toast = document.querySelector(".toast") || (() => {
        const el = document.createElement("div");
        el.className = "toast";
        document.body.appendChild(el);
        return el;
    })();

    let toastTimer;
    const notifyBib = msg => {
        toast.textContent = msg;
        toast.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
    };

    const registrosExtras = [
        {
            categoria: "timeline",
            modulo: "Timeline",
            artefato: "INC-2026-104: Movimento lateral SMB detetado",
            statusClasse: "critical",
            statusTexto: "Em análise",
            analista: "R. Lima (L3)",
            hora: "08:51:40",
            acao: "Ver Linha"
        },
        {
            categoria: "iocs",
            modulo: "Base IoC",
            artefato: "9b74c9a1...e04d [SHA-256 Loader]",
            statusClasse: "approved",
            statusTexto: "Catalogado",
            analista: "A. Souza (L2)",
            hora: "07:29:11",
            acao: "Investigar"
        }
    ];

    const tabs = bibSection.querySelectorAll(".atividades-tabs .tab[data-bib-tab]");
    const contador = document.getElementById("bibliotecaContador");

    const atualizarContador = () => {
        if (!contador) return;
        const todas = [...tbody.querySelectorAll("tr")];
        const visiveis = todas.filter(tr => !tr.hidden).length;
        contador.textContent = `Exibindo ${visiveis} de ${todas.length} registros carregados (base: 1.482 catalogados)`;
    };

    const aplicarFiltro = categoria => {
        tabs.forEach(btn => { const on = btn.dataset.bibTab === categoria; btn.classList.toggle("active", on); btn.setAttribute("aria-selected", String(on)); });
        tbody.querySelectorAll("tr").forEach(tr => {
            const cat = tr.dataset.categoria || "";
            tr.hidden = categoria !== "todos" && cat !== categoria;
        });
        atualizarContador();
    };

    tabs.forEach(btn => {
        btn.addEventListener("click", () => aplicarFiltro(btn.dataset.bibTab));
    });

    document.querySelectorAll("[data-filtro-rapido]").forEach(link => {
        link.addEventListener("click", () => {
            const alvo = link.dataset.filtroRapido.toLowerCase();
            if (alvo.includes("ioc")) aplicarFiltro("iocs");
            else if (alvo.includes("relat")) aplicarFiltro("relatorios");
            else if (alvo.includes("time")) aplicarFiltro("timeline");
            else aplicarFiltro("todos");
        });
    });

    const loadMoreBtn = document.getElementById("loadMoreBib");
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener("click", () => {
            if (loadMoreBtn.dataset.loaded === "1") {
                notifyBib("Histórico adicional já carregado.");
                return;
            }

            registrosExtras.forEach(item => {
                const tr = document.createElement("tr");
                tr.dataset.categoria = item.categoria;
                tr.innerHTML = `
                    <td>${item.modulo}</td>
                    <td>${item.artefato}</td>
                    <td><button type="button" class="btn-table">${item.acao}</button></td>
                `;
                tbody.appendChild(tr);
            });

            loadMoreBtn.dataset.loaded = "1";
            loadMoreBtn.textContent = "Histórico Carregado";
            const abaAtiva = bibSection.querySelector(".atividades-tabs .tab.active")?.dataset.bibTab || "todos";
            aplicarFiltro(abaAtiva);
            notifyBib("Novos registros adicionados à visualização.");
        });
    }

    const exportJsonBtn = document.getElementById("exportJsonBib");
    if (exportJsonBtn) {
        exportJsonBtn.addEventListener("click", () => {
            const linhasVisiveis = [...tbody.querySelectorAll("tr")].filter(tr => !tr.hidden);
            const payload = linhasVisiveis.map(tr => {
                const cols = tr.querySelectorAll("td");
                return {
                    modulo: cols[0]?.textContent.trim() || "",
                    artefato: cols[1]?.textContent.trim() || "",
                    acao: cols[2]?.textContent.trim() || ""
                };
            });

            const blob = new Blob([JSON.stringify({ exportadoEm: new Date().toISOString(), registros: payload }, null, 2)], {
                type: "application/json"
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "trilha-biblioteca-threateye.json";
            a.click();
            URL.revokeObjectURL(url);
            notifyBib("Trilha exportada em JSON.");
        });
    }

    tbody.addEventListener("click", event => {
        const btn = event.target.closest(".btn-table");
        if (!btn) return;
        const linha = btn.closest("tr");
        const artefato = linha?.children[1]?.textContent.trim() || "registro";
        notifyBib(`${btn.textContent.trim()}: ${artefato}`);
    });

    const filtrosBtn = document.getElementById("btnFiltrosBib");
    if (filtrosBtn) {
        filtrosBtn.addEventListener("click", () => {
            bibSection.scrollIntoView({ behavior: "smooth", block: "start" });
            notifyBib("Use as abas para filtrar por IoCs, Relatórios ou Timeline.");
        });
    }

    atualizarContador();
});

// ==========================================
// 7. NAVEGAÇÃO INTERNA E SUBTELAS DA BIBLIOTECA
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const app = document.getElementById("bibliotecaApp");
    if (!app) return;

    const views = app.querySelectorAll(".bib-view");
    const viewButtons = document.querySelectorAll("[data-bib-view]");

    const toast = document.querySelector(".toast") || (() => {
        const el = document.createElement("div");
        el.className = "toast";
        document.body.appendChild(el);
        return el;
    })();

    let toastTimer;
    const notifyView = msg => {
        toast.textContent = msg;
        toast.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
    };

    const abrirView = viewName => {
        const alvo = document.getElementById(`view-${viewName}`);
        if (!alvo) return;

        views.forEach(v => { v.hidden = v !== alvo; });

        viewButtons.forEach(btn => {
            if (btn.classList.contains("sidebar__subitem") || btn.closest(".sidebar__group")) {
                btn.classList.toggle("active", btn.dataset.bibView === viewName);
            }
        });

        window.scrollTo({ top: 0, behavior: "smooth" });
        document.dispatchEvent(new CustomEvent("te:view", { detail: viewName }));
    };
    window.TEBib = { abrirView, notify: notifyView };

    viewButtons.forEach(btn => {
        btn.addEventListener("click", () => abrirView(btn.dataset.bibView));
    });
    window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (h) abrirView(h); });
    setTimeout(() => { const h = location.hash.slice(1); if (h && document.getElementById("view-" + h)) abrirView(h); }, 0);

    // --- Novo Relatório ---
    const nrForm = document.getElementById("novoRelatorioForm");
    const nrIocList = document.getElementById("nrIocList");
    const nrAddIocBtn = document.getElementById("nrAddIocBtn");

    if (nrAddIocBtn && nrIocList) {
        nrAddIocBtn.addEventListener("click", () => {
            const tipo = document.getElementById("nrIocTipo").value;
            const valor = document.getElementById("nrIocValor").value.trim();
            if (!valor) return notifyView("Informe o valor do IoC antes de adicionar.");

            const li = document.createElement("li");
            li.innerHTML = `<span><strong>[${tipo}]</strong> <code>${valor}</code></span><button type="button" class="btn-table">Remover</button>`;
            li.querySelector("button").addEventListener("click", () => li.remove());
            nrIocList.appendChild(li);
            document.getElementById("nrIocValor").value = "";
        });
    }

    const nrAnexoInput = document.getElementById("nrAnexoInput");
    const nrAnexoLabel = document.getElementById("nrAnexoLabel");
    if (nrAnexoInput && nrAnexoLabel) {
        nrAnexoInput.addEventListener("change", () => {
            const file = nrAnexoInput.files?.[0];
            nrAnexoLabel.textContent = file
                ? `Arquivo selecionado: ${file.name}`
                : "Arraste evidências (.pcap, .json, .pdf, .log) ou clique para selecionar";
        });
    }

    const salvarRascunhoBtn = document.getElementById("nrSalvarRascunho");
    if (salvarRascunhoBtn) {
        salvarRascunhoBtn.addEventListener("click", () => {
            const statusEl = document.getElementById("nrStatusLabel");
            if (statusEl) statusEl.textContent = "Rascunho Salvo";
            notifyView("Rascunho salvo localmente.");
        });
    }

    if (nrForm) {
        nrForm.addEventListener("submit", e => {
            e.preventDefault();
            const titulo = document.getElementById("nrTitulo").value.trim();
            const severidade = document.getElementById("nrSeveridade").value;
            const resumo = document.getElementById("nrResumo").value.trim();
            if (!titulo || !resumo) return notifyView("Preencha o título e o resumo executivo.");

            if (window.TEStore) {
                const tlp = { "Crítica": "TLP:RED", "Alta": "TLP:AMBER", "Média": "TLP:GREEN", "Baixa": "TLP:CLEAR" }[severidade] || "TLP:AMBER";
                const iocs = [...(nrIocList ? nrIocList.children : [])].map(li => {
                    const m = li.textContent.match(/^\[(.+?)\]\s*(.+?)\s*Remover$/);
                    return m ? { tipo: m[1], valor: m[2] } : null;
                }).filter(Boolean);
                TEStore.reports.add({
                    titulo, resumo, severidade, tlp, confianca: "Moderada", mitre: (document.getElementById("nrTags")?.value || "").split(",")[0].trim() || "—",
                    autor: "Analista SOC L3", nIocs: iocs.length, iocs, origem: "manual",
                    tags: (document.getElementById("nrTags")?.value || "").split(",").map(t => t.trim()).filter(Boolean),
                    detalhes: document.getElementById("nrDetalhes")?.value.trim() || ""
                });
            }

            nrForm.reset();
            if (nrIocList) nrIocList.innerHTML = "";
            if (nrAnexoLabel) {
                nrAnexoLabel.textContent = "Arraste evidências (.pcap, .json, .pdf, .log) ou clique para selecionar";
            }
            notifyView("Relatório publicado na Biblioteca!");
            abrirView("relatorios");
        });
    }
});

// ==========================================
// 8. ASSISTENTE SONA
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const sonaApp = document.getElementById("sonaApp");
    if (!sonaApp) return;

    const form = document.getElementById("sonaForm");
    const input = document.getElementById("sonaInput");
    const hero = document.getElementById("sonaHero");
    const messages = document.getElementById("sonaMessages");
    const composer = document.getElementById("sonaComposer");
    const errorBanner = document.getElementById("sonaErrorBanner");
    const errorText = document.getElementById("sonaErrorText");
    const editLinkBtn = document.getElementById("sonaEditLinkBtn");
    const undoBtn = document.getElementById("sonaUndoBtn");
    const closeErrorBtn = document.getElementById("sonaCloseErrorBtn");
    const resetBtn = document.getElementById("sonaResetBtn");
    const fileInput = document.getElementById("sonaFileInput");
    const fileTag = document.getElementById("sonaAttachedName");
    const urlModeBtn = document.getElementById("sonaUrlModeBtn");

    let ultimoEnvio = "";

    const parecerUrlValida = valor => {
        const texto = valor.trim();
        if (!texto) return true;
        const pareceLink =
            texto.startsWith("http://") ||
            texto.startsWith("https://") ||
            texto.startsWith("www.") ||
            texto.includes("://") ||
            (/\.[a-z]{2,}(\/|$|\s)/i.test(texto) && !texto.includes(" "));

        if (!pareceLink) return true;

        try {
            const urlObj = new URL(texto);
            return (urlObj.protocol === "http:" || urlObj.protocol === "https:") && urlObj.hostname.includes(".");
        } catch {
            return false;
        }
    };

    const limparErro = () => {
        if (errorBanner) errorBanner.hidden = true;
        if (composer) composer.classList.remove("has-error");
    };

    const mostrarErroUrl = valor => {
        if (errorText) {
            errorText.innerHTML = `Não foi possível iniciar a análise para <code>${valor}</code>. Certifique-se de incluir o protocolo completo (ex.: <code>https://exemplo.com</code>).`;
        }
        if (errorBanner) errorBanner.hidden = false;
        if (composer) composer.classList.add("has-error");
    };

    const adicionarMensagem = (texto, autor = "bot") => {
        if (!messages) return;
        if (hero) hero.hidden = true;
        const bolha = document.createElement("div");
        bolha.className = `sona-msg ${autor}`;
        bolha.innerHTML = texto;
        messages.appendChild(bolha);
        bolha.scrollIntoView({ behavior: "smooth", block: "end" });
    };

    document.querySelectorAll("[data-sona-prompt]").forEach(card => {
        card.addEventListener("click", () => {
            if (!input) return;
            input.value = card.dataset.sonaPrompt || "";
            input.focus();
            limparErro();
        });
    });

    if (fileInput && fileTag) {
        fileInput.addEventListener("change", () => {
            const file = fileInput.files?.[0];
            if (file) {
                fileTag.textContent = file.name;
                fileTag.hidden = false;
            } else {
                fileTag.textContent = "";
                fileTag.hidden = true;
            }
        });
    }

    if (urlModeBtn && input) {
        urlModeBtn.addEventListener("click", () => {
            if (!input.value.trim()) {
                input.value = "https://";
                input.focus();
                return;
            }
            if (!parecerUrlValida(input.value)) {
                mostrarErroUrl(input.value.trim());
            } else {
                limparErro();
            }
        });
    }

    if (editLinkBtn && input) {
        editLinkBtn.addEventListener("click", () => {
            limparErro();
            input.focus();
        });
    }

    if (undoBtn && input) {
        undoBtn.addEventListener("click", () => {
            input.value = ultimoEnvio;
            limparErro();
            input.focus();
        });
    }

    if (closeErrorBtn) {
        closeErrorBtn.addEventListener("click", limparErro);
    }

    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            limparErro();
            if (messages) messages.innerHTML = "";
            if (hero) hero.hidden = false;
            if (input) input.value = "";
            if (fileInput) fileInput.value = "";
            if (fileTag) {
                fileTag.textContent = "";
                fileTag.hidden = true;
            }
        });
    }

    if (form && input) {
        form.addEventListener("submit", e => {
            e.preventDefault();
            const valor = input.value.trim();
            const anexo = fileInput?.files?.[0]?.name || "";

            if (!valor && !anexo) return;

            ultimoEnvio = valor;

            if (valor && !parecerUrlValida(valor)) {
                mostrarErroUrl(valor);
                return;
            }

            limparErro();

            const resumoUsuario = [
                valor ? `<span>${valor}</span>` : "",
                anexo ? `<div><code>Anexo: ${anexo}</code></div>` : ""
            ].filter(Boolean).join("");

            adicionarMensagem(resumoUsuario, "user");

            const alvo = valor || anexo;
            adicionarMensagem(
                `Análise iniciada para <code>${alvo}</code>. Verificando cabeçalhos HTTP, exposição de rotas, indicadores suspeitos e pontos de falha para consolidar o diagnóstico.`,
                "bot"
            );

            input.value = "";
            if (fileInput) fileInput.value = "";
            if (fileTag) {
                fileTag.textContent = "";
                fileTag.hidden = true;
            }
        });
    }
});
