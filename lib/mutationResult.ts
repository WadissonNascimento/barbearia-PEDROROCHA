import type { PageFeedbackTone } from "@/lib/pageFeedback";

export type MutationResult<T = void> = {
  ok: boolean;
  message: string;
  tone: PageFeedbackTone;
  data?: T;
};

export function mutationSuccess<T = void>(
  message: string,
  data?: T,
  tone: PageFeedbackTone = "success"
): MutationResult<T> {
  return {
    ok: true,
    message,
    tone,
    ...(data === undefined ? {} : { data }),
  };
}

export function mutationError(
  message: string,
  tone: PageFeedbackTone = "error"
): MutationResult {
  return {
    ok: false,
    message,
    tone,
  };
}
