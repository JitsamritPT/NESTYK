import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useLocale } from '@nestyk/i18n';
import { MobileButton, MobileIcon, tokens, useMobileTheme } from '@nestyk/ui/native';
import {
  calendarDateKey, calendarLocalDate,
  type CalendarDemoEvent, type CalendarEventKind,
} from '../lib/agent-calendar-demo';

export interface CalendarDraft {
  title: string;
  location: string;
  time: string;
  kind: CalendarEventKind;
}
export const emptyCalendarDraft: CalendarDraft = { title: '', location: '', time: '10:00', kind: 'viewing' };

interface Props {
  events: CalendarDemoEvent[];
  onAdd: (event: CalendarDemoEvent) => void;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  visibleMonth: string;
  onMonthChange: (date: string) => void;
  draft: CalendarDraft;
  onDraftChange: (draft: CalendarDraft) => void;
}

/** Calendar body only: the existing Agent shell owns navigation and page chrome. */
export function AgentCalendarScreen({ events, onAdd, selectedDate, onSelectDate, visibleMonth, onMonthChange, draft, onDraftChange }: Props) {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.agent.calendar;
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<'titleRequired' | 'timeInvalid' | null>(null);
  const [saved, setSaved] = useState(false);
  const localeTag = { th: 'th-TH', en: 'en-GB', zh: 'zh-CN', ja: 'ja-JP' }[locale];
  const kinds: CalendarEventKind[] = ['viewing', 'followUp', 'contract'];
  const daily = events.filter(event => event.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time));
  const markedDates = useMemo(() => {
    const marks: Record<string, { marked?: boolean; dotColor?: string; selected?: boolean; selectedColor?: string; selectedTextColor?: string }> = {};
    events.forEach(event => { marks[event.date] = { marked: true, dotColor: tokens.colors.selectionMark }; });
    marks[selectedDate] = { ...marks[selectedDate], selected: true, selectedColor: tokens.colors.brand[500], selectedTextColor: tokens.colors.onBrand, dotColor: tokens.colors.onBrand };
    return marks;
  }, [events, selectedDate]);
  const heading = { color: theme.screenTitle };
  const secondary = { color: theme.textSecondary };
  const surface = { backgroundColor: theme.card, borderColor: theme.border };
  const monthLabel = new Intl.DateTimeFormat(localeTag, { month: 'long', year: 'numeric' }).format(calendarLocalDate(visibleMonth));
  const selectedLabel = new Intl.DateTimeFormat(localeTag, { weekday: 'long', day: 'numeric', month: 'long' }).format(calendarLocalDate(selectedDate));
  const weekdays = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(localeTag, { weekday: 'short' }).format(new Date(2026, 8, 28 + index, 12)));

  const shiftMonth = (offset: number) => {
    const date = calendarLocalDate(visibleMonth);
    date.setDate(1);
    date.setMonth(date.getMonth() + offset);
    onMonthChange(calendarDateKey(date));
  };
  const save = () => {
    if (!draft.title.trim()) { setError('titleRequired'); return; }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time.trim())) { setError('timeInvalid'); return; }
    onAdd({ id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`, date: selectedDate, time: draft.time.trim(), kind: draft.kind, title: draft.title.trim(), location: draft.location.trim(), status: 'pending' });
    onDraftChange({ ...emptyCalendarDraft });
    setError(null);
    setAdding(false);
    setSaved(true);
  };

  return (
    <View style={styles.body}>
      <View style={[styles.notice, { backgroundColor: tokens.colors.subtle.brandBg }]}>
        <MobileIcon name="calendar" size={16} color={tokens.colors.onBrand} />
        <Text style={[styles.caption, { color: tokens.colors.onBrand, flex: 1 }]}>{copy.demoNotice}</Text>
      </View>
      <View style={[styles.calendar, surface]}>
        <Calendar
          key={`${visibleMonth}-${locale}-${theme.mode}`}
          current={visibleMonth}
          firstDay={1}
          hideExtraDays
          markedDates={markedDates}
          onDayPress={day => { onSelectDate(day.dateString); setSaved(false); }}
          customHeader={() => (
            <View>
              <View style={styles.monthRow}>
                <Text style={[styles.heading, heading, { flex: 1 }]}>{monthLabel}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={copy.previousMonth} onPress={() => shiftMonth(-1)} style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.5 : 1 }]}>
                  <MobileIcon name="chevron-left" size={20} color={theme.screenTitle} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={copy.nextMonth} onPress={() => shiftMonth(1)} style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.5 : 1 }]}>
                  <MobileIcon name="chevron-right" size={20} color={theme.screenTitle} />
                </Pressable>
              </View>
              <View style={styles.weekdays}>{weekdays.map((day, index) => <Text key={index} style={[styles.caption, secondary, styles.weekday]}>{day}</Text>)}</View>
            </View>
          )}
          theme={{
            calendarBackground: theme.card,
            dayTextColor: theme.textHeading,
            todayTextColor: theme.screenTitle,
            textDisabledColor: theme.textSecondary,
            textDayFontFamily: tokens.typography.native.body,
            textDayFontSize: 14,
            selectedDayBackgroundColor: tokens.colors.brand[500],
            selectedDayTextColor: tokens.colors.onBrand,
          }}
        />
        <MobileButton variant="ghost" onPress={() => { const today = calendarDateKey(new Date()); onSelectDate(today); onMonthChange(today.slice(0, 7) + '-01'); setSaved(false); }} textStyle={secondary}>{copy.today}</MobileButton>
      </View>
      <View style={styles.section}>
        <Text style={[styles.heading, heading, { flex: 1 }]}>{selectedLabel}</Text>
        <Text style={[styles.caption, secondary]}>{copy.eventCount.replace('{count}', String(daily.length))}</Text>
      </View>
      {daily.length === 0 ? (
        <View style={[styles.empty, surface]}>
          <MobileIcon name="calendar" size={30} color={theme.textSecondary} />
          <Text style={[styles.heading, heading]}>{copy.emptyTitle}</Text>
          <Text style={[styles.caption, secondary, { textAlign: 'center' }]}>{copy.emptyHint}</Text>
        </View>
      ) : daily.map(event => {
        const status = event.status === 'confirmed'
          ? { backgroundColor: tokens.colors.subtle.successBg, color: tokens.colors.subtle.successFg }
          : { backgroundColor: tokens.colors.subtle.warningBg, color: tokens.colors.subtle.warningFg };
        return (
          <View key={event.id} style={styles.event}>
            <Text style={[styles.time, heading]}>{event.time}</Text>
            <View style={[styles.eventCard, surface]}>
              <View style={styles.eventTop}>
                <Text style={[styles.caption, secondary]}>{copy[event.kind]}</Text>
                <Text style={[styles.status, status]}>{copy[event.status]}</Text>
              </View>
              <Text style={[styles.eventTitle, heading]}>{event.title}</Text>
              {!!event.location && <Text style={[styles.caption, secondary]}>{event.location}</Text>}
            </View>
          </View>
        );
      })}
      {saved && <Text accessibilityLiveRegion="polite" style={[styles.caption, secondary]}>{copy.saved}</Text>}
      {adding ? (
        <View style={[styles.form, surface]}>
          <Text style={[styles.heading, heading]}>{copy.newEvent}</Text>
          <Text style={[styles.caption, secondary]}>{selectedLabel}</Text>
          <Text style={[styles.label, heading]}>{copy.kind}</Text>
          <View style={styles.kindRow}>
            {kinds.map(kind => <Pressable key={kind} accessibilityRole="button" accessibilityState={{ selected: draft.kind === kind }} onPress={() => onDraftChange({ ...draft, kind })} style={({ pressed }) => [styles.kind, { backgroundColor: draft.kind === kind ? tokens.colors.brand[500] : theme.background, borderColor: theme.border, opacity: pressed ? 0.6 : 1 }]}><Text style={[styles.caption, { color: draft.kind === kind ? tokens.colors.onBrand : theme.textHeading }]}>{copy[kind]}</Text></Pressable>)}
          </View>
          {(['title', 'location', 'time'] as const).map(field => <View key={field} style={styles.field}>
            <Text style={[styles.label, heading]}>{copy[field]}</Text>
            <TextInput
              accessibilityLabel={copy[field]}
              value={draft[field]}
              onChangeText={value => { onDraftChange({ ...draft, [field]: value }); setError(null); }}
              placeholder={field === 'time' ? '10:00' : copy[field === 'title' ? 'titlePlaceholder' : 'locationPlaceholder']}
              placeholderTextColor={theme.textSecondary}
              maxLength={field === 'time' ? 5 : 160}
              autoCapitalize={field === 'time' ? 'none' : 'sentences'}
              style={[styles.input, { color: theme.textHeading, backgroundColor: theme.background, borderColor: theme.border }]}
            />
          </View>)}
          {error && <Text accessibilityRole="alert" style={[styles.caption, { color: tokens.colors.danger }]}>{copy[error]}</Text>}
          <MobileButton onPress={save}>{copy.save}</MobileButton>
          <MobileButton variant="ghost" textStyle={secondary} onPress={() => { setAdding(false); setError(null); }}>{t.common.cancel}</MobileButton>
        </View>
      ) : <MobileButton onPress={() => { setAdding(true); setSaved(false); }}>{`＋ ${copy.add}`}</MobileButton>}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14, paddingBottom: 16 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10 },
  calendar: { borderWidth: 1, borderRadius: 16, padding: 8, overflow: 'hidden' },
  monthRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 8 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  weekdays: { flexDirection: 'row', paddingVertical: 8 },
  weekday: { flex: 1, textAlign: 'center' },
  heading: { fontFamily: tokens.typography.native.headingTh, fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18 },
  section: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  empty: { borderWidth: 1, borderRadius: 14, alignItems: 'center', gap: 8, padding: 24 },
  event: { flexDirection: 'row', gap: 10 },
  time: { width: 44, paddingTop: 15, fontFamily: tokens.typography.native.bodyBold, fontSize: 12, lineHeight: 18 },
  eventCard: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14, gap: 6 },
  eventTop: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  status: { fontFamily: tokens.typography.native.body, fontSize: 11, lineHeight: 17, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  eventTitle: { fontFamily: tokens.typography.native.bodyBold, fontSize: 14, lineHeight: 21 },
  form: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  label: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20 },
  field: { gap: 6 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontFamily: tokens.typography.native.body, fontSize: 16, lineHeight: 24 },
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kind: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' },
});
