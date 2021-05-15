package akylas.alpi.maps;

import akylas.alpi.maps.Martini.Tile;

import android.os.Handler;
import android.os.Looper;
import android.util.Pair;

import org.nativescript.canvas.TNSImageAsset;

import java.nio.ByteBuffer;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

public final class MartiniMesh {
    private static final Handler handler = new Handler(Looper.getMainLooper());


    public interface Callback {
        void onSuccess(@NonNull int[] var1, @NonNull double[] var2, @NonNull double[] var3, @Nullable double[][] var4);

        void onError(@Nullable Throwable var1);
    }


    @NonNull
    public static double[] getTerrain(@NonNull byte[] imageData, int tileSize, @NonNull JSONObject elevationDecoder) throws JSONException {
        double rScaler = elevationDecoder.getDouble("rScaler");
        double bScaler = elevationDecoder.getDouble("bScaler");
        double gScaler = elevationDecoder.getDouble("gScaler");
        double offset = elevationDecoder.getDouble("offset");
        int gridSize = tileSize + 1;
        double[] terrain = new double[gridSize * gridSize];
        byte k = 0;
        byte r = 0;
        byte g = 0;
        byte b = 0;
        int i = 0;
        int y = 0;

        int var20;
        for (var20 = tileSize; y < var20; ++y) {
            int var21 = 0;

            for (int var22 = tileSize; var21 < var22; ++var21) {
                k = (byte) (i * 4);
                r = imageData[k + 0];
                g = imageData[k + 1];
                b = imageData[k + 2];
                terrain[i + y] = (double) r * rScaler + (double) g * gScaler + (double) b * bScaler + offset;
                ++i;
            }
        }

        i = gridSize * (gridSize - 1);
        y = 0;

        for (var20 = gridSize; y < var20; ++y) {
            terrain[i] = terrain[i - gridSize];
            ++i;
        }

        i = gridSize - 1;
        y = 0;

        for (var20 = gridSize; y < var20; ++y) {
            terrain[i] = terrain[i - 1];
            i += gridSize;
        }

        return terrain;
    }

    @NonNull
    public static Pair getMeshAttributes(@NonNull int[] vertices, @NonNull double[] terrain, double tileSize, @NonNull JSONArray bounds) throws JSONException {
        double gridSize = tileSize + (double) 1;
        int numOfVerticies = vertices.length / 2;
        double[] positions = new double[numOfVerticies * 3];
        double[] texCoords = new double[numOfVerticies * 2];
        int minX = bounds.getInt(0);
        int minY = bounds.getInt(1);
        int maxX = bounds.getInt(2);
        int maxY = bounds.getInt(3);
        double xScale = (double) (maxX - minX) / tileSize;
        double yScale = (double) (maxY - minY) / tileSize;
        int i = 0;

        for (int var20 = numOfVerticies; i < var20; ++i) {
            int x = vertices[i * 2];
            int y = vertices[i * 2 + 1];
            double pixelIdx = (double) y * gridSize + (double) x;
            positions[3 * i + 0] = (double) x * xScale + (double) minX;
            positions[3 * i + 1] = (double) (-y) * yScale + (double) maxY;
            positions[3 * i + 2] = terrain[(int) pixelIdx];
            texCoords[2 * i + 0] = (double) x / tileSize;
            texCoords[2 * i + 1] = (double) y / tileSize;
        }

        return new Pair(positions, texCoords);
    }

    @Nullable
    public static double[][] getMeshBoundingBox(@NonNull double[] positions) {
        double minX = Double.MAX_VALUE;
        double minY = Double.MAX_VALUE;
        double minZ = Double.MAX_VALUE;
        double maxX = -Double.MAX_VALUE;
        double maxY = -Double.MAX_VALUE;
        double maxZ = -Double.MAX_VALUE;
        int len = positions.length;
        if (len == 0) {
            return null;
        } else {

            for (int i = 0; i < len; i += 3) {

                double x = positions[i];
                double y = positions[i + 1];
                double z = positions[i + 2];
                minX = x < minX ? x : minX;
                minY = y < minY ? y : minY;
                minZ = z < minZ ? z : minZ;
                maxX = x > maxX ? x : maxX;
                maxY = y > maxY ? y : maxY;
                maxZ = z > maxZ ? z : maxZ;
            }
            return (double[][]) (new double[][]{{minX, minY, minZ}, {maxX, maxY, maxZ}});
        }
    }

    public static void getMartiniTileMesh(@NonNull final ByteBuffer buffer, @NonNull final String terrainOptionsStr, @NonNull final MartiniMesh.Callback callback) {
        Thread thread = new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    TNSImageAsset asset = new TNSImageAsset();
                    byte[] var10001 = buffer.array();
                    asset.loadImageFromBytes(var10001);
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
                            double[] terrain = getTerrain(data, width, elevationDecoder);
                            Martini martini = new Martini(gridSize);
                            Tile tile = martini.createTile(terrain);
                            Pair<int[], int[]> result = tile.getMesh(meshMaxError);
                            int[] vertices = result.first;
                            final int[] triangles = result.second;
                            Pair attributes = getMeshAttributes(vertices, terrain, width, bounds);
                            final double[] positions = (double[]) attributes.first;
                            final double[] texCoords = (double[]) attributes.second;
                            double[][] boundingBox = MartiniMesh.getMeshBoundingBox(positions);
                            handler.post((Runnable) (new Runnable() {
                                public final void run() {
                                    callback.onSuccess(triangles, positions, texCoords, boundingBox);
                                }
                            }));
                        } catch (final Throwable exception) {
                            handler.post((Runnable) (new Runnable() {
                                public final void run() {
                                    callback.onError(exception);
                                }
                            }));
                        }

                    }
                } catch (JSONException e) {
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
