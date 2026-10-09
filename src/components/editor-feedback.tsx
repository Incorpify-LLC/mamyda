import { Button } from "@/components/ui/button";

export function EditorFeedback({
  loading,
  error,
  empty,
  emptyText,
  onRetry,
}: {
  loading: boolean;
  error: boolean;
  empty: boolean;
  emptyText: string;
  onRetry: () => void;
}) {
  if (error)
    return (
      <div role="alert" className="space-y-2 text-sm text-destructive">
        <p>Could not load saved items. Your content has not been removed.</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry loading
        </Button>
      </div>
    );
  if (loading)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading saved items…
      </p>
    );
  if (empty) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return null;
}
