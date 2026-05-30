export type FormFeedbackState = {
  error: string | null;
  success: string | null;
};

export const initialFormFeedbackState: FormFeedbackState = {
  error: null,
  success: null,
};
