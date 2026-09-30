<template>
  <div>
    <h2>编辑推荐专题榜</h2>
    <div class="grid">
      <router-link v-for="t in topics" :key="t.id" :to="'/topic/'+t.id" class="t-card">
        <div class="cover">{{ t.title[0] }}</div>
        <div><b>{{ t.title }}</b><p>{{ t.summary }}</p></div>
      </router-link>
    </div>
    <el-empty v-if="!topics.length" description="暂无专题" />
  </div>
</template>
<script setup>
import { onMounted, ref } from 'vue';
import { getTopics } from '../api';
const topics = ref([]);
onMounted(async ()=> topics.value = await getTopics());
</script>
<style scoped>
.grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:12px; }
.t-card{ display:flex; gap:12px; border:1px solid #eee; border-radius:8px; padding:12px;
  text-decoration:none; color:#333; background:#fff; }
.t-card p{ color:#666; font-size:13px; margin:4px 0 0; }
.cover{ width:56px;height:56px;border-radius:8px;background:#1f9b6c;color:#fff;
  display:flex;align-items:center;justify-content:center;font-size:22px; }
</style>