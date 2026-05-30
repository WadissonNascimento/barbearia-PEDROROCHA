export type PageFeedbackTone = "error" | "success" | "info";

export function buildFeedbackRedirect(
  path: string,
  message: string,
  tone: PageFeedbackTone = "success"
) {
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);

  params.set("feedback", message);
  params.set("tone", tone);

  return `${pathname}?${params.toString()}`;
}

export function readPageFeedback(searchParams?: {
  feedback?: string;
  tone?: string;
}) {
  const message = searchParams?.feedback ?? null;

  if (!message) {
    return null;
  }

  const tone =
    searchParams?.tone === "success" ||
    searchParams?.tone === "info" ||
    searchParams?.tone === "error"
      ? searchParams.tone
      : "info";

  return {
    message,
    tone,
  } as const;
}
