-- ============================================================================
-- 065: OPIc 서베이 구조 재설계
--
-- 근본 원인: topics 테이블이 플랫 리스트로, 실제 OPIc 서베이의
-- 7개 대분류 + 선택 규칙(single/multiple, 최소 수량, 총 12개+)을 반영하지 않음.
-- 학생이 실제 시험과 동일한 서베이 경험을 할 수 없고,
-- 서버 사이드 선택 규칙 검증도 불가능.
--
-- 해결:
-- 1. topic_groups 테이블 (7개 대분류 + 선택 규칙)
-- 2. topics.group_id FK 추가 + 기존 토픽 대분류 배정
-- 3. 신규 토픽 추가 (직업/학생/거주지 + 운동/여가 확장)
-- 4. 돌발 주제 15개 추가 (기존 5개 + 15개 = 20개 + 전화통화 이동 = 21개)
-- 5. 신규 토픽 질문 시드
-- 6. set_student_topics RPC 검증 강화
-- 7. get_student_topics_with_progress에 group 정보 추가
-- 8. 058 name_en 버그 수정 (Gym/Fitness, Performances/Concerts)
-- ============================================================================

-- ============================================================================
-- 1. topic_groups 테이블 생성
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.topic_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ko text NOT NULL,
  name_en text NOT NULL,
  icon text,
  description_ko text,
  sort_order int NOT NULL DEFAULT 0,
  selection_type text NOT NULL CHECK (selection_type IN ('single', 'multiple')),
  min_selections int NOT NULL DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.topic_groups ADD CONSTRAINT topic_groups_name_en_unique UNIQUE (name_en);
CREATE INDEX IF NOT EXISTS idx_topic_groups_order ON public.topic_groups(sort_order) WHERE is_active = true;

COMMENT ON TABLE public.topic_groups IS 'OPIc 서베이 7개 대분류 (선택 규칙 포함)';

-- RLS: 공개 읽기 전용 (topics, questions과 동일 패턴)
ALTER TABLE public.topic_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "topic_groups_select" ON public.topic_groups
  FOR SELECT USING (true);

-- ============================================================================
-- 2. topic_groups 시드 데이터 (7개 대분류)
-- ============================================================================

INSERT INTO public.topic_groups (name_ko, name_en, icon, description_ko, sort_order, selection_type, min_selections) VALUES
  ('현재 직업/직장', 'Job/Occupation',     'briefcase-outline', '현재 하고 있는 일을 선택하세요',           1, 'single',   1),
  ('학생 여부',      'Student Status',     'school-outline',    '학생이라면 해당하는 항목을 선택하세요',     2, 'single',   1),
  ('거주지 형태',    'Housing Type',       'home-outline',      '현재 살고 있는 곳의 형태를 선택하세요',     3, 'single',   1),
  ('여가활동',       'Leisure Activities', 'film-outline',      '자주 하는 여가활동을 선택하세요 (2개 이상)', 4, 'multiple', 2),
  ('취미/관심사',    'Hobbies/Interests',  'heart-outline',     '관심 있는 취미를 선택하세요',              5, 'multiple', 1),
  ('운동/스포츠',    'Sports/Exercise',    'fitness-outline',   '하고 있는 운동을 선택하세요',              6, 'multiple', 1),
  ('휴가/출장',      'Vacation/Travel',    'airplane-outline',  '휴가나 출장 관련 항목을 선택하세요',        7, 'multiple', 1)
ON CONFLICT (name_en) DO NOTHING;

-- ============================================================================
-- 3. topics.group_id FK 추가
-- ============================================================================

ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.topic_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_topics_group_id ON public.topics(group_id) WHERE is_active = true;

-- ============================================================================
-- 4. 기존 서베이 토픽 대분류 배정
-- ============================================================================

-- 4a. 자기소개 → 서베이 비노출 (모의고사 Q1 전용)
UPDATE public.topics SET is_active = false
WHERE name_en = 'Self Introduction' AND category = 'survey';

-- 4b. 전화통화 → 돌발로 이동
UPDATE public.topics SET category = 'unexpected'
WHERE name_en = 'Phone Calls' AND category = 'survey';

-- 4c. 거주지 형태 (그룹 3)
UPDATE public.topics SET group_id = (SELECT id FROM public.topic_groups WHERE name_en = 'Housing Type')
WHERE name_en IN ('Home/Housing', 'Neighborhood') AND category = 'survey';

-- 4d. 여가활동 (그룹 4)
UPDATE public.topics SET group_id = (SELECT id FROM public.topic_groups WHERE name_en = 'Leisure Activities')
WHERE name_en IN ('Watching Movies', 'Watching TV', 'Shopping', 'Performances/Concerts', 'Cafes/Coffee Shops', 'Going to Parks') AND category = 'survey';

-- 4e. 취미/관심사 (그룹 5)
UPDATE public.topics SET group_id = (SELECT id FROM public.topic_groups WHERE name_en = 'Hobbies/Interests')
WHERE name_en IN ('Listening to Music', 'Cooking/Food', 'Internet/SNS', 'Reading', 'Pets') AND category = 'survey';

-- 4f. 운동/스포츠 (그룹 6)
UPDATE public.topics SET group_id = (SELECT id FROM public.topic_groups WHERE name_en = 'Sports/Exercise')
WHERE name_en IN ('Gym/Fitness', 'Jogging/Walking', 'Cycling', 'Swimming', 'Hiking', 'Yoga') AND category = 'survey';

