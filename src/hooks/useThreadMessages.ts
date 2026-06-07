import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, subscribeToTable } from '../lib/supabase';

/**
 * Loads and realtime-subscribes to messages for a thread, merging outbound
 * sends and inbound Twilio-triggered messages in chronological order.
 */

export type MessageDirection = 'inbound' | 'outbound';
export type MessageChannel = 'app' | 'sms' | 'whatsapp';
export type MessageType = 'text' | 'payment' | 'request' | 'system';

export interface ThreadMessage {
  id: string;
  thread_id: string;
  owner_user_id: string;
  direction: MessageDirection;
  channel: MessageChannel;
  body: string | null;
  message_type: MessageType;
  transaction_id: string | null;
  twilio_sid: string | null;
  raw: Record<string, unknown> | null;
  created_at: string;
}

function projectPrefix(): string {
  const ns = (typeof window !== 'undefined' && (window as any).__NULLSEC__) || {};
  return `app_${ns.projectId || 'app'}_`;
}
const messagesTable = () => `${projectPrefix()}messages`;

export interface UseThreadMessages {
  messages: ThreadMessage[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  sendText: (body: string, channel?: MessageChannel) => Promise<ThreadMessage | null>;
  appendLocal: (msg: ThreadMessage) => void;
}

export function useThreadMessages(
  threadId: string | null,
  ownerUserId: string | null
): UseThreadMessages {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const sortAsc = (a: ThreadMessage, b: ThreadMessage) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime();

  const refresh = useCallback(async () => {
    if (!threadId) {
      setMessages([]);
      seenIds.current = new Set();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from(messagesTable())
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
      if (err) throw err;
      const rows = (data || []) as ThreadMessage[];
      seenIds.current = new Set(rows.map((r) => r.id));
      if (mounted.current) setMessages(rows);
    } catch (e: any) {
      if (mounted.current) setError(e?.message || 'Failed to load messages');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime INSERT subscription scoped to this thread.
  useEffect(() => {
    if (!threadId) return;
    const unsubscribe = subscribeToTable(
      'messages',
      (payload: any) => {
        const row = payload?.new as ThreadMessage | undefined;
        if (!row || row.thread_id !== threadId) return;
        if (seenIds.current.has(row.id)) return;
        seenIds.current.add(row.id);
        if (mounted.current) {
          setMessages((prev) => [...prev, row].sort(sortAsc));
        }
      },
      { event: 'INSERT' }
    );
    return unsubscribe;
  }, [threadId]);

  const appendLocal = useCallback((msg: ThreadMessage) => {
    if (seenIds.current.has(msg.id)) return;
    seenIds.current.add(msg.id);
    if (mounted.current) {
      setMessages((prev) => [...prev, msg].sort(sortAsc));
    }
  }, []);

  const sendText = useCallback(
    async (body: string, channel: MessageChannel = 'app'): Promise<ThreadMessage | null> => {
      if (!threadId || !ownerUserId || !body.trim()) return null;
      try {
        const { data, error: err } = await supabase
          .from(messagesTable())
          .insert({
            thread_id: threadId,
            owner_user_id: ownerUserId,
            direction: 'outbound',
            channel,
            body: body.trim(),
            message_type: 'text',
            raw: {},
          })
          .select('*')
          .single();
        if (err) throw err;
        const row = data as ThreadMessage;
        appendLocal(row);
        return row;
      } catch (e: any) {
        if (mounted.current) setError(e?.message || 'Failed to send message');
        return null;
      }
    },
    [threadId, ownerUserId, appendLocal]
  );

  return { messages, loading, error, refresh, sendText, appendLocal };
}
