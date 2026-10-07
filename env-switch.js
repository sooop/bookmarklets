/*
 * ENV SWITCH — tracxlogis.com / qxpress.net 환경 전환 도구
 *
 * 이 파일은 북마클릿 로더가 <script src="...">로 동적 로드해서 실행하는 실제 로직입니다.
 * GitHub 등 정적 호스팅에 올려두고, 북마클릿(로더)은 이 파일의 URL만 참조합니다.
 * 로더는 매 실행마다 캐시버스팅 쿼리(?t=timestamp)를 붙여 불러오므로,
 * 이 파일을 수정해서 다시 올리기만 하면 북마클릿을 재설치하지 않아도 바로 반영됩니다.
 *
 * VM 판정 규칙 (tracxlogis.com / qxpress.net, staging- 제외) — 하나라도 맞으면 VM
 *   1) 3차 도메인에 '-.*' 접미가 붙음 (sooop-dev, sooop-react, youk6121-dev, x-smartship ...)
 *   2) 포트가 붙어 있음 (Production/Staging 은 포트 없이 서비스됨)
 *   3) 3차 도메인이 설정의 VM 서브도메인과 같음 (규칙에 안 걸리는 포트 없는 레거시 VM)
 * 설정 화면(⚙)에서 VM 이동 주소(서브도메인·도메인·포트·프로토콜)를 지정한다. VM 에서 나갈 때는 서비스를 매번 묻는다.
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

  var loc = window.location;
  var host = loc.hostname;
  var hostMatch = host.match(/^([^.]+)\.(tracxlogis\.com|qxpress\.net)$/);
  if (!hostMatch) {
    showToast('tracxlogis.com / qxpress.net 에서만 사용할 수 있습니다.');
    return;
  }

  // ───────── 설정 저장소 ─────────
  // localStorage 는 origin(호스트+포트)별로 분리되어 서브도메인 간에 공유되지 않으므로,
  // 도메인 전체에서 공유되는 쿠키(Domain=.tracxlogis.com / .qxpress.net)를 주 저장소로 쓰고 localStorage 는 폴백으로 둔다.
  //
  // 저장 구조(단일 출처): { vm, last, stg, prod }
  //   vm   : VM 이동에 쓰는 유일한 값 { sub, domain, port('' = 포트 없음), proto }
  //   stg  : 서비스별 Staging 3차 도메인 { 'qlps-admin.tracxlogis.com': 'staging-admin' }
  //   prod : 사용자가 'Production 이다'라고 지정한 호스트 키 (자동 VM 규칙보다 우선)
  //   last : 마지막으로 본 Production/Staging 서비스 (VM → 이동 시 후보)
  // VM 은 매번 다른 서비스를 띄울 수 있으므로 VM ↔ 서비스 대응은 저장하지 않는다.
  var CFG_KEY = '__esw_cfg__';
  var LEGACY_VM_KEY = '__esw_vm_config__';
  var LEGACY_LAST_KEY = '__esw_last_sub__';
  var DEFAULT_SUB = 'smartship2';
  var DEFAULT_DOMAIN = 'tracxlogis.com';
  var DEFAULT_VM_SUB = 'sooop-dev';
  var DEFAULT_VM_PORT = '3002';
  var DOMAINS = ['tracxlogis.com', 'qxpress.net'];
  var cookieDomain = '.' + hostMatch[2];

  var vmConfig = { sub: DEFAULT_VM_SUB, port: DEFAULT_VM_PORT, proto: 'https:', domain: DEFAULT_DOMAIN };
  var vmPortMemo = DEFAULT_VM_PORT;  // '포트 없음'을 껐다 켤 때 되살릴 직전 포트
  var lastEnv = null;
  var stgMap = {};
  var learnedProd = [];
  var LABEL_RE = /^[a-z0-9-]+$/;
  var KEY_RE = /^[a-z0-9-]+\.(tracxlogis\.com|qxpress\.net)$/;

  function readJson(getter) {
    try { return JSON.parse(getter() || 'null'); } catch (e) { return null; }
  }
  function readCookieCfg() {
    return readJson(function(){
      var m = d.cookie.match(new RegExp('(?:^|; )' + CFG_KEY + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : null;
    });
  }
  function applyCfg(cfg) {
    if (!cfg) { return; }
    var vm = cfg.vm || cfg;  // 레거시 키는 { sub, port } 평면 구조
    if (vm && typeof vm.sub === 'string' && LABEL_RE.test(vm.sub)) { vmConfig.sub = vm.sub; }
    if (vm && typeof vm.port === 'string' && /^[0-9]{0,5}$/.test(vm.port)) { vmConfig.port = vm.port; }  // '' = 포트 없음
    if (vm && (vm.proto === 'https:' || vm.proto === 'http:')) { vmConfig.proto = vm.proto; }
    if (vm && DOMAINS.indexOf(vm.domain) >= 0) { vmConfig.domain = vm.domain; }
    var last = cfg.last;
    if (last && typeof last.sub === 'string' && LABEL_RE.test(last.sub) && DOMAINS.indexOf(last.domain) >= 0) {
      lastEnv = { sub: last.sub, domain: last.domain };
    }
    if (Array.isArray(cfg.prod)) {
      learnedProd = cfg.prod.filter(function(k){ return typeof k === 'string' && KEY_RE.test(k); });
    }
    if (cfg.stg && typeof cfg.stg === 'object') {
      var ns = {};
      Object.keys(cfg.stg).forEach(function(k){
        if (KEY_RE.test(k) && typeof cfg.stg[k] === 'string' && LABEL_RE.test(cfg.stg[k])) { ns[k] = cfg.stg[k]; }
      });
      stgMap = ns;
    } else if (cfg.map && typeof cfg.map === 'object') {
      // 이전 버전(서비스별 { s, v } 학습 항목) 이관: Staging 대응만 가져온다. VM 대응은 버린다.
      Object.keys(cfg.map).forEach(function(k){
        var e = cfg.map[k];
        if (!KEY_RE.test(k) || !e || typeof e.s !== 'string' || !LABEL_RE.test(e.s)) { return; }
        stgMap[k] = e.s;
        if (learnedProd.indexOf(k) < 0) { learnedProd.push(k); }
      });
    }
  }
  // 우선순위: 레거시 localStorage < 신규 localStorage < 쿠키
  try {
    applyCfg({ vm: readJson(function(){ return localStorage.getItem(LEGACY_VM_KEY); }),
               last: readJson(function(){ return localStorage.getItem(LEGACY_LAST_KEY); }) });
    applyCfg(readJson(function(){ return localStorage.getItem(CFG_KEY); }));
  } catch (e) {}
  applyCfg(readCookieCfg());
  if (vmConfig.port) { vmPortMemo = vmConfig.port; }

  function saveCfg() {
    var json = JSON.stringify({ vm: vmConfig, last: lastEnv, stg: stgMap, prod: learnedProd });
    try { localStorage.setItem(CFG_KEY, json); } catch (e) {}
    // 쿠키는 항목당 4KB 한도 — 넘으면 쿠키 저장은 건너뛴다 (localStorage 에만 남음)
    if (encodeURIComponent(json).length > 3800) { return; }
    try {
      d.cookie = CFG_KEY + '=' + encodeURIComponent(json) + '; domain=' + cookieDomain +
        '; path=/; max-age=31536000; SameSite=Lax' + (loc.protocol === 'https:' ? '; Secure' : '');
    } catch (e) {}
  }

  // ───────── 환경 판정 ─────────
  var stagingMatch = host.match(/^staging-([^.]+)\.(tracxlogis\.com|qxpress\.net)$/);
  var hostSub = stagingMatch ? '' : hostMatch[1];
  var hostDomain = hostMatch[2];
  var hostKey = hostSub ? (hostSub + '.' + hostDomain) : '';
  var hostLabelFull = host.slice(0, host.length - hostDomain.length - 1);  // 'staging-x' 또는 'sooop-dev'
  var hostPort = String(loc.port || '');

  function famKey(f) { return f.sub + '.' + f.domain; }
  function findFamilyByStaging(label, domain) {
    var ks = Object.keys(stgMap);
    for (var i = 0; i < ks.length; i++) {
      var dot = ks[i].indexOf('.');
      if (ks[i].slice(dot + 1) === domain && stgMap[ks[i]] === label) { return { sub: ks[i].slice(0, dot), domain: domain }; }
    }
    return null;
  }

  // Production 으로 확정된 호스트: 사용자가 지정했거나, Staging 대응이 등록돼 있음
  function isForcedProd() {
    return !!hostSub && (learnedProd.indexOf(hostKey) >= 0 || !!stgMap[hostKey]);
  }
  // 판정 우선순위: Production 확정 → 규칙(하이픈 접미·포트) → 저장된 VM 설정과 일치
  function evalIsVM() {
    if (!hostSub || isForcedProd()) { return false; }
    return /-./.test(hostSub) || !!hostPort || (hostSub === vmConfig.sub && hostDomain === vmConfig.domain);
  }
  var isVM = evalIsVM();

  // 설정된 VM 과 현재 주소가 정확히 같은가 (서브도메인·도메인·포트)
  function isConfiguredVm() {
    return isVM && hostSub === vmConfig.sub && hostDomain === vmConfig.domain && hostPort === String(vmConfig.port);
  }
  function vmUrl() {
    return vmConfig.proto + '//' + vmConfig.sub + '.' + vmConfig.domain + (vmConfig.port ? ':' + vmConfig.port : '');
  }

  if (!isVM) {
    // Production/Staging 에서는 현재 서비스를 기억해 둔다 (VM 에서 이동할 때 후보로 사용)
    var curSub = stagingMatch ? stagingMatch[1] : hostSub;
    var curDomain = stagingMatch ? stagingMatch[2] : hostDomain;
    if (!lastEnv || lastEnv.sub !== curSub || lastEnv.domain !== curDomain) {
      lastEnv = { sub: curSub, domain: curDomain };
      saveCfg();
    }
  }

  // 현재 페이지가 속한 서비스(Production 3차 도메인)를 질문 없이 알 수 있으면 반환, 모르면 null
  //  - Staging: 등록된 대응 → 없으면 'staging-' 만 떼어 추정
  //  - VM: 항상 null (VM 은 매번 다른 서비스일 수 있어 이동 때마다 묻는다)
  //  - Production: 현재 호스트
  function peekFamily() {
    if (stagingMatch) {
      return findFamilyByStaging(hostLabelFull, hostDomain) || { sub: stagingMatch[1], domain: stagingMatch[2] };
    }
    if (isVM) { return null; }
    return { sub: hostSub, domain: hostDomain };
  }

  var restPath = loc.pathname + loc.search + loc.hash;

  function navigateTo(proto, targetHost, targetPort) {
    proto = (proto === 'http:' || proto === 'http') ? 'http:' : 'https:';
    var portPart = targetPort ? (':' + targetPort) : '';
    location.href = proto + '//' + targetHost + portPart + restPath;
  }

  // ───────── 모달 ─────────
  var hostEl = d.createElement('div');
  hostEl.id = 'esw-host-9f2b';
  // Shadow DOM 으로 호스트 페이지 CSS 가 새어 들어오는 것을 차단한다
  var shadow = hostEl.attachShadow({ mode: 'open' });
  var dropStyle = null;
  var overlay = null;
  var promptState = null;  // 질문 화면이 열려 있을 때 { cands, onChoose }
  var settingsOpen = false;
  var panelEl = null;

  function closeModal() {
    hostEl.remove();
    if (dropStyle) { dropStyle(); dropStyle = null; }
    window.removeEventListener('keydown', onKeydown, true);
    if (window.__eswCleanup === closeModal) { window.__eswCleanup = null; }
  }

  // Production/Staging 이동 시 현재 프로토콜 유지 (VM 에서 나갈 때는 https)
  function keepProto() { return (!isVM && loc.protocol === 'http:') ? 'http:' : 'https:'; }

  function go(proto, label, domain, port) {
    navigateTo(proto, label + '.' + domain, port);
    closeModal();
  }

  // VM 에서는 서비스를 알 수 없으므로 현재 경로를 보여 주며 묻는다. 답은 기억하지 않는다.
  function withFamily(cb) {
    var f = peekFamily();
    if (f) { cb(f); return; }
    var stripped = hostSub.indexOf('-') > 0 ? hostSub.slice(0, hostSub.lastIndexOf('-')) : '';
    openPrompt({
      title: '이 화면(' + loc.pathname + ')은 어느 서비스인가요?',
      hint: 'VM(' + host + (hostPort ? ':' + hostPort : '') + ')이 띄운 서비스의 Production 3차 도메인을 고르세요. VM 은 매번 다른 서비스일 수 있어 기억하지 않습니다.',
      cands: [lastEnv && lastEnv.sub, stripped, DEFAULT_SUB],
      onChoose: function(sub) {
        var fam = { sub: sub, domain: hostDomain };
        lastEnv = fam;
        saveCfg();
        cb(fam);
      }
    });
  }

  function askStaging(f) {
    var firstDash = f.sub.indexOf('-');
    openPrompt({
      title: f.sub + ' 의 Staging 도메인은?',
      hint: '처음 한 번만 묻고 기억합니다. (설정에서 수정·삭제할 수 있습니다)',
      cands: ['staging-' + f.sub, firstDash > 0 ? 'staging-' + f.sub.slice(firstDash + 1) : ''],
      onChoose: function(label) {
        stgMap[famKey(f)] = label;
        saveCfg();
        go(keepProto(), label, f.domain, '');
      }
    });
  }

  function pick(target) {
    if (promptState || settingsOpen) { return; }
    // 이미 해당 환경이면 새로고침 (판정이 틀려도 버튼은 항상 동작한다)
    if (target === 'production' && !stagingMatch && !isVM) { location.reload(); return; }
    if (target === 'staging' && stagingMatch) { location.reload(); return; }
    if (target === 'vm') {
      if (isConfiguredVm()) { location.reload(); } else { go(vmConfig.proto, vmConfig.sub, vmConfig.domain, vmConfig.port); }
      return;
    }

    withFamily(function(f) {
      if (target === 'production') {
        go(keepProto(), f.sub, f.domain, '');
      } else if (stgMap[famKey(f)]) {
        go(keepProto(), stgMap[famKey(f)], f.domain, '');
      } else {
        askStaging(f);
      }
    });
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
    if (promptState) {
      // 질문 화면: Esc = 취소(메인으로), 1~9 = 후보 선택, 그 외 키는 막지 않는다
      var dm = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
      if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); closePrompt(); }
      else if (dm && promptState.cands[+dm[1] - 1]) {
        e.preventDefault(); e.stopPropagation(); chooseFromPrompt(promptState.cands[+dm[1] - 1]);
      }
      return;
    }
    if (settingsOpen) {
      // 설정 화면: Esc = 메인으로. P/S/V 단축키는 비활성
      if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); showSettings(false); }
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
    '#esw-overlay-9f2b .esw-panel{width:340px;background:#14171F;border:1px solid #262B38;' +
    'border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.5);color:#E4E7EE;' +
    'animation:esw-in .15s ease;}' +
    '#esw-overlay-9f2b .esw-panel:focus{outline:none;}' +
    '@keyframes esw-in{from{opacity:0;transform:scale(.97) translateY(4px);}to{opacity:1;transform:none;}}' +
    '#esw-overlay-9f2b .esw-header{padding:16px 18px 12px 18px;border-bottom:1px solid #262B38;}' +
    '#esw-overlay-9f2b .esw-header-top{display:flex;align-items:center;gap:8px;margin-bottom:10px;}' +
    '#esw-overlay-9f2b .esw-dot{width:8px;height:8px;border-radius:50%;}' +
    '#esw-overlay-9f2b .esw-dot.esw-c-green{background:#34D399;box-shadow:0 0 8px #34D399;}' +
    '#esw-overlay-9f2b .esw-dot.esw-c-amber{background:#FBBF24;box-shadow:0 0 8px #FBBF24;}' +
    '#esw-overlay-9f2b .esw-dot.esw-c-violet{background:#A78BFA;box-shadow:0 0 8px #A78BFA;}' +
    '#esw-overlay-9f2b .esw-kicker{font-size:10px;letter-spacing:.14em;color:#8B93A7;flex:1;}' +
    '#esw-overlay-9f2b .esw-close{background:none;border:none;color:#8B93A7;font-size:16px;' +
    'font-family:inherit;cursor:pointer;line-height:1;padding:2px 4px;}' +
    '#esw-overlay-9f2b .esw-close:hover{color:#E4E7EE;}' +
    '#esw-overlay-9f2b .esw-current-env{font-size:15px;font-weight:700;margin-right:8px;}' +
    '#esw-overlay-9f2b .esw-current-host{font-size:11px;color:#8B93A7;word-break:break-all;}' +
    '#esw-overlay-9f2b .esw-body{padding:12px;display:flex;flex-direction:column;gap:8px;}' +
    '#esw-overlay-9f2b .esw-switch{width:100%;display:flex;align-items:center;gap:12px;font-family:inherit;' +
    'background:#1B1F2A;border:1px solid #262B38;border-radius:9px;padding:12px 14px;' +
    'cursor:pointer;color:#E4E7EE;text-align:left;transition:border-color .12s ease;}' +
    '#esw-overlay-9f2b .esw-switch:hover{border-color:#3A4257;}' +
    '#esw-overlay-9f2b .esw-key{flex-shrink:0;width:22px;height:22px;line-height:22px;' +
    'text-align:center;border-radius:5px;background:#0F1219;border-bottom:2px solid #333A4A;' +
    'font-size:12px;font-weight:700;}' +
    '#esw-overlay-9f2b .esw-switch-label{flex:1;min-width:0;}' +
    '#esw-overlay-9f2b .esw-switch-title{font-size:13.5px;font-weight:600;display:block;}' +
    '#esw-overlay-9f2b .esw-switch-sub{font-size:11px;color:#8B93A7;display:block;' +
    'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;}' +
    '#esw-overlay-9f2b .esw-led{flex-shrink:0;width:8px;height:8px;border-radius:50%;}' +
    '#esw-overlay-9f2b .esw-led-green{background:#34D399;box-shadow:0 0 6px #34D399;}' +
    '#esw-overlay-9f2b .esw-led-amber{background:#FBBF24;box-shadow:0 0 6px #FBBF24;}' +
    '#esw-overlay-9f2b .esw-led-violet{background:#A78BFA;box-shadow:0 0 6px #A78BFA;}' +
    '#esw-overlay-9f2b .esw-footer{padding:10px 18px;border-top:1px solid #262B38;' +
    'font-size:10.5px;color:#8B93A7;word-break:break-all;}' +
    '#esw-overlay-9f2b .esw-mini-btn{background:#1B1F2A;border:1px solid #262B38;border-radius:6px;' +
    'padding:6px 8px;color:#A78BFA;font-family:inherit;font-size:11px;cursor:pointer;}' +
    '#esw-overlay-9f2b .esw-mini-btn:hover{border-color:#A78BFA;}' +
    '#esw-overlay-9f2b .esw-field{flex:1;display:flex;flex-direction:column;gap:5px;min-width:0;}' +
    '#esw-overlay-9f2b .esw-field span{font-size:10px;color:#8B93A7;letter-spacing:.05em;}' +
    '#esw-overlay-9f2b .esw-field.esw-field-port{flex:0 0 70px;}' +
    '#esw-overlay-9f2b .esw-input{width:100%;background:#14171F;border:1px solid #262B38;' +
    'border-radius:6px;padding:6px 8px;color:#E4E7EE;font-family:inherit;font-size:12px;}' +
    '#esw-overlay-9f2b .esw-input:focus{outline:none;border-color:#A78BFA;}' +
    '#esw-overlay-9f2b .esw-current-badge{display:none;flex-shrink:0;font-size:9px;' +
    'letter-spacing:.04em;padding:3px 7px;border-radius:20px;background:rgba(228,231,238,0.08);' +
    'color:#8B93A7;}' +
    '#esw-overlay-9f2b .esw-current-badge.esw-show{display:inline-flex;align-items:center;}' +
    '#esw-overlay-9f2b .esw-main{display:flex;flex-direction:column;gap:8px;}' +
    '#esw-overlay-9f2b .esw-prompt{display:flex;flex-direction:column;gap:8px;}' +
    '#esw-overlay-9f2b .esw-prompt-title{font-size:13px;font-weight:700;word-break:break-all;}' +
    '#esw-overlay-9f2b .esw-prompt-hint{font-size:10.5px;color:#8B93A7;}' +
    '#esw-overlay-9f2b .esw-prompt-row{display:flex;gap:8px;align-items:stretch;}' +
    '#esw-overlay-9f2b .esw-prompt-row .esw-input{flex:1;}' +
    '#esw-overlay-9f2b .esw-danger{color:#FBBF24;}' +
    '#esw-overlay-9f2b .esw-settings{display:flex;flex-direction:column;gap:8px;}' +
    '#esw-overlay-9f2b .esw-section{font-size:10px;letter-spacing:.1em;color:#8B93A7;margin-top:6px;}' +
    '#esw-overlay-9f2b .esw-row{display:flex;gap:8px;align-items:flex-end;}' +
    '#esw-overlay-9f2b .esw-row .esw-field{flex:1;}' +
    '#esw-overlay-9f2b .esw-row .esw-field.esw-field-port{flex:0 0 96px;}' +
    '#esw-overlay-9f2b .esw-input:disabled{opacity:.35;}' +
    '#esw-overlay-9f2b .esw-wide{width:100%;}' +
    '#esw-overlay-9f2b .esw-preview{font-size:11px;color:#A78BFA;word-break:break-all;padding:2px 0;}' +
    '#esw-overlay-9f2b .esw-map-row{display:flex;gap:8px;align-items:center;font-size:11px;}' +
    '#esw-overlay-9f2b .esw-map-row span{flex:1;min-width:0;word-break:break-all;}' +
    '#esw-overlay-9f2b .esw-empty{font-size:11px;color:#8B93A7;}' +
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
          '<span class="esw-kicker">CURRENT ENV</span>' +
          '<button class="esw-close" data-esw-gear aria-label="설정" title="설정">&#9881;</button>' +
          '<button class="esw-close" data-esw-close aria-label="닫기">&times;</button>' +
        '</div>' +
        '<span class="esw-current-env" data-esw-env></span>' +
        '<div class="esw-current-host" data-esw-host></div>' +
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
          '<span class="esw-current-badge" data-esw-prod-badge>현재</span>' +
        '</button>' +
        '<button class="esw-switch" data-esw-target="staging">' +
          '<span class="esw-key">S</span>' +
          '<span class="esw-switch-label">' +
            '<span class="esw-switch-title">Staging</span>' +
            '<span class="esw-switch-sub" data-esw-staging-sub></span>' +
          '</span>' +
          '<span class="esw-led esw-led-amber" data-esw-staging-led></span>' +
          '<span class="esw-current-badge" data-esw-staging-badge>현재</span>' +
        '</button>' +
        '<button class="esw-switch" data-esw-target="vm">' +
          '<span class="esw-key">V</span>' +
          '<span class="esw-switch-label">' +
            '<span class="esw-switch-title">VM</span>' +
            '<span class="esw-switch-sub" data-esw-vm-label></span>' +
          '</span>' +
          '<span class="esw-led esw-led-violet" data-esw-vm-led></span>' +
          '<span class="esw-current-badge" data-esw-vm-badge>현재</span>' +
        '</button>' +
       '</div>' +
       '<div class="esw-settings esw-hide" data-esw-settings>' +
        '<button class="esw-mini-btn esw-wide" data-esw-settings-back>&larr; 돌아가기 (Esc)</button>' +
        '<div class="esw-section">VM 이동 주소</div>' +
        '<div class="esw-row">' +
          '<label class="esw-field"><span>서브도메인</span>' +
            '<input class="esw-input" type="text" data-esw-vm-sub spellcheck="false" autocomplete="off"></label>' +
          '<button class="esw-mini-btn" data-esw-vm-domain></button>' +
        '</div>' +
        '<div class="esw-row">' +
          '<label class="esw-field esw-field-port"><span>포트 (↑↓)</span>' +
            '<input class="esw-input" type="text" inputmode="numeric" data-esw-vm-port spellcheck="false" autocomplete="off"></label>' +
          '<button class="esw-mini-btn" data-esw-vm-noport></button>' +
          '<button class="esw-mini-btn" data-esw-vm-proto></button>' +
        '</div>' +
        '<div class="esw-preview" data-esw-vm-preview></div>' +
        '<button class="esw-mini-btn esw-wide" data-esw-use-current></button>' +
        '<div class="esw-section">현재 호스트</div>' +
        '<button class="esw-mini-btn esw-wide" data-esw-mark-prod></button>' +
        '<div class="esw-section">Staging 도메인 대응</div>' +
        '<div class="esw-settings" data-esw-stg-list></div>' +
        '<button class="esw-mini-btn esw-wide esw-danger" data-esw-reset-all></button>' +
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
  panelEl = q('.esw-panel');
  var envEl = q('[data-esw-env]');
  var dotEl = q('[data-esw-dot]');
  var vmLabel = q('[data-esw-vm-label]');
  var mainEl = q('[data-esw-main]');
  var promptEl = q('[data-esw-prompt]');
  var settingsEl = q('[data-esw-settings]');
  var vmSubInput = q('[data-esw-vm-sub]');
  var vmDomainBtn = q('[data-esw-vm-domain]');
  var vmPortInput = q('[data-esw-vm-port]');
  var vmNoPortBtn = q('[data-esw-vm-noport]');
  var vmProtoBtn = q('[data-esw-vm-proto]');
  var vmPreview = q('[data-esw-vm-preview]');
  var useCurrentBtn = q('[data-esw-use-current]');
  var markProdBtn = q('[data-esw-mark-prod]');
  var stgListEl = q('[data-esw-stg-list]');
  var resetAllBtn = q('[data-esw-reset-all]');
  var resetArmed = false;

  function setCurrent(name, on) {
    q('[data-esw-' + name + '-led]').classList.toggle('esw-hide', on);
    q('[data-esw-' + name + '-badge]').classList.toggle('esw-show', on);
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
    var prodCur = !stagingCur && !isVM;

    envEl.textContent = stagingCur ? 'Staging' : (isVM ? 'VM' : 'Production');
    dotEl.className = 'esw-dot ' + (stagingCur ? 'esw-c-amber' : (isVM ? 'esw-c-violet' : 'esw-c-green'));
    q('[data-esw-host]').textContent = host + (hostPort ? ':' + hostPort : '');

    var f = peekFamily();
    var ask = '이동할 때 서비스를 물어봅니다';
    q('[data-esw-prod-sub]').textContent = f ? (f.sub + '.' + f.domain) : ask;
    q('[data-esw-staging-sub]').textContent = stagingMatch ? host :
      (!f ? ask : (stgMap[famKey(f)] ? stgMap[famKey(f)] + '.' + f.domain : '선택 필요 (처음 한 번)'));
    vmLabel.textContent = vmUrl();
    setCurrent('prod', prodCur);
    setCurrent('staging', stagingCur);
    setCurrent('vm', isConfiguredVm());
    q('[data-esw-footer]').textContent = '경로 유지: ' + (restPath || '/');

    refreshSettings();
  }

  function refreshSettings() {
    // 입력 중인 칸은 덮어쓰지 않는다 (지우고 다시 쓰는 동안 값이 되살아나는 것 방지)
    if (shadow.activeElement !== vmSubInput) { vmSubInput.value = vmConfig.sub; }
    if (shadow.activeElement !== vmPortInput) { vmPortInput.value = vmConfig.port || vmPortMemo; }
    vmPortInput.disabled = !vmConfig.port;
    vmDomainBtn.textContent = '.' + vmConfig.domain;
    vmNoPortBtn.textContent = vmConfig.port ? '포트 없애기' : '포트 쓰기';
    vmProtoBtn.textContent = vmConfig.proto === 'http:' ? 'http' : 'https';
    vmPreview.textContent = '→ ' + vmUrl() + (restPath || '/');

    if (hostSub && !isConfiguredVm()) {
      useCurrentBtn.textContent = '현재 호스트(' + hostSub + (hostPort ? ':' + hostPort : '') + ')를 VM 주소로 지정';
      useCurrentBtn.classList.remove('esw-hide');
    } else {
      useCurrentBtn.classList.add('esw-hide');
    }
    if (hostSub) {
      markProdBtn.textContent = learnedProd.indexOf(hostKey) >= 0 ?
        '이 도메인(' + hostSub + ')의 Production 지정 해제' : '이 도메인(' + hostSub + ')을 Production 으로 지정';
      markProdBtn.classList.remove('esw-hide');
    } else {
      markProdBtn.classList.add('esw-hide');
    }

    while (stgListEl.firstChild) { stgListEl.removeChild(stgListEl.firstChild); }
    var keys = Object.keys(stgMap).sort();
    if (!keys.length) { stgListEl.appendChild(el('div', 'esw-empty', '등록된 대응이 없습니다.')); }
    keys.forEach(function(k){
      var row = el('div', 'esw-map-row');
      row.appendChild(el('span', '', k.slice(0, k.indexOf('.')) + ' → ' + stgMap[k]));
      var del = el('button', 'esw-mini-btn', '삭제');
      del.addEventListener('click', function(){
        delete stgMap[k];
        saveCfg();
        refresh();
      });
      row.appendChild(del);
      stgListEl.appendChild(row);
    });
    resetAllBtn.textContent = resetArmed ? '정말 초기화? 한 번 더 누르세요' : 'Staging 대응·Production 지정 모두 초기화';
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
    closePrompt();
    st.onChoose(v);
  }

  // opt: { title, hint, cands[], onChoose(value) }
  function openPrompt(opt) {
    var seen = {};
    opt.cands = opt.cands.filter(function(c){
      if (!c || !LABEL_RE.test(c) || seen[c]) { return false; }
      seen[c] = true;
      return true;
    });
    promptState = opt;
    var box = promptEl;
    while (box.firstChild) { box.removeChild(box.firstChild); }
    box.appendChild(el('div', 'esw-prompt-title', opt.title));
    box.appendChild(el('div', 'esw-prompt-hint', opt.hint + ' (숫자키 선택 · Esc 취소)'));
    opt.cands.forEach(function(c, idx){
      var b = el('button', 'esw-switch');
      b.appendChild(el('span', 'esw-key', String(idx + 1)));
      var lab = el('span', 'esw-switch-label');
      lab.appendChild(el('span', 'esw-switch-title', c));
      b.appendChild(lab);
      b.addEventListener('click', function(){ chooseFromPrompt(c); });
      box.appendChild(b);
    });
    var row = el('div', 'esw-prompt-row');
    var ci = el('input', 'esw-input');
    ci.type = 'text';
    ci.placeholder = '직접 입력 (3차 도메인 전체)';
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
    var cancel = el('button', 'esw-mini-btn', '취소 (Esc)');
    cancel.addEventListener('click', closePrompt);
    box.appendChild(cancel);

    showScreen('prompt');
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

  // ───────── 설정 화면 동작 ─────────
  // VM 이동은 vmConfig 한 곳만 읽으므로, 모든 입력은 vmConfig 만 바꾸고 저장·재렌더하면 된다.
  function commitVm() { saveCfg(); refresh(); }

  vmSubInput.addEventListener('input', function(){
    var cleaned = vmSubInput.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (cleaned !== vmSubInput.value) { vmSubInput.value = cleaned; }
    if (!cleaned) { return; }  // 비어 있는 동안은 저장하지 않는다 (blur 때 직전 값으로 복원)
    vmConfig.sub = cleaned;
    commitVm();
  });
  vmSubInput.addEventListener('blur', function(){ vmSubInput.value = vmConfig.sub; refreshSettings(); });

  vmDomainBtn.addEventListener('click', function(){
    vmConfig.domain = DOMAINS[(DOMAINS.indexOf(vmConfig.domain) + 1) % DOMAINS.length];
    commitVm();
  });

  function setPort(p) {
    vmConfig.port = p;
    vmPortMemo = p;
    commitVm();
  }
  vmPortInput.addEventListener('input', function(){
    var cleaned = vmPortInput.value.replace(/[^0-9]/g, '').slice(0, 5);
    if (cleaned !== vmPortInput.value) { vmPortInput.value = cleaned; }
    if (cleaned) { setPort(cleaned); }  // 비어 있는 동안은 저장하지 않는다 (포트 없음은 별도 버튼)
  });
  vmPortInput.addEventListener('blur', function(){ vmPortInput.value = vmConfig.port || vmPortMemo; });
  vmPortInput.addEventListener('keydown', function(e){
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      var current = parseInt(vmPortInput.value, 10);
      if (isNaN(current)) { current = parseInt(DEFAULT_VM_PORT, 10); }
      var next = Math.max(0, Math.min(65535, current + (e.key === 'ArrowUp' ? 1 : -1)));
      vmPortInput.value = String(next);
      setPort(String(next));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      vmPortInput.blur();
    }
  });
  vmSubInput.addEventListener('keydown', function(e){
    if (e.key === 'Enter') { e.preventDefault(); vmSubInput.blur(); }
  });

  vmNoPortBtn.addEventListener('click', function(){
    if (vmConfig.port) { vmPortMemo = vmConfig.port; vmConfig.port = ''; } else { vmConfig.port = vmPortMemo || DEFAULT_VM_PORT; }
    commitVm();
  });

  vmProtoBtn.addEventListener('click', function(){
    vmConfig.proto = (vmConfig.proto === 'http:') ? 'https:' : 'http:';
    commitVm();
  });

  useCurrentBtn.addEventListener('click', function(){
    vmConfig.sub = hostSub;
    vmConfig.domain = hostDomain;
    vmConfig.port = hostPort;
    if (hostPort) { vmPortMemo = hostPort; }
    vmConfig.proto = loc.protocol === 'http:' ? 'http:' : 'https:';
    commitVm();
    showToast('VM 주소를 ' + vmUrl() + ' 로 지정했습니다.');
  });

  markProdBtn.addEventListener('click', function(){
    var idx = learnedProd.indexOf(hostKey);
    if (idx >= 0) { learnedProd.splice(idx, 1); } else { learnedProd.push(hostKey); }
    saveCfg();
    refresh();
    showToast(hostKey + (idx >= 0 ? ' 의 Production 지정을 해제했습니다.' : ' 을(를) Production 으로 지정했습니다.'));
  });

  resetAllBtn.addEventListener('click', function(){
    if (!resetArmed) { resetArmed = true; refreshSettings(); return; }
    resetArmed = false;
    stgMap = {};
    learnedProd = [];
    saveCfg();
    refresh();
    showToast('Staging 대응과 Production 지정을 초기화했습니다.');
  });

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
