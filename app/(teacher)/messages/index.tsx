import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { COLORS } from '@/lib/constants';
import { getSentMessages, type SentMessage } from '@/services/messages';
import { on } from '@/lib/events';

export default function MessagesIndexScreen() {
  const colors = useThemeColors();
  const [messages, setMessages] = useState<SentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await getSentMessages();
    if (err) {
      setError(err);
    } else {
      setMessages(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMessages();
    const off = on('message-sent', fetchMessages);
    return off;
  }, [fetchMessages]);

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금 전';
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}일 전`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function renderItem({ item }: { item: SentMessage }) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
          pressed && { opacity: 0.7 },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.targetBadge}>
            <Ionicons
              name={item.target_type === 'class' ? 'people' : 'person'}
              size={14}
              color={COLORS.PRIMARY}
            />
            <Text style={[styles.targetName, { color: colors.textPrimary }]}>
              {item.target_name}
            </Text>
          </View>
          <Text style={[styles.date, { color: colors.textDisabled }]}>
            {formatDate(item.created_at)}
          </Text>
        </View>
        {item.title && (
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {item.title}
          </Text>
        )}
        <Text style={[styles.body, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.body}
        </Text>
        <View style={styles.readInfo}>
          <Ionicons name="checkmark-done" size={14} color={colors.textDisabled} />
          <Text style={[styles.readText, { color: colors.textDisabled }]}>
            {item.read_count}/{item.recipient_count}명 읽음
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      {loading ? (
        <ActivityIndicator style={styles.loader} color={COLORS.PRIMARY} />
      ) : error ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{error}</Text>
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={48} color={colors.textDisabled} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            보낸 메시지가 없습니다
          </Text>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}

      <Pressable
        style={[styles.fab, { backgroundColor: COLORS.PRIMARY }]}
        onPress={() => router.push('/(teacher)/messages/compose' as any)}
      >
        <Ionicons name="create-outline" size={24} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1, justifyContent: 'center' },
  list: { padding: 16, gap: 12 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 15, fontFamily: 'Pretendard-Regular' },
  card: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  targetBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  targetName: { fontSize: 14, fontFamily: 'Pretendard-SemiBold' },
  date: { fontSize: 12, fontFamily: 'Pretendard-Regular' },
  title: { fontSize: 15, fontFamily: 'Pretendard-SemiBold' },
  body: { fontSize: 14, fontFamily: 'Pretendard-Regular', lineHeight: 20 },
  readInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  readText: { fontSize: 12, fontFamily: 'Pretendard-Regular' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
