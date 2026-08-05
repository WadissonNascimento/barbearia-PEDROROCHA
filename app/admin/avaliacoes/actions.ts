"use server";

import {
  mutationError,
  mutationSuccess,
  type MutationResult,
} from "@/lib/mutationResult";
import { prisma } from "@/lib/prisma";
import { requireTenantSession, SHOP_ADMIN_ROLES } from "@/lib/tenantSession";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  return requireTenantSession({
    roles: SHOP_ADMIN_ROLES,
  });
}

function revalidateReviewViews() {
  revalidatePath("/");
  revalidatePath("/avaliacoes");
  revalidatePath("/admin");
  revalidatePath("/admin/avaliacoes");
}

export async function toggleReviewVisibilityAction(
  formData: FormData
): Promise<MutationResult> {
  const { shopId } = await requireAdmin();

  const reviewId = String(formData.get("reviewId") || "").trim();

  if (!reviewId) {
    return mutationError("Avaliação inválida.");
  }

  const review = await prisma.review.findFirst({
    where: {
      id: reviewId,
      shopId,
    },
    select: {
      isVisible: true,
    },
  });

  if (!review) {
    return mutationError("Avaliação não encontrada.");
  }

  await prisma.review.updateMany({
    where: {
      id: reviewId,
      shopId,
    },
    data: {
      isVisible: !review.isVisible,
    },
  });

  revalidateReviewViews();
  return mutationSuccess(
    review.isVisible ? "Avaliação ocultada da home." : "Avaliação publicada novamente."
  );
}

export async function deleteReviewAction(
  formData: FormData
): Promise<MutationResult> {
  const { shopId } = await requireAdmin();

  const reviewId = String(formData.get("reviewId") || "").trim();

  if (!reviewId) {
    return mutationError("Avaliação inválida.");
  }

  await prisma.review.deleteMany({
    where: {
      id: reviewId,
      shopId,
    },
  });

  revalidateReviewViews();
  return mutationSuccess("Avaliação excluida com sucesso.");
}
