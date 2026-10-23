/*
 * table-converter.js — 표 ↔ 목록 변환기 (북마클릿)
 * CSV · TSV · HTML 표 · GFM 표 · ASCII 선 표  <->  JSON · 마크다운 목록
 * 규칙 기반 변환(AI 미사용). 페이지의 HTML <table> 을 직접 골라 가져올 수 있다.
 * 도메인 제한 없음. 같은 페이지에서 여러 번 실행되어도 안전하다.
 */
(function () {
  'use strict';
  var d = document;
  var HOST_ID = 'tcv-host-7c1d';
  var PICK_ID = 'tcv-pick-7c1d';

  // 재실행: 이전 인스턴스 정리
  if (window.__tcvCleanup) { try { window.__tcvCleanup(); } catch (e0) { /* 무시 */ } }
  var prevHost = d.getElementById(HOST_ID); if (prevHost) { prevHost.remove(); }
  var prevPick = d.getElementById(PICK_ID); if (prevPick) { prevPick.remove(); }

  /* ===== 공통 유틸 ===== */
  var NUM_RE = /^-?(0|[1-9]\d*)(\.\d+)?$/;
  function isNum(s) { return NUM_RE.test(String(s).trim()); }
  function nz(v) { return v === undefined || v === null ? '' : v; }
  function assign(t) {
    for (var i = 1; i < arguments.length; i++) {
      var s = arguments[i]; for (var k in s) { if (Object.prototype.hasOwnProperty.call(s, k)) t[k] = s[k]; }
    }
    return t;
  }
  function flat(arr, fn) { var out = []; arr.forEach(function (x, i) { out = out.concat(fn(x, i)); }); return out; }
  function first(arr, fn) { for (var i = 0; i < arr.length; i++) { if (fn(arr[i])) return arr[i]; } return undefined; }
  function maxOf(arr, min) { var m = min; arr.forEach(function (x) { if (x > m) m = x; }); return m; }
  function has(s, sub) { return s.indexOf(sub) !== -1; }

  function cpWidth(cp) {
    if (cp >= 0x300 && cp <= 0x36f) return 0;
    if ((cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3) ||
        (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe30 && cp <= 0xfe6f) || (cp >= 0xff00 && cp <= 0xff60) ||
        (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x1f300 && cp <= 0x1f64f) || (cp >= 0x1f900 && cp <= 0x1f9ff) ||
        (cp >= 0x20000 && cp <= 0x3fffd)) return 2;
    return 1;
  }
  function strW(s) {
    s = String(s); var w = 0;
    for (var i = 0; i < s.length; i++) {
      var cp = s.charCodeAt(i);
      if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < s.length) {
        var lo = s.charCodeAt(i + 1);
        if (lo >= 0xdc00 && lo <= 0xdfff) { cp = (cp - 0xd800) * 0x400 + (lo - 0xdc00) + 0x10000; i++; }
      }
      w += cpWidth(cp);
    }
    return w;
  }
  function padTo(s, w, right) {
    var gap = Math.max(0, w - strW(s)), sp = new Array(gap + 1).join(' ');
    return right ? sp + s : s + sp;
  }
  function normalize(grid) {
    var n = 0; grid.forEach(function (r) { if (r.length > n) n = r.length; });
    return grid.map(function (r) { var c = r.slice(); while (c.length < n) c.push(''); return c; });
  }

  /* ===== 표 입력 파서 ===== */
  function parseDelimited(text, delim) {
    var rows = [], row = [], cur = '', q = false, i = 0;
    var s = text.replace(/\r\n?/g, '\n');
    while (i < s.length) {
      var ch = s[i];
      if (q) {
        if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i += 2; continue; } q = false; i++; continue; }
        cur += ch; i++; continue;
      }
      if (ch === '"' && cur === '') { q = true; i++; continue; }
      if (ch === delim) { row.push(cur); cur = ''; i++; continue; }
      if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; i++; continue; }
      cur += ch; i++;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    while (rows.length && rows[rows.length - 1].every(function (c) { return c === ''; })) rows.pop();
    return rows;
  }
  function detectDelim(text) {
    if (has(text, '\t')) return '\t';
    var best = ',', bestScore = -1, cands = [',', ';', '|'];
    for (var ci = 0; ci < cands.length; ci++) {
      var dl = cands[ci];
      var rows = parseDelimited(text.split('\n').slice(0, 30).join('\n'), dl);
      if (!rows.length) continue;
      var counts = {};
      rows.forEach(function (r) { counts[r.length] = (counts[r.length] || 0) + 1; });
      var bn = 0, bk = -1;
      for (var key in counts) { if (counts[key] > bk) { bk = counts[key]; bn = Number(key); } }
      var score = bn > 1 ? bk / rows.length * 100 + bn : 0;
      if (score > bestScore) { bestScore = score; best = dl; }
    }
    return best;
  }

  var BORDER_CH = /^[┌┬┐├┼┤└┴┘─━═╔╦╗╠╬╣╚╩╝╭╮╯╰╞╪╡╤╧╟╫╢╥╨┏┳┓┣╋┫┗┻┛┠┯┷┨┿╂\-+=\s]+$/;
  function isBorder(l) { return l.trim().length > 1 && BORDER_CH.test(l) && /[─━═\-]/.test(l); }
  function splitBars(line) {
    var t = line.trim().split(/[│┃║|]/);
    if (t.length && t[0].trim() === '') t.shift();
    if (t.length && t[t.length - 1].trim() === '') t.pop();
    return t.map(function (c) { return c.trim(); });
  }
  function parseAscii(text) {
    var lines = text.replace(/\r\n?/g, '\n').split('\n').filter(function (l) { return l.trim() !== ''; });
    var blocks = [[]];
    lines.forEach(function (l, idx) {
      if (isBorder(l)) { if (blocks[blocks.length - 1].length && idx !== lines.length - 1) blocks.push([]); }
      else blocks[blocks.length - 1].push(splitBars(l));
    });
    var bl = blocks.filter(function (b) { return b.length; });
    function merge(b) {
      var n = maxOf(b.map(function (r) { return r.length; }), 0), out = [];
      for (var c = 0; c < n; c++) out.push(b.map(function (r) { return r[c] || ''; }).filter(function (x) { return x !== ''; }).join('\n'));
      return out;
    }
    if (bl.length === 1) return bl[0];
    if (bl.length === 2 && bl[1].length > 1) return [merge(bl[0])].concat(bl[1]);
    return bl.map(merge);
  }

  function splitPipes(line) {
    var out = [], cur = '';
    for (var i = 0; i < line.length; i++) {
      if (line[i] === '\\' && line[i + 1] === '|') { cur += '|'; i++; }
      else if (line[i] === '|') { out.push(cur); cur = ''; }
      else cur += line[i];
    }
    out.push(cur);
    if (out.length && out[0].trim() === '') out.shift();
    if (out.length && out[out.length - 1].trim() === '') out.pop();
    return out.map(function (c) { return c.trim().replace(/<br\s*\/?>/gi, '\n'); });
  }
  var GFM_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
  function parseGfm(text) {
    var lines = text.replace(/\r\n?/g, '\n').split('\n').filter(function (l) { return l.trim() !== ''; });
    return lines.filter(function (l) { return !(GFM_SEP.test(l) && has(l, '-')); }).map(splitPipes);
  }

  // tbEl: 분리된(복제) <table> 요소. 호출자가 페이지 원본을 건드리지 않도록 복제본을 넘긴다.
  function parseHtmlTable(tbEl) {
    var tb = tbEl;
    Array.prototype.forEach.call(tb.querySelectorAll('script,style'), function (n) { n.remove(); });
    var rows = [], carry = [];
    Array.prototype.forEach.call(tb.querySelectorAll('tr'), function (tr) {
      if (tr.closest('table') !== tb) return;
      var row = [], c = 0;
      function fillCarry() { while (carry[c] && carry[c].n > 0) { row.push(carry[c].t); carry[c].n--; c++; } }
      Array.prototype.forEach.call(tr.children, function (cell) {
        if (!/^(TD|TH)$/.test(cell.tagName)) return;
        fillCarry();
        Array.prototype.forEach.call(cell.querySelectorAll('br'), function (b) { b.parentNode.replaceChild(d.createTextNode('\n'), b); });
        var t = cell.textContent.split('\n').map(function (x) { return x.replace(/[ \t\r\f ]+/g, ' ').trim(); }).join('\n').replace(/^\n+|\n+$/g, '');
        var cs = parseInt(cell.getAttribute('colspan') || '1', 10) || 1;
        var rs = parseInt(cell.getAttribute('rowspan') || '1', 10) || 1;
        for (var k = 0; k < cs; k++) { row.push(k === 0 ? t : ''); if (rs > 1) carry[c] = { n: rs - 1, t: k === 0 ? t : '' }; c++; }
      });
      fillCarry();
      if (row.length) rows.push(row);
    });
    return rows;
  }
  function htmlTextToTable(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var tb = doc.querySelector('table');
    return tb ? parseHtmlTable(tb) : null;
  }

  function detectTableFormat(text, html) {
    var t = text.trim();
    if (html && /<table[\s>]/i.test(html)) return 'HTML';
    if (/<table[\s>]/i.test(t)) return 'HTML';
    var ls = t.split(/\r?\n/);
    if (ls.some(function (l) { return /^\s*[┌├└╔╠╚╭│┃║]/.test(l); }) || ls.some(function (l) { return /^\s*\+[-=+]+\+\s*$/.test(l); })) return 'ASCII';
    if (ls.some(function (l) { return GFM_SEP.test(l) && has(l, '-') && (has(l, '|') || ls.length > 1); }) &&
        ls.some(function (l) { return has(l, '|') && !GFM_SEP.test(l); })) return 'GFM';
    var dl = detectDelim(t);
    return dl === '\t' ? 'TSV' : dl === ';' ? 'CSV(;)' : dl === '|' ? 'PIPE' : 'CSV';
  }
  function parseTableText(text, html) {
    var fmt = detectTableFormat(text, html), grid;
    if (fmt === 'HTML') grid = htmlTextToTable(html && /<table[\s>]/i.test(html) ? html : text);
    else if (fmt === 'ASCII') grid = parseAscii(text);
    else if (fmt === 'GFM') grid = parseGfm(text);
    else grid = parseDelimited(text, fmt === 'TSV' ? '\t' : fmt === 'CSV(;)' ? ';' : fmt === 'PIPE' ? '|' : ',');
    if (!grid || !grid.length) return null;
    return { grid: normalize(grid), fmt: fmt };
  }

  /* ===== 표 출력 직렬화 ===== */
  function csvCell(s) { return /[",\n\r]|^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function tsvCell(s) { return /[\t\n\r"]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function toCsv(m) { return m.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n'); }
  function toTsv(m) { return m.map(function (r) { return r.map(tsvCell).join('\t'); }).join('\r\n'); }
  function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function cellHtml(s) { return escHtml(s).replace(/\n/g, '<br>'); }

  function toHtmlTable(v) {
    var th = v.head.map(function (x) { return '      <th>' + cellHtml(x) + '</th>'; }).join('\n');
    var tr = v.body.map(function (r) {
      return '    <tr>\n' + r.map(function (c) { return '      <td>' + cellHtml(c) + '</td>'; }).join('\n') + '\n    </tr>';
    }).join('\n');
    return '<table>\n  <thead>\n    <tr>\n' + th + '\n    </tr>\n  </thead>\n  <tbody>\n' + tr + '\n  </tbody>\n</table>';
  }
  function toHtmlStyled(v) {
    var base = 'border:1px solid #999;padding:4px 8px;font-family:Arial,\'Malgun Gothic\',sans-serif;font-size:13px;';
    var th = v.head.map(function (x) { return '<th style="' + base + 'background:#f0f0f0;text-align:left;">' + cellHtml(x) + '</th>'; }).join('');
    var tr = v.body.map(function (r) {
      return '<tr>' + r.map(function (c) { return '<td style="' + base + (isNum(c) ? 'text-align:right;' : '') + '">' + cellHtml(c) + '</td>'; }).join('') + '</tr>';
    }).join('');
    return '<table style="border-collapse:collapse;border:1px solid #999;"><thead><tr>' + th + '</tr></thead><tbody>' + tr + '</tbody></table>';
  }

  function toGfm(v) {
    function esc(s) { return String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>'); }
    var H = v.head.map(esc), B = v.body.map(function (r) { return r.map(esc); });
    var numCol = H.map(function (_, c) {
      return B.length > 0 && B.every(function (r) { return r[c] === '' || isNum(r[c]); }) && B.some(function (r) { return r[c] !== ''; });
    });
    var w = H.map(function (x, c) {
      var m = Math.max(3, strW(x)); B.forEach(function (r) { m = Math.max(m, strW(r[c] || '')); }); return m;
    });
    function line(r) { return '| ' + r.map(function (c, i) { return padTo(c, w[i], numCol[i]); }).join(' | ') + ' |'; }
    var sep = '| ' + w.map(function (x, i) { return numCol[i] ? new Array(x).join('-') + ':' : new Array(x + 1).join('-'); }).join(' | ') + ' |';
    return [line(H), sep].concat(B.map(line)).join('\n');
  }

  function toAscii(v) {
    var cells = [v.head].concat(v.body).map(function (r) { return r.map(function (c) { return String(c).split('\n'); }); });
    var n = v.head.length, w = [];
    for (var c = 0; c < n; c++) {
      var m = 1;
      cells.forEach(function (r) { r[c].forEach(function (x) { m = Math.max(m, strW(x)); }); });
      w.push(m);
    }
    var multi = cells.some(function (r) { return r.some(function (x) { return x.length > 1; }); });
    function bar(l, mid, r) { return l + w.map(function (x) { return new Array(x + 3).join('─'); }).join(mid) + r; }
    var out = [bar('┌', '┬', '┐')];
    cells.forEach(function (r, i) {
      var hh = maxOf(r.map(function (x) { return x.length; }), 1);
      for (var k = 0; k < hh; k++) {
        out.push('│ ' + r.map(function (x, j) { return padTo(x[k] || '', w[j], k === 0 && i > 0 && x.length === 1 && isNum(x[0])); }).join(' │ ') + ' │');
      }
      if (i === 0 || (multi && i < cells.length - 1)) out.push(bar('├', '┼', '┤'));
    });
    out.push(bar('└', '┴', '┘'));
    return out.join('\n');
  }

  /* ===== JSON 데이터 <-> 표 ===== */
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function scalarStr(v) { return v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); }
  function one(k, v) { var o = {}; o[k] = v; return [o]; }

  function crossRows(lists) {
    var rows = [{}];
    lists.forEach(function (sub) {
      var nr = [];
      rows.forEach(function (r) { sub.forEach(function (s) { nr.push(assign({}, r, s)); }); });
      rows = nr;
    });
    return rows;
  }
  function flatRows(v, p, mode) {
    if (Array.isArray(v)) {
      if (!v.length) return one(p || 'value', '');
      if (mode === 'rows') return flat(v, function (x) { return flatRows(x, p, mode); });
      return crossRows(v.map(function (x, i) { return flatRows(x, p + '[' + i + ']', mode); }));
    }
    if (isObj(v)) {
      var ks = Object.keys(v);
      if (!ks.length) return one(p || 'value', '');
      return crossRows(ks.map(function (k) { return flatRows(v[k], p ? p + '.' + k : k, mode); }));
    }
    return one(p || 'value', scalarStr(v));
  }
  function valueToGrid(data, mode) {
    if (Array.isArray(data) && data.length && data.every(Array.isArray)) {
      return normalize(data.map(function (r) { return r.map(scalarStr); }));
    }
    if (isObj(data)) {
      var ks = Object.keys(data);
      if (ks.length === 1 && Array.isArray(data[ks[0]])) data = data[ks[0]];
      else if (ks.length > 1 && ks.every(function (k) { return isObj(data[k]); })) data = ks.map(function (k) { return assign({ key: k }, data[k]); });
    }
    var list = Array.isArray(data) ? data : [data];
    var rows = flat(list, function (x) { return flatRows(x, '', mode); });
    var head = [];
    rows.forEach(function (r) { Object.keys(r).forEach(function (k) { if (head.indexOf(k) === -1) head.push(k); }); });
    if (!head.length) return null;
    return [head].concat(rows.map(function (r) { return head.map(function (k) { return k in r ? r[k] : ''; }); }));
  }

  function inferVal(s) {
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (NUM_RE.test(s) && s.length < 16) return Number(s);
    return s;
  }
  function pathTokens(key) {
    if (!/[.[]/.test(key)) return [key];
    var t = [];
    key.split('.').forEach(function (seg) {
      var m = seg.match(/^([^[\]]*)((?:\[\d+\])*)$/);
      if (!m) { t.push(seg); return; }
      if (m[1] !== '') t.push(m[1]);
      (m[2].match(/\d+/g) || []).forEach(function (n) { t.push(Number(n)); });
    });
    return t.length ? t : [key];
  }
  function setPath(obj, toks, val) {
    var cur = obj;
    for (var i = 0; i < toks.length - 1; i++) {
      var t = toks[i], nx = toks[i + 1];
      if (cur[t] === undefined || cur[t] === null || typeof cur[t] !== 'object') cur[t] = typeof nx === 'number' ? [] : {};
      cur = cur[t];
    }
    cur[toks[toks.length - 1]] = val;
  }
  function compactArrays(v) {
    if (Array.isArray(v)) return v.filter(function (x) { return x !== undefined; }).map(compactArrays);
    if (isObj(v)) { Object.keys(v).forEach(function (k) { v[k] = compactArrays(v[k]); }); }
    return v;
  }
  function gridToObjects(head, body, o) {
    var toks = head.map(function (x) { return o.unflat ? pathTokens(x) : [x]; });
    return body.map(function (r) {
      var obj = {};
      head.forEach(function (x, i) {
        setPath(obj, toks[i], o.infer ? inferVal(String(nz(r[i]))) : nz(r[i]));
      });
      return compactArrays(obj);
    });
  }
  function toJsonText(head, body, o) { return JSON.stringify(gridToObjects(head, body, o), null, 2); }
  function jsonTextToGrid(text, o) { return valueToGrid(JSON.parse(text), o.arr); }

  /* ===== 마크다운 목록 <-> 표 ===== */
  var HDR_KEY = /^(헤더|머리글|header|headers|column|columns|컬럼|칼럼|열)\s*[:：]\s*(.+)$/i;
  function fixCell(s) { return String(s).replace(/<br\s*\/?>/gi, '\n').trim(); }

  function pairOf(t) {
    var m = t.match(/^([^:：\n]{1,40}?)\s*：\s*([\s\S]*)$/);
    if (m) return [m[1].trim(), m[2].trim()];
    m = t.match(/^([^:：\n]{1,40}?)\s*:(?:\s+([\s\S]*))?$/);
    if (m && !/^\/\//.test(m[2] || '')) return [m[1].trim(), (m[2] || '').trim()];
    return null;
  }
  function lineCells(t) {
    if (has(t, '|')) { var c = splitPipes(t); return c.length >= 2 ? c : null; }
    if (has(t, '\t')) return t.split('\t').map(function (x) { return x.trim(); });
    return null;
  }
  function splitHdr(t) {
    var c = has(t, '|') ? splitPipes(t) : has(t, '\t') ? t.split('\t') : t.split(/\s*[,;，]\s*/);
    return c.map(function (x) { return x.trim(); }).filter(function (x) { return x !== ''; });
  }

  function mdTree(text) {
    var roots = [], plain = [], stack = [];
    text.replace(/\r\n?/g, '\n').split('\n').forEach(function (raw) {
      if (!raw.trim()) return;
      var m = raw.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
      var ind = raw.match(/^\s*/)[0].replace(/\t/g, '    ').length;
      if (m) {
        var node = { text: m[3].replace(/^\[[ xX]\]\s+/, '').trim(), children: [] };
        var mi = m[1].replace(/\t/g, '    ').length;
        while (stack.length && stack[stack.length - 1].ind >= mi) stack.pop();
        (stack.length ? stack[stack.length - 1].node.children : roots).push(node);
        stack.push({ ind: mi, node: node });
      } else if (ind > 0 && stack.length) {
        stack[stack.length - 1].node.text += '\n' + raw.trim();
      } else {
        plain.push({ text: raw.trim(), after: roots.length > 0 });
      }
    });
    return { roots: roots, plain: plain };
  }
  function allNodes(nodes) { return flat(nodes, function (n) { return [n].concat(allNodes(n.children)); }); }
  function leafPaths(nodes, pre) {
    pre = pre || [];
    return flat(nodes, function (n) {
      return n.children.length ? leafPaths(n.children, pre.concat([n.text])) : [pre.concat([n.text])];
    });
  }
  function collectPairs(children, prefix, out) {
    children.forEach(function (ch) {
      var p = pairOf(ch.text) || [ch.text, ''];
      var path = prefix ? prefix + '.' + p[0] : p[0];
      if (!ch.children.length) { out[path] = p[1]; return; }
      if (ch.children.every(function (g) { return pairOf(g.text); })) { if (p[1]) out[path] = p[1]; collectPairs(ch.children, path, out); }
      else out[path] = [p[1]].concat(leafPaths(ch.children).map(function (x) { return x.join(' > '); })).filter(Boolean).join(', ');
    });
  }
  function recordsToGrid(recs) {
    var head = [];
    recs.forEach(function (r) { Object.keys(r).forEach(function (k) { if (head.indexOf(k) === -1) head.push(k); }); });
    return [head].concat(recs.map(function (r) { return head.map(function (k) { return nz(r[k]); }); }));
  }

  function parseMdList(text, o) {
    var tr = mdTree(text), roots = tr.roots, plain = tr.plain;
    if (!roots.length) return null;
    var hdr = null, kind = '', mode = o.headerMode, i;
    if (mode !== 'none') {
      for (i = 0; i < roots.length && !hdr; i++) {
        var m = roots[i].text.match(HDR_KEY);
        if (m && !roots[i].children.length) { hdr = splitHdr(m[2]); roots.splice(i, 1); }
      }
      for (i = 0; i < plain.length && !hdr; i++) {
        var m2 = plain[i].text.match(HDR_KEY);
        if (m2) hdr = splitHdr(m2[2]);
      }
      if (!hdr && mode === 'auto') {
        var pl = first(plain, function (p) { return !p.after && splitHdr(p.text).length >= 2; }) ||
                 first(plain, function (p) { return p.after && splitHdr(p.text).length >= 2; });
        if (pl && (has(pl.text, '|') || has(pl.text, '\t') || has(pl.text, ','))) hdr = splitHdr(pl.text);
      }
    }
    var rows = null, hdrFromData = false;
    var withKids = roots.filter(function (r) { return r.children.length; });
    function segs(t) { return t.split(/\s*\|\s*|\s*[,;]\s+/).filter(function (x) { return x !== ''; }); }
    if (withKids.length && withKids.every(function (r) { return r.children.every(function (c) { return pairOf(c.text); }); })) {
      kind = 'record';
      rows = recordsToGrid(roots.map(function (r) {
        var o2 = {}, p = pairOf(r.text);
        if (p) o2[p[0]] = p[1]; else o2['항목'] = r.text;
        collectPairs(r.children, '', o2); return o2;
      }));
      hdrFromData = true;
    } else if (!withKids.length && roots.every(function (r) { var s = segs(r.text); return s.length >= 2 && s.every(function (x) { return pairOf(x); }); })) {
      kind = 'record';
      rows = recordsToGrid(roots.map(function (r) {
        var o2 = {}; segs(r.text).forEach(function (x) { var p = pairOf(x); o2[p[0]] = p[1]; }); return o2;
      }));
      hdrFromData = true;
    } else {
      var nodes = allNodes(roots), cr = nodes.filter(function (n) { return lineCells(n.text); });
      if (cr.length && cr.length / nodes.length >= 0.8) {
        kind = 'line'; rows = cr.map(function (n) { return lineCells(n.text); });
      } else if (!withKids.length && roots.every(function (r) { return pairOf(r.text); })) {
        kind = 'kv'; rows = [['키', '값']].concat(roots.map(function (r) { return pairOf(r.text); })); hdrFromData = true;
      } else {
        kind = 'path'; rows = leafPaths(roots);
      }
    }
    rows = rows.map(function (r) { return r.map(fixCell); });
    var cols = 0; rows.forEach(function (r) { if (r.length > cols) cols = r.length; });
    var head = null;
    if (hdrFromData) head = rows.shift();
    else if (hdr) head = hdr;
    else if (mode === 'first') head = rows.shift();
    else if (mode === 'last') head = rows.pop();
    else if (mode === 'auto' && kind === 'line' && rows.length > 1 && !rows[0].some(function (c) { return isNum(c) && c !== ''; })) head = rows.shift();
    if (hdr && hdrFromData && kind !== 'kv') {
      /* 헤더 줄이 있으면 데이터 키 대신 헤더 이름을 사용 */
      head = head.map(function (x, j) { return hdr[j] !== undefined && hdr[j] !== null ? hdr[j] : x; });
    }
    function def(j) { return kind === 'path' && cols > 1 ? (j + 1) + '단계' : kind === 'path' ? '항목' : '열 ' + (j + 1); }
    var n = Math.max(cols, head ? head.length : 0), nh = [];
    for (var j = 0; j < n; j++) nh.push(head && head[j] !== undefined && head[j] !== '' ? fixCell(head[j]) : def(j));
    if (o.headerText) splitHdr(o.headerText).forEach(function (x, k) { if (k < n) nh[k] = x; });
    return { grid: normalize([nh].concat(rows).map(function (r) { return r.slice(0, n); })), kind: kind };
  }

  function toMdList(head, body, o) {
    function cl(s) { return String(s).replace(/\r?\n/g, '<br>'); }
    var out = [];
    if (o.style === 'record') {
      body.forEach(function (r) { head.forEach(function (x, i) { out.push((i ? '  ' : '') + '- ' + x + ': ' + cl(nz(r[i]))); }); });
    } else if (o.style === 'tree') {
      if (o.inclHeader) out.push('- 헤더: ' + head.map(cl).join(' | '));
      var prev = [];
      body.forEach(function (r) {
        var row = r.map(cl), dd = 0;
        while (dd < row.length && dd < prev.length && prev[dd] === row[dd]) dd++;
        if (dd === row.length) dd = row.length - 1;
        for (var i = dd; i < row.length; i++) out.push(new Array(i + 1).join('  ') + '- ' + row[i]);
        prev = row;
      });
    } else {
      var esc = function (s) { return cl(s).replace(/\|/g, '\\|'); };
      if (o.inclHeader) out.push('- ' + head.map(esc).join(' | '));
      body.forEach(function (r) { out.push('- ' + r.map(esc).join(' | ')); });
    }
    return out.join('\n');
  }

  /* ===== UI ===== */
  var MAX_ROWS = 1000;
  var S = { grid: [[]], firstHeader: true, tab: 'json', listIsInput: false, mdKind: '' };
  var KIND = { record: '키: 값 레코드', line: '한 줄 구분', kv: '키-값 쌍', path: '계층 경로' };
  var FONT = '"JetBrains Mono","SF Mono",Consolas,"D2Coding","Malgun Gothic",monospace';
  var CSS =
    ':host{all:initial}' +
    '*{box-sizing:border-box}' +
    '.bd{position:fixed;left:0;top:0;width:100vw;height:100vh;background:rgba(5,7,12,.72);display:flex;align-items:center;justify-content:center;z-index:2147483000;font-family:' + FONT + ';font-size:13px;line-height:1.5;color:#E4E7EE}' +
    '.panel{width:min(1280px,96vw);height:min(88vh,820px);background:#14171F;border:1px solid #262B38;border-radius:12px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.6);outline:none}' +
    '.top{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #262B38;background:#0B0D12;flex-wrap:wrap}' +
    '.top h1{margin:0;font-size:15px;font-weight:600}' +
    '.top .sub{color:#8B93A7;font-size:11.5px}' +
    '.top .sp{flex:1}' +
    '.panes{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;padding:12px}' +
    '@media(max-width:900px){.panes{grid-template-columns:minmax(0,1fr);grid-auto-rows:minmax(420px,1fr);overflow:auto}}' +
    '.pane{background:#1B1F2A;border:1px solid #262B38;border-radius:10px;display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden}' +
    '.ph{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;border-bottom:1px solid #262B38;flex-wrap:wrap}' +
    '.pt{display:flex;align-items:center;gap:8px;min-width:0}' +
    '.pt h2{margin:0;font-size:13px;font-weight:600}' +
    '.kinds{color:#8B93A7;font-size:11px}' +
    '.chip{font-size:11px;padding:1px 8px;border-radius:99px;background:rgba(52,211,153,.14);color:#34D399;white-space:nowrap}' +
    '.seg{display:inline-flex;background:#14171F;border:1px solid #262B38;border-radius:7px;padding:2px;gap:2px}' +
    '.seg button{font:inherit;font-size:12px;border:0;background:transparent;color:#8B93A7;padding:3px 11px;border-radius:5px;cursor:pointer}' +
    '.seg button.on{background:#262B38;color:#E4E7EE}' +
    '.pb{position:relative;flex:1;min-height:0;display:flex;flex-direction:column}' +
    '.pf{display:flex;align-items:center;gap:10px 14px;padding:8px 12px;border-top:1px solid #262B38;background:#14171F;flex-wrap:wrap}' +
    '.pf .meta{color:#8B93A7;font-size:12px}' +
    '.pf .act{margin-left:auto;display:flex;gap:8px;align-items:center}' +
    '.chk{display:inline-flex;align-items:center;gap:6px;font-size:12px;cursor:pointer}' +
    '.chk input{accent-color:#34D399;margin:0}' +
    '.gw{flex:1;min-height:0;overflow:auto}' +
    'table.g{border-collapse:separate;border-spacing:0;font-size:12.5px;min-width:100%}' +
    '.g th,.g td{border-right:1px solid #262B38;border-bottom:1px solid #262B38;padding:4px 10px;text-align:left;vertical-align:top;white-space:pre-wrap;min-width:64px;max-width:360px;outline:none}' +
    '.g thead th{position:sticky;top:0;background:#0B0D12;font-weight:600;z-index:2}' +
    '.g .rn{position:sticky;left:0;min-width:36px;width:36px;text-align:right;color:#8B93A7;background:#0B0D12;font-size:11px;user-select:none;z-index:1}' +
    '.g thead th.rn{z-index:3}' +
    '.g td:focus,.g th:focus{box-shadow:inset 0 0 0 2px #34D399;background:rgba(52,211,153,.12)}' +
    '.g td.num{text-align:right}' +
    '.empty{padding:34px 20px;color:#8B93A7;text-align:center}' +
    'textarea.code{flex:1;min-height:0;width:100%;resize:none;border:0;outline:none;padding:12px 14px;background:#1B1F2A;color:#E4E7EE;font-family:' + FONT + ';font-size:12.5px;line-height:1.6;tab-size:2;white-space:pre;overflow:auto}' +
    'textarea.code:focus{box-shadow:inset 0 0 0 2px #34D399}' +
    '.opts{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;padding:7px 12px;border-bottom:1px solid #262B38;background:#14171F;font-size:12px}' +
    '.opts select,.opts input[type=text]{font:inherit;font-size:12px;color:#E4E7EE;background:#1B1F2A;border:1px solid #262B38;border-radius:6px;padding:3px 7px;min-width:0}' +
    '.opts input[type=text]{width:200px;max-width:100%}' +
    '.btn{font:inherit;font-size:12.5px;padding:5px 12px;border-radius:7px;border:1px solid #262B38;background:#1B1F2A;color:#E4E7EE;cursor:pointer;white-space:nowrap}' +
    '.btn:hover{border-color:#34D399}' +
    '.btn.pri{background:#34D399;border-color:#34D399;color:#04211a;font-weight:600}' +
    '.mw{position:relative}' +
    '.menu{position:absolute;right:0;bottom:calc(100% + 6px);min-width:220px;background:#1B1F2A;border:1px solid #262B38;border-radius:9px;box-shadow:0 10px 30px rgba(0,0,0,.5);padding:5px;z-index:20}' +
    '.menu[hidden]{display:none}' +
    '.menu .grp{font-size:11px;color:#8B93A7;padding:6px 9px 3px}' +
    '.menu button{display:flex;width:100%;align-items:baseline;justify-content:space-between;gap:12px;font:inherit;font-size:12.5px;text-align:left;border:0;background:transparent;color:#E4E7EE;padding:6px 9px;border-radius:6px;cursor:pointer}' +
    '.menu button:hover{background:rgba(52,211,153,.14)}' +
    '.menu small{color:#8B93A7;font-size:11px}' +
    '.menu hr{border:0;border-top:1px solid #262B38;margin:4px 2px}' +
    '.st{font-size:12px;color:#8B93A7;min-width:0;overflow-wrap:anywhere}' +
    '.st.err{color:#FBBF24}' +
    '.hint{position:absolute;right:12px;bottom:10px;font-size:11px;color:#8B93A7;pointer-events:none;background:#1B1F2A;padding:2px 8px;border-radius:6px;border:1px solid #262B38}' +
    '[hidden]{display:none!important}' +
    '.toast{position:fixed;left:50%;transform:translateX(-50%);bottom:22px;background:#E4E7EE;color:#14171F;padding:8px 16px;border-radius:8px;font-family:' + FONT + ';font-size:12.5px;opacity:0;pointer-events:none;transition:opacity .18s;z-index:2147483001;max-width:calc(100vw - 32px)}' +
    '.toast.on{opacity:1}';

  function h(tag, props, kids) {
    var e = d.createElement(tag);
    if (props) {
      for (var k in props) {
        var v = props[k]; if (v === undefined || v === null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k.slice(0, 2) === 'on') e[k] = v;
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? d.createTextNode(c) : c); });
    return e;
  }
  function chk(id, label, checked) {
    var i = h('input', { type: 'checkbox', id: id }); i.checked = checked;
    return h('label', { class: 'chk' }, [i, label]);
  }
  function sel(id, options) {
    return h('select', { id: id }, options.map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
  }
  function mi(act, label, small) { return h('button', { type: 'button', 'data-act': act }, [label, h('small', { text: small })]); }

  var hostEl = h('div', { id: HOST_ID });
  var shadow = hostEl.attachShadow({ mode: 'open' });
  var R = {};

  var tableCount = d.querySelectorAll('table').length;
  var panel, toastEl;

  function build() {
    R.fmtChip = h('span', { class: 'chip', text: '대기' });
    R.vGrid = h('button', { type: 'button', class: 'on', text: '표' });
    R.vRaw = h('button', { type: 'button', text: '원문' });
    R.grid = h('table', { class: 'g' });
    R.gridWrap = h('div', { class: 'gw' }, [R.grid]);
    R.raw = h('textarea', { class: 'code', spellcheck: 'false', hidden: true, placeholder: 'CSV, TSV, HTML 표, GFM 표, ASCII 선 표를 여기에 붙여넣으세요.' });
    R.gridHint = h('div', { class: 'hint', text: 'Ctrl+V 로 표 전체 붙여넣기 · 셀은 직접 수정' });
    R.firstHeader = h('input', { type: 'checkbox' }); R.firstHeader.checked = true;
    R.dims = h('span', { class: 'meta' });
    R.copyTsv = h('button', { type: 'button', class: 'btn pri', text: 'TSV 복사' });
    R.menuBtn = h('button', { type: 'button', class: 'btn', text: '내보내기 ▾' });
    R.menu = h('div', { class: 'menu', hidden: true }, [
      h('div', { class: 'grp', text: '다른 형식으로 복사' }),
      mi('copy:csv', 'CSV', 'text'), mi('copy:htmlStyled', 'HTML 서식', 'rich'), mi('copy:htmlTable', 'HTML 표', '<table>'),
      mi('copy:gfm', 'GFM 표', '| - |'), mi('copy:ascii', 'ASCII 선 표', '┌─┬─┐'),
      h('hr'), h('div', { class: 'grp', text: '파일 다운로드' }),
      mi('dl:tsv', 'TSV 파일', '.tsv'), mi('dl:csv', 'CSV 파일', '.csv')
    ]);

    R.tabJson = h('button', { type: 'button', class: 'on', 'data-tab': 'json', text: 'JSON' });
    R.tabMd = h('button', { type: 'button', 'data-tab': 'md', text: '마크다운' });
    R.optInfer = chk('optInfer', '숫자·불리언 변환', true);
    R.optUnflat = chk('optUnflat', 'a.b 헤더를 중첩으로', true);
    R.optArr = sel('optArr', [['cols', '열로 (a[0].x)'], ['rows', '행으로 펼침']]);
    R.optsData = h('div', { class: 'opts' }, [R.optInfer, R.optUnflat, h('label', {}, ['중첩 배열 ', R.optArr])]);
    R.mdStyle = sel('mdStyle', [['record', '키: 값'], ['tree', '계층 중첩'], ['line', '한 줄 ( | )']]);
    R.mdHeader = sel('mdHeader', [['auto', '자동 감지'], ['first', '첫 항목'], ['last', '마지막 항목'], ['none', '없음']]);
    R.mdHeaderText = h('input', { type: 'text', placeholder: '헤더 직접 입력 (쉼표 구분)' });
    R.mdInclHeader = chk('mdInclHeader', '헤더 줄 출력', true);
    R.optsMd = h('div', { class: 'opts', hidden: true }, [h('label', {}, ['출력 ', R.mdStyle]), h('label', {}, ['헤더 ', R.mdHeader]), R.mdHeaderText, R.mdInclHeader]);
    R.listText = h('textarea', { class: 'code', spellcheck: 'false', placeholder: 'JSON 또는 마크다운 목록을 여기에 붙여넣으세요.' });
    R.listStatus = h('span', { class: 'st' });
    R.copyList = h('button', { type: 'button', class: 'btn pri', text: '복사' });
    R.dlList = h('button', { type: 'button', class: 'btn', text: '다운로드' });

    R.pickBtn = h('button', { type: 'button', class: 'btn', text: '페이지에서 표 선택 (' + tableCount + ')' });
    R.closeBtn = h('button', { type: 'button', class: 'btn', text: '✕ 닫기' });

    var tablePane = h('section', { class: 'pane' }, [
      h('div', { class: 'ph' }, [
        h('div', { class: 'pt' }, [h('h2', { text: '표' }), R.fmtChip, h('span', { class: 'kinds', text: 'CSV · TSV · HTML · GFM · ASCII' })]),
        h('div', { class: 'seg' }, [R.vGrid, R.vRaw])
      ]),
      h('div', { class: 'pb' }, [R.gridWrap, R.raw, R.gridHint]),
      h('div', { class: 'pf' }, [
        h('label', { class: 'chk' }, [R.firstHeader, '첫 행을 헤더로']), R.dims,
        h('div', { class: 'act' }, [R.copyTsv, h('div', { class: 'mw' }, [R.menuBtn, R.menu])])
      ])
    ]);
    var listPane = h('section', { class: 'pane' }, [
      h('div', { class: 'ph' }, [
        h('div', { class: 'pt' }, [h('h2', { text: '목록' }), h('span', { class: 'kinds', text: 'JSON · 마크다운' })]),
        h('div', { class: 'seg' }, [R.tabJson, R.tabMd])
      ]),
      R.optsData, R.optsMd,
      h('div', { class: 'pb' }, [R.listText]),
      h('div', { class: 'pf' }, [R.listStatus, h('div', { class: 'act' }, [R.copyList, R.dlList])])
    ]);

    panel = h('div', { class: 'panel', tabindex: '-1' }, [
      h('header', { class: 'top' }, [
        h('h1', { text: '표 ↔ 목록 변환기' }),
        h('span', { class: 'sub', text: '규칙 기반 변환 · 어느 쪽에 붙여넣어도 반대쪽이 갱신됩니다' }),
        h('span', { class: 'sp' }), R.pickBtn, R.closeBtn
      ]),
      h('main', { class: 'panes' }, [tablePane, listPane])
    ]);
    toastEl = h('div', { class: 'toast' });
    shadow.appendChild(h('style', { text: CSS }));
    shadow.appendChild(h('div', { class: 'bd' }, [panel]));
    shadow.appendChild(toastEl);
  }

  function view() {
    var g = S.grid, n = g[0] ? g[0].length : 0;
    if (S.firstHeader && g.length) {
      return { head: g[0].map(function (x, i) { return String(x).trim() === '' ? '열 ' + (i + 1) : String(x); }), body: g.slice(1) };
    }
    var head = []; for (var i = 0; i < n; i++) head.push('열 ' + (i + 1));
    return { head: head, body: g };
  }
  function opts() {
    return {
      infer: R.optInfer.firstChild.checked, unflat: R.optUnflat.firstChild.checked, arr: R.optArr.value,
      style: R.mdStyle.value, inclHeader: R.mdInclHeader.firstChild.checked,
      headerMode: R.mdHeader.value, headerText: R.mdHeaderText.value.trim()
    };
  }
  function setStatus(msg, err) { R.listStatus.textContent = msg || ''; R.listStatus.className = 'st' + (err ? ' err' : ''); }
  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 2200);
  }

  var CE_MODE = (function () {
    var x = d.createElement('div');
    try { x.contentEditable = 'plaintext-only'; return x.contentEditable === 'plaintext-only' ? 'plaintext-only' : 'true'; } catch (e) { return 'true'; }
  })();

  function cell(tag, text, r, c, num) {
    var e = d.createElement(tag);
    e.setAttribute('contenteditable', CE_MODE);
    e.setAttribute('data-r', r); e.setAttribute('data-c', c);
    if (num) e.className = 'num';
    e.textContent = text;
    return e;
  }
  function renderGrid() {
    var g = S.grid, n = g[0] ? g[0].length : 0, grid = R.grid;
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    if (!g.length || !n) {
      var tdE = h('td', { class: 'empty', text: '표를 붙여넣거나, 위의 "페이지에서 표 선택"으로 가져오세요.' });
      grid.appendChild(h('tbody', {}, [h('tr', {}, [tdE])]));
      return;
    }
    var v = view(), off = S.firstHeader ? 1 : 0;
    var trh = h('tr', {}, [h('th', { class: 'rn', text: '#' })]);
    v.head.forEach(function (x, i) { trh.appendChild(S.firstHeader ? cell('th', g[0][i], 0, i, false) : h('th', { text: x })); });
    grid.appendChild(h('thead', {}, [trh]));
    var tb = d.createElement('tbody');
    v.body.slice(0, MAX_ROWS).forEach(function (r, ri) {
      var tr = h('tr', {}, [h('td', { class: 'rn', text: String(ri + 1) })]);
      r.forEach(function (c, ci) { tr.appendChild(cell('td', c, ri + off, ci, isNum(c))); });
      tb.appendChild(tr);
    });
    grid.appendChild(tb);
  }

  function generateList() {
    var v = view(), o = opts();
    try {
      setStatus('');
      if (S.tab === 'json') return toJsonText(v.head, v.body, o);
      return toMdList(v.head, v.body, o);
    } catch (e) { setStatus('변환 오류: ' + e.message, true); return R.listText.value; }
  }
  function refreshOutputs(skip) {
    var g = S.grid, n = g[0] ? g[0].length : 0, rows = view().body.length;
    R.dims.textContent = n ? n + '열 × ' + rows + '행' + (rows > MAX_ROWS ? ' (표시는 앞 ' + MAX_ROWS + '행)' : '') : '';
    if (skip !== 'raw') R.raw.value = toTsv(g);
    if (skip !== 'list') { R.listText.value = generateList(); S.listIsInput = false; }
  }
  function loadGrid(grid, chipText, skip) {
    S.grid = grid; S.firstHeader = true; R.firstHeader.checked = true;
    R.fmtChip.textContent = chipText;
    renderGrid(); refreshOutputs(skip);
  }

  function handleTableText(text, html, skip) {
    if (!text.trim() && !html) return;
    var r = null;
    try { r = parseTableText(text, html); } catch (e) { r = null; }
    if (!r) { R.fmtChip.textContent = '인식 실패'; return; }
    S.grid = r.grid; R.fmtChip.textContent = r.fmt + ' 감지';
    renderGrid(); refreshOutputs(skip);
  }

  function detectListFormat(text) {
    return /^[[{]/.test(text.trim()) ? 'json' : 'md';
  }
  function listToGrid(text, tab, o) {
    if (tab === 'json') return jsonTextToGrid(text, o);
    var r = parseMdList(text, o);
    if (!r) throw new Error('목록 항목을 찾지 못했습니다.');
    S.mdKind = r.kind; return r.grid;
  }
  function handleListText(text) {
    if (!text.trim()) return;
    try {
      var grid = listToGrid(text, S.tab, opts());
      if (!grid || !grid.length) throw new Error('표로 바꿀 데이터가 없습니다.');
      S.grid = normalize(grid); S.firstHeader = true; R.firstHeader.checked = true;
      S.listIsInput = true; R.fmtChip.textContent = (S.tab === 'md' ? '마크다운' : 'JSON') + ' 에서 변환';
      renderGrid(); refreshOutputs('list');
      setStatus('인식 완료' + (S.tab === 'md' && S.mdKind ? ' · ' + KIND[S.mdKind] : '') + ' · ' + S.grid[0].length + '열 × ' + (S.grid.length - 1) + '행');
    } catch (e) { setStatus('해석 오류: ' + e.message, true); }
  }
  function setTab(t) {
    S.tab = t;
    R.tabJson.className = t === 'json' ? 'on' : ''; R.tabMd.className = t === 'md' ? 'on' : '';
    R.optsData.hidden = t === 'md'; R.optsMd.hidden = t !== 'md';
  }
  function setView(v) {
    R.vGrid.className = v === 'grid' ? 'on' : ''; R.vRaw.className = v === 'raw' ? 'on' : '';
    R.gridWrap.hidden = v !== 'grid'; R.raw.hidden = v !== 'raw'; R.gridHint.hidden = v !== 'grid';
    if (v === 'raw') R.raw.focus();
  }

  /* ----- 복사 · 다운로드 ----- */
  function execCopyFallback(text, label) {
    var ta = h('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    shadow.appendChild(ta); ta.select();
    var ok = false; try { ok = d.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    toast(ok ? label + ' 복사됨' : '복사하지 못했습니다. 원문 보기에서 직접 선택해 복사하세요.');
  }
  function copyText(text, label) {
    var fb = function () { execCopyFallback(text, label); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { toast(label + ' 복사됨'); }, fb);
        return;
      }
    } catch (e) { /* 아래 대체 경로 */ }
    fb();
  }
  function copyRich(html, plain, label) {
    var fb = function () { execCopyFallback(html, 'HTML 소스'); };
    try {
      if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
        navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' })
        })]).then(function () { toast(label + ' 복사됨'); }, fb);
        return;
      }
    } catch (e) { /* 아래 대체 경로 */ }
    fb();
  }
  function saveFile(name, data) {
    var url = URL.createObjectURL(new Blob([data]));
    var a = h('a', { href: url, download: name });
    shadow.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
    toast(name + ' 저장');
  }
  function closeMenu() { R.menu.hidden = true; }
  function menuAct(act) {
    var p = act.split(':'), kind = p[0], fmt = p[1], v = view(), m = S.grid;
    if (kind === 'copy') {
      if (fmt === 'csv') copyText(toCsv(m), 'CSV');
      else if (fmt === 'htmlTable') copyText(toHtmlTable(v), 'HTML 표');
      else if (fmt === 'htmlStyled') copyRich(toHtmlStyled(v), toTsv(m), 'HTML 서식');
      else if (fmt === 'gfm') copyText(toGfm(v), 'GFM 표');
      else if (fmt === 'ascii') copyText(toAscii(v), 'ASCII 표');
    } else if (kind === 'dl') {
      if (fmt === 'tsv') saveFile('table.tsv', toTsv(m));
      else saveFile('table.csv', '﻿' + toCsv(m));
    }
    closeMenu();
  }

  /* ----- 페이지에서 표 선택 ----- */
  var pick = null;
  function stopPick() {
    if (!pick) return;
    d.removeEventListener('mouseover', pick.over, true);
    d.removeEventListener('click', pick.click, true);
    d.removeEventListener('keydown', pick.key, true);
    window.removeEventListener('scroll', pick.upd, true);
    window.removeEventListener('resize', pick.upd, true);
    pick.box.remove(); pick.bar.remove();
    pick = null;
    hostEl.style.display = '';
  }
  function tableOf(node) {
    while (node) { if (node.nodeType === 1 && node.tagName === 'TABLE') return node; node = node.parentNode; }
    return null;
  }
  function importPageTable(el) {
    var rows = parseHtmlTable(el.cloneNode(true));
    if (!rows.length) { toast('빈 표입니다'); return; }
    loadGrid(normalize(rows), '페이지 표', 'none');
    toast('표 ' + rows.length + '행 가져옴');
  }
  function startPick() {
    if (!d.querySelectorAll('table').length) { toast('이 페이지에는 표가 없습니다'); return; }
    closeMenu();
    hostEl.style.display = 'none';
    var box = d.createElement('div'); box.id = PICK_ID;
    box.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483001;border:2px solid #34D399;background:rgba(52,211,153,.15);display:none;left:0;top:0;width:0;height:0;box-sizing:border-box';
    var bar = d.createElement('div');
    bar.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:2147483001;background:#14171F;color:#E4E7EE;border:1px solid #34D399;border-radius:8px;padding:8px 14px;font:13px ' + FONT + ';pointer-events:none';
    bar.textContent = '변환할 표를 클릭하세요 · ↑ 바깥 표 · Esc 취소';
    d.documentElement.appendChild(box); d.documentElement.appendChild(bar);
    var cur = null;
    function upd() {
      if (!cur || !cur.isConnected) { box.style.display = 'none'; return; }
      var r = cur.getBoundingClientRect();
      box.style.cssText += ';display:block;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px';
    }
    pick = {
      box: box, bar: bar, upd: upd,
      over: function (e) { cur = tableOf(e.target); upd(); },
      click: function (e) {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        if (!cur) return;
        var el = cur; stopPick(); importPageTable(el);
      },
      key: function (e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); stopPick(); return; }
        if (e.key === 'ArrowUp' && cur) {
          var up = tableOf(cur.parentNode);
          if (up) { e.preventDefault(); e.stopPropagation(); cur = up; upd(); }
        }
      }
    };
    d.addEventListener('mouseover', pick.over, true);
    d.addEventListener('click', pick.click, true);
    d.addEventListener('keydown', pick.key, true);
    window.addEventListener('scroll', upd, true);
    window.addEventListener('resize', upd, true);
  }

  /* ----- 이벤트 ----- */
  function debounce(fn, ms) {
    var t;
    return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); };
  }
  var onRawInput = debounce(function () { handleTableText(R.raw.value, null, 'raw'); }, 250);
  var onListInput = debounce(function () { handleListText(R.listText.value); }, 250);
  var onGridInput = debounce(function () { refreshOutputs('none'); }, 250);
  // 출력 옵션: 목록 입력 직후에도 표에서 목록을 다시 만들어 바로 반영한다
  function onOutputOption() { refreshOutputs('none'); }
  // 입력 옵션(중첩 배열·헤더 인식): 목록을 직접 입력한 상태면 목록을 다시 해석한다
  function onInputOption() {
    if (S.listIsInput && R.listText.value.trim()) handleListText(R.listText.value); else refreshOutputs('none');
  }

  function onKeydown(e) {
    if (pick) return;
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      if (!R.menu.hidden) closeMenu(); else closeAll();
    }
  }
  function closeAll() {
    stopPick();
    hostEl.remove();
    window.removeEventListener('keydown', onKeydown, true);
    if (window.__tcvCleanup === closeAll) window.__tcvCleanup = null;
  }

  function wire() {
    // 호스트 페이지 단축키가 입력에 끼어들지 않도록 키 이벤트를 여기서 끊는다
    ['keydown', 'keyup', 'keypress'].forEach(function (t) { hostEl.addEventListener(t, function (e) { e.stopPropagation(); }); });
    window.addEventListener('keydown', onKeydown, true);
    R.closeBtn.onclick = closeAll;
    R.pickBtn.onclick = startPick;
    R.vGrid.onclick = function () { setView('grid'); };
    R.vRaw.onclick = function () { setView('raw'); };
    R.raw.addEventListener('input', onRawInput);
    R.raw.addEventListener('paste', function (e) {
      e.preventDefault();
      var cd = e.clipboardData; R.raw.value = cd.getData('text/plain');
      handleTableText(R.raw.value, cd.getData('text/html'), 'raw');
    });
    R.grid.addEventListener('input', function (e) {
      var el = e.target.closest('[data-r]'); if (!el) return;
      S.grid[+el.getAttribute('data-r')][+el.getAttribute('data-c')] = el.innerText.replace(/\n$/, ''); onGridInput();
    });
    R.grid.addEventListener('paste', function (e) {
      var cd = e.clipboardData, t = cd.getData('text/plain'), hh = cd.getData('text/html');
      if (/<table[\s>]/i.test(hh) || /[\t\n]/.test(t.replace(/\n$/, ''))) { e.preventDefault(); handleTableText(t, hh); }
    });
    // 입력칸 밖(패널)에서 붙여넣기
    shadow.addEventListener('paste', function (e) {
      var tg = e.target;
      if (tg && (tg.tagName === 'TEXTAREA' || tg.tagName === 'INPUT' || tg.isContentEditable)) return;
      var t = e.clipboardData.getData('text/plain'), hh = e.clipboardData.getData('text/html');
      if (!hh && /^\s*[[{]/.test(t)) { setTab('json'); R.listText.value = t; handleListText(t); } else handleTableText(t, hh);
    });
    R.firstHeader.onchange = function () { S.firstHeader = R.firstHeader.checked; renderGrid(); refreshOutputs('none'); };
    R.copyTsv.onclick = function () { copyText(toTsv(S.grid), 'TSV'); };
    R.menuBtn.onclick = function (e) { e.stopPropagation(); R.menu.hidden = !R.menu.hidden; };
    R.menu.addEventListener('click', function (e) { var b = e.target.closest('[data-act]'); if (b) menuAct(b.getAttribute('data-act')); });
    shadow.addEventListener('click', function (e) { if (!e.target.closest('.mw')) closeMenu(); });

    [R.tabJson, R.tabMd].forEach(function (b) { b.onclick = function () { setTab(b.getAttribute('data-tab')); refreshOutputs('none'); }; });
    R.listText.addEventListener('input', function () { S.listIsInput = true; onListInput(); });
    R.listText.addEventListener('paste', function () {
      setTimeout(function () {
        var t = R.listText.value; if (!t.trim()) return;
        var f = detectListFormat(t); if (f !== S.tab) setTab(f);
        handleListText(t);
      }, 0);
    });
    [R.optInfer.firstChild, R.optUnflat.firstChild, R.mdStyle, R.mdInclHeader.firstChild].forEach(function (el) { el.onchange = onOutputOption; });
    [R.optArr, R.mdHeader].forEach(function (el) { el.onchange = onInputOption; });
    R.mdHeaderText.addEventListener('input', debounce(onInputOption, 300));
    R.copyList.onclick = function () { copyText(R.listText.value, S.tab === 'json' ? 'JSON' : '마크다운'); };
    R.dlList.onclick = function () { saveFile('list.' + (S.tab === 'json' ? 'json' : 'md'), R.listText.value); };
  }

  window.__tcvCleanup = closeAll;
  build();
  wire();
  renderGrid();
  d.documentElement.appendChild(hostEl);
  panel.focus();
})();
