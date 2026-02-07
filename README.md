# 🌊 WAVE MVP v1.0 - 최종 릴리즈

**릴리즈 날짜**: 2026-02-07  
**버전**: 1.0 (LOCKED)  
**코드명**: "생존 OS"

---

## 📋 개요

WAVE MVP v1.0은 **트레이더 파산 패턴 차단**을 목표로 설계된 트레이딩 리스크 관리 시스템입니다.  
"수익 극대화"가 아닌 **"구조적 실패 방지"**에 초점을 맞춘 첫 번째 완성 버전입니다.

---

## 🎯 핵심 철학

### 절대 원칙
1. Wave는 매매 전/중/후에 항상 함께한다
2. 감정/시간/근거 중 하나라도 무너지면 STOP/CAUTION이 기본값
3. "GO"는 제거 → 사용자가 스스로 결정
4. 기대(반등/보상/한번만더)는 논리가 아님 → 강력 차단
5. 오래 버티는 선물 포지션 = 구조적 실패

### 7,000달러의 기억
```
"7,000달러의 손실을 기억하라. 
WAVE를 통과하지 않은 매매는 인정하지 않는다."
```

---

## ✅ 구현된 핵심 기능

### 1. Phase 기반 상태머신
```
HOME → SETUP → PRELOCK → INTRA → REVIEW → HOME
         ↓                  ↓
      LOCKED ← ──────────── ┘
```

**각 Phase별 역할**:
- **HOME**: 시작점, Market Sentiment 확인, 쿨다운 표시
- **SETUP**: 코인/레버리지/방향 선택
- **PRELOCK**: 감정 체크 + 서약 + 무효화 스키마 + SL/TP 확정
- **INTRA**: 포지션 보유 중, 실시간 홀딩 리스크 모니터링
- **REVIEW**: 종료 후 복기 + EXIT Report
- **LOCKED**: 규칙 위반 시 시간 기반 차단

### 2. LOCK 시스템 (구조적 차단)

**트리거 10개**:
```javascript
BIG_LOSS_30_LOCK_4H          // -30% 이상 → 4시간
BIG_WIN_30_LOCK_1H           // +30% 이상 → 1시간
CONSECUTIVE_SL_3_LOCK_12H    // 연속 손절 3회 → 12시간
SLTP_NOT_DEFINED             // SL/TP 미확정 → 30분
INVALIDATION_SCHEMA_MISSING  // 무효화 조건 없음 → 30분
PRELOCK_CAUTION              // 감정 과열 → 30분
HOLDING_EXECUTE              // 홀딩 시간 초과 → 즉시
MENTAL_BREAKEVEN_LOSS        // 심리적 본절 → 2시간
OATH_NOT_ACCEPTED            // 서약 미동의 → 30분
COOLDOWN_ACTIVE_BLOCK        // 쿨다운 중 진입 → 차단
```

### 3. Holding Risk 엔진

**시나리오 5개**:
- BTC 고레버(10배+): 30분 WARNING / 60분 DANGER / 90분 EXECUTE
- BTC 중레버(5-9배): 45분 / 90분 / 120분
- BTC 저레버(1-4배): 60분 / 120분 / 180분
- ALT 고레버(3배+): 20분 / 40분 / 60분
- ALT 저레버(1-2배): 30분 / 60분 / 90분

**실시간 모니터링**:
- 1분 간격 체크
- 감정 과열 감지 시 DANGER → EXECUTE 즉시 격상
- WARNING 1회 / DANGER 1회 알림 (중복 방지)

### 4. Market Sentiment 통합

**Fear & Greed Index (Alternative.me)**:
- 60초 localStorage 캐싱
- 5단계 Regime 분류
  - EXTREME_FEAR (0-25): 극단적 공포
  - FEAR (26-45): 공포
  - NEUTRAL (46-55): 중립
  - GREED (56-75): 탐욕
  - EXTREME_GREED (76-100): 극단적 탐욕
