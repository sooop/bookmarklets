(function glitch(userOpts) {
  /* 다시 실행하면 토글(종료) */
  if (window.__glitchFx) { window.__glitchFx.stop(); return; }
  /* 비정상 종료로 남은 캔버스 정리 */
  var stale = document.getElementById('glitch-cv-7c3d');
  if (stale) stale.remove();
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
    charset: '█▓▒░▌▐▀▄#@%&$?!<>/\\|{}[]ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ'
  };
  /* 일부 키만 넘겨도 나머지 기본값이 유지되도록 병합 */
  const cfg = Object.assign({}, defaults, userOpts, {
    weights: Object.assign({}, defaults.weights, userOpts.weights),
    interactions: Object.assign({}, defaults.interactions, userOpts.interactions)
  });

  const rand = (a, b) => Math.random() * (b - a) + a;
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const I = () => cfg.intensity;

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
  cv.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;' +
    'z-index:2147483647;mix-blend-mode:difference;';
  const ctx = cv.getContext('2d');
  const fit = () => { cv.width = innerWidth; cv.height = innerHeight; };
  fit();
  on(window, 'resize', fit);
  document.documentElement.appendChild(cv);

  const patches = [];
  let loopOn = false;

  /* 가는 점 노이즈용 팔레트: 흰색 위주, 약한 청록/분홍 */
  const PAL = [
    'rgba(255,255,255,.55)', 'rgba(255,255,255,.28)',
    'rgba(255,255,255,.4)', 'rgba(120,255,255,.35)', 'rgba(255,90,140,.3)'
  ];

  const drawPatch = (p) => {
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
      drawPatch(patches[i]);
    }
    if (patches.length && running) later(loop, 50);
    else loopOn = false;
  };
  const addPatch = (p, dur) => {
    p.until = performance.now() + dur;
    patches.push(p);
    if (!loopOn) { loopOn = true; loop(); }
  };

  /* ---------- 텍스트 변형 ---------- */
  const zalgo = () => {
    let s = '';
    for (let i = 0, n = randInt(1, 3); i < n; i++) s += String.fromCharCode(randInt(0x300, 0x36f));
    return s;
  };
  const corrupt = (text) => {
    const mode = pick(['replace', 'zalgo', 'shuffle', 'case']);
    const chars = [...text];
    if (mode === 'replace')
      return chars.map(c => c.trim() && Math.random() < 0.22 ? pick([...cfg.charset]) : c).join('');
    if (mode === 'zalgo')
      return chars.map(c => c.trim() && Math.random() < 0.35 ? c + zalgo() : c).join('');
    if (mode === 'shuffle')
      return text.split(/(\s+)/).map(w => w.trim().length > 3 && Math.random() < 0.5
        ? [...w].sort(() => Math.random() - 0.5).join('') : w).join('');
    return chars.map(c => c.trim() && Math.random() < 0.18
      ? (c.toUpperCase() === c ? c.toLowerCase() : c.toUpperCase()) : c).join('');
  };
  const textNodesIn = (area, max) => {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (!p || n.nodeValue.trim().length < 2) return NodeFilter.FILTER_REJECT;
        if (/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|CODE|PRE)$/.test(p.tagName)) return NodeFilter.FILTER_REJECT;
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
        const original = node.nodeValue;
        const glitched = corrupt(original);
        node.nodeValue = glitched;
        temp(() => { if (node.nodeValue === glitched) node.nodeValue = original; }, rand(80, 400));
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

  /* ---------- 가중치 기반 비복원 추출 ---------- */
  const chooseEffects = () => {
    const r = Math.random();
    let n = Math.min(r < 0.6 ? 1 : r < 0.9 ? 2 : 3, cfg.maxCombo);
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
    chooseEffects().forEach(name => later(() => { try { effects[name](); } catch (e) {} }, rand(0, 120)));
    if (Math.random() < 0.25 * I())
      later(() => chooseEffects().slice(0, 1).forEach(n => effects[n]()), rand(150, 400));
  };

  /* ---------- 자동 스케줄러 (불규칙 간격) ---------- */
  const schedule = () => {
    if (!running) return;
    const r = Math.pow(Math.random(), 1.6);
    later(() => { burst(); schedule(); }, cfg.minDelay + r * (cfg.maxDelay - cfg.minDelay));
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
      cv.remove();
      delete window.__glitchFx;
    },
    /* 콘솔 테스트용: __glitchFx.fire('noisePatch') */
    fire(name) { run(name); }
  };
})();
