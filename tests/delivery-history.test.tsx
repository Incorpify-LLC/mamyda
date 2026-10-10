import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DeliveryHistory } from "@/components/delivery-history";
test("history loading/errors are not presented as no deliveries", () => {
  const loading = renderToStaticMarkup(
    <DeliveryHistory loading error={false} onRefresh={() => {}} />,
  );
  expect(loading).toContain("Loading delivery history");
  expect(loading).not.toContain("No channel deliveries");
  const error = renderToStaticMarkup(<DeliveryHistory loading error onRefresh={() => {}} />);
  expect(error).toContain("Retry history");
  expect(error).not.toContain("No mail logged");
});
test("empty history and refresh clarify that no delivery is initiated", () => {
  const html = renderToStaticMarkup(
    <DeliveryHistory
      loading={false}
      error={false}
      data={{ alerts: [], emails: [] }}
      onRefresh={() => {}}
    />,
  );
  expect(html).toContain("No channel deliveries yet");
  expect(html).toContain("No mail logged yet");
  expect(html).toContain("never sends a notification");
});
