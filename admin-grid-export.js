/*
 * 어드민 그리드 추출기 (DHTMLX Grid Export)
 * admin / qlps / tlsp / qwms 서브도메인의 *.tracxlogis.com 에서만 동작합니다.
 *
 * 이 파일은 북마클릿 로더가 <script src="...">로 동적 로드해서 실행하는 실제 로직입니다.
 * GitHub 등 정적 호스팅에 올려두고, 북마클릿(로더)은 이 파일의 URL만 참조합니다.
 */
!(function () {
  try {
    var e = location.hostname.toLowerCase().match(/^(.+)\.tracxlogis\.com$/);
    if (!e)
      return void alert(
        "이 북마클릿은 *.tracxlogis.com 사이트에서만 동작합니다.",
      );
    for (
      var t = e[1], o = ["admin", "qlps", "tlsp", "qwms"], n = !1, r = 0;
      r < o.length;
      r++
    )
      if (t.indexOf(o[r]) >= 0) {
        n = !0;
        break;
      }
    if (!n) return void alert("허용된 서브도메인이 아닙니다: " + t);
    var i = document.getElementById("__gepRoot");
    i && i.remove();
    var a = document.getElementById("__gepStyle");
    a && a.remove();
    var p = document.createElement("style");
    function d(e) {
      try {
        var t = e.entBox || e.obj;
        if (!t) return null;
        var o = getComputedStyle(t);
        if ("none" === o.display || "hidden" === o.visibility) return null;
        var n = t.getBoundingClientRect();
        return n.width <= 0 || n.height <= 0 ? null : n;
      } catch (e) {
        return null;
      }
    }
    function l(e) {
      var t = window.innerWidth,
        o = window.innerHeight,
        n = Math.max(e.left, 0),
        r = Math.max(e.top, 0),
        i = Math.min(e.right, t),
        a = Math.min(e.bottom, o);
      return i <= n || a <= r ? 0 : (i - n) * (a - r);
    }
    function c(e) {
      for (var t = e.getColumnCount(), o = [], n = [], r = 0; r < t; r++) {
        var i = !1;
        try {
          i = !!e.isColumnHidden && e.isColumnHidden(r);
        } catch (e) {}
        if (!i) {
          var a = "";
          try {
            a = e.getColLabel(r) || "";
          } catch (e) {}
          ((a = String(a)
            .replace(/<[^>]*>/g, "")
            .trim()),
            o.push(r),
            n.push(a || "Column" + (r + 1)));
        }
      }
      for (var p = e.getRowsNum(), d = [], l = 0; l < p; l++) {
        for (var c = e.getRowId(l), s = [], g = 0; g < o.length; g++) {
          var u = o[g],
            f = "";
          try {
            var x = e.cells(c, u),
              m = null;
            try {
              m = e.getColType ? e.getColType(u) : null;
            } catch (e) {}
            (null == (f = x.getValue()) && (f = ""),
              "object" == typeof f && (f = x.cell ? x.cell.textContent : ""),
              "ch" === m && (f = "1" === String(f) ? "Y" : "N"));
          } catch (e) {
            f = "";
          }
          ((f = String(f)
            .replace(/<[^>]*>/g, "")
            .replace(/\u00a0/g, " ")
            .trim()),
            s.push(f));
        }
        d.push(s);
      }
      return { headers: n, rows: d };
    }
    function s(e, t, o) {
      function n(e) {
        return (
          (e = null == e ? "" : String(e)),
          "\t" === o
            ? e.replace(/[\t\r\n]+/g, " ")
            : /[",\r\n]/.test(e)
              ? '"' + e.replace(/"/g, '""') + '"'
              : e
        );
      }
      var r = [e.map(n).join(o)];
      return (
        t.forEach(function (e) {
          r.push(e.map(n).join(o));
        }),
        r.join("\r\n")
      );
    }
    function g(e, t, o) {
      var n = new Blob(["\ufeff" + e], { type: o + ";charset=utf-8;" }),
        r = URL.createObjectURL(n),
        i = document.createElement("a");
      ((i.href = r),
        (i.download = t),
        document.body.appendChild(i),
        i.click(),
        setTimeout(function () {
          (document.body.removeChild(i), URL.revokeObjectURL(r));
        }, 1e3));
    }
    function u(e, t) {
      function o() {
        var o = document.createElement("textarea");
        ((o.value = e),
          (o.style.position = "fixed"),
          (o.style.left = "-9999px"),
          document.body.appendChild(o),
          o.focus(),
          o.select());
        try {
          (document.execCommand("copy"), b(t));
        } catch (e) {
          b("복사 실패: " + e.message);
        }
        document.body.removeChild(o);
      }
      navigator.clipboard && navigator.clipboard.writeText
        ? navigator.clipboard
            .writeText(e)
            .then(function () {
              b(t);
            })
            .catch(o)
        : o();
    }
    ((p.id = "__gepStyle"),
      (p.textContent =
        '#__gepRoot{all:initial;}#__gepRoot *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Malgun Gothic",sans-serif;}#__gepRoot .gep-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}#__gepPanel{position:fixed;top:16px;right:16px;z-index:2147483000;width:320px;background:#10161F;color:#EDEFF4;border:1px solid #2B3648;border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.45);}#__gepHead{border-radius:10px 10px 0 0;}#__gepHead{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#1A2333;border-bottom:1px solid #2B3648;cursor:move;user-select:none;}#__gepHead .gep-title{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;letter-spacing:.2px;}#__gepHead .gep-tagchip{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;background:#FFB020;color:#10161F;border-radius:4px;font-size:10px;font-weight:800;}#__gepClose{cursor:pointer;color:#8592A8;font-size:14px;line-height:1;padding:2px 4px;}#__gepClose:hover{color:#F2545B;}#__gepBody{padding:12px;}#__gepRoot label.gep-label{display:block;font-size:11px;color:#8592A8;margin-bottom:6px;}.gep-ddwrap{position:relative;margin-bottom:8px;}.gep-ddbtn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;background:#1A2333;border:1px solid #2B3648;border-radius:6px;padding:9px 10px;font-size:12px;color:#EDEFF4;cursor:pointer;text-align:left;}.gep-ddbtn:hover{border-color:#445068;}.gep-ddbtn .gep-ddtext{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.gep-ddbtn .gep-ddcaret{flex-shrink:0;color:#8592A8;font-size:10px;transition:transform .12s;}.gep-ddwrap.gep-ddopen .gep-ddcaret{transform:rotate(180deg);}.gep-ddlist{position:absolute;top:calc(100% + 4px);left:0;right:0;background:#1A2333;border:1px solid #2B3648;border-radius:6px;box-shadow:0 10px 28px rgba(0,0,0,.5);max-height:240px;overflow-y:auto;z-index:20;display:none;}.gep-ddwrap.gep-ddopen .gep-ddlist{display:block;}.gep-ddopt{padding:9px 10px;font-size:12px;color:#EDEFF4;cursor:pointer;border-bottom:1px solid #2B3648;line-height:1.45;white-space:normal;word-break:break-all;}.gep-ddopt:last-child{border-bottom:none;}.gep-ddopt:hover{background:#212C40;}.gep-ddopt.gep-ddopt-active{background:rgba(255,176,32,.12);color:#FFB020;}.gep-ddopt .gep-ddsub{display:block;font-size:10px;color:#8592A8;margin-top:2px;}.gep-ddopt.gep-ddopt-active .gep-ddsub{color:#c98a1f;}#__gepInfoRow{display:flex;align-items:center;justify-content:space-between;background:#1A2333;border:1px solid #2B3648;border-radius:6px;padding:8px 10px;margin-bottom:10px;}#__gepInfoRow .gep-num{font-size:16px;font-weight:700;color:#FFB020;}#__gepInfoRow .gep-sub{font-size:10px;color:#8592A8;margin-top:1px;}.gep-btnrow{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;}#__gepRoot button{cursor:pointer;border:1px solid #2B3648;background:#1A2333;color:#EDEFF4;border-radius:6px;padding:8px 6px;font-size:12px;font-weight:600;transition:border-color .12s,background .12s;}#__gepRoot button:hover{border-color:#445068;background:#212C40;}#__gepPick{width:100%;background:transparent;border:1px dashed #445068;color:#FFB020;margin-bottom:6px;}#__gepPick:hover{background:rgba(255,176,32,.08);border-color:#FFB020;}#__gepRescan{width:100%;background:transparent;color:#8592A8;font-size:11px;padding:5px;border:none;}#__gepRescan:hover{color:#EDEFF4;background:transparent;}#__gepToast{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483001;background:#FFB020;color:#10161F;font-size:12px;font-weight:700;padding:9px 16px;border-radius:20px;box-shadow:0 6px 20px rgba(0,0,0,.35);display:flex;align-items:center;gap:10px;}#__gepToast button{background:#10161F;color:#FFB020;border:none;border-radius:14px;padding:4px 10px;font-size:11px;font-weight:700;}.gep-tag{position:fixed;z-index:2147483000;cursor:pointer;}.gep-tag .gep-tagbox{position:relative;background:#FFB020;color:#10161F;font-weight:800;font-size:12px;padding:5px 10px 5px 14px;border-radius:0 4px 4px 0;box-shadow:0 4px 14px rgba(0,0,0,.4);clip-path:polygon(10px 0,100% 0,100% 100%,10px 100%,0 50%);}.gep-tag .gep-tagbox .gep-hole{position:absolute;left:3px;top:50%;transform:translateY(-50%);width:4px;height:4px;border-radius:50%;background:#10161F;opacity:.55;}.gep-tag .gep-tagsub{font-weight:600;font-size:9px;opacity:.75;margin-left:2px;}.gep-tag:hover .gep-tagbox{background:#FFCB6B;}.gep-frame{position:fixed;z-index:2147482999;border:2px solid #FFB020;border-radius:4px;background:rgba(255,176,32,.06);pointer-events:none;transition:border-color .15s;}.gep-frame.gep-active{border-color:#34D399;background:rgba(52,211,153,.08);}@keyframes gepFlash{0%{outline-color:#34D399;}100%{outline-color:transparent;}}.gep-flash{animation:gepFlash .6s ease-out;}#__gepPickLayer{all:initial;}'),
      document.head.appendChild(p));
    var f = [],
      x = window.globalActiveDHTMLGridObject;
    function m() {
      var e = (function () {
          var e = [],
            t = [];
          for (var o in window) {
            var n;
            try {
              n = window[o];
            } catch (e) {
              continue;
            }
            if (
              n &&
              "object" == typeof n &&
              "function" == typeof n.getColumnCount &&
              "function" == typeof n.cells &&
              "function" == typeof n.getRowsNum &&
              "function" == typeof n.getRowId
            ) {
              if (e.indexOf(n) >= 0) continue;
              (e.push(n), t.push({ name: o, grid: n }));
            }
          }
          return t;
        })(),
        t = e
          .map(function (e) {
            return { name: e.name, grid: e.grid, rect: d(e.grid) };
          })
          .filter(function (e) {
            return e.rect;
          });
      return (f = t.length
        ? t
        : e.map(function (e) {
            return { name: e.name, grid: e.grid, rect: null };
          }));
    }
    var v = null;
    function b(e, t, o) {
      var n = document.getElementById("__gepToast");
      n && n.remove();
      var r = document.createElement("div");
      return (
        (r.id = "__gepToast"),
        (r.innerHTML =
          "<span>" +
          e +
          "</span>" +
          (t ? '<button id="__gepToastCancel">취소</button>' : "")),
        document.body.appendChild(r),
        t
          ? r
              .querySelector("#__gepToastCancel")
              .addEventListener("click", function () {
                (r.remove(), o && o());
              })
          : (clearTimeout(v),
            (v = setTimeout(function () {
              r.parentNode && r.remove();
            }, 2200))),
        r
      );
    }
    var _ = document.createElement("div");
    ((_.id = "__gepRoot"),
      document.body.appendChild(_),
      (_.innerHTML =
        '<div id="__gepPanel"><div id="__gepHead"><div class="gep-title"><span class="gep-tagchip">G</span><span>그리드 데이터 추출</span></div><span id="__gepClose">&#10005;</span></div><div id="__gepBody"><label class="gep-label">대상 그리드</label><div class="gep-ddwrap" id="__gepDdWrap"><button type="button" id="__gepDdBtn" class="gep-ddbtn"><span class="gep-ddtext" id="__gepDdText">-</span><span class="gep-ddcaret">&#9662;</span></button><div class="gep-ddlist" id="__gepDdList"></div></div><button id="__gepPick">화면에서 직접 선택</button><div id="__gepInfoRow"><div><div class="gep-num gep-mono" id="__gepRowNum">0</div><div class="gep-sub">행 로드됨</div></div><div style="text-align:right"><div class="gep-num gep-mono" id="__gepColNum">0</div><div class="gep-sub">표시 컬럼</div></div></div><div class="gep-btnrow"><button id="__gepCsvDl">CSV 다운로드</button><button id="__gepTsvDl">TSV 다운로드</button><button id="__gepCsvCp">CSV 복사</button><button id="__gepTsvCp">TSV 복사</button></div><button id="__gepRescan">&#8635; 그리드 다시 탐색</button></div></div>'));
    var h = _.querySelector("#__gepPanel"),
      y = _.querySelector("#__gepHead"),
      w = _.querySelector("#__gepDdWrap"),
      C = _.querySelector("#__gepDdBtn"),
      k = _.querySelector("#__gepDdText"),
      E = _.querySelector("#__gepDdList"),
      F = 0;
    function L(e, t) {
      var o = 0,
        n = 0;
      try {
        ((o = e.grid.getRowsNum()), (n = e.grid.getColumnCount()));
      } catch (e) {}
      return {
        main: "G" + (t + 1) + " · " + e.name,
        sub: o + "행 · " + n + "컬럼",
      };
    }
    function S() {
      w.classList.remove("gep-ddopen");
    }
    function B(e) {
      ((F = e),
        (function () {
          var e = f[F];
          if (!e) return ((k.textContent = "그리드 없음"), void (k.title = ""));
          var t = L(e, F);
          ((k.textContent = t.main + " (" + t.sub + ")"),
            (k.title = t.main + " (" + t.sub + ")"));
        })(),
        E.querySelectorAll(".gep-ddopt").forEach(function (e) {
          e.classList.remove("gep-ddopt-active");
        }));
      var t = E.querySelector('[data-idx="' + e + '"]');
      (t && t.classList.add("gep-ddopt-active"), T());
    }
    function R() {
      ((E.innerHTML = ""),
        f.forEach(function (e, t) {
          var o = L(e, t),
            n = document.createElement("div");
          ((n.className = "gep-ddopt"),
            n.setAttribute("data-idx", t),
            (n.innerHTML =
              o.main + '<span class="gep-ddsub gep-mono">' + o.sub + "</span>"),
            n.addEventListener("click", function () {
              (B(t), S());
            }),
            E.appendChild(n));
        }));
      for (var e = 0, t = -1, o = 0; o < f.length; o++)
        if (f[o].grid === x) {
          t = o;
          break;
        }
      if (t >= 0) e = t;
      else {
        for (var n = -1, r = -1, i = 0; i < f.length; i++)
          if (f[i].rect) {
            var a = l(f[i].rect);
            a > r && ((r = a), (n = i));
          }
        n >= 0 && (e = n);
      }
      B(e);
    }
    function T() {
      var e = f[F];
      if (e) {
        var t = 0,
          o = 0;
        try {
          ((t = e.grid.getRowsNum()), (o = e.grid.getColumnCount()));
        } catch (e) {}
        ((_.querySelector("#__gepRowNum").textContent = t),
          (_.querySelector("#__gepColNum").textContent = o));
      }
    }
    function z() {
      return f[F].grid;
    }
    (m(),
      f.length || b("페이지에서 그리드를 찾을 수 없습니다."),
      R(),
      C.addEventListener("click", function (e) {
        (e.stopPropagation(), w.classList.toggle("gep-ddopen"));
      }),
      document.addEventListener("click", function (e) {
        w.contains(e.target) || S();
      }),
      T(),
      _.querySelector("#__gepClose").addEventListener("click", function () {
        (M(), _.remove(), p.remove());
      }),
      _.querySelector("#__gepRescan").addEventListener("click", function () {
        (m(),
          R(),
          T(),
          b(
            f.length
              ? "그리드 " + f.length + "개를 찾았습니다."
              : "그리드를 찾을 수 없습니다.",
          ));
      }),
      (_.querySelector("#__gepCsvDl").onclick = function () {
        var e = c(z());
        g(s(e.headers, e.rows, ","), "grid_export.csv", "text/csv");
      }),
      (_.querySelector("#__gepTsvDl").onclick = function () {
        var e = c(z());
        g(
          s(e.headers, e.rows, "\t"),
          "grid_export.tsv",
          "text/tab-separated-values",
        );
      }),
      (_.querySelector("#__gepCsvCp").onclick = function () {
        var e = c(z());
        u(s(e.headers, e.rows, ","), "CSV가 클립보드에 복사되었습니다.");
      }),
      (_.querySelector("#__gepTsvCp").onclick = function () {
        var e = c(z());
        u(s(e.headers, e.rows, "\t"), "TSV가 클립보드에 복사되었습니다.");
      }),
      (N = !1),
      (j = 0),
      (I = 0),
      (P = 0),
      (V = 0),
      y.addEventListener("mousedown", function (e) {
        if ("__gepClose" !== e.target.id) {
          N = !0;
          var t = h.getBoundingClientRect();
          ((j = e.clientX),
            (I = e.clientY),
            (P = t.left),
            (V = t.top),
            (h.style.right = "auto"),
            (h.style.top = V + "px"),
            (h.style.left = P + "px"),
            e.preventDefault());
        }
      }),
      document.addEventListener("mousemove", function (e) {
        N &&
          ((h.style.left = P + (e.clientX - j) + "px"),
          (h.style.top = V + (e.clientY - I) + "px"));
      }),
      document.addEventListener("mouseup", function () {
        N = !1;
      }));
    var D = null,
      q = !1,
      H = null;
    function M() {
      ((q = !1),
        D && (D.remove(), (D = null)),
        H &&
          (window.removeEventListener("scroll", H, !0),
          window.removeEventListener("resize", H, !0),
          (H = null)));
      var e = document.getElementById("__gepToast");
      e && e.remove();
    }
    function A(e) {
      (B(e),
        M(),
        b("G" + (e + 1) + " 그리드를 선택했습니다."),
        h.classList.add("gep-flash"),
        (h.style.outline = "2px solid #34D399"),
        setTimeout(function () {
          ((h.style.outline = "none"), h.classList.remove("gep-flash"));
        }, 650));
    }
    _.querySelector("#__gepPick").addEventListener("click", function () {
      q
        ? M()
        : (function () {
            function e() {
              ((D.innerHTML = ""),
                f.forEach(function (e, t) {
                  var o = d(e.grid) || e.rect;
                  if (o) {
                    var n = document.createElement("div");
                    ((n.className =
                      "gep-frame" + (t === F ? " gep-active" : "")),
                      (n.style.left = o.left + "px"),
                      (n.style.top = o.top + "px"),
                      (n.style.width = o.width + "px"),
                      (n.style.height = o.height + "px"),
                      D.appendChild(n));
                    var r = 0;
                    try {
                      r = e.grid.getRowsNum();
                    } catch (e) {}
                    var i = document.createElement("div");
                    ((i.className = "gep-tag"),
                      (i.style.left = o.left + "px"),
                      (i.style.top = Math.max(o.top - 2, 0) + "px"),
                      (i.innerHTML =
                        '<div class="gep-tagbox"><span class="gep-hole"></span>G' +
                        (t + 1) +
                        '<span class="gep-tagsub gep-mono">' +
                        r +
                        "행</span></div>"),
                      i.addEventListener("click", function (e) {
                        (e.stopPropagation(), A(t));
                      }),
                      D.appendChild(i),
                      (n.style.pointerEvents = "auto"),
                      (n.style.cursor = "pointer"),
                      n.addEventListener("click", function () {
                        A(t);
                      }));
                  }
                }));
            }
            (m(),
              R(),
              T(),
              f.length
                ? ((q = !0),
                  ((D = document.createElement("div")).id = "__gepPickLayer"),
                  document.body.appendChild(D),
                  e(),
                  (H = e),
                  window.addEventListener("scroll", H, !0),
                  window.addEventListener("resize", H, !0),
                  b("추출할 그리드를 클릭하세요.", !0, function () {
                    M();
                  }))
                : b("선택할 그리드가 없습니다."));
          })();
    });
  } catch (G) {
    alert("오류가 발생했습니다: " + G.message);
  }
  var N, j, I, P, V;
})();
