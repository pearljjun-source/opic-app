import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useState, useEffect, useCallback } from 'react';

import { COLORS, APP_CONFIG } from '@/lib/constants';
import { createInvite, getActiveInvite, deleteInvite } from '@/services/invites';
import { InviteCodeCard } from '@/components/teacher';
import type { Invite } from '@/lib/types';
import { getUserMessage } from '@/lib/errors';

/**
 * 학생 초대 화면
 *
 * 기능:
 * - 활성 초대 코드가 있으면 표시
 * - 없으면 새로 생성 가능
 * - 코드 삭제 가능
 */
export default function InviteScreen() {
  const [invite, setInvite] = useState<Invite | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 활성 초대 코드 조회
  const fetchActiveInvite = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await getActiveInvite();

    if (fetchError) {
      setError(getUserMessage(fetchError));
    } else {
      setInvite(data);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchActiveInvite();
  }, [fetchActiveInvite]);

  // 초대 코드 생성
  const handleCreateInvite = async () => {
    setIsCreating(true);
    setError(null);

    const result = await createInvite(APP_CONFIG.INVITE_EXPIRE_DAYS);

    if (result.success && result.invite_id) {
      // 새로 생성된 코드를 다시 조회
      await fetchActiveInvite();
    } else {
      setError(result.error || '초대 코드 생성에 실패했습니다.');
    }

    setIsCreating(false);
  };

  // 초대 코드 삭제
  const handleDeleteInvite = () => {
    if (!invite) return;

    Alert.alert(
      '초대 코드 삭제',
      '이 초대 코드를 삭제하시겠습니까?\n삭제 후 새 코드를 생성할 수 있습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            const { error: deleteError } = await deleteInvite(invite.id);

            if (deleteError) {
              setError(getUserMessage(deleteError));
              setIsLoading(false);
            } else {
              setInvite(null);
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  // 로딩 중
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {invite ? (
        <InviteCodeCard
          invite={invite}
          onDelete={handleDeleteInvite}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>활성 초대 코드가 없습니다</Text>
          <Text style={styles.emptyDescription}>
            새 초대 코드를 생성하여 학생을 초대하세요.{'\n'}
            코드는 {APP_CONFIG.INVITE_EXPIRE_DAYS}일간 유효합니다.
          </Text>

          <Pressable
            style={[styles.button, isCreating && styles.buttonDisabled]}
            onPress={handleCreateInvite}
            disabled={isCreating}
          >
            {isCreating ? (
              <ActivityIndicator size="small" color={COLORS.WHITE} />
            ) : (
              <Text style={styles.buttonText}>초대 코드 생성</Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
  },
  loadingText: {
    marginTop: 16,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.ERROR,
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  button: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: COLORS.WHITE,
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
  },
});
