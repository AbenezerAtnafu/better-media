import { NextResponse } from "next/server";
import { getQueuedJobs, clearQueuedJobs } from "@/lib/tracking-job-adapter";
import type { BackgroundJobPayload } from "better-media";

/** POST: Process queued background jobs (simulates worker) */
export async function POST() {
  try {
    const { getMedia } = await import("@/lib/media");
    const media = await getMedia();
    const jobs = getQueuedJobs();
    const results: Array<{ payload: unknown; status: "ok" | "error"; error?: string }> = [];

    for (const job of jobs) {
      try {
        await media.runBackgroundJob(job.payload as unknown as BackgroundJobPayload);
        results.push({ payload: job.payload, status: "ok" });
      } catch (err) {
        results.push({
          payload: job.payload,
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    clearQueuedJobs();

    return NextResponse.json({
      success: true,
      processed: jobs.length,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
