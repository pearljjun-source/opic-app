-- ============================================================================
-- 071: 요가 토픽에 "기억에 남는 사건" experience 질문 추가
-- ============================================================================

INSERT INTO public.questions (topic_id, question_text, question_type, difficulty, hint_ko, sort_order)
SELECT t.id, q.question_text, q.question_type::question_type, q.difficulty, q.hint_ko, q.sort_order
FROM public.topics t,
(VALUES
  ('Tell me about a memorable experience you had while doing yoga. What happened and why was it so memorable?', 'experience', 3, '요가를 하다가 기억에 남는 경험을 말해주세요. 무슨 일이 있었고 왜 기억에 남나요?', 5)
) AS q(question_text, question_type, difficulty, hint_ko, sort_order)
WHERE t.name_en = 'Yoga';
