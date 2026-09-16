import { AgentRoomEditor } from './AgentRoomEditor';
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import {
  MobileAgentListingsBody,
  MobileAgentRoomBody,
  AgentRoomDetail,
  AgentListingCard,
  type AgentListingsViewMode,
} from '@nestyk/feature-listing';
import type { AgentListingsSort } from '../lib/agent-listings-api';
import {
  MobileButton,
  MobileBottomSheet,
  MobileBrandLoader,
  MobileIcon,
  SelectionCheck,
  SelectionChip,
  tokens,
  useMobileTheme,
} from '@nestyk/ui/native';
import { useLocale } from '@nestyk/i18n';
import { fetchMyAgentListings, fetchAgentRoom } from '../lib/agent-listings-api';

type VisibilityFilter = '' | 'private' | 'published';
type StatusFilter = '' | 'available' | 'rented' | 'pending_verification' | 'needs_edit';
type SourceFilter = '' | 'owner' | 'co_agent';

type RoomFilters = {
  visibility: VisibilityFilter;
  roomStatus: StatusFilter;
  listingSource: SourceFilter;
};

const EMPTY_FILTERS: RoomFilters = {
  visibility: '',
  roomStatus: '',
  listingSource: '',
};

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <SelectionChip
      label={label}
      selected={selected}
      onPress={onPress}
      style={styles.filterChip}
      labelStyle={styles.chipLabel}
    />
  );
}

