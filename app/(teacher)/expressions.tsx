import { View, Text, StyleSheet, Pressable, ScrollView, FlatList, ActivityIndicator, TextInput } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { alert as xAlert, confirm } from '@/lib/alert';
import { showToast } from '@/lib/toast';
import { getUserMessage } from '@/lib/errors';
import {
  getExpressions,
  deleteExpressionCategory,
  createExpression,
  updateExpression,
  deleteExpression,
  cloneGlobalToOrg,
} from '@/services/expressions';
import { EXPRESSION_CATEGORIES } from '@/lib/expressions';
import type { ExpressionCategory } from '@/lib/expressions';

const LEVEL_OPTIONS = [
  { key: 'basic' as const, label: '기초' },
  { key: 'intermediate' as const, label: '중급' },
  { key: 'advanced' as const, label: '고급' },
];

const LEVEL_COLORS: Record<string, string> = {
  basic: '#10B981',
  intermediate: '#F59E0B',
  advanced: '#EF4444',
};

type EditingExpression = {
  id?: string;
  en: string;
  ko: string;
  example: string;
  tip: string;
  level: 'basic' | 'intermediate' | 'advanced';
};

const EMPTY_EXPRESSION: EditingExpression = { en: '', ko: '', example: '', tip: '', level: 'basic' };