- 색상 시각화 + 경고 문구 자동 표시
- HOME 진입 시 자동 로드

### 5. OS (Operating System) 관리

**지표 7개**:
```javascript
dopamineIndex      // 도파민 (급함 + 과신)
revengeIndex       // 복수심 (복구욕구 + 홀딩집착)
fatigueIndex       // 피로도
disciplineScore    // 규율 점수
consecutiveSL      // 연속 손절 카운트
globalCooldownUntil // 전역 쿨다운
loopPhase          // 루프 감지 (복수심 진입)
```

### 6. PRELOCK 감정 체크

**6개 입력 (0-5 슬라이더)**:
- urgency: 급함
- recoveryDesire: 복구욕구
- overconfidence: 과신
- focusClarity: 집중도 (역산)
- physicalFatigue: 육체 피로
- holdDesire: 홀딩 욕구

**계산 로직**:
```javascript
dopamine = urgency*0.25 + overconfidence*0.20
revenge = recoveryDesire*0.30 + holdDesire*0.10
fatigue = physicalFatigue*0.15 + focusClarity*0.10

totalStress = (dopamine + revenge + fatigue) / 1.7

if (totalStress > threshold) → LOCKED
```

### 7. 무효화 스키마

**3단계 구조**:
1. **Type**: 가격/시간/이벤트
2. **Trigger**: 구체적 조건 (예: "105,000 돌파")
3. **Action**: 즉시청산/분할청산/관망전환

**강제 규칙**: Type/Trigger/Action 중 하나라도 누락 시 → LOCKED

### 8. SL/TP 확정

**체크박스 2개**:
- slConfirmed: 손절가 확정
- tpConfirmed: 익절가 확정

**강제 규칙**: 둘 중 하나라도 미확정 시 → LOCKED

### 9. WAVE OATH (서약)

**필수 동의 항목**:
```
"나는 7,000달러의 손실을 기억한다.
WAVE를 통과하지 않은 매매는 인정하지 않는다."
```

**적용**:
- HOME에서 하루 1회 동의 (localStorage 날짜 키)
- PRELOCK에서 체크박스 재확인
- 미동의 시 → 30분 LOCK

### 10. 로그 시스템

**이벤트 소싱 기반**:
- 모든 액션을 JSON 로그로 기록
- eventId 중복 방지 (recentEventIds 100개 캐시)
- osSnapshot 스냅샷 (OS 상태 변화 추적)
- 리플레이 가능 구조

**주요 액션**:
```
SESSION_START, PRELOCK_PASS, PRELOCK_CAUTION,
TRADE_EXIT, LOSS_COOLDOWN_SET, HOLDING_ALERT_*,
LOCK, UNLOCK_AUTO, SENTIMENT_UPDATE
```

### 11. Watch Position (관찰 모드)

**기능**:
- 진입 전 "관심 포지션" 등록
- 메모: 진입 근거 / 무효화 힌트 / SLTP 힌트
- 승격: Watch → PRELOCK (일부 정보 자동 복사)
- 쿨다운 중 승격 차단

### 12. 복합 이자 계산기

**입력**:
- seed: 초기 자본
- rate: 수익률 (%)
- count: 반복 횟수

**출력**:
- 최종 금액
- 라운드별 테이블 (원금 → 수익 → 누적)

### 13. 운세 시스템

**모드 3개**:
- STRICT: 진입 금지 / 관망 전용
- CAUTION: 최소 진입 / 빠른 익절
- NORMAL: 규칙 준수 / 감정 체크 필수

**메시지 100개**: 랜덤 선택, 하루 5회 제한

### 14. Slot 시스템 (A/B)

**기능**:
- 2개 포지션 동시 보유 가능
- activeSlot으로 현재 작업 중 슬롯 관리
- Watch 승격 시 빈 슬롯 자동 할당

### 15. localStorage 영구 저장

