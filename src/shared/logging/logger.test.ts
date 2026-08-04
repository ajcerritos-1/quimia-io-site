import { describe, expect, it } from "vitest";
import { runWithContext } from "../context/request-context";
import { createLogger } from "./logger";

/** Minimal pino-compatible destination: collects each written line. */
function createCollector() {
  const lines: string[] = [];
  return {
    lines,
    write(chunk: string) {
      lines.push(chunk);
    },
  };
}

describe("logger", () => {
  it("emits a structured JSON line", () => {
    const collector = createCollector();
    const logger = createLogger(collector);

    logger.info("hello");

    expect(collector.lines).toHaveLength(1);
    const parsed = JSON.parse(collector.lines[0]);
    expect(parsed.msg).toBe("hello");
  });

  it("carries tenant_id and request_id from the active request context", () => {
    const collector = createCollector();
    const logger = createLogger(collector);

    runWithContext(
      { requestId: "req-42", tenant: { tenantId: "tenant-a", role: "admin" } },
      () => {
        logger.info("scoped log line");
      },
    );

    const parsed = JSON.parse(collector.lines[0]);
    expect(parsed.request_id).toBe("req-42");
    expect(parsed.tenant_id).toBe("tenant-a");
  });

  it("still carries tenant_id and request_id keys when logging outside any request context", () => {
    const collector = createCollector();
    const logger = createLogger(collector);

    logger.info("startup log line");

    const parsed = JSON.parse(collector.lines[0]);
    expect(parsed).toHaveProperty("request_id");
    expect(parsed).toHaveProperty("tenant_id");
  });

  it("does not leak one request's context onto another request's log line", () => {
    const collector = createCollector();
    const logger = createLogger(collector);

    runWithContext(
      { requestId: "req-a", tenant: { tenantId: "tenant-a", role: "admin" } },
      () => logger.info("from a"),
    );
    runWithContext(
      { requestId: "req-b", tenant: { tenantId: "tenant-b", role: "admin" } },
      () => logger.info("from b"),
    );

    const [first, second] = collector.lines.map((line) => JSON.parse(line));
    expect(first.tenant_id).toBe("tenant-a");
    expect(second.tenant_id).toBe("tenant-b");
  });
});
