package akylas.alpi.maps;

import akylas.alpi.maps.Martini.Tile;

import android.os.Handler;
import android.os.Looper;
import android.util.Pair;
import android.util.Log;

import com.github.triniwiz.canvas.TNSImageAsset;

import java.nio.ByteBuffer;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

public final class MartiniMesh {
    private static final Handler handler = new Handler(Looper.getMainLooper());


    public interface Callback {
        void onSuccess(@NonNull ByteBuffer var1, @NonNull ByteBuffer var2, @NonNull ByteBuffer var3, @Nullable float[][] var4);

        void onError(@Nullable Throwable var1);
    }


    @NonNull
    public static float[] getTerrain(@NonNull byte[] imageData, int tileSize, @NonNull JSONObject elevationDecoder) throws JSONException {
        float rScaler = (float)elevationDecoder.getDouble("rScaler");
        float bScaler = (float)elevationDecoder.getDouble("bScaler");
        float gScaler = (float)elevationDecoder.getDouble("gScaler");
        float offset = (float)elevationDecoder.getDouble("offset");
        int gridSize = tileSize + 1;
        float[] terrain = new float[gridSize * gridSize];
        int k = 0;
        int r = 0;
        int g = 0;
        int b = 0;
        int x = 0;
        int y = 0;
        int i = 0;

        for (i = 0, y = 0; y < tileSize; y++) {
            for ( x = 0; x < tileSize; x++, i++) {
                k =  (i * 3);
                r = imageData[k + 0];
                g = imageData[k + 1];
                b = imageData[k + 2];
                terrain[i + y] = r * rScaler +  g * gScaler + b * bScaler + offset;
            }
        }

        // backfill bottom border
        for ( i = gridSize * (gridSize - 1), x = 0; x < gridSize - 1; x++, i++) {
            terrain[i] = terrain[i - gridSize];
        }
        // backfill right border
        for ( i = gridSize - 1, y = 0; y < gridSize; y++, i += gridSize) {
            terrain[i] = terrain[i - 1];
        }

        return terrain;
    }

    @NonNull
    public static Pair getMeshAttributes(@NonNull int[] vertices, @NonNull float[] terrain, float tileSize, @NonNull JSONArray bounds) throws JSONException {
        float gridSize = tileSize + 1;
        int numOfVerticies = vertices.length / 2;
        float[] positions = new float[numOfVerticies * 3];
        float[] texCoords = new float[numOfVerticies * 2];
        int minX = bounds.getInt(0);
        int minY = bounds.getInt(1);
        int maxX = bounds.getInt(2);
        int maxY = bounds.getInt(3);
        float xScale = (float) (maxX - minX) / tileSize;
        float yScale = (float) (maxY - minY) / tileSize;

        for (int i = 0; i < numOfVerticies; ++i) {
            int x = vertices[i * 2];
            int y = vertices[i * 2 + 1];
            float pixelIdx = (float) y * gridSize +  x;
            positions[3 * i + 0] = (float) x * xScale + (float) minX;
            positions[3 * i + 1] = (float) (-y) * yScale + (float) maxY;
            positions[3 * i + 2] = terrain[(int) pixelIdx];
            texCoords[2 * i + 0] = (float) x / tileSize;
            texCoords[2 * i + 1] = (float) y / tileSize;
        }

        return new Pair(positions, texCoords);
    }

    @Nullable
    public static float[][] getMeshBoundingBox(@NonNull float[] positions) {
        float minX = Float.MAX_VALUE;
        float minY = Float.MAX_VALUE;
        float minZ = Float.MAX_VALUE;
        float maxX = -Float.MAX_VALUE;
        float maxY = -Float.MAX_VALUE;
        float maxZ = -Float.MAX_VALUE;
        int len = positions.length;
        if (len == 0) {
            return null;
        } else {

            for (int i = 0; i < len; i += 3) {

                float x = positions[i];
                float y = positions[i + 1];
                float z = positions[i + 2];
                minX = x < minX ? x : minX;
                minY = y < minY ? y : minY;
                minZ = z < minZ ? z : minZ;
                maxX = x > maxX ? x : maxX;
                maxY = y > maxY ? y : maxY;
                maxZ = z > maxZ ? z : maxZ;
            }
            return (float[][]) (new float[][]{{minX, minY, minZ}, {maxX, maxY, maxZ}});
        }
    }

    public static void getMartiniTileMesh(@NonNull final ByteBuffer buffer, @NonNull final String terrainOptionsStr, @NonNull final MartiniMesh.Callback callback) {
        Thread thread = new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    TNSImageAsset asset = new TNSImageAsset();
                    byte[] bytes = buffer.array();
                    asset.loadImageFromBytes(bytes);
                    byte[] data = asset.getBytes();
                    int width = asset.getWidth();
                    if (data == null) {
                        MartiniMesh.handler.post((Runnable) (new Runnable() {
                            public final void run() {
                                callback.onError((Exception) null);
                            }
                        }));
                    } else {
                        JSONObject terrainOptions = new JSONObject(terrainOptionsStr);

                        int meshMaxError = terrainOptions.getInt("meshMaxError");
                        JSONArray bounds = terrainOptions.getJSONArray("bounds");
                        JSONObject elevationDecoder = terrainOptions.getJSONObject("elevationDecoder");
                        int gridSize = width + 1;

                        try {
                            float[] terrain = getTerrain(data, width, elevationDecoder);
                            Martini martini = new Martini(gridSize);
                            Tile tile = martini.createTile(terrain);
                            Pair<int[], int[]> result = tile.getMesh(meshMaxError);
                            int[] vertices = result.first;
                            final int[] triangles = result.second;
                            Pair attributes = getMeshAttributes(vertices, terrain, width, bounds);
                            final float[] positions = (float[]) attributes.first;
                            final float[] texCoords = (float[]) attributes.second;
                            float[][] boundingBox = MartiniMesh.getMeshBoundingBox(positions);


                            final ByteBuffer positionsBuffer = ByteBuffer.allocateDirect((int)(positions.length * 8));
                            final ByteBuffer texCoordsBuffer = ByteBuffer.allocateDirect((int)(texCoords.length * 8));
                            final ByteBuffer trianglesBuffer = ByteBuffer.allocateDirect((int)(triangles.length * 4));
                            positionsBuffer.asFloatBuffer().put(positions);
                            texCoordsBuffer.asFloatBuffer().put(texCoords);
                            trianglesBuffer.asIntBuffer().put(triangles);
                            handler.post((Runnable) (new Runnable() {
                                public final void run() {
                                    callback.onSuccess(trianglesBuffer, positionsBuffer, texCoordsBuffer, boundingBox);
                                }
                            }));
                        } catch (final Throwable exception) {
                            exception.printStackTrace();
                            handler.post((Runnable) (new Runnable() {
                                public final void run() {
                                    callback.onError(exception);
                                }
                            }));
                        }

                    }
                } catch (JSONException e) {
                    e.printStackTrace();
                    handler.post((Runnable) (new Runnable() {
                        public final void run() {
                            callback.onError(e);
                        }
                    }));
                }
            }
        });
        thread.start();
    }

}
