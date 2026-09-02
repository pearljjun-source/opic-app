import { View, Text, StyleSheet, Pressable, ScrollView, FlatList, ActivityIndicator } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { getExpressions } from '@/services/expressions';
import { EXPRESSION_CATEGORIES } from '@/lib/expressions';
import type { Expression, ExpressionCategory } from '@/lib/expressions';

const LEVEL_LABELS: Record<string, { label: string; color: string }> = {
  basic: { label: '기초', color: '#10B981' },
  intermediate: { label: '중급', color: '#F59E0B' },
  advanced: { label: '고급', color: '#EF4444' },
};

export default function ExpressionsScreen() {
  const colors = useThemeColors();
  const { currentOrg } = useAuth();
  const [categories, setCategories] = useState<ExpressionCategory[]>(EXPRESSION_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState<string>(EXPRESSION_CATEGORIES[0].key);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await getExpressions(currentOrg?.id);
      if (data.length > 0) {
        setCategories(data);
        setSelectedCategory(data[0].key);
      }
      setIsLoading(false);
    })();
  }, [currentOrg?.id]);

  const category = categories.find(c => c.key === selectedCategory) || categories[0];

  const filteredExpressions = filterLevel
    ? category.expressions.filter(e => e.level === filterLevel)
    : category.expressions;

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const renderExpression = useCallback(({ item }: { item: Expression }) => {
    const isExpanded = expandedIds.has(item.id);
    const levelInfo = LEVEL_LABELS[item.level || 'basic'];

    return (
      <Pressable
        style={[styles.expressionCard, { backgroundColor: colors.surface }]}
        onPress={() => toggleExpand(item.id)}
      >
        <View style={styles.expressionHeader}>
          <View style={styles.expressionMain}>
            <Text style={[styles.expressionEn, { color: colors.textPrimary }]}>{item.en}</Text>
            {levelInfo && (
              <View style={[styles.levelBadge, { backgroundColor: levelInfo.color + '18' }]}>
                <Text style={[styles.levelText, { color: levelInfo.color }]}>{levelInfo.label}</Text>
              </View>
            )}
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textDisabled}
          />
        </View>
        <Text style={[styles.expressionKo, { color: colors.textSecondary }]}>{item.ko}</Text>

        {isExpanded && (
          <View style={[styles.expandedArea, { borderTopColor: colors.borderLight }]}>
            <View style={styles.exampleRow}>
              <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.primary} />
              <Text style={[styles.exampleText, { color: colors.textPrimary }]}>
                {item.example}
              </Text>
            </View>
            {item.tip && (
              <View style={[styles.tipRow, { backgroundColor: colors.accentYellowBg }]}>
                <Ionicons name="bulb-outline" size={14} color={colors.warning} />
                <Text style={[styles.tipText, { color: colors.gray800 }]}>{item.tip}</Text>
              </View>
            )}
          </View>
        )}
      </Pressable>
    );
  }, [expandedIds, colors]);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surfaceSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
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
              onPress={() => {
                setSelectedCategory(cat.key);
                setExpandedIds(new Set());
              }}
            >
              <Ionicons
                name={cat.icon as any}
                size={15}
                color={isActive ? cat.color : colors.textDisabled}
              />
              <Text style={[
                styles.tabText,
                { color: isActive ? cat.color : colors.textSecondary },
              ]}>
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Category header + level filter */}
      <View style={styles.categoryHeader}>
        <View>
          <Text style={[styles.categoryTitle, { color: colors.textPrimary }]}>
            {category.label}
          </Text>
          <Text style={[styles.categoryDesc, { color: colors.textSecondary }]}>
            {category.description}
          </Text>
        </View>
        <View style={styles.levelFilter}>
          {[
            { key: null, label: '전체' },
            { key: 'basic', label: '기초' },
            { key: 'intermediate', label: '중급' },
            { key: 'advanced', label: '고급' },
          ].map(lv => {
            const isActive = filterLevel === lv.key;
            return (
              <Pressable
                key={lv.key ?? 'all'}
                style={[
                  styles.filterChip,
                  isActive && { backgroundColor: colors.primary + '15' },
                ]}
                onPress={() => setFilterLevel(lv.key)}
              >
                <Text style={[
                  styles.filterChipText,
                  { color: isActive ? colors.primary : colors.textDisabled },
                ]}>
                  {lv.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Count */}
      <View style={styles.countRow}>
        <Text style={[styles.countText, { color: colors.textSecondary }]}>
          {filteredExpressions.length}개 표현
        </Text>
      </View>

      {/* Expression list */}
      <FlatList
        data={filteredExpressions}
        renderItem={renderExpression}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Tab bar
  tabBar: {
    maxHeight: 52,
    borderBottomWidth: 1,
  },
  tabBarContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
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
  tabText: {
    fontSize: 12,
    fontFamily: 'Pretendard-SemiBold',
  },

  // Category header
  categoryHeader: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
  categoryTitle: {
    fontSize: 17,
    fontFamily: 'Pretendard-Bold',
  },
  categoryDesc: {
    fontSize: 13,
    fontFamily: 'Pretendard-Regular',
    marginTop: 3,
  },
  levelFilter: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  filterChipText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
  },

  // Count
  countRow: {
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  countText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  // Expression card
  expressionCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  expressionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  expressionMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  expressionEn: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    lineHeight: 22,
  },
  levelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  levelText: {
    fontSize: 10,
    fontFamily: 'Pretendard-Bold',
  },
  expressionKo: {
    fontSize: 13,
    fontFamily: 'Pretendard-Regular',
    marginTop: 3,
  },

  // Expanded
  expandedArea: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  exampleText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    lineHeight: 21,
    fontStyle: 'italic',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
  },
});
