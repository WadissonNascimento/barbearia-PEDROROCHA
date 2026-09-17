import { notFound } from "next/navigation";
import VipPlansPreview from "./VipPlansPreview";

export default function PlansPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <VipPlansPreview />;
}
