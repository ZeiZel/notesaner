/** Payload for the OPTIMIZE_IMAGE_JOB BullMQ job. */
export interface OptimizeImageJobData {
  /** UUID of the attachment to process. */
  attachmentId: string;
}

/** Structured result returned by the image optimizer processor. */
export interface OptimizeImageJobResult {
  attachmentId: string;
  /** True when the attachment was skipped (non-image or not found). */
  skipped: boolean;
  /** Absolute path of the 150×150 WebP thumbnail. Present when skipped=false. */
  thumb150Path?: string;
  /** Absolute path of the 300×300 WebP thumbnail. Present when skipped=false. */
  thumb300Path?: string;
  /** Absolute path of the optimized WebP variant. Present when skipped=false. */
  optimizedPath?: string;
  durationMs: number;
}
