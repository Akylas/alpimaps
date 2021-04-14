package akylas.alpi.maps;

import java.util.Map;
import java.util.Arrays;
import java.util.ArrayList;
import java.util.concurrent.ConcurrentHashMap;
import java.io.FileOutputStream;
import java.io.File;

import org.json.JSONObject;
import org.json.JSONArray;
import org.json.JSONException;

import com.carto.core.MapTile;
import com.carto.core.BinaryData;
import com.carto.datasources.TileDataSource;
import com.carto.datasources.components.TileData;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.os.Handler;
import android.util.Log;
import android.content.Context;

public final class Three {
    private final static int basePlaneDimension = 65024;
    private final static int size = 128;
    private final static SphericalMercator tilePixels = new SphericalMercator(128);

    private final static int cols = 512;
    private final static int rows = 512;
    private final static int scaleFactor = 4;

    public static boolean RUN_ON_MAIN_THREAD = false;
    static Handler mainHandler = null;

    static ArrayList<int[][]> sixteenthPixelRanges;
    static {
        sixteenthPixelRanges = new ArrayList();
        for (int c = 0; c < scaleFactor; c++) {
            for (int r = 0; r < scaleFactor; r++) {
                // pixel ranges
                sixteenthPixelRanges.add(
                        new int[][] { new int[] { r * (rows / scaleFactor - 1) + r, ((r + 1) * rows) / scaleFactor },
                                new int[] { c * (cols / scaleFactor - 1) + c, ((c + 1) * cols) / scaleFactor } });
            }
        }
    }

    public static interface GetElevationMeshesCallback {
        void onResult(java.lang.Exception param0, String result);
    }

    static final double mPerPixel(double latitude, double tileSize, double zoom) {
        return Math.abs((40075000 * Math.cos((latitude * Math.PI) / 180)) / (Math.pow(2, zoom) * tileSize));
    }

    static final int[] deslash(String s) {
        String[] array = s.split("/");
        int[] result = new int[array.length];
        for (int i = 0; i < array.length; i++) {
            result[i] = Integer.parseInt(array[i]);
        }
        return result;
    }

    static final String slash(int[] s) {
        return String.valueOf(s[0]) + "/" + String.valueOf(s[1]) + "/" + String.valueOf(s[2]);
    }

