-- ============================================================================
-- 035_exam_seed_data.sql
-- 롤플레이 시나리오 10세트 (각 3문항) + 돌발 토픽/질문 확장
-- ============================================================================

-- ============================================================================
-- 1. 롤플레이 시나리오 10세트
-- ============================================================================

INSERT INTO public.roleplay_scenarios (title_ko, title_en, description_ko, scenario_context, difficulty, category, sort_order) VALUES

-- 1. 호텔 예약
('호텔 예약', 'Hotel Reservation',
  '호텔 객실 문의, 문제 해결, 숙소 관련 경험',
  'You are planning a trip and need to book a hotel room. Call the hotel and ask questions about available rooms, prices, and amenities.',
  3, 'hotel', 1),

-- 2. 레스토랑
('레스토랑', 'Restaurant',
  '예약/메뉴 문의, 음식/서비스 문제, 식당 경험',
  'You want to make a reservation at a popular restaurant. Call the restaurant and ask about their menu, availability, and special offers.',
  3, 'restaurant', 2),

-- 3. 가전/전자제품 매장
('전자제품 매장', 'Electronics Store',
  '제품 문의, 불량품 교환, 기기 구매 경험',
  'You are at an electronics store looking for a new laptop. Ask the sales associate about different models, features, and prices.',
  4, 'electronics', 3),

-- 4. 여행사
('여행사', 'Travel Agency',
  '여행 상품 문의, 일정 변경, 여행 경험',
  'You are visiting a travel agency to plan your vacation. Ask the travel agent about available packages, destinations, and travel dates.',
  4, 'travel', 4),

-- 5. 헬스장/체육관
('헬스장', 'Gym/Fitness Center',
  '회원권 문의, 시설 불만, 운동 경험',
  'You are interested in joining a gym. Call the fitness center and ask about membership options, facilities, and class schedules.',
  3, 'fitness', 5),

-- 6. 도서관
('도서관', 'Library',
  '서비스/이용 문의, 분실/연체 해결, 독서 경험',
  'You need to use the library for your studies. Call the library and ask about their services, hours, and membership requirements.',
  3, 'library', 6),

-- 7. 쇼핑몰/의류점
('의류 매장', 'Clothing Store',
  '제품 문의, 환불/교환, 쇼핑 경험',
  'You bought a piece of clothing online but it does not fit well. Visit the clothing store to discuss options for exchange or return.',
  3, 'shopping', 7),

-- 8. 공연/콘서트
('공연/콘서트', 'Concert/Performance',
  '티켓 문의, 좌석/일정 문제, 공연 관람 경험',
  'You want to buy tickets for a concert this weekend. Call the ticket office and ask about seat availability, prices, and showtimes.',
  4, 'entertainment', 8),

-- 9. 병원/클리닉
('병원', 'Hospital/Clinic',
  '예약/진료 문의, 예약 변경, 건강 관련 경험',
  'You need to schedule a doctor''s appointment. Call the clinic and ask about available times, required documents, and the doctor''s specialty.',
  4, 'health', 9),

-- 10. 이사/부동산
('부동산', 'Real Estate',
  '매물/서비스 문의, 이사 중 파손, 이사 경험',
  'You are looking for a new apartment. Call the real estate agency and ask about available properties, rent prices, and move-in dates.',
  4, 'housing', 10)

ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. 롤플레이 시나리오 문항 (시나리오당 3문항)
--    position 1: ask_questions (질문하기)
--    position 2: problem_solution (문제 해결)
--    position 3: related_experience (관련 경험)
-- ============================================================================

-- 호텔 예약
INSERT INTO public.roleplay_scenario_questions (scenario_id, position, question_text, roleplay_type, hint_ko)
SELECT s.id, q.position, q.question_text, q.roleplay_type, q.hint_ko
FROM public.roleplay_scenarios s,
(VALUES
  (1, 'I''d like to know about hotel rooms. Ask three or four questions about the hotel to find out what you need.', 'ask_questions', '호텔 객실에 대해 알고 싶습니다. 필요한 정보를 알아보기 위해 3-4가지 질문을 하세요.'),
  (2, 'I''m sorry, but there is a problem with your hotel room. The air conditioning is not working and the room has not been cleaned properly. Call the front desk and explain the situation, then suggest two or three solutions.', 'problem_solution', '호텔 방에 문제가 생겼습니다. 에어컨이 작동하지 않고 방 청소가 제대로 되지 않았습니다. 프론트에 전화해서 상황을 설명하고 2-3가지 해결 방안을 제안하세요.'),
  (3, 'Have you ever had a memorable experience while staying at a hotel or any other accommodation? Tell me about it in as much detail as possible.', 'related_experience', '호텔이나 숙소에서 기억에 남는 경험이 있나요? 가능한 자세히 말해주세요.')
) AS q(position, question_text, roleplay_type, hint_ko)
WHERE s.title_en = 'Hotel Reservation';

