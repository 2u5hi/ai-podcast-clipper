"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { updateWatermark } from "~/actions/watermark";
import { MAX_WATERMARK_LENGTH } from "~/lib/watermark";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function WatermarkSettings({
  canCustomize,
  current,
  houseWatermark,
}: {
  canCustomize: boolean;
  current: string | null;
  houseWatermark: string;
}) {
  const [text, setText] = useState(current ?? "");
  const [saving, setSaving] = useState(false);

  const save = async (value: string) => {
    setSaving(true);
    try {
      const result = await updateWatermark(value);
      if (result.success) {
        setText(value.trim());
        toast.success(
          value.trim() ? "Watermark saved" : "Watermark turned off",
          { description: "It applies to clips from your next upload." },
        );
      } else {
        toast.error("Couldn't save the watermark", {
          description: result.error,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Watermark</CardTitle>
        <CardDescription>
          {canCustomize
            ? "Your text is burned into the top-right corner of every clip. Leave it empty for no watermark."
            : `Clips made with free credits carry the ${houseWatermark} watermark. Buy any credit pack to use your own text, or none, at no extra cost.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {canCustomize ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save(text);
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="watermark">Watermark text</Label>
              <Input
                id="watermark"
                value={text}
                maxLength={MAX_WATERMARK_LENGTH}
                placeholder="@yourpodcast"
                onChange={(e) => setText(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Up to {MAX_WATERMARK_LENGTH} characters: letters, numbers,
                spaces, and common symbols.
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving || text === ""}
                onClick={() => void save("")}
              >
                No watermark
              </Button>
            </div>
          </form>
        ) : (
          <Button asChild>
            <Link href="/dashboard/billing">See credit packs</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
