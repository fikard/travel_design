<template>
  <div v-if="province">
    <el-breadcrumb separator="/" style="margin-bottom:12px">
      <el-breadcrumb-item :to="{path:'/'}">全国</el-breadcrumb-item>
      <el-breadcrumb-item>{{ province.name }}</el-breadcrumb-item>
    </el-breadcrumb>
    <h2>{{ province.name }}旅游</h2>
    <ProvinceMap :province-code="code" :cities="cities" @navigate="goCity" />
    <div class="city-list">
      <div v-for="c in cities" :key="c.code" class="city" @click="goCity(c.code)">
        <b>{{ c.name }}</b><span> {{ c.placeCount }} 个地点</span>
      </div>
    </div>
  </div>
</template>
<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getProvince } from '../api';
import ProvinceMap from '../components/ProvinceMap.vue';
const route = useRoute(), router = useRouter();
const code = route.params.code;
const province = ref(null), cities = ref([]);
onMounted(async ()=>{ const d = await getProvince(code); province.value = d; cities.value = d.cities; });
function goCity(c){ if(c) router.push('/city/'+c); }
</script>
<style scoped>
.city-list{ display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:10px; margin-top:16px; }
.city{ border:1px solid #eee; border-radius:8px; padding:12px; cursor:pointer; background:#fff; }
.city span{ color:#999; font-size:13px; }
</style>