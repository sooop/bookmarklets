/*
 * MULTILANG FILL — 다국어 관리 화면의 언어별 입력칸 일괄 입력/저장
 *
 * 대상: admin / staging-admin .tracxlogis.com 의 Multilang/ 아래 두 화면 (경로로 동작 분기)
 *  - ResourceManagement.aspx : 저장 = regTextResource(idx, work_no) 언어별 순차 호출
 *  - TranslateMng.aspx       : 저장 = Save All과 동일하게 변경된 언어만 btnSave_onClick(lang, true, false) 후 목록 갱신
 * 사용: 그리드에서 리소스를 선택(res_no / no 채워짐) → 북마클릿 실행 → 번역 데이터 붙여넣기
 *       → [입력만] 또는 [입력 후 저장]
 *
 * 입력 형식 (자동 판별)
 *  1) JSON   {"en":"..","ja":"..","ko":"..","zh-cn":"..","zh-hk":".."}  또는  [{"lang":"en","text":".."}, ...]
 *  2) TSV/CSV 헤더행(언어코드) + 값행:      en<TAB>ja<TAB>ko<TAB>zh-cn<TAB>zh-hk
 *  3) TSV/CSV 2열(언어코드, 값) 여러 행:     en<TAB>Hello
 *  4) 헤더 없는 한 행: 영어, 일본어, 한국어, 중문간체, 중문번체 순서
 *
 * 채우기 규칙: 붙여넣은 값이 있는 언어 → 그 값, 없는 언어 → 영어, 영어도 없으면 한국어.
 * 기존 값은 항상 덮어씁니다. 저장은 페이지의 regTextResource를 순차 호출하며 alert을 가로채 토스트로 대체합니다.
 */
