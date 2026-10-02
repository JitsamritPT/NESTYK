import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AgentLead, LeadViewing } from '@nestyk/types';
import { useLocale } from '@nestyk/i18n';
import { MobileIcon, tokens, useMobileTheme } from '@nestyk/ui/native';
import { listLeadViewings } from '../lib/agent-leads-api';
import { formatShortDateTime } from '../lib/lead-format';
import type { LeadRoomMatch } from '../lib/lead-match-preview';
import { LeadViewingSheet } from './LeadViewingSheet';

/** Bottom bar of a lead's matched room: book, move or cancel a viewing of this room with the client. */
export function LeadRoomActions({ lead, match }: { lead: AgentLead; match: LeadRoomMatch }) {
  const { t, locale } = useLocale();
  const c = t.agent.leads.viewing;
  const { theme } = useMobileTheme();
  const [viewings, setViewings] = useState<LeadViewing[]>([]);
  const [open, setOpen] = useState(false);
  const closed = lead.status === 'booked' || lead.status === 'lost';

  useEffect(() => {
    let active = true;
    setViewings([]);
    listLeadViewings(lead.id)
      .then((rows) => {
        if (active) setViewings(rows);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [lead.id]);

  const upcoming =
    viewings.find(
      (v) => v.rentRoomId === match.room.id && v.status === 'scheduled' && new Date(v.scheduledAt).getTime() > Date.now(),
    ) ?? null;

  const onSaved = (saved: LeadViewing) => {
    setViewings((rows) => [...rows.filter((v) => v.id !== saved.id), saved]);
    setOpen(false);
  };

  return (
    <View style={[styles.bar, { borderTopColor: theme.border }]}>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={closed}
        accessibilityRole="button"
        accessibilityState={{ disabled: closed }}
        style={({ pressed }) => [
          styles.btn,
          closed ? styles.disabled : null,
          pressed && Platform.OS === 'ios' ? { opacity: 0.85 } : null,
        ]}
        android_ripple={{ color: 'rgba(33,30,30,0.12)' }}
      >
        <MobileIcon name="calendar" size={18} color={tokens.colors.primary} />
        <Text style={styles.label} numberOfLines={1}>
          {upcoming ? c.booked.replace('{date}', formatShortDateTime(upcoming.scheduledAt, locale) ?? '') : c.book}
        </Text>
      </Pressable>

      <LeadViewingSheet
        visible={open}
        leadId={lead.id}
        roomId={match.room.id}
        viewing={upcoming}
        onClose={() => setOpen(false)}
        onSaved={onSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: tokens.colors.brand[500],
    overflow: 'hidden',
  },
  disabled: { opacity: 0.5 },
  label: { flexShrink: 1, fontFamily: tokens.typography.native.headingTh, fontSize: 16, lineHeight: 24, color: tokens.colors.primary },
});
