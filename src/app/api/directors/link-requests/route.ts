import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";

// docs/trd/att_u5_trd.md §2: GET /directors/link-requests?status=pending
// §7 확정: 이름+생년월일 정확 일치 시 candidateStudentId를 함께 제공.
export async function GET(request: Request) {
  try {
    const ctx = authenticate(request, { allowedRoles: ["director"] });
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "pending";

    const links = await prisma.parentStudentLink.findMany({
      where: { branchId: ctx.branchId!, status: status as never },
      orderBy: { requestedAt: "desc" },
    });

    const withCandidates = await Promise.all(
      links.map(async (link) => {
        const candidate = await prisma.student.findFirst({
          where: {
            branchId: link.branchId,
            name: link.requestedStudentName,
            birthDate: link.requestedStudentBirthDate,
          },
        });
        return { ...link, candidateStudentId: candidate?.id ?? null };
      }),
    );

    return NextResponse.json({ data: withCandidates });
  } catch (err) {
    return toErrorResponse(err);
  }
}
