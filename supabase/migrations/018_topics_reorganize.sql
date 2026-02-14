-- ============================================================================
-- OPIc 학습 앱 - 서베이 토픽 재구성
-- ============================================================================
-- 변경 사항:
-- 1. topics 테이블에 category 컬럼 추가 (survey / unexpected)
-- 2. 기존 "운동/헬스" → "헬스" 이름 변경
-- 3. 12개 신규 서베이 토픽 추가 (sort_order 13~24)
-- 4. 57개 신규 질문 추가 (토픽당 4~5개, 실제 OPIc 기출 기반)
-- 5. get_student_topics_with_progress RPC에 topic_category 추가
-- 6. topics.name_en UNIQUE 제약 추가 + 인덱스 추가
-- ============================================================================

-- ============================================================================
-- 1. topics 테이블에 category 컬럼 추가
-- ============================================================================

ALTER TABLE public.topics
ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'survey'
CONSTRAINT topics_category_check CHECK (category IN ('survey', 'unexpected'));

-- ============================================================================
-- 2. 기존 "운동/헬스" → "헬스" 이름 변경
-- (실제 OPIc에서는 조깅, 수영, 헬스 등 개별 선택)
-- ============================================================================

UPDATE public.topics
SET name_ko = '헬스',
    name_en = 'Gym/Fitness',
    description = '헬스장, 근력 운동, 피트니스 루틴을 설명하는 토픽'
WHERE name_en = 'Exercise/Fitness';

-- ============================================================================
-- 2b. topics.name_en에 UNIQUE 제약 추가
-- (ON CONFLICT DO NOTHING이 정상 작동하도록)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'topics_name_en_unique'
  ) THEN
    ALTER TABLE public.topics ADD CONSTRAINT topics_name_en_unique UNIQUE (name_en);
  END IF;
END $$;

-- ============================================================================
-- 3. 12개 신규 서베이 토픽 추가
-- ============================================================================

INSERT INTO public.topics (name_ko, name_en, icon, description, sort_order, category) VALUES
  ('공연/콘서트', 'Performances/Concerts', 'musical-note-outline', '공연, 콘서트 관람 경험을 설명하는 토픽', 13, 'survey'),
  ('카페/커피전문점', 'Cafes/Coffee Shops', 'cafe-outline', '카페 방문, 커피 습관을 설명하는 토픽', 14, 'survey'),
  ('공원 가기', 'Going to Parks', 'leaf-outline', '공원 방문, 야외 활동을 설명하는 토픽', 15, 'survey'),
  ('캠핑', 'Camping', 'bonfire-outline', '캠핑 경험, 장비, 장소를 설명하는 토픽', 16, 'survey'),
  ('해변 가기', 'Going to the Beach', 'sunny-outline', '해변 방문, 해변 활동을 설명하는 토픽', 17, 'survey'),
  ('독서', 'Reading', 'book-outline', '독서 습관, 좋아하는 책, 독서 경험을 설명하는 토픽', 18, 'survey'),
  ('애완동물', 'Pets', 'paw-outline', '반려동물, 돌봄 경험을 설명하는 토픽', 19, 'survey'),
  ('조깅/걷기', 'Jogging/Walking', 'walk-outline', '조깅, 산책, 걷기 운동을 설명하는 토픽', 20, 'survey'),
  ('자전거', 'Cycling', 'bicycle-outline', '자전거 타기, 사이클링 경험을 설명하는 토픽', 21, 'survey'),
  ('수영', 'Swimming', 'water-outline', '수영, 수영장, 물놀이 경험을 설명하는 토픽', 22, 'survey'),
  ('등산/하이킹', 'Hiking', 'trail-sign-outline', '등산, 하이킹, 산 경험을 설명하는 토픽', 23, 'survey'),
  ('요가', 'Yoga', 'body-outline', '요가, 명상, 스트레칭 경험을 설명하는 토픽', 24, 'survey')
ON CONFLICT (name_en) DO NOTHING;

-- ============================================================================
-- 4. 57개 신규 질문 추가 (토픽당 4~5개, 실제 OPIc 기출 기반)
-- ============================================================================

