export type HistoryTurn = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  providerEventId?: string | null;
};

export type StoredMessage = {
  sequenceNo: number;
  role: string;
  contentText: string;
  providerEventId?: string | null;
};

export function normalizeTurns(turns: HistoryTurn[]): HistoryTurn[] {
  const cleaned: HistoryTurn[] = [];
  const seenIds = new Set<string>();
  for (const turn of turns) {
    const content = turn.content.trim();
    if (!content) continue;
    const providerEventId = turn.providerEventId?.trim() || null;
    if (providerEventId) {
      if (seenIds.has(providerEventId)) continue;
      seenIds.add(providerEventId);
    }
    const last = cleaned[cleaned.length - 1];
    if (last && last.role === turn.role && last.content === content) continue;
    cleaned.push({ role: turn.role, content, providerEventId });
  }
  return cleaned;
}

export function commonPrefixLength(existing: StoredMessage[], incoming: HistoryTurn[]) {
  const limit = Math.min(existing.length, incoming.length);
  let index = 0;
  while (index < limit) {
    const prior = existing[index];
    const next = incoming[index];
    if (prior.role !== next.role) break;
    if (prior.contentText !== next.content && !next.content.startsWith(prior.contentText) && !prior.contentText.startsWith(next.content)) {
      break;
    }
    index += 1;
  }
  return index;
}

export type TranscriptMutation =
  | { type: "skip" }
  | {
      type: "apply";
      updates: Array<{ sequenceNo: number; contentText: string; providerEventId?: string | null }>;
      inserts: HistoryTurn[];
      nextSequence: number;
    };

export function planTranscriptUpsert(existing: StoredMessage[], turns: HistoryTurn[]): TranscriptMutation {
  const incoming = normalizeTurns(turns);
  if (incoming.length === 0) return { type: "skip" };

  const existingIds = new Set(
    existing.map((message) => message.providerEventId).filter((id): id is string => Boolean(id)),
  );
  const prefix = commonPrefixLength(existing, incoming);
  const updates: Array<{ sequenceNo: number; contentText: string; providerEventId?: string | null }> = [];

  for (let index = 0; index < prefix; index += 1) {
    const prior = existing[index];
    const next = incoming[index];
    if (
      prior.contentText !== next.content &&
      next.content.length >= prior.contentText.length &&
      prior.role === next.role
    ) {
      updates.push({
        sequenceNo: prior.sequenceNo,
        contentText: next.content,
        providerEventId: next.providerEventId ?? prior.providerEventId,
      });
    }
  }

  const inserts: HistoryTurn[] = [];
  for (const turn of incoming.slice(existing.length)) {
    if (turn.providerEventId && existingIds.has(turn.providerEventId)) continue;
    inserts.push(turn);
    if (turn.providerEventId) existingIds.add(turn.providerEventId);
  }

  if (updates.length === 0 && inserts.length === 0) return { type: "skip" };

  const lastSeq = existing[existing.length - 1]?.sequenceNo ?? 0;
  return {
    type: "apply",
    updates,
    inserts,
    nextSequence: lastSeq + 1,
  };
}

export function restoreWindow<T>(items: T[], limit = 24): T[] {
  if (items.length <= limit) return items;
  return items.slice(items.length - limit);
}
