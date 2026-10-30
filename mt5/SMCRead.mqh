string smcDataPath(const long chart){return "TXJ_SMC\\"+IntegerToString(chart)+".json";}
string smcDataError(string code,string message)
{CJAVal out;out["ok"]=false;out["error"]=code;out["message"]=message;return out.Serialize();}

const string SMC_DATA_ARRAYS[]={"structure_breaks","order_blocks","fair_value_gaps","swing_pivots",
   "internal_pivots","equal_levels","liquidity_sweeps","targets","trend_timeline","candles","objects"};

bool smcChartHasIndicator(long chart)
{
   for(int w=0;w<(int)ChartGetInteger(chart,CHART_WINDOWS_TOTAL);w++)
      for(int i=0;i<ChartIndicatorsTotal(chart,w);i++)
         if(StringFind(ChartIndicatorName(chart,w,i),"天行健交易系统指挥官 · SMC纯指标")==0)return true;
   return false;
}

// No user-controlled paths, chart changes, iCustom instances or trading calls.
bool smcReadSnapshot(long chart,CJAVal &out,string &error)
{
   if(ChartSymbol(chart)==""){error="CHART_NOT_FOUND";return false;}
   if(!smcChartHasIndicator(chart)){error="SMC_INDICATOR_NOT_ATTACHED";return false;}
   int file=FileOpen(smcDataPath(chart),FILE_READ|FILE_TXT|FILE_ANSI|FILE_SHARE_READ,0,CP_UTF8);
   if(file==INVALID_HANDLE){error="SNAPSHOT_NOT_READY";return false;}
   ulong size=FileSize(file);
   if(size==0 || size>32*1024*1024){FileClose(file);error="SNAPSHOT_SIZE_INVALID";return false;}
   string raw=FileReadString(file);FileClose(file);
   if(!out.Deserialize(raw,CP_UTF8) || out["schema"].ToStr()!="txj.smc.snapshot.v1")
   {error="SNAPSHOT_SCHEMA_INVALID";return false;}
   if(out["snapshot_id"].ToStr()=="" || out["as_of"].ToInt()<=0 ||
      !out.HasKey("analysis_ready",jtBOOL) || !out.HasKey("context",jtOBJ) || !out.HasKey("settings",jtOBJ))
   {error="SNAPSHOT_SCHEMA_INVALID";return false;}
   for(int i=0;i<ArraySize(SMC_DATA_ARRAYS);i++)if(!out.HasKey(SMC_DATA_ARRAYS[i],jtARRAY))
   {error="SNAPSHOT_SCHEMA_INVALID";return false;}
   if(out["chart_id"].ToStr()!=IntegerToString(chart) || out["symbol"].ToStr()!=ChartSymbol(chart) ||
      out["timeframe"].ToStr()!=EnumToString(ChartPeriod(chart)))
   {error="SNAPSHOT_IDENTITY_MISMATCH";return false;}
   long age=(long)TimeLocal()-out["published_local"].ToInt();
   if(age<0 || age>30){error="SNAPSHOT_STALE";return false;}
   error="";return true;
}

void smcCopySummary(CJAVal &source,CJAVal &out)
{
   const string keys[]={"schema","indicator_version","chart_id","symbol","timeframe","period_seconds",
      "snapshot_id","as_of","last_closed_bar","published_local","captured_local","server_time","analysis_ready",
      "data_note","time_basis","scope","array_order","input_bar_count","analysis_start_index","effective_fvg_timeframe","context",
      "premium_discount","mtf","ote","order_flow","signal","sequence","target_note","visuals_visible",
      "objects_captured_local","quote"};
   for(int i=0;i<ArraySize(keys);i++)out[keys[i]].Set(source[keys[i]]);
   for(int i=0;i<ArraySize(SMC_DATA_ARRAYS);i++)out["counts"][SMC_DATA_ARRAYS[i]]=ArraySize(source[SMC_DATA_ARRAYS[i]].m_e);
   out["bridge_age_seconds"]=(long)TimeLocal()-source["published_local"].ToInt();
   // A live heartbeat does not turn old quotes / old closed-bar evidence into new market data.
   long quoteAge=(long)MathMax(TimeCurrent(),TimeTradeServer())-source["as_of"].ToInt();
   out["evidence_lag_server_seconds"]=quoteAge;
   out["terminal_connected"]=(bool)TerminalInfoInteger(TERMINAL_CONNECTED);
   out["market_evidence_stale"]=!TerminalInfoInteger(TERMINAL_CONNECTED) || quoteAge<0 || quoteAge>2*source["period_seconds"].ToInt();
   out["ok"]=true;
}
void smcDataPage(CJAVal &source,CJAVal &out,string section,int offset,int limit)
{
   int total=ArraySize(source[section].m_e),end=(int)MathMin(total,offset+limit);
   out[section].m_type=jtARRAY;
   for(int i=offset;i<end;i++)out[section].Add(source[section][i]);
   out["pages"][section]["offset"]=offset;out["pages"][section]["limit"]=limit;
   out["pages"][section]["total"]=total;out["pages"][section]["has_more"]=end<total;
   out["pages"][section]["next_offset"]=end;
}

string smcProjectSnapshot(CJAVal &source,string section,int offset,int limit,string expected)
{
   if(offset<0 || limit<1 || limit>200)return smcDataError("INVALID_PAGE","offset>=0；limit 为1到200。");
   if(expected!="" && expected!=source["snapshot_id"].ToStr())
      return smcDataError("SNAPSHOT_CHANGED","指标已重算，请从offset=0重新读取，使用新的snapshot_id分页。");
   bool known=section=="all" || section=="summary" || section=="settings";
   for(int i=0;i<ArraySize(SMC_DATA_ARRAYS);i++)if(section==SMC_DATA_ARRAYS[i])known=true;
   if(!known)return smcDataError("UNKNOWN_SECTION","请使用summary、settings、all或工具说明中的数组名称。");
   CJAVal out;smcCopySummary(source,out);
   if(section=="settings" || section=="all")out["settings"].Set(source["settings"]);
   for(int i=0;i<ArraySize(SMC_DATA_ARRAYS);i++)
      if(section=="all" || section==SMC_DATA_ARRAYS[i])smcDataPage(source,out,SMC_DATA_ARRAYS[i],offset,limit);
   return out.Serialize();
}

string listSMCSources()
{
   CJAVal out;out["ok"]=true;out["current_chart_id"]=IntegerToString(ChartID());out["sources"].m_type=jtARRAY;
   for(long chart=ChartFirst();chart>=0;chart=ChartNext(chart))
   {
      if(!smcChartHasIndicator(chart))continue;
      CJAVal row,snapshot;string error;
      row["chart_id"]=IntegerToString(chart);row["symbol"]=ChartSymbol(chart);row["timeframe"]=EnumToString(ChartPeriod(chart));
      bool ready=smcReadSnapshot(chart,snapshot,error);row["bridge_ready"]=ready;
      if(ready){row["analysis_ready"]=snapshot["analysis_ready"].ToBool();row["as_of"].Set(snapshot["as_of"]);row["snapshot_id"].Set(snapshot["snapshot_id"]);}
      else row["error"]=error;
      out["sources"].Add(row);
   }
   out["setup"]="同一终端图表挂载随项目附带的SMC纯指标1.02并启用InpExportAIData；一个图表只挂一个此指标。不同周期需分别挂载。";
   return out.Serialize();
}