-- 4g. 휴가/출장 (그룹 7)
UPDATE public.topics SET group_id = (SELECT id FROM public.topic_groups WHERE name_en = 'Vacation/Travel')
WHERE name_en IN ('Travel/Vacation', 'Camping', 'Going to the Beach') AND category = 'survey';

-- ============================================================================
-- 5. 신규 서베이 토픽 (대분류 1-3 + 확장)
-- ============================================================================

-- 5a. 그룹 1: 직업 (신규 5개)
INSERT INTO public.topics (name_ko, name_en, icon, description, category, sort_order, group_id) VALUES
  ('회사원',     'Office Worker',   'business-outline',   '사무실에서 근무하는 직장인',   'survey', 101, (SELECT id FROM public.topic_groups WHERE name_en = 'Job/Occupation')),
  ('자영업',     'Self-Employed',   'storefront-outline', '자기 사업을 운영',            'survey', 102, (SELECT id FROM public.topic_groups WHERE name_en = 'Job/Occupation')),
  ('프리랜서',   'Freelancer',      'laptop-outline',     '프리랜서/재택 근무자',         'survey', 103, (SELECT id FROM public.topic_groups WHERE name_en = 'Job/Occupation')),
  ('공무원',     'Public Official', 'shield-outline',     '공공기관 근무자',              'survey', 104, (SELECT id FROM public.topic_groups WHERE name_en = 'Job/Occupation')),
  ('전문직',     'Professional',    'medkit-outline',     '의사, 변호사, 엔지니어 등',    'survey', 105, (SELECT id FROM public.topic_groups WHERE name_en = 'Job/Occupation'))
ON CONFLICT (name_en) DO NOTHING;

-- 5b. 그룹 2: 학생 (신규 3개)
INSERT INTO public.topics (name_ko, name_en, icon, description, category, sort_order, group_id) VALUES
  ('대학생',       'University Student',   'school-outline',    '대학교에 재학 중',              'survey', 201, (SELECT id FROM public.topic_groups WHERE name_en = 'Student Status')),
  ('대학원생',     'Graduate Student',     'library-outline',   '석사/박사 과정',                'survey', 202, (SELECT id FROM public.topic_groups WHERE name_en = 'Student Status')),
  ('직장인+학생',  'Working Student',      'briefcase-outline', '일하면서 학교도 다니는 경우',     'survey', 203, (SELECT id FROM public.topic_groups WHERE name_en = 'Student Status'))
ON CONFLICT (name_en) DO NOTHING;

-- 5c. 그룹 3: 거주지 확장 (신규 3개, 기존 2개는 위에서 group_id 배정)
INSERT INTO public.topics (name_ko, name_en, icon, description, category, sort_order, group_id) VALUES
  ('아파트',         'Apartment',          'business-outline', '아파트에 거주',              'survey', 301, (SELECT id FROM public.topic_groups WHERE name_en = 'Housing Type')),
  ('원룸/오피스텔',  'Studio/Officetel',   'bed-outline',      '원룸 또는 오피스텔에 거주',   'survey', 302, (SELECT id FROM public.topic_groups WHERE name_en = 'Housing Type')),
  ('기숙사',         'Dormitory',          'people-outline',   '학교 기숙사에 거주',          'survey', 303, (SELECT id FROM public.topic_groups WHERE name_en = 'Housing Type'))
ON CONFLICT (name_en) DO NOTHING;

-- 5d. 그룹 4: 여가 확장 (신규 1개)
INSERT INTO public.topics (name_ko, name_en, icon, description, category, sort_order, group_id) VALUES
  ('게임',  'Gaming', 'game-controller-outline', '비디오 게임, 모바일 게임', 'survey', 401, (SELECT id FROM public.topic_groups WHERE name_en = 'Leisure Activities'))
ON CONFLICT (name_en) DO NOTHING;

-- 5e. 그룹 5: 취미 확장 (신규 2개)
INSERT INTO public.topics (name_ko, name_en, icon, description, category, sort_order, group_id) VALUES
  ('사진',     'Photography',       'camera-outline',       '사진 찍기',    'survey', 501, (SELECT id FROM public.topic_groups WHERE name_en = 'Hobbies/Interests')),
  ('악기 연주', 'Playing Instruments', 'musical-note-outline', '악기 연주하기', 'survey', 502, (SELECT id FROM public.topic_groups WHERE name_en = 'Hobbies/Interests'))
ON CONFLICT (name_en) DO NOTHING;

-- 5f. 그룹 6: 운동 확장 (신규 6개)
INSERT INTO public.topics (name_ko, name_en, icon, description, category, sort_order, group_id) VALUES
  ('축구',     'Soccer',     'football-outline',  '축구',     'survey', 601, (SELECT id FROM public.topic_groups WHERE name_en = 'Sports/Exercise')),
  ('야구',     'Baseball',   'baseball-outline',  '야구',     'survey', 602, (SELECT id FROM public.topic_groups WHERE name_en = 'Sports/Exercise')),
  ('농구',     'Basketball', 'basketball-outline', '농구',    'survey', 603, (SELECT id FROM public.topic_groups WHERE name_en = 'Sports/Exercise')),
  ('테니스',   'Tennis',     'tennisball-outline', '테니스',   'survey', 604, (SELECT id FROM public.topic_groups WHERE name_en = 'Sports/Exercise')),
  ('골프',     'Golf',       'golf-outline',       '골프',    'survey', 605, (SELECT id FROM public.topic_groups WHERE name_en = 'Sports/Exercise')),
  ('배드민턴', 'Badminton',  'tennisball-outline', '배드민턴', 'survey', 606, (SELECT id FROM public.topic_groups WHERE name_en = 'Sports/Exercise'))
