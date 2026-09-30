<template>
  <div>
    <h2>搜索结果：{{ q }}</h2>
    <PlaceCard v-for="p in results" :key="p.id" :place="p" />
    <el-empty v-if="q && !results.length" description="未找到相关内容" />
  </div>
</template>
<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { searchPlaces } from '../api';
import PlaceCard from '../components/PlaceCard.vue';
const route = useRoute(); const q = ref(''); const results = ref([]);
async function load(){ q.value = route.query.q||''; results.value = await searchPlaces(q.value); }
onMounted(load); watch(()=>route.query.q, load);
</script>