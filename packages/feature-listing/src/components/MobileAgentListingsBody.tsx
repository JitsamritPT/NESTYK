import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  ScrollView,
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
  const price = items[0]?.price;
  if (price == null) return null;
  return interpolate(template, { price: price.toLocaleString() });
}

function Cover({ uri, fallback }: { uri: string | null; fallback: string }) {
  const [failed, setFailed] = React.useState(false);
  if (!uri || failed) {
    return (
      <View style={[styles.cover, styles.coverFallback]}>
        <Text style={styles.coverFallbackText}>{fallback}</Text>
      </View>
    );
  }
  return <Image source={{ uri }} style={styles.cover} onError={() => setFailed(true)} />;
}

export const MobileAgentListingsBody: React.FC<MobileAgentListingsBodyProps> = ({
  items,
  loading = false,
  error = null,
  onRetry,
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
        <Text style={[styles.emptyTitle, { color: theme.text }]}>{copy.loadError}</Text>
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
        <Text style={[styles.emptyTitle, { color: theme.text }]}>{copy.emptyTitle}</Text>
        <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>{copy.emptyBody}</Text>
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
          <View
            key={item.id}
            style={[
              styles.card,
              nativeElevation(1),
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Cover
              uri={item.coverMediaUrl}
              fallback={item.property?.name?.slice(0, 1) ?? 'R'}
            />
            <View style={styles.cardBody}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
                  {item.listingTitle || item.property?.name || `#${item.id}`}
                </Text>
                <MobileBadge role="agent" label={visibilityLabel} />
              </View>
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
              {priceLabel ? (
                <Text style={styles.price}>{priceLabel}</Text>
              ) : null}
            </View>
          </View>
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
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cover: {
    width: '100%',
    height: 140,
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
    padding: 12,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
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
    marginTop: 4,
  },
});
