/**
 * `auto` hands the decision back to the system, which is also what respects a rotation lock. `sensor`
 * follows the device even with the rotation locked (android; iOS cannot, and treats it as `auto`).
 */
export type ScreenOrientation = 'auto' | 'sensor' | 'landscape' | 'portrait';

/**
 * Holds until something asks for `auto`.
 * @returns false when the platform refused or has no way to ask; never throws.
 */
export function lockOrientation(orientation: ScreenOrientation): boolean;
