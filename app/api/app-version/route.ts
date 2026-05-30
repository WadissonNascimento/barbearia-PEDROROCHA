const runtimeVersion =
  process.env.NEXT_PUBLIC_APP_VERSION ||
  process.env.APP_VERSION ||
  process.env.GIT_COMMIT_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  `runtime-${Date.now()}`;

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      version: runtimeVersion,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
      },
    }
  );
}
