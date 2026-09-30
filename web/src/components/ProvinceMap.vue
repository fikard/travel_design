<template><div ref="el" style="width:100%;height:480px"></div></template>
<script setup>
import * as echarts from 'echarts';
import { onMounted, ref, watch, defineEmits } from 'vue';
const props = defineProps({ provinceCode: { type:String, default:'' }, cities: {type:Array, default:()=>[]} });
const emit = defineEmits(['navigate']);
const el = ref(null); let chart;
async function render(){
  if (!props.provinceCode || !props.cities.length) return;
  if (!chart) chart = echarts.init(el.value);
  try { const geo = await (await fetch(`/geo/${props.provinceCode}.json`)).json();
        echarts.registerMap('prov', geo); }
  catch(e){ return; }
  chart.setOption({
    tooltip: { trigger: 'item' },
    visualMap: { min:0, max: Math.max(...props.cities.map(c=>c.placeCount),5), left:'left',
      inRange:{ color:['#e0f4ea','#1f9b6c'] } },
    series: [{ type:'map', map:'prov', roam:true, label:{show:true,fontSize:9},
      data: props.cities.map(c=>({ name:c.name, value:c.placeCount, code:c.code })) }]
  });
  chart.off('click');
  chart.on('click', p => emit('navigate', p.data && p.data.code));
}
onMounted(render);
watch(()=>[props.provinceCode, props.cities], render, { deep:true });
</script>