import { BRAND } from "~/config/brand";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "~/components/ui/button";
import { auth } from "~/server/auth";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="bg-background flex min-h-screen flex-col items-center justify-center px-4">
      <div className="flex max-w-2xl flex-col items-center gap-6 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">
          {BRAND.productName}
        </h1>
        <p className="text-muted-foreground text-lg">
          Upload a podcast or video and get vertical, captioned short-form clips
          ready for TikTok, Shorts, and Reels.
        </p>
        <div className="flex gap-4">
          <Button asChild size="lg">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/signup">Sign up</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
