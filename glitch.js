(function glitch(userOpts) {
  /* 다시 실행하면 토글(종료) */
  if (window.__glitchFx) { window.__glitchFx.stop(); return; }
  /* 비정상 종료로 남은 캔버스 정리 */
  var stale = document.getElementById('glitch-cv-7c3d');
  if (stale) stale.remove();
  document.querySelectorAll('[data-glitch-7c3d]').forEach(function (e) { e.remove(); });
  userOpts = userOpts || {};

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const defaults = {
    intensity: reduced ? 0.3 : 0.6,   /* 0.2 ~ 2 */
    minDelay: 400,                    /* 자동 이벤트 최소 간격(ms) */
    maxDelay: 5000,                   /* 자동 이벤트 최대 간격(ms) */
    maxCombo: 3,                      /* 한 이벤트에서 섞이는 효과 최대 개수 */
    weights: {                        /* 0이면 비활성 */
      noisePatch: 3, tear: 2, rgbSplit: 3,
      textCorrupt: 2, blockShift: 1.5, scanPatch: 1, flicker: 1
    },
    interactions: {                   /* false로 개별 끄기 */
      mouse: true, scroll: true, click: true, hover: true, copy: true, view: true
    },
    mouseSpeed: 2.2,                  /* 마우스 급이동 기준 (px/ms) */
    scrollSpeed: 1.8,                 /* 급스크롤 기준 (px/ms) */
    charset: '█▓▒░▌▐▀▄#@%&$?!<>/\\|{}[]ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ',
    decay: {                          /* 오래 켜 둘수록 페이지가 실제로 망가짐 */
      enabled: !reduced,
      startMin: 2,                    /* 이 시점까지는 평소와 동일 */
      fullMin: 20,                    /* 이 시점에 열화 최대 */
      maxRatio: 0.4,                  /* 영구 손상 글자 비율 상한 (넘으면 새 영구 손상 중단) */
      restoreOnStop: true,            /* 종료(재실행)할 때 영구 손상도 전부 원복 */
      maxBurn: 24,                    /* 화면에 남는 영구 노이즈 패치 최대 개수 */
      tone: true,                     /* 손상 비율에 따른 색조/주사선 이상 */
      touch: true,                    /* 마우스가 닿은 글자가 손상됨 (닿을수록 확률 증가) */
      touchAt: 0.35                   /* 이 부패도 이상부터 접촉 손상 시작 */
    }
  };
  /* 일부 키만 넘겨도 나머지 기본값이 유지되도록 병합 */
  const cfg = Object.assign({}, defaults, userOpts, {
    weights: Object.assign({}, defaults.weights, userOpts.weights),
    interactions: Object.assign({}, defaults.interactions, userOpts.interactions),
    decay: Object.assign({}, defaults.decay, userOpts.decay)
  });

  const rand = (a, b) => Math.random() * (b - a) + a;
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  /* 부패도 0~1: startMin 전 0, fullMin 후 1, 중간은 완만히 가속 */
  const t0 = performance.now();
  let skewMin = 0;
  const lerp = (a, b, t) => a + (b - a) * t;
  const D = () => {
    const dc = cfg.decay;
    if (!dc.enabled) return 0;
    const m = (performance.now() - t0) / 60000 + skewMin;
    return Math.pow(clamp((m - dc.startMin) / Math.max(0.01, dc.fullMin - dc.startMin), 0, 1), 1.5);
  };
  const I = () => cfg.intensity * (1 + D() * 0.8);
  const dur = ms => ms * (1 + D() * 3);   /* 일시 효과도 오래 남음 */

  const timers = new Set();
  const cleanups = new Set();
  const unbinders = [];
  let running = true;

  const later = (fn, ms) => {
    const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
    timers.add(t);
    return t;
  };
  const temp = (restore, ms) => {
    cleanups.add(restore);
    later(() => { if (cleanups.delete(restore)) restore(); }, ms);
  };
  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    unbinders.push(() => target.removeEventListener(type, fn, opts));
  };

  /* ---------- 영역(Region) 유틸 ---------- */
  const randRegion = (wMin, wMax, hMin, hMax) => {
    const w = innerWidth * rand(wMin, wMax) * (0.6 + I() * 0.6);
    const h = innerHeight * rand(hMin, hMax) * (0.6 + I() * 0.6);
    return { x: rand(0, Math.max(0, innerWidth - w)), y: rand(0, Math.max(0, innerHeight - h)), w, h };
  };
  const around = (cx, cy, w, h) => ({ x: cx - w / 2, y: cy - h / 2, w, h });
  const intersects = (r, a) =>
    r.right > a.x && r.left < a.x + a.w && r.bottom > a.y && r.top < a.y + a.h;

  const SELECTOR = 'h1,h2,h3,h4,p,li,a,img,button,span,td,label,figure';
  const elementsIn = (area, max) => {
    const out = [];
    for (const el of document.body.querySelectorAll(SELECTOR)) {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 6 || r.width > innerWidth * 0.9) continue;
      if (r.height > innerHeight * 0.5) continue;
      if (!intersects(r, area)) continue;
      out.push(el);
      if (out.length >= 80) break;
    }
    return out.sort(() => Math.random() - 0.5).slice(0, max);
  };

  const busy = new WeakSet();
  const styleTemp = (el, styles, ms) => {
    if (busy.has(el)) return;
    busy.add(el);
    const prev = {};
    for (const k in styles) { prev[k] = el.style[k]; el.style[k] = styles[k]; }
    temp(() => { Object.assign(el.style, prev); busy.delete(el); }, ms);
  };

  /* ---------- 오버레이 캔버스 (1:1 해상도, 부분 패치만 그림) ---------- */
  const cv = document.createElement('canvas');
  cv.id = 'glitch-cv-7c3d';
  cv.setAttribute('data-glitch-7c3d', '');
  cv.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;' +
    'z-index:2147483647;mix-blend-mode:difference;';
  const ctx = cv.getContext('2d');
  /* 영구 번인용 캔버스: 한 번 그려 두고 거의 갱신하지 않음 */
  const bcv = document.createElement('canvas');
  bcv.setAttribute('data-glitch-7c3d', '');
  bcv.style.cssText = cv.style.cssText;
  const bctx = bcv.getContext('2d');
  const fit = () => { cv.width = bcv.width = innerWidth; cv.height = bcv.height = innerHeight; };
  fit();
  on(window, 'resize', fit);
  document.documentElement.appendChild(bcv);
  document.documentElement.appendChild(cv);

  const patches = [];
  let loopOn = false;

  /* 가는 점 노이즈용 팔레트: 흰색 위주, 약한 청록/분홍 */
  const PAL = [
    'rgba(255,255,255,.55)', 'rgba(255,255,255,.28)',
    'rgba(255,255,255,.4)', 'rgba(120,255,255,.35)', 'rgba(255,90,140,.3)'
  ];

  const drawPatch = (ctx, p) => {
    const x = p.x | 0, y = p.y | 0;
    if (p.type === 'noise') {
      /* 1px 점 + 가끔 2~9px 가로 런(스트릭) -> 아날로그 신호 느낌 */
      const n = Math.min(700, Math.floor(p.w * p.h * p.density));
      const per = Math.ceil(n / PAL.length);
      for (let k = 0; k < PAL.length; k++) {
        ctx.fillStyle = PAL[k];
        for (let i = 0; i < per; i++) {
          const run = Math.random() < 0.18 ? randInt(2, 9) : 1;
          ctx.fillRect((p.x + Math.random() * p.w) | 0, (p.y + Math.random() * p.h) | 0, run, 1);
        }
      }
      /* 길이가 서로 다른 1px 가는 라인, 가끔 꺼지거나 1px 흔들림 */
      for (const l of p.lines) {
        if (Math.random() < 0.2) continue;
        const jitter = Math.random() < 0.15 ? randInt(-1, 1) : 0;
        ctx.fillStyle = `rgba(255,255,255,${(l.a * rand(0.6, 1)).toFixed(2)})`;
        ctx.fillRect((p.x + l.dx) | 0, (p.y + l.y + jitter) | 0, l.len | 0, 1);
      }
    } else if (p.type === 'scan') {
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      for (let yy = y; yy < y + p.h; yy += 3) ctx.fillRect(x, yy, p.w | 0, 1);
    } else if (p.type === 'vline') {
      /* 끊기고 흔들리는 세로선: 조각마다 x·굵기·농도가 다르고, 가끔 한 조각이 깜빡임 */
      ctx.fillStyle = p.color;
      for (const s of p.segs) {
        if (Math.random() < 0.04) continue;
        ctx.globalAlpha = s.a;
        ctx.fillRect(s.x, s.y | 0, s.w, s.h);
      }
      ctx.globalAlpha = 1;
    } else if (p.type === 'bar') {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(x, y, p.w | 0, p.h | 0);
      ctx.globalAlpha = 1;
    }
  };

  const loop = () => {
    const now = performance.now();
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (let i = patches.length - 1; i >= 0; i--) {
      if (now > patches[i].until) { patches.splice(i, 1); continue; }
      drawPatch(ctx, patches[i]);
    }
    if (patches.length && running) later(loop, 50);
    else loopOn = false;
  };
  const addPatch = (p, ms) => {
    p.until = performance.now() + dur(ms);
    patches.push(p);
    if (!loopOn) { loopOn = true; loop(); }
  };

  /* ---------- 텍스트 변형 ---------- */
  const zalgo = () => {
    let s = '';
    for (let i = 0, n = randInt(1, 3) + Math.floor(D() * 4); i < n; i++) s += String.fromCharCode(randInt(0x300, 0x36f));
    return s;
  };

  /* 노이즈 문자 사전 */
  const SYM = [...cfg.charset];
  const POOL = {
    box: [...'┃━┏┓┗┛┣┫┳┻╋║═╔╗╚╝╬▖▗▘▙▚▛▜▝▞▟■□◢◣◤◥◐◑◒◓'],
    math: [...'∑∏∂∆∇∫≈≠≡±∞√∅∴∵⊕⊗⌘⌥⎔⏣'],
    script: [...'ЖЯДБЦШЩЫЭЮΣΞΨΩΔΛΠθλ'],
    arrow: [...'←↑→↓↔↕↯⇄⇅'],
    tofu: [...'�□▯⍰⌧⎕']
  };
  const UPSIDE = {
    a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ᴉ', j: 'ɾ', k: 'ʞ', m: 'ɯ',
    n: 'u', p: 'd', q: 'b', r: 'ɹ', t: 'ʇ', u: 'n', v: 'ʌ', w: 'ʍ', y: 'ʎ',
    A: '∀', E: 'Ǝ', F: 'Ⅎ', G: '⅁', L: '⅂', M: 'W', P: 'Ԁ', T: '⊥', U: '∩', V: 'Λ', Y: '⅄',
    '1': 'Ɩ', '2': 'ᄅ', '3': 'Ɛ', '4': 'ㄣ', '5': 'ϛ', '6': '9', '7': 'ㄥ', '9': '6'
  };
  const HL = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
  const HV = [...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'];
  const HT = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];
  const wpick = (pairs) => {
    let r = Math.random() * pairs.reduce((s, p) => s + p[1], 0);
    for (const p of pairs) { r -= p[1]; if (r <= 0) return p[0]; }
    return pairs[0][0];
  };
  /* 글자 c 하나를 노이즈로 바꾼 문자열. d(부패도)가 클수록 거친 종류가 늘어남 */
  const noiseChar = (c, d) => {
    const ch = [...c][0];
    const code = ch.codePointAt(0);
    const hg = code >= 0xAC00 && code <= 0xD7A3;
    const kind = wpick([
      ['sym', 3], ['box', 1], ['math', 1], ['script', 1], ['arrow', 0.5],
      ['mut', hg ? 3 : 0], ['jamo', hg ? 0.5 + d * 3 : 0], ['up', UPSIDE[ch] ? 2 : 0],
      ['braille', d * 2], ['zalgo', d * 2.5], ['tofu', d * 1.5]
    ]);
    if (kind === 'sym') return pick(SYM);
    if (kind === 'braille') return String.fromCharCode(0x2800 + randInt(1, 255));
    if (kind === 'zalgo') return ch + zalgo();
    if (kind === 'up') return UPSIDE[ch];
    if (kind === 'mut' || kind === 'jamo') {
      const s = code - 0xAC00;
      let l = Math.floor(s / 588), v = Math.floor((s % 588) / 28), t = s % 28;
      if (kind === 'jamo') return HL[l] + HV[v] + HT[t];
      if (Math.random() < 0.5) v = randInt(0, 20); else t = randInt(0, 27);
      return String.fromCharCode(0xAC00 + l * 588 + v * 28 + t);
    }
    return pick(POOL[kind]);
  };

  const corrupt = (text) => {
    const mode = pick(['replace', 'zalgo', 'shuffle', 'case']);
    const chars = [...text];
    if (mode === 'replace')
      return chars.map(c => c.trim() && Math.random() < 0.22 ? noiseChar(c, D()) : c).join('');
    if (mode === 'zalgo')
      return chars.map(c => c.trim() && Math.random() < 0.35 ? c + zalgo() : c).join('');
    if (mode === 'shuffle')
      return text.split(/(\s+)/).map(w => w.trim().length > 3 && Math.random() < 0.5
        ? [...w].sort(() => Math.random() - 0.5).join('') : w).join('');
    return chars.map(c => c.trim() && Math.random() < 0.18
      ? (c.toUpperCase() === c ? c.toLowerCase() : c.toUpperCase()) : c).join('');
  };
  const BAD_TAG = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|CODE|PRE|OPTION|SELECT)$/;
  /* 건드려도 되는 텍스트 노드 (입력·편집 가능 영역·SVG 제외) */
  const textOk = (n) => {
    const p = n.parentElement;
    return !!p && p instanceof HTMLElement && n.nodeValue.trim().length >= 2 &&
      !BAD_TAG.test(p.tagName) && !p.isContentEditable;
  };
  const textNodesIn = (area, max) => {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!textOk(n)) return NodeFilter.FILTER_REJECT;
        const p = n.parentElement;
        const r = p.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || !intersects(r, area)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let n, guard = 0;
    while ((n = walker.nextNode()) && guard++ < 1500) out.push(n);
    return out.sort(() => Math.random() - 0.5).slice(0, max);
  };

  /* RGB 분리: 1~3회 깜빡이며, 회마다 켜진 시간과 쉬는 간격이 불규칙 */
  const splitEl = (el, d, ms) => {
    const styles = el.tagName === 'IMG'
      ? { filter: `drop-shadow(${d}px 0 0 rgba(255,0,60,.7)) drop-shadow(${-d}px 0 0 rgba(0,255,255,.7))` }
      : { textShadow: `${d}px 0 rgba(255,0,60,.75), ${-d}px 0 rgba(0,255,255,.75)` };
    let left = randInt(1, 3);
    const blink = () => {
      if (!running) return;
      const on = rand(40, Math.max(60, ms));
      styleTemp(el, styles, on);
      if (--left > 0) later(blink, on + rand(50, 260));
    };
    blink();
  };

  /* ---------- 효과 모음: area를 넘기면 그 영역에만 적용 ---------- */
  const effects = {
    /* 잔 점 + 짧은 스트릭 + 길이가 다른 1px 라인으로 구성된 작은 노이즈 패치 */
    noisePatch(area) {
      const n = area ? 1 : randInt(1, 2);
      for (let i = 0; i < n; i++) {
        const r = area || randRegion(0.06, 0.25, 0.02, 0.1);
        const lines = [];
        for (let k = 0, c = randInt(2, 5); k < c; k++)
          lines.push({
            y: rand(0, r.h), dx: rand(-0.3 * r.w, 0.5 * r.w),
            len: rand(30, 320), a: rand(0.15, 0.5)
          });
        addPatch(Object.assign({ type: 'noise', density: rand(0.008, 0.03), lines }, r), rand(150, 450));
      }
    },

    /* 가로 띠 구간만 옆으로 찢어짐 */
    tear(band) {
      if (!band) { band = randRegion(1, 1, 0.04, 0.14); }
      band = { x: 0, y: band.y, w: innerWidth, h: band.h };
      const dir = Math.random() < 0.5 ? -1 : 1;
      elementsIn(band, 6).forEach(el => styleTemp(el, {
        transform: `translateX(${dir * rand(8, 40) * I()}px)`
      }, rand(80, 280)));
      addPatch({ type: 'bar', x: 0, y: band.y, w: innerWidth, h: band.h,
        color: pick(['#f0f', '#0ff', '#fff']), alpha: rand(0.06, 0.2) }, rand(80, 220));
    },

    /* 일부 요소에만 RGB 채널 분리 */
    rgbSplit(area) {
      area = area || randRegion(0.2, 0.6, 0.1, 0.4);
      const d = rand(2, 5) * I() + 1;
      elementsIn(area, randInt(1, 5)).forEach(el => splitEl(el, d, rand(100, 350)));
    },

    /* 일부 텍스트만 깨짐 */
    textCorrupt(area) {
      area = area || randRegion(0.2, 0.7, 0.1, 0.5);
      textNodesIn(area, randInt(1, Math.ceil(3 * I()) + 1)).forEach(node => {
        if (scars.has(node) || tcBusy.has(node)) return;   /* 영구 손상 노드와 충돌 방지 */
        tcBusy.add(node);
        const original = node.nodeValue;
        const glitched = corrupt(original);
        node.nodeValue = glitched;
        temp(() => {
          if (node.nodeValue === glitched) node.nodeValue = original;
          tcBusy.delete(node);
        }, dur(rand(80, 400)));
      });
    },

    /* 일부 블록이 슬라이스되어 어긋남 */
    blockShift(area) {
      area = area || randRegion(0.15, 0.5, 0.08, 0.3);
      elementsIn(area, randInt(1, 3)).forEach(el => {
        const top = rand(0, 65), h = rand(8, 35);
        const s = {
          transform: `translateX(${rand(-25, 25) * I()}px) skewX(${rand(-8, 8)}deg)`,
          clipPath: `inset(${top}% 0 ${Math.max(0, 100 - top - h)}% 0)`
        };
        if (el.tagName === 'IMG') s.filter = `hue-rotate(${randInt(0, 360)}deg) saturate(${rand(1.2, 3)})`;
        styleTemp(el, s, rand(60, 240));
      });
    },

    /* 좁은 영역의 옅은 주사선 */
    scanPatch(area) {
      addPatch(Object.assign({ type: 'scan' }, area || randRegion(0.2, 0.6, 0.05, 0.25)), rand(150, 500));
    },

    /* 작은 요소만 순간적으로 번쩍임 */
    flicker(area) {
      area = area || randRegion(0.2, 0.6, 0.1, 0.3);
      elementsIn(area, randInt(1, 3)).forEach(el => styleTemp(el, {
        opacity: String(rand(0.3, 0.7)),
        filter: Math.random() < 0.4 ? 'invert(1)' : `hue-rotate(${randInt(0, 360)}deg)`
      }, rand(40, 140)));
    }
  };

  /* ---------- 시간 경과 열화(decay): 복구되지 않는 손상 ---------- */
  const scars = new Map();        /* 텍스트 노드 -> { orig[], cur[], perm:Set, last } */
  const tcBusy = new WeakSet();   /* 일시 textCorrupt 진행 중인 노드 */
  const flips = new Set();        /* { span, perm } 뒤집힌 글자 */
  const permStyles = new Map();   /* 요소 -> 원래 인라인 스타일 */
  const burned = [];              /* 번인 캔버스에 남은 패치 */
  const L = {};                   /* 색조 레이어 */
  let curDamaged = 0, totalChars = 1, stage = 0;
  const TH = [0.08, 0.2, 0.4, 0.65, 0.85];   /* maxRatio 대비 단계 경계 */

  const capped = () => curDamaged / totalChars >= cfg.decay.maxRatio;
  const permRoll = d => !capped() && Math.random() < d * 0.9;

  /* -- 글자 치환 (재감염 가능) -- */
  const liveState = (node) => {
    let st = scars.get(node);
    if (st && node.nodeValue !== st.last) { scars.delete(node); st = null; }   /* 페이지가 직접 바꾼 노드 */
    return st;
  };
  const render = (node, st) => { st.last = st.cur.join(''); node.nodeValue = st.last; };
  const scarNode = (node, count, d) => {
    if (tcBusy.has(node)) return;
    let st = liveState(node);
    if (!st) {
      const o = [...node.nodeValue];
      st = { orig: o, cur: o.slice(), perm: new Set(), last: node.nodeValue };
      scars.set(node, st);
    }
    const solid = [];
    st.orig.forEach((c, i) => { if (c.trim()) solid.push(i); });
    if (!solid.length) return;
    for (let k = 0; k < count; k++) {
      let i = pick(solid);
      if (st.perm.size && Math.random() < d * 0.5) i = pick([...st.perm]);   /* 이미 망가진 글자 재타격 */
      const hit = st.cur[i] !== st.orig[i];
      st.cur[i] = hit && d > 0.3 && Math.random() < 0.4 ? st.cur[i] + zalgo() : noiseChar(st.orig[i], d);
      if (permRoll(d)) {
        if (!st.perm.has(i)) { st.perm.add(i); curDamaged++; }
      } else if (!st.perm.has(i)) {
        const v = st.cur[i];
        later(() => {
          if (liveState(node) !== st || st.perm.has(i) || st.cur[i] !== v) return;
          st.cur[i] = st.orig[i];
          render(node, st);
        }, dur(rand(120, 600)));
      }
    }
    render(node, st);
  };
  const neighborsOf = (node, max) => {
    const root = (node.parentElement && node.parentElement.parentElement) || document.body;
    const out = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n, g = 0;
    while ((n = w.nextNode()) && g++ < 200) if (n !== node && textOk(n)) out.push(n);
    return out.sort(() => Math.random() - 0.5).slice(0, max);
  };
  const scarSome = (d) => {
    let nodes = textNodesIn(randRegion(0.2, 0.8, 0.1, 0.6), 1 + Math.floor(d * 5));
    if (scars.size && Math.random() < d * 0.5)          /* 감염 전파: 손상 노드의 이웃 */
      nodes = nodes.concat(neighborsOf(pick([...scars.keys()]), 2));
    nodes.forEach(n => {
      if (!n.isConnected) return;
      scarNode(n, clamp(Math.ceil(n.nodeValue.length * rand(0.02, 0.04 + 0.2 * d)), 1, 40), d);
    });
  };

  /* -- 글자 뒤집기: 한 글자를 span 으로 감싸 transform (한글 포함 모든 글자) -- */
  const FLIPS = ['scaleX(-1)', 'scaleY(-1)', 'rotate(180deg)'];
  const FLIPS_HARD = ['rotate(90deg)', 'rotate(-90deg)', 'scale(-1,-1) skewX(14deg)', 'scaleX(-1) rotate(9deg)'];
  const pickFlip = d => pick(d > 0.4 ? FLIPS.concat(FLIPS_HARD) : FLIPS);
  const unflip = (rec) => {
    flips.delete(rec);
    const sp = rec.span, tn = sp.firstChild;
    if (sp.parentNode && tn) sp.replaceWith(tn);   /* 텍스트 노드를 그대로 빼내 원위치 */
    else if (sp.parentNode) sp.remove();
  };
  const flipChar = (node, d) => {
    if (!node.parentNode || scars.has(node) || tcBusy.has(node)) return;
    if (node.parentNode.hasAttribute && node.parentNode.hasAttribute('data-gl-flip')) return;
    const chars = [...node.nodeValue];
    const solid = [];
    chars.forEach((c, i) => { if (c.trim()) solid.push(i); });
    if (!solid.length) return;
    const i = pick(solid);
    const off = chars.slice(0, i).join('').length, len = chars[i].length;
    const mid = off ? node.splitText(off) : node;
    if (mid.nodeValue.length > len) mid.splitText(len);
    const sp = document.createElement('span');
    sp.setAttribute('data-gl-flip', '');
    sp.style.cssText = 'display:inline-block;transform:' + pickFlip(d) + ';';
    mid.parentNode.insertBefore(sp, mid);
    sp.appendChild(mid);
    const rec = { span: sp, perm: permRoll(d) };
    flips.add(rec);
    if (rec.perm) curDamaged++;
    else later(() => { if (flips.has(rec)) unflip(rec); }, dur(rand(300, 1500)));
  };
  const flipSome = (d) => {
    textNodesIn(randRegion(0.2, 0.8, 0.1, 0.6), 1 + Math.floor(d * 3)).forEach(n => flipChar(n, d));
    if (flips.size && Math.random() < d * 0.5) pick([...flips]).span.style.transform = pickFlip(d);   /* 재타격 */
  };

  /* -- 화면 번인: 캔버스에 한 번 그려 영구히 남는 노이즈/죽은 픽셀 라인 -- */
  const redrawBurn = () => {
    bctx.clearRect(0, 0, bcv.width, bcv.height);
    burned.forEach(p => drawPatch(bctx, p));
  };
  on(window, 'resize', redrawBurn);
  const burnIn = (d) => {
    if (burned.length >= Math.max(1, Math.ceil(cfg.decay.maxBurn * d)) || burned.length >= cfg.decay.maxBurn) return;
    const r = Math.random();
    let p;
    if (r < 0.45) {
      const g = randRegion(0.04, 0.18, 0.01, 0.06), lines = [];
      for (let k = 0, c = randInt(1, 3); k < c; k++)
        lines.push({ y: rand(0, g.h), dx: rand(-0.3 * g.w, 0.5 * g.w), len: rand(30, 200), a: rand(0.15, 0.4) });
      p = Object.assign({ type: 'noise', density: rand(0.006, 0.02), lines }, g);
    } else if (r < 0.7) {
      p = Object.assign({ type: 'scan' }, randRegion(0.1, 0.4, 0.03, 0.15));
    } else {
      /* 위에서 아래로 내려가며 조각을 이어 붙임: 길이·간격 불규칙, x 가 가끔 1px 어긋남, 끝으로 갈수록 옅어짐 */
      let x = rand(0, innerWidth) | 0, y = rand(0, innerHeight * 0.7);
      const total = rand(0.08, 0.5) * innerHeight, end = y + total, segs = [];
      const base = rand(0.35, 0.9);
      while (y < end) {
        const h = Math.random() < 0.15 ? 1 : randInt(3, 40);
        const taper = 1 - (y - (end - total)) / total * 0.7;
        if (Math.random() < 0.35) x += pick([-1, 1]);
        segs.push({ x: x, y: y, w: Math.random() < 0.2 ? 2 : 1, h: h, a: clamp(base * taper * rand(0.5, 1.1), 0.1, 1) });
        if (Math.random() < 0.25) segs.push({ x: x + pick([-1, 1]) * randInt(2, 5), y: y + rand(0, h), w: 1, h: 1, a: rand(0.2, 0.6) });
        y += h + (Math.random() < 0.4 ? 0 : randInt(1, 14));
      }
      p = { type: 'vline', color: pick(['#fff', '#fff', '#f0f', '#0ff', '#ff0']), segs: segs };
    }
    burned.push(p);
    drawPatch(bctx, p);
  };
  const burnRefresh = () => {              /* 번인 노이즈가 천천히 꿈틀거리도록 재생성 */
    if (!running) return;
    if (burned.length) redrawBurn();
    later(burnRefresh, 2500);
  };
  burnRefresh();

  const decayBurst = () => {
    const d = D();
    if (d <= 0) return;
    if (Math.random() < 0.25 + d * 0.75) scarSome(d);
    if (Math.random() < d * 0.7) flipSome(d);
    if (Math.random() < d * 0.5) burnIn(d);
  };
  const decayFx = { scar: scarSome, flip: flipSome, burn: burnIn };

  /* -- 접촉 손상: 커서가 지나간 글자는 닿은 횟수(heat)만큼 손상 확률이 올라감 -- */
  const heat = new WeakMap();
  const nodeAt = (x, y) => {
    if (document.caretPositionFromPoint) {
      const c = document.caretPositionFromPoint(x, y);
      return c && c.offsetNode;
    }
    if (document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(x, y);
      return r && r.startContainer;
    }
    return null;
  };
  if (cfg.decay.touch) {
    let lastT = 0;
    on(window, 'mousemove', e => {
      const t = performance.now();
      if (t - lastT < 60) return;
      lastT = t;
      const d = D(), at = cfg.decay.touchAt;
      if (d < at) return;
      const s = clamp((d - at) / Math.max(0.01, 1 - at), 0, 1);
      for (const dx of [0, -14, 14]) {
        const n = nodeAt(e.clientX + dx, e.clientY);
        if (!n || n.nodeType !== 3 || !textOk(n)) continue;
        const h = (heat.get(n) || 0) + 1;
        heat.set(n, h);
        if (Math.random() > clamp(s * 0.3 + h * 0.1 * (0.5 + s), 0, 0.95)) continue;
        try {
          scarNode(n, 1 + Math.floor(h / 3), d);
          if (h >= 4 && Math.random() < 0.3 * s) flipChar(n, d);
        } catch (err) {}
      }
    }, { passive: true });
  }

  /* -- 손상 비율 집계 -> 단계 -> 색조/주사선/이미지 열화 -- */
  const stylePerm = (el, styles) => {
    let prev = permStyles.get(el);
    if (!prev) { prev = {}; permStyles.set(el, prev); }
    for (const k in styles) { if (!(k in prev)) prev[k] = el.style[k]; el.style[k] = styles[k]; }
  };
  const measure = () => {
    let total = 0, n = 0, t;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while ((t = w.nextNode()) && n++ < 6000) {
      const p = t.parentElement;
      if (!p || BAD_TAG.test(p.tagName) || !p.getClientRects().length) continue;
      total += t.nodeValue.replace(/\s/g, '').length;
    }
    totalChars = Math.max(1, total);
    let dmg = 0;
    scars.forEach((st, node) => {
      if (!node.isConnected || (!st.perm.size && node.nodeValue === st.orig.join(''))) { scars.delete(node); return; }
      dmg += st.perm.size;
    });
    flips.forEach(rec => { if (!rec.span.isConnected) flips.delete(rec); else if (rec.perm) dmg++; });
    curDamaged = dmg;
    const ratio = dmg / totalChars / cfg.decay.maxRatio;
    stage = TH.filter(x => ratio >= x).length;
  };
  const mkLayer = (css, slow) => {
    const el = document.createElement('div');
    el.setAttribute('data-glitch-7c3d', '');
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483000;opacity:0;' +
      (slow ? 'transition:opacity 1.6s linear,background-color 1.6s linear;' : '') + css;
    document.documentElement.appendChild(el);
    return el;
  };
  const blip = (el, ms) => { el.style.opacity = '1'; later(() => { el.style.opacity = '0'; }, ms); };
  let hue = randInt(0, 359), tickN = 0;
  const toneTick = () => {
    const d = D();
    if (d <= 0) return;
    if (tickN++ % 3 === 0) measure();
    if (!cfg.decay.tone || stage < 1) return;
    if (!L.tint) {
      L.tint = mkLayer('mix-blend-mode:color;', true);
      L.sat = mkLayer('mix-blend-mode:saturation;background:#808080;', true);
      L.gray = mkLayer('mix-blend-mode:saturation;background:#808080;');
      L.inv = mkLayer('mix-blend-mode:difference;background:#fff;');
      L.scan = mkLayer('background:repeating-linear-gradient(0deg,rgba(0,0,0,.22) 0,rgba(0,0,0,.22) 1px,transparent 1px,transparent 3px);', true);
    }
    hue = (hue + rand(15, 60)) % 360;
    L.tint.style.backgroundColor = `hsl(${hue},75%,50%)`;
    L.tint.style.opacity = String(0.05 + stage * 0.04);
    L.sat.style.opacity = stage >= 2 ? String(rand(0.1, 0.15 * stage)) : '0';
    L.scan.style.opacity = stage >= 5 ? '0.8' : '0';
    if (!reduced) {
      if (stage >= 3 && Math.random() < 0.18) blip(L.gray, rand(90, 260));
      if (stage >= 4 && Math.random() < 0.1) blip(L.inv, rand(50, 120));
    }
    if (stage >= 3 && permStyles.size < 6 + Math.round(60 * d)) {
      elementsIn(randRegion(0.3, 0.9, 0.2, 0.8), 4).forEach(el => {
        if (el.tagName === 'IMG') {
          if (stage >= 4) stylePerm(el, { filter: `contrast(${rand(1.2, 1.8).toFixed(2)}) saturate(${rand(0.1, 0.6).toFixed(2)}) hue-rotate(${randInt(-40, 40)}deg)` });
        } else {
          const k = rand(1, 2.5).toFixed(1);
          stylePerm(el, { textShadow: `${k}px 0 rgba(255,0,60,.5), -${k}px 0 rgba(0,255,255,.5)` });
        }
      });
    }
  };
  const tick = () => {
    if (!running) return;
    try { toneTick(); } catch (e) {}
    later(tick, 1500);
  };
  later(tick, 1500);

  /* 종료 시 복구: all=false 면 일시 손상만 되돌리고 영구 손상은 남김 */
  const restoreDamage = (all) => {
    scars.forEach((st, node) => {
      if (node.nodeValue !== st.last) return;
      node.nodeValue = st.cur.map((c, i) => all || !st.perm.has(i) ? st.orig[i] : c).join('');
    });
    scars.clear();
    flips.forEach(rec => { if (all || !rec.perm) unflip(rec); });
    if (all) {
      flips.clear();
      permStyles.forEach((prev, el) => Object.assign(el.style, prev));
      permStyles.clear();
    }
  };

  /* ---------- 가중치 기반 비복원 추출 ---------- */
  const chooseEffects = () => {
    const r = Math.random();
    let n = Math.min(r < 0.6 ? 1 : r < 0.9 ? 2 : 3, cfg.maxCombo);
    if (Math.random() < D() * 0.6) n = Math.min(n + 1, cfg.maxCombo + (D() > 0.5 ? 1 : 0));
    let pool = Object.keys(effects).filter(k => (cfg.weights[k] || 0) > 0);
    const chosen = [];
    while (n-- > 0 && pool.length) {
      const total = pool.reduce((s, k) => s + cfg.weights[k], 0);
      let t = Math.random() * total, sel = pool[0];
      for (const k of pool) { t -= cfg.weights[k]; if (t <= 0) { sel = k; break; } }
      chosen.push(sel);
      pool = pool.filter(k => k !== sel);
    }
    return chosen;
  };

  const burst = () => {
    try { decayBurst(); } catch (e) {}
    chooseEffects().forEach(name => later(() => { try { effects[name](); } catch (e) {} }, rand(0, 120)));
    if (Math.random() < 0.25 * I())
      later(() => chooseEffects().slice(0, 1).forEach(n => effects[n]()), rand(150, 400));
  };

  /* ---------- 자동 스케줄러 (불규칙 간격) ---------- */
  const schedule = () => {
    if (!running) return;
    const r = Math.pow(Math.random(), 1.6), d = D();
    const lo = lerp(cfg.minDelay, cfg.minDelay * 0.35, d);                      /* 후반일수록 간격이 짧아짐 */
    const hi = lerp(cfg.maxDelay, Math.max(cfg.minDelay, cfg.maxDelay * 0.2), d);
    later(() => { burst(); schedule(); }, lo + r * (hi - lo));
  };
  schedule();

  /* ---------- 사용자 인터랙션 반응 ---------- */
  const cool = {};
  const ready = (key, ms) => {
    const t = performance.now();
    if (t - (cool[key] || 0) < ms) return false;
    cool[key] = t;
    return true;
  };
  const run = (name, area) => { if ((cfg.weights[name] || 0) > 0) try { effects[name](area); } catch (e) {} };

  /* 1) 마우스 급이동: 커서 주변에서 반응, 가로로 휙 움직이면 그 높이에서 찢김 */
  if (cfg.interactions.mouse) {
    let lm = null;
    on(window, 'mousemove', e => {
      const t = performance.now();
      if (lm) {
        const dt = t - lm.t;
        if (dt > 0 && dt < 100) {
          const dx = e.clientX - lm.x, dy = e.clientY - lm.y;
          const v = lm.v * 0.5 + (Math.hypot(dx, dy) / dt) * 0.5;
          lm.v = v;
          if (v > cfg.mouseSpeed && ready('mouse', 350) && Math.random() < 0.4 + I() * 0.5) {
            const size = clamp(120 + v * 25, 120, 320);
            const a = around(e.clientX, e.clientY, size * 1.3, size * 0.7);
            const names = ['noisePatch', 'rgbSplit', 'blockShift', 'flicker'];
            if (Math.abs(dx) > Math.abs(dy) * 1.5) names.push('tear', 'tear');
            const picks = [pick(names)];
            if (Math.random() < 0.35) picks.push(pick(names));
            picks.forEach(n => n === 'tear'
              ? run('tear', around(e.clientX, e.clientY, innerWidth, rand(14, 36)))
              : run(n, a));
          }
        }
      }
      lm = { x: e.clientX, y: e.clientY, t, v: lm ? lm.v : 0 };
    }, { passive: true });
  }

  /* 2) 급스크롤: 가로 띠 찢김 + 얇고 넓은 노이즈 라인 */
  if (cfg.interactions.scroll) {
    let ls = null;
    on(window, 'scroll', e => {
      const tg = e.target;
      const pos = (tg === document || tg === window || tg === document.documentElement)
        ? window.scrollY : (tg.scrollTop || 0);
      const t = performance.now();
      if (ls && ls.tg === tg) {
        const dt = t - ls.t;
        if (dt > 0 && dt < 120) {
          const v = Math.abs(pos - ls.pos) / dt;
          if (v > cfg.scrollSpeed && ready('scroll', 300) && Math.random() < 0.5 + I() * 0.4) {
            const n = v > cfg.scrollSpeed * 3 ? 2 : 1;
            for (let i = 0; i < n; i++) {
              const y = rand(0, innerHeight);
              run('tear', { y: y, h: rand(10, 40) });
              run('noisePatch', { x: rand(0, innerWidth * 0.5), y: rand(0, innerHeight), w: innerWidth * rand(0.3, 0.7), h: rand(8, 24) });
            }
            if (Math.random() < 0.4) run('blockShift');
          }
        }
      }
      ls = { tg, pos, t };
    }, { passive: true, capture: true });
  }

  /* 3) 클릭: 클릭 지점에 짧은 반응 */
  if (cfg.interactions.click) {
    on(window, 'mousedown', e => {
      if (!ready('click', 250) || Math.random() > 0.35 + I() * 0.4) return;
      const a = around(e.clientX, e.clientY, 160, 90);
      run('noisePatch', a);
      run('rgbSplit', a);
    }, { passive: true, capture: true });
  }

  /* 4) 이미지/링크/제목 위에 올리면 가끔 그 요소만 RGB 분리 */
  if (cfg.interactions.hover) {
    on(document, 'mouseover', e => {
      const el = e.target && e.target.closest && e.target.closest('img,a,button,h1,h2,h3');
      if (!el || Math.random() > 0.12 * (0.5 + I()) || !ready('hover', 1200)) return;
      splitEl(el, rand(2, 5) * I() + 1, rand(120, 320));
      if (Math.random() < 0.3) {
        const r = el.getBoundingClientRect();
        run('noisePatch', { x: r.left, y: r.top, w: Math.min(r.width, 240), h: Math.min(r.height, 50) });
      }
    }, { passive: true });
  }

  /* 5) 복사: 보이는 텍스트 일부가 순간 깨짐 */
  if (cfg.interactions.copy) {
    on(document, 'copy', () => {
      if (ready('copy', 800)) run('textCorrupt', { x: 0, y: 0, w: innerWidth, h: innerHeight });
    });
  }

  /* 6) 탭 복귀 / 창 크기 변경 */
  if (cfg.interactions.view) {
    on(document, 'visibilitychange', () => {
      if (!document.hidden && ready('view', 800)) later(burst, 120);
    });
    let rt;
    on(window, 'resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => { if (running && ready('resize', 800)) { run('tear'); run('noisePatch'); } }, 150);
    });
  }

  window.__glitchFx = {
    stop() {
      running = false;
      timers.forEach(clearTimeout); timers.clear();
      cleanups.forEach(fn => { try { fn(); } catch (e) {} }); cleanups.clear();
      unbinders.forEach(fn => fn());
      restoreDamage(cfg.decay.restoreOnStop);
      Object.keys(L).forEach(k => L[k].remove());
      cv.remove();
      bcv.remove();
      delete window.__glitchFx;
    },
    /* 콘솔 테스트용: __glitchFx.fire('noisePatch') / fire('scar'|'flip'|'burn') */
    fire(name) { if (decayFx[name]) decayFx[name](Math.max(D(), 0.5)); else run(name); },
    /* 경과 시간을 m분으로 건너뜀: __glitchFx.jump(15) */
    jump(m) { skewMin = m - (performance.now() - t0) / 60000; },
    status() { return { decay: D(), stage, damaged: curDamaged, total: totalChars, scars: scars.size, flips: flips.size, burned: burned.length }; }
  };
})();
