import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EditorFeedback } from "@/components/editor-feedback";
import { VaultOverview } from "@/components/vault-overview";

test("loading and failures do not masquerade as an empty collection", () => {
  const props = { empty: true, emptyText: "Nothing saved yet", onRetry: () => {} };
  const loading = renderToStaticMarkup(<EditorFeedback {...props} loading error={false} />);
  expect(loading).toContain('role="status"');
  expect(loading).not.toContain(props.emptyText);
  const failed = renderToStaticMarkup(<EditorFeedback {...props} loading error />);
  expect(failed).toContain('role="alert"');
  expect(failed).toContain("Retry loading");
  expect(failed).not.toContain(props.emptyText);
});
test("loaded empty collections provide a clear next step", () => {
  expect(
    renderToStaticMarkup(
      <EditorFeedback
        loading={false}
        error={false}
        empty
        emptyText="Choose New note to start."
        onRetry={() => {}}
      />,
    ),
  ).toContain("Choose New note to start.");
});
test("Vault recovery warning is outside collapsed capability information", () => {
  const markup = renderToStaticMarkup(<VaultOverview />);
  expect(markup).toContain("Mamyda cannot reset it or recover your encrypted content");
  expect(markup.indexOf("Without them, access can be permanently lost")).toBeLessThan(
    markup.indexOf("<details"),
  );
  expect(markup).toContain("Files and Minutes: not Vault-encrypted");
  expect(markup).not.toContain("planned model");
  expect(markup).not.toContain("<details open");
});