-- 공연/콘서트 (Performances/Concerts) - 5문항
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('What kind of performances or concerts do you enjoy? Tell me about the kind of shows you like to watch.', 'describe', 2, '어떤 공연이나 콘서트를 즐기나요? 좋아하는 공연 종류를 말해주세요.', 1),
  ('When was the last time you went to a concert or performance? Tell me everything about that experience from beginning to end.', 'experience', 3, '마지막으로 콘서트나 공연에 간 게 언제인가요? 처음부터 끝까지 그 경험을 말해주세요.', 2),
  ('Tell me about a memorable experience you had at a concert or performance. What made it so special?', 'experience', 3, '공연이나 콘서트에서 기억에 남는 경험을 말해주세요. 뭐가 그렇게 특별했나요?', 3),
  ('How have concerts and performances changed compared to the past? What is different now?', 'comparison', 4, '공연과 콘서트가 예전에 비해 어떻게 바뀌었나요? 지금은 뭐가 다른가요?', 4),
  ('Has there ever been an unexpected issue at a performance you attended? What happened and how did you deal with it?', 'experience', 4, '참석한 공연에서 예상치 못한 문제가 생긴 적 있나요? 무슨 일이 있었고 어떻게 대처했나요?', 5)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Performances/Concerts';

-- 카페/커피전문점 (Cafes/Coffee Shops) - 5문항
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Do you like going to cafes? Describe a cafe you often visit. What does it look like?', 'describe', 2, '카페에 가는 걸 좋아하나요? 자주 가는 카페를 설명해주세요. 어떻게 생겼나요?', 1),
  ('What do you usually do when you go to a cafe? Walk me through a typical visit.', 'routine', 2, '카페에 가면 보통 뭘 하나요? 보통 방문을 설명해주세요.', 2),
  ('Tell me about a memorable experience you had at a cafe.', 'experience', 3, '카페에서 있었던 기억에 남는 경험을 말해주세요.', 3),
  ('How have cafes changed in your country compared to the past?', 'comparison', 4, '당신 나라에서 카페가 예전에 비해 어떻게 바뀌었나요?', 4),
  ('I want to find a good cafe near here. Can you recommend one and tell me what makes it special?', 'roleplay', 4, '이 근처에서 좋은 카페를 찾고 싶어요. 하나 추천하고 뭐가 특별한지 말해줄 수 있나요?', 5)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Cafes/Coffee Shops';

-- 공원 가기 (Going to Parks) - 5문항
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about a park you like to go to. What does it look like? Describe it in detail.', 'describe', 2, '좋아하는 공원에 대해 말해주세요. 어떻게 생겼나요? 자세히 설명해주세요.', 1),
  ('What do you usually do when you go to a park? Who do you go with?', 'routine', 2, '공원에 가면 보통 뭘 하나요? 누구와 가나요?', 2),
  ('Tell me about a memorable experience you had at a park.', 'experience', 3, '공원에서 있었던 기억에 남는 경험을 말해주세요.', 3),
  ('How have parks in your area changed over the years?', 'comparison', 4, '당신 지역의 공원이 몇 년간 어떻게 바뀌었나요?', 4),
  ('Have you ever had any problems or unexpected situations at a park? What happened?', 'experience', 4, '공원에서 문제가 생기거나 예상치 못한 상황이 있었나요? 무슨 일이 있었나요?', 5)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Going to Parks';

-- 캠핑 (Camping) - 5문항
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Do you like camping? Tell me about where you usually go camping and what it looks like there.', 'describe', 2, '캠핑을 좋아하나요? 보통 어디로 캠핑을 가고 그곳이 어떻게 생겼는지 말해주세요.', 1),
  ('What do you usually do when you go camping? Describe your camping routine from start to finish.', 'routine', 2, '캠핑을 가면 보통 뭘 하나요? 처음부터 끝까지 캠핑 루틴을 설명해주세요.', 2),
  ('Tell me about your most memorable camping trip. What made it special?', 'experience', 3, '가장 기억에 남는 캠핑 여행에 대해 말해주세요. 뭐가 특별했나요?', 3),
  ('Have you ever had any problems while camping? What happened and how did you handle it?', 'experience', 4, '캠핑 중에 문제가 생긴 적 있나요? 무슨 일이 있었고 어떻게 해결했나요?', 4),
  ('How has camping changed in your country compared to the past?', 'comparison', 4, '당신 나라에서 캠핑이 예전에 비해 어떻게 바뀌었나요?', 5)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Camping';

