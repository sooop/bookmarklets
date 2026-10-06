# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개요

tracxlogis.com / qxpress.net 사내 웹앱에서 쓰는 북마클릿 도구 모음입니다.
빌드 시스템·패키지 매니저·테스트 러너·린터가 **없습니다**. `package.json`도 없고 의존성도 없습니다.
저장소의 `.js` 파일이 곧 배포 산출물이며, 정적 호스팅(jsDelivr / raw.githubusercontent.com)에서 직접 서빙됩니다.

## 배포 구조 — 로더 북마클릿 패턴

이 저장소의 핵심 아키텍처입니다. 파일 하나만 보고는 파악되지 않습니다.

1. `installer.html`을 브라우저로 열면, 사용자가 GitHub 계정/저장소/브랜치/파일 경로를 입력합니다.
2. 그 입력으로 **수백 바이트짜리 로더 북마클릿**(`javascript:` URL)을 생성합니다. 로더가 하는 일은
   `<script src="<지정 URL>?t=<Date.now()>">`를 페이지에 주입하는 것뿐입니다 (`buildLoaderHref()`).
3. 실제 로직은 저장소의 `.js` 파일에 있고, 북마클릿을 클릭할 때마다 CDN에서 새로 로드됩니다.

**결과: 배포 = `main`에 커밋/푸시.** 사용자는 북마클릿을 재설치할 필요가 없습니다.
raw.githubusercontent.com은 즉시 반영되고, jsDelivr는 CDN 캐시 지연이 있습니다.

로더는 `id="bkm-loader-9f2b"` 스크립트 태그를 재사용(기존 것 remove 후 재삽입)하므로,
`.js` 파일은 **같은 페이지에서 여러 번 실행될 수 있다**는 전제로 작성해야 합니다.

## 새 도구를 추가할 때

1. 저장소 루트에 `<이름>.js`를 만듭니다 (아래 규약 준수).
2. `installer.html`의 프리셋 칩(`.presets` 안 `data-preset="<파일명>"`)에 항목을 추가합니다.
3. `installer.html` 상단 `.lede` 설명의 파일 목록도 함께 갱신합니다.
4. 커밋/푸시하면 배포 완료입니다.

## 도구 스크립트 작성 규약

모든 `.js` 도구는 아래를 지킵니다. 공유 유틸 모듈이 없으므로 **각 파일이 완전히 자기완결적**이어야 하며,
토스트/클립보드 헬퍼가 파일마다 중복되는 것은 의도된 것입니다. 공통 모듈로 추출하지 마세요
(로더는 파일 하나만 로드합니다).

- **즉시실행 IIFE**, ES5 문법. `var`, 문자열 연결, `function` 표현식을 씁니다. 트랜스파일 단계가 없습니다.
- **재실행 안전성**: 시작하자마자 자신의 오버레이 DOM을 `getElementById(...)` → `remove()`로 제거합니다.
- **고유 ID 접미사**: 도구마다 충돌 방지용 해시 접미사를 씁니다 — `esw-*-9f2b`(env-switch),
  `qrb-*-8e4a`(qr-code), `__gep*`/`gep-*`(admin-grid-export), `__gxp*`/`gxp-*`(slick-grid-export).
  새 도구는 새 접미사를 정합니다.
- **CSS 격리**: `<style>`을 주입하되 셀렉터를 전부 오버레이 루트 ID로 한정하거나(`#esw-overlay-9f2b .foo`),
  루트에 `all:initial`을 겁니다(`.gxp-root`, `#__gepRoot`). 임의의 호스트 페이지 위에 얹히기 때문입니다.
- **z-index**: `2147483647` 부근(패널 2147483000, 토스트 2147483001 식으로 층을 나눔).
- **도메인 가드**: 실행 즉시 `location.hostname`을 `/(^|\.)tracxlogis\.com$/` 등으로 검사하고
  아니면 안내 후 종료합니다.
- **UI 문구는 한국어**, 모노스페이스 폰트 스택(`"JetBrains Mono","SF Mono",Consolas,...`).
- **다크 팔레트 공용**: 배경 `#14171F`/`#0B0D12`, 패널 `#1B1F2A`, 보더 `#262B38`, 텍스트 `#E4E7EE`,
  뮤트 `#8B93A7`, 상태색 green `#34D399` / amber `#FBBF24` / violet `#A78BFA`.
- **alert/confirm 지양** (admin-grid-export.js의 도메인 가드만 예외). 토스트로 알립니다.
- **설정 영속화**는 `localStorage`에 도구별 키로 저장하고 `try/catch`로 감쌉니다
  (`__esw_vm_config__`, `esw_installer_v2` 등).

## 각 도구의 역할

| 파일 | 하는 일 |
|---|---|
| `installer.html` | 로더 북마클릿 생성기. 다른 도구를 설치하는 진입점. localStorage에 입력값 유지 |
| `env-switch.js` | 현재 호스트명에서 서브도메인을 파싱해 Production / `staging-*` / VM 사이를 경로 유지한 채 전환. P/S/V 단축키. VM 판정은 학습값 > 규칙(3차 도메인 `-.*` 접미, 포트 유무) 순. 서비스별 Staging/VM 도메인 대응은 처음 한 번 질문해 `Domain=.<도메인>` 쿠키(+localStorage 폴백)에 저장. Shadow DOM 오버레이 |
| `qr-code.js` | 현재 URL을 QR로 표시. URL 길이에 따라 QR 픽셀 크기를 단계적으로 키움. 외부 API `api.qrserver.com` 의존 |
| `admin-grid-export.js` | **DHTMLX** 그리드 추출기. `window`를 순회해 `getColumnCount`/`cells`/`getRowsNum`/`getRowId`를 가진 객체를 찾음. 화면에서 직접 그리드를 클릭해 고르는 오버레이 제공. admin/qlps/tlsp/qwms 서브도메인 전용 |
| `slick-grid-export.js` | **SlickGrid** 추출기. `window.SlickGridFactory`를 iframe 3단계까지 재귀 탐색. 컬럼 formatter를 적용해 렌더된 값을 추출 |

두 그리드 추출기는 서로 다른 그리드 라이브러리를 대상으로 하며 코드를 공유하지 않습니다.

### 주의: 미니파이된 파일

`admin-grid-export.js`와 `slick-grid-export.js`는 **미니파이(식별자 맹글링) 후 포매팅된 상태로 커밋**되어
있습니다 (`e`, `t`, `o`, `_`, `q` 같은 한 글자 변수, 쉼표 연산자 체인). 원본 소스는 저장소에 없습니다.
이 두 파일을 수정할 때는 맹글링된 식별자를 그대로 두고 국소적으로 편집하거나,
전면 개편이 필요하면 사용자에게 원본 소스 존재 여부를 먼저 확인하세요.
`env-switch.js`와 `qr-code.js`는 일반 소스 형태이며 이쪽이 새 도구의 참고 기준입니다.

## 검증 방법

자동화된 테스트가 없습니다. 변경 확인은 수동입니다.

- 로컬 정적 서버로 `installer.html`을 열어 생성 URL/로더 동작을 확인:
  `python -m http.server 8000` → `http://localhost:8000/installer.html`
- 도구 `.js` 자체는 대상 사이트의 DevTools 콘솔에 파일 내용을 붙여넣어 실행하면
  로더를 거치지 않고 바로 검증할 수 있습니다.
- 문법 확인만 필요하면 `node --check <파일>.js`.
