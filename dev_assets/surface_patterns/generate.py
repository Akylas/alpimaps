#!/usr/bin/env python3
"""Regenerates the surface hatching tiles in app/assets/images/surfaces, used by app/utils/surfacePattern.ts.

Each tile is seamless: every stroke either runs corner to corner or is repeated at the tile period,
so nothing shows at the joins when the shader repeats it. Drawn at 4x and downsampled for smooth
edges, then shipped in two colours because the pattern is tinted by the theme's "on surface" colour
and a shader cannot be recoloured portably.

    python3 dev_assets/surface_patterns/generate.py
"""

import os

from PIL import Image, ImageDraw

TILE = 48
SUPERSAMPLE = 4
STROKE = 4
HALF = TILE // 2
QUARTER = TILE // 4

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'app', 'assets', 'images', 'surfaces')


def diagonals(draw, scale, direction):
    # unbounded range of offsets, so the set of lines maps onto itself every tile
    for offset in range(-TILE, TILE * 2 + 1, HALF):
        start = (offset * scale, TILE * scale)
        end = ((offset + direction * TILE) * scale, 0)
        draw.line([start, end], fill=255, width=STROKE * scale)


def draw_pattern(draw, name, scale):
    def line(x1, y1, x2, y2):
        draw.line([(x1 * scale, y1 * scale), (x2 * scale, y2 * scale)], fill=255, width=STROKE * scale)

    def dot(x, y, radius):
        draw.ellipse(
            [((x - radius) * scale, (y - radius) * scale), ((x + radius) * scale, (y + radius) * scale)],
            fill=255,
        )

    if name == 'diagonal':
        diagonals(draw, scale, 1)
    elif name == 'cross':
        diagonals(draw, scale, 1)
        diagonals(draw, scale, -1)
    elif name == 'ladder':
        # rungs only: stairs read as a stack of treads
        line(0, 0, TILE, 0)
        line(0, HALF, TILE, HALF)
    elif name == 'brick':
        line(0, 0, TILE, 0)
        line(0, HALF, TILE, HALF)
        # the joints of one course sit mid way along the course below it
        line(0, 0, 0, HALF)
        line(HALF, HALF, HALF, TILE)
    elif name == 'fine_dots':
        dot(QUARTER, QUARTER, 3)
        dot(3 * QUARTER, 3 * QUARTER, 3)
    elif name == 'coarse_dots':
        # bigger and more of them: loose stones rather than a bound surface
        dot(QUARTER, QUARTER, 5)
        dot(3 * QUARTER, 3 * QUARTER, 5)
        dot(3 * QUARTER, QUARTER, 3)
        dot(QUARTER, 3 * QUARTER, 3)
    elif name == 'dashes':
        # scuffed ground: broken strokes, offset row to row so no line ever forms
        line(2, QUARTER, HALF - 2, QUARTER)
        line(HALF + 2, 3 * QUARTER, TILE - 2, 3 * QUARTER)
    elif name == 'chevron':
        # arrows pointing up the difficulty, for the alpine end of the sac scale
        line(0, TILE, HALF, HALF)
        line(HALF, HALF, TILE, TILE)
        line(0, HALF, HALF, 0)
        line(HALF, 0, TILE, HALF)
    else:
        raise ValueError('unknown pattern ' + name)


def build(name):
    size = TILE * SUPERSAMPLE
    # drawn as a mask, so the same shape can be written out in either colour
    mask = Image.new('L', (size, size), 0)
    draw_pattern(ImageDraw.Draw(mask), name, SUPERSAMPLE)
    mask = mask.resize((TILE, TILE), Image.LANCZOS)

    for suffix, rgb in (('', (0, 0, 0)), ('_light', (255, 255, 255))):
        tile = Image.new('RGBA', (TILE, TILE), rgb + (0,))
        tile.putalpha(mask)
        tile.save(os.path.join(OUT, f'{name}{suffix}.png'))


for pattern in ('brick', 'chevron', 'coarse_dots', 'cross', 'dashes', 'diagonal', 'fine_dots', 'ladder'):
    build(pattern)
    print('wrote', pattern)
