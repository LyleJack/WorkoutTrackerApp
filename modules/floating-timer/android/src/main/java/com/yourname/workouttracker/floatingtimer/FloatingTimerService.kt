package com.yourname.workouttracker.floatingtimer

import android.animation.ObjectAnimator
import android.annotation.SuppressLint
import android.app.*
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.*
import android.view.*
import android.view.MotionEvent
import android.view.animation.DecelerateInterpolator
import com.yourname.workouttracker.R
import android.widget.FrameLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat

/**
 * FloatingTimerService
 *
 * A foreground Service that draws a draggable circular overlay bubble
 * showing a countdown timer.  Survives app backgrounding because it is
 * a proper Android Service with a persistent foreground notification.
 *
 * Lifecycle driven entirely from FloatingTimerModule (JS bridge):
 *   startService(SHOW, seconds)  →  bubble appears
 *   startService(UPDATE, seconds) →  countdown text refreshed
 *   startService(HIDE)           →  bubble + service dismissed
 */
class FloatingTimerService : Service() {

    companion object {
        const val ACTION_SHOW   = "SHOW"
        const val ACTION_UPDATE = "UPDATE"
        const val ACTION_HIDE   = "HIDE"
        const val EXTRA_SECONDS = "seconds"

        private const val NOTIF_CHANNEL_ID = "floating_timer"
        private const val NOTIF_ID         = 8321
    }

    // ── State ─────────────────────────────────────────────────────────────────

    private lateinit var windowManager: WindowManager
    private var bubbleView: View?   = null
    private var timerText: TextView? = null

    private val handler   = Handler(Looper.getMainLooper())
    private var remaining = 0          // seconds remaining
    private var running   = false

    private val tickRunnable = object : Runnable {
        override fun run() {
            if (!running || remaining <= 0) {
                if (remaining <= 0) pulseFinished()
                running = false
                return
            }
            remaining--
            timerText?.text = formatTime(remaining)
            handler.postDelayed(this, 1_000)
        }
    }

