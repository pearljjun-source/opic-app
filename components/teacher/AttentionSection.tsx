import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
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
  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="alert-circle" size={18} color={COLORS.SECONDARY} />
        <Text style={styles.title}>관심 필요</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{items.length}</Text>
        </View>
      </View>

      {items.map((item) => {
        const isDanger = item.level === 'danger';

        return (
          <Pressable
            key={item.student.id}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            onPress={() => onStudentPress(item.student.id)}
          >
            <View
              style={[
                styles.indicator,
                { backgroundColor: isDanger ? COLORS.ERROR : COLORS.WARNING },
              ]}
            />
            <View style={styles.itemContent}>
              <Text style={styles.studentName}>{item.student.name}</Text>
              <Text
                style={[
                  styles.message,
                  { color: isDanger ? COLORS.ERROR : COLORS.SECONDARY },
                ]}
              >
                {item.message}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.GRAY_300} />
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
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 16,
    shadowColor: COLORS.BLACK,
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
    color: COLORS.TEXT_PRIMARY,
    marginLeft: 6,
    flex: 1,
  },
  countBadge: {
    backgroundColor: COLORS.SECONDARY_LIGHT,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 12,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.SECONDARY,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.GRAY_100,
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
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 2,
  },
  message: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
  },
});
