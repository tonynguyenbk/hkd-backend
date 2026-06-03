function renderCharts(){
  const {ratios}=calculate();
  const mDef=getMetricsDef();
  if(radarChart){radarChart.destroy();radarChart=null;}
  if(barChart){barChart.destroy();barChart=null;}
  const radarVals=mDef.map(m=>{
    let v=ratios[m.key];
    if(v>=99) v=m.radarMax;
    const clamped=Math.min(Math.abs(v),m.radarMax);
    return m.inverse
      ?Math.max(0,Math.min(100,100-(clamped/m.radarMax)*100))
      :Math.max(0,Math.min(100,(clamped/m.radarMax)*100));
  });
  const statusColors=mDef.map(m=>{
    const st=classify(ratios[m.key],m.thresholds,m.inverse);
    return st==='safe'?'#22C55E':st==='warn'?'#F59E0B':'#EF4444';
  });
  const scores=mDef.map(m=>{const st=classify(ratios[m.key],m.thresholds,m.inverse);return st==='safe'?100:st==='warn'?55:15;});
  const radarLabels=mDef.map(m=>m.label.length>16?m.label.slice(0,16)+'…':m.label);
  const barLabels=mDef.map(m=>m.label.length>20?m.label.slice(0,20)+'…':m.label);
  const rCtx=document.getElementById('radar-chart');
  if(rCtx) radarChart=new Chart(rCtx,{type:'radar',data:{labels:radarLabels,datasets:[{label:t('result.tab_metrics'),data:radarVals,backgroundColor:'rgba(212,168,67,.15)',borderColor:'#D4A843',borderWidth:2,pointBackgroundColor:statusColors,pointRadius:4}]},options:{responsive:true,maintainAspectRatio:false,scales:{r:{min:0,max:100,ticks:{color:'#64748B',font:{size:9},stepSize:25},grid:{color:'rgba(255,255,255,.06)'},angleLines:{color:'rgba(255,255,255,.06)'},pointLabels:{color:'#94A3B8',font:{size:9}}}},plugins:{legend:{display:false}}}});
  const bCtx=document.getElementById('bar-chart');
  if(bCtx) barChart=new Chart(bCtx,{type:'bar',data:{labels:barLabels,datasets:[{label:t('result.tab_metrics'),data:scores,backgroundColor:statusColors.map(c=>c+'99'),borderColor:statusColors,borderWidth:1,borderRadius:5}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,scales:{x:{min:0,max:100,ticks:{color:'#64748B',font:{size:10}},grid:{color:'rgba(255,255,255,.05)'}},y:{ticks:{color:'#94A3B8',font:{size:10}},grid:{display:false}}},plugins:{legend:{display:false}}}});
}
