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

function contentKey(role: string, content: string) {
  return `${role}\u0000${content}`;
}

export function normalizeTurns(turns: HistoryTurn[]): HistoryTurn[] {
  const cleaned: HistoryTurn[] = [];
  const indexById = new Map<string, number>();

  for (const turn of turns) {
    const content = turn.content.trim();
    if (!content) continue;
    const providerEventId = turn.providerEventId?.trim() || null;

    if (providerEventId) {
      const existingIndex = indexById.get(providerEventId);
      if (existingIndex != null) {
        const prior = cleaned[existingIndex];
        if (content.length >= prior.content.length) {
          cleaned[existingIndex] = { role: turn.role, content, providerEventId };
        }
        continue;
      }
      indexById.set(providerEventId, cleaned.length);
      cleaned.push({ role: turn.role, content, providerEventId });
      continue;
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

  const byId = new Map<string, StoredMessage>();
  const noIdKeys = new Set<string>();
  for (const message of existing) {
    const id = message.providerEventId?.trim();
    if (id) byId.set(id, message);
    else noIdKeys.add(contentKey(message.role, message.contentText));
  }

  const updates: Array<{ sequenceNo: number; contentText: string; providerEventId?: string | null }> = [];
  const inserts: HistoryTurn[] = [];

  for (const turn of incoming) {
    const id = turn.providerEventId?.trim() || null;
    if (id) {
      const prior = byId.get(id);
      if (prior) {
        if (
          prior.role === turn.role &&
          turn.content !== prior.contentText &&
          turn.content.length >= prior.contentText.length
        ) {
          updates.push({
            sequenceNo: prior.sequenceNo,
            contentText: turn.content,
            providerEventId: id,
          });
        }
        continue;
      }
      inserts.push(turn);
      byId.set(id, {
        sequenceNo: -1,
        role: turn.role,
        contentText: turn.content,
        providerEventId: id,
      });
      continue;
    }

    if (noIdKeys.has(contentKey(turn.role, turn.content))) continue;
    inserts.push(turn);
    noIdKeys.add(contentKey(turn.role, turn.content));
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