-- 해변 가기 (Going to the Beach) - 5문항
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Do you like going to the beach? Tell me about a beach you have been to. What does it look like?', 'describe', 2, '해변에 가는 걸 좋아하나요? 가본 해변에 대해 말해주세요. 어떻게 생겼나요?', 1),
  ('What do you usually do when you go to the beach? Walk me through a typical day at the beach.', 'routine', 2, '해변에 가면 보통 뭘 하나요? 해변에서의 보통 하루를 설명해주세요.', 2),
  ('Tell me about a memorable experience you had at the beach.', 'experience', 3, '해변에서 있었던 기억에 남는 경험을 말해주세요.', 3),
  ('Have you ever had any problems or unexpected situations at the beach? What happened?', 'experience', 4, '해변에서 문제가 생기거나 예상치 못한 상황이 있었나요? 무슨 일이 있었나요?', 4),
  ('How are beaches in your country different from beaches in other countries you have visited?', 'comparison', 4, '당신 나라의 해변이 방문한 다른 나라의 해변과 어떻게 다른가요?', 5)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Going to the Beach';

-- 독서 (Reading) - 5문항
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('What kind of books do you like to read? Tell me about your reading preferences.', 'describe', 2, '어떤 책을 좋아하나요? 독서 취향에 대해 말해주세요.', 1),
  ('When and where do you usually read? Describe your reading habits.', 'routine', 2, '보통 언제 어디서 읽나요? 독서 습관을 설명해주세요.', 2),
  ('Tell me about a book that left a strong impression on you. What was it about and why did you like it?', 'experience', 3, '강한 인상을 남긴 책에 대해 말해주세요. 무슨 내용이고 왜 좋았나요?', 3),
  ('How have your reading habits changed over the years? Do you read differently now?', 'comparison', 4, '독서 습관이 몇 년간 어떻게 바뀌었나요? 지금은 다르게 읽나요?', 4),
  ('How has the way people read books changed with technology?', 'comparison', 4, '기술의 발전으로 사람들이 책 읽는 방식이 어떻게 바뀌었나요?', 5)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Reading';

