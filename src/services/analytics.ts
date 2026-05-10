import { supabase } from '@/lib/supabase';
import { useStore } from '@/store';

type AnalyticsMetadata = Record<string, string | number | boolean | null>;

export async function trackAppEvent({
  eventName,
  screen,
  userId,
  metadata = {},
}: {
  eventName: string;
  screen: string;
  userId?: string | null;
  metadata?: AnalyticsMetadata;
}) {
  useStore.getState().addAppEvent({
    eventName,
    screen,
    userId: userId ?? null,
    metadata,
  });

  if (!supabase || !userId) {
    return;
  }

  const { error } = await supabase.from('app_events').insert({
    user_id: userId,
    event_name: eventName,
    screen,
    metadata,
  });

  if (error) {
    console.error('Failed to save app event to Supabase:', error.message);
  }
}
