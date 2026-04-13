import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { COLORS } from '@/lib/constants';
import { getMyMessages, markMessageRead, type ReceivedMessage } from '@/services/messages';
import { on, emit } from '@/lib/events';

export default function StudentMessagesScreen() {
  const colors = useThemeColors();
  const [messages, setMessages] = useState<ReceivedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await getMyMessages();
    if (err) {
      setError(err);
    } else {
      setMessages(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMessages();
    const off = on('message-changed', fetchMessages);
    return off;
  }, [fetchMessages]);

  async function handlePress(msg: ReceivedMessage) {
    if (!msg.read_at) {
      await markMessageRead(msg.id);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, read_at: new Date().toISOString() } : m
        )
      );
      emit('message-changed');
    }
  }

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

  function renderItem({ item }: { item: ReceivedMessage }) {
    const isUnread = !item.read_at;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: isUnread ? COLORS.PRIMARY + '08' : colors.surface,
            borderColor: isUnread ? COLORS.PRIMARY + '30' : colors.border,
          },
          pressed && { opacity: 0.7 },
        ]}
        onPress={() => handlePress(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.senderInfo}>
            {isUnread && <View style={styles.unreadDot} />}
            <Text style={[styles.senderName, { color: colors.textPrimary }]}>
              {item.sender_name}
            </Text>
            {item.class_name && (
              <View style={[styles.classBadge, { backgroundColor: COLORS.PRIMARY + '15' }]}>
                <Text style={[styles.classBadgeText, { color: COLORS.PRIMARY }]}>
                  {item.class_name}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.date, { color: colors.textDisabled }]}>
            {formatDate(item.created_at)}
          </Text>
        </View>
        {item.title && (
          <Text
            style={[
              styles.title,
              { color: colors.textPrimary },
              isUnread && { fontFamily: 'Pretendard-Bold' },
            ]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
        )}
        <Text style={[styles.body, { color: colors.textSecondary }]} numberOfLines={3}>
          {item.body}
        </Text>
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
          <Ionicons name="mail-outline" size={48} color={colors.textDisabled} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            받은 메시지가 없습니다
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1, justifyContent: 'center' },
  list: { padding: 16, gap: 12 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 15, fontFamily: 'Pretendard-Regular' },
  card: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  senderInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.PRIMARY },
  senderName: { fontSize: 14, fontFamily: 'Pretendard-SemiBold' },
  classBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  classBadgeText: { fontSize: 11, fontFamily: 'Pretendard-Medium' },
  date: { fontSize: 12, fontFamily: 'Pretendard-Regular' },
  title: { fontSize: 15, fontFamily: 'Pretendard-SemiBold' },
  body: { fontSize: 14, fontFamily: 'Pretendard-Regular', lineHeight: 20 },
});
