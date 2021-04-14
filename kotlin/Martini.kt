package akylas.alpi.maps

open class Martini {
    var gridSize = 257;
    var numTriangles: Int
    var numParentTriangles: Int
    var indices: IntArray
    var coords: IntArray

    constructor(gridSize: Int) {
        this.gridSize = gridSize
        val tileSize = gridSize - 1
        if (tileSize and (tileSize - 1) == 1) {
            throw Exception("Expected grid size to be 2^n+1, got " + gridSize);
        }
        this.numTriangles = tileSize * tileSize * 2 - 2;
        this.numParentTriangles = this.numTriangles - tileSize * tileSize;

        this.indices = IntArray(this.gridSize * this.gridSize);

        // coordinates for all possible triangles in an RTIN tile
        this.coords = IntArray(this.numTriangles * 4);

        // get triangle coordinates from its index in an implicit binary tree
        var id: Int;
        var ax: Int;
        var ay: Int;
        var bx: Int;
        var by: Int;
        var cx: Int;
        var cy: Int;
        for (i in 0..this.numTriangles - 1) {
            id = i + 2;
            ax = 0; ay = 0; bx = 0; by = 0; cx = 0; cy = 0;
            if (id and 1 == 1) {
                bx = tileSize; // bottom-left triangle
                by = tileSize; // bottom-left triangle
                cx = tileSize; // bottom-left triangle
            } else {
                ax = tileSize; // top-right triangle
                ay = tileSize; // top-right triangle
                cy = tileSize; // top-right triangle
            }
            id = id shr 1;
            while ((id) > 1) {
                var mx = (ax + bx) shr 1;
                var my = (ay + by) shr 1;

                if (id and 1 == 1) { // left half
                    bx = ax; by = ay;
                    ax = cx; ay = cy;
                } else { // right half
                    ax = bx; ay = by;
                    bx = cx; by = cy;
                }
                cx = mx; cy = my;
                id = id shr 1;
            }
            val k = i * 4;
            this.coords[k + 0] = ax;
            this.coords[k + 1] = ay;
            this.coords[k + 2] = bx;
            this.coords[k + 3] = by;
        }
    }

    fun createTile(terrain: DoubleArray): Tile {
        return Tile(terrain, this);
    }

    class Tile {
        val terrain: DoubleArray
        val martini: Martini

        val errors: DoubleArray

        constructor(terrain: DoubleArray, martini: Martini) {
            val size = martini.gridSize;
            if (terrain.size !== size * size) {
                throw Exception(

                        "Expected terrain data of length ${size * size} (${size} x ${size}), got ${terrain.size}.");
            }
            this.terrain = terrain;
            this.martini = martini;
            this.errors = DoubleArray(terrain.size);
            this.update();
        }

        fun update() {
            val numTriangles = this.martini.numTriangles
            val numParentTriangles = this.martini.numParentTriangles
            val coords = this.martini.coords
            val size = this.martini.gridSize

            // iterate over all possible triangles, starting from the smallest level
            for (i in (numTriangles - 1) downTo 0) {

                var k = i * 4;
                var ax = coords[k + 0];
                var ay = coords[k + 1];
                var bx = coords[k + 2];
                var by = coords[k + 3];
                var mx = (ax + bx) shr 1;
                var my = (ay + by) shr 1;
                var cx = mx + my - ay;
                var cy = my + ax - mx;

                // calculate error in the middle of the long edge of the triangle
                val interpolatedHeight = (terrain[ay * size + ax] + terrain[by * size + bx]) / 2;
                val middleIndex = my * size + mx;
                val middleError = Math.abs(interpolatedHeight - terrain[middleIndex]);

                errors[middleIndex] = Math.max(errors[middleIndex], middleError);

                if (i < numParentTriangles) { // bigger triangles; accumulate error with children
                    val leftChildIndex = ((ay + cy) shr 1) * size + ((ax + cx) shr 1);
                    val rightChildIndex = ((by + cy) shr 1) * size + ((bx + cx) shr 1);
                    errors[middleIndex] = maxOf(errors[middleIndex], errors[leftChildIndex], errors[rightChildIndex]);
                }
            }
        }

        var meshNumTriangles: Int = 0
        var meshNumVertices: Int = 0
        var indices: IntArray = IntArray(0);
        var size: Int = 0
        var vertices: IntArray = IntArray(0);
        var triangles: IntArray = IntArray(0);
        var triIndex = 0;
        fun processTriangle(ax: Int, ay: Int, bx: Int, by: Int, cx: Int, cy: Int, maxError: Int) {
            val mx = (ax + bx) shr 1;
            val my = (ay + by) shr 1;

            if (Math.abs(ax - cx) + Math.abs(ay - cy) > 1 && errors[my * size + mx] > maxError) {
                // triangle doesn't approximate the surface well enough; drill down further
                processTriangle(cx, cy, ax, ay, mx, my, maxError);
                processTriangle(bx, by, cx, cy, mx, my, maxError);

            } else {
                // add a triangle
                val a = indices[ay * size + ax] - 1;
                val b = indices[by * size + bx] - 1;
                val c = indices[cy * size + cx] - 1;

                vertices[2 * a] = ax;
                vertices[2 * a + 1] = ay;

                vertices[2 * b] = bx;
                vertices[2 * b + 1] = by;

                vertices[2 * c] = cx;
                vertices[2 * c + 1] = cy;

                triangles[triIndex++] = a;
                triangles[triIndex++] = b;
                triangles[triIndex++] = c;
            }
        }

        fun countElements(ax: Int, ay: Int, bx: Int, by: Int, cx: Int, cy: Int, maxError: Int) {
            val mx = (ax + bx) shr 1;
            val my = (ay + by) shr 1;

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

        fun getMesh(maxError: Int = 0): Pair<IntArray, IntArray> {
            var size = this.martini.gridSize
            var indices = this.martini.indices
            var numVertices = 0;
            var numTriangles = 0;
            val max = size - 1;

            // use an index grid to keep track of vertices that were already used to avoid duplication
            indices.fill(0);

            // retrieve mesh in two stages that both traverse the error map:
            // - countElements: find used vertices (and assign each an index), and count triangles (for minimum allocation)
            // - processTriangle: fill the allocated vertices & triangles typed arrays

            countElements(0, 0, max, max, max, 0, maxError);
            countElements(max, max, 0, 0, 0, max, maxError);

            vertices = IntArray(numVertices * 2);
            triangles = IntArray(numTriangles * 3);
            triIndex = 0;


            processTriangle(0, 0, max, max, max, 0, maxError);
            processTriangle(max, max, 0, 0, 0, max, maxError);

            return Pair(vertices, triangles);
        }
    }
}

