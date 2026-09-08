import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  ScrollView,
  Pressable,
} from 'react-native';
import { useLocale } from '@nestyk/i18n';
import {
  MobileButton,
  MobileBadge,
  tokens,
  getCardElevation,
  useMobileTheme,
} from '@nestyk/ui/native';

export type AgentListingCard = {
  id: number;
  listingTitle: string | null;
  visibility: 'private' | 'published' | null;
  listingSourceCode?: 'co_agent' | 'owner' | null;
  roomStatusCode: string | null;
  property: {
    id: number;
    name: string;
    district: string;
    province: string;
  } | null;
  propertyOwner: {
    id: number;
    name: string;
    phone: string;
  } | null;
  contact?: {
    id: number;
    name: string;
    phone: string;
  } | null;
  prices: Array<{ contractTypeId?: number; contractTypeCode: string; price: number }>;
  coverMediaUrl: string | null;
};

export interface MobileAgentListingsBodyProps {
  items: AgentListingCard[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRoomPress?: (id: number) => void;
  filtered?: boolean;
  onCreatePress?: () => void;
}

function nativeElevation(level: 1 | 2 | 3) {
  const { boxShadow: _webOnly, ...rest } = getCardElevation(level);
  return rest;
}

function interpolate(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replace(`{${key}}`, String(value)),
    template,
  );
}

function formatPrice(items: AgentListingCard['prices'], template: string): string | null {
  const price = items.length ? Math.min(...items.map((item) => item.price)) : null;
  if (price == null) return null;
  return interpolate(template, { price: price.toLocaleString() });
}

function Cover({ uri, fallback }: { uri: string | null; fallback: string }) {
  const [failed, setFailed] = React.useState(false);
  const source = React.useMemo(() => uri ? { uri } : undefined, [uri]);
  React.useEffect(() => setFailed(false), [uri]);
  if (!uri || failed) {
    return (
      <View style={[styles.cover, styles.coverFallback]}>
        <Text style={styles.coverFallbackText}>{fallback}</Text>
      </View>
    );
  }
  return <Image source={source} resizeMode="cover" style={styles.cover} onError={() => setFailed(true)} />;
}

export const MobileAgentListingsBody: React.FC<MobileAgentListingsBodyProps> = ({
  items,
  loading = false,
  error = null,
  onRetry,
  onRoomPress,
  filtered,
  onCreatePress,
}) => {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.agent.listings;
  const cr = t.agent.createRoom;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tokens.colors.roles.agent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.emptyTitle, { color: theme.textHeading }]}>{copy.loadError}</Text>
        <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>{error}</Text>
        {onRetry ? (
          <View style={styles.ctaWrap}>
            <MobileButton onPress={onRetry}>{copy.retry}</MobileButton>
          </View>
        ) : null}
      </View>
    );
  }

  if (!items.length) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.emptyTitle, { color: theme.textHeading }]}>{filtered ? copy.noMatches : copy.emptyTitle}</Text>
        <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>{filtered ? copy.search : copy.emptyBody}</Text>
        {onCreatePress ? (
          <View style={styles.ctaWrap}>
            <MobileButton onPress={onCreatePress}>{copy.emptyCta}</MobileButton>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      {onCreatePress ? (
        <View style={styles.ctaWrap}>
          <MobileButton onPress={onCreatePress}>{copy.createCta}</MobileButton>
        </View>
      ) : null}
      {items.map((item) => {
        const location = [item.property?.district, item.property?.province]
          .filter(Boolean)
          .join(' · ');
        const priceLabel = formatPrice(item.prices, copy.rentPerMonth);
        const visibilityLabel =
          item.visibility === 'published' ? cr.visibilityPublished : cr.visibilityPrivate;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${copy.viewRoom}: ${item.listingTitle || item.property?.name || item.id}`}
            onPress={() => onRoomPress?.(item.id)}
            key={item.id}
            style={({ pressed }) => [
              styles.card,
              nativeElevation(1),
              { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.86 : 1 },
            ]}
          >
            <View style={styles.cardBody}>
              <View style={styles.badgeRow}>
                <MobileBadge role="agent" label={visibilityLabel} />
              </View>
                <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={2}>
                  {item.listingTitle || item.property?.name || `#${item.id}`}
                </Text>
              {item.property?.name ? (
                <Text style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={1}>
                  {item.property.name}
                </Text>
              ) : null}
              {location ? (
                <Text style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={1}>
                  {location}
                </Text>
              ) : null}
              <View style={styles.cardBottom}>
                {priceLabel ? <Text style={styles.price} numberOfLines={2}>{priceLabel}</Text> : null}
                <View style={styles.footerRow}>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: item.roomStatusCode === 'available' ? '#16A34A' : theme.textSecondary }]} />
                    <Text numberOfLines={1} style={[styles.status, { color: theme.textSecondary }]}>{copy[item.roomStatusCode as keyof typeof copy] || item.roomStatusCode || copy.notSpecified}</Text>
                  </View>
                  <Text style={styles.viewLink}>{copy.viewRoom} ›</Text>
                </View>
              </View>
            </View>
            <View style={styles.imagePanel}>
              <Cover uri={item.coverMediaUrl} fallback={item.property?.name?.slice(0, 1) ?? 'R'} />
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  list: {
    gap: 12,
    paddingBottom: 24,
  },
  centered: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 280,
  },
  ctaWrap: {
    alignSelf: 'stretch',
  },
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    minHeight: 192,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  imagePanel: {
    width: '36%',
    maxWidth: 180,
    minWidth: 100,
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  cover: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F1F5F9',
  },
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverFallbackText: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 28,
    lineHeight: 40,
    color: tokens.colors.roles.agent,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  badgeRow: { alignItems: 'flex-start', marginBottom: 2 },
  cardBottom: { marginTop: 'auto', paddingTop: 8, gap: 7 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  status: { fontFamily: tokens.typography.native.body, fontSize: 11, lineHeight: 17, flexShrink: 1 },
  viewLink: { fontFamily: tokens.typography.native.headingTh, fontSize: 12, lineHeight: 18, color: tokens.colors.roles.agent },
  title: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  sub: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
  },
  price: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    color: tokens.colors.primary,
  },
});
