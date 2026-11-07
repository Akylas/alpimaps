/** On e-ink a category is a shade of black, as a grade is: this says which, and what grey it looks like. Pure: nothing here may import NativeScript. */

/** The grey a shade (the alpha of black, 0 to 255) looks like on white. */
export function shadeGrey(shade: number): string {
    const value = 255 - Math.min(Math.max(Math.round(shade), 0), 255);
    const hex = value.toString(16).padStart(2, '0');
    return `#${hex}${hex}${hex}`;
}