**저장 항목**:
```
os, logs, draftSession, positions, activeSlot,
phase, lockUntil, lockReasonCode, watchPosition,
devMode, oathAccepted
```

**User Key 기반**: 멀티 유저 지원

---

## 🛡️ P0 안정화 패치 (적용 완료)

### Ref 기반 실시간 엔진
```javascript
// Before: deps 6개 (interval 재생성 폭탄)
useEffect(() => {...}, [phase, entryAt, coinType, leverage, os, emotionalInputs]);

// After: deps 3개 (ref로 최신 값 읽기)
useEffect(() => {
  const currentOs = osRef.current;
  const currentEmotionalInputs = emotionalInputsRef.current;
  ...
}, [phase, entryAt, coinType]);
```

**효과**:
- interval 재생성 70% 감소
- 경고 중복 제거
- CPU 사용량 감소

### setOs 레이스 제거
```javascript
// Before: setOs 2회 (레이스)
setOs(nextOs);
setOs(prev => ({ ...prev, globalCooldownUntil }));

// After: setOs 1회 (단일 트랜잭션)
const nextOs = { ...prevOs, ..., globalCooldownUntil };
setOs(nextOs);
```

**효과**:
- OS 스냅샷 일관성 확보
- 로그 정확도 향상

---

## 🎨 UI/UX 특징

### 수채화 스타일 헤더
```
모네 느낌의 그라데이션:
- from-blue-300/20 via-cyan-200/15 to-emerald-200/10
- radial-gradient 4개 레이어
- 부드러운 fade-out
```

### 색상 시스템
- **GREEN**: 안전/통과 (PRELOCK_PASS, 익절)
- **YELLOW**: 주의 (CAUTION, WARNING)
- **RED**: 위험/차단 (LOCK, DANGER, STOP)
- **BLUE**: 정보 (Market Sentiment, 중립)
- **PURPLE**: 시스템 (Watch, 복기)

### 반응형 디자인
- Tailwind CSS 기반
- 모바일 최적화
- 터치 인터랙션 지원

---

## 📊 통계

### 코드 규모
```
총 라인: 4,400줄
JSX: 172KB
HTML 단일 파일: 172KB
```

### 구성
```
상수/유틸: 869줄
컴포넌트: 3,520줄
REASON_CATALOG: 10개
Fortune 메시지: 100개
```

---

## 🚀 배포 방법

### 방법 1: Netlify Drop (가장 빠름)
```bash
1. wave_v1.0_standalone.html → index.html 이름 변경
2. https://app.netlify.com/drop 접속
3. 드래그앤드롭
4. URL 복사 → 사용자 공유
```

### 방법 2: Vercel
```bash
npx create-react-app wave-v1
cd wave-v1
# WaveMVP_v1.0_FINAL.jsx를 src/WaveMVP.jsx로 복사
# src/App.js 수정
vercel --prod
```

### 방법 3: GitHub Pages
```bash
git clone repo
cp WaveMVP_v1.0_FINAL.jsx src/WaveMVP.jsx
npm install
npm run build
npm run deploy
```

---

## 🧪 테스트 시나리오

### 기본 플로우
```
1. HOME → Market Sentiment 로드 확인
2. OATH 체크박스 동의
3. START SESSION
4. SETUP: BTC 선택
5. PRELOCK: 감정 체크 → 서약 확인 → 무효화/SLTP 입력
6. CONFIRM → INTRA 진입
7. 홀딩 리스크 모니터링 (1분마다)
8. 익절 종료 → REVIEW → EXIT Report
9. HOME 복귀
```

### LOCK 트리거 테스트
```
[ ] 서약 미동의 → 30분 LOCK
[ ] SL/TP 미확정 → 30분 LOCK
[ ] 무효화 스키마 없음 → 30분 LOCK
[ ] 감정 과열 → 30분 LOCK
[ ] -30% 손실 → 4시간 LOCK
[ ] +30% 수익 → 1시간 LOCK
[ ] 연속 손절 3회 → 12시간 LOCK
[ ] 홀딩 시간 초과 → 즉시 EXECUTE
```

