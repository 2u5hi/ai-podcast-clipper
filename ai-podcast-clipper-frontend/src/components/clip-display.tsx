"use client";

import type { Clip } from "@prisma/client";
import { AlertTriangle, Download, Loader2, RotateCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getClipPlayUrl } from "~/actions/generation";
import { Button } from "./ui/button";

type TileState =
  | { kind: "loading" }
  | { kind: "ready"; url: string }
  | { kind: "error"; message: string };

function ClipCard({ clip }: { clip: Clip }) {
  const [state, setState] = useState<TileState>({ kind: "loading" });

  // a fresh signed URL each time, so Retry also recovers from an expired one
  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const result = await getClipPlayUrl(clip.id);
      setState(
        result.success && result.url
          ? { kind: "ready", url: result.url }
          : { kind: "error", message: "This clip couldn't be loaded." },
      );
    } catch {
      setState({ kind: "error", message: "This clip couldn't be loaded." });
    }
  }, [clip.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDownload = () => {
    if (state.kind !== "ready") return;
    const link = document.createElement("a");
    link.href = state.url;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex max-w-52 flex-col gap-2">
      <div className="bg-muted flex aspect-[9/16] items-center justify-center overflow-hidden rounded-md">
        {state.kind === "loading" && (
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        )}
        {state.kind === "ready" && (
          <video
            src={state.url}
            controls
            preload="metadata"
            className="h-full w-full object-cover"
            // a URL that signs fine can still be refused by S3 (permissions, a deleted file)
            onError={() =>
              setState({
                kind: "error",
                message: "This clip couldn't be played.",
              })
            }
          />
        )}
        {state.kind === "error" && (
          <div
            role="alert"
            className="flex flex-col items-center gap-2 p-3 text-center"
          >
            <AlertTriangle className="h-6 w-6 text-amber-600" />
            <p className="text-muted-foreground text-sm">{state.message}</p>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RotateCw className="mr-1.5 h-4 w-4" />
              Retry
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Button
          onClick={handleDownload}
          variant="outline"
          size="sm"
          disabled={state.kind !== "ready"}
        >
          <Download className="mr-1.5 h-4 w-4" />
          Download
        </Button>
      </div>
    </div>
  );
}

export function ClipDisplay({ clips }: { clips: Clip[] }) {
  if (clips.length === 0) {
    return (
      <p className="text-muted-foreground p-4 text-center">
        No clips generated yet.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {clips.map((clip) => (
        <ClipCard key={clip.id} clip={clip} />
      ))}
    </div>
  );
}
