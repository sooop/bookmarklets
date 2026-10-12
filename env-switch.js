/*
 * ENV SWITCH — tracxlogis.com / qxpress.net 환경 전환 도구
 *
 * 이 파일은 북마클릿 로더가 <script src="...">로 동적 로드해서 실행하는 실제 로직입니다.
 * GitHub 등 정적 호스팅에 올려두고, 북마클릿(로더)은 이 파일의 URL만 참조합니다.
 * 로더는 매 실행마다 캐시버스팅 쿼리(?t=timestamp)를 붙여 불러오므로,
 * 이 파일을 수정해서 다시 올리기만 하면 북마클릿을 재설치하지 않아도 바로 반영됩니다.
 *
 * 구성
 *   - P / S / V 단축키로 Production / Staging / VM 전환 (경로·쿼리·해시 유지)
 *   - VM: 설정 화면 없이 '최근 VM'(도메인 × 포트) 목록에서 고르거나, 입력칸에 새 주소를 바로 입력
 *     (서브[:포트], 전체 주소, :포트 모두 가능. 입력칸에서 ↑↓ 로 포트 ±1)
 *   - VM 에서 Production / Staging 으로 나갈 때는 '경로 규칙'(첫 세그먼트, 충돌하면 두 세그먼트)으로
 *     서비스를 추정해 후보를 보여 준다. 규칙은 이동·선택할 때마다 학습하고 설정 화면에서 고정·삭제한다.
 *   - 접속 실패 화면(브라우저 오류 페이지)·외부 페이지에서도 실행되며 실패한 주소의 경로를 가져올 수 있으면 그대로 사용한다.
 *     (이 화면에서는 저장소를 읽을 수 없어 최근 주소·학습 데이터는 쓰지 못한다)
 *
 * VM 판정 규칙 (tracxlogis.com / qxpress.net, staging- 제외) — 하나라도 맞으면 VM
 *   (Production 으로 지정했거나 서비스로 학습된 호스트는 항상 Production)
 *   1) 3차 도메인에 '-.*' 접미가 붙음 (sooop-dev, sooop-react ...)
 *   2) 포트가 붙어 있음 (Production/Staging 은 포트 없이 서비스됨)
 *   3) 최근 VM 목록에 있는 주소와 같음
 * 판정과 무관하게 Production / Staging / VM 버튼은 항상 클릭할 수 있다.
 */