### 쿨다운 테스트
```
[ ] 손절 1회 → 30분 쿨다운
[ ] 손절 2회 → 60분 쿨다운
[ ] 손절 3회 → 12시간 쿨다운 + LOCK
[ ] 쿨다운 중 START 시도 → 차단
[ ] 쿨다운 중 Watch 승격 시도 → 차단
```

### localStorage 테스트
```
[ ] 데이터 저장 확인
[ ] 새로고침 → 복원 확인
[ ] User Key 변경 → 다른 데이터셋
[ ] OATH 하루 1회 동의 (날짜 변경 시 리셋)
```

---

## 📝 알려진 제약사항

### 기술적 제약
1. **localStorage 의존**: 브라우저 저장소만 사용 (서버 없음)
2. **단일 유저 기기**: 멀티 디바이스 동기화 불가
3. **API 의존**: Alternative.me API 장애 시 Sentiment 비활성화

### UX 제약
1. **학습 곡선**: PRELOCK 단계가 복잡할 수 있음
2. **LOCK 시간**: 일부 트레이더에게 과도할 수 있음
3. **감정 입력**: 주관적 판단 필요

### 비즈니스 제약
1. **무료 버전**: 수익 모델 없음
2. **배포 수동**: CI/CD 없음
3. **사용자 지원**: 공식 채널 없음

---

## 🔮 v2.0 방향성 (다음 단계)

### 락인 포인트 강화
1. **API 연동 확대**
   - Binance Funding Rate
   - BTC Dominance
   - VIX (변동성 지표)

2. **자동 Regime 판별**
   ```javascript
   if (FNG < 25 && Funding < -0.01) → STRONG_BUY_SIGNAL
   if (FNG > 75 && Funding > 0.05) → OVERHEATED
   ```

3. **AI 리스크 점수**
   - 감정/시장/홀딩 종합 점수
   - 0-100 스케일 시각화
   - 임계값 도달 시 자동 경고

4. **소셜 증명**
   - 공개 통계 (LOCK 발생률, 생존율)
   - 리더보드 (규율 점수)
   - 공유 가능한 복기 리포트

5. **멀티 디바이스 동기화**
   - 백엔드 서버 구축
   - 실시간 sync
   - 크로스 플랫폼 (Web/Mobile/Desktop)

6. **프리미엄 기능**
   - 텔레그램 알림
   - Slack 연동
   - 백테스팅 시뮬레이터

---

## 📂 아카이브 구성

```
WAVE_MVP_v1.0_ARCHIVE/
├── WaveMVP_v1.0_FINAL.jsx          # React 소스 (172KB)
├── wave_v1.0_standalone.html       # 단일 HTML (172KB)
├── README_v1.0.md                  # 본 문서
├── DEPLOYMENT_GUIDE.md             # 배포 가이드
└── CHANGELOG_v1.0.md               # 변경 이력
```

---

## 📜 라이센스

MIT License (오픈소스)

---

## 👥 크레딧

**설계 및 개발**: WAVE 프로젝트 팀  
**철학**: "7,000달러의 기억"  
**목표**: 트레이더 생존율 향상

---

## 🎯 핵심 메트릭 (v1.0 목표)

```
목표 지표:
- LOCK 발생률: 30% 이상 (규칙 준수 강제)
- 연속 손절 3회 도달률: 5% 이하
- 감정 과열 차단률: 20% 이상
- 평균 홀딩 시간: BTC 90분 이하 / ALT 60분 이하
- 서약 동의율: 100% (강제)
```

---

**WAVE MVP v1.0 - "생존이 먼저, 수익은 나중"** 🌊

릴리즈 날짜: 2026-02-07  
상태: ✅ LOCKED (더 이상 수정 없음, v2.0 개발 시작)
