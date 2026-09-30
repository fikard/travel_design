<template>
  <div class="app">
    <header class="topbar">
      <router-link to="/" class="logo">游迹地图</router-link>
      <nav><router-link to="/">地图总览</router-link>
        <router-link to="/topics">专题榜</router-link></nav>
      <el-input v-model="q" placeholder="搜索景点/美食/项目" clearable
        style="width:220px" @keyup.enter="doSearch" @clear="doSearch" />
    </header>
    <main><router-view /></main>
  </div>
</template>
<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
const q = ref('');
const router = useRouter();
function doSearch(){ router.push({ path:'/search', query:{ q: q.value } }); }
</script>
<style>
body{ margin:0; font-family: system-ui, sans-serif; background:#fafafa; }
.topbar{ display:flex; align-items:center; gap:24px; padding:12px 24px;
  background:#fff; border-bottom:1px solid #eee; }
.logo{ font-weight:700; font-size:18px; color:#1f9b6c; text-decoration:none; }
nav a{ margin-right:16px; color:#333; text-decoration:none; }
main{ max-width:1100px; margin:0 auto; padding:20px; }
</style>