package com.danzstak.app

import android.content.Context
import android.graphics.Matrix
import android.graphics.drawable.Drawable
import android.widget.ImageView

/** Uses the same percentage positioning as the website's cover background. */
class ProfileCoverView(context: Context) : ImageView(context) {
    var coverX = 50f
        set(value) { field = value.coerceIn(0f, 100f); positionImage() }
    var coverY = 50f
        set(value) { field = value.coerceIn(0f, 100f); positionImage() }
    var fitEntire = false
        set(value) { field = value; positionImage() }
    init { scaleType = ScaleType.MATRIX }
    override fun setImageDrawable(drawable: Drawable?) { super.setImageDrawable(drawable); positionImage() }
    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) { super.onSizeChanged(w, h, oldw, oldh); positionImage() }
    private fun positionImage() {
        val image = drawable ?: return
        if (width <= 0 || height <= 0 || image.intrinsicWidth <= 0 || image.intrinsicHeight <= 0) return
        val x = width.toFloat() / image.intrinsicWidth; val y = height.toFloat() / image.intrinsicHeight
        val scale = if (fitEntire) minOf(x, y) else maxOf(x, y)
        imageMatrix = Matrix().apply { setScale(scale, scale); postTranslate((width - image.intrinsicWidth * scale) * coverX / 100f, (height - image.intrinsicHeight * scale) * coverY / 100f) }
    }
}
