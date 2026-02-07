import React, { useState, useEffect, useMemo, useRef } from 'react';

// ============================================================================
// WAVE OS v1.1 - Trading Risk Management OS
// Single-file React component with localStorage persistence
// ============================================================================

// ============================================================================
// BRAND VISION - 생존 OS 핵심 메시지
// ============================================================================
const WAVE_VISION = {
  primary: "7,000달러의 손실을 기억하라. WAVE를 통과하지 않은 매매는 인정하지 않는다.",
  alternatives: [
    "WAVE는 수익이 아니라 생존을 강제한다. 통과하지 않으면 매매가 아니다.",
    "규칙을 통과한 매매만 남는다. 나머지는 전부 충동이다."
  ]
};

// ============================================================================
// MARKET SENTIMENT API - 외부 지표 통합
// ============================================================================
const SENTIMENT_API = {
  FNG_URL: "https://api.alternative.me/fng/?limit=1&format=json",
  CACHE_TTL_MS: 60000, // 60초
  CACHE_KEY: "wave.market.fng"
};

// Sentiment 판정 기준
const SENTIMENT_THRESHOLDS = {
  EXTREME_FEAR: 25,    // 0-25: 극단적 공포
  FEAR: 45,            // 26-45: 공포
  NEUTRAL: 55,         // 46-55: 중립
  GREED: 75,           // 56-75: 탐욕
  EXTREME_GREED: 100   // 76-100: 극단적 탐욕
};

// ============================================================================
// REASON CATALOG - OS-level explanation system
// ============================================================================
const REASON_CATALOG = {
  BIG_LOSS_30_LOCK_4H: {
    title: '큰 손실 감지 (-30% 이상)',
    desc: '감정적 복구 시도를 막기 위해 시스템이 4시간 거래를 차단했습니다.',
    nextActionOne: '손실 원인을 기록하고, 규칙 위반 여부를 점검하세요.',
    unlockRuleOneLine: '4시간 후 자동 해제 (복구 시도 금지)',
    severity: 'P3'
  },
  BIG_WIN_30_LOCK_1H: {
    title: '큰 수익 달성 (+30% 이상)',
    desc: '과도한 자신감으로 인한 손실을 막기 위해 1시간 휴식을 강제합니다.',
    nextActionOne: '수익의 50%를 출금하거나, 오늘 거래를 종료하세요.',
    unlockRuleOneLine: '1시간 후 해제 (당일 재진입 시 리스크 2배)',
    severity: 'P2'
  },

  CONSECUTIVE_SL_1_LOCK_30M: {
    title: '손실 발생 - 30분 쿨다운',
    desc: '첫 손실 후 즉각 재진입은 복수 심리를 유발합니다.',
    nextActionOne: '30분간 거래에서 벗어나 손실 원인을 기록하세요.',
    unlockRuleOneLine: '30분 후 자동 해제',
    severity: 'P1'
  },
  CONSECUTIVE_SL_2_LOCK_60M: {
    title: '연속 손절 2회 - 60분 쿨다운',
    desc: '2연속 손절은 시장 타이밍 불일치 신호입니다.',
    nextActionOne: '60분간 휴식하며 공통 실패 패턴을 분석하세요.',
    unlockRuleOneLine: '60분 후 자동 해제',
    severity: 'P2'
  },
  CONSECUTIVE_SL_3_LOCK_12H: {
    title: '연속 손절 3회 - 12시간 강제 휴식',
    desc: '3연속 손절은 오늘 시장과 맞지 않는 신호입니다.',
    nextActionOne: '12시간 거래 금지. 충분한 휴식 후 재개하세요.',
    unlockRuleOneLine: '12시간 후 자동 해제',
    severity: 'P3'
  },
  LOSS_COOLDOWN_ACTIVE: {
    title: '손실 후 재진입 냉각 시간',
    desc: '손실 직후 즉각 재진입은 복수 심리와 판단 왜곡을 유발합니다.',
    nextActionOne: '거래하지 마세요. 마지막 손실을 복기하고 원인을 기록하세요.',
    unlockRuleOneLine: '2시간 후 자동 해제',
    severity: 'P2'
  },
  SLTP_NOT_DEFINED: {
    title: '손절/익절 미확인',
    desc: 'SL/TP 없는 진입은 감정 기반 청산으로 이어집니다.',
    nextActionOne: '손절가와 익절가를 먼저 확정하세요.',
    unlockRuleOneLine: '30분 후 해제',
    severity: 'P1'
  },
  INVALIDATION_SCHEMA_MISSING: {
    title: '무효화 조건 미정의',
    desc: '무효화 조건이 명확하지 않으면 손절 지연과 희망 홀딩으로 이어집니다.',
    nextActionOne: '무효화 타입/트리거/액션을 명확히 정의하세요.',
    unlockRuleOneLine: '30분 후 해제 (스키마 완성 필수)',
    severity: 'P1'
  },
  AUTO_LOCK: {
    title: 'STOP 한도 초과',
    desc: '오늘 STOP 횟수가 한도를 초과했습니다.',
    nextActionOne: '오늘 거래를 종료하고 로그를 복기하세요.',
    unlockRuleOneLine: '4시간 후 해제',
    severity: 'P3'
  },
  PRELOCK_CAUTION: {
    title: '진입 조건 불충분',
    desc: 'PRELOCK 체크에서 위험 신호가 감지되었습니다.',
    nextActionOne: '진입 근거를 재점검하세요.',
    unlockRuleOneLine: '30분 후 해제',
    severity: 'P1'
  },
  MANUAL_STOP: {
    title: '수동 정지 (위험 감지)',
    desc: '사용자가 직접 위험을 감지하여 거래를 중단했습니다.',
    nextActionOne: '위험 요인을 기록하고, 냉정하게 상황을 재평가하세요.',
    unlockRuleOneLine: '2시간 후 해제',
    severity: 'P2'
  },
  HOLDING_POSITION_UNCLEAR: {
    title: '홀딩 근거 불명확',
    desc: '장시간 홀딩 중 근거가 불명확하면 청산 위험이 급증합니다.',
    nextActionOne: '포지션을 즉시 재평가하고, 확신이 없으면 청산하세요.',
    unlockRuleOneLine: '사용자 확인 후 해제',
    severity: 'P2'
  },
  
  // ⭐ P1: HOLDING_RISK 관련 추가
  HOLDING_RISK_FULL_EXIT: {
    title: '홀딩 리스크: 강제 청산',
    desc: '보유 시간이 레버리지 제한 또는 위험 조건을 초과했습니다.',
    nextActionOne: '즉시 청산 후 2시간 휴식하세요.',
    unlockRuleOneLine: '2시간 후 자동 해제',
    severity: 'P3'
  },
  HOLDING_RISK_REDUCE: {
    title: '홀딩 리스크: 50% 감축',
    desc: '위험 구간 진입으로 포지션을 줄여야 합니다.',
    nextActionOne: '즉시 물량의 50%를 청산하세요.',
    unlockRuleOneLine: '사용자 확인 후 진행',
    severity: 'P2'
  },
  MENTAL_BREAKEVEN_LOSS: {
    title: '심리적 본절로스 감지',
    desc: 'fatigue/revenge/hold가 과열되어 복구 심리 위험이 큽니다.',
    nextActionOne: '2시간 거래 금지 + 복기 작성.',
    unlockRuleOneLine: '2시간 후 자동 해제',
    severity: 'P3'
  },
  
  // ⭐ 생존 OS 강제 규칙
  OATH_NOT_ACCEPTED: {
    title: 'WAVE 서약 미동의',
    desc: 'WAVE를 통과하지 않은 매매는 인정하지 않습니다. 서약 체크 없이는 진입할 수 없습니다.',
    nextActionOne: '서약에 동의한 후 PRELOCK을 다시 진행하세요.',
    unlockRuleOneLine: '30분 후 자동 해제',
    severity: 'P1'
  },
  COOLDOWN_ACTIVE_BLOCK: {
    title: '쿨다운 중 진입 차단',
    desc: '손실 후 쿨다운 시간이 활성화되어 있습니다. 복구 심리 차단을 위해 모든 진입을 금지합니다.',
    nextActionOne: '쿨다운 종료 후 재시도하세요. 손실 원인을 복기하세요.',
    unlockRuleOneLine: '쿨다운 만료 시 자동 해제',
    severity: 'P2'
  }
};

// Daily Fortune Messages (100 items - trading focused)
const FORTUNE_MESSAGES = [
  '오늘은 수익보다 규칙이 돈이다.',
  '작게 먹고 오래 살아남는 날.',
  '기회는 흔하지만 진입은 희소해야 한다.',
  '확신이 60%면 관망이 정답이다.',
  '한 번의 실수보다 복구심리가 더 위험하다.',
  '익절은 기술, 손절은 생존이다.',
  '오늘은 레버리지를 한 단계만 낮춰도 이긴다.',
  '시장에 맞서지 말고 시장에 붙어라.',
  '급할수록 눌러 담는 진입을 경계하라.',
  '손익비가 깨지면 운도 깨진다.',
  '내가 조급하면 시장이 먹잇감으로 본다.',
  '수익 난 뒤 10분 쉬면 돈이 남는다.',
  '확률이 아닌 감정으로 진입하면 통장으로 배운다.',
  "오늘은 \"안 하는 것\"이 최고의 트레이드다.",
  '패턴이 아니라 리스크가 너를 살린다.',
  '진입 근거가 말로 설명 안 되면 진입하지 마라.',
  '호흡이 거칠면 포지션이 거칠어진다.',
  '작은 손실을 존중하면 큰 수익이 온다.',
  '큰 수익 뒤에는 큰 착각이 따라온다.',
  '한 번의 빅윈은 실력, 두 번은 자만일 수 있다.',
  '시장은 네가 이기길 원치 않는다. 네가 실수하길 원한다.',
  "오늘은 \"대기\"가 수익률을 올린다.",
  '손절 후 바로 재진입은 운세가 아니라 습관이다.',
  '좋은 자리라도 지금 컨디션이면 나쁜 자리다.',
  '이상하게 잘 풀리면 멈추고 점검해라.',
  '운이 좋아도 규칙이 없으면 다 뺏긴다.',
  '오늘의 돈은 내일의 습관에서 나온다.',
  '확률이 맞아도 포지션 크기가 틀리면 진다.',
  '진입 타이밍보다 청산 규칙이 더 큰 돈을 만든다.',
  '네가 시장을 믿지 말고, 네 규칙을 믿어라.',
  '오늘은 수익을 키우기보다 손실을 줄이는 날.',
  '시장이 주는 힌트는 조용히 온다.',
  '한 번 더 볼까?가 계좌를 지키는 질문이다.',
  '변동성이 크면 욕심도 크게 온다. 둘 다 줄여라.',
  '체결이 빨라질수록 판단은 느려져야 한다.',
  '오른다고 해서 내 자리인 건 아니다.',
  '내가 틀릴 수 있다는 전제를 지키면 돈이 남는다.',
  '승률보다 기대값을 챙겨라.',
  "오늘은 \"소액\"으로 감각만 확인해라.",
  '하루 1번 좋은 트레이드가 한 달을 먹인다.',
  '손절을 못하면 익절도 못한다.',
  "운이 좋은 날은 '안전하게' 먹는 날이다.",
  '너의 최고의 무기는 버튼을 안 누르는 힘이다.',
  '시장은 네 감정의 거울이다.',
  '오늘은 4시간봉이 답을 준다.',
  '짧게 먹어도 규칙이면 복리다.',
  '손실을 숨기면 다음 손실이 커진다.',
  '운이 아니라 루틴이 부를 만든다.',
  "오늘은 \"정리\"가 수익이다.",
  '느낌이 아니라 체크리스트가 돈이다.',
  '한 번의 FOMO가 열 번의 노력이 날아간다.',
  '기대가 커지면 손절이 늦어진다.',
  '진입이 쉬우면 청산이 어렵다. 반대로 해라.',
  "오늘은 \"먼저 보호\"하면 돈이 따라온다.",
  '리스크를 줄이면 기회가 늘어난다.',
  '급등은 기회가 아니라 함정일 수 있다.',
  "오늘은 \"기다림\"이 배당이다.",
  '확신 없는 확장(추매)은 재물운을 깎는다.',
  '한 번의 좋은 손절이 한 번의 좋은 익절이다.',
  '승리의 날엔 더 천천히 움직여라.',
  '지루함을 못 참으면 계좌도 못 참는다.',
  "오늘은 \"적은 거래\"가 정답이다.",
  '너의 규칙을 깨려는 마음이 오늘의 적이다.',
  '회복 욕구가 올라오면 손을 떼라.',
  '큰 파도엔 작은 배를 띄우지 마라.',
  '좋은 시그널은 단순하다. 복잡하면 의심해라.',
  '오늘은 수익률보다 생존률을 챙겨라.',
  '딱 한 번만 더가 계좌를 부순다.',
  '지금 들어가면 후회할 것 같으면 그게 답이다.',
  '포지션 크기 줄이면 마음이 맑아진다.',
  "오늘은 \"손실을 늦추지 않는 날\".",
  '내가 흔들리면 시장은 더 흔든다.',
  '패배를 인정하면 돈이 남는다.',
  '한 번의 냉정함이 한 달을 살린다.',
  '오늘은 단타보다 "타점"이 중요하다.',
  '매매는 전쟁이 아니라 운영이다.',
  '시장과 싸우지 말고, 내 욕심과 싸워라.',
  '오늘은 수익보다 로그가 더 값지다.',
  '좋은 자리에서도 욕심은 손실로 바뀐다.',
  '수익이 나면 절반을 지키는 날.',
  '손절이 빨라질수록 재물운이 좋아진다.',
  '오늘은 분봉보다 큰 프레임을 보라.',
  '내가 급하면 확률이 내려간다.',
  '거래 횟수 줄이면 실력이 보인다.',
  "오늘은 \"확인 후 진입\"이 돈이다.",
  '운이 좋으면 스스로 멈추는 능력이 필요하다.',
  '익절은 빠르고, 재진입은 느리게.',
  '추세를 믿되, 손절을 더 믿어라.',
  "오늘은 '안전한 수익'이 최고의 수익.",
  '시장이 빠르면 나는 천천히.',
  '내가 맞아도 타이밍이 틀리면 진다.',
  '오늘은 리스크를 줄이는 결단이 돈을 만든다.',
  '감정이 올라오면 레버리지를 내려라.',
  '확신이 있어도 룰이 없으면 운이 아니다.',
  '오늘은 손실을 작게 만들면 큰 운이 온다.',
  '한 번의 멈춤이 다음 기회를 키운다.',
  '시장에 감사하면 욕심이 줄어든다.',
  "오늘은 \"계좌 보호\"가 재물운이다.",
  '지나친 자신감은 운을 깎는다.',
  '돈은 빠른 손이 아니라 정확한 손에 간다.',
  "오늘은 \"한 번만\"이 아니라 \"한 번도\"가 답일 수 있다."
];

// Fortune Mode Mapping (score → mode + rule)
// Fortune Modes (no score needed)
const FORTUNE_MODES = [
  { mode: "관망 모드", rule: "진입하지 않는 게 최고의 트레이드다.", color: "text-slate-300" },
  { mode: "수비 모드", rule: "오늘은 손실 최소화가 정답이다.", color: "text-cyan-300" },
  { mode: "균형 모드", rule: "소액으로 감각만 확인하고 확신 없으면 멈춰라.", color: "text-emerald-300" },
  { mode: "공격 모드", rule: "기회가 오면 짧게, 규칙대로만 먹고 빠져라.", color: "text-yellow-300" },
];


// Emotional Bar Component - 클릭 위치로 0-5 값 결정
const EMO_LABELS = ['매우 낮음', '낮음', '보통', '높음', '매우 높음', '과열'];


// [3] 심리 그래프 컴포넌트 (SVG)
// ============================================================================
// HOOKS
// ============================================================================

function useContainerWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof ResizeObserver === 'undefined') return; // ✅ 방어 코드

    const ro = new ResizeObserver((entries) => {
      const cw = Math.floor(entries[0]?.contentRect?.width || 0);
      if (cw > 0) setW(cw);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, w];
}

// ============================================================================
// COMPONENTS
// ============================================================================

const PsychologyGraph = ({ logs, width = 600, height = 200 }) => {
  const recentLogs = logs.slice(-60).filter(log => log.os); // 최근 60개, os 스냅샷 있는 것만
  
  if (recentLogs.length < 2) {
    return <div className="text-slate-500 text-sm">데이터가 부족합니다 (최소 2개 이벤트 필요)</div>;
  }
  
  const padding = 40;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;
  
  // 데이터 추출
  const dopamineData = recentLogs.map((log, i) => ({
    x: (i / (recentLogs.length - 1)) * graphWidth + padding,
    y: height - padding - ((log.os.dopamineIndex / 100) * graphHeight)
  }));
  
  const revengeData = recentLogs.map((log, i) => ({
    x: (i / (recentLogs.length - 1)) * graphWidth + padding,
    y: height - padding - ((log.os.revengeIndex / 100) * graphHeight)
  }));
  
  const fatigueData = recentLogs.map((log, i) => ({
    x: (i / (recentLogs.length - 1)) * graphWidth + padding,
    y: height - padding - ((log.os.fatigueIndex / 100) * graphHeight)
  }));
  
  const toPath = (data) => {
    return data.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  };
  
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="bg-slate-900/40 rounded"
    >
      {/* Grid */}
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#475569" strokeWidth="1" />
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#475569" strokeWidth="1" />
      
      {/* Y-axis labels */}
      <text x={padding - 30} y={padding} fill="#94a3b8" fontSize="10">100</text>
      <text x={padding - 30} y={height - padding} fill="#94a3b8" fontSize="10">0</text>
      
      {/* Lines */}
      <path d={toPath(dopamineData)} fill="none" stroke="#ef4444" strokeWidth="2" />
      <path d={toPath(revengeData)} fill="none" stroke="#f97316" strokeWidth="2" />
      <path d={toPath(fatigueData)} fill="none" stroke="#eab308" strokeWidth="2" />
      
      {/* Legend */}
      <g transform={`translate(${Math.max(10, width - 170)}, 20)`}>
        <line x1="0" y1="0" x2="20" y2="0" stroke="#ef4444" strokeWidth="2" />
        <text x="25" y="4" fill="#ef4444" fontSize="10">Dopamine</text>
        
        <line x1="0" y1="15" x2="20" y2="15" stroke="#f97316" strokeWidth="2" />
        <text x="25" y="19" fill="#f97316" fontSize="10">Revenge</text>
        
        <line x1="0" y1="30" x2="20" y2="30" stroke="#eab308" strokeWidth="2" />
        <text x="25" y="34" fill="#eab308" fontSize="10">Fatigue</text>
      </g>
    </svg>
  );
};

// Responsive wrapper for PsychologyGraph
const ResponsiveGraph = ({ logs, height = 220 }) => {
  const [graphRef, graphW] = useContainerWidth();
  const W = Math.max(320, graphW || 620); // 최소 폭 보장
  
  return (
    <div ref={graphRef} className="w-full">
      <PsychologyGraph logs={logs} width={W} height={height} />
    </div>
  );
};

