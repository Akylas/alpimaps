/**
 * Asking the system for a screen orientation, for the one mode that needs it.
 *
 * There is no NativeScript API for this — both platforms want their own call, and iOS changed its
 * one in 16 — so it lives here as a platform split rather than inline in the peak finder.
 */

/**
 * Turns the app landscape, either way up, until `unlockOrientation`.
 *
 * @returns whether the system took it. False when the platform refused (or has no way to ask), so a
 * caller can decide whether its layout still works — nothing here throws.
 */
export function lockLandscape(): boolean;

/** Hands the orientation back to the system / the user's rotation lock. */
export function unlockOrientation(): void;
