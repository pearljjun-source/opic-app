-- ============================================================================
-- 069: 중복 질문 제거 + 부족 토픽 comparison 질문 추가
-- ============================================================================
-- 원인: 018_topics_reorganize.sql 질문이 2회 적용되어 12개 토픽 질문 중복
-- 조치:
--   1. 스크립트 FK 참조를 원본 질문으로 이관
--   2. 중복 질문 삭제 (newer row 기준)
--   3. 등산/하이킹, 애완동물: dedup 후 comparison 누락 → 추가
--   4. 065에서 3문항만 있는 서베이 토픽 10개: comparison 질문 추가
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. FK 참조 이관: 중복 질문 → 원본 질문 (scripts + exam_responses)
-- ============================================================================
-- 일괄 처리: 중복(rn=2)을 참조하는 모든 FK를 원본(rn=1)으로 이관
WITH dup_map AS (
  SELECT
    q.id,
    q.topic_id,
    q.question_text,
    ROW_NUMBER() OVER (PARTITION BY q.topic_id, q.question_text ORDER BY q.created_at) as rn
  FROM public.questions q
  JOIN public.topics t ON t.id = q.topic_id
  WHERE t.name_en IN (
    'Performances/Concerts', 'Cafes/Coffee Shops', 'Going to Parks',
    'Camping', 'Going to the Beach', 'Reading', 'Pets',
    'Jogging/Walking', 'Cycling', 'Swimming', 'Hiking', 'Yoga'
  )
),
reassign AS (
  SELECT
    dup.id as dup_id,
    orig.id as original_id
  FROM dup_map dup
  JOIN dup_map orig ON orig.topic_id = dup.topic_id
    AND orig.question_text = dup.question_text
    AND orig.rn = 1
  WHERE dup.rn = 2
)
UPDATE public.scripts s
SET question_id = r.original_id
FROM reassign r
WHERE s.question_id = r.dup_id;

-- exam_responses FK 이관
WITH dup_map AS (
  SELECT
    q.id,
    q.topic_id,
    q.question_text,
    ROW_NUMBER() OVER (PARTITION BY q.topic_id, q.question_text ORDER BY q.created_at) as rn
  FROM public.questions q
  JOIN public.topics t ON t.id = q.topic_id
  WHERE t.name_en IN (
    'Performances/Concerts', 'Cafes/Coffee Shops', 'Going to Parks',
    'Camping', 'Going to the Beach', 'Reading', 'Pets',
    'Jogging/Walking', 'Cycling', 'Swimming', 'Hiking', 'Yoga'
  )
),
reassign AS (
  SELECT
    dup.id as dup_id,
    orig.id as original_id
  FROM dup_map dup
  JOIN dup_map orig ON orig.topic_id = dup.topic_id
    AND orig.question_text = dup.question_text
    AND orig.rn = 1
  WHERE dup.rn = 2
)
UPDATE public.exam_responses er
SET question_id = r.original_id
FROM reassign r
WHERE er.question_id = r.dup_id;

-- ============================================================================
-- 2. 중복 질문 삭제 (12개 토픽, newer row 삭제)
-- ============================================================================
DELETE FROM public.questions
WHERE id IN (
  SELECT id FROM (
    SELECT q.id,
      ROW_NUMBER() OVER (
        PARTITION BY q.topic_id, q.question_text
        ORDER BY q.created_at
      ) as rn
    FROM public.questions q
    JOIN public.topics t ON t.id = q.topic_id
    WHERE t.name_en IN (
      'Performances/Concerts', 'Cafes/Coffee Shops', 'Going to Parks',
      'Camping', 'Going to the Beach', 'Reading', 'Pets',
      'Jogging/Walking', 'Cycling', 'Swimming', 'Hiking', 'Yoga'
    )
  ) numbered
  WHERE rn > 1
);

-- ============================================================================
-- 3. 등산/하이킹: comparison 질문 추가 (dedup 후 4문항 중 comparison 없음)
-- ============================================================================
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('How has hiking culture in your country changed over the years? Are there any differences from the past?', 'comparison', 4, '등산 문화가 예전과 비교해서 어떻게 바뀌었나요?', 5)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Hiking';

-- ============================================================================
-- 4. 애완동물: comparison 질문 추가 (dedup 후 4문항 중 comparison 없음)
-- ============================================================================
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('How has the way people keep pets changed compared to the past in your country?', 'comparison', 4, '반려동물을 키우는 방식이 예전과 비교해서 어떻게 바뀌었나요?', 5)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Pets';

-- ============================================================================
-- 5. 065에서 3문항만 있는 서베이 토픽: comparison 질문 추가 (10개)
-- ============================================================================

-- 골프
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('How has your golf game changed since you first started playing?', 'comparison', 4, '골프를 처음 시작했을 때와 비교해서 어떻게 변했나요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Golf';

-- 국내여행
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('How has domestic travel changed compared to the past? What is different now?', 'comparison', 4, '국내 여행이 예전과 비교해서 어떻게 변했나요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Domestic Travel';

-- 농구
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('How has the way you play or watch basketball changed over the years?', 'comparison', 3, '농구를 하거나 보는 방식이 어떻게 변했나요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Basketball';

-- 배드민턴
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('How has your badminton playing changed since you first started?', 'comparison', 3, '배드민턴을 처음 시작했을 때와 비교해서 어떻게 변했나요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Badminton';

-- 사진
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('How has photography changed with the development of smartphone cameras compared to the past?', 'comparison', 4, '스마트폰 카메라 발전으로 사진 촬영이 예전과 비교해서 어떻게 변했나요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Photography';

-- 악기 연주
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('How has the way you practice or play your instrument changed since you first started?', 'comparison', 4, '악기 연습이나 연주 방식이 처음 시작했을 때와 비교해서 어떻게 변했나요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Playing Instruments';

-- 야구
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('How has the way people watch or enjoy baseball changed compared to the past?', 'comparison', 3, '야구를 보거나 즐기는 방식이 예전과 비교해서 어떻게 변했나요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Baseball';

-- 출장
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('How are business trips different from personal travel? What do you do differently?', 'comparison', 4, '출장과 개인 여행은 어떻게 다른가요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Business Trip';

-- 테니스
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('How has your tennis playing changed since you first started? What have you improved?', 'comparison', 3, '테니스를 처음 시작했을 때와 비교해서 어떻게 변했나요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Tennis';

-- 원룸/오피스텔
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('How is your current place different from the first place you lived on your own?', 'comparison', 3, '지금 사는 곳이 처음 독립했을 때와 비교해서 어떻게 다른가요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Studio/Officetel';

-- ============================================================================
-- 6. 중복 방지: questions 테이블에 unique 제약 추가
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_topic_text_unique
  ON public.questions (topic_id, question_text);

COMMIT;
