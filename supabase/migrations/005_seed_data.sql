-- ============================================================================
-- OPIc 학습 앱 - Seed Data (초기 데이터)
-- ============================================================================

-- ============================================================================
-- 1. APP_CONFIG (앱 설정)
-- ============================================================================

INSERT INTO public.app_config (key, value, description) VALUES
  ('version', '{"minVersion": "1.0.0", "latestVersion": "1.0.0", "forceUpdate": false}', '앱 버전 관리'),
  ('maintenance', '{"enabled": false, "message": ""}', '점검 모드 설정')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 2. TOPICS (토픽 - Background Survey 12개)
-- ============================================================================

INSERT INTO public.topics (name_ko, name_en, icon, description, sort_order) VALUES
  ('자기소개', 'Self Introduction', '👤', '본인의 이름, 직업, 성격, 일상 등을 소개하는 토픽', 1),
  ('집/주거', 'Home/Housing', '🏠', '집의 구조, 방, 가구, 주거 환경을 설명하는 토픽', 2),
  ('이웃/동네', 'Neighborhood', '🏘️', '동네의 시설, 분위기, 이웃과의 관계를 설명하는 토픽', 3),
  ('음악 듣기', 'Listening to Music', '🎵', '좋아하는 음악, 가수, 음악 듣는 습관을 설명하는 토픽', 4),
  ('영화 보기', 'Watching Movies', '🎬', '좋아하는 영화 장르, 극장 경험을 설명하는 토픽', 5),
  ('TV 시청', 'Watching TV', '📺', '좋아하는 TV 프로그램, 시청 습관을 설명하는 토픽', 6),
  ('쇼핑', 'Shopping', '🛒', '쇼핑 장소, 구매 습관, 쇼핑 경험을 설명하는 토픽', 7),
  ('요리/음식', 'Cooking/Food', '🍳', '요리 습관, 좋아하는 음식, 식당 경험을 설명하는 토픽', 8),
  ('운동/헬스', 'Exercise/Fitness', '💪', '운동 종류, 운동 장소, 운동 습관을 설명하는 토픽', 9),
  ('여행/휴가', 'Travel/Vacation', '✈️', '여행 경험, 여행 준비, 여행지 추천을 설명하는 토픽', 10),
  ('전화통화', 'Phone Calls', '📱', '전화 사용 습관, 통화 경험을 설명하는 토픽', 11),
  ('인터넷/SNS', 'Internet/SNS', '💻', '인터넷 사용 습관, SNS 활동을 설명하는 토픽', 12)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. QUESTIONS (질문 - 각 토픽별 샘플)
-- ============================================================================

