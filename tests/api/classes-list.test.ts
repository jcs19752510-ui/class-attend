import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/classes/route";
import { prismaMock } from "../helpers/prismaMock";
import { makeRequest } from "../helpers/request";

describe("GET /api/classes (UI 지원용 추가 엔드포인트)", () => {
  it("returns only classes the teacher is actively assigned to", async () => {
    prismaMock.classTeacher.findMany.mockResolvedValue([
      { class: { id: "class-1", name: "수학반" } },
    ] as never);

    const request = makeRequest("http://test/api/classes", {
      method: "GET",
      user: { userId: "teacher-1", role: "teacher", branchId: "branch-1" },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([{ id: "class-1", name: "수학반" }]);
    expect(prismaMock.classTeacher.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ teacherUserId: "teacher-1" }) }),
    );
  });

  it("forces the director's own branch", async () => {
    prismaMock.class.findMany.mockResolvedValue([] as never);

    const request = makeRequest("http://test/api/classes", {
      method: "GET",
      user: { userId: "director-1", role: "director", branchId: "branch-1" },
    });

    await GET(request);

    expect(prismaMock.class.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { branchId: "branch-1" } }),
    );
  });
});
