import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { COLORS } from '@/lib/constants';
import { alert as xAlert } from '@/lib/alert';
import { getTeacherClasses } from '@/services/classes';
import { getConnectedStudents } from '@/services/students';
import { sendMessage } from '@/services/messages';
import { emit } from '@/lib/events';
import type { TeacherClassListItem, TeacherStudentListItem } from '@/lib/types';
import type { MessageTargetType } from '@/lib/types';

type TargetOption = {
  id: string;
  name: string;
  type: MessageTargetType;
  subtitle?: string;
};

export default function ComposeMessageScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ targetType?: string; targetId?: string; targetName?: string }>();

  const [targetOptions, setTargetOptions] = useState<TargetOption[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<TargetOption | null>(null);
  const [showPicker, setShowPicker] = useState(!params.targetId);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  // 반 + 학생 목록 로드
  useEffect(() => {
    async function load() {
      const [classesRes, studentsRes] = await Promise.all([
        getTeacherClasses(),
        getConnectedStudents(),
      ]);

      const options: TargetOption[] = [];

      if (classesRes.data) {
        for (const c of classesRes.data) {
          options.push({
            id: c.id,
            name: c.name,
            type: 'class',
            subtitle: `${c.member_count}명`,
          });
        }
      }

      if (studentsRes.data) {
        for (const s of studentsRes.data) {
          options.push({
            id: s.id,
            name: s.name,
            type: 'individual',
            subtitle: s.email,
          });
        }
      }

      setTargetOptions(options);

      // URL 파라미터로 대상이 지정된 경우
      if (params.targetId && params.targetType) {
        const preset = options.find((o) => o.id === params.targetId);
        if (preset) {
          setSelectedTarget(preset);
          setShowPicker(false);
        }
      }

      setLoading(false);
    }
    load();
  }, []);

  async function handleSend() {
    if (!selectedTarget) {
      xAlert('알림', '발송 대상을 선택해주세요');
      return;
    }
    if (!body.trim()) {
      xAlert('알림', '메시지 내용을 입력해주세요');
      return;
    }

    setSending(true);
    const { data, error } = await sendMessage({
      targetType: selectedTarget.type,
      targetId: selectedTarget.id,
      title: title.trim() || undefined,
      body: body.trim(),
    });
    setSending(false);

    if (error) {
      xAlert('발송 실패', error);
      return;
    }

    emit('message-sent');
    xAlert('발송 완료', `${data!.recipientCount}명에게 메시지를 보냈습니다`);
    router.back();
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator style={{ flex: 1 }} color={COLORS.PRIMARY} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* 대상 선택 */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>받는 사람</Text>
        {selectedTarget && !showPicker ? (
          <Pressable
            style={[styles.selectedTarget, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowPicker(true)}
          >
            <Ionicons
              name={selectedTarget.type === 'class' ? 'people' : 'person'}
              size={18}
              color={COLORS.PRIMARY}
            />
            <Text style={[styles.selectedTargetText, { color: colors.textPrimary }]}>
              {selectedTarget.name}
            </Text>
            <Text style={[styles.selectedTargetSub, { color: colors.textDisabled }]}>
              {selectedTarget.subtitle}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.textDisabled} />
          </Pressable>
        ) : (
          <View style={[styles.pickerContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {targetOptions.length === 0 ? (
              <Text style={[styles.emptyPicker, { color: colors.textDisabled }]}>
                반 또는 연결된 학생이 없습니다
              </Text>
            ) : (
              <>
                {/* 반 그룹 */}
                {targetOptions.some((o) => o.type === 'class') && (
                  <>
                    <Text style={[styles.groupLabel, { color: colors.textDisabled }]}>반</Text>
                    {targetOptions
                      .filter((o) => o.type === 'class')
                      .map((option) => (
                        <Pressable
                          key={option.id}
                          style={[
                            styles.optionRow,
                            selectedTarget?.id === option.id && { backgroundColor: COLORS.PRIMARY + '15' },
                          ]}
                          onPress={() => {
                            setSelectedTarget(option);
                            setShowPicker(false);
                          }}
                        >
                          <Ionicons name="people" size={16} color={COLORS.PRIMARY} />
                          <Text style={[styles.optionName, { color: colors.textPrimary }]}>{option.name}</Text>
                          <Text style={[styles.optionSub, { color: colors.textDisabled }]}>{option.subtitle}</Text>
                        </Pressable>
                      ))}
                  </>
                )}
                {/* 학생 그룹 */}
                {targetOptions.some((o) => o.type === 'individual') && (
                  <>
                    <Text style={[styles.groupLabel, { color: colors.textDisabled }]}>학생</Text>
                    {targetOptions
                      .filter((o) => o.type === 'individual')
                      .map((option) => (
                        <Pressable
                          key={option.id}
                          style={[
                            styles.optionRow,
                            selectedTarget?.id === option.id && { backgroundColor: COLORS.PRIMARY + '15' },
                          ]}
                          onPress={() => {
                            setSelectedTarget(option);
                            setShowPicker(false);
                          }}
                        >
                          <Ionicons name="person" size={16} color={colors.textSecondary} />
                          <Text style={[styles.optionName, { color: colors.textPrimary }]}>{option.name}</Text>
                          <Text style={[styles.optionSub, { color: colors.textDisabled }]}>{option.subtitle}</Text>
                        </Pressable>
                      ))}
                  </>
                )}
              </>
            )}
          </View>
        )}

        {/* 제목 (선택) */}
        <Text style={[styles.label, { color: colors.textSecondary, marginTop: 20 }]}>제목 (선택)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
          placeholder="제목을 입력하세요"
          placeholderTextColor={colors.textDisabled}
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />

        {/* 본문 */}
        <Text style={[styles.label, { color: colors.textSecondary, marginTop: 20 }]}>내용</Text>
        <TextInput
          style={[
            styles.input,
            styles.bodyInput,
            { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary },
          ]}
          placeholder="메시지 내용을 입력하세요"
          placeholderTextColor={colors.textDisabled}
          value={body}
          onChangeText={setBody}
          multiline
          textAlignVertical="top"
          maxLength={2000}
        />
        <Text style={[styles.charCount, { color: colors.textDisabled }]}>
          {body.length}/2000
        </Text>
      </ScrollView>

      {/* 발송 버튼 */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Pressable
          style={[
            styles.sendButton,
            { backgroundColor: COLORS.PRIMARY },
            (!selectedTarget || !body.trim() || sending) && { opacity: 0.5 },
          ]}
          onPress={handleSend}
          disabled={!selectedTarget || !body.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="send" size={18} color="#fff" />
              <Text style={styles.sendButtonText}>보내기</Text>
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16 },
  label: { fontSize: 13, fontFamily: 'Pretendard-SemiBold', marginBottom: 8 },
  selectedTarget: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  selectedTargetText: { fontSize: 15, fontFamily: 'Pretendard-SemiBold', flex: 1 },
  selectedTargetSub: { fontSize: 13, fontFamily: 'Pretendard-Regular' },
  pickerContainer: { borderRadius: 10, borderWidth: 1, overflow: 'hidden', maxHeight: 300 },
  emptyPicker: { padding: 16, fontSize: 14, fontFamily: 'Pretendard-Regular', textAlign: 'center' },
  groupLabel: { fontSize: 12, fontFamily: 'Pretendard-SemiBold', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  optionName: { fontSize: 14, fontFamily: 'Pretendard-Medium', flex: 1 },
  optionSub: { fontSize: 12, fontFamily: 'Pretendard-Regular' },
  input: { borderRadius: 10, borderWidth: 1, padding: 14, fontSize: 15, fontFamily: 'Pretendard-Regular' },
  bodyInput: { height: 160 },
  charCount: { fontSize: 12, fontFamily: 'Pretendard-Regular', textAlign: 'right', marginTop: 4 },
  footer: { borderTopWidth: 0.5, padding: 16 },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
  },
  sendButtonText: { color: '#fff', fontSize: 16, fontFamily: 'Pretendard-SemiBold' },
});
