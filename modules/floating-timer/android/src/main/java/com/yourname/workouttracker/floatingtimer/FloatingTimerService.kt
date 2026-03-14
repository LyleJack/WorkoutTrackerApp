package com.yourname.workouttracker.floatingtimer

import android.animation.ObjectAnimator
import android.annotation.SuppressLint
import android.app.*
import android.content.Context
import android.content.Intent
import android.graphics.*
import android.os.*
import android.util.DisplayMetrics
import android.view.*
import android.view.animation.DecelerateInterpolator
import androidx.core.app.NotificationCompat

/**
 * FloatingTimerService
 *
 * Features:
 *   - Arc ring draining clockwise, color shifts purple → orange → red as time runs out
 *   - Drag to move, snap to nearest edge on release
 *   - Drag into bottom 15% of screen → dismisses (chat-head style)
 *   - Tap to open app
 *   - ping() returns remaining seconds so JS can restore state after navigation
 */
class FloatingTimerService : Service() {

    companion object {
        const val ACTION_SHOW   = "SHOW"
        const val ACTION_UPDATE = "UPDATE"
        const val ACTION_HIDE   = "HIDE"
        const val ACTION_PING   = "PING"
        const val EXTRA_SECONDS    = "seconds"
        const val EXTRA_BG_COLOR   = "bgColor"
        const val EXTRA_RING_COLOR = "ringColor"
        const val EXTRA_TEXT_COLOR = "textColor"
        // Broadcast sent in response to PING
        const val BROADCAST_PONG   = "com.yourname.workouttracker.TIMER_PONG"
        const val EXTRA_REMAINING  = "remaining"
        const val EXTRA_RUNNING    = "running"

        private const val NOTIF_CHANNEL_ID = "floating_timer" // kept for channel cleanup
    }

    private lateinit var windowManager: WindowManager
    private var bubbleView:    BubbleView? = null
    private var containerView: View?       = null
    private var dismissTarget: View?       = null
    private var isDragging = false

    private val handler   = Handler(Looper.getMainLooper())
    private var remaining = 0
    private var total     = 0
    private var running   = false

    private var bgColor   = Color.parseColor("#000000")
    private var ringColor = Color.parseColor("#6C63FF")
    private var textColor = Color.parseColor("#FFFFFF")

