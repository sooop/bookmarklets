/*
 * SlickGrid 추출기
 * *.tracxlogis.com / *.qxpress.net 에서 동작하며, iframe까지 탐색해 SlickGrid 데이터 그리드를 찾아 CSV/TSV로 내보냅니다.
 *
 * 이 파일은 북마클릿 로더가 <script src="...">로 동적 로드해서 실행하는 실제 로직입니다.
 * GitHub 등 정적 호스팅에 올려두고, 북마클릿(로더)은 이 파일의 URL만 참조합니다.
 */
!(function () {
  if (!window.__gridExportActive) {
    window.__gridExportActive = !0;
    var t;
    if (
      ((t = window.location.hostname),
      !/(^|\.)tracxlogis\.com$/i.test(t) && !/(^|\.)qxpress\.net$/i.test(t))
    )
      return (
        a(
          "이 도구는 tracxlogis.com 및 qxpress.net 도메인에서만 사용할 수 있습니다.",
          "warn",
          "지원되지 않는 도메인",
        ),
        void (window.__gridExportActive = !1)
      );
    var e = [],
      n = (function t(e, n, o) {
        var r = [];
        try {
          var a = e.SlickGridFactory;
          a &&
            "object" == typeof a &&
            Object.keys(a).forEach(function (t) {
              var n = a[t];
              n &&
                "object" == typeof n &&
                n.gridObject &&
                "function" == typeof n.gridObject.getColumns &&
                r.push({ entry: n, win: e });
            });
        } catch (t) {}
        if (n > 0)
          try {
            for (
              var i = e.document.querySelectorAll("iframe"), p = 0;
              p < i.length;
              p++
            )
              try {
                var c = i[p].contentWindow;
                c &&
                  -1 === o.indexOf(c) &&
                  (o.push(c), (r = r.concat(t(c, n - 1, o))));
              } catch (t) {}
          } catch (t) {}
        return r;
      })(window, 3, [window]),
      o = n.filter(function (t) {
        try {
          var e = t.entry.gridObject.getContainerNode().getBoundingClientRect();
          return e.width > 5 && e.height > 5;
        } catch (t) {
          return !1;
        }
      });
    0 === o.length
      ? (a(
          "이 페이지에서 SlickGrid 데이터 그리드를 찾을 수 없습니다.",
          "warn",
          "그리드 없음",
        ),
        (window.__gridExportActive = !1))
      : 1 === o.length
        ? f(o[0].entry)
        : (function (t) {
            r();
            var n = document.createElement("div");
            ((n.className = "gxp-root"),
              (n.innerHTML =
                '<div class="gxp-pick-banner">그리드 <b>' +
                t.length +
                "개</b>를 찾았습니다 &middot; 내보낼 그리드를 클릭하세요 (ESC로 취소)</div>"),
              document.body.appendChild(n),
              e.push(n),
              t.forEach(function (t, o) {
                var r;
                try {
                  r = t.entry.gridObject.getContainerNode();
                } catch (t) {
                  return;
                }
                var a = r.getBoundingClientRect(),
                  i = document.createElement("div");
                ((i.className = "gxp-root"),
                  (i.style.cssText =
                    "position:fixed;left:" +
                    a.left +
                    "px;top:" +
                    a.top +
                    "px;width:" +
                    a.width +
                    "px;height:" +
                    a.height +
                    "px;z-index:2147482995;"),
                  (i.innerHTML =
                    '<div class="gxp-pick-box" style="width:100%;height:100%;"><span class="gxp-pick-index">' +
                    String(o + 1).padStart(2, "0") +
                    "</span></div>"),
                  (i.querySelector(".gxp-pick-box").onclick = function () {
                    (l(), n.remove(), f(t.entry));
                  }),
                  document.body.appendChild(i),
                  e.push(i));
              }),
              document.addEventListener("keydown", function t(e) {
                "Escape" === e.key &&
                  (u(), document.removeEventListener("keydown", t));
              }));
          })(o);
  }
  function r() {
    if (!document.getElementById("__gxpStyle")) {
      var t = document.createElement("style");
      ((t.id = "__gxpStyle"),
        (t.textContent =
          '.gxp-root{all:initial;}.gxp-root *{box-sizing:border-box;font-family:var(--gxp-font-ui);}.gxp-root{  --gxp-ink:#161B22;--gxp-ink-2:#1E2530;--gxp-line:#2D3748;  --gxp-text:#E7EAF0;--gxp-muted:#8B95A5;  --gxp-accent:#E8A33D;--gxp-ok:#34C77B;--gxp-warn:#F2555A;  --gxp-font-ui:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;  --gxp-font-mono:ui-monospace,"SFMono-Regular","JetBrains Mono",Menlo,Consolas,monospace;}.gxp-panel{position:fixed;top:16px;right:16px;z-index:2147483000;width:272px;  background:var(--gxp-ink);border:1px solid var(--gxp-line);border-radius:10px;  box-shadow:0 12px 32px rgba(0,0,0,.45);color:var(--gxp-text);overflow:hidden;  animation:gxp-in .16s ease-out;}.gxp-panel-head{display:flex;align-items:center;justify-content:space-between;  padding:12px 14px;border-bottom:1px solid var(--gxp-line);}.gxp-title{font:600 11px/1 var(--gxp-font-mono);letter-spacing:.14em;  color:var(--gxp-muted);text-transform:uppercase;}.gxp-tag{font:600 11px/1 var(--gxp-font-mono);color:#1A1200;background:var(--gxp-accent);  padding:4px 8px;border-radius:4px;transform:rotate(-1.5deg);white-space:nowrap;}.gxp-body{padding:12px 14px 14px;}.gxp-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;}.gxp-btn{appearance:none;border:1px solid var(--gxp-line);background:var(--gxp-ink-2);  color:var(--gxp-text);font:500 12px/1 var(--gxp-font-ui);padding:9px 8px;border-radius:6px;  cursor:pointer;transition:border-color .12s,background .12s;}.gxp-btn:hover{border-color:var(--gxp-accent);background:#232B38;}.gxp-btn:focus-visible{outline:2px solid var(--gxp-accent);outline-offset:1px;}.gxp-btn-ghost{background:transparent;border-color:transparent;color:var(--gxp-muted);  width:100%;text-align:center;padding:7px 8px;margin-top:2px;}.gxp-btn-ghost:hover{color:var(--gxp-text);background:var(--gxp-ink-2);}.gxp-divider{height:1px;background:var(--gxp-line);margin:10px 0;}.gxp-label{font:600 10px/1 var(--gxp-font-mono);letter-spacing:.1em;color:var(--gxp-muted);  text-transform:uppercase;margin-bottom:8px;}@keyframes gxp-in{from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:translateY(0);}}.gxp-pick-banner{position:fixed;top:16px;left:50%;transform:translateX(-50%);  z-index:2147483000;background:var(--gxp-ink);border:1px solid var(--gxp-line);  color:var(--gxp-text);padding:9px 16px;border-radius:8px;  font:500 12.5px/1.4 var(--gxp-font-ui);box-shadow:0 8px 24px rgba(0,0,0,.4);}.gxp-pick-banner b{font-family:var(--gxp-font-mono);color:var(--gxp-accent);}.gxp-pick-box{position:fixed;z-index:2147482995;border:2px solid var(--gxp-accent);  background:rgba(232,163,61,.14);cursor:pointer;box-sizing:border-box;}.gxp-pick-index{position:absolute;top:-1px;left:-1px;transform:translateY(-100%);  background:var(--gxp-accent);color:#1A1200;font:700 11px/1 var(--gxp-font-mono);  padding:3px 7px;border-radius:4px 4px 0 0;}.gxp-toast-host{position:fixed;bottom:18px;right:16px;z-index:2147483001;  display:flex;flex-direction:column;gap:8px;align-items:flex-end;}.gxp-toast{font-family:var(--gxp-font-ui);background:var(--gxp-ink);color:var(--gxp-text);  border:1px solid var(--gxp-line);border-left:3px solid var(--gxp-accent);  border-radius:6px;padding:10px 14px;min-width:200px;max-width:300px;  box-shadow:0 8px 20px rgba(0,0,0,.4);font-size:12.5px;line-height:1.45;  animation:gxp-toast-in .18s ease-out;}.gxp-toast[data-type="ok"]{border-left-color:var(--gxp-ok);}.gxp-toast[data-type="warn"]{border-left-color:var(--gxp-warn);}.gxp-toast-label{font:700 9.5px/1 var(--gxp-font-mono);letter-spacing:.1em;  text-transform:uppercase;color:var(--gxp-muted);margin-bottom:4px;}@keyframes gxp-toast-in{from{opacity:0;transform:translateX(12px);}to{opacity:1;transform:translateX(0);}}@keyframes gxp-toast-out{from{opacity:1;transform:translateX(0);}to{opacity:0;transform:translateX(12px);}}'),
        document.head.appendChild(t));
    }
  }
  function a(t, e, n) {
    r();
    var o = (function () {
        var t = document.getElementById("__gxpToastHost");
        return (
          t ||
            (((t = document.createElement("div")).id = "__gxpToastHost"),
            (t.className = "gxp-root gxp-toast-host"),
            document.body.appendChild(t)),
          t
        );
      })(),
      a = document.createElement("div");
    ((a.className = "gxp-toast"), a.setAttribute("data-type", e || "info"));
    var i = n || ("warn" === e ? "주의" : "ok" === e ? "완료" : "알림");
    ((a.innerHTML =
      '<div class="gxp-toast-label">' + i + "</div><div>" + t + "</div>"),
      o.appendChild(a),
      setTimeout(function () {
        ((a.style.animation = "gxp-toast-out .16s ease-in forwards"),
          setTimeout(function () {
            a.remove();
          }, 160));
      }, 3200));
  }
  function i(t) {
    if (null == t) return "";
    var e = document.createElement("div");
    return (
      (e.innerHTML = String(t)),
      (e.textContent || "").replace(/\s+/g, " ").trim()
    );
  }
  function p(t) {
    var e = t.gridObject,
      n = e.getColumns().filter(function (t) {
        return t.field && "sel" !== t.field;
      }),
      o = (function (t) {
        try {
          if (t.dataView && "function" == typeof t.dataView.getItems)
            return t.dataView.getItems();
        } catch (t) {}
        try {
          var e = t.gridObject.getData();
          if (Array.isArray(e)) return e;
          if (e && "function" == typeof e.getItems) return e.getItems();
          if (
            e &&
            "function" == typeof e.getLength &&
            "function" == typeof e.getItem
          ) {
            for (var n = [], o = e.getLength(), r = 0; r < o; r++)
              n.push(e.getItem(r));
            return n;
          }
        } catch (t) {}
        return [];
      })(t);
    return {
      headers: n.map(function (t) {
        return i(t.name) || t.field;
      }),
      rows: o.map(function (t, o) {
        return n.map(function (n, r) {
          var a;
          try {
            a =
              "function" == typeof n.formatter
                ? i(n.formatter(o, r, t[n.field], n, t, e))
                : t[n.field];
          } catch (e) {
            a = t[n.field];
          }
          return null == a ? "" : String(a);
        });
      }),
    };
  }
  function c(t, e) {
    function n(t) {
      return (
        (t = String(t)),
        /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t
      );
    }
    var o = [t.map(n).join(",")];
    return (
      e.forEach(function (t) {
        o.push(t.map(n).join(","));
      }),
      "\ufeff" + o.join("\r\n")
    );
  }
  function d(t, e) {
    function n(t) {
      return String(t).replace(/[\t\r\n]/g, " ");
    }
    var o = [t.map(n).join("\t")];
    return (
      e.forEach(function (t) {
        o.push(t.map(n).join("\t"));
      }),
      "\ufeff" + o.join("\r\n")
    );
  }
  function x(t, e, n) {
    var o = new Blob([t], { type: n + ";charset=utf-8;" }),
      r = URL.createObjectURL(o),
      a = document.createElement("a");
    ((a.href = r),
      (a.download = e),
      document.body.appendChild(a),
      a.click(),
      setTimeout(function () {
        (URL.revokeObjectURL(r), a.remove());
      }, 1e3));
  }
  function s(t, e) {
    navigator.clipboard && navigator.clipboard.writeText
      ? navigator.clipboard
          .writeText(t)
          .then(function () {
            e(!0);
          })
          .catch(function () {
            g(t, e);
          })
      : g(t, e);
  }
  function g(t, e) {
    try {
      var n = document.createElement("textarea");
      ((n.value = t),
        (n.style.position = "fixed"),
        (n.style.opacity = "0"),
        document.body.appendChild(n),
        n.focus(),
        n.select());
      var o = document.execCommand("copy");
      (n.remove(), e(o));
    } catch (t) {
      e(!1);
    }
  }
  function l() {
    (e.forEach(function (t) {
      t.remove();
    }),
      (e = []));
  }
  function u() {
    l();
    var t = document.getElementById("__gxpPanel");
    (t && t.remove(), (window.__gridExportActive = !1));
  }
  function f(t) {
    r();
    var e = p(t),
      n = document.createElement("div");
    ((n.id = "__gxpPanel"),
      (n.className = "gxp-root"),
      (n.innerHTML =
        '<div class="gxp-panel">  <div class="gxp-panel-head">    <span class="gxp-title">그리드 내보내기</span>    <span class="gxp-tag">' +
        e.rows.length +
        " &times; " +
        e.headers.length +
        '</span>  </div>  <div class="gxp-body">    <div class="gxp-label">다운로드</div>    <div class="gxp-row">      <button class="gxp-btn" id="__gxpCsvDl">CSV</button>      <button class="gxp-btn" id="__gxpTsvDl">TSV</button>    </div>    <div class="gxp-divider"></div>    <div class="gxp-label">클립보드 복사</div>    <div class="gxp-row">      <button class="gxp-btn" id="__gxpCsvCp">CSV 복사</button>      <button class="gxp-btn" id="__gxpTsvCp">TSV 복사</button>    </div>    <button class="gxp-btn gxp-btn-ghost" id="__gxpClose">닫기</button>  </div></div>'),
      document.body.appendChild(n),
      (n.querySelector("#__gxpCsvDl").onclick = function () {
        (x(c(e.headers, e.rows), "grid_export.csv", "text/csv"),
          a("CSV 파일을 다운로드했습니다.", "ok", "다운로드 완료"));
      }),
      (n.querySelector("#__gxpTsvDl").onclick = function () {
        (x(
          d(e.headers, e.rows),
          "grid_export.tsv",
          "text/tab-separated-values",
        ),
          a("TSV 파일을 다운로드했습니다.", "ok", "다운로드 완료"));
      }),
      (n.querySelector("#__gxpCsvCp").onclick = function () {
        s(c(e.headers, e.rows), function (t) {
          t
            ? a("CSV 데이터를 클립보드에 복사했습니다.", "ok", "복사 완료")
            : a("클립보드 복사에 실패했습니다.", "warn", "복사 실패");
        });
      }),
      (n.querySelector("#__gxpTsvCp").onclick = function () {
        s(d(e.headers, e.rows), function (t) {
          t
            ? a("TSV 데이터를 클립보드에 복사했습니다.", "ok", "복사 완료")
            : a("클립보드 복사에 실패했습니다.", "warn", "복사 실패");
        });
      }),
      (n.querySelector("#__gxpClose").onclick = u));
  }
})();
