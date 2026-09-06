// 이메일 발송 게이트웨이. 실제 서비스(Resend 등 — harness_13_tech_conventions.md
// §1) 연동 전까지는 콘솔 로그로 대체한다. att_u1_workorder.md §2 Out of Scope,
// AUTO_CONFIRM_CONTENTS.MD 참고.
export async function sendTempPasswordEmail(to: string, tempPassword: string): Promise<void> {
  console.log(
    `[mock-email] to=${to} subject=임시 비밀번호 안내 tempPassword=${tempPassword}`,
  );
}
