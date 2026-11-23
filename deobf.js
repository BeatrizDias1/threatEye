/* ThreatEye – motor de desobfuscação de JavaScript (100% no navegador)
 *
 * Princípios:
 *  - O código analisado NUNCA é executado. Tudo é feito lendo a árvore sintática (acorn)
 *    e avaliando só expressões "puras" (strings, números, atob, fromCharCode, unescape...).
 *  - Cada transformação fica registrada em "camadas", para o analista ver o caminho feito.
 */
(function (root) {
    "use strict";

    const acorn = root.acorn || (typeof require !== "undefined" ? require("acorn") : null);
    const UNKNOWN = Symbol("desconhecido");
    const MAX_LAYERS = 12;
    const MAX_STR = 4e6;
    const RESERVED = new Set("break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield let static await".split(" "));
    const GLOBAL_OBJ = new Set(["window", "self", "globalThis", "top", "parent"]);
    const PURE_GLOBALS = new Set(["atob", "btoa", "unescape", "escape", "decodeURIComponent", "decodeURI", "encodeURIComponent", "encodeURI", "parseInt", "parseFloat", "String", "Number"]);
    const STR_METHODS = new Set(["split", "slice", "substring", "substr", "charAt", "charCodeAt", "concat", "replace", "replaceAll", "toLowerCase", "toUpperCase", "trim", "indexOf", "repeat", "at", "reverse", "join"]);

    /* ---------- utilidades ---------- */
    const parseCode = (code, extra) => acorn.parse(code, Object.assign({ ecmaVersion: "latest", allowReturnOutsideFunction: true, allowHashBang: true, allowAwaitOutsideFunction: true }, extra || {}));
    const quote = s => JSON.stringify(s).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    const cut = (s, n = 90) => { s = String(s).replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
    const isIdent = s => /^[A-Za-z_$][\w$]*$/.test(s) && !RESERVED.has(s);

    function b64decode(input) {
        const s = String(input).replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
        if (!/^[A-Za-z0-9+/]*$/.test(s) || s.length % 4 === 1) throw new Error("base64 inválido");
        const T = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let out = "", buf = 0, bits = 0;
        for (const ch of s) {
            buf = (buf << 6) | T.indexOf(ch); bits += 6;
            if (bits >= 8) { bits -= 8; out += String.fromCharCode((buf >> bits) & 255); }
        }
        return out;
    }
    function utf8IfPossible(bin) {
        if (!/[\x80-\xff]/.test(bin)) return bin;
        try { return decodeURIComponent(bin.split("").map(c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join("")); } catch (e) { return bin; }
    }
    function btoaPure(s) {
        const T = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let out = "";
        for (let i = 0; i < s.length; i += 3) {
            const a = s.charCodeAt(i), b = s.charCodeAt(i + 1), c = s.charCodeAt(i + 2);
            if (a > 255 || b > 255 || c > 255) throw new Error("btoa");
            out += T[a >> 2] + T[((a & 3) << 4) | ((b || 0) >> 4)] + (i + 1 < s.length ? T[((b & 15) << 2) | ((c || 0) >> 6)] : "=") + (i + 2 < s.length ? T[c & 63] : "=");
        }
        return out;
    }
    function unescapePure(s) {
        return s.replace(/%u([0-9a-f]{4})|%([0-9a-f]{2})/gi, (m, u, h) => String.fromCharCode(parseInt(u || h, 16)));
    }

    /* ---------- percorrer a árvore ---------- */
    function walk(node, fn, parent, key) {
        if (!node || typeof node.type !== "string") return;
        if (fn(node, parent, key) === false) return;
        for (const k of Object.keys(node)) {
            if (k === "type" || k === "start" || k === "end" || k === "loc") continue;
            const v = node[k];
            if (Array.isArray(v)) v.forEach(c => c && typeof c.type === "string" && walk(c, fn, node, k));
            else if (v && typeof v.type === "string") walk(v, fn, node, k);
        }
    }
    const isPropKey = (parent, key) =>
        parent && ((parent.type === "MemberExpression" && key === "property" && !parent.computed) ||
            ((parent.type === "Property" || parent.type === "MethodDefinition" || parent.type === "PropertyDefinition") && key === "key" && !parent.computed));

    /* ---------- constantes de escopo simples (var x = "literal", declarada 1x e nunca reatribuída) ---------- */
    function collectConsts(ast) {
        const decl = new Map(), bad = new Set(), inits = new Map();
        const bump = n => decl.set(n, (decl.get(n) || 0) + 1);
        const patNames = (p, out) => {
            if (!p) return out;
            if (p.type === "Identifier") out.push(p.name);
            else if (p.type === "ObjectPattern") p.properties.forEach(q => patNames(q.value || q.argument, out));
            else if (p.type === "ArrayPattern") p.elements.forEach(q => patNames(q, out));
            else if (p.type === "AssignmentPattern") patNames(p.left, out);
            else if (p.type === "RestElement") patNames(p.argument, out);
            return out;
        };
        walk(ast, n => {
            if (n.type === "VariableDeclarator") {
                if (n.id.type === "Identifier") { bump(n.id.name); if (n.init) inits.set(n.id.name, n.init); }
                else patNames(n.id, []).forEach(x => { bump(x); bad.add(x); });
            } else if (/^Function/.test(n.type) || n.type === "ArrowFunctionExpression") {
                if (n.id && n.id.name) { bump(n.id.name); bad.add(n.id.name); }
                n.params.forEach(p => patNames(p, []).forEach(x => { bump(x); bad.add(x); }));
            } else if (n.type === "CatchClause" && n.param) patNames(n.param, []).forEach(x => { bump(x); bad.add(x); });
            else if (n.type === "ClassDeclaration" && n.id) { bump(n.id.name); bad.add(n.id.name); }
            else if (n.type === "AssignmentExpression" && n.left.type === "Identifier") bad.add(n.left.name);
            else if (n.type === "UpdateExpression" && n.argument.type === "Identifier") bad.add(n.argument.name);
            else if ((n.type === "ForInStatement" || n.type === "ForOfStatement") && n.left.type === "Identifier") bad.add(n.left.name);
        });
        const out = new Map();
        inits.forEach((init, name) => { if (decl.get(name) === 1 && !bad.has(name)) out.set(name, init); });
        return out;
    }

    /* ---------- avaliador estático seguro ---------- */
    function makeEvaluator(consts) {
        const memo = new Map(), busy = new Set();
        let steps = 0;
        const lim = () => { if (++steps > 300000) throw new Error("limite de avaliação"); };
        const ok = v => v !== UNKNOWN;
        const capStr = v => (typeof v === "string" && v.length > MAX_STR) ? UNKNOWN : v;

        function ev(n) {
            if (!n) return UNKNOWN;
            if (memo.has(n)) return memo.get(n);
            lim();
            let r;
            try { r = capStr(evRaw(n)); } catch (e) { r = UNKNOWN; }
            memo.set(n, r);
            return r;
        }
        function evRaw(n) {
            switch (n.type) {
                case "Literal":
                    if (n.regex || typeof n.value === "bigint") return UNKNOWN;
                    return n.value;
                case "TemplateLiteral": {
                    let s = "";
                    for (let i = 0; i < n.quasis.length; i++) {
                        s += n.quasis[i].value.cooked;
                        if (i < n.expressions.length) { const v = ev(n.expressions[i]); if (!ok(v) || typeof v === "object") return UNKNOWN; s += String(v); }
                    }
                    return s;
                }
                case "Identifier": {
                    if (n.name === "undefined") return undefined;
                    if (!consts.has(n.name) || busy.has(n.name)) return UNKNOWN;
                    busy.add(n.name);
                    try { return ev(consts.get(n.name)); } finally { busy.delete(n.name); }
                }
                case "ArrayExpression": {
                    const out = [];
                    for (const e of n.elements) { if (!e || e.type === "SpreadElement") return UNKNOWN; const v = ev(e); if (!ok(v)) return UNKNOWN; out.push(v); }
                    return out;
                }
                case "UnaryExpression": {
                    const v = ev(n.argument); if (!ok(v)) return UNKNOWN;
                    switch (n.operator) { case "!": return !v; case "-": return -v; case "+": return +v; case "~": return ~v; case "void": return undefined; default: return UNKNOWN; }
                }
                case "BinaryExpression": {
                    const a = ev(n.left), b = ev(n.right); if (!ok(a) || !ok(b)) return UNKNOWN;
                    if (typeof a === "object" || typeof b === "object") { if (n.operator === "+" && (Array.isArray(a) || Array.isArray(b))) return String(a) + String(b); return UNKNOWN; }
                    switch (n.operator) {
                        case "+": return a + b; case "-": return a - b; case "*": return a * b; case "/": return a / b; case "%": return a % b;
                        case "**": return a ** b; case "<<": return a << b; case ">>": return a >> b; case ">>>": return a >>> b;
                        case "&": return a & b; case "|": return a | b; case "^": return a ^ b;
                        case "==": return a == b; case "===": return a === b; case "!=": return a != b; case "!==": return a !== b;
                        case "<": return a < b; case ">": return a > b; case "<=": return a <= b; case ">=": return a >= b;
                        default: return UNKNOWN;
                    }
                }
                case "LogicalExpression": {
                    const a = ev(n.left); if (!ok(a)) return UNKNOWN;
                    if (n.operator === "&&") return a ? ev(n.right) : a;
                    if (n.operator === "||") return a ? a : ev(n.right);
                    return (a === null || a === undefined) ? ev(n.right) : a;
                }
                case "ConditionalExpression": { const t = ev(n.test); if (!ok(t)) return UNKNOWN; return ev(t ? n.consequent : n.alternate); }
                case "SequenceExpression": return UNKNOWN;
                case "MemberExpression": {
                    const o = ev(n.object); if (!ok(o) || n.optional) return UNKNOWN;
                    const p = n.computed ? ev(n.property) : n.property.name; if (!ok(p)) return UNKNOWN;
                    if (typeof o === "string" || Array.isArray(o)) {
                        if (p === "length") return o.length;
                        if (typeof p === "number" || /^\d+$/.test(String(p))) return o[Number(p)];
                    }
                    return UNKNOWN;
                }
                case "CallExpression": return evCall(n);
                default: return UNKNOWN;
            }
        }
        function evArgs(n) {
            const out = [];
            for (const a of n.arguments) { if (a.type === "SpreadElement") return null; const v = ev(a); if (!ok(v)) return null; out.push(v); }
            return out;
        }
        function evCall(n) {
            const c = n.callee;
            if (n.optional) return UNKNOWN;
            if (c.type === "Identifier" && PURE_GLOBALS.has(c.name)) return pureGlobal(c.name, evArgs(n));
            if (c.type === "MemberExpression" && !c.computed) {
                const m = c.property.name;
                if (c.object.type === "Identifier" && c.object.name === "String" && (m === "fromCharCode" || m === "fromCodePoint")) {
                    const a = evArgs(n); if (!a || a.some(x => typeof x !== "number")) return UNKNOWN;
                    return m === "fromCharCode" ? String.fromCharCode(...a) : String.fromCodePoint(...a);
                }
                if (c.object.type === "Identifier" && GLOBAL_OBJ.has(c.object.name) && PURE_GLOBALS.has(m)) return pureGlobal(m, evArgs(n));
                if (STR_METHODS.has(m)) {
                    const o = ev(c.object); if (!ok(o)) return UNKNOWN;
                    const a = evArgs(n); if (!a) return UNKNOWN;
                    return method(o, m, a);
                }
            }
            return UNKNOWN;
        }
        function pureGlobal(name, a) {
            if (!a) return UNKNOWN;
            const s = a[0];
            switch (name) {
                case "atob": return typeof s === "string" ? utf8IfPossible(b64decode(s)) : UNKNOWN;
                case "btoa": return typeof s === "string" ? btoaPure(s) : UNKNOWN;
                case "unescape": return typeof s === "string" ? unescapePure(s) : UNKNOWN;
                case "escape": return UNKNOWN;
                case "decodeURIComponent": return typeof s === "string" ? decodeURIComponent(s) : UNKNOWN;
                case "decodeURI": return typeof s === "string" ? decodeURI(s) : UNKNOWN;
                case "encodeURIComponent": return typeof s === "string" ? encodeURIComponent(s) : UNKNOWN;
                case "encodeURI": return typeof s === "string" ? encodeURI(s) : UNKNOWN;
                case "parseInt": return a.length <= 2 && (typeof s === "string" || typeof s === "number") ? parseInt(s, a[1]) : UNKNOWN;
                case "parseFloat": return typeof s === "string" ? parseFloat(s) : UNKNOWN;
                case "String": return (typeof s === "string" || typeof s === "number" || typeof s === "boolean") ? String(s) : UNKNOWN;
                case "Number": return (typeof s === "string" || typeof s === "number") ? Number(s) : UNKNOWN;
                default: return UNKNOWN;
            }
        }
        function method(o, m, a) {
            const isS = typeof o === "string", isA = Array.isArray(o);
            if (!isS && !isA) return UNKNOWN;
            const plain = a.every(x => typeof x === "string" || typeof x === "number" || typeof x === "undefined");
            switch (m) {
                case "split": return isS && plain && typeof a[0] === "string" ? o.split(a[0], a[1]) : UNKNOWN;
                case "join": return isA && o.every(x => typeof x !== "object") ? o.join(a.length ? String(a[0]) : ",") : UNKNOWN;
                case "reverse": return isA ? o.slice().reverse() : UNKNOWN;
                case "slice": return plain ? o.slice(a[0], a[1]) : UNKNOWN;
                case "concat": return isS && plain ? o.concat(...a) : (isA ? o.concat(...a) : UNKNOWN);
                case "indexOf": return plain ? o.indexOf(a[0], a[1]) : UNKNOWN;
                case "at": return plain ? o.at(a[0]) : UNKNOWN;
            }
            if (!isS || !plain) return UNKNOWN;
            switch (m) {
                case "substring": return o.substring(a[0], a[1]);
                case "substr": return o.substr(a[0], a[1]);
                case "charAt": return o.charAt(a[0]);
                case "charCodeAt": return o.charCodeAt(a[0]);
                case "replace": return typeof a[0] === "string" && typeof a[1] === "string" ? o.replace(a[0], () => a[1]) : UNKNOWN;
                case "replaceAll": return typeof a[0] === "string" && typeof a[1] === "string" ? o.split(a[0]).join(a[1]) : UNKNOWN;
                case "toLowerCase": return o.toLowerCase();
                case "toUpperCase": return o.toUpperCase();
                case "trim": return o.trim();
                case "repeat": return typeof a[0] === "number" && a[0] >= 0 && o.length * a[0] < MAX_STR ? o.repeat(a[0]) : UNKNOWN;
            }
            return UNKNOWN;
        }
        return { ev, ok };
    }

    /* ---------- edição por intervalos ---------- */
    function applyEdits(code, edits) {
        edits.sort((a, b) => b.start - a.start);
        let out = code, last = Infinity;
        for (const e of edits) {
            if (e.end > last) continue; // sobreposição: ignora a interna
            out = out.slice(0, e.start) + e.text + out.slice(e.end);
            last = e.start;
        }
        return out;
    }

    /* ---------- registro de passos de uma camada ---------- */
    function stepLog(layer) {
        const map = new Map();
        return {
            add(tipo, titulo, antes, depois) {
                let s = map.get(tipo);
                if (!s) { s = { tipo, titulo, total: 0, exemplos: [] }; map.set(tipo, s); layer.passos.push(s); }
                s.total++;
                if (s.exemplos.length < 4 && antes !== undefined) s.exemplos.push({ antes: cut(antes, 70), depois: cut(depois, 70) });
            }
        };
    }

    function techniqueOf(node) {
        let t = null;
        walk(node, n => {
            if (n.type === "CallExpression") {
                const c = n.callee, name = c.type === "Identifier" ? c.name : (c.type === "MemberExpression" && !c.computed ? c.property.name : "");
                if (name === "atob" && !t) t = ["base64", "Base64 (atob)"];
                else if ((name === "fromCharCode" || name === "fromCodePoint") && !t) t = ["charcode", "String.fromCharCode"];
                else if ((name === "unescape" || name === "decodeURIComponent") && !t) t = ["unescape", "unescape / decodeURIComponent"];
                else if ((name === "reverse" || name === "split") && !t) t = ["reordenar", "Reordenação de texto (split / reverse / join)"];
            }
        });
        return t || ["concat", "Concatenação de strings"];
    }

    /* ---------- fase A: simplificação estática ---------- */
    function simplify(code, layer, ctx) {
        let ast;
        try { ast = parseCode(code); } catch (e) { return { changed: false, code, parseError: e }; }
        const consts = collectConsts(ast);
        const { ev, ok } = makeEvaluator(consts);
        const log = stepLog(layer);
        const edits = [];

        walk(ast, (n, parent, key) => {
            if (isPropKey(parent, key)) return false;
            // valores string/booleanos dobráveis
            if (n.type === "Literal") {
                if (typeof n.value === "string" && /\\(x|u|[0-7])/.test(n.raw)) {
                    const t = quote(n.value);
                    if (t !== n.raw) { edits.push({ start: n.start, end: n.end, text: t }); log.add("escape", "Sequências de escape decodificadas (\\xNN, \\uNNNN)", n.raw, t); if (n.value.length > 3) ctx.strings.push(n.value); }
                } else if (typeof n.value === "number" && /^0[xXbBoO]|^\d+[eE]|^0\d/.test(n.raw) && Number.isFinite(n.value)) {
                    const t = String(n.value);
                    if (t !== n.raw) { edits.push({ start: n.start, end: n.end, text: t }); log.add("hex", "Números hexadecimais convertidos", n.raw, t); }
                }
                return false;
            }
            if (/^(BinaryExpression|CallExpression|TemplateLiteral|ConditionalExpression|LogicalExpression|MemberExpression)$/.test(n.type)) {
                if (n.type === "CallExpression" && isEvalLike(n)) { /* tratado na fase B */ }
                else {
                    const v = ev(n);
                    if (ok(v) && typeof v === "string") {
                        const [tipo, titulo] = techniqueOf(n);
                        const t = quote(v);
                        edits.push({ start: n.start, end: n.end, text: t });
                        log.add(tipo, titulo, code.slice(n.start, n.end), t);
                        if (v.length > 3) ctx.strings.push(v);
                        return false;
                    }
                }
            }
            if (n.type === "UnaryExpression" && n.operator === "!" && /^(ArrayExpression|Literal|UnaryExpression)$/.test(n.argument.type)) {
                const v = ev(n);
                if (ok(v) && typeof v === "boolean") { edits.push({ start: n.start, end: n.end, text: String(v) }); log.add("bool", "Booleanos ofuscados (!![] , !0)", code.slice(n.start, n.end), String(v)); return false; }
            }
            if (n.type === "MemberExpression" && n.computed && !n.optional && n.property.type === "Literal" && typeof n.property.value === "string" && isIdent(n.property.value)) {
                edits.push({ start: n.object.end, end: n.end, text: "." + n.property.value });
                log.add("dot", "Notação a['b'] convertida em a.b", code.slice(n.object.end, n.end), "." + n.property.value);
            }
            return true;
        });

        if (!edits.length) return { changed: false, code };
        const out = applyEdits(code, edits);
        return { changed: out !== code, code: out };
    }

    /* ---------- string array no estilo obfuscator.io ---------- */
    function resolveStringArrays(code, layer, ctx) {
        let ast;
        try { ast = parseCode(code); } catch (e) { return { changed: false, code }; }
        const log = stepLog(layer);
        const src = n => code.slice(n.start, n.end);
        const arrays = new Map(); // nome -> {decl, values, rotStmt}
        ast.body.forEach(st => {
            if (st.type !== "VariableDeclaration") return;
            st.declarations.forEach(d => {
                if (d.id.type === "Identifier" && d.init && d.init.type === "ArrayExpression" && d.init.elements.length >= 4 &&
                    d.init.elements.every(e => e && e.type === "Literal" && typeof e.value === "string"))
                    arrays.set(d.id.name, { stmt: st, single: st.declarations.length === 1, values: d.init.elements.map(e => e.value) });
            });
        });
        if (!arrays.size) return { changed: false, code };

        const edits = [], removable = [];
        arrays.forEach((info, aname) => {
            // rotação
            let unsupported = null;
            ast.body.forEach(st => {
                if (st.type !== "ExpressionStatement") return;
                const call = st.expression.type === "UnaryExpression" ? st.expression.argument : st.expression;
                if (!call || call.type !== "CallExpression" || call.callee.type !== "FunctionExpression") return;
                const a = call.arguments;
                if (a.length < 2 || a[0].type !== "Identifier" || a[0].name !== aname || a[1].type !== "Literal" || typeof a[1].value !== "number") return;
                const body = src(call.callee);
                if (!/push/.test(body) || !/shift/.test(body)) return;
                if (/parseInt/.test(body)) { unsupported = "rotação por checksum (obfuscator.io recente)"; return; }
                const n = a[1].value, len = info.values.length;
                const k = ((n % len) + len) % len;
                info.values = info.values.slice(k).concat(info.values.slice(0, k));
                info.rot = st;
                log.add("rot", "Rotação do array de strings aplicada", "while(--n) arr.push(arr.shift())", `${n} rotações`);
            });
            if (unsupported) { ctx.avisos.push("Array de strings encontrado com " + unsupported + ": não resolvido."); return; }

            // decodificador
            let decName = null, offset = 0, decNode = null;
            const cands = [];
            ast.body.forEach(st => {
                if (st.type === "FunctionDeclaration") cands.push([st.id.name, st, st]);
                if (st.type === "VariableDeclaration") st.declarations.forEach(d => {
                    if (d.id.type === "Identifier" && d.init && /^FunctionExpression$/.test(d.init.type)) cands.push([d.id.name, d.init, st]);
                });
            });
            for (const [nm, fn, st] of cands) {
                const body = src(fn);
                if (!new RegExp("\\b" + aname + "\\b").test(body)) continue;
                if (/atob|fromCharCode|charAt|charCodeAt|\bRC4\b|decodeURIComponent/.test(body)) { ctx.avisos.push(`Decodificador "${nm}" usa codificação extra (base64/RC4): não resolvido.`); continue; }
                const m = body.match(/(\w+)\s*=\s*\1\s*-\s*(0x[0-9a-f]+|\d+)/i) || body.match(new RegExp(aname + "\\s*\\[\\s*\\w+\\s*-\\s*(0x[0-9a-f]+|\\d+)\\s*\\]", "i"));
                offset = m ? Number(m[m.length - 1]) : 0;
                decName = nm; decNode = st; break;
            }
            if (!decName) return;

            let replaced = 0;
            walk(ast, (n, parent, key) => {
                if (n.type === "CallExpression" && n.callee.type === "Identifier" && n.callee.name === decName && n.arguments.length >= 1) {
                    const a0 = n.arguments[0];
                    if (a0.type === "Literal" && (typeof a0.value === "number" || (typeof a0.value === "string" && /^(0x[0-9a-f]+|\d+)$/i.test(a0.value)))) {
                        const idx = Number(a0.value) - offset;
                        if (idx >= 0 && idx < info.values.length) {
                            const v = info.values[idx], t = quote(v);
                            edits.push({ start: n.start, end: n.end, text: t });
                            replaced++;
                            log.add("sarray", "Chamadas ao array de strings resolvidas", code.slice(n.start, n.end), t);
                            if (v.length > 3) ctx.strings.push(v);
                            n._res = true;
                            return false;
                        }
                    }
                }
                return true;
            });
            if (!replaced) return;

            // remove declarações se não sobraram referências
            let refs = 0;
            const skip = new Set([decNode, info.stmt, info.rot].filter(Boolean));
            ast.body.forEach(st => { if (skip.has(st)) return; walk(st, (n, p, k) => {
                if (n._res) return false;
                if (n.type === "Identifier" && (n.name === decName || n.name === aname) && !isPropKey(p, k)) refs++;
            }); });
            if (!refs) {
                [decNode, info.rot, info.single ? info.stmt : null].filter(Boolean).forEach(st => removable.push(st));
                log.add("limpeza", "Declarações auxiliares removidas (array + decodificador)", aname + " / " + decName, "—");
            }
        });
        removable.forEach(st => edits.push({ start: st.start, end: st.end, text: "" }));
        if (!edits.length) return { changed: false, code };
        const out = applyEdits(code, edits);
        return { changed: out !== code, code: out };
    }

    /* ---------- fase B: camadas eval / Function / packer ---------- */
    function isEvalLike(n) {
        const c = n.callee;
        return (c.type === "Identifier" && c.name === "eval") ||
            (c.type === "MemberExpression" && !c.computed && c.property.name === "eval" && c.object.type === "Identifier" && GLOBAL_OBJ.has(c.object.name));
    }
    const isFunctionCtor = n => (n.type === "NewExpression" || n.type === "CallExpression") && n.callee.type === "Identifier" && n.callee.name === "Function";

    function unpackDeanEdwards(p, a, c, k) {
        const e = x => (x < a ? "" : e(Math.floor(x / a))) + ((x = x % a) > 35 ? String.fromCharCode(x + 29) : x.toString(36));
        while (c--) if (k[c]) p = p.replace(new RegExp("\\b" + e(c) + "\\b", "g"), () => k[c]);
        return p;
    }

    function unwrap(code, ctx) {
        let ast;
        try { ast = parseCode(code); } catch (e) { return { changed: false, code }; }
        const consts = collectConsts(ast);
        const { ev, ok } = makeEvaluator(consts);
        const edits = [], tecnicas = new Set();

        const asPayload = (text, stmtLevel) => {
            let t = String(text).trim();
            try { const p = parseCode(t); if (!stmtLevel) { if (p.body.length === 1 && p.body[0].type === "ExpressionStatement") return "(" + t.replace(/;\s*$/, "") + ")"; return null; } return t; } catch (e) { return null; }
        };

        walk(ast, (n, parent, key) => {
            // eval(...)
            if (n.type === "CallExpression" && isEvalLike(n) && n.arguments.length === 1) {
                const arg = n.arguments[0];
                let v = UNKNOWN, tec = "Carga decodificada e executada por eval()";
                const pk = arg.type === "CallExpression" && arg.callee.type === "FunctionExpression" && arg.callee.params.length === 6 && arg.arguments.length >= 4 && /replace/.test(code.slice(arg.callee.start, arg.callee.end));
                if (pk) {
                    const a = arg.arguments.map(x => ev(x));
                    if (typeof a[0] === "string" && typeof a[1] === "number" && typeof a[2] === "number" && Array.isArray(a[3])) { v = unpackDeanEdwards(a[0], a[1], a[2], a[3]); tec = "Packer (Dean Edwards)"; }
                } else v = ev(arg);
                if (ok(v) && typeof v === "string") {
                    const stmtLevel = parent && parent.type === "ExpressionStatement";
                    const rep = asPayload(v, stmtLevel);
                    if (rep !== null) {
                        const target = stmtLevel ? parent : n;
                        edits.push({ start: target.start, end: target.end, text: rep });
                        tecnicas.add(pk ? "Packer (Dean Edwards)" : tec); if (!pk && /atob\(/.test(code.slice(arg.start, arg.end))) tecnicas.add("eval(atob(...))");
                        ctx.strings.push(v);
                        return false;
                    }
                }
            }
            // new Function("...")()  /  Function("...")()
            if (n.type === "CallExpression" && isFunctionCtor(n.callee) && n.callee.arguments.length >= 1 && n.arguments.length === 0) {
                const args = n.callee.arguments, v = ev(args[args.length - 1]);
                if (ok(v) && typeof v === "string") {
                    const stmtLevel = parent && parent.type === "ExpressionStatement";
                    const rep = asPayload(v, true);
                    if (rep !== null) {
                        const target = stmtLevel ? parent : n;
                        edits.push({ start: target.start, end: target.end, text: stmtLevel ? rep : "(function(){\n" + rep + "\n})()" });
                        tecnicas.add("new Function(...)()"); ctx.strings.push(v); return false;
                    }
                }
            }
            // setTimeout("código", n)
            if (n.type === "CallExpression" && n.callee.type === "Identifier" && /^(setTimeout|setInterval)$/.test(n.callee.name) && n.arguments.length >= 1) {
                const v = ev(n.arguments[0]);
                if (ok(v) && typeof v === "string") {
                    const rep = asPayload(v, true);
                    if (rep !== null) { edits.push({ start: n.arguments[0].start, end: n.arguments[0].end, text: "function () {\n" + rep + "\n}" }); tecnicas.add(n.callee.name + "(string)"); ctx.strings.push(v); }
                }
            }
            // document.write("<html...>")  -> apenas registra o HTML
            if (n.type === "CallExpression" && n.callee.type === "MemberExpression" && !n.callee.computed && /^(write|writeln)$/.test(n.callee.property.name) &&
                n.callee.object.type === "Identifier" && n.callee.object.name === "document" && n.arguments.length >= 1) {
                const v = ev(n.arguments[0]);
                if (ok(v) && typeof v === "string") ctx.html.push(v);
            }
            return true;
        });

        if (!edits.length) return { changed: false, code };
        const out = applyEdits(code, edits);
        return { changed: out !== code, code: out, tecnica: [...tecnicas].join(" + ") };
    }

    /* ---------- fase final: renomear _0x… ---------- */
    function renameObfuscated(code, layer) {
        let ast;
        try { ast = parseCode(code); } catch (e) { return code; }
        const existing = new Set(), found = [];
        walk(ast, (n, p, k) => {
            if (n.type !== "Identifier") return;
            existing.add(n.name);
            if (/^_0x[0-9a-f]{3,}$/i.test(n.name) && !isPropKey(p, k)) found.push(n);
        });
        if (!found.length) return code;
        const map = new Map(); let i = 0;
        found.sort((a, b) => a.start - b.start).forEach(n => {
            if (!map.has(n.name)) { let nm; do { nm = "v" + (++i); } while (existing.has(nm)); map.set(n.name, nm); }
        });
        const log = stepLog(layer);
        map.forEach((nv, old) => log.add("rename", "Identificadores _0x… renomeados", old, nv));
        layer.passos.find(p => p.tipo === "rename").total = map.size;
        return applyEdits(code, found.map(n => ({ start: n.start, end: n.end, text: map.get(n.name) })));
    }

    /* ---------- formatação ---------- */
    async function formatCode(code) {
        const P = root.prettier || (typeof require !== "undefined" && root.__prettier);
        const plugins = root.prettierPlugins;
        if (P && plugins && plugins.babel && plugins.estree) {
            try { return await P.format(code, { parser: "babel", plugins: [plugins.babel, plugins.estree], printWidth: 92, tabWidth: 2, singleQuote: false }); } catch (e) { /* cai no formatador simples */ }
        }
        return simpleBeautify(code);
    }

    function simpleBeautify(code) {
        let toks;
        try { toks = [...acorn.tokenizer(code, { ecmaVersion: "latest", allowHashBang: true, allowReturnOutsideFunction: true })]; } catch (e) { return code; }
        const kw = new Set(["if", "for", "while", "switch", "catch", "with", "return", "typeof", "in", "of", "new", "delete", "void", "throw", "else", "do", "case", "var", "let", "const", "function", "instanceof", "yield", "await"]);
        let out = "", ind = 0, paren = 0, prev = null, stack = [];
        const nl = () => { out = out.replace(/[ \t]+$/, "") + "\n" + "  ".repeat(Math.max(ind, 0)); };
        for (let i = 0; i < toks.length; i++) {
            const t = toks[i], s = code.slice(t.start, t.end), nx = toks[i + 1], ns = nx ? code.slice(nx.start, nx.end) : "";
            const lbl = t.type.label;
            if (s === "{") {
                const pv = prev ? code.slice(prev.start, prev.end) : "";
                const block = !prev || /^(\)|=>|else|do|try|finally|;|\{|\})$/.test(pv) || (prev && prev.type.label === "name" && toks[i - 2] && /^(function|class)$/.test(code.slice(toks[i - 2].start, toks[i - 2].end)));
                stack.push(block);
                if (block) { out += (/\s$/.test(out) || !out ? "" : " ") + "{"; ind++; if (ns === "}") { out += "}"; i++; stack.pop(); ind--; prev = toks[i]; continue; } nl(); }
                else { out += (/\s$/.test(out) || /[(\[]$/.test(out) ? "" : " ") + "{ "; }
                prev = t; continue;
            }
            if (s === "}") {
                const block = stack.pop();
                if (block) { ind--; nl(); out += "}"; if (!/^(else|catch|finally|\)|,|;|\.|\))$/.test(ns) && !(ns === "while")) nl(); else out += (/^(else|catch|finally|while)$/.test(ns) ? " " : ""); }
                else out += " }";
                prev = t; continue;
            }
            if (s === "(") paren++;
            if (s === ")") paren--;
            if (s === ";") { out += ";"; if (paren <= 0) { if (ns !== "}") nl(); } else out += " "; prev = t; continue; }
            if (s === ",") { out += ", "; prev = t; continue; }
            if (s === ":" ) { out += ": "; prev = t; continue; }
            if (t.type.binop != null || t.type.isAssign || s === "=>" || s === "?" || t.type.label === "=" ) {
                const unary = (s === "-" || s === "+") && (!prev || /^(\(|,|=|return|\[|:|\?)$/.test(code.slice(prev.start, prev.end)));
                out += unary ? s : " " + s + " "; prev = t; continue;
            }
            if (s === "." || s === "?.") { out = out.replace(/\s+$/, "") + s; prev = t; continue; }
            if (s === "!" || s === "~" || s === "++" || s === "--") { out += s; prev = t; continue; }
            const needSpace = prev && !/[(\[.!~]$/.test(out) && !/\s$/.test(out) && !(s === "(" || s === ")" || s === "[" || s === "]" || s === ".") &&
                !/^(\(|\[)$/.test(code.slice(prev.start, prev.end));
            if (s === "(" && prev && kw.has(code.slice(prev.start, prev.end)) && !/\s$/.test(out)) out += " ";
            else if (needSpace) out += " ";
            out += s;
            prev = t;
        }
        return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
    }

    /* ---------- extração de IoCs e comportamentos ---------- */
    const TLDS = "com|net|org|io|info|biz|xyz|top|ru|cn|tk|cc|ws|link|online|site|club|shop|live|app|dev|co|br|de|uk|us|su|pw|me|ly|to|in|vip|work|click|icu|cyou|test";
    const RE = {
        url: /\b(?:https?|ftp|hxxps?):\/\/[^\s'"`<>()\\\]\[{}|^]+/gi,
        ip: /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?![\d.]*\d)/g,
        dom: new RegExp("(?<![\\w@.-])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+(?:" + TLDS + ")(?![\\w-])", "gi"),
        mail: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g,
        hash: /(?<![a-f0-9])(?:[a-f0-9]{64}|[a-f0-9]{40}|[a-f0-9]{32})(?![a-f0-9])/gi
    };
    function classify(v) {
        v = String(v).trim();
        if (/^[a-f0-9]{32}$/i.test(v)) return { tipo: "Hash", sub: "MD5", valor: v.toLowerCase() };
        if (/^[a-f0-9]{40}$/i.test(v)) return { tipo: "Hash", sub: "SHA-1", valor: v.toLowerCase() };
        if (/^[a-f0-9]{64}$/i.test(v)) return { tipo: "Hash", sub: "SHA-256", valor: v.toLowerCase() };
        if (/^(?:https?|hxxps?|ftp):\/\//i.test(v)) return { tipo: "URL", valor: v.replace(/^hxxp/i, "http") };
        if (new RegExp("^" + RE.ip.source + "$").test(v)) return { tipo: "IP", valor: v };
        if (/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(v)) return { tipo: "E-mail", valor: v.toLowerCase() };
        if (new RegExp("^(?:[a-z0-9-]+\\.)+(?:" + TLDS + ")$", "i").test(v)) return { tipo: "Domínio", valor: v.toLowerCase() };
        return null;
    }
    const NOT_DOMAIN = /^(?:window|document|navigator|location|self|parent|console|this|math|json|object|string|array|top)\./i;
    function extractIocs(texts) {
        const seen = new Map();
        const add = (valor, tipo, sub, camada, ctx) => {
            const k = tipo + "|" + valor.toLowerCase();
            if (!seen.has(k)) seen.set(k, { valor, tipo, sub: sub || null, camada, contexto: cut(ctx, 90) });
        };
        texts.forEach(({ text, camada }) => {
            let m;
            RE.url.lastIndex = 0;
            while ((m = RE.url.exec(text))) {
                let u = m[0].replace(/[.,;:!?'"]+$/, "").replace(/^hxxp/i, "http");
                add(u, "URL", null, camada, text);
                const h = u.replace(/^[a-z]+:\/\//i, "").split(/[/:?#]/)[0];
                if (new RegExp("^" + RE.ip.source + "$").test(h)) add(h, "IP", null, camada, u);
                else if (h.includes(".")) add(h.toLowerCase(), "Domínio", null, camada, u);
            }
            RE.ip.lastIndex = 0;
            while ((m = RE.ip.exec(text))) { if (m[0] !== "0.0.0.0") add(m[0], "IP", null, camada, text); }
            RE.dom.lastIndex = 0;
            while ((m = RE.dom.exec(text))) { if (!NOT_DOMAIN.test(m[0])) add(m[0].toLowerCase(), "Domínio", null, camada, text); }
            RE.mail.lastIndex = 0;
            while ((m = RE.mail.exec(text))) add(m[0].toLowerCase(), "E-mail", null, camada, text);
            RE.hash.lastIndex = 0;
            while ((m = RE.hash.exec(text))) add(m[0].toLowerCase(), "Hash", m[0].length === 64 ? "SHA-256" : m[0].length === 40 ? "SHA-1" : "MD5", camada, text);
        });
        // domínios/IPs que só existem dentro de uma URL já estão cobertos; remove "domínios" que são parte de e-mail
        const mails = [...seen.values()].filter(x => x.tipo === "E-mail").map(x => x.valor.split("@")[1]);
        mails.forEach(d => { const k = "Domínio|" + d; if (seen.has(k) && !texts.some(t => t.text.toLowerCase().replace(/[\w.+-]+@/g, "").includes(d))) seen.delete(k); });
        return [...seen.values()];
    }

    const BEHAVIORS = [
        { id: "iframe", re: /<iframe[^>]*(display\s*:\s*none|width\s*=\s*["']?0|height\s*=\s*["']?0|visibility\s*:\s*hidden)/i, titulo: "iframe oculto", desc: "Carrega conteúdo externo sem o usuário ver (técnica comum de redirecionamento e drive-by).", sev: "crit", peso: 30 },
        { id: "cookie", re: /document\s*\.\s*cookie/, titulo: "Acesso a cookies", desc: "Lê cookies da página: possível roubo de sessão.", sev: "crit", peso: 25 },
        { id: "keylog", re: /addEventListener\s*\(\s*["']key(down|up|press)["']/, titulo: "Captura de teclado", desc: "Registra teclas digitadas: possível keylogger em formulário de login.", sev: "crit", peso: 30 },
        { id: "exfil", re: /(XMLHttpRequest|fetch\s*\(|sendBeacon|new\s+Image\s*\(\s*\)\s*\.src)/, titulo: "Comunicação de rede", desc: "Envia ou busca dados em servidores externos.", sev: "alto", peso: 15 },
        { id: "activex", re: /(ActiveXObject|WScript\.Shell|Scripting\.FileSystemObject|ADODB\.Stream)/, titulo: "Execução local (Windows Script Host)", desc: "Usa objetos do Windows para executar comandos ou gravar arquivos.", sev: "crit", peso: 35 },
        { id: "shell", re: /(powershell|cmd\.exe|mshta|wscript|cscript|rundll32|certutil)/i, titulo: "Comando de sistema", desc: "Menciona interpretadores ou binários usados para executar cargas maliciosas.", sev: "crit", peso: 30 },
        { id: "redir", re: /(window\s*\.\s*)?location\s*(\.\s*(href|replace|assign)\s*(=|\())/, titulo: "Redirecionamento automático", desc: "Leva o visitante a outra página sem ação dele (phishing e malvertising).", sev: "alto", peso: 15 },
        { id: "write", re: /document\s*\.\s*write(ln)?\s*\(/, titulo: "Injeção de HTML (document.write)", desc: "Escreve HTML dinamicamente na página.", sev: "med", peso: 8 },
        { id: "form", re: /<(form|input)[^>]*(password|type\s*=\s*["']?password)/i, titulo: "Formulário de senha injetado", desc: "Cria campo de senha: típico de página de phishing.", sev: "crit", peso: 30 },
        { id: "fp", re: /navigator\s*\.\s*(userAgent|platform|plugins|language)/, titulo: "Identificação do navegador", desc: "Coleta dados do ambiente do visitante (fingerprinting).", sev: "med", peso: 5 },
        { id: "store", re: /(localStorage|sessionStorage|indexedDB)/, titulo: "Armazenamento local", desc: "Lê ou grava dados persistentes no navegador.", sev: "med", peso: 4 }
    ];
    function detectBehaviors(texts) {
        const out = [];
        BEHAVIORS.forEach(b => {
            for (const { text, camada } of texts) {
                const m = text.match(b.re);
                if (m) {
                    const i = m.index, ln = text.slice(0, i).split("\n").length;
                    out.push({ id: b.id, titulo: b.titulo, descricao: b.desc, severidade: b.sev, peso: b.peso, evidencia: cut(text.slice(Math.max(0, i - 20), i + 90), 100), camada, linha: ln });
                    break;
                }
            }
        });
        return out;
    }

    /* ---------- API principal ---------- */
    function extractScripts(input) {
        if (!/<script[\s>]/i.test(input)) return null;
        const parts = []; const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi; let m;
        while ((m = re.exec(input))) if (m[1].trim()) parts.push(m[1].trim());
        return parts.length ? parts.join("\n;\n") : null;
    }
    const newLayer = (n, titulo, code) => ({ n, titulo, bytes: code.length, passos: [], tamanhoFinal: null });

    async function analyze(input, opts) {
        opts = opts || {};
        const ctx = { strings: [], html: [], avisos: [] };
        const t0 = Date.now();
        let code = String(input || "");
        const res = { ok: true, entrada: code, saida: "", camadas: [], iocs: [], comportamentos: [], avisos: ctx.avisos, veredito: null, ms: 0, erro: null };
        if (!code.trim()) { res.ok = false; res.erro = "Cole um código JavaScript no editor da esquerda."; return res; }
        if (!acorn) { res.ok = false; res.erro = "O parser (acorn) não foi carregado."; return res; }

        const embedded = extractScripts(code);
        if (embedded) { ctx.avisos.push("Entrada em HTML: analisando apenas o conteúdo das tags <script>."); code = embedded; }

        try { parseCode(code); } catch (e) {
            res.ok = false;
            const loc = e.loc ? ` (linha ${e.loc.line}, coluna ${e.loc.column + 1})` : "";
            res.erro = "Não foi possível ler o código como JavaScript: " + String(e.message).replace(/\s*\(\d+:\d+\)$/, "") + loc + ".";
            return res;
        }

        const layers = [newLayer(1, "Código original", code)];
        const snapshots = [code];
        for (let guard = 0; guard < MAX_LAYERS; guard++) {
            const cur = layers[layers.length - 1];
            const sa = resolveStringArrays(code, cur, ctx);
            if (sa.changed) code = sa.code;
            for (let i = 0; i < 8; i++) { const r = simplify(code, cur, ctx); if (!r.changed) break; code = r.code; }
            cur.tamanhoFinal = code.length;
            const u = unwrap(code, ctx);
            if (!u.changed) break;
            code = u.code;
            layers.push(newLayer(layers.length + 1, u.tecnica || "Camada decodificada", code));
            snapshots.push(code);
            if (layers.length >= MAX_LAYERS) { ctx.avisos.push("Limite de camadas atingido."); break; }
        }
        const last = layers[layers.length - 1];
        code = renameObfuscated(code, last);
        last.tamanhoFinal = code.length;
        res.saida = await formatCode(code);
        res.camadas = layers;

        // IoCs e comportamentos
        const texts = [];
        const stringsDe = (src, n) => { try { walk(parseCode(src), nd => { if (nd.type === "Literal" && typeof nd.value === "string" && nd.value.length > 3) texts.push({ text: nd.value, camada: n }); }); } catch (e) { /* ignora */ } };
        snapshots.forEach((s, i) => stringsDe(s, i + 1));
        stringsDe(code, layers.length);
        ctx.strings.forEach(s => texts.push({ text: s, camada: layers.length }));
        ctx.html.forEach(s => texts.push({ text: s, camada: layers.length }));
        res.iocs = extractIocs(texts);
        const bt = [{ text: res.saida, camada: layers.length }, ...ctx.html.map(h => ({ text: h, camada: layers.length })), ...ctx.strings.map(s => ({ text: s, camada: layers.length }))];
        res.comportamentos = detectBehaviors(bt);
        if (layers.length > 2) res.comportamentos.unshift({ id: "layers", titulo: `${layers.length} camadas de ofuscação`, descricao: "O código escondia a carga real dentro de várias camadas (eval, packer, base64).", severidade: "alto", peso: 20, evidencia: layers.slice(1).map(l => l.titulo).join(" → "), camada: 1, linha: 1 });
        else if (layers.length === 2) res.comportamentos.unshift({ id: "layers", titulo: "Carga escondida em eval", descricao: "O código real só aparece depois de decodificar uma string e executá-la.", severidade: "alto", peso: 15, evidencia: layers[1].titulo, camada: 1, linha: 1 });

        const score = Math.min(100, res.comportamentos.reduce((a, b) => a + b.peso, 0) + Math.min(res.iocs.length * 3, 15));
        res.veredito = { score, nivel: score >= 60 ? "crit" : score >= 30 ? "alto" : score >= 10 ? "med" : "ok", rotulo: score >= 60 ? "Provavelmente malicioso" : score >= 30 ? "Suspeito" : score >= 10 ? "Atenção" : "Sem sinais relevantes" };
        res.ms = Date.now() - t0;
        return res;
    }

    root.TEDeobf = { analyze, classify, extractIocs, simpleBeautify, version: "1.0" };
    if (typeof module !== "undefined" && module.exports) module.exports = root.TEDeobf;
})(typeof window !== "undefined" ? window : globalThis);
