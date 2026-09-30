<template>
  <router-link class="card" :to="'/place/'+place.id">
    <div class="cover">{{ place.name[0] }}</div>
    <div class="body">
      <div class="row"><b>{{ place.name }}</b>
        <span class="score">{{ ((place.avgScore||place.official_score)||0).toFixed(1) }}</span></div>
      <div class="cat">{{ place.category }} · {{ typeLabel(place.type) }}</div>
      <p class="sum">{{ place.summary }}</p>
    </div>
  </router-link>
</template>
<script setup>
defineProps({ place: Object });
function typeLabel(t){ return {scenic:'景点',food:'美食',activity:'项目'}[t]||''; }
</script>
<style scoped>
.card{ display:flex; gap:12px; border:1px solid #eee; border-radius:8px; padding:12px;
  margin-bottom:12px; text-decoration:none; color:#333; background:#fff; }
.cover{ width:100px; height:70px; background:#1f9b6c; color:#fff; display:flex;
  align-items:center; justify-content:center; font-size:22px; border-radius:6px; }
.score{ color:#f57c00; font-weight:700; }
.cat{ color:#1f9b6c; font-size:13px; margin-top:4px; }
.sum{ color:#666; font-size:13px; margin:4px 0 0; }
</style>