export default function TeacherExpressionsScreen() {
  const colors = useThemeColors();
  const { currentOrg } = useAuth();
  const orgId = currentOrg?.id;

  const [categories, setCategories] = useState<ExpressionCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isFromDb, setIsFromDb] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Editing state
  const [editingExpr, setEditingExpr] = useState<EditingExpression | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const { data, isFromDb: fromDb } = await getExpressions(orgId);
    setCategories(data);
    setIsFromDb(fromDb);
    if (data.length > 0) {
      setSelectedCategory(prev => {
        // 이전 선택이 없거나, 삭제되어 더이상 존재하지 않는 경우 첫 번째로 리셋
        if (!prev || !data.find(c => c.key === prev)) return data[0].key;
        return prev;
      });
    }
    setIsLoading(false);
  }, [orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  const category = categories.find(c => c.key === selectedCategory) || categories[0];

  const handleCloneAll = () => {
    if (!orgId) return;
    confirm('기본 데이터 복제', '모든 카테고리의 기본 표현을 내 학원에 복제하시겠습니까?\n복제 후 자유롭게 수정할 수 있습니다.', async () => {
      setIsSaving(true);

      // 첫 실패에서 중단하고 원인을 표시한다 (조용히 실패하면 "눌러도 아무 일 없음"이 된다)
      let failed: { label: string; error: Error } | null = null;
      let cloned = 0;
      for (const cat of EXPRESSION_CATEGORIES) {
        const { data, error } = await cloneGlobalToOrg(orgId, cat.key);
        if (error || !data) {
          failed = { label: cat.label, error: error || new Error('SVR_UNKNOWN') };
          break;
        }
        cloned++;
      }

      setIsSaving(false);
      await loadData();

      if (failed) {
        xAlert(
          '복제 실패',
          `'${failed.label}' 카테고리에서 중단되었습니다. (${cloned}개 완료)\n\n${getUserMessage(failed.error)}`,
        );
      } else {
        showToast(`${cloned}개 카테고리를 복제했습니다.`);
      }
    });
  };

  // Expression CRUD
  const handleSaveExpression = async () => {
    if (!editingExpr || !editingCategoryId) return;
    if (!editingExpr.en.trim() || !editingExpr.ko.trim()) {
      xAlert('입력 오류', '영어 표현과 한국어 번역은 필수입니다.');
      return;
    }

    setIsSaving(true);
    if (editingExpr.id) {
      // Update
      const { error } = await updateExpression(editingExpr.id, {
        expression_en: editingExpr.en.trim(),
        expression_ko: editingExpr.ko.trim(),
        example: editingExpr.example.trim(),
        tip: editingExpr.tip.trim() || null,
        level: editingExpr.level,
      });
      if (error) xAlert('오류', getUserMessage(error));
    } else {
      // Create
      const { error } = await createExpression({
        categoryId: editingCategoryId,
        expressionEn: editingExpr.en.trim(),
        expressionKo: editingExpr.ko.trim(),
        example: editingExpr.example.trim(),
        tip: editingExpr.tip.trim() || undefined,
        level: editingExpr.level,
      });
      if (error) xAlert('오류', getUserMessage(error));
    }
    setIsSaving(false);
    setEditingExpr(null);
    setEditingCategoryId(null);
    await loadData();
  };

  const handleDeleteExpression = (exprId: string) => {
    confirm('표현 삭제', '이 표현을 삭제하시겠습니까?', async () => {
      setIsSaving(true);
      const { error } = await deleteExpression(exprId);
      if (error) xAlert('오류', getUserMessage(error));
      setIsSaving(false);
      await loadData();
    });
  };

  const handleDeleteCategory = (catId: string) => {
    confirm('카테고리 삭제', '이 카테고리와 모든 표현을 삭제하시겠습니까?', async () => {
      setIsSaving(true);
      const { error } = await deleteExpressionCategory(catId);
      if (error) xAlert('오류', getUserMessage(error));
      setIsSaving(false);
      // loadData 내에서 삭제된 카테고리 감지 후 자동 리셋
      await loadData();
    });
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Editing form
  if (editingExpr) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
        <ScrollView contentContainerStyle={styles.formContent}>
          <Text style={[styles.formTitle, { color: colors.textPrimary }]}>
            {editingExpr.id ? '표현 수정' : '새 표현 추가'}
          </Text>

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>영어 표현 *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
            value={editingExpr.en}
            onChangeText={t => setEditingExpr(prev => prev ? { ...prev, en: t } : prev)}
            placeholder="e.g. I'm into ~"
            placeholderTextColor={colors.textDisabled}
          />

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>한국어 번역 *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
            value={editingExpr.ko}
            onChangeText={t => setEditingExpr(prev => prev ? { ...prev, ko: t } : prev)}
            placeholder="e.g. ~에 빠져 있어요"
            placeholderTextColor={colors.textDisabled}
          />

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>예문</Text>
          <TextInput
            style={[styles.input, styles.multiline, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
            value={editingExpr.example}
            onChangeText={t => setEditingExpr(prev => prev ? { ...prev, example: t } : prev)}
            placeholder="예문을 입력하세요"
            placeholderTextColor={colors.textDisabled}
            multiline
          />

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>팁 (선택)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
            value={editingExpr.tip}
            onChangeText={t => setEditingExpr(prev => prev ? { ...prev, tip: t } : prev)}
            placeholder="학습 팁"
            placeholderTextColor={colors.textDisabled}
          />

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>난이도</Text>
          <View style={styles.levelRow}>
            {LEVEL_OPTIONS.map(lv => {
              const isActive = editingExpr.level === lv.key;
              return (
                <Pressable
                  key={lv.key}
                  style={[
                    styles.levelChip,
                    { borderColor: isActive ? LEVEL_COLORS[lv.key] : colors.border },
                    isActive && { backgroundColor: LEVEL_COLORS[lv.key] + '18' },
                  ]}
                  onPress={() => setEditingExpr(prev => prev ? { ...prev, level: lv.key } : prev)}
                >
                  <Text style={{ color: isActive ? LEVEL_COLORS[lv.key] : colors.textSecondary, fontFamily: 'Pretendard-Medium', fontSize: 13 }}>
                    {lv.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.formActions}>
            <Pressable
              style={[styles.formButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1 }]}
              onPress={() => { setEditingExpr(null); setEditingCategoryId(null); }}
            >
              <Text style={[styles.formButtonText, { color: colors.textSecondary }]}>취소</Text>
            </Pressable>
            <Pressable
              style={[styles.formButton, { backgroundColor: colors.primary }]}
              onPress={handleSaveExpression}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.formButtonText, { color: '#fff' }]}>저장</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Not from DB — show clone prompt
  if (!isFromDb) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
        <View style={styles.cloneContainer}>
          <Ionicons name="copy-outline" size={48} color={colors.primary} />
          <Text style={[styles.cloneTitle, { color: colors.textPrimary }]}>
            기본 표현 라이브러리
          </Text>
          <Text style={[styles.cloneDesc, { color: colors.textSecondary }]}>
            현재 기본 제공 데이터를 사용 중입니다.{'\n'}
            내 학원에 복제하면 자유롭게 수정할 수 있습니다.
          </Text>
          <Pressable
            style={[styles.cloneButton, { backgroundColor: colors.primary }]}
            onPress={handleCloneAll}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="download-outline" size={18} color="#fff" />
                <Text style={styles.cloneButtonText}>내 학원에 복제하기</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
        contentContainerStyle={styles.tabBarContent}
      >
        {categories.map(cat => {
          const isActive = cat.key === selectedCategory;
          return (
            <Pressable
              key={cat.key}
              style={[
                styles.tab,
                isActive && { backgroundColor: cat.color + '15', borderColor: cat.color },
              ]}
              onPress={() => setSelectedCategory(cat.key)}
              onLongPress={() => {
                if (isFromDb && cat.id) handleDeleteCategory(cat.id);
              }}
            >
              <Ionicons
                name={cat.icon as any}
                size={15}
                color={isActive ? cat.color : colors.textDisabled}
              />
              <Text style={[styles.tabText, { color: isActive ? cat.color : colors.textSecondary }]}>
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Category header */}
      {category && (
        <View style={styles.categoryHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.categoryTitle, { color: colors.textPrimary }]}>{category.label}</Text>
            <Text style={[styles.categoryDesc, { color: colors.textSecondary }]}>{category.description}</Text>
          </View>
          <Pressable
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              if (!category?.id) {
                xAlert('알림', '기본 데이터를 먼저 복제해주세요.');
                return;
              }
              setEditingExpr({ ...EMPTY_EXPRESSION });
              setEditingCategoryId(category.id);
            }}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addButtonText}>추가</Text>
          </Pressable>
        </View>
      )}

      {/* Count */}
      <View style={styles.countRow}>
        <Text style={[styles.countText, { color: colors.textSecondary }]}>
          {category?.expressions.length || 0}개 표현
        </Text>
      </View>

      {/* Expression list */}
      <FlatList
        data={category?.expressions || []}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const levelColor = LEVEL_COLORS[item.level || 'basic'];
          return (
            <View style={[styles.exprCard, { backgroundColor: colors.surface }]}>
              <View style={styles.exprHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.exprTitleRow}>
                    <Text style={[styles.exprEn, { color: colors.textPrimary }]}>{item.en}</Text>
                    {item.level && (
                      <View style={[styles.levelBadge, { backgroundColor: levelColor + '18' }]}>
                        <Text style={[styles.levelBadgeText, { color: levelColor }]}>
                          {LEVEL_OPTIONS.find(l => l.key === item.level)?.label || item.level}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.exprKo, { color: colors.textSecondary }]}>{item.ko}</Text>
                  {item.example && (
                    <Text style={[styles.exprExample, { color: colors.textSecondary }]} numberOfLines={2}>
                      {item.example}
                    </Text>
                  )}
                </View>
                <View style={styles.exprActions}>
                  <Pressable
                    style={styles.iconButton}
                    onPress={() => {
                      setEditingExpr({
                        id: item.id,
                        en: item.en,
                        ko: item.ko,
                        example: item.example || '',
                        tip: item.tip || '',
                        level: (item.level as any) || 'basic',
                      });
                      setEditingCategoryId(category?.id || '');
                    }}
                  >
                    <Ionicons name="pencil-outline" size={16} color={colors.textSecondary} />
                  </Pressable>
                  <Pressable
                    style={styles.iconButton}
                    onPress={() => handleDeleteExpression(item.id)}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Clone prompt
  cloneContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  cloneTitle: {
    fontSize: 18,
    fontFamily: 'Pretendard-Bold',
    marginTop: 16,
    marginBottom: 8,
  },
  cloneDesc: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  cloneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  cloneButtonText: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    color: '#fff',
  },

  // Tab bar
  tabBar: { maxHeight: 52, borderBottomWidth: 1 },
  tabBarContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabText: { fontSize: 12, fontFamily: 'Pretendard-SemiBold' },

  // Category header
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
  categoryTitle: { fontSize: 17, fontFamily: 'Pretendard-Bold' },
  categoryDesc: { fontSize: 13, fontFamily: 'Pretendard-Regular', marginTop: 3 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: { fontSize: 13, fontFamily: 'Pretendard-SemiBold', color: '#fff' },

  // Count
  countRow: { paddingHorizontal: 20, paddingVertical: 6 },
  countText: { fontSize: 12, fontFamily: 'Pretendard-Regular' },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  // Expression card
  exprCard: { borderRadius: 14, padding: 14, marginBottom: 8 },
  exprHeader: { flexDirection: 'row', gap: 8 },
  exprTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  exprEn: { fontSize: 15, fontFamily: 'Pretendard-SemiBold', lineHeight: 22 },
  exprKo: { fontSize: 13, fontFamily: 'Pretendard-Regular', marginTop: 3 },
  exprExample: { fontSize: 12, fontFamily: 'Pretendard-Regular', marginTop: 4, fontStyle: 'italic' },
  levelBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  levelBadgeText: { fontSize: 10, fontFamily: 'Pretendard-Bold' },
  exprActions: { gap: 8 },
  iconButton: { padding: 4 },

  // Form
  formContent: { padding: 20 },
  formTitle: { fontSize: 18, fontFamily: 'Pretendard-Bold', marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontFamily: 'Pretendard-Medium', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Pretendard-Regular',
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  levelRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  levelChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  formButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  formButtonText: { fontSize: 15, fontFamily: 'Pretendard-SemiBold' },
});