    // ── Service lifecycle ─────────────────────────────────────────────────────

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        createNotificationChannel()
        startForeground(NOTIF_ID, buildNotification("Timer active"))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_SHOW -> {
                val secs = intent.getIntExtra(EXTRA_SECONDS, 0)
                showBubble(secs)
            }
            ACTION_UPDATE -> {
                val secs = intent.getIntExtra(EXTRA_SECONDS, remaining)
                updateTimer(secs)
            }
            ACTION_HIDE -> hideBubble()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        running = false
        handler.removeCallbacks(tickRunnable)
        removeBubble()
        super.onDestroy()
    }

    // ── Bubble management ─────────────────────────────────────────────────────

    @SuppressLint("InflateParams", "ClickableViewAccessibility")
    private fun showBubble(seconds: Int) {
        if (bubbleView != null) {
            updateTimer(seconds)
            return
        }

        remaining = seconds
        running   = true

        val inflater = LayoutInflater.from(this)
        val view     = inflater.inflate(R.layout.bubble_timer, null)
        bubbleView   = view
        timerText    = view.findViewById(R.id.bubble_text)
        timerText?.text = formatTime(remaining)

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 24
            y = 200
        }

        // ── Drag & drop ───────────────────────────────────────────────────────
        var initX = 0; var initY = 0
        var touchX = 0f; var touchY = 0f

        view.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initX  = params.x; initY = params.y
                    touchX = event.rawX; touchY = event.rawY
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    params.x = initX + (event.rawX - touchX).toInt()
                    params.y = initY + (event.rawY - touchY).toInt()
                    windowManager.updateViewLayout(view, params)
                    true
                }
                MotionEvent.ACTION_UP -> {
                    // If barely moved, treat as tap → open app
                    val dx = Math.abs(event.rawX - touchX)
                    val dy = Math.abs(event.rawY - touchY)
                    if (dx < 8f && dy < 8f) openApp()
                    // Snap to nearest vertical edge (left / right)
                    snapToEdge(view, params)
                    true
                }
                else -> false
            }
        }

        windowManager.addView(view, params)
        animateIn(view)
        handler.postDelayed(tickRunnable, 1_000)
    }

    private fun updateTimer(seconds: Int) {
        running   = false
        handler.removeCallbacks(tickRunnable)
        remaining = seconds
        running   = true
        timerText?.text = formatTime(remaining)
        handler.postDelayed(tickRunnable, 1_000)
    }

    private fun hideBubble() {
        running = false
        handler.removeCallbacks(tickRunnable)
        bubbleView?.let { view ->
            animateOut(view) {
                removeBubble()
                stopSelf()
            }
        } ?: stopSelf()
    }

    private fun removeBubble() {
        bubbleView?.let {
            try { windowManager.removeView(it) } catch (_: Exception) {}
        }
        bubbleView = null
        timerText  = null
    }

    // ── Animations ────────────────────────────────────────────────────────────

    private fun animateIn(view: View) {
        view.scaleX = 0f; view.scaleY = 0f; view.alpha = 0f
        view.animate()
            .scaleX(1f).scaleY(1f).alpha(1f)
            .setDuration(220)
            .setInterpolator(DecelerateInterpolator())
            .start()
    }

    private fun animateOut(view: View, onEnd: () -> Unit) {
        view.animate()
            .scaleX(0f).scaleY(0f).alpha(0f)
            .setDuration(180)
            .withEndAction(onEnd)
            .start()
    }

    /** Brief pulse when timer hits 0 to draw attention */
    private fun pulseFinished() {
        val v = bubbleView ?: return
        val pulse = ObjectAnimator.ofFloat(v, "scaleX", 1f, 1.35f, 1f).apply {
            duration = 300; repeatCount = 2
        }
        val pulseY = ObjectAnimator.ofFloat(v, "scaleY", 1f, 1.35f, 1f).apply {
            duration = 300; repeatCount = 2
        }
        pulse.start(); pulseY.start()
        timerText?.text = "✓"
    }

    /** Snap to left or right screen edge with a short spring animation */
    private fun snapToEdge(view: View, params: WindowManager.LayoutParams) {
        val display    = windowManager.defaultDisplay
        val size       = android.graphics.Point()
        @Suppress("DEPRECATION")
        display.getSize(size)
        val screenW    = size.x
        val bubbleW    = view.width.takeIf { it > 0 } ?: 56.dpToPx()
        val targetX    = if (params.x + bubbleW / 2 < screenW / 2) 24 else screenW - bubbleW - 24
        view.animate()
            .translationX((targetX - params.x).toFloat())
            .setDuration(200)
            .setInterpolator(DecelerateInterpolator())
            .withEndAction {
                params.x += (targetX - params.x)
                view.translationX = 0f
                try { windowManager.updateViewLayout(view, params) } catch (_: Exception) {}
            }
            .start()
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun formatTime(secs: Int): String {
        if (secs <= 0) return "0"
        return if (secs >= 60) "${secs / 60}:${(secs % 60).toString().padStart(2, '0')}"
        else "$secs"
    }

    private fun Int.dpToPx(): Int =
        (this * resources.displayMetrics.density).toInt()

    private fun openApp() {
        val intent = packageManager.getLaunchIntentForPackage(packageName)
            ?.apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP) }
        intent?.let { startActivity(it) }
    }

    // ── Foreground notification (required to keep service alive) ──────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(
                NOTIF_CHANNEL_ID,
                "Rest Timer",
                NotificationManager.IMPORTANCE_LOW
            ).apply { description = "Floating rest timer bubble" }
            (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
                .createNotificationChannel(ch)
        }
    }

    private fun buildNotification(text: String): Notification {
        val tapIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pi = PendingIntent.getActivity(
            this, 0, tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, NOTIF_CHANNEL_ID)
            .setContentTitle("Workout Timer")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_recent_history)
            .setContentIntent(pi)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }
}
