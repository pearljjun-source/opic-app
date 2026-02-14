import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import type { AIFeedback } from '@/lib/types';

interface Props {
  feedback: AIFeedback;
}

const EVAL_COLORS = {
  positive: COLORS.SECONDARY,
  neutral: COLORS.TEXT_SECONDARY,
  negative: COLORS.ERROR,
} as const;

const EVAL_ICONS = {
  positive: 'checkmark-circle-outline',
  neutral: 'ellipse-outline',
  negative: 'close-circle-outline',
} as const;

const ERROR_TYPE_LABELS: Record<string, string> = {
  grammar: '문법',
  pronunciation: '발음',
  vocabulary: '어휘',
  l1_transfer: '한국어 간섭',
};

/**
 * AI 피드백 렌더링 컴포넌트 (v1/v2 호환)
 * - v2 필드가 있으면 확장 UI 표시
 * - v2 필드가 없으면 기존 v1 UI 폴백
 */
export default function FeedbackSection({ feedback }: Props) {
  const hasV2 = !!(
    feedback.creative_additions?.length ||
    feedback.error_analysis?.length ||
    feedback.strengths?.length ||
    feedback.priority_improvements?.length ||
    feedback.encouragement
  );

  return (
    <View style={styles.feedbackBox}>
      {/* 요약 */}
      <Text style={styles.feedbackSummary}>{feedback.summary}</Text>

      {/* === v2: 강점 === */}
      {hasV2 && feedback.strengths && feedback.strengths.length > 0 && (
        <View style={styles.feedbackSection}>
          <View style={styles.feedbackLabelRow}>
            <Ionicons name="star-outline" size={16} color={COLORS.SECONDARY} />
            <Text style={[styles.feedbackLabel, { color: COLORS.SECONDARY }]}>
              잘한 점
            </Text>
          </View>
          {feedback.strengths.map((s, i) => (
            <Text key={i} style={styles.feedbackItem}>• {s}</Text>
          ))}
        </View>
      )}

      {/* 빠뜨린 표현 */}
      {feedback.missed_phrases && feedback.missed_phrases.length > 0 && (
        <View style={styles.feedbackSection}>
          <View style={styles.feedbackLabelRow}>
            <Ionicons name="remove-circle-outline" size={16} color={COLORS.ERROR} />
            <Text style={[styles.feedbackLabel, { color: COLORS.ERROR }]}>
              빠뜨린 표현
            </Text>
          </View>
          {feedback.missed_phrases.map((phrase, i) => (
            <Text key={i} style={styles.feedbackItem}>• {phrase}</Text>
          ))}
        </View>
      )}

      {/* === v2: 추가 표현 + 평가 === */}
      {hasV2 && feedback.creative_additions && feedback.creative_additions.length > 0 ? (
        <View style={styles.feedbackSection}>
          <View style={styles.feedbackLabelRow}>
            <Ionicons name="add-circle-outline" size={16} color={COLORS.SECONDARY} />
            <Text style={[styles.feedbackLabel, { color: COLORS.SECONDARY }]}>
              추가된 표현
            </Text>
          </View>
          {feedback.creative_additions.map((item, i) => (
            <View key={i} style={styles.creativeItem}>
              <View style={styles.creativeHeader}>
                <Ionicons
                  name={EVAL_ICONS[item.evaluation] as keyof typeof Ionicons.glyphMap}
                  size={14}
                  color={EVAL_COLORS[item.evaluation]}
                />
                <Text style={[styles.creativePhrase, { color: EVAL_COLORS[item.evaluation] }]}>
                  "{item.phrase}"
                </Text>
              </View>
              <Text style={styles.creativeComment}>{item.comment}</Text>
            </View>
          ))}
        </View>
      ) : (
        /* v1 폴백: 단순 리스트 */
        feedback.extra_phrases && feedback.extra_phrases.length > 0 && (
          <View style={styles.feedbackSection}>
            <View style={styles.feedbackLabelRow}>
              <Ionicons name="add-circle-outline" size={16} color={COLORS.SECONDARY} />
              <Text style={[styles.feedbackLabel, { color: COLORS.SECONDARY }]}>
                추가된 표현
              </Text>
            </View>
            {feedback.extra_phrases.map((phrase, i) => (
              <Text key={i} style={styles.feedbackItem}>• {phrase}</Text>
            ))}
          </View>
        )
      )}

      {/* === v2: 에러 분석 (교정 포함) === */}
      {hasV2 && feedback.error_analysis && feedback.error_analysis.length > 0 ? (
        <View style={styles.feedbackSection}>
          <View style={styles.feedbackLabelRow}>
            <Ionicons name="create-outline" size={16} color={COLORS.WARNING} />
            <Text style={[styles.feedbackLabel, { color: COLORS.WARNING }]}>
              교정 사항
            </Text>
          </View>
          {feedback.error_analysis.map((item, i) => (
            <View key={i} style={styles.errorItem}>
              <View style={styles.errorTypeRow}>
                <View style={styles.errorTypeBadge}>
                  <Text style={styles.errorTypeText}>
                    {ERROR_TYPE_LABELS[item.type] || item.type}
                  </Text>
                </View>
              </View>
              <Text style={styles.errorOriginal}>
                <Text style={styles.strikethrough}>{item.original}</Text>
                {'  '}
                <Text style={styles.errorCorrected}>→ {item.corrected}</Text>
              </Text>
              <Text style={styles.errorExplanation}>{item.explanation}</Text>
            </View>
          ))}
        </View>
      ) : (
        /* v1 폴백: grammar_issues + pronunciation_tips */
        <>
          {feedback.pronunciation_tips && feedback.pronunciation_tips.length > 0 && (
            <View style={styles.feedbackSection}>
              <View style={styles.feedbackLabelRow}>
                <Ionicons name="mic-outline" size={16} color={COLORS.PRIMARY} />
                <Text style={[styles.feedbackLabel, { color: COLORS.PRIMARY }]}>발음 팁</Text>
              </View>
              {feedback.pronunciation_tips.map((tip, i) => (
                <Text key={i} style={styles.feedbackItem}>• {tip}</Text>
              ))}
            </View>
          )}
          {feedback.grammar_issues && feedback.grammar_issues.length > 0 && (
            <View style={styles.feedbackSection}>
              <View style={styles.feedbackLabelRow}>
                <Ionicons name="create-outline" size={16} color={COLORS.WARNING} />
                <Text style={[styles.feedbackLabel, { color: COLORS.WARNING }]}>문법 교정</Text>
              </View>
              {feedback.grammar_issues.map((issue, i) => (
                <Text key={i} style={styles.feedbackItem}>• {issue}</Text>
              ))}
            </View>
          )}
        </>
      )}

      {/* === v2: 우선 개선 사항 === */}
      {hasV2 && feedback.priority_improvements && feedback.priority_improvements.length > 0 ? (
        <View style={styles.feedbackSection}>
          <View style={styles.feedbackLabelRow}>
            <Ionicons name="bulb-outline" size={16} color={COLORS.PRIMARY} />
            <Text style={[styles.feedbackLabel, { color: COLORS.PRIMARY }]}>
              우선 개선 사항
            </Text>
          </View>
          {feedback.priority_improvements.map((item, i) => (
            <View key={i} style={styles.improvementItem}>
              <Text style={styles.improvementArea}>{i + 1}. {item.area}</Text>
              <Text style={styles.improvementTip}>{item.tip}</Text>
            </View>
          ))}
        </View>
      ) : (
        /* v1 폴백: suggestions */
        feedback.suggestions && feedback.suggestions.length > 0 && (
          <View style={styles.feedbackSection}>
            <View style={styles.feedbackLabelRow}>
              <Ionicons name="bulb-outline" size={16} color={COLORS.PRIMARY} />
              <Text style={[styles.feedbackLabel, { color: COLORS.PRIMARY }]}>개선 제안</Text>
            </View>
            {feedback.suggestions.map((suggestion, i) => (
              <Text key={i} style={styles.feedbackItem}>• {suggestion}</Text>
            ))}
          </View>
        )
      )}

      {/* === v2: 격려 메시지 === */}
      {hasV2 && feedback.encouragement && (
        <View style={styles.encouragementBox}>
          <Text style={styles.encouragementText}>{feedback.encouragement}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  feedbackBox: {
    backgroundColor: COLORS.WARNING + '15',
    padding: 16,
    borderRadius: 16,
  },
  feedbackSummary: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 16,
    lineHeight: 22,
  },
  feedbackSection: {
    marginTop: 12,
  },
  feedbackLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  feedbackLabel: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
  },
  feedbackItem: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginLeft: 22,
    marginBottom: 4,
    lineHeight: 20,
  },

  // === Creative Additions ===
  creativeItem: {
    marginLeft: 22,
    marginBottom: 8,
  },
  creativeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  creativePhrase: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    flexShrink: 1,
  },
  creativeComment: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    marginLeft: 18,
    lineHeight: 18,
  },

  // === Error Analysis ===
  errorItem: {
    marginLeft: 22,
    marginBottom: 10,
  },
  errorTypeRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  errorTypeBadge: {
    backgroundColor: COLORS.WARNING + '30',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  errorTypeText: {
    fontSize: 11,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.WARNING,
  },
  errorOriginal: {
    fontSize: 14,
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 20,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    color: COLORS.ERROR,
  },
  errorCorrected: {
    color: COLORS.SECONDARY,
    fontFamily: 'Pretendard-SemiBold',
  },
  errorExplanation: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
    lineHeight: 18,
  },

  // === Priority Improvements ===
  improvementItem: {
    marginLeft: 22,
    marginBottom: 8,
  },
  improvementArea: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 2,
  },
  improvementTip: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    marginLeft: 16,
    lineHeight: 18,
  },

  // === Encouragement ===
  encouragementBox: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.WARNING + '40',
  },
  encouragementText: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.PRIMARY,
    textAlign: 'center',
    lineHeight: 20,
  },
});