(function multilangFillBookmarklet(){
  var d = document;
  var ID = 'mlr-root-3c7d';
  var old = d.getElementById(ID);
  if (old) { old.remove(); }
  var oldToast = d.getElementById('mlr-toast-3c7d');
  if (oldToast) { oldToast.remove(); }

  function showToast(message) {
    var prev = d.getElementById('mlr-toast-3c7d');
    if (prev) { clearTimeout(prev.__mlrTimer); prev.remove(); }
    var t = d.createElement('div');
    t.id = 'mlr-toast-3c7d';
    t.style.cssText = 'all:initial;position:fixed;left:50%;bottom:32px;transform:translateX(-50%);' +
      'z-index:2147483001;max-width:420px;text-align:center;background:#14171F;border:1px solid #262B38;' +
      'color:#E4E7EE;padding:10px 16px;border-radius:9px;box-shadow:0 12px 30px rgba(0,0,0,.45);' +
      'font:12.5px/1.5 "JetBrains Mono","SF Mono",Consolas,"Courier New",monospace;white-space:pre-line;';
    t.textContent = message;
    d.body.appendChild(t);
    t.__mlrTimer = setTimeout(function(){ t.remove(); }, 3200);
  }

  // ── 도메인 가드 ──
  var ROUTE = /ResourceManagement\.aspx/i.test(location.pathname) ? 'rm' :
              (/TranslateMng\.aspx/i.test(location.pathname) ? 'tm' : null);
  if (!/(^|\.)tracxlogis\.com$/.test(location.hostname) || !ROUTE) {
    showToast('다국어 리소스 관리(ResourceManagement.aspx) 또는 Task 관리(TranslateMng.aspx) 화면에서만 사용할 수 있습니다.');
    return;
  }

  // ── 언어코드 별칭 / 기본 순서 ──
  var ALIAS = {
    'en': 'en', 'eng': 'en', 'english': 'en',
    'ja': 'ja', 'jp': 'ja', 'jpn': 'ja', 'japanese': 'ja',
    'ko': 'ko', 'kr': 'ko', 'kor': 'ko', 'korean': 'ko',
    'zh-cn': 'zh-cn', 'zh_cn': 'zh-cn', 'zhcn': 'zh-cn', 'cn': 'zh-cn', 'zh-hans': 'zh-cn', 'zh': 'zh-cn',
    'zh-hk': 'zh-hk', 'zh_hk': 'zh-hk', 'zhhk': 'zh-hk', 'hk': 'zh-hk', 'zh-tw': 'zh-hk', 'zh_tw': 'zh-hk',
    'tw': 'zh-hk', 'zh-hant': 'zh-hk',
    'id': 'id', 'th': 'th', 'ru': 'ru', 'vi': 'vi', 'es': 'es', 'de': 'de'
  };
  var DEFAULT_ORDER = ['en', 'ja', 'ko', 'zh-cn', 'zh-hk'];

  function normLang(s) {
    return ALIAS[String(s == null ? '' : s).replace(/^\s+|\s+$/g, '').toLowerCase()] || null;
  }

  // ── 파서 ──
  function parseDelimited(text, delim) {
    var rows = [], row = [], cell = '', inQ = false, i = 0, c;
    while (i < text.length) {
      c = text.charAt(i);
      if (inQ) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') { cell += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        cell += c; i++; continue;
      }
      if (c === '"' && cell === '') { inQ = true; i++; continue; }
      if (c === delim) { row.push(cell); cell = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; continue; }
      cell += c; i++;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function(r){ return r.some(function(x){ return x !== ''; }); });
  }

  function isHeader(row) {
    return row.length > 0 && row.every(function(x){ return normLang(x) !== null; });
  }

  // 반환: { map: {lang: text}, warn: [..] } 또는 { error: '..' }
  function parseInput(raw) {
    var text = raw.replace(/^﻿/, '');
    if (!/\S/.test(text)) { return { error: '붙여넣은 내용이 없습니다.' }; }
    var map = {}, warn = [], k, i;

    function put(lang, val) {
      var l = normLang(lang);
      if (!l) { warn.push('알 수 없는 언어코드 무시: ' + lang); return; }
      map[l] = String(val == null ? '' : val);
    }

    var trimmed = text.replace(/^\s+/, '');
    if (trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[') {
      var json;
      try { json = JSON.parse(trimmed); } catch (e) { return { error: 'JSON 파싱 실패: ' + e.message }; }
      if (Object.prototype.toString.call(json) === '[object Array]') {
        for (i = 0; i < json.length; i++) {
          var it = json[i] || {};
          put(it.lang || it.lang_cd || it.code, it.text != null ? it.text : it.res_text);
        }
      } else {
        for (k in json) { if (Object.prototype.hasOwnProperty.call(json, k)) { put(k, json[k]); } }
      }
    } else {
      var firstLine = text.split('\n')[0];
      var delim = firstLine.indexOf('\t') >= 0 ? '\t' : ',';
      var rows = parseDelimited(text, delim);
      if (!rows.length) { return { error: '파싱할 행이 없습니다.' }; }
      if (isHeader(rows[0]) && rows.length >= 2) {
        for (i = 0; i < rows[0].length; i++) { put(rows[0][i], rows[1][i]); }
      } else if (rows[0].length === 2 && normLang(rows[0][0]) !== null) {
        for (i = 0; i < rows.length; i++) { put(rows[i][0], rows[i][1]); }
      } else {
        for (i = 0; i < rows[0].length && i < DEFAULT_ORDER.length; i++) { put(DEFAULT_ORDER[i], rows[0][i]); }
        if (rows[0].length > DEFAULT_ORDER.length) { warn.push('기본 순서(5개)를 넘는 열은 무시했습니다.'); }
      }
    }

    var any = false;
    for (k in map) { if (map[k] !== '') { any = true; } }
    if (!any) { return { error: '값이 있는 언어가 없습니다.' }; }
    return { map: map, warn: warn };
  }

  // ── 페이지 언어칸 조회 / 채우기 계획 ──
  function pageFields() {
    var out = [];
    var tas = d.querySelectorAll('textarea[transinput]');
    for (var i = 0; i < tas.length; i++) {
      var ta = tas[i];
      if (ta.id.indexOf('res_text_') === 0) {
        out.push({ idx: ta.getAttribute('idx') || ta.getAttribute('lang_cd'), lang: ta.getAttribute('lang_cd'), el: ta });
      }
    }
    return out;
  }

  function buildPlan(map) {
    var fields = pageFields();
    var fallback = (map.en != null && map.en !== '') ? 'en' : ((map.ko != null && map.ko !== '') ? 'ko' : null);
    var plan = fields.map(function(f) {
      var lang = normLang(f.lang) || f.lang;
      var own = map[lang];
      var item = { idx: f.idx, lang: f.lang, el: f.el, text: null, src: 'skip' };
      if (own != null && own !== '') { item.text = own; item.src = 'own'; }
      else if (fallback) { item.text = map[fallback]; item.src = fallback; }
      return item;
    });
    var extra = [];
    Object.keys(map).forEach(function(l) {
      var found = fields.some(function(f){ return (normLang(f.lang) || f.lang) === l; });
      if (!found) { extra.push(l); }
    });
    return { items: plan, extra: extra, fallback: fallback };
  }

  function resNo() {
    var el = d.getElementById(ROUTE === 'tm' ? 'no' : 'res_no');
    return el ? el.value : '';
  }

  // ── UI ──
  var css =
    '#' + ID + '{all:initial;position:fixed;top:60px;right:24px;z-index:2147483000;width:560px;max-width:calc(100vw - 48px);' +
    'background:#1B1F2A;border:1px solid #262B38;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,.55);' +
    'color:#E4E7EE;font:12.5px/1.5 "JetBrains Mono","SF Mono",Consolas,"Courier New",monospace;}' +
    '#' + ID + ' *{box-sizing:border-box;font-family:inherit;}' +
    '#' + ID + ' .hd{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#14171F;' +
    'border-bottom:1px solid #262B38;border-radius:12px 12px 0 0;cursor:move;user-select:none;}' +
    '#' + ID + ' .hd b{font-size:13px;letter-spacing:.04em;color:#A78BFA;}' +
    '#' + ID + ' .x{cursor:pointer;color:#8B93A7;padding:0 4px;font-size:16px;}' +
    '#' + ID + ' .bd{padding:12px 14px;}' +
    '#' + ID + ' .res{color:#8B93A7;margin-bottom:8px;}#' + ID + ' .res em{color:#FBBF24;font-style:normal;}' +
    '#' + ID + ' textarea{width:100%;height:96px;background:#0B0D12;color:#E4E7EE;border:1px solid #262B38;border-radius:8px;' +
    'padding:8px;font-size:12px;resize:vertical;outline:none;}#' + ID + ' textarea:focus{border-color:#A78BFA;}' +
    '#' + ID + ' .msg{margin:8px 0;min-height:18px;color:#8B93A7;}#' + ID + ' .msg.err{color:#FBBF24;}' +
    '#' + ID + ' table{width:100%;border-collapse:collapse;margin-bottom:10px;}' +
    '#' + ID + ' td,#' + ID + ' th{padding:4px 6px;border-bottom:1px solid #262B38;text-align:left;vertical-align:top;font-weight:normal;}' +
    '#' + ID + ' th{color:#8B93A7;}' +
    '#' + ID + ' td.l{color:#A78BFA;white-space:nowrap;width:58px;}' +
    '#' + ID + ' td.s{white-space:nowrap;width:78px;color:#8B93A7;}' +
    '#' + ID + ' td.s.own{color:#34D399;}#' + ID + ' td.s.fb{color:#FBBF24;}' +
    '#' + ID + ' td.v{word-break:break-all;max-width:260px;}' +
    '#' + ID + ' td.r{white-space:nowrap;width:44px;text-align:right;}' +
    '#' + ID + ' .ok{color:#34D399;}#' + ID + ' .ng{color:#FBBF24;}' +
    '#' + ID + ' .btns{display:flex;gap:8px;justify-content:flex-end;}' +
    '#' + ID + ' button{background:#14171F;color:#E4E7EE;border:1px solid #262B38;border-radius:8px;padding:7px 14px;font-size:12px;cursor:pointer;}' +
    '#' + ID + ' button:hover:not(:disabled){border-color:#A78BFA;}' +
    '#' + ID + ' button.pri{background:#34D399;color:#0B0D12;border-color:#34D399;font-weight:bold;}' +
    '#' + ID + ' button:disabled{opacity:.4;cursor:default;}';

  var style = d.createElement('style');
  style.textContent = css;

  var root = d.createElement('div');
  root.id = ID;
  root.innerHTML =
    '<div class="hd"><b>MULTILANG FILL</b><span class="x" title="닫기">✕</span></div>' +
    '<div class="bd">' +
      '<div class="res"></div>' +
      '<textarea placeholder="번역 데이터를 붙여넣으세요 (JSON / TSV / CSV)" spellcheck="false"></textarea>' +
      '<div class="msg"></div>' +
      '<div class="pv"></div>' +
      '<div class="btns"><button class="fill" disabled>입력만</button><button class="save pri" disabled>입력 후 저장</button></div>' +
    '</div>';
  root.insertBefore(style, root.firstChild);
  d.body.appendChild(root);

  var $ = function(sel){ return root.querySelector(sel); };
  var elInput = $('textarea'), elMsg = $('.msg'), elPv = $('.pv'), elRes = $('.res');
  var btnFill = $('.fill'), btnSave = $('.save');
  var busy = false;
  var current = null; // 마지막 파싱 결과

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function clip(s) {
    s = String(s).replace(/\r?\n/g, ' ⏎ ');
    return s.length > 60 ? s.slice(0, 60) + '…' : s;
  }
  function setMsg(text, isErr) {
    elMsg.textContent = text || '';
    elMsg.className = 'msg' + (isErr ? ' err' : '');
  }
  function renderRes() {
    var no = resNo();
    var idEl = d.getElementById(ROUTE === 'tm' ? 'res_res_id' : 'res_id');
    elRes.innerHTML = no
      ? '대상 리소스: <em>#' + esc(no) + '</em> ' + esc(idEl ? idEl.value : '')
      : '<em>리소스가 선택되지 않았습니다.</em> 그리드에서 리소스를 선택하세요.';
  }

  function render() {
    renderRes();
    var raw = elInput.value;
    current = null;
    elPv.innerHTML = '';
    btnFill.disabled = btnSave.disabled = true;
    if (!/\S/.test(raw)) { setMsg(''); return; }
    var parsed = parseInput(raw);
    if (parsed.error) { setMsg(parsed.error, true); return; }
    var plan = buildPlan(parsed.map);
    if (!plan.items.length) { setMsg('페이지에서 언어 입력칸을 찾지 못했습니다. 리소스를 선택했는지 확인하세요.', true); return; }
    if (!plan.fallback) {
      var missing = plan.items.some(function(it){ return it.src === 'skip'; });
      if (missing) { parsed.warn.push('영어/한국어 값이 없어 일부 언어는 채울 수 없습니다.'); }
    }
    var html = '<table><tr><th>언어</th><th>출처</th><th>값</th><th></th></tr>';
    plan.items.forEach(function(it) {
      var srcLabel = it.src === 'own' ? '입력값' : (it.src === 'skip' ? '건너뜀' : '→ ' + it.src + ' 대체');
      var srcCls = it.src === 'own' ? 'own' : (it.src === 'skip' ? '' : 'fb');
      html += '<tr data-idx="' + esc(it.idx) + '"><td class="l">' + esc(it.lang) + '</td><td class="s ' + srcCls + '">' + srcLabel +
        '</td><td class="v">' + (it.text == null ? '' : esc(clip(it.text))) + '</td><td class="r"></td></tr>';
    });
    html += '</table>';
    elPv.innerHTML = html;
    var notes = parsed.warn.slice();
    if (plan.extra.length) { notes.push('페이지에 없는 언어 무시: ' + plan.extra.join(', ')); }
    setMsg(notes.join(' / '), notes.length > 0);
    current = parsed;
    btnFill.disabled = btnSave.disabled = false;
  }

  elInput.addEventListener('input', render);

  // 값 입력 (페이지 textarea에 기록)
  function applyValues() {
    var plan = buildPlan(current.map);
    var n = 0;
    plan.items.forEach(function(it) {
      if (it.text == null) { return; }
      it.el.value = it.text;
      n++;
    });
    return { plan: plan, count: n };
  }

  btnFill.addEventListener('click', function() {
    if (!current || busy) { return; }
    var r = applyValues();
    showToast(r.count + '개 언어 칸에 입력했습니다. (저장 전)');
  });

  // 저장: 페이지의 regTextResource 순차 호출. alert 가로채기.
  btnSave.addEventListener('click', function() {
    if (!current || busy) { return; }
    if (!resNo()) { showToast('리소스를 먼저 선택하세요.'); renderRes(); return; }
    var saveFn = ROUTE === 'tm' ? 'btnSave_onClick' : 'regTextResource';
    if (typeof window[saveFn] !== 'function') {
      showToast('페이지의 ' + saveFn + ' 함수를 찾지 못했습니다.');
      return;
    }
    busy = true;
    btnFill.disabled = btnSave.disabled = true;
    var r = applyValues();
    var workEl = d.getElementById('sc_work_no');
    var workNo = workEl ? workEl.value : '';
    var items = r.plan.items.filter(function(it){ return it.text != null; });

    var origAlert = window.alert, captured = [];
    window.alert = function(m) { captured.push(String(m)); };

    var done = 0, skipped = 0, failed = null, i = 0;
    function cell(idx) { return elPv.querySelector('tr[data-idx="' + idx + '"] td.r'); }
    function step() {
      if (i >= items.length) { finish(); return; }
      var it = items[i++];
      var c = cell(it.idx);
      if (c) { c.textContent = '…'; }
      captured.length = 0;
      var res, err = null;
      try {
        if (ROUTE === 'tm') {
          var orgEl = d.getElementById('res_text_org_' + it.lang);
          if (orgEl && orgEl.value === it.el.value) {
            if (c) { c.innerHTML = '<span class="ok">=</span>'; }
            skipped++;
            setTimeout(step, 0);
            return;
          }
          window.btnSave_onClick(it.lang, true, false);
        } else {
          res = window.regTextResource(it.idx, workNo);
        }
      } catch (e) { err = e.message || String(e); }
      if (!err && res && res.ExceptionType != undefined) {
        err = res.ExceptionMessage || res.Message || res.ExceptionType;
      }
      if (!err && res && res.ResultCode !== undefined && Number(res.ResultCode) !== 0) {
        err = res.ResultMsg || ('ResultCode ' + res.ResultCode);
      }
      if (!err && captured.length) { err = captured.join(' / '); }
      if (err) {
        if (c) { c.innerHTML = '<span class="ng">✗</span>'; }
        failed = it.lang + ': ' + err;
        finish();
        return;
      }
      if (c) { c.innerHTML = '<span class="ok">✓</span>'; }
      done++;
      setTimeout(step, 30);
    }
    function finish() {
      if (ROUTE === 'tm' && !failed) {
        try {
          if (typeof window.displayTransText === 'function') { window.displayTransText(d.getElementById('no').value); }
          if (typeof window.loadWorkResource === 'function') { window.loadWorkResource(d.getElementById('work_no').value); }
        } catch (e) { failed = '목록 갱신 실패: ' + (e.message || e); }
      }
      window.alert = origAlert;
      busy = false;
      btnFill.disabled = btnSave.disabled = false;
      if (failed) {
        setMsg('저장 중단 — ' + failed + ' (' + done + '/' + items.length + ' 완료)', true);
        showToast('저장 실패: ' + failed);
      } else {
        var doneMsg = done + '개 언어 저장 완료' + (skipped ? ' (변경 없음 ' + skipped + '개 건너뜀)' : '');
        setMsg(doneMsg, false);
        showToast(doneMsg);
      }
    }
    step();
  });

  $('.x').addEventListener('click', function() { if (!busy) { root.remove(); } });

  // 헤더 드래그 이동
  (function drag() {
    var hd = $('.hd'), sx, sy, ox, oy, on = false;
    hd.addEventListener('mousedown', function(e) {
      if (e.target.className === 'x') { return; }
      var rc = root.getBoundingClientRect();
      on = true; sx = e.clientX; sy = e.clientY; ox = rc.left; oy = rc.top;
      e.preventDefault();
    });
    d.addEventListener('mousemove', function(e) {
      if (!on) { return; }
      root.style.left = (ox + e.clientX - sx) + 'px';
      root.style.top = (oy + e.clientY - sy) + 'px';
      root.style.right = 'auto';
    });
    d.addEventListener('mouseup', function() { on = false; });
  })();

  renderRes();
  elInput.focus();
})();
