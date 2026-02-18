import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import type { TeacherClassListItem } from '@/lib/types';

interface ClassCardProps {
  classItem: TeacherClassListItem;
  onPress?: () => void;
}

export function ClassCard({ classItem, onPress }: ClassCardProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: colors.surface, shadowColor: '#000000' },
        pressed && [styles.containerPressed, { backgroundColor: colors.surfaceSecondary }],
      ]}
      onPress={onPress}
    >
      <View style={styles.content}>
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>{classItem.name}</Text>
          {classItem.description ? (
            <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={1}>
              {classItem.description}
            </Text>
          ) : null}
        </View>
        <View style={styles.right}>
          <View style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="people-outline" size={14} color={colors.primary} />
            <Text style={[styles.badgeText, { color: colors.primaryDark }]}>{classItem.member_count}명</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  containerPressed: {
    opacity: 0.9,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontSize: 17,
    fontFamily: 'Pretendard-SemiBold',
  },
  description: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    marginTop: 4,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
  },
});

export default ClassCard;
