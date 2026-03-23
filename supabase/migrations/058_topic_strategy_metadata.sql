-- ============================================================================
-- 058: 토픽 전략 메타데이터 (서베이 전략 가이드용)
-- ============================================================================
-- 목적: OPIc Background Survey 토픽 선택 전략 가이드를 위한 메타데이터 추가
-- - strategy_group: 유사 토픽 묶음 (같은 그룹 = 공유 어휘/표현 많음)
-- - difficulty_hint: 토픽 난이도 힌트 (1=쉬움 ~ 5=어려움)
-- - strategy_tip_ko: 토픽별 전략 팁 (한국어)
-- ============================================================================

-- 1. 컬럼 추가
ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS strategy_group text,
  ADD COLUMN IF NOT EXISTS difficulty_hint int DEFAULT 3 CHECK (difficulty_hint BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS strategy_tip_ko text;

-- 2. survey 토픽 전략 데이터 입력
-- 자기소개: 필수 토픽 (선택 불가, 항상 출제)
UPDATE public.topics SET
  strategy_group = 'personal',
  difficulty_hint = 1,
  strategy_tip_ko = '필수 토픽 (항상 Q1에 출제). 이름, 직업/학교, 취미, 성격을 간결하게 준비하세요.'
WHERE name_en = 'Self Introduction' AND category = 'survey';

-- 집/주거
UPDATE public.topics SET
  strategy_group = 'living',
  difficulty_hint = 2,
  strategy_tip_ko = '묘사/루틴/경험 3가지 유형 출제. "이웃/동네"와 표현이 겹치므로 함께 선택하면 효율적입니다.'
WHERE name_en = 'Home/Housing' AND category = 'survey';

-- 이웃/동네
UPDATE public.topics SET
  strategy_group = 'living',
  difficulty_hint = 2,
  strategy_tip_ko = '"집/주거"와 같은 생활권 토픽. 동네 묘사, 이웃 관계, 변화 경험을 준비하세요.'
WHERE name_en = 'Neighborhood' AND category = 'survey';

-- 음악 듣기
UPDATE public.topics SET
  strategy_group = 'entertainment',
  difficulty_hint = 2,
  strategy_tip_ko = '취미/엔터 그룹. "영화 보기", "TV 시청"과 겹치는 표현 많음. 좋아하는 장르 + 최근 경험을 준비하세요.'
WHERE name_en = 'Listening to Music' AND category = 'survey';

-- 영화 보기
UPDATE public.topics SET
  strategy_group = 'entertainment',
  difficulty_hint = 2,
  strategy_tip_ko = '가장 대중적인 토픽. "음악 듣기", "TV 시청"과 함께 선택하면 엔터테인먼트 표현을 재활용할 수 있습니다.'
WHERE name_en = 'Watching Movies' AND category = 'survey';

-- TV 시청
UPDATE public.topics SET
  strategy_group = 'entertainment',
  difficulty_hint = 2,
  strategy_tip_ko = '쉬운 토픽. 좋아하는 프로그램, 시청 습관, 최근 본 프로그램 경험을 준비하세요.'
WHERE name_en = 'Watching TV' AND category = 'survey';

-- 쇼핑
UPDATE public.topics SET
  strategy_group = 'daily_life',
  difficulty_hint = 2,
  strategy_tip_ko = '일상생활 그룹. 쇼핑 장소, 온라인/오프라인 비교, 기억에 남는 구매 경험을 준비하세요.'
WHERE name_en = 'Shopping' AND category = 'survey';

-- 요리/음식
UPDATE public.topics SET
  strategy_group = 'daily_life',
  difficulty_hint = 2,
  strategy_tip_ko = '"쇼핑"과 함께 일상 그룹. 자주 먹는 음식, 요리 과정, 식당 경험을 준비하세요.'
WHERE name_en = 'Cooking/Food' AND category = 'survey';

-- 운동/헬스
UPDATE public.topics SET
  strategy_group = 'outdoor_activity',
  difficulty_hint = 3,
  strategy_tip_ko = '활동 그룹. "공원 가기", "해변 가기"와 야외 활동 표현 공유. 운동 루틴 + 운동 중 생긴 일을 준비하세요.'
WHERE name_en = 'Exercise/Fitness' AND category = 'survey';

-- 여행/휴가
UPDATE public.topics SET
  strategy_group = 'outdoor_activity',
  difficulty_hint = 3,
  strategy_tip_ko = '풍부한 경험담 가능. 여행 준비, 여행지 묘사, 여행 중 문제 경험 등 다양한 유형 출제. 비교 질문도 나올 수 있어 난이도 약간 높음.'
WHERE name_en = 'Travel/Vacation' AND category = 'survey';

-- 전화통화
UPDATE public.topics SET
  strategy_group = 'technology',
  difficulty_hint = 2,
  strategy_tip_ko = '"인터넷/SNS"와 기술 그룹. 통화 습관, 스마트폰 사용, 기억에 남는 통화 경험을 준비하세요.'
WHERE name_en = 'Phone Calls' AND category = 'survey';

-- 인터넷/SNS
UPDATE public.topics SET
  strategy_group = 'technology',
  difficulty_hint = 2,
  strategy_tip_ko = '"전화통화"와 함께 선택 추천. 인터넷 사용 습관, SNS 활동, 온라인 경험을 준비하세요.'
WHERE name_en = 'Internet/SNS' AND category = 'survey';

-- 공원 가기 (018에서 추가된 토픽)
UPDATE public.topics SET
  strategy_group = 'outdoor_activity',
  difficulty_hint = 2,
  strategy_tip_ko = '쉬운 야외 토픽. "운동/헬스"와 겹치는 표현 많음. 공원 묘사 + 가서 하는 활동 + 기억에 남는 경험.'
WHERE name_en = 'Going to Parks' AND category = 'survey';

-- 해변 가기
UPDATE public.topics SET
  strategy_group = 'outdoor_activity',
  difficulty_hint = 2,
  strategy_tip_ko = '"공원 가기", "여행/휴가"와 야외 그룹. 해변 묘사 + 수영/활동 + 여름 경험을 준비하세요.'
WHERE name_en = 'Going to the Beach' AND category = 'survey';

-- 공연/콘서트
UPDATE public.topics SET
  strategy_group = 'entertainment',
  difficulty_hint = 3,
  strategy_tip_ko = '"음악 듣기"와 엔터 그룹. 공연장 묘사, 공연 경험, 티켓 구매 롤플레이가 나올 수 있습니다.'
WHERE name_en = 'Concerts/Performances' AND category = 'survey';

-- 독서
UPDATE public.topics SET
  strategy_group = 'indoor_hobby',
  difficulty_hint = 3,
  strategy_tip_ko = '실내 취미 그룹. 좋아하는 장르, 최근 읽은 책, 독서 습관을 준비하세요. 어휘 수준이 약간 높을 수 있음.'
WHERE name_en = 'Reading' AND category = 'survey';

-- 돌발 토픽에는 전략 메타데이터 불필요 (서베이 선택 대상이 아님)
