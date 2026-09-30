<template>
  <div v-if="city">
    <el-breadcrumb separator="/" style="margin-bottom:12px">
      <el-breadcrumb-item :to="{path:'/'}">全国</el-breadcrumb-item>
      <el-breadcrumb-item :to="{path:'/province/'+backProvince}">上省</el-breadcrumb-item>
      <el-breadcrumb-item>{{ city.name }}</el-breadcrumb-item>
    </el-breadcrumb>
    <h2>{{ city.name }} · {{ typeLabel(type) }}</h2>
    <el-tabs v-model="type" @tab-change="load">
      <el-tab-pane label="全部" value="" />
      <el-tab-pane label="景点" value="scenic" />
      <el-tab-pane label="美食" value="food" />
      <el-tab-pane label="项目" value="activity" />
    </el-tabs>
    <PlaceCard v-for="p in city.places" :key="p.id" :place="p" />
    <el-empty v-if="city.places.length===0" description="暂无内容" />
  </div>
</template>
<script setup>
import { onMounted, ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { getCity } from '../api';
import PlaceCard from '../components/PlaceCard.vue';
const route = useRoute();
const city = ref(null), type = ref('');
const backProvince = computed(()=> city.value ? city.value.province_code : '');
function typeLabel(t){ return {scenic:'景点',food:'美食',activity:'项目'}[t]||'全部'; }
async function load(){ city.value = await getCity(route.params.code, type.value); }
onMounted(load);
watch(()=>route.params.code, load);
</script>