const EmotionalBar = ({ value, onChange }) => {
  const ref = useRef(null);

  const pick = (clientX) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const ratio = rect.width ? x / rect.width : 0;
    const v = Math.min(5, Math.max(0, Math.floor(ratio * 6))); // 0~5
    onChange(v);
  };

  const filled = value === null ? 0 : (value + 1) / 6;

  return (
    <div className="space-y-2">
      <div
        ref={ref}
        onClick={(e) => pick(e.clientX)}
        className="w-full h-10 rounded-lg bg-slate-700 cursor-pointer relative overflow-hidden"
        role="button"
        aria-label="감정 강도 선택 바"
      >
        <div
          className="absolute left-0 top-0 h-full bg-blue-600 transition-all"
          style={{ width: `${filled * 100}%` }}
        />
        {/* 가이드 구분선(6칸) */}
        <div className="absolute inset-0 flex">
          {[0,1,2,3,4,5].map(i => (
            <div key={i} className={`flex-1 border-l ${i===0 ? 'border-l-0' : 'border-slate-800/70'}`} />
          ))}
        </div>
        {/* 현재 라벨 */}
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
          {value === null ? '탭해서 선택' : EMO_LABELS[value]}
        </div>
      </div>

      {/* 빠른 취소(실수 되돌리기) */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-slate-400 hover:text-white"
        >
          선택 해제
        </button>
      </div>
    </div>
  );
};

// ========== HOLDING RISK CONFIGURATION ==========
const HOLDING_RISK_CONFIG = {
  // 레버리지별 최대 허용 시간 (분)
  LEVERAGE_TIME_LIMITS: {
    BTC: {
      low: { max: 3, limit: 360 },      // 1~3배: 6시간
      mid: { max: 10, limit: 240 },     // 4~10배: 4시간
      high: { max: 15, limit: 120 },    // 11~15배: 2시간
    },
    ALT: {
      low: { max: 2, limit: 120 },      // 1~2배: 2시간
      mid: { max: 3, limit: 60 },       // 3배: 1시간
      high: { max: 5, limit: 30 },      // 4~5배: 30분
    }
  },

  // 위험 상태 조합 임계치
  DANGER_THRESHOLDS: {
    // 본절로스 징후
    MENTAL_BREAKEVEN: {
      fatigueIndex: 70,
      revengeIndex: 60,
      holdDesire: 4,
    },
    // 손실 직후 버티기
    POST_LOSS_HOLDING: {
      hoursSinceLoss: 2,        // 손실 후 2시간 이내
      holdDesire: 3,
      minElapsed: 30,           // 30분 이상 버틴 경우
    },
    // 연속 손절 후 재진입
    CONSECUTIVE_SL_HOLDING: {
      consecutiveSL: 2,
      holdDesire: 3,
      minElapsed: 15,
    }
  }
};

// ========== MARKET SENTIMENT UTILS ==========
function getSentimentFromCache() {
  try {
    const cached = localStorage.getItem(SENTIMENT_API.CACHE_KEY);
    if (!cached) return null;
    
    const parsed = JSON.parse(cached);
    const now = Date.now();
    
    if (now > parsed.expiresAt) {
      localStorage.removeItem(SENTIMENT_API.CACHE_KEY);
      return null;
    }
    
    return parsed.data;
  } catch {
    return null;
  }
}

function setSentimentToCache(data) {
  try {
    const cacheEntry = {
      data,
      expiresAt: Date.now() + SENTIMENT_API.CACHE_TTL_MS
    };
    localStorage.setItem(SENTIMENT_API.CACHE_KEY, JSON.stringify(cacheEntry));
  } catch {
    // 캐시 실패 무시 (기능은 유지)
  }
}

