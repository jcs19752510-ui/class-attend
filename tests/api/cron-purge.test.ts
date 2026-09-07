import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cron/purge-students/route";
import { prismaMock } from "../helpers/prismaMock";

const ORIGINAL_SECRET = process.env.CRON_SECRET;

describe("GET /api/cron/purge-students (harness_09 배포 런북)", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret";
  });

  afterEach(() => {
    process.env.CRON_SECRET = ORIGINAL_SECRET;
    vi.unstubAllEnvs();
  });

  it("rejects a request without a valid Authorization header", async () => {
    const request = new Request("http://test/api/cron/purge-students");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects a mismatched secret", async () => {
    const request = new Request("http://test/api/cron/purge-students", {
      headers: { authorization: "Bearer wrong-secret" },
    });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("runs the purge batch when the secret matches", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);

    const request = new Request("http://test/api/cron/purge-students", {
      headers: { authorization: "Bearer test-cron-secret" },
    });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.purgedCount).toBe(0);
  });
});
