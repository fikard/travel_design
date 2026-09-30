<template>
  <div class="review-section">
    <h3>用户口碑</h3>
    <div class="score-cards" v-if="place">
      <div class="card"><div class="num">{{ (place.official_score||0).toFixed(1) }}</div><div>官方分</div></div>
      <div class="card"><div class="num">{{ (place.userAvgScore||0).toFixed(1) }}</div><div>用户口碑</div></div>
      <div class="card"><div class="num">{{ (place.finalScore||0).toFixed(1) }}</div><div>综合分（官方40%+口碑60%）</div></div>
      <div class="card"><div class="num">{{ place.userReviewCount||0 }}</div><div>评价数</div></div>
    </div>

    <!-- 我来评价：未评价态 -->
    <div class="my-review" v-if="!myReview">
      <h4>我来评价</h4>
      <el-radio-group v-model="recommend">
        <el-radio-button value="worthit">值得去</el-radio-button>
        <el-radio-button value="general">一般</el-radio-button>
        <el-radio-button value="no">不推荐</el-radio-button>
      </el-radio-group>
      <div class="dims">
        <div v-for="d in dimensionNames" :key="d" class="dim">
          <span>{{ d }}</span>
          <el-rate v-model="draft[d]" show-score score-template="{value}" :max="5" />
        </div>
      </div>
      <el-input v-model="comment" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="写点什么…" />
      <el-button type="primary" style="margin-top:10px" :disabled="!canSubmit" @click="submit">提交评价</el-button>
    </div>

    <!-- 我的评价：可修改/删除 -->
    <div class="my-review" v-else>
      <h4>我的评价（{{ recommendLabel(myReview.recommend) }}）</h4>
      <p>{{ myReview.comment || '（无文字评论）' }}</p>
      <el-button size="small" @click="startEdit">修改</el-button>
      <el-button size="small" type="danger" @click="remove">删除</el-button>
    </div>

    <!-- 评价列表 -->
    <div class="reviews" v-if="reviews.length">
      <div v-for="r in reviews" :key="r.id" class="review-item">
        <div class="head"><b>{{ recommendLabel(r.recommend) }}</b>
          <span class="time">{{ r.created_at }}</span></div>
        <div class="dims-line">
          <el-tag v-for="d in r.dimensions" :key="d.dimension" size="small"
            style="margin-right:4px">{{ d.dimension }} {{ d.score }}</el-tag>
        </div>
        <p>{{ r.comment || '（无文字评论）' }}</p>
        <span v-if="r.isMine" class="mine">我</span>
      </div>
    </div>
    <el-empty v-else description="还没有用户评价" />
  </div>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue';
import { getPlaceReviews, submitReview, deleteReview } from '../api';
const props = defineProps({ place: Object });
const emit = defineEmits(['changed']);
const reviews = ref([]);
const myReview = computed(()=> props.place.myReview || null);
const dimensionNames = computed(()=> (props.place.dimensions||[]).map(d=>d.dimension));
const recommend = ref('worthit');
const comment = ref('');
const draft = ref({});
const editing = ref(false);

function recommendLabel(v){ return { worthit:'值得去', general:'一般', no:'不推荐' }[v] || v; }
const canSubmit = computed(()=> recommend.value && dimensionNames.value.every(d=>draft.value[d] > 0));
async function loadReviews(){ reviews.value = await getPlaceReviews(props.place.id); }
function startEdit(){
  editing.value = true;
  recommend.value = myReview.value.recommend;
  comment.value = myReview.value.comment || '';
  dimensionNames.value.forEach(d => { draft.value[d] = draft.value[d] || 5; });
}
async function submit(){
  const dimensions = dimensionNames.value.map(d => ({ dimension: d, score: draft.value[d] }));
  await submitReview({ placeId: props.place.id, recommend: recommend.value, comment: comment.value, dimensions });
  emit('changed'); await loadReviews();
}
async function remove(){
  await deleteReview(props.place.id);
  emit('changed'); await loadReviews();
}
onMounted(loadReviews);
</script>
<style scoped>
.review-section{ background:#fff; border-radius:8px; padding:16px; margin-top:12px; }
.score-cards{ display:flex; gap:12px; flex-wrap:wrap; margin:12px 0; }
.card{ flex:1; min-width:120px; border:1px solid #eee; border-radius:8px; padding:12px; text-align:center; }
.card .num{ font-size:20px; color:#f57c00; font-weight:700; }
.my-review{ border:1px dashed #ccc; border-radius:8px; padding:12px; margin:12px 0; }
.dims{ margin:10px 0; }
.dim{ display:flex; align-items:center; gap:12px; margin-bottom:6px; }
.review-item{ border-bottom:1px solid #f0f0f0; padding:10px 0; }
.mine{ color:#1f9b6c; font-size:12px; }
.time{ color:#999; font-size:12px; margin-left:8px; }
</style>
