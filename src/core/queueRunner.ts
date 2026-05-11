import { RetryableError } from "./types";

export interface QueueProgress {
  total: number;
  completed: number;
  success: number;
  failed: number;
  inFlight: number;
  currentTitle?: string;
}

export interface QueueOptions {
  maxConcurrency: number;
  minRequestIntervalMs: number;
  maxRetries: number;
}

interface RetryContext {
  attempt: number;
  waitForRateLimit: () => Promise<void>;
}

class IntervalGate {
  private nextAllowedAt = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly minIntervalMs: number) {}

  async waitTurn() {
    if (this.minIntervalMs <= 0) {
      return;
    }

    let release!: () => void;
    const previous = this.queue;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;

    const delay = Math.max(0, this.nextAllowedAt - Date.now());
    if (delay > 0) {
      await Zotero.Promise.delay(delay);
    }

    this.nextAllowedAt = Date.now() + this.minIntervalMs;
    release();
  }
}

function shouldRetryError(error: unknown): boolean {
  const retryable = error as RetryableError;
  if (typeof retryable?.shouldRetry === "boolean") {
    return retryable.shouldRetry;
  }

  const status = retryable?.status;
  if (status == null) {
    return true;
  }

  return status === 408 || status === 409 || status === 429 || status >= 500;
}

async function withRetries<TResult>(
  fn: (attempt: number) => Promise<TResult>,
  maxRetries: number,
): Promise<TResult> {
  let attempt = 0;

  while (true) {
    try {
      return await fn(attempt);
    } catch (error) {
      if (attempt >= maxRetries || !shouldRetryError(error)) {
        throw error;
      }
      const backoffMs = Math.min(30000, 1000 * 2 ** attempt);
      await Zotero.Promise.delay(backoffMs);
      attempt += 1;
    }
  }
}

export async function runConcurrentQueue<TTask, TResult>(
  tasks: TTask[],
  options: QueueOptions,
  worker: (task: TTask, context: RetryContext) => Promise<TResult>,
  onProgress?: (progress: QueueProgress) => void,
): Promise<
  Array<{ ok: true; value: TResult } | { ok: false; error: unknown }>
> {
  const total = tasks.length;
  const results: Array<
    { ok: true; value: TResult } | { ok: false; error: unknown }
  > = new Array(total);

  let nextIndex = 0;
  let completed = 0;
  let success = 0;
  let failed = 0;
  let inFlight = 0;

  const gate = new IntervalGate(options.minRequestIntervalMs);

  const workerCount = Math.max(1, Math.min(options.maxConcurrency, total || 1));

  const loops = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= total) {
        return;
      }

      const task = tasks[index];
      inFlight += 1;

      try {
        const value = await withRetries(async (attempt) => {
          return worker(task, {
            attempt,
            waitForRateLimit: async () => gate.waitTurn(),
          });
        }, options.maxRetries);
        results[index] = { ok: true, value };
        success += 1;
      } catch (error) {
        results[index] = { ok: false, error };
        failed += 1;
      } finally {
        inFlight -= 1;
        completed += 1;

        onProgress?.({
          total,
          completed,
          success,
          failed,
          inFlight,
        });
      }
    }
  });

  await Promise.all(loops);
  return results;
}
