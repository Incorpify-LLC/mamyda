import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { VerificationRequest, type PendingVerification } from "@/lib/verification-request";
import { TurnstileField } from "@/components/turnstile-field";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
const VerificationContext = createContext<VerificationRequest | null>(null);
export function SubmissionVerificationProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingVerification | null>(null);
  const [request] = useState(() => new VerificationRequest(setPending));
  useEffect(() => () => request.cancel(), [request]);
  return (
    <VerificationContext.Provider value={request}>
      {children}
      <Dialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) request.cancel();
        }}
      >
        <DialogContent>
          <DialogTitle>{pending?.label ?? "Security check"}</DialogTitle>
          <DialogDescription>
            Checking this submission. It will continue automatically after verification. Cancel
            keeps your draft.
          </DialogDescription>
          {pending && <VerificationField key={pending.id} pending={pending} request={request} />}
          <Button type="button" variant="ghost" onClick={() => request.cancel()}>
            Cancel security check
          </Button>
        </DialogContent>
      </Dialog>
    </VerificationContext.Provider>
  );
}
function VerificationField({
  pending,
  request,
}: {
  pending: PendingVerification;
  request: VerificationRequest;
}) {
  const onToken = useCallback(
    (token: string) => {
      request.accept(pending.id, token);
    },
    [pending.id, request],
  );
  return (
    <TurnstileField
      action={pending.action}
      resetKey={pending.id}
      onToken={onToken}
      appearance="interaction-only"
      size="compact"
      refreshExpired="manual"
    />
  );
}
export function useVerifiedToken() {
  const request = useContext(VerificationContext);
  const owner = useId();
  useEffect(() => () => request?.cancel(owner), [owner, request]);
  return useMemo(
    () =>
      (action: string, label = "Checking submission") => {
        if (!request) return Promise.reject(new Error("Submission verification is unavailable."));
        return request.start(owner, action, label);
      },
    [owner, request],
  );
}
