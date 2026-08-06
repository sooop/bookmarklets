/*
 * PAGE QR — 현재 페이지 주소를 QR코드로 표시
 *
 * 이 파일은 북마클릿 로더가 <script src="...">로 동적 로드해서 실행하는 실제 로직입니다.
 * GitHub 등 정적 호스팅에 올려두고, 북마클릿(로더)은 이 파일의 URL만 참조합니다.
 * 로더는 매 실행마다 캐시버스팅 쿼리(?t=timestamp)를 붙여 불러오므로,
 * 이 파일을 수정해서 다시 올리기만 하면 북마클릿을 재설치하지 않아도 바로 반영됩니다.
 */
(function qrCodeBookmarklet(){
  var d = document;
  var existing = d.getElementById('qrb-overlay-8e4a');
  if (existing) { existing.remove(); }

  var ACCENT = '#38BDF8';

  function showToast(message) {
    var existingToast = d.getElementById('qrb-toast-8e4a');
    if (existingToast) {
      clearTimeout(existingToast.__qrbTimer);
      existingToast.remove();
    }
    if (!d.getElementById('qrb-toast-style-8e4a')) {
      var toastStyle = d.createElement('style');
      toastStyle.id = 'qrb-toast-style-8e4a';
      toastStyle.textContent =
        '#qrb-toast-8e4a{position:fixed;left:50%;bottom:32px;z-index:2147483647;' +
        'transform:translate(-50%,8px);opacity:0;max-width:320px;text-align:center;' +
        'background:#14171F;border:1px solid #262B38;color:#E4E7EE;padding:10px 16px;' +
        'border-radius:9px;box-shadow:0 12px 30px rgba(0,0,0,0.45);' +
        'font-family:"JetBrains Mono","SF Mono",Consolas,"Courier New",monospace;' +
        'font-size:12.5px;line-height:1.5;white-space:pre-line;' +
        'transition:opacity .18s ease,transform .18s ease;}' +
        '#qrb-toast-8e4a.qrb-toast-show{opacity:1;transform:translate(-50%,0);}';
      d.head.appendChild(toastStyle);
    }
    var toast = d.createElement('div');
    toast.id = 'qrb-toast-8e4a';
    toast.textContent = message;
    d.body.appendChild(toast);
    requestAnimationFrame(function(){ toast.classList.add('qrb-toast-show'); });
    toast.__qrbTimer = setTimeout(function(){
      toast.classList.remove('qrb-toast-show');
      setTimeout(function(){ toast.remove(); }, 200);
    }, 2200);
  }

  function copyText(text, onDone) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onDone).catch(function(){ fallbackCopy(text, onDone); });
    } else {
      fallbackCopy(text, onDone);
    }
  }

  function fallbackCopy(text, onDone) {
    var ta = d.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    d.body.appendChild(ta);
    ta.focus(); ta.select();
    try { d.execCommand('copy'); onDone(); } catch (e) {}
    d.body.removeChild(ta);
  }

  if (!d.getElementById('qrb-style-8e4a')) {
    var style = d.createElement('style');
    style.id = 'qrb-style-8e4a';
    style.textContent =
      '#qrb-overlay-8e4a{position:fixed;inset:0;z-index:2147483647;background:rgba(6,7,10,0.65);' +
      'backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;' +
      'font-family:"JetBrains Mono","SF Mono",Consolas,"Courier New",monospace;}' +
      '#qrb-overlay-8e4a *{box-sizing:border-box;}' +
      '#qrb-overlay-8e4a .qrb-panel{width:300px;background:#14171F;border:1px solid #262B38;' +
      'border-radius:14px;box-shadow:0 24px 64px rgba(0,0,0,0.55);color:#E4E7EE;' +
      'animation:qrb-in .18s cubic-bezier(.2,.8,.2,1);overflow:hidden;}' +
      '@keyframes qrb-in{from{opacity:0;transform:scale(.96) translateY(6px);}to{opacity:1;transform:none;}}' +
      '#qrb-overlay-8e4a .qrb-header{padding:16px 16px 12px 16px;border-bottom:1px solid #262B38;}' +
      '#qrb-overlay-8e4a .qrb-header-top{display:flex;align-items:center;gap:8px;margin-bottom:10px;}' +
      '#qrb-overlay-8e4a .qrb-dot{width:8px;height:8px;border-radius:50%;background:' + ACCENT + ';' +
      'box-shadow:0 0 8px ' + ACCENT + ';flex-shrink:0;}' +
      '#qrb-overlay-8e4a .qrb-kicker{font-size:10px;letter-spacing:.14em;color:#8B93A7;flex:1;}' +
      '#qrb-overlay-8e4a .qrb-close{background:none;border:none;color:#8B93A7;font-size:16px;' +
      'cursor:pointer;line-height:1;padding:2px 4px;}' +
      '#qrb-overlay-8e4a .qrb-close:hover{color:#E4E7EE;}' +
      '#qrb-overlay-8e4a .qrb-host{font-size:13.5px;font-weight:700;word-break:break-all;}' +
      '#qrb-overlay-8e4a .qrb-body{padding:20px 16px 16px 16px;display:flex;justify-content:center;}' +
      '#qrb-overlay-8e4a .qrb-qr-card{position:relative;width:212px;height:212px;background:#fff;' +
      'border-radius:12px;padding:16px;display:flex;align-items:center;justify-content:center;' +
      'box-shadow:0 0 0 1px rgba(56,189,248,0.25),0 16px 40px rgba(0,0,0,0.35);overflow:hidden;}' +
      '#qrb-overlay-8e4a .qrb-qr-card::after{content:"";position:absolute;left:0;right:0;height:38%;' +
      'background:linear-gradient(to bottom,rgba(56,189,248,0) 0%,rgba(56,189,248,0.16) 50%,' +
      'rgba(56,189,248,0) 100%);animation:qrb-scan 2.6s ease-in-out infinite;pointer-events:none;}' +
      '@keyframes qrb-scan{0%{top:-40%;}55%{top:100%;}100%{top:100%;}}' +
      '#qrb-overlay-8e4a .qrb-qr-card img{width:180px;height:180px;display:block;position:relative;z-index:1;}' +
      '#qrb-overlay-8e4a .qrb-footer{display:flex;align-items:center;gap:8px;padding:12px 16px;' +
      'border-top:1px solid #262B38;background:#10131A;}' +
      '#qrb-overlay-8e4a .qrb-url{flex:1;min-width:0;font-size:11px;color:#8B93A7;' +
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      '#qrb-overlay-8e4a .qrb-copy{flex-shrink:0;background:#1B1F2A;border:1px solid #262B38;' +
      'border-radius:7px;color:#E4E7EE;font-family:inherit;font-size:11px;padding:6px 11px;' +
      'cursor:pointer;transition:border-color .12s ease,color .12s ease;}' +
      '#qrb-overlay-8e4a .qrb-copy:hover{border-color:' + ACCENT + ';color:' + ACCENT + ';}';
    d.head.appendChild(style);
  }

  var url = location.href;
  var encodedUrl = encodeURIComponent(url);

  // URL이 길수록(=데이터가 많을수록) QR 모듈 수가 늘어 패턴이 빽빽해지므로,
  // 길이에 맞춰 QR/카드/패널 크기를 단계적으로 키워 가독성과 스캔 성공률을 유지한다.
  var CARD_PAD = 16;
  var qrPx = 180;
  if (url.length > 320) { qrPx = 300; }
  else if (url.length > 200) { qrPx = 270; }
  else if (url.length > 120) { qrPx = 240; }
  else if (url.length > 60) { qrPx = 210; }
  var cardPx = qrPx + CARD_PAD * 2;
  var panelPx = Math.max(300, cardPx + 88);
  var requestPx = qrPx * 2;
  var qrSrc = 'https://api.qrserver.com/v1/create-qr-code/?size=' + requestPx + 'x' + requestPx + '&data=' + encodedUrl;

  var overlay = d.createElement('div');
  overlay.id = 'qrb-overlay-8e4a';
  overlay.innerHTML =
    '<div class="qrb-panel" role="dialog" aria-label="페이지 QR코드" style="width:' + panelPx + 'px">' +
      '<div class="qrb-header">' +
        '<div class="qrb-header-top">' +
          '<span class="qrb-dot"></span>' +
          '<span class="qrb-kicker">PAGE QR</span>' +
          '<button class="qrb-close" data-qrb-close aria-label="닫기">&times;</button>' +
        '</div>' +
        '<div class="qrb-host">' + location.hostname + '</div>' +
      '</div>' +
      '<div class="qrb-body">' +
        '<div class="qrb-qr-card" style="width:' + cardPx + 'px;height:' + cardPx + 'px">' +
          '<img src="' + qrSrc + '" width="' + qrPx + '" height="' + qrPx + '" ' +
            'style="width:' + qrPx + 'px;height:' + qrPx + 'px" alt="QR code">' +
        '</div>' +
      '</div>' +
      '<div class="qrb-footer">' +
        '<span class="qrb-url" title="' + url + '">' + url + '</span>' +
        '<button class="qrb-copy" data-qrb-copy>복사</button>' +
      '</div>' +
    '</div>';

  function closeOverlay() {
    var el = d.getElementById('qrb-overlay-8e4a');
    if (el) { el.remove(); }
    d.removeEventListener('keydown', onKeydown, true);
  }

  function onKeydown(e) {
    if (e.key === 'Escape') { closeOverlay(); }
  }

  overlay.addEventListener('click', function(e){
    if (e.target === overlay) { closeOverlay(); }
  });
  d.addEventListener('keydown', onKeydown, true);
  d.body.appendChild(overlay);

  overlay.querySelector('[data-qrb-close]').addEventListener('click', closeOverlay);
  var copyBtn = overlay.querySelector('[data-qrb-copy]');
  copyBtn.addEventListener('click', function(){
    copyText(url, function(){
      var original = copyBtn.textContent;
      copyBtn.textContent = '복사됨';
      setTimeout(function(){ copyBtn.textContent = original; }, 1200);
      showToast('링크를 복사했습니다.');
    });
  });
})();
