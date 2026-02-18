import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import type { AttentionItem } from '@/lib/types';

interface AttentionSectionProps {
  items: AttentionItem[];
  onStudentPress: (studentId: string) => void;
}

/**
 * AttentionSection - "관심 필요" 학생 섹션
 *
 * 규칙 기반 알림:
 * - danger (빨간색): 14일+ 미연습
 * - warning (노란색): 7일+ 미연습 또는 스크립트 배정 후 연습 없음
 */
export function AttentionSection({ items, onStudentPress }: AttentionSectionProps) {
  const colors = useThemeColors();

  if (items.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, shadowColor: '#000000' }]}>
      <View style={styles.header}>
        <Ionicons name="alert-circle" size={18} color={colors.secondary} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>관심 필요</Text>
        <View style={[styles.countBadge, { backgroundColor: colors.secondaryLight }]}>
          <Text style={[styles.countText, { color: colors.secondary }]}>{items.length}</Text>
        </View>
      </View>

      {items.map((item) => {
        const isDanger = item.level === 'danger';

        return (
          <Pressable
            key={item.student.id}
            style={({ pressed }) => [styles.item, { borderTopColor: colors.borderLight }, pressed && styles.itemPressed]}
            onPress={() => onStudentPress(item.student.id)}
          >
            <View
              style={[
                styles.indicator,
                { backgroundColor: isDanger ? colors.error : colors.warning },
              ]}
            />
            <View style={styles.itemContent}>
              <Text style={[styles.studentName, { color: colors.textPrimary }]}>{item.student.name}</Text>
              <Text
                style={[
                  styles.message,
                  { color: isDanger ? colors.error : colors.secondary },
                ]}
              >
                {item.message}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.gray300} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    marginLeft: 6,
    flex: 1,
  },
  countBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 12,
    fontFamily: 'Pretendard-SemiBold',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  itemPressed: {
    opacity: 0.7,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  itemContent: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
    marginBottom: 2,
  },
  message: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
  },
});