ON CONFLICT (name_en) DO NOTHING;

-- 5g. 그룹 7: 휴가 확장 (신규 3개)
INSERT INTO public.topics (name_ko, name_en, icon, description, category, sort_order, group_id) VALUES
  ('국내여행',  'Domestic Travel',   'map-outline',       '국내 여행',             'survey', 701, (SELECT id FROM public.topic_groups WHERE name_en = 'Vacation/Travel')),
  ('해외여행',  'International Travel', 'globe-outline',  '해외 여행',             'survey', 702, (SELECT id FROM public.topic_groups WHERE name_en = 'Vacation/Travel')),
  ('출장',      'Business Trip',     'briefcase-outline', '업무 관련 출장',         'survey', 703, (SELECT id FROM public.topic_groups WHERE name_en = 'Vacation/Travel'))
ON CONFLICT (name_en) DO NOTHING;

-- ============================================================================
-- 6. 돌발 주제 추가 (기존 5개 + 신규 15개)
-- 기존 (035): Weather/Seasons, Holidays, Recycling, Fashion/Clothing, Technology
-- ============================================================================

INSERT INTO public.topics (name_ko, name_en, icon, description, category, sort_order) VALUES
  ('교통수단',       'Transportation',       'car-outline',         '버스, 지하철, 자동차 등',     'unexpected', 811),
  ('외식',           'Eating Out',           'restaurant-outline',  '외식, 식당 이용',             'unexpected', 812),
  ('건강/병원',      'Health/Hospital',      'medkit-outline',      '건강 관리, 병원 방문',         'unexpected', 813),
  ('은행',           'Banking',              'card-outline',        '은행 업무, 금융 서비스',       'unexpected', 814),
  ('집안일',         'Household Chores',     'home-outline',        '청소, 빨래, 설거지 등',        'unexpected', 815),
  ('약속',           'Appointments',         'calendar-outline',    '만남, 약속 잡기',              'unexpected', 816),
  ('가구/가전',      'Furniture/Appliances', 'tv-outline',          '가구, 가전제품 구매/사용',      'unexpected', 817),
  ('도서관',         'Library',              'library-outline',     '도서관 이용',                   'unexpected', 818),
  ('지역 축제',      'Local Festivals',      'megaphone-outline',   '지역 행사, 축제',              'unexpected', 819),
  ('호텔',           'Hotels',               'bed-outline',         '호텔 숙박, 서비스',             'unexpected', 820),
  ('직장/프로젝트',   'Work/Projects',       'construct-outline',   '업무, 프로젝트 경험',           'unexpected', 821),
  ('산업/기술',      'Industry/Technology',  'hardware-chip-outline','산업, 기술 발전',              'unexpected', 822),
  ('지형/자연',      'Geography/Nature',     'earth-outline',       '지형, 자연환경',               'unexpected', 823),
  ('공원/산책',      'Parks/Walking',        'leaf-outline',        '공원, 산책로',                  'unexpected', 824),
  ('인터넷 쇼핑',    'Online Shopping',      'cart-outline',        '온라인 쇼핑, 배송',             'unexpected', 825)
ON CONFLICT (name_en) DO NOTHING;

-- ============================================================================
-- 7. 신규 토픽 질문 시드
-- ============================================================================

-- === 7a. 직업 토픽 질문 ===

