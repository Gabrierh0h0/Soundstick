package app.soundstick;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

/**
 * Mantiene viva la app (y su conexión) mientras se vincula WhatsApp: al pasar a WhatsApp para escribir
 * el código, Android cortaría la red de una app en segundo plano y la vinculación se perdería.
 * Solo corre durante la vinculación; se detiene al terminar o cancelar.
 */
public class WaKeepAliveService extends Service {
    private static final String CHANNEL = "soundstick_link";

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Vinculación", NotificationManager.IMPORTANCE_LOW));
        }
        Notification n = new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(getApplicationInfo().icon)
                .setContentTitle("Soundstick")
                .setContentText("Vinculando WhatsApp. Escribe el código y vuelve a la app.")
                .setOngoing(true)
                .build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(4721, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(4721, n);
        }
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