-- 레스토랑
INSERT INTO public.roleplay_scenario_questions (scenario_id, position, question_text, roleplay_type, hint_ko)
SELECT s.id, q.position, q.question_text, q.roleplay_type, q.hint_ko
FROM public.roleplay_scenarios s,
(VALUES
  (1, 'You want to have dinner at a restaurant. Call the restaurant and ask three or four questions to find out about their menu, prices, and reservations.', 'ask_questions', '레스토랑에서 저녁을 먹고 싶습니다. 메뉴, 가격, 예약에 대해 3-4가지 질문을 하세요.'),
  (2, 'You are at the restaurant and there is a problem with your order. The food is cold and the wrong dish was brought to your table. Explain the problem to the waiter and suggest how to resolve it.', 'problem_solution', '레스토랑에서 주문에 문제가 생겼습니다. 음식이 차갑고 잘못된 요리가 나왔습니다. 웨이터에게 문제를 설명하고 해결 방법을 제안하세요.'),
  (3, 'Tell me about a memorable experience you had at a restaurant. It could be a great meal, terrible service, or anything special that happened.', 'related_experience', '레스토랑에서 기억에 남는 경험을 말해주세요. 훌륭한 식사, 나쁜 서비스, 또는 특별한 일이 있었나요?')
) AS q(position, question_text, roleplay_type, hint_ko)
WHERE s.title_en = 'Restaurant';

-- 전자제품 매장
INSERT INTO public.roleplay_scenario_questions (scenario_id, position, question_text, roleplay_type, hint_ko)
SELECT s.id, q.position, q.question_text, q.roleplay_type, q.hint_ko
FROM public.roleplay_scenarios s,
(VALUES
  (1, 'You are at an electronics store looking for a new phone. Ask the sales associate three or four questions about the available phones, features, and prices.', 'ask_questions', '전자제품 매장에서 새 폰을 찾고 있습니다. 이용 가능한 폰, 기능, 가격에 대해 3-4가지 질문을 하세요.'),
  (2, 'You bought a laptop last week but it keeps shutting down unexpectedly. Go to the store and explain the problem. Ask for a replacement or repair.', 'problem_solution', '지난주에 노트북을 샀는데 갑자기 꺼지는 문제가 있습니다. 매장에 가서 문제를 설명하고 교환이나 수리를 요청하세요.'),
  (3, 'Tell me about a time when you bought an electronic device. What did you buy, and were you satisfied with it? Share the experience in detail.', 'related_experience', '전자 기기를 구입한 경험을 말해주세요. 무엇을 샀고, 만족했나요? 자세히 공유해주세요.')
) AS q(position, question_text, roleplay_type, hint_ko)
WHERE s.title_en = 'Electronics Store';

-- 여행사
INSERT INTO public.roleplay_scenario_questions (scenario_id, position, question_text, roleplay_type, hint_ko)
SELECT s.id, q.position, q.question_text, q.roleplay_type, q.hint_ko
FROM public.roleplay_scenarios s,
(VALUES
  (1, 'You are at a travel agency to plan your trip. Ask the travel agent three or four questions about destinations, prices, and travel packages.', 'ask_questions', '여행사에서 여행을 계획 중입니다. 목적지, 가격, 여행 패키지에 대해 3-4가지 질문을 하세요.'),
  (2, 'You booked a trip through the travel agency, but the flight was suddenly canceled and the hotel reservation was changed. Call the agency, explain what happened, and ask them to fix the problem.', 'problem_solution', '여행사를 통해 여행을 예약했는데 항공편이 취소되고 호텔 예약이 변경되었습니다. 여행사에 전화해서 상황을 설명하고 문제 해결을 요청하세요.'),
  (3, 'Tell me about a memorable trip you have taken. Where did you go, what did you do, and what made it special?', 'related_experience', '기억에 남는 여행 경험을 말해주세요. 어디에 갔고, 무엇을 했고, 무엇이 특별했나요?')
) AS q(position, question_text, roleplay_type, hint_ko)
WHERE s.title_en = 'Travel Agency';

