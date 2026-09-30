<template><div ref="el" style="width:100%;height:560px"></div></template>
<script setup>
import * as echarts from 'echarts';
import { onMounted, ref, watch, defineEmits } from 'vue';
const props = defineProps({ data: { type: Array, default: () => [] } });
const emit = defineEmits(['navigate']);
const el = ref(null); let chart;
async function render(){
  if (!chart) chart = echarts.init(el.value);
  try {
    const geo = await (await fetch('/geo/china.json')).json();
    echarts.registerMap('china', geo);
  } catch(e) { return; }
  chart.clear();
  chart.setOption({
    tooltip: { trigger: 'item' },
    visualMap: { min:0, max: Math.max(...props.data.map(d=>d.poiCount),10), left:'left',
      inRange:{ color:['#e0f4ea','#1f9b6c'] } },
    series: [{ type:'map', map:'china', roam:true, label:{show:true,fontSize:9},
      data: props.data.map(d=>({ name:d.name, value:d.poiCount, code:d.code })) }]
  });
  chart.off('click');
  chart.on('click', p => { emit('navigate', p.data && p.data.code); });
}
onMounted(render);
watch(()=>props.data, render, { deep:true });
</script>