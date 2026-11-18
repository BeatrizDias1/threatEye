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
