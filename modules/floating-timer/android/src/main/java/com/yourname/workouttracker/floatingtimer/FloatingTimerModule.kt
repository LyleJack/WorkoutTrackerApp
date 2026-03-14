package com.yourname.workouttracker.floatingtimer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule

@ReactModule(name = FloatingTimerModule.NAME)
class FloatingTimerModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    companion object { const val NAME = "FloatingTimer" }

    override fun getName() = NAME

    // Receive PONG broadcast from service and forward to JS
    private val pongReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val remaining = intent.getIntExtra(FloatingTimerService.EXTRA_REMAINING, 0)
            val running   = intent.getBooleanExtra(FloatingTimerService.EXTRA_RUNNING, false)
            val params    = Arguments.createMap().apply {
                putInt("remaining", remaining)
                putBoolean("running", running)
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("FloatingTimerPong", params)
        }
    }

    init {
        val filter = IntentFilter(FloatingTimerService.BROADCAST_PONG)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            reactContext.registerReceiver(pongReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            reactContext.registerReceiver(pongReceiver, filter)
        }
    }

    @ReactMethod fun hasPermission(promise: Promise) { promise.resolve(canDrawOverlays()) }

    @ReactMethod
    fun requestPermission() {
        if (canDrawOverlays()) return
        val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${reactContext.packageName}"))
            .apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
        reactContext.startActivity(intent)
    }

    @ReactMethod
    fun show(seconds: Int, isDark: Boolean) {
        if (!canDrawOverlays()) { requestPermission(); return }
        val bgColor   = if (isDark) Color.parseColor("#0a0a0a") else Color.parseColor("#ffffff")
        val ringColor = if (isDark) Color.parseColor("#6C63FF") else Color.parseColor("#5a52e8")
        val textColor = if (isDark) Color.parseColor("#e8e8ff") else Color.parseColor("#0f0f1a")
        startService(Intent(reactContext, FloatingTimerService::class.java).apply {
            action = FloatingTimerService.ACTION_SHOW
            putExtra(FloatingTimerService.EXTRA_SECONDS,    seconds)
            putExtra(FloatingTimerService.EXTRA_BG_COLOR,   bgColor)
            putExtra(FloatingTimerService.EXTRA_RING_COLOR, ringColor)
            putExtra(FloatingTimerService.EXTRA_TEXT_COLOR, textColor)
        })
    }

    @ReactMethod
    fun update(seconds: Int) {
        startService(Intent(reactContext, FloatingTimerService::class.java).apply {
            action = FloatingTimerService.ACTION_UPDATE
            putExtra(FloatingTimerService.EXTRA_SECONDS, seconds)
        })
    }

    @ReactMethod
    fun hide() {
        startService(Intent(reactContext, FloatingTimerService::class.java).apply {
            action = FloatingTimerService.ACTION_HIDE
        })
    }

    @ReactMethod
    fun ping() {
        startService(Intent(reactContext, FloatingTimerService::class.java).apply {
            action = FloatingTimerService.ACTION_PING
        })
    }

    // Needed for RN event emitters
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    private fun canDrawOverlays() =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(reactContext)

    private fun startService(intent: Intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            reactContext.startForegroundService(intent)
        else
            reactContext.startService(intent)
    }
}
