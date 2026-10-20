/**
 * Exponential backoff with full jitter
 * Based on AWS Architecture Blog recommendations
 */

export interface BackoffOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
  maxAttempts?: number;
}

const DEFAULT_BASE_DELAY_MS = 2000; // 2 seconds
const DEFAULT_MAX_DELAY_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_MAX_ATTEMPTS = 10;

export function calculateBackoff(
  attempt: number,
  options: BackoffOptions = {}
): number {
  const baseDelay = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelay = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  
  const jitter = Math.random() * exponentialDelay;
  
  return Math.floor(jitter);
}

export function shouldRetry(attempt: number, options: BackoffOptions = {}): boolean {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  return attempt < maxAttempts;
}

export interface RetryState {
  attempts: number;
  nextAttemptAt: number | null;
  lastError: string | null;
}

export function createRetryState(): RetryState {
  return {
    attempts: 0,
    nextAttemptAt: null,
    lastError: null,
  };
}

export function recordFailure(
  state: RetryState,
  error: Error | string,
  options: BackoffOptions = {}
): RetryState {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const newAttempts = state.attempts + 1;
  
  if (!shouldRetry(newAttempts, options)) {
    return {
      attempts: newAttempts,
      nextAttemptAt: null,
      lastError: errorMessage,
    };
  }
  
  const backoffMs = calculateBackoff(newAttempts, options);
  
  return {
    attempts: newAttempts,
    nextAttemptAt: Date.now() + backoffMs,
    lastError: errorMessage,
  };
}

export function resetRetryState(): RetryState {
  return createRetryState();
}

export function isReadyToRetry(state: RetryState, now: number = Date.now()): boolean {
  if (state.nextAttemptAt === null) {
    return false;
  }
  return now >= state.nextAttemptAt;
}