    private val tickRunnable = object : Runnable {
        override fun run() {
            if (!running || remaining <= 0) {
                if (remaining <= 0) { pulseFinished(); running = false }
                return
            }
            remaining--
            bubbleView?.update(remaining, total)
            handler.postDelayed(this, 1_000)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_SHOW -> {
                val secs = intent.getIntExtra(EXTRA_SECONDS, 0)
                bgColor   = intent.getIntExtra(EXTRA_BG_COLOR,   Color.parseColor("#000000"))
                ringColor = intent.getIntExtra(EXTRA_RING_COLOR, Color.parseColor("#6C63FF"))
                textColor = intent.getIntExtra(EXTRA_TEXT_COLOR, Color.parseColor("#FFFFFF"))
                showBubble(secs)
            }
            ACTION_UPDATE -> {
                val secs = intent.getIntExtra(EXTRA_SECONDS, remaining)
                updateTimer(secs)
            }
            ACTION_HIDE -> hideBubble()
            ACTION_PING -> {
                // Respond with current state so JS can restore on re-focus
                val broadcast = Intent(BROADCAST_PONG).apply {
                    putExtra(EXTRA_REMAINING, remaining)
                    putExtra(EXTRA_RUNNING,   running)
                    setPackage(packageName)
                }
                sendBroadcast(broadcast)
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        running = false
        handler.removeCallbacks(tickRunnable)
        removeBubble()
        super.onDestroy()
    }

    // ── Bubble management ──────────────────────────────────────────────────────

    @SuppressLint("ClickableViewAccessibility")
    private fun showBubble(seconds: Int) {
        if (containerView != null) { updateTimer(seconds); return }

        remaining = seconds
        total     = seconds
        running   = true

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else
            @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE

        val bubbleSize = dpToPx(80)
        val params = WindowManager.LayoutParams(
            bubbleSize, bubbleSize, type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply { gravity = Gravity.TOP or Gravity.START; x = 24; y = 200 }

        val bubble = BubbleView(this, bgColor, ringColor, textColor).apply { update(remaining, total) }
        bubbleView = bubble

        val container = object : android.widget.FrameLayout(this) {}
        container.addView(bubble, android.widget.FrameLayout.LayoutParams(bubbleSize, bubbleSize))
        containerView = container

        // ── Drag / dismiss logic ──────────────────────────────────────────────
        var initX = 0; var initY = 0
        var touchX = 0f; var touchY = 0f

        val dm = DisplayMetrics()
        @Suppress("DEPRECATION") windowManager.defaultDisplay.getMetrics(dm)
        val screenH = dm.heightPixels

        container.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initX = params.x; initY = params.y
                    touchX = event.rawX; touchY = event.rawY
                    showDismissTarget()
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    params.x = initX + (event.rawX - touchX).toInt()
                    params.y = initY + (event.rawY - touchY).toInt()
                    // Tint red when approaching dismiss zone (bottom 15%)
                    val dismissZoneTop = (screenH * 0.85f).toInt()
                    val inDismissZone  = params.y + dpToPx(80) > dismissZoneTop
                    bubble.setDismissHint(inDismissZone)
                    try { windowManager.updateViewLayout(container, params) } catch (_: Exception) {}
                    true
                }
                MotionEvent.ACTION_UP -> {
                    hideDismissTarget()
                    val dx = Math.abs(event.rawX - touchX)
                    val dy = Math.abs(event.rawY - touchY)
                    val dismissZoneTop = (screenH * 0.85f).toInt()
                    if (params.y + dpToPx(80) > dismissZoneTop && (dx > 8f || dy > 8f)) {
                        // Drag into bottom 15% → dismiss
                        container.animate()
                            .translationY((screenH - params.y).toFloat())
                            .alpha(0f).setDuration(220)
                            .withEndAction { hideBubble() }.start()
                    } else if (dx < 8f && dy < 8f) {
                        // Tap: open app always; if timer is done also dismiss the bubble
                        openApp()
                        if (!running && remaining <= 0) hideBubble()
                    } else {
                        bubble.setDismissHint(false)
                        snapToEdge(container, params)
                    }
                    true
                }
                else -> false
            }
        }

        windowManager.addView(container, params)
        animateIn(container)
        handler.postDelayed(tickRunnable, 1_000)
    }

    private fun updateTimer(seconds: Int) {
        running = false
        handler.removeCallbacks(tickRunnable)
        remaining = seconds; total = seconds; running = true
        bubbleView?.update(remaining, total)
        handler.postDelayed(tickRunnable, 1_000)
    }

    private fun hideBubble() {
        running = false
        handler.removeCallbacks(tickRunnable)
        containerView?.let { v -> animateOut(v) { removeBubble(); stopSelf() } } ?: stopSelf()
    }

    private fun removeBubble() {
        hideDismissTarget()
        containerView?.let { try { windowManager.removeView(it) } catch (_: Exception) {} }
        containerView = null; bubbleView = null
    }

    // ── Custom drawn bubble view ───────────────────────────────────────────────