(function envSwitchBookmarklet(){
  var d = document;
  // 재실행 시 이전 실행의 오버레이·키 리스너를 모두 정리한다 (리스너 누수 방지)
  if (typeof window.__eswCleanup === 'function') { try { window.__eswCleanup(); } catch (e) {} }
  var stale = d.getElementById('esw-host-9f2b');
  if (stale) { stale.remove(); }
  // 구버전(Shadow DOM 도입 전)이 같은 페이지에 남겨 둔 오버레이 정리
  var legacyOverlay = d.getElementById('esw-overlay-9f2b');
  if (legacyOverlay) { legacyOverlay.remove(); }

  // 스타일 주입: adoptedStyleSheets 는 CSP style-src 의 영향을 받지 않아 우선 사용하고, 안 되면 <style> 로 폴백
  function addStyle(root, css) {
    try {
      if (typeof CSSStyleSheet === 'function' && 'adoptedStyleSheets' in root) {
        var sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        root.adoptedStyleSheets = Array.prototype.slice.call(root.adoptedStyleSheets).concat([sheet]);
        return function(){
          try {
            root.adoptedStyleSheets = Array.prototype.filter.call(root.adoptedStyleSheets, function(s){ return s !== sheet; });
          } catch (e) {}
        };
      }
    } catch (e) {}
    var st = d.createElement('style');
    st.textContent = css;
    (root === d ? (d.head || d.documentElement) : root).appendChild(st);
    return function(){ st.remove(); };
  }

  // 열려 있는 모달 <dialog> 는 top layer 라 그 밖의 요소가 가려지고 inert 가 된다 → 그 안에 마운트
  function mountParent() {
    try {
      var dlgs = d.querySelectorAll('dialog[open]');
      for (var i = dlgs.length - 1; i >= 0; i--) {
        if (dlgs[i].matches(':modal')) { return dlgs[i]; }
      }
    } catch (e) {}
    return d.body || d.documentElement;
  }

  var TOAST_CSS =
    '#esw-toast-9f2b{all:initial;display:block;position:fixed;left:50%;bottom:32px;z-index:2147483647;' +
    'transform:translate(-50%,8px);opacity:0;max-width:320px;text-align:center;box-sizing:border-box;' +
    'background:#14171F;border:1px solid #262B38;color:#E4E7EE;padding:10px 16px;' +
    'border-radius:9px;box-shadow:0 12px 30px rgba(0,0,0,0.45);' +
    'font-family:"JetBrains Mono","SF Mono",Consolas,"Courier New",monospace;' +
    'font-size:12.5px;line-height:1.5;white-space:pre-line;' +
    'transition:opacity .18s ease,transform .18s ease;}' +
    '#esw-toast-9f2b.esw-toast-show{opacity:1;transform:translate(-50%,0);}';

  function showToast(message) {
    var prev = d.getElementById('esw-toast-9f2b');
    if (prev) {
      clearTimeout(prev.__eswTimer);
      if (prev.__eswDrop) { prev.__eswDrop(); }
      prev.remove();
    }
    var toast = d.createElement('div');
    toast.id = 'esw-toast-9f2b';
    toast.textContent = message;
    toast.__eswDrop = addStyle(d, TOAST_CSS);
    mountParent().appendChild(toast);
    requestAnimationFrame(function(){ toast.classList.add('esw-toast-show'); });
    toast.__eswTimer = setTimeout(function(){
      toast.classList.remove('esw-toast-show');
      setTimeout(function(){ toast.remove(); toast.__eswDrop(); }, 200);
    }, 2600);
  }

  // ───────── 상수 ─────────
  var DOMAINS = ['tracxlogis.com', 'qxpress.net'];
  var DEFAULT_SUB = 'smartship2';
  var DEFAULT_DOMAIN = DOMAINS[0];
  var DEFAULT_PORT = '3002';  // 입력칸에서 포트가 없을 때 ↑↓ 를 누르면 시작하는 값
  var RECENT_MAX = 8;
  var ROUTE_MAX = 30;         // 쿠키 4KB 한도 때문에 규칙 수를 제한한다
  var HOST_RE = /^([^.]+)\.(tracxlogis\.com|qxpress\.net)$/;
  var STG_RE = /^staging-([^.]+)\.(tracxlogis\.com|qxpress\.net)$/;
  var LABEL_RE = /^[a-z0-9-]+$/;
  var KEY_RE = /^[a-z0-9-]+\.(tracxlogis\.com|qxpress\.net)$/;
  var ROUTE_RE = /^\/[A-Za-z0-9._~-]+(\/[A-Za-z0-9._~-]+)?$/;
  var CFG_KEY = '__esw_cfg2__';
  var OLD_KEYS = ['__esw_cfg__', '__esw_vm_config__', '__esw_last_sub__'];

  // ───────── 현재 위치 ─────────
  // 정상 페이지는 window.location 을 그대로 쓴다. 허용 도메인이 아니면
  //  - 브라우저 접속 실패 화면: 실패한 주소를 알아낼 수 있으면 그 주소를 '현재'로 삼는다 (recovery = 'error')
  //  - 그 밖의 외부 페이지: P/S 없이 VM 이동만 제공한다 (recovery = 'foreign')
  var realLoc = window.location;
  var realMatch = realLoc.hostname.match(HOST_RE);
  var canStore = !!realMatch;  // 쿠키(Domain=.도메인)·localStorage 는 허용 도메인 페이지에서만 의미가 있다
  var recovery = '';
  var cur = {
    hostname: realLoc.hostname,
    port: String(realLoc.port || ''),
    protocol: realLoc.protocol,
    path: realLoc.pathname + realLoc.search + realLoc.hash
  };

  function guessFailedUrl() {
    var u = '';
    try { u = window.loadTimeData.data_.summary.failedUrl || ''; } catch (e) {}
    if (!u) {
      try {
        var nav = performance.getEntriesByType('navigation')[0];
        if (nav && /^https?:/.test(nav.name)) { u = nav.name; }
      } catch (e) {}
    }
    return u;
  }

  if (!realMatch) {
    var failed = /^https?:$/.test(realLoc.protocol) ? '' : guessFailedUrl();
    var fa = null;
    if (failed) { fa = d.createElement('a'); fa.href = failed; }
    if (fa && HOST_RE.test(fa.hostname)) {
      recovery = 'error';
      cur = { hostname: fa.hostname, port: String(fa.port || ''), protocol: fa.protocol,
        path: (fa.pathname || '/') + fa.search + fa.hash };
    } else {
      recovery = 'foreign';
      cur = { hostname: (fa && fa.hostname) || realLoc.hostname || '(알 수 없음)', port: '',
        protocol: realLoc.protocol, path: '/' };
    }
  }

  var host = cur.hostname;
  var hostMatch = host.match(HOST_RE);
  var stagingMatch = host.match(STG_RE);
  var noEnv = recovery === 'foreign';  // 서비스를 알 수 없는 화면 (P/S 불가)
  var hostSub = (stagingMatch || !hostMatch) ? '' : hostMatch[1];
  var hostDomain = hostMatch ? hostMatch[2] : DEFAULT_DOMAIN;
  var hostKey = hostSub ? (hostSub + '.' + hostDomain) : '';
  var hostLabelFull = hostMatch ? host.slice(0, host.length - hostDomain.length - 1) : host;  // 'staging-x' 또는 'sooop-dev'
  var hostPort = cur.port;
  var restPath = cur.path || '/';
  var cookieDomain = realMatch ? '.' + realMatch[2] : '';

  // ───────── 설정 저장소 ─────────
  // localStorage 는 origin(호스트+포트)별로 분리되어 서브도메인 간에 공유되지 않으므로,
  // 도메인 전체에서 공유되는 쿠키(Domain=.tracxlogis.com / .qxpress.net)와 localStorage 에 같은 값을 쓰고,
  // 읽을 때는 갱신 시각(u)이 더 최신인 쪽을 쓴다. (한쪽에 오래된 값이 남아 되살아나는 문제 방지)
  //
  // 저장 구조 (쿠키 4KB 한도 때문에 키를 줄여 쓴다):
  //   r : 최근 VM [{ s:서브, d:도메인 인덱스, p:포트('' = 없음), h:1(http), k:1(★ 고정), t:사용 시각(분) }]
  //   t : 경로 규칙 { '/pickups': { f:'고정 서비스', s:{ 'qlps-admin':[횟수, 시각(분)] } } }
  //   g : 서비스별 Staging 3차 도메인 { 'qlps-admin':'staging-qlps-admin' }  (도메인은 현재 호스트를 따른다)
  //   p : 사용자가 'Production 이다'라고 지정한 호스트 키 (자동 VM 규칙보다 우선)
  //   l : 마지막으로 선택·사용한 서비스 (질문 화면 후보)
  var cfg = { r: [], t: {}, g: {}, p: [], l: '', u: 0 };

  function nowMin() { return Math.floor(Date.now() / 60000); }

  function readJson(getter) {
    try { return JSON.parse(getter() || 'null'); } catch (e) { return null; }
  }
  function readCookieCfg() {
    return readJson(function(){
      var m = d.cookie.match(new RegExp('(?:^|; )' + CFG_KEY + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : null;
    });
  }
  function readLocalCfg() {
    return readJson(function(){ return localStorage.getItem(CFG_KEY); });
  }

  // 저장값을 검증하며 정리한다. 형식이 맞지 않는 항목은 버린다.
  function cleanCfg(c) {
    var o = { r: [], t: {}, g: {}, p: [], l: '', u: 0 };
    if (!c || c.v !== 2) { return o; }
    o.u = +c.u || 0;
    if (typeof c.l === 'string' && LABEL_RE.test(c.l)) { o.l = c.l; }
    if (Array.isArray(c.r)) {
      c.r.forEach(function(x){
        if (!x || typeof x.s !== 'string' || !LABEL_RE.test(x.s) || (x.d !== 0 && x.d !== 1)) { return; }
        var p = String(x.p === undefined || x.p === null ? '' : x.p);
        if (!/^[0-9]{0,5}$/.test(p)) { return; }
        o.r.push({ s: x.s, d: x.d, p: p, h: x.h ? 1 : 0, k: x.k ? 1 : 0, t: +x.t || 0 });
      });
      o.r = o.r.slice(0, RECENT_MAX);
    }
    if (c.t && typeof c.t === 'object') {
      Object.keys(c.t).forEach(function(k){
        var e = c.t[k];
        if (!ROUTE_RE.test(k) || !e || typeof e !== 'object') { return; }
        var ne = { s: {} };
        if (typeof e.f === 'string' && LABEL_RE.test(e.f)) { ne.f = e.f; }
        if (e.s && typeof e.s === 'object') {
          Object.keys(e.s).forEach(function(sub){
            var v = e.s[sub];
            if (LABEL_RE.test(sub) && Array.isArray(v) && v.length === 2) { ne.s[sub] = [+v[0] || 0, +v[1] || 0]; }
          });
        }
        if (ne.f || Object.keys(ne.s).length) { o.t[k] = ne; }
      });
    }
    if (c.g && typeof c.g === 'object') {
      Object.keys(c.g).forEach(function(sub){
        if (LABEL_RE.test(sub) && typeof c.g[sub] === 'string' && LABEL_RE.test(c.g[sub])) { o.g[sub] = c.g[sub]; }
      });
    }
    if (Array.isArray(c.p)) {
      o.p = c.p.filter(function(k){ return typeof k === 'string' && KEY_RE.test(k); });
    }
    return o;
  }

  if (canStore) {
    var fromLocal = cleanCfg(readLocalCfg());
    var fromCookie = cleanCfg(readCookieCfg());
    cfg = fromCookie.u > fromLocal.u ? fromCookie : fromLocal;
    // 이전 버전의 학습 데이터는 버린다 (꼬인 데이터가 이관되는 것을 막기 위해)
    OLD_KEYS.forEach(function(k){
      try { localStorage.removeItem(k); } catch (e) {}
      try { d.cookie = k + '=; domain=' + cookieDomain + '; path=/; max-age=0'; } catch (e) {}
    });
  }

  function routeLast(e) {
    var m = 0;
    Object.keys(e.s).forEach(function(sub){ if (e.s[sub][1] > m) { m = e.s[sub][1]; } });
    return m;
  }

  function encodeCfg() {
    return JSON.stringify({ v: 2, u: cfg.u, r: cfg.r, t: cfg.t, g: cfg.g, p: cfg.p, l: cfg.l });
  }

  function saveCfg() {
    if (!canStore) { return; }
    cfg.u = Date.now();
    // 쿠키는 항목당 4KB 한도 — 넘으면 오래된 경로 규칙부터 덜어 낸다
    var keys = Object.keys(cfg.t).sort(function(a, b){ return routeLast(cfg.t[a]) - routeLast(cfg.t[b]); });
    while (keys.length > ROUTE_MAX || (encodeURIComponent(encodeCfg()).length > 3800 && keys.length > 3)) {
      delete cfg.t[keys.shift()];
    }
    var json = encodeCfg();
    try { localStorage.setItem(CFG_KEY, json); } catch (e) {}
    try {
      d.cookie = CFG_KEY + '=' + encodeURIComponent(json) + '; domain=' + cookieDomain +
        '; path=/; max-age=31536000; SameSite=Lax' + (realLoc.protocol === 'https:' ? '; Secure' : '');
    } catch (e) {}
  }

  // ───────── VM 최근 주소 ─────────
  function vmOf(x) {
    return { sub: x.s, domain: DOMAINS[x.d], port: x.p, proto: x.h ? 'http:' : 'https:' };
  }
  function vmUrl(v) {
    return v.proto + '//' + v.sub + '.' + v.domain + (v.port ? ':' + v.port : '');
  }
  function sortRecents() {
    cfg.r.sort(function(a, b){ return (b.k - a.k) || (b.t - a.t); });
  }
  function lastVm() {
    var best = null;
    cfg.r.forEach(function(x){ if (!best || x.t > best.t) { best = x; } });
    return best ? vmOf(best) : null;
  }
  function sameVm(x, v) {
    return x.s === v.sub && DOMAINS[x.d] === v.domain && x.p === v.port;
  }
  function addRecent(v) {
    var found = null;
    cfg.r.forEach(function(x){ if (sameVm(x, v)) { found = x; } });
    if (found) {
      found.t = nowMin();
      found.h = v.proto === 'http:' ? 1 : 0;
    } else {
      cfg.r.push({ s: v.sub, d: DOMAINS.indexOf(v.domain), p: v.port, h: v.proto === 'http:' ? 1 : 0, k: 0, t: nowMin() });
    }
    sortRecents();
    // 가득 차면 ★ 고정이 아닌 항목 중 가장 오래된 것부터 밀어낸다
    while (cfg.r.length > RECENT_MAX) {
      var idx = -1;
      for (var i = cfg.r.length - 1; i >= 0; i--) { if (!cfg.r[i].k) { idx = i; break; } }
      if (idx < 0) { break; }
      cfg.r.splice(idx, 1);
    }
  }
  function relTime(t) {
    var m = nowMin() - t;
    if (m < 5) { return '방금'; }
    if (m < 60) { return m + '분 전'; }
    var h = Math.floor(m / 60);
    if (h < 24) { return h + '시간 전'; }
    var dd = Math.floor(h / 24);
    if (dd < 2) { return '어제'; }
    if (dd < 7) { return dd + '일 전'; }
    return Math.floor(dd / 7) + '주 전';
  }

  // ───────── 경로 규칙 학습 ─────────
  // 규칙 키: 첫 세그먼트('/pickups'). 한 경로에 서로 다른 서비스가 학습돼 충돌하면 두 번째 세그먼트('/pickups/history')도 함께 기록한다.
  // 숫자·해시처럼 매번 달라지는 세그먼트는 키로 쓰지 않는다.
  function isDynamicSeg(s) {
    return /^[0-9]+$/.test(s) || /^[0-9a-f]{8,}(-[0-9a-f]+)*$/i.test(s) || s.length > 40;
  }
  function routeKeys(path) {
    var segs = String(path || '').split(/[?#]/)[0].split('/').filter(function(s){ return s; });
    var k1 = (segs[0] && !isDynamicSeg(segs[0]) && ROUTE_RE.test('/' + segs[0])) ? '/' + segs[0] : '';
    var k2 = (k1 && segs[1] && !isDynamicSeg(segs[1]) && ROUTE_RE.test(k1 + '/' + segs[1])) ? k1 + '/' + segs[1] : '';
    return { k1: k1, k2: k2 };
  }
  function bumpRoute(key, sub) {
    var e = cfg.t[key] || (cfg.t[key] = { s: {} });
    var c = e.s[sub] || [0, 0];
    e.s[sub] = [c[0] + 1, nowMin()];
  }
  function recordRoute(sub, path) {
    cfg.l = sub;
    var ks = routeKeys(path);
    if (ks.k1) {
      bumpRoute(ks.k1, sub);
      var conflict = Object.keys(cfg.t[ks.k1].s).length > 1;
      if (ks.k2 && (conflict || cfg.t[ks.k2])) { bumpRoute(ks.k2, sub); }
    }
    saveCfg();
  }

  // 현재 경로에 맞는 규칙과 서비스 후보 (가장 구체적인 규칙 우선)
  function routeInfo(path) {
    var ks = routeKeys(path);
    var e2 = ks.k2 ? cfg.t[ks.k2] : null;
    var e1 = ks.k1 ? cfg.t[ks.k1] : null;
    var useE2 = !!(e2 && Object.keys(e2.s).length);
    var e = useE2 ? e2 : e1;
    var info = { key: useE2 ? ks.k2 : ks.k1, list: [], conflict: false, fixed: false };
    if (!e) { return info; }
    if (e.f) {
      info.fixed = true;
      var fc = e.s[e.f] || [0, 0];
      info.list.push({ sub: e.f, n: fc[0], t: fc[1] });
      return info;
    }
    Object.keys(e.s).forEach(function(sub){ info.list.push({ sub: sub, n: e.s[sub][0], t: e.s[sub][1] }); });
    info.list.sort(function(a, b){ return (b.n - a.n) || (b.t - a.t); });
    info.conflict = info.list.length > 1;
    return info;
  }

  function badgeFor(info, idx) {
    var it = info.list[idx];
    if (info.fixed) { return { t: '고정', tone: 'violet' }; }
    if (idx === 0 && (info.list.length === 1 || it.n > info.list[1].n)) { return { t: '학습됨', tone: 'green' }; }
    return { t: it.n <= 1 ? '드묾' : '', tone: 'amber' };
  }

  // ───────── 환경 판정 ─────────
  function knownService(sub) {
    if (cfg.g[sub]) { return true; }
    return Object.keys(cfg.t).some(function(k){ return !!cfg.t[k].s[sub]; });
  }
  // Production 으로 확정된 호스트: 사용자가 지정했거나, 서비스로 학습돼 있음
  function isForcedProd() {
    return !!hostSub && (cfg.p.indexOf(hostKey) >= 0 || knownService(hostSub));
  }
  function hasRecentHost() {
    return cfg.r.some(function(x){ return x.s === hostSub && DOMAINS[x.d] === hostDomain && x.p === hostPort; });
  }
  // 판정 우선순위: Production 확정 → 규칙(하이픈 접미·포트) → 최근 VM 목록과 일치
  function evalIsVM() {
    if (!hostSub || isForcedProd()) { return false; }
    return /-./.test(hostSub) || !!hostPort || hasRecentHost();
  }
  var isVM = evalIsVM();
  // 포트도 없고 목록에도 없이 하이픈 때문에만 VM 으로 판정된 경우 (qlps-admin 같은 Production 일 수 있음)
  function isAmbiguousVm() {
    return isVM && !hostPort && !hasRecentHost();
  }
  function isCurrentVm(v) {
    return isVM && v.sub === hostSub && v.domain === hostDomain && v.port === hostPort;
  }

  // 현재 화면이 Production/Staging 이면 사용 중인 서비스를 기억한다 (경로 규칙 학습)
  // 질문 없이 서비스를 알 수 있으면 { sub, domain, sure } , 모르면 null
  //  - Staging: 등록된 Staging 대응 → 같은 대응이 여럿이면 경로 규칙으로 고름 → 없으면 'staging-' 만 떼어 추정(sure:false)
  //  - VM: 항상 null (경로 규칙으로 후보만 제시하고 이동할 때 확인)
  //  - Production: 현재 호스트
  function peekFamily() {
    if (noEnv) { return null; }
    if (stagingMatch) {
      var subs = Object.keys(cfg.g).filter(function(sub){ return cfg.g[sub] === hostLabelFull; });
      if (subs.length === 1) { return { sub: subs[0], domain: hostDomain, sure: true }; }
      if (subs.length > 1) {
        var ri = routeInfo(restPath);
        for (var i = 0; i < ri.list.length; i++) {
          if (subs.indexOf(ri.list[i].sub) >= 0) { return { sub: ri.list[i].sub, domain: hostDomain, sure: true }; }
        }
        return { sub: subs[0], domain: hostDomain, sure: true };
      }
      return { sub: stagingMatch[1], domain: stagingMatch[2], sure: false };
    }
    if (isVM) { return null; }
    return { sub: hostSub, domain: hostDomain, sure: true };
  }

  if (!isVM && !noEnv && canStore) {
    var fam0 = peekFamily();
    if (fam0 && fam0.sure) { recordRoute(fam0.sub, restPath); }
  }
  if (isVM && !isAmbiguousVm() && canStore && !recovery) {
    // 지금 보고 있는 VM 도 최근 목록에 올려 둔다 (직접 입력해서 도착한 주소 포함)
    // 포트도 목록 기록도 없이 하이픈만으로 판정된 호스트는 Production 일 수 있어 제외한다
    addRecent({ sub: hostSub, domain: hostDomain, port: hostPort, proto: cur.protocol === 'http:' ? 'http:' : 'https:' });
    saveCfg();
  }

  function navigateTo(proto, targetHost, targetPort) {
    proto = (proto === 'http:' || proto === 'http') ? 'http:' : 'https:';
    var portPart = targetPort ? (':' + targetPort) : '';
    window.location.href = proto + '//' + targetHost + portPart + restPath;
  }

  // ───────── 모달 ─────────
  var hostEl = d.createElement('div');
  hostEl.id = 'esw-host-9f2b';
  // Shadow DOM 으로 호스트 페이지 CSS 가 새어 들어오는 것을 차단한다
  var shadow = hostEl.attachShadow({ mode: 'open' });
  var dropStyle = null;
  var overlay = null;
  var promptState = null;  // 질문 화면이 열려 있을 때 { cands, onChoose, ... }
  var settingsOpen = false;
  var panelEl = null;

  function closeModal() {
    hostEl.remove();
    if (dropStyle) { dropStyle(); dropStyle = null; }
    window.removeEventListener('keydown', onKeydown, true);
    if (window.__eswCleanup === closeModal) { window.__eswCleanup = null; }
  }

  // Production/Staging 이동 시 현재 프로토콜 유지 (VM 에서 나갈 때는 https)
  function keepProto() { return (!isVM && cur.protocol === 'http:') ? 'http:' : 'https:'; }

  function go(proto, label, domain, port) {
    navigateTo(proto, label + '.' + domain, port);
    closeModal();
  }

  function goVm(v) {
    if (isCurrentVm(v)) { window.location.reload(); return; }
    addRecent(v);
    saveCfg();
    go(v.proto, v.sub + '', v.domain, v.port);
  }

  // VM 에서는 서비스를 알 수 없으므로 경로 규칙으로 후보를 만들어 묻는다.
  function withFamily(cb) {
    var f = peekFamily();
    if (f) { cb(f); return; }
    var ri = routeInfo(restPath);
    var cands = ri.list.map(function(it, idx){
      var b = badgeFor(ri, idx);
      return { v: it.sub, sub: it.n + '회 사용 · ' + relTime(it.t) + (cfg.g[it.sub] ? ' · Staging ' + cfg.g[it.sub] : ''), badge: b.t, tone: b.tone };
    });
    var stripped = hostSub.indexOf('-') > 0 ? hostSub.slice(0, hostSub.lastIndexOf('-')) : '';
    [cfg.l, stripped, DEFAULT_SUB].forEach(function(s, i){
      if (s) { cands.push({ v: s, sub: i === 0 ? '마지막으로 선택한 서비스' : (i === 1 ? '호스트에서 추정' : '기본 후보'), badge: '', tone: '' }); }
    });
    openPrompt({
      title: '이 화면은 어느 서비스인가요?',
      hint: ri.list.length ? '경로 규칙으로 후보를 찾았습니다.' : '일치하는 경로 규칙이 없습니다. 고르면 규칙으로 기억할 수 있습니다.',
      rule: { path: restPath.split(/[?#]/)[0], key: ri.key },
      remember: !!ri.key,
      cands: cands,
      onChoose: function(sub, remember) {
        if (remember && ri.key) { recordRoute(sub, restPath); } else { cfg.l = sub; saveCfg(); }
        cb({ sub: sub, domain: hostDomain, sure: true });
      }
    });
  }

  function askStaging(f) {
    var firstDash = f.sub.indexOf('-');
    var c = ['staging-' + f.sub];
    if (firstDash > 0) { c.push('staging-' + f.sub.slice(firstDash + 1)); }
    openPrompt({
      title: f.sub + ' 의 Staging 도메인은?',
      hint: '처음 한 번만 묻고 기억합니다. (설정에서 수정·삭제할 수 있습니다)',
      cands: c.map(function(v){ return { v: v, sub: '', badge: '', tone: '' }; }),
      onChoose: function(label) {
        cfg.g[f.sub] = label;
        saveCfg();
        go(keepProto(), label, f.domain, '');
      }
    });
  }

  function pick(target) {
    if (promptState || settingsOpen) { return; }
    if (target === 'vm') {
      var v = lastVm();
      if (!v) { quickInput.focus(); return; }
      goVm(v);
      return;
    }
    if (noEnv) { showToast('이 화면에서는 서비스를 알 수 없어 VM 으로만 이동할 수 있습니다.'); return; }
    // 이미 해당 환경이면 새로고침 (판정이 틀려도 버튼은 항상 동작한다)
    if (target === 'production' && !stagingMatch && !isVM) { window.location.reload(); return; }
    if (target === 'staging' && stagingMatch) { window.location.reload(); return; }

    withFamily(function(f) {
      if (target === 'production') {
        go(keepProto(), f.sub, f.domain, '');
      } else if (cfg.g[f.sub]) {
        go(keepProto(), cfg.g[f.sub], f.domain, '');
      } else {
        askStaging(f);
      }
    });
  }

  // ───────── 새 주소 입력 해석 ─────────
  // 서브[:포트] · 전체 주소(https://서브.도메인:포트/) · :포트(서브 유지) 를 받아들인다.
  function baseVm() {
    if (isVM && hostSub) { return { sub: hostSub, domain: hostDomain, port: hostPort, proto: cur.protocol === 'http:' ? 'http:' : 'https:' }; }
    return lastVm();
  }
  function parseQuick(text) {
    var s = String(text || '').trim().toLowerCase();
    if (!s) { return null; }
    var proto = 'https:';
    var m = s.match(/^(https?):\/\//);
    if (m) { proto = m[1] + ':'; s = s.slice(m[0].length); }
    s = s.split(/[\/?#]/)[0];
    var port = '';
    var pm = s.match(/^(.*?):([0-9]*)$/);
    var hasPort = false;
    if (pm) {
      s = pm[1]; port = pm[2]; hasPort = true;
      if (!port) { return { err: '포트 번호를 입력하세요.' }; }
      if (+port > 65535) { return { err: '포트는 0~65535 범위입니다.' }; }
    } else if (s.indexOf(':') >= 0) {
      return { err: '주소 형식이 올바르지 않습니다.' };
    }
    var base = baseVm();
    var domain = base ? base.domain : DEFAULT_DOMAIN;
    DOMAINS.forEach(function(dm){
      if (s.slice(-(dm.length + 1)) === '.' + dm) { domain = dm; s = s.slice(0, -(dm.length + 1)); }
    });
    if (!s) {
      if (hasPort && base) { s = base.sub; } else { return { err: '서브도메인을 입력하세요.' }; }
    }
    if (!LABEL_RE.test(s)) { return { err: '서브도메인은 영문 소문자·숫자·하이픈만 쓸 수 있습니다.' }; }
    return { sub: s, domain: domain, port: port, proto: proto };
  }

  function onKeydown(e) {
    // Shadow DOM 안의 이벤트는 window 에서 host 로 retarget 되므로 composedPath 로 실제 대상을 얻는다
    var path = e.composedPath ? e.composedPath() : [];
    var t = path[0] || e.target;
    // 오버레이 안의 입력창에서만 단축키를 양보한다 (호스트 페이지 입력창에 포커스가 남아 있어도 동작해야 함)
    if (t && t.nodeType && overlay.contains(t) && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) {
      if (e.key === 'Escape') { t.blur(); if (panelEl) { panelEl.focus(); } }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) { return; }  // Ctrl+S/P/V 등 브라우저 단축키 보존
    var dm = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (promptState) {
      // 질문 화면: Esc = 취소(메인으로), 1~9 = 후보 선택, Enter = 1번, 그 외 키는 막지 않는다
      if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); closePrompt(); }
      else if (dm && promptState.cands[+dm[1] - 1]) {
        e.preventDefault(); e.stopPropagation(); chooseFromPrompt(promptState.cands[+dm[1] - 1].v);
      } else if ((e.code === 'Enter' || e.code === 'NumpadEnter') && promptState.cands[0] && !(t && t.tagName === 'BUTTON')) {
        e.preventDefault(); e.stopPropagation(); chooseFromPrompt(promptState.cands[0].v);
      }
      return;
    }
    if (settingsOpen) {
      // 설정 화면: Esc = 메인으로. 그 밖의 단축키는 비활성
      if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); showSettings(false); }
      return;
    }
    // 메인 화면의 숫자키: 최근 VM 바로 이동
    if (dm && cfg.r[+dm[1] - 1]) {
      e.preventDefault(); e.stopPropagation(); goVm(vmOf(cfg.r[+dm[1] - 1]));
      return;
    }
    // e.code 는 한글 IME 상태에서도 물리 키 기준으로 들어온다 (e.key 는 'ㅔ' / 'Process')
    var code = e.code;
    var action = code === 'Escape' ? 'close' : code === 'KeyP' ? 'production' :
      code === 'KeyS' ? 'staging' : code === 'KeyV' ? 'vm' : '';
    if (!action) { return; }
    e.preventDefault();
    e.stopPropagation();
    if (action === 'close') { closeModal(); } else { pick(action); }
  }

  var CSS =
    '#esw-overlay-9f2b{position:fixed;inset:0;z-index:2147483647;background:rgba(6,7,10,0.6);' +
    'backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;' +
    'font-family:"JetBrains Mono","SF Mono",Consolas,"Courier New",monospace;}' +
    '#esw-overlay-9f2b *{box-sizing:border-box;}' +
    '#esw-overlay-9f2b .esw-panel{width:340px;max-height:calc(100vh - 24px);display:flex;flex-direction:column;' +
    'background:#14171F;border:1px solid #262B38;' +
    'border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.5);color:#E4E7EE;' +
    'animation:esw-in .15s ease;}' +
    '#esw-overlay-9f2b .esw-panel:focus{outline:none;}' +
    '@keyframes esw-in{from{opacity:0;transform:scale(.97) translateY(4px);}to{opacity:1;transform:none;}}' +
    '#esw-overlay-9f2b .esw-header{flex-shrink:0;padding:16px 18px 12px 18px;border-bottom:1px solid #262B38;}' +
    '#esw-overlay-9f2b .esw-header-top{display:flex;align-items:center;gap:8px;margin-bottom:10px;}' +
    '#esw-overlay-9f2b .esw-dot{width:8px;height:8px;border-radius:50%;}' +
    '#esw-overlay-9f2b .esw-dot.esw-c-green{background:#34D399;box-shadow:0 0 8px #34D399;}' +
    '#esw-overlay-9f2b .esw-dot.esw-c-amber{background:#FBBF24;box-shadow:0 0 8px #FBBF24;}' +
    '#esw-overlay-9f2b .esw-dot.esw-c-violet{background:#A78BFA;box-shadow:0 0 8px #A78BFA;}' +
    '#esw-overlay-9f2b .esw-dot.esw-c-gray{background:#8B93A7;box-shadow:0 0 8px #8B93A7;}' +
    '#esw-overlay-9f2b .esw-kicker{font-size:10px;letter-spacing:.14em;color:#8B93A7;flex:1;}' +
    '#esw-overlay-9f2b .esw-close{background:none;border:none;color:#8B93A7;font-size:16px;' +
    'font-family:inherit;cursor:pointer;line-height:1;padding:2px 4px;}' +
    '#esw-overlay-9f2b .esw-close:hover{color:#E4E7EE;}' +
    '#esw-overlay-9f2b .esw-current-env{font-size:15px;font-weight:700;margin-right:8px;}' +
    '#esw-overlay-9f2b .esw-current-host{font-size:11px;color:#8B93A7;word-break:break-all;margin-top:2px;}' +
    '#esw-overlay-9f2b .esw-body{padding:12px;display:flex;flex-direction:column;gap:8px;overflow-y:auto;min-height:0;}' +
    '#esw-overlay-9f2b .esw-switch{width:100%;display:flex;align-items:center;gap:12px;font-family:inherit;' +
    'background:#1B1F2A;border:1px solid #262B38;border-radius:9px;padding:11px 14px;' +
    'cursor:pointer;color:#E4E7EE;text-align:left;transition:border-color .12s ease;}' +
    '#esw-overlay-9f2b .esw-switch:hover{border-color:#3A4257;}' +
    '#esw-overlay-9f2b .esw-switch.esw-sel{background:#1F1B33;border-color:#A78BFA;}' +
    '#esw-overlay-9f2b .esw-key{flex-shrink:0;width:22px;height:22px;line-height:22px;' +
    'text-align:center;border-radius:5px;background:#0F1219;border-bottom:2px solid #333A4A;' +
    'font-size:12px;font-weight:700;}' +
    '#esw-overlay-9f2b .esw-switch-label{flex:1;min-width:0;}' +
    '#esw-overlay-9f2b .esw-switch-title{font-size:13.5px;font-weight:600;display:block;}' +
    '#esw-overlay-9f2b .esw-switch-sub{font-size:11px;color:#8B93A7;display:block;' +
    'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;}' +
    '#esw-overlay-9f2b .esw-switch-sub.esw-accent{color:#A78BFA;}' +
    '#esw-overlay-9f2b .esw-led{flex-shrink:0;width:8px;height:8px;border-radius:50%;}' +
    '#esw-overlay-9f2b .esw-led-green{background:#34D399;box-shadow:0 0 6px #34D399;}' +
    '#esw-overlay-9f2b .esw-led-amber{background:#FBBF24;box-shadow:0 0 6px #FBBF24;}' +
    '#esw-overlay-9f2b .esw-led-violet{background:#A78BFA;box-shadow:0 0 6px #A78BFA;}' +
    '#esw-overlay-9f2b .esw-footer{flex-shrink:0;padding:10px 18px;border-top:1px solid #262B38;' +
    'font-size:10.5px;color:#8B93A7;word-break:break-all;line-height:1.6;}' +
    '#esw-overlay-9f2b .esw-mini-btn{background:#1B1F2A;border:1px solid #262B38;border-radius:6px;' +
    'padding:6px 8px;color:#A78BFA;font-family:inherit;font-size:11px;cursor:pointer;}' +
    '#esw-overlay-9f2b .esw-mini-btn:hover{border-color:#A78BFA;}' +
    '#esw-overlay-9f2b .esw-primary{background:#A78BFA;border:none;border-radius:6px;padding:0 12px;color:#14171F;' +
    'font-family:inherit;font-size:11.5px;font-weight:700;cursor:pointer;}' +
    '#esw-overlay-9f2b .esw-input{width:100%;background:#0F1219;border:1px solid #262B38;' +
    'border-radius:6px;padding:8px 10px;color:#E4E7EE;font-family:inherit;font-size:12px;}' +
    '#esw-overlay-9f2b .esw-input:focus{outline:none;border-color:#A78BFA;}' +
    '#esw-overlay-9f2b .esw-current-badge{flex-shrink:0;font-size:9px;' +
    'letter-spacing:.04em;padding:3px 7px;border-radius:20px;background:rgba(228,231,238,0.08);' +
    'color:#8B93A7;}' +
    '#esw-overlay-9f2b .esw-badge-green{background:rgba(52,211,153,.14);color:#34D399;}' +
    '#esw-overlay-9f2b .esw-badge-amber{background:rgba(251,191,36,.14);color:#FBBF24;}' +
    '#esw-overlay-9f2b .esw-badge-violet{background:rgba(167,139,250,.16);color:#A78BFA;}' +
    '#esw-overlay-9f2b .esw-main,#esw-overlay-9f2b .esw-prompt,#esw-overlay-9f2b .esw-settings{display:flex;flex-direction:column;gap:8px;}' +
    '#esw-overlay-9f2b .esw-prompt-title{font-size:13px;font-weight:700;word-break:break-all;}' +
    '#esw-overlay-9f2b .esw-prompt-hint{font-size:10.5px;color:#8B93A7;line-height:1.5;}' +
    '#esw-overlay-9f2b .esw-prompt-row{display:flex;gap:8px;align-items:stretch;}' +
    '#esw-overlay-9f2b .esw-prompt-row .esw-input{flex:1;min-width:0;}' +
    '#esw-overlay-9f2b .esw-rule{background:#0F1219;border:1px solid #262B38;border-radius:8px;padding:9px 11px;' +
    'font-size:11.5px;display:flex;flex-direction:column;gap:5px;word-break:break-all;}' +
    '#esw-overlay-9f2b .esw-rule b{color:#A78BFA;font-weight:600;}' +
    '#esw-overlay-9f2b .esw-chk{display:flex;align-items:flex-start;gap:10px;font-size:11px;line-height:1.5;cursor:pointer;}' +
    '#esw-overlay-9f2b .esw-chk input{margin:2px 0 0;accent-color:#A78BFA;}' +
    '#esw-overlay-9f2b .esw-chk small{display:block;color:#8B93A7;font-size:10.5px;}' +
    '#esw-overlay-9f2b .esw-danger{color:#FBBF24;}' +
    '#esw-overlay-9f2b .esw-section{font-size:10px;letter-spacing:.1em;color:#8B93A7;margin-top:6px;}' +
    '#esw-overlay-9f2b .esw-sec-row{display:flex;justify-content:space-between;align-items:baseline;margin-top:6px;}' +
    '#esw-overlay-9f2b .esw-sec-row .esw-section{margin-top:0;}' +
    '#esw-overlay-9f2b .esw-row{display:flex;gap:8px;align-items:stretch;}' +
    '#esw-overlay-9f2b .esw-row .esw-input{flex:1;min-width:0;}' +
    '#esw-overlay-9f2b .esw-list{display:flex;flex-direction:column;gap:5px;}' +
    '#esw-overlay-9f2b .esw-rrow{width:100%;display:flex;align-items:center;gap:10px;font-family:inherit;' +
    'background:#1B1F2A;border:1px solid #262B38;border-radius:8px;padding:8px 10px;color:#E4E7EE;text-align:left;cursor:pointer;}' +
    '#esw-overlay-9f2b .esw-rrow:hover{border-color:#A78BFA;}' +
    '#esw-overlay-9f2b .esw-rrow.esw-rcur{border-color:#3A4257;}' +
    '#esw-overlay-9f2b .esw-rn{flex-shrink:0;width:18px;height:18px;line-height:18px;text-align:center;border-radius:4px;' +
    'background:#0F1219;font-size:10.5px;font-weight:700;color:#8B93A7;}' +
    '#esw-overlay-9f2b .esw-rname{flex:1;min-width:0;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
    '#esw-overlay-9f2b .esw-rname b{font-weight:600;}' +
    '#esw-overlay-9f2b .esw-rname span{color:#8B93A7;}' +
    '#esw-overlay-9f2b .esw-rport{flex-shrink:0;font-size:10.5px;color:#A78BFA;background:#0F1219;border-radius:4px;padding:2px 6px;}' +
    '#esw-overlay-9f2b .esw-rwhen{flex-shrink:0;font-size:9.5px;color:#8B93A7;min-width:34px;text-align:right;}' +
    '#esw-overlay-9f2b .esw-qnote{font-size:10.5px;color:#8B93A7;line-height:1.5;word-break:break-all;}' +
    '#esw-overlay-9f2b .esw-qnote.esw-ok{color:#A78BFA;font-size:11px;}' +
    '#esw-overlay-9f2b .esw-qnote.esw-bad{color:#FBBF24;font-size:11px;}' +
    '#esw-overlay-9f2b .esw-card{background:#1B1F2A;border:1px solid #262B38;border-radius:8px;padding:9px 11px;' +
    'display:flex;flex-direction:column;gap:5px;}' +
    '#esw-overlay-9f2b .esw-card.esw-warn{border-color:#FBBF24;}' +
    '#esw-overlay-9f2b .esw-card-head{display:flex;align-items:center;gap:8px;}' +
    '#esw-overlay-9f2b .esw-card-key{flex:1;min-width:0;font-size:12px;font-weight:600;color:#A78BFA;word-break:break-all;}' +
    '#esw-overlay-9f2b .esw-card-meta{font-size:10px;color:#8B93A7;}' +
    '#esw-overlay-9f2b .esw-card-line{font-size:11px;word-break:break-all;}' +
    '#esw-overlay-9f2b .esw-card-line span{color:#8B93A7;}' +
    '#esw-overlay-9f2b .esw-card-note{font-size:10.5px;color:#FBBF24;line-height:1.5;}' +
    '#esw-overlay-9f2b .esw-x{background:none;border:none;color:#8B93A7;font-family:inherit;font-size:14px;cursor:pointer;padding:0 2px;line-height:1;}' +
    '#esw-overlay-9f2b .esw-x:hover{color:#E4E7EE;}' +
    '#esw-overlay-9f2b .esw-fixrow{display:flex;gap:6px;}' +
    '#esw-overlay-9f2b .esw-fixrow .esw-mini-btn{flex:1;color:#E4E7EE;padding:5px 0;font-size:10.5px;}' +
    '#esw-overlay-9f2b .esw-vmrow{display:flex;align-items:center;gap:8px;font-size:11px;padding:6px 10px;border-radius:6px;' +
    'background:#1B1F2A;border:1px solid #262B38;}' +
    '#esw-overlay-9f2b .esw-vmrow span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
    '#esw-overlay-9f2b .esw-star{background:none;border:none;font-family:inherit;font-size:13px;cursor:pointer;padding:0;color:#8B93A7;}' +
    '#esw-overlay-9f2b .esw-star.esw-on{color:#FBBF24;}' +
    '#esw-overlay-9f2b .esw-empty{font-size:11px;color:#8B93A7;line-height:1.5;}' +
    '#esw-overlay-9f2b .esw-hide{display:none;}';
  dropStyle = addStyle(shadow, CSS);

  overlay = d.createElement('div');
  overlay.id = 'esw-overlay-9f2b';
  // 동적 값(호스트·설정)은 마크업에 끼워 넣지 않고 refresh() 에서 textContent/value 로 채운다
  overlay.innerHTML =
    '<div class="esw-panel" role="dialog" aria-label="환경 전환" tabindex="-1">' +
      '<div class="esw-header">' +
        '<div class="esw-header-top">' +
          '<span class="esw-dot" data-esw-dot></span>' +
          '<span class="esw-kicker" data-esw-kicker>CURRENT ENV</span>' +
          '<button class="esw-close" data-esw-gear aria-label="설정" title="설정">&#9881;</button>' +
          '<button class="esw-close" data-esw-close aria-label="닫기">&times;</button>' +
        '</div>' +
        '<span class="esw-current-env" data-esw-env></span>' +
        '<div class="esw-current-host" data-esw-host></div>' +
        '<button class="esw-mini-btn esw-hide" style="margin-top:8px" data-esw-ambiguous></button>' +
      '</div>' +
      '<div class="esw-body">' +
       '<div class="esw-prompt esw-hide" data-esw-prompt></div>' +
       '<div class="esw-main" data-esw-main>' +
        '<button class="esw-switch" data-esw-target="production">' +
          '<span class="esw-key">P</span>' +
          '<span class="esw-switch-label">' +
            '<span class="esw-switch-title">Production</span>' +
            '<span class="esw-switch-sub" data-esw-prod-sub></span>' +
          '</span>' +
          '<span class="esw-led esw-led-green" data-esw-prod-led></span>' +
          '<span class="esw-current-badge esw-hide" data-esw-prod-badge>현재</span>' +
        '</button>' +
        '<button class="esw-switch" data-esw-target="staging">' +
          '<span class="esw-key">S</span>' +
          '<span class="esw-switch-label">' +
            '<span class="esw-switch-title">Staging</span>' +
            '<span class="esw-switch-sub" data-esw-staging-sub></span>' +
          '</span>' +
          '<span class="esw-led esw-led-amber" data-esw-staging-led></span>' +
          '<span class="esw-current-badge esw-hide" data-esw-staging-badge>현재</span>' +
        '</button>' +
        '<button class="esw-switch esw-sel" data-esw-target="vm">' +
          '<span class="esw-key">V</span>' +
          '<span class="esw-switch-label">' +
            '<span class="esw-switch-title">VM</span>' +
            '<span class="esw-switch-sub esw-accent" data-esw-vm-label></span>' +
          '</span>' +
          '<span class="esw-led esw-led-violet" data-esw-vm-led></span>' +
          '<span class="esw-current-badge esw-hide" data-esw-vm-badge>현재</span>' +
        '</button>' +
        '<div class="esw-sec-row"><span class="esw-section">최근 VM · 숫자키 또는 클릭</span><span class="esw-section">도메인 × 포트</span></div>' +
        '<div class="esw-list" data-esw-recents></div>' +
        '<div class="esw-section">새 주소 직접 입력</div>' +
        '<div class="esw-row">' +
          '<input class="esw-input" type="text" data-esw-quick placeholder="sooop-dev:3002" aria-label="새 VM 주소" spellcheck="false" autocomplete="off">' +
          '<button class="esw-primary" data-esw-quick-go>이동 ↵</button>' +
        '</div>' +
        '<div class="esw-qnote" data-esw-quick-note></div>' +
       '</div>' +
       '<div class="esw-settings esw-hide" data-esw-settings>' +
        '<button class="esw-mini-btn" data-esw-settings-back>&larr; 돌아가기 (Esc)</button>' +
        '<div class="esw-section" data-esw-sec-routes></div>' +
        '<div class="esw-settings" data-esw-routes></div>' +
        '<div class="esw-section" data-esw-sec-vm></div>' +
        '<div class="esw-list" data-esw-vm-list></div>' +
        '<div class="esw-section">Staging 도메인 대응</div>' +
        '<div class="esw-list" data-esw-stg-list></div>' +
        '<div class="esw-section">현재 호스트</div>' +
        '<button class="esw-mini-btn" data-esw-mark-prod></button>' +
        '<button class="esw-mini-btn esw-danger" data-esw-reset-all></button>' +
       '</div>' +
      '</div>' +
      '<div class="esw-footer" data-esw-footer></div>' +
    '</div>';
  shadow.appendChild(overlay);

  function q(sel) { return overlay.querySelector(sel); }
  function el(tag, cls, text) {
    var n = d.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined) { n.textContent = text; }
    return n;
  }
  function clear(node) { while (node.firstChild) { node.removeChild(node.firstChild); } }
  panelEl = q('.esw-panel');
  var envEl = q('[data-esw-env]');
  var dotEl = q('[data-esw-dot]');
  var kickerEl = q('[data-esw-kicker]');
  var vmLabel = q('[data-esw-vm-label]');
  var mainEl = q('[data-esw-main]');
  var promptEl = q('[data-esw-prompt]');
  var settingsEl = q('[data-esw-settings]');
  var ambiguousBtn = q('[data-esw-ambiguous]');
  var recentsEl = q('[data-esw-recents]');
  var quickInput = q('[data-esw-quick]');
  var quickNote = q('[data-esw-quick-note]');
  var secRoutesEl = q('[data-esw-sec-routes]');
  var routesEl = q('[data-esw-routes]');
  var secVmEl = q('[data-esw-sec-vm]');
  var vmListEl = q('[data-esw-vm-list]');
  var stgListEl = q('[data-esw-stg-list]');
  var markProdBtn = q('[data-esw-mark-prod]');
  var resetAllBtn = q('[data-esw-reset-all]');
  var resetArmed = false;

  function setCurrent(name, on) {
    q('[data-esw-' + name + '-led]').classList.toggle('esw-hide', on);
    q('[data-esw-' + name + '-badge]').classList.toggle('esw-hide', !on);
  }

  // 세 화면(메인·질문·설정) 중 하나만 보인다
  function showScreen(name) {
    promptState = name === 'prompt' ? promptState : null;
    settingsOpen = name === 'settings';
    mainEl.classList.toggle('esw-hide', name !== 'main');
    promptEl.classList.toggle('esw-hide', name !== 'prompt');
    settingsEl.classList.toggle('esw-hide', name !== 'settings');
    panelEl.focus();
  }
  function showSettings(on) {
    resetArmed = false;
    showScreen(on ? 'settings' : 'main');
    refresh();
  }

  // 판정·설정이 바뀔 때마다 화면 전체를 다시 그린다 (버튼은 판정과 무관하게 항상 클릭 가능)
  function refresh() {
    isVM = evalIsVM();
    var stagingCur = !!stagingMatch;
    var prodCur = !stagingCur && !isVM && !noEnv;

    envEl.textContent = noEnv ? (recovery === 'foreign' ? '외부 페이지' : '') :
      (stagingCur ? 'Staging' : (isVM ? 'VM' : 'Production'));
    dotEl.className = 'esw-dot ' + (noEnv ? 'esw-c-gray' : (stagingCur ? 'esw-c-amber' : (isVM ? 'esw-c-violet' : 'esw-c-green')));
    kickerEl.textContent = recovery === 'error' ? '접속 실패 화면 · 실패한 주소 기준' :
      (noEnv ? 'tracxlogis.com / qxpress.net 이 아닙니다' : 'CURRENT ENV');
    q('[data-esw-host]').textContent = host + (hostPort ? ':' + hostPort : '');

    if (isAmbiguousVm() && !noEnv) {
      ambiguousBtn.textContent = '이 도메인(' + hostSub + ')은 Production 인가요? → 지정';
      ambiguousBtn.classList.remove('esw-hide');
    } else {
      ambiguousBtn.classList.add('esw-hide');
    }

    // P/S 보조 문구: VM 이면 경로 규칙으로 추정한 서비스를 보여 준다
    var f = peekFamily();
    var ask = noEnv ? '이 화면에서는 서비스를 알 수 없습니다' : '이동할 때 서비스를 물어봅니다';
    var guess = null;
    if (!f && !noEnv) {
      var ri = routeInfo(restPath);
      if (ri.list.length && !ri.conflict) { guess = ri.list[0].sub; }
    }
    var fam = f ? f.sub : guess;
    q('[data-esw-prod-sub]').textContent = fam ? (fam + '.' + hostDomain + (guess ? ' · 경로 규칙' : '')) : ask;
    q('[data-esw-staging-sub]').textContent = stagingMatch && f && f.sure ? host :
      (!fam ? ask : (cfg.g[fam] ? cfg.g[fam] + '.' + hostDomain : '선택 필요 (처음 한 번)'));
    var lv = lastVm();
    vmLabel.textContent = lv ? vmUrl(lv) : '아래에 주소를 입력하세요';
    setCurrent('prod', prodCur);
    setCurrent('staging', stagingCur);
    setCurrent('vm', !!lv && isCurrentVm(lv));
    var fm = '경로 유지: ' + (restPath || '/');
    if (!canStore) { fm += '\n저장된 설정을 읽을 수 없는 화면입니다 (최근 주소·학습 데이터 사용 불가)'; }
    q('[data-esw-footer]').textContent = fm;
    q('[data-esw-footer]').style.whiteSpace = 'pre-line';

    renderRecents();
    updateQuick();
    refreshSettings();
  }

  function renderRecents() {
    clear(recentsEl);
    if (!cfg.r.length) {
      recentsEl.appendChild(el('div', 'esw-empty', canStore ? '아직 이동한 VM 이 없습니다. 아래에 주소를 입력하면 여기에 쌓입니다.' : '이 화면에서는 최근 주소를 쓸 수 없습니다. 아래에 주소를 입력하세요.'));
      return;
    }
    cfg.r.forEach(function(x, i){
      var v = vmOf(x);
      var b = el('button', 'esw-rrow' + (isCurrentVm(v) ? ' esw-rcur' : ''));
      b.appendChild(el('span', 'esw-rn', String(i + 1)));
      var nm = el('span', 'esw-rname');
      nm.appendChild(el('b', '', v.sub));
      nm.appendChild(el('span', '', '.' + v.domain));
      b.appendChild(nm);
      b.appendChild(el('span', 'esw-rport', (v.proto === 'http:' ? 'http ' : '') + (v.port ? ':' + v.port : '포트 없음')));
      b.appendChild(el('span', 'esw-rwhen', isCurrentVm(v) ? '현재' : (x.k ? '★' : relTime(x.t))));
      b.addEventListener('click', function(){ if (!promptState && !settingsOpen) { goVm(v); } });
      recentsEl.appendChild(b);
    });
  }

  function updateQuick() {
    var text = quickInput.value;
    quickNote.className = 'esw-qnote';
    if (!text.trim()) {
      quickNote.textContent = '서브만 쓰면 도메인은 직전 값, 포트는 생략 시 없음. 입력칸에서 ↑↓ 로 포트 ±1 · Shift+Enter 로 이동 없이 저장.';
      return;
    }
    var p = parseQuick(text);
    if (p.err) { quickNote.className = 'esw-qnote esw-bad'; quickNote.textContent = p.err; return; }
    quickNote.className = 'esw-qnote esw-ok';
    quickNote.textContent = '→ ' + vmUrl(p) + restPath;
  }

  function submitQuick(saveOnly) {
    var p = parseQuick(quickInput.value);
    if (!p) { quickInput.focus(); return; }
    if (p.err) { updateQuick(); return; }
    if (saveOnly) {
      addRecent(p);
      saveCfg();
      quickInput.value = '';
      refresh();
      showToast(vmUrl(p) + ' 을(를) 최근 목록에 저장했습니다.');
      return;
    }
    goVm(p);
  }

  // ───────── 질문 화면 ─────────
  function closePrompt() {
    promptState = null;
    showScreen('main');
  }

  function chooseFromPrompt(value) {
    var v = String(value || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!v || !promptState) { return; }
    var st = promptState;
    var remember = !!(st.rememberEl && st.rememberEl.checked);
    closePrompt();
    st.onChoose(v, remember);
  }

  // opt: { kicker?, title, hint, rule?:{ path, key }, remember?:bool, cands:[{ v, sub, badge, tone }], onChoose(value, remember) }
  function openPrompt(opt) {
    var seen = {};
    opt.cands = opt.cands.filter(function(c){
      if (!c.v || !LABEL_RE.test(c.v) || seen[c.v]) { return false; }
      seen[c.v] = true;
      return true;
    }).slice(0, 9);
    promptState = opt;
    var box = promptEl;
    clear(box);
    box.appendChild(el('div', 'esw-prompt-title', opt.title));
    box.appendChild(el('div', 'esw-prompt-hint', opt.hint + ' (숫자키 선택 · Enter = 1번 · Esc 취소)'));
    if (opt.rule) {
      var rb = el('div', 'esw-rule');
      rb.appendChild(el('span', '', '현재 경로 · 일치한 규칙'));
      var rl = el('span');
      rl.appendChild(d.createTextNode(opt.rule.path + ' ← '));
      rl.appendChild(opt.rule.key ? el('b', '', opt.rule.key + '/*') : el('span', '', '일치하는 규칙 없음'));
      rb.appendChild(rl);
      box.appendChild(rb);
    }
    opt.cands.forEach(function(c, idx){
      var b = el('button', 'esw-switch' + (idx === 0 && c.tone === 'green' ? ' esw-sel' : ''));
      b.appendChild(el('span', 'esw-key', String(idx + 1)));
      var lab = el('span', 'esw-switch-label');
      lab.appendChild(el('span', 'esw-switch-title', c.v));
      if (c.sub) { lab.appendChild(el('span', 'esw-switch-sub', c.sub)); }
      b.appendChild(lab);
      if (c.badge) { b.appendChild(el('span', 'esw-current-badge esw-badge-' + (c.tone || 'amber'), c.badge)); }
      b.addEventListener('click', function(){ chooseFromPrompt(c.v); });
      box.appendChild(b);
    });
    var row = el('div', 'esw-prompt-row');
    var ci = el('input', 'esw-input');
    ci.type = 'text';
    ci.placeholder = '직접 입력 (3차 도메인 전체)';
    ci.setAttribute('aria-label', '직접 입력');
    ci.spellcheck = false;
    ci.autocomplete = 'off';
    ci.addEventListener('keydown', function(e){
      if (e.key === 'Enter') { e.preventDefault(); chooseFromPrompt(ci.value); }
    });
    var ok = el('button', 'esw-mini-btn', '확인');
    ok.addEventListener('click', function(){ chooseFromPrompt(ci.value); });
    row.appendChild(ci);
    row.appendChild(ok);
    box.appendChild(row);
    opt.rememberEl = null;
    if (opt.remember) {
      var lbl = el('label', 'esw-chk');
      var cb = el('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.addEventListener('change', function(){ cb.blur(); panelEl.focus(); });
      var tx = el('span', '', '선택을 ' + opt.rule.key + '/* 규칙으로 기억');
      tx.appendChild(el('small', '', '같은 경로의 다른 VM 에서도 후보 1번이 됩니다.'));
      lbl.appendChild(cb);
      lbl.appendChild(tx);
      box.appendChild(lbl);
      opt.rememberEl = cb;
    }
    var cancel = el('button', 'esw-mini-btn', '취소 (Esc)');
    cancel.addEventListener('click', closePrompt);
    box.appendChild(cancel);

    showScreen('prompt');
  }

  // ───────── 설정 화면 ─────────
  function refreshSettings() {
    // 경로 규칙
    var keys = Object.keys(cfg.t).sort(function(a, b){ return routeLast(cfg.t[b]) - routeLast(cfg.t[a]); });
    secRoutesEl.textContent = '경로 규칙 · ' + keys.length;
    clear(routesEl);
    if (!keys.length) { routesEl.appendChild(el('div', 'esw-empty', '학습된 규칙이 없습니다. Production/Staging 을 쓰거나 VM 에서 서비스를 고르면 쌓입니다.')); }
    keys.forEach(function(k){
      var e = cfg.t[k];
      var subs = Object.keys(e.s).sort(function(a, b){ return (e.s[b][0] - e.s[a][0]) || (e.s[b][1] - e.s[a][1]); });
      var total = 0;
      subs.forEach(function(s){ total += e.s[s][0]; });
      var conflict = !e.f && subs.length > 1;
      var card = el('div', 'esw-card' + (conflict ? ' esw-warn' : ''));
      var head = el('div', 'esw-card-head');
      head.appendChild(el('span', 'esw-card-key', k + '/*'));
      head.appendChild(el('span', 'esw-card-meta', conflict ? '충돌' : (total + '회 · ' + relTime(routeLast(e)))));
      var del = el('button', 'esw-x', '×');
      del.setAttribute('aria-label', '규칙 삭제');
      del.addEventListener('click', function(){ delete cfg.t[k]; saveCfg(); refresh(); });
      head.appendChild(del);
      card.appendChild(head);
      var line = el('div', 'esw-card-line');
      if (e.f) {
        line.appendChild(d.createTextNode('→ ' + e.f + ' '));
        line.appendChild(el('span', '', '(고정)' + (cfg.g[e.f] ? ' / ' + cfg.g[e.f] : '')));
      } else {
        line.appendChild(d.createTextNode('→ ' + subs.map(function(s){ return s + ' ' + e.s[s][0] + '회'; }).join(' · ')));
        if (!conflict && subs.length === 1 && cfg.g[subs[0]]) { line.appendChild(el('span', '', ' / ' + cfg.g[subs[0]])); }
      }
      card.appendChild(line);
      if (conflict) {
        card.appendChild(el('div', 'esw-card-note', '서로 다른 서비스가 같은 경로로 학습되었습니다. 이동할 때 매번 묻습니다.'));
        var fr = el('div', 'esw-fixrow');
        subs.slice(0, 3).forEach(function(s){
          var fb = el('button', 'esw-mini-btn', s + ' 으로 고정');
          fb.addEventListener('click', function(){ e.f = s; saveCfg(); refresh(); });
          fr.appendChild(fb);
        });
        card.appendChild(fr);
      }
      if (e.f) {
        var unfix = el('button', 'esw-mini-btn', '고정 해제');
        unfix.addEventListener('click', function(){ delete e.f; saveCfg(); refresh(); });
        card.appendChild(unfix);
      }
      routesEl.appendChild(card);
    });

    // VM 최근 주소
    secVmEl.textContent = 'VM 최근 주소 · ' + cfg.r.length + ' (최대 ' + RECENT_MAX + ')';
    clear(vmListEl);
    if (!cfg.r.length) { vmListEl.appendChild(el('div', 'esw-empty', '저장된 주소가 없습니다.')); }
    cfg.r.forEach(function(x){
      var row = el('div', 'esw-vmrow');
      var star = el('button', 'esw-star' + (x.k ? ' esw-on' : ''), x.k ? '★' : '☆');
      star.setAttribute('aria-label', x.k ? '고정 해제' : '고정');
      star.addEventListener('click', function(){ x.k = x.k ? 0 : 1; sortRecents(); saveCfg(); refresh(); });
      row.appendChild(star);
      var v = vmOf(x);
      row.appendChild(el('span', '', v.sub + '.' + v.domain + (v.port ? ':' + v.port : '') + (v.proto === 'http:' ? ' (http)' : '')));
      var del = el('button', 'esw-x', '×');
      del.setAttribute('aria-label', '삭제');
      del.addEventListener('click', function(){ cfg.r.splice(cfg.r.indexOf(x), 1); saveCfg(); refresh(); });
      row.appendChild(del);
      vmListEl.appendChild(row);
    });
    if (cfg.r.length) { vmListEl.appendChild(el('div', 'esw-empty', '★ 고정하면 가득 차도 밀려나지 않습니다.')); }

    // Staging 대응
    clear(stgListEl);
    var gk = Object.keys(cfg.g).sort();
    if (!gk.length) { stgListEl.appendChild(el('div', 'esw-empty', '등록된 대응이 없습니다.')); }
    gk.forEach(function(sub){
      var row = el('div', 'esw-vmrow');
      row.appendChild(el('span', '', sub + ' → ' + cfg.g[sub]));
      var del = el('button', 'esw-x', '×');
      del.setAttribute('aria-label', '삭제');
      del.addEventListener('click', function(){ delete cfg.g[sub]; saveCfg(); refresh(); });
      row.appendChild(del);
      stgListEl.appendChild(row);
    });

    // 현재 호스트
    if (hostSub) {
      markProdBtn.textContent = cfg.p.indexOf(hostKey) >= 0 ?
        '이 도메인(' + hostSub + ')의 Production 지정 해제' : '이 도메인(' + hostSub + ')을 Production 으로 지정';
      markProdBtn.classList.remove('esw-hide');
    } else {
      markProdBtn.classList.add('esw-hide');
    }
    resetAllBtn.textContent = resetArmed ? '정말 초기화? 한 번 더 누르세요' : '경로 규칙·Staging 대응·Production 지정 모두 초기화';
  }

  refresh();

  overlay.querySelector('[data-esw-close]').addEventListener('click', closeModal);
  q('[data-esw-gear]').addEventListener('click', function(){ if (!promptState) { showSettings(!settingsOpen); } });
  q('[data-esw-settings-back]').addEventListener('click', function(){ showSettings(false); });
  var btns = overlay.querySelectorAll('[data-esw-target]');
  for (var i = 0; i < btns.length; i++) {
    btns[i].addEventListener('click', function(){ pick(this.getAttribute('data-esw-target')); });
  }

  // 입력창 텍스트 드래그 선택이 패널 밖에서 끝나도 닫히지 않도록 mousedown 위치까지 확인
  var downOnBackdrop = false;
  overlay.addEventListener('mousedown', function(e){ downOnBackdrop = (e.target === overlay); });
  overlay.addEventListener('click', function(e){
    if (e.target === overlay && downOnBackdrop) closeModal();
  });

  // ───────── 동작 연결 ─────────
  function toggleProd() {
    var idx = cfg.p.indexOf(hostKey);
    if (idx >= 0) { cfg.p.splice(idx, 1); } else { cfg.p.push(hostKey); }
    saveCfg();
    refresh();
    showToast(hostKey + (idx >= 0 ? ' 의 Production 지정을 해제했습니다.' : ' 을(를) Production 으로 지정했습니다.'));
  }
  markProdBtn.addEventListener('click', toggleProd);
  ambiguousBtn.addEventListener('click', toggleProd);

  resetAllBtn.addEventListener('click', function(){
    if (!resetArmed) { resetArmed = true; refreshSettings(); return; }
    resetArmed = false;
    cfg.t = {};
    cfg.g = {};
    cfg.p = [];
    cfg.l = '';
    saveCfg();
    refresh();
    showToast('경로 규칙·Staging 대응·Production 지정을 초기화했습니다.');
  });

  quickInput.addEventListener('input', updateQuick);
  quickInput.addEventListener('keydown', function(e){
    if (e.key === 'Enter') {
      e.preventDefault();
      submitQuick(e.shiftKey);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      // 포트 ±1. 입력이 비어 있으면 직전 VM 주소에서 시작하고, 포트가 없으면 기본 포트부터 붙인다.
      e.preventDefault();
      var v = quickInput.value.trim();
      if (!v) {
        var b = baseVm();
        if (!b) { return; }
        v = b.sub + (b.port ? ':' + b.port : '');
      }
      var delta = e.key === 'ArrowUp' ? 1 : -1;
      var pm = v.match(/:([0-9]{1,5})(?=[\/?#]|$)/);
      if (pm) {
        v = v.replace(pm[0], ':' + Math.max(0, Math.min(65535, parseInt(pm[1], 10) + delta)));
      } else {
        var st = v.indexOf('://') >= 0 ? v.indexOf('://') + 3 : 0;
        var ix = v.slice(st).search(/[\/?#]/);
        ix = ix < 0 ? v.length : st + ix;
        v = v.slice(0, ix) + ':' + DEFAULT_PORT + v.slice(ix);
      }
      quickInput.value = v;
      updateQuick();
    }
  });
  q('[data-esw-quick-go]').addEventListener('click', function(){ submitQuick(false); });

  // 호스트 페이지의 document 레벨 핸들러(단축키, 바깥 클릭 닫기, Bootstrap/jQuery UI 포커스 트랩 등)가
  // 오버레이 이벤트에 반응하지 않도록 host 에서 버블링을 끊는다.
  ['click', 'mousedown', 'mouseup', 'pointerdown', 'keydown', 'keyup', 'keypress', 'focusin', 'focusout'].forEach(function(type){
    hostEl.addEventListener(type, function(e){ e.stopPropagation(); });
  });

  hostEl.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;display:block;';
  mountParent().appendChild(hostEl);

  // 호스트 페이지 입력창/iframe 에 포커스가 있어도 단축키가 먹도록 패널로 포커스를 가져온다
  panelEl.focus();

  window.addEventListener('keydown', onKeydown, true);
  window.__eswCleanup = closeModal;
})();
