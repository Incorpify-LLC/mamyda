import { afterEach, expect, test, vi } from "vitest";
import { transferFile } from "@/lib/file-transfer";
class MockRequest {
  static latest: MockRequest;
  upload: {
    onprogress?: (event: { lengthComputable: boolean; loaded: number; total: number }) => void;
  } = {};
  status = 200;
  timeout = 0;
  onload?: () => void;
  onerror?: () => void;
  ontimeout?: () => void;
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn();
  constructor() {
    MockRequest.latest = this;
  }
}
afterEach(() => vi.unstubAllGlobals());
test("reports real byte progress, uses binary PUT, and waits for server persistence", async () => {
  vi.stubGlobal("XMLHttpRequest", MockRequest);
  const progress = vi.fn(),
    finished = vi.fn();
  const file = new File(["abc"], "a.txt");
  const result = transferFile("/api/files/uploads/test", file, progress).then(finished);
  const request = MockRequest.latest;
  expect(request.open).toHaveBeenCalledWith("PUT", "/api/files/uploads/test");
  expect(request.setRequestHeader).toHaveBeenCalledWith("Content-Type", "application/octet-stream");
  request.upload.onprogress!({ lengthComputable: true, loaded: 3, total: 3 });
  expect(progress).toHaveBeenCalledWith(100);
  await Promise.resolve();
  expect(finished).not.toHaveBeenCalled();
  request.onload!();
  await result;
  expect(finished).toHaveBeenCalledTimes(1);
});
test.each(["server", "network", "timeout"])(
  "rejects %s failures instead of marking them uploaded",
  async (mode) => {
    vi.stubGlobal("XMLHttpRequest", MockRequest);
    const result = transferFile("/upload", new File(["a"], "a"), () => {});
    const rejected = expect(result).rejects.toThrow();
    const request = MockRequest.latest;
    if (mode === "server") {
      request.status = 400;
      request.onload!();
    } else if (mode === "network") request.onerror!();
    else request.ontimeout!();
    await rejected;
  },
);
