document.addEventListener("DOMContentLoaded", () => {

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

            alert("Cadastro realizado com sucesso!");
            window.location.href = "login.html";
        });
    }


    // ==========================================
    // 2. LÓGICA DE LOGIN (login.html)
    // ==========================================
    const loginForm = document.getElementById("loginForm");

    if (loginForm) {
        const password = document.getElementById("password");
        const togglePassword = document.getElementById("togglePassword");
        const eyeIcon = document.getElementById("eyeIcon");
        const email = document.getElementById("email");

        const emailError = document.getElementById("emailError");
        const passwordError = document.getElementById("passwordError");

        if (togglePassword) {
            togglePassword.addEventListener("click", function() {
                if (password.type === "password") {
                    password.type = "text";
                    eyeIcon.classList.remove("fa-eye");
                    eyeIcon.classList.add("fa-eye-slash");
                } else {
                    password.type = "password";
                    eyeIcon.classList.remove("fa-eye-slash");
                    eyeIcon.classList.add("fa-eye");
                }
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
        toggleBtn.addEventListener("click", () => {
            const isMobile = window.innerWidth <= 768;

            if (isMobile) {
                sidebar.classList.toggle("open");
            } else {
                sidebar.classList.toggle("closed");
                mainContent.classList.toggle("expanded");
            }
        });
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

    const stats = [
        { t: "Investigações hoje", b: "+12%", c: "t-g", v: 24, s: "Total de artefatos checados" },
        { t: "IoCs analisados", b: "Ativos", c: "t-p", v: 137, s: "Indicadores catalogados" },
        { t: "Ameaças críticas", b: "Alta", c: "t-r", v: 8, s: "Requer mitigação imediata", red: true },
        { t: "Incidentes ativos", b: "Atenção", c: "t-y", v: 3, s: "Equipe SOC engajada" }
    ];
    const week = [
        { d: "S", n: "Segunda", v: 62 }, { d: "T", n: "Terça", v: 84 }, { d: "Q", n: "Quarta", v: 70 },
        { d: "Q", n: "Quinta", v: 108 }, { d: "S", n: "Sexta", v: 92 }, { d: "S", n: "Sábado", v: 142 }, { d: "D", n: "Domingo", v: 118 }
    ];
    const rows = [
        { a: "8f14e45f...c21e", t: "SHA-256", r: "Crítico", rc: "p-crit", d: "10:42", s: "Investigando", sc: "s-inv" },
        { a: "login-secure.update.net", t: "URL / Phishing", r: "Alto", rc: "p-alto", d: "19:07", s: "Concluído", sc: "s-ok" },
        { a: "cdn-telemetry.io", t: "Domínio", r: "Médio", rc: "p-med", d: "00:37", s: "Concluído", sc: "s-ok" },
        { a: "185.220.101.42", t: "IP (Tor Exit)", r: "Alto", rc: "p-alto", d: "Ontem", s: "Em Quarentena", sc: "s-q" }
    ];
    const $ = id => document.getElementById(id);

    statsEl.innerHTML = stats.map(s => `
        <article class="card stat">
            <div class="top"><span>${s.t}</span><span class="tag ${s.c}">${s.b}</span></div>
            <strong class="${s.red ? "red" : ""}" data-n="${s.v}">0</strong>
            <small>${s.s}</small>
        </article>`).join("");

    document.querySelectorAll("[data-n]").forEach(el => {
        const end = +el.dataset.n, t0 = performance.now();
        const tick = now => {
            const p = Math.min((now - t0) / 900, 1);
            el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
            if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });

    const max = Math.max(...week.map(w => w.v));
    const peak = week.reduce((a, b) => (b.v > a.v ? b : a));
    $("chart").innerHTML = week.map(w => `
        <div class="bar ${w === peak ? "peak" : ""}" data-h="${Math.round(w.v / max * 100)}">
            <em>${w.n}: ${w.v}</em><div class="fill"></div><span>${w.d}</span>
        </div>`).join("");
    setTimeout(() => document.querySelectorAll(".bar").forEach(b => b.querySelector(".fill").style.height = b.dataset.h + "%"), 60);
    $("peak").textContent = `Pico: ${peak.n} (${peak.v} eventos)`;

    $("tbody").innerHTML = rows.map(r => `
        <tr>
            <td class="mono">${r.a}</td><td>${r.t}</td>
            <td><span class="pill ${r.rc}">${r.r}</span></td>
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

    // Abas: cada card declara em quais abas aparece (data-tabs)
    const tabs = document.querySelectorAll(".tab");
    const showTab = name => {
        tabs.forEach(b => b.classList.toggle("active", b.dataset.tab === name));
        grid.querySelectorAll("[data-tabs]").forEach(c => c.hidden = !c.dataset.tabs.split(" ").includes(name));
        grid.querySelectorAll(".set-col").forEach(col => col.hidden = !col.querySelector("[data-tabs]:not([hidden])"));
        grid.classList.toggle("single", [...grid.children].some(c => c.hidden));
    };
    tabs.forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));
    showTab("geral");

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
        nome: sessao ? sessao.nome : "Analista ThreatEye",
        email: sessao ? sessao.email : "analista@threateye.sec",
        cargo: "SOC Lead Tier 3"
    };
    const renderPerfil = () => {
        $("pfNome").value = perfil.nome; $("pfEmail").value = perfil.email; $("pfCargo").value = perfil.cargo;
        $("pfTitle").textContent = perfil.nome; $("pfMail").textContent = perfil.email;
        $("pfRole").textContent = perfil.cargo + " • Squad Alpha";
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
        tabs.forEach(btn => btn.classList.toggle("active", btn.dataset.bibTab === categoria));
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
                    <td><span class="status ${item.statusClasse}">${item.statusTexto}</span></td>
                    <td>${item.analista}</td>
                    <td>${item.hora}</td>
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
                    status: cols[2]?.textContent.trim() || "",
                    analista: cols[3]?.textContent.trim() || "",
                    carimboUtc: cols[4]?.textContent.trim() || ""
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
    };

    viewButtons.forEach(btn => {
        btn.addEventListener("click", () => abrirView(btn.dataset.bibView));
    });

    // --- Filtros da Timeline ---
    const tlFilters = document.querySelectorAll("[data-tl-filter]");
    const tlFeed = document.getElementById("timelineFeed");
    tlFilters.forEach(btn => {
        btn.addEventListener("click", () => {
            tlFilters.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const tipo = btn.dataset.tlFilter;
            if (!tlFeed) return;
            tlFeed.querySelectorAll(".timeline-item").forEach(item => {
                item.hidden = tipo !== "todos" && item.dataset.tlType !== tipo;
            });
        });
    });

    const loadMoreTl = document.getElementById("loadMoreTimeline");
    if (loadMoreTl && tlFeed) {
        loadMoreTl.addEventListener("click", () => {
            if (loadMoreTl.dataset.loaded === "1") return notifyView("Todos os eventos recentes já foram carregados.");
            const extra = document.createElement("article");
            extra.className = "timeline-item";
            extra.dataset.tlType = "analise";
            extra.innerHTML = `
                <div class="tl-badge info"><i class="fa-solid fa-magnifying-glass-chart"></i></div>
                <div class="tl-body">
                    <div class="tl-meta"><span>07:12:44 · Ontem</span><span class="status approved">Concluído</span></div>
                    <h3>Varredura de Reputação de Domínios</h3>
                    <p>18 domínios recém-observados no proxy corporativo foram correlacionados sem indícios de C2.</p>
                    <div class="tl-tags"><span>ID: #74819</span><span>Por: Sistema ThreatEye</span></div>
                </div>`;
            tlFeed.appendChild(extra);
            loadMoreTl.dataset.loaded = "1";
            notifyView("Eventos anteriores carregados na timeline.");
        });
    }

    // --- Busca, Filtros e Copiar na Base de IoCs ---
    const iocSearch = document.getElementById("iocSearchInput");
    const iocType = document.getElementById("iocTypeFilter");
    const iocSev = document.getElementById("iocSeverityFilter");
    const iocOrigin = document.getElementById("iocOriginFilter");
    const iocsTbody = document.getElementById("iocsTbody");
    const iocPageInfo = document.getElementById("iocPageInfo");

    const filtrarIocs = () => {
        if (!iocsTbody) return;
        const termo = (iocSearch?.value || "").trim().toLowerCase();
        const tipo = iocType?.value || "todos";
        const sev = iocSev?.value || "todos";
        const orig = iocOrigin?.value || "todos";
        let visiveis = 0;

        iocsTbody.querySelectorAll("tr").forEach(tr => {
            const texto = tr.textContent.toLowerCase();
            const rowTipo = tr.dataset.iocType || "";
            const rowSev = tr.dataset.iocSev || "";
            const rowOrig = tr.dataset.iocOrigin || "";

            const match =
                (!termo || texto.includes(termo)) &&
                (tipo === "todos" || rowTipo === tipo) &&
                (sev === "todos" || rowSev === sev) &&
                (orig === "todos" || rowOrig === orig);

            tr.hidden = !match;
            if (match) visiveis++;
        });

        if (iocPageInfo) {
            iocPageInfo.textContent = `Exibindo ${visiveis} indicador(es) · Página 1 de 1`;
        }
    };

    [iocSearch, iocType, iocSev, iocOrigin].forEach(el => {
        if (el) {
            el.addEventListener("input", filtrarIocs);
            el.addEventListener("change", filtrarIocs);
        }
    });

    if (iocsTbody) {
        iocsTbody.addEventListener("click", event => {
            const btn = event.target.closest(".ioc-copy-btn");
            if (!btn) return;
            const val = btn.dataset.iocVal || "";
            if (navigator.clipboard && val) {
                navigator.clipboard.writeText(val).catch(() => {});
            }
            notifyView(`IoC copiado: ${val}`);
        });
    }

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

            const grid = document.getElementById("relatoriosGrid");
            if (grid) {
                const codigo = `REL-2026-0${Math.floor(91 + Math.random() * 8)}`;
                const card = document.createElement("article");
                card.className = "biblioteca-card";
                card.innerHTML = `
                    <div class="card-title"><i class="fa-regular fa-file-lines"></i><h2>${codigo} · ${titulo}</h2></div>
                    <p>${resumo}</p>
                    <div class="card-info"><span>SEVERIDADE: ${severidade.toUpperCase()}</span><span class="status approved">Publicado</span></div>
                    <div class="card-footer"><span>Autor: Analista SOC L3 · ${nrIocList?.children.length || 0} IoCs vinculados</span></div>`;
                grid.prepend(card);
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