-- 헬스장
INSERT INTO public.roleplay_scenario_questions (scenario_id, position, question_text, roleplay_type, hint_ko)
SELECT s.id, q.position, q.question_text, q.roleplay_type, q.hint_ko
FROM public.roleplay_scenarios s,
(VALUES
  (1, 'You are interested in joining a gym. Call the fitness center and ask three or four questions about membership plans, class schedules, and facilities.', 'ask_questions', '헬스장에 가입하려고 합니다. 회원권, 수업 일정, 시설에 대해 3-4가지 질문을 하세요.'),
  (2, 'You have been a member of the gym for a month, but the equipment is always occupied and the locker room is not clean. Talk to the manager and explain the problems. Suggest how they can improve.', 'problem_solution', '헬스장 회원이 된 지 한 달인데 기구가 항상 사용 중이고 라커룸이 깨끗하지 않습니다. 매니저에게 문제를 설명하고 개선 방법을 제안하세요.'),
  (3, 'Tell me about your experience with exercising or going to a gym. What kind of exercise do you do and how has it affected your life?', 'related_experience', '운동이나 헬스장 경험을 말해주세요. 어떤 운동을 하고, 생활에 어떤 영향을 미쳤나요?')
) AS q(position, question_text, roleplay_type, hint_ko)
WHERE s.title_en = 'Gym/Fitness Center';

-- 도서관
INSERT INTO public.roleplay_scenario_questions (scenario_id, position, question_text, roleplay_type, hint_ko)
SELECT s.id, q.position, q.question_text, q.roleplay_type, q.hint_ko
FROM public.roleplay_scenarios s,
(VALUES
  (1, 'You want to use the local library. Call the library and ask three or four questions about their services, borrowing policies, and operating hours.', 'ask_questions', '지역 도서관을 이용하고 싶습니다. 서비스, 대출 정책, 운영 시간에 대해 3-4가지 질문을 하세요.'),
  (2, 'You borrowed a book from the library but lost it. Also, you have overdue books with late fees. Visit the library and explain the situation. Ask what you can do to resolve these issues.', 'problem_solution', '도서관에서 빌린 책을 분실했습니다. 또한 연체된 책과 연체료가 있습니다. 도서관에 가서 상황을 설명하고 해결 방법을 물어보세요.'),
  (3, 'Do you enjoy reading? Tell me about a time when you went to a library or bookstore. What was the experience like?', 'related_experience', '독서를 좋아하나요? 도서관이나 서점에 갔던 경험을 말해주세요. 어떤 경험이었나요?')
) AS q(position, question_text, roleplay_type, hint_ko)
WHERE s.title_en = 'Library';

-- 의류 매장
INSERT INTO public.roleplay_scenario_questions (scenario_id, position, question_text, roleplay_type, hint_ko)
SELECT s.id, q.position, q.question_text, q.roleplay_type, q.hint_ko
FROM public.roleplay_scenarios s,
(VALUES
  (1, 'You are shopping for new clothes for a special occasion. Ask the store assistant three or four questions about their clothing selection, sizes, and return policy.', 'ask_questions', '특별한 행사를 위해 새 옷을 사려고 합니다. 매장 직원에게 옷 종류, 사이즈, 반품 정책에 대해 3-4가지 질문을 하세요.'),
  (2, 'You ordered clothes online but received the wrong size and color. Call the store to explain the problem and ask for an exchange or refund.', 'problem_solution', '온라인으로 옷을 주문했는데 사이즈와 색상이 잘못 왔습니다. 매장에 전화해서 문제를 설명하고 교환이나 환불을 요청하세요.'),
  (3, 'Tell me about a memorable shopping experience. It could be finding a great deal, buying something special, or any interesting story related to shopping.', 'related_experience', '기억에 남는 쇼핑 경험을 말해주세요. 좋은 할인, 특별한 물건 구매, 또는 쇼핑과 관련된 흥미로운 이야기가 있나요?')
) AS q(position, question_text, roleplay_type, hint_ko)
WHERE s.title_en = 'Clothing Store';

-- 공연/콘서트
INSERT INTO public.roleplay_scenario_questions (scenario_id, position, question_text, roleplay_type, hint_ko)
SELECT s.id, q.position, q.question_text, q.roleplay_type, q.hint_ko
FROM public.roleplay_scenarios s,
(VALUES
  (1, 'You want to see a performance this weekend. Call the ticket office and ask three or four questions about available shows, seat options, and ticket prices.', 'ask_questions', '이번 주말에 공연을 보고 싶습니다. 매표소에 전화해서 공연, 좌석, 티켓 가격에 대해 3-4가지 질문을 하세요.'),
  (2, 'You bought concert tickets but the show has been rescheduled to a date when you are busy. Also, your seats have been changed to worse ones. Call the ticket office and explain the situation. Ask for a solution.', 'problem_solution', '콘서트 티켓을 샀는데 공연 일정이 바쁜 날로 변경되었습니다. 또한 좌석이 더 나쁜 곳으로 바뀌었습니다. 매표소에 전화해서 상황을 설명하고 해결 방법을 요청하세요.'),
  (3, 'Have you been to a concert or any live performance? Tell me about your experience. What was the most memorable part?', 'related_experience', '콘서트나 공연에 가본 적 있나요? 경험을 말해주세요. 가장 기억에 남는 부분은 무엇인가요?')
) AS q(position, question_text, roleplay_type, hint_ko)
WHERE s.title_en = 'Concert/Performance';

