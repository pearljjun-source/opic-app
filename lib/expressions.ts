// ============================================================================
// OPIc 핵심 표현 라이브러리 — 기본 시드 데이터
// 실제 OPIc 학습 자료 기반 + 체계적 정리
// DB에 저장된 데이터가 있으면 DB 우선, 없으면 이 기본 데이터 사용
// ============================================================================

export interface Expression {
  id: string;
  en: string;
  ko: string;
  example: string;
  tip?: string;
  level?: 'basic' | 'intermediate' | 'advanced';
}

export interface ExpressionCategory {
  id?: string;
  key: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  expressions: Expression[];
}

export const EXPRESSION_CATEGORIES: ExpressionCategory[] = [
  // ========================================================================
  // 1. 도입 표현 (Opening)
  // ========================================================================
  {
    key: 'opening',
    label: '도입 표현',
    icon: 'flag-outline',
    color: '#6366F1',
    description: '답변을 자연스럽게 시작하는 표현',
    expressions: [
      { id: 'op01', en: "Well, when it comes to...", ko: '음, ~에 관해서 말하자면', example: "Well, when it comes to cooking, I'm not very experienced but I enjoy it.", level: 'basic' },
      { id: 'op02', en: "Sure, I'd be happy to tell you about...", ko: '네, 기꺼이 ~에 대해 말씀드리겠습니다', example: "Sure, I'd be happy to tell you about my favorite restaurant.", level: 'basic' },
      { id: 'op03', en: "That's a great question. Let me think...", ko: '좋은 질문이네요. 생각해볼게요...', example: "That's a great question. Let me think... I'd say my neighborhood is pretty quiet.", tip: '생각할 시간을 자연스럽게 벌 수 있는 표현', level: 'basic' },
      { id: 'op04', en: "Oh, I have the perfect story for this.", ko: '아, 이것에 딱 맞는 이야기가 있어요', example: "Oh, I have the perfect story for this. Last summer, I went on an amazing trip.", tip: '경험 문제에서 강한 도입으로 사용', level: 'intermediate' },
      { id: 'op05', en: "Let me give it to you straight.", ko: '단도직입적으로 말씀드릴게요', example: "Let me give it to you straight. I absolutely love my job.", tip: '자신감 있는 도입. AL급 표현', level: 'advanced' },
      { id: 'op06', en: "Get ready for this.", ko: '(재미있는 이야기) 준비하세요', example: "Get ready for this. What happened to me last weekend was unbelievable.", tip: '흥미를 끄는 도입. 감정 표현과 함께 사용', level: 'advanced' },
      { id: 'op07', en: "To be honest with you...", ko: '솔직히 말씀드리자면', example: "To be honest with you, I don't have much experience with that, but I'll try my best.", level: 'basic' },
      { id: 'op08', en: "If I had to pick one thing...", ko: '하나를 꼽아야 한다면', example: "If I had to pick one thing I love about my city, it would be the food.", level: 'intermediate' },
      { id: 'op09', en: "I'll tell you this —", ko: '이것만 말씀드릴게요 —', example: "I'll tell you this — there's no place like home.", level: 'advanced' },
      { id: 'op10', en: "You know what? I actually...", ko: '그거 아세요? 사실 저는...', example: "You know what? I actually started doing yoga last month, and I love it.", level: 'intermediate' },
    ],
  },

  // ========================================================================
  // 2. 묘사/설명 (Description)
  // ========================================================================
  {
    key: 'describe',
    label: '묘사/설명',
    icon: 'image-outline',
    color: '#10B981',
    description: '장소, 사물, 사람을 생생하게 묘사하는 표현',
    expressions: [
      { id: 'ds01', en: "It's located right in the heart of...", ko: '~의 한가운데에 위치해 있어요', example: "It's located right in the heart of downtown, so it's very convenient.", level: 'basic' },
      { id: 'ds02', en: "The first thing you notice is...", ko: '가장 먼저 눈에 띄는 것은', example: "The first thing you notice is the huge glass windows that let in tons of natural light.", level: 'intermediate' },
      { id: 'ds03', en: "What I like most about it is...", ko: '제가 가장 좋아하는 점은', example: "What I like most about it is the cozy atmosphere. It feels like home.", level: 'basic' },
      { id: 'ds04', en: "It has a really cozy/spacious vibe.", ko: '정말 아늑한/넓은 분위기예요', example: "It has a really spacious vibe with high ceilings and modern furniture.", tip: 'cozy(아늑한), spacious(넓은), peaceful(평온한), chaotic(정신없는) 등 분위기 형용사 활용', level: 'intermediate' },
      { id: 'ds05', en: "One thing that really stands out is...", ko: '정말 눈에 띄는 한 가지는', example: "One thing that really stands out is the incredible view from the rooftop.", level: 'intermediate' },
      { id: 'ds06', en: "It's surrounded by...", ko: '~로 둘러싸여 있어요', example: "It's surrounded by tall trees and a beautiful walking trail.", level: 'basic' },
      { id: 'ds07', en: "It's one of those places where you can just...", ko: '그냥 ~할 수 있는 그런 곳이에요', example: "It's one of those places where you can just sit back and enjoy the sunset.", level: 'advanced' },
      { id: 'ds08', en: "The whole place is decked out with...", ko: '장소 전체가 ~로 꾸며져 있어요', example: "The whole place is decked out with vintage decorations and warm lighting.", tip: 'decked out = 화려하게 꾸며진. AL급 구어체 표현', level: 'advanced' },
      { id: 'ds09', en: "You can see... everywhere you look.", ko: '어디를 봐도 ~를 볼 수 있어요', example: "You can see cherry blossom trees everywhere you look during spring.", level: 'basic' },
      { id: 'ds10', en: "It's nothing fancy, but...", ko: '화려하진 않지만...', example: "It's nothing fancy, but it has everything I need, and I feel comfortable there.", level: 'intermediate' },
    ],
  },

  // ========================================================================
  // 3. 루틴/습관 (Routine)
  // ========================================================================
  {
    key: 'routine',
    label: '루틴/습관',
    icon: 'repeat-outline',
    color: '#F59E0B',
    description: '일상, 루틴, 반복 행동을 말하는 표현',
    expressions: [
      { id: 'rt01', en: "The first thing I do is...", ko: '가장 먼저 하는 것은', example: "The first thing I do when I wake up is check my phone and drink a glass of water.", level: 'basic' },
      { id: 'rt02', en: "I usually start by ~ing...", ko: '보통 ~하는 것으로 시작해요', example: "I usually start by stretching for about 10 minutes before I do anything else.", level: 'basic' },
      { id: 'rt03', en: "After that, I...", ko: '그다음에 저는', example: "After that, I grab a quick breakfast — usually just toast and coffee.", level: 'basic' },
      { id: 'rt04', en: "Once I'm done with that, I...", ko: '그게 끝나면 저는', example: "Once I'm done with that, I head to the gym, which is about a 10-minute walk.", level: 'intermediate' },
      { id: 'rt05', en: "I tend to... most of the time.", ko: '대부분 ~하는 편이에요', example: "I tend to eat out most of the time because I'm too lazy to cook.", level: 'intermediate' },
      { id: 'rt06', en: "I make it a point to...", ko: '꼭 ~하려고 해요', example: "I make it a point to read for at least 30 minutes before bed every night.", tip: '강한 습관/의지를 표현. IH+ 표현', level: 'intermediate' },
      { id: 'rt07', en: "On a typical day, I...", ko: '평범한 날에는 저는', example: "On a typical day, I wake up around 7, have breakfast, and head to work by 8:30.", level: 'basic' },
      { id: 'rt08', en: "I try to... whenever I get the chance.", ko: '기회가 될 때마다 ~하려고 해요', example: "I try to work out whenever I get the chance, even if it's just a short jog.", level: 'intermediate' },
      { id: 'rt09', en: "Every now and then, I...", ko: '가끔씩 저는', example: "Every now and then, I treat myself to a nice dinner at a fancy restaurant.", level: 'intermediate' },
      { id: 'rt10', en: "It's kind of become a habit for me to...", ko: '~하는 게 습관이 되었어요', example: "It's kind of become a habit for me to listen to podcasts during my commute.", level: 'advanced' },
    ],
  },

  // ========================================================================
  // 4. 과거 경험 (Past Experience)
  // ========================================================================
  {
    key: 'experience',
    label: '과거 경험',
    icon: 'time-outline',
    color: '#EF4444',
    description: '기억에 남는 경험, 에피소드를 이야기하는 표현',
    expressions: [
      { id: 'ex01', en: "I remember one time when...", ko: '한번은 ~했던 때가 기억나요', example: "I remember one time when I got completely lost in Tokyo. It was actually pretty fun.", level: 'basic' },
      { id: 'ex02', en: "There was this one time...", ko: '이런 적이 한 번 있었는데', example: "There was this one time my friends and I decided to go on a spontaneous road trip.", level: 'intermediate' },
      { id: 'ex03', en: "A few years ago, I...", ko: '몇 년 전에 저는', example: "A few years ago, I took up photography as a hobby, and I've been hooked ever since.", level: 'basic' },
      { id: 'ex04', en: "What happened was...", ko: '무슨 일이 있었냐면', example: "What happened was, I accidentally booked the wrong hotel, so we had to find a new one.", level: 'intermediate' },
      { id: 'ex05', en: "It turned out that...", ko: '알고 보니 ~였어요', example: "It turned out that the restaurant was closed for renovation, so we had to find another place.", tip: '예상 밖의 결과를 말할 때. 스토리에 재미를 더해줌', level: 'intermediate' },
      { id: 'ex06', en: "I ended up ~ing.", ko: '결국 ~하게 되었어요', example: "I ended up staying at my friend's place for three days. It was actually a blast.", level: 'intermediate' },
      { id: 'ex07', en: "Oh no, I totally forgot!", ko: '아, 완전히 깜빡했어요!', example: "Oh no, I totally forgot about the meeting! I had to rush there.", tip: '감정 표현을 넣으면 자연스러움이 올라감', level: 'basic' },
      { id: 'ex08', en: "Looking back, I think...", ko: '돌이켜보면, ~라고 생각해요', example: "Looking back, I think that trip really changed my perspective on life.", level: 'intermediate' },
      { id: 'ex09', en: "That experience taught me that...", ko: '그 경험이 ~라는 것을 가르쳐 줬어요', example: "That experience taught me that you should always have a backup plan.", level: 'intermediate' },
      { id: 'ex10', en: "Ever since then, I've been...", ko: '그 이후로 쭉 ~해왔어요', example: "Ever since then, I've been more careful about double-checking my reservations.", tip: '현재완료 시제로 과거→현재 연결. 고득점 핵심', level: 'advanced' },
      { id: 'ex11', en: "I was so... that I couldn't even...", ko: '너무 ~해서 ~조차 못했어요', example: "I was so nervous that I couldn't even remember what I wanted to say.", level: 'advanced' },
    ],
  },

  // ========================================================================
  // 5. 비교 표현 (Comparison)
  // ========================================================================
  {
    key: 'comparison',
    label: '비교 표현',
    icon: 'swap-horizontal-outline',
    color: '#8B5CF6',
    description: '과거와 현재, 두 가지를 비교하는 표현',
    expressions: [
      { id: 'cp01', en: "Compared to the past, now...", ko: '과거와 비교하면, 지금은', example: "Compared to the past, now people rely on smartphones for almost everything.", level: 'basic' },
      { id: 'cp02', en: "Things have changed a lot since...", ko: '~이후로 많이 변했어요', example: "Things have changed a lot since I was in college. Technology is completely different.", level: 'basic' },
      { id: 'cp03', en: "Back in the day, people used to...", ko: '예전에는 사람들이 ~하곤 했어요', example: "Back in the day, people used to write letters, but now everyone just texts.", level: 'intermediate' },
      { id: 'cp04', en: "One major difference is that...", ko: '큰 차이점 하나는 ~이에요', example: "One major difference is that now you can order food with just a few taps on your phone.", level: 'intermediate' },
      { id: 'cp05', en: "While..., on the other hand...", ko: '~하는 반면에, 다른 한편으로는', example: "While my parents prefer shopping at traditional markets, I, on the other hand, prefer online shopping.", level: 'intermediate' },
      { id: 'cp06', en: "It's not as... as it used to be.", ko: '예전만큼 ~하지 않아요', example: "It's not as popular as it used to be, but some people still enjoy it.", level: 'intermediate' },
      { id: 'cp07', en: "The biggest change I've noticed is...", ko: '제가 느낀 가장 큰 변화는', example: "The biggest change I've noticed is how much faster everything has become with the internet.", level: 'intermediate' },
      { id: 'cp08', en: "These days... whereas before...", ko: '요즘에는 ~하지만, 이전에는', example: "These days, I prefer staying in, whereas before I used to go out every weekend.", level: 'advanced' },
      { id: 'cp09', en: "It's a completely different story now.", ko: '지금은 완전히 달라요', example: "I used to hate exercise, but it's a completely different story now. I work out every day.", tip: '극적인 변화를 강조할 때. 스토리텔링에 효과적', level: 'advanced' },
    ],
  },

  // ========================================================================
  // 6. 롤플레이 (Role-play)
  // ========================================================================
  {
    key: 'roleplay',
    label: '롤플레이',
    icon: 'chatbubbles-outline',
    color: '#EC4899',
    description: '전화 문의, 질문하기, 문제 해결, 요청 표현',
    expressions: [
      // 질문하기 (Ask Questions)
      { id: 'rp01', en: "Hi, I'm calling to ask about...", ko: '안녕하세요, ~에 대해 문의하려고 전화했습니다', example: "Hi, I'm calling to ask about your membership options and pricing.", level: 'basic' },
      { id: 'rp02', en: "I was wondering if you could tell me...", ko: '혹시 ~를 알려주실 수 있을까요', example: "I was wondering if you could tell me your business hours and location.", tip: '가장 공손한 질문 형태. 필수 암기 표현', level: 'basic' },
      { id: 'rp03', en: "What are your operating hours?", ko: '영업시간이 어떻게 되나요?', example: "What are your operating hours? And do you open on weekends?", tip: '어떤 장소 문의에도 쓸 수 있는 만능 질문', level: 'basic' },
      { id: 'rp04', en: "Do I need a reservation, or can I walk in?", ko: '예약이 필요한가요, 아니면 바로 가도 되나요?', example: "Do I need a reservation, or can I just walk in?", level: 'basic' },
      { id: 'rp05', en: "How much is it gonna cost me?", ko: '비용이 얼마나 드나요?', example: "How much is it gonna cost me for a monthly membership?", level: 'intermediate' },
      // 문제 해결 (Problem Solving)
      { id: 'rp06', en: "I'm afraid there's been a problem with...", ko: '죄송하지만 ~에 문제가 있는 것 같습니다', example: "I'm afraid there's been a problem with my order. I received the wrong item.", level: 'intermediate' },
      { id: 'rp07', en: "I bought it last week, but it's not working properly.", ko: '지난주에 샀는데 제대로 작동하지 않아요', example: "I bought it last week, but it's not working properly. The screen keeps flickering.", level: 'intermediate' },
      { id: 'rp08', en: "I'd like to request an exchange or refund.", ko: '교환이나 환불을 요청하고 싶습니다', example: "I'd like to request an exchange or a full refund if possible.", level: 'basic' },
      { id: 'rp09', en: "Is there any way you could...?", ko: '혹시 ~할 수 있는 방법이 있을까요?', example: "Is there any way you could reschedule my appointment to next Friday?", level: 'intermediate' },
      // 일정 변경/취소
      { id: 'rp10', en: "I'm sorry for the sudden change, but something came up.", ko: '갑자기 변경해서 죄송하지만, 일이 생겼어요', example: "I'm sorry for the sudden change, but something came up. I had a family emergency.", tip: '구체적 사유를 함께 말하면 더 자연스러움', level: 'intermediate' },
      { id: 'rp11', en: "Can I reschedule it to another time?", ko: '다른 시간으로 변경할 수 있을까요?', example: "Can I reschedule it to another time? Maybe next Tuesday would work.", level: 'basic' },
      // 감사/마무리
      { id: 'rp12', en: "I'd really appreciate your help. I owe you one!", ko: '도움 정말 감사해요. 신세 졌어요!', example: "I'd really appreciate your help. I owe you one! Let me buy you lunch sometime.", level: 'intermediate' },
    ],
  },

  // ========================================================================
  // 7. 연결/전환 (Transitions)
  // ========================================================================
  {
    key: 'transition',
    label: '연결/전환',
    icon: 'git-merge-outline',
    color: '#0EA5E9',
    description: '문장을 자연스럽게 연결하고 내용을 확장하는 표현',
    expressions: [
      { id: 'tr01', en: "Speaking of which...", ko: '그것과 관련해서 말하자면', example: "Speaking of which, I also wanted to mention that the food there is phenomenal.", level: 'intermediate' },
      { id: 'tr02', en: "Another thing I should mention is...", ko: '또 언급할 것은', example: "Another thing I should mention is that the location is super convenient.", level: 'basic' },
      { id: 'tr03', en: "On top of that...", ko: '게다가', example: "On top of that, they offer free parking for all members.", level: 'basic' },
      { id: 'tr04', en: "Not only that, but...", ko: '그뿐만 아니라', example: "Not only that, but they also have a kids' play area, which is great for families.", level: 'intermediate' },
      { id: 'tr05', en: "The reason I say this is because...", ko: '제가 이렇게 말하는 이유는', example: "The reason I say this is because I've been going there for over five years.", tip: '이유를 설명하며 답변에 깊이를 더함. IH+ 표현', level: 'intermediate' },
      { id: 'tr06', en: "Come to think of it...", ko: '생각해보니', example: "Come to think of it, I actually visited that place just last month.", level: 'advanced' },
      { id: 'tr07', en: "What I mean by that is...", ko: '제가 의미하는 바는', example: "What I mean by that is, it's not just a gym — it's more like a community.", level: 'advanced' },
      { id: 'tr08', en: "More importantly...", ko: '더 중요한 것은', example: "More importantly, the staff there are incredibly friendly and helpful.", level: 'intermediate' },
      { id: 'tr09', en: "And the best part is...", ko: '그리고 가장 좋은 점은', example: "And the best part is, it's only a 5-minute walk from my apartment.", level: 'basic' },
    ],
  },

  // ========================================================================
  // 8. 필러/시간벌기 (Fillers)
  // ========================================================================
  {
    key: 'filler',
    label: '필러/시간벌기',
    icon: 'chatbox-ellipses-outline',
    color: '#F97316',
    description: '생각할 시간을 벌고 대화를 자연스럽게 만드는 표현',
    expressions: [
      { id: 'fl01', en: "Well...", ko: '음...', example: "Well... I think the biggest advantage is the convenience.", tip: '가장 기본적인 필러. 모든 답변 시작에 사용 가능', level: 'basic' },
      { id: 'fl02', en: "You know...", ko: '알다시피, 있잖아요', example: "It was, you know, one of those unforgettable moments.", level: 'basic' },
      { id: 'fl03', en: "I mean...", ko: '제 말은, 즉', example: "I mean, it's not perfect, but it's definitely worth trying.", level: 'basic' },
      { id: 'fl04', en: "Actually...", ko: '사실은', example: "Actually, I didn't expect it to be that good, but I was pleasantly surprised.", level: 'basic' },
      { id: 'fl05', en: "Let's see...", ko: '어디 보자...', example: "Let's see... I think I go there about twice a month.", level: 'basic' },
      { id: 'fl06', en: "Kind of / Sort of", ko: '좀, 어느 정도', example: "It was kind of difficult at first, but I got the hang of it.", tip: '표현을 부드럽게 만드는 완충 표현', level: 'basic' },
      { id: 'fl07', en: "Basically...", ko: '기본적으로', example: "Basically, my daily routine revolves around work and exercise.", level: 'basic' },
      { id: 'fl08', en: "You see...", ko: '그러니까요, 보다시피', example: "You see, that's exactly why I prefer online shopping.", level: 'intermediate' },
      { id: 'fl09', en: "How should I put it...", ko: '어떻게 말해야 할까...', example: "How should I put it... it was like a dream come true.", level: 'advanced' },
      { id: 'fl10', en: "I know, right?", ko: '그렇지 않나요?', example: "The view was amazing. I know, right? I couldn't believe it either.", tip: '공감을 유도하는 표현. 독백에서도 자연스럽게 사용', level: 'intermediate' },
    ],
  },

  // ========================================================================
  // 9. 감정/강조 표현 (Emotions & Emphasis)
  // ========================================================================
  {
    key: 'emotion',
    label: '감정/강조',
    icon: 'heart-outline',
    color: '#E11D48',
    description: '감정을 표현하여 답변에 생동감을 더하는 표현',
    expressions: [
      // 긍정
      { id: 'em01', en: "It was absolutely amazing/fantastic!", ko: '정말 놀랍고 환상적이었어요!', example: "The concert was absolutely fantastic! I had the time of my life.", tip: 'amazing, fantastic, fabulous, incredible, marvelous, outstanding 등 다양하게 활용', level: 'basic' },
      { id: 'em02', en: "I was blown away by...", ko: '~에 완전히 감동받았어요', example: "I was blown away by the scenery. It was breathtaking.", level: 'advanced' },
      { id: 'em03', en: "I had the time of my life.", ko: '인생 최고의 시간이었어요', example: "We went to Jeju Island and I had the time of my life.", level: 'intermediate' },
      { id: 'em04', en: "I was so excited that...", ko: '너무 신나서 ~했어요', example: "I was so excited that I couldn't sleep the night before.", level: 'basic' },
      { id: 'em05', en: "It totally made my day.", ko: '그것 덕분에 하루가 완전히 좋아졌어요', example: "A stranger complimented my outfit, and it totally made my day.", level: 'intermediate' },
      // 부정
      { id: 'em06', en: "That was so frustrating.", ko: '정말 답답했어요/짜증났어요', example: "The traffic was terrible and I was late. That was so frustrating.", level: 'basic' },
      { id: 'em07', en: "I was pretty disappointed because...", ko: '꽤 실망했어요, 왜냐하면', example: "I was pretty disappointed because the movie didn't live up to my expectations.", level: 'intermediate' },
      { id: 'em08', en: "It was a total disaster.", ko: '완전히 엉망이었어요', example: "My first cooking attempt? It was a total disaster. I burned everything.", tip: '유머러스한 자기 비하로 자연스러움 UP', level: 'advanced' },
      { id: 'em09', en: "I freaked out when...", ko: '~했을 때 완전 놀랐어요/당황했어요', example: "I freaked out when I realized I left my wallet at the restaurant.", level: 'intermediate' },
      { id: 'em10', en: "But my goodness, it was worth it.", ko: '하지만 정말로, 그만한 가치가 있었어요', example: "The hike was exhausting, but my goodness, the view from the top was worth it.", level: 'advanced' },
    ],
  },

  // ========================================================================
  // 10. 마무리 표현 (Closing)
  // ========================================================================
  {
    key: 'closing',
    label: '마무리 표현',
    icon: 'checkmark-done-outline',
    color: '#14B8A6',
    description: '답변을 깔끔하게 마무리하는 표현',
    expressions: [
      { id: 'cl01', en: "So, that's basically what my... is like.", ko: '그래서 기본적으로 제 ~은 그런 거예요', example: "So, that's basically what my typical weekend is like.", level: 'basic' },
      { id: 'cl02', en: "All in all, I'd say...", ko: '종합하면, ~라고 말씀드리겠습니다', example: "All in all, I'd say it was one of the most memorable trips I've ever taken.", level: 'intermediate' },
      { id: 'cl03', en: "That's pretty much it.", ko: '대략 그 정도입니다', example: "That's pretty much it. I hope that gives you a good picture of my neighborhood.", level: 'basic' },
      { id: 'cl04', en: "Overall, I'm really happy with...", ko: '전반적으로, ~에 정말 만족해요', example: "Overall, I'm really happy with where I live. It's a great area.", level: 'basic' },
      { id: 'cl05', en: "So yeah, that's my take on it.", ko: '네, 그게 그것에 대한 제 생각이에요', example: "So yeah, that's my take on it. I think technology has definitely improved our lives.", tip: '자연스러운 구어체 마무리. AL급', level: 'advanced' },
      { id: 'cl06', en: "That's the bottom line.", ko: '그게 핵심이에요', example: "I love my job because of the people. That's the bottom line.", level: 'advanced' },
      { id: 'cl07', en: "I would definitely recommend it to anyone.", ko: '누구에게나 꼭 추천하고 싶어요', example: "The restaurant is amazing. I would definitely recommend it to anyone who loves Italian food.", level: 'intermediate' },
      { id: 'cl08', en: "If I get the chance, I'd love to... again.", ko: '기회가 되면, 다시 ~하고 싶어요', example: "If I get the chance, I'd love to visit Japan again. It was incredible.", level: 'intermediate' },
    ],
  },

  // ========================================================================
  // 11. 고급 수식어 (Advanced Modifiers) — IH→AL 등급 핵심
  // ========================================================================
  {
    key: 'modifier',
    label: '고급 수식어',
    icon: 'sparkles-outline',
    color: '#7C3AED',
    description: 'IH→AL 달성을 위한 형용사/부사 활용법',
    expressions: [
      { id: 'md01', en: "incredibly / unbelievably", ko: '믿을 수 없을 만큼', example: "The food there is incredibly delicious. You have to try it.", tip: 'very 대신 사용하면 표현이 풍부해짐', level: 'intermediate' },
      { id: 'md02', en: "absolutely / totally / completely", ko: '완전히, 전적으로', example: "I absolutely loved the movie. It was totally worth watching.", level: 'basic' },
      { id: 'md03', en: "relatively / fairly / pretty", ko: '비교적, 꽤', example: "The commute is relatively short — only about 20 minutes by subway.", level: 'intermediate' },
      { id: 'md04', en: "spontaneous / impromptu", ko: '즉흥적인', example: "It was a spontaneous decision to go camping, and it turned out to be amazing.", level: 'advanced' },
      { id: 'md05', en: "breathtaking / stunning", ko: '숨막히게 아름다운', example: "The sunset was absolutely breathtaking. I've never seen anything like it.", level: 'advanced' },
      { id: 'md06', en: "hands down", ko: '확실히, 단연코', example: "That was hands down the best meal I've ever had.", tip: '최상급을 강조하는 구어체 표현', level: 'advanced' },
      { id: 'md07', en: "right off the bat", ko: '바로, 즉시', example: "Right off the bat, I could tell this place was special.", level: 'advanced' },
      { id: 'md08', en: "out of the blue", ko: '갑자기, 예상치 못하게', example: "Out of the blue, my friend called me and invited me to a party.", level: 'intermediate' },
      { id: 'md09', en: "once in a lifetime", ko: '일생에 한 번뿐인', example: "It was a once-in-a-lifetime experience. I'll never forget it.", level: 'intermediate' },
      { id: 'md10', en: "top-notch / first-rate", ko: '최고 수준의', example: "The service at that hotel was absolutely top-notch.", level: 'advanced' },
    ],
  },
];

/** 전체 표현 수 */
export const TOTAL_EXPRESSION_COUNT = EXPRESSION_CATEGORIES.reduce(
  (sum, cat) => sum + cat.expressions.length, 0
);
