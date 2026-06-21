import { AbstractToolRenderer } from './abstract-tool.renderer';

export class GenericToolRenderer extends AbstractToolRenderer {
  public override get name(): string {
    return this.toolStreamDelta.toolName ?? 'unknown';
  }

  public get input(): string {
    return this.formatInput(this.rawInput);
  }
}
