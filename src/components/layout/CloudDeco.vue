<script setup>
// 祥云 + 纸鸢装饰：童真动画氛围
</script>

<template>
  <div aria-hidden="true">
    <!-- 祥云：慢速飘过 -->
    <svg class="cloud-deco" width="130" height="70" viewBox="0 0 130 70" style="top:10%; animation-duration:26s">
      <ellipse cx="40" cy="42" rx="30" ry="16" fill="#fff" opacity="0.85"/>
      <ellipse cx="68" cy="34" rx="26" ry="15" fill="#fff" opacity="0.9"/>
      <ellipse cx="94" cy="43" rx="24" ry="13" fill="#fff" opacity="0.8"/>
    </svg>
    <svg class="cloud-deco" width="90" height="50" viewBox="0 0 90 50" style="top:68%; animation-duration:34s; animation-delay:-12s">
      <ellipse cx="28" cy="30" rx="22" ry="12" fill="#f7e0dd" opacity="0.8"/>
      <ellipse cx="50" cy="24" rx="20" ry="11" fill="#f7e0dd" opacity="0.85"/>
      <ellipse cx="70" cy="30" rx="18" ry="10" fill="#f7e0dd" opacity="0.75"/>
    </svg>
    <!-- 右上角固定纸鸢 -->
    <svg class="kite-pin floaty" width="72" height="88" viewBox="0 0 100 110" style="top:12%; right:3%">
      <polygon points="50,6 78,40 50,66 22,40" fill="#e0a1a1" stroke="#4a4a4a" stroke-width="2" opacity="0.7"/>
      <line x1="50" y1="6" x2="50" y2="66" stroke="#fff7ea" stroke-width="1.4" opacity="0.8"/>
      <line x1="22" y1="40" x2="78" y2="40" stroke="#fff7ea" stroke-width="1.4" opacity="0.8"/>
      <path d="M50 66 Q 58 78 50 86 T 50 106" fill="none" stroke="#4a4a4a" stroke-width="1.2" opacity="0.6"/>
    </svg>
    <!-- 左下角灯笼 -->
    <svg class="lantern sway" width="46" height="64" viewBox="0 0 46 64" style="left:2%; bottom:14%">
      <line x1="23" y1="0" x2="23" y2="10" stroke="#4a4a4a" stroke-width="1.6"/>
      <rect x="14" y="10" width="18" height="26" rx="8" fill="#d9a94e" opacity="0.55" stroke="#4a4a4a" stroke-width="1.2"/>
      <line x1="14" y1="23" x2="32" y2="23" stroke="#4a4a4a" stroke-width="1"/>
      <line x1="23" y1="36" x2="23" y2="44" stroke="#4a4a4a" stroke-width="1.4"/>
      <rect x="19" y="44" width="8" height="10" fill="#c96a4a" opacity="0.6"/>
    </svg>
  </div>
</template>

<style scoped>
.kite-pin { position: fixed; z-index: 1; pointer-events: none; opacity: .75; }
.lantern { position: fixed; z-index: 1; pointer-events: none; opacity: .5; }
@media (max-width: 900px) {
  .kite-pin, .lantern { display: none; }
}
</style>
