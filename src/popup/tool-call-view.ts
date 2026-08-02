import type { ToolStreamDelta } from '../shared/types';

export type ToolCallStatus = 'running' | 'success' | 'error';

export interface ToolCallView {
  toolCallId: string;
  toolName?: string;
  status: ToolCallStatus;
  startedAt?: number;
  durationMs?: number;
  delta: ToolStreamDelta;
}

export function toToolCallViews(deltas: ToolStreamDelta[]): ToolCallView[] {
  const viewsById = new Map<string, ToolCallView>();
  const order: string[] = [];

  for (const delta of deltas) {
    const id = delta.toolCallId;
    const existing = viewsById.get(id);

    if (delta.event === 'call' || delta.event === 'input-start') {
      if (!existing) {
        const view: ToolCallView = {
          toolCallId: id,
          toolName: 'toolName' in delta ? delta.toolName : undefined,
          status: 'running',
          startedAt: 'startedAt' in delta ? delta.startedAt : undefined,
          delta,
        };
        viewsById.set(id, view);
        order.push(id);
      } else {
        if ('toolName' in delta && delta.toolName) {
          existing.toolName = delta.toolName;
        }
        if ('startedAt' in delta && delta.startedAt && !existing.startedAt) {
          existing.startedAt = delta.startedAt;
        }
      }
      continue;
    }

    if (delta.event === 'input-delta' || delta.event === 'input-end') {
      if (!existing) {
        const view: ToolCallView = {
          toolCallId: id,
          toolName: 'toolName' in delta ? delta.toolName : undefined,
          status: 'running',
          delta,
        };
        viewsById.set(id, view);
        order.push(id);
      } else {
        if ('toolName' in delta && delta.toolName) {
          existing.toolName = delta.toolName;
        }
      }
      continue;
    }

    if (delta.event === 'result') {
      if (existing) {
        existing.status = 'success';
        existing.delta = delta;
        if (delta.startedAt !== undefined) {
          existing.startedAt = delta.startedAt;
        }
        if (delta.durationMs !== undefined) {
          existing.durationMs = delta.durationMs;
        }
      } else {
        const view: ToolCallView = {
          toolCallId: id,
          toolName: delta.toolName,
          status: 'success',
          startedAt: delta.startedAt,
          durationMs: delta.durationMs,
          delta,
        };
        viewsById.set(id, view);
        order.push(id);
      }
      continue;
    }

    if (delta.event === 'error') {
      if (existing) {
        existing.status = 'error';
        existing.delta = delta;
        if (delta.startedAt !== undefined) {
          existing.startedAt = delta.startedAt;
        }
        if (delta.durationMs !== undefined) {
          existing.durationMs = delta.durationMs;
        }
      } else {
        const view: ToolCallView = {
          toolCallId: id,
          toolName: delta.toolName,
          status: 'error',
          startedAt: delta.startedAt,
          durationMs: delta.durationMs,
          delta,
        };
        viewsById.set(id, view);
        order.push(id);
      }
    }
  }

  return order.map((id) => viewsById.get(id)!);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}
