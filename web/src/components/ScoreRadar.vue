<template><div ref="el" style="width:100%;height:300px"></div></template>
<script setup>
import * as echarts from 'echarts';
import { onMounted, ref, watch } from 'vue';
const props = defineProps({ dimensions: { type: Array, default: ()=>[] } });
const el = ref(null); let chart;
function render(){
  if (!props.dimensions.length) return;
  if (!chart) chart = echarts.init(el.value);
  chart.setOption({
    radar: { indicator: props.dimensions.map(d=>({name:d.dimension, max:5})) },
    series: [{ type:'radar',
      data:[{ value: props.dimensions.map(d=>d.score),
              areaStyle:{color:'rgba(31,155,108,.3)'} }] }]
  });
}
onMounted(render);
watch(()=>props.dimensions, render, { deep:true });
</script>