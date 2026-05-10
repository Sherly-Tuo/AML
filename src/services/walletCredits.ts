import { supabase } from '@/lib/supabase';

export async function insertDemoTopUp(userId: string, amount = 10) {
  if (!supabase) {
    return {
      success: false as const,
      message: 'Supabase is not configured right now.',
    };
  }

  const { error } = await supabase.from('wallet_credit_events').insert({
    user_id: userId,
    event_type: 'manual_top_up',
    amount,
    notes: 'Demo wallet top-up from VoltShare app',
  });

  if (error) {
    return {
      success: false as const,
      message: error.message,
    };
  }

  return {
    success: true as const,
    amount,
  };
}
