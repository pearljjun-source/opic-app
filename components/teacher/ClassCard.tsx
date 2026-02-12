import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/lib/constants';
import type { TeacherClassListItem } from '@/lib/types';

interface ClassCardProps {
  classItem: TeacherClassListItem;
  onPress?: () => void;
}

export function ClassCard({ classItem, onPress }: ClassCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.containerPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.content}>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{classItem.name}</Text>
          {classItem.description ? (
            <Text style={styles.description} numberOfLines={1}>
              {classItem.description}
            </Text>
          ) : null}
        </View>
        <View style={styles.right}>
          <View style={styles.badge}>
            <Ionicons name="people-outline" size={14} color={COLORS.PRIMARY} />
            <Text style={styles.badgeText}>{classItem.member_count}명</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.GRAY_400} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: COLORS.BLACK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  containerPressed: {
    opacity: 0.9,
    backgroundColor: COLORS.GRAY_50,
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
    color: COLORS.TEXT_PRIMARY,
  },
  description: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    color: COLORS.TEXT_SECONDARY,
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
    backgroundColor: COLORS.PRIMARY_LIGHT,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
    color: COLORS.PRIMARY_DARK,
  },
});

export default ClassCard;
