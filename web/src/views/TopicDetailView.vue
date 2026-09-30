<template>
  <div v-if="topic">
    <h2>{{ topic.title }}</h2><p>{{ topic.summary }}</p>
    <div v-for="(p,i) in topic.places" :key="p.id" style="display:flex;align-items:flex-start;gap:8px">
      <span class="rank">{{ i+1 }}</span>
      <div style="flex:1"><PlaceCard :place="p" /></div>
    </div>
  </div>
</template>
<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getTopic } from '../api';
import PlaceCard from '../components/PlaceCard.vue';
const route = useRoute(); const topic = ref(null);
onMounted(async ()=> topic.value = await getTopic(route.params.id));
</script>
<style scoped>
.rank{ min-width:28px;height:28px;border-radius:50%;background:#1f9b6c;color:#fff;
  display:flex;align-items:center;justify-content:center;margin-top:8px; }
</style>