    public static void getElevationMeshesAsync(Context context, TileDataSource dataSource, String options,
            GetElevationMeshesCallback callback) {
        Thread thread = new Thread(new Runnable() {
            @Override
            public void run() {
                String result = null;
                try {
                    result = getElevationMeshes(context, dataSource, options);
                } catch (final Exception e) {
                    e.printStackTrace();
                    if (RUN_ON_MAIN_THREAD) {
                        if (mainHandler == null) {
                            mainHandler = new Handler(android.os.Looper.getMainLooper());
                        }
                        mainHandler.post(new Runnable() {
                            @Override
                            public void run() {
                                callback.onResult(e, null);
                            }
                        });
                    } else {
                        callback.onResult(e, null);
                    }
                    return;
                }

                final String fRa = result;
                if (RUN_ON_MAIN_THREAD) {
                    if (mainHandler == null) {
                        mainHandler = new Handler(android.os.Looper.getMainLooper());
                    }
                    mainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            callback.onResult(null, fRa);
                        }
                    });
                } else {
                    callback.onResult(null, fRa);
                }
            }
        });
        thread.start();
    }

    public static String getElevationMeshes(Context context, TileDataSource dataSource, String options) throws JSONException {
        // Log.d("JS", "getElevationMeshes " + options);
        JSONObject mainObject = new JSONObject(options);
        JSONArray coords = mainObject.getJSONArray("coords");
        JSONArray tilesJSON = mainObject.getJSONArray("tiles");
        ArrayList<String> tiles = new ArrayList<>();
        for (int i = 0; i < tilesJSON.length(); i++) {
            tiles.add(tilesJSON.getString(i));
        }
        int z = coords.getInt(0);
        int x = coords.getInt(1);
        int y = coords.getInt(2);
        TileData data = dataSource.loadTile(new MapTile(x,y, z, 0));
        String s1 = slash(new int[]{x, y, z});

        // console.log(time+' started #'+parserIndex)

        double[] elevations;
        BinaryData binaryData = data.getData();
        if (binaryData != null) {
            // let pixels;
            // const data = dataSource.loadTile(new com.carto.core.MapTile(coords[1],
            // coords[2], coords[0], 0));
            // if (s1.equals("1056/734/11")) {
            //     File path = context.getFilesDir();
            //     File file = new File(path, "test.png");
            //     try {
            //         FileOutputStream stream = new FileOutputStream(file);
            //         stream.write(binaryData.getData());
            //         stream.close();
            //     } catch(final Exception e){
            //     } finally {
            //     }
            // }

            Bitmap bmp = BitmapFactory.decodeByteArray(binaryData.getData(), 0, (int) binaryData.size());
            int w = bmp.getWidth();
            int h = bmp.getHeight();
            // final int[] pixels = new int[w * h];
            // pixels = Array.create('int', w * h);
            // bmp.getPixels(pixels, 0, w, 0, 0, w, h);
            int pix, R, G, B, index;
            long length = w * h;
            elevations = new double[(int) length];
            // colors => elevations
            // if (s1.equals("1056/734/11")) {
            //     Log.d("JS", "handling elevation image px " +  s1+ " "  +  w+ " " + h);
            // }
            for (int py = 0; py < h; py++) {
                for (int px = 0; px < w; px++) {
                    index = py * w + px;
                    pix = bmp.getPixel(px, py);
                    R = (pix >> 16) & 0xff;     //bitwise shifting
                    G = (pix >> 8) & 0xff;
                    B = pix & 0xff;
                    elevations[index] = (-10000.0 + (R * 256.0 * 256.0 + G * 256.0 + B) * 0.1);
                    // if (s1.equals("1056/734/11")) {
                    //     Log.d("JS", "elevations px " +  s1+ " "  + px + " "  + py + " "  +  index+ " " + R+ " " + G+ " " + B+ " " + elevations[index]);
                    // }
                    // elevations.push((R * 256 + G + B / 256) - 32768)
                }
            }
            bmp.recycle();
        } else {
            elevations = new double[1048576];
            Arrays.fill(elevations, 0);
        }
        // figure out tile coordinates of the 16 grandchildren of this tile
        ArrayList<String> sixteenths = new ArrayList<String>();
        for (int c = 0; c < scaleFactor; c++) {
            for (int r = 0; r < scaleFactor; r++) {
                // tile coordinates
                sixteenths.add(String.valueOf(z + 2) + "/" + String.valueOf(x * scaleFactor + c) + "/"
                        + String.valueOf(y * scaleFactor + r));
            }
        }

        // iterate through sixteenths...

        double tileSize = (basePlaneDimension / Math.pow(2, z + 2));
        long vertices = size;
        long segments = vertices - 1;
        double segmentLength = tileSize / segments;
        //             if (s1.equals("1056/734/11")) {
        // Log.d("JS", "tileSize " +  basePlaneDimension+ " " +  z+ " " + tileSize);
        //             }

        JSONObject meshes = new JSONObject();
        // check 16 grandchildren of this terrain tile
        for (int i = 0; i < sixteenths.size(); i++) {
            String s = sixteenths.get(i);
            // if this grandchild is actually in view, proceed...
            if (tiles.contains(s)) {
                // imagesDownloaded++;
                int[] d = deslash(s);
                int[][] pxRange = sixteenthPixelRanges.get(i);
                ArrayList<Double> elev = new ArrayList<Double>();

                double xOffset = (d[1] + 0.5) * tileSize - basePlaneDimension / 2;
                double yOffset = (d[2] + 0.5) * tileSize - basePlaneDimension / 2;

                // grab its elevations from the 4x4 grid
                for (int r = pxRange[0][0]; r < pxRange[0][1]; r++) {
                    for (int c = pxRange[1][0]; c < pxRange[1][1]; c++) {
                        int currentPixelIndex = r * cols + c;
                        elev.add(elevations[currentPixelIndex]);
                    }
                }
                JSONArray array = new JSONArray();
                int dataIndex = 0;

                // iterate through rows
                for (int r = 0; r < vertices; r++) {
                    double yPx = d[2] * size + r;
                    double[] px = new double[] { (x * tileSize), yPx };
                    double pixelLat = tilePixels.ll(px, d[0])[1]; // latitude of this pixel
                    double metersPerPixel = mPerPixel(pixelLat, tileSize, d[0]); // real-world distance this pixel
                                                                                 // represents

                    // y position of vertex in world pixel coordinates
                    double yPos = -r * segmentLength + tileSize / 2;
                    // Log.d("JS", "vertices " +  r+ " " + yPx+ " " +  pixelLat+ " " +  metersPerPixel+ " " +  yPos);

                    // iterate through columns
                    for (int c = 0; c < vertices; c++) {
                        double   xPos = c * segmentLength - tileSize / 2;
                        array.put((xPos + xOffset));
                        array.put((elev.get(dataIndex) / metersPerPixel));
                        array.put((-yPos + yOffset));
                        dataIndex++;
                    }
                }
                meshes.put(s, array);
            }
        }
        return meshes.toString();
    }
}