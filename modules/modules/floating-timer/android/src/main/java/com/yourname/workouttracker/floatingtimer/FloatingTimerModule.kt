package com.yourname.workouttracker.floatingtimer

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule

/**
 * FloatingTimerModule
 *
 * Exposes three methods to JavaScript:
 *
 *   FloatingTimer.requestPermission()  →  opens Android "Draw over apps" settings if needed
 *   FloatingTimer.show(seconds)        →  starts/updates the bubble with a countdown
 *   FloatingTimer.hide()               →  dismisses the bubble and stops the service
 *   FloatingTimer.hasPermission()      →  Promise<boolean>
 */
@ReactModule(name = FloatingTimerModule.NAME)
class FloatingTimerModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "FloatingTimer"
    }

    override fun getName() = NAME

    // ── JS-exposed methods ────────────────────────────────────────────────────

    @ReactMethod
    fun hasPermission(promise: Promise) {
        promise.resolve(canDrawOverlays())
    }

    @ReactMethod
    fun requestPermission() {
        if (canDrawOverlays()) return
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${reactContext.packageName}")
        ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
        reactContext.startActivity(intent)
    }

    @ReactMethod
    fun show(seconds: Int) {
        if (!canDrawOverlays()) {
            requestPermission()
            return
        }
        val intent = Intent(reactContext, FloatingTimerService::class.java).apply {
            action = FloatingTimerService.ACTION_SHOW
            putExtra(FloatingTimerService.EXTRA_SECONDS, seconds)
        }
        startService(intent)
    }

    @ReactMethod
    fun update(seconds: Int) {
        val intent = Intent(reactContext, FloatingTimerService::class.java).apply {
            action = FloatingTimerService.ACTION_UPDATE
            putExtra(FloatingTimerService.EXTRA_SECONDS, seconds)
        }
        startService(intent)
    }

    @ReactMethod
    fun hide() {
        val intent = Intent(reactContext, FloatingTimerService::class.java).apply {
            action = FloatingTimerService.ACTION_HIDE
        }
        startService(intent)
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun canDrawOverlays(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
                Settings.canDrawOverlays(reactContext)

    private fun startService(intent: Intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }
    }
}
