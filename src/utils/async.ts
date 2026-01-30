/**
 * Sleep utility using Bun.sleep for Promise-based delays.
 */
export const sleep = (ms: number): Promise<void> => Bun.sleep(ms);
