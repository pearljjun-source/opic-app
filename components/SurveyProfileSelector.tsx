import { View, Text, StyleSheet, Pressable, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import {
  SURVEY_JOB_OPTIONS,
  SURVEY_STUDENT_TYPE_OPTIONS,
  SURVEY_RESIDENCE_OPTIONS,
} from '@/lib/constants';
import type { SurveyProfile } from '@/lib/types';

interface SurveyProfileSelectorProps {
  profile: SurveyProfile;
  onChange: (profile: SurveyProfile) => void;
}

export function SurveyProfileSelector({ profile, onChange }: SurveyProfileSelectorProps) {
  const colors = useThemeColors();

  return (
    <View style={styles.container}>
      {/* Q1: 직업 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          Q1. 현재 하시는 일은 무엇입니까?
        </Text>
        <View style={styles.optionList}>
          {SURVEY_JOB_OPTIONS.map((opt) => {
            const selected = profile.job_type === opt.key;
            return (
              <Pressable
                key={opt.key}
                style={[
                  styles.radioOption,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  selected && { backgroundColor: colors.primaryLight, borderColor: colors.primary },
                ]}
                onPress={() => onChange({ ...profile, job_type: opt.key })}
              >
                <Ionicons
                  name={(opt.icon as keyof typeof Ionicons.glyphMap)}
                  size={20}
                  color={selected ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.radioLabel,
                    { color: colors.textPrimary },
                    selected && { color: colors.primary, fontFamily: 'Pretendard-SemiBold' },
                  ]}
                >
                  {opt.label}
                </Text>
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={selected ? colors.primary : colors.textDisabled}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Q2: 학생 여부 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          Q2. 현재 학생이십니까?
        </Text>
        <View style={[styles.toggleRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="school-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>학생입니다</Text>
          <Switch
            value={profile.is_student}
            onValueChange={(v) =>
              onChange({ ...profile, is_student: v, student_type: v ? profile.student_type : null })
            }
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Q2 후속: 수강 유형 (학생이 아닌 경우만) */}
        {!profile.is_student && (
          <View style={styles.subSection}>
            <Text style={[styles.subTitle, { color: colors.textSecondary }]}>
              최근에 수강한 수업이 있나요?
            </Text>
            {SURVEY_STUDENT_TYPE_OPTIONS.map((opt) => {
              const selected = profile.student_type === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  style={[
                    styles.radioOptionCompact,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    selected && { backgroundColor: colors.primaryLight, borderColor: colors.primary },
                  ]}
                  onPress={() => onChange({ ...profile, student_type: selected ? null : opt.key })}
                >
                  <Text
                    style={[
                      styles.radioLabel,
                      { color: colors.textPrimary, flex: 1 },
                      selected && { color: colors.primary, fontFamily: 'Pretendard-SemiBold' },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={selected ? colors.primary : colors.textDisabled}
                  />
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Q3: 거주 형태 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          Q3. 현재 어디에 살고 계십니까?
        </Text>
        <View style={styles.optionList}>
          {SURVEY_RESIDENCE_OPTIONS.map((opt) => {
            const selected = profile.residence_type === opt.key;
            return (
              <Pressable
                key={opt.key}
                style={[
                  styles.radioOption,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  selected && { backgroundColor: colors.primaryLight, borderColor: colors.primary },
                ]}
                onPress={() => onChange({ ...profile, residence_type: opt.key })}
              >
                <Ionicons
                  name={(opt.icon as keyof typeof Ionicons.glyphMap)}
                  size={20}
                  color={selected ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.radioLabel,
                    { color: colors.textPrimary },
                    selected && { color: colors.primary, fontFamily: 'Pretendard-SemiBold' },
                  ]}
                >
                  {opt.label}
                </Text>
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={selected ? colors.primary : colors.textDisabled}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Pretendard-Bold',
  },
  optionList: {
    gap: 6,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  radioOptionCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  radioLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  toggleLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
  },
  subSection: {
    marginTop: 4,
    gap: 6,
  },
  subTitle: {
    fontSize: 13,
    fontFamily: 'Pretendard-Regular',
    marginBottom: 2,
  },
});
