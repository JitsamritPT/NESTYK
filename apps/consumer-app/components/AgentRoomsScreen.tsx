import { AgentRoomEditor } from './AgentRoomEditor';
import React, { useEffect, useState } from 'react';
import { View, Text, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView, SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { MobileAgentListingsBody, MobileAgentRoomBody, AgentRoomDetail, AgentListingCard } from '@nestyk/feature-listing';
import { MobileButton, MobileInput, useMobileTheme } from '@nestyk/ui/native';
import { useLocale } from '@nestyk/i18n';
import { fetchMyAgentListings, fetchAgentRoom } from '../lib/agent-listings-api';

export function AgentRoomsScreen({
  onCreate,
  reloadToken,
  onReloadSettled,
  searchOpen = false,
  onSearchOpenChange,
}: {
  onCreate: () => void;
  /** Shell pull-to-refresh (MobileModePage). Bump to reload listings. */
  reloadToken?: number;
  onReloadSettled?: (token: number) => void;
  searchOpen?: boolean;
  onSearchOpenChange?: (open: boolean) => void;
}) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.agent.listings;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AgentListingCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [modalReady, setModalReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [room, setRoom] = useState<AgentRoomDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailRefresh, setDetailRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      fetchMyAgentListings({ page, q: query.trim(), visibility: filter })
        .then((result) => {
          if (cancelled) return;
          setItems(result.items); setTotal(result.total);
          if (page > 1 && !result.items.length) setPage(Math.max(1, Math.ceil(result.total / 20)));
        })
        .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); })
        .finally(() => {
          if (cancelled) return;
          setLoading(false);
          if (reloadToken) onReloadSettled?.(reloadToken);
        });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, filter, page, refresh, reloadToken, onReloadSettled]);

  useEffect(() => {
    if (selected === null) return;
    let cancelled = false;
    setRoom(null); setDetailError(null);
    fetchAgentRoom(selected)
      .then((result) => { if (!cancelled) setRoom(result); })
      .catch((err) => { if (!cancelled) setDetailError(err instanceof Error ? err.message : String(err)); });
    return () => { cancelled = true; };
  }, [selected, detailRefresh]);

  return <View style={{ gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1 }}>
        <MobileButton onPress={onCreate}>{copy.createCta}</MobileButton>
      </View>
    </View>
    {searchOpen || !!query.trim() ? (
      <MobileInput
        value={query}
        onChangeText={(value) => { setQuery(value); setPage(1); }}
        placeholder={copy.search}
        autoFocus={searchOpen && !query.trim()}
        onBlur={() => {
          if (!query.trim()) onSearchOpenChange?.(false);
        }}
      />
    ) : null}
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      {[['', copy.all], ['private', t.agent.createRoom.visibilityPrivate], ['published', t.agent.createRoom.visibilityPublished]].map(([value, label]) => <MobileButton key={value} variant={filter === value ? 'primary' : 'outline'} onPress={() => { setFilter(value); setPage(1); }}>{label}</MobileButton>)}
    </View>
    {!loading && !error && <Text style={{ color: theme.textSecondary }}>{copy.results.replace('{count}', String(total))}</Text>}
    {error && items.length > 0 && <View style={{ gap: 8 }} accessibilityLiveRegion="polite">
      <Text style={{ color: theme.textSecondary }}>{error}</Text>
      <MobileButton variant="outline" onPress={() => setRefresh((n) => n + 1)}>{copy.retry}</MobileButton>
    </View>}
    <MobileAgentListingsBody items={items} loading={loading && items.length === 0} error={items.length ? null : error} filtered={!!query.trim() || !!filter} onRetry={() => setRefresh((n) => n + 1)} onRoomPress={(id) => { setModalReady(false); setRoom(null); setDetailError(null); setSelected(id); }} />
    {!error && total > 20 && <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
      <MobileButton variant="outline" disabled={loading || page <= 1} onPress={() => setPage((n) => n - 1)}>{copy.previous}</MobileButton>
      <Text style={{ color: theme.textHeading }}>{page} / {Math.ceil(total / 20)}</Text>
      <MobileButton variant="outline" disabled={loading || page * 20 >= total} onPress={() => setPage((n) => n + 1)}>{copy.next}</MobileButton>
    </View>}
    <Modal onShow={() => setModalReady(true)} visible={selected !== null} presentationStyle="fullScreen" animationType="slide" onRequestClose={() => { if (!saving) { if (editing) setEditing(false); else setSelected(null); } }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 0, zIndex: 1, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border }}>
          <View style={{ flex: 1 }}><MobileButton variant="outline" disabled={saving} onPress={() => { if (editing) setEditing(false); else setSelected(null); }}>{`‹ ${editing ? copy.cancelEdit : copy.backToRooms}`}</MobileButton></View>
          {room && !editing && <MobileButton onPress={() => setEditing(true)}>{copy.editRoom}</MobileButton>}
        </View>
        {!modalReady ? <ActivityIndicator /> : detailError ? <View style={{ padding: 24, gap: 16 }}><Text style={{ color: theme.textHeading }}>{detailError}</Text><MobileButton onPress={() => setDetailRefresh((n) => n + 1)}>{copy.retry}</MobileButton></View> : room ? (editing ? <View style={{ flex: 1, padding: 16 }}><AgentRoomEditor room={room} onBusy={setSaving} onSaved={() => { setEditing(false); setDetailRefresh((n) => n + 1); setRefresh((n) => n + 1); }} /></View> : <MobileAgentRoomBody mapsApiKey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY} key={`${room.id}-${detailRefresh}`} room={room} />) : <ActivityIndicator />}
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  </View>;
}