function FilterOptionRow({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  const { theme } = useMobileTheme();
  return (
    <View style={styles.filterSection}>
      <Text style={[styles.filterSectionTitle, { color: theme.textHeading }]}>{title}</Text>
      <View style={styles.chipWrap}>
        {options.map((opt) => (
          <Chip
            key={opt.value || 'any'}
            label={opt.label}
            selected={value === opt.value}
            onPress={() => onChange(opt.value)}
          />
        ))}
      </View>
    </View>
  );
}

export function AgentRoomsScreen({
  onCreate,
  reloadToken,
  onReloadSettled,
  searchOpen = false,
  onSearchOpenChange,
}: {
  onCreate: () => void;
  reloadToken?: number;
  onReloadSettled?: (token: number) => void;
  searchOpen?: boolean;
  onSearchOpenChange?: (open: boolean) => void;
}) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.agent.listings;
  const cr = t.agent.createRoom;

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<RoomFilters>(EMPTY_FILTERS);
  const [draft, setDraft] = useState<RoomFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [sort, setSort] = useState<AgentListingsSort>('updated_desc');
  const [viewMode, setViewMode] = useState<AgentListingsViewMode>('row');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AgentListingCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [gateOpen, setGateOpen] = useState(false);
  const [modalReady, setModalReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [room, setRoom] = useState<AgentRoomDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailRefresh, setDetailRefresh] = useState(0);
  const searchRef = React.useRef<TextInput>(null);

  useEffect(() => {
    if (searchOpen) {
      const tmr = setTimeout(() => searchRef.current?.focus(), 80);
      return () => clearTimeout(tmr);
    }
  }, [searchOpen]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      fetchMyAgentListings({
        page,
        q: query.trim(),
        visibility: filters.visibility || undefined,
        roomStatus: filters.roomStatus || undefined,
        listingSource: filters.listingSource || undefined,
        sort,
      })
        .then((result) => {
          if (cancelled) return;
          setItems(result.items);
          setTotal(result.total);
          if (page > 1 && !result.items.length) setPage(Math.max(1, Math.ceil(result.total / 20)));
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          if (cancelled) return;
          setLoading(false);
          if (reloadToken) onReloadSettled?.(reloadToken);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, filters, page, sort, refresh, reloadToken, onReloadSettled]);

  useEffect(() => {
    if (loading && items.length === 0) setGateOpen(false);
  }, [loading, items.length]);

  useEffect(() => {
    if (selected === null) return;
    let cancelled = false;
    setRoom(null);
    setDetailError(null);
    fetchAgentRoom(selected)
      .then((result) => {
        if (!cancelled) setRoom(result);
      })
      .catch((err) => {
        if (!cancelled) setDetailError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [selected, detailRefresh]);

  const filterBadge = useMemo(() => {
    let n = 0;
    if (filters.visibility) n += 1;
    if (filters.roomStatus) n += 1;
    if (filters.listingSource) n += 1;
    return n;
  }, [filters]);

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (filters.roomStatus) {
      chips.push({
        key: 'status',
        label: String(copy[filters.roomStatus as keyof typeof copy] || filters.roomStatus),
        clear: () => setFilters((f) => ({ ...f, roomStatus: '' })),
      });
    }
    if (filters.listingSource) {
      chips.push({
        key: 'source',
        label:
          filters.listingSource === 'owner' ? cr.sourceOwner : cr.sourceCoAgent,
        clear: () => setFilters((f) => ({ ...f, listingSource: '' })),
      });
    }
    if (filters.visibility) {
      chips.push({
        key: 'visibility',
        label:
          filters.visibility === 'published' ? cr.visibilityPublished : cr.visibilityPrivate,
        clear: () => setFilters((f) => ({ ...f, visibility: '' })),
      });
    }
    return chips;
  }, [filters, copy, cr]);

  const openFilter = () => {
    setDraft(filters);
    setFilterOpen(true);
  };

  const applyFilter = () => {
    setFilters(draft);
    setPage(1);
    setFilterOpen(false);
  };

  const resetDraft = () => setDraft(EMPTY_FILTERS);

  const clearAllFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const sortOptions: Array<{ value: AgentListingsSort; label: string }> = [
    { value: 'updated_desc', label: copy.sortUpdatedDesc },
    { value: 'updated_asc', label: copy.sortUpdatedAsc },
    { value: 'price_asc', label: copy.sortPriceAsc },
    { value: 'price_desc', label: copy.sortPriceDesc },
  ];

  const sortLabel = sortOptions.find((opt) => opt.value === sort)?.label ?? copy.sortUpdatedDesc;

  const statusOptions = [
    { value: '', label: copy.filterAny },
    { value: 'available', label: copy.available },
    { value: 'rented', label: copy.rented },
    { value: 'pending_verification', label: copy.pending_verification },
    { value: 'needs_edit', label: copy.needs_edit },
  ];

  const visibilityOptions = [
    { value: '', label: copy.filterAny },
    { value: 'published', label: cr.visibilityPublished },
    { value: 'private', label: cr.visibilityPrivate },
  ];

  const sourceOptions = [
    { value: '', label: copy.filterAny },
    { value: 'owner', label: cr.sourceOwner },
    { value: 'co_agent', label: cr.sourceCoAgent },
  ];

  const hasActiveQuery =
    !!query.trim() || !!filters.visibility || !!filters.roomStatus || !!filters.listingSource;

  if (!gateOpen) {
    return (
      <MobileBrandLoader
        fill
        size="md"
        done={!loading}
        onComplete={() => setGateOpen(true)}
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.searchRow}>
        <View
          style={[
            styles.searchField,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <MobileIcon name="search" size={18} color={theme.textSecondary} />
          <TextInput
            ref={searchRef}
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              setPage(1);
            }}
            placeholder={copy.searchRooms}
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.textHeading }]}
            returnKeyType="search"
            onBlur={() => {
              if (!query.trim()) onSearchOpenChange?.(false);
            }}
          />
          {query.trim() ? (
            <Pressable
              onPress={() => {
                setQuery('');
                setPage(1);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={copy.filterClear}
            >
              <MobileIcon name="close" size={16} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={openFilter}
          accessibilityRole="button"
          accessibilityLabel={copy.filterRooms}
          style={({ pressed }) => [
            styles.filterBtn,
            { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
          ]}
          {...(Platform.OS === 'android'
            ? { android_ripple: { color: 'rgba(0,0,0,0.08)' } }
            : {})}
        >
          <MobileIcon name="funnel" size={20} color={tokens.colors.primary} />
          {filterBadge > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{filterBadge}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {activeChips.length > 0 ? (
        <View style={styles.activeChipsRow}>
          {activeChips.map((chip) => (
            <Pressable
              key={chip.key}
              onPress={chip.clear}
              style={styles.activeChip}
              accessibilityRole="button"
              accessibilityLabel={`${copy.filterClear} ${chip.label}`}
            >
              <Text style={styles.activeChipLabel}>{chip.label}</Text>
              <MobileIcon name="close" size={12} color={tokens.colors.primary} />
            </Pressable>
          ))}
          <Pressable onPress={clearAllFilters} hitSlop={8}>
            <Text style={[styles.clearLink, { color: theme.textSecondary }]}>{copy.filterClear}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.toolbar}>
        <Text style={[styles.toolbarCount, { color: theme.textSecondary }]}>
          {copy.results.replace('{count}', String(total))}
        </Text>
        <View style={styles.toolbarActions}>
          <Pressable
            onPress={() => setSortOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={copy.sortTitle}
            style={({ pressed }) => [
              styles.sortBtn,
              { borderColor: theme.border, backgroundColor: theme.surface, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.sortLabel, { color: theme.textHeading }]} numberOfLines={1}>
              {sortLabel}
            </Text>
            <MobileIcon name="chevron-down" size={14} color={theme.textSecondary} />
          </Pressable>
          <View style={[styles.viewToggle, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            {(['grid', 'row'] as const).map((mode) => {
              const selected = viewMode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => setViewMode(mode)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={mode === 'grid' ? copy.viewGrid : copy.viewRow}
                  style={[
                    styles.viewToggleBtn,
                    selected && styles.viewToggleBtnSelected,
                  ]}
                  {...(Platform.OS === 'android'
                    ? { android_ripple: { color: 'rgba(0,0,0,0.08)' } }
                    : {})}
                >
                  <MobileIcon
                    name={mode === 'grid' ? 'grid' : 'list-rows'}
                    size={18}
                    color={selected ? tokens.colors.primary : theme.textSecondary}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {error && items.length > 0 ? (
        <View style={{ gap: 8 }} accessibilityLiveRegion="polite">
          <Text style={{ color: theme.textSecondary }}>{error}</Text>
          <MobileButton variant="outline" onPress={() => setRefresh((n) => n + 1)}>
            {copy.retry}
          </MobileButton>
        </View>
      ) : null}

      <MobileAgentListingsBody
        items={items}
        viewMode={viewMode}
        loading={false}
        error={items.length ? null : error}
        filtered={hasActiveQuery}
        onRetry={() => setRefresh((n) => n + 1)}
        onRoomPress={(id) => {
          setModalReady(false);
          setRoom(null);
          setDetailError(null);
          setSelected(id);
        }}
        onCreatePress={onCreate}
      />

      {!error && total > 20 ? (
        <View style={styles.pager}>
          <MobileButton
            variant="outline"
            disabled={loading || page <= 1}
            onPress={() => setPage((n) => n - 1)}
          >
            {copy.previous}
          </MobileButton>
          <Text style={{ color: theme.textHeading }}>
            {page} / {Math.ceil(total / 20)}
          </Text>
          <MobileButton
            variant="outline"
            disabled={loading || page * 20 >= total}
            onPress={() => setPage((n) => n + 1)}
          >
            {copy.next}
          </MobileButton>
        </View>
      ) : null}

      <MobileBottomSheet visible={sortOpen} onClose={() => setSortOpen(false)}>
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: theme.textHeading }]}>{copy.sortTitle}</Text>
          <Pressable
            onPress={() => setSortOpen(false)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={copy.filterClear}
          >
            <MobileIcon name="close" size={22} color={theme.textHeading} />
          </Pressable>
        </View>
        <View style={styles.sortList}>
          {sortOptions.map((opt) => {
            const selected = sort === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  setSort(opt.value);
                  setPage(1);
                  setSortOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.sortRow,
                  { borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
                  selected && styles.sortRowSelected,
                ]}
              >
                <Text
                  style={[
                    styles.sortRowLabel,
                    { color: selected ? tokens.colors.primary : theme.textHeading },
                  ]}
                >
                  {opt.label}
                </Text>
                {selected ? <SelectionCheck selected variant="chip" size="md" /> : null}
              </Pressable>
            );
          })}
        </View>
      </MobileBottomSheet>

      <MobileBottomSheet visible={filterOpen} onClose={() => setFilterOpen(false)}>
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: theme.textHeading }]}>{copy.filterRooms}</Text>
          <Pressable
            onPress={() => setFilterOpen(false)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={copy.filterClear}
          >
            <MobileIcon name="close" size={22} color={theme.textHeading} />
          </Pressable>
        </View>
        <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
          <FilterOptionRow
            title={copy.filterAvailability}
            options={statusOptions}
            value={draft.roomStatus}
            onChange={(v) => setDraft((d) => ({ ...d, roomStatus: v as StatusFilter }))}
          />
          <FilterOptionRow
            title={copy.filterVisibility}
            options={visibilityOptions}
            value={draft.visibility}
            onChange={(v) => setDraft((d) => ({ ...d, visibility: v as VisibilityFilter }))}
          />
          <FilterOptionRow
            title={copy.filterSource}
            options={sourceOptions}
            value={draft.listingSource}
            onChange={(v) => setDraft((d) => ({ ...d, listingSource: v as SourceFilter }))}
          />
        </ScrollView>
        <View style={styles.sheetFooter}>
          <Pressable onPress={resetDraft} hitSlop={8}>
            <Text style={[styles.resetLink, { color: theme.textHeading }]}>{copy.filterReset}</Text>
          </Pressable>
          <Pressable
            onPress={applyFilter}
            style={styles.showResultsBtn}
            accessibilityRole="button"
            {...(Platform.OS === 'android'
              ? { android_ripple: { color: 'rgba(33,30,30,0.12)' } }
              : {})}
          >
            <Text style={styles.showResultsLabel}>{copy.filterShowResults}</Text>
          </Pressable>
        </View>
      </MobileBottomSheet>

      <Modal
        onShow={() => setModalReady(true)}
        visible={selected !== null}
        presentationStyle="fullScreen"
        animationType="slide"
        onRequestClose={() => {
          if (!saving) {
            if (editing) setEditing(false);
            else setSelected(null);
          }
        }}
      >
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                flexShrink: 0,
                zIndex: 1,
                backgroundColor: theme.surface,
                borderBottomWidth: 1,
                borderBottomColor: theme.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <MobileButton
                  variant="outline"
                  disabled={saving}
                  onPress={() => {
                    if (editing) setEditing(false);
                    else setSelected(null);
                  }}
                >{`‹ ${editing ? copy.cancelEdit : copy.backToRooms}`}</MobileButton>
              </View>
              {room && !editing ? (
                <MobileButton onPress={() => setEditing(true)}>{copy.editRoom}</MobileButton>
              ) : null}
            </View>
            {!modalReady ? (
              <ActivityIndicator />
            ) : detailError ? (
              <View style={{ padding: 24, gap: 16 }}>
                <Text style={{ color: theme.textHeading }}>{detailError}</Text>
                <MobileButton onPress={() => setDetailRefresh((n) => n + 1)}>
                  {copy.retry}
                </MobileButton>
              </View>
            ) : room ? (
              editing ? (
                <View style={{ flex: 1, padding: 16 }}>
                  <AgentRoomEditor
                    room={room}
                    onBusy={setSaving}
                    onSaved={() => {
                      setEditing(false);
                      setDetailRefresh((n) => n + 1);
                      setRefresh((n) => n + 1);
                    }}
                  />
                </View>
              ) : (
                <MobileAgentRoomBody
                  mapsApiKey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}
                  key={`${room.id}-${detailRefresh}`}
                  room={room}
                />
              )
            ) : (
              <ActivityIndicator />
            )}
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchField: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: tokens.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toolbarCount: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    flexShrink: 0,
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: 140,
  },
  sortLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    flexShrink: 1,
  },
  viewToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  viewToggleBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggleBtnSelected: {
    backgroundColor: tokens.colors.brand[100],
  },
  sortList: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  sortRowSelected: {
    borderColor: tokens.colors.brand[500],
    backgroundColor: tokens.colors.brand[50],
  },
  sortRowLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  activeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: tokens.colors.brand[100],
  },
  activeChipLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.primary,
    fontWeight: '600',
  },
  clearLink: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    marginLeft: 4,
  },
  pager: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  sheetTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '500',
  },
  sheetBody: {
    paddingHorizontal: 20,
    maxHeight: 420,
  },
  filterSection: { gap: 10, marginBottom: 20 },
  filterSectionTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    flexGrow: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    minHeight: 36,
  },
  chipLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
  },
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  resetLink: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  showResultsBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: tokens.colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  showResultsLabel: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
});
