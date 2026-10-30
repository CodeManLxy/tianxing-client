function zoneEvidence(bridge,targets){
 return targets.map(target=>{
  try{const snapshot=bridge.snapshot(target.chartId);const section=name=>{const rows=snapshot[name]||[],indexed=rows.map((row,index)=>({...row,index})),valid=row=>row.mitigated===false&&['fresh','tested'].includes(row.status);return {total:rows.length,valid_count:indexed.filter(valid).length,unavailable_count:indexed.filter(row=>!valid(row)).length,candidates:[...indexed.filter(valid).slice(-20),...indexed.filter(row=>!valid(row)).slice(-5)],selection_note:'客户端已读取整个数组，此处展示最多20个有效候选及5个不可用样本；index为原数组全局下标。更多记录通过get_smc_data分页读取。'};};return {chart_id:target.chartId,symbol:snapshot.symbol,timeframe:snapshot.timeframe,effective_fvg_timeframe:snapshot.effective_fvg_timeframe,snapshot_id:snapshot.snapshot_id,analysis_ready:snapshot.analysis_ready,market_evidence_stale:snapshot.market_evidence_stale,order_blocks:section('order_blocks'),fair_value_gaps:section('fair_value_gaps')};}
  catch(e){return {chart_id:target.chartId,error:e.message,analysis_ready:false};}
 });
}
module.exports={zoneEvidence};
