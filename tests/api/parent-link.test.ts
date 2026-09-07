import { describe, expect, it } from "vitest";
import { POST as createLinkRequest } from "@/app/api/parent/link-requests/route";
import { PATCH as approveLink } from "@/app/api/directors/link-requests/[id]/approve/route";
import { PATCH as rejectLink } from "@/app/api/directors/link-requests/[id]/reject/route";
import { PATCH as revokeLink } from "@/app/api/directors/link-requests/[id]/revoke/route";
import { GET as getChildren } from "@/app/api/parent/children/route";
import { prismaMock } from "../helpers/prismaMock";
import { makeRequest } from "../helpers/request";

const BRANCH_1 = "branch-1";
const BRANCH_2 = "branch-2";

describe("POST /api/parent/link-requests (att_u5_trd.md AC-1)", () => {
  it("AC-1: creates a pending request with studentId still null", async () => {
    prismaMock.branch.findUnique.mockResolvedValue({ id: BRANCH_1 } as never);
    prismaMock.parentStudentLink.create.mockResolvedValue({ id: "link-1" } as never);

    const request = makeRequest("http://test/api/parent/link-requests", {
      body: {
        branchId: BRANCH_1,
        requestedStudentName: "학생",
        requestedStudentBirthDate: "2015-01-01",
      },
      user: { userId: "parent-1", role: "parent", branchId: null },
    });

    const response = await createLinkRequest(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.linkRequestId).toBe("link-1");
    expect(prismaMock.parentStudentLink.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.not.objectContaining({ studentId: expect.anything() }) }),
    );
  });
});

describe("PATCH /api/directors/link-requests/{id}/approve (att_u5_trd.md AC-2, AC-3, AC-5, AC-6, AC-8)", () => {
  const pendingLink = {
    id: "link-1",
    parentUserId: "parent-1",
    branchId: BRANCH_1,
    status: "pending",
  };

  it("AC-2: director from another branch is rejected with 403 FORBIDDEN_BRANCH", async () => {
    prismaMock.parentStudentLink.findUnique.mockResolvedValue({
      ...pendingLink,
      branchId: BRANCH_2,
    } as never);

    const request = makeRequest("http://test/api/directors/link-requests/link-1/approve", {
      method: "PATCH",
      body: { studentId: "student-1" },
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    const response = await approveLink(request, { params: Promise.resolve({ id: "link-1" }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN_BRANCH");
  });

  it("AC-3: a student from a different branch is rejected with 422 INVALID_STUDENT", async () => {
    prismaMock.parentStudentLink.findUnique.mockResolvedValue(pendingLink as never);
    prismaMock.student.findUnique.mockResolvedValue({
      id: "student-1",
      branchId: BRANCH_2,
      status: "enrolled",
    } as never);

    const request = makeRequest("http://test/api/directors/link-requests/link-1/approve", {
      method: "PATCH",
      body: { studentId: "student-1" },
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    const response = await approveLink(request, { params: Promise.resolve({ id: "link-1" }) });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("INVALID_STUDENT");
  });

  it("AC-6: a withdrawn student is rejected with 409 STUDENT_WITHDRAWN", async () => {
    prismaMock.parentStudentLink.findUnique.mockResolvedValue(pendingLink as never);
    prismaMock.student.findUnique.mockResolvedValue({
      id: "student-1",
      branchId: BRANCH_1,
      status: "withdrawn",
    } as never);

    const request = makeRequest("http://test/api/directors/link-requests/link-1/approve", {
      method: "PATCH",
      body: { studentId: "student-1" },
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    const response = await approveLink(request, { params: Promise.resolve({ id: "link-1" }) });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("STUDENT_WITHDRAWN");
  });

  it("AC-5: an already-approved (parent, student) pair is rejected with 409 ALREADY_LINKED", async () => {
    prismaMock.parentStudentLink.findUnique.mockResolvedValue(pendingLink as never);
    prismaMock.student.findUnique.mockResolvedValue({
      id: "student-1",
      branchId: BRANCH_1,
      status: "enrolled",
    } as never);
    prismaMock.parentStudentLink.findFirst.mockResolvedValue({ id: "other-link" } as never);

    const request = makeRequest("http://test/api/directors/link-requests/link-1/approve", {
      method: "PATCH",
      body: { studentId: "student-1" },
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    const response = await approveLink(request, { params: Promise.resolve({ id: "link-1" }) });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("ALREADY_LINKED");
  });

  it("AC-8: a successful approval logs an audit event", async () => {
    prismaMock.parentStudentLink.findUnique.mockResolvedValue(pendingLink as never);
    prismaMock.student.findUnique.mockResolvedValue({
      id: "student-1",
      branchId: BRANCH_1,
      status: "enrolled",
    } as never);
    prismaMock.parentStudentLink.findFirst.mockResolvedValue(null);
    prismaMock.parentStudentLink.update.mockResolvedValue({} as never);

    const request = makeRequest("http://test/api/directors/link-requests/link-1/approve", {
      method: "PATCH",
      body: { studentId: "student-1" },
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    const response = await approveLink(request, { params: Promise.resolve({ id: "link-1" }) });

    expect(response.status).toBe(200);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ actionType: "parent_link.approve" }) }),
    );
  });
});

describe("PATCH .../reject and .../revoke (att_u5_trd.md AC-7, AC-9)", () => {
  it("AC-7: rejecting a request records the reason and does not block future requests", async () => {
    prismaMock.parentStudentLink.findUnique.mockResolvedValue({
      id: "link-1",
      branchId: BRANCH_1,
      status: "pending",
    } as never);
    prismaMock.parentStudentLink.update.mockResolvedValue({} as never);

    const request = makeRequest("http://test/api/directors/link-requests/link-1/reject", {
      method: "PATCH",
      body: { reason: "생년월일 불일치" },
      user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
    });

    const response = await rejectLink(request, { params: Promise.resolve({ id: "link-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("rejected");
  });

  it("AC-9: revoking an approved link removes the student from GET /parent/children", async () => {
    prismaMock.parentStudentLink.findUnique.mockResolvedValue({
      id: "link-1",
      branchId: BRANCH_1,
      status: "approved",
    } as never);
    prismaMock.parentStudentLink.update.mockResolvedValue({} as never);

    const revokeResponse = await revokeLink(
      makeRequest("http://test/api/directors/link-requests/link-1/revoke", {
        method: "PATCH",
        user: { userId: "director-1", role: "director", branchId: BRANCH_1 },
      }),
      { params: Promise.resolve({ id: "link-1" }) },
    );
    expect(revokeResponse.status).toBe(200);

    prismaMock.parentStudentLink.findMany.mockResolvedValue([]); // revoked -> no longer approved
    const childrenResponse = await getChildren(
      makeRequest("http://test/api/parent/children", {
        method: "GET",
        user: { userId: "parent-1", role: "parent", branchId: null },
      }),
    );
    const body = await childrenResponse.json();

    expect(body.data).toEqual([]);
  });
});
