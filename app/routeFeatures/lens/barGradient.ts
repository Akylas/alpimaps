/** A bar as one view's background: hard-edged stops, each segment as wide as its size. Null when there is nothing to draw. */
export function barGradient(segments: { color: string; size: number }[]): string | null {
    const total = segments.reduce((sum, segment) => sum + segment.size, 0);
    if (!segments.length || total <= 0) {
        return null;
    }
    let end = 0;
    const stops = segments.map(({ color, size }) => {
        const start = end;
        end += (size / total) * 100;
        return `${color} ${start.toFixed(2)}%, ${color} ${end.toFixed(2)}%`;
    });
    return `linear-gradient(to right, ${stops.join(', ')})`;
}
