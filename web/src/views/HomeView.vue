<template>
  <div>
    <h2>全国特色旅游概览</h2>
    <ChinaMap :data="provinces" @navigate="go" />
  </div>
</template>
<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import ChinaMap from '../components/ChinaMap.vue';
import { getProvinces } from '../api';
const provinces = ref([]);
const router = useRouter();
onMounted(async ()=> provinces.value = await getProvinces());
function go(code){ if(code) router.push('/province/'+code); }
</script>