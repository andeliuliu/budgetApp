import { cents, formatMoney, parseDollars, splitEvenly } from '@budgetapp/money';
import { CATEGORIES, type Category } from '@budgetapp/types';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, H1, Paragraph, Separator, SizableText, XStack, YStack } from 'tamagui';

import { useAuth } from '@/auth/auth-provider';
import { api } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import { brand } from '@/theme/colors';
import { categoryMeta } from './category-meta';

type Txn = {
  id: string;
  name: string;
  merchantName: string | null;
  amountCents: number;
  date: string;
  category: string;
  pending: boolean;
  /** True once the user has triaged it. Unreviewed "other" rows are the queue. */
  reviewed: boolean;
};

type Group = { category: string; label: string; emoji: string; total: number; items: Txn[] };

/** Always returns all categories (even $0 ones) so every category is a drop target. */
function buildGroups(txns: Txn[]): Group[] {
  const byCat = new Map<string, Txn[]>();
  for (const t of txns) {
    const arr = byCat.get(t.category);
    if (arr) arr.push(t);
    else byCat.set(t.category, [t]);
  }
  return CATEGORIES.map((category) => {
    const items = byCat.get(category) ?? [];
    return {
      category,
      ...categoryMeta(category),
      total: items.reduce((s, t) => s + t.amountCents, 0),
      items,
    };
  }).sort((a, b) => {
    // Sink buckets sit last: "other" (uncategorized), then "trash" (excluded from spend).
    const rank = (c: string) => (c === 'trash' ? 2 : c === 'other' ? 1 : 0);
    const r = rank(a.category) - rank(b.category);
    return r !== 0 ? r : b.total - a.total;
  });
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type TileShared = {
  hoverIndex: SharedValue<number>;
  landIndex: SharedValue<number>;
  landScale: SharedValue<number>;
};

function CategoryTile({
  index,
  group,
  onPress,
  registerRef,
  shared,
}: {
  index: number;
  group: Group;
  onPress: () => void;
  registerRef: (category: string, node: unknown) => void;
  shared: TileShared;
}) {
  const aStyle = useAnimatedStyle(() => {
    const hovered = shared.hoverIndex.value === index;
    const landed = shared.landIndex.value === index;
    const hl = hovered;
    return {
      transform: [{ scale: hovered ? 1.06 : landed ? shared.landScale.value : 1 }],
      borderColor: hl ? brand.accent : '#E6E6E6',
      borderWidth: hl ? 2 : 1,
      backgroundColor: hl ? brand.accentSoft : '#fff',
    };
  });

  return (
    <Pressable style={{ flex: 1 }} onPress={onPress}>
      <Animated.View
        ref={(el: unknown) => registerRef(group.category, el)}
        style={[
          {
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            minHeight: 100,
            padding: 12,
            borderRadius: 14,
          },
          aStyle,
        ]}>
        <SizableText size="$8">{group.emoji}</SizableText>
        <SizableText size="$2" numberOfLines={1}>
          {group.label}
        </SizableText>
        {group.category === 'trash' ? (
          <SizableText size="$3" theme="alt2">
            {group.items.length}
          </SizableText>
        ) : (
          <SizableText size="$3" fontWeight="700">
            {formatMoney(cents(group.total))}
          </SizableText>
        )}
      </Animated.View>
    </Pressable>
  );
}

export function TransactionsScreen() {
  const { signOut } = useAuth();
  // Scope the screen to the current calendar month (the "This month" view).
  const monthRange = useMemo(() => {
    const now = new Date();
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 1)), // exclusive
    };
  }, []);
  const { data, loading, refetch } = useApiQuery<Txn[]>(
    `/transactions?from=${monthRange.from}&to=${monthRange.to}`,
  );
  const [syncing, setSyncing] = useState(false);
  // Category whose transactions are shown in the modal (tap a tile to open).
  const [modalCategory, setModalCategory] = useState<string | null>(null);
  // A transaction lifted out of the modal (long-press) to re-file via drag.
  const [liftedId, setLiftedId] = useState<string | null>(null);
  // The transaction open in the edit modal (tap a row), plus its draft fields.
  const [editing, setEditing] = useState<Txn | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editSplit, setEditSplit] = useState('1'); // # of people to divide the price by
  // Optimistic local state: a picked category marks the row reviewed + bumps its
  // tile instantly, before the PATCH round-trips. Server reflects it on next fetch.
  const [overrides, setOverrides] = useState<Record<string, Category>>({});
  // Optimistic title/amount edits, keyed by transaction id.
  const [edits, setEdits] = useState<
    Record<string, { merchantName?: string; amountCents?: number }>
  >({});

  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      await api('/plaid/sync', { method: 'POST' });
      await api('/plaid/recategorize', { method: 'POST' });
      await refetch();
    } catch {
      await refetch();
    } finally {
      setSyncing(false);
    }
  }, [refetch]);

  const txns = data ?? [];
  const effective = useMemo(
    () =>
      txns.map((t) => {
        let r = t;
        if (overrides[t.id]) r = { ...r, category: overrides[t.id], reviewed: true };
        if (edits[t.id]) r = { ...r, ...edits[t.id] };
        return r;
      }),
    [txns, overrides, edits],
  );
  const groups = useMemo(() => buildGroups(effective), [effective]);
  // Spent = everything except trash. Every other category counts.
  const spent = effective
    .filter((t) => t.category !== 'trash')
    .reduce((s, t) => s + t.amountCents, 0);
  const grid = chunk(groups, 3);
  const modalGroup = groups.find((g) => g.category === modalCategory) ?? null;

  // The pending queue: "other" rows the user hasn't triaged yet (distinct from
  // rows deliberately filed into "other", which are reviewed and stay put).
  const pending = useMemo(
    () => effective.filter((t) => t.category === 'other' && !t.reviewed),
    [effective],
  );
  // A lifted (re-categorizing) txn takes the card slot; otherwise the queue head.
  const lifted = liftedId ? effective.find((t) => t.id === liftedId) ?? null : null;
  const currentCard = lifted ?? pending[0] ?? null;

  // Drop-target categories in grid order; refs kept current for the worklet callbacks.
  const dropCategories = useMemo(() => groups.map((g) => g.category), [groups]);
  const dropCatsRef = useRef<string[]>([]);
  dropCatsRef.current = dropCategories;
  const currentCardRef = useRef<Txn | null>(null);
  currentCardRef.current = currentCard;

  // Shared values driving the drag + animations (UI thread).
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const hoverIndex = useSharedValue(-1);
  const landIndex = useSharedValue(-1);
  const landScale = useSharedValue(1);
  const cardHome = useSharedValue({ cx: 0, cy: 0 });
  const rects = useSharedValue<({ x: number; y: number; w: number; h: number } | null)[]>([]);

  const tileRefs = useRef<Map<string, any>>(new Map());
  const cardRef = useRef<any>(null);

  const registerRef = useCallback((category: string, node: unknown) => {
    if (node) tileRefs.current.set(category, node);
    else tileRefs.current.delete(category);
  }, []);

  const measureCardHome = useCallback(() => {
    cardRef.current?.measureInWindow((x: number, y: number, w: number, h: number) => {
      cardHome.value = { cx: x + w / 2, cy: y + h / 2 };
    });
  }, [cardHome]);

  // Measure every tile's on-screen box at drag start (positions are static then).
  const measureTiles = useCallback(() => {
    const cats = dropCatsRef.current;
    if (cats.length === 0) {
      rects.value = [];
      return;
    }
    const out: ({ x: number; y: number; w: number; h: number } | null)[] = new Array(
      cats.length,
    ).fill(null);
    let remaining = cats.length;
    cats.forEach((cat, i) => {
      const node = tileRefs.current.get(cat);
      if (!node) {
        if (--remaining === 0) rects.value = out;
        return;
      }
      node.measureInWindow((x: number, y: number, w: number, h: number) => {
        out[i] = { x, y, w, h };
        if (--remaining === 0) rects.value = out;
      });
    });
  }, [rects]);

  // Card released over tile `hit` — classify, then reset transforms for the next card.
  const handleDrop = useCallback(
    (hit: number) => {
      const card = currentCardRef.current;
      const cat = dropCatsRef.current[hit] as Category | undefined;
      if (card && cat) {
        // Optimistically file it (incl. into "other" = "reviewed, leave as other"),
        // then persist. PATCH sets reviewed=true so it won't return to the queue.
        setOverrides((o) => ({ ...o, [card.id]: cat }));
        api(`/transactions/${card.id}`, { method: 'PATCH', body: { category: cat } }).catch(
          () => {},
        );
      }
      setLiftedId(null); // drop done — fall back to the pending queue
      tx.value = 0;
      ty.value = 0;
      scale.value = 1;
      hoverIndex.value = -1;
      opacity.value = withTiming(1, { duration: 200 });
    },
    [tx, ty, scale, opacity, hoverIndex],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          runOnJS(measureTiles)();
        })
        .onUpdate((e) => {
          tx.value = e.translationX;
          ty.value = e.translationY;
          const cx = cardHome.value.cx + e.translationX;
          const cy = cardHome.value.cy + e.translationY;
          let hit = -1;
          const rs = rects.value;
          for (let i = 0; i < rs.length; i++) {
            const r = rs[i];
            if (r && cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) {
              hit = i;
              break;
            }
          }
          hoverIndex.value = hit;
        })
        .onEnd(() => {
          const hit = hoverIndex.value;
          const rs = rects.value;
          const r = hit >= 0 ? rs[hit] : null;
          if (r) {
            const targetX = r.x + r.w / 2 - cardHome.value.cx;
            const targetY = r.y + r.h / 2 - cardHome.value.cy;
            tx.value = withTiming(targetX, { duration: 240 });
            ty.value = withTiming(targetY, { duration: 240 });
            scale.value = withTiming(0.2, { duration: 240 });
            opacity.value = withTiming(0, { duration: 240 }, (finished) => {
              if (finished) runOnJS(handleDrop)(hit);
            });
            // Bounce the receiving tile.
            landIndex.value = hit;
            landScale.value = withSequence(
              withTiming(1.18, { duration: 140 }),
              withSpring(1),
            );
          } else {
            tx.value = withSpring(0);
            ty.value = withSpring(0);
            hoverIndex.value = -1;
          }
        }),
    // Shared values + callbacks are stable; safe to build once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const cardAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const tileShared: TileShared = { hoverIndex, landIndex, landScale };

  const closeModal = () => {
    setModalCategory(null);
    setEditing(null);
  };

  const openEdit = (t: Txn) => {
    setEditing(t);
    setEditName(t.merchantName ?? t.name);
    setEditPrice((t.amountCents / 100).toFixed(2));
    setEditSplit('1');
  };

  // At least 1 person; non-integer/blank means "no split".
  const splitN = Math.max(1, Math.floor(Number(editSplit) || 1));
  // Live "your share" of the entered amount (null while the amount is unparseable).
  const shareCents = (() => {
    try {
      return splitEvenly(parseDollars(editPrice), splitN)[0];
    } catch {
      return null;
    }
  })();

  const saveEdit = () => {
    if (!editing) return;
    const id = editing.id;
    const patch: { merchantName?: string; amountCents?: number } = {};
    const title = editName.trim();
    if (title && title !== (editing.merchantName ?? editing.name)) patch.merchantName = title;
    // shareCents already folds in the split (= full amount when splitN === 1).
    if (shareCents !== null && shareCents !== editing.amountCents) patch.amountCents = shareCents;
    if (Object.keys(patch).length > 0) {
      setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }));
      api(`/transactions/${id}`, { method: 'PATCH', body: patch }).catch(() => {});
    }
    setEditing(null);
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: '#E6E6E6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <YStack style={{ flex: 1 }}>
        <XStack style={{ padding: 16, justifyContent: 'space-between', alignItems: 'center' }}>
          <SizableText size="$6" fontWeight="700">
            Spending
          </SizableText>
          <Button chromeless size="$2" onPress={signOut}>
            Sign out
          </Button>
        </XStack>
        <Separator />

        <ScrollView
          contentContainerStyle={{
            padding: 16,
            gap: 20,
            flexGrow: 1,
            paddingBottom: currentCard ? 150 : 16,
          }}
          refreshControl={<RefreshControl refreshing={syncing} onRefresh={refresh} />}>
          {txns.length === 0 ? (
            !loading && (
              <YStack style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
                <Paragraph theme="alt2" style={{ textAlign: 'center' }}>
                  No transactions yet. A new bank connection takes a few minutes to import —
                  pull down to refresh.
                </Paragraph>
              </YStack>
            )
          ) : (
            <>
              <YStack style={{ gap: 4 }}>
                <Paragraph theme="alt2">This month</Paragraph>
                <H1 color={brand.accent}>{formatMoney(cents(spent))}</H1>
                <Paragraph theme="alt2">spent</Paragraph>
              </YStack>

              <YStack style={{ gap: 10 }}>
                {grid.map((row, ri) => (
                  <XStack key={ri} style={{ gap: 10 }}>
                    {row.map((g, ci) => (
                      <CategoryTile
                        key={g.category}
                        index={ri * 3 + ci}
                        group={g}
                        onPress={() => setModalCategory(g.category)}
                        registerRef={registerRef}
                        shared={tileShared}
                      />
                    ))}
                    {row.length < 3 &&
                      Array.from({ length: 3 - row.length }).map((_, i) => (
                        <YStack key={`pad-${i}`} style={{ flex: 1 }} />
                      ))}
                  </XStack>
                ))}
              </YStack>

              <Paragraph theme="alt2" style={{ textAlign: 'center' }}>
                {currentCard
                  ? 'Drag the card below onto a category to file it.'
                  : 'Tap a category to see its transactions; hold one to move it.'}
              </Paragraph>
            </>
          )}
        </ScrollView>

        {currentCard && (
          <GestureDetector gesture={pan}>
            <Animated.View
              ref={cardRef}
              onLayout={measureCardHome}
              style={[
                {
                  position: 'absolute',
                  left: 16,
                  right: 16,
                  bottom: 24,
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: '#fff',
                  borderWidth: 1,
                  borderColor: '#E6E6E6',
                  shadowColor: '#000',
                  shadowOpacity: 0.12,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 6,
                },
                cardAnim,
              ]}>
              <XStack style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <YStack style={{ flexShrink: 1, paddingRight: 12, gap: 4 }}>
                  <XStack style={{ alignItems: 'center', gap: 8 }}>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 999,
                        backgroundColor: brand.accentSoft,
                      }}>
                      <SizableText size="$1" color={brand.accent} fontWeight="700">
                        {lifted ? 'recategorize' : 'pending category'}
                      </SizableText>
                    </View>
                    <SizableText size="$1" theme="alt2">
                      {lifted ? `from ${categoryMeta(lifted.category).label}` : `${pending.length} left`}
                    </SizableText>
                  </XStack>
                  <SizableText size="$5" numberOfLines={1}>
                    {currentCard.merchantName ?? currentCard.name}
                  </SizableText>
                  <SizableText size="$1" theme="alt2">
                    {String(currentCard.date).slice(0, 10)} · drag onto a category
                  </SizableText>
                </YStack>
                <SizableText size="$5" fontWeight="700">
                  {formatMoney(cents(currentCard.amountCents))}
                </SizableText>
              </XStack>
            </Animated.View>
          </GestureDetector>
        )}

        {/* One modal only — stacking two RN Modals deadlocks iOS presentation.
            Content swaps between the category list and the edit form. */}
        <Modal
          visible={!!modalGroup}
          transparent
          animationType="slide"
          onRequestClose={closeModal}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}>
            <Pressable
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}
              onPress={closeModal}>
              {/* Sheet swallows taps so they don't dismiss via the backdrop. */}
              <Pressable
                onPress={() => {}}
                style={{
                  backgroundColor: '#fff',
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  paddingTop: 12,
                  paddingHorizontal: 16,
                  paddingBottom: 32,
                  maxHeight: '75%',
                }}>
                {editing ? (
                  <YStack style={{ gap: 16, paddingVertical: 4 }}>
                    <XStack style={{ alignItems: 'center', gap: 8 }}>
                      <SizableText size="$6" fontWeight="700">
                        Edit transaction
                      </SizableText>
                      <View style={{ flex: 1 }} />
                      <Button chromeless size="$2" onPress={() => setEditing(null)}>
                        Back
                      </Button>
                    </XStack>
                    <YStack style={{ gap: 6 }}>
                      <SizableText size="$2" theme="alt2">
                        Title
                      </SizableText>
                      <TextInput
                        value={editName}
                        onChangeText={setEditName}
                        placeholder="Title"
                        style={inputStyle}
                      />
                    </YStack>
                    <YStack style={{ gap: 6 }}>
                      <SizableText size="$2" theme="alt2">
                        Amount ($)
                      </SizableText>
                      <TextInput
                        value={editPrice}
                        onChangeText={setEditPrice}
                        placeholder="0.00"
                        keyboardType="numbers-and-punctuation"
                        style={inputStyle}
                      />
                      <SizableText size="$1" theme="alt2">
                        Positive = money out, negative = money in.
                      </SizableText>
                    </YStack>
                    <YStack style={{ gap: 6 }}>
                      <SizableText size="$2" theme="alt2">
                        Split between (people)
                      </SizableText>
                      <TextInput
                        value={editSplit}
                        onChangeText={setEditSplit}
                        placeholder="1"
                        keyboardType="number-pad"
                        style={inputStyle}
                      />
                      {splitN > 1 && shareCents !== null && (
                        <SizableText size="$1" color={brand.accent} fontWeight="700">
                          Your share: {formatMoney(shareCents)} (÷ {splitN})
                        </SizableText>
                      )}
                    </YStack>
                    <XStack style={{ justifyContent: 'flex-end', gap: 8 }}>
                      <Button chromeless onPress={() => setEditing(null)}>
                        Cancel
                      </Button>
                      <Button onPress={saveEdit}>Save</Button>
                    </XStack>
                  </YStack>
                ) : modalGroup ? (
                  <>
                    <XStack style={{ alignItems: 'center', gap: 8, paddingVertical: 4 }}>
                      <SizableText size="$7">{modalGroup.emoji}</SizableText>
                      <SizableText size="$6" fontWeight="700">
                        {modalGroup.label}
                      </SizableText>
                      <SizableText size="$3" theme="alt2">
                        · {modalGroup.items.length}
                      </SizableText>
                      <View style={{ flex: 1 }} />
                      <Button chromeless size="$2" onPress={closeModal}>
                        Close
                      </Button>
                    </XStack>
                    <Paragraph theme="alt2" size="$1" style={{ paddingBottom: 8 }}>
                      Tap a transaction to edit it; hold for a second to move it to another
                      category.
                    </Paragraph>
                    <Separator />
                    {modalGroup.items.length === 0 ? (
                      <Paragraph theme="alt2" style={{ textAlign: 'center', paddingVertical: 24 }}>
                        No transactions here yet.
                      </Paragraph>
                    ) : (
                      <ScrollView style={{ marginTop: 8 }}>
                        <YStack style={{ gap: 12 }}>
                          {modalGroup.items.map((t) => (
                            <Pressable
                              key={t.id}
                              delayLongPress={1000}
                              onPress={() => openEdit(t)}
                              onLongPress={() => {
                                setLiftedId(t.id);
                                setModalCategory(null);
                              }}>
                              <XStack
                                style={{
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  paddingVertical: 4,
                                }}>
                                <YStack style={{ flexShrink: 1, paddingRight: 12 }}>
                                  <SizableText size="$4" numberOfLines={1}>
                                    {t.merchantName ?? t.name}
                                  </SizableText>
                                  <SizableText size="$1" theme="alt2">
                                    {String(t.date).slice(0, 10)}
                                    {t.pending ? ' · pending' : ''}
                                  </SizableText>
                                </YStack>
                                <SizableText size="$4">
                                  {formatMoney(cents(t.amountCents))}
                                </SizableText>
                              </XStack>
                            </Pressable>
                          ))}
                        </YStack>
                      </ScrollView>
                    )}
                  </>
                ) : null}
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>
      </YStack>
    </SafeAreaView>
  );
}
