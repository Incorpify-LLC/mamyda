export type PendingVerification = { id: number; owner: string; action: string; label: string };
/** Tokens live only in the submitted call, never in saved form state. */
export class VerificationRequest {
  current: PendingVerification | null = null;
  private sequence = 0;
  private resolve?: (token: string) => void;
  private reject?: (error: Error) => void;
  constructor(private changed: (pending: PendingVerification | null) => void) {}
  start(owner: string, action: string, label: string): Promise<string> {
    if (this.current) return Promise.reject(new Error("A security check is already in progress."));
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
      this.current = { id: ++this.sequence, owner, action, label };
      this.changed(this.current);
    });
  }
  accept(id: number, token: string) {
    if (!token || this.current?.id !== id) return false;
    const resolve = this.resolve;
    this.clear();
    resolve?.(token);
    return true;
  }
  cancel(owner?: string) {
    if (!this.current || (owner && owner !== this.current.owner)) return;
    const reject = this.reject;
    this.clear();
    reject?.(new Error("Security check cancelled. Your draft is unchanged."));
  }
  private clear() {
    this.current = null;
    this.resolve = undefined;
    this.reject = undefined;
    this.changed(null);
  }
}
