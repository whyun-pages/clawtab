import type { ToolStreamDelta } from '../../shared/types';

export interface ToolRenderer {
  readonly name: string;
  readonly input: string;
  render(delta: ToolStreamDelta): string;
}
