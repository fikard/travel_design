<template>
  <div>
    <h2>我的评价</h2>
    <div v-for="r in reviews" :key="r.id" class="item">
      <div class="head">
        <router-link :to="'/place/'+r.place_id"><b>{{ r.place_name }}</b></router-link>
        <el-tag size="small" :type="tagType(r.recommend)">{{ recommendLabel(r.recommend) }}</el-tag>
        <span class="time">{{ r.updated_at }}</span>
      </div>
      <p>{{ r.comment || '（无文字评论）' }}</p>
      <el-button size="small" @click="edit(r)">修改</el-button>
      <el-button size="small" type="danger" @click="remove(r)">删除</el-button>
    </div>
    <el-empty v-if="!reviews.length" description="你还没有评价过任何地点" />
  </div>
</template>
<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getMyReviews, deleteReview } from '../api';
const router = useRouter();
const reviews = ref([]);
function recommendLabel(v){ return { worthit:'值得去', general:'一般', no:'不推荐' }[v] || v; }
function tagType(v){ return { worthit:'success', general:'info', no:'danger' }[v] || ''; }
async function load(){ reviews.value = await getMyReviews(); }
function edit(r){ router.push({ path:'/place/'+r.place_id, query:{ editReview:'1' } }); }
async function remove(r){
  await deleteReview(r.place_id);
  await load();
}
onMounted(load);
</script>
<style scoped>
.item{ background:#fff; border:1px solid #eee; border-radius:8px; padding:12px; margin-bottom:12px; }
.head{ display:flex; align-items:center; gap:10px; margin-bottom:6px; }
.time{ color:#999; font-size:12px; }
</style>