    inner class BubbleView(
        context: Context,
        private val bgCol: Int,
        private val baseRingCol: Int,
        private val txtCol: Int,
    ) : View(context) {

        private var rem         = 0
        private var tot         = 0
        private var done        = false
        private var dismissHint = false
        private var onDismissHintChanged: ((Boolean) -> Unit)? = null

        fun setOnDismissHintChanged(cb: (Boolean) -> Unit) { onDismissHintChanged = cb }

        // Colors for time-remaining interpolation
        private val colorFull   = baseRingCol                      // 100% → 50%  purple
        private val colorMid    = Color.parseColor("#f59e0b")      // 50%  → 25%  orange
        private val colorLow    = Color.parseColor("#ef4444")      // 25%  → 0%   red
        private val colorDone   = Color.parseColor("#22c55e")      // finished    green
        private val colorDismiss= Color.parseColor("#ef444488")    // dismiss hint

        private val bgPaint    = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = bgCol; style = Paint.Style.FILL }
        private val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND
        }
        private val ringPaint  = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND
        }
        private val innerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND
        }
        private val textPaint  = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = txtCol; textAlign = Paint.Align.CENTER; typeface = Typeface.DEFAULT_BOLD
        }
        private val doneTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = colorDone; textAlign = Paint.Align.CENTER; typeface = Typeface.DEFAULT_BOLD
        }

        private var oval      = RectF()
        private var ovalInner = RectF()
        private var cx = 0f; private var cy = 0f

        override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
            val stroke  = w * 0.09f
            val strokeI = stroke * 0.35f
            trackPaint.strokeWidth = stroke
            ringPaint.strokeWidth  = stroke
            innerPaint.strokeWidth = strokeI
            textPaint.textSize     = w * 0.26f
            doneTextPaint.textSize = w * 0.26f
            val inset  = stroke / 2f + w * 0.04f
            val insetI = inset + stroke + strokeI / 2f + w * 0.01f
            oval.set(inset, inset, w - inset, h - inset)
            ovalInner.set(insetI, insetI, w - insetI, h - insetI)
            cx = w / 2f; cy = h / 2f
        }

        fun update(remaining: Int, total: Int) {
            rem = remaining; tot = total; done = remaining <= 0
            postInvalidate()
        }

        fun setDismissHint(hint: Boolean) {
            if (dismissHint != hint) {
                dismissHint = hint
                onDismissHintChanged?.invoke(hint)
                postInvalidate()
            }
        }

        private fun currentRingColor(): Int {
            if (done) return colorDone
            if (dismissHint) return colorDismiss
            if (tot <= 0) return colorFull
            val pct = rem.toFloat() / tot.toFloat()
            return when {
                pct > 0.5f -> {
                    // purple → orange: interpolate in top half
                    val t = (pct - 0.5f) / 0.5f   // 1→0 as pct goes 1→0.5
                    lerpColor(colorMid, colorFull, t)
                }
                pct > 0.25f -> {
                    // orange → red: interpolate in 50%→25% band
                    val t = (pct - 0.25f) / 0.25f  // 1→0 as pct goes 0.5→0.25
                    lerpColor(colorLow, colorMid, t)
                }
                else -> colorLow
            }
        }

        private fun lerpColor(from: Int, to: Int, t: Float): Int {
            val r = (Color.red(from)   + (Color.red(to)   - Color.red(from))   * t).toInt()
            val g = (Color.green(from) + (Color.green(to) - Color.green(from)) * t).toInt()
            val b = (Color.blue(from)  + (Color.blue(to)  - Color.blue(from))  * t).toInt()
            return Color.rgb(r.coerceIn(0, 255), g.coerceIn(0, 255), b.coerceIn(0, 255))
        }

        override fun onDraw(canvas: Canvas) {
            val col = currentRingColor()

            // Background
            canvas.drawCircle(cx, cy, cx - 2f, bgPaint)

            // Track (faint)
            trackPaint.color = Color.argb(35, Color.red(col), Color.green(col), Color.blue(col))
            canvas.drawArc(oval, -90f, 360f, false, trackPaint)

            // Outer progress arc
            ringPaint.color = col
            if (!done && tot > 0) {
                canvas.drawArc(oval, -90f, 360f * rem / tot, false, ringPaint)
            } else if (done) {
                canvas.drawArc(oval, -90f, 360f, false, ringPaint)
            }

            // Inner echo ring
            innerPaint.color = Color.argb(80, Color.red(col), Color.green(col), Color.blue(col))
            if (tot > 0 && rem > 0) {
                canvas.drawArc(ovalInner, -90f, 360f * rem / tot, false, innerPaint)
            }

            // Text
            val label = if (done) "✓" else rem.toString()
            val paint = if (done) doneTextPaint else textPaint
            val fm    = paint.fontMetrics
            canvas.drawText(label, cx, cy - (fm.ascent + fm.descent) / 2f, paint)
        }
    }

    // ── Animations ─────────────────────────────────────────────────────────────

    private fun animateIn(view: View) {
        view.scaleX = 0f; view.scaleY = 0f; view.alpha = 0f
        view.animate().scaleX(1f).scaleY(1f).alpha(1f)
            .setDuration(220).setInterpolator(DecelerateInterpolator()).start()
    }

    private fun animateOut(view: View, onEnd: () -> Unit) {
        view.animate().scaleX(0f).scaleY(0f).alpha(0f)
            .setDuration(180).withEndAction(onEnd).start()
    }

    private fun pulseFinished() {
        val v = containerView ?: return
        ObjectAnimator.ofFloat(v, "scaleX", 1f, 1.3f, 1f).apply { duration = 300; repeatCount = 2 }.start()
        ObjectAnimator.ofFloat(v, "scaleY", 1f, 1.3f, 1f).apply { duration = 300; repeatCount = 2 }.start()
        bubbleView?.update(0, total)
    }

    private fun showDismissTarget() {
        if (dismissTarget != null) return
        val dm = DisplayMetrics()
        @Suppress("DEPRECATION") windowManager.defaultDisplay.getMetrics(dm)

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE

        val targetH = dpToPx(56)
        val target = android.widget.TextView(this).apply {
            text     = "↓  Release here to dismiss"
            textSize = 12f
            setTextColor(Color.parseColor("#ef4444"))
            gravity  = android.view.Gravity.CENTER
            setBackgroundColor(Color.argb(180, 20, 0, 0))
            alpha    = 0f
        }
        val targetParams = WindowManager.LayoutParams(
            dm.widthPixels, targetH, type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = android.view.Gravity.BOTTOM or android.view.Gravity.START
            x = 0; y = 0
        }
        windowManager.addView(target, targetParams)
        dismissTarget = target
        target.animate().alpha(1f).setDuration(150).start()
    }

    private fun hideDismissTarget() {
        val t = dismissTarget ?: return
        t.animate().alpha(0f).setDuration(120).withEndAction {
            try { windowManager.removeView(t) } catch (_: Exception) {}
        }.start()
        dismissTarget = null
    }

    private fun snapToEdge(view: View, params: WindowManager.LayoutParams) {
        val dm = DisplayMetrics()
        @Suppress("DEPRECATION") windowManager.defaultDisplay.getMetrics(dm)
        val screenW = dm.widthPixels
        val bubbleW = view.width.takeIf { it > 0 } ?: dpToPx(80)
        val targetX = if (params.x + bubbleW / 2 < screenW / 2) 24 else screenW - bubbleW - 24
        view.animate()
            .translationX((targetX - params.x).toFloat())
            .setDuration(200).setInterpolator(DecelerateInterpolator())
            .withEndAction {
                params.x += (targetX - params.x); view.translationX = 0f
                try { windowManager.updateViewLayout(view, params) } catch (_: Exception) {}
            }.start()
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private fun dpToPx(dp: Int): Int = (dp * resources.displayMetrics.density).toInt()

    private fun openApp() {
        packageManager.getLaunchIntentForPackage(packageName)
            ?.apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP) }
            ?.let { startActivity(it) }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(NOTIF_CHANNEL_ID, "Rest Timer", NotificationManager.IMPORTANCE_LOW)
                .apply { description = "Floating rest timer bubble" }
            (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(ch)
        }
    }

    private fun buildNotification(text: String): Notification {
        val pi = PendingIntent.getActivity(
            this, 0, packageManager.getLaunchIntentForPackage(packageName),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, NOTIF_CHANNEL_ID)
            .setContentTitle("Workout Timer").setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_recent_history)
            .setContentIntent(pi).setOngoing(true).setSilent(true).build()
    }
}
