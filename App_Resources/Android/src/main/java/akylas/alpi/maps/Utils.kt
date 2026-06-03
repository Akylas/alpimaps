package akylas.alpi.maps;

import android.annotation.SuppressLint
import android.content.ContentResolver
import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Log
import java.io.IOException
import kotlin.concurrent.thread


/**
 * This class contains helper functions for processing images
 *
 * @constructor creates image util
 */
class Utils {
    companion object {
        @SuppressLint("Range")
        fun getFileNameSync(context: Context, uri: Uri): String? {
            var result: String? = null
            if (uri.scheme == "content") {
                val cursor: Cursor? = context.contentResolver.query(uri, null, null, null, null)
                try {
                    if (cursor != null && cursor.moveToFirst()) {
                        result =
                            cursor.getString(cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME))
                    }
                } finally {
                    cursor!!.close()
                }
            }
            if (result == null) {
                result = uri.lastPathSegment
            }
            return result
        }
        fun getFileNameSync(context: Context, src: String): String? {
            return getFileNameSync(context, Uri.parse(src))
        }
        fun getFileName(context: Context, src: String, callback: FunctionCallback) {
            thread(start = true) {
                try {
                    callback.onResult(null, getFileNameSync(context, Uri.parse(src)))
                } catch (e: Exception) {
                    callback.onResult(e, null)
                }
            }
        }
    }
}