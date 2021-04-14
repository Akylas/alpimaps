package akylas.alpi.maps

import com.github.triniwiz.canvas.TNSImageAsset
import org.json.JSONArray
import org.json.JSONObject
import java.lang.Exception
import java.nio.ByteBuffer
import java.util.concurrent.Executors
import android.os.Handler
import android.os.Looper


class MartiniMesh {
    interface Callback {
        fun onSuccess(triangles: IntArray, positions: DoubleArray, texCoords: DoubleArray, boundingBox: Array<Array<Double>>?)
        fun onError(error: Exception?)
    }

    companion object {

        private val handler = Handler(Looper.getMainLooper())

        @JvmStatic
        private val executor = Executors.newCachedThreadPool()

        fun getTerrain(imageData: ByteArray, tileSize: Int, elevationDecoder: JSONObject): DoubleArray {
            val rScaler = elevationDecoder.getDouble("rScaler")
            val bScaler = elevationDecoder.getDouble("bScaler")
            val gScaler = elevationDecoder.getDouble("gScaler")
            val offset = elevationDecoder.getDouble("offset")

            val gridSize = tileSize + 1;
            // From Martini demo
            // https://observablehq.com/@mourner/martin-real-time-rtin-terrain-mesh
            val terrain = DoubleArray(gridSize * gridSize);
            // decode terrain values
            var k: Byte
            var r: Byte
            var g: Byte
            var b: Byte;
            var i = 0;
            for (y in 0 until tileSize) {
                for (x in 0 until tileSize) {
                    k = (i * 4).toByte();
                    r = imageData[k + 0];
                    g = imageData[k + 1];
                    b = imageData[k + 2];
                    terrain[i + y] = r * rScaler + g * gScaler + b * bScaler + offset;
                    i++;
                }
            }
            // backfill bottom border
            i = gridSize * (gridSize - 1);
            for (x in 0 until gridSize) {
                terrain[i] = terrain[i - gridSize];
                i++;
            }
            i = gridSize - 1;
            // backfill right border
            for (y in 0 until gridSize) {
                terrain[i] = terrain[i - 1];
                i += gridSize;
            }
            return terrain;
        }

        fun getMeshAttributes(vertices: IntArray, terrain: DoubleArray, tileSize: Double, bounds: JSONArray): Pair<DoubleArray, DoubleArray> {
            val gridSize = tileSize + 1;
            val numOfVerticies = vertices.size / 2;
            // vec3. x, y in pixels, z in meters
            val positions = DoubleArray(numOfVerticies * 3);
            // vec2. 1 to 1 relationship with position. represents the uv on the texture image. 0,0 to 1,1.
            val texCoords = DoubleArray(numOfVerticies * 2);
            val minX = bounds.getInt(0);
            val minY = bounds.getInt(1);
            val maxX = bounds.getInt(2);
            val maxY = bounds.getInt(3);
//        const [minX, minY, maxX, maxY] = bounds || [0, 0, tileSize, tileSize];
            val xScale = (maxX - minX) / tileSize;
            val yScale = (maxY - minY) / tileSize;

            for (i in 0 until numOfVerticies) {
                val x = vertices[i * 2];
                val y = vertices[i * 2 + 1];
                val pixelIdx = y * gridSize + x;

                positions[3 * i + 0] = x * xScale + minX;
                positions[3 * i + 1] = -y * yScale + maxY;
                positions[3 * i + 2] = terrain[pixelIdx.toInt()];

                texCoords[2 * i + 0] = x / tileSize;
                texCoords[2 * i + 1] = y / tileSize;
            }

            return Pair(positions, texCoords)
        }

        fun getMeshBoundingBox(positions: DoubleArray): Array<Array<Double>>? {
            var minX = Double.MAX_VALUE;
            var minY = Double.MAX_VALUE;
            var minZ = Double.MAX_VALUE;
            var maxX = -Double.MAX_VALUE;
            var maxY = -Double.MAX_VALUE;
            var maxZ = -Double.MAX_VALUE;

            val len = positions.size;

            if (len == 0) {
                return null;
            }

            for (i in 0 until len step 3) {
                val x = positions[i];
                val y = positions[i + 1];
                val z = positions[i + 2];

                minX = if (x < minX) x else minX;
                minY = if (y < minY) y else minY;
                minZ = if (z < minZ) z else minZ;

                maxX = if (x > maxX) x else maxX;
                maxY = if (y > maxY) y else maxY;
                maxZ = if (z > maxZ) z else maxZ;
            }
            return arrayOf(arrayOf(minX, minY, minZ), arrayOf(maxX, maxY, maxZ));
        }

        @JvmStatic
        fun getMartiniTileMesh(buffer: ByteBuffer, terrainOptionsStr: String, callback: Callback) {
            executor.execute {
                val asset = TNSImageAsset()
                asset.loadImageFromBytes(buffer.array())
                val data = asset.bytes;
                val width = asset.width;

                if (data == null) {
                    handler.post {
                        callback.onError(null)
                    }
                    return@execute;
                }
                val terrainOptions = JSONObject(terrainOptionsStr);
                val meshMaxError = terrainOptions.getInt("meshMaxError")
                val bounds = terrainOptions.getJSONArray("bounds")
                val elevationDecoder = terrainOptions.getJSONObject("elevationDecoder")

                val gridSize = width + 1;
                try {
                    val terrain = getTerrain(data, width, elevationDecoder);

                    val martini = Martini(gridSize);
                    val tile = martini.createTile(terrain);
                    val (vertices, triangles) = tile.getMesh(meshMaxError);

                    val (positions, texCoords) = getMeshAttributes(vertices, terrain, width.toDouble(), bounds);
                    var boundingBox = getMeshBoundingBox(positions);
                    handler.post {
                        callback.onSuccess(triangles, positions, texCoords, boundingBox);
                    }
                } catch (exception: Exception) {
                    handler.post {
                        callback.onError(exception)
                    }
                }
            }
        }
    }

}