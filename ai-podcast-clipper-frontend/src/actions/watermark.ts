"use server";

import { revalidatePath } from "next/cache";
import { parseWatermarkText } from "~/lib/watermark";
import { requireVerifiedUserId } from "~/server/accounts";
import { db } from "~/server/db";
import { hasPurchasedCredits } from "~/server/watermark";

export async function updateWatermark(
  input: string,
): Promise<{ success: boolean; error?: string }> {
  const userId = await requireVerifiedUserId();

  if (!(await hasPurchasedCredits(userId))) {
    return {
      success: false,
      error: "Buy any credit pack to use your own watermark",
    };
  }

  const parsed = parseWatermarkText(input);
  if (!parsed.ok) return { success: false, error: parsed.error };

  await db.user.update({
    where: { id: userId },
    data: { watermarkText: parsed.text },
  });
  revalidatePath("/dashboard/settings");
  return { success: true };
}