-- 병원
INSERT INTO public.roleplay_scenario_questions (scenario_id, position, question_text, roleplay_type, hint_ko)
SELECT s.id, q.position, q.question_text, q.roleplay_type, q.hint_ko
FROM public.roleplay_scenarios s,
(VALUES
  (1, 'You need to see a doctor. Call the clinic and ask three or four questions about available appointment times, the doctor''s specialty, and what to bring.', 'ask_questions', '의사를 만나야 합니다. 병원에 전화해서 예약 가능 시간, 전문 분야, 준비물에 대해 3-4가지 질문을 하세요.'),
  (2, 'You had a doctor''s appointment scheduled for today, but when you arrived, the receptionist said your appointment was canceled without notice. Explain the situation and ask them to reschedule as soon as possible.', 'problem_solution', '오늘 병원 예약이 있었는데 도착하니 사전 통보 없이 취소되었다고 합니다. 상황을 설명하고 가능한 빨리 재예약을 요청하세요.'),
  (3, 'Tell me about a time when you or someone you know went to the hospital or clinic. What happened and how was the experience?', 'related_experience', '본인이나 아는 사람이 병원에 간 경험을 말해주세요. 무슨 일이 있었고 경험은 어땠나요?')
) AS q(position, question_text, roleplay_type, hint_ko)
WHERE s.title_en = 'Hospital/Clinic';

-- 부동산
INSERT INTO public.roleplay_scenario_questions (scenario_id, position, question_text, roleplay_type, hint_ko)
SELECT s.id, q.position, q.question_text, q.roleplay_type, q.hint_ko
FROM public.roleplay_scenarios s,
(VALUES
  (1, 'You are looking for a new place to live. Call the real estate agency and ask three or four questions about available apartments, rent, and the neighborhood.', 'ask_questions', '새로운 살 곳을 찾고 있습니다. 부동산에 전화해서 아파트, 월세, 동네에 대해 3-4가지 질문을 하세요.'),
  (2, 'You recently moved into a new apartment, but some of your furniture was damaged during the move. Also, the apartment has some issues the landlord did not mention before. Call the landlord and explain the problems. Ask for compensation or repairs.', 'problem_solution', '새 아파트로 이사했는데 이삿짐 운송 중 가구가 파손되었습니다. 또한 집주인이 사전에 말하지 않은 문제들이 있습니다. 집주인에게 전화해서 문제를 설명하고 보상이나 수리를 요청하세요.'),
  (3, 'Tell me about your experience of moving to a new place. What was it like? Were there any challenges or interesting things that happened during the move?', 'related_experience', '이사 경험을 말해주세요. 어땠나요? 이사 중 어려움이나 흥미로운 일이 있었나요?')
) AS q(position, question_text, roleplay_type, hint_ko)
WHERE s.title_en = 'Real Estate';

-- ============================================================================
-- 3. 돌발 토픽 추가 (unexpected category)
-- ============================================================================

INSERT INTO public.topics (name_ko, name_en, icon, description, sort_order, category) VALUES
  ('재활용', 'Recycling', '♻️', '재활용 습관, 환경 보호, 분리수거에 대한 돌발 토픽', 31, 'unexpected'),
  ('날씨/계절', 'Weather/Seasons', '🌤️', '좋아하는 계절, 날씨 변화, 계절별 활동에 대한 돌발 토픽', 32, 'unexpected'),
  ('명절/기념일', 'Holidays', '🎉', '명절 풍습, 기념일 활동, 특별한 날에 대한 돌발 토픽', 33, 'unexpected'),
  ('패션/의류', 'Fashion/Clothing', '👔', '옷 스타일, 패션 트렌드, 의류 쇼핑에 대한 돌발 토픽', 34, 'unexpected'),
  ('기술/가전', 'Technology', '📲', '기술 변화, 가전제품, 디지털 기기에 대한 돌발 토픽', 35, 'unexpected')
