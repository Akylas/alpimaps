import { BitmapShader, Canvas, Matrix, Paint, Style, TileMode } from '@nativescript-community/ui-canvas';
import { Color, ImageSource, knownFolders, path } from '@nativescript/core';

/**
 * Hatching rather than colour: e-ink renders the `surfaceColors` palette as indistinguishable greys.
 * Tiles from `assets/images/surfaces` (see `generate.py` there) repeated by a shader, one drawRect per band.
 */
export type SurfacePattern = 'solid' | 'brick' | 'fine_dots' | 'coarse_dots' | 'dashes' | 'diagonal' | 'cross' | 'ladder' | 'chevron';

export const surfacePatterns: { [id: string]: SurfacePattern } = {
    highway: 'solid',
    street: 'solid',
    road: 'solid',
    paved: 'solid',
    paved_smooth: 'solid',
    cycleway: 'solid',
    paved_rough: 'brick',
    compacted: 'fine_dots',
    gravel: 'coarse_dots',
    dirt: 'dashes',
    track: 'diagonal',
    path: 'cross',
    steps: 'ladder',
    sac_scale_1: 'cross',
    sac_scale_2: 'cross',
    sac_scale_3: 'cross',
    sac_scale_4: 'chevron',
    sac_scale_5: 'chevron',
    sac_scale_6: 'chevron'
};

/** In canvas units. The files are 48px so they stay crisp instead of being upscaled. */
const TILE_SIZE = 12;
const TILES_FOLDER = path.join(knownFolders.currentApp().path, 'assets', 'images', 'surfaces');

const fillPaint = new Paint();
fillPaint.setStyle(Style.FILL);
const patternPaint = new Paint();
patternPaint.setStyle(Style.FILL);
/** a shader only depends on the pattern and on which of the two tile colours it uses */
const shaderCache: { [key: string]: BitmapShader } = {};

export interface SurfaceBandOptions {
    id: string;
    left: number;
    right: number;
    top: number;
    bottom: number;
    fillColor: Color | string | number;
    patternColor: Color | string | number;
}

export function drawSurfaceBand(canvas: Canvas, { bottom, fillColor, id, left, patternColor, right, top }: SurfaceBandOptions) {
    fillPaint.setColor(fillColor);
    canvas.drawRect(left, top, right, bottom, fillPaint);
    const pattern = surfacePatterns[id] || 'cross';
    if (pattern === 'solid' || right - left <= 0) {
        return;
    }
    const shader = getPatternShader(pattern, patternColor);
    if (!shader) {
        return;
    }
    patternPaint.setShader(shader);
    canvas.drawRect(left, top, right, bottom, patternPaint);
}

function getPatternShader(pattern: SurfacePattern, color: Color | string | number) {
    // a shader cannot be recoloured the same way on both platforms, so the tiles ship in the only two
    // colours they are ever drawn in: the theme's "on surface" is either near black or near white
    const shaded = new Color(color as any);
    const light = (shaded.r * 299 + shaded.g * 587 + shaded.b * 114) / 1000 > 140;
    const key = pattern + (light ? '_light' : '');
    if (!shaderCache[key]) {
        try {
            const image = ImageSource.fromFileSync(path.join(TILES_FOLDER, key + '.png'));
            if (!image) {
                return null;
            }
            const shader = new BitmapShader(image, TileMode.REPEAT, TileMode.REPEAT);
            // the tile is authored at 48px but drawn at TILE_SIZE canvas units, which are density
            // independent: without this it would cover 48 of them and tile four times too coarsely
            const matrix = new Matrix();
            const scale = TILE_SIZE / image.width;
            matrix.setScale(scale, scale);
            shader.setLocalMatrix(matrix);
            shaderCache[key] = shader;
        } catch (error) {
            // a throw here would abort the whole widget half drawn; a band without hatching is still readable
            console.error('failed to load the surface pattern', key, error);
            return null;
        }
    }
    return shaderCache[key];
}
