const POLICY=Object.freeze({basis:'equity',default_percent:1,min_percent:1,max_percent:2});
function positive(value,name){if(typeof value!=='number'||!Number.isFinite(value)||value<=0)throw Error(name+'缺失或无效');return value;}
function riskBudget(account,percent=POLICY.default_percent){
 if(typeof percent!=='number'||!Number.isFinite(percent)||percent<POLICY.min_percent||percent>POLICY.max_percent)throw Error('单笔风险比例必须在 1%–2% 之间');
 const equity=positive(account?.equity,'账户净值');return {basis:'equity',equity,risk_percent:percent,max_loss:positive(equity*(percent/100),'风险预算'),currency:account.currency||''};
}
function estimateTradeRisk(state,args){
 if(!state.bridge_online||!state.connected)throw Error('MT5 未连接或账户数据已过期，无法计算风险');
 const budget=riskBudget(state.account,args.risk_percent??1);
 const symbol=state.symbols?.find(s=>s.symbol===args.symbol);if(!symbol)throw Error('缺少品种合约数据，请在 MT5 打开该品种图表');
 const tick=positive(symbol.tick_size,'最小跳动'),value=positive(symbol.tick_value_loss||symbol.tick_value,'合约 Tick Value');
 const step=positive(symbol.volume_step,'手数步长'),min=positive(symbol.volume_min,'最小手数'),max=positive(symbol.volume_max,'最大手数');
 if(max<min)throw Error('合约手数范围无效');
 const price=positive(args.price,'入场价'),sl=positive(args.sl,'止损价');
 if(!['BUY_LIMIT','SELL_LIMIT'].includes(args.type))throw Error('只支持 BUY_LIMIT / SELL_LIMIT 风险估算');
 const distance=args.type==='BUY_LIMIT'?price-sl:sl-price;if(distance<=0)throw Error('止损方向不正确');
 const lossPerLot=positive(distance/tick*value,'每手止损金额');
 let units=Math.floor(Math.min(max,budget.max_loss/lossPerLot)/step+1e-9),volume=Number((units*step).toFixed(8));
 // Always round down. Never increase the risk target to meet a minimum lot.
 if(volume*lossPerLot>budget.max_loss){units--;volume=Number((units*step).toFixed(8));}
 if(volume<min||volume<=0)throw Error('当前风险预算不足最小手数；不自动提高风险比例或扩大预算');
 const bid=positive(symbol.bid,'Bid'),ask=positive(symbol.ask,'Ask');if(ask<bid)throw Error('Bid/Ask 无效');
 const age=positive(state.server_time,'服务器时间')-positive(symbol.quote_time,'报价时间');if(age>30||age< -3)throw Error('报价已过期，刷新后再计算风险');
 const maxSpread=Number((ask-bid+tick).toFixed(Math.min(12,Math.max(0,Number(symbol.digits)||8))));
 return {...budget,account:state.account.login,server:state.account.server,symbol:args.symbol,type:args.type,price,sl,volume,loss_per_lot_estimate:lossPerLot,estimated_loss:volume*lossPerLot,estimated_percent:volume*lossPerLot/budget.equity*100,max_spread:positive(maxSpread,'点差上限'),spread_policy:'当前真实点差 + 一个最小价格跳动；确认前可调整',method:'tick_value_estimate',final_check:'EA OrderCalcProfit',excludes:['commission','swap','slippage'],published_utc:state.published_utc,quote_time:symbol.quote_time};
}
function prepareRiskOrder(state,args){
 const quote=estimateTradeRisk(state,args),symbol=state.symbols.find(s=>s.symbol===args.symbol);
 const volume=positive(args.volume??quote.volume,'手数'),requested=positive(args.max_loss??quote.max_loss,'止损金额上限');
 const cap=Math.min(requested,quote.max_loss); // A later equity decrease can only lower the approved cap.
 if(volume<symbol.volume_min||volume>symbol.volume_max||Math.abs(volume/symbol.volume_step-Math.round(volume/symbol.volume_step))>1e-6)throw Error('手数不符合合约范围或步长');
 if(volume*quote.loss_per_lot_estimate>cap+Math.max(1,cap)*1e-10)throw Error('预估止损超出单笔风险预算，请重新计算手数');
 const tp=positive(args.tp,'止盈价'),reward=args.type==='BUY_LIMIT'?tp-args.price:args.price-tp;
 if(reward/Math.abs(args.price-args.sl)<1)throw Error('价格 RR 小于 1');
 return {...args,volume,max_loss:cap,max_spread:positive(args.max_spread??quote.max_spread,'点差上限'),risk_percent:quote.risk_percent,risk_basis:'equity',risk_equity:quote.equity};
}
module.exports={POLICY,riskBudget,estimateTradeRisk,prepareRiskOrder};
