package akylas.alpi.maps;

import android.util.Pair;

import java.util.Arrays;

import androidx.annotation.NonNull;

public class Martini {
    private int gridSize = 257;
    private int numTriangles;
    private int numParentTriangles;
    @NonNull
    private int[] indices;
    @NonNull
    private int[] coords;

    public final int getGridSize() {
        return this.gridSize;
    }

    public final void setGridSize(int var1) {
        this.gridSize = var1;
    }

    public final int getNumTriangles() {
        return this.numTriangles;
    }

    public final int getNumParentTriangles() {
        return this.numParentTriangles;
    }


    @NonNull
    public final int[] getIndices() {
        return this.indices;
    }

    public final void setIndices(@NonNull int[] var1) {
        this.indices = var1;
    }

    @NonNull
    public final int[] getCoords() {
        return this.coords;
    }

    public final void setCoords(@NonNull int[] var1) {
        this.coords = var1;
    }

    @NonNull
    public final Martini.Tile createTile(@NonNull float[] terrain) throws Throwable {
        return new Martini.Tile(terrain, this);
    }

    public Martini(int gridSize) throws Throwable {
        this.gridSize = gridSize;
        int tileSize = gridSize - 1;
        if ((tileSize & tileSize - 1) == 1) {
            throw (Throwable) (new Exception("Expected grid size to be 2^n+1, got " + gridSize));
        } else {
            this.numTriangles = tileSize * tileSize * 2 - 2;
            this.numParentTriangles = this.numTriangles - tileSize * tileSize;
            this.indices = new int[this.gridSize * this.gridSize];
            this.coords = new int[this.numTriangles * 4];
            int id = 0;
            int ax = 0;
            int ay = 0;
            int bx = 0;
            int by = 0;
            int cx = 0;
            int cy = 0;
            for (int i = 0; i < this.numTriangles; i++) {
                id = i + 2;
                ax = 0;
                ay = 0;
                bx = 0;
                by = 0;
                cx = 0;
                cy = 0;
                if ((id & 1) == 1) {
                    bx = tileSize;
                    by = tileSize;
                    cx = tileSize;
                } else {
                    ax = tileSize;
                    ay = tileSize;
                    cy = tileSize;
                }

                int mx;
                for (id >>= 1; id > 1; id >>= 1) {
                    mx = ax + bx >> 1;
                    int my = ay + by >> 1;
                    if ((id & 1) == 1) {
                        bx = ax;
                        by = ay;
                        ax = cx;
                        ay = cy;
                    } else {
                        ax = bx;
                        ay = by;
                        bx = cx;
                        by = cy;
                    }

                    cx = mx;
                    cy = my;
                }

                mx = i * 4;
                this.coords[mx + 0] = ax;
                this.coords[mx + 1] = ay;
                this.coords[mx + 2] = bx;
                this.coords[mx + 3] = by;
            }
        }

    }

    static final class Tile {
        @NonNull
        private final float[] terrain;
        @NonNull
        private final Martini martini;
        private final float[] errors;
        private int meshNumTriangles;
        private int meshNumVertices;
        private int[] indices;
        private int size;
        private int[] vertices;
        private int[] triangles;
        private int triIndex;

        public final void update() {
            int numTriangles = this.martini.getNumTriangles();
            int numParentTriangles = this.martini.getNumParentTriangles();
            int[] coords = this.martini.getCoords();
            int size = this.martini.getGridSize();

            for (int i = numTriangles - 1; i >= 0; --i) {
                int k = i * 4;
                int ax = coords[k + 0];
                int ay = coords[k + 1];
                int bx = coords[k + 2];
                int by = coords[k + 3];
                int mx = ax + bx >> 1;
                int my = ay + by >> 1;
                int cx = mx + my - ay;
                int cy = my + ax - mx;
                float interpolatedHeight = (this.terrain[ay * size + ax] + this.terrain[by * size + bx]) / (float) 2;
                int middleIndex = my * size + mx;
                float middleError = Math.abs(interpolatedHeight - this.terrain[middleIndex]);
                this.errors[middleIndex] = Math.max(this.errors[middleIndex], middleError);
                if (i < numParentTriangles) {
                    int leftChildIndex = (ay + cy >> 1) * size + (ax + cx >> 1);
                    int rightChildIndex = (by + cy >> 1) * size + (bx + cx >> 1);
                    errors[middleIndex] = Math.max(errors[middleIndex], Math.max(errors[leftChildIndex], errors[rightChildIndex]));
                }
            }

        }

        public final void processTriangle(int ax, int ay, int bx, int by, int cx, int cy, int maxError) {
            int mx = ax + bx >> 1;
            int my = ay + by >> 1;
            if (Math.abs(ax - cx) + Math.abs(ay - cy) > 1 && this.errors[my * this.size + mx] > (float) maxError) {
                this.processTriangle(cx, cy, ax, ay, mx, my, maxError);
                this.processTriangle(bx, by, cx, cy, mx, my, maxError);
            } else {
                int a = this.indices[ay * this.size + ax] - 1;
                int b = this.indices[by * this.size + bx] - 1;
                int c = this.indices[cy * this.size + cx] - 1;
                this.vertices[2 * a] = ax;
                this.vertices[2 * a + 1] = ay;
                this.vertices[2 * b] = bx;
                this.vertices[2 * b + 1] = by;
                this.vertices[2 * c] = cx;
                this.vertices[2 * c + 1] = cy;
                this.triangles[triIndex++] = a;
                this.triangles[triIndex++] = b;
                this.triangles[triIndex++] = c;
            }

        }

        public final void countElements(int ax, int ay, int bx, int by, int cx, int cy, int maxError) {
            int mx = ax + bx >> 1;
            int my = ay + by >> 1;
            if (Math.abs(ax - cx) + Math.abs(ay - cy) > 1 && errors[my * size + mx] > maxError) {
                countElements(cx, cy, ax, ay, mx, my, maxError);
                countElements(bx, by, cx, cy, mx, my, maxError);
            } else {
                if (indices[ay * size + ax] == 0) {
                    indices[ay * size + ax] = ++meshNumVertices;
                }
                if (indices[by * size + bx] == 0) {
                    indices[by * size + bx] = ++meshNumVertices;
                }
                if (indices[cy * size + cx] == 0) {
                    indices[cy * size + cx] = ++meshNumVertices;
                }
                meshNumTriangles++;
            }

        }

        @NonNull
        public final Pair<int[], int[]> getMesh(int maxError) {
            meshNumVertices = 0;
            meshNumTriangles = 0;
            int max = size - 1;

            Arrays.fill(indices, 0);
            this.countElements(0, 0, max, max, max, 0, maxError);
            this.countElements(max, max, 0, 0, 0, max, maxError);
            this.vertices = new int[meshNumVertices * 2];
            this.triangles = new int[meshNumTriangles * 3];
            this.triIndex = 0;
            this.processTriangle(0, 0, max, max, max, 0, maxError);
            this.processTriangle(max, max, 0, 0, 0, max, maxError);
            return new Pair(this.vertices, this.triangles);
        }

        public Tile(@NonNull float[] terrain, @NonNull Martini martini) throws Throwable {
            super();

            this.terrain = terrain;
            this.martini = martini;
            indices = martini.getIndices();
            size = martini.getGridSize();
            if (terrain.length != size * size) {
                throw (Throwable) (new Exception("Expected terrain data of length " + size * size + " (" + size + " x " + size + "), got " + terrain.length + '.'));
            } else {
                this.errors = new float[terrain.length];
                this.update();
            }
        }
    }
}

