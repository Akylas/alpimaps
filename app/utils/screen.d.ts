export const DEFAULT_SCREEN_REFRESH_DELAY: number;

/** Turns on / refreshes the screen on eink devices. No-op on iOS. */
export function requestScreenRefresh(delay?: number);
