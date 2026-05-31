(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/ai/tiers.js
  var DEFAULT_MODELS = {
    tiny: "google/gemini-2.5-flash-lite",
    // classifier — runs every turn (cheap, fast)
    medium: "deepseek/deepseek-v4-pro",
    // narrator — quality matters
    large: "deepseek/deepseek-v4-pro",
    // world gen — not used in Phase 3
    image: "google/gemini-2.5-flash-image"
    // scene sketch — optional, fires after each turn
  };

  // vendor/spektrum.js
  var MUSTACHE = /\{\{\s*([^}]+?)\s*\}\}/g;
  var warn = (msg) => console.warn("[spektrum] " + msg);
  var SAFE_KEY = (k) => k !== "__proto__" && k !== "prototype" && k !== "constructor";
  var JS_SCHEME = /^\s*javascript:/i;
  var KEY_GATE = { enter: ":Enter", esc: ":Escape", tab: ":Tab", shift: "shiftKey", cmd: "metaKey" };
  var getPathObj = (obj, path) => path.split(".").reduce((acc, k) => acc == null ? acc : acc[k], obj);
  var isPath = (obj, path) => path.split(".").every((k) => SAFE_KEY(k) && (obj = obj == null ? void 0 : obj[k]) !== void 0);
  var createNestedObjects = (obj, path) => {
    const keys = path.split(".");
    if (!keys.every(SAFE_KEY)) return obj;
    keys.pop();
    keys.reduce((acc, k) => acc[k] = acc[k] || {}, obj);
    return obj;
  };
  var setPathValue = (obj, path, value) => {
    const keys = path.split(".");
    if (!keys.every(SAFE_KEY)) return;
    const last = keys.pop();
    const target = keys.reduce((acc, k) => acc[k] = acc[k] || {}, obj);
    target[last] = value;
  };
  var deepMerge = (target, source) => {
    for (const k of Object.keys(source)) {
      if (!SAFE_KEY(k)) continue;
      const v = source[k];
      if (v && typeof v === "object" && !Array.isArray(v)) {
        if (target[k] == null || typeof target[k] !== "object") target[k] = {};
        deepMerge(target[k], v);
      } else target[k] = v;
    }
    return target;
  };
  var clearObject = (obj) => {
    for (const k of Object.keys(obj)) delete obj[k];
  };
  var parseValue = (s) => {
    if (s == null || s === "") return void 0;
    if (s === "true") return true;
    if (s === "false") return false;
    const n = +s;
    return n === n ? n : s;
  };
  var callAll = (fns) => fns.forEach((f) => f && f());
  var histId = (el) => el.dataset.name || `${el.dataset.fn}@${el.dataset.id}`;
  var fnVal = (el, v) => v ?? parseValue(el.value);
  var EVAL_CACHE_LIMIT = 500;
  var evalCache = /* @__PURE__ */ new Map();
  var cacheSet = (k, v) => {
    if (evalCache.size >= EVAL_CACHE_LIMIT) {
      evalCache.delete(evalCache.keys().next().value);
    }
    evalCache.set(k, v);
  };
  var scopePaths = /* @__PURE__ */ new WeakMap();
  var eachHosts = /* @__PURE__ */ new WeakSet();
  var evalExpr = (expr) => {
    let fn = evalCache.get(expr);
    if (fn) return fn;
    try {
      const normalized = expr.replace(
        /([a-zA-Z_$][\w$]*)((?:\.\d+)+)/g,
        (_, h, t) => h + t.replace(/\.(\d+)/g, "[$1]")
      );
      const compiled = new Function("state", "scope", `with (state) with (scope||{}) { return (${normalized}); }`);
      fn = (state, scope) => {
        try {
          return compiled(state, scope);
        } catch {
          return void 0;
        }
      };
    } catch (err) {
      warn('invalid expression: "' + expr + '" ' + err);
      fn = () => void 0;
    }
    cacheSet(expr, fn);
    return fn;
  };
  var IDENT = /(?<![\w$.])([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*)/g;
  var RESERVED = /^(true|false|null|undefined|NaN|Infinity|Math|JSON|Date|Number|String|Array|Object|Boolean)$/;
  var extractPaths = (expr, scope) => {
    const paths = /* @__PURE__ */ new Set();
    const map = scopePaths.get(scope);
    const stripped = expr.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, '""');
    for (const m of stripped.matchAll(IDENT)) {
      const id = m[1];
      const head = id.split(".")[0];
      if (RESERVED.test(head)) continue;
      if (scope && head in scope) {
        const aliased = map[head];
        if (aliased) paths.add(aliased + id.slice(head.length));
        continue;
      }
      paths.add(id);
    }
    return [...paths];
  };
  var applyClass = (el, v) => {
    if (typeof v === "string") el.className = v;
    else if (Array.isArray(v)) el.className = v.filter(Boolean).join(" ");
    else if (v && typeof v === "object")
      for (const k in v) el.classList.toggle(k, !!v[k]);
  };
  var walkTextNodes = (root, visit) => {
    const stack = [root];
    while (stack.length) {
      const n = stack.pop();
      if (n.nodeType === 3) visit(n);
      else for (let i = n.childNodes.length; i--; ) stack.push(n.childNodes[i]);
    }
  };
  var createSpektrum = (opts = {}) => {
    const { historyLimit, snapshotEvery } = opts;
    const forkLimit = opts.forkLimit ?? 50;
    const appState2 = {};
    const appStateDelta2 = {};
    const history3 = [];
    const snapshots2 = [];
    const forks2 = [];
    const systems = [];
    const fns = {};
    const refs2 = {};
    const intents2 = {};
    let cursor = 0;
    let replaying = false;
    const errorHandlers = /* @__PURE__ */ new Set();
    const recordHandlers = /* @__PURE__ */ new Set();
    const forkHandlers = /* @__PURE__ */ new Set();
    let boundRoots = /* @__PURE__ */ new WeakSet();
    const allCleanups = /* @__PURE__ */ new Set();
    const safeFire = (handlers, name, ...args) => {
      for (const fn of handlers) {
        try {
          fn(...args);
        } catch (err) {
          console.error(`[spektrum] ${name} threw`, err);
        }
      }
    };
    const stateSnapshot = () => deepMerge(deepMerge({}, appState2), appStateDelta2);
    const checkPath = (path) => {
      if (!isPath(appStateDelta2, path)) createNestedObjects(appStateDelta2, path);
      if (!isPath(appState2, path)) createNestedObjects(appState2, path);
    };
    const applyEntry = (e) => {
      if (e.op === "checkpoint") return;
      checkPath(e.path);
      if (e.op === "set") return setPathValue(appStateDelta2, e.path, e.value);
      const cur = getPathObj(appStateDelta2, e.path) ?? getPathObj(appState2, e.path);
      setPathValue(appStateDelta2, e.path, (typeof cur === "number" ? cur : 0) + e.value);
    };
    const record = (entry) => {
      if (cursor < history3.length) {
        const dropped = history3.slice(cursor);
        history3.length = cursor;
        while (snapshots2.at(-1)?.index > cursor) snapshots2.pop();
        if (dropped.length && forkLimit !== 0) {
          const fork = { entries: dropped, forkedAt: cursor, ts: Date.now() };
          forks2.push(fork);
          if (forks2.length > forkLimit) forks2.splice(0, forks2.length - forkLimit);
          safeFire(forkHandlers, "onFork", fork);
        }
      }
      applyEntry(entry);
      history3.push(entry);
      cursor = history3.length;
      if (snapshotEvery && history3.length % snapshotEvery === 0) {
        snapshots2.push({ index: history3.length, state: stateSnapshot() });
      }
      if (historyLimit && history3.length > historyLimit) {
        const chunk = historyLimit >>> 4 || 1;
        const drop = history3.length - historyLimit + chunk - 1;
        history3.splice(0, drop);
        cursor = Math.max(0, cursor - drop);
        while (snapshots2[0]?.index <= drop) snapshots2.shift();
        for (const s of snapshots2) s.index -= drop;
      }
      safeFire(recordHandlers, "onRecord", entry);
    };
    const sub = (set) => (fn) => {
      if (fn === null) return set.clear();
      set.add(fn);
      return () => set.delete(fn);
    };
    const onError2 = sub(errorHandlers);
    const onRecord2 = sub(recordHandlers);
    const onFork2 = sub(forkHandlers);
    const routeErr = (err, fn, msg) => {
      if (errorHandlers.size) safeFire(errorHandlers, "onError", err, fn);
      else console.error("[spektrum] " + msg, err);
    };
    const runSystem = (sys) => {
      try {
        sys.fn(appState2, appStateDelta2);
      } catch (err) {
        routeErr(err, sys.fn, "system threw");
      }
    };
    const callFn = (name, fn, ...args) => {
      try {
        const r = fn(...args);
        if (r?.then) r.catch((err) => routeErr(err, fn, `async data-fn "${name}"`));
      } catch (err) {
        routeErr(err, fn, `sync data-fn "${name}"`);
      }
    };
    const setValue2 = (path, value, id) => path ? record({ id: id || `set:${path}`, path, value, op: "set" }) : warn("setValue: empty path");
    const addValue2 = (path, value, id) => path ? record({ id: id || `add:${path}`, path, value, op: "add" }) : warn("addValue: empty path");
    const trigger2 = (id, path, value) => addValue2(path, value, id);
    const checkpoint2 = (name, metadata) => {
      record({ id: name, path: "", value: metadata, op: "checkpoint" });
    };
    const checkpointsOf = () => history3.flatMap((e, index) => e.op === "checkpoint" ? [{ ...e, index }] : []);
    const addSystem2 = (paths, fn) => {
      const entry = { paths, fn, topKeys: paths.map((p) => p.split(".")[0]), active: true };
      systems.push(entry);
      return () => {
        entry.active = false;
        const i = systems.indexOf(entry);
        ~i && systems.splice(i, 1);
      };
    };
    const watch2 = addSystem2;
    const removeSystem2 = (fn) => {
      const i = systems.findIndex((s) => s.fn === fn);
      if (i === -1) return false;
      systems.splice(i, 1);
      return true;
    };
    const defineFn2 = (name, fn, meta) => {
      if (meta) fn.meta = meta;
      fns[name] = fn;
    };
    const asyncRunners = {};
    const addAsync2 = (path, fn) => {
      const id = `addAsync:${path}`;
      const set = (k, v) => setValue2(`${path}.${k}`, v, id);
      const run3 = async () => {
        set("loading", true);
        try {
          set("data", await fn());
          set("error", null);
        } catch (err) {
          set("error", err?.message || String(err));
        } finally {
          set("loading", false);
        }
      };
      asyncRunners[path] = run3;
      const cur = getPathObj(appState2, path);
      const settled = cur && typeof cur === "object" && ("data" in cur || "error" in cur);
      if (!settled) run3();
      return run3;
    };
    const refresh2 = (path) => asyncRunners[path]?.();
    const tick2 = () => {
      let iterations = 0;
      while (Object.keys(appStateDelta2).length > 0) {
        if (iterations++ > 1024) {
          const err = new Error("tick: max iterations exceeded");
          err.code = "E_TICK_OVERFLOW";
          if (errorHandlers.size) safeFire(errorHandlers, "onError", err, null);
          else warn("tick: max iterations exceeded");
          clearObject(appStateDelta2);
          return;
        }
        const deltaKeys = new Set(Object.keys(appStateDelta2));
        const toRun = systems.filter(
          (s) => s.topKeys.some((k) => deltaKeys.has(k)) && s.paths.some((p) => isPath(appStateDelta2, p))
        );
        deepMerge(appState2, appStateDelta2);
        clearObject(appStateDelta2);
        for (const sys of toRun) if (sys.active) runSystem(sys);
      }
    };
    const run2 = () => {
      tick2();
      requestAnimationFrame(run2);
    };
    const resetState2 = () => {
      for (const c of allCleanups) c();
      allCleanups.clear();
      clearObject(appState2);
      clearObject(appStateDelta2);
      clearObject(refs2);
      history3.length = 0;
      snapshots2.length = 0;
      forks2.length = 0;
      boundRoots = /* @__PURE__ */ new WeakSet();
      cursor = 0;
      replaying = false;
    };
    const reset2 = () => {
      resetState2();
      systems.length = 0;
    };
    const replay2 = (n) => {
      n = Math.max(0, Math.min(n, history3.length));
      replaying = true;
      cursor = 0;
      clearObject(appState2);
      clearObject(appStateDelta2);
      let startIdx = 0;
      const sn = snapshots2.findLast((s) => s.index <= n);
      if (sn) {
        deepMerge(appState2, sn.state);
        cursor = startIdx = sn.index;
      }
      for (let i = startIdx; i < n; i++) {
        applyEntry(history3[i]);
        cursor = i + 1;
        tick2();
      }
      for (const sys of systems) runSystem(sys);
      replaying = false;
    };
    const resolvePath = (path, scope) => {
      const map = scopePaths.get(scope);
      if (!map) return path;
      const head = path.split(".")[0];
      const aliased = map[head];
      return aliased ? aliased + path.slice(head.length) : path;
    };
    const bindReactive = (paths, render, scope) => {
      const wrapped = scope ? (state, delta) => render(state, delta, scope) : render;
      const unsub = addSystem2(paths, wrapped);
      wrapped(stateSnapshot(), appStateDelta2);
      return unsub;
    };
    const textTemplates = /* @__PURE__ */ new WeakMap();
    const bindText = (node, scope) => {
      let template = textTemplates.get(node);
      if (template === void 0) {
        template = node.textContent;
        textTemplates.set(node, template);
      }
      if (!template.includes("{{")) return;
      const paths = /* @__PURE__ */ new Set();
      for (const m of template.matchAll(MUSTACHE)) {
        for (const p of extractPaths(m[1].trim(), scope)) paths.add(p);
      }
      return bindReactive([...paths], (state, _delta, sc) => {
        node.textContent = template.replace(MUSTACHE, (_, e) => {
          const v = evalExpr(e.trim())(state, sc);
          return v == null ? "" : String(v);
        });
      }, scope);
    };
    const bindAttrs = (el, scope) => {
      const unsubs = [];
      for (const a of [...el.attributes]) {
        if (a.name[0] !== ":") continue;
        const prop = a.name.slice(1), expr = a.value;
        if (!expr) continue;
        const isClass = prop === "class" || prop === "className";
        const isUrl = /^(href|src|action|formaction|background|cite|poster|data)$/.test(prop);
        unsubs.push(bindReactive(extractPaths(expr, scope), (state, _delta, sc) => {
          let v = evalExpr(expr)(state, sc);
          if (isClass) return applyClass(el, v);
          if (isUrl && typeof v === "string" && JS_SCHEME.test(v)) v = "#";
          el[prop] = v;
        }, scope));
      }
      return unsubs.length && (() => callAll(unsubs));
    };
    const bindIf = (el, scope) => {
      const expr = el.dataset.if;
      if (!expr) return;
      return bindReactive(extractPaths(expr, scope), (state, _delta, sc) => {
        el.style.display = evalExpr(expr)(state, sc) ? "" : "none";
      }, scope);
    };
    const bindModel = (el, scope) => {
      const raw = el.dataset.model;
      if (!raw) return;
      const parts = raw.split(".");
      const mods = /* @__PURE__ */ new Set();
      while (/^(lazy|number|trim)$/.test(parts.at(-1))) {
        mods.add(parts.pop());
      }
      const path = resolvePath(parts.join("."), scope);
      if (!path) return;
      const isCheckbox = el.type === "checkbox";
      const eventName = mods.has("lazy") || isCheckbox ? "change" : "input";
      const writeEl = (v) => isCheckbox ? el.checked = !!v : el.value = v ?? "";
      const readEl = () => {
        if (isCheckbox) return el.checked;
        const v = mods.has("trim") ? el.value.trim() : el.value;
        if (!mods.has("number")) return parseValue(v);
        const n = parseFloat(v);
        return isNaN(n) ? v : n;
      };
      const unsubs = [];
      unsubs.push(bindReactive([path], (state) => writeEl(getPathObj(state, path))));
      const listener = () => setValue2(path, readEl(), `model:${path}`);
      el.addEventListener(eventName, listener);
      unsubs.push(() => el.removeEventListener(eventName, listener));
      return () => callAll(unsubs);
    };
    const bindRef = (el) => {
      const name = el.dataset.ref;
      if (!name) return;
      refs2[name] = el;
      return () => {
        if (refs2[name] === el) delete refs2[name];
      };
    };
    const bindIntent = (el) => {
      const name = el.dataset.intent;
      if (!name) return;
      (intents2[name] ||= []).push(el);
      return () => {
        const a = intents2[name];
        const i = a?.indexOf(el);
        if (i >= 0) a.splice(i, 1);
        if (!a?.length) delete intents2[name];
      };
    };
    const computed2 = (path, deps, fn) => {
      const derive = (s, d) => {
        const v = fn(s);
        setPathValue(d, path, v);
        setPathValue(appState2, path, v);
      };
      try {
        derive(stateSnapshot(), appStateDelta2);
      } catch {
      }
      return addSystem2(deps, derive);
    };
    const makeScope = (outer, varName, i, items2, arrayPath) => {
      const path = arrayPath + "." + i;
      const scope = outer ? { ...outer } : {};
      scope[varName] = items2[i];
      scope.index = i;
      scope.$index = i;
      scope.$first = i === 0;
      scope.$last = i === items2.length - 1;
      scope.$path = path;
      scopePaths.set(scope, { ...scopePaths.get(outer) || {}, [varName]: path });
      return scope;
    };
    const bindEach = (el, outerScope) => {
      const ds = el.dataset;
      const arrayPath = resolvePath(ds.each, outerScope);
      if (!arrayPath) return;
      const varName = ds.as || "item";
      const keyExpr = ds.key;
      const isTpl = el.tagName === "TEMPLATE";
      const host = isTpl ? el.parentElement : el;
      if (!host) {
        warn(`data-each="${arrayPath}" <template> needs a parentElement`);
        return;
      }
      const templateChild = (isTpl ? el.content : el).firstElementChild;
      if (!templateChild) {
        warn(`data-each="${arrayPath}" needs an element child to clone`);
        return;
      }
      const template = templateChild.cloneNode(true);
      if (!isTpl) templateChild.remove();
      eachHosts.add(host);
      const anchor = isTpl ? el : null;
      const insertAt = (clone, ref) => host.insertBefore(clone, ref || anchor);
      const cache = /* @__PURE__ */ new Map();
      let cleanups = [];
      let live = [];
      const liveDrop = (clone) => {
        const oi = live.indexOf(clone);
        if (oi >= 0) live.splice(oi, 1);
      };
      const buildClone = (i, items2) => {
        const clone = template.cloneNode(true);
        if (clone.style && !clone.style.contain) clone.style.contain = "layout style";
        const scope = makeScope(outerScope, varName, i, items2, arrayPath);
        return { clone, cleanup: bindDOM2(clone, scope) };
      };
      const wipeAll = () => {
        for (const e of cache.values()) {
          e.cleanup();
          e.clone.remove();
        }
        cache.clear();
        callAll(cleanups);
        for (const c of live) c.remove();
        cleanups = [];
        live = [];
      };
      let prev = [];
      const appendFrom = (from, to, items2) => {
        for (let i = from; i < to; i++) {
          const c = buildClone(i, items2);
          cleanups.push(c.cleanup);
          live.push(c.clone);
          insertAt(c.clone, null);
        }
      };
      return bindReactive([arrayPath], (state) => {
        const items2 = getPathObj(state, arrayPath);
        if (!Array.isArray(items2)) {
          if (items2 !== void 0) warn(`data-each="${arrayPath}" resolved to ${items2 === null ? "null" : typeof items2}, expected Array`);
          wipeAll();
          prev = [];
          return;
        }
        if (!keyExpr) {
          const oldN = prev.length, newN = items2.length;
          let pre = 0;
          while (pre < oldN && pre < newN && prev[pre] === items2[pre]) pre++;
          if (pre === oldN && newN > oldN) appendFrom(oldN, newN, items2);
          else if (pre === newN && newN < oldN) {
            while (cleanups.length > newN) {
              cleanups.pop()();
              live.pop().remove();
            }
          } else {
            wipeAll();
            appendFrom(0, newN, items2);
          }
          prev = items2.slice();
          return;
        }
        const keyFn = evalExpr(keyExpr);
        const newKeys = items2.map((item) => keyFn(state, { [varName]: item }));
        const seen = /* @__PURE__ */ new Set();
        for (let i = 0; i < items2.length; i++) {
          const key = newKeys[i];
          if (seen.has(key)) warn(`data-each="${arrayPath}" duplicate key ${JSON.stringify(key)}`);
          seen.add(key);
          let entry = cache.get(key);
          if (!entry) {
            entry = buildClone(i, items2);
            cache.set(key, entry);
          } else if (entry.index !== i) {
            entry.cleanup();
            entry.cleanup = bindDOM2(entry.clone, makeScope(outerScope, varName, i, items2, arrayPath));
          }
          entry.index = i;
          if (live[i] !== entry.clone) {
            insertAt(entry.clone, live[i]);
            liveDrop(entry.clone);
            live.splice(i, 0, entry.clone);
          }
        }
        for (const [key, entry] of cache) {
          if (!seen.has(key)) {
            entry.cleanup();
            entry.clone.remove();
            liveDrop(entry.clone);
            cache.delete(key);
          }
        }
      });
    };
    const bindAction = (el, scope) => {
      const ds = el.dataset;
      const action = ds.action;
      const fnName = ds.fn;
      const handler = fns[fnName];
      if (!handler) {
        console.warn(`[spektrum] unknown data-fn "${fnName}"`, el);
        return;
      }
      const value = parseValue(ds.value);
      if (action === "cycle") {
        if (!ds.id) return warn(`data-action="cycle" needs data-id`);
        const idPath = resolvePath(ds.id, scope);
        return addSystem2([idPath], (state, delta) => callFn(fnName, handler, el, state, delta, value, void 0, scope));
      }
      const [eventName, ...modifiers] = action.split(".");
      const mods = new Set(modifiers);
      const has2 = (m) => mods.has(m);
      const rm = () => el.removeEventListener(eventName, listener, opts2);
      const listener = (ev) => {
        for (const m of mods) {
          const g = KEY_GATE[m];
          if (g && (g[0] === ":" ? ev.key !== g.slice(1) : !ev[g])) return;
        }
        if (has2("self") && ev.target !== el) return;
        if (has2("prevent")) ev.preventDefault();
        if (has2("stop")) ev.stopPropagation();
        callFn(fnName, handler, el, appState2, appStateDelta2, value, ev, scope);
        if (has2("once")) rm();
      };
      const opts2 = { capture: has2("capture"), passive: has2("passive") };
      el.addEventListener(eventName, listener, opts2);
      return rm;
    };
    const bindDOM2 = (root, scope) => {
      root = root || document;
      if (!scope) {
        if (boundRoots.has(root)) return () => {
        };
        boundRoots.add(root);
      }
      const unsubs = [];
      const collect = (u) => {
        if (u) {
          unsubs.push(u);
          allCleanups.add(u);
        }
      };
      const ownedByEach = (n) => {
        let p = n.parentNode;
        while (p && p !== root) {
          if (eachHosts.has(p)) return true;
          p = p.parentNode;
        }
        return false;
      };
      for (const el of root.querySelectorAll("[data-each]")) {
        if (!root.contains(el) || ownedByEach(el)) continue;
        collect(bindEach(el, scope));
      }
      walkTextNodes(root, (n) => {
        if (ownedByEach(n)) return;
        collect(bindText(n, scope));
      });
      for (const el of root.querySelectorAll("*")) {
        if (ownedByEach(el)) continue;
        collect(bindAttrs(el, scope));
        const ds = el.dataset;
        if (ds.if !== void 0) collect(bindIf(el, scope));
        if (ds.model !== void 0) collect(bindModel(el, scope));
        if (ds.ref !== void 0) collect(bindRef(el));
        if (ds.intent !== void 0) collect(bindIntent(el));
        if (ds.action !== void 0) collect(bindAction(el, scope));
        el.removeAttribute("data-cloak");
      }
      root.removeAttribute?.("data-cloak");
      return () => {
        boundRoots.delete(root);
        callAll(unsubs);
        for (const u of unsubs) allCleanups.delete(u);
      };
    };
    const serialize2 = (opts2 = {}) => {
      const out = { state: appState2 };
      if (opts2.includeHistory !== false) {
        out.history = history3;
        out.cursor = cursor;
      }
      if (opts2.includeForks) out.forks = forks2;
      return JSON.stringify(out);
    };
    const describe2 = () => ({
      state: appState2,
      cursor,
      historyLength: history3.length,
      forkCount: forks2.length,
      snapshotCount: snapshots2.length,
      options: { historyLimit, snapshotEvery, forkLimit },
      systems: systems.map((s) => ({ paths: s.paths, name: s.fn.name || "" })),
      fns: Object.entries(fns).map(([n, f]) => ({ name: n, ...f.meta || {} })),
      refs: Object.keys(refs2),
      intents: Object.fromEntries(Object.entries(intents2).map(([k, v]) => [k, v.length])),
      checkpoints: checkpointsOf()
    });
    const explain2 = (opts2 = {}) => {
      const from = Math.max(0, opts2.from ?? 0);
      const to = Math.min(history3.length, opts2.to ?? history3.length);
      return history3.slice(from, to).map((e, i) => ({
        ...e,
        index: from + i,
        triggers: e.op === "checkpoint" ? [] : systems.filter((s) => s.paths.some((p) => p === e.path || e.path.startsWith(p + ".") || p.startsWith(e.path + "."))).map((s) => s.fn.name || "")
      }));
    };
    const attempt2 = (name, fn) => {
      const start = cursor;
      checkpoint2(`attempt:${name}`);
      const result = fn();
      let done = false;
      return {
        result,
        commit: () => {
          if (done) return;
          done = true;
          checkpoint2(`attempt:${name}:commit`);
        },
        discard: () => {
          if (done) return;
          done = true;
          replay2(start);
        }
      };
    };
    const findByIntent2 = (name) => intents2[name]?.slice() || [];
    defineFn2("setValue", (el, _s, _d, v, _e, sc) => setValue2(resolvePath(el.dataset.id, sc), fnVal(el, v), histId(el)));
    const addFn = (el, _s, _d, v, _e, sc) => addValue2(resolvePath(el.dataset.id, sc), fnVal(el, v), histId(el));
    defineFn2("addValue", addFn);
    defineFn2("trigger", addFn);
    defineFn2("setText", (el, state, _d, _v, _e, sc) => {
      el.textContent = getPathObj(state, resolvePath(el.dataset.id, sc));
    });
    defineFn2("setStyle", (el, state, _d, _v, _e, sc) => {
      const v = getPathObj(state, resolvePath(el.dataset.id, sc));
      el.style[el.dataset.prop] = `${v}${el.dataset.suffix || ""}`;
    });
    defineFn2("toggle", (el) => {
      const target = document.querySelector(el.dataset.target);
      if (target) target.classList.toggle(el.dataset.class);
    });
    return {
      appState: appState2,
      appStateDelta: appStateDelta2,
      history: history3,
      snapshots: snapshots2,
      forks: forks2,
      refs: refs2,
      intents: intents2,
      get cursor() {
        return cursor;
      },
      get replaying() {
        return replaying;
      },
      get checkpoints() {
        return checkpointsOf();
      },
      setValue: setValue2,
      addValue: addValue2,
      trigger: trigger2,
      checkpoint: checkpoint2,
      computed: computed2,
      addAsync: addAsync2,
      refresh: refresh2,
      addSystem: addSystem2,
      watch: watch2,
      removeSystem: removeSystem2,
      defineFn: defineFn2,
      onError: onError2,
      onRecord: onRecord2,
      onFork: onFork2,
      bindDOM: bindDOM2,
      run: run2,
      tick: tick2,
      replay: replay2,
      reset: reset2,
      resetState: resetState2,
      serialize: serialize2,
      describe: describe2,
      explain: explain2,
      attempt: attempt2,
      findByIntent: findByIntent2
    };
  };
  var _default = createSpektrum();
  var {
    appState,
    appStateDelta,
    history: history2,
    snapshots,
    forks,
    refs,
    intents,
    setValue,
    addValue,
    trigger,
    checkpoint,
    computed,
    addAsync,
    refresh,
    addSystem,
    watch,
    removeSystem,
    defineFn,
    onError,
    onRecord,
    onFork,
    bindDOM,
    run,
    tick,
    replay,
    reset,
    resetState,
    serialize,
    describe,
    explain,
    attempt,
    findByIntent
  } = _default;

  // src/core/state.js
  var DEFAULTS = {
    session: {
      phase: "loading",
      // loading | key-setup | char-create | play | game-over
      turnCount: 0,
      chapterId: "ch-1",
      skillCooldowns: {}
      // { skillId: turnsRemaining }
    },
    ai: {
      baseUrl: "https://openrouter.ai/api/v1",
      key: "",
      models: { ...DEFAULT_MODELS },
      totalTokens: 0,
      totalCostUsd: 0
    },
    party: {
      pc: null,
      // { record: CharacterRecord, sheet: DerivedSheet }
      inventory: []
    },
    world: {
      currentRoom: null,
      exitRoomId: null,
      rooms: {},
      npcs: {}
    },
    flags: {},
    transcript: [],
    settings: {
      sceneImage: false,
      // generate a journal-sketch scene image after each turn
      actionBar: true
      // show the action bar above the debug bar
    }
  };
  function initState() {
    for (const [key, value] of Object.entries(DEFAULTS)) {
      setValue(key, value);
    }
  }
  function restoreState(snapshot) {
    for (const [key, value] of Object.entries(snapshot)) {
      setValue(key, value);
    }
  }
  var SAVE_KEY = "dans-dungeons";
  function saveToStorage() {
    const snap = {
      session: appState.session,
      ai: appState.ai,
      party: appState.party,
      world: appState.world,
      flags: appState.flags,
      transcript: appState.transcript,
      settings: appState.settings
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
    } catch (e) {
      console.warn("[state] localStorage save failed", e);
    }
  }
  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  function clearSave() {
    localStorage.removeItem(SAVE_KEY);
  }

  // src/game/world.js
  var ALL_DIRS = ["north", "south", "east", "west"];
  var OPPOSITE = { north: "south", south: "north", east: "west", west: "east" };
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  var HOUSE_STYLES = [
    "crumbling manor",
    "abandoned estate",
    "forsaken keep",
    "derelict townhouse"
  ];
  var START_ROOMS = [
    {
      name: "Entrance Hall",
      description: (style) => `You stand in the entrance hall of a ${style}. Tattered tapestries cling to damp stone walls, and the reek of mildew fills your lungs. A heavy timber door ahead suggests the house goes deeper.`
    },
    {
      name: "Foyer",
      description: (style) => `The foyer of this ${style} greets you with warped floorboards and the ghost of old grandeur. A cracked mirror reflects your wary face. Passage inward beckons from the far wall.`
    },
    {
      name: "Mudroom",
      description: (style) => `A narrow mudroom at the threshold of the ${style}. Boots long rotted away line one wall; rusted coat-hooks the other. A sagging door leads further inside.`
    }
  ];
  var HUB_ROOMS = [
    {
      name: "Great Hall",
      description: "A vaulted great hall stretches before you, its long feasting table overturned. Moonlight bleeds through a cracked skylight above. One passage disappears into shadow to the side, and a locked door dominates the far wall \u2014 its keyhole dark and waiting."
    },
    {
      name: "Drawing Room",
      description: "The drawing room reeks of old smoke and something worse. Furniture has been shoved to the walls. A side passage gapes open to your left, and across the room a door hangs sealed by a heavy lock."
    },
    {
      name: "Corridor",
      description: "A long corridor bisects the heart of the house. Sconces hold nothing but wax stumps. To one side a doorway stands open; to the other a locked door bears a keyhole shaped for something specific."
    }
  ];
  var KEY_ROOMS = [
    {
      name: "Kitchen",
      description: "The kitchen still holds the ghost of old meals. Pots hang from rusted hooks, and a butcher's block is scarred deep by years of use. Something glints on the shelf above the cold hearth \u2014 catching the faint light."
    },
    {
      name: "Pantry",
      description: "Rows of empty shelves line the pantry, their contents long since spoiled or stolen. A single item rests on the lowest shelf as if left deliberately \u2014 it catches your eye immediately."
    },
    {
      name: "Servants' Quarters",
      description: "A cramped room once shared by servants, now empty of all comfort. Bare pallets are pushed against the walls. On a small bedside table something metallic glints \u2014 left behind, or hidden here on purpose?"
    }
  ];
  var VAULT_ROOMS = [
    {
      name: "Master Study",
      description: (treasureName) => `The master's study is in disarray \u2014 shelves ransacked, papers scattered. Yet in the centre of the room, ${treasureName} sits untouched, as though protected by some old ward. A window to the outside stands unlatched \u2014 a way out.`
    },
    {
      name: "Trophy Room",
      description: (treasureName) => `Glass cases line the trophy room, most shattered and empty. But one pedestal still bears its prize: ${treasureName}. Dust motes swirl as your entrance disturbs the stale air. A back door creaks open to the outside \u2014 your way out.`
    },
    {
      name: "Vault",
      description: (treasureName) => `Stone walls and an iron-banded floor mark this as the vault proper. Someone breached it long ago, but left the most valuable thing behind: ${treasureName}. A drainage passage in the far wall leads upward \u2014 and out.`
    }
  ];
  var ENEMIES = [
    {
      name: "Grizzik the Goblin",
      hp: 7,
      maxHp: 7,
      ac: 15,
      toHit: 4,
      damageDie: "1d6",
      damageBonus: 2,
      damageType: "slashing",
      intro: (style) => `A goblin crouches atop the overturned furniture, yellow eyes snapping open as you enter. It snatches up a battered scimitar and bares its teeth: "This ${style} belongs to Grizzik! Turn back or bleed, big-folk!"`
    },
    {
      name: "Guard Skeleton",
      hp: 9,
      maxHp: 9,
      ac: 13,
      toHit: 4,
      damageDie: "1d6",
      damageBonus: 2,
      damageType: "slashing",
      intro: (style) => `Bones rattle as the skeleton assigned to guard this ${style} lurches upright. Its hollow eye sockets fix on you; a rusted longsword rises into a fighting stance with terrible purpose.`
    },
    {
      name: "Feral Cultist",
      hp: 8,
      maxHp: 8,
      ac: 12,
      toHit: 3,
      damageDie: "1d6",
      damageBonus: 1,
      damageType: "piercing",
      intro: (style) => `A robed figure spins to face you, madness bright in its eyes. It has been waiting in this ${style} for a reason you don't yet understand \u2014 and it levels a long dagger at your throat.`
    },
    {
      name: "Giant Rat",
      hp: 5,
      maxHp: 5,
      ac: 12,
      toHit: 3,
      damageDie: "1d4",
      damageBonus: 0,
      damageType: "piercing",
      intro: (style) => `A rat the size of a terrier erupts from beneath the debris of the ${style}, hackles raised and yellow teeth bared. It lunges before you can take a breath.`
    }
  ];
  var KEYS = [
    { id: "found-key", name: "brass key", description: "A tarnished brass key, its bow cast in the shape of a crescent moon." },
    { id: "found-key", name: "iron key", description: "A heavy iron key, cold to the touch and etched with a single Roman numeral." },
    { id: "found-key", name: "silver key", description: "A slender silver key that catches the light with an almost warm glow." },
    { id: "found-key", name: "bone key", description: "A key carved from a single piece of bone \u2014 its origin better left unasked." }
  ];
  var TREASURES = [
    { id: "treasure", name: "chest of gold coins", description: "A brass-banded chest overflowing with gold coins, worth a small fortune.", type: "treasure", value: 250, taken: false },
    { id: "treasure", name: "sapphire amulet", description: "A deep-blue sapphire set in filigreed silver, pulsing with faint inner light.", type: "treasure", value: 500, taken: false },
    { id: "treasure", name: "sealed arcane tome", description: "A thick book sealed with wax and cord, its cover warm despite the cold room.", type: "treasure", value: 400, taken: false },
    { id: "treasure", name: "jewelled ceremonial sword", description: "A sword more art than weapon \u2014 its hilt crusted with rubies and engraved silver.", type: "treasure", value: 600, taken: false }
  ];
  function generateWorld() {
    const enterDir = pick(ALL_DIRS);
    const backDir = OPPOSITE[enterDir];
    const sideDirs = ALL_DIRS.filter((d) => d !== enterDir && d !== backDir);
    const keyDir = sideDirs[0];
    const lockedDir = sideDirs[1];
    const style = pick(HOUSE_STYLES);
    const startDef = pick(START_ROOMS);
    const hubDef = pick(HUB_ROOMS);
    const keyDef = pick(KEY_ROOMS);
    const vaultDef = pick(VAULT_ROOMS);
    const enemyDef = pick(ENEMIES);
    const keyItem = { ...pick(KEYS) };
    const treasure = { ...pick(TREASURES) };
    const rooms = {
      "room-start": {
        id: "room-start",
        name: startDef.name,
        description: startDef.description(style),
        exits: [
          { dir: enterDir, roomId: "room-hub" }
        ],
        loot: []
      },
      "room-hub": {
        id: "room-hub",
        name: hubDef.name,
        description: hubDef.description,
        exits: [
          { dir: backDir, roomId: "room-start" },
          { dir: keyDir, roomId: "room-key" },
          { dir: lockedDir, roomId: "room-vault", locked: true, keyId: "found-key" }
        ],
        loot: []
      },
      "room-key": {
        id: "room-key",
        name: keyDef.name,
        description: keyDef.description,
        exits: [
          { dir: OPPOSITE[keyDir], roomId: "room-hub" }
        ],
        loot: [
          { ...keyItem, taken: false }
        ]
      },
      "room-vault": {
        id: "room-vault",
        name: vaultDef.name,
        description: vaultDef.description(treasure.name),
        exits: [
          { dir: OPPOSITE[lockedDir], roomId: "room-hub", locked: false }
        ],
        loot: [
          treasure
        ]
      }
    };
    const npcs = {
      "enemy-1": {
        id: "enemy-1",
        roomId: "room-hub",
        name: enemyDef.name,
        hp: enemyDef.hp,
        maxHp: enemyDef.maxHp,
        ac: enemyDef.ac,
        toHit: enemyDef.toHit,
        damageDie: enemyDef.damageDie,
        damageBonus: enemyDef.damageBonus,
        damageType: enemyDef.damageType,
        conditions: [],
        attitude: "hostile",
        alive: true,
        intro: enemyDef.intro(style)
      }
    };
    return {
      currentRoom: "room-start",
      exitRoomId: "room-vault",
      rooms,
      npcs
    };
  }

  // vendor/bag-of-holding/src/classes/index.js
  var classes_exports = {};
  __export(classes_exports, {
    barbarian: () => barbarian_default,
    bard: () => bard_default,
    cleric: () => cleric_default,
    druid: () => druid_default,
    fighter: () => fighter_default,
    monk: () => monk_default,
    paladin: () => paladin_default,
    ranger: () => ranger_default,
    rogue: () => rogue_default,
    sorcerer: () => sorcerer_default,
    warlock: () => warlock_default,
    wizard: () => wizard_default
  });

  // vendor/bag-of-holding/src/dice.js
  var PATTERN = /^(\d+)d(\d+)([+-]\d+)?$/;
  function parse(spec) {
    const m = PATTERN.exec(String(spec).trim());
    if (!m) throw new Error(`Invalid dice spec: ${spec}`);
    return { count: Number(m[1]), sides: Number(m[2]), modifier: m[3] ? Number(m[3]) : 0 };
  }
  function rollDie(sides, rng = Math.random) {
    return 1 + Math.floor(rng() * sides);
  }
  function roll(spec, rng = Math.random) {
    const { count, sides, modifier } = parse(spec);
    const rolls = Array.from({ length: count }, () => rollDie(sides, rng));
    const total = rolls.reduce((a, b) => a + b, 0) + modifier;
    return { spec, rolls, modifier, total };
  }
  function rollAdvantage(spec, rng = Math.random) {
    const a = roll(spec, rng);
    const b = roll(spec, rng);
    return a.total >= b.total ? a : b;
  }
  function rollDisadvantage(spec, rng = Math.random) {
    const a = roll(spec, rng);
    const b = roll(spec, rng);
    return a.total <= b.total ? a : b;
  }
  function rollExplosive(spec, rng = Math.random) {
    const { count, sides, modifier } = parse(spec);
    const rolls = [];
    for (let i = 0; i < count; i++) {
      let value;
      do {
        value = rollDie(sides, rng);
        rolls.push(value);
      } while (value === sides);
    }
    const total = rolls.reduce((a, b) => a + b, 0) + modifier;
    return { spec, rolls, modifier, total };
  }
  function seededRng(seed) {
    let state = (seed | 0) >>> 0;
    return () => {
      state = state + 1831565813 | 0;
      let t = state;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // vendor/bag-of-holding/src/checks.js
  var MIN_DC = 5;
  var MAX_DC = 30;
  function modFromScore(score) {
    return Math.floor((score - 10) / 2);
  }
  function clampDC(dc) {
    return Math.max(MIN_DC, Math.min(MAX_DC, dc));
  }
  function abilityCheck({ abilityScore, proficient = false, proficiencyBonus = 2, dc }, rng = Math.random) {
    const d20 = rollDie(20, rng);
    const mod = modFromScore(abilityScore) + (proficient ? proficiencyBonus : 0);
    const total = d20 + mod;
    const target = clampDC(dc);
    return { d20, mod, total, dc: target, success: total >= target };
  }
  function savingThrow(args, rng = Math.random) {
    if (args.autoFailed === true) {
      return {
        d20: 0,
        mod: 0,
        total: 0,
        dc: clampDC(args.dc),
        success: false,
        autoFailed: true
      };
    }
    return abilityCheck(args, rng);
  }

  // vendor/bag-of-holding/src/mechanics.js
  var REFRESH_KINDS = Object.freeze(["short", "long", "day"]);
  function freshResource({ max, refreshes, shortRestRecovery = 0 }) {
    if (!Number.isInteger(max) || max < 0) {
      throw new Error("freshResource: max must be a non-negative integer");
    }
    if (!REFRESH_KINDS.includes(refreshes)) {
      throw new Error(`freshResource: refreshes must be one of ${REFRESH_KINDS.join(", ")}`);
    }
    if (!Number.isInteger(shortRestRecovery) || shortRestRecovery < 0) {
      throw new Error("freshResource: shortRestRecovery must be a non-negative integer");
    }
    const counter = { used: 0, max, refreshes };
    if (shortRestRecovery > 0) counter.shortRestRecovery = shortRestRecovery;
    return counter;
  }
  function freshResources(classDef, level, actor) {
    const out = {};
    const table = classDef?.resources;
    if (!table) return out;
    const evaluate = (field, fallback) => {
      if (field === void 0) return fallback;
      return typeof field === "function" ? field(level, actor) : field;
    };
    for (const [id, spec] of Object.entries(table)) {
      const max = evaluate(spec.max, 0);
      if (max > 0) {
        out[id] = freshResource({
          max,
          refreshes: evaluate(spec.refreshes, "long"),
          shortRestRecovery: evaluate(spec.shortRestRecovery, 0)
        });
      }
    }
    return out;
  }
  function spendResource(actor, id, amount = 1) {
    if (!Number.isInteger(amount) || amount < 1) {
      throw new Error("spendResource: amount must be a positive integer");
    }
    const r = actor.resources?.[id];
    if (!r) return { ok: false, reason: `unknown resource: ${id}` };
    const remaining = r.max - r.used;
    if (remaining < amount) {
      return { ok: false, reason: `not enough ${id}: ${remaining} left, ${amount} needed` };
    }
    return {
      ok: true,
      actor: {
        ...actor,
        resources: { ...actor.resources, [id]: { ...r, used: r.used + amount } }
      }
    };
  }
  function refreshResources(actor, kind) {
    if (!actor.resources) return actor;
    if (!["short", "long", "all"].includes(kind)) {
      throw new Error(`refreshResources: kind must be 'short', 'long', or 'all'`);
    }
    let changed = false;
    const next = {};
    for (const [id, r] of Object.entries(actor.resources)) {
      const shouldReset = kind === "all" || kind === "short" && r.refreshes === "short" || kind === "long" && (r.refreshes === "short" || r.refreshes === "long");
      if (shouldReset && r.used > 0) {
        next[id] = { ...r, used: 0 };
        changed = true;
        continue;
      }
      if (kind === "short" && r.refreshes === "long" && r.shortRestRecovery && r.used > 0) {
        const reduced = Math.max(0, r.used - r.shortRestRecovery);
        if (reduced !== r.used) {
          next[id] = { ...r, used: reduced };
          changed = true;
          continue;
        }
      }
      next[id] = r;
    }
    return changed ? { ...actor, resources: next } : actor;
  }

  // vendor/bag-of-holding/src/classes/fighter.js
  var fighter_default = {
    id: "fighter",
    name: "Fighter",
    hitDie: 10,
    primaryAbility: "str",
    savingThrowProficiencies: ["str", "con"],
    weaponMasterySlots: 3,
    // Extra Attack at L5: one additional attack per Attack action.
    // Encounter system reads this via `attacksPerAction(classDef, level)`.
    extraAttacks: { 5: 1 },
    features: {
      1: ["Fighting Style", "Second Wind", "Weapon Mastery"],
      2: ["Action Surge", "Tactical Mind"],
      3: ["Fighter Subclass"],
      4: ["Ability Score Improvement"],
      5: ["Extra Attack", "Tactical Shift"],
      6: ["Ability Score Improvement", "Weapon Mastery (4 weapons)"],
      7: ["Subclass Feature"],
      8: ["Ability Score Improvement"],
      9: ["Indomitable", "Tactical Master"],
      10: ["Subclass Feature"]
    },
    // Resource-bearing features (since 1.3.0). Both refresh on a
    // Short Rest per SRD 5.2 § Fighter.
    resources: {
      secondWind: { max: 1, refreshes: "short" },
      actionSurge: { max: 1, refreshes: "short" }
    },
    mechanics: {
      /**
       * SRD 5.2 § Fighter § Second Wind: as a Bonus Action, regain
       * `1d10 + Fighter level` Hit Points. One use per Short Rest.
       * Returns `{ ok, die, healed, hpAfter, actor }` on success or
       * `{ ok: false, reason }` if no uses remain.
       */
      secondWind: (actor, _args, ctx) => {
        const result = spendResource(actor, "secondWind");
        if (!result.ok) return result;
        const level = actor.level ?? 1;
        const die = ctx.rollDie(10, ctx.rng);
        const raw = die + level;
        const hpBefore = actor.hp ?? 0;
        const hpMax = actor.hpMax ?? Infinity;
        const hpAfter = Math.min(hpBefore + raw, hpMax);
        return {
          ok: true,
          die,
          healed: hpAfter - hpBefore,
          hpAfter,
          actor: { ...result.actor, hp: hpAfter }
        };
      },
      /**
       * SRD 5.2 § Fighter § Action Surge: on your turn, take one
       * additional action. Returns `{ ok, extraAction, actor }`. The
       * host applies the action by topping up the encounter budget;
       * the engine just decrements the use.
       */
      actionSurge: (actor) => {
        const result = spendResource(actor, "actionSurge");
        if (!result.ok) return result;
        return { ok: true, extraAction: true, actor: result.actor };
      }
    }
  };

  // vendor/bag-of-holding/src/classes/rogue.js
  var rogue_default = {
    id: "rogue",
    name: "Rogue",
    hitDie: 8,
    primaryAbility: "dex",
    savingThrowProficiencies: ["dex", "int"],
    // Sneak Attack scales: 1d6 at L1, +1d6 every 2 levels (rounded).
    sneakAttackDice: { 1: 1, 3: 2, 5: 3, 7: 4, 9: 5 },
    features: {
      1: ["Expertise", "Sneak Attack", "Thieves' Cant"],
      2: ["Cunning Action"],
      3: ["Roguish Archetype"],
      4: ["Ability Score Improvement"],
      5: ["Uncanny Dodge"],
      6: ["Expertise (2 more skills)"],
      7: ["Evasion", "Reliable Talent"],
      8: ["Ability Score Improvement"],
      9: ["Subclass Feature"],
      10: ["Ability Score Improvement"]
    },
    mechanics: {
      /**
       * SRD 5.2 § Rogue § Sneak Attack. Once per turn, when the
       * Rogue hits a creature with a Finesse or Ranged weapon and
       * either (a) has Advantage on the attack roll, or (b) has an
       * ally of the target within 5 ft, they may add extra dice of
       * the same damage type as the weapon: `⌈level / 2⌉ d6`.
       *
       * Inputs (via `args`):
       *   - `attackHadAdvantage` — boolean from the attack result
       *   - `allyAdjacent` — boolean, host-derived from positioning
       *   - `weaponFinesse` — boolean, from the weapon record
       *   - `weaponRanged` — boolean, from the weapon record
       *
       * Returns either:
       *   `{ triggers: true, damageDice, damageType, actor }` — the
       *     damage rider for the host to roll alongside the weapon's
       *     base damage; the new actor carries `sneakAttackUsedThisTurn:
       *     true` so a second attack in the same turn no-ops.
       *   `{ triggers: false, reason }` — debuggable string for the UI.
       *
       * The "once per turn" gate uses a boolean flag rather than a
       * resource counter because it resets on turn end (encounter
       * loop concern), not on a rest.
       */
      sneakAttack: (actor, args = {}) => {
        const level = actor.level ?? 1;
        const diceCount = Math.ceil(level / 2);
        if (actor.sneakAttackUsedThisTurn) {
          return { triggers: false, reason: "already used this turn" };
        }
        const weaponEligible = args.weaponFinesse === true || args.weaponRanged === true;
        if (!weaponEligible) {
          return { triggers: false, reason: "weapon must be Finesse or Ranged" };
        }
        const positionEligible = args.attackHadAdvantage === true || args.allyAdjacent === true;
        if (!positionEligible) {
          return { triggers: false, reason: "requires Advantage or an adjacent ally" };
        }
        return {
          triggers: true,
          damageDice: `${diceCount}d6`,
          damageType: args.damageType ?? "precision",
          actor: { ...actor, sneakAttackUsedThisTurn: true }
        };
      },
      /**
       * Clear the once-per-turn Sneak Attack flag. The host calls
       * this on `endTurn` so the next turn re-enables Sneak Attack.
       * Kept as a class mechanic (rather than a top-level helper) so
       * the contract surface stays uniform — every per-turn class
       * feature in future sub-releases will follow the same pattern.
       */
      endTurn: (actor) => {
        if (!actor.sneakAttackUsedThisTurn) return { actor };
        const { sneakAttackUsedThisTurn: _, ...rest } = actor;
        return { actor: rest };
      }
    }
  };

  // vendor/bag-of-holding/src/classes/cleric.js
  function channelDivinityUsesForLevel(level) {
    if (level >= 18) return 4;
    if (level >= 6) return 3;
    if (level >= 2) return 2;
    return 0;
  }
  function channelDivinityDC(actor) {
    const proficiencyBonus = actor.proficiencyBonus ?? 2;
    const wisMod = modFromScore(actor.abilityScores?.wis ?? 10);
    return 8 + proficiencyBonus + wisMod;
  }
  var cleric_default = {
    id: "cleric",
    name: "Cleric",
    hitDie: 8,
    primaryAbility: "wis",
    savingThrowProficiencies: ["wis", "cha"],
    spellcasting: { ability: "wis", cantripsKnown: { 1: 3, 4: 4, 10: 5 }, progression: "full", preparation: "prepared" },
    subclasses: {
      "life-domain": {
        id: "life-domain",
        name: "Life Domain",
        features: {
          3: ["Disciple of Life", "Preserve Life"]
        }
      }
    },
    features: {
      1: ["Spellcasting", "Divine Domain"],
      2: ["Channel Divinity"],
      3: [],
      4: ["Ability Score Improvement"],
      5: ["Destroy Undead (CR 1/2)"],
      6: ["Channel Divinity (3 uses)", "Subclass Feature"],
      7: ["Blessed Strikes"],
      8: ["Ability Score Improvement"],
      9: [],
      10: ["Divine Intervention"]
    },
    // Resource-bearing features (since 1.3.3). Channel Divinity in
    // 2024 SRD: full refresh on Long Rest, one use back on Short Rest.
    resources: {
      channelDivinity: {
        max: (level) => channelDivinityUsesForLevel(level),
        refreshes: "long",
        shortRestRecovery: 1
      }
    },
    mechanics: {
      /**
       * SRD 5.2 § Cleric — Channel Divinity: Divine Spark. Spend a
       * Channel Divinity use, point your holy symbol at a creature
       * within 30 ft, roll 1d8 + WIS mod, then either:
       *   - mode: 'heal'   — restore that many HP to the target
       *   - mode: 'damage' — target makes a CON save vs the Cleric's
       *                     spell save DC; failure = full, success =
       *                     half. Damage type chosen by the caster
       *                     between necrotic and radiant.
       *
       * The engine resolves the die + DC; the host applies the heal
       * or damage to the chosen target and rolls the save itself.
       */
      divineSpark: (actor, args = {}, ctx) => {
        const result = spendResource(actor, "channelDivinity");
        if (!result.ok) return result;
        const wisMod = modFromScore(actor.abilityScores?.wis ?? 10);
        const die = ctx.rollDie(8, ctx.rng);
        const value = die + wisMod;
        const mode = args.mode === "damage" ? "damage" : "heal";
        if (mode === "heal") {
          return { ok: true, mode, die, value, actor: result.actor };
        }
        const damageType = args.damageType === "necrotic" ? "necrotic" : "radiant";
        return {
          ok: true,
          mode,
          die,
          value,
          save: { ability: "con", dc: channelDivinityDC(actor) },
          damageType,
          halfOnSuccess: true,
          actor: result.actor
        };
      },
      /**
       * SRD 5.2 § Cleric — Channel Divinity: Turn Undead. Spend a
       * Channel Divinity use, every Undead within 30 ft must make a
       * WIS save vs the Cleric's spell save DC. On failure: Frightened
       * + Incapacitated for 1 minute (or until the creature takes any
       * damage). The host iterates targets and rolls saves; the engine
       * surfaces the DC and the on-fail effect.
       */
      turnUndead: (actor, _args, _ctx) => {
        const result = spendResource(actor, "channelDivinity");
        if (!result.ok) return result;
        return {
          ok: true,
          save: { ability: "wis", dc: channelDivinityDC(actor) },
          onFail: {
            conditions: ["frightened", "incapacitated"],
            duration: "1 minute",
            endsOnDamage: true
          },
          rangeFt: 30,
          actor: result.actor
        };
      },
      /**
       * Read-only: the current Channel Divinity DC. For UI chip
       * tooltips and AI-narrator "the DC is N" prose without
       * dispatching a full Channel Divinity action.
       */
      channelDivinityDC: (actor) => ({ dc: channelDivinityDC(actor) })
    }
  };

  // vendor/bag-of-holding/src/classes/wizard.js
  function arcaneRecoveryCapForLevel(level) {
    return Math.ceil((level ?? 1) / 2);
  }
  var ARCANE_RECOVERY_MAX_SLOT_LEVEL = 5;
  var wizard_default = {
    id: "wizard",
    name: "Wizard",
    hitDie: 6,
    primaryAbility: "int",
    savingThrowProficiencies: ["int", "wis"],
    spellcasting: { ability: "int", cantripsKnown: { 1: 3, 4: 4, 10: 5 }, progression: "full", preparation: "prepared" },
    subclasses: {
      "evoker": {
        id: "evoker",
        name: "Evoker",
        features: {
          3: ["Evocation Savant", "Sculpt Spells"]
        }
      }
    },
    features: {
      1: ["Spellcasting", "Arcane Recovery"],
      2: ["Arcane Tradition"],
      3: [],
      4: ["Ability Score Improvement"],
      5: [],
      6: ["Subclass Feature"],
      7: [],
      8: ["Ability Score Improvement"],
      9: [],
      10: ["Subclass Feature"]
    },
    // Resource-bearing features (since 1.3.10). Arcane Recovery is one
    // use per Long Rest — the use itself refunds slot levels.
    resources: {
      arcaneRecovery: {
        max: 1,
        refreshes: "long"
      }
    },
    mechanics: {
      /**
       * SRD 5.2 § Wizard — Arcane Recovery. Once per Long Rest, on a
       * Short Rest, recover spent spell slot levels whose combined
       * sum is at most ⌈Wizard level / 2⌉. No individual slot may
       * be 6th level or higher.
       *
       * `args.slotLevels: number[]` — the slot levels to recover (one
       * entry per slot, repeated for multiples). Example: `[1, 1]`
       * recovers two L1 slots (combined sum 2); `[2]` recovers a
       * single L2 (combined sum 2).
       *
       * Validates: per-slot cap, combined-sum cap, availability of
       * each requested slot in the actor's spent pool, and one-use-
       * per-Long-Rest. Refuses cleanly on any failure with no state
       * mutation.
       */
      arcaneRecovery: (actor, args = {}, _ctx) => {
        const slotLevels = args.slotLevels;
        if (!Array.isArray(slotLevels) || slotLevels.length === 0) {
          return { ok: false, reason: "args.slotLevels must be a non-empty array of slot levels" };
        }
        for (const lvl of slotLevels) {
          if (!Number.isInteger(lvl) || lvl < 1) {
            return { ok: false, reason: "each slot level must be a positive integer" };
          }
          if (lvl > ARCANE_RECOVERY_MAX_SLOT_LEVEL) {
            return {
              ok: false,
              reason: `Arcane Recovery cannot recover slots above level ${ARCANE_RECOVERY_MAX_SLOT_LEVEL}`
            };
          }
        }
        const sum = slotLevels.reduce((a, b) => a + b, 0);
        const level = actor.level ?? 1;
        const cap = arcaneRecoveryCapForLevel(level);
        if (sum > cap) {
          return {
            ok: false,
            reason: `combined slot levels ${sum} exceed Arcane Recovery cap ${cap}`
          };
        }
        if (!Array.isArray(actor.spellSlots)) {
          return { ok: false, reason: "actor has no spellSlots to recover" };
        }
        const need = /* @__PURE__ */ new Map();
        for (const lvl of slotLevels) need.set(lvl, (need.get(lvl) ?? 0) + 1);
        const nextSlots = actor.spellSlots.map((s) => ({ ...s }));
        for (const [lvl, count] of need.entries()) {
          let toRecover = count;
          for (const s of nextSlots) {
            if (s.level === lvl && s.used > 0 && toRecover > 0) {
              const recoverable = Math.min(toRecover, s.used);
              s.used -= recoverable;
              toRecover -= recoverable;
            }
          }
          if (toRecover > 0) {
            return {
              ok: false,
              reason: `not enough spent level-${lvl} slots to recover ${count}`
            };
          }
        }
        const useResult = spendResource(actor, "arcaneRecovery");
        if (!useResult.ok) return useResult;
        return {
          ok: true,
          recovered: slotLevels.slice(),
          combinedLevels: sum,
          actor: { ...useResult.actor, spellSlots: nextSlots }
        };
      },
      /**
       * Read-only: Arcane Recovery status for UI affordances. Reports
       * whether the feature is available right now (not yet used this
       * Long Rest cycle) and the recoverable-level cap at this level.
       */
      arcaneRecoveryStatus: (actor) => {
        const r = actor.resources?.arcaneRecovery;
        const level = actor.level ?? 1;
        return {
          available: Boolean(r && r.used < r.max),
          cap: arcaneRecoveryCapForLevel(level)
        };
      }
    }
  };

  // vendor/bag-of-holding/src/classes/barbarian.js
  var RAGES_BY_LEVEL = Object.freeze({
    1: 2,
    2: 2,
    3: 3,
    4: 3,
    5: 3,
    6: 4,
    7: 4,
    8: 4,
    9: 4,
    10: 4,
    11: 4,
    12: 5,
    13: 5,
    14: 5,
    15: 5,
    16: 5,
    17: 6,
    18: 6,
    19: 6,
    20: 999
  });
  function rageDamageForLevel(level) {
    if (level >= 16) return 4;
    if (level >= 9) return 3;
    return 2;
  }
  var RAGE_MAX_ROUNDS = 100;
  var RAGE_RESISTANCES = Object.freeze(["bludgeoning", "piercing", "slashing"]);
  var barbarian_default = {
    id: "barbarian",
    name: "Barbarian",
    hitDie: 12,
    primaryAbility: "str",
    savingThrowProficiencies: ["str", "con"],
    weaponMasterySlots: 2,
    extraAttacks: { 5: 1 },
    subclasses: {
      berserker: {
        id: "berserker",
        name: "Path of the Berserker",
        features: {
          3: ["Frenzy"]
        }
      }
    },
    features: {
      1: ["Rage", "Unarmored Defense"],
      2: ["Reckless Attack", "Danger Sense"],
      3: ["Primal Path"],
      4: ["Ability Score Improvement"],
      5: ["Extra Attack", "Fast Movement"],
      6: ["Subclass Feature"],
      7: ["Feral Instinct", "Instinctive Pounce"],
      8: ["Ability Score Improvement"],
      9: ["Brutal Strike"],
      10: ["Subclass Feature"]
    },
    // Resource-bearing features (since 1.3.1). Rage refreshes on Long
    // Rest with one use recovered on Short Rest per SRD 5.2 § Barbarian
    // — Rage; the partial-recovery field is honoured by
    // `Mechanics.refreshResources` (see src/mechanics.js).
    resources: {
      rage: {
        max: (level) => RAGES_BY_LEVEL[level] ?? 6,
        refreshes: "long",
        shortRestRecovery: 1
      }
    },
    mechanics: {
      /**
       * SRD 5.2 § Barbarian — Rage: as a Bonus Action, enter Rage.
       * Sets `actor.rage` to a state record the host queries while
       * resolving STR weapon attacks, STR checks/saves, and incoming
       * BPS damage. Returns either `{ ok: true, damageBonus, actor }`
       * or `{ ok: false, reason }`.
       *
       * Raging on an already-raging actor is a host bug — surfaces as
       * `{ ok: false, reason }` rather than a throw so the UI can
       * surface the affordance gracefully.
       */
      rage: (actor, _args, _ctx) => {
        if (actor.rage?.active) {
          return { ok: false, reason: "already raging" };
        }
        const result = spendResource(actor, "rage");
        if (!result.ok) return result;
        const level = actor.level ?? 1;
        const damageBonus = rageDamageForLevel(level);
        return {
          ok: true,
          damageBonus,
          actor: {
            ...result.actor,
            rage: {
              active: true,
              roundsRemaining: RAGE_MAX_ROUNDS,
              damageBonus,
              resistances: [...RAGE_RESISTANCES]
            }
          }
        };
      },
      /**
       * End Rage early (Bonus Action per SRD). Clears `actor.rage`.
       * `{ ok: false, reason }` when the actor wasn't raging — same
       * "host should have gated the chip" semantics as `rage()`.
       */
      endRage: (actor) => {
        if (!actor.rage?.active) {
          return { ok: false, reason: "not raging" };
        }
        const { rage: _, ...rest } = actor;
        return { ok: true, actor: rest };
      },
      /**
       * Read-only: the bonus damage the Barbarian adds to a STR
       * weapon attack right now. Returns 0 if not raging. The host
       * calls this when computing each STR-based weapon damage roll
       * and adds the result to the modifier.
       */
      rageDamageBonus: (actor) => {
        if (!actor.rage?.active) return { bonus: 0 };
        return { bonus: actor.rage.damageBonus };
      },
      /**
       * Read-only: is the actor currently raging? Boolean result for
       * chip-state and UI affordances.
       */
      isRaging: (actor) => ({ raging: Boolean(actor.rage?.active) })
    }
  };

  // vendor/bag-of-holding/src/classes/bard.js
  function bardicInspirationDieSize(level) {
    if (level >= 15) return 12;
    if (level >= 10) return 10;
    if (level >= 5) return 8;
    return 6;
  }
  function bardicInspirationUses(chaScore) {
    return Math.max(1, modFromScore(chaScore ?? 10));
  }
  var bard_default = {
    id: "bard",
    name: "Bard",
    hitDie: 8,
    primaryAbility: "cha",
    savingThrowProficiencies: ["dex", "cha"],
    spellcasting: {
      ability: "cha",
      cantripsKnown: { 1: 2, 4: 3 },
      progression: "full",
      preparation: "known"
    },
    subclasses: {
      "college-of-lore": {
        id: "college-of-lore",
        name: "College of Lore",
        features: {
          3: ["Bonus Proficiencies", "Cutting Words"]
        }
      }
    },
    features: {
      1: ["Bardic Inspiration", "Spellcasting"],
      2: ["Expertise", "Jack of All Trades"],
      3: ["Bard College"],
      4: ["Ability Score Improvement"],
      5: ["Font of Inspiration"],
      6: ["Subclass Feature"],
      7: [],
      8: ["Ability Score Improvement"],
      9: ["Expertise (2 more skills)"],
      10: ["Magical Secrets"]
    },
    // Resource-bearing features (since 1.3.2). Uses = CHA mod (min 1);
    // refresh tag flips from 'long' to 'short' at L5 per Font of
    // Inspiration. `freshResources` evaluates both fields against the
    // actor at provisioning time, so re-running `freshResources` on
    // level-up correctly rebuilds the counter with the new refresh
    // contract.
    resources: {
      bardicInspiration: {
        max: (_level, actor) => bardicInspirationUses(actor?.abilityScores?.cha),
        refreshes: (level) => level >= 5 ? "short" : "long"
      }
    },
    mechanics: {
      /**
       * SRD 5.2 § Bard — Bardic Inspiration: as a Bonus Action,
       * inspire a creature within 60 ft that can see or hear you.
       * Spends one use, returns the die spec for the target to roll
       * later (within the next hour, once per failed D20 Test).
       *
       * The engine doesn't track *which* creature holds the die — that
       * binding lives on the host as `target.bardicInspirationDie`
       * (or wherever the host stores it). The mechanic just reports
       * what die was conferred.
       */
      bardicInspiration: (actor, _args, _ctx) => {
        const result = spendResource(actor, "bardicInspiration");
        if (!result.ok) return result;
        const level = actor.level ?? 1;
        const dieSize = bardicInspirationDieSize(level);
        return {
          ok: true,
          die: `1d${dieSize}`,
          dieSize,
          actor: result.actor
        };
      },
      /**
       * SRD 5.2 § Bard — Font of Inspiration (L5): "you can expend a
       * spell slot (no action required) to regain one expended use of
       * Bardic Inspiration". Refunds a use, consumes a slot of the
       * level passed in `args.slotLevel`.
       *
       * Refuses (no state mutation) when:
       *   - Bard is below level 5
       *   - `args.slotLevel` is missing or invalid
       *   - the actor has no spell slots
       *   - no slot of the requested level is available
       *   - BI is already at full uses
       */
      fontOfInspiration: (actor, args = {}, _ctx) => {
        const level = actor.level ?? 1;
        if (level < 5) {
          return { ok: false, reason: "requires Bard level 5 (Font of Inspiration)" };
        }
        const slotLevel = args.slotLevel;
        if (!Number.isInteger(slotLevel) || slotLevel < 1) {
          return { ok: false, reason: "args.slotLevel must be a positive integer" };
        }
        if (!Array.isArray(actor.spellSlots)) {
          return { ok: false, reason: "actor has no spellSlots" };
        }
        const slotIdx = actor.spellSlots.findIndex(
          (s) => s.level === slotLevel && s.used < s.max
        );
        if (slotIdx === -1) {
          return { ok: false, reason: `no spell slot of level ${slotLevel} available` };
        }
        const r = actor.resources?.bardicInspiration;
        if (!r) return { ok: false, reason: "no bardicInspiration resource" };
        if (r.used === 0) {
          return { ok: false, reason: "bardicInspiration already at full" };
        }
        const nextSlots = actor.spellSlots.slice();
        nextSlots[slotIdx] = { ...nextSlots[slotIdx], used: nextSlots[slotIdx].used + 1 };
        return {
          ok: true,
          actor: {
            ...actor,
            spellSlots: nextSlots,
            resources: {
              ...actor.resources,
              bardicInspiration: { ...r, used: r.used - 1 }
            }
          }
        };
      },
      /**
       * Read-only: the die size the Bard is currently conferring.
       * Returns `{ dieSize, die }` for chip-state and UI affordances.
       */
      inspirationDie: (actor) => {
        const level = actor.level ?? 1;
        const dieSize = bardicInspirationDieSize(level);
        return { dieSize, die: `1d${dieSize}` };
      }
    }
  };

  // vendor/bag-of-holding/src/classes/druid.js
  function wildShapeUsesForLevel(level) {
    if (level < 2) return 0;
    return 2;
  }
  function wildShapeMaxCR(level) {
    if (level >= 8) return 1;
    if (level >= 4) return 0.5;
    if (level >= 2) return 0.25;
    return 0;
  }
  function wildShapeKnownForms(level) {
    if (level >= 8) return 8;
    if (level >= 4) return 6;
    if (level >= 2) return 4;
    return 0;
  }
  function wildShapeAllowedMovement(level) {
    return {
      swim: level >= 4,
      fly: level >= 8
    };
  }
  var druid_default = {
    id: "druid",
    name: "Druid",
    hitDie: 8,
    primaryAbility: "wis",
    savingThrowProficiencies: ["int", "wis"],
    spellcasting: {
      ability: "wis",
      cantripsKnown: { 1: 2, 4: 3 },
      progression: "full",
      preparation: "prepared"
    },
    subclasses: {
      "circle-of-the-land": {
        id: "circle-of-the-land",
        name: "Circle of the Land",
        features: {
          2: ["Cantrip", "Land Stride"],
          3: ["Circle Spells"]
        }
      }
    },
    features: {
      1: ["Druidic", "Spellcasting"],
      2: ["Wild Shape", "Druid Circle"],
      3: [],
      4: ["Ability Score Improvement"],
      5: [],
      6: ["Subclass Feature"],
      7: ["Elemental Fury"],
      8: ["Ability Score Improvement"],
      9: [],
      10: ["Subclass Feature"]
    },
    // Resource-bearing features (since 1.3.4). Wild Shape refreshes
    // fully on Long Rest with one use back on Short Rest per SRD 5.2.
    resources: {
      wildShape: {
        max: (level) => wildShapeUsesForLevel(level),
        refreshes: "long",
        shortRestRecovery: 1
      }
    },
    mechanics: {
      /**
       * SRD 5.2 § Druid — Wild Shape. Spend a use to transform into a
       * Beast form the Druid knows. The engine validates the CR cap
       * and movement-mode restrictions, spends the resource, and
       * stamps `actor.wildShape` with the form metadata. The host
       * handles the stat overlay (HP, AC, attacks come from the beast
       * record) — the engine doesn't muddle character-sheet derivation
       * with morph state.
       *
       * `args.beast` is the host's beast record:
       *   `{ id, cr, speeds?: { walk?, swim?, fly?, climb?, burrow? } }`
       *
       * Returns `{ ok: false, reason }` for:
       *   - already wild-shaped
       *   - missing beast
       *   - beast.cr > wildShapeMaxCR(level)
       *   - beast has swim/fly speed and the Druid hasn't unlocked it
       *   - no Wild Shape uses remaining
       */
      wildShape: (actor, args = {}, _ctx) => {
        if (actor.wildShape?.active) {
          return { ok: false, reason: "already wild-shaped" };
        }
        const beast = args.beast;
        if (!beast || typeof beast !== "object") {
          return { ok: false, reason: "args.beast must be a beast record" };
        }
        const level = actor.level ?? 1;
        const maxCR = wildShapeMaxCR(level);
        const beastCR = beast.cr ?? 0;
        if (beastCR > maxCR) {
          return { ok: false, reason: `beast CR ${beastCR} exceeds your max CR ${maxCR}` };
        }
        const movement = wildShapeAllowedMovement(level);
        const speeds = beast.speeds ?? {};
        if (!movement.swim && (speeds.swim ?? 0) > 0) {
          return { ok: false, reason: "cannot Wild Shape into a swimming Beast below L4" };
        }
        if (!movement.fly && (speeds.fly ?? 0) > 0) {
          return { ok: false, reason: "cannot Wild Shape into a flying Beast below L8" };
        }
        const result = spendResource(actor, "wildShape");
        if (!result.ok) return result;
        return {
          ok: true,
          actor: {
            ...result.actor,
            wildShape: {
              active: true,
              beastId: beast.id,
              cr: beastCR
            }
          }
        };
      },
      /**
       * SRD 5.2 § Druid — Wild Shape: revert as a Bonus Action. Clears
       * `actor.wildShape`; doesn't refund the spent use. Refuses when
       * the actor wasn't currently in a Wild Shape form.
       */
      revertWildShape: (actor) => {
        if (!actor.wildShape?.active) {
          return { ok: false, reason: "not wild-shaped" };
        }
        const { wildShape: _, ...rest } = actor;
        return { ok: true, actor: rest };
      },
      /**
       * Read-only: caps + allowed movement at the Druid's current
       * level. UI affordances and chip tooltips read this to filter
       * the beast picker without dispatching a full transform.
       */
      wildShapeCaps: (actor) => {
        const level = actor.level ?? 1;
        return {
          maxCR: wildShapeMaxCR(level),
          knownForms: wildShapeKnownForms(level),
          allowedMovement: wildShapeAllowedMovement(level)
        };
      }
    }
  };

  // vendor/bag-of-holding/src/classes/monk.js
  function focusPointsForLevel(level) {
    if (level < 2) return 0;
    return level;
  }
  function martialArtsDieSize(level) {
    if (level >= 17) return 12;
    if (level >= 11) return 10;
    if (level >= 5) return 8;
    return 6;
  }
  function flurryStrikeCount(level) {
    return level >= 10 ? 3 : 2;
  }
  var monk_default = {
    id: "monk",
    name: "Monk",
    hitDie: 8,
    primaryAbility: "dex",
    savingThrowProficiencies: ["str", "dex"],
    extraAttacks: { 5: 1 },
    subclasses: {
      "open-hand": {
        id: "open-hand",
        name: "Warrior of the Open Hand",
        features: {
          3: ["Open Hand Technique"]
        }
      }
    },
    features: {
      1: ["Unarmored Defense", "Martial Arts"],
      2: ["Monk's Focus", "Unarmored Movement"],
      3: ["Monastic Tradition", "Deflect Attacks"],
      4: ["Ability Score Improvement"],
      5: ["Extra Attack", "Stunning Strike"],
      6: ["Empowered Strikes", "Subclass Feature"],
      7: ["Evasion"],
      8: ["Ability Score Improvement"],
      9: ["Acrobatic Movement"],
      10: ["Heightened Focus"]
    },
    // Resource-bearing features (since 1.3.5). Focus Points refresh
    // fully on a Short Rest — the canonical short-rest resource.
    resources: {
      focusPoints: {
        max: (level) => focusPointsForLevel(level),
        refreshes: "short"
      }
    },
    mechanics: {
      /**
       * Spend `amount` Focus Points without any further effect. Useful
       * for subclass features that consume points outside the three
       * default Focus options. Defaults to 1 point.
       */
      spendFocusPoints: (actor, args = {}, _ctx) => {
        const amount = args.amount ?? 1;
        return spendResource(actor, "focusPoints", amount);
      },
      /**
       * SRD 5.2 § Monk — Flurry of Blows: 1 Focus Point as a Bonus
       * Action, make two Unarmed Strikes (three at L10+ via Heightened
       * Focus). Returns `{ ok, strikes, actor }`. The host resolves
       * each unarmed strike through its normal attack flow; the engine
       * just reports the count.
       */
      flurryOfBlows: (actor, _args, _ctx) => {
        const result = spendResource(actor, "focusPoints");
        if (!result.ok) return result;
        const level = actor.level ?? 1;
        return {
          ok: true,
          strikes: flurryStrikeCount(level),
          actor: result.actor
        };
      },
      /**
       * SRD 5.2 § Monk — Patient Defense.
       *   - `args.spendFp: false` — free Disengage as a Bonus Action.
       *   - `args.spendFp: true` (default) — 1 Focus Point: Disengage +
       *     Dodge as a Bonus Action, plus 2 rolls of the Martial Arts
       *     die in Temporary HP.
       *
       * Returns `{ ok, actions, tempHp?, actor }`. The host applies the
       * Disengage + Dodge state and grants the tempHp; the engine
       * resolves the dice and the resource.
       */
      patientDefense: (actor, args = {}, ctx) => {
        const spendFp = args.spendFp !== false;
        if (!spendFp) {
          return { ok: true, actions: ["disengage"], actor };
        }
        const result = spendResource(actor, "focusPoints");
        if (!result.ok) return result;
        const level = actor.level ?? 1;
        const die = martialArtsDieSize(level);
        const a = ctx.rollDie(die, ctx.rng);
        const b = ctx.rollDie(die, ctx.rng);
        return {
          ok: true,
          actions: ["disengage", "dodge"],
          tempHp: a + b,
          rolls: [a, b],
          actor: result.actor
        };
      },
      /**
       * SRD 5.2 § Monk — Step of the Wind.
       *   - `args.spendFp: false` — free Dash as a Bonus Action.
       *   - `args.spendFp: true` (default) — 1 Focus Point: Disengage +
       *     Dash as a Bonus Action, jump distance doubled for the
       *     turn, and may move one willing Large-or-smaller ally
       *     within 5 ft along without provoking opportunity attacks.
       */
      stepOfTheWind: (actor, args = {}, _ctx) => {
        const spendFp = args.spendFp !== false;
        if (!spendFp) {
          return { ok: true, actions: ["dash"], actor };
        }
        const result = spendResource(actor, "focusPoints");
        if (!result.ok) return result;
        return {
          ok: true,
          actions: ["disengage", "dash"],
          doubledJump: true,
          canCarryAlly: true,
          actor: result.actor
        };
      },
      /**
       * Read-only: current Martial Arts die spec for chip tooltips
       * and the bonus-action Martial Arts attack.
       */
      martialArtsDie: (actor) => {
        const level = actor.level ?? 1;
        const size = martialArtsDieSize(level);
        return { dieSize: size, die: `1d${size}` };
      }
    }
  };

  // vendor/bag-of-holding/src/classes/paladin.js
  function layOnHandsPoolForLevel(level) {
    if (level < 1) return 0;
    return 5 * level;
  }
  function divineSmiteDice(slotLevel) {
    if (!Number.isInteger(slotLevel) || slotLevel < 1) return 0;
    return 2 + (slotLevel - 1);
  }
  var paladin_default = {
    id: "paladin",
    name: "Paladin",
    hitDie: 10,
    primaryAbility: "cha",
    savingThrowProficiencies: ["wis", "cha"],
    extraAttacks: { 5: 1 },
    spellcasting: {
      ability: "cha",
      progression: "half",
      preparation: "prepared"
    },
    subclasses: {
      "oath-of-devotion": {
        id: "oath-of-devotion",
        name: "Oath of Devotion",
        features: {
          3: ["Oath Spells", "Channel Divinity: Sacred Weapon"]
        }
      }
    },
    features: {
      1: ["Lay on Hands", "Spellcasting"],
      2: ["Fighting Style", "Divine Smite", "Channel Divinity"],
      3: ["Sacred Oath"],
      4: ["Ability Score Improvement"],
      5: ["Extra Attack", "Faithful Steed"],
      6: ["Aura of Protection"],
      7: ["Subclass Feature"],
      8: ["Ability Score Improvement"],
      9: ["Abjure Foes"],
      10: ["Aura of Courage"]
    },
    // Resource-bearing features (since 1.3.6). Lay on Hands is an HP
    // pool sized to 5 × level; Divine Smite Once gives one free Smite
    // cast per Long Rest (the 2024 SRD change). Both refresh on Long
    // Rest only — Short Rest leaves them alone.
    resources: {
      layOnHands: {
        max: (level) => layOnHandsPoolForLevel(level),
        refreshes: "long"
      },
      divineSmiteOnce: {
        max: (level) => level >= 2 ? 1 : 0,
        refreshes: "long"
      }
    },
    mechanics: {
      /**
       * SRD 5.2 § Paladin — Lay on Hands. As a Bonus Action, touch a
       * creature and restore Hit Points from the pool, up to the
       * remaining amount in the pool. Returns `{ ok, healed, actor }`
       * — `healed` is the amount actually drawn (capped by the
       * remaining pool).
       *
       * `args.amount` is the HP the host wants to draw. Must be a
       * positive integer. The function never silently over-draws — a
       * caller asking for more than the pool has left gets `ok: false`.
       */
      layOnHands: (actor, args = {}, _ctx) => {
        const amount = args.amount;
        if (!Number.isInteger(amount) || amount < 1) {
          return { ok: false, reason: "args.amount must be a positive integer" };
        }
        const result = spendResource(actor, "layOnHands", amount);
        if (!result.ok) return result;
        return { ok: true, healed: amount, actor: result.actor };
      },
      /**
       * SRD 5.2 § Paladin — Divine Smite. As a Bonus Action immediately
       * after hitting with an attack, cast the Divine Smite spell on
       * the target.
       *
       * `args.slotLevel`              — slot to consume (1–5).
       * `args.useFreeCast: true`      — consume the once-per-Long-Rest
       *                                 free cast instead of a slot.
       * `args.targetIsFiendOrUndead`  — adds the SRD's +1d8 vs Fiend / Undead.
       *
       * Either a slot consumption OR the free cast is required.
       * Returns `{ ok, dice, damageType, actor }`.
       */
      divineSmite: (actor, args = {}, _ctx) => {
        const level = actor.level ?? 1;
        if (level < 2) {
          return { ok: false, reason: "requires Paladin level 2 (Divine Smite)" };
        }
        const useFreeCast = args.useFreeCast === true;
        const slotLevel = args.slotLevel;
        const castLevel = useFreeCast ? 1 : slotLevel;
        if (useFreeCast) {
          const result = spendResource(actor, "divineSmiteOnce");
          if (!result.ok) return result;
          actor = result.actor;
        } else {
          if (!Number.isInteger(slotLevel) || slotLevel < 1) {
            return { ok: false, reason: "args.slotLevel (1+) or args.useFreeCast required" };
          }
          if (!Array.isArray(actor.spellSlots)) {
            return { ok: false, reason: "actor has no spellSlots" };
          }
          const slotIdx = actor.spellSlots.findIndex(
            (s) => s.level === slotLevel && s.used < s.max
          );
          if (slotIdx === -1) {
            return { ok: false, reason: `no spell slot of level ${slotLevel} available` };
          }
          const nextSlots = actor.spellSlots.slice();
          nextSlots[slotIdx] = { ...nextSlots[slotIdx], used: nextSlots[slotIdx].used + 1 };
          actor = { ...actor, spellSlots: nextSlots };
        }
        let dice = divineSmiteDice(castLevel);
        if (args.targetIsFiendOrUndead === true) dice += 1;
        return {
          ok: true,
          dice,
          damageDice: `${dice}d8`,
          damageType: "radiant",
          castLevel,
          usedFreeCast: useFreeCast,
          actor
        };
      },
      /**
       * Read-only: current Lay on Hands pool snapshot for UI
       * affordances. Returns `{ remaining, max }`.
       */
      layOnHandsPool: (actor) => {
        const pool = actor.resources?.layOnHands;
        if (!pool) return { remaining: 0, max: 0 };
        return { remaining: pool.max - pool.used, max: pool.max };
      }
    }
  };

  // vendor/bag-of-holding/src/classes/ranger.js
  function huntersMarkFreeCastsForLevel(level) {
    if (level >= 17) return 6;
    if (level >= 13) return 5;
    if (level >= 9) return 4;
    if (level >= 5) return 3;
    return 2;
  }
  var ranger_default = {
    id: "ranger",
    name: "Ranger",
    hitDie: 10,
    primaryAbility: "dex",
    savingThrowProficiencies: ["str", "dex"],
    extraAttacks: { 5: 1 },
    spellcasting: {
      ability: "wis",
      progression: "half",
      preparation: "prepared"
    },
    subclasses: {
      "hunter": {
        id: "hunter",
        name: "Hunter",
        features: {
          3: ["Hunter's Lore", "Hunter's Prey"]
        }
      }
    },
    features: {
      1: ["Favored Enemy", "Spellcasting"],
      2: ["Deft Explorer", "Fighting Style"],
      3: ["Ranger Subclass", "Primal Awareness"],
      4: ["Ability Score Improvement"],
      5: ["Extra Attack"],
      6: ["Roving"],
      7: ["Subclass Feature"],
      8: ["Ability Score Improvement"],
      9: ["Expertise"],
      10: ["Tireless"]
    },
    // Resource-bearing features (since 1.3.7). Free Hunter's Mark
    // casts refresh on Long Rest only.
    resources: {
      huntersMarkFree: {
        max: (level) => huntersMarkFreeCastsForLevel(level),
        refreshes: "long"
      }
    },
    mechanics: {
      /**
       * SRD 5.2 § Ranger — cast Hunter's Mark. Prefers a free cast
       * (Favored Enemy) when one is available; falls back to a spell
       * slot of at least `args.slotLevel` (default 1) otherwise.
       *
       * Set `args.useFreeCast: false` to force a slot consumption
       * regardless of free uses remaining — useful when the host
       * wants to upcast.
       *
       * Binds the target to `actor.huntersMark = { targetId, castLevel }`.
       * Hunter's Mark is a Concentration spell in the 2024 SRD; the
       * host owns the concentration record (or the 1.5 concentration
       * auto-bind will, once it lands).
       */
      castHuntersMark: (actor, args = {}, _ctx) => {
        const targetId = args.targetId;
        if (typeof targetId !== "string" || targetId.length === 0) {
          return { ok: false, reason: "args.targetId required" };
        }
        const allowFree = args.useFreeCast !== false;
        if (allowFree) {
          const r = actor.resources?.huntersMarkFree;
          if (r && r.used < r.max) {
            const result = spendResource(actor, "huntersMarkFree");
            return {
              ok: true,
              usedFreeCast: true,
              castLevel: 1,
              actor: { ...result.actor, huntersMark: { targetId, castLevel: 1 } }
            };
          }
        }
        const slotLevel = args.slotLevel ?? 1;
        if (!Number.isInteger(slotLevel) || slotLevel < 1) {
          return { ok: false, reason: "args.slotLevel must be a positive integer" };
        }
        if (!Array.isArray(actor.spellSlots)) {
          return { ok: false, reason: "no free casts available and no spellSlots on the actor" };
        }
        const slotIdx = actor.spellSlots.findIndex(
          (s) => s.level >= slotLevel && s.used < s.max
        );
        if (slotIdx === -1) {
          return { ok: false, reason: `no slot of level ${slotLevel} or higher available` };
        }
        const chosenSlot = actor.spellSlots[slotIdx];
        const nextSlots = actor.spellSlots.slice();
        nextSlots[slotIdx] = { ...chosenSlot, used: chosenSlot.used + 1 };
        return {
          ok: true,
          usedFreeCast: false,
          castLevel: chosenSlot.level,
          actor: {
            ...actor,
            spellSlots: nextSlots,
            huntersMark: { targetId, castLevel: chosenSlot.level }
          }
        };
      },
      /**
       * End an active Hunter's Mark (concentration drop, target dies,
       * Ranger chooses to dispel). Refuses when no Hunter's Mark is
       * active.
       */
      endHuntersMark: (actor) => {
        if (!actor.huntersMark) {
          return { ok: false, reason: "no active Hunters Mark" };
        }
        const { huntersMark: _, ...rest } = actor;
        return { ok: true, actor: rest };
      },
      /**
       * Compute the Hunter's Mark damage rider for an attack against a
       * target. Returns either:
       *   `{ triggers: true, damageDice: '1d6', damageType: 'force' }`
       *   `{ triggers: false, reason }`
       *
       * The host calls this when resolving each weapon attack and adds
       * the rider damage on hit. Hunter's Mark at higher slot levels
       * doesn't increase the damage dice in the 2024 spell — slot
       * level extends duration, not damage — so the rider stays 1d6.
       */
      huntersMarkDamage: (actor, args = {}, _ctx) => {
        if (!actor.huntersMark) {
          return { triggers: false, reason: "no active Hunters Mark" };
        }
        if (args.targetId !== actor.huntersMark.targetId) {
          return { triggers: false, reason: "attack is not against the marked target" };
        }
        return {
          triggers: true,
          damageDice: "1d6",
          damageType: "force"
        };
      },
      /**
       * Read-only: snapshot of the Favored Enemy free-cast pool for UI
       * affordances.
       */
      favoredEnemyStatus: (actor) => {
        const pool = actor.resources?.huntersMarkFree;
        if (!pool) return { remaining: 0, max: 0 };
        return { remaining: pool.max - pool.used, max: pool.max };
      }
    }
  };

  // vendor/bag-of-holding/src/classes/sorcerer.js
  function sorceryPointsForLevel(level) {
    if (level < 2) return 0;
    return level;
  }
  var SLOT_CREATION_COSTS = Object.freeze({
    1: 2,
    2: 3,
    3: 5,
    4: 6,
    5: 7
  });
  var METAMAGIC_OPTIONS = Object.freeze({
    careful: { cost: 1, effect: Object.freeze({ allyAutoPassesAoESave: true }) },
    distant: { cost: 1, effect: Object.freeze({ rangeMultiplier: 2, touchBecomesFt: 30 }) },
    empowered: { cost: 1, effect: Object.freeze({ rerollDamageDice: "chaMod" }) },
    extended: { cost: 1, effect: Object.freeze({ durationMultiplier: 2 }) },
    heightened: { cost: 2, effect: Object.freeze({ saveDisadvantage: true }) },
    quickened: { cost: 2, effect: Object.freeze({ castingTime: "bonus" }) },
    seeking: { cost: 1, effect: Object.freeze({ rerollAttack: true }) },
    subtle: { cost: 1, effect: Object.freeze({ removeComponents: ["v", "s"] }) },
    transmuted: { cost: 1, effect: Object.freeze({ changeDamageType: true }) },
    twinned: { cost: "slotLevel", effect: Object.freeze({ additionalTarget: 1 }) }
  });
  var sorcerer_default = {
    id: "sorcerer",
    name: "Sorcerer",
    hitDie: 6,
    primaryAbility: "cha",
    savingThrowProficiencies: ["con", "cha"],
    spellcasting: {
      ability: "cha",
      cantripsKnown: { 1: 4, 4: 5 },
      progression: "full",
      preparation: "known"
    },
    subclasses: {
      "draconic-sorcery": {
        id: "draconic-sorcery",
        name: "Draconic Sorcery",
        features: {
          1: ["Draconic Resilience", "Draconic Ancestry"],
          3: ["Elemental Affinity"]
        }
      }
    },
    features: {
      1: ["Spellcasting", "Innate Sorcery"],
      2: ["Font of Magic"],
      3: ["Metamagic"],
      4: ["Ability Score Improvement"],
      5: ["Sorcerous Restoration"],
      6: ["Subclass Feature"],
      7: [],
      8: ["Ability Score Improvement"],
      9: [],
      10: ["Metamagic (third option)"]
    },
    // Resource-bearing features (since 1.3.8). Sorcery Points refresh
    // on Long Rest only.
    resources: {
      sorceryPoints: {
        max: (level) => sorceryPointsForLevel(level),
        refreshes: "long"
      }
    },
    mechanics: {
      /**
       * SRD 5.2 § Sorcerer — Font of Magic: convert a spent spell slot
       * into Sorcery Points. The points gained equal the slot level
       * (capped at 5). `args.slotLevel` is required.
       *
       * "Spent" means the host has already consumed the slot; this
       * mechanic refunds nothing — it's the reverse: it takes an
       * *unspent* slot, marks it spent, and grants the points. (The
       * SRD wording: "you can transform unexpended Sorcery Points...
       * or a spell slot you have into one of the other".)
       */
      convertSlotToPoints: (actor, args = {}, _ctx) => {
        const slotLevel = args.slotLevel;
        if (!Number.isInteger(slotLevel) || slotLevel < 1 || slotLevel > 5) {
          return { ok: false, reason: "args.slotLevel must be an integer in [1, 5]" };
        }
        if (!Array.isArray(actor.spellSlots)) {
          return { ok: false, reason: "actor has no spellSlots" };
        }
        const slotIdx = actor.spellSlots.findIndex(
          (s) => s.level === slotLevel && s.used < s.max
        );
        if (slotIdx === -1) {
          return { ok: false, reason: `no spell slot of level ${slotLevel} available` };
        }
        const points = slotLevel;
        const pool = actor.resources?.sorceryPoints;
        if (!pool) return { ok: false, reason: "no sorceryPoints resource" };
        const newUsed = Math.max(0, pool.used - points);
        const nextSlots = actor.spellSlots.slice();
        nextSlots[slotIdx] = { ...nextSlots[slotIdx], used: nextSlots[slotIdx].used + 1 };
        return {
          ok: true,
          pointsGained: pool.used - newUsed,
          actor: {
            ...actor,
            spellSlots: nextSlots,
            resources: { ...actor.resources, sorceryPoints: { ...pool, used: newUsed } }
          }
        };
      },
      /**
       * SRD 5.2 § Sorcerer — Font of Magic: create a spell slot by
       * spending Sorcery Points. Slot level must be 1–5; the cost
       * comes from `SLOT_CREATION_COSTS`. The created slot is tagged
       * `temporary: true` so `Spellcasting.longRest` (which currently
       * just resets `used`) can identify it for removal on Long Rest
       * per the SRD ("the slot vanishes when you finish a Long Rest").
       *
       * Note: the existing `longRest` doesn't yet strip temporary
       * slots — that's a planned tightening, tracked under the
       * 1.6.0 turn-lifecycle + dawn-event work. For now the host can
       * read the `temporary` flag and filter at presentation time, or
       * (worst case) the slot survives the rest as a free use. This
       * is documented in `docs/srd-coverage.md` row 24.
       */
      createSpellSlot: (actor, args = {}, _ctx) => {
        const slotLevel = args.slotLevel;
        if (!Number.isInteger(slotLevel) || slotLevel < 1 || slotLevel > 5) {
          return { ok: false, reason: "args.slotLevel must be an integer in [1, 5]" };
        }
        const cost = SLOT_CREATION_COSTS[slotLevel];
        const result = spendResource(actor, "sorceryPoints", cost);
        if (!result.ok) return result;
        const existingSlots = Array.isArray(actor.spellSlots) ? actor.spellSlots : [];
        const newSlot = { level: slotLevel, used: 0, max: 1, temporary: true };
        return {
          ok: true,
          cost,
          slot: newSlot,
          actor: {
            ...result.actor,
            spellSlots: [...existingSlots, newSlot]
          }
        };
      },
      /**
       * SRD 5.2 § Sorcerer — Metamagic. Spend Sorcery Points to alter
       * a spell. `args.metamagic` keys into `METAMAGIC_OPTIONS`;
       * `args.slotLevel` is required when the option's cost is
       * `'slotLevel'` (i.e. Twinned Spell).
       *
       * Returns `{ ok, metamagic, cost, effect, actor }`. The host
       * applies the `effect` payload when casting the spell.
       */
      applyMetamagic: (actor, args = {}, _ctx) => {
        const name = args.metamagic;
        const option = METAMAGIC_OPTIONS[name];
        if (!option) {
          return { ok: false, reason: `unknown metamagic option: ${name}` };
        }
        let cost = option.cost;
        if (cost === "slotLevel") {
          const slotLevel = args.slotLevel;
          if (!Number.isInteger(slotLevel) || slotLevel < 1) {
            return { ok: false, reason: `${name} requires args.slotLevel` };
          }
          cost = slotLevel;
        }
        const result = spendResource(actor, "sorceryPoints", cost);
        if (!result.ok) return result;
        return {
          ok: true,
          metamagic: name,
          cost,
          effect: option.effect,
          actor: result.actor
        };
      },
      /**
       * Read-only: current Sorcery Points snapshot for UI.
       */
      sorceryPointsStatus: (actor) => {
        const pool = actor.resources?.sorceryPoints;
        if (!pool) return { remaining: 0, max: 0 };
        return { remaining: pool.max - pool.used, max: pool.max };
      }
    }
  };

  // vendor/bag-of-holding/src/classes/warlock.js
  function invocationsKnownForLevel(level) {
    if (level >= 18) return 8;
    if (level >= 15) return 7;
    if (level >= 12) return 6;
    if (level >= 9) return 5;
    if (level >= 7) return 4;
    if (level >= 5) return 3;
    if (level >= 2) return 2;
    return 1;
  }
  var ELDRITCH_INVOCATIONS = Object.freeze({
    "agonizing-blast": {
      id: "agonizing-blast",
      name: "Agonizing Blast",
      prerequisites: { warlockLevel: 2 },
      repeatable: true,
      effect: Object.freeze({ damageBonus: "chaMod", targets: "oneCantrip" })
    },
    "armor-of-shadows": {
      id: "armor-of-shadows",
      name: "Armor of Shadows",
      prerequisites: { warlockLevel: 1 },
      effect: Object.freeze({ atWillSpell: "mage-armor" })
    },
    "devils-sight": {
      id: "devils-sight",
      name: "Devil's Sight",
      prerequisites: { warlockLevel: 2 },
      effect: Object.freeze({ darkvisionFt: 120, throughMagicalDarkness: true })
    },
    "eldritch-mind": {
      id: "eldritch-mind",
      name: "Eldritch Mind",
      prerequisites: { warlockLevel: 1 },
      effect: Object.freeze({ concentrationAdvantage: true })
    },
    "fiendish-vigor": {
      id: "fiendish-vigor",
      name: "Fiendish Vigor",
      prerequisites: { warlockLevel: 2 },
      effect: Object.freeze({ atWillSpell: "false-life" })
    },
    "mask-of-many-faces": {
      id: "mask-of-many-faces",
      name: "Mask of Many Faces",
      prerequisites: { warlockLevel: 2 },
      effect: Object.freeze({ atWillSpell: "disguise-self" })
    },
    "misty-visions": {
      id: "misty-visions",
      name: "Misty Visions",
      prerequisites: { warlockLevel: 2 },
      effect: Object.freeze({ atWillSpell: "silent-image" })
    },
    "repelling-blast": {
      id: "repelling-blast",
      name: "Repelling Blast",
      prerequisites: { warlockLevel: 2, cantrip: "eldritch-blast" },
      effect: Object.freeze({ pushOnEldritchBlastHitFt: 10 })
    },
    "beguiling-influence": {
      id: "beguiling-influence",
      name: "Beguiling Influence",
      prerequisites: { warlockLevel: 1 },
      effect: Object.freeze({ skillProficiencies: ["deception", "persuasion"] })
    },
    "eyes-of-the-rune-keeper": {
      id: "eyes-of-the-rune-keeper",
      name: "Eyes of the Rune Keeper",
      prerequisites: { warlockLevel: 1 },
      effect: Object.freeze({ readsAllScripts: true })
    }
  });
  function validateInvocations(invocationIds, actor) {
    if (!Array.isArray(invocationIds)) {
      return { ok: false, reason: "invocations must be an array" };
    }
    const level = actor.level ?? 1;
    const cantripsKnown = new Set(actor.cantripsKnown ?? []);
    const maxKnown = invocationsKnownForLevel(level);
    if (invocationIds.length > maxKnown) {
      return {
        ok: false,
        reason: `${invocationIds.length} invocations selected; max ${maxKnown} at Warlock level ${level}`
      };
    }
    const seen = /* @__PURE__ */ new Map();
    for (const id of invocationIds) {
      const inv = ELDRITCH_INVOCATIONS[id];
      if (!inv) return { ok: false, reason: `unknown invocation: ${id}` };
      const count = seen.get(id) ?? 0;
      if (count > 0 && !inv.repeatable) {
        return { ok: false, reason: `cannot repeat invocation: ${id}` };
      }
      seen.set(id, count + 1);
      const prereqs = inv.prerequisites;
      if (prereqs.warlockLevel && level < prereqs.warlockLevel) {
        return {
          ok: false,
          reason: `${id} requires Warlock level ${prereqs.warlockLevel}`
        };
      }
      if (prereqs.cantrip && !cantripsKnown.has(prereqs.cantrip)) {
        return {
          ok: false,
          reason: `${id} requires the ${prereqs.cantrip} cantrip`
        };
      }
    }
    return { ok: true };
  }
  var warlock_default = {
    id: "warlock",
    name: "Warlock",
    hitDie: 8,
    primaryAbility: "cha",
    savingThrowProficiencies: ["wis", "cha"],
    spellcasting: {
      ability: "cha",
      cantripsKnown: { 1: 2, 4: 3 },
      progression: "warlock",
      preparation: "known"
    },
    subclasses: {
      "fiend-patron": {
        id: "fiend-patron",
        name: "Patron: The Fiend",
        features: {
          1: ["Dark One's Blessing", "Expanded Spell List"],
          3: ["Dark One's Own Luck"]
        }
      }
    },
    features: {
      1: ["Eldritch Invocations", "Pact Magic"],
      2: ["Eldritch Invocation"],
      3: ["Patron's Boon", "Pact Boon"],
      4: ["Ability Score Improvement"],
      5: ["Eldritch Invocation (additional)"],
      6: ["Subclass Feature"],
      7: ["Eldritch Invocation (additional)"],
      8: ["Ability Score Improvement"],
      9: ["Eldritch Invocation (additional)"],
      10: ["Subclass Feature"]
    },
    mechanics: {
      /**
       * Persist a validated set of Eldritch Invocations on the actor.
       * Refuses (no state mutation) if any prereq fails or the count
       * exceeds the level cap. Returns `{ ok, actor }` on success.
       */
      setInvocations: (actor, args = {}, _ctx) => {
        const ids = args.invocations;
        const check = validateInvocations(ids, actor);
        if (!check.ok) return check;
        return {
          ok: true,
          invocationsKnown: ids.length,
          maxKnown: invocationsKnownForLevel(actor.level ?? 1),
          actor: { ...actor, invocations: [...ids] }
        };
      },
      /**
       * Read-only: does the actor have the named invocation?
       */
      hasInvocation: (actor, args = {}, _ctx) => {
        const list = Array.isArray(actor.invocations) ? actor.invocations : [];
        return { has: list.includes(args.invocationId) };
      },
      /**
       * SRD 5.2 § Agonizing Blast: adds CHA modifier to the damage of
       * one chosen Warlock cantrip. Returns `{ bonus }` — 0 if the
       * Warlock doesn't have Agonizing Blast, otherwise the CHA mod
       * (floored at 0 for CHA 8 — no negative bonus per SRD).
       */
      agonizingBlastBonus: (actor, _args, _ctx) => {
        const list = Array.isArray(actor.invocations) ? actor.invocations : [];
        if (!list.includes("agonizing-blast")) return { bonus: 0 };
        const chaMod = modFromScore(actor.abilityScores?.cha ?? 10);
        return { bonus: Math.max(0, chaMod) };
      },
      /**
       * Read-only: invocation-slot accounting for the UI builder.
       */
      invocationsStatus: (actor, _args, _ctx) => {
        const level = actor.level ?? 1;
        const known = Array.isArray(actor.invocations) ? actor.invocations.length : 0;
        return { known, max: invocationsKnownForLevel(level) };
      }
    }
  };

  // vendor/bag-of-holding/src/conditions.js
  var CONDITIONS = Object.freeze([
    "blinded",
    "charmed",
    "deafened",
    "frightened",
    "grappled",
    "incapacitated",
    "invisible",
    "paralyzed",
    "petrified",
    "poisoned",
    "prone",
    "restrained",
    "stunned",
    "unconscious"
  ]);
  var _RAW_CONDITION_EFFECTS = {
    blinded: {
      // SRD: a blinded creature's attacks have disadvantage; attacks
      // against it have advantage.
      ownAttackDisadvantage: true,
      targetAdvantage: true,
      cantSee: true
    },
    charmed: {
      // The charmer has advantage on social checks vs the charmed
      // actor; we surface that as `charmedBy` semantics on the actor
      // (host owns the charmer reference). The flag here lets
      // downstream code know to look.
      socialDisadvantageVsCharmer: true
    },
    deafened: {
      cantHear: true
    },
    frightened: {
      // While the source of fright is in sight: disadvantage on
      // ability checks AND attack rolls. Host decides "is the source
      // in sight" — the flag lets the math conservatively apply
      // disadvantage when the host doesn't deny it.
      ownAttackDisadvantage: true,
      ownCheckDisadvantage: true
    },
    grappled: {
      speedZero: true
    },
    incapacitated: {
      incapacitates: true,
      cantSpeak: true
      // SRD 2024 update: incapacitated can't speak
    },
    invisible: {
      targetDisadvantage: true,
      // attackers have disadvantage on this actor
      ownAttackAdvantage: true
    },
    paralyzed: {
      incapacitates: true,
      speedZero: true,
      autoFailStrDexSaves: true,
      targetAdvantage: true,
      critIfAttackerWithin5: true
    },
    petrified: {
      incapacitates: true,
      speedZero: true,
      autoFailStrDexSaves: true,
      targetAdvantage: true,
      resistance: "all"
      // host applies a flat 0.5x multiplier on damage
    },
    poisoned: {
      ownAttackDisadvantage: true,
      ownCheckDisadvantage: true
    },
    prone: {
      // Attackers within 5 ft have advantage; attackers further than
      // 5 ft have disadvantage. The math layer needs the distance to
      // decide — we surface `proneOnTarget: true` and let the call
      // site pass `attackerDistance` into the modifier helper.
      proneOnTarget: true,
      ownAttackDisadvantage: true
      // 5e: a prone actor's attacks have disadvantage
    },
    restrained: {
      speedZero: true,
      targetAdvantage: true,
      ownAttackDisadvantage: true,
      saveDexDisadvantage: true
    },
    stunned: {
      incapacitates: true,
      speedZero: true,
      autoFailStrDexSaves: true,
      targetAdvantage: true
    },
    unconscious: {
      incapacitates: true,
      speedZero: true,
      autoFailStrDexSaves: true,
      targetAdvantage: true,
      critIfAttackerWithin5: true,
      cantSee: true,
      cantHear: true
    }
  };
  for (const v of Object.values(_RAW_CONDITION_EFFECTS)) Object.freeze(v);
  var CONDITION_EFFECTS = Object.freeze(_RAW_CONDITION_EFFECTS);
  function effectsFor(actor) {
    const flags = {};
    for (const condition of actor.conditions ?? []) {
      const effect = CONDITION_EFFECTS[condition];
      if (!effect) continue;
      for (const [k, v] of Object.entries(effect)) {
        if (typeof v === "boolean") flags[k] = flags[k] || v;
        else flags[k] = v;
      }
    }
    return flags;
  }
  function attackStance({ attacker = {}, target = {}, attackerDistanceFt = 0 }) {
    const a = effectsFor(attacker);
    const t = effectsFor(target);
    let adv = false;
    let dis = false;
    if (a.ownAttackDisadvantage) dis = true;
    if (a.ownAttackAdvantage) adv = true;
    if (t.targetAdvantage) adv = true;
    if (t.targetDisadvantage) dis = true;
    if (t.proneOnTarget) {
      if (attackerDistanceFt <= 5) adv = true;
      else dis = true;
    }
    if (target.dodging === true) dis = true;
    if (adv && dis) return "normal";
    if (adv) return "advantage";
    if (dis) return "disadvantage";
    return "normal";
  }
  function has(actor, condition) {
    return Array.isArray(actor.conditions) && actor.conditions.includes(condition);
  }
  function apply(actor, condition, allowedConditions = CONDITIONS) {
    if (!allowedConditions.includes(condition)) throw new Error(`Unknown condition: ${condition}`);
    if ((actor.conditionImmunities ?? []).includes(condition)) {
      return actor;
    }
    const current = new Set(actor.conditions ?? []);
    current.add(condition);
    return { ...actor, conditions: [...current] };
  }
  function isImmuneTo(actor, condition) {
    return Array.isArray(actor.conditionImmunities) && actor.conditionImmunities.includes(condition);
  }
  function remove(actor, condition) {
    const current = new Set(actor.conditions ?? []);
    current.delete(condition);
    return { ...actor, conditions: [...current] };
  }
  var EXHAUSTION_MAX = 6;
  var D20_PENALTY_PER_LEVEL = 2;
  var SPEED_PENALTY_PER_LEVEL = 5;
  var clampLevel = (n) => Math.max(0, Math.min(EXHAUSTION_MAX, n | 0));
  var exhaustion = {
    /**
     * `?? 0` so a fresh actor (never exhausted) reads as level 0
     * without needing initialisation, and `clampLevel` so a save with
     * a stale level survives a rules tweak.
     */
    level(actor) {
      return clampLevel(actor.exhaustion ?? 0);
    },
    /**
     * Default `amount = 1` because "one level" is overwhelmingly the
     * most common operation — forced marches, magical effects, and
     * curses almost always grant one level at a time.
     */
    gain(actor, amount = 1) {
      return { ...actor, exhaustion: clampLevel(exhaustion.level(actor) + amount) };
    },
    /**
     * Long Rest reduction in SRD 5.2 is one level per rest; same
     * default rationale as `gain`.
     */
    reduce(actor, amount = 1) {
      return { ...actor, exhaustion: clampLevel(exhaustion.level(actor) - amount) };
    },
    /**
     * Absolute setter that bypasses cumulative semantics. Useful for
     * save-load (set to a known persisted level) and for debug /
     * Nerd-mode console operations; the loop should normally prefer
     * `gain` / `reduce` so the deltas show up correctly in history.
     */
    set(actor, level) {
      return { ...actor, exhaustion: clampLevel(level) };
    },
    /**
     * Pre-derived penalty the loop adds to every D20 Test the actor
     * makes. Surfaced as a separate accessor so callers compose it
     * with other modifiers (proficiency, situational) without having
     * to know the per-level constant.
     */
    modifierToD20Tests(actor) {
      return -D20_PENALTY_PER_LEVEL * exhaustion.level(actor);
    },
    /**
     * Returned as a positive subtrahend rather than a negative speed
     * to match how the loop applies it (`baseSpeed - speedPenalty`),
     * matching the "your Speed is reduced by …" wording in the SRD.
     */
    speedPenalty(actor) {
      return SPEED_PENALTY_PER_LEVEL * exhaustion.level(actor);
    },
    /**
     * Convenience predicate so callers don't have to import
     * `EXHAUSTION_MAX` just to compare. Surfacing death as a flag
     * rather than letting callers branch on a magic number keeps
     * death-handling code grep-able.
     */
    isDead(actor) {
      return exhaustion.level(actor) >= EXHAUSTION_MAX;
    }
  };

  // vendor/bag-of-holding/src/character.js
  var SKILL_ABILITY = Object.freeze({
    "acrobatics": "dex",
    "animal-handling": "wis",
    "arcana": "int",
    "athletics": "str",
    "deception": "cha",
    "history": "int",
    "insight": "wis",
    "intimidation": "cha",
    "investigation": "int",
    "medicine": "wis",
    "nature": "int",
    "perception": "wis",
    "performance": "cha",
    "persuasion": "cha",
    "religion": "int",
    "sleight-of-hand": "dex",
    "stealth": "dex",
    "survival": "wis"
  });
  var ABILITIES = Object.freeze(["str", "dex", "con", "int", "wis", "cha"]);
  var SPEED_ZERO_CONDITIONS = Object.freeze([
    "grappled",
    "paralyzed",
    "petrified",
    "restrained",
    "stunned",
    "unconscious"
  ]);
  var SIZE_CAPACITY_MULTIPLIER = Object.freeze({
    tiny: 0.5,
    small: 1,
    medium: 1,
    large: 2,
    huge: 4,
    gargantuan: 8
  });
  var AVG_HP_BY_DIE = Object.freeze({ 4: 3, 6: 4, 8: 5, 10: 6, 12: 7 });
  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  function validateRecord(record, registries) {
    if (!isPlainObject(record)) {
      throw new Error("CharacterRecord must be an object");
    }
    for (const field of ["id", "name", "speciesId", "backgroundId", "classId"]) {
      if (typeof record[field] !== "string" || record[field].length === 0) {
        throw new Error(`CharacterRecord.${field} must be a non-empty string`);
      }
    }
    if (!Number.isInteger(record.level) || record.level < 1) {
      throw new Error("CharacterRecord.level must be a positive integer");
    }
    if (!isPlainObject(record.abilityScores)) {
      throw new Error("CharacterRecord.abilityScores must be an object");
    }
    for (const ability2 of ABILITIES) {
      const value = record.abilityScores[ability2];
      if (!Number.isInteger(value)) {
        throw new Error(`CharacterRecord.abilityScores.${ability2} must be an integer`);
      }
    }
    if (!isPlainObject(record.equipment)) {
      throw new Error("CharacterRecord.equipment must be an object");
    }
    if (!Array.isArray(record.equipment.weaponIds)) {
      throw new Error("CharacterRecord.equipment.weaponIds must be an array");
    }
    if (!registries.species[record.speciesId]) {
      throw new Error(`CharacterRecord.speciesId '${record.speciesId}' not registered with engine`);
    }
    if (!registries.classes[record.classId]) {
      throw new Error(`CharacterRecord.classId '${record.classId}' not registered with engine`);
    }
    if (!registries.backgrounds[record.backgroundId]) {
      throw new Error(`CharacterRecord.backgroundId '${record.backgroundId}' not registered with engine`);
    }
    if (record.equipment.armorId && !registries.items[record.equipment.armorId]) {
      throw new Error(`CharacterRecord.equipment.armorId '${record.equipment.armorId}' not registered with engine`);
    }
    if (record.equipment.shieldId && !registries.items[record.equipment.shieldId]) {
      throw new Error(`CharacterRecord.equipment.shieldId '${record.equipment.shieldId}' not registered with engine`);
    }
    for (const weaponId of record.equipment.weaponIds) {
      if (!registries.items[weaponId]) {
        throw new Error(`CharacterRecord.equipment.weaponIds entry '${weaponId}' not registered with engine`);
      }
    }
  }
  function deriveAbilities(record, background) {
    const final = { ...record.abilityScores };
    const explicitBumps = record.abilityScoreBumps;
    if (explicitBumps) {
      for (const ability2 of ABILITIES) {
        final[ability2] += explicitBumps[ability2] ?? 0;
      }
    } else {
      for (const ability2 of background.abilityScores) {
        final[ability2] += 1;
      }
    }
    const mod = {};
    for (const ability2 of ABILITIES) {
      mod[ability2] = modFromScore(final[ability2]);
    }
    return { final, mod };
  }
  function deriveMaxHp(record, classDef, conMod) {
    const hitDie = classDef.hitDie;
    const rolled = Array.isArray(record.hpRolled) ? record.hpRolled : [];
    const avgPerLevel = AVG_HP_BY_DIE[hitDie] ?? Math.floor(hitDie / 2) + 1;
    const l1 = (rolled[0] ?? hitDie) + conMod;
    let acc = l1;
    for (let level = 2; level <= record.level; level += 1) {
      const baseRoll = rolled[level - 1] ?? avgPerLevel;
      acc += baseRoll + conMod;
    }
    return acc;
  }
  function deriveAc(record, items2, dexMod) {
    const armor = record.equipment.armorId ? items2[record.equipment.armorId] : null;
    const shield = record.equipment.shieldId ? items2[record.equipment.shieldId] : null;
    let armorAc = 10;
    let dexContribution = dexMod;
    if (armor) {
      armorAc = armor.ac ?? 10;
      if (armor.addsDex) {
        dexContribution = armor.maxDex !== void 0 ? Math.min(dexMod, armor.maxDex) : dexMod;
      } else {
        dexContribution = 0;
      }
    }
    const shieldAc = shield?.acBonus ?? 0;
    const misc = 0;
    return {
      value: armorAc + dexContribution + shieldAc + misc,
      breakdown: { armor: armorAc, shield: shieldAc, dex: dexContribution, misc }
    };
  }
  function deriveInitiative(allFeats, profBonus, dexMod) {
    const alert = allFeats.find((f) => f.id === "alert");
    return dexMod + (alert ? profBonus : 0);
  }
  function deriveSpeed(species2, conditions, exhaustionLevel) {
    if (conditions.some((c) => SPEED_ZERO_CONDITIONS.includes(c))) {
      return { walk: 0 };
    }
    const penalty = exhaustion.speedPenalty({ exhaustion: exhaustionLevel });
    return { walk: Math.max(0, species2.speed - penalty) };
  }
  function deriveSaves(classDef, extraSaves, profBonus, abilityMods) {
    const classSaves = new Set(classDef.savingThrowProficiencies ?? []);
    const extraSet = new Set(extraSaves ?? []);
    const saves = {};
    for (const ability2 of ABILITIES) {
      const proficient = classSaves.has(ability2) || extraSet.has(ability2);
      saves[ability2] = {
        mod: abilityMods[ability2] + (proficient ? profBonus : 0),
        proficient
      };
    }
    return saves;
  }
  function deriveSkills(background, extraSkills, expertise, profBonus, abilityMods) {
    const proficientSet = /* @__PURE__ */ new Set([
      ...background.skillProficiencies ?? [],
      ...extraSkills ?? []
    ]);
    const expertiseSet = new Set(expertise ?? []);
    const skills = {};
    for (const [skillId, ability2] of Object.entries(SKILL_ABILITY)) {
      const proficient = proficientSet.has(skillId);
      const isExpert = proficient && expertiseSet.has(skillId);
      const profPortion = isExpert ? profBonus * 2 : proficient ? profBonus : 0;
      skills[skillId] = {
        ability: ability2,
        mod: abilityMods[ability2] + profPortion,
        proficient,
        expertise: isExpert
      };
    }
    return skills;
  }
  function deriveAttacks(record, items2, profBonus, abilityMods) {
    const attacks = [];
    for (const weaponId of record.equipment.weaponIds) {
      const weapon = items2[weaponId];
      const properties = weapon.properties ?? [];
      const isRanged = properties.includes("ranged");
      const isFinesse = properties.includes("finesse");
      let abilityMod;
      if (isRanged) {
        abilityMod = abilityMods.dex;
      } else if (isFinesse) {
        abilityMod = Math.max(abilityMods.str, abilityMods.dex);
      } else {
        abilityMod = abilityMods.str;
      }
      attacks.push({
        weaponId,
        name: weapon.name,
        attackBonus: abilityMod + profBonus,
        damageDice: weapon.damage ?? "0",
        damageMod: abilityMod,
        damageType: weapon.damageType,
        masteryProperty: weapon.mastery,
        // Clone so deep-freezing the sheet later can't reach back and
        // freeze the item registry's mutable properties array.
        properties: [...properties]
      });
    }
    return attacks;
  }
  function deriveSpellcasting(classDef, profBonus, abilityMods) {
    const sc = classDef.spellcasting;
    if (!sc) return null;
    const abilityMod = abilityMods[sc.ability];
    return {
      ability: sc.ability,
      attackBonus: profBonus + abilityMod,
      saveDC: 8 + profBonus + abilityMod
    };
  }
  function resolveFeats(record, background) {
    const fromRecord = Array.isArray(record.feats) ? record.feats : [];
    const seen = /* @__PURE__ */ new Map();
    for (const feat of [background.originFeat, ...fromRecord]) {
      seen.set(feat.id, feat);
    }
    return [...seen.values()];
  }
  function deriveSheet(record, registries) {
    validateRecord(record, registries);
    const species2 = registries.species[record.speciesId];
    const classDef = registries.classes[record.classId];
    const background = registries.backgrounds[record.backgroundId];
    const items2 = registries.items;
    const profBonus = registries.XP.PROFICIENCY_BY_LEVEL[record.level] ?? Math.ceil(record.level / 4) + 1;
    const { final: abilityFinal, mod: abilityMods } = deriveAbilities(record, background);
    const allFeats = resolveFeats(record, background);
    const conditions = Array.isArray(record.conditions) ? record.conditions : [];
    const exhaustionLevel = exhaustion.level({ exhaustion: record.exhaustion });
    const hp = { max: deriveMaxHp(record, classDef, abilityMods.con) };
    const ac = deriveAc(record, items2, abilityMods.dex);
    const initiative = deriveInitiative(allFeats, profBonus, abilityMods.dex);
    const speed = deriveSpeed(species2, conditions, exhaustionLevel);
    const saves = deriveSaves(classDef, record.proficiencies?.saves, profBonus, abilityMods);
    const skills = deriveSkills(
      background,
      record.proficiencies?.skills,
      record.proficiencies?.expertise,
      profBonus,
      abilityMods
    );
    const attacks = deriveAttacks(record, items2, profBonus, abilityMods);
    const spellcasting = deriveSpellcasting(classDef, profBonus, abilityMods);
    const passives = {
      perception: 10 + skills.perception.mod,
      insight: 10 + skills.insight.mod,
      investigation: 10 + skills.investigation.mod
    };
    const sizeMultiplier = SIZE_CAPACITY_MULTIPLIER[species2.size] ?? 1;
    const capacity = Math.round(abilityFinal.str * 15 * sizeMultiplier);
    const carryingCapacity = { capacity, push: capacity * 2, lift: capacity * 2 };
    const meta = {
      source: "bag-of-holding/character@1",
      speciesId: record.speciesId,
      classId: record.classId,
      level: record.level
    };
    if (record.subclassId !== void 0) {
      meta.subclassId = record.subclassId;
    }
    const sheet = {
      meta,
      abilityScores: { final: abilityFinal, mod: abilityMods },
      proficiencyBonus: profBonus,
      hp,
      ac,
      initiative,
      speed,
      saves,
      skills,
      attacks,
      spellcasting,
      passives,
      carryingCapacity,
      activeEffects: {
        conditions: [...conditions],
        exhaustion: exhaustionLevel
      }
    };
    return deepFreeze(sheet);
  }
  function deepFreeze(value) {
    for (const key of Object.keys(value)) {
      const child = value[key];
      if (child !== null && typeof child === "object") {
        deepFreeze(child);
      }
    }
    return Object.freeze(value);
  }

  // vendor/bag-of-holding/src/rules.js
  var DEFAULT_RULES = Object.freeze({
    /** d20 faces that count as critical hits. Default `[20]`.
     *  Pathfinder-style would be `[19, 20]`; a Champion Fighter's
     *  Improved Critical would be `[19, 20]` for that engine. */
    critOn: Object.freeze([20]),
    /** d20 faces that count as fumbles. Default `[1]`. */
    fumbleOn: Object.freeze([1]),
    /** Minimum damage on a successful hit. Default `1` (SRD §
     *  "Damage Rolls": you always deal at least 1 damage). Set to
     *  `0` for systems where negative modifiers fully cancel a hit. */
    damageFloor: 1,
    /** When true, every damage die that comes up its maximum value
     *  triggers another roll of the same die, added on. Off by
     *  default (SRD doesn't use exploding dice). On in Savage Worlds-
     *  flavoured packs. */
    explodingDamageDice: false,
    /** Override map of `level → XP threshold`. `null` means use the
     *  SRD 5.2 table from `xp.js`. Gritty packs raise thresholds;
     *  heroic packs lower them. */
    xpThresholds: null,
    /** Override map of `level → proficiency bonus`. `null` means use
     *  the SRD 5.2 table from `xp.js`. */
    proficiencyByLevel: null,
    /** DC of a death saving throw. SRD 5.2 § Death Saving Throws sets
     *  this at 10. Gritty packs raise it; heroic packs lower it. */
    deathSaveDC: 10,
    /** Number of successes / failures required to stabilise / die.
     *  SRD 5.2 uses three of each. */
    deathSaveSuccessesRequired: 3,
    /** How many Hit Dice come back on a Long Rest.
     *  - `'half'` (default) matches SRD 5.2 § Long Rest.
     *  - `'all'`  — heroic packs restore them all.
     *  - `'none'` — gritty packs (DMG Slow Natural Healing). */
    longRestHitDiceRecovery: "half"
  });
  var isIntegerInRange = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  var isPositiveIntegerMap = (m) => {
    if (typeof m !== "object" || m === null || Array.isArray(m)) return false;
    for (const [k, v] of Object.entries(m)) {
      if (!isIntegerInRange(Number(k), 1, 1e3)) return false;
      if (!Number.isInteger(v) || v < 0) return false;
    }
    return true;
  };
  function buildRules(extras = {}) {
    if (extras === null || typeof extras !== "object" || Array.isArray(extras)) {
      throw new Error("rules must be an object");
    }
    if (extras.critOn !== void 0) {
      if (!Array.isArray(extras.critOn) || extras.critOn.some((v) => !isIntegerInRange(v, 1, 20))) {
        throw new Error("rules.critOn must be an array of integers in [1, 20]");
      }
    }
    if (extras.fumbleOn !== void 0) {
      if (!Array.isArray(extras.fumbleOn) || extras.fumbleOn.some((v) => !isIntegerInRange(v, 1, 20))) {
        throw new Error("rules.fumbleOn must be an array of integers in [1, 20]");
      }
    }
    if (extras.damageFloor !== void 0) {
      if (!Number.isInteger(extras.damageFloor) || extras.damageFloor < 0) {
        throw new Error("rules.damageFloor must be a non-negative integer");
      }
    }
    if (extras.explodingDamageDice !== void 0 && typeof extras.explodingDamageDice !== "boolean") {
      throw new Error("rules.explodingDamageDice must be a boolean");
    }
    if (extras.xpThresholds !== void 0 && extras.xpThresholds !== null) {
      if (!isPositiveIntegerMap(extras.xpThresholds)) {
        throw new Error("rules.xpThresholds must be a record of positive integer levels \u2192 non-negative integer XP");
      }
    }
    if (extras.proficiencyByLevel !== void 0 && extras.proficiencyByLevel !== null) {
      if (!isPositiveIntegerMap(extras.proficiencyByLevel)) {
        throw new Error("rules.proficiencyByLevel must be a record of positive integer levels \u2192 non-negative integer bonus");
      }
    }
    if (extras.deathSaveDC !== void 0) {
      if (!isIntegerInRange(extras.deathSaveDC, 1, 30)) {
        throw new Error("rules.deathSaveDC must be an integer in [1, 30]");
      }
    }
    if (extras.deathSaveSuccessesRequired !== void 0) {
      if (!Number.isInteger(extras.deathSaveSuccessesRequired) || extras.deathSaveSuccessesRequired < 1) {
        throw new Error("rules.deathSaveSuccessesRequired must be a positive integer");
      }
    }
    if (extras.longRestHitDiceRecovery !== void 0) {
      if (!["half", "all", "none"].includes(extras.longRestHitDiceRecovery)) {
        throw new Error("rules.longRestHitDiceRecovery must be 'half', 'all', or 'none'");
      }
    }
    return Object.freeze({
      critOn: Object.freeze([...extras.critOn ?? DEFAULT_RULES.critOn]),
      fumbleOn: Object.freeze([...extras.fumbleOn ?? DEFAULT_RULES.fumbleOn]),
      damageFloor: extras.damageFloor ?? DEFAULT_RULES.damageFloor,
      explodingDamageDice: extras.explodingDamageDice ?? DEFAULT_RULES.explodingDamageDice,
      xpThresholds: extras.xpThresholds == null ? DEFAULT_RULES.xpThresholds : Object.freeze({ ...extras.xpThresholds }),
      proficiencyByLevel: extras.proficiencyByLevel == null ? DEFAULT_RULES.proficiencyByLevel : Object.freeze({ ...extras.proficiencyByLevel }),
      deathSaveDC: extras.deathSaveDC ?? DEFAULT_RULES.deathSaveDC,
      deathSaveSuccessesRequired: extras.deathSaveSuccessesRequired ?? DEFAULT_RULES.deathSaveSuccessesRequired,
      longRestHitDiceRecovery: extras.longRestHitDiceRecovery ?? DEFAULT_RULES.longRestHitDiceRecovery
    });
  }

  // vendor/bag-of-holding/src/combat.js
  function rollInitiative({ dexterity }, rng = Math.random) {
    return rollDie(20, rng) + modFromScore(dexterity);
  }
  function attackRoll({ attackBonus, ac, attacker, target, attackerDistanceFt }, rng = Math.random, rules = DEFAULT_RULES) {
    let stance = "normal";
    if (attacker || target) {
      stance = attackStance({
        attacker: attacker ?? {},
        target: target ?? {},
        attackerDistanceFt: attackerDistanceFt ?? 0
      });
    }
    let d20;
    if (stance === "advantage") {
      d20 = Math.max(rollDie(20, rng), rollDie(20, rng));
    } else if (stance === "disadvantage") {
      d20 = Math.min(rollDie(20, rng), rollDie(20, rng));
    } else {
      d20 = rollDie(20, rng);
    }
    let critical = rules.critOn.includes(d20);
    const fumble = rules.fumbleOn.includes(d20);
    const total = d20 + attackBonus;
    const hit = critical || !fumble && total >= ac;
    if (hit && target && attackerDistanceFt !== void 0 && attackerDistanceFt <= 5) {
      const tEffects = effectsFor(target);
      if (tEffects.critIfAttackerWithin5) critical = true;
    }
    return { d20, attackBonus, total, ac, hit, critical, fumble, stance };
  }
  function damageRoll({ damageDice, damageMod = 0, critical = false, damageType }, rng = Math.random, rules = DEFAULT_RULES) {
    const rollFn = rules.explodingDamageDice ? rollExplosive : roll;
    const base = rollFn(damageDice, rng);
    const extra = critical ? rollFn(damageDice, rng) : { rolls: [], total: 0 };
    const total = Math.max(rules.damageFloor, base.total + extra.total + damageMod);
    const result = {
      damageDice,
      baseRolls: base.rolls,
      critRolls: extra.rolls,
      damageMod,
      total
    };
    if (damageType !== void 0) result.damageType = damageType;
    return result;
  }
  var DEFAULT_MASTERY_HANDLERS = Object.freeze({
    graze: (_w, _t, result, attacker) => {
      if (result?.hit) return { kind: "none" };
      const attackBonus = result?.attackBonus ?? 0;
      const proficiencyBonus = attacker?.proficiencyBonus ?? 0;
      return { kind: "graze", damage: attackBonus - proficiencyBonus };
    },
    cleave: (_w, _t, result) => {
      if (!result?.hit) return { kind: "none" };
      return { kind: "cleave", range: 5 };
    },
    nick: (_w, _t, result) => {
      if (!result?.hit) return { kind: "none" };
      return { kind: "nick", extraAttack: true };
    },
    push: (_w, _t, result) => {
      if (!result?.hit) return { kind: "none" };
      return { kind: "push", distance: 10, sizeCap: "large" };
    },
    sap: (_w, _t, result) => {
      if (!result?.hit) return { kind: "none" };
      return { kind: "sap", disadvantage: true };
    },
    slow: (_w, _t, result) => {
      if (!result?.hit) return { kind: "none" };
      return { kind: "slow", speedReduction: 10 };
    },
    topple: (_w, _t, result, attacker) => {
      if (!result?.hit) return { kind: "none" };
      const attackBonus = result.attackBonus ?? 0;
      const proficiencyBonus = attacker?.proficiencyBonus ?? 0;
      const attackAbilityMod = attackBonus - proficiencyBonus;
      const saveDC = 8 + attackAbilityMod + proficiencyBonus;
      return { kind: "topple", saveDC, ability: "con", onFail: "prone" };
    },
    vex: (_w, _t, result) => {
      if (!result?.hit) return { kind: "none" };
      return { kind: "vex", advantage: true };
    }
  });
  var MASTERY_PROPERTIES = Object.freeze(Object.keys(DEFAULT_MASTERY_HANDLERS));
  function applyMastery(weapon, target, attackResult, attacker = {}, handlers = DEFAULT_MASTERY_HANDLERS) {
    const mastery = weapon?.mastery;
    if (!mastery) return { kind: "none" };
    const handler = handlers[mastery];
    if (!handler) throw new Error(`Unknown weapon mastery: ${mastery}`);
    return handler(weapon, target, attackResult, attacker);
  }
  function freshDeathSaves() {
    return { successes: 0, failures: 0, stable: false, dead: false };
  }
  function dropToZero(actor) {
    const withUnconscious = apply(actor, "unconscious");
    return { ...withUnconscious, hp: 0, deathSaves: freshDeathSaves() };
  }
  function deathSave(actor, rng = Math.random, rules = DEFAULT_RULES) {
    const tracker = actor.deathSaves ?? freshDeathSaves();
    if (tracker.dead || tracker.stable) return { d20: 0, outcome: "noop", actor };
    const dc = rules.deathSaveDC;
    const threshold = rules.deathSaveSuccessesRequired;
    const d20 = rollDie(20, rng);
    if (d20 === 20) {
      const revived = remove(actor, "unconscious");
      return {
        d20,
        outcome: "revived",
        actor: { ...revived, hp: 1, deathSaves: freshDeathSaves() }
      };
    }
    if (d20 === 1) {
      const failures2 = tracker.failures + 2;
      const dead2 = failures2 >= threshold;
      return {
        d20,
        outcome: dead2 ? "dead" : "failure",
        actor: { ...actor, deathSaves: { ...tracker, failures: failures2, dead: dead2 } }
      };
    }
    if (d20 >= dc) {
      const successes = tracker.successes + 1;
      const stable = successes >= threshold;
      return {
        d20,
        outcome: stable ? "stable" : "success",
        actor: { ...actor, deathSaves: { ...tracker, successes, stable } }
      };
    }
    const failures = tracker.failures + 1;
    const dead = failures >= threshold;
    return {
      d20,
      outcome: dead ? "dead" : "failure",
      actor: { ...actor, deathSaves: { ...tracker, failures, dead } }
    };
  }
  function applyDamageWhileDown(actor, damageTaken, { critical = false, hpMax } = {}, rules = DEFAULT_RULES) {
    const tracker = actor.deathSaves ?? freshDeathSaves();
    if (tracker.dead) return { outcome: "noop", actor };
    const max = hpMax ?? actor.hpMax;
    const threshold = rules.deathSaveSuccessesRequired;
    if (max !== void 0 && damageTaken >= max) {
      return {
        outcome: "dead",
        actor: { ...actor, deathSaves: { ...tracker, failures: threshold, dead: true } }
      };
    }
    const failureDelta = critical ? 2 : 1;
    const failures = tracker.failures + failureDelta;
    const dead = failures >= threshold;
    return {
      outcome: dead ? "dead" : "failure",
      actor: { ...actor, deathSaves: { ...tracker, failures, stable: false, dead } }
    };
  }
  function stabilize(actor) {
    return {
      ...actor,
      deathSaves: { successes: 0, failures: 0, stable: true, dead: false }
    };
  }
  function reviveTo(actor, hp) {
    if (!Number.isInteger(hp) || hp < 1) {
      throw new Error("reviveTo: hp must be a positive integer");
    }
    const withoutUnconscious = remove(actor, "unconscious");
    return { ...withoutUnconscious, hp, deathSaves: freshDeathSaves() };
  }
  function applyDamageModifiers(actor, { amount, type } = {}) {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error("applyDamageModifiers: amount must be a non-negative integer");
    }
    if (!type) return amount;
    if ((actor.damageImmunities ?? []).includes(type)) return 0;
    let result = amount;
    if ((actor.damageResistances ?? []).includes(type)) {
      result = Math.floor(result / 2);
    }
    if ((actor.damageVulnerabilities ?? []).includes(type)) {
      result = result * 2;
    }
    return result;
  }
  function grantTempHp(actor, amount) {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error("grantTempHp: amount must be a non-negative integer");
    }
    const current = actor.tempHp ?? 0;
    if (amount > current) return { ...actor, tempHp: amount };
    return actor;
  }
  function applyDamage(actor, args = {}) {
    const { amount = 0, type, critical = false, source } = args;
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error("applyDamage: amount must be a non-negative integer");
    }
    const finalAmount = applyDamageModifiers(actor, { amount, type });
    if (finalAmount === 0 && (actor.damageImmunities ?? []).includes(type)) {
      return wrapDamageResult({
        actor,
        amount,
        finalAmount,
        tempHpAbsorbed: 0,
        hpBefore: actor.hp ?? 0,
        hpAfter: actor.hp ?? 0,
        outcome: "immune",
        source
      });
    }
    const hpBefore = actor.hp ?? 0;
    if (hpBefore === 0 && finalAmount > 0) {
      const dwd = applyDamageWhileDown(
        actor,
        finalAmount,
        { critical, hpMax: actor.hpMax }
      );
      return wrapDamageResult({
        actor: dwd.actor,
        amount,
        finalAmount,
        tempHpAbsorbed: 0,
        hpBefore: 0,
        hpAfter: 0,
        outcome: dwd.outcome === "dead" ? "dead" : "downed",
        source
      });
    }
    const tempBefore = actor.tempHp ?? 0;
    const tempAbsorbed = Math.min(tempBefore, finalAmount);
    const remainingDamage = finalAmount - tempAbsorbed;
    const tempAfter = tempBefore - tempAbsorbed;
    let next = { ...actor, tempHp: tempAfter };
    if (remainingDamage === 0) {
      return wrapDamageResult({
        actor: next,
        amount,
        finalAmount,
        tempHpAbsorbed: tempAbsorbed,
        hpBefore,
        hpAfter: hpBefore,
        outcome: tempAbsorbed > 0 ? "absorbed" : "damaged",
        source
      });
    }
    const hpMax = actor.hpMax;
    const overkill = remainingDamage - hpBefore;
    if (hpBefore > 0 && remainingDamage >= hpBefore && hpMax !== void 0 && overkill >= hpMax) {
      return wrapDamageResult({
        actor: {
          ...next,
          hp: 0,
          deathSaves: { successes: 0, failures: 3, stable: false, dead: true }
        },
        amount,
        finalAmount,
        tempHpAbsorbed: tempAbsorbed,
        hpBefore,
        hpAfter: 0,
        outcome: "dead",
        source
      });
    }
    const hpAfter = Math.max(0, hpBefore - remainingDamage);
    if (hpAfter === 0 && hpBefore > 0) {
      next = dropToZero({ ...next, hp: 0 });
      return wrapDamageResult({
        actor: next,
        amount,
        finalAmount,
        tempHpAbsorbed: tempAbsorbed,
        hpBefore,
        hpAfter: 0,
        outcome: "downed",
        source
      });
    }
    next = { ...next, hp: hpAfter };
    return wrapDamageResult({
      actor: next,
      amount,
      finalAmount,
      tempHpAbsorbed: tempAbsorbed,
      hpBefore,
      hpAfter,
      outcome: "damaged",
      source
    });
  }
  function wrapDamageResult({ actor, amount, finalAmount, tempHpAbsorbed, hpBefore, hpAfter, outcome, source }) {
    const out = { amount, finalAmount, tempHpAbsorbed, hpBefore, hpAfter, outcome, actor };
    if (source !== void 0) out.source = source;
    return out;
  }
  function tickTimers(actor) {
    if (!Array.isArray(actor.timers) || actor.timers.length === 0) {
      return { actor, expired: [] };
    }
    const expired = [];
    const remaining = [];
    for (const t of actor.timers) {
      const next = (t.remainingRounds ?? 0) - 1;
      if (next <= 0) expired.push(t);
      else remaining.push({ ...t, remainingRounds: next });
    }
    return {
      actor: { ...actor, timers: remaining },
      expired
    };
  }
  function addTimer(actor, timer) {
    if (!timer || typeof timer !== "object") {
      throw new Error("addTimer: timer must be an object");
    }
    if (typeof timer.id !== "string" || timer.id.length === 0) {
      throw new Error("addTimer: timer.id must be a non-empty string");
    }
    if (!Number.isInteger(timer.remainingRounds) || timer.remainingRounds < 1) {
      throw new Error("addTimer: timer.remainingRounds must be a positive integer");
    }
    const existing = Array.isArray(actor.timers) ? actor.timers : [];
    return { ...actor, timers: [...existing, { ...timer }] };
  }
  function turnEnd(actor) {
    return tickTimers(actor);
  }
  function heal(actor, amount) {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error("heal: amount must be a non-negative integer");
    }
    const hpBefore = actor.hp ?? 0;
    if (amount === 0) {
      return { healed: 0, hpBefore, hpAfter: hpBefore, actor };
    }
    const hpMax = actor.hpMax ?? Infinity;
    const hpAfter = Math.min(hpMax, hpBefore + amount);
    const healed = hpAfter - hpBefore;
    let next = { ...actor, hp: hpAfter };
    if (hpBefore <= 0 && hpAfter > 0) {
      if ((actor.conditions ?? []).includes("unconscious")) {
        next = remove(next, "unconscious");
      }
      if (next.deathSaves) next = { ...next, deathSaves: freshDeathSaves() };
    }
    return { healed, hpBefore, hpAfter, actor: next };
  }

  // vendor/bag-of-holding/src/xp.js
  var THRESHOLDS = Object.freeze({
    1: 0,
    2: 300,
    3: 900,
    4: 2700,
    5: 6500,
    6: 14e3,
    7: 23e3,
    8: 34e3,
    9: 48e3,
    10: 64e3,
    11: 85e3,
    12: 1e5,
    13: 12e4,
    14: 14e4,
    15: 165e3,
    16: 195e3,
    17: 225e3,
    18: 265e3,
    19: 305e3,
    20: 355e3
  });
  var PROFICIENCY_BY_LEVEL = Object.freeze({
    1: 2,
    2: 2,
    3: 2,
    4: 2,
    5: 3,
    6: 3,
    7: 3,
    8: 3,
    9: 4,
    10: 4,
    11: 4,
    12: 4,
    13: 5,
    14: 5,
    15: 5,
    16: 5,
    17: 6,
    18: 6,
    19: 6,
    20: 6
  });
  function levelForXP(xp, thresholds = THRESHOLDS) {
    let level = 1;
    for (const [lvl, threshold] of Object.entries(thresholds)) {
      if (xp >= threshold) level = Number(lvl);
    }
    return level;
  }
  function nextLevelThreshold(xp, thresholds = THRESHOLDS) {
    const current = levelForXP(xp, thresholds);
    return thresholds[current + 1] ?? null;
  }
  function awardMilestone({ pc, beat }, thresholds = THRESHOLDS) {
    const minutes = beat?.targetPlaytimeMinutes ?? 30;
    const xpDelta = Math.round(minutes * 10);
    const newTotal = pc.xp + xpDelta;
    return { xpDelta, newTotal, willLevelUp: levelForXP(newTotal, thresholds) > pc.level };
  }

  // vendor/bag-of-holding/src/movesets.js
  var movesets_exports = {};
  __export(movesets_exports, {
    legal: () => legal
  });
  function legal({ pc, scene }) {
    const blockers = incapacitatingConditions(pc);
    if (blockers.length > 0) return incapacitatedActions(blockers);
    if (Array.isArray(pc?.conditions) && pc.conditions.includes("prone")) {
      return [
        { id: "talk", label: "Free-form dialogue", cost: "free" },
        { id: "look", label: "Look around", cost: "free" },
        { id: "stand-up", label: "Stand up (half movement)", cost: "movement" }
      ];
    }
    const actions = baseActions(scene);
    const provider = CLASS_PROVIDERS[pc?.classId];
    const level = pc?.level ?? 0;
    if (provider) {
      for (const chip of provider) {
        if (level >= chip.minLevel && chipApplies(chip, scene)) {
          actions.push({ id: chip.id, label: chip.label, cost: chip.cost });
        }
      }
    }
    return actions;
  }
  var INCAPACITATING = /* @__PURE__ */ new Set(["incapacitated", "paralyzed", "petrified", "stunned", "unconscious"]);
  function incapacitatingConditions(pc) {
    const list = pc?.conditions ?? [];
    return list.filter((c) => INCAPACITATING.has(c));
  }
  function incapacitatedActions(blockers) {
    return [{ id: "wait", label: `Incapacitated (${blockers.join(", ")})`, cost: "free" }];
  }
  function baseActions(scene) {
    const actions = [
      { id: "talk", label: "Free-form dialogue", cost: "free" },
      { id: "look", label: "Look around", cost: "free" }
    ];
    if (scene?.mode === "combat") {
      actions.push({ id: "attack.melee", label: "Melee attack", cost: "action" });
      actions.push({ id: "move.disengage", label: "Disengage", cost: "action" });
      actions.push({ id: "move.dash", label: "Dash", cost: "action" });
    } else {
      actions.push({ id: "move", label: "Move to another location", cost: "free" });
    }
    return actions;
  }
  function chipApplies(chip, scene) {
    if (chip.combatOnly && scene?.mode !== "combat") return false;
    return true;
  }
  var CLASS_PROVIDERS = {
    fighter: [
      { minLevel: 1, id: "fighter.second-wind", label: "Second Wind", cost: "bonus", combatOnly: true },
      { minLevel: 2, id: "fighter.action-surge", label: "Action Surge", cost: "free", combatOnly: true }
    ],
    rogue: [
      { minLevel: 2, id: "rogue.cunning-action.dash", label: "Cunning Action (Dash)", cost: "bonus", combatOnly: true },
      { minLevel: 2, id: "rogue.cunning-action.disengage", label: "Cunning Action (Disengage)", cost: "bonus", combatOnly: true },
      { minLevel: 2, id: "rogue.cunning-action.hide", label: "Cunning Action (Hide)", cost: "bonus", combatOnly: true }
    ],
    barbarian: [
      { minLevel: 1, id: "barbarian.rage", label: "Rage", cost: "bonus", combatOnly: true },
      { minLevel: 2, id: "barbarian.reckless-attack", label: "Reckless Attack", cost: "free", combatOnly: true }
    ],
    bard: [
      { minLevel: 1, id: "bard.bardic-inspiration", label: "Bardic Inspiration", cost: "bonus" }
    ],
    cleric: [
      { minLevel: 2, id: "cleric.channel-divinity", label: "Channel Divinity", cost: "action" }
    ],
    druid: [
      { minLevel: 2, id: "druid.wild-shape", label: "Wild Shape", cost: "action", combatOnly: true }
    ],
    monk: [
      { minLevel: 1, id: "monk.martial-arts", label: "Martial Arts (unarmed strike)", cost: "bonus", combatOnly: true },
      { minLevel: 5, id: "monk.stunning-strike", label: "Stunning Strike", cost: "free", combatOnly: true }
    ],
    paladin: [
      { minLevel: 1, id: "paladin.lay-on-hands", label: "Lay on Hands", cost: "bonus" },
      { minLevel: 2, id: "paladin.divine-smite", label: "Divine Smite (spend a slot)", cost: "free", combatOnly: true }
    ],
    ranger: [
      { minLevel: 1, id: "ranger.favored-enemy", label: "Recall lore (Favored Enemy)", cost: "free" }
    ],
    sorcerer: [
      { minLevel: 2, id: "sorcerer.font-of-magic", label: "Convert sorcery points \u2194 slots", cost: "bonus" }
    ],
    warlock: [
      { minLevel: 1, id: "warlock.eldritch-blast", label: "Eldritch Blast", cost: "action", combatOnly: true }
    ],
    wizard: [
      { minLevel: 1, id: "wizard.arcane-recovery", label: "Arcane Recovery (during short rest)", cost: "free" }
    ]
  };

  // vendor/bag-of-holding/src/beats/index.js
  var beats_exports = {};
  __export(beats_exports, {
    ARCHETYPE_ROLES: () => ARCHETYPE_ROLES,
    advance: () => advance,
    castArchetypes: () => castArchetypes,
    createThread: () => createThread,
    currentBeat: () => currentBeat,
    isComplete: () => isComplete,
    isReady: () => isReady,
    makeEmptyBeat: () => makeEmptyBeat,
    pushSubThread: () => pushSubThread,
    subThreadDepth: () => subThreadDepth,
    validateBeat: () => validateBeat
  });

  // vendor/bag-of-holding/src/beats/schema.js
  var ARCHETYPE_ROLES = Object.freeze([
    "authority",
    "antagonist",
    "informant",
    "mentor",
    "fixer",
    "muscle",
    "herald"
  ]);
  var REQUIRED_FIELDS = ["id", "dramaticPurpose", "targetPlaytimeMinutes", "setRequiredFlags"];
  function validateBeat(beat) {
    const errors = [];
    if (beat === null || typeof beat !== "object") {
      return { valid: false, errors: ["beat must be an object"] };
    }
    for (const key of REQUIRED_FIELDS) {
      if (beat[key] === void 0) errors.push(`Missing required field: ${key}`);
    }
    if (beat.id !== void 0 && typeof beat.id !== "string") {
      errors.push("id must be a string");
    }
    if (beat.targetPlaytimeMinutes !== void 0 && typeof beat.targetPlaytimeMinutes !== "number") {
      errors.push("targetPlaytimeMinutes must be a number");
    }
    for (const arrayField of ["prerequisites", "setRequiredFlags", "fallbackLocations", "requiredArchetypes", "successors"]) {
      if (beat[arrayField] !== void 0 && !Array.isArray(beat[arrayField])) {
        errors.push(`${arrayField} must be an array`);
      }
    }
    return { valid: errors.length === 0, errors };
  }
  function makeEmptyBeat(id) {
    return {
      id,
      dramaticPurpose: "",
      targetPlaytimeMinutes: 30,
      prerequisites: [],
      setRequiredFlags: [],
      preferredLocation: null,
      fallbackLocations: [],
      requiredArchetypes: [],
      boundEntities: {},
      successors: []
    };
  }

  // vendor/bag-of-holding/src/beats/thread.js
  function createThread(beats) {
    for (const beat of beats) {
      const { valid, errors } = validateBeat(beat);
      if (!valid) throw new Error(`Invalid beat ${beat?.id ?? "<no id>"}: ${errors.join(", ")}`);
    }
    const byId = {};
    for (let i = 0; i < beats.length; i++) byId[beats[i].id] = i;
    return { beats, currentIndex: 0, byId, stack: [] };
  }
  function currentBeat(thread) {
    if (thread.stack && thread.stack.length > 0) {
      const top = thread.stack[thread.stack.length - 1];
      return currentBeat(top);
    }
    return thread.beats[thread.currentIndex] ?? null;
  }
  function isReady(beat, state) {
    if (!beat) return false;
    return (beat.prerequisites ?? []).every((flag) => state?.flags?.[flag] === true);
  }
  function isComplete(beat, state) {
    if (!beat) return false;
    return (beat.setRequiredFlags ?? []).every((flag) => state?.flags?.[flag] === true);
  }
  function advance(thread, state, { chooseSuccessor } = {}) {
    if (thread.stack && thread.stack.length > 0) {
      const top = thread.stack[thread.stack.length - 1];
      const r = advance(top, state, { chooseSuccessor });
      const newStack = [...thread.stack];
      newStack[newStack.length - 1] = r.thread;
      let outThread = { ...thread, stack: newStack };
      if (r.finished) {
        outThread = { ...outThread, stack: outThread.stack.slice(0, -1) };
      }
      return { thread: outThread, advanced: r.advanced, finished: false, reason: r.reason };
    }
    const beat = thread.beats[thread.currentIndex] ?? null;
    if (!beat) return { thread, advanced: false, reason: "no current beat" };
    if (!isComplete(beat, state)) return { thread, advanced: false, reason: "current beat not complete" };
    if (Array.isArray(beat.successors) && beat.successors.length > 0) {
      const candidates = beat.successors.filter((id) => {
        const idx = thread.byId[id];
        if (idx === void 0) return false;
        const candidate = thread.beats[idx];
        return isReady(candidate, state);
      });
      if (candidates.length === 0) {
        return { thread, advanced: false, reason: "no ready successor" };
      }
      const pickedId = chooseSuccessor ? chooseSuccessor({ candidates, state, currentBeat: beat }) : candidates[0];
      const nextIndex2 = thread.byId[pickedId];
      if (nextIndex2 === void 0) {
        return { thread, advanced: false, reason: `chooseSuccessor returned unknown id: ${pickedId}` };
      }
      return {
        thread: { ...thread, currentIndex: nextIndex2 },
        advanced: true,
        finished: false
      };
    }
    const nextIndex = thread.currentIndex + 1;
    const finished = nextIndex >= thread.beats.length;
    return {
      thread: { ...thread, currentIndex: nextIndex },
      advanced: true,
      finished
    };
  }
  function pushSubThread(thread, beats) {
    const sub = createThread(beats);
    return { ...thread, stack: [...thread.stack, sub] };
  }
  function subThreadDepth(thread) {
    return thread.stack.length;
  }

  // vendor/bag-of-holding/src/beats/casting.js
  function castArchetypes(beat, { entityProvider }) {
    if (typeof entityProvider !== "function") {
      throw new Error("entityProvider callback is required for beat casting");
    }
    const cast = {};
    for (const slot of beat.requiredArchetypes ?? []) {
      const entity = entityProvider(slot);
      if (!entity) {
        return { cast: null, missing: slot, error: `No entity for archetype: ${slot.role}` };
      }
      cast[slot.role] = entity;
    }
    return { cast, missing: null, error: null };
  }

  // vendor/bag-of-holding/src/encounter.js
  var DEFAULT_ACTION_BUDGET = Object.freeze({
    action: 1,
    bonus: 1,
    reaction: 1,
    movement: null
    // overridden per-actor from speed
  });
  var ACTION_COSTS = Object.freeze(["action", "bonus", "reaction", "movement", "free"]);
  function freshBudget(speed) {
    return { ...DEFAULT_ACTION_BUDGET, movement: speed };
  }
  function rollOrder(participants, rng = Math.random, onInitiativeRoll) {
    const rolled = participants.map((p) => {
      const d20 = rollDie(20, rng);
      const initiative = d20 + modFromScore(p.dexterity);
      if (onInitiativeRoll) onInitiativeRoll({ id: p.id, dexterity: p.dexterity, value: initiative });
      return { ...p, initiative, initiativeD20: d20 };
    });
    rolled.sort((a, b) => {
      if (b.initiative !== a.initiative) return b.initiative - a.initiative;
      if (b.initiativeD20 !== a.initiativeD20) return b.initiativeD20 - a.initiativeD20;
      if (b.dexterity !== a.dexterity) return b.dexterity - a.dexterity;
      return String(a.id).localeCompare(String(b.id));
    });
    return rolled;
  }
  function startEncounter(participants, rng = Math.random, onInitiativeRoll) {
    if (!Array.isArray(participants) || participants.length === 0) {
      throw new Error("startEncounter requires at least one participant");
    }
    for (const p of participants) {
      if (p === null || typeof p !== "object") {
        throw new Error("Each participant must be an object");
      }
      if (typeof p.id !== "string" || p.id.length === 0) {
        throw new Error("Each participant must have a non-empty string id");
      }
      if (!Number.isInteger(p.dexterity)) {
        throw new Error(`Participant ${p.id}: dexterity must be an integer`);
      }
      if (!Number.isInteger(p.speed) || p.speed < 0) {
        throw new Error(`Participant ${p.id}: speed must be a non-negative integer`);
      }
    }
    const order = rollOrder(participants, rng, onInitiativeRoll);
    const budgets = {};
    for (const p of order) budgets[p.id] = freshBudget(p.speed);
    return {
      order,
      turnIndex: 0,
      round: 1,
      budgets,
      log: []
      // append-only encounter event log; the engine's
      //   rollLog still captures dice; this captures
      //   bookkeeping transitions (turn ends, reactions used).
    };
  }
  function currentActor(state) {
    return state.order[state.turnIndex] ?? null;
  }
  function spend(state, actorId, cost, amount = 1) {
    if (!ACTION_COSTS.includes(cost)) {
      return { allowed: false, reason: `unknown cost: ${cost}` };
    }
    if (cost === "free") return { allowed: true, state };
    const budget = state.budgets[actorId];
    if (!budget) return { allowed: false, reason: `unknown actor: ${actorId}` };
    const current = budget[cost];
    if (current === null) return { allowed: false, reason: `no ${cost} budget` };
    if (current < amount) return { allowed: false, reason: `insufficient ${cost} (have ${current}, need ${amount})` };
    const next = {
      ...state,
      budgets: { ...state.budgets, [actorId]: { ...budget, [cost]: current - amount } }
    };
    return { allowed: true, state: next };
  }
  function endTurn(state) {
    if (state.order.length === 0) return { state, finished: true };
    let next = (state.turnIndex + 1) % state.order.length;
    let round = state.round;
    if (next === 0) round += 1;
    const nextActor = state.order[next];
    const refreshedBudgets = {
      ...state.budgets,
      [nextActor.id]: freshBudget(nextActor.speed)
    };
    return {
      state: {
        ...state,
        turnIndex: next,
        round,
        budgets: refreshedBudgets,
        log: [...state.log, { kind: "turn-end", round: state.round, actorId: state.order[state.turnIndex]?.id }]
      },
      finished: false
    };
  }
  function removeParticipant(state, actorId) {
    const idx = state.order.findIndex((p) => p.id === actorId);
    if (idx === -1) return state;
    const newOrder = state.order.filter((p) => p.id !== actorId);
    const newBudgets = { ...state.budgets };
    delete newBudgets[actorId];
    let newIndex = state.turnIndex;
    if (idx < state.turnIndex) newIndex -= 1;
    if (newIndex >= newOrder.length) newIndex = 0;
    return {
      ...state,
      order: newOrder,
      turnIndex: newIndex,
      budgets: newBudgets,
      log: [...state.log, { kind: "remove", actorId }]
    };
  }
  function attacksPerAction(classDef, level) {
    if (!classDef || typeof classDef !== "object") return 1;
    const table = classDef.extraAttacks;
    if (!table) return 1;
    let best = 0;
    for (const [lvl, extra] of Object.entries(table)) {
      if (level >= Number(lvl) && extra > best) best = extra;
    }
    return 1 + best;
  }
  function opportunityAttack(state, { reactorId, attackerArgs, disengaged = false, rng = Math.random, rules = DEFAULT_RULES }) {
    if (disengaged) return { triggered: false, reason: "disengaged", state };
    const reactor = state.order.find((p) => p.id === reactorId);
    if (!reactor) return { triggered: false, reason: "reactor not in encounter", state };
    const spent = spend(state, reactorId, "reaction");
    if (!spent.allowed) return { triggered: false, reason: spent.reason, state };
    const result = attackRoll(attackerArgs, rng, rules);
    const nextState = {
      ...spent.state,
      log: [...spent.state.log, { kind: "opportunity-attack", reactorId, hit: result.hit }]
    };
    return { triggered: true, attack: result, state: nextState };
  }
  var COVER_BONUSES = Object.freeze({
    none: 0,
    half: 2,
    "three-quarters": 5,
    full: null
  });
  function effectiveAc(baseAc, cover = "none") {
    if (!Object.prototype.hasOwnProperty.call(COVER_BONUSES, cover)) {
      throw new Error(`Unknown cover: ${cover}. Known: ${Object.keys(COVER_BONUSES).join(", ")}`);
    }
    const bonus = COVER_BONUSES[cover];
    if (bonus === null) return null;
    return baseAc + bonus;
  }
  function rangeBand({ distance, normalRange, longRange }) {
    if (!Number.isFinite(distance) || distance < 0) {
      throw new Error("distance must be a non-negative number");
    }
    if (distance <= normalRange) return "in-range-normal";
    if (distance <= longRange) return "in-range-long";
    return "out-of-range";
  }
  function spendAndReturn(state, actorId, cost, amount, fields) {
    const r = spend(state, actorId, cost, amount);
    if (!r.allowed) return r;
    return { allowed: true, state: r.state, ...fields };
  }
  function dash(state, actorId) {
    const r = spend(state, actorId, "action");
    if (!r.allowed) return r;
    const participant = state.order.find((p) => p.id === actorId);
    const extra = participant?.speed ?? 0;
    const budget = r.state.budgets[actorId];
    const newBudgets = {
      ...r.state.budgets,
      [actorId]: { ...budget, movement: (budget.movement ?? 0) + extra }
    };
    return {
      allowed: true,
      state: {
        ...r.state,
        budgets: newBudgets,
        log: [...r.state.log, { kind: "dash", actorId, extra }]
      }
    };
  }
  function disengage(state, actor) {
    return spendAndReturn(state, actor.id, "action", 1, {
      actor: { ...actor, disengaged: true }
    });
  }
  function dodge(state, actor) {
    return spendAndReturn(state, actor.id, "action", 1, {
      actor: { ...actor, dodging: true }
    });
  }
  function help(state, actor, args = {}) {
    const targetId = args.targetId;
    if (typeof targetId !== "string" || targetId.length === 0) {
      return { allowed: false, reason: "args.targetId required" };
    }
    return spendAndReturn(state, actor.id, "action", 1, {
      actor: { ...actor, helping: { targetId } }
    });
  }
  function hide(state, actor) {
    return spendAndReturn(state, actor.id, "action", 1, {
      actor,
      // unchanged — host applies `hidden: true` on a successful check
      result: { needsStealthCheck: true }
    });
  }
  function ready(state, actor, args = {}) {
    const { trigger: trigger2, action } = args;
    if (typeof trigger2 !== "string" || trigger2.length === 0) {
      return { allowed: false, reason: "args.trigger required" };
    }
    if (typeof action !== "string" || action.length === 0) {
      return { allowed: false, reason: "args.action required" };
    }
    const a = spend(state, actor.id, "action");
    if (!a.allowed) return a;
    const b = spend(a.state, actor.id, "reaction");
    if (!b.allowed) return b;
    return {
      allowed: true,
      state: b.state,
      actor: { ...actor, readied: { trigger: trigger2, action } }
    };
  }
  function ability(state, actor, args = {}) {
    const kind = args.kind;
    if (!["search", "study", "influence"].includes(kind)) {
      return { allowed: false, reason: "args.kind must be search / study / influence" };
    }
    const r = spend(state, actor.id, "action");
    if (!r.allowed) return r;
    return {
      allowed: true,
      state: {
        ...r.state,
        log: [...r.state.log, { kind, actorId: actor.id }]
      },
      actor,
      result: { needsCheck: true, kind }
    };
  }
  function grapple(state, actor, args = {}) {
    const proficiencyBonus = actor.proficiencyBonus ?? 2;
    const strMod2 = modFromScore(actor.abilityScores?.str ?? 10);
    const dc = 8 + strMod2 + proficiencyBonus;
    const r = spend(state, actor.id, "action");
    if (!r.allowed) return r;
    return {
      allowed: true,
      state: r.state,
      actor,
      result: {
        save: { dc, abilities: ["str", "dex"] },
        onFail: { condition: "grappled" },
        targetId: args.targetId
      }
    };
  }
  function shove(state, actor, args = {}) {
    const choice = args.choice ?? "prone";
    if (!["prone", "push"].includes(choice)) {
      return { allowed: false, reason: "args.choice must be 'prone' or 'push'" };
    }
    const proficiencyBonus = actor.proficiencyBonus ?? 2;
    const strMod2 = modFromScore(actor.abilityScores?.str ?? 10);
    const dc = 8 + strMod2 + proficiencyBonus;
    const r = spend(state, actor.id, "action");
    if (!r.allowed) return r;
    const onFail = choice === "prone" ? { condition: "prone" } : { pushFt: 5 };
    return {
      allowed: true,
      state: r.state,
      actor,
      result: {
        save: { dc, abilities: ["str", "dex"] },
        onFail,
        choice,
        targetId: args.targetId
      }
    };
  }
  function offHandAttack(state, actor, args = {}) {
    if (!args.weapon) return { allowed: false, reason: "args.weapon required" };
    return spendAndReturn(state, actor.id, "bonus", 1, {
      actor,
      result: { suppressPositiveAbilityMod: true, weapon: args.weapon }
    });
  }
  function improvisedAttack({ damageDie = "d4", damageType = "bludgeoning", proficient = false } = {}) {
    return {
      damageDice: `1${damageDie}`,
      damageType,
      proficient
    };
  }

  // vendor/bag-of-holding/src/spellcasting.js
  var spellcasting_exports = {};
  __export(spellcasting_exports, {
    AOE_SHAPES: () => AOE_SHAPES,
    cantripTier: () => cantripTier,
    castAsRitual: () => castAsRitual,
    castSpell: () => castSpell,
    castSpellSave: () => castSpellSave,
    concentrationSaveDC: () => concentrationSaveDC,
    consumeSlot: () => consumeSlot,
    endConcentration: () => endConcentration,
    freshSlots: () => freshSlots,
    fullCasterSlots: () => fullCasterSlots,
    halfCasterSlots: () => halfCasterSlots,
    longRest: () => longRest,
    preparedSpellCount: () => preparedSpellCount,
    refundSlot: () => refundSlot,
    scaledDamageSpec: () => scaledDamageSpec,
    shortRest: () => shortRest,
    startConcentration: () => startConcentration,
    targetsInArea: () => targetsInArea,
    validatePreparation: () => validatePreparation,
    warlockPactSlots: () => warlockPactSlots
  });
  function fullCasterSlots(casterLevel2, spellLevel) {
    if (!Number.isInteger(casterLevel2) || casterLevel2 < 1 || casterLevel2 > 20) {
      throw new Error(`casterLevel out of range: ${casterLevel2}`);
    }
    if (!Number.isInteger(spellLevel) || spellLevel < 1 || spellLevel > 9) {
      throw new Error(`spellLevel out of range: ${spellLevel}`);
    }
    return FULL_CASTER_TABLE[casterLevel2 - 1][spellLevel];
  }
  var FULL_CASTER_TABLE = [
    /* L1  */
    [0, 2, 0, 0, 0, 0, 0, 0, 0, 0],
    /* L2  */
    [0, 3, 0, 0, 0, 0, 0, 0, 0, 0],
    /* L3  */
    [0, 4, 2, 0, 0, 0, 0, 0, 0, 0],
    /* L4  */
    [0, 4, 3, 0, 0, 0, 0, 0, 0, 0],
    /* L5  */
    [0, 4, 3, 2, 0, 0, 0, 0, 0, 0],
    /* L6  */
    [0, 4, 3, 3, 0, 0, 0, 0, 0, 0],
    /* L7  */
    [0, 4, 3, 3, 1, 0, 0, 0, 0, 0],
    /* L8  */
    [0, 4, 3, 3, 2, 0, 0, 0, 0, 0],
    /* L9  */
    [0, 4, 3, 3, 3, 1, 0, 0, 0, 0],
    /* L10 */
    [0, 4, 3, 3, 3, 2, 0, 0, 0, 0],
    /* L11 */
    [0, 4, 3, 3, 3, 2, 1, 0, 0, 0],
    /* L12 */
    [0, 4, 3, 3, 3, 2, 1, 0, 0, 0],
    /* L13 */
    [0, 4, 3, 3, 3, 2, 1, 1, 0, 0],
    /* L14 */
    [0, 4, 3, 3, 3, 2, 1, 1, 0, 0],
    /* L15 */
    [0, 4, 3, 3, 3, 2, 1, 1, 1, 0],
    /* L16 */
    [0, 4, 3, 3, 3, 2, 1, 1, 1, 0],
    /* L17 */
    [0, 4, 3, 3, 3, 2, 1, 1, 1, 1],
    /* L18 */
    [0, 4, 3, 3, 3, 3, 1, 1, 1, 1],
    /* L19 */
    [0, 4, 3, 3, 3, 3, 2, 1, 1, 1],
    /* L20 */
    [0, 4, 3, 3, 3, 3, 2, 2, 1, 1]
  ];
  function halfCasterSlots(casterLevel2, spellLevel) {
    if (!Number.isInteger(casterLevel2) || casterLevel2 < 1 || casterLevel2 > 20) {
      throw new Error(`casterLevel out of range: ${casterLevel2}`);
    }
    if (!Number.isInteger(spellLevel) || spellLevel < 1 || spellLevel > 5) {
      throw new Error(`spellLevel out of range for half-caster: ${spellLevel}`);
    }
    if (casterLevel2 < 2) return 0;
    return HALF_CASTER_TABLE[casterLevel2 - 2][spellLevel];
  }
  var HALF_CASTER_TABLE = [
    /* L2  */
    [0, 2, 0, 0, 0, 0],
    /* L3  */
    [0, 3, 0, 0, 0, 0],
    /* L4  */
    [0, 3, 0, 0, 0, 0],
    /* L5  */
    [0, 4, 2, 0, 0, 0],
    /* L6  */
    [0, 4, 2, 0, 0, 0],
    /* L7  */
    [0, 4, 3, 0, 0, 0],
    /* L8  */
    [0, 4, 3, 0, 0, 0],
    /* L9  */
    [0, 4, 3, 2, 0, 0],
    /* L10 */
    [0, 4, 3, 2, 0, 0],
    /* L11 */
    [0, 4, 3, 3, 0, 0],
    /* L12 */
    [0, 4, 3, 3, 0, 0],
    /* L13 */
    [0, 4, 3, 3, 1, 0],
    /* L14 */
    [0, 4, 3, 3, 1, 0],
    /* L15 */
    [0, 4, 3, 3, 2, 0],
    /* L16 */
    [0, 4, 3, 3, 2, 0],
    /* L17 */
    [0, 4, 3, 3, 3, 1],
    /* L18 */
    [0, 4, 3, 3, 3, 1],
    /* L19 */
    [0, 4, 3, 3, 3, 2],
    /* L20 */
    [0, 4, 3, 3, 3, 2]
  ];
  function warlockPactSlots(casterLevel2) {
    if (!Number.isInteger(casterLevel2) || casterLevel2 < 1 || casterLevel2 > 20) {
      throw new Error(`casterLevel out of range: ${casterLevel2}`);
    }
    const table = [
      /*  L1 */
      { count: 1, level: 1 },
      /*  L2 */
      { count: 2, level: 1 },
      /*  L3 */
      { count: 2, level: 2 },
      /*  L4 */
      { count: 2, level: 2 },
      /*  L5 */
      { count: 2, level: 3 },
      /*  L6 */
      { count: 2, level: 3 },
      /*  L7 */
      { count: 2, level: 4 },
      /*  L8 */
      { count: 2, level: 4 },
      /*  L9 */
      { count: 2, level: 5 },
      /* L10 */
      { count: 2, level: 5 },
      /* L11 */
      { count: 3, level: 5 },
      /* L12 */
      { count: 3, level: 5 },
      /* L13 */
      { count: 3, level: 5 },
      /* L14 */
      { count: 3, level: 5 },
      /* L15 */
      { count: 3, level: 5 },
      /* L16 */
      { count: 3, level: 5 },
      /* L17 */
      { count: 4, level: 5 },
      /* L18 */
      { count: 4, level: 5 },
      /* L19 */
      { count: 4, level: 5 },
      /* L20 */
      { count: 4, level: 5 }
    ];
    return table[casterLevel2 - 1];
  }
  function freshSlots(progression, casterLevel2) {
    if (progression === "none") return [];
    const out = [];
    if (progression === "warlock") {
      const { count, level } = warlockPactSlots(casterLevel2);
      out.push({ level, used: 0, max: count, source: "pact" });
      return out;
    }
    const slotFn = progression === "full" ? fullCasterSlots : halfCasterSlots;
    const maxLevel = progression === "full" ? 9 : 5;
    for (let spellLevel = 1; spellLevel <= maxLevel; spellLevel++) {
      const max = slotFn(casterLevel2, spellLevel);
      if (max > 0) out.push({ level: spellLevel, used: 0, max });
    }
    return out;
  }
  function consumeSlot(slots, level) {
    if (!Array.isArray(slots)) throw new Error("slots must be an array");
    if (!Number.isInteger(level) || level < 1) {
      throw new Error("level must be a positive integer");
    }
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (s.level >= level && s.used < s.max) {
        const next = slots.slice();
        next[i] = { ...s, used: s.used + 1 };
        return { ok: true, slots: next, levelCast: s.level };
      }
    }
    return { ok: false, reason: `no slot of level ${level}+ available` };
  }
  function refundSlot(slots, level) {
    const i = slots.findIndex((s) => s.level === level);
    if (i === -1) return slots;
    if (slots[i].used === 0) return slots;
    const next = slots.slice();
    next[i] = { ...slots[i], used: slots[i].used - 1 };
    return next;
  }
  function longRest(slots) {
    return slots.map((s) => ({ ...s, used: 0 }));
  }
  function shortRest(slots) {
    return slots.map((s) => s.source === "pact" ? { ...s, used: 0 } : s);
  }
  function startConcentration(actor, { spellId, level }) {
    const previous = actor.concentration ?? null;
    return {
      actor: { ...actor, concentration: { spellId, level } },
      dropped: previous
    };
  }
  function concentrationSaveDC(damageTaken) {
    if (!Number.isFinite(damageTaken) || damageTaken < 0) {
      throw new Error("damageTaken must be a non-negative number");
    }
    return Math.max(10, Math.floor(damageTaken / 2));
  }
  function endConcentration(actor) {
    if (!actor.concentration) return actor;
    const { concentration: _, ...rest } = actor;
    return rest;
  }
  var DICE_PATTERN = /^(\d+)d(\d+)([+-]\d+)?$/;
  function cantripTier(casterLevel2) {
    if (casterLevel2 >= 17) return 4;
    if (casterLevel2 >= 11) return 3;
    if (casterLevel2 >= 5) return 2;
    return 1;
  }
  function scaledDamageSpec(baseSpec, casterLevel2) {
    const m = DICE_PATTERN.exec(String(baseSpec).trim());
    if (!m) return baseSpec;
    const tier = cantripTier(casterLevel2);
    const count = Number(m[1]) * tier;
    const modifier = m[3] ?? "";
    return `${count}d${m[2]}${modifier}`;
  }
  function preparedSpellCount({ casterLevel: casterLevel2, abilityMod, progression = "full" }) {
    if (!Number.isInteger(casterLevel2) || casterLevel2 < 1) {
      throw new Error("casterLevel must be a positive integer");
    }
    if (!Number.isInteger(abilityMod)) {
      throw new Error("abilityMod must be an integer");
    }
    const levelPortion = progression === "half" ? Math.floor(casterLevel2 / 2) : casterLevel2;
    return Math.max(1, abilityMod + levelPortion);
  }
  function validatePreparation({ known, prepared, casterLevel: casterLevel2, abilityMod, progression }) {
    if (!Array.isArray(known) || !Array.isArray(prepared)) {
      return { valid: false, reason: "known and prepared must be arrays" };
    }
    const knownSet = new Set(known);
    for (const id of prepared) {
      if (!knownSet.has(id)) return { valid: false, reason: `prepared spell not in known list: ${id}` };
    }
    const max = preparedSpellCount({ casterLevel: casterLevel2, abilityMod, progression });
    if (prepared.length > max) {
      return { valid: false, reason: `prepared count ${prepared.length} exceeds budget ${max}` };
    }
    return { valid: true };
  }
  function castSpell(actor, spell, args = {}) {
    const components = spell.components ?? {};
    if (components.v && actor.silenced === true) {
      return { ok: false, reason: "silenced \u2014 cannot speak the Verbal component" };
    }
    if (components.s && actor.somaticBlocked === true) {
      return { ok: false, reason: "no free hand for the Somatic component" };
    }
    if (components.m?.cost && actor.materials?.[spell.id] !== true) {
      return { ok: false, reason: `missing material component for ${spell.id}` };
    }
    if (spell.level > 0 && args.alreadyCastLeveledThisTurn === true) {
      return { ok: false, reason: "only one leveled spell can be cast per turn" };
    }
    let working = actor;
    if (args.ritual === true) {
      if (!spell.ritual) {
        return { ok: false, reason: "spell does not have the Ritual tag" };
      }
      const prepared = Array.isArray(actor.spellsPrepared) ? actor.spellsPrepared : [];
      if (!prepared.includes(spell.id)) {
        return { ok: false, reason: "ritual casting requires the spell to be prepared" };
      }
    } else if (spell.level > 0) {
      const slotLevel = args.slotLevel ?? spell.level;
      if (!Number.isInteger(slotLevel) || slotLevel < 1) {
        return { ok: false, reason: "slotLevel must be a positive integer" };
      }
      if (slotLevel < spell.level) {
        return { ok: false, reason: `slot level ${slotLevel} below spell's base level ${spell.level}` };
      }
      if (!Array.isArray(actor.spellSlots)) {
        return { ok: false, reason: "actor has no spellSlots" };
      }
      const slotResult = consumeSlot(actor.spellSlots, slotLevel);
      if (!slotResult.ok) return { ok: false, reason: slotResult.reason };
      working = { ...working, spellSlots: slotResult.slots };
    }
    if (spell.concentration === true) {
      const result = startConcentration(working, { spellId: spell.id, level: args.slotLevel ?? spell.level });
      working = result.actor;
    }
    const castLevel = args.ritual === true ? spell.level : args.slotLevel ?? spell.level;
    const upcastEffect = typeof spell.upcast === "function" ? spell.upcast(castLevel) : null;
    return {
      ok: true,
      actor: working,
      castLevel,
      upcastEffect,
      ritual: args.ritual === true
    };
  }
  function castAsRitual(actor, spell, args = {}) {
    return castSpell(actor, spell, { ...args, ritual: true });
  }
  var AOE_SHAPES = Object.freeze(["sphere", "cube", "cone", "line", "cylinder", "emanation"]);
  function distance2D(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function inCone2D(origin, direction, range, point) {
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance === 0) return true;
    if (distance > range) return false;
    const dirLen = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    const cosAngle = (dx * direction.x + dy * direction.y) / (distance * dirLen);
    return cosAngle >= 0.8944;
  }
  function inLine2D(origin, direction, length, width, point) {
    const dirLen = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    const ux = direction.x / dirLen;
    const uy = direction.y / dirLen;
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    const along = dx * ux + dy * uy;
    const perp = Math.abs(-dx * uy + dy * ux);
    return along >= 0 && along <= length && perp <= width / 2;
  }
  function targetsInArea({ origin, shape, size, direction, width = 5, candidates }) {
    if (!AOE_SHAPES.includes(shape)) {
      throw new Error(`Unknown AoE shape: ${shape}. Known: ${AOE_SHAPES.join(", ")}`);
    }
    if ((shape === "cone" || shape === "line") && (!direction || direction.x === 0 && direction.y === 0)) {
      throw new Error(`${shape} requires a non-zero direction vector`);
    }
    if (!Array.isArray(candidates)) {
      throw new Error("candidates must be an array");
    }
    const inside = (p) => {
      if (shape === "sphere" || shape === "cylinder" || shape === "emanation") {
        return distance2D(origin, p) <= size;
      }
      if (shape === "cube") {
        return Math.abs(p.x - origin.x) <= size && Math.abs(p.y - origin.y) <= size;
      }
      if (shape === "cone") return inCone2D(origin, direction, size, p);
      return inLine2D(origin, direction, size, width, p);
    };
    return candidates.filter((c) => inside(c.position));
  }
  function castSpellSave(results, { halfOnSuccess = true } = {}) {
    if (!Array.isArray(results)) {
      throw new Error("results must be an array");
    }
    return results.map((r) => ({
      targetId: r.targetId,
      saved: r.saved === true,
      appliedDamage: r.saved ? halfOnSuccess ? Math.floor((r.damage ?? 0) / 2) : 0 : r.damage ?? 0
    }));
  }

  // vendor/bag-of-holding/src/rest.js
  function spendHitDie(actor, rng = Math.random) {
    if (!Number.isInteger(actor.hitDie) || actor.hitDie < 1) {
      throw new Error("spendHitDie: actor.hitDie must be a positive integer");
    }
    const total = actor.hitDiceTotal ?? actor.level ?? 0;
    const used = actor.hitDiceUsed ?? 0;
    if (used >= total) return { healed: 0, hpAfter: actor.hp ?? 0, actor };
    const conMod = modFromScore(actor.abilityScores?.con ?? 10);
    const die = rollDie(actor.hitDie, rng);
    const raw = Math.max(1, die + conMod);
    const hpBefore = actor.hp ?? 0;
    const hpMax = actor.hpMax ?? Infinity;
    const hpAfter = Math.min(hpBefore + raw, hpMax);
    return {
      die,
      // raw face for logging / replay
      conMod,
      healed: hpAfter - hpBefore,
      hpAfter,
      actor: { ...actor, hp: hpAfter, hitDiceUsed: used + 1 }
    };
  }
  function halfHitDiceRecovered(total) {
    return Math.max(1, Math.floor(total / 2));
  }
  function longRest2(actor, rules = DEFAULT_RULES) {
    const total = actor.hitDiceTotal ?? actor.level ?? 0;
    const used = actor.hitDiceUsed ?? 0;
    const mode = rules.longRestHitDiceRecovery;
    let recovered;
    if (mode === "all") recovered = used;
    else if (mode === "none") recovered = 0;
    else recovered = halfHitDiceRecovered(total);
    const nextUsed = Math.max(0, used - recovered);
    const hpMax = actor.hpMax ?? actor.hp ?? 0;
    let next = { ...actor, hp: hpMax, hitDiceUsed: nextUsed };
    if (next.deathSaves) next = { ...next, deathSaves: freshDeathSaves() };
    next = exhaustion.reduce(next, 1);
    if (Array.isArray(next.spellSlots)) {
      next = { ...next, spellSlots: longRest(next.spellSlots) };
    }
    next = refreshResources(next, "long");
    return next;
  }
  function shortRest2(actor) {
    let next = actor;
    if (Array.isArray(next.spellSlots)) {
      next = { ...next, spellSlots: shortRest(next.spellSlots) };
    }
    next = refreshResources(next, "short");
    return next;
  }

  // vendor/bag-of-holding/src/scene-clock.js
  var DEFAULT_DAWN_MINUTE = 360;
  var DEFAULT_DUSK_MINUTE = 1080;
  var MINUTES_PER_DAY = 1440;
  function freshScene({ startMinute = DEFAULT_DAWN_MINUTE, dawnMinute = DEFAULT_DAWN_MINUTE, duskMinute = DEFAULT_DUSK_MINUTE } = {}) {
    if (!Number.isInteger(startMinute) || startMinute < 0) {
      throw new Error("freshScene: startMinute must be a non-negative integer");
    }
    return { minutes: startMinute, dawnMinute, duskMinute };
  }
  function advanceTime(scene, delta = {}) {
    if (!scene || typeof scene !== "object") {
      throw new Error("advanceTime: scene must be an object");
    }
    const minutesDelta = (delta.minutes ?? 0) + (delta.hours ?? 0) * 60 + (delta.days ?? 0) * MINUTES_PER_DAY + Math.floor((delta.rounds ?? 0) / 10);
    if (minutesDelta < 0) {
      throw new Error("advanceTime: scene clocks only move forward");
    }
    const before = scene.minutes ?? 0;
    const after = before + minutesDelta;
    const dawn = scene.dawnMinute ?? DEFAULT_DAWN_MINUTE;
    const dusk = scene.duskMinute ?? DEFAULT_DUSK_MINUTE;
    const events = [];
    let cursor = before;
    while (cursor < after) {
      const dayStart = Math.floor(cursor / MINUTES_PER_DAY) * MINUTES_PER_DAY;
      const dawnAt = dayStart + dawn;
      const duskAt = dayStart + dusk;
      const nextEdges = [dawnAt, duskAt, dayStart + MINUTES_PER_DAY].filter((m) => m > cursor && m <= after).sort((a, b) => a - b);
      if (nextEdges.length === 0) break;
      for (const edge of nextEdges) {
        if (edge === dayStart + MINUTES_PER_DAY) continue;
        if (edge === dawnAt) events.push("dawn");
        else if (edge === duskAt) events.push("dusk");
      }
      cursor = nextEdges[nextEdges.length - 1];
    }
    return {
      scene: { ...scene, minutes: after },
      events
    };
  }
  function formatTimeOfDay(minutes) {
    const m = ((minutes ?? 0) % MINUTES_PER_DAY + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    const hh = Math.floor(m / 60).toString().padStart(2, "0");
    const mm = (m % 60).toString().padStart(2, "0");
    return `${hh}:${mm}`;
  }

  // vendor/bag-of-holding/src/magic-items.js
  var RARITY_BANDS = Object.freeze([
    "common",
    "uncommon",
    "rare",
    "veryRare",
    "legendary",
    "artifact"
  ]);
  var ATTUNEMENT_CAP = 3;
  var RECHARGE_KINDS = Object.freeze(["dawn", "dusk", "longRest", "shortRest"]);
  function canAttune(actor, item) {
    if (!item || typeof item !== "object") {
      return { ok: false, reason: "item must be an object" };
    }
    const attuned = Array.isArray(actor.attunedItems) ? actor.attunedItems : [];
    if (attuned.includes(item.id)) {
      return { ok: false, reason: "already attuned to this item" };
    }
    if (attuned.length >= ATTUNEMENT_CAP) {
      return { ok: false, reason: `attunement cap reached (${ATTUNEMENT_CAP} items)` };
    }
    const req = item.requiresAttunement;
    if (req && typeof req === "object") {
      if (req.classId && actor.classId !== req.classId) {
        return { ok: false, reason: `requires class ${req.classId}` };
      }
      if (req.spellcaster === true && actor.spellcaster !== true) {
        return { ok: false, reason: "requires a spellcasting feature" };
      }
      if (req.abilityMin && typeof req.abilityMin === "object") {
        for (const [ability2, minimum] of Object.entries(req.abilityMin)) {
          const score = actor.abilityScores?.[ability2] ?? 10;
          if (score < minimum) {
            return { ok: false, reason: `requires ${ability2.toUpperCase()} ${minimum}+` };
          }
        }
      }
    }
    return { ok: true };
  }
  function attune(actor, item) {
    const check = canAttune(actor, item);
    if (!check.ok) return check;
    const attuned = Array.isArray(actor.attunedItems) ? actor.attunedItems : [];
    let next = { ...actor, attunedItems: [...attuned, item.id] };
    if (item.charges) {
      const existing = next.itemCharges ?? {};
      next = {
        ...next,
        itemCharges: { ...existing, [item.id]: { used: 0, max: item.charges.max } }
      };
    }
    return { ok: true, actor: next };
  }
  function unattune(actor, item, args = {}) {
    const attuned = Array.isArray(actor.attunedItems) ? actor.attunedItems : [];
    if (!attuned.includes(item.id)) {
      return { ok: false, reason: "not attuned to this item" };
    }
    if (item.cursed && args.removeCurseApplied !== true) {
      return { ok: false, reason: "item is cursed; cannot voluntarily un-attune without Remove Curse" };
    }
    const nextAttuned = attuned.filter((id) => id !== item.id);
    let next = { ...actor, attunedItems: nextAttuned };
    if (next.itemCharges?.[item.id]) {
      const { [item.id]: _, ...rest } = next.itemCharges;
      next = { ...next, itemCharges: rest };
    }
    return { ok: true, actor: next };
  }
  function spendCharge(actor, itemId, amount = 1) {
    if (!Number.isInteger(amount) || amount < 1) {
      throw new Error("spendCharge: amount must be a positive integer");
    }
    const charges = actor.itemCharges?.[itemId];
    if (!charges) return { ok: false, reason: `no charge state for item: ${itemId}` };
    const remaining = charges.max - charges.used;
    if (remaining < amount) {
      return { ok: false, reason: `not enough charges: ${remaining} left, ${amount} needed` };
    }
    return {
      ok: true,
      actor: {
        ...actor,
        itemCharges: {
          ...actor.itemCharges,
          [itemId]: { ...charges, used: charges.used + amount }
        }
      }
    };
  }
  function rechargeItem(actor, item, rng = Math.random) {
    if (!item || typeof item !== "object") {
      return { ok: false, reason: "item must be an object" };
    }
    const charges = actor.itemCharges?.[item.id];
    if (!charges) return { ok: false, reason: `no charge state for item: ${item.id}` };
    const recoverSpec = item.charges?.recovers;
    let newUsed;
    if (typeof recoverSpec === "number") {
      newUsed = Math.max(0, charges.used - recoverSpec);
    } else if (typeof recoverSpec === "string") {
      newUsed = Math.max(0, charges.used - parseDiceSpec(recoverSpec, rng));
    } else {
      newUsed = 0;
    }
    const recovered = charges.used - newUsed;
    return {
      ok: true,
      recovered,
      actor: {
        ...actor,
        itemCharges: {
          ...actor.itemCharges,
          [item.id]: { ...charges, used: newUsed }
        }
      }
    };
  }
  function parseDiceSpec(spec, rng) {
    const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(String(spec).trim());
    if (!m) throw new Error(`rechargeItem: invalid dice spec: ${spec}`);
    const count = Number(m[1]);
    const sides = Number(m[2]);
    const mod = m[3] ? Number(m[3]) : 0;
    let total = mod;
    for (let i = 0; i < count; i++) total += rollDie(sides, rng);
    return total;
  }
  function identifyItem(actor, itemId) {
    const known = Array.isArray(actor.identifiedItems) ? actor.identifiedItems : [];
    if (known.includes(itemId)) return actor;
    return { ...actor, identifiedItems: [...known, itemId] };
  }
  function isIdentified(actor, itemId) {
    return Array.isArray(actor.identifiedItems) && actor.identifiedItems.includes(itemId);
  }
  function itemSavingThrow(item, dc, rng = Math.random) {
    if (!item.savingThrow) {
      return { d20: 0, total: 0, success: true, noSave: true };
    }
    const bonus = item.savingThrow.bonus ?? 0;
    const d20 = rollDie(20, rng);
    const total = d20 + bonus;
    return { d20, total, success: total >= dc };
  }

  // vendor/bag-of-holding/src/monsters.js
  function multiattackSequence(monster) {
    if (!monster.multiattack || !Array.isArray(monster.multiattack.attacks)) {
      return [];
    }
    return monster.multiattack.attacks.slice();
  }
  function freshLegendaryState(monster) {
    if (!monster.legendaryActions) return null;
    const max = monster.legendaryActions.uses ?? 3;
    return { used: 0, max };
  }
  function useLegendaryAction(actor, monster, optionId, cost = 1) {
    if (!monster.legendaryActions) {
      return { ok: false, reason: "monster has no Legendary Actions" };
    }
    if (!Number.isInteger(cost) || cost < 1) {
      throw new Error("useLegendaryAction: cost must be a positive integer");
    }
    const pool = actor.legendary ?? freshLegendaryState(monster);
    if (pool.max - pool.used < cost) {
      return { ok: false, reason: `not enough legendary uses: ${pool.max - pool.used} left` };
    }
    const option = monster.legendaryActions.options?.find((o) => o.id === optionId);
    if (!option) {
      return { ok: false, reason: `unknown legendary option: ${optionId}` };
    }
    return {
      ok: true,
      option,
      actor: {
        ...actor,
        legendary: { ...pool, used: pool.used + cost }
      }
    };
  }
  function refreshLegendaryActions(actor) {
    if (!actor.legendary) return actor;
    if (actor.legendary.used === 0) return actor;
    return { ...actor, legendary: { ...actor.legendary, used: 0 } };
  }
  function freshLegendaryResistance(monster) {
    if (!monster.legendaryResistance) return null;
    const max = monster.legendaryResistance.uses ?? 3;
    return { used: 0, max };
  }
  function useLegendaryResistance(actor, monster) {
    if (!monster.legendaryResistance) {
      return { ok: false, reason: "monster has no Legendary Resistance" };
    }
    const pool = actor.legendaryResistance ?? freshLegendaryResistance(monster);
    if (pool.used >= pool.max) {
      return { ok: false, reason: "Legendary Resistance pool exhausted" };
    }
    return {
      ok: true,
      actor: {
        ...actor,
        legendaryResistance: { ...pool, used: pool.used + 1 }
      }
    };
  }
  function lairActionAvailable(monster, args = {}) {
    if (!monster.lairActions) return false;
    if (args.inLair !== true) return false;
    const trigger2 = monster.lairActions.triggersOnInitiative ?? 20;
    return args.initiativeCount === trigger2;
  }
  function fireLairAction(monster, optionId) {
    if (!monster.lairActions) {
      return { ok: false, reason: "monster has no Lair Actions" };
    }
    const option = monster.lairActions.options?.find((o) => o.id === optionId);
    if (!option) {
      return { ok: false, reason: `unknown lair-action option: ${optionId}` };
    }
    return { ok: true, option };
  }
  function freshInnateState(monster) {
    const innate = monster.innateSpellcasting;
    if (!innate) return null;
    const out = {};
    for (const id of innate["3day"] ?? []) out[id] = { used: 0, max: 3 };
    for (const id of innate["1day"] ?? []) out[id] = { used: 0, max: 1 };
    return out;
  }
  function castInnate(actor, monster, spellId) {
    const innate = monster.innateSpellcasting;
    if (!innate) return { ok: false, reason: "monster has no innate spellcasting" };
    const atWill = (innate.atWill ?? []).includes(spellId);
    if (atWill) return { ok: true, actor, atWill: true };
    const tracked = actor.innateSpells ?? freshInnateState(monster);
    const counter = tracked?.[spellId];
    if (!counter) return { ok: false, reason: `${spellId} is not in this monster's innate list` };
    if (counter.used >= counter.max) {
      return { ok: false, reason: `${spellId} has no uses remaining today` };
    }
    return {
      ok: true,
      actor: {
        ...actor,
        innateSpells: { ...tracked, [spellId]: { ...counter, used: counter.used + 1 } }
      }
    };
  }
  function refreshInnateSpells(actor, monster) {
    if (!monster.innateSpellcasting) return actor;
    const fresh = freshInnateState(monster);
    return { ...actor, innateSpells: fresh };
  }
  function senses(monster) {
    return monster.senses ?? {};
  }
  function saveBonus(monster, ability2) {
    const trained = monster.saves?.[ability2];
    if (trained !== void 0) return trained;
    const score = monster.abilityScores?.[ability2] ?? 10;
    return Math.floor((score - 10) / 2);
  }

  // vendor/bag-of-holding/src/movement.js
  var MOVEMENT_MODES = Object.freeze(["walk", "fly", "swim", "climb", "burrow"]);
  function speedFor(actor, mode) {
    if (!MOVEMENT_MODES.includes(mode)) {
      throw new Error(`speedFor: unknown movement mode: ${mode}`);
    }
    const speeds = actor.speeds;
    if (speeds && Number.isInteger(speeds[mode])) return speeds[mode];
    if (mode === "walk" && Number.isInteger(actor.speed)) return actor.speed;
    return 0;
  }
  function movementCost(feet, { difficult = false, crawling = false } = {}) {
    if (!Number.isInteger(feet) || feet < 0) {
      throw new Error("movementCost: feet must be a non-negative integer");
    }
    let cost = feet;
    if (difficult) cost *= 2;
    if (crawling) cost *= 2;
    return cost;
  }
  function fall(distanceFt, rng = Math.random) {
    if (!Number.isFinite(distanceFt) || distanceFt < 0) {
      throw new Error("fall: distanceFt must be a non-negative number");
    }
    const dice = Math.min(20, Math.floor(distanceFt / 10));
    const rolls = [];
    let total = 0;
    for (let i = 0; i < dice; i++) {
      const face = rollDie(6, rng);
      rolls.push(face);
      total += face;
    }
    return { dice, total, rolls, prone: total > 0 };
  }
  function strMod(actor) {
    const score = actor.abilityScores?.str ?? 10;
    return Math.floor((score - 10) / 2);
  }
  function longJump(actor, { runningStart = true } = {}) {
    const mod = Math.max(0, strMod(actor));
    return runningStart ? mod : Math.floor(mod / 2);
  }
  function highJump(actor, { runningStart = true } = {}) {
    const base = Math.max(0, 3 + strMod(actor));
    return runningStart ? base : Math.floor(base / 2);
  }
  var LIGHT_LEVELS = Object.freeze(["bright", "dim", "darkness"]);
  function effectiveLight(viewer, { ambient, distanceFt }) {
    if (!LIGHT_LEVELS.includes(ambient)) {
      throw new Error(`effectiveLight: unknown ambient level: ${ambient}`);
    }
    const senses2 = viewer.senses ?? {};
    const truesight = senses2.truesight ?? 0;
    if (distanceFt <= truesight) return "bright";
    const blindsight = senses2.blindsight ?? 0;
    if (distanceFt <= blindsight) return "bright";
    const darkvision = senses2.darkvision ?? 0;
    if (distanceFt <= darkvision) {
      if (ambient === "darkness") return "dim";
      if (ambient === "dim") return "bright";
    }
    return ambient;
  }
  function obscuredState(viewer, { ambient, distanceFt }) {
    const light = effectiveLight(viewer, { ambient, distanceFt });
    if (light === "darkness") return "heavy";
    if (light === "dim") return "light";
    return "none";
  }
  function hasLineOfSight(_observer, _target, obstacles = []) {
    return !obstacles.some((o) => o && o.blocksSight === true);
  }
  function hasLineOfEffect(_origin, _target, obstacles = []) {
    return !obstacles.some((o) => o && o.blocksEffect === true);
  }

  // vendor/bag-of-holding/src/multiclass.js
  var MULTICLASS_PREREQS = Object.freeze({
    barbarian: { requireAll: { str: 13 } },
    bard: { requireAll: { cha: 13 } },
    cleric: { requireAll: { wis: 13 } },
    druid: { requireAll: { wis: 13 } },
    fighter: { requireAny: { str: 13, dex: 13 } },
    monk: { requireAll: { dex: 13, wis: 13 } },
    paladin: { requireAll: { str: 13, cha: 13 } },
    ranger: { requireAll: { dex: 13, wis: 13 } },
    rogue: { requireAll: { dex: 13 } },
    sorcerer: { requireAll: { cha: 13 } },
    warlock: { requireAll: { cha: 13 } },
    wizard: { requireAll: { int: 13 } }
  });
  var CASTER_WEIGHT = Object.freeze({
    bard: 1,
    cleric: 1,
    druid: 1,
    sorcerer: 1,
    wizard: 1,
    paladin: 0.5,
    ranger: 0.5
    // Warlock is intentionally absent — Pact Magic is its own track.
    // Subclass-specific third-casters (eldritch-knight, arcane-trickster)
    // can be opted into via a custom CASTER_WEIGHT map per engine.
  });
  function totalLevel(record) {
    if (record.classes && typeof record.classes === "object") {
      let sum = 0;
      for (const lvl of Object.values(record.classes)) sum += lvl;
      return sum;
    }
    return record.level ?? 0;
  }
  function casterLevel(record, weights = CASTER_WEIGHT) {
    if (record.classes && typeof record.classes === "object") {
      let sum = 0;
      for (const [classId, lvl] of Object.entries(record.classes)) {
        const w2 = weights[classId] ?? 0;
        sum += w2 * lvl;
      }
      return Math.floor(sum);
    }
    const w = weights[record.classId] ?? 0;
    return Math.floor(w * (record.level ?? 0));
  }
  function canMulticlassInto(record, newClassId, prereqs = MULTICLASS_PREREQS) {
    if (!newClassId) return { ok: false, reason: "newClassId required" };
    const newReq = prereqs[newClassId];
    if (!newReq) return { ok: false, reason: `unknown class: ${newClassId}` };
    const currentClassIds = record.classes ? Object.keys(record.classes) : record.classId ? [record.classId] : [];
    const scores = record.abilityScores ?? {};
    const meetsReq = (req) => {
      if (req.requireAll) {
        for (const [ability2, minimum] of Object.entries(req.requireAll)) {
          if ((scores[ability2] ?? 10) < minimum) {
            return { ok: false, reason: `requires ${ability2.toUpperCase()} ${minimum}+` };
          }
        }
      }
      if (req.requireAny) {
        const passes = Object.entries(req.requireAny).some(
          ([ability2, minimum]) => (scores[ability2] ?? 10) >= minimum
        );
        if (!passes) {
          const abilities = Object.keys(req.requireAny).map((a) => a.toUpperCase()).join(" or ");
          const minimum = Object.values(req.requireAny)[0];
          return { ok: false, reason: `requires ${abilities} ${minimum}+` };
        }
      }
      return { ok: true };
    };
    for (const id of currentClassIds) {
      const req = prereqs[id];
      if (!req) continue;
      const check = meetsReq(req);
      if (!check.ok) return check;
    }
    const newCheck = meetsReq(newReq);
    if (!newCheck.ok) return newCheck;
    return { ok: true };
  }
  function languages(record) {
    return Object.freeze([...Array.isArray(record.languages) ? record.languages : []]);
  }
  function knowsLanguage(record, lang) {
    return Array.isArray(record.languages) && record.languages.includes(lang);
  }
  function tools(record) {
    return Object.freeze([...Array.isArray(record.tools) ? record.tools : []]);
  }
  function isProficientWithTool(record, tool) {
    return Array.isArray(record.tools) && record.tools.includes(tool);
  }

  // vendor/bag-of-holding/src/inspiration.js
  function hasInspiration(actor) {
    return actor.inspiration === true;
  }
  function grantInspiration(actor) {
    return actor.inspiration === true ? actor : { ...actor, inspiration: true };
  }
  function spendInspiration(actor) {
    if (actor.inspiration !== true) {
      return { ok: false, reason: "no Heroic Inspiration to spend" };
    }
    const { inspiration: _, ...rest } = actor;
    return { ok: true, actor: rest };
  }
  function applyHalflingLucky(originalD20, rng = Math.random) {
    if (originalD20 !== 1) {
      return { d20: originalD20, replaced: false, original: originalD20 };
    }
    const reroll = rollDie(20, rng);
    return { d20: reroll, replaced: true, original: 1 };
  }
  function rerollFailedSave({ actor, resourceId }, rng = Math.random) {
    const r = actor.resources?.[resourceId];
    if (!r || r.used >= r.max) {
      return { used: false, actor };
    }
    const newRoll = rollDie(20, rng);
    return {
      used: true,
      newRoll,
      actor: {
        ...actor,
        resources: {
          ...actor.resources,
          [resourceId]: { ...r, used: r.used + 1 }
        }
      }
    };
  }
  function groupCheck({ successes, total }) {
    if (!Number.isInteger(successes) || successes < 0) {
      throw new Error("groupCheck: successes must be a non-negative integer");
    }
    if (!Number.isInteger(total) || total < 1) {
      throw new Error("groupCheck: total must be a positive integer");
    }
    const threshold = Math.ceil(total / 2);
    return { success: successes >= threshold, threshold, successes, total };
  }
  function workingTogether({ allyProficient }) {
    return { advantage: allyProficient === true };
  }

  // vendor/bag-of-holding/src/encounter-design.js
  function xpForCR(cr) {
    if (typeof cr !== "number" || cr < 0) {
      throw new Error("xpForCR: cr must be a non-negative number");
    }
    if (cr === 0) return 10;
    if (cr === 1 / 8) return 25;
    if (cr === 1 / 4) return 50;
    if (cr === 1 / 2) return 100;
    const table = {
      1: 200,
      2: 450,
      3: 700,
      4: 1100,
      5: 1800,
      6: 2300,
      7: 2900,
      8: 3900,
      9: 5e3,
      10: 5900,
      11: 7200,
      12: 8400,
      13: 1e4,
      14: 11500,
      15: 13e3,
      16: 15e3,
      17: 18e3,
      18: 2e4,
      19: 22e3,
      20: 25e3,
      21: 33e3,
      22: 41e3,
      23: 5e4,
      24: 62e3,
      25: 75e3,
      26: 9e4,
      27: 105e3,
      28: 12e4,
      29: 135e3,
      30: 155e3
    };
    const value = table[cr];
    if (value === void 0) {
      throw new Error(`xpForCR: no XP for CR ${cr} (table covers 0..30 in 5e increments)`);
    }
    return value;
  }
  var ENCOUNTER_BUDGETS = Object.freeze({
    // PHB / DMG 2024 simplified table — XP per character.
    // (Values rounded to the SRD's per-character bands.)
    1: { low: 50, moderate: 75, high: 100 },
    2: { low: 100, moderate: 150, high: 200 },
    3: { low: 150, moderate: 225, high: 400 },
    4: { low: 250, moderate: 375, high: 500 },
    5: { low: 500, moderate: 750, high: 1100 },
    6: { low: 600, moderate: 1e3, high: 1400 },
    7: { low: 750, moderate: 1300, high: 1700 },
    8: { low: 1e3, moderate: 1700, high: 2100 },
    9: { low: 1300, moderate: 2e3, high: 2600 },
    10: { low: 1600, moderate: 2300, high: 3100 },
    11: { low: 1900, moderate: 2900, high: 4100 },
    12: { low: 2200, moderate: 3700, high: 4700 },
    13: { low: 2600, moderate: 4200, high: 5400 },
    14: { low: 2900, moderate: 4900, high: 6200 },
    15: { low: 3300, moderate: 5400, high: 7800 },
    16: { low: 3800, moderate: 6100, high: 9800 },
    17: { low: 4500, moderate: 7200, high: 11700 },
    18: { low: 5e3, moderate: 8700, high: 14200 },
    19: { low: 5500, moderate: 10700, high: 17200 },
    20: { low: 6400, moderate: 13200, high: 22e3 }
  });
  function budgetFor(partyLevels, difficulty) {
    if (!Array.isArray(partyLevels) || partyLevels.length === 0) {
      throw new Error("budgetFor: partyLevels must be a non-empty array");
    }
    if (!["low", "moderate", "high"].includes(difficulty)) {
      throw new Error("budgetFor: difficulty must be 'low', 'moderate', or 'high'");
    }
    let total = 0;
    for (const lvl of partyLevels) {
      const band = ENCOUNTER_BUDGETS[lvl];
      if (!band) throw new Error(`budgetFor: no budget for character level ${lvl}`);
      total += band[difficulty];
    }
    return total;
  }
  function classifyEncounter({ monsterCRs, partyLevels }) {
    if (!Array.isArray(monsterCRs)) {
      throw new Error("classifyEncounter: monsterCRs must be an array");
    }
    const xp = monsterCRs.reduce((sum, cr) => sum + xpForCR(cr), 0);
    const low = budgetFor(partyLevels, "low");
    const moderate = budgetFor(partyLevels, "moderate");
    const high = budgetFor(partyLevels, "high");
    let band;
    if (xp < low) band = "trivial";
    else if (xp < moderate) band = "low";
    else if (xp < high) band = "moderate";
    else if (xp === high) band = "high";
    else band = "deadly";
    return { xp, band, budgets: { low, moderate, high } };
  }

  // vendor/bag-of-holding/src/replay.js
  function stanceActors(stance) {
    if (stance === "advantage") {
      return { attacker: { conditions: ["invisible"] }, target: {} };
    }
    if (stance === "disadvantage") {
      return { attacker: { conditions: ["blinded"] }, target: {} };
    }
    return { attacker: void 0, target: void 0 };
  }
  var arraysEqual = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
  function verifyLog({ seed, log, rules: rulesOpt }) {
    const rng = seededRng(seed);
    const rules = rulesOpt === void 0 ? DEFAULT_RULES : buildRules(rulesOpt);
    for (let i = 0; i < log.length; i++) {
      const entry = log[i];
      let actual;
      switch (entry.op) {
        case "rollDie":
          actual = rollDie(entry.sides, rng);
          if (actual !== entry.value) {
            return { ok: false, divergedAt: i, expected: entry.value, actual };
          }
          break;
        case "roll":
          actual = roll(entry.spec, rng);
          if (actual.total !== entry.total || !arraysEqual(actual.rolls, entry.rolls)) {
            return { ok: false, divergedAt: i, expected: entry, actual };
          }
          break;
        case "rollAdvantage":
          actual = rollAdvantage(entry.spec, rng);
          if (actual.total !== entry.total || !arraysEqual(actual.rolls, entry.rolls)) {
            return { ok: false, divergedAt: i, expected: entry, actual };
          }
          break;
        case "rollDisadvantage":
          actual = rollDisadvantage(entry.spec, rng);
          if (actual.total !== entry.total || !arraysEqual(actual.rolls, entry.rolls)) {
            return { ok: false, divergedAt: i, expected: entry, actual };
          }
          break;
        case "rollInitiative":
          actual = rollInitiative({ dexterity: entry.dexterity }, rng);
          if (actual !== entry.value) {
            return { ok: false, divergedAt: i, expected: entry.value, actual };
          }
          break;
        case "attackRoll":
          if (entry.cancelled === true) break;
          actual = attackRoll({
            attackBonus: entry.attackBonus,
            ac: entry.ac,
            ...stanceActors(entry.stance ?? "normal")
          }, rng, rules);
          if (actual.d20 !== entry.d20 || actual.hit !== entry.hit) {
            return { ok: false, divergedAt: i, expected: entry, actual };
          }
          break;
        case "damageRoll":
          actual = damageRoll({
            damageDice: entry.damageDice,
            damageMod: entry.damageMod,
            critical: entry.critRolls.length > 0
          }, rng, rules);
          if (!arraysEqual(actual.baseRolls, entry.baseRolls) || !arraysEqual(actual.critRolls, entry.critRolls)) {
            return { ok: false, divergedAt: i, expected: entry, actual };
          }
          break;
        case "abilityCheck":
          actual = abilityCheck({
            abilityScore: entry.abilityScore,
            proficient: entry.proficient,
            proficiencyBonus: entry.proficiencyBonus,
            dc: entry.dc
          }, rng);
          if (actual.d20 !== entry.d20 || actual.success !== entry.success) {
            return { ok: false, divergedAt: i, expected: entry, actual };
          }
          break;
        case "savingThrow":
          actual = savingThrow({
            abilityScore: entry.abilityScore,
            proficient: entry.proficient,
            proficiencyBonus: entry.proficiencyBonus,
            dc: entry.dc
          }, rng);
          if (actual.d20 !== entry.d20 || actual.success !== entry.success) {
            return { ok: false, divergedAt: i, expected: entry, actual };
          }
          break;
        default:
          throw new Error(`Cannot replay unknown roll op: ${entry.op}`);
      }
    }
    return { ok: true };
  }

  // vendor/bag-of-holding/src/hooks.js
  var HOOK_EVENTS = Object.freeze([
    // Phase C — combat / progression events (since 0.3.0).
    "beforeAttack",
    "afterDamage",
    "onLevelUp",
    "onConditionApplied",
    "onDeath",
    // Phase D — turn lifecycle + scene events (since 1.6.0).
    // Hosts call `engine.Combat.turnStart` / `turnEnd` to fire the
    // first two; the engine fires the rest from the bound surfaces
    // (Rest.longRest, Rest.shortRest, Combat.applyDamage, casting).
    "onTurnStart",
    "onTurnEnd",
    "onLongRest",
    "onShortRest",
    "onCast",
    "onDamageApplied",
    "onHpChanged"
  ]);
  function buildHookRegistry(extras = {}) {
    if (extras === null || typeof extras !== "object" || Array.isArray(extras)) {
      throw new Error("hooks must be an object");
    }
    const handlers = {};
    for (const event of HOOK_EVENTS) handlers[event] = [];
    for (const [event, value] of Object.entries(extras)) {
      if (!HOOK_EVENTS.includes(event)) {
        throw new Error(`Unknown hook event: ${event}. Known: ${HOOK_EVENTS.join(", ")}`);
      }
      const list = Array.isArray(value) ? value : [value];
      for (const fn of list) {
        if (typeof fn !== "function") {
          throw new Error(`hooks.${event} entries must be functions`);
        }
        handlers[event].push(fn);
      }
    }
    function fire(event, payload) {
      let merged = { ...payload };
      for (const handler of handlers[event]) {
        const delta = handler(merged);
        if (delta && typeof delta === "object") {
          merged = { ...merged, ...delta };
          if (merged.cancelled === true) break;
        }
      }
      return merged;
    }
    function count(event) {
      if (!HOOK_EVENTS.includes(event)) {
        throw new Error(`Unknown hook event: ${event}`);
      }
      return handlers[event].length;
    }
    return Object.freeze({ fire, count, EVENTS: HOOK_EVENTS });
  }

  // vendor/bag-of-holding/src/srd/species.js
  var species_default = {
    human: { id: "human", name: "Human", size: "medium", speed: 30, traits: ["Resourceful", "Skillful", "Versatile"] },
    elf: { id: "elf", name: "Elf", size: "medium", speed: 30, traits: ["Darkvision 60ft", "Fey Ancestry", "Keen Senses", "Trance"] },
    dwarf: { id: "dwarf", name: "Dwarf", size: "medium", speed: 30, traits: ["Darkvision 120ft", "Dwarven Resilience", "Dwarven Toughness", "Stonecunning"] },
    halfling: { id: "halfling", name: "Halfling", size: "small", speed: 30, traits: ["Brave", "Halfling Nimbleness", "Luck", "Naturally Stealthy"] },
    dragonborn: { id: "dragonborn", name: "Dragonborn", size: "medium", speed: 30, traits: ["Draconic Ancestry", "Breath Weapon", "Damage Resistance", "Draconic Flight (L5)"] },
    gnome: { id: "gnome", name: "Gnome", size: "small", speed: 30, traits: ["Darkvision 60ft", "Gnomish Cunning"] },
    goliath: { id: "goliath", name: "Goliath", size: "medium", speed: 35, traits: ["Giant Ancestry", "Powerful Build", "Large Form (L5)"] },
    orc: { id: "orc", name: "Orc", size: "medium", speed: 30, traits: ["Adrenaline Rush", "Darkvision 120ft", "Powerful Build", "Relentless Endurance"] },
    tiefling: { id: "tiefling", name: "Tiefling", size: "medium", speed: 30, traits: ["Darkvision 60ft", "Fiendish Legacy", "Otherworldly Presence"] }
  };

  // vendor/bag-of-holding/src/srd/backgrounds.js
  var backgrounds_default = {
    "acolyte": {
      id: "acolyte",
      name: "Acolyte",
      abilityScores: ["int", "wis", "cha"],
      skillProficiencies: ["insight", "religion"],
      toolProficiency: "calligrapher-supplies",
      originFeat: { id: "magic-initiate", variant: "cleric" }
    },
    "criminal": {
      id: "criminal",
      name: "Criminal",
      abilityScores: ["dex", "con", "int"],
      skillProficiencies: ["sleight-of-hand", "stealth"],
      toolProficiency: "thieves-tools",
      originFeat: { id: "alert" }
    },
    "sage": {
      id: "sage",
      name: "Sage",
      abilityScores: ["con", "int", "wis"],
      skillProficiencies: ["arcana", "history"],
      toolProficiency: "calligrapher-supplies",
      originFeat: { id: "magic-initiate", variant: "wizard" }
    },
    "soldier": {
      id: "soldier",
      name: "Soldier",
      abilityScores: ["str", "dex", "con"],
      skillProficiencies: ["athletics", "intimidation"],
      toolProficiency: "gaming-set",
      originFeat: { id: "savage-attacker" }
    }
  };

  // vendor/bag-of-holding/src/srd/feats.js
  var feats_default = {
    "magic-initiate": {
      id: "magic-initiate",
      name: "Magic Initiate",
      category: "origin",
      // The feat picks a spell list. `variant` is set on selection.
      variants: ["cleric", "druid", "wizard"],
      grants: {
        cantripsKnown: 2,
        level1Spell: 1,
        // free cast once per Long Rest
        spellcastingAbility: "choose:int|wis|cha"
      },
      repeatable: true
      // different list each time
    },
    "alert": {
      id: "alert",
      name: "Alert",
      category: "origin",
      grants: {
        initiativeProficiency: true,
        initiativeSwap: true
        // swap with a willing ally after rolling
      }
    },
    "savage-attacker": {
      id: "savage-attacker",
      name: "Savage Attacker",
      category: "origin",
      grants: {
        // Once per turn on a weapon hit, roll damage dice twice and keep
        // either roll. The loop reads this flag and rolls accordingly.
        rerollWeaponDamageOncePerTurn: true
      }
    }
  };

  // vendor/bag-of-holding/src/srd/spells.js
  var spells_default = {
    // Cantrips
    "fire-bolt": { id: "fire-bolt", name: "Fire Bolt", level: 0, school: "evocation", damage: "1d10" },
    "sacred-flame": { id: "sacred-flame", name: "Sacred Flame", level: 0, school: "evocation", damage: "1d8", save: "dex" },
    "eldritch-blast": { id: "eldritch-blast", name: "Eldritch Blast", level: 0, school: "evocation", damage: "1d10" },
    "ray-of-frost": { id: "ray-of-frost", name: "Ray of Frost", level: 0, school: "evocation", damage: "1d8" },
    "light": { id: "light", name: "Light", level: 0, school: "evocation" },
    "guidance": { id: "guidance", name: "Guidance", level: 0, school: "divination" },
    "mage-hand": { id: "mage-hand", name: "Mage Hand", level: 0, school: "conjuration" },
    "prestidigitation": { id: "prestidigitation", name: "Prestidigitation", level: 0, school: "transmutation" },
    // L1
    "cure-wounds": { id: "cure-wounds", name: "Cure Wounds", level: 1, school: "evocation", healing: "1d8+mod" },
    "magic-missile": { id: "magic-missile", name: "Magic Missile", level: 1, school: "evocation", damage: "1d4+1", autohit: true, projectiles: 3 },
    "shield": { id: "shield", name: "Shield", level: 1, school: "abjuration", reaction: true, acBonus: 5 },
    "mage-armor": { id: "mage-armor", name: "Mage Armor", level: 1, school: "abjuration", sets: { ac: "13+dex" } },
    "bless": { id: "bless", name: "Bless", level: 1, school: "enchantment", concentration: true },
    "healing-word": { id: "healing-word", name: "Healing Word", level: 1, school: "evocation", healing: "1d4+mod", bonusAction: true },
    "sleep": { id: "sleep", name: "Sleep", level: 1, school: "enchantment" },
    "thunderwave": { id: "thunderwave", name: "Thunderwave", level: 1, school: "evocation", damage: "2d8", save: "con" },
    "detect-magic": { id: "detect-magic", name: "Detect Magic", level: 1, school: "divination", concentration: true },
    // L2
    "misty-step": { id: "misty-step", name: "Misty Step", level: 2, school: "conjuration", bonusAction: true },
    "invisibility": { id: "invisibility", name: "Invisibility", level: 2, school: "illusion", concentration: true },
    "hold-person": { id: "hold-person", name: "Hold Person", level: 2, school: "enchantment", concentration: true, save: "wis" },
    "scorching-ray": { id: "scorching-ray", name: "Scorching Ray", level: 2, school: "evocation", damage: "2d6", projectiles: 3 },
    "spiritual-weapon": { id: "spiritual-weapon", name: "Spiritual Weapon", level: 2, school: "evocation", bonusAction: true, damage: "1d8+mod" },
    // L3
    "fireball": { id: "fireball", name: "Fireball", level: 3, school: "evocation", damage: "8d6", save: "dex" },
    "counterspell": { id: "counterspell", name: "Counterspell", level: 3, school: "abjuration", reaction: true },
    "haste": { id: "haste", name: "Haste", level: 3, school: "transmutation", concentration: true },
    "fly": { id: "fly", name: "Fly", level: 3, school: "transmutation", concentration: true },
    "lightning-bolt": { id: "lightning-bolt", name: "Lightning Bolt", level: 3, school: "evocation", damage: "8d6", save: "dex" },
    // L4
    "banishment": { id: "banishment", name: "Banishment", level: 4, school: "abjuration", concentration: true, save: "cha" },
    "polymorph": { id: "polymorph", name: "Polymorph", level: 4, school: "transmutation", concentration: true, save: "wis" },
    "fire-shield": { id: "fire-shield", name: "Fire Shield", level: 4, school: "evocation" },
    // L5
    "cone-of-cold": { id: "cone-of-cold", name: "Cone of Cold", level: 5, school: "evocation", damage: "8d8", save: "con" },
    "hold-monster": { id: "hold-monster", name: "Hold Monster", level: 5, school: "enchantment", concentration: true, save: "wis" },
    "wall-of-stone": { id: "wall-of-stone", name: "Wall of Stone", level: 5, school: "evocation", concentration: true }
  };

  // vendor/bag-of-holding/src/srd/items.js
  var items_default = {
    // Simple melee weapons
    "club": { id: "club", name: "Club", type: "weapon", damage: "1d4", damageType: "bludgeoning", properties: ["light"], mastery: "slow" },
    "dagger": { id: "dagger", name: "Dagger", type: "weapon", damage: "1d4", damageType: "piercing", properties: ["finesse", "light", "thrown"], mastery: "nick" },
    "handaxe": { id: "handaxe", name: "Handaxe", type: "weapon", damage: "1d6", damageType: "slashing", properties: ["light", "thrown"], mastery: "vex" },
    "javelin": { id: "javelin", name: "Javelin", type: "weapon", damage: "1d6", damageType: "piercing", properties: ["thrown"], mastery: "slow" },
    "light-hammer": { id: "light-hammer", name: "Light Hammer", type: "weapon", damage: "1d4", damageType: "bludgeoning", properties: ["light", "thrown"], mastery: "nick" },
    "mace": { id: "mace", name: "Mace", type: "weapon", damage: "1d6", damageType: "bludgeoning", properties: [], mastery: "sap" },
    "quarterstaff": { id: "quarterstaff", name: "Quarterstaff", type: "weapon", damage: "1d6", damageType: "bludgeoning", properties: ["versatile"], mastery: "topple" },
    "sickle": { id: "sickle", name: "Sickle", type: "weapon", damage: "1d4", damageType: "slashing", properties: ["finesse", "light"], mastery: "nick" },
    "spear": { id: "spear", name: "Spear", type: "weapon", damage: "1d6", damageType: "piercing", properties: ["thrown", "versatile"], mastery: "push" },
    // Simple ranged
    "shortbow": { id: "shortbow", name: "Shortbow", type: "weapon", damage: "1d6", damageType: "piercing", properties: ["ranged", "two-handed"], mastery: "vex" },
    "crossbow-light": { id: "crossbow-light", name: "Light Crossbow", type: "weapon", damage: "1d8", damageType: "piercing", properties: ["ranged", "two-handed"], mastery: "slow" },
    // Martial melee
    "battleaxe": { id: "battleaxe", name: "Battleaxe", type: "weapon", damage: "1d8", damageType: "slashing", properties: ["versatile"], mastery: "topple" },
    "flail": { id: "flail", name: "Flail", type: "weapon", damage: "1d8", damageType: "bludgeoning", properties: [], mastery: "sap" },
    "glaive": { id: "glaive", name: "Glaive", type: "weapon", damage: "1d10", damageType: "slashing", properties: ["heavy", "reach", "two-handed"], mastery: "graze" },
    "greataxe": { id: "greataxe", name: "Greataxe", type: "weapon", damage: "1d12", damageType: "slashing", properties: ["heavy", "two-handed"], mastery: "cleave" },
    "greatsword": { id: "greatsword", name: "Greatsword", type: "weapon", damage: "2d6", damageType: "slashing", properties: ["heavy", "two-handed"], mastery: "graze" },
    "halberd": { id: "halberd", name: "Halberd", type: "weapon", damage: "1d10", damageType: "slashing", properties: ["heavy", "reach", "two-handed"], mastery: "cleave" },
    "longsword": { id: "longsword", name: "Longsword", type: "weapon", damage: "1d8", damageType: "slashing", properties: ["versatile"], mastery: "sap" },
    "maul": { id: "maul", name: "Maul", type: "weapon", damage: "2d6", damageType: "bludgeoning", properties: ["heavy", "two-handed"], mastery: "topple" },
    "morningstar": { id: "morningstar", name: "Morningstar", type: "weapon", damage: "1d8", damageType: "piercing", properties: [], mastery: "sap" },
    "pike": { id: "pike", name: "Pike", type: "weapon", damage: "1d10", damageType: "piercing", properties: ["heavy", "reach", "two-handed"], mastery: "push" },
    "rapier": { id: "rapier", name: "Rapier", type: "weapon", damage: "1d8", damageType: "piercing", properties: ["finesse"], mastery: "vex" },
    "scimitar": { id: "scimitar", name: "Scimitar", type: "weapon", damage: "1d6", damageType: "slashing", properties: ["finesse", "light"], mastery: "sap" },
    "shortsword": { id: "shortsword", name: "Shortsword", type: "weapon", damage: "1d6", damageType: "piercing", properties: ["finesse", "light"], mastery: "vex" },
    "trident": { id: "trident", name: "Trident", type: "weapon", damage: "1d8", damageType: "piercing", properties: ["thrown", "versatile"], mastery: "topple" },
    "warhammer": { id: "warhammer", name: "Warhammer", type: "weapon", damage: "1d8", damageType: "bludgeoning", properties: ["versatile"], mastery: "push" },
    // Martial ranged
    "longbow": { id: "longbow", name: "Longbow", type: "weapon", damage: "1d8", damageType: "piercing", properties: ["heavy", "ranged", "two-handed"], mastery: "slow" },
    "crossbow-heavy": { id: "crossbow-heavy", name: "Heavy Crossbow", type: "weapon", damage: "1d10", damageType: "piercing", properties: ["heavy", "ranged", "two-handed"], mastery: "push" },
    // Armor
    "padded": { id: "padded", name: "Padded Armor", type: "armor", ac: 11, addsDex: true },
    "leather-armor": { id: "leather-armor", name: "Leather Armor", type: "armor", ac: 11, addsDex: true },
    "studded-leather": { id: "studded-leather", name: "Studded Leather", type: "armor", ac: 12, addsDex: true },
    "hide": { id: "hide", name: "Hide", type: "armor", ac: 12, addsDex: true, maxDex: 2 },
    "chain-shirt": { id: "chain-shirt", name: "Chain Shirt", type: "armor", ac: 13, addsDex: true, maxDex: 2 },
    "scale-mail": { id: "scale-mail", name: "Scale Mail", type: "armor", ac: 14, addsDex: true, maxDex: 2 },
    "breastplate": { id: "breastplate", name: "Breastplate", type: "armor", ac: 14, addsDex: true, maxDex: 2 },
    "half-plate": { id: "half-plate", name: "Half Plate", type: "armor", ac: 15, addsDex: true, maxDex: 2 },
    "ring-mail": { id: "ring-mail", name: "Ring Mail", type: "armor", ac: 14, addsDex: false },
    "chain-mail": { id: "chain-mail", name: "Chain Mail", type: "armor", ac: 16, addsDex: false },
    "splint": { id: "splint", name: "Splint", type: "armor", ac: 17, addsDex: false },
    "plate": { id: "plate", name: "Plate Armor", type: "armor", ac: 18, addsDex: false },
    "shield": { id: "shield", name: "Shield", type: "armor", acBonus: 2 },
    // Consumables
    "potion-healing": { id: "potion-healing", name: "Potion of Healing", type: "consumable", heals: "2d4+2" },
    "potion-greater-healing": { id: "potion-greater-healing", name: "Potion of Greater Healing", type: "consumable", heals: "4d4+4" },
    "potion-superior-healing": { id: "potion-superior-healing", name: "Potion of Superior Healing", type: "consumable", heals: "8d4+8" }
  };

  // vendor/bag-of-holding/src/srd/monsters.js
  var monsters_default = {
    goblin: {
      id: "goblin",
      name: "Goblin",
      cr: 0.25,
      ac: 15,
      hp: 7,
      size: "small",
      speed: 30,
      abilityScores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
      attacks: [{ name: "Scimitar", attackBonus: 4, damage: "1d6+2", damageType: "slashing" }],
      skills: { stealth: 6 }
    },
    orc: {
      id: "orc",
      name: "Orc",
      cr: 0.5,
      ac: 13,
      hp: 15,
      size: "medium",
      speed: 30,
      abilityScores: { str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10 },
      attacks: [{ name: "Greataxe", attackBonus: 5, damage: "1d12+3", damageType: "slashing" }]
    },
    bandit: {
      id: "bandit",
      name: "Bandit",
      cr: 0.125,
      ac: 12,
      hp: 11,
      size: "medium",
      speed: 30,
      abilityScores: { str: 11, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
      attacks: [
        { name: "Scimitar", attackBonus: 3, damage: "1d6+1", damageType: "slashing" },
        { name: "Crossbow, Light", attackBonus: 3, damage: "1d8+1", damageType: "piercing" }
      ]
    },
    wolf: {
      id: "wolf",
      name: "Wolf",
      cr: 0.25,
      ac: 13,
      hp: 11,
      size: "medium",
      speed: 40,
      abilityScores: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
      attacks: [{ name: "Bite", attackBonus: 4, damage: "2d4+2", damageType: "piercing" }],
      traits: ["Pack Tactics", "Keen Hearing and Smell"]
    },
    zombie: {
      id: "zombie",
      name: "Zombie",
      cr: 0.25,
      ac: 8,
      hp: 22,
      size: "medium",
      speed: 20,
      abilityScores: { str: 13, dex: 6, con: 16, int: 3, wis: 6, cha: 5 },
      attacks: [{ name: "Slam", attackBonus: 3, damage: "1d6+1", damageType: "bludgeoning" }],
      traits: ["Undead Fortitude"]
    },
    skeleton: {
      id: "skeleton",
      name: "Skeleton",
      cr: 0.25,
      ac: 13,
      hp: 13,
      size: "medium",
      speed: 30,
      abilityScores: { str: 10, dex: 14, con: 15, int: 6, wis: 8, cha: 5 },
      attacks: [
        { name: "Shortsword", attackBonus: 4, damage: "1d6+2", damageType: "piercing" },
        { name: "Shortbow", attackBonus: 4, damage: "1d6+2", damageType: "piercing" }
      ]
    },
    ogre: {
      id: "ogre",
      name: "Ogre",
      cr: 2,
      ac: 11,
      hp: 59,
      size: "large",
      speed: 40,
      abilityScores: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
      attacks: [{ name: "Greatclub", attackBonus: 6, damage: "2d8+4", damageType: "bludgeoning" }]
    },
    troll: {
      id: "troll",
      name: "Troll",
      cr: 5,
      ac: 15,
      hp: 84,
      size: "large",
      speed: 30,
      abilityScores: { str: 18, dex: 13, con: 20, int: 7, wis: 9, cha: 7 },
      attacks: [{ name: "Bite", attackBonus: 7, damage: "1d6+4", damageType: "piercing" }],
      traits: ["Regeneration", "Keen Smell"]
    },
    "young-dragon-red": {
      id: "young-dragon-red",
      name: "Young Red Dragon",
      cr: 10,
      ac: 18,
      hp: 178,
      size: "large",
      speed: 40,
      abilityScores: { str: 23, dex: 10, con: 21, int: 14, wis: 11, cha: 19 },
      attacks: [{ name: "Bite", attackBonus: 10, damage: "2d10+6", damageType: "piercing" }],
      traits: ["Fire Breath (Recharge 5\u20136)", "Fire Immunity"]
    }
  };

  // vendor/bag-of-holding/src/engine.js
  var REGISTRY_VALIDATORS = {
    species: { required: ["id", "name", "size", "speed"], arrayFields: ["traits"] },
    classes: { required: ["id", "name", "hitDie"] },
    backgrounds: { required: ["id", "name", "abilityScores", "skillProficiencies", "originFeat"] },
    feats: { required: ["id", "name", "category"] },
    spells: { required: ["id", "name", "level", "school"] },
    items: { required: ["id", "name", "type"] },
    monsters: { required: ["id", "name", "ac", "hp", "abilityScores"], arrayFields: ["attacks", "traits"] }
  };
  function validateRecord2(registry, id, record) {
    const rules = REGISTRY_VALIDATORS[registry];
    if (record === null || typeof record !== "object") {
      throw new Error(`Plugin contribution ${registry}.${id} must be an object`);
    }
    for (const field of rules.required) {
      if (record[field] === void 0) {
        throw new Error(`Plugin contribution ${registry}.${id} missing required field: ${field}`);
      }
    }
    for (const field of rules.arrayFields ?? []) {
      if (record[field] !== void 0 && !Array.isArray(record[field])) {
        throw new Error(`Plugin contribution ${registry}.${id}.${field} must be an array`);
      }
    }
  }
  function mergeRegistry(registry, defaults, extras = {}) {
    for (const [id, record] of Object.entries(extras)) {
      validateRecord2(registry, id, record);
    }
    return { ...defaults, ...extras };
  }
  function buildXP(rules, hooks) {
    const thresholds = rules.xpThresholds ?? THRESHOLDS;
    const proficiency = rules.proficiencyByLevel ?? PROFICIENCY_BY_LEVEL;
    return {
      THRESHOLDS: thresholds,
      PROFICIENCY_BY_LEVEL: proficiency,
      levelForXP: (xp) => levelForXP(xp, thresholds),
      nextLevelThreshold: (xp) => nextLevelThreshold(xp, thresholds),
      awardMilestone: ({ pc, beat }) => {
        const result = awardMilestone({ pc, beat }, thresholds);
        if (hooks && result.willLevelUp) {
          const newLevel = levelForXP(result.newTotal, thresholds);
          hooks.fire("onLevelUp", {
            pc,
            fromLevel: pc.level,
            toLevel: newLevel,
            xpDelta: result.xpDelta,
            newTotal: result.newTotal
          });
        }
        return result;
      }
    };
  }
  function buildConditions(extraConditions = []) {
    if (!Array.isArray(extraConditions)) {
      throw new Error("extraConditions must be an array of strings");
    }
    for (const c of extraConditions) {
      if (typeof c !== "string" || c.length === 0) {
        throw new Error(`extraConditions entries must be non-empty strings (got ${JSON.stringify(c)})`);
      }
    }
    const combined = Object.freeze([.../* @__PURE__ */ new Set([...CONDITIONS, ...extraConditions])]);
    return {
      CONDITIONS: combined,
      EXHAUSTION_MAX,
      has,
      isImmuneTo,
      apply: (actor, condition) => apply(actor, condition, combined),
      remove,
      effectsFor,
      attackStance,
      exhaustion
    };
  }
  function createEngine(opts = {}) {
    const species2 = mergeRegistry("species", species_default, opts.extraSpecies);
    const classes2 = mergeRegistry("classes", classes_exports, opts.extraClasses);
    const backgrounds2 = mergeRegistry("backgrounds", backgrounds_default, opts.extraBackgrounds);
    const feats2 = mergeRegistry("feats", feats_default, opts.extraFeats);
    const spells2 = mergeRegistry("spells", spells_default, opts.extraSpells);
    const items2 = mergeRegistry("items", items_default, opts.extraItems);
    const monsters2 = mergeRegistry("monsters", monsters_default, opts.extraMonsters);
    const ConditionsBoundBase = buildConditions(opts.extraConditions);
    const rules = buildRules(opts.rules);
    const hooks = buildHookRegistry(opts.hooks);
    const ConditionsBound = {
      ...ConditionsBoundBase,
      apply: (actor, condition) => {
        let next = ConditionsBoundBase.apply(actor, condition);
        if (next === actor) return next;
        const effect = CONDITION_EFFECTS[condition];
        if (effect?.incapacitates && next.concentration) {
          next = endConcentration(next);
        }
        hooks.fire("onConditionApplied", { actor: next, condition, previous: actor });
        return next;
      },
      exhaustion: {
        ...ConditionsBoundBase.exhaustion,
        gain: (actor, amount) => {
          const next = ConditionsBoundBase.exhaustion.gain(actor, amount);
          if (ConditionsBoundBase.exhaustion.isDead(next) && !ConditionsBoundBase.exhaustion.isDead(actor)) {
            hooks.fire("onDeath", { actor: next, cause: "exhaustion", previous: actor });
          }
          return next;
        },
        set: (actor, level) => {
          const next = ConditionsBoundBase.exhaustion.set(actor, level);
          if (ConditionsBoundBase.exhaustion.isDead(next) && !ConditionsBoundBase.exhaustion.isDead(actor)) {
            hooks.fire("onDeath", { actor: next, cause: "exhaustion", previous: actor });
          }
          return next;
        }
      }
    };
    const XPBound = buildXP(rules, hooks);
    const rng = opts.rng ?? Math.random;
    const rollLogCap = opts.rollLogCap ?? Infinity;
    const rollLog = [];
    let rollCount = 0;
    const record = (op, payload, context) => {
      const entry = { index: rollCount++, op, ...payload };
      if (context !== void 0) entry.context = context;
      rollLog.push(entry);
      if (opts.onRoll) opts.onRoll(entry);
      if (rollLog.length > rollLogCap) {
        rollLog.splice(0, rollLog.length - rollLogCap);
      }
      return entry;
    };
    const DiceBound = {
      parse,
      seededRng,
      rollDie: (sides, context) => {
        const value = rollDie(sides, rng);
        record("rollDie", { sides, value }, context);
        return value;
      },
      roll: (spec, context) => {
        const result = roll(spec, rng);
        record("roll", { spec, rolls: result.rolls, modifier: result.modifier, total: result.total }, context);
        return result;
      },
      rollAdvantage: (spec, context) => {
        const result = rollAdvantage(spec, rng);
        record("rollAdvantage", { spec, rolls: result.rolls, modifier: result.modifier, total: result.total }, context);
        return result;
      },
      rollDisadvantage: (spec, context) => {
        const result = rollDisadvantage(spec, rng);
        record("rollDisadvantage", { spec, rolls: result.rolls, modifier: result.modifier, total: result.total }, context);
        return result;
      }
    };
    const ChecksBound = {
      modFromScore,
      clampDC,
      abilityCheck: (args, context) => {
        const result = abilityCheck(args, rng);
        record("abilityCheck", {
          abilityScore: args.abilityScore,
          proficient: args.proficient ?? false,
          proficiencyBonus: args.proficiencyBonus ?? 2,
          ...result
        }, context);
        return result;
      },
      savingThrow: (args, context) => {
        let augmented = args;
        if (args.actor && args.ability && (args.ability === "str" || args.ability === "dex")) {
          const effects = effectsFor(args.actor);
          if (effects.autoFailStrDexSaves) {
            augmented = { ...args, autoFailed: true };
          }
        }
        const result = savingThrow(augmented, rng);
        record("savingThrow", {
          abilityScore: args.abilityScore,
          proficient: args.proficient ?? false,
          proficiencyBonus: args.proficiencyBonus ?? 2,
          ...result
        }, context);
        return result;
      }
    };
    if (opts.extraMastery) {
      for (const [name, handler] of Object.entries(opts.extraMastery)) {
        if (typeof handler !== "function") {
          throw new Error(`extraMastery.${name} must be a function`);
        }
      }
    }
    const masteryHandlers = Object.freeze({
      ...DEFAULT_MASTERY_HANDLERS,
      ...opts.extraMastery ?? {}
    });
    const masteryProperties = Object.freeze(Object.keys(masteryHandlers));
    const CombatBound = {
      rollInitiative: (args, context) => {
        const value = rollInitiative(args, rng);
        record("rollInitiative", { dexterity: args.dexterity, value }, context);
        return value;
      },
      attackRoll: (args, context) => {
        const pre = hooks.fire("beforeAttack", { ...args, context });
        if (pre.cancelled === true) {
          const cancelled = { d20: 0, attackBonus: args.attackBonus, total: 0, ac: pre.ac, hit: false, critical: false, fumble: false, stance: "normal", cancelled: true };
          record("attackRoll", cancelled, context);
          return cancelled;
        }
        const result = attackRoll({
          attackBonus: pre.attackBonus,
          ac: pre.ac,
          attacker: pre.attacker,
          target: pre.target,
          attackerDistanceFt: pre.attackerDistanceFt
        }, rng, rules);
        record("attackRoll", result, context);
        return result;
      },
      damageRoll: (args, context) => {
        const result = damageRoll(args, rng, rules);
        const merged = hooks.fire("afterDamage", { ...result, context });
        const final = { ...result, total: merged.total };
        record("damageRoll", final, context);
        return final;
      },
      MASTERY_PROPERTIES: masteryProperties,
      applyMastery: (weapon, target, attackResult, attacker) => applyMastery(weapon, target, attackResult, attacker, masteryHandlers),
      // === Encounter system (since 0.4.0) ===
      //
      // Bound here rather than as a separate top-level namespace so
      // the encounter functions share the engine's rng and rules
      // without the caller threading them per call.
      // Every initiative draw is logged so the encounter's stochastic
      // surface flows into the same rollLog the rest of the engine
      // populates — replay verification then covers an entire combat
      // session end-to-end.
      startEncounter: (participants) => startEncounter(
        participants,
        rng,
        ({ dexterity, value }) => record("rollInitiative", { dexterity, value })
      ),
      rollOrder: (participants) => rollOrder(
        participants,
        rng,
        ({ dexterity, value }) => record("rollInitiative", { dexterity, value })
      ),
      currentActor,
      endTurn,
      removeParticipant,
      spend,
      freshBudget,
      attacksPerAction,
      opportunityAttack: (state, args) => {
        const result = opportunityAttack(state, { ...args, rng, rules });
        if (result.triggered) {
          record("attackRoll", result.attack, args.context);
        }
        return result;
      },
      effectiveAc,
      rangeBand,
      ACTION_COSTS,
      COVER_BONUSES,
      // === Action verbs (since 1.7.0) ===
      dash,
      disengage,
      dodge,
      help,
      hide,
      ready,
      ability,
      grapple,
      shove,
      offHandAttack,
      improvisedAttack,
      // === Death saves (since 1.1.0) ===
      //
      // Bound so the d20 from each save flows into the same rollLog as
      // attack rolls and so `onDeath` fires consistently. Exhaustion
      // already fires `onDeath` via the Conditions binding; these are
      // the second and third pathways (failed death save, damage at 0).
      //
      // `dropToZero` delegates the Unconscious add to `ConditionsBound`
      // (declared below in the same closure) so the existing
      // `onConditionApplied` hook fires through one code path.
      freshDeathSaves,
      dropToZero: (actor) => {
        const withUnconscious = ConditionsBound.apply(actor, "unconscious");
        return { ...withUnconscious, hp: 0, deathSaves: freshDeathSaves() };
      },
      deathSave: (actor, context) => {
        const result = deathSave(actor, rng, rules);
        if (result.d20 !== 0) {
          record("deathSave", { d20: result.d20, outcome: result.outcome }, context);
        }
        if (result.outcome === "dead") {
          hooks.fire("onDeath", { actor: result.actor, cause: "deathSave", previous: actor });
        }
        return result;
      },
      applyDamageWhileDown: (actor, damageTaken, args) => {
        const result = applyDamageWhileDown(actor, damageTaken, args ?? {}, rules);
        if (result.outcome === "dead" && (actor.deathSaves?.dead ?? false) === false) {
          hooks.fire("onDeath", { actor: result.actor, cause: "damageWhileDown", previous: actor });
        }
        return result;
      },
      stabilize,
      reviveTo,
      // === Damage pipeline (since 1.4.0) ===
      //
      // Pure modifiers and tempHp helpers pass through unchanged.
      // `applyDamage` and `heal` are bound so the outcomes that
      // *create* an Unconscious actor (or kill one outright) fire the
      // appropriate hooks — same contract as the existing death-save
      // bindings. Specifically:
      //   - 'downed' outcomes route through `dropToZero` internally,
      //     which calls `ConditionsBound.apply('unconscious')`; the
      //     `onConditionApplied` hook fires through that path.
      //   - 'dead' outcomes (instant-death or damage-while-down)
      //     synthesise an onDeath fire via the existing `applyDamage
      //     WhileDown` binding's cause-tracking; for the massive-
      //     damage instant-death path we fire it here explicitly.
      applyDamageModifiers,
      grantTempHp,
      applyDamage: (actor, args) => {
        const wasDead = actor.deathSaves?.dead ?? false;
        const wasUnconscious = (actor.conditions ?? []).includes("unconscious");
        const result = applyDamage(actor, args);
        if (result.outcome === "dead" && !wasDead) {
          hooks.fire("onDeath", { actor: result.actor, cause: "damage", previous: actor });
        }
        if (result.outcome === "downed" && !wasUnconscious) {
          hooks.fire("onConditionApplied", {
            actor: result.actor,
            condition: "unconscious",
            previous: actor
          });
        }
        hooks.fire("onDamageApplied", {
          actor: result.actor,
          previous: actor,
          amount: result.amount,
          finalAmount: result.finalAmount,
          outcome: result.outcome,
          type: args?.type
        });
        if (result.hpAfter !== result.hpBefore) {
          hooks.fire("onHpChanged", {
            actor: result.actor,
            previous: actor,
            hpBefore: result.hpBefore,
            hpAfter: result.hpAfter,
            cause: "damage"
          });
        }
        return result;
      },
      heal: (actor, amount) => {
        const result = heal(actor, amount);
        if (result.hpAfter !== result.hpBefore) {
          hooks.fire("onHpChanged", {
            actor: result.actor,
            previous: actor,
            hpBefore: result.hpBefore,
            hpAfter: result.hpAfter,
            cause: "heal"
          });
        }
        return result;
      },
      // === Turn lifecycle (since 1.6.0) ===
      //
      // `turnStart` and `turnEnd` are *signal* helpers — they tick the
      // actor's timers (turnEnd) and fire the matching hook with the
      // resulting state. The host calls them at the natural moments
      // in its turn loop; the engine's job is to provide the
      // canonical dispatch point so plugins always see the same
      // ordering.
      addTimer,
      tickTimers,
      turnStart: (actor, context) => {
        hooks.fire("onTurnStart", { actor, context });
        return { actor };
      },
      turnEnd: (actor, context) => {
        const result = turnEnd(actor);
        hooks.fire("onTurnEnd", {
          actor: result.actor,
          previous: actor,
          expired: result.expired,
          context
        });
        return result;
      }
    };
    const characterRegistries = {
      species: species2,
      classes: classes2,
      backgrounds: backgrounds2,
      feats: feats2,
      items: items2,
      XP: XPBound
    };
    const RestBound = {
      spendHitDie: (actor, context) => {
        const result = spendHitDie(actor, rng);
        if (result.die !== void 0) {
          record("rollDie", { sides: actor.hitDie, value: result.die }, context);
        }
        return result;
      },
      longRest: (actor) => {
        const next = longRest2(actor, rules);
        hooks.fire("onLongRest", { actor: next, previous: actor });
        return next;
      },
      shortRest: (actor) => {
        const next = shortRest2(actor);
        hooks.fire("onShortRest", { actor: next, previous: actor });
        return next;
      }
    };
    const MechanicsBound = {
      freshResource,
      freshResources,
      spendResource,
      refreshResources,
      REFRESH_KINDS,
      /**
       * Dispatch a class mechanic for an actor whose `classId` is
       * registered. Returns whatever the handler returns. Throws on
       * unknown classes or unknown mechanics so a typo at the host
       * surfaces immediately rather than silently no-op'ing.
       */
      apply: (actor, id, args, context) => {
        const classDef = classes2[actor.classId];
        if (!classDef) throw new Error(`Unknown class for mechanic dispatch: ${actor.classId}`);
        const handlers = classDef.mechanics;
        if (!handlers || !handlers[id]) {
          throw new Error(`Unknown class mechanic: ${classDef.id}.${id}`);
        }
        const ctx = {
          rng,
          rollDie: (sides) => {
            const value = rollDie(sides, rng);
            record("rollDie", { sides, value }, context);
            return value;
          },
          modFromScore
        };
        return handlers[id](actor, args ?? {}, ctx);
      }
    };
    return {
      // Data registries — plain objects, mutate at your own risk.
      species: species2,
      classes: classes2,
      backgrounds: backgrounds2,
      feats: feats2,
      spells: spells2,
      items: items2,
      monsters: monsters2,
      // Math + helpers (bound to this engine's data + rng + rules).
      Dice: DiceBound,
      Checks: ChecksBound,
      Combat: CombatBound,
      Conditions: ConditionsBound,
      XP: XPBound,
      Movesets: movesets_exports,
      Beats: beats_exports,
      // Spellcasting: mostly pure module; engine wraps `castSpell` to
      // fire the `onCast` hook (Phase D, since 1.6.0). The hook can
      // short-circuit a cast via `cancelled: true` — that's the
      // Counterspell intercept point.
      Spellcasting: (() => {
        const fireOnCast = (actor, spell, args) => {
          const pre = hooks.fire("onCast", { actor, spell, args });
          if (pre.cancelled === true) {
            return { ok: false, reason: pre.reason ?? "cast cancelled by reaction", cancelled: true };
          }
          return null;
        };
        return {
          ...spellcasting_exports,
          castSpell: (actor, spell, args) => {
            const cancel = fireOnCast(actor, spell, args);
            if (cancel) return cancel;
            return castSpell(actor, spell, args);
          },
          castAsRitual: (actor, spell, args) => {
            const cancel = fireOnCast(actor, spell, { ...args ?? {}, ritual: true });
            if (cancel) return cancel;
            return castAsRitual(actor, spell, args);
          }
        };
      })(),
      // Rest mechanics (since 1.2.0). `spendHitDie` is engine-bound
      // so its die roll flows into rollLog; `longRest` runs against
      // the engine's resolved rules so the recovery-mode knob applies.
      Rest: RestBound,
      // Scene clock (since 1.6.0). Pure surface — the engine doesn't
      // hold scene state; the host owns the clock and passes it in
      // and out via `advanceTime(scene, delta)`.
      SceneClock: Object.freeze({
        freshScene,
        advanceTime,
        formatTimeOfDay,
        DEFAULT_DAWN_MINUTE,
        DEFAULT_DUSK_MINUTE,
        MINUTES_PER_DAY
      }),
      // Magic items lifecycle (since 1.9.0). rechargeItem accepts the
      // engine's rng via the binding so dice-based recoveries (e.g.
      // 1d6+4 at dawn) flow into the same replay-deterministic chain.
      EncounterDesign: Object.freeze({
        xpForCR,
        ENCOUNTER_BUDGETS,
        budgetFor,
        classifyEncounter
      }),
      Inspiration: Object.freeze({
        hasInspiration,
        grant: grantInspiration,
        spend: spendInspiration,
        applyHalflingLucky: (originalD20) => applyHalflingLucky(originalD20, rng),
        rerollFailedSave: (args) => rerollFailedSave(args, rng),
        groupCheck,
        workingTogether
      }),
      Multiclass: Object.freeze({
        MULTICLASS_PREREQS,
        CASTER_WEIGHT,
        totalLevel,
        casterLevel,
        canMulticlassInto,
        languages,
        knowsLanguage,
        tools,
        isProficientWithTool
      }),
      Movement: Object.freeze({
        MOVEMENT_MODES,
        LIGHT_LEVELS,
        speedFor,
        movementCost,
        fall: (distanceFt) => fall(distanceFt, rng),
        longJump,
        highJump,
        effectiveLight,
        obscuredState,
        hasLineOfSight,
        hasLineOfEffect
      }),
      Monsters: Object.freeze({
        multiattackSequence,
        freshLegendaryState,
        useLegendaryAction,
        refreshLegendaryActions,
        freshLegendaryResistance,
        useLegendaryResistance,
        lairActionAvailable,
        fireLairAction,
        freshInnateState,
        castInnate,
        refreshInnateSpells,
        senses,
        saveBonus
      }),
      MagicItems: Object.freeze({
        RARITY_BANDS,
        ATTUNEMENT_CAP,
        RECHARGE_KINDS,
        canAttune,
        attune,
        unattune,
        spendCharge,
        rechargeItem: (actor, item) => rechargeItem(actor, item, rng),
        identifyItem,
        isIdentified,
        itemSavingThrow: (item, dc) => itemSavingThrow(item, dc, rng)
      }),
      // Class mechanics (since 1.3.0). Foundation for resource-bearing
      // class features (Second Wind, Action Surge, Sneak Attack, etc.)
      // Per-class handlers live on the class def under `mechanics`.
      Mechanics: MechanicsBound,
      // Character derivation — turns a host-owned record into a
      // frozen sheet. See docs/character-sheet.md.
      deriveSheet: (record2) => deriveSheet(record2, characterRegistries),
      // Audit / replay surface.
      rollLog,
      verifyLog,
      // Frozen merged rules — exposed for introspection ("which
      // pack is loaded?" UI, debug overlay, telemetry).
      rules,
      // Phase C: read-only hook registry. Hosts can inspect counts
      // and fire ad-hoc events (e.g. `onDeath` from non-exhaustion
      // causes the host detects, like dropping below 0 hp).
      hooks
    };
  }

  // vendor/bag-of-holding/index.js
  var _default2 = createEngine();
  var {
    Dice,
    Checks,
    Combat,
    Conditions,
    XP,
    Movesets,
    Beats,
    Spellcasting,
    Rest,
    Mechanics,
    SceneClock,
    MagicItems,
    Monsters,
    Movement,
    Multiclass,
    Inspiration,
    EncounterDesign,
    species,
    classes,
    backgrounds,
    feats,
    spells,
    items,
    monsters
  } = _default2;
  var Character = Object.freeze({
    deriveSheet,
    SKILL_ABILITY
  });
  var SRD = Object.freeze({ species, classes, backgrounds, feats, spells, items, monsters });

  // src/game/character.js
  var STARTER_CLASSES = ["fighter", "rogue", "cleric", "wizard"];
  var CLASS_EQUIPMENT = {
    fighter: { armorId: "chain-mail", shieldId: "shield", weaponIds: ["longsword"] },
    rogue: { armorId: "leather-armor", weaponIds: ["shortsword", "dagger"] },
    cleric: { armorId: "chain-mail", shieldId: "shield", weaponIds: ["mace"] },
    wizard: { weaponIds: ["quarterstaff"] }
  };
  var STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
  async function createCharacter(ui) {
    ui.clear();
    ui.appendEntry("system", "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
    ui.appendEntry("system", "    CHARACTER CREATION");
    ui.appendEntry("system", "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
    ui.appendEntry("system", "");
    const nameRaw = await ui.prompt("What is your adventurer's name? [Dan]:");
    const name = nameRaw.trim() || "Dan";
    const classId = await ui.pickFrom(
      "Choose your class:",
      STARTER_CLASSES,
      (c) => c.charAt(0).toUpperCase() + c.slice(1),
      0
    );
    const speciesIds = Object.keys(SRD.species);
    const speciesId = await ui.pickFrom(
      "Choose your species:",
      speciesIds,
      (s) => SRD.species[s]?.name ?? s.charAt(0).toUpperCase() + s.slice(1),
      0
    );
    const bgIds = Object.keys(SRD.backgrounds);
    const bgId = await ui.pickFrom(
      "Choose your background:",
      bgIds,
      (b) => SRD.backgrounds[b]?.name ?? b.charAt(0).toUpperCase() + b.slice(1),
      3
    );
    ui.appendEntry("system", "");
    ui.appendEntry("system", `Forging ${name.trim()}'s fate\u2026`);
    const record = {
      id: `pc-${Date.now()}`,
      name: name.trim(),
      classId,
      speciesId,
      backgroundId: bgId,
      level: 1,
      abilityScores: {
        str: STANDARD_ARRAY[0],
        dex: STANDARD_ARRAY[1],
        con: STANDARD_ARRAY[2],
        int: STANDARD_ARRAY[3],
        wis: STANDARD_ARRAY[4],
        cha: STANDARD_ARRAY[5]
      },
      equipment: CLASS_EQUIPMENT[classId] ?? { weaponIds: [] },
      conditions: [],
      exhaustion: 0,
      xp: 0,
      notes: "",
      // Runtime HP tracking (not in DerivedSheet — host owns current HP)
      hpCurrent: null
      // filled below after derivation
    };
    const engine = createEngine();
    const sheet = engine.deriveSheet(record);
    record.hpCurrent = sheet.hp.max;
    return { record, sheet };
  }

  // src/ai/openrouter.js
  var CLASSIFIER_SCHEMA = {
    type: "object",
    properties: {
      intent: {
        type: "string",
        enum: ["attack", "skill", "talk", "move", "take", "unlock", "look", "inventory", "wait", "impossible", "meta"]
      },
      target_id: { type: ["string", "null"] },
      direction: { type: ["string", "null"] },
      skill: { type: ["string", "null"] },
      dc: { type: ["number", "null"] },
      reason: { type: "string" }
    },
    required: ["intent", "target_id", "direction", "skill", "dc", "reason"],
    additionalProperties: false
  };
  var NARRATOR_SCHEMA = {
    type: "object",
    properties: {
      narration: { type: "string" },
      combat_ended: { type: "boolean" },
      outcome: { type: "string", enum: ["continue", "victory", "defeat", "flee"] }
    },
    required: ["narration", "combat_ended", "outcome"],
    additionalProperties: false
  };
  function modelFor(tier, ai) {
    return ai.models?.[tier] ?? DEFAULT_MODELS[tier] ?? DEFAULT_MODELS.medium;
  }
  function headers(key, origin) {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
      "HTTP-Referer": origin,
      "X-Title": "Dan's Dungeons"
    };
  }
  async function checkKey() {
    const ai = appState.ai || {};
    if (!ai.key) return false;
    const base = (ai.baseUrl || "https://openrouter.ai/api/v1").replace(/\/$/, "");
    try {
      const res = await fetch(`${base}/auth/key`, {
        headers: { "Authorization": `Bearer ${ai.key}` }
      });
      return res.status !== 401;
    } catch {
      return true;
    }
  }
  async function _callOnce({ tier = "medium", messages, schema }) {
    const ai = appState.ai || {};
    const base = (ai.baseUrl || "https://openrouter.ai/api/v1").replace(/\/$/, "");
    const model = modelFor(tier, ai);
    const body = {
      model,
      messages,
      temperature: tier === "tiny" ? 0.1 : 0.85,
      max_tokens: tier === "tiny" ? 250 : 700
    };
    if (schema) {
      body.response_format = {
        type: "json_schema",
        json_schema: { name: "output", strict: true, schema }
      };
    }
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: headers(ai.key || "", location.origin),
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`AI ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data = await res.json();
    if (data.usage?.total_tokens) addValue("ai.totalTokens", data.usage.total_tokens);
    return data.choices[0].message.content;
  }
  async function _call(opts) {
    try {
      return await _callOnce(opts);
    } catch (err) {
      if (err.message.startsWith("AI 400:") && opts.tier !== "medium") {
        return await _callOnce({ ...opts, tier: "medium" });
      }
      throw err;
    }
  }
  var NarrationExtractor = class {
    constructor() {
      this._buf = "";
      this._active = false;
      this._done = false;
    }
    feed(raw) {
      if (this._done) return "";
      this._buf += raw;
      if (!this._active) {
        const marker = '"narration":"';
        const idx = this._buf.indexOf(marker);
        if (idx === -1) {
          if (this._buf.length > marker.length) {
            this._buf = this._buf.slice(-(marker.length - 1));
          }
          return "";
        }
        this._active = true;
        this._buf = this._buf.slice(idx + marker.length);
      }
      let out = "";
      let i = 0;
      while (i < this._buf.length) {
        const ch = this._buf[i];
        if (ch === "\\") {
          if (i + 1 >= this._buf.length) break;
          const esc = this._buf[i + 1];
          out += esc === '"' ? '"' : esc === "n" ? "\n" : esc === "t" ? "	" : esc === "r" ? "" : esc;
          i += 2;
        } else if (ch === '"') {
          this._done = true;
          i++;
          break;
        } else {
          out += ch;
          i++;
        }
      }
      this._buf = this._buf.slice(i);
      return out;
    }
  };
  async function _callStreamOnce({ tier = "medium", messages }, onChunk) {
    const ai = appState.ai || {};
    const base = (ai.baseUrl || "https://openrouter.ai/api/v1").replace(/\/$/, "");
    const model = modelFor(tier, ai);
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: headers(ai.key || "", location.origin),
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.85,
        max_tokens: 700,
        stream: true
      })
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`AI ${res.status}: ${txt.slice(0, 200)}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const extractor = new NarrationExtractor();
    let full = "";
    let partial = "";
    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = partial + decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      partial = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") break outer;
        try {
          const evt = JSON.parse(data);
          const delta = evt.choices?.[0]?.delta?.content;
          if (delta) {
            full += delta;
            if (onChunk) {
              const narChunk = extractor.feed(delta);
              if (narChunk) onChunk(narChunk);
            }
          }
          if (evt.usage?.total_tokens) addValue("ai.totalTokens", evt.usage.total_tokens);
        } catch {
        }
      }
    }
    return full;
  }
  async function _callStream(opts, onChunk) {
    try {
      return await _callStreamOnce(opts, onChunk);
    } catch (err) {
      if (err.message.startsWith("AI 400:") && opts.tier !== "medium") {
        return await _callStreamOnce({ ...opts, tier: "medium" }, onChunk);
      }
      throw err;
    }
  }
  async function generateSceneImage(sceneDescription) {
    const ai = appState.ai || {};
    const base = (ai.baseUrl || "https://openrouter.ai/api/v1").replace(/\/$/, "");
    const model = modelFor("image", ai);
    const prompt2 = "Old hand-drawn journal sketch of a medieval fantasy scene. Black ink lines on sepia parchment paper. Rough, scratchy linework. No colour \u2014 only shades of sepia and black ink. Like an adventurer's field journal. No text, no labels, no writing of any kind. No borders, no frames, no decorative edges. Scene: " + sceneDescription;
    let res;
    try {
      res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: headers(ai.key || "", location.origin),
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt2 }],
          max_tokens: 2048
        })
      });
    } catch (e) {
      console.warn("[scene-image] fetch failed", e);
      return null;
    }
    if (!res.ok) {
      console.warn("[scene-image] API error", res.status);
      return null;
    }
    let data;
    try {
      data = await res.json();
    } catch (e) {
      console.warn("[scene-image] res.json() failed", e);
      return null;
    }
    if (data.usage?.total_tokens) addValue("ai.totalTokens", data.usage.total_tokens);
    const msg = data.choices?.[0]?.message ?? {};
    const content = msg.content;
    console.log("[scene-image] msg keys:", Object.keys(msg), "| content type:", typeof content, "| images array:", Array.isArray(msg.images));
    if (Array.isArray(msg.images)) {
      for (const part of msg.images) {
        if (part.type === "image_url" && part.image_url?.url) {
          console.log("[scene-image] extracted from msg.images, length:", part.image_url.url.length);
          return part.image_url.url;
        }
      }
    }
    if (Array.isArray(content)) {
      for (const part of content) {
        if (part.type === "image_url" && part.image_url?.url) return part.image_url.url;
        if (part.type === "image" && part.data) return `data:image/png;base64,${part.data}`;
        if (part.inline_data?.data) {
          const mime = part.inline_data.mime_type || "image/png";
          return `data:${mime};base64,${part.inline_data.data}`;
        }
      }
    }
    if (typeof content === "string") {
      const m = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/]+=*/);
      if (m) return m[0];
    }
    console.warn("[scene-image] no image data found in response", data);
    return null;
  }
  async function chatCompletion(opts) {
    const content = await _call(opts);
    if (!opts.schema) return content;
    try {
      return JSON.parse(content);
    } catch {
      const repairMessages = [
        ...opts.messages,
        { role: "assistant", content },
        { role: "user", content: "Your response was not valid JSON. Retry and return only a JSON object matching the schema." }
      ];
      const retry = await _call({ ...opts, messages: repairMessages });
      return JSON.parse(retry);
    }
  }
  async function classify(playerInput, sceneContext) {
    const system = `You are a D&D action classifier. Classify the player's intent from their free-text input.

Current scene (use this to identify valid targets):
${JSON.stringify(sceneContext, null, 2)}

Output a single JSON object. Be generous in interpretation ("hit the goblin" \u2192 attack, "sneak past" \u2192 skill stealth).
- "go north" / "head through the doorway" \u2192 move (set direction to north/south/east/west)
- "take the key" / "grab the brass key"  \u2192 take (set target_id to the item's id from scene loot)
- "unlock the door" / "use the key"       \u2192 unlock
- direction: the cardinal direction for move, null otherwise
- target_id: NPC id for attack, item id for take, null otherwise
For skill checks suggest a dc between 10 and 20.`;
    return chatCompletion({
      tier: "tiny",
      messages: [
        { role: "system", content: system },
        { role: "user", content: playerInput }
      ],
      schema: CLASSIFIER_SCHEMA
    });
  }
  async function narrate(resolvedFacts, sceneContext, recentTranscript, onChunk) {
    const system = `You are the Game Master narrating a D&D 5e dungeon encounter.

Setting: gritty low fantasy, second person ("you strike", "you dodge").

Rules:
- Do NOT invent dice results \u2014 use only the resolved facts in the data
- 2\u20134 sentences; vivid but concise
- If a hit: describe the impact and the enemy's reaction
- If a miss: describe the near-miss
- If the enemy retaliated: weave it into the same narration
- End on tension or consequence
- If intent is 'move': describe entering the new room (use newRoom.description); introduce any enemies using their intro text; mention visible items
- If intent is 'take': describe picking up the item
- If intent is 'unlock': describe unlocking the door with a satisfying click
- CRITICAL \u2014 if intent is 'impossible': the action simply cannot happen. Do NOT describe it succeeding or partially succeeding. Describe only the failure and its reason. No enemy dies, no item is taken, nothing changes.

Recent transcript (last 3 turns, for continuity):
${recentTranscript.slice(-3).map((e) => `${e.role}: ${e.text}`).join("\n")}

Current scene:
${JSON.stringify(sceneContext, null, 2)}

Resolved mechanics:
${JSON.stringify(resolvedFacts, null, 2)}

Output ONLY a JSON object \u2014 no markdown, no extra text:
{"narration":"...","combat_ended":true/false,"outcome":"continue"|"victory"|"defeat"|"flee"}`;
    const messages = [
      { role: "system", content: system },
      { role: "user", content: "Narrate the outcome of this turn." }
    ];
    const raw = await _callStream({ tier: "medium", messages }, onChunk);
    try {
      return JSON.parse(raw);
    } catch {
      const repairMessages = [
        ...messages,
        { role: "assistant", content: raw },
        { role: "user", content: "Your response was not valid JSON. Retry and return only a JSON object matching the schema." }
      ];
      const retry = await _call({ tier: "medium", messages: repairMessages, schema: NARRATOR_SCHEMA });
      return JSON.parse(retry);
    }
  }

  // src/game/loop.js
  function buildScene() {
    const { record, sheet } = appState.party?.pc ?? {};
    const roomId = appState.world?.currentRoom;
    const room = appState.world?.rooms?.[roomId];
    const npcs = Object.values(appState.world?.npcs ?? {}).filter((n) => n.roomId === roomId);
    return {
      room: room ? {
        name: room.name,
        description: room.description,
        exits: (room.exits ?? []).map((e) => ({ direction: e.dir, locked: e.locked ?? false })),
        loot: (room.loot ?? []).filter((i) => !i.taken).map((i) => ({ id: i.id, name: i.name, description: i.description }))
      } : null,
      pc: record ? {
        name: record.name,
        classId: record.classId,
        hpCurrent: record.hpCurrent,
        hpMax: sheet?.hp.max,
        ac: sheet?.ac.value,
        conditions: record.conditions,
        inventory: (appState.party?.inventory ?? []).map((i) => ({ id: i.id, name: i.name }))
      } : null,
      npcs: npcs.map((n) => ({
        id: n.id,
        name: n.name,
        hp: n.hp,
        maxHp: n.maxHp,
        attitude: n.attitude,
        alive: n.alive
      }))
    };
  }
  function doubleDice(spec) {
    return spec.replace(/^(\d+)d(\d+)$/, (_, n, d) => `${Number(n) * 2}d${d}`);
  }
  function resolveRules(classified) {
    const { record, sheet } = appState.party?.pc ?? {};
    if (!record || !sheet) return { intent: "impossible", reason: "No character found" };
    const { intent, target_id: targetId, skill, dc } = classified;
    if (intent === "attack") {
      const target = appState.world?.npcs?.[targetId];
      if (!target) return { intent: "impossible", reason: "No valid target" };
      if (!target.alive) return { intent: "impossible", reason: `${target.name} is already dead` };
      const weapon = sheet.attacks?.[0] ?? {
        name: "unarmed strike",
        attackBonus: sheet.proficiencyBonus + sheet.abilityScores.mod.str,
        damageDice: "1d4",
        damageMod: sheet.abilityScores.mod.str,
        damageType: "bludgeoning"
      };
      const d20 = Dice.roll("1d20");
      const crit = d20.total === 20;
      const fumble = d20.total === 1;
      const totalHit = d20.total + weapon.attackBonus;
      const hit = !fumble && (crit || totalHit >= target.ac);
      let damage = 0;
      let targetNewHp = target.hp;
      let targetDead = false;
      if (hit) {
        const diceSpec = crit ? doubleDice(weapon.damageDice) : weapon.damageDice;
        const dmgRoll = Dice.roll(diceSpec);
        damage = Math.max(1, dmgRoll.total + (weapon.damageMod ?? 0));
        targetNewHp = Math.max(0, target.hp - damage);
        targetDead = targetNewHp <= 0;
      }
      return {
        intent,
        targetId,
        targetName: target.name,
        weaponName: weapon.name,
        d20: d20.total,
        totalHit,
        targetAC: target.ac,
        hit,
        crit,
        fumble,
        damage,
        targetPrevHp: target.hp,
        targetNewHp,
        targetDead
      };
    }
    if (intent === "skill") {
      const SKILL_ABILITY2 = {
        athletics: "str",
        acrobatics: "dex",
        "sleight-of-hand": "dex",
        stealth: "dex",
        arcana: "int",
        history: "int",
        investigation: "int",
        nature: "int",
        religion: "int",
        "animal-handling": "wis",
        insight: "wis",
        medicine: "wis",
        perception: "wis",
        survival: "wis",
        deception: "cha",
        intimidation: "cha",
        performance: "cha",
        persuasion: "cha"
      };
      const skillId = skill ?? "perception";
      const ability2 = SKILL_ABILITY2[skillId] ?? "str";
      const abilMod = sheet.abilityScores.mod[ability2] ?? 0;
      const skillRow = sheet.skills?.[skillId];
      const profBonus = skillRow?.proficient ? sheet.proficiencyBonus : 0;
      const d20 = Dice.roll("1d20");
      const total = d20.total + abilMod + profBonus;
      const checkDC = dc ?? 12;
      return { intent, skill: skillId, ability: ability2, d20: d20.total, abilMod, profBonus, total, dc: checkDC, success: total >= checkDC };
    }
    if (intent === "move") {
      const dir = classified.direction;
      if (!dir) return { intent: "impossible", reason: "No direction given." };
      const room = appState.world?.rooms?.[appState.world?.currentRoom];
      const exit = (room?.exits ?? []).find((e) => e.dir === dir);
      if (!exit) return { intent: "impossible", reason: `No exit to the ${dir}.` };
      if (exit.locked) {
        const hasKey = (appState.party?.inventory ?? []).some((i) => i.id === exit.keyId);
        if (!hasKey) return { intent: "impossible", reason: "The door is locked. You need a key." };
      }
      const newRoom = appState.world?.rooms?.[exit.roomId];
      return {
        intent: "move",
        direction: dir,
        newRoomId: exit.roomId,
        newRoom: {
          name: newRoom?.name,
          description: newRoom?.description,
          npcs: Object.values(appState.world?.npcs ?? {}).filter((n) => n.roomId === exit.roomId && n.alive).map((n) => ({ name: n.name, attitude: n.attitude, intro: n.intro })),
          loot: (newRoom?.loot ?? []).filter((i) => !i.taken).map((i) => ({ name: i.name, description: i.description }))
        }
      };
    }
    if (intent === "take") {
      const roomId = appState.world?.currentRoom;
      const loot = (appState.world?.rooms?.[roomId]?.loot ?? []).filter((i) => !i.taken);
      const item = loot.find((i) => i.id === targetId) ?? (loot.length === 1 ? loot[0] : null);
      if (!item) return { intent: "impossible", reason: "Nothing to take here." };
      return { intent: "take", itemId: item.id, itemName: item.name };
    }
    if (intent === "unlock") {
      const roomId = appState.world?.currentRoom;
      const locked = (appState.world?.rooms?.[roomId]?.exits ?? []).find((e) => e.locked);
      if (!locked) return { intent: "impossible", reason: "Nothing to unlock here." };
      const hasKey = (appState.party?.inventory ?? []).some((i) => i.id === locked.keyId);
      if (!hasKey) return { intent: "impossible", reason: "You don't have the right key." };
      return { intent: "unlock", exitDir: locked.dir, newRoomId: locked.roomId };
    }
    return { intent };
  }
  function goblinRetaliates() {
    const roomId = appState.world?.currentRoom;
    const hostiles = Object.values(appState.world?.npcs ?? {}).filter((n) => n.roomId === roomId && n.alive && n.attitude === "hostile");
    if (!hostiles.length) return null;
    const goblin = hostiles[0];
    const { record, sheet } = appState.party?.pc ?? {};
    if (!record || !sheet) return null;
    const d20 = Dice.roll("1d20");
    const fumble = d20.total === 1;
    const crit = d20.total === 20;
    const totalHit = d20.total + goblin.toHit;
    const hit = !fumble && (crit || totalHit >= sheet.ac.value);
    let damage = 0, pcNewHp = record.hpCurrent;
    if (hit) {
      const spec = crit ? doubleDice(goblin.damageDie) : goblin.damageDie;
      const dmg = Dice.roll(spec);
      damage = Math.max(1, dmg.total + goblin.damageBonus);
      pcNewHp = Math.max(0, record.hpCurrent - damage);
    }
    return {
      goblinName: goblin.name,
      d20: d20.total,
      totalHit,
      pcAC: sheet.ac.value,
      hit,
      crit,
      fumble,
      damage,
      pcPrevHp: record.hpCurrent,
      pcNewHp,
      pcUnconscious: pcNewHp === 0
    };
  }
  function commitAll(resolved, goblinResult) {
    const prev = appState.session?.skillCooldowns ?? {};
    const cooldowns = {};
    for (const [s, turns] of Object.entries(prev)) {
      if (turns > 1) cooldowns[s] = turns - 1;
    }
    if (resolved.intent === "skill") cooldowns[resolved.skill] = 3;
    setValue("session.skillCooldowns", cooldowns);
    if (resolved.intent === "move" && resolved.newRoomId) {
      setValue("world", { ...appState.world, currentRoom: resolved.newRoomId });
    }
    if (resolved.intent === "take") {
      const roomId = appState.world.currentRoom;
      const picked = appState.world.rooms[roomId].loot.find((i) => i.id === resolved.itemId);
      const rooms = { ...appState.world.rooms };
      rooms[roomId] = {
        ...rooms[roomId],
        loot: rooms[roomId].loot.map((i) => i.id === resolved.itemId ? { ...i, taken: true } : i)
      };
      setValue("world", { ...appState.world, rooms });
      setValue("party", { ...appState.party, inventory: [...appState.party?.inventory ?? [], picked] });
    }
    if (resolved.intent === "unlock") {
      const roomId = appState.world.currentRoom;
      const rooms = { ...appState.world.rooms };
      rooms[roomId] = {
        ...rooms[roomId],
        exits: rooms[roomId].exits.map((e) => e.dir === resolved.exitDir ? { ...e, locked: false } : e)
      };
      setValue("world", { ...appState.world, rooms });
    }
    if (resolved.intent === "attack" && resolved.hit) {
      const npcs = { ...appState.world?.npcs };
      npcs[resolved.targetId] = {
        ...npcs[resolved.targetId],
        hp: resolved.targetNewHp,
        alive: !resolved.targetDead,
        attitude: resolved.targetDead ? "dead" : npcs[resolved.targetId].attitude
      };
      setValue("world", { ...appState.world, npcs });
    }
    if (goblinResult?.hit) {
      setValue("party", {
        ...appState.party,
        pc: {
          ...appState.party.pc,
          record: { ...appState.party.pc.record, hpCurrent: goblinResult.pcNewHp }
        }
      });
    }
  }
  function appendTranscript(playerText, gmText) {
    const turn = appState.session?.turnCount ?? 0;
    setValue("transcript", [
      ...appState.transcript ?? [],
      { role: "player", text: playerText, turn },
      { role: "gm", text: gmText, turn }
    ]);
  }
  async function processTurn(playerInput, onNarrationChunk) {
    const scene = buildScene();
    const classified = await classify(playerInput, scene);
    const resolved = resolveRules(classified);
    const goblinTurnTriggered = ["attack", "skill", "wait", "look", "talk", "move", "take", "unlock"].includes(resolved.intent);
    const goblinSurvived = resolved.intent !== "attack" || !resolved.targetDead;
    const goblinResult = goblinTurnTriggered && goblinSurvived ? goblinRetaliates() : null;
    const allEnemiesDead = resolved.targetDead === true && Object.values(appState.world?.npcs ?? {}).filter((n) => n.id !== resolved.targetId).every((n) => !n.alive);
    const pcUnconscious = goblinResult?.hit ? goblinResult.pcNewHp <= 0 : (appState.party?.pc?.record?.hpCurrent ?? 1) <= 0;
    const narratorResp = await narrate(
      {
        playerAction: playerInput,
        pcAction: resolved,
        enemyRetaliation: goblinResult,
        allEnemiesDead,
        pcUnconscious
      },
      scene,
      appState.transcript ?? [],
      onNarrationChunk
    );
    commitAll(resolved, goblinResult);
    appendTranscript(playerInput, narratorResp.narration);
    addValue("session.turnCount", 1);
    saveToStorage();
    return { ...narratorResp, _debug: { classified, resolved, goblinResult } };
  }

  // src/ui/console.js
  var console_exports = {};
  __export(console_exports, {
    appendEntry: () => appendEntry,
    appendStreamChunk: () => appendStreamChunk,
    beginStreamEntry: () => beginStreamEntry,
    clear: () => clear,
    clearChips: () => clearChips,
    hideSceneImage: () => hideSceneImage,
    initCollapsibles: () => initCollapsibles,
    initCopyKeyButton: () => initCopyKeyButton,
    insertActionChip: () => insertActionChip,
    pickFrom: () => pickFrom,
    prompt: () => prompt,
    restoreSceneImage: () => restoreSceneImage,
    setSceneImage: () => setSceneImage,
    setSketchOpacity: () => setSketchOpacity,
    setThinking: () => setThinking,
    showActionChips: () => showActionChips,
    showCharacterChips: () => showCharacterChips,
    showRoomChips: () => showRoomChips,
    showSceneImageLoading: () => showSceneImageLoading,
    showSkillChips: () => showSkillChips,
    updateActionBar: () => updateActionBar,
    updateDebugPanel: () => updateDebugPanel,
    updateEnemyStats: () => updateEnemyStats,
    updatePCHeaderStats: () => updatePCHeaderStats,
    updatePCStats: () => updatePCStats
  });
  var _tip = document.createElement("div");
  _tip.id = "ab-tooltip";
  document.body.appendChild(_tip);
  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest("[data-tip]");
    if (!el) return;
    _tip.textContent = el.dataset.tip;
    const r = el.getBoundingClientRect();
    _tip.style.left = `${r.left + r.width / 2}px`;
    _tip.style.top = `${r.top - 8}px`;
    _tip.style.transform = "translate(-50%, -100%)";
    _tip.classList.add("visible");
  });
  document.addEventListener("mouseout", (e) => {
    if (!e.target.closest("[data-tip]")) return;
    _tip.classList.remove("visible");
  });
  var _history = [];
  var _historyCursor = -1;
  var _historyDraft = "";
  var transcriptEl = () => document.getElementById("transcript");
  var pcStatsEl = () => document.getElementById("pc-stats");
  var enemyStatsEl = () => document.getElementById("enemy-stats");
  var actionChipsEl = () => document.getElementById("action-chips");
  var cmdEl = () => document.getElementById("cmd");
  var _resolveInput = null;
  var inputRowEl = () => document.getElementById("input-row");
  cmdEl().addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") {
      if (!_history.length || cmdEl().disabled) return;
      e.preventDefault();
      if (_historyCursor === -1) {
        _historyDraft = cmdEl().value;
        _historyCursor = _history.length - 1;
      } else if (_historyCursor > 0) {
        _historyCursor--;
      }
      cmdEl().value = _history[_historyCursor];
      cmdEl().setSelectionRange(cmdEl().value.length, cmdEl().value.length);
      return;
    }
    if (e.key === "ArrowDown") {
      if (_historyCursor === -1 || cmdEl().disabled) return;
      e.preventDefault();
      if (_historyCursor < _history.length - 1) {
        _historyCursor++;
        cmdEl().value = _history[_historyCursor];
      } else {
        _historyCursor = -1;
        cmdEl().value = _historyDraft;
      }
      cmdEl().setSelectionRange(cmdEl().value.length, cmdEl().value.length);
      return;
    }
    if (e.key !== "Enter") return;
    const val = cmdEl().value.trim();
    cmdEl().value = "";
    _historyCursor = -1;
    _historyDraft = "";
    if (val) _history.push(val);
    if (_resolveInput) {
      const fn = _resolveInput;
      _resolveInput = null;
      setInputEnabled(false);
      fn(val);
    }
  });
  cmdEl().addEventListener("focus", () => inputRowEl()?.classList.add("active"));
  cmdEl().addEventListener("blur", () => inputRowEl()?.classList.remove("active"));
  transcriptEl().addEventListener("click", () => {
    if (!cmdEl().disabled) cmdEl().focus();
  });
  function setInputEnabled(on, placeholder = "What do you do?") {
    const el = cmdEl();
    el.disabled = !on;
    if (on) {
      el.placeholder = placeholder;
      el.focus();
    } else {
      el.placeholder = "\u2026";
    }
  }
  function clear() {
    transcriptEl().querySelectorAll(".entry").forEach((e) => e.remove());
  }
  function appendEntry(role, text) {
    const el = document.createElement("div");
    el.className = `entry entry-${role}`;
    el.textContent = text;
    transcriptEl().appendChild(el);
    el.scrollIntoView({ behavior: "smooth", block: "end" });
    return el;
  }
  function beginStreamEntry(role) {
    const el = document.createElement("div");
    el.className = `entry entry-${role}`;
    transcriptEl().appendChild(el);
    el.scrollIntoView({ behavior: "smooth", block: "end" });
    return el;
  }
  function appendStreamChunk(el, chunk) {
    el.textContent += chunk;
    el.scrollIntoView({ behavior: "smooth", block: "end" });
  }
  function setThinking(on) {
    const ID = "thinking-indicator";
    if (on) {
      if (document.getElementById(ID)) return;
      const el = appendEntry("thinking", "\u23F3 The Dungeon Master considers\u2026");
      el.id = ID;
    } else {
      document.getElementById(ID)?.remove();
    }
  }
  function prompt(message) {
    if (message) appendEntry("system", message);
    setInputEnabled(true, message || "What do you do?");
    return new Promise((resolve) => {
      _resolveInput = resolve;
    });
  }
  async function pickFrom(message, options, labelFn = (x) => x, defaultIdx = -1) {
    appendEntry("system", message);
    options.forEach((opt, i) => {
      const isDefault = i === defaultIdx;
      appendEntry(
        isDefault ? "option-default" : "option",
        `  ${i + 1}. ${labelFn(opt)}${isDefault ? "  \u2190 default" : ""}`
      );
    });
    appendEntry("system", "");
    while (true) {
      const input = await prompt(defaultIdx >= 0 ? "Enter a number, name, or press Enter for default:" : "Enter a number or name:");
      if (input.trim() === "" && defaultIdx >= 0) return options[defaultIdx];
      const num = parseInt(input, 10);
      if (!isNaN(num) && num >= 1 && num <= options.length) return options[num - 1];
      const match = options.find(
        (o) => o.toLowerCase() === input.toLowerCase() || labelFn(o).toLowerCase() === input.toLowerCase()
      );
      if (match) return match;
      appendEntry("error", `Please enter 1\u2013${options.length} or the option name.`);
    }
  }
  function updatePCHeaderStats(record, sheet) {
    const el = document.getElementById("pc-header-stats");
    if (!el) return;
    if (!record || !sheet) {
      el.innerHTML = "";
      return;
    }
    const hp = record.hpCurrent ?? sheet.hp.max;
    const maxHp = sheet.hp.max;
    const low = hp <= Math.floor(maxHp / 4);
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    el.innerHTML = `<span class="hs-name">${escHtml(record.name)}</span><span class="hs-sep">\xB7</span>${escHtml(cap(record.classId))}<span class="hs-sep">\xB7</span>HP <span class="${low ? "hs-hp-low" : "hs-hp-ok"}">${hp}/${maxHp}</span><span class="hs-sep">\xB7</span>AC ${sheet.ac.value}`;
  }
  function updatePCStats(record, sheet, inventory = []) {
    if (!record || !sheet) {
      pcStatsEl().innerHTML = "";
      return;
    }
    const hp = record.hpCurrent ?? sheet.hp.max;
    const maxHp = sheet.hp.max;
    const low = hp <= Math.floor(maxHp / 4);
    const bagRow = inventory.length ? `<div class="stat-row">Bag  ${inventory.map((i) => i.name).join(", ")}</div>` : "";
    pcStatsEl().innerHTML = `
    <div class="stat-block">
      <div class="stat-name">${record.name}</div>
      <div class="stat-row">HP  <span class="hp${low ? " low" : ""}">${hp}/${maxHp}</span></div>
      <div class="stat-row">AC  ${sheet.ac.value}</div>
      <div class="stat-row">${record.classId.charAt(0).toUpperCase() + record.classId.slice(1)} ${record.level}</div>
      <div class="stat-row">PB  +${sheet.proficiencyBonus}</div>
      ${bagRow}
    </div>`;
  }
  function updateEnemyStats(npcs) {
    const alive = (Array.isArray(npcs) ? npcs : Object.values(npcs ?? {})).filter((n) => n.alive);
    if (!alive.length) {
      enemyStatsEl().innerHTML = '<div class="muted">No enemies</div>';
      return;
    }
    enemyStatsEl().innerHTML = alive.map((n) => {
      const low = n.hp <= Math.floor(n.maxHp / 4);
      return `<div class="stat-block enemy">
      <div class="stat-name">${n.name}</div>
      <div class="stat-row">HP <span class="hp${low ? " low" : ""}">${n.hp}/${n.maxHp}</span></div>
    </div>`;
    }).join("");
  }
  var MOBILE_BREAKPOINT = 768;
  function makePanel(panel, storageKey, extraUpdate) {
    function set(open) {
      panel.classList.toggle("collapsed", !open);
      panel.setAttribute("aria-expanded", String(open));
      localStorage.setItem(storageKey, open ? "open" : "closed");
      extraUpdate?.(open);
    }
    function storedOrDefault() {
      const v = localStorage.getItem(storageKey);
      return v !== null ? v === "open" : window.innerWidth >= MOBILE_BREAKPOINT;
    }
    return { set, storedOrDefault };
  }
  var _setDebug = null;
  var _debugBar = null;
  var _debugPanel = null;
  function initCopyKeyButton(getKey) {
    const btn = document.getElementById("copy-key-btn");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(getKey());
      btn.textContent = "\u2713";
      setTimeout(() => {
        btn.textContent = "\u{1F511}";
      }, 1200);
    });
  }
  function initCollapsibles() {
    const sidebar = document.getElementById("sidebar");
    const sidebarBtn = document.getElementById("sidebar-toggle");
    if (sidebar && sidebarBtn) {
      const { set, storedOrDefault } = makePanel(sidebar, "dg-sidebar", (open) => {
        sidebarBtn.textContent = open ? "\u25C0" : "\u25B6";
      });
      set(storedOrDefault());
      sidebarBtn.addEventListener("click", () => set(sidebar.classList.contains("collapsed")));
    }
    _debugPanel = document.getElementById("debug-panel");
    _debugBar = document.getElementById("debug-bar");
    const chevron = _debugBar?.querySelector(".toggle-chevron");
    if (_debugPanel && _debugBar) {
      const { set, storedOrDefault } = makePanel(_debugBar, "dg-debug", (open) => {
        _debugPanel.classList.toggle("collapsed", !open);
        if (chevron) chevron.textContent = open ? "\u25B4" : "\u25BE";
      });
      _setDebug = set;
      _setDebug._initial = storedOrDefault();
      _debugBar.addEventListener(
        "click",
        () => _setDebug(_debugPanel.classList.contains("collapsed"))
      );
      _debugBar.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          _debugBar.click();
        }
      });
    }
  }
  function escHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function updateDebugPanel(debug) {
    const el = _debugPanel;
    if (!el) return;
    if (!debug) {
      el.innerHTML = "";
      return;
    }
    if (_debugBar && !_debugBar.classList.contains("visible")) {
      _debugBar.classList.add("visible");
      _setDebug?.(_setDebug._initial ?? true);
    }
    const { classified, resolved, goblinResult } = debug;
    const sections = [];
    function sec(label) {
      const s = { label, rows: [] };
      sections.push(s);
      return s;
    }
    const cs = sec("intent");
    cs.rows.push({ text: `${classified.intent}${classified.target_id ? " \u2192 " + classified.target_id : ""}` });
    if (classified.direction) cs.rows.push({ text: `dir: ${classified.direction}` });
    if (classified.skill) cs.rows.push({ text: `skill: ${classified.skill}` });
    if (classified.dc != null) cs.rows.push({ text: `dc: ${classified.dc}` });
    if (classified.reason) cs.rows.push({ text: classified.reason, cls: "dim" });
    function d20Html(val) {
      if (val === 1) return `d20  <strong class="nat-1">${val}</strong>`;
      if (val === 20) return `d20  <strong class="nat-20">${val}</strong>`;
      return escHtml(`d20  ${val}`);
    }
    if (resolved.intent === "attack") {
      const s = sec("pc attack");
      s.rows.push({ text: resolved.weaponName });
      const bonus = resolved.totalHit - resolved.d20;
      s.rows.push({ html: `${d20Html(resolved.d20)}  +${escHtml(String(bonus))}  \u2192 ${escHtml(String(resolved.totalHit))}` });
      const label = resolved.crit ? "CRIT \u2713" : resolved.fumble ? "FUMBLE \u2717" : resolved.hit ? "HIT \u2713" : "MISS \u2717";
      s.rows.push({ text: `AC   ${resolved.targetAC}  ${label}`, cls: resolved.hit && !resolved.fumble ? "hit" : "miss" });
      if (resolved.hit) {
        s.rows.push({ text: `dmg  ${resolved.damage}` });
        s.rows.push({ text: `${resolved.targetName}  ${resolved.targetPrevHp} \u2192 ${resolved.targetNewHp}${resolved.targetDead ? "  \u2717" : ""}` });
      }
    } else if (resolved.intent === "skill") {
      const s = sec(`skill: ${resolved.skill} (${resolved.ability})`);
      const bonus = resolved.abilMod + resolved.profBonus;
      s.rows.push({ html: `${d20Html(resolved.d20)}  +${escHtml(String(bonus))}  \u2192 ${escHtml(String(resolved.total))}` });
      s.rows.push({ text: `DC   ${resolved.dc}  ${resolved.success ? "PASS \u2713" : "FAIL \u2717"}`, cls: resolved.success ? "hit" : "miss" });
    } else {
      const s = sec("pc action");
      s.rows.push({ text: resolved.intent });
      if (resolved.reason) s.rows.push({ text: resolved.reason, cls: "dim" });
    }
    if (goblinResult) {
      const s = sec(goblinResult.goblinName);
      const bonus = goblinResult.totalHit - goblinResult.d20;
      s.rows.push({ html: `${d20Html(goblinResult.d20)}  +${escHtml(String(bonus))}  \u2192 ${escHtml(String(goblinResult.totalHit))}` });
      const label = goblinResult.crit ? "CRIT \u2713" : goblinResult.fumble ? "FUMBLE \u2717" : goblinResult.hit ? "HIT \u2713" : "MISS \u2717";
      s.rows.push({ text: `AC   ${goblinResult.pcAC}  ${label}`, cls: goblinResult.hit && !goblinResult.fumble ? "hit" : "miss" });
      if (goblinResult.hit) {
        s.rows.push({ text: `dmg  ${goblinResult.damage}` });
        s.rows.push({ text: `you  ${goblinResult.pcPrevHp} \u2192 ${goblinResult.pcNewHp}${goblinResult.pcUnconscious ? "  (down)" : ""}` });
      }
    }
    el.innerHTML = sections.map((s) => `<div class="dbg-section">
    <div class="dbg-sep">${escHtml(s.label)}</div>
    ${s.rows.map((r) => `<div class="dbg-row${r.cls ? " " + r.cls : ""}">${r.html ?? escHtml(r.text)}</div>`).join("")}
  </div>`).join("");
  }
  var skillChipsEl = () => document.getElementById("skill-chips");
  var characterChipsEl = () => document.getElementById("character-chips");
  function classAbilities(record, sheet) {
    const lvl = record.level ?? 1;
    const sneakDice = Math.ceil(lvl / 2);
    const dc = sheet.spellcasting?.saveDC ?? "?";
    const spAtk = sheet.spellcasting?.attackBonus ?? "?";
    return {
      fighter: [
        { label: "Second Wind", note: `Bonus action: regain 1d10+${lvl} HP.
Once per short rest.`, text: "I use Second Wind to heal myself" },
        { label: "Action Surge", note: "Take one additional action this turn.\nOnce per short rest.", text: "I use Action Surge for an extra action" }
      ],
      rogue: [
        { label: "Sneak Attack", note: `Deal ${sneakDice}d6 extra damage when you have advantage
or an ally flanks your target.`, text: "I make a Sneak Attack" },
        { label: "Cunning Action", note: "Bonus action: Dash, Disengage, or Hide.\nKeeps you mobile without spending your main action.", text: "I use Cunning Action to " }
      ],
      cleric: [
        { label: "Turn Undead", note: `Channel Divinity: undead within 30 ft must flee.
WIS save DC ${dc} or be turned for 1 minute.`, text: "I use Channel Divinity: Turn Undead" },
        { label: "Cast Spell", note: `Cast a prepared spell. Targets resist with DC ${dc}.
Concentration spells last until broken or you cast another.`, text: "I cast a spell at " }
      ],
      wizard: [
        { label: "Arcane Recovery", note: `Short rest: regain spell slots up to level ${Math.ceil(lvl / 2)}.
Once per long rest.`, text: "I use Arcane Recovery" },
        { label: "Cast Spell", note: `Cast a prepared spell. +${spAtk} to spell attack rolls.
Higher spell slots deal more damage or last longer.`, text: "I cast a spell at " }
      ]
    }[record.classId] ?? [];
  }
  function prefillChip(text) {
    cmdEl().value = text;
    cmdEl().focus();
    cmdEl().setSelectionRange(text.length, text.length);
  }
  function fireChip(val) {
    if (_resolveInput) {
      const fn = _resolveInput;
      _resolveInput = null;
      setInputEnabled(false);
      cmdEl().value = "";
      fn(val);
    } else {
      prefillChip(val);
    }
  }
  function showCharacterChips(record, sheet) {
    const el = characterChipsEl();
    if (!el) return;
    el.innerHTML = "";
    if (!record || !sheet) return;
    for (const atk of sheet.attacks ?? []) {
      const btn = document.createElement("button");
      btn.className = "chip";
      btn.innerHTML = `<span class="skill-name">${atk.name}</span><span class="skill-ab">+${atk.attackBonus} ${atk.damageDice}</span>`;
      btn.addEventListener("click", () => prefillChip(`I attack with my ${atk.name}`));
      el.appendChild(btn);
    }
    if (sheet.spellcasting) {
      const info = document.createElement("div");
      info.className = "char-spell-info";
      info.textContent = `Spell save DC ${sheet.spellcasting.saveDC} \xB7 spell atk +${sheet.spellcasting.attackBonus}`;
      el.appendChild(info);
    }
    for (const ability2 of classAbilities(record, sheet)) {
      const btn = document.createElement("button");
      btn.className = "chip";
      btn.innerHTML = `<span class="skill-name">${ability2.label}</span><span class="skill-ab">${ability2.note}</span>`;
      btn.addEventListener("click", () => prefillChip(ability2.text));
      el.appendChild(btn);
    }
  }
  var SKILLS = [
    { id: "athletics", label: "Athletics", ab: "STR", desc: "Climb, jump, swim, or grapple. Raw physical effort against resistance." },
    { id: "acrobatics", label: "Acrobatics", ab: "DEX", desc: "Balance, tumble, or escape a grapple. Finesse and body control." },
    { id: "sleight-of-hand", label: "Sleight of Hand", ab: "DEX", desc: "Pick pockets, plant objects, or perform manual trickery unseen." },
    { id: "stealth", label: "Stealth", ab: "DEX", desc: "Move silently and stay hidden. Opposed by passive Perception." },
    { id: "arcana", label: "Arcana", ab: "INT", desc: "Recall lore about spells, magic items, and the planes." },
    { id: "history", label: "History", ab: "INT", desc: "Recall past events, legendary figures, and ancient civilisations." },
    { id: "investigation", label: "Investigation", ab: "INT", desc: "Search for clues, find hidden doors, or deduce what happened." },
    { id: "nature", label: "Nature", ab: "INT", desc: "Identify plants, animals, weather patterns, and natural hazards." },
    { id: "religion", label: "Religion", ab: "INT", desc: "Recall lore about deities, rites, cults, and holy symbols." },
    { id: "animal-handling", label: "Animal Handling", ab: "WIS", desc: "Calm, guide, or read the intent of beasts and mounts." },
    { id: "insight", label: "Insight", ab: "WIS", desc: "Read someone's true feelings or detect when they're lying." },
    { id: "medicine", label: "Medicine", ab: "WIS", desc: "Stabilise a dying creature, diagnose ailments, or tend wounds." },
    { id: "perception", label: "Perception", ab: "WIS", desc: "Notice threats, spot hidden creatures, or hear distant sounds." },
    { id: "survival", label: "Survival", ab: "WIS", desc: "Track prey, forage food, navigate terrain, or endure the wild." },
    { id: "deception", label: "Deception", ab: "CHA", desc: "Lie convincingly, disguise your intent, or create a false impression." },
    { id: "intimidation", label: "Intimidation", ab: "CHA", desc: "Coerce through threats, menace, or sheer force of presence." },
    { id: "performance", label: "Performance", ab: "CHA", desc: "Entertain, impersonate, or captivate an audience." },
    { id: "persuasion", label: "Persuasion", ab: "CHA", desc: "Win someone over through charm, reasoned argument, or diplomacy." }
  ];
  function showSkillChips(cooldowns = {}) {
    const el = skillChipsEl();
    if (!el) return;
    el.innerHTML = "";
    for (const skill of SKILLS) {
      const remaining = cooldowns[skill.id] ?? 0;
      const onCooldown = remaining > 0;
      const btn = document.createElement("button");
      btn.className = "chip skill-chip" + (onCooldown ? " disabled" : "");
      btn.disabled = onCooldown;
      btn.innerHTML = `<span class="skill-name">${skill.label}</span><span class="skill-ab">${skill.ab}${onCooldown ? ` (${remaining})` : ""}</span>`;
      if (!onCooldown) {
        btn.addEventListener("click", () => prefillChip(`I use ${skill.label}`));
      }
      el.appendChild(btn);
    }
  }
  function insertActionChip(label, value) {
    const el = actionChipsEl();
    if (!el) return;
    const btn = document.createElement("button");
    btn.className = "chip chip-retry";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      if (_resolveInput) {
        const fn = _resolveInput;
        _resolveInput = null;
        setInputEnabled(false);
        cmdEl().value = "";
        fn(value);
      } else {
        cmdEl().value = value;
        cmdEl().focus();
      }
    });
    el.insertBefore(btn, el.firstChild);
  }
  function showActionChips(actions) {
    const el = actionChipsEl();
    if (!el) return;
    for (const action of actions) {
      const btn = document.createElement("button");
      btn.className = "chip";
      btn.textContent = action.label;
      btn.addEventListener("click", () => fireChip(action.value ?? action.label));
      el.appendChild(btn);
    }
  }
  function clearChips() {
    const a = actionChipsEl(), c = characterChipsEl(), s = skillChipsEl();
    if (a) a.innerHTML = "";
    if (c) c.innerHTML = "";
    if (s) s.innerHTML = "";
  }
  var transcriptBgEl = () => document.getElementById("transcript-bg");
  function showSceneImageLoading() {
  }
  function setSceneImage(src) {
    const el = transcriptBgEl();
    if (el) el.style.backgroundImage = `url("${src}")`;
    try {
      localStorage.setItem("sketch-last-image", src);
    } catch {
    }
  }
  function restoreSceneImage() {
    const src = localStorage.getItem("sketch-last-image");
    if (!src) return false;
    const el = transcriptBgEl();
    if (el) el.style.backgroundImage = `url("${src}")`;
    return true;
  }
  function hideSceneImage() {
    const el = transcriptBgEl();
    if (el) el.classList.add("sketch-off");
  }
  function setSketchOpacity(tier) {
    const el = transcriptBgEl();
    if (!el) return;
    el.classList.remove("sketch-off", "sketch-hi");
    if (tier === "off") el.classList.add("sketch-off");
    if (tier === "hi") el.classList.add("sketch-hi");
  }
  function showRoomChips(exits, loot) {
    const ICON = { north: "\u2191", south: "\u2193", east: "\u2192", west: "\u2190" };
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const actions = [
      ...exits.map((e) => ({
        label: `${ICON[e.dir] ?? "\u2192"} ${cap(e.dir)}${e.locked ? " \u{1F512}" : ""}`,
        value: `I go ${e.dir}`
      })),
      ...loot.filter((i) => !i.taken).map((i) => ({
        label: `Take ${i.name}`,
        value: `I take the ${i.name}`
      })),
      ...exits.some((e) => e.locked) ? [{ label: "\u{1F511} Unlock", value: "I use the key to unlock the door" }] : [],
      { label: "\u2694 Attack", value: "I attack" },
      { label: "\u{1F441} Look around", value: "I look around carefully" },
      { label: "\u{1F4AC} Talk", value: "I try to talk" },
      { label: "\u23F3 Wait", value: "I wait and watch" }
    ];
    showActionChips(actions);
  }
  function updateActionBar(exits, record, sheet, cooldowns) {
    const DIRS = ["north", "east", "south", "west"];
    for (const dir of DIRS) {
      const btn = document.getElementById(`ab-${dir}`);
      if (!btn) continue;
      const exit = exits.find((e) => e.dir === dir);
      btn.disabled = !exit;
      btn.classList.toggle("ab-locked", !!exit?.locked);
      btn.onclick = exit ? () => fireChip(exit.locked ? `I try to unlock the door to the ${dir}` : `I go ${dir}`) : null;
      if (exit?.locked) {
        btn.dataset.tip = `${dir.charAt(0).toUpperCase() + dir.slice(1)} \u2014 locked
Try to force or unlock the door.`;
      } else if (exit) {
        btn.dataset.tip = `${dir.charAt(0).toUpperCase() + dir.slice(1)} \u2014 passage open
${exit.description ?? "Move in this direction."}`;
      } else {
        btn.dataset.tip = `${dir.charAt(0).toUpperCase() + dir.slice(1)} \u2014 no exit`;
      }
    }
    const abEl = document.getElementById("ab-abilities-list");
    if (abEl) {
      abEl.innerHTML = "";
      if (record && sheet) {
        for (const atk of sheet.attacks ?? []) {
          const btn = document.createElement("span");
          btn.className = "ab-word ab-available";
          btn.dataset.tip = `Attack
+${atk.attackBonus} to hit \xB7 ${atk.damageDice} damage`;
          btn.textContent = atk.name;
          abEl.appendChild(btn);
        }
        for (const ability2 of classAbilities(record, sheet)) {
          const btn = document.createElement("span");
          btn.className = "ab-word ab-available";
          btn.dataset.tip = ability2.note;
          btn.textContent = ability2.label;
          abEl.appendChild(btn);
        }
      }
    }
    const skEl = document.getElementById("ab-skills-list");
    if (skEl) {
      skEl.innerHTML = "";
      for (const skill of SKILLS) {
        const remaining = cooldowns[skill.id] ?? 0;
        const onCd = remaining > 0;
        const btn = document.createElement("span");
        btn.className = "ab-word " + (onCd ? "ab-unavailable" : "ab-available");
        btn.dataset.tip = onCd ? `${skill.label} \xB7 ${skill.ab}
${skill.desc}

Cooldown: ${remaining} turn${remaining > 1 ? "s" : ""} remaining` : `${skill.label} \xB7 ${skill.ab}
${skill.desc}`;
        btn.textContent = skill.label + (onCd ? ` (${remaining})` : "");
        skEl.appendChild(btn);
      }
    }
  }

  // src/main.js
  var sketchView = "windowed";
  function applySketchView(view) {
    sketchView = view;
    setSketchOpacity(view === "minimized" ? "off" : view === "maximized" ? "hi" : "normal");
    if (view !== "minimized") restoreSceneImage();
    ["min", "win", "max"].forEach((id) => {
      const map = { min: "minimized", win: "windowed", max: "maximized" };
      document.getElementById(`sketch-btn-${id}`)?.setAttribute("aria-pressed", String(map[id] === view));
    });
  }
  var journalLog = [];
  function registerReactiveSidebar() {
    computed("ui.costDisplay", ["ai.totalTokens", "ai.totalCostUsd"], (s) => {
      const tokens = s.ai?.totalTokens ?? 0;
      const cost = s.ai?.totalCostUsd ?? 0;
      return tokens > 0 ? "$" + cost.toFixed(4) + " \xB7 " + tokens.toLocaleString() + " tok" : "";
    });
    addSystem(["party.pc", "party.inventory", "world.currentRoom", "world.npcs"], () => {
      const pc = appState.party?.pc;
      updatePCStats(pc?.record, pc?.sheet, appState.party?.inventory ?? []);
      updatePCHeaderStats(pc?.record, pc?.sheet);
      const currentRoom = appState.world?.currentRoom;
      const roomNpcs = Object.values(appState.world?.npcs ?? {}).filter((n) => n.roomId === currentRoom);
      updateEnemyStats(roomNpcs);
    });
  }
  function buildImagePrompt(narration) {
    const roomId = appState.world?.currentRoom;
    const room = appState.world?.rooms?.[roomId];
    const npcs = Object.values(appState.world?.npcs ?? {}).filter((n) => n.roomId === roomId && n.alive).map((n) => n.name);
    const base = narration || room?.description || "A dark dungeon corridor";
    return npcs.length ? `${base} ${npcs.join(", ")} present.` : base;
  }
  function requestSceneImage(narration, journalEntry = null) {
    if (sketchView === "minimized") return Promise.resolve(null);
    showSceneImageLoading();
    return generateSceneImage(buildImagePrompt(narration)).then((src) => {
      console.log("[scene-image] generateSceneImage resolved:", src ? `data URI ${src.length} chars` : "null");
      src ? setSceneImage(src) : hideSceneImage();
      if (src && journalEntry) journalEntry.imageSrc = src;
      return src;
    }).catch((e) => {
      console.warn("[scene-image] uncaught error", e);
      hideSceneImage();
      return null;
    });
  }
  var DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
  async function setupKey() {
    clear();
    appendEntry("gm", "\u2694  DUNGEONS & DANS  \u2694");
    appendEntry("system", "");
    appendEntry("system", "To play, you need a free OpenRouter API key.");
    appendEntry("system", "Sign up at openrouter.ai \u2192 API Keys.");
    appendEntry("system", "");
    const key = await prompt("Paste your OpenRouter API key:");
    setValue("ai.key", key.trim());
    appendEntry("system", "");
    appendEntry("system", `Default base URL: ${DEFAULT_BASE_URL}`);
    const customUrl = await prompt("Custom base URL (press Enter to use the default):");
    if (customUrl.trim()) setValue("ai.baseUrl", customUrl.trim());
    appendEntry("system", "");
    appendEntry("system", "Key saved. You can change it later with /settings.");
    saveToStorage();
  }
  async function reAuthKey() {
    setValue("ai.key", "");
    tick();
    appendEntry("system", "");
    appendEntry("error", "API key rejected \u2014 Missing Authentication header (401).");
    const key = await prompt("Paste a valid OpenRouter API key to continue:");
    if (key.trim()) {
      setValue("ai.key", key.trim());
      tick();
      saveToStorage();
      appendEntry("system", "Key updated \u2014 retrying\u2026");
    }
  }
  async function startNewGame() {
    const world = generateWorld();
    setValue("world", world);
    setValue("party", { pc: null, inventory: [] });
    setValue("flags", {});
    setValue("transcript", []);
    setValue("session.turnCount", 0);
    setValue("session.phase", "char-create");
    const result = await createCharacter(console_exports);
    if (!result) {
      appendEntry("error", "Character creation cancelled. Refresh to try again.");
      return;
    }
    setValue("party.pc", result);
    appendEntry("system", "");
    appendEntry("system", "(black ink on sepia parchment \u2014 costs a few extra credits per turn)");
    const sketchChoice = await pickFrom(
      "Generate an AI scene sketch after each turn?",
      ["yes", "no"],
      (x) => x === "yes" ? "\u{1F5BC} Yes, sketch each scene" : "\u2717 No thanks",
      1
      // default: no
    );
    const wantsSketch = sketchChoice === "yes";
    setValue("settings.sceneImage", wantsSketch);
    const sketchControls = document.getElementById("sketch-controls");
    if (sketchControls) sketchControls.style.display = wantsSketch ? "" : "none";
    setValue("session.phase", "play");
    tick();
    saveToStorage();
    await beginAdventure();
  }
  async function beginAdventure() {
    const room = appState.world.rooms[appState.world.currentRoom];
    const pc = appState.party.pc;
    clear();
    appendEntry("system", "\u2500\u2500 THE ADVENTURE BEGINS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
    appendEntry("system", "");
    appendEntry("gm", room.description);
    appendEntry("system", "");
    const exits = room.exits.map((e) => e.dir).join(", ");
    appendEntry("system", `Exits: ${exits}`);
    appendEntry("system", "");
    appendEntry(
      "system",
      `You are ${pc.record.name}, a level 1 ${pc.record.classId}. HP: ${pc.record.hpCurrent}/${pc.sheet.hp.max}  AC: ${pc.sheet.ac.value}`
    );
    appendEntry("system", "");
    const openingEntry = { turn: 0, narration: room.description, imageSrc: null };
    journalLog.push(openingEntry);
    if (appState.settings?.sceneImage) requestSceneImage(room.description, openingEntry);
    if (appState.settings?.actionBar) updateActionBar(room.exits ?? [], appState.party?.pc?.record, appState.party?.pc?.sheet, {});
    await playLoop();
  }
  var RETRY_DELAYS = [1e3, 2e3, 4e3];
  async function playLoop() {
    let pendingRetry = null;
    while (true) {
      let onChunk = function(text) {
        if (!streamEl) {
          setThinking(false);
          streamEl = beginStreamEntry("gm");
        }
        appendStreamChunk(streamEl, text);
      };
      if (appState.session.phase !== "play") break;
      const inExitRoom = appState.world?.currentRoom === appState.world?.exitRoomId;
      if (inExitRoom) {
        await doVictory();
        break;
      }
      const pcHp = appState.party?.pc?.record?.hpCurrent ?? 1;
      if (pcHp <= 0) {
        await doDefeat();
        break;
      }
      const room = appState.world?.rooms?.[appState.world?.currentRoom];
      showRoomChips(room?.exits ?? [], room?.loot ?? []);
      showCharacterChips(appState.party?.pc?.record, appState.party?.pc?.sheet);
      showSkillChips(appState.session?.skillCooldowns ?? {});
      if (appState.settings?.actionBar) {
        updateActionBar(room?.exits ?? [], appState.party?.pc?.record, appState.party?.pc?.sheet, appState.session?.skillCooldowns ?? {});
      }
      if (pendingRetry) {
        insertActionChip("\u21BA Retry", pendingRetry);
        pendingRetry = null;
      }
      const raw = await prompt("");
      if (!raw.trim()) continue;
      if (raw.startsWith("/")) {
        await handleMeta(raw);
        continue;
      }
      appendEntry("player", `> ${raw}`);
      clearChips();
      setThinking(true);
      let streamEl = null;
      let result = null;
      let caughtErr = null;
      let reauthed = false;
      for (let attempt2 = 0; attempt2 <= RETRY_DELAYS.length; attempt2++) {
        if (attempt2 > 0) {
          streamEl?.remove();
          streamEl = null;
          setThinking(false);
          appendEntry("system", `\u23F3 Retrying\u2026 (${attempt2}/${RETRY_DELAYS.length})`);
          await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt2 - 1]));
          setThinking(true);
        }
        try {
          result = await processTurn(raw, onChunk);
          caughtErr = null;
          break;
        } catch (e) {
          caughtErr = e;
          if (/^AI 401:/.test(e.message) && !reauthed) {
            reauthed = true;
            streamEl?.remove();
            streamEl = null;
            setThinking(false);
            await reAuthKey();
            setThinking(true);
            attempt2--;
            caughtErr = null;
            continue;
          }
          if (!/^AI 4\d\d:/.test(e.message) || attempt2 === RETRY_DELAYS.length) break;
        }
      }
      if (caughtErr) {
        setThinking(false);
        streamEl?.remove();
        streamEl = null;
        appendEntry("system", "");
        if (/^AI 401:/.test(caughtErr.message)) {
          appendEntry("error", "Still failing after re-authentication. Use /settings to update your API key.");
        } else if (/^AI 4\d\d:/.test(caughtErr.message)) {
          appendEntry("gm", "The Game Master was not available. Try again when you are ready.");
          pendingRetry = raw;
        } else {
          appendEntry("error", `Error: ${caughtErr.message}`);
          appendEntry("system", "The turn was not resolved. Try again or type /restart.");
        }
        continue;
      }
      tick();
      setThinking(false);
      if (!streamEl && result?.narration) appendEntry("gm", result.narration);
      appendEntry("system", "");
      const journalEntry = { turn: appState.session?.turnCount ?? 0, narration: result?.narration ?? "", imageSrc: null };
      journalLog.push(journalEntry);
      if (appState.settings?.sceneImage) requestSceneImage(result?.narration, journalEntry);
      updateDebugPanel(result?._debug);
    }
  }
  async function doVictory() {
    setValue("session.phase", "game-over");
    const room = appState.world?.rooms?.[appState.world?.exitRoomId];
    const treasure = (room?.loot ?? []).find((i) => i.type === "treasure");
    appendEntry("system", "");
    appendEntry("system", "\u2550\u2550 VICTORY \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
    appendEntry(
      "gm",
      `You have found ${treasure?.name ?? "the treasure"} and made it out alive. The adventure ends in triumph \u2014 for now.`
    );
    appendEntry("system", "");
    appendEntry("system", "Type /restart to play again.");
    await awaitRestart();
  }
  async function doDefeat() {
    setValue("session.phase", "game-over");
    appendEntry("system", "");
    appendEntry("system", "\u2550\u2550 DEFEAT \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
    appendEntry(
      "gm",
      "The world dims. Grizzik's mocking cackle echoes through the stone as you collapse to the cold floor. Your adventure ends here \u2014 for now."
    );
    appendEntry("system", "");
    appendEntry("system", "Type /restart to try again.");
    await awaitRestart();
  }
  async function awaitRestart() {
    showActionChips([{ label: "\u{1F504} Restart", value: "/restart" }]);
    while (true) {
      const input = await prompt("");
      if (input.toLowerCase().startsWith("/restart")) {
        clearSave();
        location.reload();
        return;
      }
    }
  }
  async function handleMeta(raw) {
    const cmd = raw.slice(1).toLowerCase().trim();
    if (cmd === "restart") {
      clearSave();
      location.reload();
      return;
    }
    if (cmd === "save") {
      saveToStorage();
      appendEntry("system", "Game saved to localStorage.");
      return;
    }
    if (cmd === "status") {
      const pc = appState.party?.pc;
      if (pc) {
        appendEntry("system", `${pc.record.name} \u2014 HP ${pc.record.hpCurrent}/${pc.sheet.hp.max}, AC ${pc.sheet.ac.value}`);
      }
      return;
    }
    if (cmd === "settings") {
      appendEntry("system", "Re-running key setup\u2026");
      await setupKey();
      return;
    }
    if (cmd === "help") {
      appendEntry("system", "/save \xB7 /status \xB7 /settings \xB7 /restart \xB7 /help");
      return;
    }
    appendEntry("system", `Unknown command: ${raw}  (try /help)`);
  }
  async function resumeGame() {
    appendEntry("system", "\u2500\u2500 RESUMING ADVENTURE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
    appendEntry("system", "");
    const entries = (appState.transcript ?? []).slice(-6);
    for (const e of entries) {
      if (e.role === "player") appendEntry("player", `> ${e.text}`);
      else appendEntry(e.role, e.text);
    }
    appendEntry("system", "");
    appendEntry(
      "system",
      `HP: ${appState.party?.pc?.record?.hpCurrent}/${appState.party?.pc?.sheet?.hp?.max}  Turn: ${appState.session?.turnCount}`
    );
    appendEntry("system", "");
    await playLoop();
  }
  function applyActionBarState(on) {
    document.getElementById("action-bar").style.display = on ? "" : "none";
  }
  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
  }
  function exportScreenshot() {
    const src = localStorage.getItem("sketch-last-image");
    if (!src?.startsWith("data:image")) {
      appendEntry("system", "No scene sketch to export yet.");
      return;
    }
    const [header, b64] = src.split(",");
    const mime = header.match(/:(.*?);/)[1];
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: mime });
    const name = appState.party?.pc?.record?.name ?? "adventurer";
    triggerDownload(blob, `dans-dungeons-sketch-${name.toLowerCase().replace(/\s+/g, "-")}.png`);
  }
  function exportAllSketches() {
    const sketches = journalLog.filter((e) => e.imageSrc);
    if (!sketches.length) {
      appendEntry("system", "No sketches generated this session yet.");
      return;
    }
    const pcName = appState.party?.pc?.record?.name ?? "Adventurer";
    const rows = sketches.map(
      (e, i) => `<figure>
  <figcaption>${i === 0 ? "Opening scene" : "Turn " + e.turn}</figcaption>
  <img src="${e.imageSrc}" alt="Scene sketch turn ${e.turn}">
</figure>`
    ).join("\n");
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Sketches \u2014 ${pcName}</title>
<style>
  body{background:#f5e6c8;color:#3a2a1a;font-family:Georgia,serif;max-width:800px;margin:0 auto;padding:2rem}
  h1{text-align:center;color:#5c3d1a;margin-bottom:2rem}
  figure{margin:0 0 2rem;border-top:1px solid #c8a878;padding-top:1.5rem}
  figcaption{font-size:.75rem;text-transform:uppercase;letter-spacing:.1em;color:#8c6a3a;margin-bottom:.6rem}
  img{width:100%;border:1px solid #c8a878;border-radius:2px}
</style></head>
<body><h1>Sketches of ${pcName}</h1>${rows}</body></html>`;
    triggerDownload(
      new Blob([html], { type: "text/html" }),
      `dans-dungeons-sketches-${pcName.toLowerCase().replace(/\s+/g, "-")}.html`
    );
  }
  function importSave() {
    document.getElementById("import-file-input").click();
  }
  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const snap = JSON.parse(ev.target.result);
        restoreState(snap);
        tick();
        saveToStorage();
        appendEntry("system", `Imported save: ${file.name}`);
      } catch {
        appendEntry("error", "Failed to import \u2014 file is not a valid save.");
      }
    };
    reader.readAsText(file);
  }
  function createJournal() {
    if (!journalLog.length) return;
    const pcName = appState.party?.pc?.record?.name ?? "Adventurer";
    const pcClass = appState.party?.pc?.record?.classId ?? "";
    const entriesHtml = journalLog.map((entry, i) => {
      const heading = i === 0 ? "The Adventure Begins" : `Turn ${entry.turn}`;
      const img = entry.imageSrc ? `<img src="${entry.imageSrc}" alt="Scene sketch" style="width:100%;display:block;margin-bottom:1.2rem;border-radius:2px;">` : "";
      const text = entry.narration.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
      return `<div class="entry">
  <div class="turn-label">${heading}</div>
  ${img}
  <p>${text}</p>
</div>`;
    }).join("\n");
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Journal of ${pcName.replace(/</g, "&lt;")}</title>
<style>
  body { background:#f5e6c8; color:#3a2a1a; font-family:Georgia,'Times New Roman',serif; max-width:700px; margin:0 auto; padding:2rem 1.5rem; line-height:1.8; }
  h1 { text-align:center; font-size:2rem; margin-bottom:0.3rem; color:#5c3d1a; letter-spacing:0.04em; }
  .subtitle { text-align:center; color:#8c6a3a; font-style:italic; margin-bottom:2.5rem; font-size:1rem; }
  .entry { border-top:1px solid #c8a878; padding-top:1.5rem; margin-top:1.5rem; }
  .entry:first-child { border-top:none; margin-top:0; }
  .turn-label { font-size:0.75rem; text-transform:uppercase; letter-spacing:0.1em; color:#8c6a3a; margin-bottom:0.8rem; }
  p { margin:0; }
  img { border:1px solid #c8a878; }
</style>
</head>
<body>
<h1>Journal of ${pcName.replace(/</g, "&lt;")}</h1>
<div class="subtitle">A ${pcClass} \u2014 Dan's Dungeons</div>
${entriesHtml}
</body>
</html>`;
    triggerDownload(
      new Blob([html], { type: "text/html" }),
      `dans-dungeons-journal-${pcName.toLowerCase().replace(/\s+/g, "-")}.html`
    );
  }
  async function ensureKey() {
    if (!appState.ai?.key) {
      await setupKey();
      tick();
      return;
    }
    const valid = await checkKey();
    if (!valid) {
      setValue("ai.key", "");
      tick();
      saveToStorage();
      await setupKey();
      tick();
    }
  }
  async function boot() {
    initCollapsibles();
    initCopyKeyButton(() => appState.ai?.key ?? "");
    document.getElementById("sketch-btn-min")?.addEventListener("click", () => applySketchView("minimized"));
    document.getElementById("sketch-btn-win")?.addEventListener("click", () => applySketchView("windowed"));
    document.getElementById("sketch-btn-max")?.addEventListener("click", () => applySketchView("maximized"));
    const actionBarToggle = document.getElementById("action-bar-toggle");
    actionBarToggle?.addEventListener("click", () => {
      const next = !(appState.settings?.actionBar ?? true);
      setValue("settings.actionBar", next);
      actionBarToggle.setAttribute("aria-pressed", String(next));
      actionBarToggle.textContent = next ? "ON" : "OFF";
      applyActionBarState(next);
      saveToStorage();
    });
    document.getElementById("export-journal")?.addEventListener("click", createJournal);
    document.getElementById("export-screenshot")?.addEventListener("click", exportScreenshot);
    document.getElementById("export-sketches")?.addEventListener("click", exportAllSketches);
    document.getElementById("export-import")?.addEventListener("click", importSave);
    document.getElementById("import-file-input")?.addEventListener("change", handleImportFile);
    run();
    registerReactiveSidebar();
    initState();
    const save = loadFromStorage();
    if (save) restoreState(save);
    const urlKey = new URLSearchParams(location.search).get("key");
    if (urlKey) {
      setValue("ai.key", urlKey.trim());
      history.replaceState(null, "", location.pathname);
    }
    tick();
    bindDOM(document.getElementById("chrome"));
    bindDOM(document.getElementById("sidebar-header"));
    const sketchOn = appState.settings?.sceneImage ?? false;
    const sketchControls = document.getElementById("sketch-controls");
    if (sketchControls) sketchControls.style.display = sketchOn ? "" : "none";
    const abOn = appState.settings?.actionBar ?? true;
    if (actionBarToggle) {
      actionBarToggle.setAttribute("aria-pressed", String(abOn));
      actionBarToggle.textContent = abOn ? "ON" : "OFF";
    }
    applyActionBarState(abOn);
    await ensureKey();
    if (save && appState.session?.phase === "play") {
      await resumeGame();
      return;
    }
    await startNewGame();
  }
  boot().catch((e) => {
    appendEntry("error", `Fatal: ${e.message}`);
    console.error(e);
  });
})();
