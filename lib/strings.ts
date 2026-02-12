// ============================================================================
// OPIc 학습 앱 - UI 문자열 (한국어)
// ============================================================================

export const STRINGS = {
  // ============================================================================
  // 공통
  // ============================================================================
  common: {
    appName: 'Speaky',
    loading: '로딩 중...',
    error: '오류가 발생했습니다',
    retry: '다시 시도',
    cancel: '취소',
    confirm: '확인',
    save: '저장',
    delete: '삭제',
    edit: '수정',
    close: '닫기',
    next: '다음',
    prev: '이전',
    done: '완료',
    submit: '제출',
    search: '검색',
    noData: '데이터가 없습니다',
    yes: '예',
    no: '아니오',
  },

  // ============================================================================
  // 인증
  // ============================================================================
  auth: {
    login: '로그인',
    logout: '로그아웃',
    signup: '회원가입',
    email: '이메일',
    password: '비밀번호',
    passwordConfirm: '비밀번호 확인',
    name: '이름',
    forgotPassword: '비밀번호 찾기',
    resetPassword: '비밀번호 재설정',
    sendResetEmail: '재설정 이메일 전송',
    resetEmailSent: '비밀번호 재설정 이메일이 전송되었습니다',
    noAccount: '계정이 없으신가요?',
    hasAccount: '이미 계정이 있으신가요?',
    loginFailed: '로그인에 실패했습니다',
    signupFailed: '회원가입에 실패했습니다',
    invalidCredentials: '이메일 또는 비밀번호가 올바르지 않습니다',
    emailAlreadyExists: '이미 사용 중인 이메일입니다',
    weakPassword: '비밀번호가 너무 약합니다',
    passwordMismatch: '비밀번호가 일치하지 않습니다',
    selectRole: '역할을 선택해주세요',
    roleTeacher: '강사',
    roleStudent: '학생',
  },

  // ============================================================================
  // 강사 화면
  // ============================================================================
  teacher: {
    // 탭
    tabHome: '홈',
    tabInvite: '초대',
    tabSettings: '설정',

    // 홈
    homeTitle: '내 학생',
    noStudents: '연결된 학생이 없습니다',
    noStudentsDesc: '초대 코드를 생성하여 학생을 초대해보세요',
    studentCount: '학생 {count}명',

    // 초대
    inviteTitle: '학생 초대',
    inviteDesc: '초대 코드를 생성하여 학생에게 공유하세요',
    generateCode: '초대 코드 생성',
    inviteCode: '초대 코드',
    copyCode: '코드 복사',
    codeCopied: '코드가 복사되었습니다',
    codeExpires: '{date}까지 유효',
    activeInvites: '활성 초대',
    noActiveInvites: '활성 초대 코드가 없습니다',

    // 학생 상세
    studentDetail: '학생 정보',
    practiceHistory: '연습 기록',
    scripts: '스크립트',
    addScript: '스크립트 추가',
    noPractices: '연습 기록이 없습니다',
    noScripts: '작성된 스크립트가 없습니다',

    // 스크립트 작성
    selectTopic: '주제 선택',
    selectQuestion: '질문 선택',
    writeScript: '스크립트 작성',
    scriptContent: '스크립트 내용',
    scriptComment: '코멘트 (선택)',
    scriptCommentPlaceholder: '학생에게 전달할 메모를 입력하세요',
    saveAsDraft: '임시 저장',
    saveAsComplete: '완료로 저장',
    scriptSaved: '스크립트가 저장되었습니다',

    // 연습 상세
    practiceDetail: '연습 상세',
    transcription: 'STT 결과',
    aiFeedback: 'AI 피드백',
    teacherFeedback: '강사 피드백',
    addFeedback: '피드백 추가',
    editFeedback: '피드백 수정',
    feedbackPlaceholder: '학생에게 피드백을 작성하세요',
    feedbackSaved: '피드백이 저장되었습니다',
  },

  // ============================================================================
  // 학생 화면
  // ============================================================================
  student: {
    // 탭
    tabHome: '홈',
    tabHistory: '기록',
    tabSettings: '설정',

    // 연결
    connectTitle: '강사 연결',
    connectDesc: '강사에게 받은 초대 코드를 입력하세요',
    inviteCodeInput: '초대 코드 입력',
    inviteCodePlaceholder: '6자리 코드 입력',
    connectButton: '연결하기',
    connectSuccess: '강사와 연결되었습니다',
    connectFailed: '연결에 실패했습니다',
    invalidCode: '유효하지 않은 초대 코드입니다',
    codeExpired: '만료된 초대 코드입니다',
    alreadyConnected: '이미 연결된 강사가 있습니다',

    // 홈
    homeTitle: '학습하기',
    noTeacher: '연결된 강사가 없습니다',
    noTeacherDesc: '강사의 초대 코드를 입력하여 연결하세요',
    myTopics: '나의 주제',
    myScripts: '나의 스크립트',
    recentPractices: '최근 연습',
    practiceCount: '연습 {count}회',
    avgScore: '평균 점수 {score}점',

    // 주제
    topicsTitle: '주제 목록',
    selectTopics: '관심 주제 선택',
    selectedTopics: '선택된 주제',
    saveTopics: '주제 저장',
    topicsSaved: '주제가 저장되었습니다',

    // 스크립트
    scriptDetail: '스크립트 상세',
    startPractice: '연습 시작',
    viewHistory: '연습 기록 보기',

    // 연습
    practiceTitle: '연습하기',
    practiceGuide: '스크립트를 보고 녹음해보세요',
    recording: '녹음 중...',
    startRecording: '녹음 시작',
    stopRecording: '녹음 중지',
    playRecording: '녹음 듣기',
    submitPractice: '제출하기',
    analyzing: '분석 중...',

    // 결과
    resultTitle: '연습 결과',
    score: '점수',
    reproductionRate: '재현율',
    missedPhrases: '누락된 표현',
    extraPhrases: '추가된 표현',
    pronunciationTips: '발음 팁',
    grammarIssues: '문법 이슈',
    suggestions: '개선 제안',

    // 기록
    historyTitle: '연습 기록',
    noHistory: '연습 기록이 없습니다',
    noHistoryDesc: '스크립트를 선택하여 연습을 시작해보세요',
    filterByTopic: '주제별 필터',
    filterByDate: '날짜별 필터',
  },

  // ============================================================================
  // 설정
  // ============================================================================
  settings: {
    title: '설정',
    account: '계정',
    profile: '프로필',
    notifications: '알림 설정',
    notificationsDesc: '푸시 알림 수신 여부',
    privacy: '개인정보 처리방침',
    terms: '이용약관',
    version: '앱 버전',
    deleteAccount: '회원 탈퇴',
    deleteAccountConfirm: '정말 탈퇴하시겠습니까?\n모든 데이터가 삭제되며 복구할 수 없습니다.',
    deleteAccountSuccess: '회원 탈퇴가 완료되었습니다',
  },

  // ============================================================================
  // 오류 메시지
  // ============================================================================
  errors: {
    network: '네트워크 연결을 확인해주세요',
    serverError: '서버 오류가 발생했습니다',
    unauthorized: '인증이 필요합니다',
    forbidden: '접근 권한이 없습니다',
    notFound: '데이터를 찾을 수 없습니다',
    rateLimited: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요',
    recordingFailed: '녹음에 실패했습니다',
    uploadFailed: '업로드에 실패했습니다',
    analysisFailed: '분석에 실패했습니다',
  },

  // ============================================================================
  // 유효성 검사
  // ============================================================================
  validation: {
    required: '필수 입력 항목입니다',
    invalidEmail: '올바른 이메일 형식이 아닙니다',
    emailRequired: '이메일을 입력해주세요',
    passwordRequired: '비밀번호를 입력해주세요',
    passwordMinLength: '비밀번호는 최소 {min}자 이상이어야 합니다',
    passwordMaxLength: '비밀번호는 최대 {max}자까지 가능합니다',
    nameRequired: '이름을 입력해주세요',
    nameMinLength: '이름은 최소 {min}자 이상이어야 합니다',
    nameMaxLength: '이름은 최대 {max}자까지 가능합니다',
    inviteCodeRequired: '초대 코드를 입력해주세요',
    inviteCodeLength: '초대 코드는 {length}자입니다',
    scriptRequired: '스크립트 내용을 입력해주세요',
    scriptMinLength: '스크립트는 최소 {min}자 이상이어야 합니다',
  },

  // ============================================================================
  // 시간 관련
  // ============================================================================
  time: {
    justNow: '방금 전',
    minutesAgo: '{minutes}분 전',
    hoursAgo: '{hours}시간 전',
    daysAgo: '{days}일 전',
    weeksAgo: '{weeks}주 전',
    monthsAgo: '{months}개월 전',
    yearsAgo: '{years}년 전',
  },

  // ============================================================================
  // 피드백 관련
  // ============================================================================
  feedback: {
    summary: '요약',
    reproductionRate: '재현율',
    missedPhrases: '누락된 표현',
    extraPhrases: '추가된 표현',
    pronunciationTips: '발음 팁',
    grammarIssues: '문법 이슈',
    suggestions: '개선 제안',
    noMissedPhrases: '누락된 표현이 없습니다',
    noExtraPhrases: '추가된 표현이 없습니다',
    noPronunciationTips: '발음 팁이 없습니다',
    noGrammarIssues: '문법 이슈가 없습니다',
    noSuggestions: '개선 제안이 없습니다',
  },
} as const;

// 템플릿 문자열 처리 헬퍼
export function formatString(
  template: string,
  params: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''));
}
