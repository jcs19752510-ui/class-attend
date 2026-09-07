import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/audit-logs/route";
import { prismaMock } from "../helpers/prismaMock";
import { makeRequest } from "../helpers/request";

const BRANCH_1 = "branch-1";
const BRANCH_2 = "branch-2";

describe("GET /api/audit-logs (att_u7_trd.md AC-2, AC-3, AC-4, §7)", () => {
  it("AC-4: rejects teacher/parent roles with 403 FORBIDDEN_ROLE", async () => {
    const request = makeRequest("http://test/api/audit-logs", {
      method: "GET",
      user: { userId: "teacher-1", role: "teacher", branchId: BRANCH_1 },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN_ROLE");
  });

  it("AC-2 & §7: a director requesting another branch's logs gets 403 FORBIDDEN_BRANCH", async () => {
    const request = makeRequest(`http://test/api/audit-logs?branchId=${BRANCH_2}`, {
      method: "GET",
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN_BRANCH");
  });

  it("AC-2: a director's own-branch query is forced regardless of omitted filter", async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([] as never);

    const request = makeRequest("http://test/api/audit-logs", {
      method: "GET",
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    await GET(request);

    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ branchId: BRANCH_1 }) }),
    );
  });

  it("AC-3: franchise_admin can query without a branch filter", async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([] as never);

    const request = makeRequest("http://test/api/audit-logs", {
      method: "GET",
      user: { userId: "admin-1", role: "franchise_admin", branchId: null },
    });

    await GET(request);

    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ branchId: undefined }) }),
    );
  });
});