-- 애완동물 (Pets) - 4문항
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Do you have a pet? Tell me about your pet. What does it look like and what is its personality?', 'describe', 2, '반려동물이 있나요? 반려동물에 대해 말해주세요. 어떻게 생겼고 성격은 어떤가요?', 1),
  ('What do you do to take care of your pet on a daily basis? Describe your routine.', 'routine', 2, '매일 반려동물을 돌보기 위해 뭘 하나요? 루틴을 설명해주세요.', 2),
  ('Tell me about a memorable experience you had with your pet.', 'experience', 3, '반려동물과 있었던 기억에 남는 경험을 말해주세요.', 3),
  ('Have you ever had any problems with your pet? What happened and how did you deal with it?', 'experience', 4, '반려동물과 관련해서 문제가 생긴 적 있나요? 무슨 일이 있었고 어떻게 해결했나요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Pets';

-- 조깅/걷기 (Jogging/Walking) - 5문항
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Do you enjoy jogging or walking? Where do you usually go? Describe the place.', 'describe', 2, '조깅이나 걷기를 즐기나요? 보통 어디로 가나요? 그곳을 설명해주세요.', 1),
  ('How often do you jog or walk? Walk me through your typical jogging or walking routine.', 'routine', 2, '얼마나 자주 조깅이나 걷기를 하나요? 보통 루틴을 설명해주세요.', 2),
  ('Tell me about a memorable experience you had while jogging or walking.', 'experience', 3, '조깅이나 걷기 중에 있었던 기억에 남는 경험을 말해주세요.', 3),
  ('How have your jogging or walking habits changed compared to when you first started?', 'comparison', 4, '처음 시작했을 때와 비교해서 조깅이나 걷기 습관이 어떻게 바뀌었나요?', 4),
  ('Have you ever had any problems while jogging or walking? What happened?', 'experience', 4, '조깅이나 걷기 중에 문제가 생긴 적 있나요? 무슨 일이 있었나요?', 5)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Jogging/Walking';

-- 자전거 (Cycling) - 5문항
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Do you enjoy cycling? Tell me about where you usually ride your bicycle.', 'describe', 2, '자전거 타는 걸 즐기나요? 보통 어디서 자전거를 타는지 말해주세요.', 1),
  ('How often do you ride your bicycle? Describe your typical cycling routine.', 'routine', 2, '얼마나 자주 자전거를 타나요? 보통 자전거 루틴을 설명해주세요.', 2),
  ('Tell me about a memorable cycling experience you have had.', 'experience', 3, '기억에 남는 자전거 경험을 말해주세요.', 3),
  ('Have you ever had any problems while riding a bicycle? What happened and how did you deal with it?', 'experience', 4, '자전거를 타다가 문제가 생긴 적 있나요? 무슨 일이 있었고 어떻게 해결했나요?', 4),
  ('How has cycling in your area changed over the years?', 'comparison', 4, '당신 지역에서 자전거 타기가 몇 년간 어떻게 바뀌었나요?', 5)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Cycling';

-- 수영 (Swimming) - 5문항
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Do you enjoy swimming? Where do you usually go swimming? Describe the place.', 'describe', 2, '수영을 즐기나요? 보통 어디서 수영하나요? 그곳을 설명해주세요.', 1),
  ('How often do you go swimming? Walk me through what you typically do when you go swimming.', 'routine', 2, '얼마나 자주 수영하러 가나요? 수영하러 갈 때 보통 뭘 하는지 설명해주세요.', 2),
  ('Tell me about a memorable experience you had while swimming.', 'experience', 3, '수영하면서 있었던 기억에 남는 경험을 말해주세요.', 3),
  ('Have you ever had any problems at a swimming pool or while swimming? What happened?', 'experience', 4, '수영장이나 수영 중에 문제가 생긴 적 있나요? 무슨 일이 있었나요?', 4),
  ('How have swimming facilities in your area changed over the years?', 'comparison', 4, '당신 지역의 수영 시설이 몇 년간 어떻게 바뀌었나요?', 5)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Swimming';

-- 등산/하이킹 (Hiking) - 4문항
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Do you like hiking? Tell me about a mountain or trail you like to hike. What does it look like?', 'describe', 2, '등산을 좋아하나요? 좋아하는 산이나 등산로에 대해 말해주세요. 어떻게 생겼나요?', 1),
  ('What do you usually do when you go hiking? Describe your typical hiking routine.', 'routine', 2, '등산을 가면 보통 뭘 하나요? 보통 등산 루틴을 설명해주세요.', 2),
  ('Tell me about a memorable hiking experience you have had.', 'experience', 3, '기억에 남는 등산 경험을 말해주세요.', 3),
  ('Have you ever had any problems or difficulties while hiking? What happened and how did you handle it?', 'experience', 4, '등산 중에 문제나 어려움이 있었나요? 무슨 일이 있었고 어떻게 해결했나요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Hiking';

-- 요가 (Yoga) - 4문항
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Do you practice yoga? Tell me about where and how you do yoga.', 'describe', 2, '요가를 하나요? 어디서 어떻게 요가를 하는지 말해주세요.', 1),
  ('How often do you do yoga? Walk me through your typical yoga session.', 'routine', 2, '얼마나 자주 요가를 하나요? 보통 요가 세션을 설명해주세요.', 2),
  ('Tell me about how you first started doing yoga. What made you interested in it?', 'experience', 3, '처음 요가를 시작하게 된 계기를 말해주세요. 뭐가 관심을 끌었나요?', 3),
  ('How has your yoga practice changed since you first started?', 'comparison', 4, '처음 시작했을 때부터 요가가 어떻게 바뀌었나요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Yoga';

-- ============================================================================
-- 5. get_student_topics_with_progress RPC 수정 (topic_category 추가)
-- RETURNS TABLE 변경이므로 DROP 먼저 필요
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_student_topics_with_progress(uuid);

CREATE OR REPLACE FUNCTION public.get_student_topics_with_progress(
  p_student_id uuid
)
RETURNS TABLE (
  topic_id uuid,
  topic_name_ko text,
  topic_name_en text,
  topic_icon text,
  topic_sort_order integer,
  topic_category text,
  total_questions bigint,
  scripts_count bigint,
  practices_count bigint,
  best_avg_score numeric,
  last_practice_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role public.user_role;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN;
  END IF;

  -- 권한 검증: 본인 또는 연결된 강사
  SELECT role INTO v_caller_role FROM public.users
  WHERE id = v_caller_id AND deleted_at IS NULL;

  IF v_caller_role = 'student' AND v_caller_id != p_student_id THEN
    RETURN;
  END IF;

  IF v_caller_role = 'teacher' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.teacher_student
      WHERE teacher_id = v_caller_id
        AND student_id = p_student_id
        AND deleted_at IS NULL
    ) THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    t.id AS topic_id,
    t.name_ko AS topic_name_ko,
    t.name_en AS topic_name_en,
    t.icon AS topic_icon,
    t.sort_order AS topic_sort_order,
    t.category AS topic_category,
    -- 토픽의 전체 질문 수
    (SELECT COUNT(*) FROM public.questions q
     WHERE q.topic_id = t.id AND q.is_active = true) AS total_questions,
    -- 이 학생에게 작성된 스크립트 수
    (SELECT COUNT(*) FROM public.scripts s
     JOIN public.questions q2 ON q2.id = s.question_id
     WHERE s.student_id = p_student_id
       AND q2.topic_id = t.id
       AND s.deleted_at IS NULL
       AND s.status = 'complete') AS scripts_count,
    -- 연습 횟수
    (SELECT COUNT(*) FROM public.practices p
     JOIN public.scripts s2 ON s2.id = p.script_id
     JOIN public.questions q3 ON q3.id = s2.question_id
     WHERE p.student_id = p_student_id
       AND q3.topic_id = t.id
       AND p.deleted_at IS NULL
       AND s2.deleted_at IS NULL) AS practices_count,
    -- 최고 평균 점수
    (SELECT ROUND(AVG(p2.score)::numeric, 1)
     FROM public.practices p2
     JOIN public.scripts s3 ON s3.id = p2.script_id
     JOIN public.questions q4 ON q4.id = s3.question_id
     WHERE p2.student_id = p_student_id
       AND q4.topic_id = t.id
       AND p2.deleted_at IS NULL
       AND s3.deleted_at IS NULL
       AND p2.score IS NOT NULL) AS best_avg_score,
    -- 마지막 연습 시간
    (SELECT MAX(p3.created_at)
     FROM public.practices p3
     JOIN public.scripts s4 ON s4.id = p3.script_id
     JOIN public.questions q5 ON q5.id = s4.question_id
     WHERE p3.student_id = p_student_id
       AND q5.topic_id = t.id
       AND p3.deleted_at IS NULL
       AND s4.deleted_at IS NULL) AS last_practice_at
  FROM public.student_topics st
  JOIN public.topics t ON t.id = st.topic_id AND t.is_active = true
  WHERE st.student_id = p_student_id
    AND st.deleted_at IS NULL
  ORDER BY t.sort_order ASC;
END;
$$;

COMMENT ON FUNCTION public.get_student_topics_with_progress IS '학생의 배정 토픽 + 진행 통계 조회 (category 포함)';

-- ============================================================================
-- 6. 인덱스 추가 (topics_name_en_unique는 2b에서 추가됨)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_topics_category
ON public.topics(category, sort_order) WHERE is_active = true;
