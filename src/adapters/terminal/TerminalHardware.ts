import type { TerminalLightState } from '../../features/terminal/terminalModel';

export interface FaceValueTerminalHardware {
  onCassetteDetected(handler: (productId: string) => void): () => void;
  onActuatorPressed(handler: () => void): () => void;
  printEvidenceRecord(recordId: string): Promise<{ ok: boolean }>;
  setStatusLight(state: TerminalLightState): Promise<void>;
}

type Handler = () => void;

type CassetteHandler = (productId: string) => void;

class BrowserTerminalHardware implements FaceValueTerminalHardware {
  private cassetteHandlers = new Set<CassetteHandler>();
  private actuatorHandlers = new Set<Handler>();

  constructor() {
    globalThis.addEventListener?.('keydown', this.handleKeydown);
  }

  private handleKeydown = (event: KeyboardEvent) => {
    if (event.repeat) return;
    if (event.key.toLowerCase() === 'n') {
      this.cassetteHandlers.forEach((handler) => handler('FV-P-ONE-THING-10'));
    }
    if (event.code === 'Space') {
      event.preventDefault();
      this.actuatorHandlers.forEach((handler) => handler());
    }
  };

  onCassetteDetected(handler: CassetteHandler) {
    this.cassetteHandlers.add(handler);
    return () => this.cassetteHandlers.delete(handler);
  }

  onActuatorPressed(handler: Handler) {
    this.actuatorHandlers.add(handler);
    return () => this.actuatorHandlers.delete(handler);
  }

  async printEvidenceRecord(recordId: string) {
    globalThis.dispatchEvent?.(
      new CustomEvent('fv-terminal-print', { detail: { recordId } }),
    );
    await new Promise((resolve) => globalThis.setTimeout(resolve, 1150));
    return { ok: true };
  }

  async setStatusLight(state: TerminalLightState) {
    globalThis.dispatchEvent?.(
      new CustomEvent('fv-terminal-light', { detail: { state } }),
    );
  }
}

let browserHardware: BrowserTerminalHardware | undefined;

export function getBrowserTerminalHardware(): FaceValueTerminalHardware {
  browserHardware ??= new BrowserTerminalHardware();
  return browserHardware;
}