async function fetchFearGreedIndex() {
  try {
    const response = await fetch(SENTIMENT_API.FNG_URL, {
      headers: { 'accept': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`FNG API failed: ${response.status}`);
    }
    
    const json = await response.json();
    const row = json?.data?.[0];
    
    if (!row) {
      throw new Error('FNG response missing data');
    }
    
    return {
      value: Number(row.value),
      classification: String(row.value_classification || ''),
      timestamp: Number(row.timestamp),
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('[WAVE] FNG fetch failed:', error);
    return null;
  }
}

function getSentimentRegime(fngValue) {
  if (fngValue <= SENTIMENT_THRESHOLDS.EXTREME_FEAR) return 'EXTREME_FEAR';
  if (fngValue <= SENTIMENT_THRESHOLDS.FEAR) return 'FEAR';
  if (fngValue <= SENTIMENT_THRESHOLDS.NEUTRAL) return 'NEUTRAL';
  if (fngValue <= SENTIMENT_THRESHOLDS.GREED) return 'GREED';
  return 'EXTREME_GREED';
}

function getSentimentColor(regime) {
  switch (regime) {
    case 'EXTREME_FEAR': return 'text-red-500';
    case 'FEAR': return 'text-orange-400';
    case 'NEUTRAL': return 'text-slate-300';
    case 'GREED': return 'text-green-400';
    case 'EXTREME_GREED': return 'text-emerald-500';
    default: return 'text-slate-400';
  }
}

function getSentimentWarning(regime) {
  switch (regime) {
    case 'EXTREME_FEAR':
      return '극단적 공포 구간. 바닥 근처일 가능성. 신중한 진입 고려.';
    case 'FEAR':
      return '공포 구간. 매수 기회 탐색 구간.';
    case 'NEUTRAL':
      return '중립 구간. 방향성 불명확.';
    case 'GREED':
      return '탐욕 구간. 과열 주의. 익절 고려.';
    case 'EXTREME_GREED':
      return '극단적 탐욕 구간. 고점 근처 가능성. 진입 자제 권장.';
    default:
      return '';
  }
}

// ========== NORMALIZERS (스키마 보장) ==========
function normalizeOs(raw) {
  const today = new Date().toISOString().split('T')[0];
  const DEFAULT_OS = {
    dayKey: today,
    dopamineIndex: 0,
    revengeIndex: 0,
    fatigueIndex: 0,
    disciplineScore: 100,
    urgentEnterCount: 0,
    loop: { index: 0, phase: null },
    loopPhase: null,
    consecutiveSL: 0,
    recentEventIds: [],
    globalCooldownUntil: null,
    lastPositionSnapshot: null,
    lossCooldownUntil: null,
    watchMode: false,
    lastBigWinAt: null,
    lastBigLossAt: null,
    lastLossAt: null,
    mentalBreakevenFlag: false, // ⭐ STAGE3 추가
  };

  if (!raw || typeof raw !== 'object') return DEFAULT_OS;

  // loop 필드 보장 (가장 치명적)
  const loop = (raw.loop && typeof raw.loop === 'object')
    ? { index: Number(raw.loop.index) || 0, phase: raw.loop.phase || null }
    : { index: 0, phase: null };

  // recentEventIds 배열 보장
  const recentEventIds = Array.isArray(raw.recentEventIds) ? raw.recentEventIds : [];

  return {
    ...DEFAULT_OS,
    ...raw,
    loop,
    recentEventIds,
    dayKey: raw.dayKey || today,
    dopamineIndex: Number(raw.dopamineIndex) || 0,
    revengeIndex: Number(raw.revengeIndex) || 0,
    fatigueIndex: Number(raw.fatigueIndex) || 0,
    disciplineScore: Number(raw.disciplineScore) || 100,
    urgentEnterCount: Number(raw.urgentEnterCount) || 0,
    consecutiveSL: Number(raw.consecutiveSL) || 0,
  };
}

function normalizeSession(raw) {
  const DEFAULT_SESSION = {
    id: null,
    startTime: null,
    coinType: null,
    leverage: null,
    direction: null,
    entryThesis: '',
    entryPrice: null,
    entryAt: null,
    // lossCooldownUntil: null, // ❌ 제거 (os.globalCooldownUntil 사용)
    invalidationSchema: { type: null, trigger: '', action: null },
    slConfirmed: false,
    tpConfirmed: false,
    capitalSecured: null,
    trades: [],
    bottom: null,
    negFundingLong: null,
    hasEntryReason: null,
    status: null,
  };

  if (!raw || typeof raw !== 'object') return DEFAULT_SESSION;

  // invalidationSchema 보장
  const invalidationSchema = (raw.invalidationSchema && typeof raw.invalidationSchema === 'object')
    ? { type: raw.invalidationSchema.type || null, trigger: raw.invalidationSchema.trigger || '', action: raw.invalidationSchema.action || null }
    : { type: null, trigger: '', action: null };

  // trades 배열 보장
  const trades = Array.isArray(raw.trades) ? raw.trades : [];

  return {
    ...DEFAULT_SESSION,
    ...raw,
    invalidationSchema,
    trades,
    slConfirmed: Boolean(raw.slConfirmed),
    tpConfirmed: Boolean(raw.tpConfirmed),
  };
}

function normalizePositions(raw) {
  if (!raw || typeof raw !== 'object') return { A: null, B: null };

  return {
    A: raw.A ? normalizeSession(raw.A) : null,
    B: raw.B ? normalizeSession(raw.B) : null,
  };
}

// ========== VALIDATORS ==========
function validateOs(data) {
  if (!data || typeof data !== 'object') return null;
  // 필수 필드 검증
  if (typeof data.dopamineIndex !== 'number') return null;
  if (typeof data.revengeIndex !== 'number') return null;
  // recentEventIds 배열 보장
  const recentEventIds = Array.isArray(data.recentEventIds) ? data.recentEventIds : [];
  return { ...data, recentEventIds };
}

function validateSession(data) {
  if (!data || typeof data !== 'object') return null;
  return data;
}

// ========== STORAGE HELPERS ==========
function saveToStorage(userKey, key, data) {
  if (typeof window === 'undefined') return;
  const storageKey = `wave.${userKey}.${key}`;
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch (e) {
    console.error('[WAVE] Storage save failed:', e);
  }
}

function loadFromStorage(userKey, key, fallback = null) {
  if (typeof window === 'undefined') return fallback;
  const storageKey = `wave.${userKey}.${key}`;
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error('[WAVE] Storage load failed:', e);
    return fallback;
  }
}

function saveToStorageFor(userKey, key, data) {
  return saveToStorage(userKey, key, data);
}

function loadFromStorageFor(userKey, key, fallback = null) {
  return loadFromStorage(userKey, key, fallback);
}

// ========== HELPER FUNCTIONS ==========
function resolveLoopPhase(os, lockUntil) {
  if (lockUntil && Date.now() < lockUntil) return 'LOCKED';
  
  // ⭐ loop 필드 방어
  const loop = (os && os.loop) ? os.loop : { index: 0, phase: null };
  
  if (loop.index >= 3) return 'LOOP_DANGER';
  if (loop.index >= 2) return 'LOOP_WARNING';
  return null;
}

function calculateEmotionalStress(inputs) {
  const values = Object.values(inputs).filter(v => v !== null);
  if (values.length === 0) {
    return { dopamine: 0, revenge: 0, fatigue: 0 }; // ⭐ 객체 반환
  }
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length; // 0~3 범위
  // 0~100 스케일로 매핑
  const base = Math.round((avg / 3) * 100);
  return {
    dopamine: Math.round(base * 0.45),  // 45% 가중치
    revenge: Math.round(base * 0.35),   // 35% 가중치
    fatigue: Math.round(base * 0.20),   // 20% 가중치
  };
}

function getHoldingTimeLimits(coinType) {
  if (coinType === 'BTC') {
    return { soft: 60, warning: 240, danger: 360 }; // 1h, 4h, 6h
  }
  // ALT
  return { soft: 15, warning: 60, danger: 120 }; // 15m, 1h, 2h
}

// ========== HOLDING RISK ENGINE ==========
function calculateHoldingRisk(params) {
  const {
    elapsedMin,
    coinType,
    leverage,
    os,
    emotionalInputs,
  } = params;

  // [1] 레버리지별 하드 리밋 체크
  const assetConfig = HOLDING_RISK_CONFIG.LEVERAGE_TIME_LIMITS[coinType] || HOLDING_RISK_CONFIG.LEVERAGE_TIME_LIMITS.ALT;
  let timeLimit = 30; // 기본값
  
  for (const tier of ['low', 'mid', 'high']) {
    const config = assetConfig[tier];
    if (leverage <= config.max) {
      timeLimit = config.limit;
      break;
    }
  }

  // [2] 시간 초과 시 즉시 EXECUTE
  if (elapsedMin >= timeLimit) {
    return {
      tier: 'EXECUTE',
      action: 'FULL_EXIT',
      reason: `레버리지 ${leverage}배는 ${timeLimit}분 이상 보유 금지`,
    };
  }

  // [3] 본절로스 징후 탐지
  const mental = HOLDING_RISK_CONFIG.DANGER_THRESHOLDS.MENTAL_BREAKEVEN;
  if (
    (os.fatigueIndex || 0) >= mental.fatigueIndex &&
    (os.revengeIndex || 0) >= mental.revengeIndex &&
    (emotionalInputs.holdDesire || 0) >= mental.holdDesire
  ) {
    return {
      tier: 'EXECUTE',
      action: 'LOCK_2H',
      reason: '심리적 본절로스 징후 (fatigue/revenge/hold 과열)',
    };
  }

  // [4] 손실 직후 + 버티기
  const postLoss = HOLDING_RISK_CONFIG.DANGER_THRESHOLDS.POST_LOSS_HOLDING;
  if (os.lastLossAt) {
    const hoursSinceLoss = (Date.now() - os.lastLossAt) / (1000 * 60 * 60);
    if (
      hoursSinceLoss < postLoss.hoursSinceLoss &&
      (emotionalInputs.holdDesire || 0) >= postLoss.holdDesire &&
      elapsedMin >= postLoss.minElapsed
    ) {
      return {
        tier: 'EXECUTE',
        action: 'REDUCE_50',
        reason: '손실 직후 버티기 (복구 시도 차단)',
      };
    }
  }

  // [5] 연속 손절 후 재진입 + 버티기
  const consecutive = HOLDING_RISK_CONFIG.DANGER_THRESHOLDS.CONSECUTIVE_SL_HOLDING;
  if (
    (os.consecutiveSL || 0) >= consecutive.consecutiveSL &&
    (emotionalInputs.holdDesire || 0) >= consecutive.holdDesire &&
    elapsedMin >= consecutive.minElapsed
  ) {
    return {
      tier: 'EXECUTE',
      action: 'FULL_EXIT',
      reason: '연속 손절 후 버티기 (추가 손실 방지)',
    };
  }

  // [6] 경고 단계 (시간 기반)
  const warningThreshold = timeLimit * 0.7; // 70%
  const dangerThreshold = timeLimit * 0.85; // 85%

  if (elapsedMin >= dangerThreshold) {
    return {
      tier: 'DANGER',
      action: 'REDUCE_50',
      reason: `시간 제한 ${timeLimit}분의 85% 도달`,
    };
  }

  if (elapsedMin >= warningThreshold) {
    return {
      tier: 'WARNING',
      action: 'ALERT',
      reason: `시간 제한 ${timeLimit}분의 70% 도달`,
    };
  }

  return {
    tier: 'SAFE',
    action: 'NONE',
    reason: null,
  };
}

function WaveMVP() {
  // ========== REFS ==========
  const eventSeqRef = useRef(0);
  const holdingAlertShownRef = useRef({ WARNING: false, DANGER: false }); // ⭐ P0-2 가드
  const promotedSlotRef = useRef({ A: false, B: false }); // ⭐ P0-3 가드
  const osRef = useRef({
    dopamineIndex: 0,
    revengeIndex: 0,
    urgentEnterCount: 0,
    loop: { index: 0, phase: null },
    loopPhase: null,
    recentEventIds: [],
    globalCooldownUntil: null,
    lastPositionSnapshot: null,
    lossCooldownUntil: null,
    watchMode: false,
  });
  const historyRef = useRef([]);
  
  // ⭐ P0: Ref 기반 실시간 엔진 (interval deps 폭발 제거)
  const emotionalInputsRef = useRef({
    urgency: null,
    recoveryDesire: null,
    overconfidence: null,
    focusClarity: null,
    physicalFatigue: null,
    holdDesire: null
  });
  const sessionRef = useRef(null);
  const phaseRef = useRef('HOME');

  // ========== STATE ==========
  const [phase, setPhase] = useState('HOME');
  const [lockUntil, setLockUntil] = useState(null);
  const [lockReasonCode, setLockReasonCode] = useState(null);
  const [tick, setTick] = useState(0);
  const [logs, setLogs] = useState([]);
  const [devMode, setDevMode] = useState(false);
  const [userKey, setUserKey] = useState('guest');
  const [userKeyInput, setUserKeyInput] = useState('');

  const [positions, setPositions] = useState({ A: null, B: null });
  const [activeSlot, setActiveSlot] = useState(null);
  const [draftSession, setDraftSession] = useState({
    id: null,
    startTime: null,
    coinType: null,
    leverage: null,
    direction: null,
    entryThesis: '',
    entryPrice: null,
    entryAt: null,
    lossCooldownUntil: null,
    invalidationSchema: { type: null, trigger: '', action: null },
    slConfirmed: false,
    tpConfirmed: false,
    capitalSecured: null,
    trades: [],
    bottom: null,
    negFundingLong: null,
    hasEntryReason: null,
    status: null
  });
  const [lastPositionSnapshot, setLastPositionSnapshot] = useState(null);

  const session = activeSlot ? (positions[activeSlot] || draftSession) : draftSession;

  const setSession = (updater) => {
    if (!activeSlot) {
      setDraftSession(updater);
      return;
    }
    setPositions(prev => ({
      ...prev,
      [activeSlot]: typeof updater === 'function' ? updater(prev[activeSlot] || draftSession) : updater
    }));
  };

  const [emotionalInputs, setEmotionalInputs] = useState({
    urgency: null,
    recoveryDesire: null,
    overconfidence: null,
    focusClarity: null,
    physicalFatigue: null,
    holdDesire: null
  });

  // ⭐ WAVE 서약 체크 (생존 OS 강제)
  const [oathAccepted, setOathAccepted] = useState(false);

  // ⭐ OATH persistence (하루 1회)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const today = new Date().toISOString().split('T')[0];
    const key = `wave.${userKey}.oathAccepted.${today}`;
    const saved = localStorage.getItem(key);
    if (saved === '1') setOathAccepted(true);
  }, [userKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const today = new Date().toISOString().split('T')[0];
    const key = `wave.${userKey}.oathAccepted.${today}`;
    localStorage.setItem(key, oathAccepted ? '1' : '0');
  }, [userKey, oathAccepted]);

  // ⭐ P0: Ref 동기화 (interval에서 최신 값 읽기 위함)
  useEffect(() => {
    emotionalInputsRef.current = emotionalInputs;
  }, [emotionalInputs]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const [holdingCheckModal, setHoldingCheckModal] = useState(false);
  const [fortuneModal, setFortuneModal] = useState(false);
  const [closeIntent, setCloseIntent] = useState(null);
  const [closePnlInput, setClosePnlInput] = useState('');
  const [dailyFortune, setDailyFortune] = useState(null);
  
  // ⭐ Market Sentiment (Fear & Greed Index)
  const [marketSentiment, setMarketSentiment] = useState(null);
  const [sentimentLoading, setSentimentLoading] = useState(false);
  
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [capitalAnswer, setCapitalAnswer] = useState(null);

  const [logFocus, setLogFocus] = useState(null);
  const [recentLogsOpen, setRecentLogsOpen] = useState(false);
  const [compoundInput, setCompoundInput] = useState({ seed: '', rate: '', count: '' });
  const [compoundResult, setCompoundResult] = useState(null);
  const [compoundRows, setCompoundRows] = useState([]); // ⭐ 추가

  const [exportModal, setExportModal] = useState(false); // ⭐ 추가
  const [exportText, setExportText] = useState(''); // ⭐ 추가
  const [importModal, setImportModal] = useState(false); // ⭐ 추가
  const [importText, setImportText] = useState(''); // ⭐ 추가

  // ⭐ Exit Report Modal
  const [exitReportModal, setExitReportModal] = useState(false);
  const [exitReportData, setExitReportData] = useState(null);

  const [watchPosition, setWatchPosition] = useState(null);
  const [watchMode, setWatchMode] = useState(false);

  const [os, setOs] = useState({
    dopamineIndex: 0,
    revengeIndex: 0,
    urgentEnterCount: 0,
    loop: { index: 0, phase: null },
    loopPhase: null,
    recentEventIds: [],
    globalCooldownUntil: null,
    lastPositionSnapshot: null,
    lossCooldownUntil: null,
    watchMode: false,
  });

  // ========== COMPUTED VALUES ==========
  const isPrelockFailureLock = useMemo(() => {
    return ['PRELOCK_CAUTION', 'INVALIDATION_SCHEMA_MISSING', 'SLTP_NOT_DEFINED'].includes(lockReasonCode);
  }, [lockReasonCode]);

  const ruleOfDay = useMemo(() => ({ stopLimitPerDay: 3 }), []);

  const todayStopCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return logs.filter(l => l.action === 'STOP' && l.timestamp?.slice(0, 10) === today).length;
  }, [logs]);

  // Update osRef when os changes
  useEffect(() => {
    osRef.current = os;
  }, [os]);

  // ========== PERSISTENCE ==========
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      // [1] Load activeUser first
      const activeUser = localStorage.getItem('wave.activeUser.v1') || 'guest';
      setUserKey(activeUser);
      
      // ⚠️ activeUser를 직접 사용해서 로드 (state userKey는 아직 업데이트 안됨)
      const _userKey = activeUser;
      
      const loadNS = (key, fallback) => loadFromStorageFor(_userKey, key, fallback);
      
      // Load devMode
      const savedDevMode = loadNS('devMode.v1', '0');
      setDevMode(savedDevMode === '1');

      // ⭐ Load OS (정규화 적용)
      const rawOs = loadNS('os.v1', null);
      const normalizedOs = normalizeOs(rawOs);
      
      // Daily reset 체크
      const today = new Date().toISOString().split('T')[0];
      if (normalizedOs.dayKey !== today) {
        console.log('[WAVE] Daily reset triggered');
        setOs({
          ...normalizedOs,
          dayKey: today,
          consecutiveSL: 0,
          lastLossAt: null,
          lastBigLossAt: null,
          lastBigWinAt: null
        });
        setDraftSession(prev => ({
          ...prev,
          lossCooldownUntil: null
        }));
      } else {
        setOs(normalizedOs);
      }

      // Load session
      const savedSession = loadNS('session.v1', null);
      if (savedSession) {
        const validated = validateSession(savedSession);
        if (validated) {
          if (validated.phase) setPhase(validated.phase);
          if (validated.lockUntil && validated.lockUntil > Date.now()) {
            setLockUntil(validated.lockUntil);
            if (validated.lockReasonCode) setLockReasonCode(validated.lockReasonCode);
            setPhase('LOCKED');
          }
          if (validated.session) setDraftSession(validated.session);
          if (validated.selectedCoin) setSelectedCoin(validated.selectedCoin);
        } else {
          console.warn('[WAVE] Invalid session data, starting fresh');
        }
      }

      // Load logs
      const savedLogs = loadNS('logs.v1', []);
      if (Array.isArray(savedLogs)) {
        setLogs(savedLogs);
      } else {
        console.warn('[WAVE] Invalid logs data, starting fresh');
      }

      // Load daily fortune (전역 유지 - 오늘의 운세는 유저 공통)
      const fortuneData = localStorage.getItem('wave.fortune.v1');
      if (fortuneData) {
        try {
          const parsed = JSON.parse(fortuneData);
          const today = new Date().toISOString().split('T')[0];
          if (parsed.date === today) {
            setDailyFortune(parsed);
          }
        } catch(e) {
          localStorage.removeItem('wave.fortune.v1');
        }
      }

      // Load watch position
      const savedWatch = loadNS('watch.v1', null);
      if (savedWatch) {
        setWatchPosition(savedWatch);
      }
      
      // ⭐ Load positions (정규화 적용)
      const rawPositions = loadNS('positions.v1', null);
      const normalizedPositions = normalizePositions(rawPositions);
      setPositions(normalizedPositions);
      
      // Load activeSlot
      const savedActiveSlot = loadNS('activeSlot.v1', null);
      if (savedActiveSlot) {
        setActiveSlot(savedActiveSlot);
      }
      
      // Load lastPositionSnapshot
      const savedSnapshot = loadNS('lastSnapshot.v1', null);
      if (savedSnapshot) {
        setLastPositionSnapshot(savedSnapshot);
      }
    } catch(e) {
      console.error('[WAVE] Storage init error:', e);
    }
  }, []);

  useEffect(() => {
    saveToStorage(userKey, 'os.v1', os);
  }, [userKey, os]);

  useEffect(() => {
    // positions에 session이 포함되므로 별도 저장 불필요
    // phase/lock/selectedCoin만 저장
    const s = { phase, lockUntil, lockReasonCode, selectedCoin };
    saveToStorage(userKey, 'session.v1', s);
  }, [userKey, phase, lockUntil, lockReasonCode, selectedCoin]);

  useEffect(() => {
    const trimmedLogs = logs.slice(-2000);
    saveToStorage(userKey, 'logs.v1', trimmedLogs);
  }, [userKey, logs]);

  useEffect(() => {
    saveToStorage(userKey, 'devMode.v1', devMode ? '1' : '0');
  }, [userKey, devMode]);

  useEffect(() => {
    saveToStorage(userKey, 'watch.v1', watchPosition);
  }, [userKey, watchPosition]);
  
  useEffect(() => {
    saveToStorage(userKey, 'positions.v1', positions);
  }, [userKey, positions]);
  
  useEffect(() => {
    saveToStorage(userKey, 'activeSlot.v1', activeSlot);
  }, [userKey, activeSlot]);
  
  useEffect(() => {
    saveToStorage(userKey, 'lastSnapshot.v1', lastPositionSnapshot);
  }, [userKey, lastPositionSnapshot]);

  // ⭐ activeSlot 선택 시 draftSession → positions 승격
  useEffect(() => {
    if (!activeSlot) return;
    
    // 이미 슬롯에 데이터가 있으면 skip (복원 케이스)
    if (positions?.[activeSlot]) return;
    
    // ⭐ P0-3: 이미 승격했으면 skip (중복 방지)
    if (promotedSlotRef.current[activeSlot]) return;
    
    // draft → positions 승격
    setPositions(prev => ({
      ...prev,
      [activeSlot]: { ...draftSession, id: `session_${Date.now()}`, startTime: new Date().toISOString() }
    }));
    
    // ⭐ 승격 완료 플래그
    promotedSlotRef.current[activeSlot] = true;
  }, [activeSlot, draftSession, positions?.A?.id, positions?.B?.id]); // ⭐ deps 최소화

  useEffect(() => {
    const newLoopPhase = resolveLoopPhase(os, lockUntil);
    if (newLoopPhase !== os.loopPhase) {
      setOs(prev => ({ ...prev, loopPhase: newLoopPhase }));
    }
  }, [os.consecutiveSL, os.dopamineIndex, os.revengeIndex, os.fatigueIndex, os.lastBigLossAt, os.loopPhase, lockUntil]);

  useEffect(() => {
    if (phase === 'LOCKED' && lockUntil) {
      const timer = setInterval(() => setTick(t => t + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [phase, lockUntil]);

  // INTRA real-time tick for HH:MM:SS display
  useEffect(() => {
    if (phase === 'INTRA' && session.entryAt) {
      const timer = setInterval(() => setTick(t => t + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [phase, session.entryAt]);

  // ⭐ INTRA Holding Risk 실시간 모니터링 (1분 간격)
  // ⭐ P0: Ref 기반으로 deps 최소화 (os, emotionalInputs 제거 → 재생성 방지)
  useEffect(() => {
    if (phase !== 'INTRA' || !session.entryAt || !session.coinType) return;

    // ⭐ 세션 변경 시 알림 초기화
    holdingAlertShownRef.current = { WARNING: false, DANGER: false };

    const checkInterval = setInterval(() => {
      const currentSession = sessionRef.current;
      const currentOs = osRef.current;
      const currentEmotionalInputs = emotionalInputsRef.current;
      
      if (!currentSession || !currentSession.entryAt) return;
      
      const elapsedMin = Math.floor((Date.now() - currentSession.entryAt) / 60000);
      
      // Holding Risk 계산 (ref에서 최신 값 읽기)
      const riskResult = calculateHoldingRisk({
        elapsedMin,
        coinType: currentSession.coinType,
        leverage: currentSession.leverage || 1,
        os: currentOs,
        emotionalInputs: currentEmotionalInputs,
      });

      // EXECUTE 단계면 강제 실행
      if (riskResult.tier === 'EXECUTE') {
        executeHoldingRisk(riskResult, currentSession);
        clearInterval(checkInterval);
      } else if (riskResult.tier === 'DANGER') {
        // ⭐ DANGER 단계면 모달 (1회만)
        if (!holdingAlertShownRef.current.DANGER) {
          const eventId = getEventId('HOLDING_ALERT_DANGER', currentSession.id);
          addLog('HOLDING_ALERT_DANGER', { 
            elapsedMin, 
            coinType: currentSession.coinType,
            reason: riskResult.reason 
          }, eventId);
          setHoldingCheckModal(true);
          holdingAlertShownRef.current.DANGER = true;
        }
      } else if (riskResult.tier === 'WARNING') {
        // ⭐ WARNING 단계면 로그만 (1회만)
        if (!holdingAlertShownRef.current.WARNING) {
          const eventId = getEventId('HOLDING_ALERT_WARNING', currentSession.id);
          addLog('HOLDING_ALERT_WARNING', { 
            elapsedMin, 
            coinType: currentSession.coinType,
            reason: riskResult.reason 
          }, eventId);
          holdingAlertShownRef.current.WARNING = true;
        }
      }
    }, 60000); // 1분마다 체크

    return () => clearInterval(checkInterval);
  }, [phase, session.entryAt, session.coinType]); // ⭐ os, emotionalInputs 제거

  // HOME에서도 냉각시간이 활성화되어 있으면 1초마다 tick 갱신(실시간 표시용)
  useEffect(() => {
    const active = session.lossCooldownUntil && Date.now() < session.lossCooldownUntil;
    if (phase !== 'HOME' || !active) return;
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, [phase, session.lossCooldownUntil]);

  // Auto-unlock when lockUntil expires
  useEffect(() => {
    if (lockUntil && Date.now() >= lockUntil) {
      const eventId = getEventId('UNLOCK_AUTO', session.id);
      addLog('UNLOCK_AUTO', { prevReason: lockReasonCode, unlockAt: Date.now() }, eventId);
      
      setLockUntil(null);
      setLockReasonCode(null);
      setPhase('HOME');
    }
  }, [tick, lockUntil]);

  // ⭐ HOME 진입 시 Market Sentiment 자동 로드
  useEffect(() => {
    if (phase === 'HOME' && !marketSentiment) {
      loadMarketSentiment();
    }
  }, [phase]);

  // ⭐ [REMOVED] getHoldingTimeLimits 기반 interval 제거
  // calculateHoldingRisk 엔진으로 통합됨 (중복 방지)

  // Auto-lock when STOP limit exceeded
  useEffect(() => {
    if (phase === 'HOME' && todayStopCount >= ruleOfDay.stopLimitPerDay) {
      const until = Date.now() + 4 * 60 * 60 * 1000;
      const eventId = getEventId('AUTO_LOCK', session.id);
      
      if (addLog('AUTO_LOCK', { reason: 'STOP 한도 초과', count: todayStopCount }, eventId)) {
        setLockReasonCode('AUTO_LOCK');
        setLockUntil(until);
        setPhase('LOCKED');
      }
    }
  }, [phase, todayStopCount]);

  // ⭐ HOME 슬롯 실시간 tick (A/B OPEN 슬롯 타이머)
  const hasAnyOpenSlot = useMemo(() => {
    // ⭐ entryAt 없어도 OPEN이면 tick (방어적)
    return (positions?.A?.status === 'OPEN') || (positions?.B?.status === 'OPEN');
  }, [positions]);

  useEffect(() => {
    if (phase !== 'HOME') return;
    if (!hasAnyOpenSlot) return;
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, [phase, hasAnyOpenSlot]);


  // [필수 4] OS 지표 감쇠 (10분마다)
  useEffect(() => {
    const decayInterval = setInterval(() => {
      setOs(prev => ({
        ...prev,
        dopamineIndex: Math.max(0, prev.dopamineIndex - 2),
        revengeIndex: Math.max(0, prev.revengeIndex - 2),
        fatigueIndex: Math.max(0, prev.fatigueIndex - 1)
      }));
    }, 10 * 60 * 1000); // 10분

    return () => clearInterval(decayInterval);
  }, []);




  // ========== HELPERS ==========
  
  const getLogColorClass = (action) => {
    if (action === 'LOCK' || action === 'STOP' || action === 'AUTO_LOCK') return 'bg-red-500';
    if (action.startsWith('PRELOCK')) return 'bg-fuchsia-500';
    if (action === 'TRADE_EXIT') return 'bg-emerald-500';
    if (action.startsWith('SESSION')) return 'bg-cyan-500';
    if (action === 'UNDO') return 'bg-yellow-400';
    return 'bg-slate-500';
  };

  const buildCompoundTable = ({ seed, rate, count }) => {
    const S = parseFloat(seed);
    const R = parseFloat(rate);
    const N = parseInt(count, 10);

    if (!Number.isFinite(S) || S <= 0) return [];
    if (!Number.isFinite(R)) return [];
    if (!Number.isFinite(N) || N <= 0) return [];

    const isLossTurn = (i) => {
      const k = (i - 1) % 10 + 1;
      return k === 4 || k === 7 || k === 10;
    };

    let balance = S;
    let totalWithdraw = 0;
    const rows = [];

    for (let i = 1; i <= N; i++) {
      const loss = isLossTurn(i);
      
      if (loss) {
        const lossAmt = balance * 0.03;
        balance = balance - lossAmt;
        rows.push({ turn: i, type: 'SL', pnl: -lossAmt, withdraw: 0, totalWithdraw, balance });
      } else {
        const profit = balance * (R / 100);
        const withdraw = profit * 0.5;
        totalWithdraw += withdraw;
        balance = balance + (profit - withdraw);
        rows.push({ turn: i, type: 'TP', pnl: profit, withdraw, totalWithdraw, balance });
      }
    }
    return rows;
  };
  
  const pushSnapshot = () => {
    const snapshot = {
      phase,
      session: JSON.parse(JSON.stringify(session)),
      emotionalInputs: JSON.parse(JSON.stringify(emotionalInputs)),
      dailyFortune,
      lockUntil,
      lockReasonCode,
      selectedCoin,
      capitalAnswer
    };
    
    historyRef.current = [...historyRef.current, snapshot].slice(-20); // Keep last 20
  };

  const handleUndo = () => {
    if (historyRef.current.length === 0) return;
    
    const snapshot = historyRef.current.pop();
    historyRef.current = [...historyRef.current]; // Trigger update
    
    setPhase(snapshot.phase);
    setSession(snapshot.session);
    setEmotionalInputs(snapshot.emotionalInputs);
    setDailyFortune(snapshot.dailyFortune);
    setLockUntil(snapshot.lockUntil);
    setLockReasonCode(snapshot.lockReasonCode);
    setSelectedCoin(snapshot.selectedCoin);
    setCapitalAnswer(snapshot.capitalAnswer);
    
    const eventId = getEventId('UNDO', snapshot.session?.id || session.id);
    addLog('UNDO', { restoredPhase: snapshot.phase }, eventId);
  };

  // LOCK 해제 + PRELOCK로 복귀(입력 유지)
  const handleBackToPrelockFromLock = () => {
    if (!isPrelockFailureLock) return;
    pushSnapshot(); // UNDO 가능하게
    const eventId = getEventId('LOCK_RESET_TO_PRELOCK', session.id);
    addLog('LOCK_RESET_TO_PRELOCK', { fromReason: lockReasonCode }, eventId);

    setLockUntil(null);
    setLockReasonCode(null);
    setPhase('PRELOCK');
  };

  // LOCK 해제 + PRELOCK 입력 완전 초기화 후 복귀
  const handleFullResetPrelockFromLock = () => {
    if (!isPrelockFailureLock) return;
    pushSnapshot(); // UNDO 가능하게
    const eventId = getEventId('LOCK_RESET_PRELOCK_FULL', session.id);
    addLog('LOCK_RESET_PRELOCK_FULL', { fromReason: lockReasonCode }, eventId);

    setLockUntil(null);
    setLockReasonCode(null);

    // PRELOCK 입력 완전 초기화
    setEmotionalInputs({
      urgency: null,
      recoveryDesire: null,
      overconfidence: null,
      focusClarity: null,
      physicalFatigue: null,
      holdDesire: null
    });
    setSession(prev => ({
      ...prev,
      invalidationSchema: { type: null, trigger: '', action: null },
      slConfirmed: false,
      tpConfirmed: false
    }));

    setPhase('PRELOCK');
  };

  // 전체 RESET (최초 진입 상태로 초기화)

  // [2] Export/Import (백업/복원)
  // ========== NAVIGATION HANDLERS ==========
  // ========== NAVIGATION HANDLERS ==========
  const handleGoHomeFromIntra = () => {
    const eventId = getEventId('NAV_HOME', session.id);
    addLog('NAV_HOME', { from: phase, to: 'HOME', focusedSlot: activeSlot }, eventId);
    setPhase('HOME'); // ✅ activeSlot 유지
  };

  // ========== HOME SLOT EXIT HANDLERS ==========
  const handleExitFromHome = (slot, exitIntent) => {
    const p = positions?.[slot];
    if (!p || p.status !== 'OPEN') return;

    // ✅ INTRA로 이동 + Close Panel 오픈
    setActiveSlot(slot);
    setSelectedCoin(p.coinType || null);
    setCloseIntent(exitIntent?.intent || 'MANUAL'); // ⭐ intent 설정
    setClosePnlInput(''); // ⭐ 입력 초기화
    setPhase('INTRA');
    
    const eventId = getEventId('HOME_TO_INTRA_FOR_EXIT', p.id);
    addLog('HOME_TO_INTRA_FOR_EXIT', { slot, intent: exitIntent?.intent || 'MANUAL' }, eventId);
  };

  const handleConfirmClose = () => {
    const pnl = parseFloat(closePnlInput); // ✅ closePnlInput 사용
    if (isNaN(pnl)) {
      alert('PnL(%)를 입력하세요');
      return;
    }

    // ✅ 기존 handleTradeExit 호출
    const reason = closeIntent === 'TP' ? 'take_profit' : closeIntent === 'SL' ? 'stop_loss' : 'manual';
    handleTradeExit({ pnl, reason });
    
    // Close Panel 닫기
    setCloseIntent(null);
    setClosePnlInput('');
  };

  const handleStopFromHome = (slot) => {
    const p = positions?.[slot];
    if (!p || p.status !== 'OPEN') return;

    pushSnapshot();
    addLog('STOP', { reason: 'user_stop', reasonCode: 'MANUAL_STOP', fromSlot: slot }, getEventId('STOP', p.id));

    setLockReasonCode('MANUAL_STOP');
    setLockUntil(Date.now() + 2 * 60 * 60 * 1000);
    setPhase('LOCKED');
  };

  // ========== SLOT MANAGEMENT HANDLERS ==========
  const getSlotElapsed = (p) => {
    if (!p?.entryAt) return null;
    const ms = Date.now() - p.entryAt;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  const canResumeSlot = (p) => p && p.status === 'OPEN' && p.entryAt;

  const handleResumeSlot = (slot) => {
    const p = positions[slot];
    if (!p || p.status !== 'OPEN') return;

    setActiveSlot(slot);
    setSelectedCoin(p.coinType || null);
    setPhase('INTRA');

    const eventId = getEventId('SLOT_RESUME', p.id);
    addLog('SLOT_RESUME', { slot, sessionId: p.id }, eventId);
  };

  // ========== RISK SCORE CALCULATOR ==========
  const calcRiskScore = (s) => {
    if (!s) return 0;
    
    let score = 0;
    const reasons = [];
    
    // ALT penalty
    if (s.coinType === 'ALT') {
      score += 10;
      reasons.push('ALT 변동성 가중치');
    }
    
    // SHORT penalty (핵심)
    if (s.direction === 'SHORT') {
      score += 15;
      reasons.push('SHORT 가중치 적용');
    }
    
    // hasEntryReason false penalty
    if (!s.hasEntryReason) {
      score += 10;
      reasons.push('진입 근거 없음 (패턴/이격도/3음봉 등)');
    }
    
    // Leverage penalty
    if (s.coinType === 'BTC' && s.leverage >= 10) {
      score += 5;
    } else if (s.coinType === 'ALT' && s.leverage >= 3) {
      score += 5;
    }
    
    return { score, reasons };
  };

  // ========== WATCH POSITION HANDLERS ==========
  const handleWatchCreate = () => {
    const newWatch = {
      id: `watch_${Date.now()}`,
      createdAt: Date.now(),
      coinType: 'BTC',
      leverage: null,
      direction: null,
      entryAt: Date.now(),
      note: '',
      invalidationMemo: '',
      sltpMemo: '',
      status: 'open'
    };
    setWatchPosition(newWatch);
    addLog('WATCH_CREATE', { id: newWatch.id }, newWatch.id);
  };

  const handleWatchUpdate = (updates) => {
    if (!watchPosition) return;
    const updated = { ...watchPosition, ...updates };
    setWatchPosition(updated);
    addLog('WATCH_UPDATE', { id: watchPosition.id, updates }, watchPosition.id);
  };

  const handleWatchClose = () => {
    if (!watchPosition) return;
    const closedWatch = { ...watchPosition, status: 'closed', closedAt: Date.now() };
    addLog('WATCH_CLOSE', { id: watchPosition.id }, watchPosition.id);
    setWatchPosition(null);
  };

  const handleWatchPromote = () => {
    if (!watchPosition) return;
    
    // ⭐ [Rule 2-2] 쿨다운 중 승격 차단
    if (os.globalCooldownUntil && Date.now() < os.globalCooldownUntil) {
      const eventId = getEventId('STOP', 'watch_promote');
      addLog('STOP', { reasonCode: 'COOLDOWN_ACTIVE_BLOCK', action: 'watch_promote' }, eventId);
      alert('❌ 쿨다운 활성: Watch 승격 금지. 쿨다운 종료 후 재시도하세요.');
      return;
    }
    
    // LOCKED 시 승격 차단
    if (lockUntil && lockUntil > Date.now()) {
      alert('❌ LOCKED 상태: Watch 승격 금지. 리스크 감소 액션만 허용.');
      return;
    }
    
    const nextCoin = watchPosition.coinType;
    setSelectedCoin(nextCoin);
    
    // session 스키마 보존 (필수 필드 유지)
    setSession(prev => ({
      ...prev,
      id: `session_${Date.now()}`,
      startTime: new Date().toISOString(),
      coinType: nextCoin,
      leverage: watchPosition.leverage ?? (nextCoin === 'BTC' ? 15 : 5),
      direction: watchPosition.direction ?? 'LONG',
      entryThesis: [
        watchPosition.note,
        watchPosition.invalidationMemo ? `무효화 힌트: ${watchPosition.invalidationMemo}` : null,
        watchPosition.sltpMemo ? `SLTP 힌트: ${watchPosition.sltpMemo}` : null
      ].filter(Boolean).join(' | '),
      entryPrice: null,
      entryAt: null, // PRELOCK에서 다시 Confirm 후 진입
      // 핵심: invalidationSchema / slConfirmed / tpConfirmed 반드시 유지
      invalidationSchema: { type: null, trigger: '', action: null },
      slConfirmed: false,
      tpConfirmed: false,
      capitalSecured: null,
      trades: [],
      bottom: false,
      negFundingLong: false,
      hasEntryReason: false
    }));
    
    addLog('WATCH_PROMOTE', { watchId: watchPosition.id }, watchPosition.id);
    setWatchPosition(null); // 승격 후 watch 제거
    setPhase('PRELOCK'); // PRELOCK로 이동 (감정/무효화/SLTP 재확인 강제)
  };

  const handleExport = () => {
    const exportData = {
      userKey,
      os,
      logs: logs.slice(-2000), // trim
      positions,
      activeSlot,
      lastPositionSnapshot,
      fortune: dailyFortune,
      watchPosition,
      exportedAt: new Date().toISOString()
    };
    
    const json = JSON.stringify(exportData, null, 2);
    
    // 모달로 항상 노출(권한 이슈 무시)
    setExportText(json);
    setExportModal(true);
    
    addLog('EXPORT', { size: json.length }, getEventId('EXPORT', session.id));
  };
  
  const handleImport = () => {
    setImportText('');
    setImportModal(true);
  };
  
  const confirmImport = () => {
    const json = importText;
    if (!json) return;
    
    try {
      const data = JSON.parse(json);
      
      // 검증
      if (!data.os || !data.logs) {
        alert('❌ 잘못된 백업 데이터입니다.');
        return;
      }
      
      // ⭐ 복원 (정규화 적용)
      if (data.userKey) {
        setUserKey(data.userKey);
        localStorage.setItem('wave.activeUser.v1', data.userKey);
      }
      setOs(normalizeOs(data.os)); // ⭐ 정규화
      setLogs(data.logs.slice(-2000)); // trim
      if (data.positions) setPositions(normalizePositions(data.positions)); // ⭐ 정규화
      if (data.activeSlot) setActiveSlot(data.activeSlot);
      if (data.lastPositionSnapshot) setLastPositionSnapshot(data.lastPositionSnapshot);
      if (data.fortune) setDailyFortune(data.fortune);
      if (data.watchPosition) setWatchPosition(data.watchPosition);
      
      setPhase('HOME');
      alert('✅ 백업 데이터가 복원되었습니다!');
      
      addLog('IMPORT', { logsCount: data.logs.length }, getEventId('IMPORT'));
    } catch(e) {
      alert('❌ JSON 파싱 실패: ' + e.message);
    }
    setImportModal(false);
  };

  // ========== EXIT REPORT HANDLER ==========
  const handleExitReportAck = () => {
    const eventId = getEventId('EXIT_REPORT_ACK', exitReportData?.session?.id || 'unknown');
    addLog('EXIT_REPORT_ACK', {}, eventId);
    
    setExitReportModal(false);
    setExitReportData(null);
  };


  // [1] UserKey 변경 핸들러 (레이스 제거)
  const handleUserKeyChange = (newKey) => {
    if (!newKey || newKey.trim() === '') {
      alert('UserKey를 입력하세요');
      return;
    }
    
    const trimmedKey = newKey.trim();
    
    // activeUser 저장
    if (typeof window !== 'undefined') {
      localStorage.setItem('wave.activeUser.v1', trimmedKey);
    }
    
    // ⭐ 정규화된 OS 로딩
    const rawOs = loadFromStorageFor(trimmedKey, 'os.v1', null);
    const normalizedOs = normalizeOs(rawOs); // ⭐ 항상 정규화
    
    // ⭐ 정규화된 Positions 로딩
    const rawPositions = loadFromStorageFor(trimmedKey, 'positions.v1', null);
    const normalizedPositions = normalizePositions(rawPositions); // ⭐ 항상 정규화
    
    const newLogs = loadFromStorageFor(trimmedKey, 'logs.v1', []);
    const newSessionData = loadFromStorageFor(trimmedKey, 'session.v1', null);
    
    // state 업데이트 (로드 후!)
    setUserKey(trimmedKey);
    setOs(normalizedOs); // ⭐ 정규화된 OS
    setPositions(normalizedPositions); // ⭐ 정규화된 Positions
    setLogs(newLogs);
    
    if (newSessionData) {
      if (newSessionData.phase) setPhase(newSessionData.phase);
      if (newSessionData.lockUntil && newSessionData.lockUntil > Date.now()) {
        setLockUntil(newSessionData.lockUntil);
        if (newSessionData.lockReasonCode) setLockReasonCode(newSessionData.lockReasonCode);
        setPhase('LOCKED');
      }
      if (newSessionData.session) setSession(newSessionData.session);
      if (newSessionData.selectedCoin) setSelectedCoin(newSessionData.selectedCoin);
    } else {
      setPhase('HOME');
      setDraftSession(normalizeSession(null)); // ⭐ 정규화된 세션
    }
    
    setUserKeyInput('');
    addLog('USER_KEY_CHANGE', { newKey: trimmedKey }, getEventId('USER_KEY_CHANGE', null));
  };

  const handleReset = () => {
    if (!window.confirm('정말 초기화할까요? 현재 진행 상태가 모두 사라집니다.')) {
      return;
    }

    const eventId = getEventId('FULL_RESET', 'system');
    addLog('FULL_RESET', { fromPhase: phase }, eventId);

    // UI 상태 초기화
    setPhase('HOME');
    setLockUntil(null);
    setLockReasonCode(null);
    setSelectedCoin(null);
    setCapitalAnswer(null);
    setFortuneModal(false);

    // 감정 입력 초기화
    setEmotionalInputs({
      urgency: null,
      recoveryDesire: null,
      overconfidence: null,
      focusClarity: null,
      physicalFatigue: null,
      holdDesire: null
    });

    // 세션 초기화
    setSession({
      id: null,
      startTime: null,
      coinType: null,
      leverage: null,
      entryAt: null,
      lossCooldownUntil: null,
      invalidationSchema: { type: null, trigger: '', action: null },
      slConfirmed: false,
      tpConfirmed: false,
      trades: [],
      capitalSecured: null
    });

    // 히스토리 클리어
    historyRef.current = [];
  };
  
  const getEventId = (action, sessionId) => {
    eventSeqRef.current += 1;
    return `${Date.now()}|${sessionId ?? 'na'}|${action}|${eventSeqRef.current}`;
  };

  const addLog = (action, data = {}, eventId, osOverride = null) => {
    const currentOs = osRef.current || {}; // ⭐ null 가드
    const safeRecent = Array.isArray(currentOs.recentEventIds) ? currentOs.recentEventIds : []; // ⭐ 배열 가드
    const osSnap = osOverride ? { ...osOverride } : { ...currentOs }; // ⭐ osOverride 지원
    
    if (safeRecent.includes(eventId)) {
      console.warn('[WAVE] Duplicate event blocked:', eventId);
      return false;
    }
    
    setOs(prev => ({
      ...prev,
      recentEventIds: [...(prev.recentEventIds || []), eventId].slice(-50) // ⭐ 배열 가드
    }));
    
    const entry = {
      timestamp: new Date().toISOString(),
      eventId,
      action,
      data,
      os: osSnap // ⭐ 정확한 OS 스냅샷
    };
    setLogs(prev => [...prev, entry].slice(-2000)); // 메모리 누수 방지
    return true;
  };

  const checkLossCooldown = () => {
    if (!os.globalCooldownUntil) return false;
    
    const now = Date.now();
    if (now < os.globalCooldownUntil) {
      const eventId = getEventId('LOCK', session.id);
      if (addLog('LOCK', { 
        reasonCode: 'LOSS_COOLDOWN_ACTIVE',
        cooldownUntil: os.globalCooldownUntil,
        remainingMs: os.globalCooldownUntil - now
      }, eventId)) {
        setLockReasonCode('LOSS_COOLDOWN_ACTIVE');
        setLockUntil(os.globalCooldownUntil);
        setPhase('LOCKED');
      }
      return true;
    }
    return false;
  };

  const generateDailyFortune = () => {
    pushSnapshot(); // UNDO support
    
    const today = new Date().toISOString().split('T')[0];

    const prev = (dailyFortune && dailyFortune.date === today) ? dailyFortune : null;
    const nextRollsUsed = prev ? (prev.rollsUsed + 1) : 1;

    if (nextRollsUsed > 5) return; // 하루 5회까지만

    // [5] 진짜 랜덤 (Math.random)
    const modeIndex = Math.floor(Math.random() * FORTUNE_MODES.length);
    const messageIndex = Math.floor(Math.random() * FORTUNE_MESSAGES.length);

    const fortune = {
      date: today,
      mode: FORTUNE_MODES[modeIndex].mode,
      rule: FORTUNE_MODES[modeIndex].rule,
      color: FORTUNE_MODES[modeIndex].color,
      message: FORTUNE_MESSAGES[messageIndex],
      rollsUsed: nextRollsUsed
    };

    setDailyFortune(fortune);
    if (typeof window !== 'undefined') {
      localStorage.setItem('wave.fortune.v1', JSON.stringify(fortune));
    }

    // 매번 모달 열어서 변화 체감 확실히
    setFortuneModal(true);

    const eventId = getEventId('FORTUNE_ROLL', session.id);
    addLog('FORTUNE_ROLL', { ...fortune }, eventId);
  };

  // ⭐ Market Sentiment 로드
  const loadMarketSentiment = async () => {
    // 캐시 먼저 확인
    const cached = getSentimentFromCache();
    if (cached) {
      setMarketSentiment(cached);
      return;
    }
    
    // API 호출
    setSentimentLoading(true);
    const data = await fetchFearGreedIndex();
    setSentimentLoading(false);
    
    if (data) {
      setMarketSentiment(data);
      setSentimentToCache(data);
      
      // 로그 기록
      const eventId = getEventId('SENTIMENT_UPDATE', 'market');
      addLog('SENTIMENT_UPDATE', { 
        value: data.value, 
        classification: data.classification,
        regime: getSentimentRegime(data.value)
      }, eventId);
    }
  };

  // ========== HANDLERS ==========
  
  const handleStartSession = () => {
    if (todayStopCount >= ruleOfDay.stopLimitPerDay) return;
    
    // ⭐ [Rule 2-2] 쿨다운 중 신규 진입 차단
    if (!devMode && checkLossCooldown()) {
      const eventId = getEventId('STOP', 'session_start');
      addLog('STOP', { reasonCode: 'COOLDOWN_ACTIVE_BLOCK', action: 'session_start' }, eventId);
      return;
    }
    
    pushSnapshot(); // UNDO support
    setSelectedCoin(null); // Reset coin selection for new session
    
    const newSession = {
      id: Date.now(),
      startTime: new Date().toISOString(),
      coinType: null,
      leverage: null,
      direction: null,
      entryThesis: '',
      entryPrice: null,
      entryAt: null,
      lossCooldownUntil: session.lossCooldownUntil,
      invalidationSchema: { type: null, trigger: '', action: null },
      slConfirmed: false,
      tpConfirmed: false,
      capitalSecured: null,
      trades: [],
      bottom: null,
      negFundingLong: null,
      hasEntryReason: null,
      status: null
    };
    
    const eventId = getEventId('SESSION_START', newSession.id);
    
    if (addLog('SESSION_START', newSession, eventId)) {
      // ⭐ draft 초기화 + activeSlot 해제
      setDraftSession(newSession);
      setActiveSlot(null);
      setPhase('SETUP');
    }
  };

  const handleSetupComplete = (coinType) => {
    // LOCKED 시 신규 진입 차단
    if (lockUntil && lockUntil > Date.now()) {
      alert('❌ LOCKED 상태: 신규 진입 금지. 리스크 감소 액션(청산/감축)만 허용.');
      const eventId = getEventId('STOP', session.id);
      addLog('STOP', { reasonCode: 'LOCKED_NEW_ENTRY_BLOCKED' }, eventId);
      return;
    }
    
    if (!session.leverage) {
      alert('레버리지를 입력해주세요');
      return;
    }
    
    pushSnapshot(); // UNDO support
    setSession(prev => ({ ...prev, coinType }));
    
    // lastPositionSnapshot 저장 (⭐ coinType은 파라미터 사용)
    setLastPositionSnapshot({
      coinType, // ✅ 업데이트된 값
      direction: session.direction,
      bottom: session.bottom,
      negFundingLong: session.negFundingLong,
      hasEntryReason: session.hasEntryReason,
      ts: Date.now()
    });
    
    setPhase('PRELOCK');
    
    const eventId = getEventId('SETUP_COMPLETE', session.id);
    addLog('SETUP_COMPLETE', { coinType, direction: session.direction, bottom: session.bottom, negFundingLong: session.negFundingLong, hasEntryReason: session.hasEntryReason }, eventId);
  };

  const handleEmotionalInput = (key, value) => {
    setEmotionalInputs(prev => ({ ...prev, [key]: value }));
  };

  const handleInvalidationSchema = (field, value) => {
    setSession(prev => ({
      ...prev,
      invalidationSchema: { ...prev.invalidationSchema, [field]: value }
    }));
  };

  const handlePrelockComplete = () => {
    if (checkLossCooldown()) return;

    pushSnapshot(); // UNDO support

    // ⭐ [Rule 2-1] WAVE 서약 체크
    if (!oathAccepted) {
      const eventId = getEventId('STOP', session.id);
      if (addLog('STOP', { reasonCode: 'OATH_NOT_ACCEPTED' }, eventId)) {
        setLockReasonCode('OATH_NOT_ACCEPTED');
        setPhase('LOCKED');
        setLockUntil(Date.now() + 30 * 60 * 1000);
      }
      return;
    }

    // Validate invalidation schema
    const { type, trigger, action } = session.invalidationSchema;
    if (!type || !trigger || !action) {
      const eventId = getEventId('STOP', session.id);
      if (addLog('STOP', { reasonCode: 'INVALIDATION_SCHEMA_MISSING', schema: session.invalidationSchema }, eventId)) {
        setLockReasonCode('INVALIDATION_SCHEMA_MISSING');
        setPhase('LOCKED');
        setLockUntil(Date.now() + 30 * 60 * 1000);
      }
      return;
    }

    // Validate SL/TP
    if (!session.slConfirmed || !session.tpConfirmed) {
      const eventId = getEventId('STOP', session.id);
      if (addLog('STOP', { reasonCode: 'SLTP_NOT_DEFINED', slConfirmed: session.slConfirmed, tpConfirmed: session.tpConfirmed }, eventId)) {
        setLockReasonCode('SLTP_NOT_DEFINED');
        setPhase('LOCKED');
        setLockUntil(Date.now() + 30 * 60 * 1000);
      }
      return;
    }

    // Calculate emotional stress
    const stress = calculateEmotionalStress(emotionalInputs);
    setOs(prev => ({
      ...prev,
      dopamineIndex: Math.min(100, prev.dopamineIndex + stress.dopamine),
      revengeIndex: Math.min(100, prev.revengeIndex + stress.revenge),
      fatigueIndex: Math.min(100, prev.fatigueIndex + stress.fatigue)
    }));

    // Apply stricter thresholds if discipline is low
    const threshold = os.disciplineScore < 80 ? 50 : 70;
    const totalStressRaw = stress.dopamine + stress.revenge + stress.fatigue; // max ~170
    const totalStress = Math.min(100, Math.round(totalStressRaw / 1.7)); // normalize to 0-100

    if (totalStress > threshold) {
      const eventId = getEventId('PRELOCK_CAUTION', session.id);
      if (addLog('PRELOCK_CAUTION', { stress, totalStress, threshold }, eventId)) {
        setLockReasonCode('PRELOCK_CAUTION');
        setPhase('LOCKED');
        setLockUntil(Date.now() + 30 * 60 * 1000);
      }
      return;
    }

    const eventId = getEventId('PRELOCK_PASS', session.id);
    addLog('PRELOCK_PASS', { stress }, eventId);
    
    // INTRA 진입: status OPEN 설정
    const entryTime = Date.now();
    setSession(prev => ({ ...prev, entryAt: entryTime, status: 'OPEN' }));
    
    // positions에도 반영 (⭐ activeSlot 있을 때만)
    if (activeSlot) {
      setPositions(prev => ({
        ...prev,
        [activeSlot]: {
          ...(prev[activeSlot] || {}),
          status: 'OPEN',
          entryAt: entryTime
        }
      }));
    }
    
    setPhase('INTRA');
  };

  // ========== HOLDING RISK EXECUTE HANDLER ==========
  const executeHoldingRisk = (riskResult, currentSession) => {
    const eventId = getEventId('HOLDING_RISK_EXECUTE', currentSession.id);
    
    addLog('HOLDING_RISK_EXECUTE', {
      tier: riskResult.tier,
      action: riskResult.action,
      reason: riskResult.reason,
      elapsedMin: Math.floor((Date.now() - currentSession.entryAt) / 60000),
      coinType: currentSession.coinType,
      leverage: currentSession.leverage,
    }, eventId);

    switch (riskResult.action) {
      case 'FULL_EXIT':
        // 강제 청산 요구
        setLockReasonCode('HOLDING_RISK_FULL_EXIT');
        setLockUntil(Date.now() + 2 * 60 * 60 * 1000); // 2시간
        setPhase('LOCKED');
        alert(`⚠️ 강제 청산 필요\n\n사유: ${riskResult.reason}\n\n포지션을 즉시 청산하고 2시간 휴식하세요.`);
        break;

      case 'REDUCE_50':
        // 50% 감축 요구
        setLockReasonCode('HOLDING_RISK_REDUCE');
        alert(`⚠️ 포지션 50% 감축 필요\n\n사유: ${riskResult.reason}\n\n물량의 절반을 즉시 청산하세요.`);
        break;

      case 'LOCK_2H':
        // 즉시 LOCK
        setLockReasonCode('MENTAL_BREAKEVEN_LOSS');
        setLockUntil(Date.now() + 2 * 60 * 60 * 1000);
        setPhase('LOCKED');
        
        // OS에 플래그 저장 (다음 PRELOCK에서 사용)
        setOs(prev => ({
          ...prev,
          mentalBreakevenFlag: true,
        }));
        
        alert(`🔒 심리적 본절로스 감지\n\n${riskResult.reason}\n\n2시간 강제 휴식입니다.`);
        break;

      default:
        break;
    }
  };

  const handleTradeExit = (result) => {
    pushSnapshot(); // UNDO support
    const now = Date.now();
    const pnl = parseFloat(result.pnl || 0);
    const prevOs = osRef.current;
    
    // [필수 3] session.trades 적재
    const trade = {
      ts: new Date().toISOString(),
      pnl,
      reason: result.reason || 'manual',
      direction: session.direction,
      entryPrice: session.entryPrice,
      leverage: session.leverage,
      coinType: session.coinType
    };
    setSession(prev => ({
      ...prev,
      trades: [...prev.trades, trade]
    }));
    
    const nextConsecutiveSL = pnl < 0 ? prevOs.consecutiveSL + 1 : pnl > 0 ? 0 : prevOs.consecutiveSL;
    
    let lockPlan = null;
    
    if (pnl <= -30) {
      lockPlan = {
        until: now + 240 * 60 * 1000,
        reasonCode: 'BIG_LOSS_30_LOCK_4H',
        action: 'LOCK',
        data: { pnl }
      };
    } else if (pnl >= 30) {
      lockPlan = {
        until: now + 60 * 60 * 1000,
        reasonCode: 'BIG_WIN_30_LOCK_1H',
        action: 'LOCK',
        data: { pnl }
      };
    }
    
    // ⭐ P0: nextOs 계산 (단일 트랜잭션, 레이스 방지)
    // 쿨다운까지 포함한 최종 OS 상태를 한 번에 계산
    let cooldownUntil = null;
    let cooldownReasonCode = '';
    
    if (pnl < 0) {
      let cooldownMs = 0;
      
      if (nextConsecutiveSL === 1) {
        cooldownMs = 30 * 60 * 1000;
        cooldownReasonCode = 'CONSECUTIVE_SL_1_LOCK_30M';
      } else if (nextConsecutiveSL === 2) {
        cooldownMs = 60 * 60 * 1000;
        cooldownReasonCode = 'CONSECUTIVE_SL_2_LOCK_60M';
      } else if (nextConsecutiveSL >= 3) {
        cooldownMs = 12 * 60 * 60 * 1000;
        cooldownReasonCode = 'CONSECUTIVE_SL_3_LOCK_12H';
        // 3회 연속 손실은 lockPlan으로 처리
        if (!lockPlan) {
          lockPlan = {
            until: now + cooldownMs,
            reasonCode: cooldownReasonCode,
            action: 'LOCK',
            data: { consecutiveSL: nextConsecutiveSL }
          };
        }
      }
      
      cooldownUntil = now + cooldownMs;
    }
    
    const nextOs = {
      ...prevOs,
      consecutiveSL: nextConsecutiveSL,
      ...(pnl < 0 && { lastLossAt: now }),
      ...(pnl <= -30 && { lastBigLossAt: now }),
      ...(pnl >= 30 && { lastBigWinAt: now }),
      ...(cooldownUntil && { globalCooldownUntil: cooldownUntil }) // ⭐ 쿨다운 포함
    };
    
    // ⭐ P0: setOs 한 번만 호출 (레이스 제거)
    setOs(nextOs);

    // [필수 1] 손실 쿨다운 로그
    if (pnl < 0 && cooldownUntil) {
      const cooldownEventId = getEventId('LOSS_COOLDOWN_SET', session.id);
      addLog('LOSS_COOLDOWN_SET', { pnl, cooldownUntil, consecutiveSL: nextConsecutiveSL, reasonCode: cooldownReasonCode }, cooldownEventId);
    }
    
    const exitEventId = getEventId('TRADE_EXIT', session.id);
    // ⭐ osOverride로 정확한 OS 전달
    if (!addLog('TRADE_EXIT', { ...result, pnl, nextConsecutiveSL }, exitEventId, nextOs)) return;
    
    // ⭐ Exit Report 데이터 저장
    setExitReportData({
      session: { ...session },
      os: { ...nextOs },
      pnl,
      violations: [],
    });
    
    if (lockPlan) {
      const lockEventId = getEventId(lockPlan.action, session.id);
      
      if (addLog(lockPlan.action, {
        reasonCode: lockPlan.reasonCode,
        ...lockPlan.data,
        lockUntil: lockPlan.until
      }, lockEventId)) {
        setLockReasonCode(lockPlan.reasonCode);
        setLockUntil(lockPlan.until);
        setPhase('LOCKED');
        
        // ⭐ LOCK 후에도 Exit Report 표시
        setExitReportModal(true);
      }
      return;
    }
    
    // ⭐ EXIT_REPORT_SHOWN 로그
    const reportEventId = getEventId('EXIT_REPORT_SHOWN', session.id);
    addLog('EXIT_REPORT_SHOWN', { pnl }, reportEventId);
    
    setPhase('REVIEW');
    setExitReportModal(true); // ⭐ Exit Report 표시
  };

  const handleStop = () => {
    pushSnapshot(); // UNDO support
    const eventId = getEventId('STOP', session.id);
    
    if (addLog('STOP', { reason: 'user_stop', reasonCode: 'MANUAL_STOP' }, eventId)) {
      setLockReasonCode('MANUAL_STOP');
      setPhase('LOCKED');
      setLockUntil(Date.now() + 2 * 60 * 60 * 1000);
    }
  };

  const handleResetTimer = () => {
    const prevEntryAt = session.entryAt;
    const newEntryAt = Date.now();
    
    setSession(prev => ({ ...prev, entryAt: newEntryAt }));
    
    const eventId = getEventId('TIMER_RESET', session.id);
    addLog('TIMER_RESET', { prevEntryAt, newEntryAt }, eventId);
  };

  const handleAbortSession = () => {
    pushSnapshot(); // UNDO support
    
    const slot = activeSlot; // 현재 관리중 슬롯
    const now = Date.now();
    
    const eventId = getEventId('SESSION_ABORT', session.id);
    addLog('SESSION_ABORT', {
      slot,
      phaseFrom: 'INTRA',
      timeInPositionMin: session.entryAt ? Math.floor((now - session.entryAt) / 60000) : null,
      statusBefore: session.status
    }, eventId);
    
    // ✅ 슬롯 종료 (Abort는 '정리된 종료'로 취급)
    if (slot) {
      setPositions(prev => ({
        ...prev,
        [slot]: {
          ...(prev[slot] || {}),
          status: 'ABORTED',
          abortedAt: now
        }
      }));
    }
    
    // ⭐ activeSlot은 REVIEW_COMPLETE에서 해제 (REVIEW에서 어떤 슬롯인지 유지)
    setHoldingCheckModal(false);
    setSelectedCoin(null);
    
    setEmotionalInputs({
      urgency: null,
      recoveryDesire: null,
      overconfidence: null,
      focusClarity: null,
      physicalFatigue: null,
      holdDesire: null
    });
    
    // ✅ 리뷰로 보내서 "도망 버튼" 방지
    setPhase('REVIEW');
  };

  const handleHoldingCheck = (answer) => {
    setHoldingCheckModal(false);
    
    const eventId = getEventId('HOLDING_CHECK', session.id);
    addLog('HOLDING_CHECK', { answer }, eventId);

    if (answer === 'unclear') {
      const stopEventId = getEventId('STOP', session.id);
      if (addLog('STOP', { reasonCode: 'HOLDING_POSITION_UNCLEAR', reason: 'holding_check_unclear' }, stopEventId)) {
        setLockReasonCode('HOLDING_POSITION_UNCLEAR');
        setPhase('LOCKED');
        setLockUntil(Date.now() + 2 * 60 * 60 * 1000);
      }
    }
  };

  const handleReviewComplete = (capitalSecured) => {
    setCapitalAnswer(null); // Reset capital answer for next session
    setSession(prev => ({ ...prev, capitalSecured, status: 'CLOSED', closedAt: Date.now() }));
    
    // positions에도 CLOSED 반영
    setPositions(prev => ({
      ...prev,
      [activeSlot]: {
        ...(prev[activeSlot] || {}),
        status: 'CLOSED',
        closedAt: Date.now(),
        capitalSecured
      }
    }));
    
    const eventId = getEventId('REVIEW_COMPLETE', session.id);
    addLog('REVIEW_COMPLETE', { capitalSecured, slot: activeSlot }, eventId);

    // Update discipline score based on capital security
    if (capitalSecured === false) {
      setOs(prev => ({
        ...prev,
        dopamineIndex: Math.min(100, prev.dopamineIndex + 10),
        disciplineScore: Math.max(0, prev.disciplineScore - 5)
      }));
    } else if (capitalSecured === true) {
      setOs(prev => ({
        ...prev,
        disciplineScore: Math.min(100, prev.disciplineScore + 2)
      }));
    }

    // activeSlot 해제 (다음 진입 가능)
    setActiveSlot(null);
    
    setPhase('HOME');
    setEmotionalInputs({
      urgency: null,
      recoveryDesire: null,
      overconfidence: null,
      focusClarity: null,
      physicalFatigue: null,
      holdDesire: null
    });
  };

  const handleBackToHome = () => {
    const eventId = getEventId('NAV_BACK', session.id);
    addLog('NAV_BACK', { from: 'SETUP', to: 'HOME' }, eventId);
    setPhase('HOME');
  };

  const handleBackToSetup = () => {
    const eventId = getEventId('NAV_BACK', session.id);
    addLog('NAV_BACK', { from: 'PRELOCK', to: 'SETUP' }, eventId);
    setPhase('SETUP');
  };

  const handleSkipReview = () => {
    const eventId = getEventId('REVIEW_SKIP', session.id);
    addLog('REVIEW_SKIP', {}, eventId);
    handleReviewComplete(null);
  };

  const handleResetPrelock = () => {
    pushSnapshot(); // UNDO support
    const eventId = getEventId('PRELOCK_RESET', session.id);
    addLog('PRELOCK_RESET', {}, eventId);

    setEmotionalInputs({
      urgency: null,
      recoveryDesire: null,
      overconfidence: null,
      focusClarity: null,
      physicalFatigue: null,
      holdDesire: null
    });
    
    // ⭐ 서약 초기화
    setOathAccepted(false);

    setSession(prev => ({
      ...prev,
      invalidationSchema: { type: null, trigger: '', action: null },
      slConfirmed: false,
      tpConfirmed: false
    }));
  };

  // ========== RENDERS ==========
  
  const renderTimeLeft = () => {
    if (!lockUntil) return null;
  
    const now = Date.now();
    const diff = lockUntil - now;
    
    if (diff <= 0) return '해제됨'; // useEffect handles unlock
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hours}시간 ${mins}분 ${secs}초`;
  };

  const renderCooldownTimeLeft = () => {
    if (!os.globalCooldownUntil) return null; // ⭐ os 기반
    const now = Date.now();
    const diff = os.globalCooldownUntil - now; // ⭐ os 기반
    
    if (diff <= 0) return null;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}시간 ${mins}분`;
  };

  // ========== PHASE RENDERS ==========
  
  if (phase === 'HOME') {
    const cooldownActive = os.globalCooldownUntil && Date.now() < os.globalCooldownUntil;
    
    const rollsUsedToday = (dailyFortune && dailyFortune.date === new Date().toISOString().split('T')[0])
      ? dailyFortune.rollsUsed
      : 0;
    
    const canRoll = rollsUsedToday < 5;

    return (
      <div className="min-h-screen bg-slate-950">
        {/* 🎨 수채화 배경 헤더 */}
        <div className="relative overflow-hidden">
          {/* 그라데이션 수채화 배경 */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-300/20 via-cyan-200/15 to-emerald-200/10"></div>
          <div className="absolute inset-0 bg-gradient-to-tr from-amber-100/10 via-sky-200/15 to-blue-300/20"></div>
          
          {/* 수채화 텍스처 오버레이 */}
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: `
              radial-gradient(circle at 20% 30%, rgba(147, 197, 253, 0.3) 0%, transparent 50%),
              radial-gradient(circle at 80% 20%, rgba(165, 243, 252, 0.2) 0%, transparent 50%),
              radial-gradient(circle at 40% 70%, rgba(134, 239, 172, 0.2) 0%, transparent 50%),
              radial-gradient(circle at 90% 80%, rgba(253, 230, 138, 0.2) 0%, transparent 50%)
            `
          }}></div>
          
          {/* 컨텐츠 */}
          <div className="relative p-8 pb-16">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-2">
                <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-300 via-cyan-200 to-blue-400 bg-clip-text text-transparent drop-shadow-lg">
                  WAVE 🌊
                </h1>
              </div>
              <p className="text-slate-200 text-base mb-1 drop-shadow font-semibold leading-relaxed">
                {WAVE_VISION.primary}
              </p>
            </div>
          </div>
          
          {/* 물결 효과 하단 */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-b from-transparent to-slate-950"></div>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="max-w-2xl mx-auto px-8 -mt-8">
          <div className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              id="devMode"
              checked={devMode}
              onChange={(e) => setDevMode(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="devMode" className="text-xs text-slate-500">
              개발 모드 (쿨다운 무시)
            </label>
          </div>
          
          {/* ⭐ Market Sentiment 카드 */}
          {marketSentiment && (
            <div className="mb-4 p-4 bg-gradient-to-br from-indigo-900/30 to-blue-900/20 backdrop-blur rounded-lg border border-indigo-400/30 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-indigo-300">📊 Market Sentiment</h3>
                <button
                  onClick={loadMarketSentiment}
                  disabled={sentimentLoading}
                  className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                >
                  {sentimentLoading ? '⏳' : '🔄'}
                </button>
              </div>
              
              {(() => {
                const regime = getSentimentRegime(marketSentiment.value);
                const color = getSentimentColor(regime);
                const warning = getSentimentWarning(regime);
                
                return (
                  <>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className={`text-3xl font-bold ${color}`}>
                        {marketSentiment.value}
                      </span>
                      <span className="text-sm text-slate-400">/ 100</span>
                    </div>
                    
                    <div className="mb-2">
                      <span className={`text-sm font-semibold ${color}`}>
                        {marketSentiment.classification}
                      </span>
                      <span className="text-xs text-slate-400 ml-2">
                        ({regime.replace('_', ' ')})
                      </span>
                    </div>
                    
                    <div className="text-xs text-slate-300 mb-2 p-2 bg-slate-900/40 rounded border border-indigo-500/20">
                      {warning}
                    </div>
                    
                    <div className="text-xs text-slate-500">
                      Updated: {new Date(marketSentiment.updatedAt).toLocaleTimeString('ko-KR')}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
          
          {/* ⭐ WAVE OATH 배너 (생존 OS 강제 규칙) */}
          <div className="mb-4 p-4 bg-gradient-to-br from-red-900/30 to-orange-900/20 backdrop-blur rounded-lg border border-red-400/40 shadow-xl">
            <h3 className="text-sm font-bold text-red-300 mb-2">🔒 WAVE OATH</h3>
            <div className="text-xs text-slate-200 space-y-1 mb-3">
              <p>• 7,000달러의 손실을 기억하라.</p>
              <p>• WAVE를 통과하지 않은 매매는 인정하지 않는다.</p>
            </div>
            
            {/* ⭐ 서약 동의 체크박스 */}
            <div className="mb-3 flex items-center justify-between gap-3 p-2 rounded bg-slate-900/40 border border-red-400/20">
              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={oathAccepted}
                  onChange={(e) => setOathAccepted(e.target.checked)}
                  className="w-4 h-4"
                />
                오늘 WAVE 서약에 동의한다
              </label>
              <span className={`text-xs font-bold ${oathAccepted ? 'text-emerald-300' : 'text-amber-300'}`}>
                {oathAccepted ? 'ACCEPTED' : 'REQUIRED'}
              </span>
            </div>
            
            <div className="border-t border-red-400/30 pt-2 mb-2">
              <p className="text-xs text-red-200 font-semibold mb-1">오늘의 강제 규칙:</p>
              <ul className="text-xs text-slate-300 space-y-0.5 ml-3">
                <li>• SL/TP 미확정 → 30분 LOCK</li>
                <li>• 연속 손절 3회 → 12시간 강제 휴식</li>
                <li>• 홀딩 시간 초과 → 감축 또는 강제 청산</li>
              </ul>
            </div>
            
            <div className="border-t border-red-400/30 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">현재 상태:</span>
                <button
                  type="button"
                  onClick={() => {
                    if (lockUntil && Date.now() < lockUntil) {
                      alert(`🔒 LOCKED\n\n남은 시간: ${renderTimeLeft()}\n사유: ${lockReasonCode || 'UNKNOWN'}\n\n잠금이 해제되면 다시 시도하세요.`);
                      return;
                    }
                    if (os.globalCooldownUntil && Date.now() < os.globalCooldownUntil) {
                      alert(`⏳ COOLDOWN\n\n남은 시간: ${renderCooldownTimeLeft()}\n\n권장 행동: 마지막 손실 복기 작성\n쿨다운 종료 후 거래를 재개하세요.`);
                      return;
                    }
                    alert(`✅ READY\n\n다음 단계:\n1. START SESSION 클릭\n2. SETUP에서 코인/레버리지 선택\n3. PRELOCK에서 서약 체크 + 무효화/SLTP 확정\n4. INTRA 진입\n\n서약에 동의하고 규칙을 통과해야 진입할 수 있습니다.`);
                  }}
                  className={`text-xs font-bold underline underline-offset-4 cursor-pointer hover:opacity-80 transition-opacity ${
                    (lockUntil && Date.now() < lockUntil) ? 'text-red-300' :
                    (os.globalCooldownUntil && Date.now() < os.globalCooldownUntil) ? 'text-yellow-300' :
                    'text-green-300'
                  }`}
                >
                  {(lockUntil && Date.now() < lockUntil) 
                    ? `LOCKED (${renderTimeLeft()})`
                    : (os.globalCooldownUntil && Date.now() < os.globalCooldownUntil)
                    ? `COOLDOWN (${renderCooldownTimeLeft()})`
                    : 'READY'}
                </button>
              </div>
            </div>
          </div>
          
          {/* [패치 3-A] UserKey 입력 */}
          <div className="mb-4 p-4 bg-slate-800/70 backdrop-blur rounded-lg border border-cyan-500/20 shadow-lg">
            <div className="text-sm text-slate-300 mb-2">
              User Key: <span className="font-bold text-cyan-300">{userKey}</span>
              {userKey === 'guest' && <span className="ml-2 text-amber-300">(기본값)</span>}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={userKeyInput}
                onChange={(e) => setUserKeyInput(e.target.value)}
                placeholder="새 User Key 입력 (예: SUNG_MAN_01)"
                className="flex-1 bg-slate-700/80 p-2 rounded text-sm border border-cyan-500/30 focus:border-cyan-400 focus:outline-none"
              />
              <button
                onClick={() => handleUserKeyChange(userKeyInput)}
                className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded font-bold text-sm shadow-lg"
              >
                변경
              </button>
            </div>
          </div>
          
          {/* [패치 3-B] Export/Import */}
          <div className="mb-6 flex gap-2">
            <button
              onClick={handleExport}
              className="flex-1 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded font-bold text-sm shadow-lg"
            >
              📦 EXPORT (백업)
            </button>
            <button
              onClick={handleImport}
              className="flex-1 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded font-bold text-sm shadow-lg"
            >
              📥 IMPORT (복원)
            </button>
          </div>
          
          {/* Daily Fortune Button */}
          <button
            onClick={generateDailyFortune}
            disabled={!canRoll}
            className={`w-full mb-6 py-3 rounded-lg font-bold shadow-lg ${
              canRoll 
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400' 
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            {dailyFortune && dailyFortune.rollsUsed 
              ? `오늘 당신을 위한 재물운 🔮 (남은: ${5 - dailyFortune.rollsUsed}/5)` 
              : '오늘 당신을 위한 재물운 🔮 (5회)'}
          </button>
          
          {!canRoll && (
            <div className="mb-6 py-2 text-center text-slate-400 text-sm">
              오늘의 운세보기 끝 (내일 다시 해요)
            </div>
          )}

          {dailyFortune && dailyFortune.date === new Date().toISOString().split('T')[0] && (
            <div className="mt-4 mb-6 p-5 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur rounded-lg border border-amber-400/30 shadow-xl">
              <div className="text-sm text-amber-200/80">오늘의 모드</div>
              <div className={`text-3xl font-bold mt-1 ${dailyFortune.color} drop-shadow-lg`}>
                {dailyFortune.mode}
              </div>
              <div className="text-sm mt-2 text-slate-200">{dailyFortune.rule}</div>
              <div className="text-xs mt-3 text-slate-300/80 border-t border-slate-600/50 pt-2">
                {dailyFortune.message}
              </div>
            </div>
          )}

          {/* Loss Cooldown Warning */}
          {cooldownActive && (
            <div className="mb-6 p-4 bg-gradient-to-br from-red-900/40 to-red-800/30 backdrop-blur rounded-lg border border-red-400/40 shadow-xl">
              <div className="text-sm text-red-300 font-bold">⚠️ 손실 후 냉각 시간</div>
              <div className="text-2xl font-bold mt-1 text-red-200">{renderCooldownTimeLeft()} 남음</div>
              <div className="text-sm mt-2 text-slate-200">손실 복기 후 거래를 재개하세요</div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setTick(t => t + 1)}
                  className="px-3 py-2 rounded bg-slate-700/80 hover:bg-slate-600 text-xs font-bold border border-red-400/30"
                >
                  ↻ 새로고침
                </button>
              </div>
            </div>
          )}

          {/* WATCH POSITION (관측 포지션) */}
          <div className="mb-6 p-4 bg-gradient-to-br from-purple-900/30 to-indigo-900/20 backdrop-blur rounded-lg border border-purple-400/30 shadow-xl">
            <h3 className="text-sm font-semibold text-purple-300 mb-3">👁️ WATCH POSITION (관측 포지션)</h3>
            
            {!watchPosition ? (
              <button
                onClick={handleWatchCreate}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded font-bold shadow-lg"
              >
                + 관측 포지션 만들기
              </button>
            ) : (
              <div>
                <div className="mb-3 p-3 bg-slate-900/50 backdrop-blur rounded border border-purple-400/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-purple-200">{watchPosition.coinType}</span>
                    <span className="text-xs text-slate-300">
                      경과: {(() => {
                        const elapsed = Date.now() - watchPosition.entryAt;
                        const hours = Math.floor(elapsed / (1000 * 60 * 60));
                        const mins = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
                        return `${hours}h ${mins}m`;
                      })()}
                    </span>
                  </div>
                  {watchPosition.note && (
                    <div className="text-xs text-slate-200 mt-1">{watchPosition.note}</div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <select
                    value={watchPosition.coinType}
                    onChange={(e) => handleWatchUpdate({ coinType: e.target.value })}
                    className="bg-slate-700/80 p-2 rounded text-sm border border-purple-400/20"
                  >
                    <option value="BTC">BTC</option>
                    <option value="ALT">ALT</option>
                  </select>
                  <select
                    value={watchPosition.direction || ''}
                    onChange={(e) => handleWatchUpdate({ direction: e.target.value })}
                    className="bg-slate-700/80 p-2 rounded text-sm border border-purple-400/20"
                  >
                    <option value="">방향 선택</option>
                    <option value="LONG">LONG</option>
                    <option value="SHORT">SHORT</option>
                  </select>
                </div>
                
                <input
                  type="text"
                  value={watchPosition.note}
                  onChange={(e) => handleWatchUpdate({ note: e.target.value })}
                  placeholder="메모 (선택)"
                  className="w-full mb-2 bg-slate-700/80 p-2 rounded text-sm border border-purple-400/20"
                />
                
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={handleWatchPromote}
                    className="py-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 rounded font-bold text-xs shadow"
                  >
                    ⬆️ 승격
                  </button>
                  <button
                    onClick={handleWatchClose}
                    className="py-2 bg-slate-700/80 hover:bg-slate-600 rounded font-bold text-xs border border-purple-400/20"
                  >
                    종료
                  </button>
                  <button
                    onClick={() => setTick(t => t + 1)}
                    className="py-2 bg-slate-800/80 hover:bg-slate-700 rounded font-bold text-xs border border-purple-400/20"
                  >
                    ↻
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* OS Status */}
          <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/70 backdrop-blur p-6 rounded-lg mb-6 border border-cyan-500/20 shadow-xl">
            <h3 className="text-sm font-semibold text-cyan-300 mb-3">OS STATUS</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-400">Dopamine</div>
                <div className="text-2xl font-bold text-red-300">{os.dopamineIndex}%</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Revenge</div>
                <div className="text-2xl font-bold text-orange-300">{os.revengeIndex}%</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Discipline</div>
                <div className="text-2xl font-bold text-emerald-300">{os.disciplineScore}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Today STOP</div>
                <div className="text-2xl font-bold text-amber-300">{todayStopCount}/{ruleOfDay.stopLimitPerDay}</div>
              </div>
            </div>
          </div>

          {/* Last Position Snapshot (참고용) */}
          {lastPositionSnapshot && (
            <div className="mb-6 p-4 bg-gradient-to-br from-indigo-900/30 to-blue-900/20 backdrop-blur rounded-lg border border-indigo-400/30 shadow-xl">
              <h3 className="text-sm font-semibold text-indigo-300 mb-2">📊 직전 포지션 참고</h3>
              <div className="text-xs text-slate-200 space-y-1">
                <div>코인: {lastPositionSnapshot.coinType} / 방향: {lastPositionSnapshot.direction}</div>
                <div>바닥: {lastPositionSnapshot.bottom ? 'Yes' : 'No'} / 음펀비: {lastPositionSnapshot.negFundingLong ? 'Yes' : 'No'}</div>
                <div>근거: {lastPositionSnapshot.hasEntryReason ? 'Yes' : 'No'}</div>
              </div>
            </div>
          )}

          {/* ⭐ SLOTS (A/B) - HOME real-time monitor */}
          <div className="mb-6 p-4 bg-gradient-to-br from-slate-800/80 to-slate-900/70 backdrop-blur rounded-lg border border-cyan-500/20 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-cyan-300">🧩 SLOTS (A/B)</h3>
              <div className="flex items-center gap-3">
                <div className="text-xs text-slate-400">
                  {new Date().toLocaleTimeString('ko-KR')}
                </div>
                <button
                  onClick={() => setTick(t => t + 1)}
                  className="text-cyan-400 hover:text-cyan-300 transition-colors"
                  title="새로고침"
                >
                  🔄
                </button>
              </div>
            </div>

            {(['A','B']).map((slot) => {
              const p = positions?.[slot];
              const isOpen = p?.status === 'OPEN' && p?.entryAt;
              const elapsedText = isOpen ? getSlotElapsed(p) : null;

              return (
                <div key={slot} className="mb-3 p-3 bg-slate-900/50 backdrop-blur rounded border border-cyan-500/20">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-cyan-300">Slot {slot}</div>
                    <div className="text-xs text-slate-300">
                      {isOpen ? `경과: ${elapsedText}` : (p?.status ? `상태: ${p.status}` : '비어있음')}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-2 text-xs text-slate-200 space-y-1">
                      <div>코인: {p.coinType || 'N/A'} / 방향: {p.direction || 'N/A'} / 레버: {p.leverage ? `${p.leverage}x` : 'N/A'}</div>
                    </div>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleResumeSlot(slot)}
                      disabled={!isOpen}
                      className={`py-2 rounded font-bold text-xs shadow ${
                        isOpen ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500' : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      ▶ Resume
                    </button>

                    <button
                      onClick={() => handleExitFromHome(slot, { intent: 'TP' })}
                      disabled={!isOpen}
                      className={`py-2 rounded font-bold text-xs shadow ${
                        isOpen ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500' : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      ✅ 익절 종료
                    </button>

                    <button
                      onClick={() => handleExitFromHome(slot, { intent: 'SL' })}
                      disabled={!isOpen}
                      className={`py-2 rounded font-bold text-xs shadow ${
                        isOpen ? 'bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500' : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      ⚠️ 손절 종료
                    </button>

                    <button
                      onClick={() => handleStopFromHome(slot)}
                      disabled={!isOpen}
                      className={`py-2 rounded font-bold text-xs shadow ${
                        isOpen ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500' : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      ⛔ STOP
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Start Button */}
          <button
            onClick={handleStartSession}
            disabled={!devMode && (todayStopCount >= ruleOfDay.stopLimitPerDay || cooldownActive || (lockUntil && lockUntil > Date.now()))}
            className={`w-full py-4 rounded-lg font-bold text-lg transition-all shadow-xl ${
              !devMode && (todayStopCount >= ruleOfDay.stopLimitPerDay || cooldownActive || (lockUntil && lockUntil > Date.now()))
                ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed opacity-50'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white'
            }`}
          >
            {todayStopCount >= ruleOfDay.stopLimitPerDay 
              ? `STOP 한도 초과${devMode ? ' (devMode)' : ' - 오늘 거래 불가'}`
              : cooldownActive
                ? `손실 냉각 시간${devMode ? ' (devMode 무시)' : ' - 거래 불가'}`
                : (lockUntil && lockUntil > Date.now())
                  ? 'LOCKED - 신규 진입 금지'
                  : 'START SESSION'}
          </button>

          {/* Recent Logs - Mini Chart + Drilldown */}
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-slate-400 mb-3">RECENT LOGS</h3>

            {/* emotion flow graph */}
            <div className="mb-4 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
              <div className="text-xs text-slate-400 mb-2">감정 흐름 (Dopamine / Revenge / Fatigue)</div>
              <ResponsiveGraph logs={logs} height={220} />
            </div>

            {/* mini chart */}
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
              <div className="flex items-end gap-1 h-14">
                {logs.slice(-20).map((log) => (
                  <button
                    key={log.eventId}
                    onClick={() => setLogFocus(log.eventId)}
                    title={`${log.action} @ ${new Date(log.timestamp).toLocaleTimeString()}`}
                    className={`flex-1 rounded-sm ${getLogColorClass(log.action)} opacity-80 hover:opacity-100 transition`}
                    style={{ height: `${12 + (log.action === "LOCK" || log.action === "STOP" ? 40 : 22)}px` }}
                  />
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 bg-red-500 inline-block rounded-sm"/>LOCK/STOP</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 bg-fuchsia-500 inline-block rounded-sm"/>PRELOCK</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 inline-block rounded-sm"/>EXIT</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 bg-cyan-500 inline-block rounded-sm"/>SESSION</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 bg-slate-500 inline-block rounded-sm"/>ETC</span>
              </div>
            </div>

            {/* drilldown grid */}
            <div className="mt-4 bg-slate-800/30 rounded-lg border border-slate-700/50 overflow-hidden">
              <button
                type="button"
                onClick={() => setRecentLogsOpen(v => !v)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-800/30 transition"
              >
                <div className="text-xs text-slate-300">
                  {logFocus ? "상세 로그 (선택됨)" : "상세 로그 (최근 10개)"} · {recentLogsOpen ? "접기" : "펼치기"}
                </div>
                <span className="text-slate-400 text-xs">{recentLogsOpen ? "▲" : "▼"}</span>
              </button>

              {recentLogsOpen && (
                <div className="p-4 border-t border-slate-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-slate-400">
                      {logFocus ? "선택 이벤트 상세" : "최근 이벤트 상세"}
                    </div>
                    {logFocus && (
                      <button
                        type="button"
                        onClick={() => setLogFocus(null)}
                        className="text-xs text-slate-400 hover:text-white"
                      >
                        선택 해제
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {(logFocus
                      ? logs.filter(l => l.eventId === logFocus)
                      : logs.slice(-10).reverse()
                    ).map((log) => (
                      <div key={log.eventId} className="bg-slate-900/40 p-3 rounded border border-slate-700/40">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-cyan-300 text-sm">{log.action}</span>
                          <span className="text-slate-500 text-xs">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>

                        {/* JSON 2단 접기 */}
                        <details className="mt-2">
                          <summary className="text-xs text-slate-400 cursor-pointer select-none hover:text-white">
                            데이터 보기
                          </summary>
                          <pre className="mt-2 text-xs text-slate-300 whitespace-pre-wrap break-words">
{JSON.stringify(log.data || {}, null, 2)}
                          </pre>
                        </details>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Compound Magic */}
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-slate-400 mb-3">복리의 마법</h3>

            <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
              <div className="grid grid-cols-3 gap-3">
                <input
                  value={compoundInput.seed}
                  onChange={(e) => setCompoundInput(prev => ({ ...prev, seed: e.target.value }))}
                  className="bg-slate-900/50 border border-slate-700 rounded p-3 text-center font-bold"
                  placeholder="시드 (예: 8000)"
                />
                <input
                  value={compoundInput.rate}
                  onChange={(e) => setCompoundInput(prev => ({ ...prev, rate: e.target.value }))}
                  className="bg-slate-900/50 border border-slate-700 rounded p-3 text-center font-bold"
                  placeholder="수익률% (예: 5)"
                />
                <input
                  value={compoundInput.count}
                  onChange={(e) => setCompoundInput(prev => ({ ...prev, count: e.target.value }))}
                  className="bg-slate-900/50 border border-slate-700 rounded p-3 text-center font-bold"
                  placeholder="횟수 (예: 30)"
                />
              </div>

              <button
                onClick={() => setCompoundRows(buildCompoundTable(compoundInput))}
                className="w-full mt-4 py-3 rounded-lg font-bold bg-cyan-600 hover:bg-cyan-700"
              >
                표 생성
              </button>

              {compoundRows.length > 0 && (
                <div className="mt-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-slate-900/40 p-3 rounded border border-slate-700/50">
                      <div className="text-slate-400 text-xs">최종 잔고</div>
                      <div className="text-xl font-bold text-emerald-300">
                        {compoundRows[compoundRows.length - 1].balance.toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-slate-900/40 p-3 rounded border border-slate-700/50">
                      <div className="text-slate-400 text-xs">누적 출금</div>
                      <div className="text-xl font-bold text-yellow-300">
                        {compoundRows[compoundRows.length - 1].totalWithdraw.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 max-h-80 overflow-auto rounded border border-slate-700/50">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-slate-900">
                        <tr className="text-slate-400">
                          <th className="p-2 text-left">#</th>
                          <th className="p-2 text-left">타입</th>
                          <th className="p-2 text-right">손익</th>
                          <th className="p-2 text-right">출금</th>
                          <th className="p-2 text-right">누적출금</th>
                          <th className="p-2 text-right">잔고</th>
                        </tr>
                      </thead>
                      <tbody>
                        {compoundRows.map(r => (
                          <tr key={r.turn} className="border-t border-slate-800">
                            <td className="p-2 text-slate-300">{r.turn}</td>
                            <td className={`p-2 font-bold ${r.type === "SL" ? "text-red-300" : "text-emerald-300"}`}>
                              {r.type}
                            </td>
                            <td className={`p-2 text-right ${r.pnl < 0 ? "text-red-300" : "text-emerald-300"}`}>
                              {r.pnl.toFixed(2)}
                            </td>
                            <td className="p-2 text-right text-yellow-200">{r.withdraw.toFixed(2)}</td>
                            <td className="p-2 text-right text-yellow-300">{r.totalWithdraw.toFixed(2)}</td>
                            <td className="p-2 text-right text-slate-100">{r.balance.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 text-xs text-slate-400">
                    규칙: 승리 시 수익의 50% 출금 / 10회 중 3회 손절 / 손절은 잔고의 3%
                  </div>
                </div>
              )}
            </div>
          </div>

        {/* Fortune Modal */}
        {fortuneModal && dailyFortune && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 p-8 rounded-lg max-w-md w-full border border-purple-500">
              <h3 className="text-2xl font-bold mb-4 text-center">🔮 오늘의 재물운</h3>
              <div className="text-center mb-6">
                <div className={`text-4xl font-bold mb-2 ${dailyFortune.color}`}>{dailyFortune.mode}</div>
                <div className="text-sm text-slate-200 mb-3">{dailyFortune.rule}</div>
                <p className="text-lg text-slate-300">{dailyFortune.message}</p>
              </div>
              <button
                onClick={() => setFortuneModal(false)}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold"
              >
                확인
              </button>
            </div>
          </div>
        )}

        {/* EXPORT Modal */}
        {exportModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 p-6 rounded-lg max-w-2xl w-full border border-green-500">
              <h3 className="text-xl font-bold mb-3">📦 EXPORT (백업 JSON)</h3>
              <p className="text-xs text-slate-400 mb-3">아래 내용을 길게 눌러 전체 복사하세요.</p>
              <textarea
                value={exportText}
                readOnly
                className="w-full h-80 bg-slate-900/60 border border-slate-700 rounded p-3 text-xs font-mono"
              />
              <div className="mt-3 flex gap-2 justify-end">
                <button
                  onClick={() => {
                    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(exportText).catch(() => {});
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-bold text-sm"
                >
                  복사 시도
                </button>
                <button
                  onClick={() => setExportModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded font-bold text-sm"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* IMPORT Modal */}
        {importModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 p-6 rounded-lg max-w-2xl w-full border border-blue-500">
              <h3 className="text-xl font-bold mb-3">📥 IMPORT (복원 JSON)</h3>
              <p className="text-xs text-slate-400 mb-3">백업 JSON을 붙여넣고 "복원"을 누르세요.</p>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="w-full h-80 bg-slate-900/60 border border-slate-700 rounded p-3 text-xs font-mono"
                placeholder="여기에 백업 JSON 붙여넣기"
              />
              <div className="mt-3 flex gap-2 justify-end">
                <button
                  onClick={confirmImport}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-bold text-sm"
                >
                  복원
                </button>
                <button
                  onClick={() => setImportModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded font-bold text-sm"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    );
  }

  if (phase === 'SETUP') {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={handleBackToHome}
              className="text-slate-400 hover:text-white transition-colors"
            >
              ← HOME
            </button>
            <h2 className="text-3xl font-bold">SETUP</h2>
            <div className="w-20"></div>
          </div>
          
          <div className="bg-slate-800 p-6 rounded-lg space-y-6">
            <div>
              <label className="block text-sm mb-2 font-semibold">코인 선택 (필수)</label>
              <p className="text-xs text-slate-400 mb-3">
                선택한 코인 타입에 따라 최대 레버리지와 홀딩 시간 알림 기준이 결정됩니다.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedCoin('BTC')}
                  className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                    selectedCoin === 'BTC'
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  BTC (최대 15배)
                </button>
                <button
                  onClick={() => setSelectedCoin('ALT')}
                  className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                    selectedCoin === 'ALT'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  ALT (최대 5배)
                </button>
              </div>
              {selectedCoin && (
                <div className="mt-3 p-3 bg-slate-700/50 rounded text-xs">
                  <p className="font-semibold mb-1">
                    {selectedCoin === 'BTC' ? 'BTC 홀딩 시간 알림:' : 'ALT 홀딩 시간 알림:'}
                  </p>
                  <p className="text-slate-400">
                    {selectedCoin === 'BTC' 
                      ? '60분(주의) → 240분(경고) → 241분+(위험)'
                      : '15분(주의) → 60분(경고) → 240분+(위험)'}
                  </p>
                </div>
              )}
            </div>

            {/* Leverage Input */}
            {selectedCoin && (
              <div>
                <label className="block text-sm mb-2 font-semibold">레버리지 (필수)</label>
                <p className="text-xs text-slate-400 mb-3">
                  {selectedCoin === 'BTC' ? '1배 ~ 15배' : '1배 ~ 5배'}
                </p>
                <select
                  value={session.leverage || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!Number.isNaN(val)) {
                      setSession(prev => ({ ...prev, leverage: val }));
                    }
                  }}
                  className="w-full bg-slate-700 p-3 rounded text-center text-xl font-bold"
                >
                  <option value="">선택</option>
                  {Array.from({ length: selectedCoin === 'BTC' ? 15 : 5 }, (_, i) => i + 1).map(v => (
                    <option key={v} value={v}>{v}x</option>
                  ))}
                </select>
                {session.leverage && (
                  <div className="mt-2 text-center text-sm text-slate-400">
                    현재 레버리지: <span className="text-white font-bold">{session.leverage}x</span>
                  </div>
                )}
              </div>
            )}

            {/* Direction (LONG/SHORT) */}
            {selectedCoin && session.leverage && (
              <div>
                <label className="block text-sm mb-2 font-semibold">방향 (필수)</label>
                <p className="text-xs text-slate-400 mb-3">SHORT는 LONG보다 리스크 가중치가 높습니다.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSession(prev => ({ ...prev, direction: 'LONG' }))}
                    className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                      session.direction === 'LONG'
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    LONG
                  </button>
                  <button
                    onClick={() => setSession(prev => ({ ...prev, direction: 'SHORT', negFundingLong: false }))}
                    className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                      session.direction === 'SHORT'
                        ? 'bg-red-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    SHORT
                  </button>
                </div>
              </div>
            )}

            {/* Bottom (바닥 형국) */}
            {session.direction && (
              <div>
                <label className="block text-sm mb-2 font-semibold">바닥 형국인가? (필수)</label>
                <p className="text-xs text-slate-400 mb-3">바닥 판단은 홀딩 경고 완화에 영향을 줍니다.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSession(prev => ({ ...prev, bottom: true }))}
                    className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                      session.bottom === true
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setSession(prev => ({ ...prev, bottom: false }))}
                    className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                      session.bottom === false
                        ? 'bg-slate-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            )}

            {/* Negative Funding (LONG only) */}
            {session.direction === 'LONG' && session.bottom !== null && (
              <div>
                <label className="block text-sm mb-2 font-semibold">음펀비인가? (LONG 전용)</label>
                <p className="text-xs text-slate-400 mb-3">음펀비 + 바닥이면 홀딩 경고가 완화됩니다.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSession(prev => ({ ...prev, negFundingLong: true }))}
                    className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                      session.negFundingLong === true
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setSession(prev => ({ ...prev, negFundingLong: false }))}
                    className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                      session.negFundingLong === false
                        ? 'bg-slate-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            )}

            {/* Has Entry Reason */}
            {session.bottom !== null && (session.direction === 'SHORT' || session.negFundingLong !== null) && (
              <div>
                <label className="block text-sm mb-2 font-semibold">진입 근거가 명확히 있는가? (필수)</label>
                <p className="text-xs text-slate-400 mb-3">
                  패턴(더블탑/삼각수렴/3음봉/이격도) 등 근거가 하나라도 있으면 Yes
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSession(prev => ({ ...prev, hasEntryReason: true }))}
                    className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                      session.hasEntryReason === true
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setSession(prev => ({ ...prev, hasEntryReason: false }))}
                    className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                      session.hasEntryReason === false
                        ? 'bg-yellow-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            )}

            {/* Slot Select (A/B) */}
            {session.hasEntryReason !== null && (
              <div>
                <label className="block text-sm mb-2 font-semibold">포지션 슬롯 선택 (필수)</label>
                <p className="text-xs text-slate-400 mb-3">
                  A/B 둘 다 OPEN이면 신규 진입 불가 (청산 후 재진입)
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setActiveSlot('A')}
                    disabled={positions.A && positions.A.status === 'OPEN'}
                    className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                      activeSlot === 'A'
                        ? 'bg-blue-600 text-white'
                        : positions.A && positions.A.status === 'OPEN'
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Slot A {positions.A && positions.A.status === 'OPEN' && '(사용중)'}
                  </button>
                  <button
                    onClick={() => setActiveSlot('B')}
                    disabled={positions.B && positions.B.status === 'OPEN'}
                    className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                      activeSlot === 'B'
                        ? 'bg-blue-600 text-white'
                        : positions.B && positions.B.status === 'OPEN'
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Slot B {positions.B && positions.B.status === 'OPEN' && '(사용중)'}
                  </button>
                </div>
                {positions.A && positions.A.status === 'OPEN' && positions.B && positions.B.status === 'OPEN' && (
                  <div className="mt-3 p-3 bg-red-900/30 rounded text-xs text-red-300">
                    ⚠️ 슬롯이 꽉 찼습니다. 기존 포지션을 청산 후 재진입하세요.
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => handleSetupComplete(selectedCoin)}
              disabled={!selectedCoin || !session.leverage || !session.direction || session.bottom === null || (session.direction === 'LONG' && session.negFundingLong === null) || session.hasEntryReason === null || !activeSlot || (positions.A && positions.A.status === 'OPEN' && positions.B && positions.B.status === 'OPEN')}
              className={`w-full py-3 rounded-lg font-bold mt-4 ${
                selectedCoin && session.leverage && session.direction && session.bottom !== null && (session.direction === 'SHORT' || session.negFundingLong !== null) && session.hasEntryReason !== null && activeSlot && !(positions.A && positions.A.status === 'OPEN' && positions.B && positions.B.status === 'OPEN')
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              NEXT
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'PRELOCK') {
    const emotionFields = [
      { key: 'urgency', label: '급함', desc: '지금 마음상태가 어떤가요?' },
      { key: 'recoveryDesire', label: '복구욕구', desc: '지금 복구심리가 있나요?' },
      { key: 'overconfidence', label: '과신', desc: '당신은 당신의 매매를 과신하고 있나요? 또는 핑크빛 미래가 보이나요?' },
      { key: 'focusClarity', label: '집중도', desc: '지금 집중할 수 있는 환경인가요? (내/외적 요인 포함)' },
      { key: 'physicalFatigue', label: '피로도', desc: '지금 몸과 정신의 피로도는 어떤가요?' },
      { key: 'holdDesire', label: '장기보유욕구', desc: '이거 더 간다고 확신하시는 건가요?' }
    ];

    const allEmotionsSet = emotionFields.every(f => emotionalInputs[f.key] !== null);
    const schemaComplete = session.invalidationSchema.type && session.invalidationSchema.trigger && session.invalidationSchema.action;
    const slTpComplete = session.slConfirmed && session.tpConfirmed;
    const canProceed = allEmotionsSet && schemaComplete && slTpComplete && oathAccepted; // ⭐ 서약 체크 추가

    return (
      <div className="min-h-screen bg-slate-900 text-white p-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={handleBackToSetup}
              className="text-slate-400 hover:text-white transition-colors"
            >
              ← SETUP
            </button>
            <h2 className="text-3xl font-bold">PRELOCK CHECK</h2>
            <button
              onClick={handleResetPrelock}
              className="text-slate-400 hover:text-white transition-colors text-sm"
            >
              RESET
            </button>
          </div>
          
          <div className="space-y-6">
            {/* Risk Score */}
            {(() => {
              const risk = calcRiskScore(session);
              return (
                <div className="bg-yellow-900/30 p-4 rounded-lg border border-yellow-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-yellow-300">⚠️ Risk Score</h3>
                    <span className="text-2xl font-bold text-yellow-200">{risk.score}</span>
                  </div>
                  {risk.reasons.length > 0 && (
                    <ul className="text-xs text-yellow-100 space-y-1 mt-2">
                      {risk.reasons.map((r, i) => <li key={i}>• {r}</li>)}
                    </ul>
                  )}
                  {session.direction === 'LONG' && session.negFundingLong && session.bottom && (
                    <div className="mt-2 text-xs text-cyan-300">
                      ✓ 홀딩 경고 완화 (LONG + 음펀비 + 바닥) - 단, 무효화 기준 준수 필수
                    </div>
                  )}
                </div>
              );
            })()}
            
            {/* Emotional Inputs */}
            <div className="bg-slate-800 p-6 rounded-lg">
              <h3 className="font-bold mb-4">감정 상태</h3>
              <div className="space-y-4">
                {emotionFields.map(field => (
                  <div key={field.key}>
                    <label className="block text-sm font-semibold mb-1">{field.label}</label>
                    <p className="text-xs text-slate-400 mb-2">{field.desc}</p>
                    <EmotionalBar
                      value={emotionalInputs[field.key]}
                      onChange={(v) => handleEmotionalInput(field.key, v)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* ⭐ 본절로스 플래그 체크: 추가 질문 */}
            {os.mentalBreakevenFlag && (
              <div className="bg-red-900/30 p-6 rounded-lg border-2 border-red-500">
                <h3 className="font-bold text-red-300 mb-4">🚨 심리 복구 확인 (필수)</h3>
                <p className="text-sm text-red-200 mb-4">
                  이전 거래에서 심리적 본절로스 징후가 감지되었습니다.
                  진입 전 반드시 아래 질문에 답변하세요.
                </p>
                
                <div className="space-y-4">
                  <div className="bg-slate-800/50 p-4 rounded">
                    <p className="text-sm font-bold mb-2">1. 지금 복구하려는 마음이 강한가요?</p>
                    <p className="text-xs text-slate-400 mb-3">
                      "손실을 만회해야 한다", "이번엔 꼭 수익을 내야 한다"는 생각이 강하면 위험합니다.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          alert('❌ STOP\n\n복구 심리가 강한 상태에서는 진입하지 마세요.\n충분히 쉬고 감정이 안정된 후 재시도하세요.');
                          handleBackToHome();
                        }}
                        className="flex-1 bg-red-600 hover:bg-red-700 py-2 rounded"
                      >
                        예 (강함)
                      </button>
                      <button
                        onClick={() => {
                          // 통과
                        }}
                        className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded"
                      >
                        아니오 (안정됨)
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-800/50 p-4 rounded">
                    <p className="text-sm font-bold mb-2">2. 포지션 크기를 평소보다 줄였나요?</p>
                    <p className="text-xs text-slate-400 mb-3">
                      심리 회복 단계에서는 물량을 줄여야 안전합니다.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          // 플래그 제거
                          setOs(prev => ({ ...prev, mentalBreakevenFlag: false }));
                        }}
                        className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded"
                      >
                        예 (줄임)
                      </button>
                      <button
                        onClick={() => {
                          alert('❌ STOP\n\n심리 회복 중에는 포지션 크기를 줄여야 합니다.\n레버리지나 물량을 줄인 후 재시도하세요.');
                          handleBackToHome();
                        }}
                        className="flex-1 bg-red-600 hover:bg-red-700 py-2 rounded"
                      >
                        아니오 (그대로)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Invalidation Schema */}
            <div className="bg-slate-800 p-6 rounded-lg">
              <h3 className="font-bold mb-4">무효화 조건 (필수)</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm mb-2">타입</label>
                  <select
                    value={session.invalidationSchema.type || ''}
                    onChange={(e) => handleInvalidationSchema('type', e.target.value)}
                    className="w-full bg-slate-700 p-3 rounded"
                  >
                    <option value="">선택</option>
                    <option value="PRICE">가격</option>
                    <option value="TIME">시간</option>
                    <option value="STRUCTURE">구조</option>
                    <option value="MOMENTUM">모멘텀</option>
                    <option value="VOLUME">거래량</option>
                    <option value="VOLATILITY">변동성</option>
                    <option value="ORDERBOOK">호가/매수벽</option>
                    <option value="NEWS_EVENT">뉴스/이벤트</option>
                    <option value="LIQUIDITY">유동성/슬리피지</option>
                    <option value="SYSTEM">시스템(규칙위반)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-2">트리거 (예: -5%, 30분, 전저점 붕괴)</label>
                  <input
                    type="text"
                    value={session.invalidationSchema.trigger}
                    onChange={(e) => handleInvalidationSchema('trigger', e.target.value)}
                    className="w-full bg-slate-700 p-3 rounded"
                    placeholder="구체적인 조건 입력"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2">액션</label>
                  <select
                    value={session.invalidationSchema.action || ''}
                    onChange={(e) => handleInvalidationSchema('action', e.target.value)}
                    className="w-full bg-slate-700 p-3 rounded"
                  >
                    <option value="">선택</option>
                    <option value="FULL_EXIT">전량 청산</option>
                    <option value="HALF_EXIT">50% 청산</option>
                  </select>
                </div>
              </div>
            </div>

            {/* SL/TP Confirmation */}
            <div className="bg-slate-800 p-6 rounded-lg">
              <h3 className="font-bold mb-4">손절/익절 확인 (필수)</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={session.slConfirmed}
                    onChange={(e) => setSession(prev => ({ ...prev, slConfirmed: e.target.checked }))}
                    className="w-5 h-5"
                  />
                  <span>손절가를 설정했습니다</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={session.tpConfirmed}
                    onChange={(e) => setSession(prev => ({ ...prev, tpConfirmed: e.target.checked }))}
                    className="w-5 h-5"
                  />
                  <span>익절가를 설정했습니다</span>
                </label>
              </div>
            </div>

            {/* ⭐ WAVE 서약 (생존 OS 강제) */}
            <div className="bg-gradient-to-br from-red-900/40 to-orange-900/30 p-6 rounded-lg border-2 border-red-400/50">
              <h3 className="font-bold text-red-300 mb-3">🔒 WAVE 서약 (필수)</h3>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={oathAccepted}
                  onChange={(e) => setOathAccepted(e.target.checked)}
                  className="w-5 h-5 mt-1 flex-shrink-0"
                />
                <span className="text-sm text-slate-200 leading-relaxed">
                  나는 <strong className="text-red-300">7,000달러의 손실</strong>을 기억한다. 
                  <strong className="text-red-300">WAVE를 통과하지 않은 매매는 인정하지 않는다.</strong>
                </span>
              </label>
              {!oathAccepted && (
                <p className="text-xs text-red-300 mt-2 ml-8">
                  ⚠️ 서약에 동의해야 진입할 수 있습니다.
                </p>
              )}
            </div>

            <button
              onClick={handlePrelockComplete}
              disabled={!canProceed}
              className={`w-full py-4 rounded-lg font-bold ${
                canProceed
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              CONFIRM
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'INTRA') {
    const elapsedMs = session.entryAt ? (Date.now() - session.entryAt) : 0;
    const elapsed = Math.floor(elapsedMs / (1000 * 60)); // minutes for limits check
    const limits = session.coinType ? getHoldingTimeLimits(session.coinType) : { soft: 0, warning: 0, danger: 0 };
    
    // Format as HH:MM:SS
    const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
    const mins = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((elapsedMs % (1000 * 60)) / 1000);
    const timeDisplay = `${hours}시간 ${mins}분 ${secs}초`;

    return (
      <div className="min-h-screen bg-slate-900 text-white p-8">
        <div className="max-w-2xl mx-auto">
          {/* Header with HOME button */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={handleGoHomeFromIntra}
              className="text-slate-400 hover:text-white transition-colors"
            >
              ← HOME
            </button>
            <h2 className="text-3xl font-bold">INTRA - 포지션 관리</h2>
            <div className="w-20"></div>
          </div>

          {/* ⭐ Close Panel */}
          {closeIntent && (
            <div className="mb-6 p-6 bg-blue-900/30 rounded-lg border border-blue-500/50">
              <h3 className="text-xl font-bold mb-4">
                {closeIntent === 'TP' ? '🟢 익절 종료' : closeIntent === 'SL' ? '🔴 손절 종료' : '⚪ 수동 종료'}
              </h3>
              
              <div className="mb-4">
                <label className="block text-sm text-slate-400 mb-2">PnL (%)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="예: 5.2 또는 -3.8"
                  value={closePnlInput}
                  onChange={e => setClosePnlInput(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded text-white text-lg"
                  autoFocus
                />
                <div className="text-xs text-slate-500 mt-1">
                  {closeIntent === 'TP' ? '양수(+)를 입력하세요' : closeIntent === 'SL' ? '음수(-)를 입력하세요' : '실제 PnL을 입력하세요'}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setCloseIntent(null);
                    setClosePnlInput('');
                  }}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded font-bold"
                >
                  취소
                </button>
                <button
                  onClick={handleConfirmClose}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 rounded font-bold"
                >
                  확정
                </button>
              </div>
            </div>
          )}
          
          {/* Control Buttons */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={handleResetTimer}
              className="flex-1 py-2 bg-yellow-600 hover:bg-yellow-700 rounded font-bold text-sm"
            >
              🔄 RESET TIMER
            </button>
            <button
              onClick={handleAbortSession}
              className="flex-1 py-2 bg-slate-600 hover:bg-slate-700 rounded font-bold text-sm"
            >
              ✕ ABORT → HOME
            </button>
          </div>

          {/* Holding Time Display */}
          <div className="bg-slate-800 p-6 rounded-lg mb-6">
            <h3 className="text-sm text-slate-400 mb-4">홀딩 시간</h3>
            <div className="text-4xl font-bold mb-2 font-mono">
              {timeDisplay}
            </div>
            <div className="text-sm text-slate-400">
              {elapsed >= limits.danger && <span className="text-red-400 font-bold">⚠️ 위험 구간 진입</span>}
              {elapsed >= limits.warning && elapsed < limits.danger && <span className="text-yellow-400 font-bold">⚠️ 경고</span>}
              {elapsed >= limits.soft && elapsed < limits.warning && <span className="text-blue-400">주의</span>}
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-lg mb-6">
            <h3 className="text-sm text-slate-400 mb-4">현재 상태</h3>
            
            {/* Coin Type & Leverage */}
            <div className="mb-4 pb-4 border-b border-slate-700">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500">종목</div>
                  <div className="text-xl font-bold text-blue-400">
                    {session.coinType || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">레버리지</div>
                  <div className="text-xl font-bold text-yellow-400">
                    {session.leverage ? `${session.leverage}x` : 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Invalidation Condition */}
            <div className="mb-4 pb-4 border-b border-slate-700">
              <div className="text-xs text-slate-500 mb-2">무효화 조건</div>
              <div className="text-sm">
                <span className="text-purple-400 font-bold">
                  {session.invalidationSchema.type || 'N/A'}
                </span>
                {' / '}
                <span className="text-slate-300">
                  {session.invalidationSchema.trigger || 'N/A'}
                </span>
                {' / '}
                <span className="text-orange-400">
                  {session.invalidationSchema.action || 'N/A'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-500">Dopamine</div>
                <div className={`text-xl font-bold ${os.dopamineIndex > 60 ? 'text-red-400' : 'text-green-400'}`}>
                  {os.dopamineIndex}%
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Revenge</div>
                <div className={`text-xl font-bold ${os.revengeIndex > 60 ? 'text-orange-400' : 'text-green-400'}`}>
                  {os.revengeIndex}%
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => {
                setCloseIntent('TP');
                setClosePanelOpen(true);
                setClosePnlInput('');
              }}
              className="w-full bg-green-600 hover:bg-green-700 py-4 rounded-lg font-bold"
            >
              익절 EXIT
            </button>
            <button
              onClick={() => {
                setCloseIntent('SL');
                setClosePanelOpen(true);
                setClosePnlInput('');
              }}
              className="w-full bg-yellow-600 hover:bg-yellow-700 py-4 rounded-lg font-bold"
            >
              손절 EXIT
            </button>
            <button
              onClick={handleStop}
              className="w-full bg-red-600 hover:bg-red-700 py-4 rounded-lg font-bold"
            >
              STOP (위험 감지)
            </button>
          </div>
        </div>

        {/* Holding Check Modal */}
        {holdingCheckModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 p-8 rounded-lg max-w-md w-full border border-red-500">
              <h3 className="text-2xl font-bold mb-4 text-center text-red-400">⚠️ 장시간 홀딩</h3>
              <p className="text-center mb-6 text-slate-300">
                왜 이 포지션을 계속 보유하고 있습니까?
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => handleHoldingCheck('plan_intact')}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold"
                >
                  계획이 유효함
                </button>
                <button
                  onClick={() => handleHoldingCheck('partial_exit')}
                  className="w-full py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-bold"
                >
                  일부 청산 고려
                </button>
                <button
                  onClick={() => handleHoldingCheck('unclear')}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold"
                >
                  불명확 → STOP 권장
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'LOCKED') {
    const reasonData = lockReasonCode && REASON_CATALOG[lockReasonCode] 
      ? REASON_CATALOG[lockReasonCode]
      : {
          title: '거래 차단',
          desc: '시스템이 위험을 감지하여 거래를 차단했습니다.',
          nextActionOne: '로그를 확인하고 원인을 파악하세요.',
          unlockRuleOneLine: '지정된 시간 후 해제',
          severity: 'P2'
        };
    
    return (
      <div className="min-h-screen bg-red-950 text-white p-8 flex items-center justify-center">
        <div className="max-w-2xl w-full text-center">
          {/* LOCKED에서도 UNDO 가능하게 */}
          <div className="flex justify-end mb-4">
            <button
              onClick={handleUndo}
              disabled={historyRef.current.length === 0}
              className={`px-4 py-2 rounded text-sm font-bold ${
                historyRef.current.length > 0
                  ? 'bg-slate-700 hover:bg-slate-600 text-white'
                  : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              ↩ UNDO
            </button>
          </div>

          <div className="text-6xl mb-6">🔒</div>
          <h2 className="text-4xl font-bold mb-2">{reasonData.title}</h2>
          <div className="inline-block px-3 py-1 bg-red-800 rounded text-xs font-mono mb-4">
            {reasonData.severity}
          </div>
          <p className="text-red-300 mb-8">{reasonData.desc}</p>
          
          <div className="bg-red-900/50 p-8 rounded-lg border border-red-700 mb-8">
            <div className="text-sm text-red-300 mb-2">남은 시간</div>
            <div className="text-5xl font-bold font-mono">
              {renderTimeLeft()}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-blue-900/30 p-6 rounded-lg text-left border border-blue-700">
              <h3 className="font-bold mb-2 text-blue-300">지금 할 일</h3>
              <p className="text-sm text-slate-200">{reasonData.nextActionOne}</p>
            </div>
            
            <div className="bg-slate-800/50 p-6 rounded-lg text-left border border-slate-700">
              <h3 className="font-bold mb-2">해제 조건</h3>
              <p className="text-sm text-slate-300">{reasonData.unlockRuleOneLine}</p>
            </div>
            
            <div className="bg-slate-800/30 p-4 rounded-lg text-left">
              <h3 className="text-xs font-semibold text-slate-500 mb-2">현재 상태</h3>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">STOP 누적:</span>
                  <span className="ml-1 text-yellow-400">{todayStopCount}회</span>
                </div>
                <div>
                  <span className="text-slate-500">Loop:</span>
                  <span className="ml-1 text-purple-400">{os.loopPhase}</span>
                </div>
                <div>
                  <span className="text-slate-500">Discipline:</span>
                  <span className="ml-1 text-green-400">{os.disciplineScore}</span>
                </div>
              </div>
            </div>

            {/* 진입조건 불충분 락이면: 즉시 초기화/복귀 버튼 제공 */}
            {isPrelockFailureLock && (
              <div className="mt-4 space-y-2">
                <button
                  onClick={handleBackToPrelockFromLock}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold"
                >
                  ↩ PRELOCK로 돌아가기 (입력 유지)
                </button>
                <button
                  onClick={handleFullResetPrelockFromLock}
                  className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold"
                >
                  ♻ PRELOCK 초기화 후 돌아가기
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'REVIEW') {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-8">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-6">REVIEW</h2>
          
          <div className="bg-slate-800 p-6 rounded-lg mb-6">
            <h3 className="text-sm text-slate-400 mb-4">거래 요약</h3>
            <p className="text-slate-300">이번 거래에 대한 간단한 복기를 진행합니다.</p>
          </div>

          <div className="space-y-3 mb-6">
            <div className="bg-slate-800/50 p-4 rounded">
              <p className="text-sm text-slate-400">감정 상태</p>
              <p className="text-lg">Dopamine: {os.dopamineIndex}% / Revenge: {os.revengeIndex}%</p>
            </div>
            
            <div className="bg-slate-800 p-6 rounded-lg">
              <h3 className="font-bold mb-4">수익 후 자본 확보</h3>
              <p className="text-sm text-slate-400 mb-4">
                수익이 발생했다면, 50% 출금 또는 포지션 축소를 했습니까?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setCapitalAnswer(true)}
                  className={`flex-1 py-3 rounded-lg font-bold ${
                    capitalAnswer === true
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  예 (자본 확보함)
                </button>
                <button
                  onClick={() => setCapitalAnswer(false)}
                  className={`flex-1 py-3 rounded-lg font-bold ${
                    capitalAnswer === false
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  아니오
                </button>
                <button
                  onClick={() => setCapitalAnswer(null)}
                  className={`flex-1 py-3 rounded-lg font-bold ${
                    capitalAnswer === null
                      ? 'bg-slate-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  해당없음
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleSkipReview}
            className="w-full bg-slate-600 hover:bg-slate-700 py-3 rounded-lg font-bold mb-3"
          >
            SKIP (해당없음)
          </button>

          <button
            onClick={() => handleReviewComplete(capitalAnswer)}
            className="w-full bg-blue-600 hover:bg-blue-700 py-4 rounded-lg font-bold"
          >
            완료 - HOME으로
          </button>
        </div>
      </div>
    );
  }

  // ========== EXIT REPORT MODAL ==========
  if (exitReportModal && exitReportData) {
    const { session: reportSession, os: reportOs, pnl } = exitReportData;
    
    // 규칙 위반 체크
    const violations = [];
    if (!reportSession.slConfirmed) violations.push('손절가 미설정');
    if (!reportSession.tpConfirmed) violations.push('목표가 미설정');
    if (!reportSession.invalidationSchema || reportSession.invalidationSchema.type === null) {
      violations.push('무효화 스키마 미설정');
    }
    
    // 위험 상태
    const riskLevel = 
      (reportOs.fatigueIndex || 0) >= 70 ? 'HIGH' :
      (reportOs.fatigueIndex || 0) >= 40 ? 'MEDIUM' : 'LOW';
    
    // 다음 매매까지
    const cooldownRemaining = reportOs.globalCooldownUntil 
      ? Math.ceil((reportOs.globalCooldownUntil - Date.now()) / 60000)
      : 0;

    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 p-6 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
          <h2 className="text-2xl font-bold mb-4 text-center">📊 심리 결과 리포트</h2>
          
          {/* PnL */}
          <div className="mb-4 p-4 bg-slate-700 rounded-lg text-center">
            <div className="text-sm text-slate-400 mb-1">최종 손익</div>
            <div className={`text-3xl font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {pnl >= 0 ? '+' : ''}{pnl}%
            </div>
          </div>

          {/* 규칙 위반 */}
          <div className="mb-4 p-4 bg-slate-700 rounded-lg">
            <h3 className="font-bold text-yellow-400 mb-2">⚠️ 규칙 위반</h3>
            {violations.length === 0 ? (
              <p className="text-green-400">없음 ✓</p>
            ) : (
              <ul className="list-disc ml-5 text-red-400 space-y-1">
                {violations.map((v, i) => <li key={i}>{v}</li>)}
              </ul>
            )}
          </div>

          {/* 심리 상태 */}
          <div className="mb-4 p-4 bg-slate-700 rounded-lg">
            <h3 className="font-bold mb-2">🧠 심리 상태</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">도파민</span>
                <span>{reportOs.dopamineIndex || 0}/100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">복수심</span>
                <span>{reportOs.revengeIndex || 0}/100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">피로도</span>
                <span>{reportOs.fatigueIndex || 0}/100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">연속 손절</span>
                <span>{reportOs.consecutiveSL || 0}회</span>
              </div>
              <div className={`font-bold mt-2 pt-2 border-t border-slate-600 flex justify-between ${
                riskLevel === 'HIGH' ? 'text-red-400' :
                riskLevel === 'MEDIUM' ? 'text-yellow-400' : 'text-green-400'
              }`}>
                <span>위험도</span>
                <span>{riskLevel}</span>
              </div>
            </div>
          </div>

          {/* 다음 매매까지 */}
          <div className="mb-6 p-4 bg-slate-700 rounded-lg">
            <h3 className="font-bold mb-2">⏰ 다음 매매까지</h3>
            {cooldownRemaining > 0 ? (
              <p className="text-yellow-400 text-center text-lg font-bold">
                {Math.floor(cooldownRemaining / 60)}시간 {cooldownRemaining % 60}분 대기
              </p>
            ) : (
              <p className="text-green-400 text-center font-bold">즉시 가능</p>
            )}
          </div>

          <button
            onClick={handleExitReportAck}
            className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-bold"
          >
            확인
          </button>
        </div>
      </div>
    );
  }

  // ========== EXIT REPORT MODAL ==========
  if (exitReportModal && exitReportData) {
    const violations = [];
    
    // 규칙 위반 체크
    const sess = exitReportData.session || {};
    if (!sess.slConfirmed) violations.push('손절가 미설정');
    if (!sess.tpConfirmed) violations.push('목표가 미설정');
    if (!sess.invalidationSchema || sess.invalidationSchema.type === null) {
      violations.push('무효화 스키마 미설정');
    }
    
    // 위험 상태
    const currentOs = exitReportData.os || os;
    const riskLevel = 
      currentOs.fatigueIndex >= 70 ? 'HIGH' :
      currentOs.fatigueIndex >= 40 ? 'MEDIUM' : 'LOW';

    // 다음 매매까지
    const cooldownRemaining = currentOs.globalCooldownUntil 
      ? Math.ceil((currentOs.globalCooldownUntil - Date.now()) / 60000)
      : 0;

    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-slate-800 p-8 rounded-lg max-w-md w-full mx-4">
          <h2 className="text-2xl font-bold mb-6">📊 심리 결과 리포트</h2>
          
          {/* 규칙 위반 */}
          <div className="mb-6">
            <h3 className="font-bold text-yellow-400 mb-2">⚠️ 규칙 위반</h3>
            {violations.length === 0 ? (
              <p className="text-green-400">없음 ✅</p>
            ) : (
              <ul className="list-disc ml-5 text-red-400 space-y-1">
                {violations.map((v, i) => <li key={i}>{v}</li>)}
              </ul>
            )}
          </div>

          {/* 위험 상태 */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">🧠 심리 상태</h3>
            <div className="space-y-2 text-sm bg-slate-900/50 p-4 rounded">
              <div className="flex justify-between">
                <span>도파민:</span>
                <span className="font-bold">{currentOs.dopamineIndex || 0}/100</span>
              </div>
              <div className="flex justify-between">
                <span>복수심:</span>
                <span className="font-bold">{currentOs.revengeIndex || 0}/100</span>
              </div>
              <div className="flex justify-between">
                <span>피로도:</span>
                <span className="font-bold">{currentOs.fatigueIndex || 0}/100</span>
              </div>
              <div className={`flex justify-between pt-2 border-t border-slate-700 font-bold ${
                riskLevel === 'HIGH' ? 'text-red-400' :
                riskLevel === 'MEDIUM' ? 'text-yellow-400' : 'text-green-400'
              }`}>
                <span>위험도:</span>
                <span>{riskLevel}</span>
              </div>
            </div>
          </div>

          {/* 다음 매매까지 */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">⏰ 다음 매매까지</h3>
            {cooldownRemaining > 0 ? (
              <p className="text-yellow-400 bg-slate-900/50 p-3 rounded">
                🔒 {cooldownRemaining}분 대기 필요
              </p>
            ) : (
              <p className="text-green-400 bg-slate-900/50 p-3 rounded">
                ✅ 즉시 진입 가능
              </p>
            )}
          </div>

          <button
            onClick={() => {
              const eventId = getEventId('EXIT_REPORT_ACK', exitReportData?.session?.id || 'unknown');
              addLog('EXIT_REPORT_ACK', {
                violations: violations.length,
                riskLevel,
                cooldownRemaining,
              }, eventId);
              setExitReportModal(false);
              setExitReportData(null);
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-bold transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default WaveMVP;

/*
==============================================================================
WAVE OS v1.1 - BEHAVIOR CONTRACT
==============================================================================

See separate contract table below code.

==============================================================================
*/