ON CONFLICT (name_en) DO NOTHING;

-- ============================================================================
-- 4. 돌발 토픽 질문 추가
-- ============================================================================

-- 재활용
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about recycling in your country. How do people usually recycle?', 'describe', 3, '당신 나라의 재활용에 대해 말해주세요. 사람들은 보통 어떻게 재활용하나요?', 1),
  ('What is your recycling routine? Describe what you do step by step.', 'routine', 3, '재활용 루틴은 어떤가요? 단계별로 설명해주세요.', 2),
  ('Has recycling changed over the years in your country? How was it different in the past?', 'comparison', 4, '당신 나라에서 재활용이 변해왔나요? 과거에는 어떻게 달랐나요?', 3),
  ('Tell me about a time when you had a problem related to recycling or waste disposal. What happened?', 'experience', 4, '재활용이나 쓰레기 처리와 관련된 문제가 있었던 적이 있나요? 무슨 일이 있었나요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Recycling';

-- 날씨/계절
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('What is the weather like in your country? Describe the different seasons.', 'describe', 3, '당신 나라의 날씨는 어떤가요? 다양한 계절을 설명해주세요.', 1),
  ('What do you usually do when the weather is nice? Tell me about your typical outdoor activities.', 'routine', 3, '날씨가 좋을 때 보통 뭘 하나요? 야외 활동에 대해 말해주세요.', 2),
  ('How has the weather changed compared to when you were younger? Do you notice any differences?', 'comparison', 4, '어렸을 때와 비교해서 날씨가 어떻게 변했나요? 차이를 느끼나요?', 3),
  ('Tell me about a time when bad weather affected your plans. What happened and how did you deal with it?', 'experience', 4, '나쁜 날씨가 계획에 영향을 미친 적이 있나요? 무슨 일이 있었고 어떻게 대처했나요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Weather/Seasons';

-- 명절/기념일
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('What holidays do you celebrate in your country? Describe a major holiday and how people celebrate it.', 'describe', 3, '당신 나라에서 어떤 명절을 기념하나요? 주요 명절과 기념 방법을 설명해주세요.', 1),
  ('What do you usually do during the holidays? Describe your typical holiday routine.', 'routine', 3, '명절에 보통 뭘 하나요? 명절 루틴을 설명해주세요.', 2),
  ('How have holiday celebrations changed compared to the past? What is different now?', 'comparison', 4, '과거와 비교해서 명절 기념 방식이 어떻게 바뀌었나요? 지금은 뭐가 다른가요?', 3),
  ('Tell me about a memorable holiday or celebration you experienced. What made it special?', 'experience', 4, '기억에 남는 명절이나 기념일 경험을 말해주세요. 뭐가 특별했나요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Holidays';

-- 패션/의류
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('What kind of clothes do you usually wear? Describe your typical style.', 'describe', 3, '보통 어떤 옷을 입나요? 본인의 스타일을 설명해주세요.', 1),
  ('What is your routine when you go shopping for clothes? How do you decide what to buy?', 'routine', 3, '옷 쇼핑을 할 때 루틴은 어떤가요? 뭘 살지 어떻게 결정하나요?', 2),
  ('How has fashion changed in your country compared to the past? What do people wear differently now?', 'comparison', 4, '과거와 비교해서 패션이 어떻게 변했나요? 사람들이 다르게 입는 건 뭔가요?', 3),
  ('Tell me about a time when you bought something you really loved or regretted. What happened?', 'experience', 4, '정말 좋았거나 후회한 옷을 산 경험을 말해주세요. 무슨 일이 있었나요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Fashion/Clothing';

-- 기술/가전
INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('What kinds of technology or electronic devices do you use daily? Describe them.', 'describe', 3, '매일 사용하는 기술이나 전자 기기는 뭔가요? 설명해주세요.', 1),
  ('Tell me about your daily routine with technology. How do you use your phone, computer, or other devices throughout the day?', 'routine', 3, '기술과 관련된 일상 루틴을 말해주세요. 하루 동안 폰, 컴퓨터, 기기를 어떻게 사용하나요?', 2),
  ('How has technology changed compared to when you were younger? What are the biggest differences?', 'comparison', 4, '어렸을 때와 비교해서 기술이 어떻게 변했나요? 가장 큰 차이는 뭔가요?', 3),
  ('Tell me about a time when technology caused a problem for you. What happened and how did you resolve it?', 'experience', 4, '기술이 문제를 일으킨 적이 있나요? 무슨 일이 있었고 어떻게 해결했나요?', 4)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Technology';
