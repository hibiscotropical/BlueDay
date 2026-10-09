package br.com.daylist.backup;

import android.Manifest;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;
import org.json.JSONException;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class BlueDayBackupPlugin extends CordovaPlugin {
    private static final int WRITE_PERMISSION_REQUEST = 7314;
    private static final String DOWNLOAD_DIRECTORY = "Blue Day";
    private CallbackContext pendingCallback;
    private String pendingContents;
    private String pendingFileName;

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext)
            throws JSONException {
        if (!"save".equals(action)) {
            return false;
        }

        String contents = args.getString(0);
        String fileName = args.getString(1);
        if (contents.length() == 0 || !fileName.matches("day-list-backup-[0-9T-]+\\.enc")) {
            callbackContext.error("O conteúdo ou nome do arquivo de backup é inválido.");
            return true;
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
                !cordova.hasPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)) {
            pendingCallback = callbackContext;
            pendingContents = contents;
            pendingFileName = fileName;
            cordova.requestPermission(this, WRITE_PERMISSION_REQUEST,
                    Manifest.permission.WRITE_EXTERNAL_STORAGE);
            return true;
        }

        saveBackup(contents, fileName, callbackContext);
        return true;
    }

    @Override
    public void onRequestPermissionResult(int requestCode, String[] permissions,
                                          int[] grantResults) {
        if (requestCode != WRITE_PERMISSION_REQUEST || pendingCallback == null) {
            return;
        }

        CallbackContext callback = pendingCallback;
        String contents = pendingContents;
        String fileName = pendingFileName;
        pendingCallback = null;
        pendingContents = null;
        pendingFileName = null;

        if (grantResults.length == 0 || grantResults[0] != PackageManager.PERMISSION_GRANTED) {
            callback.error("Permita o acesso ao armazenamento para salvar o backup em Downloads.");
            return;
        }
        saveBackup(contents, fileName, callback);
    }

    private void saveBackup(String contents, String fileName, CallbackContext callbackContext) {
        cordova.getThreadPool().execute(() -> {
            try {
                String savedPath = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                        ? saveWithMediaStore(contents, fileName)
                        : saveToLegacyDownloads(contents, fileName);
                callbackContext.success(savedPath);
            } catch (Exception error) {
                callbackContext.error("Não foi possível salvar o backup em Downloads: " +
                        error.getMessage());
            }
        });
    }

    private String saveWithMediaStore(String contents, String fileName) throws Exception {
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
        values.put(MediaStore.Downloads.MIME_TYPE, "application/json");
        values.put(MediaStore.Downloads.RELATIVE_PATH,
                Environment.DIRECTORY_DOWNLOADS + File.separator + DOWNLOAD_DIRECTORY);
        values.put(MediaStore.Downloads.IS_PENDING, 1);

        Uri collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        Uri fileUri = cordova.getContext().getContentResolver().insert(collection, values);
        if (fileUri == null) {
            throw new IllegalStateException("O Android não criou o arquivo de destino.");
        }

        try (OutputStream output = cordova.getContext().getContentResolver()
                .openOutputStream(fileUri)) {
            if (output == null) {
                throw new IllegalStateException("Não foi possível abrir o arquivo de destino.");
            }
            output.write(contents.getBytes(StandardCharsets.UTF_8));
        } catch (Exception error) {
            cordova.getContext().getContentResolver().delete(fileUri, null, null);
            throw error;
        }

        ContentValues published = new ContentValues();
        published.put(MediaStore.Downloads.IS_PENDING, 0);
        int publishedCount = cordova.getContext().getContentResolver()
                .update(fileUri, published, null, null);
        if (publishedCount == 0) {
            cordova.getContext().getContentResolver().delete(fileUri, null, null);
            throw new IllegalStateException("O Android não publicou o arquivo de backup.");
        }

        try (Cursor cursor = cordova.getContext().getContentResolver()
                .query(fileUri, new String[]{
                        MediaStore.Downloads.IS_PENDING,
                        MediaStore.Downloads.SIZE
                }, null, null, null)) {
            if (cursor == null || !cursor.moveToFirst() ||
                    cursor.getInt(0) != 0 || cursor.getLong(1) == 0) {
                cordova.getContext().getContentResolver().delete(fileUri, null, null);
                throw new IllegalStateException("O arquivo de backup não ficou disponível em Downloads.");
            }
        }
        return "Downloads/" + DOWNLOAD_DIRECTORY + "/" + fileName;
    }

    @SuppressWarnings("deprecation")
    private String saveToLegacyDownloads(String contents, String fileName) throws Exception {
        File directory = new File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                DOWNLOAD_DIRECTORY);
        if (!directory.exists() && !directory.mkdirs()) {
            throw new IllegalStateException("Não foi possível criar a pasta de backup.");
        }

        File file = new File(directory, fileName);
        try (FileOutputStream output = new FileOutputStream(file)) {
            output.write(contents.getBytes(StandardCharsets.UTF_8));
        }
        MediaScannerConnection.scanFile(
                cordova.getContext(), new String[]{file.getAbsolutePath()}, null, null);
        return "Downloads/" + DOWNLOAD_DIRECTORY + "/" + fileName;
    }
}
