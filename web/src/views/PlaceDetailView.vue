<template>
  <div v-if="place">
    <el-breadcrumb separator="/" style="margin-bottom:12px">
      <el-breadcrumb-item :to="{path:'/city/'+place.city_code}">返回城市</el-breadcrumb-item>
    </el-breadcrumb>
    <h2>{{ place.name }}</h2>
    <el-tag v-for="t in place.tags" :key="t" size="small" style="margin-right:6px">{{ t }}</el-tag>
    <p class="score">综合评分：{{ (place.avgScore||0).toFixed(1) }}
      <span style="font-size:12px;color:#999">（官方）</span></p>
    <el-row :gutter="20">
      <el-col :span="12"><ScoreRadar :dimensions="place.dimensions||[]" /></el-col>
      <el-col :span="12">
        <p><b>分类：</b>{{ place.category }}</p>
        <p><b>地址：</b>{{ place.address }}</p>
        <p v-if="place.topics && place.topics.length"><b>入选专题：</b>
          <router-link v-for="tp in place.topics" :key="tp.id" :to="'/topic/'+tp.id"
            style="margin-right:8px">{{ tp.title }}</router-link></p>
      </el-col>
    </el-row>
    <div class="body"><h3>攻略介绍</h3><p>{{ place.body }}</p></div>
  </div>
</template>
<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getPlace } from '../api';
import ScoreRadar from '../components/ScoreRadar.vue';
const route = useRoute(); const place = ref(null);
onMounted(async ()=> place.value = await getPlace(route.params.id));
</script>
<style scoped>
.score{ color:#f57c00; font-size:16px; margin:12px 0; }
.body{ background:#fff; padding:16px; border-radius:8px; margin-top:12px; }
</style>