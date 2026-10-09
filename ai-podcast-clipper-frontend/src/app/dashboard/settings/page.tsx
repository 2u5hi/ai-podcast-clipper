import { redirect } from "next/navigation";
import { WatermarkSettings } from "~/components/watermark-settings";
import { BRAND } from "~/config/brand";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { hasPurchasedCredits } from "~/server/watermark";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { watermarkText: true },
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <WatermarkSettings
        canCustomize={await hasPurchasedCredits(session.user.id)}
        current={user.watermarkText}
        houseWatermark={BRAND.houseWatermark}
      />
    </div>
  );
}