-- 회사원
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about your job. What kind of work do you do? Describe your typical day at the office.', 'describe', 2, '어떤 일을 하시나요? 사무실에서의 일상을 설명해주세요.', 1),
  ('What is your daily routine at work? Walk me through a typical workday from start to finish.', 'routine', 3, '출근부터 퇴근까지 하루 일과를 말해주세요.', 2),
  ('Tell me about a memorable experience you had at work. What happened and how did you handle it?', 'experience', 3, '직장에서 기억에 남는 경험을 말해주세요.', 3),
  ('How has your workplace changed compared to when you first started? What are the differences?', 'comparison', 4, '처음 입사했을 때와 비교해서 직장이 어떻게 변했나요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Office Worker';

-- 자영업
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about your business. What kind of business do you run and what do you do?', 'describe', 2, '어떤 사업을 하시나요? 어떤 일을 하시는지 설명해주세요.', 1),
  ('What is your typical day like running your own business?', 'routine', 3, '자영업을 하면서 하루 일과가 어떤가요?', 2),
  ('Tell me about a challenge you faced in your business and how you overcame it.', 'experience', 3, '사업에서 겪었던 어려움과 어떻게 극복했는지 말해주세요.', 3),
  ('How is running your own business different from working for a company?', 'comparison', 4, '자영업과 회사 근무는 어떻게 다른가요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Self-Employed';

-- 프리랜서
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about your work as a freelancer. What kind of projects do you work on?', 'describe', 2, '프리랜서로 어떤 프로젝트를 하시나요?', 1),
  ('What does a typical workday look like for you as a freelancer?', 'routine', 3, '프리랜서로서의 하루 일과를 말해주세요.', 2),
  ('Tell me about a project you worked on that was particularly memorable or challenging.', 'experience', 3, '특히 기억에 남는 프로젝트에 대해 말해주세요.', 3),
  ('How is working as a freelancer different from working at a regular office?', 'comparison', 4, '프리랜서 근무와 정규직 근무는 어떻게 다른가요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Freelancer';

-- 공무원
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about your job as a public official. What department do you work in and what do you do?', 'describe', 2, '공무원으로서 어떤 부서에서 어떤 일을 하시나요?', 1),
  ('What is your daily routine at work? Describe a typical day.', 'routine', 3, '하루 업무 일과를 설명해주세요.', 2),
  ('Tell me about a memorable experience you had at your workplace.', 'experience', 3, '직장에서 기억에 남는 경험을 말해주세요.', 3),
  ('How has your work changed over the years? What are the biggest differences?', 'comparison', 4, '근무 환경이 어떻게 변했나요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Public Official';

-- 전문직
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about your profession. What field are you in and what does your work involve?', 'describe', 2, '어떤 전문 분야에서 일하시나요?', 1),
  ('Walk me through a typical day in your profession.', 'routine', 3, '전문직으로서의 하루 일과를 말해주세요.', 2),
  ('Tell me about a particularly challenging case or situation you handled in your work.', 'experience', 4, '업무에서 특히 어려웠던 상황을 말해주세요.', 3),
  ('How has your field changed since you first started your career?', 'comparison', 4, '처음 일을 시작했을 때와 비교해서 분야가 어떻게 변했나요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Professional';

-- === 7b. 학생 토픽 질문 ===

-- 대학생
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about your school. What university do you attend and what is your major?', 'describe', 2, '어떤 대학교에 다니고 전공이 무엇인가요?', 1),
  ('What is your daily routine as a university student?', 'routine', 2, '대학생으로서의 하루 일과를 말해주세요.', 2),
  ('Tell me about a memorable experience you had at school.', 'experience', 3, '학교에서 기억에 남는 경험을 말해주세요.', 3),
  ('How is university life different from high school?', 'comparison', 3, '대학 생활은 고등학교와 어떻게 다른가요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'University Student';

-- 대학원생
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about your graduate studies. What are you researching or studying?', 'describe', 3, '대학원에서 무엇을 연구하거나 공부하고 있나요?', 1),
  ('What does a typical week look like for you as a graduate student?', 'routine', 3, '대학원생으로서 일주일이 어떤가요?', 2),
  ('Tell me about a challenging aspect of your graduate studies.', 'experience', 4, '대학원 생활에서 어려웠던 점을 말해주세요.', 3),
  ('How is graduate school different from your undergraduate experience?', 'comparison', 4, '대학원과 학부 시절은 어떻게 다른가요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Graduate Student';

-- 직장인+학생
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about yourself. You work and study at the same time. How do you manage both?', 'describe', 3, '일과 공부를 동시에 하고 있는데, 어떻게 관리하나요?', 1),
  ('What is your daily schedule like, balancing work and school?', 'routine', 3, '일과 학교를 병행하는 하루 일정을 말해주세요.', 2),
  ('Tell me about a time when balancing work and school was particularly difficult.', 'experience', 4, '일과 학업 병행이 특히 어려웠던 때를 말해주세요.', 3),
  ('How is your life different now compared to when you were only working or only studying?', 'comparison', 4, '일만 하거나 공부만 하던 때와 비교해서 어떻게 다른가요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Working Student';

-- === 7c. 거주지 신규 토픽 질문 ===

-- 아파트
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about the apartment you live in. What does it look like? Describe it in detail.', 'describe', 2, '살고 있는 아파트를 자세히 설명해주세요.', 1),
  ('What is your daily routine at home? What do you usually do when you get home?', 'routine', 2, '집에서의 일상을 말해주세요.', 2),
  ('Tell me about a memorable experience you had in your apartment or apartment complex.', 'experience', 3, '아파트에서 기억에 남는 경험을 말해주세요.', 3),
  ('How is your current apartment different from the place you lived before?', 'comparison', 3, '이전에 살던 곳과 현재 아파트는 어떻게 다른가요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Apartment';

-- 원룸/오피스텔
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about the place you live in. What does your studio apartment look like?', 'describe', 2, '살고 있는 원룸/오피스텔을 설명해주세요.', 1),
  ('What do you usually do when you get home? Describe your evening routine.', 'routine', 2, '집에 오면 보통 뭘 하나요?', 2),
  ('Tell me about a problem you had with your studio or how you decorated it.', 'experience', 3, '원룸에서 있었던 문제나 인테리어 경험을 말해주세요.', 3)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Studio/Officetel';

-- 기숙사
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about the dormitory you live in. What is it like?', 'describe', 2, '살고 있는 기숙사를 설명해주세요.', 1),
  ('What is your daily routine living in the dormitory?', 'routine', 2, '기숙사에서의 하루 일과를 말해주세요.', 2),
  ('Tell me about a memorable experience you had while living in the dormitory.', 'experience', 3, '기숙사 생활에서 기억에 남는 경험을 말해주세요.', 3),
  ('How is living in a dormitory different from living at home with your family?', 'comparison', 3, '기숙사 생활과 가족과 사는 것은 어떻게 다른가요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Dormitory';

-- === 7d. 여가/취미/운동 신규 토픽 질문 (간략 버전) ===

-- 게임
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('What kind of games do you like to play? Describe your favorite game.', 'describe', 2, '어떤 게임을 좋아하나요? 좋아하는 게임을 설명해주세요.', 1),
  ('How often do you play games? What is your gaming routine?', 'routine', 2, '얼마나 자주 게임을 하나요?', 2),
  ('Tell me about a memorable gaming experience you had.', 'experience', 3, '기억에 남는 게임 경험을 말해주세요.', 3),
  ('How have the games you play changed over the years?', 'comparison', 3, '게임 취향이 어떻게 변했나요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Gaming';

-- 사진
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about your interest in photography. What kind of photos do you like to take?', 'describe', 2, '사진 취미에 대해 말해주세요.', 1),
  ('How often do you take photos? What is your routine when you go out to take pictures?', 'routine', 3, '사진 찍으러 갈 때 어떻게 하나요?', 2),
  ('Tell me about a photo you took that you are particularly proud of.', 'experience', 3, '특히 자랑스러운 사진 경험을 말해주세요.', 3)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Photography';

-- 악기 연주
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about the instrument you play. How did you start playing?', 'describe', 2, '어떤 악기를 연주하나요? 어떻게 시작했나요?', 1),
  ('How often do you practice? What is your practice routine?', 'routine', 3, '얼마나 자주 연습하나요?', 2),
  ('Tell me about a memorable performance or experience related to playing your instrument.', 'experience', 3, '악기 연주와 관련된 기억에 남는 경험을 말해주세요.', 3)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Playing Instruments';

-- 축구
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about your interest in soccer. Do you play or watch soccer?', 'describe', 2, '축구에 대해 말해주세요.', 1),
  ('How often do you play or watch soccer? What is your routine?', 'routine', 2, '축구를 얼마나 자주 하거나 보나요?', 2),
  ('Tell me about a memorable soccer game or experience you had.', 'experience', 3, '기억에 남는 축구 경험을 말해주세요.', 3),
  ('How has your interest in soccer changed over the years?', 'comparison', 3, '축구에 대한 관심이 어떻게 변했나요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Soccer';

-- 야구
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about your interest in baseball. Do you play or watch baseball?', 'describe', 2, '야구에 대해 말해주세요.', 1),
  ('How often do you play or watch baseball games?', 'routine', 2, '야구를 얼마나 자주 하거나 보나요?', 2),
  ('Tell me about a memorable baseball game you watched or played in.', 'experience', 3, '기억에 남는 야구 경험을 말해주세요.', 3)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Baseball';

-- 농구
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about your interest in basketball. Where do you usually play?', 'describe', 2, '농구에 대해 말해주세요. 보통 어디서 하나요?', 1),
  ('How often do you play basketball? What is your routine?', 'routine', 2, '농구를 얼마나 자주 하나요?', 2),
  ('Tell me about a memorable basketball game or experience.', 'experience', 3, '기억에 남는 농구 경험을 말해주세요.', 3)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Basketball';

-- 테니스
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about your interest in tennis. How did you get into it?', 'describe', 2, '테니스에 대해 말해주세요. 어떻게 시작했나요?', 1),
  ('How often do you play tennis? Where do you usually play?', 'routine', 3, '테니스를 얼마나 자주 하나요?', 2),
  ('Tell me about a memorable tennis match you played or watched.', 'experience', 3, '기억에 남는 테니스 경험을 말해주세요.', 3)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Tennis';

-- 골프
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about your interest in golf. How did you start playing?', 'describe', 3, '골프에 대해 말해주세요. 어떻게 시작했나요?', 1),
  ('How often do you play golf? Describe your typical golf routine.', 'routine', 3, '골프를 얼마나 자주 치나요?', 2),
  ('Tell me about a memorable round of golf you played.', 'experience', 3, '기억에 남는 골프 라운드를 말해주세요.', 3)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Golf';

-- 배드민턴
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about your interest in badminton. Where do you usually play?', 'describe', 2, '배드민턴에 대해 말해주세요.', 1),
  ('How often do you play badminton? Who do you usually play with?', 'routine', 2, '배드민턴을 얼마나 자주 하나요?', 2),
  ('Tell me about a memorable badminton game you played.', 'experience', 3, '기억에 남는 배드민턴 경험을 말해주세요.', 3)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Badminton';

-- 국내여행
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about a place in your country that you like to visit. What is it like?', 'describe', 2, '좋아하는 국내 여행지를 설명해주세요.', 1),
  ('What do you usually do to prepare for a domestic trip?', 'routine', 3, '국내 여행을 준비할 때 보통 어떻게 하나요?', 2),
  ('Tell me about a memorable domestic trip you took.', 'experience', 3, '기억에 남는 국내 여행을 말해주세요.', 3)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Domestic Travel';

-- 해외여행
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about a country you have visited. What was it like?', 'describe', 3, '방문했던 나라에 대해 말해주세요.', 1),
  ('What do you usually do to prepare for an international trip?', 'routine', 3, '해외 여행을 준비할 때 어떻게 하나요?', 2),
  ('Tell me about a memorable experience you had during a trip abroad.', 'experience', 4, '해외 여행 중 기억에 남는 경험을 말해주세요.', 3),
  ('How is traveling domestically different from traveling abroad?', 'comparison', 4, '국내 여행과 해외 여행은 어떻게 다른가요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'International Travel';

-- 출장
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about a business trip you have taken. Where did you go?', 'describe', 3, '출장 경험에 대해 말해주세요.', 1),
  ('What do you usually do to prepare for a business trip?', 'routine', 3, '출장 준비를 어떻게 하나요?', 2),
  ('Tell me about a memorable or challenging business trip experience.', 'experience', 4, '기억에 남는 출장 경험을 말해주세요.', 3)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Business Trip';

-- === 7e. 돌발 주제 질문 시드 (주요 5개 우선) ===

-- 교통수단
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('What kind of transportation do you usually use? Describe it.', 'describe', 2, '보통 어떤 교통수단을 이용하나요?', 1),
  ('What is your daily commute like? Walk me through your typical trip.', 'routine', 2, '출퇴근 과정을 설명해주세요.', 2),
  ('Tell me about a memorable experience you had while using public transportation.', 'experience', 3, '대중교통 이용 중 기억에 남는 경험을 말해주세요.', 3),
  ('How has public transportation in your area changed over the years?', 'comparison', 4, '교통수단이 어떻게 변했나요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Transportation';

-- 외식
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about a restaurant you like to go to. What is it like?', 'describe', 2, '좋아하는 식당에 대해 말해주세요.', 1),
  ('How often do you eat out? What do you usually do when you go to a restaurant?', 'routine', 2, '외식을 얼마나 자주 하나요?', 2),
  ('Tell me about a memorable dining experience you had at a restaurant.', 'experience', 3, '기억에 남는 외식 경험을 말해주세요.', 3),
  ('How have your eating out habits changed compared to a few years ago?', 'comparison', 3, '외식 습관이 어떻게 변했나요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Eating Out';

-- 건강/병원
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('What do you usually do to stay healthy? Describe your health habits.', 'describe', 2, '건강을 위해 보통 무엇을 하나요?', 1),
  ('Tell me about a time you went to the hospital or saw a doctor. What happened?', 'experience', 3, '병원에 갔던 경험을 말해주세요.', 2),
  ('How have your health habits changed over the years?', 'comparison', 3, '건강 습관이 어떻게 변했나요?', 3)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Health/Hospital';

-- 은행
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about the bank you use. What kind of banking services do you use?', 'describe', 2, '이용하는 은행과 서비스를 말해주세요.', 1),
  ('What is your routine when you go to the bank?', 'routine', 2, '은행에 가면 보통 어떻게 하나요?', 2),
  ('Tell me about a problem you had at the bank and how you resolved it.', 'experience', 3, '은행에서 겪었던 문제를 말해주세요.', 3)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Banking';

-- 집안일
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('What kind of household chores do you do at home?', 'describe', 2, '집에서 어떤 집안일을 하나요?', 1),
  ('What is your cleaning routine? How often do you clean your home?', 'routine', 2, '청소 루틴을 설명해주세요.', 2),
  ('Tell me about a time when you had to do a big cleaning or organizing project at home.', 'experience', 3, '대청소를 했던 경험을 말해주세요.', 3)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Household Chores';

-- 약속
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('How do you usually make plans to meet friends? Describe the process.', 'describe', 2, '친구와 약속을 어떻게 잡나요?', 1),
  ('Tell me about a time when your plans changed suddenly. What happened?', 'experience', 3, '약속이 갑자기 변경됐던 경험을 말해주세요.', 2),
  ('How has the way you make appointments changed compared to before?', 'comparison', 3, '약속을 잡는 방식이 어떻게 변했나요?', 3)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Appointments';

-- 가구/가전
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about the furniture or appliances in your home. What is your favorite item?', 'describe', 2, '집의 가구나 가전제품에 대해 말해주세요.', 1),
  ('Tell me about a time you bought new furniture or an appliance. What was the experience like?', 'experience', 3, '가구나 가전을 샀던 경험을 말해주세요.', 2),
  ('How have home appliances changed compared to when you were younger?', 'comparison', 3, '가전제품이 어떻게 변했나요?', 3)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Furniture/Appliances';

-- 도서관
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about a library you go to. What is it like?', 'describe', 2, '다니는 도서관을 설명해주세요.', 1),
  ('How often do you go to the library? What do you usually do there?', 'routine', 2, '도서관에 얼마나 자주 가나요?', 2),
  ('Tell me about a memorable experience you had at a library.', 'experience', 3, '도서관에서 기억에 남는 경험을 말해주세요.', 3)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Library';

-- 지역 축제
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about a local festival or event in your area. What is it like?', 'describe', 3, '지역 축제에 대해 말해주세요.', 1),
  ('Tell me about a festival you attended. What did you do there?', 'experience', 3, '참석했던 축제 경험을 말해주세요.', 2),
  ('How have local festivals changed compared to the past?', 'comparison', 4, '지역 축제가 어떻게 변했나요?', 3)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Local Festivals';

-- 호텔
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about a hotel you stayed at recently. What was it like?', 'describe', 3, '최근에 묵었던 호텔을 설명해주세요.', 1),
  ('What do you usually look for when choosing a hotel?', 'routine', 3, '호텔을 고를 때 보통 무엇을 확인하나요?', 2),
  ('Tell me about a problem you experienced at a hotel and how it was resolved.', 'experience', 4, '호텔에서 겪었던 문제를 말해주세요.', 3)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Hotels';

-- 직장/프로젝트
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about a project you worked on recently. What was it about?', 'describe', 3, '최근 프로젝트에 대해 말해주세요.', 1),
  ('Tell me about a challenge you faced at work and how you handled it.', 'experience', 4, '업무에서 겪었던 어려움을 말해주세요.', 2),
  ('How has the way people work changed compared to a few years ago?', 'comparison', 4, '일하는 방식이 어떻게 변했나요?', 3)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Work/Projects';

-- 산업/기술
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('What kind of technology do you use in your daily life?', 'describe', 3, '일상에서 어떤 기술을 사용하나요?', 1),
  ('Tell me about a new technology that has changed the way you live or work.', 'experience', 4, '생활이나 업무를 바꾼 기술에 대해 말해주세요.', 2),
  ('How has technology changed your industry or field of work?', 'comparison', 5, '기술이 산업을 어떻게 변화시켰나요?', 3)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Industry/Technology';

-- 지형/자연
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Describe the geography and natural features of the area where you live.', 'describe', 3, '살고 있는 지역의 지형과 자연환경을 설명해주세요.', 1),
  ('Tell me about a time you visited a beautiful natural area. What was it like?', 'experience', 3, '아름다운 자연환경을 방문한 경험을 말해주세요.', 2),
  ('How has the natural environment in your area changed over the years?', 'comparison', 4, '지역의 자연환경이 어떻게 변했나요?', 3)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Geography/Nature';

-- 공원/산책
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about a park you like to visit. What does it look like?', 'describe', 2, '좋아하는 공원을 설명해주세요.', 1),
  ('How often do you go for walks? Describe your walking routine.', 'routine', 2, '산책을 얼마나 자주 하나요?', 2),
  ('Tell me about a memorable experience you had at a park.', 'experience', 3, '공원에서 기억에 남는 경험을 말해주세요.', 3)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Parks/Walking';

-- 인터넷 쇼핑
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about your online shopping habits. What do you usually buy online?', 'describe', 2, '온라인 쇼핑 습관에 대해 말해주세요.', 1),
  ('Walk me through the process when you shop online.', 'routine', 2, '온라인으로 쇼핑할 때 과정을 설명해주세요.', 2),
  ('Tell me about a problem you had with an online purchase and how you handled it.', 'experience', 3, '온라인 구매에서 문제가 있었던 경험을 말해주세요.', 3),
  ('How is online shopping different from shopping at a physical store?', 'comparison', 3, '온라인 쇼핑과 오프라인 쇼핑은 어떻게 다른가요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Online Shopping';

-- ============================================================================
-- 8. 058 name_en 버그 수정 (058 적용 후에만 실행 — 컬럼 존재 확인)
-- ============================================================================

DO $$
BEGIN
  -- strategy_group 컬럼이 존재할 때만 실행 (058이 적용된 경우)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'topics' AND column_name = 'strategy_group'
  ) THEN
    -- Gym/Fitness (018에서 Exercise/Fitness에서 이름 변경됨, 058에서 매칭 실패)
    UPDATE public.topics SET
      strategy_group = 'outdoor_activity',
      difficulty_hint = 3,
      strategy_tip_ko = '활동 그룹. "공원 가기", "해변 가기"와 야외 활동 표현 공유. 운동 루틴 + 운동 중 생긴 일을 준비하세요.'
    WHERE name_en = 'Gym/Fitness' AND strategy_group IS NULL;

    -- Performances/Concerts (058에서 Concerts/Performances로 잘못 참조)
    UPDATE public.topics SET
      strategy_group = 'entertainment',
      difficulty_hint = 3,
      strategy_tip_ko = '"음악 듣기"와 엔터 그룹. 공연장 묘사, 공연 경험, 티켓 구매 롤플레이가 나올 수 있습니다.'
    WHERE name_en = 'Performances/Concerts' AND strategy_group IS NULL;
  END IF;
END $$;

-- ============================================================================
-- 9. set_student_topics RPC 재작성 (서버 사이드 선택 규칙 검증)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_student_topics(
  p_student_id uuid,
  p_topic_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_topic_id uuid;
  v_valid_count int;
  v_group_record record;
  v_group_selection_count int;
  v_total_count int;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- 인가: 연결된 강사 또는 super_admin 또는 본인(학생)
  IF v_caller_id != p_student_id
     AND NOT public.is_super_admin()
     AND NOT EXISTS (
       SELECT 1 FROM public.teacher_student
       WHERE teacher_id = v_caller_id AND student_id = p_student_id AND deleted_at IS NULL
     )
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_CONNECTED');
  END IF;

  -- 빈 배열 허용 (토픽 초기화)
  IF p_topic_ids IS NULL OR array_length(p_topic_ids, 1) IS NULL THEN
    DELETE FROM public.student_topics WHERE student_id = p_student_id;
    RETURN jsonb_build_object('success', true);
  END IF;

  -- 검증 1: 모든 topic_id가 active 서베이 토픽인지
  SELECT COUNT(*) INTO v_valid_count
  FROM public.topics
  WHERE id = ANY(p_topic_ids) AND is_active = true AND category = 'survey';

  IF v_valid_count != array_length(p_topic_ids, 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TOPIC');
  END IF;

  -- 검증 2: 그룹별 선택 규칙
  FOR v_group_record IN
    SELECT tg.id, tg.name_ko, tg.selection_type, tg.min_selections
    FROM public.topic_groups tg
    WHERE tg.is_active = true
    ORDER BY tg.sort_order
  LOOP
    SELECT COUNT(*) INTO v_group_selection_count
    FROM public.topics t
    WHERE t.id = ANY(p_topic_ids) AND t.group_id = v_group_record.id;

    -- single 그룹에서 2개 이상 선택 차단
    IF v_group_record.selection_type = 'single' AND v_group_selection_count > 1 THEN
      RETURN jsonb_build_object('success', false, 'error', 'SINGLE_GROUP_EXCEEDED',
        'detail', v_group_record.name_ko || '에서는 1개만 선택할 수 있습니다.');
    END IF;

    -- 각 그룹 최소 선택 수 검증
    IF v_group_selection_count < v_group_record.min_selections THEN
      RETURN jsonb_build_object('success', false, 'error', 'GROUP_MIN_NOT_MET',
        'detail', v_group_record.name_ko || '에서 최소 ' || v_group_record.min_selections || '개를 선택해야 합니다.');
    END IF;
  END LOOP;

  -- 검증 3: 총 12개 이상
  v_total_count := array_length(p_topic_ids, 1);
  IF v_total_count < 12 THEN
    RETURN jsonb_build_object('success', false, 'error', 'MIN_TOTAL_NOT_MET',
      'detail', '최소 12개 이상의 토픽을 선택해야 합니다. (현재: ' || v_total_count || '개)');
  END IF;

  -- 기존 배정 hard delete (junction 테이블)
  DELETE FROM public.student_topics WHERE student_id = p_student_id;

  -- 새 토픽 배정
  FOREACH v_topic_id IN ARRAY p_topic_ids
  LOOP
    INSERT INTO public.student_topics (student_id, topic_id)
    VALUES (p_student_id, v_topic_id);
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.set_student_topics IS '토픽 배정 (OPIc 서베이 선택 규칙 서버 검증: single/multiple, 최소 수량, 총 12개+)';

-- ============================================================================
-- 10. get_student_topics_with_progress에 group 정보 추가
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_student_topics_with_progress(uuid);

CREATE OR REPLACE FUNCTION public.get_student_topics_with_progress(p_student_id uuid)
RETURNS TABLE (
  topic_id uuid,
  topic_name_ko text,
  topic_name_en text,
  topic_icon text,
  topic_sort_order integer,
  topic_category text,
  topic_group_id uuid,
  topic_group_name_ko text,
  topic_group_sort_order integer,
  total_questions bigint,
  scripts_count bigint,
  practices_count bigint,
  best_avg_score numeric,
  last_practice_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_is_authorized boolean;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN RETURN; END IF;

  v_is_authorized := (v_caller_id = p_student_id)
    OR EXISTS (
      SELECT 1 FROM public.teacher_student
      WHERE teacher_id = v_caller_id AND student_id = p_student_id AND deleted_at IS NULL
    )
    OR public.is_super_admin();

  IF NOT v_is_authorized THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    t.id AS topic_id,
    t.name_ko AS topic_name_ko,
    t.name_en AS topic_name_en,
    t.icon AS topic_icon,
    t.sort_order AS topic_sort_order,
    t.category AS topic_category,
    t.group_id AS topic_group_id,
    tg.name_ko AS topic_group_name_ko,
    COALESCE(tg.sort_order, 99) AS topic_group_sort_order,
    (SELECT COUNT(*) FROM public.questions q WHERE q.topic_id = t.id AND q.is_active = true) AS total_questions,
    (SELECT COUNT(*) FROM public.scripts s
     JOIN public.questions q2 ON q2.id = s.question_id
     WHERE s.student_id = p_student_id AND q2.topic_id = t.id
       AND s.deleted_at IS NULL AND s.status = 'complete') AS scripts_count,
    (SELECT COUNT(*) FROM public.practices p
     JOIN public.scripts s2 ON s2.id = p.script_id
     JOIN public.questions q3 ON q3.id = s2.question_id
     WHERE p.student_id = p_student_id AND q3.topic_id = t.id
       AND p.deleted_at IS NULL AND s2.deleted_at IS NULL) AS practices_count,
    (SELECT ROUND(AVG(p2.score)::numeric, 1) FROM public.practices p2
     JOIN public.scripts s3 ON s3.id = p2.script_id
     JOIN public.questions q4 ON q4.id = s3.question_id
     WHERE p2.student_id = p_student_id AND q4.topic_id = t.id
       AND p2.deleted_at IS NULL AND s3.deleted_at IS NULL
       AND p2.score IS NOT NULL) AS best_avg_score,
    (SELECT MAX(p3.created_at) FROM public.practices p3
     JOIN public.scripts s4 ON s4.id = p3.script_id
     JOIN public.questions q5 ON q5.id = s4.question_id
     WHERE p3.student_id = p_student_id AND q5.topic_id = t.id
       AND p3.deleted_at IS NULL AND s4.deleted_at IS NULL) AS last_practice_at
  FROM public.topics t
  JOIN public.student_topics st ON st.topic_id = t.id AND st.student_id = p_student_id
  LEFT JOIN public.topic_groups tg ON tg.id = t.group_id
  WHERE t.is_active = true
  ORDER BY COALESCE(tg.sort_order, 99), t.sort_order;
END;
$$;

COMMENT ON FUNCTION public.get_student_topics_with_progress IS
  '학생 토픽별 진도 (group 정보 포함, 본인/연결 강사/super_admin)';

-- ============================================================================
-- 11. PostgREST 스키마 캐시 리로드
-- ============================================================================

NOTIFY pgrst, 'reload schema';