-- 자기소개 (Self Introduction)
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Let''s start the interview now. Tell me something about yourself.', 'describe', 2, '자기소개를 해주세요.', 1),
  ('Tell me about your daily routine. What do you usually do from morning to night?', 'routine', 2, '하루 일과를 말해주세요. 아침부터 저녁까지 보통 뭘 하나요?', 2),
  ('Describe your personality. What kind of person are you?', 'describe', 3, '성격을 설명해주세요. 어떤 사람인가요?', 3),
  ('What do you do in your free time? Tell me about your hobbies.', 'describe', 2, '여가 시간에 뭘 하나요? 취미에 대해 말해주세요.', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Self Introduction';

-- 집/주거 (Home/Housing)
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('I would like to know about your home. Can you describe it in detail?', 'describe', 2, '집에 대해 알고 싶어요. 자세히 설명해줄 수 있나요?', 1),
  ('Tell me about your favorite room in your house. What do you like about it?', 'describe', 2, '집에서 가장 좋아하는 방에 대해 말해주세요. 뭐가 좋나요?', 2),
  ('What do you typically do at home on weekends?', 'routine', 2, '주말에 집에서 보통 뭘 하나요?', 3),
  ('Tell me about a memorable experience you had at your home.', 'experience', 3, '집에서 있었던 기억에 남는 경험을 말해주세요.', 4),
  ('How has your home changed compared to where you lived when you were younger?', 'comparison', 4, '어렸을 때 살던 곳과 비교해서 집이 어떻게 바뀌었나요?', 5),
  ('Have you ever had any problems with your house? What happened and how did you resolve it?', 'experience', 4, '집에 문제가 생긴 적 있나요? 무슨 일이 있었고 어떻게 해결했나요?', 6)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Home/Housing';

-- 이웃/동네 (Neighborhood)
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Can you describe your neighborhood? What is it like?', 'describe', 2, '동네를 설명해줄 수 있나요? 어떤 곳인가요?', 1),
  ('What facilities or places are there in your neighborhood?', 'describe', 2, '동네에 어떤 시설이나 장소가 있나요?', 2),
  ('What do you usually do in your neighborhood?', 'routine', 2, '동네에서 보통 뭘 하나요?', 3),
  ('Tell me about an interesting experience you had with your neighbors.', 'experience', 3, '이웃과 있었던 재미있는 경험을 말해주세요.', 4),
  ('How has your neighborhood changed over the years?', 'comparison', 4, '동네가 몇 년간 어떻게 바뀌었나요?', 5)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Neighborhood';

-- 음악 듣기 (Listening to Music)
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('What kind of music do you like? Who is your favorite singer or band?', 'describe', 2, '어떤 음악을 좋아하나요? 좋아하는 가수나 밴드는 누구인가요?', 1),
  ('When and where do you usually listen to music?', 'routine', 2, '보통 언제 어디서 음악을 듣나요?', 2),
  ('Tell me about a memorable concert or music event you attended.', 'experience', 3, '참석했던 기억에 남는 콘서트나 음악 행사에 대해 말해주세요.', 3),
  ('How has your taste in music changed compared to when you were younger?', 'comparison', 4, '어렸을 때와 비교해서 음악 취향이 어떻게 바뀌었나요?', 4),
  ('How do people listen to music these days compared to the past?', 'comparison', 4, '요즘 사람들은 예전과 비교해서 어떻게 음악을 듣나요?', 5)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Listening to Music';

-- 영화 보기 (Watching Movies)
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('What kind of movies do you enjoy watching? Tell me about your favorite genre.', 'describe', 2, '어떤 영화를 즐겨 보나요? 좋아하는 장르에 대해 말해주세요.', 1),
  ('How often do you watch movies? Where do you usually watch them?', 'routine', 2, '얼마나 자주 영화를 보나요? 보통 어디서 보나요?', 2),
  ('Tell me about a movie that left a strong impression on you.', 'experience', 3, '강한 인상을 남긴 영화에 대해 말해주세요.', 3),
  ('How has the way people watch movies changed over the years?', 'comparison', 4, '사람들이 영화를 보는 방식이 몇 년간 어떻게 바뀌었나요?', 4),
  ('Tell me about a memorable experience you had at a movie theater.', 'experience', 3, '영화관에서 있었던 기억에 남는 경험을 말해주세요.', 5)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Watching Movies';

-- TV 시청 (Watching TV)
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('What kind of TV programs do you like to watch?', 'describe', 2, '어떤 TV 프로그램을 좋아하나요?', 1),
  ('When do you usually watch TV? How much time do you spend watching?', 'routine', 2, '보통 언제 TV를 보나요? 얼마나 시간을 쓰나요?', 2),
  ('Tell me about your favorite TV show. What do you like about it?', 'describe', 2, '좋아하는 TV 프로그램에 대해 말해주세요. 뭐가 좋나요?', 3),
  ('How has the way people watch TV changed compared to the past?', 'comparison', 4, '사람들이 TV를 보는 방식이 예전과 비교해서 어떻게 바뀌었나요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Watching TV';

-- 쇼핑 (Shopping)
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Where do you usually go shopping? Describe the place.', 'describe', 2, '보통 어디서 쇼핑하나요? 그곳을 설명해주세요.', 1),
  ('How often do you go shopping? What do you usually buy?', 'routine', 2, '얼마나 자주 쇼핑하나요? 보통 뭘 사나요?', 2),
  ('Tell me about a memorable shopping experience.', 'experience', 3, '기억에 남는 쇼핑 경험을 말해주세요.', 3),
  ('How has shopping changed with online shopping? Compare it to traditional shopping.', 'comparison', 4, '온라인 쇼핑으로 쇼핑이 어떻게 바뀌었나요? 전통적인 쇼핑과 비교해주세요.', 4),
  ('I want to buy a gift for my friend. Can you recommend a good store and explain how to get there?', 'roleplay', 4, '친구에게 줄 선물을 사고 싶어요. 좋은 가게를 추천하고 가는 방법을 설명해줄 수 있나요?', 5)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Shopping';

-- 요리/음식 (Cooking/Food)
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Do you enjoy cooking? What kind of food do you usually make?', 'describe', 2, '요리하는 걸 즐기나요? 보통 어떤 음식을 만드나요?', 1),
  ('Describe a dish you are good at making. How do you make it?', 'describe', 3, '잘 만드는 요리를 설명해주세요. 어떻게 만드나요?', 2),
  ('Tell me about a time when cooking didn''t go as planned.', 'experience', 3, '요리가 계획대로 안 됐던 적에 대해 말해주세요.', 3),
  ('How have your eating habits or cooking style changed over the years?', 'comparison', 4, '식습관이나 요리 스타일이 몇 년간 어떻게 바뀌었나요?', 4),
  ('What is a popular food or restaurant in your country?', 'describe', 2, '당신 나라에서 인기 있는 음식이나 식당은 무엇인가요?', 5)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Cooking/Food';

-- 운동/헬스 (Exercise/Fitness)
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('What kind of exercise do you do? Describe your workout routine.', 'describe', 2, '어떤 운동을 하나요? 운동 루틴을 설명해주세요.', 1),
  ('Where do you usually exercise? Describe the place.', 'describe', 2, '보통 어디서 운동하나요? 그곳을 설명해주세요.', 2),
  ('How often do you exercise? Walk me through a typical workout.', 'routine', 2, '얼마나 자주 운동하나요? 평소 운동을 설명해주세요.', 3),
  ('Tell me about a time when you achieved a fitness goal or had a memorable workout experience.', 'experience', 3, '운동 목표를 달성했거나 기억에 남는 운동 경험을 말해주세요.', 4),
  ('How have your exercise habits changed compared to when you were younger?', 'comparison', 4, '어렸을 때와 비교해서 운동 습관이 어떻게 바뀌었나요?', 5)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Exercise/Fitness';

-- 여행/휴가 (Travel/Vacation)
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Do you like to travel? What kind of places do you like to visit?', 'describe', 2, '여행을 좋아하나요? 어떤 곳을 방문하는 걸 좋아하나요?', 1),
  ('Tell me about the most memorable trip you have ever taken.', 'experience', 3, '가장 기억에 남는 여행에 대해 말해주세요.', 2),
  ('What do you usually do to prepare for a trip?', 'routine', 2, '여행 준비를 위해 보통 뭘 하나요?', 3),
  ('Have you ever had any problems during a trip? What happened?', 'experience', 4, '여행 중에 문제가 생긴 적 있나요? 무슨 일이 있었나요?', 4),
  ('How has traveling changed compared to the past?', 'comparison', 4, '여행이 예전과 비교해서 어떻게 바뀌었나요?', 5),
  ('I am planning to visit your country. Can you recommend some places to visit?', 'roleplay', 4, '당신 나라를 방문할 계획이에요. 방문할 곳을 추천해줄 수 있나요?', 6)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Travel/Vacation';

-- 전화통화 (Phone Calls)
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('How often do you make phone calls? Who do you usually call?', 'routine', 2, '얼마나 자주 전화하나요? 보통 누구에게 전화하나요?', 1),
  ('Tell me about a memorable phone conversation you had.', 'experience', 3, '기억에 남는 전화 통화에 대해 말해주세요.', 2),
  ('How has phone communication changed over the years?', 'comparison', 4, '전화 소통이 몇 년간 어떻게 바뀌었나요?', 3),
  ('You need to call a restaurant to make a reservation. Role-play the phone call.', 'roleplay', 4, '식당에 예약하려고 전화해야 해요. 전화 통화를 연기해주세요.', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Phone Calls';

-- 인터넷/SNS (Internet/SNS)
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('How do you use the internet in your daily life?', 'routine', 2, '일상에서 인터넷을 어떻게 사용하나요?', 1),
  ('What websites or apps do you use most often?', 'describe', 2, '가장 자주 사용하는 웹사이트나 앱은 뭔가요?', 2),
  ('Do you use social media? How do you use it?', 'routine', 2, 'SNS를 사용하나요? 어떻게 사용하나요?', 3),
  ('Tell me about an interesting experience you had online.', 'experience', 3, '온라인에서 있었던 재미있는 경험을 말해주세요.', 4),
  ('How has internet usage changed compared to when you first started using it?', 'comparison', 4, '처음 사용할 때와 비교해서 인터넷 사용이 어떻게 바뀌었나요?', 5)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Internet/SNS';
