import { setTestSession, getCurrentSession } from "../../lib/auth";

async function main() {
  if (typeof setTestSession !== "function") {
    console.error("DIAGNOSTIC_ERROR: setTestSession is not exported as a function from lib/auth");
    process.exit(1);
  }

  setTestSession({
    userId: "mock-user-guard",
    username: "mock.guard",
    name: "Mock Guard User",
    role: "MT",
    staffId: "staff-guard-01",
  });

  const session = await getCurrentSession();
  console.log("RESULT_SESSION_ID:" + (session?.userId || "NULL"));
}

main().catch((err: unknown) => {
  const error = err as Error;
  console.error("ERROR:", error?.message || String(err));
  process.exit(1);
});
