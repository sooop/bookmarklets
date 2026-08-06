/*
 * ENV SWITCH — tracxlogis.com / qxpress.net 환경 전환 도구
 *
 * 이 파일은 북마클릿 로더가 <script src="...">로 동적 로드해서 실행하는 실제 로직입니다.
 * GitHub 등 정적 호스팅에 올려두고, 북마클릿(로더)은 이 파일의 URL만 참조합니다.
 * 로더는 매 실행마다 캐시버스팅 쿼리(?t=timestamp)를 붙여 불러오므로,
 * 이 파일을 수정해서 다시 올리기만 하면 북마클릿을 재설치하지 않아도 바로 반영됩니다.
 */
(function envSwitchBookmarklet(){
  var d = document;
  var existing = d.getElementById('esw-overlay-9f2b');
  if (existing) { existing.remove(); }

  function showToast(message) {
    var existingToast = d.getElementById('esw-toast-9f2b');
    if (existingToast) {
      clearTimeout(existingToast.__eswTimer);
      existingToast.remove();
    }
    if (!d.getElementById('esw-toast-style-9f2b')) {
      var toastStyle = d.createElement('style');
      toastStyle.id = 'esw-toast-style-9f2b';
      toastStyle.textContent =
        '#esw-toast-9f2b{position:fixed;left:50%;bottom:32px;z-index:2147483647;' +
        'transform:translate(-50%,8px);opacity:0;max-width:320px;text-align:center;' +
        'background:#14171F;border:1px solid #262B38;color:#E4E7EE;padding:10px 16px;' +
        'border-radius:9px;box-shadow:0 12px 30px rgba(0,0,0,0.45);' +
        'font-family:"JetBrains Mono","SF Mono",Consolas,"Courier New",monospace;' +
        'font-size:12.5px;line-height:1.5;white-space:pre-line;' +
        'transition:opacity .18s ease,transform .18s ease;}' +
        '#esw-toast-9f2b.esw-toast-show{opacity:1;transform:translate(-50%,0);}';
      d.head.appendChild(toastStyle);
    }
    var toast = d.createElement('div');
    toast.id = 'esw-toast-9f2b';
    toast.textContent = message;
    d.body.appendChild(toast);
    requestAnimationFrame(function(){ toast.classList.add('esw-toast-show'); });
    toast.__eswTimer = setTimeout(function(){
      toast.classList.remove('esw-toast-show');
      setTimeout(function(){ toast.remove(); }, 200);
    }, 2600);
  }

  var loc = window.location;
  var host = loc.hostname;
  var isTracx = /(^|\.)tracxlogis\.com$/.test(host);
  var isQx = /(^|\.)qxpress\.net$/.test(host);
  var isAllowedDomain = isTracx || isQx;

  var STORAGE_KEY = '__esw_last_sub__';
  var DEFAULT_SUB = 'smartship2';
  var DEFAULT_DOMAIN = 'tracxlogis.com';
  var STORAGE_KEY_VM = '__esw_vm_config__';
  var DEFAULT_VM_SUB = 'sooop-dev';
  var DEFAULT_VM_PORT = '3002';
  var vmConfig = { sub: DEFAULT_VM_SUB, port: DEFAULT_VM_PORT };
  try {
    var cachedVm = JSON.parse(localStorage.getItem(STORAGE_KEY_VM) || 'null');
    if (cachedVm && cachedVm.sub) { vmConfig.sub = cachedVm.sub; }
    if (cachedVm && cachedVm.port) { vmConfig.port = cachedVm.port; }
  } catch (e) {}

  function saveVmConfig() {
    try { localStorage.setItem(STORAGE_KEY_VM, JSON.stringify(vmConfig)); } catch (e) {}
  }

  var stagingMatch = host.match(/^staging-([^.]+)\.(tracxlogis\.com|qxpress\.net)$/);
  var isVM = (host === (vmConfig.sub + '.tracxlogis.com'));
  var prodMatch = (!stagingMatch && !isVM) ? host.match(/^([^.]+)\.(tracxlogis\.com|qxpress\.net)$/) : null;

  var sub, domain;
  if (stagingMatch) { sub = stagingMatch[1]; domain = stagingMatch[2]; }
  else if (prodMatch) { sub = prodMatch[1]; domain = prodMatch[2]; }

  if (sub && domain) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ sub: sub, domain: domain })); } catch (e) {}
  } else if (isVM) {
    try {
      var cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (cached) { sub = cached.sub; domain = cached.domain; }
    } catch (e) {}
  }

  if (!sub || !domain) {
    sub = DEFAULT_SUB;
    domain = DEFAULT_DOMAIN;
  }

  var vmPortMatches = (String(loc.port || '') === String(vmConfig.port || ''));
  var vmIsCurrent = isVM && vmPortMatches;

  var restPath = isAllowedDomain ? (loc.pathname + loc.search + loc.hash) : '/main';
  var protocol = loc.protocol;
  var currentEnv = stagingMatch ? 'Staging' : (isVM ? 'VM' : (isAllowedDomain ? 'Production' : 'External'));
  var currentColor = stagingMatch ? '#FBBF24' : (isVM ? '#A78BFA' : (isAllowedDomain ? '#34D399' : '#8B93A7'));

  function navigateTo(targetHost, targetPort) {
    var portPart = targetPort ? (':' + targetPort) : '';
    location.href = protocol + '//' + targetHost + portPart + restPath;
  }

  function closeModal() {
    var el = d.getElementById('esw-overlay-9f2b');
    if (el) el.remove();
    d.removeEventListener('keydown', onKeydown, true);
  }

  function pick(target) {
    if (target === 'production') {
      if (prodIsCurrent) { return; }
      if (!sub || !domain) { showToast('서브도메인 정보가 없어 Production으로 전환할 수 없습니다.\nProduction 또는 Staging 페이지에서 먼저 실행해 주세요.'); return; }
      navigateTo(sub + '.' + domain);
    } else if (target === 'staging') {
      if (stagingIsCurrent) { return; }
      if (!sub || !domain) { showToast('서브도메인 정보가 없어 Staging으로 전환할 수 없습니다.\nProduction 또는 Staging 페이지에서 먼저 실행해 주세요.'); return; }
      navigateTo('staging-' + sub + '.' + domain);
    } else if (target === 'vm') {
      var vmSub = vmConfig.sub || DEFAULT_VM_SUB;
      var vmPort = vmConfig.port || DEFAULT_VM_PORT;
      var vmNow = (host === (vmSub + '.tracxlogis.com')) && (String(loc.port || '') === String(vmPort));
      if (vmNow) { return; }
      navigateTo(vmSub + '.tracxlogis.com', vmPort);
    }
    closeModal();
  }

  function onKeydown(e) {
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      if (e.key === 'Escape') { e.target.blur(); }
      return;
    }
    if (e.key === 'Escape') { closeModal(); }
    else if (e.key === 'p' || e.key === 'P') { pick('production'); }
    else if (e.key === 's' || e.key === 'S') { pick('staging'); }
    else if (e.key === 'v' || e.key === 'V') { pick('vm'); }
  }

  var style = d.createElement('style');
  style.id = 'esw-style-9f2b';
  style.textContent =
    '#esw-overlay-9f2b{position:fixed;inset:0;z-index:2147483647;background:rgba(6,7,10,0.6);' +
    'backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;' +
    'font-family:"JetBrains Mono","SF Mono",Consolas,"Courier New",monospace;}' +
    '#esw-overlay-9f2b *{box-sizing:border-box;}' +
    '#esw-overlay-9f2b .esw-panel{width:340px;background:#14171F;border:1px solid #262B38;' +
    'border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.5);color:#E4E7EE;' +
    'animation:esw-in .15s ease;}' +
    '@keyframes esw-in{from{opacity:0;transform:scale(.97) translateY(4px);}to{opacity:1;transform:none;}}' +
    '#esw-overlay-9f2b .esw-header{padding:16px 18px 12px 18px;border-bottom:1px solid #262B38;}' +
    '#esw-overlay-9f2b .esw-header-top{display:flex;align-items:center;gap:8px;margin-bottom:10px;}' +
    '#esw-overlay-9f2b .esw-dot{width:8px;height:8px;border-radius:50%;background:' + currentColor + ';' +
    'box-shadow:0 0 8px ' + currentColor + ';}' +
    '#esw-overlay-9f2b .esw-kicker{font-size:10px;letter-spacing:.14em;color:#8B93A7;flex:1;}' +
    '#esw-overlay-9f2b .esw-close{background:none;border:none;color:#8B93A7;font-size:16px;' +
    'cursor:pointer;line-height:1;padding:2px 4px;}' +
    '#esw-overlay-9f2b .esw-close:hover{color:#E4E7EE;}' +
    '#esw-overlay-9f2b .esw-current-env{font-size:15px;font-weight:700;margin-right:8px;}' +
    '#esw-overlay-9f2b .esw-current-host{font-size:11px;color:#8B93A7;word-break:break-all;}' +
    '#esw-overlay-9f2b .esw-body{padding:12px;display:flex;flex-direction:column;gap:8px;}' +
    '#esw-overlay-9f2b .esw-switch{width:100%;display:flex;align-items:center;gap:12px;' +
    'background:#1B1F2A;border:1px solid #262B38;border-radius:9px;padding:12px 14px;' +
    'cursor:pointer;color:#E4E7EE;text-align:left;transition:border-color .12s ease;}' +
    '#esw-overlay-9f2b .esw-switch:hover:not(:disabled){border-color:#3A4257;}' +
    '#esw-overlay-9f2b .esw-switch:disabled{opacity:.4;cursor:not-allowed;}' +
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
    '#esw-overlay-9f2b .esw-vm-row{display:flex;gap:8px;align-items:stretch;}' +
    '#esw-overlay-9f2b .esw-vm-row .esw-switch{width:auto;flex:1;min-width:0;}' +
    '#esw-overlay-9f2b .esw-edit-btn{flex-shrink:0;width:36px;background:#1B1F2A;' +
    'border:1px solid #262B38;border-radius:9px;color:#8B93A7;cursor:pointer;' +
    'display:flex;align-items:center;justify-content:center;transition:border-color .12s ease,color .12s ease;}' +
    '#esw-overlay-9f2b .esw-edit-btn:hover{border-color:#3A4257;color:#E4E7EE;}' +
    '#esw-overlay-9f2b .esw-edit-btn.esw-active{color:#A78BFA;border-color:#A78BFA;}' +
    '#esw-overlay-9f2b .esw-vm-settings{display:none;gap:8px;margin-top:8px;' +
    'padding:10px;background:#0F1219;border:1px solid #262B38;border-radius:9px;}' +
    '#esw-overlay-9f2b .esw-vm-settings.esw-open{display:flex;}' +
    '#esw-overlay-9f2b .esw-field{flex:1;display:flex;flex-direction:column;gap:5px;min-width:0;}' +
    '#esw-overlay-9f2b .esw-field span{font-size:10px;color:#8B93A7;letter-spacing:.05em;}' +
    '#esw-overlay-9f2b .esw-field.esw-field-port{flex:0 0 70px;}' +
    '#esw-overlay-9f2b .esw-input{width:100%;background:#14171F;border:1px solid #262B38;' +
    'border-radius:6px;padding:6px 8px;color:#E4E7EE;font-family:inherit;font-size:12px;}' +
    '#esw-overlay-9f2b .esw-input:focus{outline:none;border-color:#A78BFA;}' +
    '#esw-overlay-9f2b .esw-hide{display:none;}' +
    '#esw-overlay-9f2b .esw-current-badge{display:none;flex-shrink:0;font-size:9px;' +
    'letter-spacing:.04em;padding:3px 7px;border-radius:20px;background:rgba(228,231,238,0.08);' +
    'color:#8B93A7;}' +
    '#esw-overlay-9f2b .esw-current-badge.esw-show{display:inline-flex;align-items:center;}' +
    '#esw-overlay-9f2b .esw-switch:disabled .esw-switch-title{color:#C7CBD6;}';
  d.head.appendChild(style);

  var overlay = d.createElement('div');
  overlay.id = 'esw-overlay-9f2b';

  var prodSubText = (sub && domain) ? (sub + '.' + domain) : '서브도메인 정보 없음';
  var stagingSubText = (sub && domain) ? ('staging-' + sub + '.' + domain) : '서브도메인 정보 없음';
  var noSubInfo = (!sub || !domain);
  var prodIsCurrent = currentEnv === 'Production';
  var stagingIsCurrent = currentEnv === 'Staging';
  var prodDisabled = noSubInfo || prodIsCurrent;
  var stagingDisabled = noSubInfo || stagingIsCurrent;
  var prodTitle = prodIsCurrent ? '이미 현재 환경입니다' : (noSubInfo ? '서브도메인 정보 없음' : '');
  var stagingTitle = stagingIsCurrent ? '이미 현재 환경입니다' : (noSubInfo ? '서브도메인 정보 없음' : '');

  overlay.innerHTML =
    '<div class="esw-panel" role="dialog" aria-label="환경 전환">' +
      '<div class="esw-header">' +
        '<div class="esw-header-top">' +
          '<span class="esw-dot"></span>' +
          '<span class="esw-kicker">CURRENT ENV</span>' +
          '<button class="esw-close" data-esw-close aria-label="닫기">&times;</button>' +
        '</div>' +
        '<span class="esw-current-env">' + currentEnv + '</span>' +
        '<div class="esw-current-host">' + host + '</div>' +
      '</div>' +
      '<div class="esw-body">' +
        '<button class="esw-switch" data-esw-target="production" title="' + prodTitle + '" ' + (prodDisabled ? 'disabled' : '') + '>' +
          '<span class="esw-key">P</span>' +
          '<span class="esw-switch-label">' +
            '<span class="esw-switch-title">Production</span>' +
            '<span class="esw-switch-sub">' + prodSubText + '</span>' +
          '</span>' +
          '<span class="esw-led esw-led-green' + (prodIsCurrent ? ' esw-hide' : '') + '"></span>' +
          '<span class="esw-current-badge' + (prodIsCurrent ? ' esw-show' : '') + '">현재</span>' +
        '</button>' +
        '<button class="esw-switch" data-esw-target="staging" title="' + stagingTitle + '" ' + (stagingDisabled ? 'disabled' : '') + '>' +
          '<span class="esw-key">S</span>' +
          '<span class="esw-switch-label">' +
            '<span class="esw-switch-title">Staging</span>' +
            '<span class="esw-switch-sub">' + stagingSubText + '</span>' +
          '</span>' +
          '<span class="esw-led esw-led-amber' + (stagingIsCurrent ? ' esw-hide' : '') + '"></span>' +
          '<span class="esw-current-badge' + (stagingIsCurrent ? ' esw-show' : '') + '">현재</span>' +
        '</button>' +
        '<div class="esw-vm-row">' +
          '<button class="esw-switch" data-esw-target="vm" title="' + (vmIsCurrent ? '이미 현재 환경입니다' : '') + '" ' + (vmIsCurrent ? 'disabled' : '') + '>' +
            '<span class="esw-key">V</span>' +
            '<span class="esw-switch-label">' +
              '<span class="esw-switch-title">VM</span>' +
              '<span class="esw-switch-sub" data-esw-vm-label>' + vmConfig.sub + '.tracxlogis.com:' + vmConfig.port + '</span>' +
            '</span>' +
            '<span class="esw-led esw-led-violet' + (vmIsCurrent ? ' esw-hide' : '') + '" data-esw-vm-led></span>' +
            '<span class="esw-current-badge' + (vmIsCurrent ? ' esw-show' : '') + '" data-esw-vm-badge>현재</span>' +
          '</button>' +
          '<button class="esw-edit-btn" data-esw-vm-edit aria-label="VM 설정 편집" title="VM 서브도메인/포트 편집">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>' +
          '</button>' +
        '</div>' +
        '<div class="esw-vm-settings" data-esw-vm-settings>' +
          '<label class="esw-field">' +
            '<span>서브도메인</span>' +
            '<input class="esw-input" type="text" data-esw-vm-sub value="' + vmConfig.sub + '" spellcheck="false" autocomplete="off">' +
          '</label>' +
          '<label class="esw-field esw-field-port">' +
            '<span>포트</span>' +
            '<input class="esw-input" type="text" inputmode="numeric" data-esw-vm-port value="' + vmConfig.port + '" spellcheck="false" autocomplete="off">' +
          '</label>' +
        '</div>' +
      '</div>' +
      '<div class="esw-footer">경로 유지: ' + (restPath || '/') + '</div>' +
    '</div>';

  d.body.appendChild(overlay);

  overlay.addEventListener('click', function(e){
    if (e.target === overlay) closeModal();
  });
  overlay.querySelector('[data-esw-close]').addEventListener('click', closeModal);
  var btns = overlay.querySelectorAll('[data-esw-target]');
  for (var i = 0; i < btns.length; i++) {
    btns[i].addEventListener('click', function(){ pick(this.getAttribute('data-esw-target')); });
  }

  var vmLabel = overlay.querySelector('[data-esw-vm-label]');
  var vmSettings = overlay.querySelector('[data-esw-vm-settings]');
  var vmEditBtn = overlay.querySelector('[data-esw-vm-edit]');
  var vmSubInput = overlay.querySelector('[data-esw-vm-sub]');
  var vmPortInput = overlay.querySelector('[data-esw-vm-port]');
  var vmSwitchBtn = overlay.querySelector('[data-esw-target="vm"]');
  var vmLed = overlay.querySelector('[data-esw-vm-led]');
  var vmBadge = overlay.querySelector('[data-esw-vm-badge]');

  function updateVmDisplay() {
    var s = vmConfig.sub || DEFAULT_VM_SUB;
    var p = vmConfig.port || DEFAULT_VM_PORT;
    vmLabel.textContent = s + '.tracxlogis.com:' + p;

    var isCurrent = (host === (s + '.tracxlogis.com')) && (String(loc.port || '') === String(p));
    vmSwitchBtn.disabled = isCurrent;
    vmSwitchBtn.title = isCurrent ? '이미 현재 환경입니다' : '';
    vmLed.classList.toggle('esw-hide', isCurrent);
    vmBadge.classList.toggle('esw-show', isCurrent);
  }

  vmEditBtn.addEventListener('click', function(e){
    e.stopPropagation();
    var isOpen = vmSettings.classList.toggle('esw-open');
    vmEditBtn.classList.toggle('esw-active', isOpen);
    if (isOpen) { vmSubInput.focus(); }
  });

  vmSubInput.addEventListener('input', function(){
    var cleaned = vmSubInput.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (cleaned !== vmSubInput.value) { vmSubInput.value = cleaned; }
    vmConfig.sub = cleaned || DEFAULT_VM_SUB;
    saveVmConfig();
    updateVmDisplay();
  });

  vmPortInput.addEventListener('input', function(){
    var cleaned = vmPortInput.value.replace(/[^0-9]/g, '').slice(0, 5);
    if (cleaned !== vmPortInput.value) { vmPortInput.value = cleaned; }
    vmConfig.port = cleaned || DEFAULT_VM_PORT;
    saveVmConfig();
    updateVmDisplay();
  });

  function onVmInputEnter(e) {
    if (e.key !== 'Enter') { return; }
    e.preventDefault();
    pick('vm');
  }
  vmSubInput.addEventListener('keydown', onVmInputEnter);
  vmPortInput.addEventListener('keydown', onVmInputEnter);

  d.addEventListener('keydown', onKeydown, true);
})();
