const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const JAVA_PACKAGE = 'com.citygo';
const JAVA_DIR = path.join('android', 'app', 'src', 'main', 'java', 'com', 'citygo');

function ensurePermission(manifest, name) {
  manifest['uses-permission'] = manifest['uses-permission'] || [];
  const exists = manifest['uses-permission'].some((permission) => permission.$['android:name'] === name);
  if (!exists) {
    manifest['uses-permission'].push({ $: { 'android:name': name } });
  }
}

function ensureApplicationChild(app, tagName, androidName, value) {
  app[tagName] = app[tagName] || [];
  const existing = app[tagName].find((entry) => entry.$?.['android:name'] === androidName);
  if (existing) {
    existing.$ = { ...existing.$, ...value.$ };
    if (value['intent-filter']) existing['intent-filter'] = value['intent-filter'];
    return;
  }
  app[tagName].push(value);
}

function writeFileIfChanged(filePath, contents) {
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === contents) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

const keepAliveServiceKt = `package ${JAVA_PACKAGE}

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class KeepAliveService : Service() {
    companion object {
        const val CHANNEL_ID = "citygo_keepalive_channel"
        const val NOTIF_ID = 9001
        const val ACTION_STOP = "com.citygo.STOP_KEEPALIVE"
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        createChannel()
        startForeground(NOTIF_ID, buildNotification())
        return START_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        val restartIntent = Intent(applicationContext, KeepAliveService::class.java).apply {
            setPackage(packageName)
        }
        val pendingIntent = PendingIntent.getService(
            applicationContext,
            1,
            restartIntent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )
        val alarmManager = getSystemService(ALARM_SERVICE) as android.app.AlarmManager
        alarmManager.set(
            android.app.AlarmManager.ELAPSED_REALTIME,
            android.os.SystemClock.elapsedRealtime() + 1_000,
            pendingIntent
        )
        super.onTaskRemoved(rootIntent)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "CityGo activo",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Mantiene CityGo activo para recibir solicitudes"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val openAppIntent = packageManager
            .getLaunchIntentForPackage(packageName)
            ?.apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP }

        val pendingOpen = PendingIntent.getActivity(
            this,
            0,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("CityGo activo")
            .setContentText("Estás disponible para recibir solicitudes de carrera")
            .setSmallIcon(R.drawable.ic_notification)
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(pendingOpen)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
}
`;

const keepAliveModuleKt = `package ${JAVA_PACKAGE}

import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class KeepAliveModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "KeepAlive"

    @ReactMethod
    fun start() {
        Log.d("CityGo:KeepAlive", "start() llamado desde JS")
        saveDriverOnline(true)
        val intent = Intent(reactContext, KeepAliveService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }
    }

    @ReactMethod
    fun stop() {
        Log.d("CityGo:KeepAlive", "stop() llamado desde JS")
        saveDriverOnline(false)
        val intent = Intent(reactContext, KeepAliveService::class.java).apply {
            action = KeepAliveService.ACTION_STOP
        }
        reactContext.startService(intent)
    }

    private fun saveDriverOnline(online: Boolean) {
        reactContext
            .getSharedPreferences("CityGoPrefs", Context.MODE_PRIVATE)
            .edit()
            .putBoolean("driverOnline", online)
            .apply()
    }
}
`;

const keepAlivePackageKt = `package ${JAVA_PACKAGE}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class KeepAlivePackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> =
        listOf(KeepAliveModule(ctx))

    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`;

const bootReceiverKt = `package ${JAVA_PACKAGE}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        Log.d("CityGo:BootReceiver", "onReceive: $action")

        val relevant = action == Intent.ACTION_BOOT_COMPLETED ||
            action == "android.intent.action.QUICKBOOT_POWERON" ||
            action == Intent.ACTION_MY_PACKAGE_REPLACED

        if (!relevant) return

        val prefs = context.getSharedPreferences("CityGoPrefs", Context.MODE_PRIVATE)
        val driverOnline = prefs.getBoolean("driverOnline", false)
        if (!driverOnline) return

        val serviceIntent = Intent(context, KeepAliveService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
    }
}
`;

function withKeepAliveAndroid(config) {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    ensurePermission(manifest, 'android.permission.FOREGROUND_SERVICE');
    ensurePermission(manifest, 'android.permission.FOREGROUND_SERVICE_LOCATION');
    ensurePermission(manifest, 'android.permission.RECEIVE_BOOT_COMPLETED');
    ensurePermission(manifest, 'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS');
    ensurePermission(manifest, 'android.permission.WAKE_LOCK');

    const app = manifest.application[0];
    ensureApplicationChild(app, 'service', '.KeepAliveService', {
      $: {
        'android:name': '.KeepAliveService',
        'android:enabled': 'true',
        'android:exported': 'false',
        'android:foregroundServiceType': 'location',
        'android:stopWithTask': 'false',
      },
    });

    ensureApplicationChild(app, 'receiver', '.BootReceiver', {
      $: {
        'android:name': '.BootReceiver',
        'android:enabled': 'true',
        'android:exported': 'true',
      },
      'intent-filter': [
        {
          action: [
            { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
            { $: { 'android:name': 'android.intent.action.QUICKBOOT_POWERON' } },
            { $: { 'android:name': 'android.intent.action.MY_PACKAGE_REPLACED' } },
          ],
          category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
        },
      ],
    });

    return config;
  });

  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const javaDir = path.join(projectRoot, JAVA_DIR);
      writeFileIfChanged(path.join(javaDir, 'KeepAliveService.kt'), keepAliveServiceKt);
      writeFileIfChanged(path.join(javaDir, 'KeepAliveModule.kt'), keepAliveModuleKt);
      writeFileIfChanged(path.join(javaDir, 'KeepAlivePackage.kt'), keepAlivePackageKt);
      writeFileIfChanged(path.join(javaDir, 'BootReceiver.kt'), bootReceiverKt);

      const mainApplicationPath = path.join(javaDir, 'MainApplication.kt');
      if (fs.existsSync(mainApplicationPath)) {
        let contents = fs.readFileSync(mainApplicationPath, 'utf8');
        if (!contents.includes('add(KeepAlivePackage())')) {
          contents = contents.replace(
            'PackageList(this).packages.apply {',
            'PackageList(this).packages.apply {\n              add(KeepAlivePackage())'
          );
          fs.writeFileSync(mainApplicationPath, contents);
        }
      }

      return config;
    },
  ]);
}

module.exports = withKeepAliveAndroid;
